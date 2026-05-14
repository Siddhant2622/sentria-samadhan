import { useEffect, useMemo, useState } from 'react';
import { Shield, Filter, Search, Map as MapIcon, BarChart2, Bell, Clock, AlertTriangle, Home, Users, CheckCircle, Ban, Eye, TrendingUp, ChevronRight, Plus, Zap } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchComplaints, formatRelativeTime, statusColor, urgencyColor, openInGoogleMaps } from '../lib/api';
import { API_BASE } from '../lib/config';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'board');
  const [complaints, setComplaints] = useState([]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [banReason, setBanReason] = useState('');
  const [banning, setBanning] = useState(false);
  const [showAddAuthority, setShowAddAuthority] = useState(false);
  const [editingOfficer, setEditingOfficer] = useState(null);
  const [newAuthority, setNewAuthority] = useState({ name: '', department: '', email: '' });
  const [assigningTo, setAssigningTo] = useState(null);
  const [officerRatings, setOfficerRatings] = useState({});

  const fetchOfficers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/officers`);
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
      
      const rRes = await fetch(`${API_BASE}/api/superadmin/ratings`);
      const rData = await rRes.json();
      if (rData.officers) {
        const mapping = {};
        rData.officers.forEach(o => mapping[o.id] = o);
        setOfficerRatings(mapping);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchComplaints().then(setComplaints);
    fetchOfficers();
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return complaints;
    return complaints.filter((item) =>
      [item.id, item.title, item.category, item.address, item.department_id, item.status]
        .filter(Boolean).some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [complaints, query]);

  const stats = useMemo(() => ({
    escalated: complaints.filter((item) => item.urgency_level === 'Emergency' || /escalat/i.test(item.status || '')).length,
    resolved: complaints.filter((item) => /resolved|complete/i.test(item.status || '')).length,
    active: complaints.filter((item) => !/resolved|complete/i.test(item.status || '')).length,
    fake: complaints.filter((item) => item.is_fake).length,
  }), [complaints]);

  const handleBan = async (userId, ban) => {
    setBanning(true);
    try {
      await fetch(`${API_BASE}/api/admin/users/${userId}/ban`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_banned: ban, ban_reason: banReason }),
      });
      setSelectedUser(null);
      setBanReason('');
    } catch { /* ignore */ } finally { setBanning(false); }
  };

  const tabs = [
    { id: 'board', label: 'Cases', icon: Clock },
    { id: 'fraud', label: 'Fraud', icon: AlertTriangle },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'sla', label: 'SLA', icon: BarChart2 },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Dancheong accent line */}
      <div className="dancheong-line" />

      {/* Header */}
      <div className="bg-surface border-b border-black/[0.06] p-4 sticky top-0 z-20">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-3">
            <img src="/logo.png" className="w-11 h-11 object-contain" alt="Logo" />
            <div>
              <h1 className="font-bold text-sm leading-tight font-serif">Authority Portal</h1>
              <p className="text-[10px] text-textMuted uppercase tracking-wider">Sentria Samadhan Command</p>
            </div>
          </div>
          <button className="relative p-2 text-textMuted hover:text-textMain transition-colors">
            <Bell size={18} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full border border-white" />
          </button>
        </div>

        <div className="flex bg-surfaceLight p-1 rounded-xl gap-1">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-1.5 text-[10px] font-semibold rounded-lg flex justify-center items-center gap-1 transition-colors ${activeTab === tab.id ? 'bg-surface shadow-soft text-primary' : 'text-textMuted'}`}>
              <tab.icon size={12} /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { label: 'Escalated', value: stats.escalated, color: 'text-danger', icon: AlertTriangle },
            { label: 'Resolved', value: stats.resolved, color: 'text-teal', icon: CheckCircle },
            { label: 'Active', value: stats.active, color: 'text-primary', icon: Users },
            { label: 'Fake Reports', value: stats.fake, color: 'text-warning', icon: Shield },
          ].map((item) => (
            <div key={item.label} className="korean-card p-4">
              <item.icon size={15} className={item.color} />
              <h3 className={`text-2xl font-bold mt-2 ${item.color}`}>{item.value}</h3>
              <p className="text-xs text-textMuted mt-1">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="flex space-x-2 mb-5">
          <div className="flex-1 bg-surface border border-black/[0.06] rounded-xl flex items-center px-3 shadow-soft">
            <Search size={15} className="text-textMuted mr-2" />
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search complaints..." className="bg-transparent border-none py-2.5 text-sm w-full focus:outline-none" />
          </div>
          <button className="bg-surface border border-black/[0.06] p-2.5 rounded-xl text-textMuted hover:text-textMain shadow-soft transition-colors">
            <Filter size={16} />
          </button>
        </div>

        {/* Cases Board */}
        {activeTab === 'board' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-xs uppercase tracking-wider text-textMuted">All Complaints</h2>
              <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-bold">{filtered.length}</span>
            </div>
            {filtered.map((c, index) => (
              <motion.button type="button" key={c.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
                onClick={() => navigate(`/track/${c.id}`)}
                className="w-full text-left korean-card p-4">
                <div className="flex justify-between items-start mb-2 gap-3">
                  <span className="text-xs font-mono text-textMuted bg-surfaceLight px-2 py-1 rounded-md truncate">#{c.id?.slice(0,8)}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {c.is_fake ? <span className="text-[10px] px-2 py-1 rounded-full font-bold bg-danger/10 text-danger">⚠ Fake</span> : null}
                    <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider whitespace-nowrap ${urgencyColor(c.urgency_level)}`}>{c.urgency_level || 'Medium'}</span>
                  </div>
                </div>
                <h3 className="font-bold text-textMain mb-1">{c.title}</h3>
                <div className="flex items-center text-xs text-textMuted mb-2">
                  <span 
                    className="flex items-center min-w-0 cursor-pointer group hover:text-primary transition-colors"
                    onClick={(e) => { e.stopPropagation(); openInGoogleMaps(c.address, c.latitude, c.longitude); }}
                  >
                    <MapIcon size={11} className="mr-1 shrink-0 group-hover:text-primary group-hover:scale-125 transition-transform" />
                    <span className="truncate group-hover:underline">{c.address || 'Location pending'}</span>
                  </span>
                  <span className="mx-2">·</span>
                  <Clock size={11} className="mr-1 shrink-0" /> {formatRelativeTime(c.created_at)}
                </div>
                {typeof c.progress_percentage === 'number' && (
                  <div className="mb-3">
                    <div className="h-1.5 bg-surfaceLight rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary to-teal rounded-full" style={{ width: `${c.progress_percentage}%` }} />
                    </div>
                    <p className="text-[10px] text-textMuted mt-1">{c.progress_percentage}% complete</p>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-black/[0.04] gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor(c.status)}`}>{c.status || 'Pending'}</span>
                    {c.assigned_officer_name && (
                      <span className="text-[10px] bg-teal/10 text-teal px-2 py-1 rounded-md font-medium">Assigned to: {c.assigned_officer_name}</span>
                    )}
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setAssigningTo(c); }}
                    className="bg-primary/10 text-primary text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-primary/20 transition-colors"
                  >
                    {c.assigned_officer_id ? 'Reassign' : 'Assign Officer'} <Plus size={12} />
                  </button>
                </div>
              </motion.button>
            ))}
          </div>
        )}

        {/* Fraud Panel */}
        {activeTab === 'fraud' && (
          <div className="space-y-4">
            <div className="bg-warning/10 border border-warning/20 rounded-2xl p-4 flex gap-3">
              <AlertTriangle size={18} className="text-warning shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-warning">Automated Verification Active</p>
                <p className="text-xs text-textMuted mt-1">Complaints flagged by our automated verification system for suspicious images, metadata mismatch or duplicate uploads are shown below.</p>
              </div>
            </div>
            {complaints.filter(c => c.is_fake).length === 0 ? (
              <div className="text-center py-10 text-textMuted text-sm flex flex-col items-center gap-3">
                <CheckCircle size={36} className="text-primary/30" />
                No fake complaints detected.
              </div>
            ) : (
              complaints.filter(c => c.is_fake).map((c, i) => (
                <div key={c.id} className="korean-card border-danger/20 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-textMuted bg-surfaceLight px-2 py-1 rounded-md">#{c.id?.slice(0,8)}</span>
                    <span className="text-[10px] px-2 py-1 rounded-full font-bold bg-danger/10 text-danger">Flagged</span>
                  </div>
                  <h3 className="font-bold mb-1">{c.title}</h3>
                  <p className="text-xs text-warning mb-2">⚠ {c.fake_reason || 'System detected potential fraud'}</p>
                  <div className="flex gap-2 pt-2 border-t border-black/[0.04]">
                    <button onClick={() => navigate(`/track/${c.id}`)} className="flex-1 bg-surfaceLight text-xs py-2 rounded-xl font-medium flex items-center justify-center gap-1 transition-colors hover:bg-black/[0.04]">
                      <Eye size={12} /> View
                    </button>
                    <button onClick={() => setSelectedUser({ id: c.citizen_id, name: c.citizen_id })} className="flex-1 bg-danger/10 text-danger text-xs py-2 rounded-xl font-bold flex items-center justify-center gap-1">
                      <Ban size={12} /> Ban User
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Users Panel */}
        {activeTab === 'users' && (
          <div className="space-y-3">
            <button onClick={() => setShowAddAuthority(true)} className="w-full bg-primary text-white py-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm shadow-lg shadow-primary/20 mb-4 transition-transform active:scale-95">
               <Plus size={18} /> Provision Local Authority
            </button>
            {users.length === 0 && <div className="text-center py-10 text-textMuted text-sm">No users found.</div>}
            {users.map((u) => (
              <div key={u.id} className="korean-card p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold">
                    {u.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">{u.name}</h3>
                    <div className="flex items-center gap-2">
                       <p className="text-[10px] text-textMuted uppercase">{u.department}</p>
                       {officerRatings[u.id] && (
                         <div className="flex items-center gap-1 bg-warning/10 text-warning px-1.5 py-0.5 rounded text-[8px] font-bold">
                           <Zap size={8} fill="currentColor" /> {officerRatings[u.id].rating}
                         </div>
                       )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${u.is_banned ? 'text-danger' : 'text-primary'}`}>{u.is_banned ? 'Banned' : 'Active'}</p>
                    <p className="text-[10px] text-textMuted">{u.district || 'All Districts'}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-black/[0.04]">
                  <button onClick={() => {
                    setEditingOfficer(u);
                    setNewAuthority({ name: u.name, department: u.department, email: u.email });
                    setShowAddAuthority(true);
                  }} className="flex-1 bg-surfaceLight text-textMain text-xs py-2 rounded-xl font-medium flex items-center justify-center gap-1 transition-colors hover:bg-black/[0.04]">
                    Edit
                  </button>
                  <button onClick={() => {
                    if(confirm(`Are you sure you want to remove ${u.name}?`)) {
                      fetch(`${API_BASE}/api/admin/officers/${u.id}`, { method: 'DELETE' })
                      .then(r => r.json())
                      .then(() => setUsers(users.filter(x => x.id !== u.id)))
                      .catch(console.error);
                    }
                  }} className="flex-1 bg-danger/10 text-danger text-xs py-2 rounded-xl font-bold flex items-center justify-center gap-1">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SLA Analytics */}
        {activeTab === 'sla' && (
          <div className="space-y-4">
            {[
              { label: 'Automated Routing Confidence', value: 92, color: 'bg-primary' },
              { label: 'SLA Compliance Rate', value: 78, color: 'bg-teal' },
              { label: 'Emergency Response', value: 64, color: 'bg-warning' },
              { label: 'Fraud Detection Rate', value: 88, color: 'bg-danger' },
              { label: 'Citizen Satisfaction', value: 81, color: 'bg-primary' },
            ].map((metric) => (
              <div key={metric.label} className="korean-card p-4">
                <div className="flex justify-between text-sm mb-3">
                  <span className="flex items-center gap-2"><TrendingUp size={14} className="text-textMuted" />{metric.label}</span>
                  <span className="font-bold">{metric.value}%</span>
                </div>
                <div className="h-2 bg-surfaceLight rounded-full overflow-hidden">
                  <motion.div className={`h-full ${metric.color} rounded-full`}
                    initial={{ width: 0 }} animate={{ width: `${metric.value}%` }} transition={{ duration: 1 }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Authority Modal */}
      {showAddAuthority && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md bg-white rounded-3xl z-[100] p-8 shadow-elevated max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-xl mb-1 font-serif text-slate-900">{editingOfficer ? 'Edit Local Authority' : 'Provision Local Authority'}</h3>
            <p className="text-textMuted text-sm mb-6">{editingOfficer ? 'Update credentials for this field officer.' : 'Create credentials for a new field officer in your district.'}</p>
            <div className="space-y-4">
              <input value={newAuthority.name} onChange={e => setNewAuthority({...newAuthority, name: e.target.value})}
                placeholder="Authority Name (e.g. Ramesh P.)" className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm focus:outline-none focus:border-primary" />
              <input type="email" value={newAuthority.email} onChange={e => setNewAuthority({...newAuthority, email: e.target.value})}
                placeholder="Google Email (for login)" className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm focus:outline-none focus:border-primary" />
              <select value={newAuthority.department} onChange={e => setNewAuthority({...newAuthority, department: e.target.value})}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm focus:outline-none focus:border-primary">
                <option value="">Select Department</option>
                <option value="PWD">Public Works (PWD)</option>
                <option value="Sanitation">Sanitation</option>
                <option value="Electricity">Electricity</option>
                <option value="Water">Water Board</option>
              </select>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setShowAddAuthority(false)} className="flex-1 bg-slate-50 py-4 rounded-2xl text-sm font-medium">Cancel</button>
                <button 
                  onClick={() => {
                    const url = editingOfficer ? `${API_BASE}/api/admin/officers/${editingOfficer.id}` : `${API_BASE}/api/admin/officers`;
                    const method = editingOfficer ? 'PUT' : 'POST';
                    fetch(url, {
                      method,
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name: newAuthority.name, email: newAuthority.email, department: newAuthority.department })
                    })
                    .then(res => res.json())
                    .then(data => {
                      if (data.success) {
                        if (editingOfficer) {
                          setUsers(users.map(u => u.id === editingOfficer.id ? data.officer : u));
                        } else {
                          setUsers([data.officer, ...users]);
                        }
                        setShowAddAuthority(false);
                        setEditingOfficer(null);
                        setNewAuthority({ name: '', department: '', email: '' });
                      } else {
                        alert(data.error);
                      }
                    })
                    .catch(console.error);
                  }} 
                  disabled={!newAuthority.name || !newAuthority.department || !newAuthority.email}
                  className="flex-1 bg-primary text-white py-4 rounded-2xl text-sm font-bold disabled:opacity-50">
                  {editingOfficer ? 'Save Changes' : 'Add Authority'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Ban Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md bg-surface rounded-3xl border border-black/[0.06] p-6 shadow-elevated max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg mb-1 font-serif">Ban / Suspend User</h3>
            <p className="text-textMuted text-sm mb-4">User: <strong>{selectedUser.name}</strong></p>
            <textarea className="w-full bg-surfaceLight border border-black/[0.06] rounded-2xl p-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 resize-none mb-4 transition-all"
              rows={3} placeholder="Reason for ban (e.g. uploaded fake images repeatedly)..." value={banReason} onChange={(e) => setBanReason(e.target.value)} />
            <div className="flex gap-3">
              <button onClick={() => { setSelectedUser(null); setBanReason(''); }} className="flex-1 bg-surfaceLight py-3 rounded-2xl text-sm font-medium transition-colors hover:bg-black/[0.04]">Cancel</button>
              <button onClick={() => handleBan(selectedUser.id, !selectedUser.is_banned)} disabled={banning || !banReason.trim()}
                className="flex-1 bg-danger text-white py-3 rounded-2xl text-sm font-bold disabled:opacity-50 transition-colors">
                {banning ? 'Processing...' : selectedUser.is_banned ? 'Unban User' : 'Confirm Ban'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* Assignment Modal */}
      <AnimatePresence>
        {assigningTo && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-md bg-white rounded-3xl z-[100] p-8 shadow-elevated max-h-[90vh] overflow-y-auto">
              <h3 className="font-bold text-xl mb-1 font-serif text-slate-900">Assign Field Officer</h3>
              <p className="text-textMuted text-sm mb-6">Select an officer to handle: <strong>{assigningTo.title}</strong></p>
              <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar mb-6">
                {users.length === 0 && <p className="text-center py-4 text-textMuted text-sm">No officers available. Please provision one first.</p>}
                {users.map(u => (
                  <button 
                    key={u.id}
                    onClick={() => {
                      fetch(`${API_BASE}/api/complaints/${assigningTo.id}/assign`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ officer_id: u.id, officer_name: u.name })
                      })
                      .then(r => r.json())
                      .then(() => {
                        setComplaints(complaints.map(complaint => 
                          complaint.id === assigningTo.id 
                            ? { ...complaint, assigned_officer_id: u.id, assigned_officer_name: u.name, status: 'Assigned' } 
                            : complaint
                        ));
                        setAssigningTo(null);
                      })
                      .catch(console.error);
                    }}
                    className={`w-full text-left p-4 rounded-2xl flex items-center justify-between border transition-all ${assigningTo.assigned_officer_id === u.id ? 'bg-primary/5 border-primary' : 'bg-slate-50 border-transparent hover:border-black/10'}`}
                  >
                    <div className="flex-1">
                        <p className="font-bold text-slate-900 text-sm">{u.name}</p>
                        <div className="flex items-center gap-2">
                           <p className="text-[10px] text-slate-500 uppercase tracking-wider">{u.department} · {u.district || 'All Districts'}</p>
                           {officerRatings[u.id] && (
                             <div className="flex items-center gap-1 bg-warning/10 text-warning px-1.5 py-0.5 rounded text-[8px] font-bold">
                               <Zap size={8} fill="currentColor" /> {officerRatings[u.id].rating}
                             </div>
                           )}
                        </div>
                    </div>
                    {assigningTo.assigned_officer_id === u.id && <CheckCircle size={16} className="text-primary" />}
                  </button>
                ))}
              </div>
              <button onClick={() => setAssigningTo(null)} className="w-full bg-slate-100 py-4 rounded-2xl text-sm font-bold">Cancel</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
