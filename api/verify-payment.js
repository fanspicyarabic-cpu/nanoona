// api/verify-payment.js - التحقق المباشر من صحة المدفوعات مع خوادم SpaceRemit API v2
import { updateInvoiceStatus } from './invoices.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }

    const paymentId = body.payment_id || body.paymentId || body.SP_payment_code;
    const invoiceId = body.invoiceId || body.invoice_number;
    const telegramUser = body.telegramUser || body.userId;

    if (!paymentId) {
      return res.status(400).json({ success: false, message: 'معرّف الدفع (Payment ID) مطلوب للتحقق.' });
    }

    // جلب المفتاح السري حصراً من متغيرات البيئة
    const secretKey = process.env.SPACEREMIT_API_KEY;
    if (!secretKey) {
      console.error('[Verify Error]: SPACEREMIT_API_KEY is missing from environment variables.');
      return res.status(500).json({
        success: false,
        message: 'إعدادات المفتاح السري غير مكتملة في السيرفر.'
      });
    }

    console.log(`[SpaceRemit Verification] التحقق من العملية ${paymentId} عبر payment_info...`);

    const response = await fetch('https://spaceremit.com/api/v2/payment_info/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        private_key: secretKey,
        payment_id: paymentId
      })
    });

    const data = await response.json();
    console.log('[SpaceRemit Verification Response]:', JSON.stringify(data));

    // حالات السداد المؤكدة في SpaceRemit: A (مقبول), B (تم الدفع), D (مكتمل), E, T
    const isSuccess = data && (data.response_status === 'success' || (data.data && ['A', 'B', 'D', 'E', 'T'].includes(data.data.status_tag)));

    if (isSuccess) {
      // تحديث حالة الفاتورة في السيرفر لتكون معتمدة
      if (invoiceId || telegramUser) {
        updateInvoiceStatus(invoiceId || telegramUser, 'approved', {
          paymentId: paymentId,
          verifiedAt: new Date().toISOString()
        });
      }
    }

    return res.status(200).json({
      success: isSuccess,
      verified: isSuccess,
      paymentId: paymentId,
      status: (data.data && data.data.status) || (isSuccess ? 'Completed' : 'Failed'),
      status_tag: data.data ? data.data.status_tag : null,
      raw: data
    });

  } catch (error) {
    console.error('Error verifying payment with SpaceRemit:', error);
    return res.status(500).json({
      success: false,
      message: 'خطأ أثناء التحقق من الدفع: ' + error.message
    });
  }
}
