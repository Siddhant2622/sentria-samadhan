import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, CheckCircle, AlertTriangle, FileText, Image as ImageIcon, MapPin } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { motion } from 'framer-motion';
import { openInGoogleMaps, fetchComplaints } from '../lib/api';
import { useAuth } from '../lib/AuthContext';

export default function PublicFeed() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const districtQuery = user?.role === 'Citizen' && user?.district ? `?district=${encodeURIComponent(user.district)}` : '';
        const data = await fetchComplaints(districtQuery);
        setComplaints(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  // Calculate statistics
  const now = new Date();
  const solvedCount = complaints.filter(c => /solved|resolved|completed/i.test(c.status || '')).length;
  const delayedCount = complaints.filter(c => {
    if (/solved|resolved|completed/i.test(c.status || '')) return false;
    if (!c.expected_completion_date) return false;
    return new Date(c.expected_completion_date) < now;
  }).length;
  const totalCount = complaints.length;

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">
      <div className="p-4 flex items-center border-b border-black/[0.06] bg-surface/70 sticky top-0 z-10 backdrop-blur-md">
        <button onClick={() => navigate(-1)} className="p-2 bg-surfaceLight rounded-full mr-4">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-bold text-lg font-serif">Community Reports</h1>
      </div>

      <div className="p-6 space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="korean-card p-4 text-center border-b-4 border-b-blue-500">
            <FileText size={24} className="mx-auto text-blue-500 mb-2" />
            <h3 className="text-2xl font-bold">{totalCount}</h3>
            <p className="text-[10px] text-textMuted font-bold uppercase tracking-wider mt-1">Total</p>
          </div>
          <div className="korean-card p-4 text-center border-b-4 border-b-primary">
            <CheckCircle size={24} className="mx-auto text-primary mb-2" />
            <h3 className="text-2xl font-bold">{solvedCount}</h3>
            <p className="text-[10px] text-textMuted font-bold uppercase tracking-wider mt-1">Solved</p>
          </div>
          <div className="korean-card p-4 text-center border-b-4 border-b-danger">
            <Clock size={24} className="mx-auto text-danger mb-2" />
            <h3 className="text-2xl font-bold text-danger">{delayedCount}</h3>
            <p className="text-[10px] text-textMuted font-bold uppercase tracking-wider mt-1">Delayed</p>
          </div>
        </div>

        {/* Complaints Feed */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold font-serif mb-4">Recent Reports</h2>
          {loading ? (
            <div className="flex justify-center p-8">
              <div className="w-8 h-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin"></div>
            </div>
          ) : complaints.length === 0 ? (
            <div className="text-center p-8 text-textMuted">
              No reports found in the community.
            </div>
          ) : (
            complaints.map((complaint, idx) => {
              const isResolved = /solved|resolved|completed/i.test(complaint.status || '');
              const isDelayed = !isResolved && new Date(complaint.expected_completion_date) < now;
              const hasMedia = complaint.media_urls && complaint.media_urls.length > 0;
              
              return (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={complaint.id} 
                  className="korean-card p-4 flex gap-4 cursor-pointer hover:border-primary/30 transition-all"
                  onClick={() => navigate(`/track/${complaint.id}`)}
                >
                  <div className="w-20 h-20 rounded-xl bg-surfaceLight flex-shrink-0 flex items-center justify-center overflow-hidden relative">
                    {hasMedia ? (
                      <img src={complaint.media_urls[0]} alt="Report" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={24} className="text-textMuted" />
                    )}
                    {isDelayed && (
                      <div className="absolute inset-0 bg-danger/10 border-2 border-danger/50 rounded-xl"></div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surfaceLight text-textMuted border border-black/5">
                        {complaint.category}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isResolved ? 'bg-primary/10 text-primary border-primary/20' : 
                        isDelayed ? 'bg-danger/10 text-danger border-danger/20' : 'bg-orange-500/10 text-orange-600 border-orange-500/20'
                      }`}>
                        {isDelayed ? 'Delayed' : complaint.status}
                      </span>
                    </div>
                    <h3 className="font-bold text-sm truncate">{complaint.title}</h3>
                    <p className="text-xs text-textMuted mt-1 line-clamp-2">{complaint.description}</p>
                    {complaint.address && (
                      <p 
                        className="text-xs text-textMuted mt-1.5 flex items-center gap-1 cursor-pointer hover:text-primary transition-colors group"
                        onClick={(e) => { e.stopPropagation(); openInGoogleMaps(complaint.address, complaint.latitude, complaint.longitude); }}
                      >
                        <MapPin size={11} className="shrink-0 group-hover:scale-125 transition-transform" />
                        <span className="truncate group-hover:underline">{complaint.address}</span>
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
