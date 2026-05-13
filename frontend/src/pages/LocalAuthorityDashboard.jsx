import { useEffect, useState, useMemo } from 'react';
import { API_BASE } from '../lib/config';
import { useNavigate } from 'react-router-dom';
import { Shield, MapPin, Clock, CheckCircle, Camera, AlertTriangle, UserX, AlertCircle, X, ChevronRight, Truck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchComplaints, statusColor, urgencyColor } from '../lib/api';
import { useAuth } from '../lib/AuthContext';

export default function LocalAuthorityDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [activeTask, setActiveTask] = useState(null);
  
  // Progress Update State
  const [progress, setProgress] = useState(50);
  const [statusText, setStatusText] = useState('In Progress');
  const [workNote, setWorkNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const refreshTasks = () => {
      if (!user?.id) return;
      const query = `?assigned_officer_id=${user.id}`;
      fetchComplaints(query).then(data => {
        setTasks(data.filter(c => !/resolve|complete/i.test(c.status || '')));
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
          work_update_text: workNote || `Marked as ${statusText}`
        })
      });
      // Update local state
      setTasks(tasks.filter(t => progress === 100 ? t.id !== activeTask.id : true));
      setActiveTask(null);
      setWorkNote('');
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
          <button onClick={() => navigate('/dashboard')} className="text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-lg">Citizen View</button>
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
                        className="flex-1 bg-primary/10 text-primary text-[10px] font-bold py-1.5 rounded-lg text-center hover:bg-primary/20 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        GPS Tracking
                      </a>
                      <a 
                        href={`https://www.google.com/maps/search/${encodeURIComponent(task.address)}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex-1 bg-surfaceLight text-textMuted text-[10px] font-bold py-1.5 rounded-lg text-center hover:bg-black/5 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Search Address
                      </a>
                    </div>
                  )}
                </div>
                
                {isOverdue && (
                  <div className="flex items-center text-[10px] font-bold text-danger bg-danger/10 px-2 py-1 rounded-md mb-3 w-max">
                    <AlertCircle size={12} className="mr-1" /> OVERDUE
                  </div>
                )}
                
                <button 
                  onClick={() => { setActiveTask(task); setProgress(task.progress_percentage || 50); setStatusText(task.status === 'Pending' ? 'In Progress' : task.status); }}
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
            <motion.div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-surface rounded-t-[2rem] z-[100] p-6 shadow-elevated"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25 }}>
              
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-[10px] text-textMuted uppercase tracking-wider mb-1">Update Task</p>
                    <h3 className="font-bold font-serif leading-tight">{activeTask.title}</h3>
                  </div>
                  <button onClick={() => !submitting && setActiveTask(null)} className="p-1.5 bg-surfaceLight rounded-full"><X size={16}/></button>
                </div>
                
                <div className="bg-surfaceLight/50 p-3 rounded-2xl mb-5 space-y-3">
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
                  
                  {activeTask.latitude && activeTask.longitude && (
                    <div className="pt-3 border-t border-black/5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Shield size={12} className="text-primary" />
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-textMuted uppercase">Automated GPS</span>
                            <span className="text-[10px] font-mono text-textMuted">{activeTask.latitude.toFixed(6)}, {activeTask.longitude.toFixed(6)}</span>
                          </div>
                        </div>
                        <a 
                          href={`https://www.google.com/maps?q=${activeTask.latitude},${activeTask.longitude}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="bg-primary text-white text-[10px] font-bold px-3 py-2 rounded-lg shadow-soft"
                        >
                          Navigate via GPS
                        </a>
                      </div>
                    </div>
                  )}
                </div>

              <div className="space-y-5">
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
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
