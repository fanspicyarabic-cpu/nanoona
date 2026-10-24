// api/approve-invoice.js - إنشاء رابط انضمام تليجرام فردي صالح لمرة واحدة وتأكيد الفاتورة
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

    const { invoiceId, telegramUser, planName, botToken: customBotToken, channelId: customChannelId } = body || {};

    const botToken = customBotToken || process.env.TELEGRAM_BOT_TOKEN;
    const channelId = customChannelId || process.env.TELEGRAM_CHANNEL_ID || '@nnano14';

    console.log(`[Invoice Approval] تفعيل الفاتورة: ${invoiceId} للمستخدم: ${telegramUser}`);

    let inviteLink = null;
    let botStatus = 'skipped_no_token';

    // في حال توفر Bot Token و Channel ID نقوم بطلب رابط فردي صالح لمرة واحدة (member_limit: 1)
    if (botToken && channelId) {
      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/createChatInviteLink`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: channelId,
            name: `VIP-${invoiceId || Date.now()}`,
            member_limit: 1, // رابط فردي صالح لمستخدم واحد فقط لمنع المشاركة
            creates_join_request: false
          })
        });

        const tgData = await tgRes.json();
        if (tgData && tgData.ok && tgData.result && tgData.result.invite_link) {
          inviteLink = tgData.result.invite_link;
          botStatus = 'link_generated';
          console.log(`[Telegram Bot] تم إنشاء رابط انضمام فردي بنجاح: ${inviteLink}`);
        } else {
          console.warn('[Telegram Bot API Warning]:', tgData);
          botStatus = 'error_generating_link';
        }
      } catch (tgErr) {
        console.error('[Telegram Bot API Error]:', tgErr);
        botStatus = 'network_error';
      }
    }

    // إذا لم يتوفر البوت أو واجه خطأ، نوفر رابط القناة الرسمي الاحتياطي
    if (!inviteLink) {
      inviteLink = `https://t.me/nnano14?start=vip_${invoiceId || 'confirmed'}`;
    }

    return res.status(200).json({
      success: true,
      invoiceId: invoiceId,
      status: 'approved',
      telegramUser: telegramUser,
      planName: planName,
      inviteLink: inviteLink,
      botStatus: botStatus,
      approvedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Approve Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء معالجة الفاتورة: ' + error.message
    });
  }
}
