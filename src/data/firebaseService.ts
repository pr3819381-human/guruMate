
import { signInAnonymously } from "firebase/auth";
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

let authenticationPromise: Promise<string | null> | null = null;

function isValidData(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function sanitizeRemoteData(raw: unknown): GuruMateData | null {
  if (!isValidData(raw)) {
    return null;
  }

  return {
    schedules: toArray<GuruMateData["schedules"][number]>(
      raw.schedules,
    ),
    reminders: toArray<GuruMateData["reminders"][number]>(
      raw.reminders,
    ),
    exams: toArray<GuruMateData["exams"][number]>(
      raw.exams,
    ),
    students: toArray<GuruMateData["students"][number]>(
      raw.students,
    ),
    grades: toArray<GuruMateData["grades"][number]>(
      raw.grades,
    ),
    activities: toArray<GuruMateData["activities"][number]>(
      raw.activities,
    ),
  };
}

export function isCloudAvailable(): boolean {
  return (
    firebaseEnabled &&
    firebaseAuth !== null &&
    firestore !== null
  );
}

async function getUserId(): Promise<string | null> {
  if (!isCloudAvailable() || !firebaseAuth) {
    return null;
  }

  if (firebaseAuth.currentUser) {
    return firebaseAuth.currentUser.uid;
  }

  if (!authenticationPromise) {
    authenticationPromise = signInAnonymously(firebaseAuth)
      .then((credential) => credential.user.uid)
      .catch((error: unknown) => {
        console.warn(
          "GuruMate gagal melakukan autentikasi Firebase:",
          error,
        );

        return null;
      })
      .finally(() => {
        authenticationPromise = null;
      });
  }

  return authenticationPromise;
}

function getDataReference(uid: string) {
  if (!firestore) {
    return null;
  }

  return doc(
    firestore,
    "users",
    uid,
    DATA_COLLECTION,
    DOCUMENT_ID,
  );
}

export async function loadCloudData(): Promise<GuruMateData | null> {
  try {
    const uid = await getUserId();

    if (!uid) {
      return null;
    }

    const reference = getDataReference(uid);

    if (!reference) {
      return null;
    }

    const snapshot = await getDoc(reference);

    if (!snapshot.exists()) {
      return null;
    }

    return sanitizeRemoteData(snapshot.data());
  } catch (error: unknown) {
    console.warn(
      "GuruMate gagal mengambil data dari Firebase:",
      error,
    );

    return null;
  }
}

export async function saveCloudData(
  data: GuruMateData,
): Promise<boolean> {
  try {
    const uid = await getUserId();

    if (!uid) {
      return false;
    }

    const reference = getDataReference(uid);

    if (!reference) {
      return false;
    }

    await setDoc(
      reference,
      {
        schedules: data.schedules,
        reminders: data.reminders,
        exams: data.exams,
        students: data.students,
        grades: data.grades,
        activities: data.activities,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    return true;
  } catch (error: unknown) {
    console.warn(
      "GuruMate gagal menyimpan data ke Firebase:",
      error,
    );

    return false;
  }
}

export async function syncCloudData(
  localData: GuruMateData,
  onRemoteData: (data: GuruMateData) => void,
): Promise<boolean> {
  try {
    const remoteData = await loadCloudData();

    if (remoteData) {
      onRemoteData(remoteData);
      return true;
    }

    return await saveCloudData(localData);
  } catch (error: unknown) {
    console.warn(
      "GuruMate gagal menyinkronkan data:",
      error,
    );

    return false;
  }
}