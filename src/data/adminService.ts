import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";

import {
  adminAuth,
  adminFirestore,
  firebaseAuth,
  firestore,
} from "../firebase";

export type AdminActivity = {
  id?: string;
  action: string;
  category: string;
  description: string;
  userEmail: string;
  userId?: string | null;
  createdAt?: Timestamp | Date | string | null;
};

// Sesuai dengan nama collection yang sudah kamu buat di Firestore.
const ADMIN_COLLECTION = "adminuser";
const ACTIVITY_COLLECTION = "adminActivities";
const MAX_ACTIVITY_RESULTS = 250;

function safeText(value: unknown, maxLength: number): string {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

/**
 * Memeriksa hak akses admin berdasarkan UID.
 *
 * Dokumen yang diperiksa:
 * adminuser/{uid}
 *
 * Field wajib:
 * role: "admin"
 * active: true
 */
export async function isAdminUser(
  uid: string | null | undefined,
): Promise<boolean> {
  if (!uid || !adminFirestore) {
    return false;
  }

  try {
    const roleRef = doc(adminFirestore, ADMIN_COLLECTION, uid);
    const roleSnapshot = await getDoc(roleRef);

    if (!roleSnapshot.exists()) {
      return false;
    }

    const roleData = roleSnapshot.data();

    return (
      roleData.role === "admin" &&
      roleData.active === true
    );
  } catch (error: unknown) {
    console.error(
      "GuruMate: gagal memverifikasi akses admin.",
      error,
    );

    return false;
  }
}

/**
 * Email tidak digunakan untuk menentukan hak akses admin.
 * Hak akses hanya diberikan melalui UID yang terdaftar.
 */
export function isAdminEmail(
  _email: string | null | undefined,
): boolean {
  return false;
}

/**
 * Mencatat aktivitas pengguna yang sedang login.
 */
export async function recordGuruMateActivity(
  action: string,
  category = "Umum",
  description = "",
  userEmail?: string,
): Promise<void> {
  if (!firestore) {
    return;
  }

  const currentUser = firebaseAuth?.currentUser;

  if (!currentUser) {
    return;
  }

  try {
    await addDoc(
      collection(firestore, ACTIVITY_COLLECTION),
      {
        action: safeText(action, 120) || "Aktivitas",
        category: safeText(category, 80) || "Umum",
        description: safeText(description, 1000),
        userEmail:
          safeText(userEmail ?? "", 254) ||
          currentUser.email ||
          "Pengguna GuruMate",
        userId: currentUser.uid,
        createdAt: serverTimestamp(),
      },
    );
  } catch (error: unknown) {
    console.warn(
      "GuruMate: aktivitas tidak berhasil dicatat.",
      error,
    );
  }
}

export const logActivity = recordGuruMateActivity;

/**
 * Mengambil maksimal 250 aktivitas terbaru.
 * Hanya dapat dipanggil dengan sesi admin yang valid.
 */
export async function getAdminActivities(): Promise<
  AdminActivity[]
> {
  if (!adminFirestore || !adminAuth?.currentUser) {
    throw new Error(
      "Sesi admin atau koneksi Firebase belum tersedia.",
    );
  }

  const allowed = await isAdminUser(
    adminAuth.currentUser.uid,
  );

  if (!allowed) {
    throw new Error(
      "Akses ditolak. Akun ini bukan admin aktif.",
    );
  }

  const activityQuery = query(
    collection(adminFirestore, ACTIVITY_COLLECTION),
    orderBy("createdAt", "desc"),
    limit(MAX_ACTIVITY_RESULTS),
  );

  const snapshot = await getDocs(activityQuery);

  return snapshot.docs.map((document) => {
    const value = document.data();

    let createdAt: Timestamp | null = null;

    if (
      value.createdAt &&
      typeof value.createdAt === "object" &&
      "toDate" in value.createdAt &&
      typeof value.createdAt.toDate === "function"
    ) {
      createdAt = value.createdAt as Timestamp;
    }

    return {
      id: document.id,
      action:
        safeText(value.action, 120) || "Aktivitas",
      category:
        safeText(value.category, 80) || "Umum",
      description: safeText(
        value.description,
        1000,
      ),
      userEmail:
        safeText(value.userEmail, 254) ||
        "Pengguna GuruMate",
      userId:
        typeof value.userId === "string"
          ? value.userId
          : null,
      createdAt,
    };
  });
}