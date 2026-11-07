import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
  signOut,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const isConfigured = Object.values(firebaseConfig).every(Boolean);

// Reliable Capacitor detection (works on v3, v4, v5, v6)
const isCapacitor = typeof window !== 'undefined' && (
  !!(window?.Capacitor?.isNativePlatform?.()) ||
  !!(window?.Capacitor?.isNative) ||
  window?.location?.protocol === 'capacitor:'
);

let app, auth, googleProvider;

if (isConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);

  googleProvider = new GoogleAuthProvider();
  googleProvider.addScope('email');
  googleProvider.addScope('profile');
  googleProvider.setCustomParameters({ prompt: 'select_account' });
} else {
  console.warn('⚠️  Firebase not configured. Add VITE_FIREBASE_* keys to frontend/.env');
}

export {
  auth, googleProvider, isConfigured, isCapacitor,
  signInWithPopup, signInWithRedirect,
  signInWithCredential, GoogleAuthProvider,
  signOut, RecaptchaVerifier, signInWithPhoneNumber, onAuthStateChanged,
};
