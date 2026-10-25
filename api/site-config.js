// api/site-config.js - إدارة وتخصيص واجهة الموقع وإعدادات البوت بأمان مع دعم التخزين الدائم
import { isValidAdminToken } from './admin-auth.js';
import { loadSiteConfig, saveSiteConfig } from '../lib/storage.js';

export async function getSiteConfig() {
  return await loadSiteConfig();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: إرجاع إعدادات الموقع بعد حجب المفاتيح والتوكنات السرية
  if (req.method === 'GET') {
    try {
      const siteConfig = await loadSiteConfig();
      const safeConfig = { ...siteConfig };
      safeConfig.hasBotToken = Boolean(siteConfig.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN);
      delete safeConfig.telegramBotToken;

      return res.status(200).json({
        success: true,
        config: safeConfig
      });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  // POST: تحديث إعدادات الموقع (حصرياً للأدمن المعتمد مع التحقق من توكن الجلسة)
  if (req.method === 'POST') {
    try {
      const token = req.headers['x-admin-token'] || (req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null);
      if (!isValidAdminToken(token)) {
        return res.status(403).json({
          success: false,
          message: 'جلسة العمل غير صالحة أو غير مصرح لك بتعديل الإعدادات.'
        });
      }

      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
      }

      const currentConfig = await loadSiteConfig();
      const incomingBotToken = body.telegramBotToken ? body.telegramBotToken.trim() : null;

      const updateData = {
        ...body
      };

      if (!incomingBotToken) {
        updateData.telegramBotToken = currentConfig.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || "";
      } else {
        updateData.telegramBotToken = incomingBotToken;
      }

      const updated = await saveSiteConfig(updateData);
      console.log('[Site Config Updated Securely and Persisted]');

      const safeConfig = { ...updated };
      safeConfig.hasBotToken = Boolean(safeConfig.telegramBotToken);
      delete safeConfig.telegramBotToken;

      return res.status(200).json({
        success: true,
        message: 'تم تحديث إعدادات واجهة الموقع بنجاح وحفظها',
        config: safeConfig
      });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
}
