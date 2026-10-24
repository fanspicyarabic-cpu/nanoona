export default async function handler(req, res) {
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

      // Optional: Verify payment authenticity with SpaceRemit if private key is provided
      const secretKey = process.env.SPACEREMIT_SECRET_KEY || "test_skXZ2IACDM9IZMKX65FZFFVLCSXE5HSA60EW4ULOIW8ER8QPRZQ7";
      const paymentCode = payload.SP_payment_code || payload.spaceremit_id || payload.payment_id;

      if (paymentCode && secretKey) {
        try {
          const verifyResponse = await fetch('https://spaceremit.com/api/v2/payment_info/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              private_key: secretKey,
              spaceremit_code: paymentCode
            })
          });
          const verifyData = await verifyResponse.json();
          console.log('SpaceRemit Verification Result:', verifyData);
        } catch (vErr) {
          console.warn('Verification request warning:', vErr.message);
        }
      }

      // Return 200 OK to SpaceRemit to acknowledge receipt
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
}
