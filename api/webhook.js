export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const payload = req.body || {};
      console.log('✅ SpaceRemit Webhook Received Event:', JSON.stringify(payload));

      // استخراج بيانات الدفع من الـ Webhook
      const status = payload.status || payload.payment_status || 'unknown';
      const paymentId = payload.payment_id || payload.SP_payment_code || payload.spaceremit_id || payload.id;
      const customData = payload.custom_data || payload.notes || {};

      // استخراج معرّف التليجرام ونوع الخدمة
      const userId = customData.userId || customData.telegramUsername || payload.telegram || 'غير محدد';
      const serviceType = customData.serviceType || payload.service || 'اشتراك';
      const amount = payload.amount || customData.amount || '0';

      console.log(`💳 تفاصيل العملية:
      - رقم العملية: ${paymentId}
      - الحالة: ${status}
      - المستخدم: ${userId}
      - الخدمة: ${serviceType}
      - المبلغ: ${amount} $`);

      // التحقق من حالة الدفع (مدفوع / مكتمل)
      if (['paid', 'completed', 'successful', 'success'].includes(status.toLowerCase())) {
        console.log(`🎉 [تأكيد التفعيل]: تم استلام الدفع بنجاح للمستخدم (${userId}). سيتم تفعيل الخدمة (${serviceType}).`);
        
        // هنا يمكنك إضافة إرسال رسالة تليجرام للبوت الخاص بك أو تخزينها بقاعدة بيانات:
        // await notifyTelegramBot(userId, serviceType, amount);
      } else {
        console.log(`⚠️ حالة الدفع غير مكتملة حالياً: ${status}`);
      }

      // الرد على SpaceRemit برمز 200 لتأكيد استلام الإشعار بنجاح
      return res.status(200).json({
        success: true,
        message: 'Webhook received and processed successfully',
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

  // GET request (فحص صحة نقطة النهاية في المتصفح)
  return res.status(200).json({
    status: 'active',
    endpoint: '/api/webhook',
    service: 'SpaceRemit Webhook Handler for nanoona.vercel.app',
    timestamp: new Date().toISOString()
  });
}
