// api/admin-auth.js - إدارة مصادقة لوحة التحكم وتغيير كلمة السر بشكل آمن وعديم الحالة (Stateless HMAC)
import crypto from 'crypto';
import { getAdminPassword, setAdminPassword } from './storage.js';

const AUTH_SECRET = process.env.ADMIN_JWT_SECRET || 'nanoona2026_jwt_secret_salt_v1';

// إنشاء توكن مشفر وموقع رقمياً للجلسة (صالحة عبر جميع خوادم Vercel Serverless)
export function generateSessionToken() {
  const timestamp = Date.now();
  const signature = crypto.createHmac('sha256', AUTH_SECRET)
    .update(`${timestamp}`)
    .digest('hex');
  return `${timestamp}.${signature}`;
}

// دالة مساعدة للتحقق من صحة وصلاحية توكن الأدمن بدون الاعتماد على ذاكرة مشتركة
export function isValidAdminToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [timestampStr, signature] = parts;
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;

  // صلاحية الجلسة 7 أيام
  if (Date.now() - timestamp > 7 * 24 * 60 * 60 * 1000) {
    return false;
  }

  const expectedSignature = crypto.createHmac('sha256', AUTH_SECRET)
    .update(`${timestamp}`)
    .digest('hex');

  if (signature.length !== expectedSignature.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch (e) {
    return false;
  }
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
      const currentAdminPassword = await getAdminPassword();

      // 1. تسجيل الدخول
      if (action === 'login' || (!action && password)) {
        const inputPass = (password || '').trim();
        if (inputPass === currentAdminPassword) {
          const sessionToken = generateSessionToken();

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

        // التحقق من توكن الجلسة أولاً
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

        // تحديث كلمة السر
        await setAdminPassword(newPass);
        const newSessionToken = generateSessionToken();

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
