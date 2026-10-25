// api/site-config.js - إدارة وتخصيص واجهة الموقع وإعدادات البوت بأمان
import { isValidAdminToken } from './admin-auth.js';

let siteConfig = {
  // بيانات المشهورة والبروفايل
  celebrityName: "الملكة نانو",
  celebrityTitle: "صانعة محتوى حصري | تجربة التواصل المباشر وVIP",
  celebrityBio: "مرحباً بكم في العالم الخاص بالملكة نانو. تم إنشاء هذه المنصة لتوفير تجربة تواصل آمنة وحصرية مع المتابعين المميزين، بعيداً عن قيود منصات التواصل التقليدية.",
  avatarUrl: "avatar.jpg",
  coverUrl: "avatar.jpg",
  
  // مؤشرات الإحصائيات في البروفايل
  followersCount: "1.2M",
  subscribersCount: "154K",
  likesCount: "3.8M",
  
  // أسعار وتفاصيل باقات الاشتراك المعتمدة
  tierBasicName: "اشتراك المحتوى الأساسي",
  tierBasicPrice: "20.00",
  tierVipName: "اشتراك برايفيت VIP ⭐️",
  tierVipPrice: "50.00",
  tierCallName: "مكالمة فيديو مباشر 📹",
  tierCallPrice: "150.00",
  
  // روابط التواصل الاجتماعي
  telegramChannel: "https://t.me/nnano14",
  whatsappNumber: "https://wa.me/qr/6SUMEKHOZNDUK1",
  tiktokUrl: "https://t.me/nnano14",
  instagramUrl: "https://t.me/nnano14",
  snapchatUrl: "https://t.me/nnano14",

  // إعدادات بوت وتليجرام (لا يتم كشفها للواجهة الأمامية في GET)
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  telegramChannelId: process.env.TELEGRAM_CHANNEL_ID || "@nnano14",
  
  // محافظ ووسائل محلية احتياطية
  instapayAccount: "nanoona@instapay",
  vodafoneCash: "01023456789",
  zainCash: "07812345678",

  // تفعيل أو إخفاء الدفع بالبطاقة البنكية (Visa / MasterCard) من لوحة التحكم
  enableCardPayment: false
};

export function getSiteConfig() {
  return siteConfig;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: إرجاع إعدادات الموقع بعد حجب المفاتيح والتوكنات السرية تماماً لمنع فحصها عبر F12
  if (req.method === 'GET') {
    const safeConfig = { ...siteConfig };
    safeConfig.hasBotToken = Boolean(siteConfig.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN);
    // حجب التوكن الحساس لمنع كشفه في أدوات المطور للمتصفح
    delete safeConfig.telegramBotToken;

    return res.status(200).json({
      success: true,
      config: safeConfig
    });
  }

  // POST: تحديث إعدادات الموقع (حصرياً للأدمن المعتمد مع التحقق من توكن الجلسة)
  if (req.method === 'POST') {
    try {
      const token = req.headers['x-admin-token'] || (req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null);
      if (!isValidAdminToken(token)) {
        return res.status(403).json({
          success: false,
          message: 'جلسة العمل غير صالحة أو غير مصرح لك بتعديل الإعدادات.'
        });
      }

      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
      }

      // الحفاظ على توكن البوت القديم إذا لم يرسل المستخدم توكناً جديداً
      const incomingBotToken = body.telegramBotToken ? body.telegramBotToken.trim() : null;

      siteConfig = {
        ...siteConfig,
        ...(body || {})
      };

      if (!incomingBotToken) {
        siteConfig.telegramBotToken = siteConfig.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || "";
      } else {
        siteConfig.telegramBotToken = incomingBotToken;
      }

      console.log('[Site Config Updated Securely]');

      const safeConfig = { ...siteConfig };
      safeConfig.hasBotToken = Boolean(siteConfig.telegramBotToken);
      delete safeConfig.telegramBotToken;

      return res.status(200).json({
        success: true,
        message: 'تم تحديث إعدادات واجهة الموقع بنجاح',
        config: safeConfig
      });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
}
