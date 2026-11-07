const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const PAYPAL_BASE = 'https://api-m.sandbox.paypal.com';
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';

async function getAccessToken() {
  const creds = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('PayPal auth failed: ' + JSON.stringify(data));
  return data.access_token;
}

// GET /api/paypal/config — safe to expose (client ID only, never secret)
router.get('/config', (req, res) => {
  res.json({
    clientId: PAYPAL_CLIENT_ID || 'sb',
    currency: 'USD',
    configured: Boolean(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET),
  });
});

// POST /api/paypal/create-order
router.post('/create-order', async (req, res) => {
  const { amount, campaign_id, donor_name } = req.body;
  if (!amount || !campaign_id) return res.status(400).json({ error: 'amount and campaign_id required' });
  if (parseFloat(amount) < 1) return res.status(400).json({ error: 'Minimum donation is $1' });

  db.get(`SELECT id, title, status FROM campaigns WHERE id = ?`, [campaign_id], async (err, campaign) => {
    if (err || !campaign) return res.status(404).json({ error: 'Campaign not found' });

    try {
      const accessToken = await getAccessToken();
      const FRONTEND = process.env.FRONTEND_URL || 'https://sentria-samadhan-frontend.onrender.com';

      const ppRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': uuidv4(),
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{
            reference_id: campaign_id,
            description: `Donation: ${campaign.title}`,
            amount: { currency_code: 'USD', value: parseFloat(amount).toFixed(2) },
            custom_id: campaign_id,
          }],
          application_context: {
            brand_name: 'Sentria Samadhan',
            user_action: 'PAY_NOW',
            return_url: `${FRONTEND}/campaigns/${campaign_id}?payment=success`,
            cancel_url: `${FRONTEND}/campaigns/${campaign_id}?payment=cancelled`,
          },
        }),
      });

      const order = await ppRes.json();
      if (!order.id) {
        console.error('PayPal order error:', order);
        return res.status(500).json({ error: 'PayPal order creation failed', details: order });
      }

      const donationId = 'don-' + uuidv4().split('-')[0];
      db.run(
        `INSERT INTO donations (id, campaign_id, donor_name, amount, currency, paypal_order_id, status) VALUES (?,?,?,?,?,?,?)`,
        [donationId, campaign_id, donor_name || 'Anonymous', amount, 'USD', order.id, 'pending']
      );

      res.json({ orderID: order.id, donationId });
    } catch (e) {
      console.error('create-order error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });
});

// POST /api/paypal/capture-order/:orderID
router.post('/capture-order/:orderID', async (req, res) => {
  const { orderID } = req.params;
  try {
    const accessToken = await getAccessToken();
    const ppRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': uuidv4(),
      },
    });
    const capture = await ppRes.json();

    if (capture.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Payment not completed', details: capture });
    }

    const captureId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    const campaignId = capture.purchase_units?.[0]?.reference_id;
    const capturedAmount = parseFloat(capture.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value || 0);

    db.run(`UPDATE donations SET status='completed', paypal_capture_id=? WHERE paypal_order_id=?`, [captureId, orderID]);

    if (campaignId && capturedAmount > 0) {
      db.run(
        `UPDATE campaigns SET raised_amount = MIN(raised_amount + ?, goal_amount),
         status = CASE WHEN raised_amount + ? >= goal_amount THEN 'Completed' ELSE status END
         WHERE id = ?`,
        [capturedAmount, capturedAmount, campaignId]
      );
      // Invalidate cached AI summary so it regenerates with new data
      db.run(`UPDATE campaigns SET ai_summary = NULL WHERE id = ?`, [campaignId]);
    }

    res.json({ success: true, captureId, campaignId, amount: capturedAmount });
  } catch (e) {
    console.error('capture-order error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/paypal/webhook
router.post('/webhook', express.raw({ type: '*/*' }), (req, res) => {
  res.status(200).json({ received: true });
  try {
    const event = JSON.parse(req.body.toString());
    console.log(`[PayPal Webhook] ${event.event_type}`);
    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      console.log(`[PayPal Webhook] Capture: ${event.resource?.id}, amount: ${event.resource?.amount?.value}`);
    }
  } catch (e) {
    console.error('[PayPal Webhook] parse error:', e.message);
  }
});

module.exports = router;
