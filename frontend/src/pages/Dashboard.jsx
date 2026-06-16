import { useEffect, useMemo, useState, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Clock, ArrowRight, ShieldCheck, Camera, Bell, Activity, Zap, LogOut, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchComplaints, formatRelativeTime, statusColor, urgencyColor, openInGoogleMaps, resolveImageUrl } from '../lib/api';
import { API_BASE } from '../lib/config';
import { useAuth } from '../lib/AuthContext';
import { useLanguage } from '../lib/LanguageContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout, updateUserDistrict } = useAuth();
  const { t } = useLanguage();
  const [complaints, setComplaints] = useState([]);

  useEffect(() => {
    // Force redirect to appropriate dashboard if role is not Citizen
    if (user?.role === 'Admin') navigate('/admin');
    else if (user?.role === 'SuperAdmin') navigate('/superadmin');
    else if (user?.role === 'Officer') navigate('/officer');

    // If citizen has a district, filter by it.
    const districtQuery = user?.role === 'Citizen' && user?.district ? `?district=${encodeURIComponent(user.district)}` : '';
    const refreshData = () => fetchComplaints(districtQuery).then(setComplaints);
    
    refreshData();
    const interval = setInterval(refreshData, 10000); // Poll every 10s

    // Auto-detect district if missing
    if (user?.role === 'Citizen' && !user?.district) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
          if (!res.ok) throw new Error('Geocoding rate limited');
          const data = await res.json();
          const detectedDistrict = data.locality || data.city || data.principalSubdivision;
          
          if (detectedDistrict) {
            // Find closest match in our MP districts list
            const MP_DISTRICTS = ['Agar Malwa', 'Alirajpur', 'Anuppur', 'Ashoknagar', 'Balaghat', 'Barwani', 'Betul', 'Bhind', 'Bhopal', 'Burhanpur', 'Chhatarpur', 'Chhindwara', 'Damoh', 'Datia', 'Dewas', 'Dhar', 'Dindori', 'Guna', 'Gwalior', 'Harda', 'Hoshangabad', 'Indore', 'Jabalpur', 'Jhabua', 'Katni', 'Khandwa', 'Khargone', 'Mandla', 'Mandsaur', 'Morena', 'Narsinghpur', 'Neemuch', 'Panna', 'Raisen', 'Rajgarh', 'Ratlam', 'Rewa', 'Sagar', 'Satna', 'Sehore', 'Seoni', 'Shahdol', 'Shajapur', 'Sheopur', 'Shivpuri', 'Sidhi', 'Singrauli', 'Tikamgarh', 'Ujjain', 'Umaria', 'Vidisha', 'Niwari'];
            const match = MP_DISTRICTS.find(d => detectedDistrict.toLowerCase().includes(d.toLowerCase()));
            
            if (match && updateUserDistrict) {
              await updateUserDistrict(match);
              // user object will update from Context automatically.
            }
          }
        } catch (e) { console.error('Geocoding failed', e); }
      }, null, { enableHighAccuracy: true });
    }

    return () => clearInterval(interval);
  }, [user, navigate, updateUserDistrict]);

  const [ratingTarget, setRatingTarget] = useState(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [seenIds, setSeenIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('sentria_seen_notifs') || '[]')); }
    catch { return new Set(); }
  });

  const handleRate = async () => {
    if (!ratingTarget || submittingRating) return;
    setSubmittingRating(true);
    try {
      const res = await fetch(`${API_BASE}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          citizen_id: user.id,
          complaint_id: ratingTarget.id,
          rating: ratingValue,
          comment: ratingComment
        })
      });
      if (res.ok) {
        setComplaints(complaints.map(c => c.id === ratingTarget.id ? { ...c, has_rated: true } : c));
        setRatingTarget(null);
        setRatingComment('');
        setRatingValue(5);
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to submit rating');
      }
    } catch (e) {
      alert('Network error');
    } finally {
      setSubmittingRating(false);
    }
  };

  const stats = useMemo(() => {
    const open = complaints.filter((item) => !/resolved|completed/i.test(item.status || '')).length;
    const urgent = complaints.filter((item) => ['High', 'Emergency'].includes(item.urgency_level)).length;
    const resolved = complaints.filter((item) => /resolved|completed/i.test(item.status || '')).length;
    return { open, urgent, resolved };
  }, [complaints]);

  const trustScore = user?.trust_score ?? 100;
  const trustColor = trustScore >= 75 ? 'text-primary' : trustScore >= 40 ? 'text-warning' : 'text-danger';
  const trustBg = trustScore >= 75 ? 'bg-primary/10' : trustScore >= 40 ? 'bg-warning/10' : 'bg-danger/10';

  return (
    <div className="min-h-screen pb-24">
      {/* Dancheong accent line */}
      <div className="dancheong-line" />

      <div className="bg-surface/70 backdrop-blur-sm p-6 rounded-b-[2rem] shadow-soft border-b border-black/[0.04]">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            <img src="/logo.png" className="w-14 h-14 object-contain drop-shadow-md" alt="Sentria Samadhan" />
            <div>
              <p className="text-textMuted text-sm">{t('welcome')}</p>
              <h1 className="text-2xl font-bold text-textMain tracking-tight font-serif">{user?.name || 'Citizen'}</h1>
              <p className="text-xs text-textMuted mt-1">{t('civicCommand')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => { setShowNotifications(true); const ids = complaints.map(c=>c.id); localStorage.setItem('sentria_seen_notifs', JSON.stringify(ids)); setSeenIds(new Set(ids)); }}
              className="relative h-11 w-11 rounded-2xl bg-surfaceLight border border-black/[0.06] flex items-center justify-center text-textMuted hover:text-textMain transition-colors"
            >
              <Bell size={18} />
              {complaints.filter(c => !seenIds.has(c.id)).length > 0 && (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-danger rounded-full border-2 border-white" />
              )}
            </button>
            <button onClick={logout} className="h-11 w-11 rounded-2xl bg-surfaceLight border border-black/[0.06] flex items-center justify-center text-textMuted hover:text-danger transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className={`${trustBg} border border-black/[0.06] rounded-2xl p-3 flex items-center gap-3`}>
            <Shield size={20} className={trustColor} />
            <div>
              <p className={`text-lg font-bold ${trustColor}`}>{trustScore}/100</p>
              <p className="text-[10px] text-textMuted uppercase tracking-wide">{t('trustScore')}</p>
            </div>
          </div>
          <div className="bg-gradient-to-br from-primary/10 to-teal/10 border border-black/[0.06] rounded-2xl p-3 flex items-center gap-3">
            <ShieldCheck size={20} className="text-primary" />
            <div>
              <p className="text-sm font-bold text-primary">{t('aiActive')}</p>
              <p className="text-[10px] text-textMuted uppercase tracking-wide">Sentria Samadhan</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-primary/10 to-teal/10 border border-black/[0.06] rounded-2xl p-4 flex items-center space-x-3">
          <div className="bg-primary/15 p-2 rounded-xl text-primary shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{t('readyMsg')}</h3>
            <p className="text-xs text-textMuted mt-0.5">{t('fraudEnabled')}</p>
          </div>
        </div>
      </div>

      <div className="px-6 mt-5 grid grid-cols-3 gap-3">
        {[
          { label: t('open'), value: stats.open, icon: Activity, color: 'text-primary' },
          { label: t('urgent'), value: stats.urgent, icon: Zap, color: 'text-warning' },
          { label: t('solved'), value: stats.resolved, icon: ShieldCheck, color: 'text-teal' }
        ].map((item) => (
          <div key={item.label} className="korean-card p-3">
            <item.icon size={16} className={item.color} />
            <p className="text-xl font-bold mt-2">{item.value}</p>
            <p className="text-[10px] text-textMuted uppercase tracking-wide">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="px-6 mt-6">
        <motion.button whileTap={{ scale: 0.98 }} onClick={() => navigate('/report')}
          className="w-full bg-gradient-to-r from-primary to-teal rounded-3xl p-6 shadow-[0_10px_30px_rgba(91,123,111,0.2)] relative overflow-hidden text-left">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl translate-x-10 -translate-y-10" />
          <div className="relative z-10">
            <div className="bg-white/20 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-sm">
              <Camera size={24} className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1">{t('reportIssue')}</h2>
            <p className="text-sm text-white/80">{t('aiDescription')}</p>
          </div>
        </motion.button>
      </div>

      <div className="px-6 mt-4">
        <motion.button whileTap={{ scale: 0.98 }} onClick={() => navigate('/voice-report')}
          className="w-full bg-slate-800 text-white rounded-3xl p-5 shadow-[0_8px_25px_rgba(0,0,0,0.1)] relative overflow-hidden text-left border border-slate-700/80">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl translate-x-5 -translate-y-5" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="bg-primary/25 p-3 rounded-2xl text-primary flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white mb-0.5">Report by Talking 🎙</h2>
              <p className="text-xs text-slate-300">File a complaint step-by-step using voice in any language</p>
            </div>
          </div>
        </motion.button>
      </div>

      {(user?.role === 'Admin' || user?.role === 'Officer') && (
        <div className="px-6 mt-4">
          <button onClick={() => navigate('/admin')} className="w-full korean-card p-4 flex items-center gap-3 text-primary font-semibold border-primary/20">
            <Shield size={20} /> Open Authority Dashboard
          </button>
        </div>
      )}

      {user?.role === 'SuperAdmin' && (
        <div className="px-6 mt-4 space-y-3">
          <button onClick={() => navigate('/superadmin')} className="w-full bg-gradient-to-r from-slate-800 to-slate-900 text-white p-4 rounded-2xl flex items-center gap-3 font-semibold shadow-lg">
            <Shield size={20} /> MP State Command Center
          </button>
          <button onClick={() => navigate('/admin')} className="w-full korean-card p-4 flex items-center gap-3 text-primary font-semibold border-primary/20">
            <Shield size={20} /> Open Authority Dashboard
          </button>
        </div>
      )}

      <div className="px-6 mt-8">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-lg font-bold font-serif">{t('recentComplaints')}</h2>
          <button onClick={() => navigate('/map')} className="text-primary text-sm font-medium">{t('viewAll')}</button>
        </div>

        <div className="space-y-4">
          {complaints.length === 0 && (
            <div className="text-center py-10 text-textMuted text-sm">{t('noComplaints')}</div>
          )}
          {complaints.slice(0, 5).map((item, index) => (
            <motion.div role="button" tabIndex={0} key={item.id}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
              onClick={() => navigate(`/track/${item.id}`)}
              className="w-full text-left korean-card p-4 cursor-pointer" style={{ willChange: 'transform, opacity' }}>
              <div className="flex justify-between items-start gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${urgencyColor(item.urgency_level)}`}>{item.category || 'Civic'}</span>
                  <span className="text-xs text-textMuted flex items-center"><Clock size={12} className="mr-1" /> {formatRelativeTime(item.created_at)}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {item.is_fake ? <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-danger/10 text-danger">⚠ Flagged</span> : null}
                  <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${statusColor(item.status)}`}>{item.status || 'Pending'}</span>
                </div>
              </div>
              <div className="flex gap-4">
                {item.media_urls && item.media_urls.length > 0 && (
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-black/5 flex-shrink-0">
                    <img 
                      src={resolveImageUrl(item.media_urls[0])} 
                      alt="Evidence" 
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-textMuted m-auto"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>'; }}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-textMain mb-1 truncate">{item.title}</h3>
                  {typeof item.progress_percentage === 'number' && (
                    <div className="mb-2">
                      <div className="flex justify-between text-[10px] text-textMuted mb-1">
                        <span>Work progress</span><span>{item.progress_percentage}%</span>
                      </div>
                      <div className="h-1.5 bg-black/[0.06] rounded-full overflow-hidden">
                        <motion.div className="h-full bg-gradient-to-r from-primary to-teal rounded-full"
                          initial={{ width: 0 }} animate={{ width: `${item.progress_percentage}%` }} transition={{ duration: 0.8, delay: index * 0.05 }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center mt-3 gap-2">
                <div 
                  className="flex items-center text-xs text-textMuted min-w-0 cursor-pointer group hover:text-primary transition-colors flex-1"
                  onClick={(e) => { e.stopPropagation(); openInGoogleMaps(item.address, item.latitude, item.longitude); }}
                >
                  <MapPin size={12} className="mr-1 shrink-0 group-hover:text-primary group-hover:scale-125 transition-transform" />
                  <span className="truncate group-hover:underline">{item.address || 'Location pending'}</span>
                </div>
                {/resolved|completed/i.test(item.status) && !item.has_rated && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setRatingTarget(item); }} 
                    className="bg-primary/10 text-primary px-3 py-1.5 rounded-xl text-[10px] font-bold hover:bg-primary/20 transition-all active:scale-95"
                  >
                    Rate Service
                  </button>
                )}
                <div className="bg-surfaceLight p-1.5 rounded-full text-textMuted shrink-0"><ArrowRight size={14} /></div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      {/* Rating Modal */}
      <AnimatePresence>
        {ratingTarget && (
          <>
            <motion.div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !submittingRating && setRatingTarget(null)} />
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-md bg-white rounded-3xl pointer-events-auto p-8 shadow-elevated max-h-[90vh] overflow-y-auto">
              <h3 className="font-bold text-xl mb-1 font-serif text-slate-900">Rate Quality of Service</h3>
              <p className="text-textMuted text-sm mb-6">How was your experience with: <strong>{ratingTarget.title}</strong>?</p>
              
              <div className="flex justify-center gap-2 mb-8">
                {[1, 2, 3, 4, 5].map(star => (
                  <button key={star} onClick={() => setRatingValue(star)} className={`p-2 transition-transform active:scale-90 ${ratingValue >= star ? 'text-warning' : 'text-slate-200'}`}>
                    <Zap size={32} fill={ratingValue >= star ? 'currentColor' : 'none'} strokeWidth={2.5} />
                  </button>
                ))}
              </div>

              <div className="mb-6">
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block tracking-widest">Additional Feedback</label>
                <textarea 
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  placeholder="Share your thoughts on the resolution..."
                  className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm min-h-[100px] focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex gap-3">
                <button disabled={submittingRating} onClick={() => setRatingTarget(null)} className="flex-1 bg-slate-100 py-4 rounded-2xl text-sm font-bold">Cancel</button>
                <button disabled={submittingRating} onClick={handleRate} className="flex-1 bg-primary text-white py-4 rounded-2xl text-sm font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                  {submittingRating ? <Activity size={18} className="animate-spin" /> : 'Submit Rating'}
                </button>
              </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Notifications Panel */}
      <AnimatePresence>
        {showNotifications && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90]"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowNotifications(false)}
            />
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                className="w-full max-w-md bg-surface rounded-3xl pointer-events-auto shadow-elevated max-h-[90vh] flex flex-col"
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: 'spring', damping: 25 }}
              >
              <div className="flex items-center justify-between p-6 pb-4 border-b border-black/[0.05]">
                <div>
                  <h3 className="font-bold font-serif text-lg text-textMain">Notifications</h3>
                  <p className="text-xs text-textMuted">{complaints.length} complaint update{complaints.length !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={() => setShowNotifications(false)} className="p-2 rounded-full bg-surfaceLight text-textMuted">
                  <Zap size={16} />
                </button>
              </div>
              <div className="overflow-y-auto p-4 space-y-3 pb-8 flex-1">
                {complaints.length === 0 ? (
                  <div className="text-center py-12 text-textMuted">
                    <Bell size={40} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No complaints yet. Report an issue to get started!</p>
                  </div>
                ) : complaints.map((c) => {
                  const isNew = !seenIds.has(c.id);
                  const icon = /resolved|completed/i.test(c.status) ? '✅' : /progress/i.test(c.status) ? '🔧' : /assigned/i.test(c.status) ? '👷' : '📋';
                  const statusMsg = /resolved|completed/i.test(c.status)
                    ? 'Your complaint has been resolved!'
                    : /progress/i.test(c.status)
                    ? `Work is in progress by ${c.assigned_officer_name || 'a field officer'}`
                    : /assigned/i.test(c.status)
                    ? `Assigned to ${c.assigned_officer_name || 'an officer'}`
                    : 'Your complaint is pending assignment';
                  return (
                    <motion.div
                      key={c.id}
                      onClick={() => { setShowNotifications(false); navigate(`/track/${c.id}`); }}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all hover:shadow-md ${isNew ? 'bg-primary/5 border-primary/20' : 'bg-surfaceLight border-black/[0.05]'}`}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl shrink-0">{icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-xs font-bold text-textMain truncate">{c.title}</p>
                            {isNew && <span className="shrink-0 px-1.5 py-0.5 bg-primary text-white text-[9px] font-bold rounded-md">NEW</span>}
                          </div>
                          <p className="text-[11px] text-textMuted leading-relaxed">{statusMsg}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${statusColor(c.status)}`}>{c.status}</span>
                            <span className="text-[9px] text-textMuted">{formatRelativeTime(c.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
