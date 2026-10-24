export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed. Please use POST.' });
  }

  try {
    const { userId, telegramUsername, amount, serviceType } = req.body || {};

    const cleanTelegram = (telegramUsername || userId || '').trim();
    if (!cleanTelegram) {
      return res.status(400).json({ success: false, message: 'معرّف التليجرام مطلوب للمتابعة.' });
    }

    const payAmount = parseFloat(amount) || 50;

    // جلب المفاتيح الرسمية المباشرة من متغيرات البيئة أو القيم المحددة
    const publicKey = process.env.SPACEREMIT_PUBLIC_KEY || "pkPE7TZ3QSHQ92AOB3KEVU53FHNXD5XBVVOF4PSMNLCP2KORDZZ5";

    const host = req.headers.host || 'nanoona.vercel.app';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    const notes = `${serviceType || 'vip'} - ${cleanTelegram}`;

    // بناء الرابط المباشر الرسمي المعتمد من SpaceRemit
    const paymentUrl = `https://spaceremit.com/apipay-v2/&k=${encodeURIComponent(publicKey)}&amount=${encodeURIComponent(payAmount)}&currency=USD&way=card&notes=${encodeURIComponent(notes)}&name=${encodeURIComponent(cleanTelegram)}`;

    console.log(`[SpaceRemit] Generated checkout URL for ${cleanTelegram}: ${payAmount} USD`);

    return res.status(200).json({
      success: true,
      payment_url: paymentUrl,
      order_id: `SP-${Date.now()}`,
      amount: payAmount,
      currency: 'USD',
      telegram: cleanTelegram
    });

  } catch (error) {
    console.error('Server error creating SpaceRemit payment:', error);
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء إعداد رابط الدفع: ' + error.message
    });
  }
}
