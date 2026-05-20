import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Layers, MapPin, Navigation, ShieldAlert } from 'lucide-react';
import { fetchComplaints, urgencyColor, openInGoogleMaps, resolveImageUrl } from '../lib/api';
import { API_BASE } from '../lib/config';
import { useAuth } from '../lib/AuthContext';

export default function MapPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);

  useEffect(() => {
    const districtQuery = user?.district ? `?district=${encodeURIComponent(user.district)}` : '';
    fetchComplaints(districtQuery).then(setComplaints);
  }, [user?.district]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="p-4 flex items-center justify-between border-b border-black/[0.06] bg-surface/70 sticky top-0 z-10 backdrop-blur-md">
        <div className="flex items-center">
          <button onClick={() => navigate('/dashboard')} className="p-2 bg-surfaceLight rounded-full mr-4">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-bold text-lg font-serif">Civic Map</h1>
            <p className="text-xs text-textMuted">Live issue density and priority</p>
          </div>
        </div>
        <button className="p-2 bg-surfaceLight rounded-xl text-primary">
          <Layers size={18} />
        </button>
      </div>

      <div className="h-[420px] relative bg-surface/60 map-grid overflow-hidden border-b border-black/[0.06]">
        <svg className="absolute inset-0 w-full h-full text-primary/30" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M 5 18 C 28 24 28 52 50 46 S 72 18 95 28" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M 20 96 C 30 72 56 74 62 48 S 72 18 84 2" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
        {complaints.slice(0, 10).map((item, index) => (
          <button
            key={item.id}
            onClick={() => navigate(`/track/${item.id}`)}
            className={`absolute rounded-full border-2 border-white shadow-lg flex items-center justify-center ${
              item.urgency_level === 'Emergency' ? 'w-12 h-12 bg-danger text-white animate-pulse' :
              item.urgency_level === 'High' ? 'w-10 h-10 bg-warning text-white' :
              'w-9 h-9 bg-primary text-white'
            }`}
            style={{ left: `${12 + (index * 21) % 72}%`, top: `${12 + (index * 29) % 70}%` }}
            title={item.title}
          >
            <MapPin size={16} />
          </button>
        ))}
        <div className="absolute left-5 right-5 bottom-5 bg-surface/90 backdrop-blur-md border border-black/[0.06] rounded-2xl p-4 shadow-card">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary p-2 rounded-xl">
              <Navigation size={18} />
            </div>
            <div>
              <h2 className="font-bold font-serif">Smart Civic Tracker</h2>
              <p className="text-xs text-textMuted mt-1">Markers are generated from current reports and sorted by urgency.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-3">
        {complaints.slice(0, 4).map((item) => (
          <div
            key={item.id}
            className="w-full korean-card p-4 text-left flex items-center gap-3"
          >
            {item.media_urls && item.media_urls.length > 0 && (
              <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-black/5">
                <img src={resolveImageUrl(item.media_urls[0])} alt="Report" className="w-full h-full object-cover" 
                  onError={(e) => { 
                    e.currentTarget.style.display = 'none'; 
                    const fallback = document.createElement('div');
                    fallback.className = 'w-full h-full bg-black/5 flex items-center justify-center text-textMuted';
                    fallback.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                    e.currentTarget.parentElement.appendChild(fallback);
                  }} 
                />
              </div>
            )}
            <div className="min-w-0 flex-1 cursor-pointer" onClick={() => navigate(`/track/${item.id}`)}>
              <p className="font-semibold truncate">{item.title}</p>
              <div className="flex flex-col gap-1 mt-1">
                {item.latitude && item.longitude && (
                  <p 
                    className="text-xs text-textMuted truncate hover:text-primary hover:underline cursor-pointer transition-colors flex items-center"
                    onClick={(e) => { e.stopPropagation(); openInGoogleMaps(null, item.latitude, item.longitude); }}
                  >
                    <MapPin size={10} className="mr-1 shrink-0 inline" /> GPS Location
                  </p>
                )}
                {item.address && (
                  <p 
                    className="text-xs text-textMuted truncate hover:text-teal hover:underline cursor-pointer transition-colors flex items-center"
                    onClick={(e) => { e.stopPropagation(); openInGoogleMaps(item.address, null, null); }}
                  >
                    <MapPin size={10} className="mr-1 shrink-0 inline" /> {item.address}
                  </p>
                )}
                {(!item.latitude && !item.longitude && !item.address) && (
                  <p className="text-xs text-textMuted truncate flex items-center">
                    <MapPin size={10} className="mr-1 shrink-0 inline" /> Location pending
                  </p>
                )}
              </div>
            </div>
            <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${urgencyColor(item.urgency_level)}`}>
              {item.urgency_level || 'Medium'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
