import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { API_BASE } from '../lib/config';
import { useNavigate } from 'react-router-dom';
import { Shield, MapPin, Clock, CheckCircle, Camera, AlertTriangle, UserX, AlertCircle, X, ChevronRight, Truck, Activity, Bell, Search, Navigation, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchComplaints, statusColor, urgencyColor, formatRelativeTime, resolveImageUrl } from '../lib/api';
import { useAuth } from '../lib/AuthContext';

// Generate a notification chime using Web Audio API (no external file needed)
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // First tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(830, ctx.currentTime);
    gain1.gain.setValueAtTime(0.3, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.3);
    // Second tone (higher, delayed)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1100, ctx.currentTime + 0.15);
    gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.5);
  } catch (e) {
    // Silently fail — audio may not be available
  }
}

export default function LocalAuthorityDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [activeTask, setActiveTask] = useState(null);
  
  // Progress Update State
  const [progress, setProgress] = useState(50);
  const [statusText, setStatusText] = useState('In Progress');
  const [workNote, setWorkNote] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Notification State
  const [showNotifications, setShowNotifications] = useState(false);
  const [seenIds, setSeenIds] = useState(() => new Set(JSON.parse(localStorage.getItem('sentria_officer_notifs') || '[]')));

  // Device Notification Request
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const prevTaskIdsRef = useRef(new Set());
  const hasInteracted = useRef(false);

  // Track user interaction so we can play sound (browser requires gesture first)
  useEffect(() => {
    const handler = () => { hasInteracted.current = true; };
    window.addEventListener('click', handler, { once: true });
    window.addEventListener('touchstart', handler, { once: true });
    return () => { window.removeEventListener('click', handler); window.removeEventListener('touchstart', handler); };
  }, []);

  useEffect(() => {
    const refreshTasks = () => {
      if (!user?.id) return;
      const query = `?assigned_officer_id=${user.id}`;
      fetchComplaints(query).then(data => {
        const activeTasks = data.filter(c => !/resolve|complete/i.test(c.status || ''));
        
        // Detect NEW tasks that weren't in the previous set
        const currentIds = new Set(activeTasks.map(t => t.id));
        const prevIds = prevTaskIdsRef.current;
        const newTasks = activeTasks.filter(t => !prevIds.has(t.id));
        
        if (newTasks.length > 0 && prevIds.size > 0 && hasInteracted.current) {
          playNotificationSound();
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              const notif = new Notification('New Civic Task Assigned', {
                body: `You have ${newTasks.length} new task(s) to review.`,
                icon: '/logo.png',
                badge: '/logo.png'
              });
              notif.onclick = () => {
                window.focus();
                notif.close();
              };
            } catch (e) {
              console.warn('Device notification failed:', e);
            }
          }
        }
        
        prevTaskIdsRef.current = currentIds;
        setTasks(activeTasks);
      });
    };

    refreshTasks();
    const interval = setInterval(refreshTasks, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [user?.id]);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      // Emergency first
      const urgencyMap = { 'Emergency': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
      const valA = urgencyMap[a.urgency_level] || 0;
      const valB = urgencyMap[b.urgency_level] || 0;
      return valB - valA;
    });
  }, [tasks]);

  // ─── Address Search State ────────────────────────────────
  const [addressQuery, setAddressQuery] = useState('');
  const [addressResults, setAddressResults] = useState([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const searchTimerRef = useRef(null);

  const handleAddressSearch = useCallback((query) => {
    setAddressQuery(query);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (query.trim().length < 3) {
      setAddressResults([]);
      return;
    }
    setAddressLoading(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=6&addressdetails=1`
        );
        const data = await res.json();
        setAddressResults(data.map(r => ({
          name: r.display_name,
          lat: parseFloat(r.lat),
          lon: parseFloat(r.lon),
          type: r.type,
          shortName: [r.address?.road, r.address?.suburb, r.address?.city || r.address?.town || r.address?.state_district].filter(Boolean).join(', ') || r.display_name.split(',').slice(0, 3).join(',')
        })));
      } catch (e) {
        console.error('Address search failed:', e);
        setAddressResults([]);
      } finally {
        setAddressLoading(false);
      }
    }, 400);
  }, []);

  const handleUpdateProgress = async () => {
    if (!activeTask) return;
    setSubmitting(true);
    try {
      await fetch(`${API_BASE}/api/complaints/${activeTask.id}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          progress_percentage: progress,
          status: statusText,
          work_update_text: workNote || `Marked as ${statusText}`,
          new_expected_date: newDueDate || undefined
        })
      });
      // Update local state
      setTasks(tasks.filter(t => progress === 100 ? t.id !== activeTask.id : true));
      setActiveTask(null);
      setWorkNote('');
      setNewDueDate('');
    } catch (e) {
      console.error(e);
      alert('Failed to update progress.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFlagFake = async () => {
    if (!activeTask) return;
    if(!window.confirm("Are you sure you want to flag this as a fake report? The citizen's trust score will be impacted.")) return;
    
    setSubmitting(true);
    try {
      // In a real app, this would hit a specific endpoint to flag fake and penalize citizen
      await fetch(`${API_BASE}/api/admin/users/${activeTask.citizen_id}/ban`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_banned: true, ban_reason: 'Flagged by field officer for submitting fake reports.' })
      });
      
      // Mark complaint as resolved/closed
      await fetch(`${API_BASE}/api/complaints/${activeTask.id}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          progress_percentage: 100,
          status: 'Closed (Fake)',
          work_update_text: 'Officer arrived on site and verified this is a fake report.'
        })
      });

      setTasks(tasks.filter(t => t.id !== activeTask.id));
      setActiveTask(null);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">
      <div className="bg-surface border-b border-black/[0.06] p-4 sticky top-0 z-20">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <img src="/logo.png" className="w-12 h-12 object-contain" alt="Logo" />
            <div>
              <h1 className="font-bold text-sm leading-tight font-serif">Field Officer Portal</h1>
              <p className="text-[10px] text-textMuted uppercase tracking-wider">My Assigned Tasks</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowNotifications(true);
                const ids = tasks.map(t => t.id);
                localStorage.setItem('sentria_officer_notifs', JSON.stringify(ids));
                setSeenIds(new Set(ids));
              }}
              className="relative p-2 text-textMuted hover:text-textMain transition-colors"
            >
              <Bell size={18} />
              {tasks.filter(t => !seenIds.has(t.id)).length > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-danger rounded-full border-2 border-white animate-pulse" />
              )}
            </button>
          </div>
        </div>
      </div>



      <div className="p-4 space-y-4">
        {sortedTasks.length === 0 ? (
          <div className="text-center py-10 text-textMuted text-sm">
            <CheckCircle size={36} className="mx-auto text-teal/40 mb-3" />
            No pending tasks! Great job.
          </div>
        ) : (
          sortedTasks.map((task) => {
            const isOverdue = new Date(task.expected_completion_date) < new Date();
            
            return (
              <div key={task.id} className={`korean-card p-4 border-l-4 ${task.urgency_level === 'Emergency' ? 'border-l-danger' : isOverdue ? 'border-l-warning' : 'border-l-primary'}`}>
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider ${urgencyColor(task.urgency_level)}`}>
                    {task.urgency_level || 'Medium'}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${statusColor(task.status)}`}>
                    {task.status || 'Pending'}
                  </span>
                </div>
                
                  {task.media_urls && task.media_urls.length > 0 && (
                    <div className="w-full h-32 mb-3 rounded-xl overflow-hidden bg-black/5 relative">
                      <img 
                        src={resolveImageUrl(task.media_urls[0])} 
                        alt="Task Evidence" 
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                      <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-md text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold">
                        ORIGINAL EVIDENCE
                      </div>
                    </div>
                  )}

                  <h3 className="font-bold mb-1">{task.title}</h3>
                
                <div className="space-y-1 mb-3">
                  <div className="flex items-center text-xs text-textMuted group cursor-pointer" onClick={(e) => { e.stopPropagation(); if(task.address) window.open(`https://www.google.com/maps/search/${encodeURIComponent(task.address)}`, '_blank'); }}>
                    <MapPin size={12} className="mr-1 shrink-0 text-teal group-hover:scale-125 transition-transform" /> 
                    <span className="truncate group-hover:text-primary group-hover:underline">{task.address || 'Location pending'}</span>
                  </div>
                  {task.latitude && task.longitude && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-black/5 mt-2">
                      <a 
                        href={`https://www.google.com/maps?q=${task.latitude},${task.longitude}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex-1 bg-primary/10 text-primary text-[10px] font-bold py-1.5 rounded-lg text-center hover:bg-primary/20 transition-colors flex items-center justify-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Navigation size={10} /> GPS Navigate
                      </a>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setAddressQuery(task.address || '');
                          handleAddressSearch(task.address || '');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="flex-1 bg-surfaceLight text-textMuted text-[10px] font-bold py-1.5 rounded-lg text-center hover:bg-black/5 transition-colors flex items-center justify-center gap-1"
                      >
                        <Search size={10} /> Search Nearby
                      </button>
                    </div>
                  )}
                </div>
                
                {isOverdue && (
                  <div className="flex items-center text-[10px] font-bold text-danger bg-danger/10 px-2 py-1 rounded-md mb-3 w-max">
                    <AlertCircle size={12} className="mr-1" /> OVERDUE
                  </div>
                )}
                
                <button 
                  onClick={() => { 
                    setActiveTask(task); 
                    setProgress(task.progress_percentage || 50); 
                    setStatusText(task.status === 'Pending' ? 'In Progress' : task.status); 
                    setNewDueDate('');
                  }}
                  className="w-full bg-surfaceLight hover:bg-primary/10 hover:text-primary text-textMain text-xs font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1 border border-black/5"
                >
                  Update Status <ChevronRight size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Task Action Modal */}
      <AnimatePresence>
        {activeTask && (
          <>
            <motion.div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[90]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !submitting && setActiveTask(null)} />
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
              <motion.div className="w-full max-w-md bg-surface rounded-3xl p-6 shadow-elevated pointer-events-auto max-h-[90vh] overflow-y-auto"
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ type: 'spring', damping: 25 }}>
              
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-[10px] text-textMuted uppercase tracking-wider mb-1">Update Task</p>
                    <h3 className="font-bold font-serif leading-tight">{activeTask.title}</h3>
                  </div>
                  <button onClick={() => !submitting && setActiveTask(null)} className="p-1.5 bg-surfaceLight rounded-full"><X size={16}/></button>
                </div>
                
                <div className="bg-surfaceLight/50 p-3 rounded-2xl mb-5 space-y-3">
                  {activeTask.media_urls && activeTask.media_urls.length > 0 && (
                    <div className="rounded-xl overflow-hidden mb-2 border border-black/5">
                      <img 
                        src={resolveImageUrl(activeTask.media_urls[0])} 
                        alt="Evidence" 
                        className="w-full h-auto object-cover max-h-48"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="text-teal shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-[10px] text-textMuted uppercase font-bold">Written Address</p>
                      <p className="text-xs font-medium leading-relaxed">{activeTask.address || 'N/A'}</p>
                      <a 
                        href={activeTask.address ? `https://www.google.com/maps/search/${encodeURIComponent(activeTask.address)}` : '#'} 
                        target="_blank" 
                        rel="noreferrer"
                        className={`inline-block mt-1 text-[10px] font-bold text-primary hover:underline ${!activeTask.address && 'opacity-50 pointer-events-none'}`}
                      >
                        Navigate via Address →
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 pt-3 border-t border-black/5">
                    <Shield size={14} className="text-primary shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-[10px] text-textMuted uppercase font-bold">Citizen Description</p>
                      <p className="text-xs font-medium leading-relaxed italic text-textMain">
                        "{activeTask.description || 'No description provided.'}"
                      </p>
                    </div>
                  </div>
                  
                  {activeTask.latitude && activeTask.longitude && (
                    <div className="pt-3 border-t border-black/5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Activity size={12} className="text-primary" />
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-textMuted uppercase">Precision GPS</span>
                            <span className="text-[10px] font-mono text-textMuted">{activeTask.latitude.toFixed(6)}, {activeTask.longitude.toFixed(6)}</span>
                          </div>
                        </div>
                        <a 
                          href={`https://www.google.com/maps?q=${activeTask.latitude},${activeTask.longitude}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="bg-primary text-white text-[10px] font-bold px-3 py-2 rounded-lg shadow-soft"
                        >
                          GPS Map
                        </a>
                      </div>
                    </div>
                  )}
                </div>

              <div className="space-y-5">
                {activeTask.due_date_updated === 0 && (
                  <div className="bg-primary/5 border border-primary/20 p-3 rounded-xl">
                    <label className="text-xs font-bold mb-1.5 block text-primary">Expected Completion Date (One-time update)</label>
                    <input 
                      type="date" 
                      value={newDueDate} 
                      onChange={(e) => setNewDueDate(e.target.value)} 
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full bg-white border border-black/[0.06] rounded-xl p-2.5 text-sm focus:outline-none focus:border-primary" 
                    />
                    <p className="text-[9px] text-textMuted mt-1">Update this after your initial site visit to set realistic expectations.</p>
                  </div>
                )}
                
                <div>
                  <div className="flex justify-between text-xs mb-2 font-bold">
                    <span>Work Progress ({progress}%)</span>
                  </div>
                  <input type="range" min="0" max="100" step="10" value={progress} onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setProgress(val);
                    if(val === 100) setStatusText('Resolved');
                    else if(val > 0) setStatusText('In Progress');
                    else setStatusText('Pending');
                  }} className="w-full accent-primary" />
                </div>

                <div>
                  <label className="text-xs font-bold mb-1 block">Status Label</label>
                  <select value={statusText} onChange={(e) => setStatusText(e.target.value)} className="w-full bg-surfaceLight border border-black/[0.06] rounded-xl p-3 text-sm focus:outline-none focus:border-primary">
                    <option value="Pending">Pending Assignment</option>
                    <option value="Dispatched">Team Dispatched</option>
                    <option value="In Progress">Work In Progress</option>
                    <option value="Inspection">Final Inspection</option>
                    <option value="Resolved">Work Completed (Resolved)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold mb-1 block">Proof of Work Note (Required for 100%)</label>
                  <textarea 
                    value={workNote} onChange={(e) => setWorkNote(e.target.value)}
                    placeholder="Describe the work done..."
                    className="w-full bg-surfaceLight border border-black/[0.06] rounded-xl p-3 text-sm focus:outline-none focus:border-primary resize-none h-20"
                  />
                </div>

                <div className="flex gap-2">
                  <button className="bg-surfaceLight text-textMuted p-3 rounded-xl flex items-center justify-center border border-black/5 flex-shrink-0">
                    <Camera size={20} />
                  </button>
                  <button 
                    onClick={handleUpdateProgress} disabled={submitting || (progress === 100 && !workNote.trim())}
                    className="flex-1 bg-primary text-white font-bold py-3 rounded-xl disabled:opacity-50 transition-transform active:scale-95"
                  >
                    {submitting ? 'Updating...' : progress === 100 ? 'Close Complaint' : 'Save Update'}
                  </button>
                </div>

                <div className="pt-4 border-t border-black/5 mt-2">
                  <button onClick={handleFlagFake} disabled={submitting} className="w-full flex items-center justify-center gap-2 text-xs font-bold text-danger bg-danger/10 py-3 rounded-xl">
                    <UserX size={14} /> Flag as Fake & Block Citizen
                  </button>
                </div>
              </div>

              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Notifications Panel — centered, 300px wide */}
      <AnimatePresence>
        {showNotifications && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowNotifications(false)}
            />
            <motion.div
              className="relative bg-surface rounded-3xl shadow-elevated pointer-events-auto flex flex-col"
              style={{ width: 300, maxHeight: '80vh' }}
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
            >
              <div className="flex items-center justify-between p-5 pb-3 border-b border-black/[0.05] shrink-0">
                <div>
                  <h3 className="font-bold font-serif text-base text-textMain">Notifications</h3>
                  <p className="text-[10px] text-textMuted">{tasks.length} assigned task{tasks.length !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={() => setShowNotifications(false)} className="p-1.5 rounded-full bg-surfaceLight text-textMuted hover:text-textMain transition-colors">
                  <X size={14} />
                </button>
              </div>
              <div className="overflow-y-auto p-3 space-y-2 pb-6 flex-1">
                {tasks.length === 0 ? (
                  <div className="text-center py-10 text-textMuted">
                    <Bell size={32} className="mx-auto mb-2 opacity-20" />
                    <p className="text-xs">No tasks assigned yet.</p>
                  </div>
                ) : tasks.map((t) => {
                  const isNew = !seenIds.has(t.id);
                  const icon = /emergency/i.test(t.urgency_level) ? '🔥' : /high/i.test(t.urgency_level) ? '⚠️' : '📋';
                  return (
                    <motion.div
                      key={t.id}
                      onClick={() => {
                        setShowNotifications(false);
                        setActiveTask(t);
                        setProgress(t.progress_percentage || 50);
                        setStatusText(t.status === 'Pending' ? 'In Progress' : t.status);
                      }}
                      className={`p-3 rounded-xl border cursor-pointer transition-all hover:shadow-md ${isNew ? 'bg-primary/5 border-primary/20' : 'bg-surfaceLight border-black/[0.05]'}`}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-lg shrink-0">{icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <p className="text-[11px] font-bold text-textMain truncate">{t.title}</p>
                            {isNew && <span className="shrink-0 px-1 py-0.5 bg-primary text-white text-[8px] font-bold rounded">NEW</span>}
                          </div>
                          <p className="text-[10px] text-textMuted truncate">{t.address || 'Location pending'}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${urgencyColor(t.urgency_level)}`}>{t.urgency_level || 'Medium'}</span>
                            <span className="text-[8px] text-textMuted">{formatRelativeTime(t.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
