import { useState, useRef, useEffect } from 'react';
import { API_BASE } from '../lib/config';
import { useNavigate } from 'react-router-dom';
import { Mic, Globe, Image as ImageIcon, Camera, CheckCircle, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { motion } from 'framer-motion';

const LANGUAGES = [
  { code: 'hi-IN', label: 'हिंदी', name: 'Hindi' },
  { code: 'mr-IN', label: 'मराठी', name: 'Marathi' },
  { code: 'ta-IN', label: 'தமிழ்', name: 'Tamil' },
  { code: 'te-IN', label: 'తెలుగు', name: 'Telugu' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ', name: 'Kannada' },
  { code: 'ml-IN', label: 'മലയാളം', name: 'Malayalam' },
  { code: 'bn-IN', label: 'বাংলা', name: 'Bengali' },
  { code: 'gu-IN', label: 'ગુજરાતી', name: 'Gujarati' },
  { code: 'pa-IN', label: 'ਪੰਜਾਬੀ', name: 'Punjabi' },
  { code: 'en-IN', label: 'English', name: 'English' }
];

const GREETINGS = {
  'hi-IN': 'नमस्ते! आपकी क्या समस्या है?',
  'mr-IN': 'नमस्कार! तुमची काय समस्या आहे?',
  'ta-IN': 'வணக்கம்! உங்கள் பிரச்சனை என்ன?',
  'te-IN': 'నమస్కారం! మీ సమస్య ఏమిటి?',
  'kn-IN': 'ನಮಸ್ಕಾರ! ನಿಮ್ಮ ಸಮಸ್ಯೆ ಏನು?',
  'ml-IN': 'നമസ്കാരം! നിങ്ങളുടെ പ്രശ്നം എന്താണ്?',
  'bn-IN': 'নমস্কার! আপনার সমস্যা কি?',
  'gu-IN': 'નમસ્તે! તમારી સમસ્યા શું છે?',
  'pa-IN': 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਤੁਹਾਡੀ ਕੀ ਸਮੱਸਿਆ ਹੈ?',
  'en-IN': 'Hello! What is your problem?'
};

const CIVIC_CATEGORIES = {
  Roads: { department_id: 'PWD', authority_name: 'Public Works Department' },
  Sanitation: { department_id: 'SANITATION', authority_name: 'Municipal Sanitation Department' },
  Electricity: { department_id: 'ELECTRICITY_BOARD', authority_name: 'State Electricity Board' },
  Water: { department_id: 'WATER_WORKS', authority_name: 'Water Supply Department' },
  Traffic: { department_id: 'TRAFFIC_POLICE', authority_name: 'Traffic Police' },
  Environment: { department_id: 'FOREST_DEPT', authority_name: 'Forest & Environment Dept' },
  Other: { department_id: 'MUNICIPAL_CORP', authority_name: 'Municipal Corporation' }
};

export default function VoiceReport() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [step, setStep] = useState('WELCOME');
  const [flowStep, setFlowStep] = useState('extract_complaint'); 
  const [selectedLang, setSelectedLang] = useState('hi-IN');
  const [transcript, setTranscript] = useState(''); // Text fallback
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const audioChunksRef = useRef([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [audioBase64, setAudioBase64] = useState('');
  const [speechError, setSpeechError] = useState('');
  
  const [aiMessage, setAiMessage] = useState(GREETINGS['hi-IN']);
  
  const [complaintData, setComplaintData] = useState({
    title: '',
    description: '',
    category: 'Other',
    department_id: 'MUNICIPAL_CORP',
    urgency_level: 'Medium',
    address: ''
  });
  
  const [location, setLocation] = useState(null);
  const [uploadedMediaUrl, setUploadedMediaUrl] = useState('');
  const [imageHash, setImageHash] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    const greeting = GREETINGS[selectedLang] || GREETINGS['en-IN'];
    setAiMessage(greeting);
    setFlowStep('extract_complaint');
    setStep('WELCOME');
    setChatHistory([]);
  }, [selectedLang]);

  // Text-to-Speech Helper
  const speakMessage = (text, shouldAutoListen = false) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/👋/g, ''); 
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = selectedLang;
      
      if (shouldAutoListen) {
        utterance.onend = () => {
          setTimeout(() => {
            startRecording();
          }, 300);
        };
      }
      
      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    if (aiMessage) {
      const shouldAutoListen = step === 'WELCOME' || step === 'NEED_INFO';
      speakMessage(aiMessage, shouldAutoListen);
    }
  }, [aiMessage]);

  const requestLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setComplaintData(prev => ({ ...prev, address: 'Using GPS Location' }));
      },
      () => setLocation(null),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const startRecording = async () => {
    if (isRecording) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      
      recorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      
      recorder.onstop = () => {
        // Will be handled in stopRecording promise
      };
      
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setStep('LISTENING');
      setTranscript('');
      setAudioBase64('');
      setSpeechError('');
    } catch (err) {
      console.error("Mic access denied or error:", err);
      setSpeechError("Microphone access denied or unavailable. Please type your response.");
      setStep('LISTENING');
    }
  };

  const stopRecording = () => {
    return new Promise((resolve) => {
      if (mediaRecorder && isRecording) {
        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = () => {
            const base64data = reader.result.split(',')[1];
            resolve(base64data);
          };
          mediaRecorder.stream.getTracks().forEach(track => track.stop());
        };
        mediaRecorder.stop();
        setIsRecording(false);
      } else {
        resolve('');
      }
    });
  };

  const handleProcessVoice = async () => {
    let finalAudioBase64 = '';
    if (isRecording) {
      finalAudioBase64 = await stopRecording();
    }
    
    // Fallback if they typed instead of speaking
    if (!transcript.trim() && !finalAudioBase64) {
      setStep('WELCOME');
      return;
    }
    
    setStep('ANALYZING');
    
    try {
      const res = await fetch(`${API_BASE}/api/chat/voice-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcript,
          audioBase64: finalAudioBase64,
          language: selectedLang,
          currentData: complaintData,
          flowStep: flowStep,
          history: chatHistory
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        if (data.extractedFields) {
          setComplaintData(prev => ({ ...prev, ...data.extractedFields }));
        }
        
        if (flowStep === 'extract_complaint') {
           if (data.isComplete) {
             setAiMessage(data.reply);
             setStep('UPLOAD_PHOTO');
             setTranscript('');
           } else {
             // For history, use the transcribed text from backend if audio was used
             const userContent = data.transcribedText || transcript || '[Audio Message]';
             setChatHistory(prev => [...prev, { role: 'user', content: userContent }, { role: 'ai', content: data.reply }]);
             setAiMessage(data.reply);
             setStep('NEED_INFO');
             setTranscript('');
           }
        } else if (flowStep === 'extract_location') {
           if (data.location_type === 'current') {
              requestLocation();
              setAiMessage(data.reply);
              setStep('SUCCESS');
           } else {
              setAiMessage(data.reply);
              setFlowStep('save_specific_location');
              setStep('NEED_INFO');
           }
           setTranscript('');
        } else if (flowStep === 'save_specific_location') {
           setAiMessage(data.reply);
           setStep('SUCCESS');
           setTranscript('');
        }
      } else {
        setAiMessage(data.error || "Sorry, I couldn't understand that. Let's try again.");
        setStep('WELCOME');
      }
    } catch (error) {
      console.error("Error processing voice:", error);
      setAiMessage("Network error. Please try again.");
      setStep('WELCOME');
    }
  };

  const processImageScan = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width, height = img.height;
          const MAX_DIMENSION = 1920; 
          if (width > height && width > MAX_DIMENSION) { height *= MAX_DIMENSION / width; width = MAX_DIMENSION; }
          else if (height > MAX_DIMENSION) { width *= MAX_DIMENSION / height; height = MAX_DIMENSION; }
          canvas.width = width; canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            resolve({ file: new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' }), previewUrl: canvas.toDataURL('image/webp', 0.9) });
          }, 'image/webp', 0.9);
        };
      };
    });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    setStep('ANALYZING');
    try {
      const scanned = await processImageScan(file);
      setPreviewUrl(scanned.previewUrl);
      const formData = new FormData();
      formData.append('image', scanned.file);
      const response = await fetch(`${API_BASE}/api/complaints/analyze`, { method: 'POST', body: formData });
      const data = await response.json();
      
      if(response.ok && data.success) {
        if (data.is_duplicate) {
          alert(data.message || "The Complaint is already filed");
          setStep('WELCOME');
          return;
        }

        setUploadedMediaUrl(data.media_url);
        setImageHash(data.image_hash || '');
        
        const priorityScore = data.priority_score || 5;
        let urgency = 'Medium';
        if (priorityScore >= 8) urgency = 'Emergency';
        else if (priorityScore >= 6) urgency = 'High';
        else if (priorityScore <= 3) urgency = 'Low';
        
        const categoryKey = data.category || complaintData.category || 'Other';
        const mappedDept = CIVIC_CATEGORIES[categoryKey]?.department_id || 'MUNICIPAL_CORP';

        const newComplaintData = { 
          ...complaintData, 
          category: categoryKey,
          department_id: mappedDept,
          urgency_level: urgency
        };
        setComplaintData(newComplaintData);

        // Fetch AI announcement
        const res2 = await fetch(`${API_BASE}/api/chat/voice-assistant`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: '',
            language: selectedLang,
            currentData: newComplaintData,
            flowStep: 'announce_dept'
          })
        });
        const data2 = await res2.json();
        if (data2.success) {
          setAiMessage(data2.reply);
          setFlowStep('extract_location');
          setStep('NEED_INFO');
        } else {
          setStep('SUCCESS');
        }
      } else {
        alert("Failed to process photo.");
        setStep('UPLOAD_PHOTO');
      }
    } catch (err) {
      setStep('UPLOAD_PHOTO');
    }
  };

  const submitComplaint = async () => {
    setStep('SUBMITTING');
    const finalData = {
      citizen_id: user?.id,
      title: complaintData.title || 'Voice Complaint',
      description: complaintData.description || transcript,
      category: complaintData.category || 'Other',
      department_id: complaintData.department_id || 'MUNICIPAL_CORP',
      urgency_level: complaintData.urgency_level || 'Medium',
      priority_score: 5,
      latitude: location?.latitude,
      longitude: location?.longitude,
      address: complaintData.address || '',
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
      if(data.success) {
        if (data.is_duplicate) {
          alert(data.message || 'The Complaint is already filed');
          navigate(`/dashboard`);
        } else {
          setStep('DONE');
        }
      }
      else { alert(data.error || 'Submission failed'); setStep('SUCCESS'); }
    } catch (e) {
      alert('Network error'); setStep('SUCCESS');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans overflow-x-hidden flex flex-col relative pb-32">
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-teal-500/10 blur-[100px] rounded-full pointer-events-none" />
      
      <div className="flex-1 w-full max-w-4xl mx-auto p-4 flex flex-col items-center justify-center relative z-10 pt-12 pb-24">
        
        <button onClick={() => navigate('/dashboard')} className="absolute top-4 left-4 p-3 bg-slate-800/50 rounded-full hover:bg-slate-700 transition-colors z-20 backdrop-blur-md">
          <ArrowLeft size={24} />
        </button>

        <div className="absolute top-4 right-4 z-20">
          <div className="bg-slate-800/80 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-2 border border-slate-700">
            <Globe size={18} className="text-teal-400" />
            <select 
              value={selectedLang} 
              onChange={(e) => setSelectedLang(e.target.value)}
              className="bg-transparent text-white outline-none appearance-none cursor-pointer font-bold pr-4 text-sm"
            >
              {LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code} className="bg-slate-800">{lang.label} ({lang.name})</option>
              ))}
            </select>
          </div>
        </div>

        {step === 'WELCOME' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center text-center w-full max-w-md mt-16">
            <div className="relative mb-12">
              <div className="w-32 h-32 bg-slate-800 rounded-full flex items-center justify-center relative z-10 border border-slate-700">
                <Mic size={48} className="text-slate-400" />
              </div>
            </div>
            
            <h1 className="text-3xl font-bold mb-4 font-serif leading-tight">
              {aiMessage}
            </h1>
            <p className="text-slate-400 mb-12 text-lg">Press start to speak</p>
            
            <button onClick={startRecording} className="w-full py-5 bg-gradient-to-r from-primary to-teal rounded-full text-xl font-bold hover:shadow-[0_0_40px_rgba(99,102,241,0.4)] transition-all flex items-center justify-center gap-3 active:scale-95">
              <Mic size={24} /> Start Speaking
            </button>
          </motion.div>
        )}

        {(step === 'LISTENING' || step === 'NEED_INFO') && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center w-full max-w-md">
            {step === 'NEED_INFO' && (
              <div className="mb-8 p-4 bg-slate-800 rounded-2xl border border-slate-700 w-full text-left">
                <p className="text-lg text-primary font-bold flex items-center gap-2"><Sparkles size={20} /> AI Assistant</p>
                <p className="text-xl mt-2">{aiMessage}</p>
              </div>
            )}
            
            <div className="relative mb-12">
              <div className="w-32 h-32 bg-primary rounded-full flex items-center justify-center relative z-10 shadow-[0_0_60px_rgba(99,102,241,0.6)] animate-pulse">
                <Mic size={48} className="text-white" />
              </div>
              <div className="absolute inset-0 bg-primary/30 rounded-full animate-ping scale-150" />
            </div>
            
            <div className="w-full bg-slate-800 p-6 rounded-[2rem] min-h-[150px] mb-8 border border-slate-700 shadow-xl relative flex items-center justify-center">
              {speechError ? (
                <div className="flex flex-col h-full w-full">
                  <p className="text-sm text-amber-400 font-bold mb-3">{speechError}</p>
                  <textarea 
                    value={transcript} 
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder="Type your response here..."
                    className="w-full bg-slate-900/50 text-white p-4 rounded-xl border border-slate-600 focus:border-primary outline-none resize-none min-h-[100px]"
                  />
                </div>
              ) : isRecording ? (
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
                    <p className="text-xl text-red-400 font-bold tracking-wide">Recording Audio</p>
                  </div>
                  <p className="text-sm text-slate-400 mt-2">Speak now. Click 'Done Talking' when finished.</p>
                </div>
              ) : transcript ? (
                <p className="text-xl leading-relaxed text-left w-full">{transcript}</p>
              ) : (
                <p className="text-xl text-slate-500 italic text-center">Ready to record.</p>
              )}
            </div>

            <div className="flex gap-4 w-full">
              {speechError ? (
                 <button onClick={() => {setStep('WELCOME'); setFlowStep('extract_complaint'); setTranscript('');}} className="flex-1 py-4 bg-slate-800 rounded-full font-bold hover:bg-slate-700 transition-colors">
                  Cancel
                </button>
              ) : !isRecording ? (
                <button onClick={startRecording} className="flex-1 py-4 bg-slate-800 rounded-full font-bold hover:bg-slate-700 transition-colors">
                  Speak Again
                </button>
              ) : (
                <button onClick={() => {stopRecording(); setStep('WELCOME'); setFlowStep('extract_complaint'); setTranscript('');}} className="flex-1 py-4 bg-slate-800 rounded-full font-bold hover:bg-slate-700 transition-colors">
                  Cancel
                </button>
              )}
              <button onClick={handleProcessVoice} className="flex-[2] py-4 bg-primary rounded-full font-bold text-lg hover:bg-indigo-600 transition-colors shadow-lg">
                Done {speechError ? 'Typing' : 'Talking'}
              </button>
            </div>
          </motion.div>
        )}

        {step === 'ANALYZING' && (
          <div className="flex flex-col items-center">
            <Loader2 size={64} className="text-primary animate-spin mb-6" />
            <h2 className="text-2xl font-bold mb-2">Analyzing...</h2>
          </div>
        )}

        {step === 'UPLOAD_PHOTO' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center w-full max-w-md">
            <div className="mb-8 p-6 bg-slate-800 rounded-3xl border border-slate-700 text-left w-full shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-teal" />
              <p className="text-lg text-teal-400 font-bold flex items-center gap-2 mb-3"><Sparkles size={20} /> AI Assistant</p>
              <p className="text-2xl font-serif">{aiMessage}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full mb-6">
              <button onClick={() => cameraInputRef.current?.click()} className="aspect-square bg-slate-800 border-2 border-dashed border-slate-600 rounded-[2rem] flex flex-col items-center justify-center gap-4 hover:border-primary transition-all">
                <Camera size={32} className="text-primary" />
                <span className="font-bold">Use Camera</span>
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="aspect-square bg-slate-800 border-2 border-dashed border-slate-600 rounded-[2rem] flex flex-col items-center justify-center gap-4 hover:border-teal transition-all">
                <ImageIcon size={32} className="text-teal-400" />
                <span className="font-bold">Upload Gallery</span>
              </button>
            </div>
            
            <button onClick={() => {
              setAiMessage("You skipped the photo. Is the problem at your current GPS location, or another location?");
              setFlowStep('extract_location');
              setStep('NEED_INFO');
            }} className="py-4 px-8 text-slate-400 hover:text-white font-bold underline underline-offset-4">
              Skip photo (Not recommended)
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} />
          </motion.div>
        )}

        {step === 'SUCCESS' && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md flex flex-col text-left">
            {previewUrl && (
              <div className="w-full rounded-[2rem] overflow-hidden mb-6 shadow-xl border-4 border-white">
                <img src={previewUrl} className="w-full h-48 object-cover" />
              </div>
            )}
            
            <div className="bg-slate-50 border border-slate-200 p-6 rounded-[2rem] shadow-xl relative overflow-hidden mb-8">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-400 to-emerald-400" />
              
              <p className="text-sm text-teal-600 font-bold flex items-center gap-2 mb-5 uppercase tracking-wider">
                <Sparkles size={16} /> System Initial Assessment
              </p>
              
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">Detected Issue</p>
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <p className="text-xl font-bold text-slate-800">{complaintData.title}</p>
                  </div>
                </div>
                
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">Target Department (System Detected)</p>
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                    <p className="text-lg font-bold text-slate-800">
                      {complaintData.category} — {CIVIC_CATEGORIES[complaintData.category]?.authority_name || 'Municipal Corporation'}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="bg-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-700">Dept Rating: 5 (0 reviews)</span>
                    </div>
                    <p className="text-xs text-slate-500 italic">
                      System mapped this issue to {CIVIC_CATEGORIES[complaintData.category]?.authority_name || 'Municipal Corporation'}
                    </p>
                  </div>
                </div>
                
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">Location / Address</p>
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                    <p className="text-slate-800 font-medium">{complaintData.address || 'Address not specified'}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <button onClick={submitComplaint} className="w-full py-5 bg-gradient-to-r from-primary to-teal rounded-full text-xl font-bold shadow-lg text-white hover:opacity-90 transition-opacity">
              File Complaint Now
            </button>
          </motion.div>
        )}

        {step === 'SUBMITTING' && (<div className="flex flex-col items-center"><Loader2 size={64} className="text-primary animate-spin mb-6" /><h2 className="text-2xl font-bold">Submitting...</h2></div>)}
        {step === 'DONE' && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center">
            <div className="w-24 h-24 bg-teal-500/20 text-teal-400 rounded-full flex items-center justify-center mb-6"><CheckCircle size={48} /></div>
            <h2 className="text-3xl font-bold mb-4 font-serif">Complaint Filed</h2>
            <button onClick={() => navigate('/dashboard')} className="px-8 py-4 bg-slate-800 rounded-full font-bold">Return to Dashboard</button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
