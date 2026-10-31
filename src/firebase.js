import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'store-generator-c9b66.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'store-generator-c9b66',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
};

const requiredConfig = ['apiKey', 'authDomain', 'projectId', 'appId'];

export function ensureFirebaseConfigured() {
  const missing = requiredConfig.filter((key) => !firebaseConfig[key]);
  if (missing.length) {
    const variables = missing.map((key) => `VITE_FIREBASE_${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`);
    throw new Error(`Firebase is not configured. Add ${variables.join(', ')} to your .env file.`);
  }
}

export function getFirebaseApp() {
  ensureFirebaseConfigured();
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}
