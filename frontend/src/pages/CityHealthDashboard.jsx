import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, Target, Shield, Zap, Info, MapPin, CheckCircle, Clock, AlertTriangle, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE } from '../lib/config';

export default function CityHealthDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [district, setDistrict] = useState(''); // Empty means 'All Districts'

  useEffect(() => {
    fetchHealthData();
  }, [district]);

  const fetchHealthData = async () => {
    setLoading(true);
    try {
      const query = district ? `?district=${encodeURIComponent(district)}` : '';
      const res = await fetch(`${API_BASE}/api/city-health${query}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error('Failed to fetch city health data:', e);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend) => {
    if (trend === 'improving') return <TrendingUp size={16} className="text-teal" />;
    if (trend === 'declining') return <TrendingDown size={16} className="text-danger" />;
    return <Minus size={16} className="text-warning" />;
  };

  return (
    <div className="min-h-screen bg-background text-textMain flex flex-col pb-24">
      {/* Dancheong accent line */}
      <div className="dancheong-line" />

      {/* Header */}
      <div className="bg-surface/90 backdrop-blur-xl border-b border-black/[0.06] p-4 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 bg-surfaceLight hover:bg-black/[0.04] rounded-full transition-colors">
            <ArrowLeft size={20} className="text-textMuted" />
          </button>
          <div>
            <h1 className="font-bold font-serif text-lg text-textMain leading-tight">City Health Score</h1>
            <p className="text-[10px] text-primary uppercase tracking-wider font-bold">AI Analytics Command Center</p>
          </div>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <Activity size={40} className="text-primary animate-pulse mb-4" />
          <p className="text-sm text-textMuted font-bold">Analyzing Civic Data...</p>
        </div>
      ) : data ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          
          {/* Main Score Hero */}
          <div className="bg-surface rounded-[2.5rem] p-6 border border-black/[0.06] shadow-soft relative overflow-hidden">
            {/* Background blur orb */}
            <div 
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full blur-[60px] opacity-20 pointer-events-none"
              style={{ backgroundColor: data.overallTier.color }}
            />
            
            <div className="relative z-10 flex flex-col items-center text-center">
              <p className="text-xs font-bold text-textMuted uppercase tracking-widest mb-4">Overall Civic Health</p>
              
              <div className="relative mb-4">
                <svg className="w-40 h-40 transform -rotate-90">
                  <circle cx="80" cy="80" r="70" stroke="rgba(0,0,0,0.05)" strokeWidth="8" fill="none" />
                  <motion.circle 
                    cx="80" cy="80" r="70" 
                    stroke={data.overallTier.color} 
                    strokeWidth="8" 
                    strokeLinecap="round"
                    fill="none" 
                    strokeDasharray="440"
                    initial={{ strokeDashoffset: 440 }}
                    animate={{ strokeDashoffset: 440 - (440 * data.overallScore) / 100 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-black font-serif" style={{ color: data.overallTier.color }}>
                    {data.overallScore}
                  </span>
                  <span className="text-[10px] font-bold text-textMuted">OUT OF 100</span>
                </div>
              </div>
              
              <div 
                className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg"
                style={{ backgroundColor: `${data.overallTier.bg}20`, color: data.overallTier.color, border: `1px solid ${data.overallTier.color}40` }}
              >
                {data.overallTier.label} Condition
              </div>
            </div>
          </div>

          {/* AI Insights Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Zap size={16} className="text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-textMain">AI Generated Insights</h2>
            </div>
            
            <div className="grid gap-3">
              {data.insights.map((insight, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                  key={i} 
                  className="bg-surface border border-black/[0.06] shadow-sm p-4 rounded-[2rem] flex gap-3 items-start"
                >
                  <span className="text-xl shrink-0 mt-0.5">{insight.icon}</span>
                  <p className="text-xs leading-relaxed text-textMain font-medium">
                    {insight.text}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* 30-Day Forecast */}
          <div className="bg-surface border border-black/[0.06] shadow-soft rounded-[2.5rem] p-5">
            <h2 className="text-xs font-bold uppercase tracking-widest text-textMuted mb-4 flex items-center gap-2">
              <Clock size={14} /> 30-Day Health Forecast
            </h2>
            
            <div className="flex items-center justify-between mb-4">
              <div className="text-center">
                <p className="text-[10px] text-textMuted font-bold mb-1 uppercase">Current</p>
                <p className="text-2xl font-black font-serif text-textMain">{data.forecast.currentScore}</p>
              </div>
              
              <div className="flex-1 flex items-center justify-center px-4 relative">
                <div className="h-0.5 w-full bg-black/10 rounded-full" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${data.forecast.scoreDelta >= 0 ? 'bg-teal/20 text-teal' : 'bg-danger/20 text-danger'}`}>
                    {data.forecast.scoreDelta > 0 ? '+' : ''}{data.forecast.scoreDelta} PTS
                  </div>
                </div>
              </div>
              
              <div className="text-center">
                <p className="text-[10px] text-textMuted font-bold mb-1 uppercase">Predicted</p>
                <p className="text-2xl font-black font-serif" style={{ color: data.forecast.riskColor }}>{data.forecast.predictedScore}</p>
              </div>
            </div>
            
            <p className="text-xs text-textMain bg-surfaceLight p-3 rounded-xl border border-black/[0.04]">
              <span className="font-bold text-textMain">Reason:</span> {data.forecast.reason}
            </p>
          </div>

          {/* Category Breakdown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-bold uppercase tracking-wider text-textMain">Department Health</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(data.categories).map(([key, cat]) => (
                <div key={key} className="bg-surface border border-black/[0.06] shadow-sm rounded-2xl p-4 hover:shadow-md transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-sm text-textMain mb-1">{cat.label}</h3>
                      <div className="flex items-center gap-2">
                        <span 
                          className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                          style={{ backgroundColor: `${cat.tier.bg}20`, color: cat.tier.color }}
                        >
                          {cat.tier.label}
                        </span>
                        <div className="flex items-center gap-1 bg-surfaceLight px-1.5 py-0.5 rounded text-[9px] font-bold text-textMuted border border-black/[0.04]">
                          {getTrendIcon(cat.trend)} {cat.trendPct}%
                        </div>
                      </div>
                    </div>
                    
                    {/* Mini Donut */}
                    <div className="relative w-12 h-12">
                      <svg className="w-12 h-12 transform -rotate-90">
                        <circle cx="24" cy="24" r="20" stroke="rgba(0,0,0,0.05)" strokeWidth="4" fill="none" />
                        <circle 
                          cx="24" cy="24" r="20" 
                          stroke={cat.tier.color} 
                          strokeWidth="4" 
                          strokeLinecap="round"
                          fill="none" 
                          strokeDasharray="125.6"
                          strokeDashoffset={125.6 - (125.6 * cat.score) / 100}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-textMain">
                        {cat.score}
                      </div>
                    </div>
                  </div>
                  
                  {/* Stats Row */}
                  <div className="flex gap-4 pt-3 border-t border-black/[0.04]">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider font-bold text-textMuted">Resolved</p>
                      <p className="text-xs font-bold text-teal">{cat.stats.resolved}/{cat.stats.total}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider font-bold text-textMuted">Pending</p>
                      <p className="text-xs font-bold text-warning">{cat.stats.pending}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider font-bold text-textMuted">Avg Time</p>
                      <p className="text-xs font-bold text-textMain">{Math.round(cat.stats.avgResolutionDays)}d</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* District Rankings (if applicable) */}
          {data.rankings && data.rankings.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-textMain px-1">District Rankings</h2>
              <div className="bg-surface border border-black/[0.06] rounded-[2rem] overflow-hidden shadow-sm">
                {data.rankings.map((rank, i) => (
                  <div key={rank.district} className={`p-4 flex items-center gap-4 ${i !== data.rankings.length - 1 ? 'border-b border-black/[0.04]' : ''}`}>
                    <div className="w-6 text-center text-xs font-black text-textMuted">#{i + 1}</div>
                    <div className="flex-1">
                      <p className="font-bold text-sm text-textMain">{rank.district}</p>
                      <p className="text-[10px] text-textMuted">{rank.total} Total Issues</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg font-serif" style={{ color: rank.tier.color }}>{rank.score}</p>
                      <p className="text-[9px] uppercase tracking-wider font-bold" style={{ color: rank.tier.color }}>{rank.tier.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      ) : null}
    </div>
  );
}
