
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
  type Unsubscribe,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import {
  firebaseAuth,
  firebaseEnabled,
  firestore,
} from "../firebase";

import type { GuruMateData } from "./storage";

const DATA_COLLECTION = "gurumateData";
const DOCUMENT_ID = "main";

function requireFirebase() {
  if (!firebaseEnabled || !firebaseAuth || !firestore) {
    throw new Error(
      "Firebase belum dikonfigurasi. Periksa pengaturan VITE_FIREBASE di file .env.",
    );
  }

  return { auth: firebaseAuth, database: firestore };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidData(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function sanitizeRemoteData(raw: unknown): GuruMateData | null {
  if (!isValidData(raw)) return null;

  return {
    schedules: toArray<GuruMateData["schedules"][number]>(raw.schedules),
    reminders: toArray<GuruMateData["reminders"][number]>(raw.reminders),
    exams: toArray<GuruMateData["exams"][number]>(raw.exams),
    students: toArray<GuruMateData["students"][number]>(raw.students),
    grades: toArray<GuruMateData["grades"][number]>(raw.grades),
    attendance: toArray<GuruMateData["attendance"][number]>(raw.attendance),
    activities: toArray<GuruMateData["activities"][number]>(raw.activities),
  };
}

export function isCloudAvailable(): boolean {
  return (
    firebaseEnabled &&
    firebaseAuth !== null &&
    firestore !== null
  );
}

export function observeAuthState(
  callback: (user: User | null) => void,
): Unsubscribe {
  const { auth } = requireFirebase();
  return onAuthStateChanged(auth, callback);
}

export function getCurrentTeacher(): User | null {
  return firebaseAuth?.currentUser ?? null;
}

export async function registerTeacher(
  name: string,
  email: string,
  password: string,
): Promise<User> {
  const { auth } = requireFirebase();
  const cleanName = name.trim();
  const cleanEmail = normalizeEmail(email);

  if (cleanName.length < 2) {
    throw new Error("Nama lengkap minimal 2 karakter.");
  }

  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("Masukkan alamat email yang valid.");
  }

  if (password.length < 6) {
    throw new Error("Kata sandi minimal 6 karakter.");
  }

  const credential = await createUserWithEmailAndPassword(
    auth,
    cleanEmail,
    password,
  );

  await updateProfile(credential.user, {
    displayName: cleanName,
  });

  return credential.user;
}

export async function loginTeacher(
  email: string,
  password: string,
): Promise<User> {
  const { auth } = requireFirebase();

  if (!normalizeEmail(email) || !password) {
    throw new Error("Email dan kata sandi wajib diisi.");
  }

  const credential = await signInWithEmailAndPassword(
    auth,
    normalizeEmail(email),
    password,
  );

  return credential.user;
}

export async function logoutTeacher(): Promise<void> {
  const { auth } = requireFirebase();
  await signOut(auth);
}

function getDataReference(uid: string) {
  const { database } = requireFirebase();

  return doc(
    database,
    "users",
    uid,
    DATA_COLLECTION,
    DOCUMENT_ID,
  );
}

export async function loadCloudData(): Promise<GuruMateData | null> {
  const user = getCurrentTeacher();

  if (!user || !isCloudAvailable()) {
    return null;
  }

  try {
    const snapshot = await getDoc(getDataReference(user.uid));

    if (!snapshot.exists()) {
      return null;
    }

    return sanitizeRemoteData(snapshot.data());
  } catch (error: unknown) {
    console.warn("GuruMate: gagal memuat data cloud.", error);
    throw error;
  }
}

export async function saveCloudData(
  data: GuruMateData,
): Promise<boolean> {
  const user = getCurrentTeacher();

  if (!user || !isCloudAvailable()) {
    return false;
  }

  try {
    await setDoc(
      getDataReference(user.uid),
      {
        schedules: data.schedules,
        reminders: data.reminders,
        exams: data.exams,
        students: data.students,
        grades: data.grades,
        attendance: data.attendance,
        activities: data.activities,
        ownerUid: user.uid,
        ownerEmail: user.email ?? "",
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    return true;
  } catch (error: unknown) {
    console.warn("GuruMate: gagal menyimpan data cloud.", error);
    return false;
  }
}

export async function syncCloudData(
  localData: GuruMateData,
  onRemoteData: (data: GuruMateData) => void,
): Promise<boolean> {
  const user = getCurrentTeacher();

  if (!user || !isCloudAvailable()) {
    return false;
  }

  try {
    const remoteData = await loadCloudData();

    if (remoteData) {
      onRemoteData(remoteData);
      return true;
    }

    return await saveCloudData(localData);
  } catch (error: unknown) {
    console.warn("GuruMate: sinkronisasi cloud gagal.", error);
    return false;
  }
}
