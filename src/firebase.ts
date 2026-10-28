
import {
  getApps,
  initializeApp,
  type FirebaseApp,
  type FirebaseOptions,
} from "firebase/app";
import {
  getAuth,
  type Auth,
} from "firebase/auth";
import {
  getFirestore,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const requiredConfig: Array<keyof FirebaseOptions> = [
  "apiKey",
  "authDomain",
  "projectId",
  "appId",
];

export const firebaseEnabled = requiredConfig.every((key) => {
  const value = firebaseConfig[key];
  return typeof value === "string" && value.trim().length > 0;
});

function getOrCreateApp(name: string): FirebaseApp | null {
  if (!firebaseEnabled) {
    return null;
  }

  const existingApp = getApps().find((app) => app.name === name);

  if (existingApp) {
    return existingApp;
  }

  return name === "[DEFAULT]"
    ? initializeApp(firebaseConfig)
    : initializeApp(firebaseConfig, name);
}

export const firebaseApp = getOrCreateApp("[DEFAULT]");

export const firebaseAuth: Auth | null = firebaseApp
  ? getAuth(firebaseApp)
  : null;

export const firestore: Firestore | null = firebaseApp
  ? getFirestore(firebaseApp)
  : null;

// Koneksi Firebase terpisah untuk area admin.
export const adminApp = getOrCreateApp("GuruMateAdmin");

export const adminAuth: Auth | null = adminApp
  ? getAuth(adminApp)
  : null;

export const adminFirestore: Firestore | null = adminApp
  ? getFirestore(adminApp)
  : null;
