import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, Phone, User, ArrowRight, Loader2,
  AlertTriangle, ShieldCheck, ChevronRight, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../lib/AuthContext';

export default function Login() {
  const [view, setView] = useState('home'); // home | quick | phone | otp | name
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { loginWithGoogle, sendOtp, verifyOtp, demoLogin, updateUserName, isFirebaseConfigured } = useAuth();
  const navigate = useNavigate();

  const go = (path) => navigate(path);
  const goByRole = (user) => {
    if (user?.role === 'SuperAdmin') navigate('/superadmin');
    else if (user?.role === 'Admin') navigate('/admin');
    else if (user?.role === 'Officer') navigate('/officer');
    else navigate('/dashboard');
  };

  // ── Quick Name Login ─────────────────────────────────────────
  const handleQuickLogin = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError('Please enter your name.');
    setLoading(true); setError('');
    try {
      const result = await demoLogin(name.trim());
      if (result.success) goByRole(result.user);
      else setError(result.error);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  // ── Google Login (web only) ──────────────────────────────────
  const handleGoogleLogin = async () => {
    setLoading(true); setError('');
    const result = await loginWithGoogle();
    setLoading(false);
    if (result?.redirecting) return; // Capacitor redirect in progress
    if (result?.success) goByRole(result.user);
    else setError(result?.error || 'Google sign-in failed.');
  };

  // ── Phone OTP ────────────────────────────────────────────────
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (phone.trim().length !== 10) return setError('Enter a valid 10-digit mobile number.');
    setLoading(true); setError('');
    const result = await sendOtp(`+91${phone.trim()}`, 'recaptcha-container');
    setLoading(false);
    if (result.success) {
      localStorage.setItem('sentira_phone_attempt', phone.trim());
      if (result.isMock) {
        setError('Firebase billing is not enabled. Using Mock OTP mode for demo. Use code 123456.');
      }
      setView('otp');
    } else setError(result.error);
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otp.length < 6) return setError('Enter the 6-digit OTP.');
    setLoading(true); setError('');
    const result = await verifyOtp(otp);
    setLoading(false);
    if (result.success) {
      // If user has no display name (phone login), ask for name
      if (result.needsName) {
        setView('name');
      } else {
        goByRole(result.user);
      }
    } else {
      setError(result.error);
    }
  };

  // ── Name Entry (after phone OTP) ─────────────────────────────
  const handleNameSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError('Please enter your name.');
    setLoading(true); setError('');
    try {
      const result = await updateUserName(name.trim());
      if (result.success) goByRole(result.user);
      else setError(result.error);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-6 relative overflow-hidden ink-wash">
      {/* Recaptcha (invisible) */}
      <div id="recaptcha-container" />

      {/* Dancheong accent line at top */}
      <div className="absolute top-0 left-0 right-0 dancheong-line" />

      {/* Subtle ink-wash orbs */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-primary/[0.06] rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-accent/[0.06] rounded-full blur-[120px] translate-y-1/2 -translate-x-1/3 pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-primary to-teal rounded-[22px] mx-auto mb-4 flex items-center justify-center shadow-[0_8px_40px_rgba(91,123,111,0.25)]">
            <Sparkles size={36} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-textMain font-serif tracking-tight mb-1">
            Sentria Samadhan
          </h1>
          <p className="text-textMuted text-sm">Smart Citizen Grievance Ecosystem</p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-surface/90 backdrop-blur-xl border border-black/[0.06] rounded-[2rem] p-6 shadow-card"
        >
          {/* Error banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="bg-danger/10 border border-danger/20 text-danger text-sm p-3 rounded-xl mb-4 flex items-start gap-2"
              >
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span className="flex-1 text-xs">{error}</span>
                <button onClick={() => setError('')}><X size={14} /></button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">

            {/* ── HOME ── */}
            {view === 'home' && (
              <motion.div key="home" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} className="space-y-3">

                {/* Phone OTP - PRIMARY CTA */}
                <button
                  onClick={() => { setView('phone'); setError(''); }}
                  className="w-full bg-gradient-to-r from-primary to-teal text-white font-bold p-4 rounded-2xl flex items-center justify-between gap-3 hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-primary/15"
                >
                  <div className="flex items-center gap-3">
                    <Phone size={20} />
                    <div className="text-left">
                      <div className="text-sm font-bold">Sign In with Mobile</div>
                      <div className="text-xs opacity-80">Verify via OTP — real authentication</div>
                    </div>
                  </div>
                  <ChevronRight size={18} className="opacity-70" />
                </button>

                <div className="flex items-center gap-3 text-textMuted text-xs font-medium uppercase">
                  <div className="flex-1 h-px bg-black/[0.08]" /> Other options <div className="flex-1 h-px bg-black/[0.08]" />
                </div>

                {/* Google */}
                <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full bg-surface text-gray-900 font-semibold p-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-surfaceLight transition-all active:scale-95 disabled:opacity-60 shadow-soft border border-black/[0.06]"
                >
                  {loading
                    ? <Loader2 size={20} className="animate-spin text-gray-500" />
                    : <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.2l6.8-6.8C35.7 2.3 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.1C12.3 13 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.6H24v8.7h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.1z"/><path fill="#FBBC05" d="M10.5 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6l-7.9-6.1A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2 1.4-4.6 2.2-7.7 2.2-6.3 0-11.7-4.3-13.6-10.1l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>
                  }
                  Continue with Google
                </button>

                <div className="pt-2 text-center">
                  <p className="text-[10px] text-textMuted leading-relaxed">
                    By signing in, you agree to our Terms of Service and Privacy Policy. Your data is encrypted and handled by state authority.
                  </p>
                </div>
              </motion.div>
            )}



            {/* ── PHONE ── */}
            {view === 'phone' && (
              <motion.div key="phone" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
                <button onClick={() => { setView('home'); setError(''); }} className="text-xs text-textMuted mb-4 hover:text-textMain flex items-center gap-1 transition-colors">← Back</button>
                <h2 className="font-bold text-lg mb-1">Enter Mobile Number</h2>
                <p className="text-textMuted text-sm mb-5">We'll send a one-time password via SMS.</p>
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div className="flex items-center bg-surfaceLight border border-black/[0.06] rounded-2xl focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                    <span className="pl-4 pr-2 text-textMuted font-semibold text-sm">+91</span>
                    <input
                      type="tel" inputMode="numeric" autoFocus maxLength={10}
                      value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="98765 43210"
                      className="flex-1 bg-transparent p-3.5 outline-none font-medium tracking-wider"
                    />
                  </div>
                  <button type="submit" disabled={loading || phone.length !== 10}
                    className="w-full bg-primary hover:bg-primaryHover text-white font-bold p-4 rounded-2xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <>Send OTP <ArrowRight size={18} /></>}
                  </button>
                </form>
              </motion.div>
            )}

            {/* ── OTP ── */}
            {view === 'otp' && (
              <motion.div key="otp" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
                <button onClick={() => { setView('phone'); setError(''); setOtp(''); }} className="text-xs text-textMuted mb-4 hover:text-textMain flex items-center gap-1 transition-colors">← Back</button>
                <h2 className="font-bold text-lg mb-1">Verify OTP</h2>
                <p className="text-textMuted text-sm mb-5">Sent to <strong className="text-textMain">+91 {phone}</strong></p>
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <input
                    type="number" autoFocus
                    value={otp} onChange={(e) => setOtp(e.target.value.slice(0, 6))}
                    placeholder="· · · · · ·"
                    className="w-full bg-surfaceLight border border-black/[0.06] rounded-2xl p-5 outline-none font-black text-center text-2xl tracking-[0.5em] focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                  />
                  <button type="submit" disabled={loading || otp.length < 6}
                    className="w-full bg-primary hover:bg-primaryHover text-white font-bold p-4 rounded-2xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="animate-spin" size={20} /> : 'Verify & Sign In'}
                  </button>
                </form>
                <p className="text-center text-xs text-textMuted mt-4">
                  Didn't receive OTP?{' '}
                  <button onClick={() => { setView('phone'); setOtp(''); setError(''); }} className="text-primary font-medium">Resend</button>
                </p>
              </motion.div>
            )}

            {/* ── NAME ENTRY (after phone OTP) ── */}
            {view === 'name' && (
              <motion.div key="name" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <ShieldCheck size={16} className="text-primary" />
                  </div>
                  <span className="text-xs text-primary font-bold">Phone verified ✓</span>
                </div>
                <h2 className="font-bold text-xl mb-1 font-serif">What's your name?</h2>
                <p className="text-textMuted text-sm mb-5">Help us personalize your experience. This will be visible on your complaints.</p>
                <form onSubmit={handleNameSubmit} className="space-y-4">
                  <input
                    type="text" autoFocus
                    value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Aarav Sharma"
                    className="w-full bg-surfaceLight border border-black/[0.06] rounded-2xl p-4 outline-none font-medium focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all text-lg"
                  />
                  <button type="submit" disabled={loading || !name.trim()}
                    className="w-full bg-gradient-to-r from-primary to-teal text-white font-bold p-4 rounded-2xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/15">
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <>Continue to Dashboard <ArrowRight size={18} /></>}
                  </button>
                </form>
              </motion.div>
            )}

          </AnimatePresence>
        </motion.div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-textMuted">
          <ShieldCheck size={14} className="text-primary" />
          Sentria Samadhan — Powered by Smart Technology
        </div>
      </div>
    </div>
  );
}
