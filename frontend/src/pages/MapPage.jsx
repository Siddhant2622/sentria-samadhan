import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Layers, MapPin, Navigation, ShieldAlert, Crosshair } from 'lucide-react';
import { fetchComplaints, urgencyColor, openInGoogleMaps, resolveImageUrl } from '../lib/api';
import { API_BASE } from '../lib/config';
import { useAuth } from '../lib/AuthContext';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet.heat';

function RealHeatmap({ points }) {
  const map = useMap();
  
  useEffect(() => {
    if (!map || !points || points.length === 0) return;
    
    const heatPoints = points.map(p => [
      p.latitude, 
      p.longitude, 
      p.urgency_level === 'Emergency' ? 1.0 : p.urgency_level === 'High' ? 0.6 : 0.2
    ]);

    const heatLayer = L.heatLayer(heatPoints, {
      radius: 35,
      blur: 25,
      maxZoom: 15,
      gradient: {
        0.2: '#4f46e5', // Indigo
        0.5: '#eab308', // Yellow
        0.8: '#f97316', // Orange
        1.0: '#ef4444'  // Red
      }
    }).addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points]);

  return null;
}

function MapController({ focusLocation }) {
  const map = useMap();
  useEffect(() => {
    if (focusLocation) {
      map.flyTo(focusLocation, 16, { animate: true, duration: 1.5 });
    }
  }, [focusLocation, map]);
  return null;
}

export default function MapPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [focusLocation, setFocusLocation] = useState(null);

  const [warnings, setWarnings] = useState([]);

  useEffect(() => {
    const districtQuery = user?.district ? `?district=${encodeURIComponent(user.district)}` : '';
    fetchComplaints(districtQuery).then(setComplaints);
    
    // Also fetch warnings
    fetch(`${API_BASE}/api/admin/warnings`)
      .then(res => res.json())
      .then(data => setWarnings(data.filter(w => w.status !== 'Resolved' && w.status !== 'Closed')))
      .catch(console.error);
  }, [user?.district]);

  const validComplaints = complaints.filter(c => c.latitude && c.longitude && c.latitude !== 0);
  const mapCenter = validComplaints.length > 0 ? [validComplaints[0].latitude, validComplaints[0].longitude] : [23.2599, 77.4126];

  // Dynamic Insights Calculation
  const highPriorityCount = validComplaints.filter(c => c.urgency_level === 'Emergency' || c.urgency_level === 'High').length;
  const categoryCounts = validComplaints.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + 1;
    return acc;
  }, {});
  const mostCommonCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Pending';

  const handleCenterLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setFocusLocation([pos.coords.latitude, pos.coords.longitude]),
        (err) => alert("Please enable location services to use this feature.")
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  const getMarkerIcon = (urgency) => {
    const bgColor = urgency === 'Emergency' ? 'bg-danger animate-pulse' :
                    urgency === 'High' ? 'bg-warning' : 'bg-primary';
    const size = urgency === 'Emergency' ? '48px' : urgency === 'High' ? '40px' : '36px';
    const anchor = urgency === 'Emergency' ? 24 : urgency === 'High' ? 20 : 18;
    
    return L.divIcon({
      className: 'custom-ui-marker',
      html: `<div class="rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white ${bgColor}" style="width: ${size}; height: ${size};">
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
             </div>`,
      iconSize: [anchor * 2, anchor * 2],
      iconAnchor: [anchor, anchor]
    });
  };

  const getWarningIcon = () => {
    return L.divIcon({
      className: 'custom-warning-marker',
      html: `<div class="rounded-full border-4 border-white shadow-xl flex items-center justify-center text-white bg-orange-500 animate-pulse" style="width: 56px; height: 56px; box-shadow: 0 0 30px rgba(249, 115, 22, 0.8);">
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
             </div>`,
      iconSize: [56, 56],
      iconAnchor: [28, 28]
    });
  };

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
        <div className="flex items-center gap-2">
          <button 
            onClick={handleCenterLocation} 
            className="p-2 bg-surfaceLight text-primary rounded-xl shadow-sm transition-colors hover:bg-slate-200"
            title="My Location"
          >
            <Crosshair size={18} />
          </button>
          <button 
            onClick={() => setShowHeatmap(!showHeatmap)} 
            className={`p-2 rounded-xl transition-colors ${showHeatmap ? 'bg-primary text-white shadow-lg' : 'bg-surfaceLight text-primary shadow-sm'}`}
            title="Toggle Heatmap"
          >
            <Layers size={18} />
          </button>
        </div>
      </div>

      <div className="h-[420px] relative overflow-hidden border-b border-black/[0.06] z-0">
        <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%', zIndex: 0 }}>
          <TileLayer
            url="http://mt0.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}"
            attribution="&copy; Google Maps"
          />
          <MapController focusLocation={focusLocation} />
          {showHeatmap ? (
            <RealHeatmap points={validComplaints} />
          ) : (
            <>
              {validComplaints.map(item => (
                <Marker 
                  key={item.id}
                  position={[item.latitude, item.longitude]}
                  icon={getMarkerIcon(item.urgency_level)}
                  eventHandlers={{
                    click: () => navigate(`/track/${item.id}`)
                  }}
                >
                  <Popup>
                    <div className="text-sm font-bold">{item.title}</div>
                    <div className="text-xs text-slate-500">{item.urgency_level} Priority</div>
                  </Popup>
                </Marker>
              ))}
              
              {/* Render Warnings using coordinates of their first related complaint */}
              {warnings.map(warning => {
                let relatedIds = [];
                try { relatedIds = JSON.parse(warning.related_complaints || '[]'); } catch(e){}
                
                // Find a valid complaint to anchor the warning
                const anchorComp = validComplaints.find(c => relatedIds.includes(c.id));
                if (!anchorComp) return null;
                
                return (
                  <Marker 
                    key={warning.id}
                    position={[anchorComp.latitude, anchorComp.longitude]}
                    icon={getWarningIcon()}
                    eventHandlers={{
                      click: () => navigate(`/admin/warnings`)
                    }}
                  >
                    <Popup>
                      <div className="text-sm font-bold text-red-600">{warning.warning_type}</div>
                      <div className="text-xs text-slate-500">{warning.confidence_score}% AI Confidence</div>
                    </Popup>
                  </Marker>
                );
              })}
            </>
          )}
        </MapContainer>
        
        <div className="absolute left-5 right-5 bottom-5 bg-surface/90 backdrop-blur-md border border-black/[0.06] rounded-2xl p-4 shadow-card pointer-events-none">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl text-white ${showHeatmap ? 'bg-gradient-to-r from-danger to-warning' : 'bg-primary'}`}>
                <Navigation size={18} />
              </div>
              <div>
                <h2 className="font-bold font-serif">{showHeatmap ? 'Heatmap Density Insights' : 'Real-time Tracker'}</h2>
                <p className="text-[10px] text-textMuted mt-1 leading-snug">
                  {showHeatmap 
                    ? `Visualizing ${validComplaints.length} reports. High concentration indicates severe infrastructure degradation.` 
                    : `Tracking ${validComplaints.length} active civic issues in your district.`}
                </p>
              </div>
            </div>
            
            {validComplaints.length > 0 && (
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-black/[0.06] mt-1">
                <div>
                  <p className="text-[9px] text-textMuted uppercase font-bold">Total Active</p>
                  <p className="font-bold text-slate-800">{validComplaints.length}</p>
                </div>
                <div>
                  <p className="text-[9px] text-danger uppercase font-bold">Critical/High</p>
                  <p className="font-bold text-danger">{highPriorityCount}</p>
                </div>
                <div>
                  <p className="text-[9px] text-teal uppercase font-bold">Top Issue</p>
                  <p className="font-bold text-teal truncate">{mostCommonCategory.replace('_', ' ')}</p>
                </div>
              </div>
            )}
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
            <div className="min-w-0 flex-1 cursor-pointer" onClick={() => {
              if (item.latitude && item.longitude) {
                setFocusLocation([item.latitude, item.longitude]);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              } else {
                navigate(`/track/${item.id}`);
              }
            }}>
              <p className="font-semibold truncate hover:text-primary transition-colors">{item.title}</p>
              <div className="flex flex-col gap-1 mt-1">
                {item.latitude && item.longitude && (
                  <p 
                    className="text-xs text-textMuted truncate flex items-center"
                  >
                    <MapPin size={10} className="mr-1 shrink-0 inline" /> Tap to view on map
                  </p>
                )}
                {item.address && (
                  <p 
                    className="text-xs text-textMuted truncate hover:text-teal hover:underline cursor-pointer transition-colors flex items-center"
                    onClick={(e) => { e.stopPropagation(); navigate(`/track/${item.id}`); }}
                  >
                    <Navigation size={10} className="mr-1 shrink-0 inline" /> Details
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
