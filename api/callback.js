module.exports = async (req, res) => {
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
      console.log('SpaceRemit Callback Received:', JSON.stringify(payload));

      return res.status(200).json({
        success: true,
        message: 'Callback received and verified successfully',
        data: payload
      });
    } catch (error) {
      console.error('Error handling SpaceRemit callback:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // GET request (for browser verification)
  return res.status(200).json({
    status: 'online',
    message: 'SpaceRemit Webhook Endpoint for nanoona.vercel.app is active and ready.',
    mode: 'test'
  });
};
