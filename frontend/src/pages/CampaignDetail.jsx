import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Heart, Zap, CheckCircle, Clock, AlertCircle, ExternalLink, Users } from 'lucide-react';
import { API_BASE } from '../lib/config';

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [donateAmount, setDonateAmount] = useState('10');
  const [donorName, setDonorName] = useState('');
  const [paypalReady, setPaypalReady] = useState(false);
  const [paypalConfigured, setPaypalConfigured] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(searchParams.get('payment') || '');
  const [error, setError] = useState('');
  const paypalContainerRef = useRef(null);
  const paypalButtonsRef = useRef(null);

  useEffect(() => {
    // Load campaign data
    fetch(`${API_BASE}/api/campaigns/${id}`)
      .then(r => r.json())
      .then(data => { setCampaign(data); setLoading(false); })
      .catch(() => { setLoading(false); });

    // Check PayPal config & load SDK
    fetch(`${API_BASE}/api/paypal/config`)
      .then(r => r.json())
      .then(config => {
        setPaypalConfigured(config.configured);
        if (config.configured && config.clientId && config.clientId !== 'sb') {
          loadPayPalSDK(config.clientId);
        }
      })
      .catch(() => {});
  }, [id]);

  function loadPayPalSDK(clientId) {
    if (window.paypal) { setPaypalReady(true); return; }
    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
    script.async = true;
    script.onload = () => setPaypalReady(true);
    document.head.appendChild(script);
  }

  // Render PayPal buttons when SDK ready + amount changes
  useEffect(() => {
    if (!paypalReady || !paypalContainerRef.current || !campaign) return;
    // Destroy previous buttons
    if (paypalButtonsRef.current) {
      paypalButtonsRef.current.close?.();
      paypalButtonsRef.current = null;
    }
    if (paypalContainerRef.current) paypalContainerRef.current.innerHTML = '';

    const amount = parseFloat(donateAmount);
    if (isNaN(amount) || amount < 1) return;

    paypalButtonsRef.current = window.paypal.Buttons({
      style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'donate', height: 45 },

      createOrder: async () => {
        setError('');
        const res = await fetch(`${API_BASE}/api/paypal/create-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, campaign_id: id, donor_name: donorName || 'Anonymous' }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        return data.orderID;
      },

      onApprove: async (data) => {
        const res = await fetch(`${API_BASE}/api/paypal/capture-order/${data.orderID}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const result = await res.json();
        if (result.success) {
          setPaymentStatus('success');
          // Refresh campaign data
          fetch(`${API_BASE}/api/campaigns/${id}`).then(r => r.json()).then(setCampaign).catch(() => {});
        } else {
          setError('Payment capture failed. Please try again.');
        }
      },

      onError: (err) => {
        console.error('PayPal error:', err);
        setError('Payment failed. Please try again.');
      },

      onCancel: () => setPaymentStatus('cancelled'),
    });

    paypalButtonsRef.current.render(paypalContainerRef.current);
  }, [paypalReady, donateAmount, campaign, id, donorName]);

  // Load AI summary
  const loadAISummary = async () => {
    setAiLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/campaigns/${id}/ai-summary`);
      const data = await res.json();
      setAiSummary(data.summary || '');
    } catch (e) {
      setAiSummary('AI summary unavailable. Please try again.');
    }
    setAiLoading(false);
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F0E8' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #5B7B6F', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!campaign) return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <AlertCircle size={40} color="#C4917B" />
      <p>Campaign not found.</p>
      <button onClick={() => navigate('/campaigns')} style={{ padding: '8px 20px', background: '#5B7B6F', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' }}>Back</button>
    </div>
  );

  const pct = campaign.progress_pct || 0;

  return (
    <div style={{ minHeight: '100vh', background: '#F5F0E8', paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#5B7B6F,#7BA8A0)', padding: '16px 20px 32px', position: 'relative' }}>
        <button onClick={() => navigate('/campaigns')} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10, padding: '6px 12px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
          <ArrowLeft size={16} /> Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          {campaign.verified === 1 && <CheckCircle size={16} color="#A8D8A8" />}
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{campaign.category} · {campaign.verified ? 'AI Verified' : 'Pending Verification'}</span>
        </div>
        <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: '0 0 4px', lineHeight: 1.3 }}>{campaign.title}</h1>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, margin: 0 }}>by {campaign.organizer_name}</p>
      </div>

      <div style={{ padding: '0 16px', marginTop: -16 }}>
        {/* Payment status banner */}
        {paymentStatus === 'success' && (
          <div style={{ background: '#E8F5E9', border: '1px solid #A8D8A8', borderRadius: 12, padding: '12px 16px', marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
            <CheckCircle size={20} color="#5B7B6F" />
            <div>
              <div style={{ fontWeight: 700, color: '#2D6A4F', fontSize: 14 }}>Payment Successful! 🎉</div>
              <div style={{ fontSize: 12, color: '#52B788' }}>Your donation was recorded via PayPal Sandbox. Thank you!</div>
            </div>
          </div>
        )}
        {paymentStatus === 'cancelled' && (
          <div style={{ background: '#FFF9E6', border: '1px solid #D4A84B', borderRadius: 12, padding: '12px 16px', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: '#8B6914' }}>Payment cancelled. You can try again anytime.</span>
          </div>
        )}

        {/* Progress card */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <span style={{ fontSize: 28, fontWeight: 800, color: '#5B7B6F' }}>${campaign.raised_amount?.toLocaleString()}</span>
              <span style={{ fontSize: 14, color: '#999' }}> raised</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#2D2D2D' }}>{pct}%</div>
              <div style={{ fontSize: 12, color: '#999' }}>of ${campaign.goal_amount?.toLocaleString()}</div>
            </div>
          </div>
          <div style={{ background: '#F0EDE8', borderRadius: 999, height: 10, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,#5B7B6F,#7BA8A0)', borderRadius: 999, transition: 'width 0.8s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#999' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={12} /> {campaign.donations?.length || 0} donors</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {campaign.status === 'Completed' ? <CheckCircle size={12} color="#5B7B6F" /> : <Clock size={12} />}
              {campaign.status}
            </span>
          </div>
        </div>

        {/* Description */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#2D2D2D' }}>About this Campaign</h3>
          <p style={{ margin: 0, fontSize: 13, color: '#555', lineHeight: 1.6 }}>{campaign.description}</p>
        </div>

        {/* PayPal Donate */}
        {campaign.status !== 'Completed' && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#2D2D2D', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Heart size={16} color="#C4917B" /> Donate via PayPal
            </h3>

            {/* Quick amounts */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {['5','10','25','50'].map(a => (
                <button key={a} onClick={() => setDonateAmount(a)}
                  style={{ flex: 1, padding: '8px 0', border: '2px solid', borderColor: donateAmount === a ? '#5B7B6F' : '#E8E0D4', borderRadius: 10, background: donateAmount === a ? '#5B7B6F' : '#fff', color: donateAmount === a ? '#fff' : '#555', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
                  ${a}
                </button>
              ))}
            </div>

            {/* Custom amount + name */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#999', fontWeight: 700 }}>$</span>
                <input type="number" min="1" value={donateAmount} onChange={e => setDonateAmount(e.target.value)}
                  style={{ width: '100%', padding: '10px 10px 10px 24px', border: '1.5px solid #E8E0D4', borderRadius: 10, fontSize: 15, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <input type="text" placeholder="Your name (optional)" value={donorName} onChange={e => setDonorName(e.target.value)}
                style={{ flex: 2, padding: '10px 12px', border: '1.5px solid #E8E0D4', borderRadius: 10, fontSize: 13, outline: 'none' }} />
            </div>

            {error && <div style={{ background: '#FFEBEE', border: '1px solid #FFCDD2', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#C62828', marginBottom: 10 }}>{error}</div>}

            {/* PayPal button container */}
            {paypalConfigured ? (
              <div ref={paypalContainerRef} />
            ) : (
              <div style={{ background: '#FFF9E6', border: '1px solid #D4A84B', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: '#8B6914', fontWeight: 600, marginBottom: 4 }}>PayPal Sandbox Mode</div>
                <div style={{ fontSize: 12, color: '#B8870A' }}>Add PAYPAL_CLIENT_ID in Render dashboard to enable live donations.</div>
                <a href="https://developer.paypal.com" target="_blank" rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 12, color: '#0070BA', fontWeight: 600 }}>
                  Get PayPal Sandbox Keys <ExternalLink size={12} />
                </a>
              </div>
            )}
          </div>
        )}

        {/* AI Transparency Summary */}
        <div style={{ background: 'linear-gradient(135deg,#F0F7F4,#E8F4F1)', borderRadius: 16, padding: 16, marginBottom: 12, border: '1px solid #C8E6D4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#2D6A4F', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={15} color="#5B7B6F" /> AI Transparency Report
            </h3>
            {!aiSummary && (
              <button onClick={loadAISummary} disabled={aiLoading}
                style={{ padding: '5px 12px', background: '#5B7B6F', color: '#fff', border: 'none', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: aiLoading ? 0.7 : 1 }}>
                {aiLoading ? 'Generating…' : 'Generate ✨'}
              </button>
            )}
          </div>
          {aiSummary ? (
            <p style={{ margin: 0, fontSize: 13, color: '#2D5016', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{aiSummary}</p>
          ) : (
            <p style={{ margin: 0, fontSize: 12, color: '#52796F' }}>Tap "Generate" to get a Gemini AI transparency analysis of this campaign — including fund allocation review and consistency checks.</p>
          )}
        </div>

        {/* Recent donors */}
        {campaign.donations?.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#2D2D2D' }}>Recent Donors</h3>
            {campaign.donations.slice(0, 5).map((d, i) => (
              <div key={d.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < Math.min(campaign.donations.length, 5) - 1 ? '1px solid #F0EDE8' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#5B7B6F,#7BA8A0)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13 }}>
                    {(d.donor_name || 'A')[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#2D2D2D' }}>{d.donor_name || 'Anonymous'}</div>
                    <div style={{ fontSize: 11, color: '#999' }}>{new Date(d.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <span style={{ fontWeight: 700, color: '#5B7B6F', fontSize: 15 }}>${d.amount}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

