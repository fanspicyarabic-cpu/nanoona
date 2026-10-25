// api/storage.js - طبقة تخزين واسترجاع موحدة ومرنة تدعم Vercel Blob، KV، Upstash والملفات المحلية
import fs from 'fs';
import path from 'path';
import { put, get } from '@vercel/blob';

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

const DEFAULT_POSTS = [];


// دالة ذكية لتحويل أي رابط صورة خارجي (خاصة مواقع الرفع مثل ibb.co و postimg و imgur) إلى رابط مباشر للملف
export async function resolveDirectImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  let finalUrl = url.trim();

  // 1. روابط موقع ImgBB (ibb.co/ID أو imgbb.com/ID)
  const ibbMatch = finalUrl.match(/https?:\/\/(?:www\.)?ibb\.co\/([a-zA-Z0-9]+)/i);
  if (ibbMatch) {
    try {
      const res = await fetch(finalUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      if (res.ok) {
        const html = await res.text();
        const ogMatch = html.match(/<meta property=["']og:image["'] content=["']([^"']+)["']/i);
        if (ogMatch && ogMatch[1]) {
          return ogMatch[1];
        }
        const directMatch = html.match(/https:\/\/i\.ibb\.co\/[a-zA-Z0-9]+\/[^"'\s<>]+/i);
        if (directMatch && directMatch[0]) {
          return directMatch[0];
        }
      }
    } catch (e) {
      console.warn('[Resolve ibb.co failed]:', e.message);
    }
  }

  // 2. روابط موقع PostImages (postimg.cc/ID)
  const postimgMatch = finalUrl.match(/https?:\/\/(?:www\.)?postimg\.cc\/([a-zA-Z0-9]+)/i);
  if (postimgMatch) {
    try {
      const res = await fetch(finalUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      if (res.ok) {
        const html = await res.text();
        const ogMatch = html.match(/<meta property=["']og:image["'] content=["']([^"']+)["']/i);
        if (ogMatch && ogMatch[1]) {
          return ogMatch[1];
        }
      }
    } catch (e) {}
  }

  // 3. روابط Imgur العادية (imgur.com/ID)
  const imgurMatch = finalUrl.match(/https?:\/\/(?:i\.)?imgur\.com\/([a-zA-Z0-9]+)$/i);
  if (imgurMatch) {
    return `https://i.imgur.com/${imgurMatch[1]}.jpg`;
  }

  return finalUrl;
}

// عنوان Vercel Blob الأساسي للمنصة
const BLOB_BASE_URL = 'https://lg9mkoigra1xyncm.public.blob.vercel-storage.com';

// دوال Vercel Blob السحابية الدائمة (مستمرة ولا تتأثر بإعادة تشغيل السيرفرات أو النشر الجديد)
async function blobGet(pathname) {
  // 1. القراءة المباشرة مع download=1 لتجاوز كاش CDN والحصول على أحدث نسخة فورياً من المصدر
  try {
    const url = `${BLOB_BASE_URL}/${pathname}?download=1&_t=${Date.now()}`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    // محاولة بديلة
  }

  // 2. محاولة احتياطية عبر دالة get الخاصة بحزمة @vercel/blob
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    try {
      const res = await get(pathname, {
        token,
        access: 'public'
      });
      if (res && res.statusCode === 200 && res.stream) {
        const chunks = [];
        for await (const chunk of res.stream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        if (chunks.length > 0) {
          const body = Buffer.concat(chunks).toString('utf8');
          return JSON.parse(body);
        }
      }
    } catch (e) {
      // الملف غير متوفر في Blob بعد
    }
  }
  return null;
}

async function blobSet(pathname, data) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return false;
  try {
    await put(pathname, JSON.stringify(data, null, 2), {
      token,
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60
    });
    return true;
  } catch (e) {
    console.warn(`[Blob Set ${pathname} Warning]:`, e.message);
  }
  return false;
}

// كاش في الذاكرة لتسريع الاستجابة
let memoryConfig = null;
let lastConfigFetch = 0;
let memoryPosts = null;
let lastPostsFetch = 0;
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
  const now = Date.now();
  if (memoryConfig !== null && (now - lastConfigFetch < 3000)) {
    return memoryConfig;
  }

  // 1. محاولة القراءة من Vercel Blob (التخزين السحابي الدائم الطازج)
  const fromBlob = await blobGet('site-config.json');
  if (fromBlob && typeof fromBlob === 'object') {
    memoryConfig = { ...DEFAULT_CONFIG, ...fromBlob };
    lastConfigFetch = now;
    return memoryConfig;
  }

  // 2. محاولة السحب من Vercel KV / Upstash
  const fromKv = await kvGet('site_config');
  if (fromKv && typeof fromKv === 'object') {
    memoryConfig = { ...DEFAULT_CONFIG, ...fromKv };
    lastConfigFetch = now;
    return memoryConfig;
  }

  if (memoryConfig) return memoryConfig;

  // 3. محاولة القراءة من data/site-config.json
  const fromFile = readLocalJson('site-config.json', DEFAULT_CONFIG);
  memoryConfig = { ...DEFAULT_CONFIG, ...fromFile };
  lastConfigFetch = now;
  return memoryConfig;
}

// حفظ إعدادات الموقع
export async function saveSiteConfig(newConfig) {
  const current = await loadSiteConfig();
  memoryConfig = {
    ...current,
    ...(newConfig || {})
  };
  lastConfigFetch = Date.now();

  // حفظ سحابي دائم في Vercel Blob
  await blobSet('site-config.json', memoryConfig);

  // حفظ في Vercel KV إن وجد
  await kvSet('site_config', memoryConfig);

  // حفظ محلي في الملف إذا أمكن
  writeLocalJson('site-config.json', memoryConfig);

  return memoryConfig;
}

// 2. جلب المنشورات
export async function loadPosts(options = {}) {
  const now = Date.now();
  const forceFresh = Boolean(options && options.fresh);
  if (!forceFresh && memoryPosts !== null && (now - lastPostsFetch < 2000)) {
    return memoryPosts;
  }

  // 1. محاولة القراءة من Vercel Blob (التخزين السحابي الدائم الطازج)
  const fromBlob = await blobGet('posts.json');
  if (Array.isArray(fromBlob)) {
    memoryPosts = fromBlob;
    lastPostsFetch = now;
    return memoryPosts;
  }

  // 2. محاولة السحب من Vercel KV / Upstash
  const fromKv = await kvGet('site_posts');
  if (Array.isArray(fromKv)) {
    memoryPosts = fromKv;
    lastPostsFetch = now;
    return memoryPosts;
  }

  if (memoryPosts !== null && !forceFresh) return memoryPosts;

  // 3. محاولة القراءة من data/posts.json
  const fromFile = readLocalJson('posts.json', DEFAULT_POSTS);
  memoryPosts = Array.isArray(fromFile) ? fromFile : DEFAULT_POSTS;
  lastPostsFetch = now;
  return memoryPosts;
}

// حفظ المنشورات
export async function savePosts(posts) {
  memoryPosts = Array.isArray(posts) ? [...posts] : [];
  lastPostsFetch = Date.now();

  // حفظ سحابي دائم في Vercel Blob (لا يحذف أبداً حتى بعد أي تحديث أو رفع)
  await blobSet('posts.json', memoryPosts);

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
