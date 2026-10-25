// api/test-bot.js - فحص وتأكيد تفعيل بوت تليجرام وصلاحيات القناة
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

    const { botToken, channelId } = body || {};

    const token = (botToken || process.env.TELEGRAM_BOT_TOKEN || '').trim();
    const channel = (channelId || process.env.TELEGRAM_CHANNEL_ID || '@nnano14').trim();

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال رمز Telegram Bot Token أولاً'
      });
    }

    // 1. فحص معلومات البوت عبر getMe
    const botRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const botData = await botRes.json();

    if (!botData.ok) {
      return res.status(400).json({
        success: false,
        message: `رمز البوت غير صالح: ${botData.description || 'Unknown error'}`
      });
    }

    const botUser = botData.result;

    // 2. فحص القناة إذا كانت مدخلة عبر getChat
    let channelInfo = null;
    let channelError = null;

    if (channel) {
      try {
        const chatRes = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(channel)}`);
        const chatData = await chatRes.json();
        if (chatData.ok) {
          channelInfo = {
            title: chatData.result.title || chatData.result.username,
            type: chatData.result.type,
            id: chatData.result.id
          };
        } else {
          channelError = chatData.description;
        }
      } catch (err) {
        channelError = err.message;
      }
    }

    return res.status(200).json({
      success: true,
      bot: {
        id: botUser.id,
        name: botUser.first_name,
        username: botUser.username
      },
      channel: channelInfo,
      channelError: channelError,
      message: `تم التحقق بنجاح! البوت @${botUser.username} نشط وجاهز للنشر المباشر.`
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `خطأ في الاتصال: ${error.message}`
    });
  }
}
