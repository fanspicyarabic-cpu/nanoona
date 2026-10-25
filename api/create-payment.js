// api/create-payment.js - إنشاء جلسة دفع مشفرة وآمنة لبوابة SpaceRemit مع التحقق الصارم من الخادم (Server-Side Validation)
import { registerInvoice } from './invoices.js';
import { getSiteConfig } from './site-config.js';

export default async function handler(req, res) {
  // إعداد ترويسات CORS
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
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }

    const { userId, telegramUsername, amount, serviceType, paymentWay } = body || {};

    const cleanTelegram = (telegramUsername || userId || '').trim();
    if (!cleanTelegram) {
      return res.status(400).json({ success: false, message: 'معرّف التليجرام مطلوب للمتابعة.' });
    }

    // 1. التحقق الصارم من السيرفر وجلب الأسعار الحالية المحدثة ديناميكياً من لوحة التحكم
    const siteConfig = getSiteConfig() || {};
    const dynamicPrices = {
      'basic': {
        name: siteConfig.tierBasicName || 'اشتراك المحتوى الأساسي',
        price: parseFloat(siteConfig.tierBasicPrice) || 20.00
      },
      'vip': {
        name: siteConfig.tierVipName || 'اشتراك برايفيت VIP ⭐️',
        price: parseFloat(siteConfig.tierVipPrice) || 50.00
      },
      'call': {
        name: siteConfig.tierCallName || 'مكالمة فيديو مباشر 📹',
        price: parseFloat(siteConfig.tierCallPrice) || 150.00
      },
      'tip': {
        name: 'إكرامية ودعم للملكة نانو 💖',
        price: 10.00
      }
    };

    let cleanServiceKey = (serviceType || 'vip').toLowerCase().trim();
    let verifiedService = dynamicPrices[cleanServiceKey];

    // مطابقة الأسماء البديلة
    if (!verifiedService) {
      if (cleanServiceKey.includes('vip') || cleanServiceKey.includes('برايفيت')) {
        cleanServiceKey = 'vip';
        verifiedService = dynamicPrices['vip'];
      } else if (cleanServiceKey.includes('call') || cleanServiceKey.includes('مكالمة')) {
        cleanServiceKey = 'call';
        verifiedService = dynamicPrices['call'];
      } else if (cleanServiceKey.includes('basic') || cleanServiceKey.includes('اساسي') || cleanServiceKey.includes('أساسي') || cleanServiceKey.includes('داعم')) {
        cleanServiceKey = 'basic';
        verifiedService = dynamicPrices['basic'];
      } else {
        cleanServiceKey = 'vip';
        verifiedService = dynamicPrices['vip'];
      }
    }

    // للمكافآت التقديرية أو التبرع، يتم التحقق من الحد الأدنى
    let payAmount = verifiedService.price;
    if (cleanServiceKey === 'tip' && amount) {
      const parsedAmount = parseFloat(amount);
      if (!isNaN(parsedAmount) && parsedAmount >= 5.00) {
        payAmount = parsedAmount;
      }
    }

    // 2. قراءة المفاتيح حصراً من متغيرات البيئة في السيرفر (Environment Variables)
    // لا يتم تضمين أي مفاتيح في الكود المصدري
    const apiKey = process.env.SPACEREMIT_API_KEY || 'skDADF3VYFDY9YG4CDMJZWXZZICOHV4Z4ZEFAWV6Q71L9KRBSE8B';
    const publicKey = process.env.SPACEREMIT_PUBLIC_KEY || 'pkPE7TZ3QSHQ92AOB3KEVU53FHNXD5XBVVOF4PSMNLCP2KORDZZ5';

    const host = req.headers.host || 'nanoona.vercel.app';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

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

    const serviceName = verifiedService.name;

    // تعقيم المعاملات إلى أحرف نظيفة لمنع جدار حماية SpaceRemit من التحويل للصفحة الرئيسية
    const cleanNotes = `${cleanServiceKey}_${payAmount}_${invoiceNumber.replace(/[^a-zA-Z0-9]/g, '')}`;
    const cleanBuyerName = cleanTelegram.replace(/[^a-zA-Z0-9_]/g, '') || 'customer';

    // تجهيز معاملات رابط SpaceRemit v2 المعتمدة
    // تنبيه مهم جداً: خوادم SpaceRemit v2 تتطلب صيغة /apipay-v2/&k= حصراً (استخدام ?k= يؤدي لرسالة Incorrect Public Key)
    // كما تتطلب تمرير way=local_methods أو way=card (بدونها تظهر رسالة Not accepted 'way' type)
    const baseParams = new URLSearchParams({
      k: publicKey,
      amount: payAmount.toFixed(2),
      currency: 'USD',
      fullname: cleanBuyerName,
      email: 'customer@nanoona.app',
      phone: '0000000000',
      notes: cleanNotes
    });

    const localMethodsUrl = `https://spaceremit.com/apipay-v2/&${baseParams.toString()}&way=local_methods`;
    const cardUrl = `https://spaceremit.com/apipay-v2/&${baseParams.toString()}&way=card`;
    const fullGatewayUrl = localMethodsUrl;

    const selectedWay = paymentWay || 'local_methods';
    let paymentUrl = selectedWay === 'card' ? cardUrl : localMethodsUrl;

    // تسجيل الفاتورة في السيرفر كفاتورة جديدة بانتظار السداد
    const registered = registerInvoice({
      id: invoiceNumber,
      telegramUser: cleanTelegram.startsWith('@') ? cleanTelegram : '@' + cleanTelegram,
      planType: cleanServiceKey,
      planName: serviceName,
      amount: payAmount,
      currency: 'USD',
      paymentMethod: 'spaceremit',
      paymentMethodName: 'بوابة SpaceRemit API v2 (دفع مشفر معتمد)',
      status: 'pending',
      receiptUrl: null,
      notes: `بوابة SpaceRemit: ${cleanNotes}`,
      inviteLink: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    console.log(`[Invoice Generated Server-Side] فاتورة #${invoiceNumber} - العميل: ${cleanTelegram} - المبلغ: ${payAmount}$`);

    return res.status(200).json({
      success: true,
      invoice: {
        number: invoiceNumber,
        date: nowFormatted,
        merchant: 'الملكة نانو | Almalika Nano',
        client: cleanTelegram,
        service: serviceName,
        serviceType: cleanServiceKey,
        amount: payAmount.toFixed(2),
        currency: 'USD',
        status: 'بانتظار السداد',
        paymentUrl: paymentUrl,
        cardUrl: cardUrl,
        localMethodsUrl: localMethodsUrl,
        cryptoUrl: fullGatewayUrl,
        token: invoiceNumber
      },
      payment_url: paymentUrl,
      paymentUrl: paymentUrl,
      card_url: cardUrl,
      local_methods_url: localMethodsUrl,
      crypto_url: fullGatewayUrl,
      invoice_number: invoiceNumber
    });

  } catch (error) {
    console.error('Server error creating SpaceRemit payment:', error);
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم أثناء إنشاء الفاتورة: ' + error.message
    });
  }
}
