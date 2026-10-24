export default async function handler(req, res) {
  // إعداد ترويسات CORS للسماح بالطلبات
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed. يرجى استخدام طريقة POST.' });
  }

  try {
    const { userId, telegramUsername, amount, serviceType } = req.body || {};

    const cleanTelegram = (telegramUsername || userId || '').trim();
    if (!cleanTelegram) {
      return res.status(400).json({ success: false, message: 'معرّف التليجرام مطلوب للمتابعة.' });
    }

    const payAmount = parseFloat(amount) || 50;

    // جلب المفاتيح من متغيرات البيئة في Vercel
    const apiKey = process.env.SPACEREMIT_API_KEY || "skDADF3VYFDY9YG4CDMJZWXZZICOHV4Z4ZEFAWV6Q71L9KRBSE8B";
    const publicKey = process.env.SPACEREMIT_PUBLIC_KEY || "pkPE7TZ3QSHQ92AOB3KEVU53FHNXD5XBVVOF4PSMNLCP2KORDZZ5";

    const host = req.headers.host || 'nanoona.vercel.app';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    // تجهيز الـ Payload المطلوب لمعايير SpaceRemit API v2
    const requestPayload = {
      amount: payAmount,
      currency: 'USD',
      private_key: apiKey,
      secret_key: apiKey,
      success_url: `${baseUrl}/?payment=success&telegram=${encodeURIComponent(cleanTelegram)}`,
      cancel_url: `${baseUrl}/?payment=canceled`,
      webhook_url: `${baseUrl}/api/webhook`,
      customer: {
        name: cleanTelegram,
        telegram: cleanTelegram,
        service: serviceType || 'vip'
      },
      custom_data: {
        userId: cleanTelegram,
        telegramUsername: cleanTelegram,
        serviceType: serviceType || 'vip',
        timestamp: new Date().toISOString()
      }
    };

    console.log('====================================================');
    console.log('[SpaceRemit API Request] إرسال طلب إنشاء الدفع:');
    console.log('Payload:', JSON.stringify(requestPayload, null, 2));
    console.log('====================================================');

    let paymentUrl = null;
    let rawApiResponse = null;
    let apiStatus = null;

    // 1. إرسال الطلب لنقطة نهاية SpaceRemit API v2
    try {
      const response = await fetch('https://spaceremit.com/api/v2/payment/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestPayload)
      });

      apiStatus = response.status;
      const responseText = await response.text();

      // طباعة الاستجابة بالكامل في سجلات Vercel كما طلبت تماماً
      console.log('====================================================');
      console.log(`[SpaceRemit API Response] كود الحالة: ${apiStatus}`);
      console.log('نص الاستجابة بالكامل (Raw Response):', responseText);
      console.log('====================================================');

      try {
        rawApiResponse = JSON.parse(responseText);
        
        // فحص كافة الحقول المحتملة التي قد تحمل رابط الفاتورة الفريد
        paymentUrl = rawApiResponse.payment_url || 
                     rawApiResponse.checkout_url || 
                     rawApiResponse.invoice_url || 
                     rawApiResponse.url || 
                     rawApiResponse.link || 
                     (rawApiResponse.data && (rawApiResponse.data.payment_url || rawApiResponse.data.url || rawApiResponse.data.link || rawApiResponse.data.checkout_url));

      } catch (jsonErr) {
        console.warn('[SpaceRemit Notice] الاستجابة لم تكن JSON (قد تكون صفحة توجيه HTML):', responseText.substring(0, 200));
      }

    } catch (fetchErr) {
      console.error('[SpaceRemit API Error] فشل الاتصال بالبوابة:', fetchErr.message);
    }

    // 2. إذا لم ترجع البوابة رابط فاتورة JSON فريد (مثل نظام الـ Embedded Checkout الرسمي للبوابة):
    if (!paymentUrl) {
      console.warn('[SpaceRemit Fallback] استخدام الرابط المباشر للبوابة.');
      const notes = `${serviceType || 'vip'} - ${cleanTelegram}`;
      paymentUrl = `https://spaceremit.com/apipay-v2/&k=${encodeURIComponent(publicKey)}&amount=${encodeURIComponent(payAmount)}&currency=USD&way=card&notes=${encodeURIComponent(notes)}&name=${encodeURIComponent(cleanTelegram)}`;
    }

    console.log('====================================================');
    console.log('[Final Payment URL] الرابط المرسل للمستخدم:', paymentUrl);
    console.log('====================================================');

    return res.status(200).json({
      success: true,
      payment_url: paymentUrl,
      order_id: `SP-${Date.now()}`,
      amount: payAmount,
      currency: 'USD',
      telegram: cleanTelegram,
      debug: {
        api_status: apiStatus,
        response: rawApiResponse
      }
    });

  } catch (error) {
    console.error('Server error creating SpaceRemit payment:', error);
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم أثناء إنشاء الدفع: ' + error.message
    });
  }
}
