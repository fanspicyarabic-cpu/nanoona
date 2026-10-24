// api/posts.js - إدارة محتوى التغذية الحصرية وتصنيف الوسائط
let memoryPosts = [
  {
    id: 'post-1',
    title: 'جلسة تصوير خاصة وحصرية لجمهور VIP 📸✨',
    content: 'كواليس حصرية من جلسة التصوير الجديدة مع لمسات الميك-أب الملكي والإطلالة الذهبية. شاركوني رأيكم بالتعليقات!',
    mediaUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=900&auto=format&fit=crop',
    mediaType: 'image',
    isVip: true,
    likes: 142,
    views: 1250,
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
  },
  {
    id: 'post-2',
    title: 'مقطع فيديو ترحيبي خاص بالأعضاء الجدد 📹👑',
    content: 'أهلاً بكم في عالمي الخاص! في هذا الفيديو القصير أشارككم خطة الأسبوع والمفاجآت القادمة لمشتركي البرايفيت.',
    mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    mediaType: 'video',
    isVip: false,
    likes: 289,
    views: 3410,
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString()
  },
  {
    id: 'post-3',
    title: 'بث مباشر مسجل ومحادثة حصرية عن أسرار الرشاقة 💎',
    content: 'تسجيل كامل للبث المباشر الأخير مع الملكة نانو، إجابات على أسئلة المتابعين ودردشة عفوية مليئة بالطاقة الإيجابية.',
    mediaUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    mediaType: 'youtube',
    isVip: true,
    likes: 415,
    views: 5200,
    createdAt: new Date(Date.now() - 3600000 * 36).toISOString()
  }
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: جلب المنشورات
  if (req.method === 'GET') {
    const { type, isVip } = req.query || {};
    let filtered = memoryPosts;

    if (type && type !== 'all') {
      if (type === 'video') {
        filtered = filtered.filter(p => p.mediaType === 'video' || p.mediaType === 'youtube' || p.mediaType === 'vimeo');
      } else if (type === 'image') {
        filtered = filtered.filter(p => p.mediaType === 'image');
      }
    }

    if (isVip !== undefined && isVip !== '') {
      const vipBool = isVip === 'true' || isVip === '1';
      filtered = filtered.filter(p => p.isVip === vipBool);
    }

    return res.status(200).json({
      success: true,
      posts: filtered,
      count: filtered.length
    });
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

      memoryPosts.unshift(newPost);

      return res.status(201).json({
        success: true,
        message: 'تم نشر المنشور بنجاح',
        post: newPost
      });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  // DELETE: حذف منشور
  if (req.method === 'DELETE') {
    const { id } = req.query || {};
    if (!id) return res.status(400).json({ success: false, message: 'معرف المنشور مطلوب' });

    memoryPosts = memoryPosts.filter(p => p.id !== id);
    return res.status(200).json({ success: true, message: 'تم حذف المنشور بنجاح' });
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
}
