import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app, `gs://${firebaseConfig.storageBucket}`);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

export async function signInWithGoogle() {
  // Use redirect for production (Vercel), popup for localhost
  const isLocalhost = window.location.hostname === 'localhost';
  if (isLocalhost) {
    return signInWithPopup(auth, googleProvider);
  } else {
    return signInWithRedirect(auth, googleProvider);
  }
}

export { getRedirectResult };

export async function logout() {
  return signOut(auth);
}
