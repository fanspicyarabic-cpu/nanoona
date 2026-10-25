// api/storage.js - طبقة تخزين واسترجاع موحدة ومرنة تدعم Vercel KV و Upstash والملفات المحلية
import fs from 'fs';
import path from 'path';

// إعدادات افتراضية
const DEFAULT_CONFIG = {
  celebrityName: "الملكة نانو",
  celebrityTitle: "صانعة محتوى حصري | تجربة التواصل المباشر وVIP",
  celebrityBio: "مرحباً بكم في العالم الخاص بالملكة نانو. تم إنشاء هذه المنصة لتوفير تجربة تواصل آمنة وحصرية مع المتابعين المميزين، بعيداً عن قيود منصات التواصل التقليدية.",
  avatarUrl: "avatar.jpg",
  coverUrl: "avatar.jpg",
  followersCount: "1.2M",
  subscribersCount: "154K",
  viewsCount: "5.4M",
  likesCount: "3.8M",
  tierBasicName: "اشتراك المحتوى الأساسي",
  tierBasicPrice: "20.00",
  tierVipName: "اشتراك برايفيت VIP ⭐",
  tierVipPrice: "50.00",
  tierCallName: "مكالمة فيديو مباشر 📹",
  tierCallPrice: "150.00",
  showTelegram: true,
  telegramChannel: "https://t.me/nnano14",
  showTiktok: true,
  tiktokUrl: "https://fanspicy.com/nanoona1/",
  showInstagram: true,
  instagramUrl: "https://fanspicy.com/nanoona1/",
  showSnapchat: true,
  snapchatUrl: "https://fanspicy.com/nanoona1/",
  showWhatsapp: false,
  whatsappNumber: "",
  showTwitter: false,
  twitterUrl: "",
  showYoutube: false,
  youtubeUrl: "",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  telegramChannelId: process.env.TELEGRAM_CHANNEL_ID || "@nnano14",
  instapayAccount: "nanoona@instapay",
  vodafoneCash: "01023456789",
  zainCash: "07812345678",
  enableCardPayment: false,
  adsterraEnabled: false,
  adsterraHeaderCode: "",
  adsterraTopBannerEnabled: false,
  adsterraTopBannerCode: "",
  adsterraBottomBannerEnabled: false,
  adsterraBottomBannerCode: ""
};

const DEFAULT_POSTS = [
  {
    id: "post-1",
    title: "جلسة تصوير خاصة وحصرية لجمهور VIP 📸✨",
    content: "كواليس حصرية من جلسة التصوير الجديدة مع لمسات الميك-أب الملكي والإطلالة الذهبية. شاركوني رأيكم بالتعليقات!",
    mediaUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=900&auto=format&fit=crop",
    mediaType: "image",
    isVip: true,
    likes: 142,
    views: 1250,
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
  },
  {
    id: "post-2",
    title: "مقطع فيديو ترحيبي خاص بالأعضاء الجدد 📹👑",
    content: "أهلاً بكم في عالمي الخاص! في هذا الفيديو القصير أشارككم خطة الأسبوع والمفاجآت القادمة لمشتركي البرايفيت.",
    mediaUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    mediaType: "video",
    isVip: false,
    likes: 289,
    views: 3410,
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString()
  },
  {
    id: "post-3",
    title: "بث مباشر مسجل ومحادثة حصرية عن أسرار الرشاقة 💎",
    content: "تسجيل كامل للبث المباشر الأخير مع الملكة نانو، إجابات على أسئلة المتابعين ودردشة عفوية مليئة بالطاقة الإيجابية.",
    mediaUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    mediaType: "youtube",
    isVip: true,
    likes: 415,
    views: 5200,
    createdAt: new Date(Date.now() - 3600000 * 36).toISOString()
  }
];

// كاش في الذاكرة لتسريع الاستجابة
let memoryConfig = null;
let memoryPosts = null;
let memoryPassword = null;

// التحقق من توفر Vercel KV أو Upstash Redis REST API
function getKvConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    return { url, token };
  }
  return null;
}

async function kvGet(key) {
  const kv = getKvConfig();
  if (!kv) return null;
  try {
    const res = await fetch(`${kv.url}/get/${key}`, {
      headers: { Authorization: `Bearer ${kv.token}` }
    });
    const data = await res.json();
    if (data && data.result) {
      return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
    }
  } catch (e) {
    console.warn(`[KV Get Error on ${key}]:`, e.message);
  }
  return null;
}

async function kvSet(key, value) {
  const kv = getKvConfig();
  if (!kv) return false;
  try {
    await fetch(`${kv.url}/set/${key}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${kv.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(value)
    });
    return true;
  } catch (e) {
    console.warn(`[KV Set Error on ${key}]:`, e.message);
  }
  return false;
}

function getLocalFilePath(filename) {
  const candidates = [
    path.join(process.cwd(), 'data', filename),
    path.join(process.cwd(), filename),
    path.resolve('data', filename)
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

function readLocalJson(filename, fallback) {
  try {
    const p = getLocalFilePath(filename);
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    // تجاهل أخطاء الملفات المحلية في بيئات معينة
  }
  return fallback;
}

function writeLocalJson(filename, data) {
  try {
    const dir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const p = getLocalFilePath(filename);
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    // بيئة قراءة فقط (مثل خوادم Vercel Serverless بدون إمكانية كتابة)
    return false;
  }
}

// 1. جلب إعدادات الموقع
export async function loadSiteConfig() {
  if (memoryConfig) return memoryConfig;

  // محاولة السحب من Vercel KV / Upstash
  const fromKv = await kvGet('site_config');
  if (fromKv && typeof fromKv === 'object') {
    memoryConfig = { ...DEFAULT_CONFIG, ...fromKv };
    return memoryConfig;
  }

  // محاولة القراءة من data/site-config.json
  const fromFile = readLocalJson('site-config.json', DEFAULT_CONFIG);
  memoryConfig = { ...DEFAULT_CONFIG, ...fromFile };
  return memoryConfig;
}

// حفظ إعدادات الموقع
export async function saveSiteConfig(newConfig) {
  const current = await loadSiteConfig();
  memoryConfig = {
    ...current,
    ...(newConfig || {})
  };

  // حفظ في Vercel KV إن وجد
  await kvSet('site_config', memoryConfig);

  // حفظ محلي في الملف إذا أمكن
  writeLocalJson('site-config.json', memoryConfig);

  return memoryConfig;
}

// 2. جلب المنشورات
export async function loadPosts() {
  if (memoryPosts !== null) return memoryPosts;

  // محاولة السحب من Vercel KV / Upstash
  const fromKv = await kvGet('site_posts');
  if (Array.isArray(fromKv)) {
    memoryPosts = fromKv;
    return memoryPosts;
  }

  // محاولة القراءة من data/posts.json
  const fromFile = readLocalJson('posts.json', DEFAULT_POSTS);
  memoryPosts = Array.isArray(fromFile) ? fromFile : DEFAULT_POSTS;
  return memoryPosts;
}

// حفظ المنشورات
export async function savePosts(posts) {
  memoryPosts = Array.isArray(posts) ? posts : [];

  // حفظ في Vercel KV إن وجد
  await kvSet('site_posts', memoryPosts);

  // حفظ محلي في الملف إذا أمكن
  writeLocalJson('posts.json', memoryPosts);

  return memoryPosts;
}

// 3. كلمة سر الأدمن
export async function getAdminPassword() {
  if (memoryPassword) return memoryPassword;

  const fromKv = await kvGet('admin_password');
  if (fromKv && typeof fromKv === 'string') {
    memoryPassword = fromKv;
    return memoryPassword;
  }

  memoryPassword = process.env.ADMIN_PASSWORD || 'nanoona2026';
  return memoryPassword;
}

export async function setAdminPassword(newPassword) {
  memoryPassword = (newPassword || '').trim();
  await kvSet('admin_password', memoryPassword);
  return memoryPassword;
}
