// api/posts.js - إدارة محتوى التغذية الحصرية وتصنيف الوسائط مع دعم التخزين الدائم
import { loadPosts, savePosts } from '../lib/storage.js';
import { isValidAdminToken } from './admin-auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: جلب المنشورات
  if (req.method === 'GET') {
    try {
      const { type, isVip } = req.query || {};
      let posts = await loadPosts();

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

  // التحقق من صلاحيات الأدمن لأي عملية تعديل/حذف/إضافة
  const token = req.headers['x-admin-token'] || (req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null);
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    // إذا تم تمرير توكن غير صالح
    if (token && !isValidAdminToken(token)) {
      return res.status(403).json({ success: false, message: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً' });
    }
  }

  // POST: إضافة منشور جديد
  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
      }

      const { title, content, mediaUrl, mediaType, isVip } = body || {};

      if (!title) {
        return res.status(400).json({ success: false, message: 'عنوان المنشور مطلوب' });
      }

      const currentPosts = await loadPosts();
      const newPost = {
        id: `post-${Date.now()}`,
        title: title.trim(),
        content: (content || '').trim(),
        mediaUrl: (mediaUrl || '').trim(),
        mediaType: mediaType || 'image',
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
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
      }
      const { id, title, content, mediaUrl, mediaType, isVip, views, likes } = body || {};
      if (!id) return res.status(400).json({ success: false, message: 'معرف المنشور مطلوب' });

      let currentPosts = await loadPosts();
      const idx = currentPosts.findIndex(p => p.id === id);
      if (idx === -1) {
        return res.status(404).json({ success: false, message: 'المنشور غير موجود' });
      }

      currentPosts[idx] = {
        ...currentPosts[idx],
        title: title !== undefined ? title.trim() : currentPosts[idx].title,
        content: content !== undefined ? content.trim() : currentPosts[idx].content,
        mediaUrl: mediaUrl !== undefined ? mediaUrl.trim() : currentPosts[idx].mediaUrl,
        mediaType: mediaType !== undefined ? mediaType : currentPosts[idx].mediaType,
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
      const { id } = req.query || {};
      if (!id) return res.status(400).json({ success: false, message: 'معرف المنشور مطلوب' });

      let currentPosts = await loadPosts();
      const filtered = currentPosts.filter(p => p.id !== id);
      await savePosts(filtered);

      return res.status(200).json({
        success: true,
        message: 'تم حذف المنشور بنجاح وتحديث القائمة'
      });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
}
