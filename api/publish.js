// api/publish.js - أتمتة النشر المزدوج إلى قناة تليجرام عبر Telegram Bot API
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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

    const { title, content, mediaUrl, mediaType, isVip, botToken: customBotToken, channelId: customChannelId } = body || {};

    const botToken = customBotToken || process.env.TELEGRAM_BOT_TOKEN;
    const channelId = customChannelId || process.env.TELEGRAM_CHANNEL_ID || '@nnano14';

    console.log(`[Smart Publisher] طلب نشر منشور: "${title}" (النوع: ${mediaType || 'text'}, VIP: ${isVip})`);

    let broadcastResult = null;
    let broadcastStatus = 'no_bot_token';

    if (botToken && channelId) {
      const caption = `👑 *${title || 'منشور جديد من الملكة نانو'}* \n\n${content || ''}\n\n${isVip ? '🔒 _محتوى حصري لمشتركي VIP_' : '✨ _متاح للجميع_'}\n\n🔗 للاشتراك والدعم: https://nanoona.vercel.app`;

      try {
        if (mediaType === 'image' && mediaUrl) {
          // إرسال صورة
          const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: channelId,
              photo: mediaUrl,
              caption: caption,
              parse_mode: 'Markdown'
            })
          });
          broadcastResult = await tgRes.json();
        } else if (mediaType === 'video' && mediaUrl && mediaUrl.match(/\.(mp4|mov|webm)$/i)) {
          // إرسال فيديو مباشر
          const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendVideo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: channelId,
              video: mediaUrl,
              caption: caption,
              parse_mode: 'Markdown'
            })
          });
          broadcastResult = await tgRes.json();
        } else {
          // إرسال نص مع الرابط
          const textWithMedia = mediaUrl ? `${caption}\n\n🎬 رابط الوسائط: ${mediaUrl}` : caption;
          const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: channelId,
              text: textWithMedia,
              parse_mode: 'Markdown',
              disable_web_page_preview: false
            })
          });
          broadcastResult = await tgRes.json();
        }

        if (broadcastResult && broadcastResult.ok) {
          broadcastStatus = 'sent_successfully';
        } else {
          broadcastStatus = 'failed_telegram_api';
          console.warn('[Telegram Broadcast Warning]:', broadcastResult);
        }
      } catch (tgErr) {
        console.error('[Telegram Broadcast Error]:', tgErr);
        broadcastStatus = 'network_error';
      }
    }

    return res.status(200).json({
      success: true,
      broadcastStatus: broadcastStatus,
      broadcastResult: broadcastResult,
      publishedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Publish Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'خطأ أثناء النشر: ' + error.message
    });
  }
}
