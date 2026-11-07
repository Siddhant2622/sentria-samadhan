import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, TrendingUp, Users, CheckCircle, Clock, ArrowRight, Zap } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { API_BASE } from '../lib/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const CATEGORY_COLOR = {
  Roads: '#C4917B', Electricity: '#D4A84B', Sanitation: '#5B7B6F',
  Water: '#7BA8A0', Environment: '#6B9E78', Other: '#8C8C8C',
};

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_BASE}/api/campaigns`)
      .then(r => r.json())
      .then(data => { setCampaigns(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setCampaigns(DEMO_CAMPAIGNS); setLoading(false); });
  }, []);

  const filtered = filter === 'All' ? campaigns : campaigns.filter(c => c.status === filter);
  const totalRaised = campaigns.reduce((s, c) => s + (c.raised_amount || 0), 0);
  const totalGoal = campaigns.reduce((s, c) => s + (c.goal_amount || 0), 0);

  const chartData = {
    labels: campaigns.slice(0, 5).map(c => c.title.substring(0, 18) + '…'),
    datasets: [
      { label: 'Raised ($)', data: campaigns.slice(0, 5).map(c => c.raised_amount), backgroundColor: '#5B7B6F', borderRadius: 6 },
      { label: 'Goal ($)',   data: campaigns.slice(0, 5).map(c => c.goal_amount),   backgroundColor: '#E8E0D4', borderRadius: 6 },
    ],
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(168deg,#F5F0E8 0%,#EDE6DA 100%)', paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#5B7B6F,#7BA8A0)', padding: '20px 20px 28px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 150, height: 150, background: 'rgba(255,255,255,0.08)', borderRadius: '50%' }} />
        <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: 0 }}>Community Campaigns</h1>
        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, margin: '4px 0 16px' }}>AI-verified civic funding · Powered by PayPal</p>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { label: 'Total Raised', value: `$${totalRaised.toLocaleString()}`, icon: TrendingUp },
            { label: 'of Goal', value: `$${totalGoal.toLocaleString()}`, icon: Heart },
            { label: 'Campaigns', value: campaigns.length, icon: Users },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} style={{ flex: 1, background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 8px', textAlign: 'center', backdropFilter: 'blur(10px)' }}>
              <Icon size={16} color="rgba(255,255,255,0.9)" style={{ marginBottom: 4 }} />
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{value}</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>
        {/* Chart */}
        {campaigns.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 16, marginTop: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Zap size={14} color="#5B7B6F" />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#2D2D2D' }}>Funding Overview</span>
            </div>
            <Bar data={chartData} options={{ responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } } }, scales: { y: { beginAtZero: true } } }} height={160} />
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, marginBottom: 12 }}>
          {['All', 'Active', 'Completed'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: filter === f ? '#5B7B6F' : '#fff', color: filter === f ? '#fff' : '#666', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              {f}
            </button>
          ))}
        </div>

        {/* Campaign cards */}
        {loading ? (
          [1,2,3].map(i => <div key={i} style={{ height: 140, background: '#fff', borderRadius: 16, marginBottom: 12, opacity: 0.5, animation: 'pulse 1.5s infinite' }} />)
        ) : (
          filtered.map(c => (
            <div key={c.id} onClick={() => navigate(`/campaigns/${c.id}`)}
              style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', cursor: 'pointer', border: '1px solid rgba(0,0,0,0.04)' }}>
              {/* Category + status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: CATEGORY_COLOR[c.category] || '#8C8C8C', background: (CATEGORY_COLOR[c.category] || '#8C8C8C') + '15', padding: '3px 8px', borderRadius: 20 }}>
                  {c.category}
                </span>
                <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, color: c.status === 'Completed' ? '#5B7B6F' : '#D4A84B', fontWeight: 600 }}>
                  {c.status === 'Completed' ? <CheckCircle size={12} /> : <Clock size={12} />} {c.status}
                </span>
              </div>

              <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#2D2D2D', lineHeight: 1.3 }}>{c.title}</h3>
              <p style={{ margin: '0 0 12px', fontSize: 12, color: '#666', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.description}</p>

              {/* Progress bar */}
              <div style={{ background: '#F0EDE8', borderRadius: 999, height: 6, marginBottom: 8, overflow: 'hidden' }}>
                <div style={{ width: `${c.progress_pct}%`, height: '100%', background: `linear-gradient(90deg, #5B7B6F, #7BA8A0)`, borderRadius: 999, transition: 'width 0.5s ease' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 15, color: '#5B7B6F' }}>${c.raised_amount?.toLocaleString()}</span>
                  <span style={{ fontSize: 12, color: '#999' }}> of ${c.goal_amount?.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#5B7B6F', fontSize: 12, fontWeight: 600 }}>
                  {c.progress_pct}% · View <ArrowRight size={14} />
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>by {c.organizer_name}</div>
            </div>
          ))
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            <Heart size={40} color="#E8E0D4" style={{ marginBottom: 12 }} />
            <p>No {filter.toLowerCase()} campaigns yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

const DEMO_CAMPAIGNS = [
  { id: 'camp-001', title: 'MP Nagar Road Repair Drive', description: 'Community-funded initiative to fix 12 potholes identified through citizen complaints.', category: 'Roads', status: 'Active', goal_amount: 5000, raised_amount: 1850, progress_pct: 37, organizer_name: 'MP Citizens Welfare Trust' },
  { id: 'camp-002', title: 'Habibganj Streetlight Restoration', description: 'Fund LED streetlights for 3 dark lanes near Habibganj school zone.', category: 'Electricity', status: 'Active', goal_amount: 2500, raised_amount: 2100, progress_pct: 84, organizer_name: 'Bhopal Safe Streets NGO' },
];
