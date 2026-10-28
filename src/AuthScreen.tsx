
import { useState } from "react";
import type { FormEvent } from "react";
import {
  loginTeacher,
  registerTeacher,
} from "./data/firebaseService";
import "./AuthScreen.css";

type AuthScreenProps = {
  onLogin: () => void;
};

export default function AuthScreen({ onLogin }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      setError("Email dan kata sandi wajib diisi.");
      return;
    }

    if (mode === "register") {
      if (name.trim().length < 2) {
        setError("Masukkan nama lengkap minimal 2 karakter.");
        return;
      }

      if (password.length < 6) {
        setError("Kata sandi minimal 6 karakter.");
        return;
      }

      if (password !== confirmPassword) {
        setError("Konfirmasi kata sandi belum cocok.");
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === "register") {
        await registerTeacher(name, cleanEmail, password);
      } else {
        await loginTeacher(cleanEmail, password);
      }

      onLogin();
    } catch (err: unknown) {
      const code =
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        typeof err.code === "string"
          ? err.code
          : "";

      const messages: Record<string, string> = {
        "auth/email-already-in-use":
          "Email ini sudah terdaftar. Silakan login.",
        "auth/invalid-email":
          "Format email tidak valid.",
        "auth/invalid-credential":
          "Email atau kata sandi salah.",
        "auth/user-not-found":
          "Akun tidak ditemukan. Silakan daftar terlebih dahulu.",
        "auth/wrong-password":
          "Kata sandi salah. Coba periksa kembali.",
        "auth/weak-password":
          "Kata sandi terlalu lemah. Gunakan minimal 6 karakter.",
        "auth/too-many-requests":
          "Terlalu banyak percobaan. Coba lagi beberapa saat.",
        "auth/network-request-failed":
          "Koneksi internet bermasalah. Periksa koneksi lalu coba lagi.",
        "auth/operation-not-allowed":
          "Login email dan kata sandi belum diaktifkan di Firebase Console.",
      };

      setError(
        messages[code] ??
          (err instanceof Error
            ? err.message
            : "Terjadi kesalahan. Silakan coba lagi."),
      );
    } finally {
      setLoading(false);
    }
  }

  function changeMode(nextMode: "login" | "register") {
    setMode(nextMode);
    setError("");
    setPassword("");
    setConfirmPassword("");
  }

  return (
    <main className="auth-page">
      <section className="auth-showcase">
        <div className="auth-brand">
          <div className="auth-brand-icon">G</div>
          <span>GuruMate</span>
        </div>

        <div className="auth-showcase-content">
          <span className="auth-eyebrow">
            PERSONAL TEACHING WORKSPACE
          </span>

          <h1>
            Mengajar lebih teratur.
            <br />
            <span>Hari lebih terarah.</span>
          </h1>

          <p>
            Satu ruang untuk mengelola jadwal mengajar, agenda,
            pengingat, ujian, dan data akademik dengan lebih mudah.
          </p>

          <div className="auth-feature-list">
            <div className="auth-feature">
              <span className="auth-feature-icon">✓</span>
              <div>
                <strong>Jadwal dalam satu tempat</strong>
                <small>Periksa agenda mengajar tanpa repot.</small>
              </div>
            </div>

            <div className="auth-feature">
              <span className="auth-feature-icon">◷</span>
              <div>
                <strong>Pengingat kegiatan</strong>
                <small>Lebih siap menghadapi kegiatan hari ini.</small>
              </div>
            </div>

            <div className="auth-feature">
              <span className="auth-feature-icon">▦</span>
              <div>
                <strong>Data lebih terorganisasi</strong>
                <small>Kelola pekerjaan dalam satu workspace.</small>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-showcase-footer">
          GuruMate · Personal workspace for teachers
        </div>
      </section>

      <section className="auth-form-section">
        <div className="auth-form-wrap">
          <div className="auth-mobile-brand">
            <div className="auth-brand-icon">G</div>
            <span>GuruMate</span>
          </div>

          <div className="auth-form-heading">
            <span className="auth-form-eyebrow">
              {mode === "login" ? "SELAMAT DATANG KEMBALI" : "MULAI PERJALANANMU"}
            </span>

            <h2>
              {mode === "login" ? "Masuk ke akunmu" : "Buat akun guru"}
            </h2>

            <p>
              {mode === "login"
                ? "Masuk untuk melihat jadwal dan mengelola kegiatan mengajar."
                : "Daftarkan akun untuk mulai menggunakan GuruMate."}
            </p>
          </div>

          <div className="auth-mode-switch">
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              onClick={() => changeMode("login")}
            >
              Masuk
            </button>

            <button
              type="button"
              className={mode === "register" ? "active" : ""}
              onClick={() => changeMode("register")}
            >
              Daftar akun
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === "register" && (
              <label className="auth-field">
                <span>Nama lengkap</span>
                <input
                  type="text"
                  autoComplete="name"
                  placeholder="Contoh: Budi Santoso"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  minLength={2}
                />
              </label>
            )}

            <label className="auth-field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="email"
                placeholder="nama@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>

            <label className="auth-field">
              <span>Kata sandi</span>
              <div className="auth-password-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  placeholder="Minimal 6 karakter"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={6}
                />

                <button
                  type="button"
                  className="auth-show-password"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={
                    showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
                  }
                >
                  {showPassword ? "Sembunyikan" : "Lihat"}
                </button>
              </div>
            </label>

            {mode === "register" && (
              <label className="auth-field">
                <span>Konfirmasi kata sandi</span>
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Ulangi kata sandi"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  minLength={6}
                />
              </label>
            )}

            {error && (
              <div className="auth-error" role="alert">
                <span>!</span>
                <p>{error}</p>
              </div>
            )}

            <button
              className="auth-submit"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Mohon tunggu..."
                : mode === "login"
                  ? "Masuk ke GuruMate"
                  : "Buat akun sekarang"}
              {!loading && <span aria-hidden="true">→</span>}
            </button>
          </form>

          <p className="auth-switch-copy">
            {mode === "login"
              ? "Belum punya akun?"
              : "Sudah punya akun?"}{" "}
            <button
              type="button"
              onClick={() =>
                changeMode(mode === "login" ? "register" : "login")
              }
            >
              {mode === "login" ? "Daftar sekarang" : "Masuk"}
            </button>
          </p>

          <div className="auth-security-note">
            <span>🔒</span>
            <p>
              Data akun diproses melalui Firebase Authentication.
              Jangan bagikan kata sandimu kepada siapa pun.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
