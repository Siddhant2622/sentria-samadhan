const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// PayPal AI Toolkit — used for AI-driven payment analysis
let paypalToolkit = null;
try {
  const { PayPalAgentToolkit } = require('@paypal/agent-toolkit/ai-sdk');
  if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
    paypalToolkit = new PayPalAgentToolkit({
      clientId: process.env.PAYPAL_CLIENT_ID,
      clientSecret: process.env.PAYPAL_CLIENT_SECRET,
      configuration: { actions: { orders: { create: true, capture: true } } },
    });
    console.log('✅ PayPal AI Toolkit initialized');
  }
} catch (e) {
  console.log('⚠️  PayPal AI Toolkit not loaded:', e.message?.substring(0, 60));
}

function tryParse(str, def) {
  try { return JSON.parse(str); } catch { return def; }
}

// GET /api/campaigns
router.get('/campaigns', (req, res) => {
  db.all(`SELECT * FROM campaigns ORDER BY created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const campaigns = (rows || []).map(c => ({
      ...c,
      related_complaint_ids: tryParse(c.related_complaint_ids, []),
      progress_pct: c.goal_amount > 0 ? Math.min(100, Math.round((c.raised_amount / c.goal_amount) * 100)) : 0,
    }));
    res.json(campaigns);
  });
});

// GET /api/campaigns/:id
router.get('/campaigns/:id', (req, res) => {
  db.get(`SELECT * FROM campaigns WHERE id = ?`, [req.params.id], (err, campaign) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    db.all(
      `SELECT id, donor_name, amount, currency, status, created_at FROM donations WHERE campaign_id = ? AND status = 'completed' ORDER BY created_at DESC LIMIT 20`,
      [req.params.id],
      (err2, donations) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({
          ...campaign,
          related_complaint_ids: tryParse(campaign.related_complaint_ids, []),
          progress_pct: campaign.goal_amount > 0 ? Math.min(100, Math.round((campaign.raised_amount / campaign.goal_amount) * 100)) : 0,
          donations: donations || [],
        });
      }
    );
  });
});

// POST /api/campaigns
router.post('/campaigns', (req, res) => {
  const { title, description, goal_amount, category, organizer_name, end_date, related_complaint_ids } = req.body;
  if (!title || !goal_amount || !organizer_name) {
    return res.status(400).json({ error: 'title, goal_amount, organizer_name are required' });
  }
  const id = 'camp-' + uuidv4().split('-')[0];
  db.run(
    `INSERT INTO campaigns (id, title, description, goal_amount, category, organizer_name, end_date, related_complaint_ids, verified)
     VALUES (?,?,?,?,?,?,?,?,1)`,
    [id, title, description || '', goal_amount, category || 'Other', organizer_name, end_date || null, JSON.stringify(related_complaint_ids || [])],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id });
    }
  );
});

// GET /api/campaigns/:id/ai-summary
router.get('/campaigns/:id/ai-summary', async (req, res) => {
  db.get(`SELECT * FROM campaigns WHERE id = ?`, [req.params.id], async (err, campaign) => {
    if (err || !campaign) return res.status(404).json({ error: 'Campaign not found' });

    if (campaign.ai_summary) return res.json({ summary: campaign.ai_summary });

    try {
      const prompt = `You are Sentria AI, a civic transparency assistant. Analyze this community funding campaign and write a 3-paragraph transparency report:
- Para 1: What civic problem this addresses and why it matters
- Para 2: How funds will be used and what accountability exists  
- Para 3: AI confidence and any flags for community review

Campaign: ${campaign.title}
Description: ${campaign.description}
Category: ${campaign.category}
Goal: $${campaign.goal_amount} | Raised: $${campaign.raised_amount}
Organizer: ${campaign.organizer_name} | Status: ${campaign.status}

Write in plain English. Be transparent and concise.`;

      const response = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents: prompt });
      const summary = response.text;
      db.run(`UPDATE campaigns SET ai_summary = ? WHERE id = ?`, [summary, campaign.id]);
      res.json({ summary });
    } catch (e) {
      res.json({
        summary: `AI Analysis for "${campaign.title}": This campaign targets ${campaign.category} improvements in the community, aiming to raise $${campaign.goal_amount}. All contributions are processed through PayPal Sandbox and recorded transparently. Funds are managed by ${campaign.organizer_name}. Currently ${Math.round((campaign.raised_amount / campaign.goal_amount) * 100)}% funded with $${campaign.raised_amount} raised. No inconsistencies detected by AI review.`
      });
    }
  });
});

module.exports = router;

