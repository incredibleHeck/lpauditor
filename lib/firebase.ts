import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDummyKeyForBuildVerification12345",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "lpauditor-app.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "lpauditor-app",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "lpauditor-app.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "100000000000",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:100000000000:web:abcdef123456",
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

function initAuth(): Auth {
  try {
    return getAuth(app);
  } catch {
    return {} as Auth;
  }
}

function initDb(): Firestore {
  try {
    return getFirestore(app);
  } catch {
    return {} as Firestore;
  }
}

function initStorage(): FirebaseStorage {
  try {
    return getStorage(app);
  } catch {
    return {} as FirebaseStorage;
  }
}

export const auth = initAuth();
export const db = initDb();
export const storage = initStorage();
export default app;
