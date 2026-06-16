import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mic, MicOff, Volume2, VolumeX, Camera, Image as ImageIcon, CheckCircle, AlertTriangle, Loader2, Sparkles, Send, MapPin, Building2, Eye, ShieldAlert, Phone, PhoneOff, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE } from '../lib/config';
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

const SUPPORTED_LANGUAGES = [
  { code: 'hi-IN', display: 'हिन्दी', short: 'hi' },
  { code: 'en-IN', display: 'English', short: 'en' },
  { code: 'bn-IN', display: 'বাংলা', short: 'bn' },
  { code: 'te-IN', display: 'తెలుగు', short: 'te' },
  { code: 'mr-IN', display: 'मराठी', short: 'mr' },
  { code: 'ta-IN', display: 'தமிழ்', short: 'ta' },
  { code: 'gu-IN', display: 'ગુજરાતી', short: 'gu' },
  { code: 'ur-IN', display: 'اردو', short: 'ur' },
  { code: 'kn-IN', display: 'ಕನ್ನಡ', short: 'kn' },
  { code: 'ml-IN', display: 'മലയാളം', short: 'ml' },
  { code: 'pa-IN', display: 'ਪੰਜਾਬੀ', short: 'pa' }
];

export default function VoiceReport() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Call Mode & Speech State
  const [selectedLang, setSelectedLang] = useState('hi-IN');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { sender: 'ai', text: 'नमस्ते! मैं आपकी शिकायत दर्ज करने में मदद करूँगा। कृपया अपनी समस्या के बारे में विस्तार से बताएं।' }
  ]);
  
  // Dynamic Complaint Schema State
  const [currentState, setCurrentState] = useState({
    title: '',
    description: '',
    category: 'Other',
    urgency_level: 'Medium',
    address: '',
    isPhotoAttached: false
  });
  
  const [missingField, setMissingField] = useState('issue'); // issue | address | photo | none
  const [readyToSubmit, setReadyToSubmit] = useState(false);
  const [manualText, setManualText] = useState('');
  
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadedMediaUrl, setUploadedMediaUrl] = useState('');
  const [imageHash, setImageHash] = useState('');
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1); // 1: Conversational / Voice Filing, 2: Success

  // Speech Recognition Ref
  const recognitionRef = useRef(null);
  const callActiveRef = useRef(isCallActive);

  // Keep ref in sync for asynchronous speech event handlers
  useEffect(() => {
    callActiveRef.current = isCallActive;
  }, [isCallActive]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = selectedLang;

      rec.onstart = () => {
        setIsListening(true);
        setErrorMsg('');
        setTranscription('');
      };

      rec.onresult = (event) => {
        const text = event.results[0][0].transcript;
        setTranscription(text);
        if (text.trim()) {
          handleSendMessage(text);
        }
      };

      rec.onerror = (event) => {
        console.log('Speech recognition error:', event.error);
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setErrorMsg('माइक एक्सेस या स्पीच रिकग्निशन में समस्या है।');
        }
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
        // Automatically resume listening if in Hands-Free Call Mode and not currently speaking or waiting
        setTimeout(() => {
          if (callActiveRef.current && !window.speechSynthesis.speaking && !isThinking && !isListening) {
            try {
              recognitionRef.current?.start();
            } catch (e) {
              // Ignore already started errors
            }
          }
        }, 600);
      };

      recognitionRef.current = rec;
    } else {
      console.warn('Speech recognition not supported in this browser.');
    }

    // Geolocation Request on Mount
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          });
        },
        () => console.warn('Location access denied'),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [selectedLang, isThinking]);

  // Handle Speech Synthesis
  const speak = (text) => {
    if (!window.speechSynthesis || isMuted) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const shortCode = SUPPORTED_LANGUAGES.find(l => l.code === selectedLang)?.short || 'hi';
    utterance.lang = shortCode;

    // Find custom voice matching shortCode
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.toLowerCase().startsWith(shortCode) || v.lang.includes('IN'));
    if (voice) utterance.voice = voice;

    utterance.onstart = () => {
      setIsSpeaking(true);
      // Turn off microphone during speech to prevent voice feedback loop
      recognitionRef.current?.abort();
    };
    
    utterance.onend = () => {
      setIsSpeaking(false);
      // In Hands-free call mode, automatically resume listening after speaking completes
      if (callActiveRef.current) {
        setTimeout(() => {
          if (callActiveRef.current && !isListening && !isThinking) {
            try {
              recognitionRef.current?.start();
            } catch (e) {
              console.warn(e);
            }
          }
        }, 500);
      }
    };

    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  // Speak greeting on mount or language change
  useEffect(() => {
    const defaultGreetings = {
      'hi-IN': 'नमस्ते! मैं आपकी शिकायत दर्ज करने में मदद करूँगा। कृपया अपनी समस्या के बारे में विस्तार से बताएं।',
      'en-IN': 'Hello! I will help you file your complaint. Please describe the issue in detail.',
      'mr-IN': 'नमस्कार! मी तुमची तक्रार नोंदविण्यात मदत करेन. कृपया समस्येचे सविस्तर वर्णन करा.',
      'bn-IN': 'নমস্কার! আমি আপনার অভিযোগ জানাতে সাহায্য করব। দয়া করে বিষয়টি বিস্তারিত বলুন।',
      'te-IN': 'నమస్కారం! నేను మీ ఫిర్యాదును నమోదు చేయడంలో సహాయపడతాను. దయచేసి సమస్యను వివరంగా వివరించండి.',
      'ta-IN': 'வணக்கம்! உங்கள் புகாரை பதிவு செய்ய நான் உதவுகிறேன். தயவுசெய்து சிக்கலை விரிவாக விவரிக்கவும்.',
      'gu-IN': 'નમસ્તે! હું તમારી ફરિયાદ નોંધવામાં મદદ કરીશ. કૃપા કરીને સમસ્યાનું વિગતવાર વર્ણન કરો.',
      'ur-IN': 'ہیلو! میں آپ کی شکایت درج کرانے میں مدد کروں گا۔ براہ کرم مسئلہ کی تفصیل بتائیں۔',
      'kn-IN': 'ನಮಸ್ಕಾರ! ನಿಮ್ಮ ದೂರನ್ನು ದಾಖಲಿಸಲು ನಾನು ಸಹಾಯ ಮಾಡುತ್ತೇನೆ. ದಯವಿಟ್ಟು ಸಮಸ್ಯೆಯನ್ನು ವಿವರವಾಗಿ ತಿಳಿಸಿ.',
      'ml-IN': 'നമസ്കാരം! നിങ്ങളുടെ പരാതി ഫയൽ ചെയ്യാൻ ഞാൻ സഹായിക്കാം. ദയവായി പ്രശ്നം വിശദമായി പറയുക.',
      'pa-IN': 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਤੁਹਾਡੀ ਸ਼ਿਕਾਇਤ ਦਰਜ ਕਰਨ ਵਿੱਚ ਮਦਦ ਕਰਾਂਗਾ। ਕਿਰਪา ਕਰਕੇ ਸਮੱਸਿਆ ਦਾ ਵੇਰਵਾ ਦਿਓ।'
    };

    const text = defaultGreetings[selectedLang] || defaultGreetings['hi-IN'];
    setChatHistory([{ sender: 'ai', text }]);
    
    // Only speak automatically on trigger to respect autoplay policies
    if (isCallActive) {
      speak(text);
    }
  }, [selectedLang]);

  // Toggle Hands-free Voice Call Mode
  const toggleVoiceCall = () => {
    if (isCallActive) {
      setIsCallActive(false);
      recognitionRef.current?.stop();
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
    } else {
      setIsCallActive(true);
      setErrorMsg('');
      const firstGreeting = chatHistory[0]?.text || 'Hello';
      speak(firstGreeting);
    }
  };

  // Standard tap to talk microphone trigger
  const handleTapToSpeak = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
      recognitionRef.current?.start();
    }
  };

  // Image Processing & Compression
  const processImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_DIM = 1200;
          if (width > height) {
            if (width > MAX_DIM) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (!blob) return reject(new Error('Canvas is empty'));
            const processedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
              type: 'image/webp',
              lastModified: Date.now()
            });
            resolve({ file: processedFile, previewUrl: canvas.toDataURL('image/webp', 0.85) });
          }, 'image/webp', 0.85);
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  // Photo Upload Handler
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setErrorMsg('');
    setIsThinking(true);
    recognitionRef.current?.abort();

    try {
      const scanned = await processImage(file);
      setPreviewUrl(scanned.previewUrl);

      const formData = new FormData();
      formData.append('image', scanned.file);

      // Call Backend Analyzer (checks spam, AI generation, duplicate status)
      const res = await fetch(`${API_BASE}/api/complaints/analyze`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (res.ok && data.success) {
        if (data.is_duplicate) {
          alert(data.message);
          navigate(`/track/${data.complaint_id}`);
          return;
        }

        const analysis = data.analysis;
        setUploadedMediaUrl(data.media_url);
        setImageHash(data.image_hash || '');

        // Merge image analysis with ongoing state
        setCurrentState(prev => {
          const updated = {
            ...prev,
            title: analysis.title || prev.title || 'Civic Issue',
            category: analysis.category || prev.category,
            urgency_level: analysis.urgency_level || prev.urgency_level,
            address: analysis.address || prev.address,
            isPhotoAttached: true
          };
          
          // Send notification message to Assistant updating context
          sendSystemPhotoUpdate(updated, analysis.title);
          return updated;
        });

      } else {
        setErrorMsg(data.error || 'छवि सत्यापन विफल रहा।');
        setPreviewUrl(null);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('नेटवर्क त्रुटि। कृपया पुनः प्रयास करें।');
      setPreviewUrl(null);
    } finally {
      setIsThinking(false);
    }
  };

  // Notify voice assistant of photo uploads
  const sendSystemPhotoUpdate = async (updatedState, imageTitle) => {
    setIsThinking(true);
    const shortCode = SUPPORTED_LANGUAGES.find(l => l.code === selectedLang)?.short || 'hi';
    const systemMessageText = `[System: Citizen has uploaded photo evidence displaying: "${imageTitle}"]`;

    try {
      const res = await fetch(`${API_BASE}/api/chat/voice-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: chatHistory,
          userMessage: systemMessageText,
          currentState: updatedState,
          selectedLanguage: shortCode
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setChatHistory(prev => [...prev, { sender: 'ai', text: data.reply }]);
        setMissingField(data.missingField || 'none');
        setReadyToSubmit(!!data.readyToSubmit);
        speak(data.reply);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsThinking(false);
    }
  };

  // Skip Photo Action
  const handleSkipPhoto = async () => {
    setIsThinking(true);
    const shortCode = SUPPORTED_LANGUAGES.find(l => l.code === selectedLang)?.short || 'hi';
    const systemMessageText = `[System: Citizen specifies they do not have a photo. Proceed without photo evidence.]`;
    
    // Optimistically update photo flag
    setCurrentState(prev => ({ ...prev, isPhotoAttached: false }));

    try {
      const res = await fetch(`${API_BASE}/api/chat/voice-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: chatHistory,
          userMessage: systemMessageText,
          currentState: { ...currentState, isPhotoAttached: false },
          selectedLanguage: shortCode
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setChatHistory(prev => [...prev, { sender: 'ai', text: data.reply }]);
        setMissingField(data.missingField || 'none');
        setReadyToSubmit(!!data.readyToSubmit);
        speak(data.reply);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsThinking(false);
    }
  };

  // Fetch Device GPS location and Geocode
  const fetchGPSLocation = () => {
    if (!navigator.geolocation) return;
    setIsThinking(true);
    setErrorMsg('');
    recognitionRef.current?.abort();

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      setLocation({ latitude, longitude });
      
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        const data = await res.json();
        const formattedAddress = data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        
        setCurrentState(prev => {
          const updated = { ...prev, address: formattedAddress };
          sendSystemLocationUpdate(updated, formattedAddress);
          return updated;
        });
      } catch (err) {
        console.error(err);
        setErrorMsg("स्थान खोजने में असमर्थ। कृपया बोलकर स्थान बताएं।");
      } finally {
        setIsThinking(false);
      }
    }, () => {
      setErrorMsg("जीपीएस एक्सेस अस्वीकृत। कृपया स्थान की अनुमति चालू करें।");
      setIsThinking(false);
    }, { enableHighAccuracy: true, timeout: 8000 });
  };

  // Notify assistant of GPS updates
  const sendSystemLocationUpdate = async (updatedState, formattedAddress) => {
    setIsThinking(true);
    const shortCode = SUPPORTED_LANGUAGES.find(l => l.code === selectedLang)?.short || 'hi';
    const systemMessageText = `[System: Citizen selected GPS address: "${formattedAddress}"]`;

    try {
      const res = await fetch(`${API_BASE}/api/chat/voice-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: chatHistory,
          userMessage: systemMessageText,
          currentState: updatedState,
          selectedLanguage: shortCode
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setChatHistory(prev => [...prev, { sender: 'ai', text: data.reply }]);
        setMissingField(data.missingField || 'none');
        setReadyToSubmit(!!data.readyToSubmit);
        speak(data.reply);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsThinking(false);
    }
  };

  // Text inputs callback (when talking is hard/unavailable)
  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualText.trim()) return;
    const text = manualText;
    setManualText('');
    handleSendMessage(text);
  };

  // Main voice transcription/message handler
  const handleSendMessage = async (textToSend) => {
    if (!textToSend.trim() || isThinking) return;

    setChatHistory(prev => [...prev, { sender: 'user', text: textToSend }]);
    setIsThinking(true);
    const shortCode = SUPPORTED_LANGUAGES.find(l => l.code === selectedLang)?.short || 'hi';

    // Intercept submit confirmation commands in transcript (e.g. saying "submit" / "दर्ज करो")
    const isSubmitCommand = ['submit', 'submit it', 'दर्ज करो', 'जमा करो', 'शिकायत दर्ज करो', 'yes submit', 'हाँ दर्ज करो'].includes(textToSend.toLowerCase().trim());
    if (isSubmitCommand && readyToSubmit) {
      setIsThinking(false);
      handleSubmitGrievance();
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/chat/voice-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: chatHistory,
          userMessage: textToSend,
          currentState: currentState,
          selectedLanguage: shortCode
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setChatHistory(prev => [...prev, { sender: 'ai', text: data.reply }]);
        
        // Update grievance fields
        if (data.extractedFields) {
          setCurrentState(prev => ({
            ...prev,
            title: data.extractedFields.title || prev.title,
            description: data.extractedFields.description || prev.description || textToSend,
            category: data.extractedFields.category || prev.category,
            urgency_level: data.extractedFields.urgency_level || prev.urgency_level,
            address: data.extractedFields.address || prev.address
          }));
        }

        setMissingField(data.missingField || 'none');
        setReadyToSubmit(!!data.readyToSubmit);
        speak(data.reply);

      } else {
        const errorReply = 'क्षमा करें, प्रतिक्रिया विफल रही। कृपया पुनः प्रयास करें।';
        setChatHistory(prev => [...prev, { sender: 'ai', text: errorReply }]);
        speak(errorReply);
      }
    } catch (err) {
      console.error(err);
      const errorReply = 'नेटवर्क समस्या के कारण सर्वर से संपर्क नहीं हो सका।';
      setChatHistory(prev => [...prev, { sender: 'ai', text: errorReply }]);
      speak(errorReply);
    } finally {
      setIsThinking(false);
    }
  };

  // Submit Final Report
  const handleSubmitGrievance = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMsg('');
    
    // Stop ongoing calls and voice
    setIsCallActive(false);
    recognitionRef.current?.abort();
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    const mappedDept = CIVIC_CATEGORIES_LIST[currentState.category] || CIVIC_CATEGORIES_LIST.Other;

    const payload = {
      citizen_id: user?.id,
      title: currentState.title || 'Civic Issue via Voice',
      description: currentState.description || chatHistory.filter(m => m.sender === 'user').map(m => m.text).join(' '),
      category: currentState.category,
      department_id: mappedDept.department_id,
      priority_score: currentState.urgency_level === 'Emergency' ? 10 : currentState.urgency_level === 'High' ? 8 : 5,
      urgency_level: currentState.urgency_level,
      latitude: location?.latitude || 0,
      longitude: location?.longitude || 0,
      address: currentState.address || 'Location Specified via Voice',
      district: user?.district || 'Bhopal',
      media_urls: uploadedMediaUrl ? [uploadedMediaUrl] : [],
      image_hash: imageHash
    };

    try {
      const res = await fetch(`${API_BASE}/api/complaints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStep(2);
      } else {
        setErrorMsg(data.error || 'शिकायत जमा करने में विफलता।');
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('नेटवर्क समस्या। कृपया पुनः सबमिट करें।');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Checklist values
  const isIssueReady = !!currentState.title;
  const isLocationReady = !!currentState.address;
  const isPhotoReady = currentState.isPhotoAttached;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 overflow-hidden pb-10">
      <div className="dancheong-line" />

      {step === 1 && (
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          
          {/* Header */}
          <div className="bg-white border-b border-slate-100 p-4 pt-12 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-lg font-bold font-serif flex items-center gap-1.5">
                  Voice Grievance AI 🎙
                </h1>
                <p className="text-[10px] text-slate-400">Multilingual Step-by-Step Reporting</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsMuted(!isMuted)} 
                className={`p-2 rounded-xl border transition-all ${isMuted ? 'border-red-200 bg-red-50 text-red-500' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                title="Mute AI Speech"
              >
                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              
              {/* Call Mode Toggle */}
              <button
                onClick={toggleVoiceCall}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${isCallActive ? 'bg-red-500 text-white animate-pulse' : 'bg-green-600 text-white hover:bg-green-700'}`}
              >
                {isCallActive ? (
                  <>
                    <PhoneOff size={14} /> Hang Up Call
                  </>
                ) : (
                  <>
                    <Phone size={14} /> Start Voice Call
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Languages Selector Strip */}
          <div className="bg-slate-100 border-b border-slate-200/60 p-2 overflow-x-auto no-scrollbar flex gap-2 shrink-0">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setSelectedLang(lang.code)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all ${selectedLang === lang.code ? 'bg-primary text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'}`}
              >
                {lang.display}
              </button>
            ))}
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="m-3 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-xs shrink-0">
              <AlertTriangle size={15} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Call Mode Status Banner */}
          {isCallActive && (
            <div className="bg-indigo-50 border-b border-indigo-100 p-2.5 px-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2 text-xs text-indigo-700 font-medium">
                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping" />
                <span>AI Call Connected — speak hands-free</span>
              </div>
              <p className="text-[10px] text-slate-400">Mic starts when AI stops speaking</p>
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            
            {/* Left Column: Call Voice Chat & Transcription */}
            <div className="flex-1 flex flex-col border-r border-slate-200/50 overflow-hidden bg-white/40">
              
              {/* Chat Log */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatHistory.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed ${msg.sender === 'user' ? 'bg-primary text-white rounded-tr-none' : 'bg-white border border-slate-150 text-slate-800 rounded-tl-none shadow-sm'}`}>
                      {msg.text.startsWith('[System:') ? (
                        <span className="italic flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                          <Eye size={12} /> {msg.text.replace('[System:', '').replace(']', '')}
                        </span>
                      ) : (
                        msg.text
                      )}
                    </div>
                  </motion.div>
                ))}
                
                {isThinking && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-slate-150 p-3.5 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2 text-xs text-slate-400">
                      <Loader2 size={14} className="animate-spin text-primary" />
                      <span>AI सोच रहा है...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Dynamic Option Guide Card (Context-Sensitive Step UI) */}
              <div className="p-4 bg-indigo-50/40 border-t border-slate-200/60 shrink-0">
                <AnimatePresence mode="wait">
                  {/* Step 1: Issue Description */}
                  {missingField === 'issue' && !readyToSubmit && (
                    <motion.div 
                      key="step-issue"
                      initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}
                      className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm flex flex-col gap-2"
                    >
                      <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Sparkles size={14} className="text-primary" /> Step 1: Describe the Civic Issue
                      </h3>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        कृपया माइक या कॉल चालू करें और समस्या बोलें। उदाहरण: <em>"यहाँ गली में कचरे का ढेर लगा है"</em> या <em>"सड़क पर बड़ा गड्ढा है।"</em>
                      </p>
                    </motion.div>
                  )}

                  {/* Step 2: Location Access / Address */}
                  {missingField === 'address' && !readyToSubmit && (
                    <motion.div 
                      key="step-address"
                      initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}
                      className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm flex flex-col gap-3"
                    >
                      <div>
                        <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <MapPin size={14} className="text-primary animate-bounce" /> Step 2: Location details
                        </h3>
                        <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                          कृपया अपना स्थान बताएं या सीधे नीचे दिए गए बटन पर क्लिक कर GPS स्थान शेयर करें।
                        </p>
                      </div>
                      
                      <div className="flex gap-2">
                        <button 
                          onClick={fetchGPSLocation}
                          className="flex-1 bg-gradient-to-r from-primary to-teal text-white py-3 px-4 rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-2 hover:opacity-95 transition-opacity"
                        >
                          <Compass size={16} /> GPS स्थान से भरें
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 3: Photo Evidence Capture */}
                  {missingField === 'photo' && !readyToSubmit && (
                    <motion.div 
                      key="step-photo"
                      initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}
                      className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm flex flex-col gap-3"
                    >
                      <div>
                        <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Camera size={14} className="text-primary" /> Step 3: Attach Photo (Recommended)
                        </h3>
                        <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                          समस्या का फोटो खींचें या गैलरी से अपलोड करें। फोटो न होने की स्थिति में आप आगे बढ़ सकते हैं।
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2">
                        <button 
                          onClick={() => cameraInputRef.current?.click()} 
                          className="py-3 px-2 bg-indigo-50 border border-dashed border-indigo-200 text-primary rounded-xl flex flex-col items-center justify-center gap-1 font-bold text-[10px] hover:bg-indigo-100/40"
                        >
                          <Camera size={18} /> कैमरा फोटो लें
                        </button>
                        <button 
                          onClick={() => fileInputRef.current?.click()} 
                          className="py-3 px-2 bg-teal-50 border border-dashed border-teal-200 text-teal-600 rounded-xl flex flex-col items-center justify-center gap-1 font-bold text-[10px] hover:bg-teal-100/40"
                        >
                          <ImageIcon size={18} /> गैलरी से चुनें
                        </button>
                        <button 
                          onClick={handleSkipPhoto} 
                          className="py-3 px-2 bg-slate-100 border border-slate-200 text-slate-600 rounded-xl flex flex-col items-center justify-center gap-1 font-bold text-[10px] hover:bg-slate-200"
                        >
                          <span className="text-lg">⏭</span> फोटो छोड़ें (Skip)
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 4: Submission Confirmation */}
                  {readyToSubmit && (
                    <motion.div 
                      key="step-confirm"
                      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-gradient-to-br from-green-50 to-emerald-50/50 p-4 rounded-2xl border border-green-200 shadow-sm flex flex-col gap-3 animate-pulse"
                    >
                      <div>
                        <h3 className="text-xs font-bold text-green-800 flex items-center gap-1.5">
                          <CheckCircle size={15} /> Step 4: Ready to Submit
                        </h3>
                        <p className="text-[11px] text-green-700 leading-relaxed mt-0.5 font-medium">
                          सभी आवश्यक विवरण दर्ज कर लिए गए हैं। शिकायत दर्ज करने के लिए बोलें: <em>"शिकायत दर्ज करो"</em> या नीचे दिए गए बटन पर क्लिक करें।
                        </p>
                      </div>
                      
                      <button 
                        onClick={handleSubmitGrievance}
                        disabled={isSubmitting}
                        className="w-full bg-green-600 text-white font-bold py-3.5 rounded-xl shadow-lg hover:bg-green-700 transition-all text-xs flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                        शिकायत दर्ज करें (Submit Final Complaint)
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Speech Microphone controls */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col items-center gap-3 shrink-0">
                <div className="h-6 flex items-center gap-1.5 justify-center w-full">
                  {isListening ? (
                    [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1 bg-red-400 rounded-full"
                        animate={{ height: [10, 26, 6, 18, 10][(i + Math.round(Math.random() * 2)) % 5] }}
                        transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.05 }}
                      />
                    ))
                  ) : isSpeaking ? (
                    [0, 1, 2, 3, 4, 5].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1 bg-primary rounded-full"
                        animate={{ height: [6, 22, 10, 16, 6][i % 5] }}
                        transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.07 }}
                      />
                    ))
                  ) : (
                    <div className="w-16 h-0.5 bg-slate-200 rounded-full" />
                  )}
                </div>

                <div className="flex items-center gap-4 w-full px-4 justify-between">
                  {/* Manual Type Input fallback */}
                  <form onSubmit={handleManualSubmit} className="flex-1 flex gap-2 mr-2">
                    <input 
                      value={manualText} 
                      onChange={e => setManualText(e.target.value)} 
                      placeholder="Type message manually if needed..." 
                      className="flex-1 text-xs p-2.5 px-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <button type="submit" className="p-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-900 transition-colors">
                      <Send size={15} />
                    </button>
                  </form>

                  {/* Manual Speak Mic Button (only shows when Call is not active) */}
                  {!isCallActive && (
                    <motion.button
                      type="button"
                      onClick={handleTapToSpeak}
                      whileTap={{ scale: 0.95 }}
                      className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-primary text-white'}`}
                    >
                      {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                    </motion.button>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Live Grievance Schema Inspector */}
            <div className="h-2/5 md:h-full md:w-80 border-t md:border-t-0 bg-slate-100 overflow-y-auto p-4 space-y-4 shrink-0">
              <div className="bg-white border border-slate-150 p-4 rounded-2xl shadow-sm space-y-4">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles size={13} className="text-primary" /> शिकायत का विवरण (Live)
                </h2>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-bold">शीर्षक (Title)</label>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 min-h-[36px] flex items-center">
                      {currentState.title || <span className="text-slate-300 italic font-normal">शीर्षक सुन रहा हूँ...</span>}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-bold">श्रेणी (Category)</label>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 min-h-[36px] flex items-center">
                      {currentState.category ? `${currentState.category} — ${CIVIC_CATEGORIES_LIST[currentState.category]?.authority_name || 'Municipal'}` : <span className="text-slate-300 italic font-normal">सुन रहा हूँ...</span>}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-bold">स्थान (Address)</label>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 min-h-[36px] flex items-center">
                      {currentState.address || <span className="text-slate-300 italic">स्थान सुन रहा हूँ...</span>}
                    </div>
                  </div>

                  {/* Photo Display */}
                  {previewUrl && (
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">फोटो साक्ष्य (Evidence)</label>
                      <div className="relative rounded-xl overflow-hidden aspect-video border border-slate-200 shadow-sm">
                        <img src={previewUrl} className="w-full h-full object-cover" />
                        <button 
                          onClick={() => { setPreviewUrl(null); setUploadedMediaUrl(''); setImageHash(''); setCurrentState(p => ({ ...p, isPhotoAttached: false })); }} 
                          className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-md"
                        >
                          हटाएं
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress Checklist indicator */}
              <div className="bg-white border border-slate-150 p-4 rounded-2xl shadow-sm space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">चेकलिस्ट</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={isIssueReady ? 'text-green-500' : 'text-slate-300'}>
                      <CheckCircle size={16} />
                    </span>
                    <span className={isIssueReady ? 'text-slate-700 font-medium' : 'text-slate-400'}>समस्या का विवरण</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={isLocationReady ? 'text-green-500' : 'text-slate-300'}>
                      <CheckCircle size={16} />
                    </span>
                    <span className={isLocationReady ? 'text-slate-700 font-medium' : 'text-slate-400'}>स्थान/पता</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={isPhotoReady ? 'text-green-500' : 'text-slate-300'}>
                      <CheckCircle size={16} />
                    </span>
                    <span className={isPhotoReady ? 'text-slate-700 font-medium' : 'text-slate-400'}>फोटो अटैच है</span>
                  </div>
                </div>
              </div>
            </div>
            
          </div>
          
          {/* Inputs for hidden file uploads */}
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
          <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handlePhotoUpload} />
        </div>
      )}

      {step === 2 && (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in zoom-in-95 duration-500 h-screen bg-slate-50">
          <div className="w-24 h-24 bg-teal-50 text-teal-600 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-sm">
            <CheckCircle size={48} />
          </div>
          <h2 className="text-3xl font-bold font-serif mb-4 tracking-tight">शिकायत दर्ज हुई!</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-10 max-w-xs">
            आपकी नागरिक शिकायत सफलतापूर्वक दर्ज कर संबंधित विभाग को प्रेषित कर दी गई है।
          </p>
          <button 
            onClick={() => navigate('/dashboard')} 
            className="w-full max-w-sm bg-slate-900 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-black transition-colors text-sm"
          >
            डैशबोर्ड पर वापस जाएं
          </button>
        </div>
      )}
    </div>
  );
}
