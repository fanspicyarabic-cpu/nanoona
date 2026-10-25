// api/site-config.js - إدارة وتخصيص واجهة الموقع وإعدادات البوت بالكامل
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
  
  // أسعار وتفاصيل باقات الاشتراك
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

  // إعدادات بوت وتليجرام
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  telegramChannelId: process.env.TELEGRAM_CHANNEL_ID || "@nnano14",
  
  // محافظ ووسائل محلية احتياطية
  instapayAccount: "nanoona@instapay",
  vodafoneCash: "01023456789",
  zainCash: "07812345678"
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: إرجاع إعدادات الموقع الحالية
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      config: siteConfig
    });
  }

  // POST: تحديث إعدادات الموقع من لوحة التحكم
  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
      }

      // دمج الإعدادات الجديدة مع القديمة
      siteConfig = {
        ...siteConfig,
        ...(body || {})
      };

      console.log('[Site Config Updated]:', JSON.stringify(body));

      return res.status(200).json({
        success: true,
        message: 'تم تحديث إعدادات واجهة الموقع بنجاح',
        config: siteConfig
      });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
}
