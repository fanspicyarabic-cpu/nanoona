// api/publish.js - أتمتة النشر المزدوج إلى قناة تليجرام عبر Telegram Bot API مع معالجة ذكية للأخطاء
import { loadSiteConfig } from '../lib/storage.js';

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }

    const {
      title,
      content,
      mediaUrl,
      mediaType,
      isVip,
      botToken: customBotToken,
      channelId: customChannelId,
      buttonText,
      buttonUrl
    } = body || {};

    // جلب إعدادات الموقع المحفوظة تلقائياً إذا لم يتم تمرير الرمز في الطلب
    const config = await loadSiteConfig();
    const botToken = (customBotToken && customBotToken.trim()) || config.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
    const channelId = (customChannelId && customChannelId.trim()) || config.telegramChannelId || process.env.TELEGRAM_CHANNEL_ID || '@nnano14';

    if (!botToken) {
      return res.status(400).json({
        success: false,
        broadcastStatus: 'no_bot_token',
        message: 'لم يتم العثور على رمز بوت تليجرام (Telegram Bot Token)! يرجى الانتقال إلى تبويب "إعدادات البوت والمحافظ" في لوحة التحكم، وإدخال رمز البوت والنقر على حفظ أولاً.'
      });
    }

    if (!channelId) {
      return res.status(400).json({
        success: false,
        broadcastStatus: 'no_channel_id',
        message: 'يرجى تحديد معرف القناة (مثال: @nnano14 أو معرف الـ ID الرقمي) في الإعدادات.'
      });
    }

    // تجهيز النص بنظام HTML الآمن لمنع أي تعارض مع الرموز التعبيرية والنصوص الخاصة
    const caption = `👑 <b>${escapeHtml(title || 'منشور جديد من الملكة نانو')}</b>\n\n${escapeHtml(content || '')}\n\n${isVip ? '🔒 <i>محتوى حصري لمشتركي VIP</i>' : '✨ <i>متاح للجميع</i>'}`;

    // تجهيز الأزرار التفاعلية المخصصة (Inline Keyboard Button)
    const btnLabel = (buttonText || '').trim() || 'اشترك الآن ودخول القناة VIP ⭐️';
    let btnLink = (buttonUrl || '').trim() || 'https://nanoona.vercel.app';
    if (!btnLink.startsWith('http://') && !btnLink.startsWith('https://')) {
      btnLink = `https://${btnLink}`;
    }

    const replyMarkup = {
      inline_keyboard: [
        [{ text: btnLabel, url: btnLink }]
      ]
    };

    let broadcastResult = null;
    let broadcastStatus = 'unknown';

    let targetMediaUrl = (mediaUrl || '').trim();
    let targetMediaType = mediaType || 'image';

    const videyMatch = targetMediaUrl.match(/(?:videy\.co\/v\/?\?(?:.*&)?id=|videy\.co\/|cdn\.videy\.co\/)([a-zA-Z0-9]+)/i);
    if (videyMatch) {
      targetMediaUrl = `https://cdn.videy.co/${videyMatch[1]}.mp4`;
      targetMediaType = 'video';
    } else if (targetMediaUrl.match(/\.(mp4|mov|webm|m4v)$/i)) {
      targetMediaType = 'video';
    }

    // 1. محاولة الإرسال كصورة
    if (targetMediaType === 'image' && targetMediaUrl && targetMediaUrl.startsWith('http')) {
      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: channelId,
            photo: targetMediaUrl,
            caption: caption.slice(0, 1024),
            parse_mode: 'HTML',
            reply_markup: replyMarkup
          })
        });
        broadcastResult = await tgRes.json();
      } catch (err) {
        console.warn('[SendPhoto Failed, falling back to message]:', err.message);
      }
    }
    // 2. محاولة الإرسال كفيديو مباشر
    else if (targetMediaType === 'video' && targetMediaUrl && targetMediaUrl.match(/\.(mp4|mov|webm)$/i)) {
      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendVideo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: channelId,
            video: targetMediaUrl,
            caption: caption.slice(0, 1024),
            parse_mode: 'HTML',
            reply_markup: replyMarkup
          })
        });
        broadcastResult = await tgRes.json();
      } catch (err) {
        console.warn('[SendVideo Failed, falling back to message]:', err.message);
      }
    }

    // 3. إذا لم يتم الإرسال أو فشلت الصورة/الفيديو (مثلاً الرابط خارجي)، يتم إرسال رسالة نصية مدعمة برابط المعاينة
    if (!broadcastResult || !broadcastResult.ok) {
      const textWithMedia = mediaUrl ? `${caption}\n\n🎬 <b>رابط الوسائط:</b> <a href="${mediaUrl}">${mediaUrl}</a>` : caption;
      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: channelId,
          text: textWithMedia,
          parse_mode: 'HTML',
          disable_web_page_preview: false,
          reply_markup: replyMarkup
        })
      });
      broadcastResult = await tgRes.json();
    }

    if (broadcastResult && broadcastResult.ok) {
      broadcastStatus = 'sent_successfully';
      return res.status(200).json({
        success: true,
        broadcastStatus: broadcastStatus,
        message: 'تم النشر بنجاح على القناة وتوليد الزر التفاعلي! 🚀',
        broadcastResult: broadcastResult
      });
    } else {
      broadcastStatus = 'failed_telegram_api';
      const tgDesc = (broadcastResult && broadcastResult.description) || 'تعذر البث إلى قناة تليجرام';
      return res.status(200).json({
        success: false,
        broadcastStatus: broadcastStatus,
        message: `تعذر النشر في قناة تليجرام: ${tgDesc} (يرجى التأكد من إضافة البوت كمشرف Admin داخل القناة ولديه صلاحية نشر الرسائل).`,
        broadcastResult: broadcastResult
      });
    }

  } catch (error) {
    console.error('[Publish Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'خطأ أثناء النشر: ' + error.message
    });
  }
}
