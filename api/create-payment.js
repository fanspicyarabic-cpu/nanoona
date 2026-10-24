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

    // إنشاء رقم فاتورة فريد وتوثيقي
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
    const nowFormatted = new Date().toLocaleString('ar-EG', {
      timeZone: 'Asia/Riyadh',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const serviceTitles = {
      'vip': 'اشتراك برايفيت VIP ⭐',
      'call': 'مكالمة فيديو مباشر 📹',
      'tip': 'إكرامية ودعم للملكة نانو 💖'
    };
    const serviceName = serviceTitles[serviceType] || 'خدمة مخصصة';

    const notes = `${serviceName} - ${cleanTelegram} (${invoiceNumber})`;
    const paymentUrl = `https://spaceremit.com/apipay-v2/&k=${encodeURIComponent(publicKey)}&amount=${encodeURIComponent(payAmount)}&currency=USD&way=card&notes=${encodeURIComponent(notes)}&name=${encodeURIComponent(cleanTelegram)}`;

    console.log('====================================================');
    console.log(`[Invoice Generated] تم إنشاء الفاتورة رقم ${invoiceNumber}:`);
    console.log('العميل:', cleanTelegram);
    console.log('المبلغ:', payAmount, 'USD');
    console.log('الخدمة:', serviceName);
    console.log('رابط SpaceRemit:', paymentUrl);
    console.log('====================================================');

    return res.status(200).json({
      success: true,
      invoice: {
        number: invoiceNumber,
        date: nowFormatted,
        merchant: 'الملكة نانو | Almalika Nano',
        client: cleanTelegram,
        service: serviceName,
        serviceType: serviceType || 'vip',
        amount: payAmount.toFixed(2),
        currency: 'USD',
        status: 'بانتظار السداد',
        paymentUrl: paymentUrl
      },
      payment_url: paymentUrl
    });

  } catch (error) {
    console.error('Server error creating SpaceRemit payment:', error);
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم أثناء إنشاء الفاتورة: ' + error.message
    });
  }
}

