import { useState, useRef, useEffect } from 'react';
import { API_BASE } from '../lib/config';
import { useNavigate } from 'react-router-dom';
import { Camera, Image as ImageIcon, Sparkles, Send, MapPin, CheckCircle, ArrowLeft, Loader2, AlertTriangle, Building2, PlusCircle, Edit2, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useLanguage } from '../lib/LanguageContext';
import { useAuth } from '../lib/AuthContext';

const CIVIC_CATEGORIES_LIST = {
  Roads: { department_id: 'PWD', authority_name: 'Public Works Department' },
  Sanitation: { department_id: 'SANITATION', authority_name: 'Municipal Sanitation Department' },
  Electricity: { department_id: 'ELECTRICITY_BOARD', authority_name: 'Electricity Board' },
  Water: { department_id: 'WATER_WORKS', authority_name: 'Water Works Department' },
  Traffic: { department_id: 'TRAFFIC_POLICE', authority_name: 'Traffic Police' },
  Environment: { department_id: 'ENVIRONMENT', authority_name: 'Environment Department' },
  Fire: { department_id: 'FIRE_DEPT', authority_name: 'Fire & Emergency Services' },
  Other: { department_id: 'MUNICIPAL_CORP', authority_name: 'Municipal Corporation' }
};

export default function ReportIssue() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  
  const [step, setStep] = useState(1); // 1: Upload, 2: System Analyzing, 3: Chat/Details, 4: Success
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadedMediaUrl, setUploadedMediaUrl] = useState('');
  const [imageHash, setImageHash] = useState('');
  
  const [analysis, setAnalysis] = useState(null);
  const [chatMsg, setChatMsg] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [description, setDescription] = useState('');
  const [isTextReport, setIsTextReport] = useState(false);
  const [deptRatings, setDeptRatings] = useState({});

  useEffect(() => {
    fetch(`${API_BASE}/api/superadmin/ratings`)
      .then(r => r.json())
      .then(data => {
        if (data.departments) setDeptRatings(data.departments);
      })
      .catch(e => console.error('Failed to fetch ratings', e));
  }, []);

  const requestLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      () => setLocation(null),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const processImageScan = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_DIMENSION = 1920; 
          if (width > height) {
            if (width > MAX_DIMENSION) {
              height = Math.round((height *= MAX_DIMENSION / width));
              width = MAX_DIMENSION;
            }
          } else {
            if (height > MAX_DIMENSION) {
              width = Math.round((width *= MAX_DIMENSION / height));
              height = MAX_DIMENSION;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (!blob) return reject(new Error('Canvas is empty'));
            const processedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
              type: 'image/webp',
              lastModified: Date.now(),
            });
            resolve({ file: processedFile, previewUrl: canvas.toDataURL('image/webp', 0.9) });
          }, 'image/webp', 0.9);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    setUploadError('');
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Please upload a clear image.');
      return;
    }
    setStep(2);
    requestLocation();
    try {
      const scanned = await processImageScan(file);
      setPreviewUrl(scanned.previewUrl);
      const formData = new FormData();
      formData.append('image', scanned.file);
      const response = await fetch(`${API_BASE}/api/complaints/analyze`, { method: 'POST', body: formData });
      const data = await response.json();
      if(response.ok && data.success) {
        if (data.is_duplicate) {
          alert(data.message);
          navigate(`/track/${data.complaint_id}`);
          return;
        }
        setAnalysis(data.analysis);
        setUploadedMediaUrl(data.media_url);
        setImageHash(data.image_hash || '');
        const aiMsg = data.analysis.ai_analysis || data.analysis.citizen_question || `Detected: ${data.analysis.title}. ${data.analysis.description || ''}`;
        setChatHistory([{ sender: 'ai', text: aiMsg }]);
        setStep(3);
      } else {
        const errMsg = response.status === 429 
          ? 'AI is temporarily busy. Please wait 60 seconds and try again.'
          : (data.error || 'AI Analysis failed.');
        setUploadError(errMsg);
        setStep(1);
      }
    } catch (e) {
      setUploadError('Network error. Please check your connection and try again.');
      setStep(1);
    }
  };

  const handleManualReport = () => {
    // Clear any previously uploaded photo so it doesn't leak into text report
    setPreviewUrl(null);
    setUploadedMediaUrl('');
    setImageHash('');
    setIsTextReport(true);
    setAnalysis({
      title: '',
      category: 'Other',
      urgency_level: 'Medium',
      department_id: 'MUNICIPAL_CORP',
      ai_analysis: 'Hello! Please describe your civic issue in detail. I will help route it to the right authority.'
    });
    setChatHistory([{ sender: 'ai', text: 'Hello! Please describe your civic issue in detail. I will help route it to the right authority.' }]);
    setStep(3);
    requestLocation();
  };

  const handleChat = async (e) => {
    e.preventDefault();
    if(!chatMsg.trim() || isChatLoading) return;
    const userMsg = chatMsg;
    setChatMsg('');
    setChatHistory(prev => [...prev, { sender: 'user', text: userMsg }]);
    setIsChatLoading(true);
    
    // If text report, also update the title from first message
    if (isTextReport && !analysis?.title) {
      setAnalysis(prev => ({ ...prev, title: userMsg.slice(0, 60) }));
    }
    
    try {
      const res = await fetch(`${API_BASE}/api/chat/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: chatHistory,
          complaintContext: { ...analysis, description: userMsg }
        })
      });
      const data = await res.json();
      if (data.reply) {
        setChatHistory(prev => [...prev, { sender: 'ai', text: data.reply }]);
      } else {
        setChatHistory(prev => [...prev, { sender: 'ai', text: 'Thank you for the details. Please confirm your location and submit when ready.' }]);
      }
    } catch (e) {
      console.error(e);
      setChatHistory(prev => [...prev, { sender: 'ai', text: 'Details noted. Please submit your report when ready.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleSubmit = async () => {
    const finalData = {
      citizen_id: user?.id,
      title: analysis.title || 'Civic Issue',
      description: chatHistory.filter(m => m.sender === 'user').map(m => m.text).join(' ') || description,
      category: analysis.category,
      department_id: analysis.department_id,
      priority_score: analysis.urgency_level === 'Emergency' ? 10 : analysis.urgency_level === 'High' ? 8 : 5,
      urgency_level: analysis.urgency_level,
      latitude: location?.latitude,
      longitude: location?.longitude,
      district: user?.district || 'Bhopal',
      media_urls: uploadedMediaUrl ? [uploadedMediaUrl] : [],
      image_hash: imageHash
    };
    try {
      const res = await fetch(`${API_BASE}/api/complaints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalData)
      });
      const data = await res.json();
      if(data.success) setStep(4);
      else alert(data.error || 'Submission failed');
    } catch (e) {
      alert('Network error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <div className="dancheong-line" />
      
      {step === 1 && (
        <div className="flex-1 flex flex-col p-6 animate-in fade-in slide-in-from-bottom-4">
          <button onClick={() => navigate(-1)} className="mb-8 w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-slate-400 hover:text-primary transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="mb-10">
            <h1 className="text-3xl font-bold font-serif mb-2 tracking-tight">Report Civic Issue</h1>
            <p className="text-slate-500 text-sm leading-relaxed">Our AI will automatically analyze your photo and route it to the correct department.</p>
          </div>
          {uploadError && <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm"><AlertTriangle size={18} /> {uploadError}</div>}
          <div className="grid grid-cols-1 gap-4 flex-1">
            <button onClick={() => cameraInputRef.current?.click()} className="flex-1 bg-white border-2 border-dashed border-indigo-100 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 hover:border-primary/40 hover:bg-indigo-50/30 transition-all group shadow-sm">
              <div className="w-20 h-20 bg-indigo-50 rounded-[2rem] flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <Camera size={40} />
              </div>
              <div className="text-center">
                <p className="font-bold text-lg text-slate-800">Use Camera</p>
                <p className="text-xs text-slate-400 mt-1">Capture live evidence</p>
              </div>
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-white border-2 border-dashed border-indigo-100 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 hover:border-primary/40 hover:bg-indigo-50/30 transition-all group shadow-sm">
              <div className="w-20 h-20 bg-teal-50 rounded-[2rem] flex items-center justify-center text-teal-600 group-hover:scale-110 transition-transform">
                <ImageIcon size={40} />
              </div>
              <div className="text-center">
                <p className="font-bold text-lg text-slate-800">Choose from Gallery</p>
                <p className="text-xs text-slate-400 mt-1">Upload existing photos</p>
              </div>
            </button>
            <button onClick={handleManualReport} className="py-5 bg-slate-800 text-white rounded-[2rem] flex items-center justify-center gap-3 font-bold hover:bg-slate-900 transition-colors shadow-lg">
              <PlusCircle size={20} /> Report without photo
            </button>
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
          <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} />
        </div>
      )}

      {step === 2 && (
        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center animate-in zoom-in-95 duration-500">
           <div className="relative mb-12">
              <div className="w-32 h-32 border-4 border-indigo-100 border-t-primary rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-primary">
                 <Sparkles size={40} className="animate-pulse" />
              </div>
           </div>
           <h2 className="text-2xl font-bold font-serif mb-3">Analyzing Evidence...</h2>
           <p className="text-slate-500 text-sm leading-relaxed max-w-xs">Sentria AI is scanning your photo to determine the category, department, and priority level.</p>
        </div>
      )}

      {step === 3 && (
        <div className="flex-1 flex flex-col h-screen overflow-hidden animate-in slide-in-from-right duration-300">
           <div className="bg-white border-b border-slate-100 p-6 pt-12 flex items-center gap-4">
              <button onClick={() => setStep(1)} className="p-2 text-slate-400 hover:text-slate-900"><ArrowLeft size={20} /></button>
              <h2 className="text-xl font-bold font-serif truncate">Confirm & Report</h2>
           </div>
           
           <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {previewUrl && <div className="rounded-[2.5rem] overflow-hidden shadow-lg aspect-video"><img src={previewUrl} className="w-full h-full object-cover" /></div>}
              
              <div className="bg-indigo-50/50 p-6 rounded-[2.5rem] border border-indigo-100">
                 <h3 className="text-xs font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2"><Sparkles size={14} /> AI Initial Assessment</h3>
                 <div className="space-y-4">
                    <div>
                       <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Detected Issue</label>
                       <input value={analysis.title} onChange={e => setAnalysis({...analysis, title: e.target.value})} className="w-full bg-transparent border-none p-0 text-lg font-bold focus:ring-0" />
                    </div>
                    <div>
                       <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Target Department (AI Detected)</label>
                       <div className="relative">
                          <select 
                            value={analysis.category} 
                            onChange={(e) => {
                              const cat = e.target.value;
                              const deptId = CIVIC_CATEGORIES_LIST[cat].department_id;
                              setAnalysis({...analysis, category: cat, department_id: deptId});
                            }}
                            className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-700 appearance-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all pr-12 shadow-sm"
                          >
                             {Object.keys(CIVIC_CATEGORIES_LIST).map((cat) => (
                               <option key={cat} value={cat}>{cat} — {CIVIC_CATEGORIES_LIST[cat].authority_name}</option>
                             ))}
                          </select>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                             <Building2 size={18} />
                          </div>
                       </div>
                       <div className="mt-2 flex items-center gap-2">
                          <div className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-lg flex items-center gap-1.5">
                             <Zap size={10} fill="currentColor" />
                             Dept Rating: {deptRatings[analysis.department_id]?.avg || '5.0'} ({deptRatings[analysis.department_id]?.count || 0} reviews)
                          </div>
                          <p className="text-[10px] text-slate-400 italic">AI mapped this issue to {CIVIC_CATEGORIES_LIST[analysis.category]?.authority_name}</p>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="space-y-3">
                 <h3 className="text-sm font-bold text-slate-800">Chat with Assistant</h3>
                 <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden">
                    <div className="p-4 h-60 overflow-y-auto space-y-4 bg-slate-50/30">
                       {chatHistory.map((msg, i) => (
                         <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                           <div className={`max-w-[85%] p-3 rounded-2xl text-xs ${msg.sender === 'user' ? 'bg-primary text-white' : 'bg-white border border-slate-100 text-slate-700'}`}>
                             {msg.text}
                           </div>
                         </div>
                       ))}
                    </div>
                    <form onSubmit={handleChat} className="p-3 border-t border-slate-100 flex gap-2">
                       <input value={chatMsg} onChange={e => setChatMsg(e.target.value)} placeholder="Add more details..." className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-2 text-sm" />
                       <button className="bg-primary text-white p-2 rounded-xl"><Send size={18} /></button>
                    </form>
                 </div>
              </div>
           </div>
           
           <div className="p-6 bg-white border-t border-slate-100">
              <button onClick={handleSubmit} className="w-full bg-primary text-white py-4 rounded-[2rem] font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-3 hover:bg-slate-900 transition-colors">
                <CheckCircle size={20} /> Submit Final Report
              </button>
           </div>
        </div>
      )}

      {step === 4 && (
        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center animate-in zoom-in-95 duration-500">
           <div className="w-24 h-24 bg-teal-50 text-teal-600 rounded-[2.5rem] flex items-center justify-center mb-8">
              <CheckCircle size={48} />
           </div>
           <h2 className="text-3xl font-bold font-serif mb-4">Report Submitted!</h2>
           <p className="text-slate-500 text-sm leading-relaxed mb-10 max-w-xs">Your grievance has been successfully routed to the {CIVIC_CATEGORIES_LIST[analysis.category].authority_name}.</p>
           <button onClick={() => navigate('/dashboard')} className="w-full bg-slate-800 text-white py-5 rounded-[2.5rem] font-bold shadow-lg">Back to Dashboard</button>
        </div>
      )}
    </div>
  );
}
