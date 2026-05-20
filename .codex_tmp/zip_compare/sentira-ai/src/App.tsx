/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, createContext, useContext } from 'react';
import { collection, query, orderBy, limit, onSnapshot, where, doc, getDoc, setDoc } from 'firebase/firestore';
import { analyzeIssueImage, getSmartFollowUpQuestions } from './services/aiService';
import { Card, Badge, Button } from './components/UI';
import { Complaint, UserProfile } from './types';
import { useParams, BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { formatDate, cn } from './lib/utils';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, db, googleProvider } from './lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home as HomeIcon, 
  MapPin, 
  PlusCircle, 
  History, 
  User as UserIcon, 
  Bell,
  Search,
  ChevronRight,
  ShieldAlert,
  ArrowLeft,
  LayoutDashboard
} from 'lucide-react';

// --- Auth Context ---
interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
        if (userDoc.exists()) {
          setUser(userDoc.data() as UserProfile);
        } else {
          const newUser: UserProfile = {
            uid: fbUser.uid,
            email: fbUser.email || '',
            displayName: fbUser.displayName || 'User',
            photoURL: fbUser.photoURL || '',
            role: 'citizen',
            createdAt: new Date().toISOString(),
          };
          await setDoc(doc(db, 'users', fbUser.uid), newUser);
          setUser(newUser);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
  }, []);

  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error(err);
    }
  };

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// --- Layout & Components ---
function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const navItems = [
    { path: '/', icon: HomeIcon, label: 'Home' },
    { path: '/explore', icon: Search, label: 'Explore' },
    { path: '/report', icon: PlusCircle, label: 'Report', primary: true },
    { path: '/history', icon: History, label: 'Activity' },
    { path: '/profile', icon: UserIcon, label: 'Profile' },
  ];

  if (user?.role === 'admin' || user?.role === 'officer') {
    navItems[1] = { path: '/dashboard', icon: LayoutDashboard, label: 'Admin' };
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex justify-around items-center px-4 py-2 pb-6 z-50">
      {navItems.map((item) => (
        <button
          key={item.path}
          onClick={() => navigate(item.path)}
          className={`flex flex-col items-center gap-1 transition-all ${
            location.pathname === item.path ? 'text-blue-600' : 'text-slate-400'
          } ${item.primary ? 'scale-110 -translate-y-2' : ''}`}
        >
          <div className={`${item.primary ? 'bg-blue-600 text-white p-3 rounded-full shadow-lg' : ''}`}>
            <item.icon size={item.primary ? 28 : 22} />
          </div>
          {!item.primary && <span className="text-[10px] font-medium uppercase tracking-wider">{item.label}</span>}
        </button>
      ))}
    </div>
  );
}

// --- Protected Route ---
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

// --- Main App ---
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={
              <ProtectedRoute>
                <div className="min-h-screen bg-slate-50 pb-24">
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/report" element={<ReportIssue />} />
                    <Route path="/complaint/:id" element={<ComplaintDetails />} />
                    <Route path="/explore" element={<Explore />} />
                    <Route path="/history" element={<HistoryPage />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/dashboard" element={<AdminDashboard />} />
                  </Routes>
                  <BottomNav />
                </div>
              </ProtectedRoute>
            } />
          </Routes>
        </AnimatePresence>
      </BrowserRouter>
    </AuthProvider>
  );
}

// Placeholder Screens (to be filled in next step)
function Login() {
  const { signIn, user } = useAuth();
  if (user) return <Navigate to="/" />;

  return (
    <div className="h-screen flex flex-col items-center justify-center p-6 bg-blue-600 text-white">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <ShieldAlert size={80} className="mx-auto mb-6 opacity-80" />
        <h1 className="text-4xl font-bold mb-2">Sentira AI</h1>
        <p className="text-blue-100 mb-12 max-w-[280px]">India's Next-Gen AI Public Grievance Platform</p>
        <button 
          onClick={signIn}
          className="bg-white text-blue-600 px-8 py-4 rounded-2xl font-semibold shadow-2xl active:scale-95 transition-transform"
        >
          Sign in with Google
        </button>
      </motion.div>
    </div>
  );
}

function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [recentComplaints, setRecentComplaints] = useState<Complaint[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'complaints'), orderBy('createdAt', 'desc'), limit(5));
    return onSnapshot(q, (snapshot) => {
      setRecentComplaints(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Complaint)));
    });
  }, []);

  return (
    <div className="p-5 flex flex-col gap-6 animate-in fade-in transition-all duration-500">
      <header className="flex justify-between items-center px-1">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Sentira AI</span>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Team CODEX</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 leading-none">Jai Hind, {user?.displayName.split(' ')[0]}</h2>
          <p className="text-slate-500 text-sm font-medium">BGI Hackathon • Vision 2047</p>
        </div>
        <button className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm relative group active:scale-95 transition-all">
          <Bell size={20} className="text-slate-600 group-hover:text-blue-600" />
          <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white"></span>
        </button>
      </header>

      <Card className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-6 relative overflow-hidden" onClick={() => navigate('/report')}>
        <div className="relative z-10">
          <h3 className="text-xl font-bold mb-1">Report a Civic Issue</h3>
          <p className="text-blue-100 text-sm mb-4">AI will automatically analyze and route your complaint.</p>
          <div className="bg-white/20 backdrop-blur-sm self-start inline-flex px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider">
            Start Reporting <ChevronRight size={14} className="ml-1 inline" />
          </div>
        </div>
        <PlusCircle size={100} className="absolute -right-4 -bottom-4 text-white/10" />
      </Card>

      <section>
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-bold">Live Tracking</h4>
          <button className="text-blue-600 text-xs font-medium" onClick={() => navigate('/history')}>See All</button>
        </div>
        <div className="flex flex-col gap-3">
          {recentComplaints.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-slate-100/50 rounded-2xl border border-dashed border-slate-200">
              No recent reports. Start by reporting an issue.
            </div>
          ) : (
            recentComplaints.map((c) => (
              <Card key={c.id} className="flex gap-4 items-center" onClick={() => navigate(`/complaint/${c.id}`)}>
                <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100">
                  <img src={c.media.url} alt={c.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h5 className="font-semibold truncate text-sm">{c.title}</h5>
                    <Badge variant={c.status === 'completed' ? 'success' : c.status === 'delayed' ? 'error' : 'info'}>
                      {c.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-slate-500 text-xs truncate mb-2">{c.description}</p>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium bg-slate-50 self-start px-2 py-0.5 rounded-full">
                    <MapPin size={10} /> {c.location.address.split(',')[0]}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </section>

      <section>
        <h4 className="font-bold mb-4">Quick Categories</h4>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Pothole', icon: '🕳️' },
            { label: 'Garbage', icon: '🗑️' },
            { label: 'Water', icon: '🚰' },
            { label: 'Lights', icon: '💡' },
            { label: 'Traffic', icon: '🚦' },
            { label: 'Pollution', icon: '🏭' },
            { label: 'Power', icon: '⚡' },
            { label: 'Safety', icon: '👮' },
          ].map((cat) => (
            <div key={cat.label} className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-2xl">
                {cat.icon}
              </div>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight">{cat.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ReportIssue() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'upload' | 'analyzing' | 'chat' | 'review' | 'success'>('upload');
  const [media, setMedia] = useState<{ type: 'image' | 'video', file: File, preview: string } | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [pipelineStatus, setPipelineStatus] = useState<string>('Initializing AI...');
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([]);
  const [location, setLocation] = useState<{ lat: number, lng: number, address: string }>({ lat: 23.2599, lng: 77.4126, address: 'MP Nagar Zone 2, Bhopal' });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMedia({ 
        type: file.type.startsWith('video') ? 'video' : 'image',
        file,
        preview: URL.createObjectURL(file)
      });
      analyze(file);
    }
  };

  const analyze = async (file: File) => {
    setStep('analyzing');
    const stages = [
      'Data Ingestion...',
      'NLP Preprocessing...',
      'Semantic Analysis...',
      'AI Classification...',
      'Priority Detection...',
      'Routing Generation...'
    ];
    
    // Simulate pipeline visuals for the "PDF vibe"
    for (const stage of stages) {
      setPipelineStatus(stage);
      await new Promise(r => setTimeout(r, 600));
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const result = await analyzeIssueImage(base64, file.type);
      if (result) {
        setAiAnalysis(result);
        const questions = await getSmartFollowUpQuestions(result);
        setFollowUpQuestions(questions);
        setStep('chat');
      }
    };
    reader.readAsDataURL(file);
  };

  const submitComplaint = async () => {
    try {
      const id = Date.now().toString();
      const complaintRef = doc(db, 'complaints', id);
      await setDoc(complaintRef, {
        citizenId: user?.uid,
        title: aiAnalysis.title,
        description: aiAnalysis.description,
        category: aiAnalysis.category,
        urgency: aiAnalysis.urgency,
        severity: aiAnalysis.severity,
        status: 'submitted',
        location,
        media: {
          type: media?.type,
          url: media?.preview // In real app, upload to storage first
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setStep('success');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-5 flex flex-col h-[calc(100vh-80px)]">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-bold">New Report</h2>
      </header>

      <AnimatePresence mode="wait">
        {step === 'upload' && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col gap-6">
            <label className="flex-1 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center p-8 text-center bg-white cursor-pointer hover:border-blue-400 transition-colors">
              <input type="file" className="hidden" accept="image/*,video/*" onChange={handleFile} />
              <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
                <PlusCircle size={40} />
              </div>
              <h3 className="font-bold text-lg mb-2">Upload Issue Image/Video</h3>
              <p className="text-slate-400 text-sm">AI will analyze and detect the issue automatically.</p>
            </label>
            <Card className="flex items-center gap-4 p-4 border-l-4 border-l-blue-600">
              <ShieldAlert className="text-blue-600" />
              <p className="text-xs text-slate-500">Your privacy is protected. Precise location will be used to route the complaint to the correct authority.</p>
            </Card>
          </motion.div>
        )}

        {step === 'analyzing' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="relative w-40 h-40 mb-12">
              {/* Outer pulse */}
              <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.3, 0.1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-blue-600 rounded-full"
              />
              <div className="absolute inset-0 rounded-full border-4 border-blue-100"></div>
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent"
              ></motion.div>
              <div className="absolute inset-4 rounded-full bg-white shadow-inner flex flex-col items-center justify-center overflow-hidden">
                {media && <img src={media.preview} className="w-full h-full object-cover opacity-20 grayscale" />}
                <div className="absolute inset-0 flex items-center justify-center">
                  <Search className="text-blue-600 animate-pulse" size={40} />
                </div>
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-4 tracking-tight">Sentira Semantic Engine</h3>
            <div className="flex flex-col gap-2 items-center">
              <motion.div 
                key={pipelineStatus}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest border border-blue-100 flex items-center gap-2"
              >
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-ping" />
                {pipelineStatus}
              </motion.div>
              <p className="text-slate-400 text-sm max-w-[240px] mt-2">Our AI is processing your input using the multi-stage BGI pipeline.</p>
            </div>
          </motion.div>
        )}

        {step === 'chat' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col gap-6">
            <div className="bg-blue-600 p-6 rounded-3xl text-white">
              <Badge variant="info" className="bg-white/20 text-white mb-2">AI Diagnosis</Badge>
              <h3 className="text-xl font-bold mb-2">{aiAnalysis.title}</h3>
              <p className="text-blue-100 text-sm leading-relaxed">{aiAnalysis.description}</p>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-4 py-4">
              <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-none self-start max-w-[85%] text-sm">
                I've detected a {aiAnalysis.category} issue. To help the authorities, could you tell me:
                <ul className="mt-2 flex flex-col gap-2">
                  {followUpQuestions.map((q, i) => (
                    <li key={i} className="flex gap-2 items-start text-blue-700 font-medium">
                      <ChevronRight size={16} className="mt-0.5 flex-shrink-0" /> {q}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-2">
              <input type="text" placeholder="Type your response..." className="flex-1 outline-none text-sm" />
              <Button onClick={() => setStep('review')} className="px-4 py-2">Submit</Button>
            </div>
          </motion.div>
        )}

        {step === 'review' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col gap-6 overflow-y-auto">
            <Card className="p-0 overflow-hidden">
               <img src={media?.preview} className="w-full h-48 object-cover" />
               <div className="p-5">
                 <div className="flex justify-between items-start mb-4">
                   <h3 className="text-xl font-bold">{aiAnalysis.title}</h3>
                   <Badge variant="error">{aiAnalysis.urgency}</Badge>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4 mb-6">
                   <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                     <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Category</p>
                     <p className="text-sm font-semibold">{aiAnalysis.category}</p>
                   </div>
                   <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                     <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Severity</p>
                     <p className="text-sm font-semibold">{aiAnalysis.severity}/10</p>
                   </div>
                   <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 col-span-2">
                     <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Authority Path</p>
                     <p className="text-sm font-semibold">{aiAnalysis.suggestedDepartment}</p>
                   </div>
                 </div>

                 <div className="flex gap-2 items-start text-xs text-slate-500 mb-6 bg-blue-50 p-3 rounded-xl border border-blue-100">
                   <MapPin size={16} className="text-blue-600 flex-shrink-0" />
                   <div>
                     <p className="font-bold text-blue-900 mb-0.5">Location Detected</p>
                     <p>{location.address}</p>
                   </div>
                 </div>

                 <Button onClick={submitComplaint} className="w-full py-4 text-lg">Confirm & Send Complaint</Button>
               </div>
            </Card>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
              <ShieldAlert size={48} />
            </div>
            <h3 className="text-2xl font-bold mb-2">Complaint Submitted!</h3>
            <p className="text-slate-500 mb-8">Reference ID: #ST-{Date.now().toString().slice(-6)}</p>
            <div className="w-full flex flex-col gap-3">
              <Button onClick={() => navigate('/')} className="w-full">Go to Home</Button>
              <Button variant="outline" onClick={() => navigate('/history')} className="w-full">Track Progress</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
function ComplaintDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [complaint, setComplaint] = useState<Complaint | null>(null);

  useEffect(() => {
    if (!id) return;
    return onSnapshot(doc(db, 'complaints', id), (snapshot) => {
      if (snapshot.exists()) {
        setComplaint({ id: snapshot.id, ...snapshot.data() } as Complaint);
      }
    });
  }, [id]);

  if (!complaint) return <div className="p-8 text-center text-slate-400">Loading details...</div>;

  const steps = [
    { status: 'submitted', label: 'Report Received', desc: 'AI has analyzed and routed your report' },
    { status: 'assigned', label: 'Officer Assigned', desc: 'A dedicated officer is reviewing the case' },
    { status: 'in_progress', label: 'Work in Progress', desc: 'Ground team has been dispatched' },
    { status: 'completed', label: 'Issue Resolved', desc: 'Work completed and verified' },
  ];

  const currentStepIndex = steps.findIndex(s => s.status === complaint.status);
  const isDelayed = complaint.status === 'delayed';

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <header className="fixed top-0 left-0 right-0 p-4 flex items-center gap-4 bg-white/80 backdrop-blur-md z-40 border-b border-slate-100">
        <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-lg font-bold truncate">{complaint.title}</h2>
      </header>

      <div className="pt-20 p-5 flex flex-col gap-6 overflow-y-auto pb-32">
        <Card className="p-0 overflow-hidden">
          <img src={complaint.media.url} className="w-full h-40 object-cover" />
          <div className="p-4 bg-blue-600 text-white flex justify-between items-center">
            <div>
              <p className="text-[10px] uppercase font-black tracking-widest opacity-70">Estimated Completion</p>
              <p className="font-bold text-lg">14 May, 05:00 PM</p>
            </div>
            <div className="text-right">
              <Badge variant="info" className="bg-white/20 text-white border-0">On Track</Badge>
            </div>
          </div>
        </Card>

        <section>
          <h4 className="font-bold mb-6">Resolution Progress</h4>
          <div className="relative pl-8 flex flex-col gap-10">
            {/* Timeline Line */}
            <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-slate-200">
              <motion.div 
                initial={{ height: 0 }}
                animate={{ height: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
                className="w-full bg-blue-600"
              />
            </div>

            {steps.map((step, i) => {
              const isActive = i <= currentStepIndex;
              const isCurrent = i === currentStepIndex;
              
              return (
                <div key={step.status} className="relative">
                  <div className={cn(
                    "absolute -left-8 w-6 h-6 rounded-full flex items-center justify-center transition-colors z-10",
                    isActive ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-400"
                  )}>
                    {isActive ? <div className="w-2 h-2 bg-white rounded-full" /> : <div className="w-2 h-2 bg-slate-400 rounded-full" />}
                  </div>
                  
                  <div className={cn("transition-all", isActive ? "opacity-100" : "opacity-40")}>
                    <h5 className="font-bold text-sm mb-1">{step.label}</h5>
                    <p className="text-xs text-slate-500 leading-normal">{step.desc}</p>
                    {isCurrent && (
                      <div className="mt-3 flex gap-2">
                        <Badge variant="info">Current Status</Badge>
                        <span className="text-[10px] text-slate-400 font-medium">Updated 2h ago</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {isDelayed && (
          <Card className="bg-rose-50 border-rose-100 p-4">
             <div className="flex gap-3 items-start">
               <ShieldAlert className="text-rose-600 flex-shrink-0" size={24} />
               <div>
                  <h4 className="font-bold text-rose-900 text-sm">Case Delayed</h4>
                  <p className="text-xs text-rose-700 mt-1">Resolution is taking longer than expected due to heavy rainfall. You can escalate this case to higher authority.</p>
                  <Button variant="primary" className="bg-rose-600 hover:bg-rose-700 mt-4 py-2 text-xs h-10">Escalate Issue</Button>
               </div>
             </div>
          </Card>
        )}

        <section>
          <h4 className="font-bold mb-4">Authority Details</h4>
          <Card className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-xl">🏢</div>
            <div className="flex-1">
              <h5 className="font-bold text-sm">Bhopal Municipal Corp.</h5>
              <p className="text-xs text-slate-500">Zone 3 Ground Team A-12</p>
            </div>
            <Button variant="outline" className="p-2 h-10 w-10 min-w-0"><Bell size={16} /></Button>
          </Card>
        </section>
      </div>
    </div>
  );
}

function AdminDashboard() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(collection(db, 'complaints'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setComplaints(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Complaint)));
    });
  }, []);

  const stats = [
    { label: 'Pending', count: complaints.filter(c => c.status === 'submitted').length, color: 'bg-amber-500' },
    { label: 'In Progress', count: complaints.filter(c => c.status === 'in_progress').length, color: 'bg-blue-500' },
    { label: 'Resolved', count: complaints.filter(c => c.status === 'completed').length, color: 'bg-emerald-500' },
    { label: 'Delayed', count: complaints.filter(c => c.status === 'delayed').length, color: 'bg-rose-500' },
  ];

  return (
    <div className="p-5 flex flex-col gap-6">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Authority Console</h2>
          <p className="text-slate-500 text-sm">Monitoring city-wide grievances</p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4">
        {stats.map(s => (
          <Card key={s.label} className="p-4 flex flex-col items-center justify-center">
            <p className="text-2xl font-black mb-1">{s.count}</p>
            <div className="flex items-center gap-1.5">
              <div className={cn("w-2 h-2 rounded-full", s.color)} />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      <section>
        <h4 className="font-bold mb-4">Grievance Heatmap (Mock)</h4>
        <div className="w-full h-48 bg-slate-200 rounded-3xl overflow-hidden relative border-2 border-white shadow-inner">
           <img src="https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=1000" className="w-full h-full object-cover opacity-50 grayscale" />
           <div className="absolute top-1/4 left-1/3 w-8 h-8 bg-rose-500/50 rounded-full blur-xl animate-pulse" />
           <div className="absolute top-1/2 left-1/2 w-12 h-12 bg-amber-500/50 rounded-full blur-xl animate-pulse delay-75" />
           <div className="absolute bottom-1/4 right-1/4 w-10 h-10 bg-rose-500/50 rounded-full blur-xl animate-pulse delay-150" />
           <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Badge variant="error" className="shadow-lg">3 Critical Hotspots Identified</Badge>
           </div>
        </div>
      </section>

      <section>
        <h4 className="font-bold mb-4">Live Queue</h4>
        <div className="flex flex-col gap-3">
          {complaints.map(c => (
            <Card key={c.id} className="flex gap-4 items-center" onClick={() => navigate(`/complaint/${c.id}`)}>
               <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100">
                  <img src={c.media.url} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                   <h5 className="font-bold text-xs truncate">{c.title}</h5>
                   <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(c.createdAt)}</p>
                </div>
                <Badge variant={c.urgency === 'emergency' || c.urgency === 'high' ? 'error' : 'info'}>{c.urgency}</Badge>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function Explore() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(collection(db, 'complaints'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setComplaints(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Complaint)));
    });
  }, []);

  return (
    <div className="p-5 flex flex-col gap-6">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Explore Issues</h2>
          <p className="text-slate-500 text-sm">See what's happening in your neighborhood</p>
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5 no-scrollbar">
        {['All', 'Potholes', 'Garbage', 'Water', 'Public Safety'].map(tag => (
          <button key={tag} className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all",
            tag === 'All' ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-white text-slate-500 border-slate-100"
          )}>
            {tag}
          </button>
        ))}
      </div>

      <div className="w-full h-56 bg-slate-200 rounded-3xl overflow-hidden relative shadow-lg">
         <img src="https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&q=80&w=1000" className="w-full h-full object-cover" />
         {complaints.map((c, i) => (
           <motion.div 
            key={c.id}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="absolute p-1 bg-white rounded-full shadow-xl border-2 border-blue-600 cursor-pointer"
            style={{ 
              top: `${20 + (i * 15) % 60}%`, 
              left: `${15 + (i * 20) % 70}%` 
            }}
            onClick={() => navigate(`/complaint/${c.id}`)}
          >
            <div className="w-8 h-8 rounded-full overflow-hidden">
              <img src={c.media.url} className="w-full h-full object-cover" />
            </div>
           </motion.div>
         ))}
         <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-sm p-3 rounded-2xl flex items-center justify-between border border-white/20">
            <p className="text-[10px] font-bold text-slate-900 uppercase">Viewing 1.2km radius</p>
            <button className="text-blue-600 text-[10px] font-black uppercase">Refresh Map</button>
         </div>
      </div>

      <div className="flex flex-col gap-4">
        <h4 className="font-bold">Trending Issues</h4>
        {complaints.map(c => (
          <Card key={c.id} className="flex flex-col gap-4">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-lg">👤</div>
               <div className="flex-1">
                 <h5 className="font-bold text-sm">Citizen #...{c.citizenId.slice(-4)}</h5>
                 <p className="text-[10px] text-slate-400">{formatDate(c.createdAt)} • {c.location.address.split(',')[0]}</p>
               </div>
               <Badge variant="info">Upvoted by 12</Badge>
             </div>
             <p className="text-sm font-semibold">{c.title}</p>
             <div className="w-full h-40 bg-slate-100 rounded-2xl overflow-hidden">
                <img src={c.media.url} className="w-full h-full object-cover" />
             </div>
             <div className="flex gap-2">
                <button className="flex-1 py-2 bg-slate-50 text-slate-600 rounded-xl text-xs font-bold border border-slate-100">Upvote</button>
                <button className="flex-1 py-2 bg-slate-50 text-slate-600 rounded-xl text-xs font-bold border border-slate-100">Comment</button>
                <button className="p-2 bg-slate-50 text-slate-600 rounded-xl border border-slate-100"><Bell size={16} /></button>
             </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function HistoryPage() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'complaints'), where('citizenId', '==', user.uid), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setComplaints(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Complaint)));
    });
  }, [user]);

  return (
    <div className="p-5 flex flex-col gap-6">
      <header>
        <h2 className="text-2xl font-bold tracking-tight">Your Activity</h2>
        <p className="text-slate-500 text-sm">Tracking {complaints.length} reports</p>
      </header>

      <div className="flex flex-col gap-4">
        {complaints.length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">
             <History size={48} className="mx-auto mb-4 opacity-20" />
             <p className="font-bold">No reports yet</p>
             <p className="text-xs mt-1">Issues you report will appear here for tracking.</p>
          </div>
        ) : (
          complaints.map(c => (
            <Card key={c.id} className="flex gap-4 p-4 items-center" onClick={() => navigate(`/complaint/${c.id}`)}>
               <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 flex-shrink-0">
                  <img src={c.media.url} className="w-full h-full object-cover" />
               </div>
               <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h5 className="font-bold text-sm truncate">{c.title}</h5>
                    <Badge variant={c.status === 'completed' ? 'success' : 'info'}>{c.status}</Badge>
                  </div>
                  <p className="text-[10px] text-slate-400 mb-2 uppercase font-black tracking-widest">{formatDate(c.createdAt)}</p>
                  <p className="text-xs text-blue-600 font-bold">Track Resolution →</p>
               </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function Profile() {
  const { user, logout } = useAuth();
  
  return (
    <div className="p-5 flex flex-col gap-8">
      <header className="flex flex-col items-center gap-4 mt-8">
        <div className="relative">
          <div className="w-24 h-24 rounded-full border-4 border-white shadow-xl overflow-hidden bg-blue-100 flex items-center justify-center text-3xl">
            {user?.photoURL ? <img src={user.photoURL} /> : "👤"}
          </div>
          <div className="absolute bottom-0 right-0 bg-blue-600 text-white p-1.5 rounded-full border-4 border-white">
            <PlusCircle size={16} />
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold">{user?.displayName}</h2>
          <Badge variant="info">{user?.role}</Badge>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Reports', value: '12' },
          { label: 'Resolved', value: '08' },
          { label: 'Karma', value: '450' },
        ].map(s => (
          <div key={s.label} className="bg-white p-4 rounded-2xl text-center shadow-sm border border-slate-50">
            <p className="text-xl font-black text-blue-600">{s.value}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <h4 className="px-2 text-[10px] uppercase font-black tracking-widest text-slate-400 mb-2">Account Settings</h4>
        {[
          { label: 'Verify Aadhaar', icon: ShieldAlert, color: 'text-rose-600' },
          { label: 'Notification Prefs', icon: Bell, color: 'text-blue-600' },
          { label: 'Language: English', icon: Search, color: 'text-slate-600' },
          { label: 'Help & Support', icon: History, color: 'text-slate-600' },
        ].map(item => (
          <button key={item.label} className="bg-white p-4 rounded-2xl flex justify-between items-center active:bg-slate-50 transition-colors border border-slate-50">
            <div className="flex items-center gap-4">
              <div className={cn("p-2 rounded-xl bg-slate-50", item.color)}>
                <item.icon size={18} />
              </div>
              <span className="font-semibold text-sm">{item.label}</span>
            </div>
            <ChevronRight size={16} className="text-slate-300" />
          </button>
        ))}
      </div>

      <Button variant="outline" onClick={logout} className="text-rose-600 border-rose-100 hover:bg-rose-50">Log Out</Button>
      
      <p className="text-center text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em] mt-8">Sentira AI v1.0.4 • Beta</p>
    </div>
  );
}
