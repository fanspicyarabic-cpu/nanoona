// api/invoices.js - إدارة الفواتير والمحافظ المحلية
// يدعم تخزين الفواتير والاسترجاع السريع المتوافق مع بيئة Vercel Serverless
let memoryInvoices = [
  {
    id: 'INV-849102',
    telegramUser: '@ahmed_vip',
    planType: 'vip',
    planName: 'اشتراك برايفيت VIP ⭐',
    amount: 50,
    currency: 'USD',
    paymentMethod: 'instapay',
    paymentMethodName: 'InstaPay (انستاباي مصر)',
    status: 'approved',
    receiptUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500&auto=format&fit=crop',
    inviteLink: 'https://t.me/+AbCdEfGh12345',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'INV-626507',
    telegramUser: '@kareem_iraq',
    planType: 'vip',
    planName: 'اشتراك برايفيت VIP ⭐',
    amount: 50,
    currency: 'USD',
    paymentMethod: 'zaincash',
    paymentMethodName: 'زين كاش (العراق)',
    status: 'pending',
    receiptUrl: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=500&auto=format&fit=crop',
    inviteLink: null,
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    updatedAt: new Date(Date.now() - 1800000).toISOString()
  },
  {
    id: 'INV-391824',
    telegramUser: '@saud_vip',
    planType: 'call',
    planName: 'مكالمة فيديو مباشر 📹',
    amount: 30,
    currency: 'USD',
    paymentMethod: 'spaceremit',
    paymentMethodName: 'بوابة SpaceRemit API v2 (دفع معتمد)',
    status: 'approved',
    receiptUrl: null,
    inviteLink: 'https://t.me/+XyZ12345Link',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    updatedAt: new Date(Date.now() - 5400000).toISOString()
  }
];

export function registerInvoice(newInvoice) {
  memoryInvoices.unshift(newInvoice);
  return newInvoice;
}

export function updateInvoiceStatus(idOrUser, status, details = {}) {
  const clean = (idOrUser || '').replace('@', '').toLowerCase();
  const inv = memoryInvoices.find(i => i.id === idOrUser || i.telegramUser.replace('@', '').toLowerCase() === clean);
  if (inv) {
    inv.status = status;
    Object.assign(inv, details);
    inv.updatedAt = new Date().toISOString();
    return inv;
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: إرجاع قائمة الفواتير والإحصائيات
  if (req.method === 'GET') {
    const { status, id } = req.query || {};

    if (id) {
      const single = memoryInvoices.find(inv => inv.id === id);
      if (single) return res.status(200).json({ success: true, invoice: single });
      return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });
    }

    let filtered = memoryInvoices;
    if (status && status !== 'all') {
      filtered = memoryInvoices.filter(inv => inv.status === status);
    }

    const stats = {
      totalRevenue: memoryInvoices.filter(i => i.status === 'approved').reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0),
      activeSubscribers: memoryInvoices.filter(i => i.status === 'approved').length,
      pendingCount: memoryInvoices.filter(i => i.status === 'pending').length,
      totalInvoices: memoryInvoices.length
    };

    return res.status(200).json({
      success: true,
      invoices: filtered,
      stats: stats
    });
  }

  // POST: إنشاء فاتورة جديدة قادمة من الدفع المحلي أو SpaceRemit
  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
      }

      const { telegramUser, planType, planName, amount, paymentMethod, paymentMethodName, receiptUrl, notes } = body || {};

      if (!telegramUser) {
        return res.status(400).json({ success: false, message: 'معرّف التليجرام مطلوب' });
      }

      const newId = `INV-${Math.floor(100000 + Math.random() * 900000)}`;
      const newInvoice = {
        id: newId,
        telegramUser: telegramUser.startsWith('@') ? telegramUser : '@' + telegramUser,
        planType: planType || 'vip',
        planName: planName || 'اشتراك برايفيت VIP ⭐',
        amount: parseFloat(amount) || 50,
        currency: 'USD',
        paymentMethod: paymentMethod || 'local_wallet',
        paymentMethodName: paymentMethodName || 'محفظة إلكترونية محلية',
        status: 'pending',
        receiptUrl: receiptUrl || null,
        notes: notes || '',
        inviteLink: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      memoryInvoices.unshift(newInvoice);

      return res.status(201).json({
        success: true,
        message: 'تم تسجيل الفاتورة بنجاح وهي قيد المراجعة',
        invoice: newInvoice
      });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  // PUT: تحديث حالة الفاتورة (موافقة / رفض / إضافة رابط الانضمام)
  if (req.method === 'PUT') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
      }

      const { id, status, inviteLink } = body || {};
      const index = memoryInvoices.findIndex(inv => inv.id === id);

      if (index === -1) {
        return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });
      }

      if (status) memoryInvoices[index].status = status;
      if (inviteLink) memoryInvoices[index].inviteLink = inviteLink;
      memoryInvoices[index].updatedAt = new Date().toISOString();

      return res.status(200).json({
        success: true,
        message: 'تم تحديث الفاتورة بنجاح',
        invoice: memoryInvoices[index]
      });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
}
