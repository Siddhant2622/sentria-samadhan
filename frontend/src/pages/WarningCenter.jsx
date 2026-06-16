import { useEffect, useState } from 'react';
import { ArrowLeft, AlertTriangle, Activity, ShieldAlert, CheckCircle, Clock, Send, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { API_BASE } from '../lib/config';
import { formatRelativeTime } from '../lib/api';

export default function WarningCenter() {
  const navigate = useNavigate();
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchWarnings = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/warnings`);
      const data = await res.json();
      setWarnings(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarnings();
  }, []);

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      await fetch(`${API_BASE}/api/admin/warnings/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      fetchWarnings();
    } catch (e) {
      alert('Failed to update status');
    }
  };

  const handleNotify = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/warnings/${id}/notify`, { method: 'POST' });
      const data = await res.json();
      alert(data.message);
    } catch (e) {
      alert('Failed to notify department');
    }
  };

  const getRiskColor = (risk) => {
    switch(risk?.toLowerCase()) {
      case 'critical': return 'text-red-600 bg-red-100 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-100 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      default: return 'text-green-600 bg-green-100 border-green-200';
    }
  };

  const activeWarnings = warnings.filter(w => w.status !== 'Resolved' && w.status !== 'Closed');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <div className="bg-slate-900 text-white p-4 sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin')} className="p-2 hover:bg-slate-800 rounded-xl transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-bold text-lg flex items-center gap-2">
              <ShieldAlert size={20} className="text-red-400" /> Warning Center
            </h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">AI Predictive Governance</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="text-slate-400 mb-1"><Activity size={18} /></div>
            <div className="text-2xl font-black text-slate-800">{activeWarnings.length}</div>
            <div className="text-xs font-bold text-slate-500 uppercase">Active Warnings</div>
          </div>
          <div className="bg-red-50 p-4 rounded-2xl border border-red-100 shadow-sm">
            <div className="text-red-400 mb-1"><AlertTriangle size={18} /></div>
            <div className="text-2xl font-black text-red-700">{warnings.filter(w => w.risk_level === 'Critical' && w.status === 'Open').length}</div>
            <div className="text-xs font-bold text-red-600 uppercase">Critical Risks</div>
          </div>
        </div>

        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mt-4">Detected Anomalies</h2>

        {loading ? (
          <div className="py-20 text-center text-slate-400"><Activity size={24} className="animate-spin mx-auto mb-2" /> Analyzing Data...</div>
        ) : warnings.length === 0 ? (
          <div className="py-20 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl">
            <CheckCircle size={32} className="mx-auto mb-2 text-slate-300" />
            <p className="font-bold text-slate-500">All Clear</p>
            <p className="text-xs">No emerging issues detected.</p>
          </div>
        ) : (
          <div className="space-y-4 pb-24">
            {warnings.map((warning, i) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: i * 0.05 }}
                key={warning.id} 
                className={`bg-white rounded-[2rem] border overflow-hidden shadow-sm ${warning.status === 'Resolved' ? 'opacity-60' : 'border-slate-200'}`}
              >
                <div className={`p-5 border-b ${getRiskColor(warning.risk_level).replace('text-', 'border-').replace('600', '100').replace('bg-', '')}`}>
                  <div className="flex justify-between items-start mb-3">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${getRiskColor(warning.risk_level)}`}>
                      {warning.risk_level} RISK
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                      <Clock size={12} /> {formatRelativeTime(warning.generated_at)}
                    </span>
                  </div>
                  <h3 className="font-black text-lg text-slate-900 leading-tight mb-1">{warning.warning_type}</h3>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                    <MapPin size={14} /> {warning.area} {warning.ward !== 'Unknown' && `(Ward ${warning.ward})`}
                  </div>
                </div>
                
                <div className="p-5 space-y-4">
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <div className="text-[10px] font-bold text-indigo-500 uppercase mb-1 flex justify-between">
                      <span>AI Analysis</span>
                      <span>{warning.confidence_score}% Confidence</span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed font-medium">{warning.description}</p>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="text-xs font-bold text-slate-500">
                      Dept: <span className="text-slate-800">{warning.department}</span>
                    </div>
                    <div className="text-xs font-bold text-slate-500">
                      Status: <span className={warning.status === 'Open' ? 'text-orange-500' : 'text-teal-500'}>{warning.status}</span>
                    </div>
                  </div>

                  {warning.status !== 'Resolved' && (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                      <button 
                        onClick={() => handleNotify(warning.id)}
                        className="py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                      >
                        <Send size={14} /> Notify Dept
                      </button>
                      <button 
                        onClick={() => handleStatusUpdate(warning.id, 'Resolved')}
                        className="py-2.5 rounded-xl bg-teal-50 text-teal-700 text-xs font-bold hover:bg-teal-100 transition-colors flex items-center justify-center gap-2"
                      >
                        <CheckCircle size={14} /> Resolve
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
