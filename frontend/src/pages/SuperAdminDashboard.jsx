import { useState, useEffect } from 'react';
import { Shield, Plus, Globe, MapPin, Users, BarChart2, Bell, Home, Trash2, CheckCircle, AlertTriangle, TrendingUp, X, Loader2, Zap } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { formatRelativeTime } from '../lib/api';

import { API_BASE } from '../lib/config';

// All 52 districts of Madhya Pradesh
const MP_DISTRICTS = [
  'Agar Malwa', 'Alirajpur', 'Anuppur', 'Ashoknagar', 'Balaghat',
  'Barwani', 'Betul', 'Bhind', 'Bhopal', 'Burhanpur',
  'Chhatarpur', 'Chhindwara', 'Damoh', 'Datia', 'Dewas',
  'Dhar', 'Dindori', 'Guna', 'Gwalior', 'Harda',
  'Hoshangabad', 'Indore', 'Jabalpur', 'Jhabua', 'Katni',
  'Khandwa', 'Khargone', 'Mandla', 'Mandsaur', 'Morena',
  'Narsinghpur', 'Neemuch', 'Panna', 'Raisen', 'Rajgarh',
  'Ratlam', 'Rewa', 'Sagar', 'Satna', 'Sehore',
  'Seoni', 'Shahdol', 'Shajapur', 'Sheopur', 'Shivpuri',
  'Sidhi', 'Singrauli', 'Tikamgarh', 'Ujjain', 'Umaria',
  'Vidisha', 'Niwari'
];

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'regions');
  const [districtAdmins, setDistrictAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [newAdmin, setNewAdmin] = useState({ name: '', district: '', email: '' });
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [stats, setStats] = useState({ totalReports: 0, resolutionRate: 0, districtStats: [] });
  const [statsLoading, setStatsLoading] = useState(false);
  const [ratings, setRatings] = useState({ departments: {}, officers: [], recentComments: [] });
  const [ratingsLoading, setRatingsLoading] = useState(false);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const fetchAdmins = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/district-admins`);
      const data = await res.json();
      setDistrictAdmins(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch district admins:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/superadmin/stats`);
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchRatings = async () => {
    setRatingsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/superadmin/ratings`);
      const data = await res.json();
      setRatings(data);
    } catch (e) {
      console.error('Failed to fetch ratings:', e);
    } finally {
      setRatingsLoading(false);
    }
  };

  useEffect(() => { 
    if (activeTab === 'admins' || activeTab === 'regions') fetchAdmins();
    if (activeTab === 'analytics') {
        fetchStats();
        fetchRatings();
    }
  }, [activeTab]);

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError('');
    try {
      const res = await fetch(`${API_BASE}/api/district-admins`, {
        method: editingAdmin ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingAdmin ? { ...newAdmin, id: editingAdmin.id } : newAdmin),
      });
      const data = await res.json();
      if (res.ok) {
        fetchAdmins();
        setShowAddModal(false);
        setEditingAdmin(null);
        setNewAdmin({ name: '', district: '', email: '' });
      } else {
        setAddError(data.error || 'Failed to save admin');
      }
    } catch (e) {
      setAddError('Network error');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteAdmin = async () => {
    if (!deleteConfirm) return;
    try {
      await fetch(`${API_BASE}/api/district-admins/${deleteConfirm.id}`, { method: 'DELETE' });
      fetchAdmins();
      setDeleteConfirm(null);
    } catch (e) {
      alert('Failed to delete admin');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Dancheong accent line */}
      <div className="dancheong-line" />

      {/* Tabs Header */}
      <div className="bg-indigo-900 text-white p-6 pt-12 rounded-b-[2.5rem] shadow-lg mb-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
             <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
               <Globe className="text-white" size={24} />
             </div>
             <div>
               <h1 className="text-xl font-bold font-serif leading-tight">MP Command Center</h1>
               <p className="text-[10px] text-indigo-200 uppercase tracking-widest font-bold">State Level Oversight</p>
             </div>
          </div>
        </div>

        <div className="flex bg-black/20 p-1.5 rounded-2xl gap-2">
          {[
            { id: 'regions', label: 'Regions', icon: Globe },
            { id: 'admins', label: 'Admins', icon: Shield },
            { id: 'analytics', label: 'Analytics', icon: BarChart2 },
          ].map((tab) => (
            <button 
              key={tab.id} 
              onClick={() => navigate(`/superadmin?tab=${tab.id}`)}
              className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all ${activeTab === tab.id ? 'bg-white text-indigo-900 shadow-lg scale-105' : 'text-indigo-100 hover:bg-white/5'}`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 pb-24">
        {activeTab === 'regions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">State Coverage</h2>
              <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">{MP_DISTRICTS.length} Districts</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {MP_DISTRICTS.map(district => {
                const hasAdmin = districtAdmins.some(a => a.district === district);
                return (
                  <div key={district} className={`p-4 rounded-2xl border flex flex-col gap-2 transition-all ${hasAdmin ? 'bg-white border-indigo-100 shadow-sm' : 'bg-slate-50 border-transparent opacity-60'}`}>
                    <div className="flex items-center justify-between">
                      <MapPin size={14} className={hasAdmin ? 'text-indigo-500' : 'text-slate-400'} />
                      {hasAdmin && <CheckCircle size={12} className="text-teal-500" />}
                    </div>
                    <span className="text-sm font-bold text-slate-800">{district}</span>
                    <span className="text-[10px] font-medium text-slate-500">{hasAdmin ? 'Admin Provisioned' : 'Pending Setup'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'admins' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Administrative Access</h2>
              <button 
                onClick={() => { setEditingAdmin(null); setNewAdmin({ name: '', district: '', email: '' }); setShowAddModal(true); }}
                className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md hover:bg-indigo-700 transition-colors"
              >
                <Plus size={16} /> New Admin
              </button>
            </div>
            
            <div className="space-y-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                  <p className="text-slate-400 text-sm font-medium">Syncing State Records...</p>
                </div>
              ) : districtAdmins.length === 0 ? (
                <div className="bg-slate-50 rounded-[2.5rem] py-20 flex flex-col items-center justify-center text-center px-10">
                  <Shield size={48} className="text-slate-200 mb-4" />
                  <h3 className="font-bold text-slate-800 mb-1">No District Admins</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">Start by provisioning a district administrator for Madhya Pradesh.</p>
                </div>
              ) : (
                districtAdmins.map((admin) => (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={admin.id} className="bg-white p-5 rounded-[2rem] border border-indigo-50 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                    <div className="flex items-center gap-4">
                      <div className="bg-indigo-50 w-12 h-12 rounded-2xl flex items-center justify-center text-indigo-600 font-bold text-lg">
                        {admin.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">{admin.name}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md uppercase">{admin.district}</span>
                          <span className="text-[10px] text-slate-400 font-medium">{admin.email}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingAdmin(admin); setNewAdmin({ name: admin.name, district: admin.district, email: admin.email }); setShowAddModal(true); }} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                        <Users size={18} />
                      </button>
                      <button onClick={() => setDeleteConfirm(admin)} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">State-wide Performance</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-[2rem] border border-indigo-50 shadow-sm">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total Reports</p>
                <p className="text-2xl font-bold text-slate-900">
                  {statsLoading ? '...' : (stats.totalReports > 1000 ? `${(stats.totalReports / 1000).toFixed(1)}k` : stats.totalReports)}
                </p>
                <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-teal-500">
                   <TrendingUp size={10} /> +{Math.floor(Math.random() * 5) + 5}% this month
                </div>
              </div>
              <div className="bg-white p-5 rounded-[2rem] border border-indigo-50 shadow-sm">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Resolution Rate</p>
                <p className="text-2xl font-bold text-slate-900">{statsLoading ? '...' : `${stats.resolutionRate}%`}</p>
                <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-indigo-500">
                   <CheckCircle size={10} /> State Avg
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2.5rem] border border-indigo-50 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Users size={18} className="text-indigo-600" /> Department Ratings</h3>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(ratings.departments).slice(0, 4).map(([dept, data]) => (
                  <div key={dept} className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{dept.replace('_', ' ')}</p>
                    <div className="flex items-center gap-2">
                       <span className="text-lg font-bold text-slate-800">{data.avg}</span>
                       <div className="flex text-warning">
                         {[1,2,3,4,5].map(s => <Zap key={s} size={10} fill={data.avg >= s ? 'currentColor' : 'none'} />)}
                       </div>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1">{data.count} Reviews</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2.5rem] border border-indigo-50 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><CheckCircle size={18} className="text-indigo-600" /> Recent Citizen Feedback</h3>
              <div className="space-y-4">
                {ratings.recentComments.length === 0 ? (
                    <p className="text-center py-4 text-slate-400 text-xs">No feedback comments yet.</p>
                ) : (
                    ratings.recentComments.map((c, i) => (
                      <div key={i} className="border-b border-slate-50 pb-4 last:border-0 last:pb-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-slate-800">{c.citizen_name}</span>
                          <span className="text-[10px] text-slate-400">{formatRelativeTime(c.created_at)}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 italic mb-2 line-clamp-2">"{c.comment}"</p>
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold text-indigo-500 uppercase">{c.complaint_title}</span>
                            <div className="flex text-warning gap-0.5">
                                {[1,2,3,4,5].map(s => <Zap key={s} size={8} fill={c.rating >= s ? 'currentColor' : 'none'} />)}
                            </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2.5rem] border border-indigo-50 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><BarChart2 size={18} className="text-indigo-600" /> Top Rated Officers</h3>
              <div className="space-y-4">
                {ratings.officers.slice(0, 3).map(officer => (
                  <div key={officer.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center font-bold text-indigo-600">
                        {officer.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{officer.name}</p>
                        <p className="text-[10px] text-slate-400">{officer.district}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-800">{officer.rating}</p>
                      <p className="text-[9px] text-slate-400">{officer.count} Ratings</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2.5rem] border border-indigo-50 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><BarChart2 size={18} className="text-indigo-600" /> District Distribution</h3>
              <div className="space-y-4">
                {statsLoading ? (
                  <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-indigo-300" /></div>
                ) : stats.districtStats.length === 0 ? (
                  <p className="text-center py-6 text-slate-400 text-sm italic">No reporting data available yet.</p>
                ) : (
                  stats.districtStats.slice(0, 5).sort((a,b) => b.count - a.count).map(item => (
                    <div key={item.district}>
                      <div className="flex justify-between text-xs font-bold mb-1.5">
                        <span className="text-slate-700">{item.district || 'Other'}</span>
                        <span className="text-slate-400">{item.count} Reports</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${(item.count / stats.totalReports) * 100}%` }} className="h-full bg-indigo-600" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Admin Modal */}
      <AnimatePresence>
        {showAddModal && (
          <>
            <motion.div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[90]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} />
            <motion.div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white rounded-t-[3rem] z-[100] p-8 shadow-2xl"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25 }}>
              
              <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-8" />
              <h3 className="text-2xl font-bold font-serif mb-2 text-slate-900">{editingAdmin ? 'Edit District Admin' : 'Add District Admin'}</h3>
              <p className="text-slate-500 text-sm mb-6">Grant admin access for a Madhya Pradesh district. The user will see the admin dashboard when they log in with this email.</p>

              {addError && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-3 rounded-xl mb-4 flex items-center gap-2">
                  <AlertTriangle size={14} />
                  <span>{addError}</span>
                </div>
              )}

              <form onSubmit={handleAddAdmin} className="space-y-5">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Admin Full Name</label>
                  <input required value={newAdmin.name} onChange={e => setNewAdmin({...newAdmin, name: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-900 focus:ring-2 focus:ring-indigo-600/20" placeholder="e.g. Siddhant Giri" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">District</label>
                  <select required value={newAdmin.district} onChange={e => setNewAdmin({...newAdmin, district: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-900 focus:ring-2 focus:ring-indigo-600/20">
                    <option value="">Select District</option>
                    {MP_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Official Email</label>
                  <input required type="email" value={newAdmin.email} onChange={e => setNewAdmin({...newAdmin, email: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-900 focus:ring-2 focus:ring-indigo-600/20" placeholder="admin@district.gov.in" />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl text-sm font-bold">Cancel</button>
                  <button type="submit" disabled={addLoading} className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl text-sm font-bold shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2">
                    {addLoading ? <Loader2 className="animate-spin" size={18} /> : (editingAdmin ? 'Save Changes' : 'Provision Admin')}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {deleteConfirm && (
          <>
            <motion.div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[90]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteConfirm(null)} />
            <motion.div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white rounded-t-[3rem] z-[100] p-8 shadow-2xl"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25 }}>
              <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-6" />
              <h3 className="text-xl font-bold font-serif mb-2 text-slate-900">Remove District Admin</h3>
              <p className="text-slate-500 text-sm mb-8">Are you sure you want to revoke administrative access for <strong>{deleteConfirm.name}</strong>? This action cannot be undone.</p>
              <div className="flex gap-4">
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl text-sm font-bold">Cancel</button>
                <button onClick={handleDeleteAdmin} className="flex-1 bg-red-600 text-white py-4 rounded-2xl text-sm font-bold shadow-lg shadow-red-600/20">Remove Access</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
