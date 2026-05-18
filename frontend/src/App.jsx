import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import { useAuth } from './lib/AuthContext';

const lazyRetry = (componentImport) =>
  lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem('page-has-been-force-refreshed') || 'false'
    );
    try {
      const component = await componentImport();
      window.sessionStorage.setItem('page-has-been-force-refreshed', 'false');
      return component;
    } catch (error) {
      if (!pageHasAlreadyBeenForceRefreshed) {
        window.sessionStorage.setItem('page-has-been-force-refreshed', 'true');
        window.location.reload();
        return new Promise(() => {}); // Wait for reload
      }
      throw error;
    }
  });

const Dashboard = lazyRetry(() => import('./pages/Dashboard'));
const ReportIssue = lazyRetry(() => import('./pages/ReportIssue'));
const LiveTracking = lazyRetry(() => import('./pages/LiveTracking'));
const AdminDashboard = lazyRetry(() => import('./pages/AdminDashboard'));
const LocalAuthorityDashboard = lazyRetry(() => import('./pages/LocalAuthorityDashboard'));
const SuperAdminDashboard = lazyRetry(() => import('./pages/SuperAdminDashboard'));
const MapPage = lazyRetry(() => import('./pages/MapPage'));
const ProfilePage = lazyRetry(() => import('./pages/ProfilePage'));
const Feedback = lazyRetry(() => import('./pages/Feedback'));
const PublicFeed = lazyRetry(() => import('./pages/PublicFeed'));
const Login = lazyRetry(() => import('./pages/Login'));

// Full-screen branded splash shown while checking auth state
function SplashScreen() {
  return (
    <div
      style={{ background: 'linear-gradient(168deg, #F5F0E8 0%, #EDE6DA 100%)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'fixed', inset: 0, zIndex: 9999 }}
    >
      {/* Soft warm orbs – inspired by Korean ink-wash paintings */}
      <div style={{ position: 'absolute', top: 0, right: 0, width: 320, height: 320, background: 'rgba(91,123,111,0.08)', borderRadius: '50%', filter: 'blur(100px)', transform: 'translate(30%, -40%)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: 280, height: 280, background: 'rgba(196,145,123,0.08)', borderRadius: '50%', filter: 'blur(100px)', transform: 'translate(-30%, 40%)' }} />

      {/* Dancheong accent line at top */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #5B7B6F, #7BA8A0, #C4917B, #D4A84B, #C75B5B)', opacity: 0.5 }} />

      {/* Icon – celadon jade inspired */}
      <div style={{
        width: 80, height: 80, borderRadius: 22,
        background: 'linear-gradient(135deg, #5B7B6F, #7BA8A0)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 8px 40px rgba(91,123,111,0.25)',
        marginBottom: 24,
        animation: 'float 3s ease-in-out infinite',
      }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
          <path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>
        </svg>
      </div>

      <h1 style={{
        fontSize: 28, fontWeight: 700, letterSpacing: -0.5, margin: 0,
        fontFamily: "'Noto Serif KR', serif",
        color: '#2D2D2D',
        animation: 'fadeIn 1s ease-out',
      }}>
        Sentria Samadhan
      </h1>
      <p style={{ color: '#8C8C8C', fontSize: 13, marginTop: 8, letterSpacing: 0.5, fontWeight: 400 }}>
        Smart Citizen Grievance Ecosystem
      </p>

      {/* Loading dots – warm terracotta */}
      <div style={{ display: 'flex', gap: 8, marginTop: 40 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: '50%',
            background: i === 1 ? '#C4917B' : '#5B7B6F',
            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>

      <style>{`
        @keyframes fadeIn { 0%{opacity:0;transform:translateY(8px)} 100%{opacity:1;transform:translateY(0)} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
      `}</style>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RootRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'SuperAdmin') return <Navigate to="/superadmin" replace />;
  if (user.role === 'Admin') return <Navigate to="/admin" replace />;
  if (user.role === 'Officer') return <Navigate to="/officer" replace />;
  return <Navigate to="/dashboard" replace />;
}

function AppShell() {
  const location = useLocation();
  const { loading } = useAuth();
  const hideNav = ['/login'].includes(location.pathname);

  // Block EVERYTHING while checking auth — no flash of inner content
  if (loading) return <SplashScreen />;

  return (
    <div className="flex flex-col min-h-screen bg-background text-textMain max-w-md mx-auto relative overflow-hidden shadow-2xl border-x border-black/5">
      <div className={`flex-1 overflow-y-auto no-scrollbar ${!hideNav ? 'pb-20' : ''}`}>
        <Routes>
          <Route path="/login" element={<Suspense fallback={<SplashScreen />}><Login /></Suspense>} />
          <Route path="/" element={<RootRedirect />} />
          <Route path="/dashboard" element={<ProtectedRoute><Suspense fallback={<SplashScreen />}><Dashboard /></Suspense></ProtectedRoute>} />
          <Route path="/report" element={<ProtectedRoute><Suspense fallback={<SplashScreen />}><ReportIssue /></Suspense></ProtectedRoute>} />
          <Route path="/track/:id" element={<ProtectedRoute><Suspense fallback={<SplashScreen />}><LiveTracking /></Suspense></ProtectedRoute>} />
          <Route path="/map" element={<ProtectedRoute><Suspense fallback={<SplashScreen />}><MapPage /></Suspense></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Suspense fallback={<SplashScreen />}><ProfilePage /></Suspense></ProtectedRoute>} />
          <Route path="/feed" element={<ProtectedRoute><Suspense fallback={<SplashScreen />}><PublicFeed /></Suspense></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><Suspense fallback={<SplashScreen />}><AdminDashboard /></Suspense></ProtectedRoute>} />
          <Route path="/officer" element={<ProtectedRoute><Suspense fallback={<SplashScreen />}><LocalAuthorityDashboard /></Suspense></ProtectedRoute>} />
          <Route path="/superadmin" element={<ProtectedRoute><Suspense fallback={<SplashScreen />}><SuperAdminDashboard /></Suspense></ProtectedRoute>} />
          <Route path="/feedback" element={<ProtectedRoute><Suspense fallback={<SplashScreen />}><Feedback /></Suspense></ProtectedRoute>} />
        </Routes>
      </div>
      {!hideNav && <BottomNav />}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default App;
