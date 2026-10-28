
import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";

import { adminAuth, firebaseEnabled } from "./firebase";
import {
  getAdminActivities,
  isAdminUser,
  type AdminActivity,
} from "./data/adminService";

type AdminPortalProps = {
  onClose: () => void;
};

function formatDate(value: unknown): string {
  if (!value) return "Waktu belum tersedia";

  let date: Date;

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    date = value.toDate();
  } else if (value instanceof Date) {
    date = value;
  } else if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    date = new Date(value);
  } else {
    return "Waktu belum tersedia";
  }

  if (Number.isNaN(date.getTime())) {
    return "Waktu belum tersedia";
  }

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminPortal({ onClose }: AdminPortalProps) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activities, setActivities] = useState<AdminActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const auth = adminAuth;

    if (!auth) {
      setError("Firebase Admin belum dikonfigurasi.");
      setAuthReady(true);
      return;
    }

    let mounted = true;

    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (!currentUser) {
          if (mounted) {
            setUser(null);
            setActivities([]);
            setAuthReady(true);
          }
          return;
        }

        try {
          const allowed = await isAdminUser(currentUser.uid);

          if (!mounted) return;

          if (allowed) {
            setUser(currentUser);
          } else {
            setUser(null);
            setActivities([]);
            setError(
              "Akses ditolak. UID akun ini belum terdaftar sebagai admin aktif.",
            );

            await signOut(auth);
          }
        } catch (authError) {
          console.error("Pemeriksaan admin gagal:", authError);

          if (mounted) {
            setUser(null);
            setActivities([]);
            setError("Gagal memverifikasi admin. Periksa koneksi Firebase.");
          }
        } finally {
          if (mounted) {
            setAuthReady(true);
          }
        }
      },
      (authError) => {
        console.error("Gagal memeriksa sesi admin:", authError);

        if (mounted) {
          setError("Sesi admin gagal diperiksa. Muat ulang halaman.");
          setAuthReady(true);
        }
      },
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  async function loadActivities() {
    const auth = adminAuth;
    const currentUser = auth?.currentUser;

    if (!currentUser) {
      setActivities([]);
      setError("Sesi admin tidak tersedia. Silakan login kembali.");
      return;
    }

    setError("");
    setLoadingActivities(true);

    try {
      const allowed = await isAdminUser(currentUser.uid);

      if (!allowed) {
        setActivities([]);
        setUser(null);
        setError("Akses admin sudah tidak aktif. Silakan login kembali.");
        await signOut(auth);
        return;
      }

      const rows = await getAdminActivities();
      setActivities(rows);
    } catch (loadError) {
      console.error("Gagal memuat aktivitas GuruMate:", loadError);
      setError(
        "Riwayat gagal dimuat. Periksa koneksi Firebase dan Firestore Rules.",
      );
    } finally {
      setLoadingActivities(false);
    }
  }

  useEffect(() => {
    if (user) {
      void loadActivities();
    } else {
      setActivities([]);
    }
    // Muat aktivitas saat sesi admin berubah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleLogin(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setError("");
    setNotice("");

    const auth = adminAuth;

    if (!firebaseEnabled || !auth) {
      setError(
        "Firebase belum dikonfigurasi. Periksa file .env.",
      );
      return;
    }

    setLoggingIn(true);

    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );

      const allowed = await isAdminUser(credential.user.uid);

      if (!allowed) {
        await signOut(auth);
        setUser(null);
        setPassword("");
        setError(
          "Akses ditolak. Akun berhasil login, tetapi UID belum terdaftar sebagai admin aktif.",
        );
        return;
      }

      setUser(credential.user);
      setPassword("");
      setNotice("Login admin berhasil.");
    } catch (loginError) {
      console.error("Login admin GuruMate gagal:", loginError);

      setError(
        "Login gagal. Periksa email, password, metode Email/Password, dan konfigurasi Firebase.",
      );
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleLogout() {
    const auth = adminAuth;

    try {
      if (auth) {
        await signOut(auth);
      }

      setUser(null);
      setActivities([]);
      setPassword("");
      setError("");
      setNotice("Kamu sudah keluar dari panel admin.");
    } catch (logoutError) {
      console.error("Logout admin gagal:", logoutError);
      setError("Logout gagal. Silakan coba lagi.");
    }
  }

  if (!authReady) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
        <div className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-white/[0.04] p-8">
          Memeriksa sesi admin...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:px-6">
        <section className="mx-auto w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/90 p-6 shadow-2xl shadow-blue-950/30 sm:p-8">
          <button
            type="button"
            onClick={onClose}
            className="mb-6 text-sm text-slate-400 transition hover:text-white"
          >
            ← Kembali ke GuruMate
          </button>

          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/15 text-xl text-blue-300">
            A
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-300">
            GuruMate Control Center
          </p>

          <h1 className="mt-2 text-2xl font-bold">Login Admin</h1>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Masuk menggunakan akun yang UID-nya sudah terdaftar
            sebagai admin aktif. Akun guru biasa tidak mendapat
            akses ke panel ini.
          </p>

          {!firebaseEnabled && (
            <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-200">
              Firebase belum aktif. Lengkapi konfigurasi Firebase
              sebelum login.
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-slate-300">
              Email akun admin
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400"
                placeholder="Masukkan email admin"
              />
            </label>

            <label className="block text-sm font-medium text-slate-300">
              Password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400"
                placeholder="Password akun admin"
              />
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200"
              >
                {error}
              </p>
            )}

            {notice && (
              <p className="text-sm text-emerald-300">{notice}</p>
            )}

            <button
              type="submit"
              disabled={!firebaseEnabled || !adminAuth || loggingIn}
              className="w-full rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loggingIn ? "Memverifikasi..." : "Masuk sebagai Admin"}
            </button>
          </form>

          <p className="mt-5 text-xs leading-5 text-slate-500">
            Daftarkan UID admin melalui Firebase Console.
            Jangan menyimpan password di dalam kode.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-300">
              GuruMate Control Center
            </p>

            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
              Log Aktivitas
            </h1>

            <p className="mt-2 break-all text-sm text-slate-400">
              Login sebagai {user.email || user.uid}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadActivities()}
              disabled={loadingActivities}
              className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
            >
              {loadingActivities ? "Memuat..." : "Muat Ulang"}
            </button>

            <button
              type="button"
              onClick={() => void handleLogout()}
              className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-2.5 text-sm font-semibold text-rose-200 hover:bg-rose-400/20"
            >
              Keluar
            </button>
          </div>
        </header>

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200"
          >
            {error}
          </p>
        )}

        {notice && (
          <p className="mt-4 text-sm text-emerald-300">{notice}</p>
        )}

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">
              Total aktivitas dimuat
            </p>
            <p className="mt-2 text-3xl font-bold">
              {activities.length}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">Status akses</p>
            <p className="mt-2 text-lg font-semibold text-emerald-300">
              Admin terverifikasi
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">Penyimpanan</p>
            <p className="mt-2 text-lg font-semibold">
              Firebase Firestore
            </p>
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="flex flex-col gap-2 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Riwayat penggunaan
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Menampilkan maksimal 250 aktivitas terbaru.
              </p>
            </div>

            {loadingActivities && (
              <span className="text-sm text-blue-300">
                Memuat aktivitas...
              </span>
            )}
          </div>

          {activities.length === 0 && !loadingActivities ? (
            <div className="p-8 text-center text-sm text-slate-400">
              Belum ada aktivitas yang tercatat, atau data belum
              dapat dibaca oleh aturan Firestore.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Waktu</th>
                    <th className="px-5 py-3 font-medium">Pengguna</th>
                    <th className="px-5 py-3 font-medium">Kategori</th>
                    <th className="px-5 py-3 font-medium">Aktivitas</th>
                    <th className="px-5 py-3 font-medium">Keterangan</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/5">
                  {activities.map((activity, index) => (
                    <tr
                      key={
                        activity.id ??
                        `${activity.createdAt ?? "activity"}-${index}`
                      }
                      className="align-top hover:bg-white/[0.025]"
                    >
                      <td className="whitespace-nowrap px-5 py-4 text-slate-400">
                        {formatDate(activity.createdAt)}
                      </td>

                      <td className="px-5 py-4 text-slate-300">
                        {activity.userEmail || "GuruMate"}
                      </td>

                      <td className="px-5 py-4 text-slate-300">
                        {activity.category || "Umum"}
                      </td>

                      <td className="px-5 py-4 font-medium text-white">
                        {activity.action || "Aktivitas"}
                      </td>

                      <td className="max-w-sm px-5 py-4 text-slate-400">
                        {activity.description || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
