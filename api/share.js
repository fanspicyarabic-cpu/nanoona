// api/share.js - مسار مشاركة المنشورات مع دعم كامل لمعاينة الروابط في تويتر (X)، تليجرام، وواتساب
import { loadPosts } from '../lib/storage.js';

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function handler(req, res) {
  const { id } = req.query || {};
  const postId = id ? String(id).trim() : '';

  let post = null;
  if (postId) {
    try {
      const posts = await loadPosts();
      post = posts.find(p => String(p.id) === postId);
    } catch (e) {
      console.warn('[Share Handler Error]:', e.message);
    }
  }

  const siteUrl = 'https://nanoona.vercel.app';
  const defaultAvatar = `${siteUrl}/avatar.jpg`;

  const title = post ? `${escapeHtml(post.title)} | الملكة نانو VIP` : 'الملكة نانو | المنصة الرسمية للمحتوى الحصري VIP 👑';
  const rawDesc = post && post.content ? post.content : 'شاهد المحتوى الحصري واستمتع بالتواصل المباشر مع الملكة نانو على المنصة الرسمية المعتمدة.';
  const description = escapeHtml(rawDesc.slice(0, 200));
  // كشف ذكي للفيديو واستضافة Videy
  let isVideo = false;
  let videoUrl = '';
  let previewImage = defaultAvatar;

  if (post && post.mediaUrl) {
    const rawUrl = post.mediaUrl.trim();
    const videyMatch = rawUrl.match(/(?:videy\.co\/v\/?\?(?:.*&)?id=|videy\.co\/|cdn\.videy\.co\/)([a-zA-Z0-9]+)/i);
    if (videyMatch) {
      isVideo = true;
      videoUrl = `https://cdn.videy.co/${videyMatch[1]}.mp4`;
    } else if (post.mediaType === 'video' || rawUrl.match(/\.(mp4|mov|webm|m4v)$/i)) {
      isVideo = true;
      videoUrl = rawUrl;
    } else if (rawUrl.startsWith('http')) {
      previewImage = rawUrl;
    }
  }

  const imageUrl = previewImage;
  const canonicalUrl = post ? `${siteUrl}/p/${post.id}` : siteUrl;
  const targetAppUrl = post ? `${siteUrl}/#${post.id}` : siteUrl;

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta name="description" content="${description}">

    <!-- Open Graph (معاينة الروابط في تليجرام، واتساب، وفيسبوك) -->
    <meta property="og:type" content="${isVideo ? 'video.other' : 'article'}">
    <meta property="og:site_name" content="الملكة نانو | المنصة الرسمية">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:image:secure_url" content="${imageUrl}">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    ${isVideo ? `<meta property="og:video" content="${videoUrl}">
    <meta property="og:video:secure_url" content="${videoUrl}">
    <meta property="og:video:type" content="video/mp4">` : ''}
    <meta property="og:url" content="${canonicalUrl}">

    <!-- Twitter / X Cards (بطاقة تويتر الكبيرة المميزة) -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${imageUrl}">
    <meta name="twitter:image:alt" content="${title}">

    <link rel="icon" type="image/jpeg" href="${defaultAvatar}">
    <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>

    <style>
      body {
        font-family: 'Tajawal', sans-serif;
        background: radial-gradient(circle at top, #1e1b2e 0%, #0a0a0c 100%);
        min-height: 100vh;
        color: #f1f5f9;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
      }
      .gold-btn {
        background: linear-gradient(135deg, #FACC15 0%, #EAB308 50%, #CA8A04 100%);
        color: #000;
        font-weight: 800;
        transition: all 0.25s ease;
      }
      .gold-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 0 25px rgba(234, 179, 8, 0.45);
      }
    </style>
</head>
<body>
    <div class="max-w-md w-full bg-[#121318]/90 border border-yellow-500/30 rounded-3xl p-6 shadow-2xl backdrop-blur-md text-center">
        <!-- Logo / Avatar -->
        <div class="w-20 h-20 mx-auto rounded-full p-1 bg-gradient-to-tr from-yellow-600 via-yellow-400 to-yellow-200 shadow-xl overflow-hidden mb-4">
            <img src="${defaultAvatar}" alt="الملكة نانو" class="w-full h-full object-cover rounded-full">
        </div>

        <div class="inline-block px-3 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded-full text-yellow-400 text-xs font-bold mb-3">
            ${post && post.isVip ? '🔒 منشور VIP حصري' : '✨ محتوى رسمي موثق'}
        </div>

        <h1 class="text-xl font-black text-white mb-2 leading-tight">${post ? escapeHtml(post.title) : 'الملكة نانو'}</h1>
        <p class="text-xs text-gray-400 mb-6 leading-relaxed">${description}</p>

        ${isVideo && videoUrl ? `
        <div class="rounded-2xl overflow-hidden border border-yellow-500/20 mb-6 max-h-60 bg-black flex items-center justify-center shadow-lg">
            <video src="${videoUrl}" controls playsinline class="w-full max-h-60 object-contain"></video>
        </div>
        ` : (post && post.mediaUrl ? `
        <div class="rounded-2xl overflow-hidden border border-white/10 mb-6 max-h-56 bg-black flex items-center justify-center">
            <img src="${imageUrl}" alt="${title}" class="w-full h-full object-cover" onerror="this.style.display='none'">
        </div>
        ` : '')}

        <a href="${targetAppUrl}" class="gold-btn w-full py-3 px-6 rounded-xl block text-sm shadow-xl mb-3">
            <span>فتح المنشور في المنصة الرسمية 👑</span>
        </a>

        <p class="text-[11px] text-gray-500">جاري توجيهك تلقائياً إلى منصة الملكة نانو الرسمية...</p>
    </div>

    <!-- توجيه المتصفح البشري تلقائياً بعد ثانيتين -->
    <script>
      setTimeout(() => {
        window.location.href = '${targetAppUrl}';
      }, 1500);
    </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}
