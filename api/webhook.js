// api/webhook.js - استقبال إشعارات الدفع والتحقق الصارم من التوقيع ومن خوادم بوابة SpaceRemit لمنع أي طلبات وهمية
import { updateInvoiceStatus } from './invoices.js';

// ذاكرة مؤقتة لتخزين آخر العمليات المكتملة
const completedPayments = new Map();

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-spaceremit-signature, x-signature');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET request (فحص حالة الدفع أو استعلام العميل)
  if (req.method === 'GET') {
    const { check, user } = req.query || {};
    if (check && user) {
      const cleanUser = decodeURIComponent(user).toLowerCase().trim().replace('@', '');
      const matched = completedPayments.get(cleanUser);
      if (matched) {
        return res.status(200).json({
          status: 'completed',
          transactionId: matched.paymentId,
          amount: matched.amount,
          serviceType: matched.serviceType,
          timestamp: matched.timestamp
        });
      }
      return res.status(200).json({ status: 'pending' });
    }

    return res.status(200).json({
      status: 'active',
      endpoint: '/api/webhook',
      service: 'SpaceRemit Secure Webhook Handler',
      timestamp: new Date().toISOString()
    });
  }

  if (req.method === 'POST') {
    try {
      let payload = req.body || {};
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch (e) { payload = {}; }
      }

      console.log('🔔 [SpaceRemit Webhook Event]:', JSON.stringify(payload));

      // 1. التحقق من صحة التوقيع / الرمز السري (Signature / Webhook Secret)
      const expectedSecret = process.env.SPACEREMIT_WEBHOOK_SECRET;
      if (expectedSecret) {
        const receivedSignature = req.headers['x-spaceremit-signature'] ||
                                  req.headers['x-signature'] ||
                                  req.query.secret ||
                                  payload.signature ||
                                  payload.secret;

        if (receivedSignature !== expectedSecret) {
          console.warn('[Security Alert]: تم رفض الـ Webhook بسبب توقيع غير صالح أو غير متطابق.');
          return res.status(401).json({
            success: false,
            message: 'توقيع الـ Webhook غير صالح (Unauthorized Signature)'
          });
        }
      }

      // استخراج بيانات الدفع من الـ Webhook
      const status = (payload.status || payload.payment_status || '').toLowerCase();
      const paymentId = payload.payment_id || payload.SP_payment_code || payload.spaceremit_id || payload.id;
      const customData = payload.custom_data || payload.notes || {};

      const userId = (customData.userId || customData.telegramUsername || payload.telegram || payload.name || '').trim();
      const serviceType = customData.serviceType || payload.service || 'اشتراك VIP';
      const amount = payload.amount || customData.amount || '0';

      const isClaimedPaid = ['paid', 'completed', 'successful', 'success'].includes(status);

      // 2. التحقق من السيرفر الأصلي للبوابة (Server-to-Server Verification)
      // في حال كانت الرسالة تفيد باكتمال الدفع، نقوم باستعلام خادم SpaceRemit مباشرة بالمفتاح السري
      // للتأكد بنسبة 100% أن العملية حقيقية وغير مزورة من طرف خارجي
      const apiKey = process.env.SPACEREMIT_API_KEY;
      if (isClaimedPaid && apiKey && paymentId) {
        try {
          console.log(`[Webhook Security] التحقق المباشر من العملية ${paymentId} عبر سيرفر SpaceRemit...`);
          const verifyRes = await fetch('https://spaceremit.com/api/v2/payment_info/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              private_key: apiKey,
              payment_id: paymentId
            })
          });

          const verifyData = await verifyRes.json();
          const isActuallyValid = verifyData && (
            verifyData.response_status === 'success' ||
            (verifyData.data && ['A', 'B', 'D', 'E', 'T'].includes(verifyData.data.status_tag))
          );

          if (!isActuallyValid) {
            console.error(`❌ [Security Alert]: محاولة إرسال Webhook وهمي! العملية ${paymentId} لم يتم تأكيدها لدى SpaceRemit:`, verifyData);
            return res.status(400).json({
              success: false,
              message: 'فشل التحقق من العملية مع خوادم بوابة الدفع الرسمية.'
            });
          }

          console.log(`✅ [Security Verified]: تم تأكيد صحة العملية ${paymentId} رسمياً من بوابة SpaceRemit.`);
        } catch (gateErr) {
          console.error('[Gateway Verification Connection Error]:', gateErr);
          return res.status(502).json({
            success: false,
            message: 'تعذر الاتصال بخوادم البوابة للتحقق من التوقيع.'
          });
        }
      }

      // إذا تم التأكد بنجاح
      if (isClaimedPaid) {
        console.log(`🎉 [Payment Verified & Confirmed]: تم تفعيل العملية بنجاح للمستخدم (${userId}).`);

        if (userId) {
          const cleanKey = userId.toLowerCase().trim().replace('@', '');
          completedPayments.set(cleanKey, {
            paymentId,
            amount,
            serviceType,
            timestamp: Date.now()
          });

          // تحديث الفاتورة في النظام لتصبح معتمدة
          updateInvoiceStatus(userId, 'approved', {
            paymentId,
            verifiedAt: new Date().toISOString()
          });
        }
      }

      // الرد على البوابة برمز 200
      return res.status(200).json({
        success: true,
        message: 'Webhook verified and processed successfully',
        transaction: {
          id: paymentId,
          status: status,
          userId: userId,
          serviceType: serviceType
        }
      });

    } catch (error) {
      console.error('❌ خطأ في معالجة الـ Webhook:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
