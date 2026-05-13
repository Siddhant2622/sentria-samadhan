import { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  auth, googleProvider, isConfigured, isCapacitor,
  signInWithPopup, signInWithRedirect,
  signInWithCredential, GoogleAuthProvider,
  signOut, RecaptchaVerifier, signInWithPhoneNumber, onAuthStateChanged,
} from './firebase';
import { updateProfile } from 'firebase/auth';

const AuthContext = createContext();
import { API_BASE } from './config';

async function syncUserWithBackend(firebaseUser) {
  const idToken = await firebaseUser.getIdToken();
  const response = await fetch(`${API_BASE}/api/auth/firebase-login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      uid: firebaseUser.uid,
      name: firebaseUser.displayName || 'Citizen',
      email: firebaseUser.email || '',
      phone: firebaseUser.phoneNumber || '',
      profileImage: firebaseUser.photoURL || '',
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Backend sync failed');
  return { dbUser: data.user, idToken };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [idToken, setIdToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const recaptchaRef = useRef(null);
  const confirmationRef = useRef(null);

  useEffect(() => {
    // Restore demo/quick login from localStorage
    const stored = localStorage.getItem('sentria_user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch (_) {}
    }

    if (!isConfigured || !auth) {
      setLoading(false);
      return;
    }

    // Removed getRedirectResult since we exclusively use signInWithPopup now

    // Listen for ongoing auth state
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const { dbUser, idToken: token } = await syncUserWithBackend(fbUser);
          setFirebaseUser(fbUser);
          setUser(dbUser);
          setIdToken(token);
        } catch (e) {
          console.error('Backend sync error:', e);
        }
      } else {
        const stored = localStorage.getItem('sentria_user');
        if (!stored) {
          setFirebaseUser(null);
          setUser(null);
          setIdToken(null);
        }
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // ── Google Sign-In ──────────────────────────────────────────
  const loginWithGoogle = async () => {
    if (!isConfigured || !auth) {
      return { success: false, error: 'Firebase not configured.' };
    }
    try {
      setError('');

      if (isCapacitor) {
        // Try native plugin first, fall back to redirect
        try {
          const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
          const nativeResult = await FirebaseAuthentication.signInWithGoogle();
          
          if (nativeResult.credential?.idToken) {
            const credential = GoogleAuthProvider.credential(nativeResult.credential.idToken);
            const result = await signInWithCredential(auth, credential);
            try {
              const { dbUser, idToken: token } = await syncUserWithBackend(result.user);
              if (dbUser.is_banned) {
                await signOut(auth);
                return { success: false, error: `Account banned: ${dbUser.ban_reason || 'Contact support.'}` };
              }
              setUser(dbUser);
              setIdToken(token);
              return { success: true, user: dbUser };
            } catch (syncError) {
              // If backend sync fails (e.g. Fetch Error), do NOT fallback to web popup
              return { success: false, error: `Backend Connection Error: ${syncError.message}` };
            }
          } else {
            throw new Error("Native login missing ID token");
          }
        } catch (nativeErr) {
          console.warn('Native plugin failed, using popup:', nativeErr.message);
          // Fall back to popup (redirect fails with auth/argument-error on capacitor://)
          const result = await signInWithPopup(auth, googleProvider);
          const { dbUser, idToken: token } = await syncUserWithBackend(result.user);
          if (dbUser.is_banned) {
            await signOut(auth);
            return { success: false, error: `Account banned: ${dbUser.ban_reason || 'Contact support.'}` };
          }
          setUser(dbUser);
          setIdToken(token);
          return { success: true, user: dbUser };
        }
      } else {
        const result = await signInWithPopup(auth, googleProvider);
        const { dbUser, idToken: token } = await syncUserWithBackend(result.user);
        if (dbUser.is_banned) {
          await signOut(auth);
          return { success: false, error: `Account banned: ${dbUser.ban_reason}` };
        }
        setUser(dbUser);
        setIdToken(token);
        return { success: true, user: dbUser };
      }
    } catch (e) {
      const msg = e.code === 'auth/popup-closed-by-user'
        ? 'Sign-in cancelled.'
        : e.message || 'Google sign-in failed.';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  // ── Phone OTP – Step 1: Send ───────────────────────────────
  const sendOtp = async (phoneNumber, recaptchaContainerId) => {
    if (!isConfigured || !auth) {
      return { success: false, error: 'Firebase not configured.' };
    }
    try {
      setError('');
      if (recaptchaRef.current) {
        try { recaptchaRef.current.clear(); } catch (_) {}
        recaptchaRef.current = null;
      }
      const verifier = new RecaptchaVerifier(auth, recaptchaContainerId, { size: 'invisible' });
      recaptchaRef.current = verifier;
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, verifier);
      confirmationRef.current = confirmation;
      return { success: true };
    } catch (e) {
      console.error('Firebase SMS Error:', e);
      
      // ── AUTO-BYPASS FOR BILLING/QUOTA ISSUES ──
      if (e.code === 'auth/billing-not-enabled' || e.code === 'auth/quota-exceeded' || e.code === 'auth/operation-not-allowed') {
        console.warn('⚠️ Firebase SMS restricted. Switching to Mock OTP mode for demo.');
        localStorage.setItem('sentria_phone_attempt', phoneNumber.replace('+91', ''));
        return { success: true, isMock: true }; 
      }

      let msg = e.message || 'Failed to send OTP.';
      if (e.code === 'auth/unauthorized-domain') {
        msg = 'Domain not authorized. Add your current URL to Firebase Console > Authentication > Settings > Authorized Domains.';
      }
      setError(msg);
      return { success: false, error: msg };
    }
  };

  // ── Phone OTP – Step 2: Verify ─────────────────────────────
  const verifyOtp = async (otpCode) => {
    // ── MASTER OTP BYPASS (For Hackathon/Demo) ──
    if (otpCode === '123456') {
      try {
        // Create a mock Firebase user structure
        const mockFbUser = {
          uid: 'demo-otp-user-' + Date.now(),
          phoneNumber: '+91' + (localStorage.getItem('sentira_phone_attempt') || '9942523385'),
          displayName: 'Citizen',
          getIdToken: async () => 'mock-id-token'
        };
        
        setFirebaseUser(mockFbUser);
        const { dbUser, idToken: token } = await syncUserWithBackend(mockFbUser);
        setUser(dbUser);
        setIdToken(token);
        localStorage.setItem('sentria_user', JSON.stringify(dbUser));
        
        return { success: true, needsName: true };
      } catch (e) {
        return { success: false, error: 'Demo bypass failed: ' + e.message };
      }
    }

    if (!confirmationRef.current) {
      return { success: false, error: 'OTP session expired. Please request again.' };
    }
    try {
      setError('');
      const result = await confirmationRef.current.confirm(otpCode);
      const fbUser = result.user;
      setFirebaseUser(fbUser);

      // Sync with backend
      const { dbUser, idToken: token } = await syncUserWithBackend(fbUser);
      if (dbUser.is_banned) {
        await signOut(auth);
        return { success: false, error: `Account banned: ${dbUser.ban_reason}` };
      }
      setUser(dbUser);
      setIdToken(token);
      localStorage.setItem('sentria_user', JSON.stringify(dbUser));

      // Check if user needs to enter their name
      const hasName = fbUser.displayName && fbUser.displayName !== 'Citizen' && fbUser.displayName.trim().length > 0;
      const dbHasName = dbUser.name && dbUser.name !== 'Citizen' && dbUser.name.trim().length > 0;

      return { success: true, needsName: !hasName && !dbHasName };
    } catch (e) {
      const msg = e.code === 'auth/invalid-verification-code'
        ? 'Invalid OTP. Please try again.'
        : e.message || 'OTP verification failed.';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  // ── Update User Name (after phone OTP) ─────────────────────
  const updateUserName = async (newName) => {
    try {
      setError('');

      // Update Firebase Auth profile
      if (firebaseUser) {
        await updateProfile(firebaseUser, { displayName: newName });
      }

      let updatedUser;
      // Sync updated name with backend
      if (firebaseUser) {
        const idToken = await firebaseUser.getIdToken();
        const response = await fetch(`${API_BASE}/api/auth/firebase-login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            uid: firebaseUser.uid,
            name: newName,
            email: firebaseUser.email || '',
            phone: firebaseUser.phoneNumber || '',
            profileImage: firebaseUser.photoURL || '',
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to update name');
        updatedUser = data.user;
        setUser(updatedUser);
        localStorage.setItem('sentria_user', JSON.stringify(updatedUser));
      } else {
        // For demo/localStorage users
        updatedUser = { ...user, name: newName };
        setUser(updatedUser);
        localStorage.setItem('sentria_user', JSON.stringify(updatedUser));
      }

      return { success: true, user: updatedUser };
    } catch (e) {
      setError(e.message);
      return { success: false, error: e.message };
    }
  };

  // ── Update User District ─────────────────────────────────────
  const updateUserDistrict = async (newDistrict) => {
    try {
      setError('');
      if (user && user.id && !user.id.startsWith('demo-user')) {
        const response = await fetch(`${API_BASE}/api/users/${user.id}/district`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ district: newDistrict }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to update district');
        setUser(data.user);
        localStorage.setItem('sentria_user', JSON.stringify(data.user));
        return { success: true, user: data.user };
      } else {
        const updatedUser = { ...user, district: newDistrict };
        setUser(updatedUser);
        localStorage.setItem('sentria_user', JSON.stringify(updatedUser));
        return { success: true, user: updatedUser };
      }
    } catch (e) {
      setError(e.message);
      return { success: false, error: e.message };
    }
  };

  // ── Quick / Demo Login ─────────────────────────────────────
  const demoLogin = async (name = 'Demo Citizen') => {
    try {
      setError('');
      const response = await fetch(`${API_BASE}/api/auth/demo-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed');
      setUser(data.user);
      setIdToken(data.token);
      localStorage.setItem('sentria_user', JSON.stringify(data.user));
      return { success: true, user: data.user };
    } catch (e) {
      setError(e.message);
      return { success: false, error: e.message };
    }
  };

  // ── Logout ─────────────────────────────────────────────────
  const logout = async () => {
    if (isConfigured && auth) {
      try { await signOut(auth); } catch (_) {}
    }
    if (isCapacitor) {
      try {
        const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
        await FirebaseAuthentication.signOut();
      } catch (_) {}
    }
    setUser(null);
    setFirebaseUser(null);
    setIdToken(null);
    localStorage.removeItem('sentria_user');
  };

  return (
    <AuthContext.Provider value={{
      user, firebaseUser, idToken, loading, error,
      isFirebaseConfigured: isConfigured,
      loginWithGoogle, sendOtp, verifyOtp, updateUserName, updateUserDistrict, demoLogin, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
