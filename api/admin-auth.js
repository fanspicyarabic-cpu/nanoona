// api/admin-auth.js - إدارة مصادقة لوحة التحكم وتغيير كلمة السر بشكل آمن
import crypto from 'crypto';

// كلمة السر في ذاكرة السيرفر، مع إمكانية تحديدها عبر متغيرات البيئة ADMIN_PASSWORD
let currentAdminPassword = process.env.ADMIN_PASSWORD || 'nanoona2026';

// قائمة التوكنات النشطة لجلسات الأدمن المعتمدة
const activeSessions = new Map();

// إنشاء توكن عشوائي ومشفر للجلسة
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

// دالة مساعدة للتحقق من صلاحيات الأدمن عبر ترويسات الطلب أو التوكن
export function isValidAdminToken(token) {
  if (!token) return false;
  const session = activeSessions.get(token);
  if (!session) return false;
  // صلاحية الجلسة 24 ساعة
  if (Date.now() - session.createdAt > 24 * 60 * 60 * 1000) {
    activeSessions.delete(token);
    return false;
  }
  return true;
}

export function getCurrentAdminPassword() {
  return currentAdminPassword;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: فحص صلاحية توكن الجلسة الحالية
  if (req.method === 'GET') {
    const token = req.query.token || req.headers['x-admin-token'] || (req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null);
    const valid = isValidAdminToken(token);
    return res.status(200).json({
      authenticated: valid
    });
  }

  // POST: تسجيل الدخول أو تغيير كلمة السر
  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
      }

      const { action, password, oldPassword, newPassword, token } = body || {};

      // 1. تسجيل الدخول
      if (action === 'login' || (!action && password)) {
        const inputPass = (password || '').trim();
        if (inputPass === currentAdminPassword) {
          const sessionToken = generateSessionToken();
          activeSessions.set(sessionToken, {
            createdAt: Date.now()
          });

          return res.status(200).json({
            success: true,
            token: sessionToken,
            message: 'تم تسجيل الدخول بنجاح'
          });
        } else {
          return res.status(401).json({
            success: false,
            message: 'كلمة السر غير صحيحة! يرجى التأكد والمحاولة مجدداً.'
          });
        }
      }

      // 2. تغيير كلمة السر من لوحة التحكم
      if (action === 'change-password') {
        const adminToken = token || req.headers['x-admin-token'] || (req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null);
        
        // التحقق من توكن الجلسة أولاً لضمان عدم وصول أي شخص خارجي
        if (!isValidAdminToken(adminToken)) {
          return res.status(403).json({
            success: false,
            message: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً.'
          });
        }

        const oldPass = (oldPassword || '').trim();
        const newPass = (newPassword || '').trim();

        if (!oldPass || !newPass) {
          return res.status(400).json({
            success: false,
            message: 'يرجى إدخال كلمة السر الحالية والجديدة.'
          });
        }

        if (oldPass !== currentAdminPassword) {
          return res.status(400).json({
            success: false,
            message: 'كلمة السر الحالية غير مطابقة!'
          });
        }

        if (newPass.length < 6) {
          return res.status(400).json({
            success: false,
            message: 'يجب أن تتكون كلمة السر الجديدة من 6 خانات على الأقل.'
          });
        }

        // تحديث كلمة السر وتجديد التوكن
        currentAdminPassword = newPass;
        const newSessionToken = generateSessionToken();
        activeSessions.set(newSessionToken, {
          createdAt: Date.now()
        });

        console.log('🔒 [Security] تم تغيير كلمة سر لوحة التحكم بنجاح');

        return res.status(200).json({
          success: true,
          token: newSessionToken,
          message: 'تم تغيير كلمة السر بنجاح! تم تحديث بيانات الدخول.'
        });
      }

      return res.status(400).json({
        success: false,
        message: 'إجراء غير مدعوم'
      });

    } catch (e) {
      return res.status(500).json({
        success: false,
        message: 'خطأ في معالجة طلب المصادقة: ' + e.message
      });
    }
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
}
