// api/posts.js - إدارة محتوى التغذية الحصرية وتصنيف الوسائط مع دعم التخزين الدائم
import { loadPosts, savePosts, resolveDirectImageUrl } from '../lib/storage.js';
import { isValidAdminToken } from './admin-auth.js';
import { put } from '@vercel/blob';

function normalizeMedia(url, type) {
  let finalMediaUrl = (url || '').trim();
  let finalMediaType = type || 'image';

  if (!finalMediaUrl) {
    return { mediaUrl: '', mediaType: finalMediaType };
  }

  const videyMatch = finalMediaUrl.match(/(?:videy\.co\/v\/?\?(?:.*&)?id=|videy\.co\/|cdn\.videy\.co\/)([a-zA-Z0-9]+)/i);
  if (videyMatch) {
    return { mediaUrl: `https://cdn.videy.co/${videyMatch[1]}.mp4`, mediaType: 'video' };
  }

  if (finalMediaUrl.includes('youtube.com') || finalMediaUrl.includes('youtu.be')) {
    return { mediaUrl: finalMediaUrl, mediaType: 'youtube' };
  }

  if (finalMediaUrl.match(/\.(mp4|webm|mov|m4v|ogg)$/i)) {
    return { mediaUrl: finalMediaUrl, mediaType: 'video' };
  }

  return { mediaUrl: finalMediaUrl, mediaType: finalMediaType };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: جلب المنشورات
  if (req.method === 'GET') {
    try {
      const { type, isVip, category, _t } = req.query || {};
      const forceFresh = Boolean(_t);
      let posts = await loadPosts({ fresh: forceFresh });

      if (category && category !== 'all') {
        posts = posts.filter(p => (p.category || 'photos') === category);
      }

      if (type && type !== 'all') {
        if (type === 'video') {
          posts = posts.filter(p => p.mediaType === 'video' || p.mediaType === 'youtube' || p.mediaType === 'vimeo');
        } else if (type === 'image') {
          posts = posts.filter(p => p.mediaType === 'image');
        }
      }

      if (isVip !== undefined && isVip !== '') {
        const vipBool = isVip === 'true' || isVip === '1';
        posts = posts.filter(p => p.isVip === vipBool);
      }

      return res.status(200).json({
        success: true,
        posts: posts,
        count: posts.length
      });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  // التحقق من صلاحيات الأدمن لأي عملية تعديل/حذف/إضافة/رفع
  const token = req.headers['x-admin-token'] || (req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null);
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    if (token && !isValidAdminToken(token)) {
      return res.status(403).json({ success: false, message: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً' });
    }
  }

  // مسار رفع صور الأغلفة والوسائط مباشرة إلى Vercel Blob
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }

  if (req.method === 'POST' && ((req.query && req.query.action === 'upload') || (body && body.action === 'upload'))) {
    try {
      const { fileData, fileName, contentType } = body || {};
      if (!fileData) {
        return res.status(400).json({ success: false, message: 'بيانات الملف مطلوبة للرفع' });
      }

      const matches = fileData.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      const buffer = matches ? Buffer.from(matches[2], 'base64') : Buffer.from(fileData, 'base64');
      const mime = (matches && matches[1]) || contentType || 'image/jpeg';
      const cleanName = (fileName || `cover-${Date.now()}.jpg`).replace(/[^a-zA-Z0-9._-]/g, '_');
      const blobPath = `covers/${Date.now()}-${cleanName}`;

      const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
      const blobRes = await put(blobPath, buffer, {
        token: blobToken,
        access: 'public',
        contentType: mime,
        addRandomSuffix: true
      });

      return res.status(200).json({
        success: true,
        message: 'تم رفع الغلاف بنجاح وتوليد رابط دائم',
        url: blobRes.url
      });
    } catch (e) {
      return res.status(500).json({ success: false, message: 'فشل رفع الملف: ' + e.message });
    }
  }

  // POST: إضافة منشور جديد
  if (req.method === 'POST') {
    try {
      const { title, content, mediaUrl, mediaType, isVip, category, thumbnail } = body || {};

      if (!title) {
        return res.status(400).json({ success: false, message: 'عنوان المنشور مطلوب' });
      }

      // تحويل الروابط الخارجية (مثل ibb.co) تلقائياً إلى روابط صور مباشرة
      const resolvedMediaUrl = mediaUrl ? await resolveDirectImageUrl(mediaUrl) : '';
      const resolvedThumbnail = thumbnail ? await resolveDirectImageUrl(thumbnail) : '';

      const normalized = normalizeMedia(resolvedMediaUrl, mediaType);

      const currentPosts = await loadPosts({ fresh: true });
      const newPost = {
        id: `post-${Date.now()}`,
        title: title.trim(),
        content: (content || '').trim(),
        mediaUrl: normalized.mediaUrl,
        mediaType: normalized.mediaType,
        thumbnail: (resolvedThumbnail || '').trim(),
        category: (category || 'photos').trim(),
        isVip: Boolean(isVip),
        likes: 0,
        views: 1,
        createdAt: new Date().toISOString()
      };

      currentPosts.unshift(newPost);
      await savePosts(currentPosts);

      return res.status(201).json({
        success: true,
        message: 'تم نشر المنشور بنجاح وحفظه',
        post: newPost
      });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  // PUT: تعديل منشور موجود
  if (req.method === 'PUT') {
    try {
      const { id, title, content, mediaUrl, mediaType, isVip, views, likes, category, thumbnail } = body || {};
      if (!id) return res.status(400).json({ success: false, message: 'معرف المنشور مطلوب' });

      let currentPosts = await loadPosts({ fresh: true });
      const idx = currentPosts.findIndex(p => String(p.id) === String(id));
      if (idx === -1) {
        return res.status(404).json({ success: false, message: 'المنشور غير موجود' });
      }

      let updatedMediaUrl = mediaUrl !== undefined ? mediaUrl.trim() : currentPosts[idx].mediaUrl;
      let updatedMediaType = mediaType !== undefined ? mediaType : currentPosts[idx].mediaType;

      if (mediaUrl !== undefined) {
        const resolved = await resolveDirectImageUrl(updatedMediaUrl);
        const norm = normalizeMedia(resolved, updatedMediaType);
        updatedMediaUrl = norm.mediaUrl;
        updatedMediaType = norm.mediaType;
      }

      let updatedThumbnail = currentPosts[idx].thumbnail || '';
      if (thumbnail !== undefined) {
        updatedThumbnail = await resolveDirectImageUrl(thumbnail.trim());
      }

      currentPosts[idx] = {
        ...currentPosts[idx],
        title: title !== undefined ? title.trim() : currentPosts[idx].title,
        content: content !== undefined ? content.trim() : currentPosts[idx].content,
        mediaUrl: updatedMediaUrl,
        mediaType: updatedMediaType,
        thumbnail: updatedThumbnail,
        category: category !== undefined ? category.trim() : (currentPosts[idx].category || 'photos'),
        isVip: isVip !== undefined ? Boolean(isVip) : currentPosts[idx].isVip,
        views: views !== undefined ? views : currentPosts[idx].views,
        likes: likes !== undefined ? likes : currentPosts[idx].likes,
        updatedAt: new Date().toISOString()
      };

      await savePosts(currentPosts);

      return res.status(200).json({
        success: true,
        message: 'تم تعديل المنشور بنجاح وحفظ التغيير',
        post: currentPosts[idx]
      });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  // DELETE: حذف منشور
  if (req.method === 'DELETE') {
    try {
      const id = (req.query && req.query.id) || (body && body.id);
      if (!id) return res.status(400).json({ success: false, message: 'معرف المنشور مطلوب للحذف' });

      let currentPosts = await loadPosts({ fresh: true });
      const filtered = currentPosts.filter(p => String(p.id).trim() !== String(id).trim());
      await savePosts(filtered);

      return res.status(200).json({
        success: true,
        message: 'تم حذف المنشور بنجاح وتحديث القائمة نهائياً',
        deletedId: id,
        remainingCount: filtered.length
      });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
}
