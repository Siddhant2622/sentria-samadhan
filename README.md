# Sentria Samadhan 2.0
### AI-Powered Civic Action & Transparent Community Funding

> **Built for the PayPal AI Hackathon 2026** — Social Impact track  
> Deadline: November 13, 2026 · Hosted on [Render](https://sentria-samadhan-frontend.onrender.com)

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![PayPal Sandbox](https://img.shields.io/badge/PayPal-Sandbox-blue)](https://developer.paypal.com)
[![Powered by Gemini](https://img.shields.io/badge/AI-Gemini%202.0%20Flash-orange)](https://ai.google.dev)
[![Deploy on Render](https://img.shields.io/badge/Deployed-Render-purple)](https://render.com)

---

## 🎯 What It Does

Sentria Samadhan connects **civic complaints → AI analysis → community funding → PayPal payments** in one transparent loop:

1. **Citizen Reports** a civic issue (pothole, broken streetlight, garbage pile) with photo evidence
2. **Gemini AI scans the image**, verifies it's real (not AI-generated), and classifies the issue
3. **AI groups related complaints** and identifies issues that could benefit from community action
4. **Verified NGOs create Campaigns** — voluntary funding drives for civic improvements
5. **PayPal Sandbox Checkout** processes donations with full order tracking
6. **Gemini AI Transparency Report** explains fund allocation and flags inconsistencies
7. **Public dashboard** shows all transactions, campaign progress, and AI-verified work updates

> Citizens always report for free. Donations are voluntary and supplementary to government action.

---

## 🏗️ Architecture

```
Citizen App (React PWA)
    │
    ├── Report Issue → AI Image Analysis (Gemini Vision)
    │                       ↓
    │               Supabase Storage (images)
    │
    ├── View Campaigns → PayPal JS SDK v6
    │                         ↓
    │               POST /api/paypal/create-order
    │                         ↓
    │               PayPal Sandbox REST API
    │                         ↓
    │               POST /api/paypal/capture-order
    │                         ↓
    │               SQLite (donations + campaigns)
    │
    └── AI Transparency → GET /api/campaigns/:id/ai-summary
                               ↓
                        Gemini 2.0 Flash
                        @paypal/agent-toolkit
```

---

## 🚀 Live Demo

| Service | URL |
|---|---|
| **Frontend** | https://sentria-samadhan-frontend.onrender.com |
| **Backend API** | https://sentria-samadhan-backend.onrender.com |
| **Campaigns** | https://sentria-samadhan-frontend.onrender.com/campaigns |

**Demo flow:** Login → Tap "Fund" in bottom nav → Select a campaign → Enter amount → PayPal Sandbox → Donate → See AI transparency report

---

## 💳 PayPal Integration

### APIs Used
| Feature | PayPal API |
|---|---|
| Donation checkout | [Orders API v2](https://developer.paypal.com/api/orders/v2/) — create + capture |
| Webhook verification | [Webhooks API](https://developer.paypal.com/api/webhooks/) |
| Frontend buttons | [PayPal JS SDK v6](https://developer.paypal.com/sdk/js/) |
| AI-powered analysis | [@paypal/agent-toolkit](https://github.com/paypal/AI-Toolkit) |

### PayPal Flow
```
User clicks Donate
      ↓
POST /api/paypal/create-order  →  PayPal Orders API  →  orderID
      ↓
PayPal JS SDK renders button (sandbox)
      ↓
User approves in PayPal popup
      ↓
POST /api/paypal/capture-order  →  PayPal captures payment
      ↓
SQLite records: donation ID, campaign ID, capture ID, amount
      ↓
Campaign raised_amount updated in real-time
```

---

## 🤖 AI Integration (Gemini + PayPal AI Toolkit)

- **Image verification** — Gemini Vision scans uploaded complaint photos for authenticity
- **Issue classification** — AI categorizes and routes civic issues (Roads, Water, Electricity…)
- **Campaign AI summary** — Gemini generates a 3-paragraph transparency report per campaign
- **PayPal AI Toolkit** — `@paypal/agent-toolkit` powers AI-driven payment decision-making

---

## 🛠️ Setup

### Prerequisites
- Node.js 18+
- PayPal Developer Account → [developer.paypal.com](https://developer.paypal.com/dashboard/)
- Gemini API Key → [ai.google.dev](https://ai.google.dev)
- Supabase account → [supabase.com](https://supabase.com)

### 1. Clone
```bash
git clone https://github.com/Siddhant2622/sentria-samadhan.git
cd sentria-samadhan
```

### 2. Backend setup
```bash
cd backend
npm install
cp .env.example .env   # Fill in your keys
npm start
```

**Required `.env` values:**
```env
GEMINI_API_KEY=your_gemini_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_secret_key
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret
PAYPAL_ENV=sandbox
FRONTEND_URL=http://localhost:5173
PORT=3001
```

### 3. Get PayPal Sandbox credentials
1. Go to [developer.paypal.com/dashboard](https://developer.paypal.com/dashboard/)
2. Click **Apps & Credentials** → **Create App** (Sandbox)
3. Copy **Client ID** and **Secret** into `.env`

### 4. Frontend setup
```bash
cd frontend
npm install
# Set VITE_API_URL in .env if needed
npm run dev
```

### 5. Create Supabase bucket (first time only)
```bash
cd backend
node create_bucket.js
```

---

## 📁 Project Structure

```
sentria-samadhan/
├── backend/
│   ├── index.js              # Express server + AI image analysis
│   ├── db.js                 # SQLite schema (users, complaints, campaigns, donations)
│   ├── routes/
│   │   ├── campaigns.js      # Campaign CRUD + Gemini AI summary
│   │   └── paypal.js         # PayPal create-order, capture-order, webhook
│   └── ...
├── frontend/
│   ├── src/pages/
│   │   ├── Campaigns.jsx     # Campaign list with Chart.js funding bars
│   │   ├── CampaignDetail.jsx # PayPal donate button + AI report
│   │   ├── ReportIssue.jsx   # AI-powered civic complaint submission
│   │   └── ...
│   └── ...
├── render.yaml               # Render.com deployment config
└── LICENSE                   # MIT
```

---

## 🌍 Significant Updates Since October 1, 2026

The following features were **built specifically for this hackathon** after October 1, 2026:

| Feature | Date Added |
|---|---|
| PayPal Sandbox checkout (create-order + capture) | Nov 7, 2026 |
| Community campaign system | Nov 7, 2026 |
| Gemini AI transparency reports | Nov 7, 2026 |
| @paypal/agent-toolkit integration | Nov 7, 2026 |
| Donations SQLite table + tracking | Nov 7, 2026 |
| Campaign funding dashboard (Chart.js) | Nov 7, 2026 |
| MIT License | Nov 7, 2026 |
| Supabase image storage for verification | Nov 7, 2026 |

The original project (May 2026) provided the civic complaint infrastructure. The PayPal + AI funding layer is entirely new.

---

## 🏆 Hackathon Category

**Social Impact** — A tool that lets community members pool money for shared civic projects, powered by transparent AI analysis and PayPal payments.

---

## 📺 Demo Video

[YouTube Demo Link — to be added]

---

## 👥 Team

Built by **Siddhant Giri** for the PayPal AI Hackathon 2026.

---

## 📄 License

[MIT](LICENSE)
