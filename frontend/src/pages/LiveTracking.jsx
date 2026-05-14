import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Truck, ShieldAlert, Phone, Flag, MapPin, ChevronUp, AlertTriangle, Clock, Info, Star, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchComplaint, statusColor, urgencyColor, openInGoogleMaps } from '../lib/api';
import { API_BASE } from '../lib/config';

const TRACKING_STEPS = [
  { id: 'submitted', label: 'Submitted', desc: 'System processed and created a civic ticket.' },
  { id: 'verified', label: 'Verified', desc: 'Authority reviewed and verified the complaint.' },
  { id: 'assigned', label: 'Officer Assigned', desc: 'A field officer has been assigned.' },
  { id: 'dispatched', label: 'Team Dispatched', desc: 'Field team is en route to the location.' },
  { id: 'started', label: 'Work Started', desc: 'On-site work has commenced.' },
  { id: 'progress', label: 'In Progress', desc: 'Repair work is actively ongoing.' },
  { id: 'inspection', label: 'Final Inspection', desc: 'Authority performing quality check.' },
  { id: 'resolved', label: 'Resolved', desc: 'Complaint resolved and closed.' },
];

function activeIndexFor(status = '') {
  const s = status.toLowerCase();
  if (s.includes('resolve') || s.includes('complete')) return 7;
  if (s.includes('inspect')) return 6;
  if (s.includes('progress')) return 5;
  if (s.includes('started') || s.includes('work')) return 4;
  if (s.includes('dispatch')) return 3;
  if (s.includes('assign')) return 2;
  if (s.includes('verif')) return 1;
  if (s.includes('escalat')) return 5;
  return 0;
}

const ESCALATION_LEVELS = ['Junior Officer', 'Senior Officer', 'Department Head', 'Municipal Commissioner'];

export default function LiveTracking() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [complaint, setComplaint] = useState(null);
  const [showEscalate, setShowEscalate] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');
  const [escalating, setEscalating] = useState(false);
  const [escalateSuccess, setEscalateSuccess] = useState(false);
  const [workUpdates, setWorkUpdates] = useState([]);
  const [hasSubmittedFeedback, setHasSubmittedFeedback] = useState(false);
  const [officerRating, setOfficerRating] = useState(null);

  useEffect(() => {
    fetchComplaint(id).then((data) => {
      setComplaint(data);
      try {
        const updates = JSON.parse(data?.work_updates || '[]');
        setWorkUpdates(Array.isArray(updates) ? updates : []);
      } catch { setWorkUpdates([]); }

      // Check feedback status if complaint is completed
      if (data?.progress_percentage === 100) {
        const citizenId = localStorage.getItem('sentira_user_id') || 'demo-user'; // fallback for demo
        fetch(`${API_BASE}/api/feedback/check?citizen_id=${citizenId}&complaint_id=${id}`)
          .then(res => res.json())
          .then(check => setHasSubmittedFeedback(check.hasSubmitted))
          .catch(() => {});
      }
    });
  }, [id]);

  useEffect(() => {
    if (complaint?.assigned_officer_id) {
      fetch(`${API_BASE}/api/superadmin/ratings`)
        .then(r => r.json())
        .then(data => {
          if (data.officers) {
            const o = data.officers.find(x => x.id === complaint.assigned_officer_id);
            if (o) setOfficerRating(o.rating);
          }
        })
        .catch(() => {});
    }
  }, [complaint]);

  const activeIndex = useMemo(() => activeIndexFor(complaint?.status), [complaint]);
  const progress = complaint?.progress_percentage ?? (activeIndex / (TRACKING_STEPS.length - 1)) * 100;

  const isOverdue = useMemo(() => {
    if (!complaint?.expected_completion_date) return false;
    return new Date(complaint.expected_completion_date) < new Date() && !/resolve|complete/i.test(complaint?.status || '');
  }, [complaint]);

  const handleEscalate = async () => {
    if (!escalateReason.trim()) return;
    setEscalating(true);
    try {
      await fetch(`${API_BASE}/api/complaints/${id}/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: escalateReason, target_level: 'Senior Officer' }),
      });
      setEscalateSuccess(true);
      setTimeout(() => { setShowEscalate(false); setEscalateSuccess(false); }, 2000);
    } catch { /* ignore */ } finally {
      setEscalating(false);
    }
  };

  if (!complaint) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="flex flex-col items-center gap-3 text-textMuted">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading tracker...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-black/[0.06] bg-surface/70 sticky top-0 z-10 backdrop-blur-md">
        <div className="flex items-center min-w-0">
          <button onClick={() => navigate('/dashboard')} className="p-2 bg-surfaceLight rounded-full mr-3">
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <h1 className="font-bold text-lg truncate font-serif">Live Tracking</h1>
            <p className="text-xs text-textMuted truncate">ID: #{complaint.id?.slice(0, 8)}</p>
          </div>
        </div>
        <button onClick={() => setShowEscalate(true)}
          className="bg-danger/10 text-danger px-3 py-2 rounded-xl border border-danger/20 flex items-center text-xs font-bold gap-1.5">
          <Flag size={13} /> Escalate
        </button>
      </div>

      {/* Overdue Alert */}
      {isOverdue && (
        <div className="mx-4 mt-4 bg-danger/10 border border-danger/20 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-danger shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-danger">Deadline Overdue</p>
            <p className="text-xs text-textMuted mt-0.5">This complaint was due on {new Date(complaint.expected_completion_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}. Tap Escalate to alert higher authority.</p>
          </div>
        </div>
      )}

      {/* Fake complaint warning */}
      {complaint.is_fake ? (
        <div className="mx-4 mt-4 bg-warning/10 border border-warning/20 rounded-2xl p-4 flex items-start gap-3">
          <ShieldAlert size={18} className="text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-warning">Flagged for Review</p>
            <p className="text-xs text-textMuted mt-0.5">{complaint.fake_reason || 'System detected potential fraud. Authority is reviewing.'}</p>
          </div>
        </div>
      ) : null}

      {/* Map Visual */}
      <div className="h-48 w-full bg-surface/60 border-b border-black/[0.06] relative overflow-hidden flex items-center justify-center map-grid mt-4 mx-0">
        <svg className="absolute inset-0 w-full h-full text-primary/30" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M 18 76 Q 42 45 62 56 T 86 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="4 4" />
        </svg>
        <div className="absolute top-[28%] right-[22%] bg-danger p-2 rounded-full text-white border-2 border-white shadow-lg">
          <ShieldAlert size={16} />
        </div>
        <div className="absolute left-[38%] top-[50%] flex flex-col items-center">
          <div className="bg-primary p-2.5 rounded-full text-white animate-bounce shadow-2xl border-2 border-white">
            <Truck size={18} />
          </div>
          <div className="mt-1 bg-surface/90 backdrop-blur-md px-2 py-0.5 rounded-md border border-black/[0.06] text-[10px] font-bold">En Route</div>
        </div>
        <div 
          className="absolute bottom-3 left-3 right-3 bg-surface/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-black/[0.06] text-xs flex items-center shadow-card cursor-pointer hover:border-primary/30 hover:text-primary transition-all group"
          onClick={() => openInGoogleMaps(complaint.address, complaint.latitude, complaint.longitude)}
        >
          <MapPin size={12} className="mr-2 text-teal shrink-0 group-hover:text-primary group-hover:scale-125 transition-transform" />
          <span className="truncate group-hover:underline">{complaint.address || 'Location pending'}</span>
          <span className="ml-auto text-[10px] text-primary font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pl-2">Open in Maps →</span>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Complaint Card */}
        <div className="korean-card p-5 shadow-card">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-xs text-textMuted uppercase tracking-wide mb-1">{complaint.category || 'Civic Issue'}</p>
              <h2 className="text-lg font-bold font-serif">{complaint.title}</h2>
              <p className="text-sm text-textMuted mt-1.5 leading-relaxed">{complaint.description}</p>
            </div>
            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase whitespace-nowrap ${urgencyColor(complaint.urgency_level)}`}>
              {complaint.urgency_level || 'Medium'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-surfaceLight rounded-xl p-3">
              <p className="text-[10px] text-textMuted uppercase">Status</p>
              <p className={`inline-block mt-1.5 px-2 py-1 rounded-full text-xs font-semibold ${statusColor(complaint.status)}`}>{complaint.status || 'Pending'}</p>
            </div>
            <div className="bg-surfaceLight rounded-xl p-3">
              <p className="text-[10px] text-textMuted uppercase">Priority</p>
              <p className="text-lg font-bold mt-1">{complaint.priority_score || 5}/10</p>
            </div>
          </div>

          {complaint.expected_completion_date && (
            <div className={`flex items-center gap-2 text-xs p-2.5 rounded-xl ${isOverdue ? 'bg-danger/10 text-danger' : 'bg-surfaceLight text-textMuted'}`}>
              <Clock size={13} className="shrink-0" />
              <span>{isOverdue ? 'Was due' : 'Expected by'}: {new Date(complaint.expected_completion_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="korean-card p-5">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-sm">Work Progress</h3>
            <span className="text-primary font-bold text-lg">{Math.round(progress)}%</span>
          </div>
          <div className="h-3 bg-surfaceLight rounded-full overflow-hidden mb-1">
            <motion.div
              className="h-full bg-gradient-to-r from-primary via-teal to-teal rounded-full relative overflow-hidden"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            </motion.div>
          </div>
          <p className="text-xs text-textMuted mt-2">
            {progress === 100 ? '✅ Work completed' : progress > 0 ? `${TRACKING_STEPS[Math.min(activeIndex, TRACKING_STEPS.length-1)].label} – work ongoing` : 'Awaiting assignment'}
          </p>
          
          {progress === 100 && !hasSubmittedFeedback && (
            <motion.button 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }}
              onClick={() => navigate(`/feedback?complaintId=${complaint.id}`)}
              className="w-full mt-4 bg-primary/10 text-primary py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-primary/20 transition-colors"
            >
              <Star size={16} className="fill-primary" /> Give Feedback
            </motion.button>
          )}

          {progress === 100 && hasSubmittedFeedback && (
            <div className="mt-4 p-3 bg-teal/10 rounded-2xl flex items-center justify-center gap-2 text-teal text-sm font-bold">
              <CheckCircle size={16} /> Feedback Submitted
            </div>
          )}
        </div>

        {/* Assigned Officer */}
        <div className="korean-card p-4">
          <p className="text-xs text-textMuted uppercase tracking-wide mb-3">Assigned Officer</p>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-teal/30 flex items-center justify-center font-bold text-sm">
              {(complaint.assigned_officer_name || 'RK').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{complaint.assigned_officer_name || 'Rajesh Kumar'}</p>
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-textMuted uppercase tracking-wider">Ward Officer · {complaint.department_id || 'PWD'}</p>
                {officerRating && (
                  <div className="flex items-center gap-1 bg-warning/10 text-warning px-1.5 py-0.5 rounded text-[8px] font-bold">
                    <Zap size={8} fill="currentColor" /> {officerRating}
                  </div>
                )}
              </div>
            </div>
            <button 
              onClick={() => complaint.assigned_officer_phone ? window.location.href = `tel:${complaint.assigned_officer_phone}` : alert('Phone number not available for this officer.')}
              className="p-2 bg-primary/10 text-primary rounded-full transition-transform hover:scale-110 active:scale-95"
              title={complaint.assigned_officer_phone || 'No phone number available'}
            >
              <Phone size={15} />
            </button>
          </div>
        </div>

        {/* Timeline */}
        <div>
          <h3 className="font-bold mb-4 font-serif">Status Timeline</h3>
          <div className="relative pl-3">
            <div className="absolute left-6 top-2 bottom-6 w-0.5 bg-black/[0.06]" />
            {TRACKING_STEPS.map((step, index) => {
              const isCompleted = index < activeIndex;
              const isCurrent = index === activeIndex;
              return (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.06 }}
                  key={step.id}
                  className="flex mb-5 relative z-10"
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center border-[3px] border-background z-10 shrink-0 mt-0.5 ${
                    isCompleted ? 'bg-primary text-white' :
                    isCurrent ? 'bg-teal text-white shadow-[0_0_12px_rgba(123,168,160,0.4)] animate-pulse' :
                    'bg-surfaceLight border-black/10 text-textMuted'
                  }`}>
                    {isCompleted && <CheckCircle size={13} />}
                    {isCurrent && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <div className="ml-4 flex-1">
                    <h4 className={`font-semibold text-sm ${!isCompleted && !isCurrent ? 'text-textMuted' : 'text-textMain'}`}>{step.label}</h4>
                    <p className="text-xs text-textMuted leading-relaxed mt-0.5">{step.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Work Updates Feed */}
        {workUpdates.length > 0 && (
          <div>
            <h3 className="font-bold mb-3 flex items-center gap-2 font-serif"><Info size={16} className="text-primary" /> Field Updates</h3>
            <div className="space-y-3">
              {workUpdates.map((u, i) => (
                <div key={i} className="korean-card p-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-textMuted">{new Date(u.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="text-primary text-xs font-bold">{u.progress}%</span>
                  </div>
                  <p className="text-sm">{u.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Escalate Sheet */}
      <AnimatePresence>
        {showEscalate && (
          <>
            <motion.div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowEscalate(false)} />
            <motion.div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-surface rounded-t-[2rem] border-t border-black/[0.06] z-40 p-6 shadow-elevated"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30 }}>
              <div className="w-10 h-1 bg-black/10 rounded-full mx-auto mb-5" />
              <h3 className="font-bold text-lg mb-1 font-serif">Escalate Complaint</h3>
              <p className="text-textMuted text-sm mb-4">Send this complaint to a higher authority for urgent action.</p>

              <div className="mb-4">
                <p className="text-xs text-textMuted uppercase tracking-wide mb-2">Escalation Path</p>
                <div className="flex items-center gap-1 flex-wrap">
                  {ESCALATION_LEVELS.map((lvl, i) => (
                    <span key={lvl} className="flex items-center gap-1 text-xs">
                      <span className="bg-surfaceLight px-2 py-1 rounded-lg">{lvl}</span>
                      {i < ESCALATION_LEVELS.length - 1 && <ChevronUp size={12} className="text-textMuted rotate-90" />}
                    </span>
                  ))}
                </div>
              </div>

              {escalateSuccess ? (
                <div className="bg-primary/10 text-primary rounded-2xl p-4 text-center font-semibold flex items-center justify-center gap-2">
                  <CheckCircle size={18} /> Escalated successfully!
                </div>
              ) : (
                <>
                  <textarea
                    className="w-full bg-surfaceLight border border-black/[0.06] rounded-2xl p-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 resize-none mb-4 transition-all"
                    rows={3}
                    placeholder="Describe why you are escalating (e.g. work not started after 5 days)..."
                    value={escalateReason}
                    onChange={(e) => setEscalateReason(e.target.value)}
                  />
                  <button
                    onClick={handleEscalate}
                    disabled={escalating || !escalateReason.trim()}
                    className="w-full bg-danger text-white font-bold py-4 rounded-2xl disabled:opacity-50 transition-colors active:scale-95"
                  >
                    {escalating ? 'Escalating...' : 'Send Escalation'}
                  </button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
