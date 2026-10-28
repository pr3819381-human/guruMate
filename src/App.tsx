import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { User } from "firebase/auth";
import "./App.css";
import "./AuthScreen.css";
import AdminPortal from "./AdminPortal";
import AuthScreen from "./AuthScreen";
import {
  getCurrentTeacher,
  isCloudAvailable,
  observeAuthState,
  loadCloudData,
  saveCloudData,
  logoutTeacher,
} from "./data/firebaseService";
import { recordGuruMateActivity } from "./data/adminService";
import {
  getGuruMateData,
  saveGuruMateData,
  subscribeToGuruMateData,
  addSchedule,
  addReminder,
  addExam,
  addStudent,
  addGrade,
  upsertAttendance,
  toggleReminder,
  type GuruMateData,
  type Schedule,
  type Reminder,
  type AttendanceStatus,
} from "./data/storage";

const menus = [
  { name: "Dashboard", icon: "⌂", description: "Ringkasan aktivitas mengajar" },
  { name: "Kalender", icon: "▦", description: "Kalender kegiatan sekolah" },
  { name: "Jadwal Mengajar", icon: "◷", description: "Atur jadwal kelas" },
  { name: "Agenda & Reminder", icon: "✓", description: "Pengingat kegiatan penting" },
  { name: "Ujian", icon: "▤", description: "Jadwal ujian dan evaluasi" },
  { name: "Akademik", icon: "◎", description: "Data siswa dan nilai" },
  { name: "Absensi", icon: "◉", description: "Kehadiran siswa" },
  { name: "Mengajar", icon: "▣", description: "Ringkasan kegiatan mengajar" },
  { name: "Laporan", icon: "▥", description: "Ringkasan dan ekspor data" },
];

const todayISO = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const dateLabel = (value: string) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Belum ditentukan";

const inputClass =
  "gm-form-input w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10";

const buttonClass =
  "gm-primary-button inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5 active:translate-y-0";

const cardClass = "gm-panel-card rounded-2xl border p-5 sm:p-6";

function App() {
  const [page, setPage] = useState("Dashboard");
  const [authUser, setAuthUser] = useState<User | null>(() => getCurrentTeacher());
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState("");

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      return localStorage.getItem("gurumateTheme") === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });

  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showAdminPortal, setShowAdminPortal] = useState(false);
  const [data, setData] = useState<GuruMateData>(() => getGuruMateData());
  const [notice, setNotice] = useState("");

  const [studentForm, setStudentForm] = useState({
    name: "",
    className: "",
    nis: "",
  });

  const [gradeForm, setGradeForm] = useState({
    studentId: "",
    examId: "",
    score: "",
  });

  const [attendanceDate, setAttendanceDate] = useState(todayISO());
  const [attendanceClass, setAttendanceClass] = useState("");

  const [scheduleForm, setScheduleForm] = useState({
    date: todayISO(),
    startTime: "07:00",
    endTime: "08:30",
    subject: "",
    className: "",
    room: "",
    topic: "",
    color: "from-blue-400 to-indigo-500",
  });

  const [reminderForm, setReminderForm] = useState({
    title: "",
    detail: "",
    date: todayISO(),
    time: "08:00",
    type: "today" as Reminder["type"],
  });

  const [examForm, setExamForm] = useState({
    title: "",
    subject: "",
    className: "",
    date: todayISO(),
    time: "09:00",
    room: "",
  });

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });

  useEffect(() => {
    if (!isCloudAvailable()) {
      setAuthReady(true);
      setAuthError(
        "Firebase belum dikonfigurasi. Periksa file .env dan aktifkan Email/Password di Firebase Authentication.",
      );
      return;
    }

    try {
      return observeAuthState((user) => {
        setAuthUser(user);
        setAuthReady(true);
        setAuthError("");
      });
    } catch (error) {
      console.error("GuruMate authentication:", error);
      setAuthReady(true);
      setAuthError("GuruMate gagal menghubungkan autentikasi Firebase.");
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.gurumateTheme = theme;

    try {
      localStorage.setItem("gurumateTheme", theme);
    } catch {
      // Tema tetap aktif selama aplikasi terbuka.
    }
  }, [theme]);

  useEffect(() => {
    return subscribeToGuruMateData(() => {
      setData(getGuruMateData());
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function syncCloud() {
      if (!authUser) return;

      try {
        const remote = await loadCloudData();
        if (cancelled) return;

        if (remote) {
          localStorage.setItem("gurumateData", JSON.stringify(remote));
          window.dispatchEvent(new CustomEvent("gurumateDataChanged"));
          setData(remote);
        } else {
          await saveCloudData(getGuruMateData());
        }
      } catch (error) {
        console.warn("Sinkronisasi GuruMate:", error);
      }
    }

    void syncCloud();

    return () => {
      cancelled = true;
    };
  }, [authUser]);

  const today = todayISO();

  const schedulesToday = useMemo(
    () =>
      data.schedules
        .filter((item) => item.date === today)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [data.schedules, today],
  );

  const upcomingSchedules = useMemo(
    () =>
      data.schedules
        .filter((item) => item.date >= today)
        .sort((a, b) =>
          `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`),
        ),
    [data.schedules, today],
  );

  const reminders = useMemo(
    () =>
      data.reminders
        .filter((item) => !item.completed)
        .sort((a, b) =>
          `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
        ),
    [data.reminders],
  );

  const exams = useMemo(
    () =>
      data.exams
        .filter((item) => item.status === "upcoming")
        .sort((a, b) =>
          `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
        ),
    [data.exams],
  );

  function commit(next: GuruMateData, message = "Perubahan berhasil disimpan.") {
    saveGuruMateData(next);
    setData(next);
    setNotice(message);
    void recordGuruMateActivity(message, "Data", message);
    window.setTimeout(() => setNotice(""), 3000);
  }

  function submitSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (scheduleForm.endTime <= scheduleForm.startTime) {
      setNotice("Waktu selesai harus setelah waktu mulai.");
      return;
    }

    const next = addSchedule(data, scheduleForm);
    commit(next, "Jadwal mengajar berhasil ditambahkan.");

    setScheduleForm({
      date: todayISO(),
      startTime: "07:00",
      endTime: "08:30",
      subject: "",
      className: "",
      room: "",
      topic: "",
      color: "from-blue-400 to-indigo-500",
    });
  }

  function submitReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const next = addReminder(data, reminderForm);
    commit(next, "Pengingat berhasil ditambahkan.");

    setReminderForm({
      title: "",
      detail: "",
      date: todayISO(),
      time: "08:00",
      type: "today",
    });
  }

  function submitExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const next = addExam(data, examForm);
    commit(next, "Jadwal ujian berhasil ditambahkan.");

    setExamForm({
      title: "",
      subject: "",
      className: "",
      date: todayISO(),
      time: "09:00",
      room: "",
    });
  }

  function submitStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!studentForm.name.trim() || !studentForm.className.trim()) {
      setNotice("Nama siswa dan kelas wajib diisi.");
      return;
    }

    const next = addStudent(data, {
      name: studentForm.name.trim(),
      className: studentForm.className.trim(),
      nis: studentForm.nis.trim(),
      average: 0,
    });

    commit(next, "Data siswa berhasil ditambahkan.");
    setStudentForm({ name: "", className: "", nis: "" });
  }

  function submitGrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const score = Number(gradeForm.score);

    if (
      !gradeForm.studentId ||
      !gradeForm.examId ||
      gradeForm.score === "" ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > 100
    ) {
      setNotice("Pilih siswa, ujian, dan masukkan nilai 0–100.");
      return;
    }

    const next = addGrade(data, {
      studentId: gradeForm.studentId,
      examId: gradeForm.examId,
      score,
    });

    commit(next, "Nilai siswa berhasil disimpan.");
    setGradeForm({ studentId: "", examId: "", score: "" });
  }

  function saveAttendance(studentId: string, status: AttendanceStatus) {
    const student = data.students.find((item) => item.id === studentId);
    if (!student) return;

    const next = upsertAttendance(data, {
      studentId,
      className: student.className,
      date: attendanceDate,
      status,
      note: "",
      checkedAt: new Date().toISOString(),
    });

    commit(next, `Absensi ${student.name} disimpan.`);
  }

  function finishReminder(id: string) {
    commit(toggleReminder(data, id), "Status pengingat diperbarui.");
  }

  function downloadReport() {
    const rows = [
      ["Jenis", "Nama", "Tanggal", "Waktu", "Keterangan"],
      ...data.schedules.map((item) => [
        "Jadwal",
        `${item.subject} - ${item.className}`,
        item.date,
        item.startTime,
        `${item.endTime}; ${item.room}; ${item.topic}`,
      ]),
      ...data.reminders.map((item) => [
        "Pengingat",
        item.title,
        item.date,
        item.time,
        `${item.detail}; ${item.completed ? "Selesai" : "Aktif"}`,
      ]),
      ...data.exams.map((item) => [
        "Ujian",
        `${item.title} - ${item.subject}`,
        item.date,
        item.time,
        `${item.className}; ${item.room}; ${item.status}`,
      ]),
      ...data.students.map((item) => [
        "Siswa",
        item.name,
        "",
        "",
        `${item.className}; NIS ${item.nis}; rata-rata ${item.average}`,
      ]),
      ...data.grades.map((item) => [
        "Nilai",
        data.students.find((student) => student.id === item.studentId)?.name ?? item.studentId,
        "",
        "",
        `Ujian ${data.exams.find((exam) => exam.id === item.examId)?.title ?? item.examId}; nilai ${item.score}`,
      ]),
      ...data.attendance.map((item) => [
        "Absensi",
        data.students.find((student) => student.id === item.studentId)?.name ?? item.studentId,
        item.date,
        "",
        `${item.className}; ${item.status}`,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      )
      .join("\r\n");

    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8;",
      }),
    );

    const link = document.createElement("a");
    link.href = url;
    link.download = `GuruMate-Laporan-${today}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const monthName = calendarMonth.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const offset = (new Date(year, month, 1).getDay() + 6) % 7;
    const count = new Date(year, month + 1, 0).getDate();

    return [
      ...Array.from({ length: offset }, () => null),
      ...Array.from({ length: count }, (_, index) => {
        const day = index + 1;
        return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }),
    ];
  }, [calendarMonth]);

  if (showAdminPortal) {
    return <AdminPortal onClose={() => setShowAdminPortal(false)} />;
  }

  if (!authReady) {
    return (
      <div className="gm-auth-loading">
        <div className="gm-auth-spinner" />
        <p>Menyiapkan GuruMate...</p>
      </div>
    );
  }

  if (!authUser) {
    return (
      <>
        {authError && (
          <div className="gm-auth-config-error" role="alert">
            {authError}
          </div>
        )}
        <AuthScreen onLogin={() => setAuthUser(getCurrentTeacher())} />
      </>
    );
  }

  const todayAgenda = [
    ...schedulesToday.map((item) => ({
      id: item.id,
      time: item.startTime,
      end: item.endTime,
      title: `${item.subject} — ${item.className}`,
      detail: [item.topic, item.room ? `Ruang ${item.room}` : ""]
        .filter(Boolean)
        .join(" · "),
      type: "Jadwal mengajar",
    })),
    ...reminders
      .filter((item) => item.date === today)
      .map((item) => ({
        id: item.id,
        time: item.time,
        end: "",
        title: item.title,
        detail: item.detail,
        type: "Pengingat",
      })),
    ...exams
      .filter((item) => item.date === today)
      .map((item) => ({
        id: item.id,
        time: item.time,
        end: "",
        title: item.title,
        detail: `${item.subject} · ${item.className}${item.room ? ` · Ruang ${item.room}` : ""}`,
        type: "Ujian",
      })),
  ].sort((a, b) => a.time.localeCompare(b.time));

  const todayDate = new Date();
  const greeting =
    todayDate.getHours() < 11
      ? "Selamat pagi"
      : todayDate.getHours() < 15
        ? "Selamat siang"
        : todayDate.getHours() < 18
          ? "Selamat sore"
          : "Selamat malam";

  const teacherName =
    authUser.displayName?.trim() ||
    authUser.email?.split("@")[0] ||
    "Bapak/Ibu Guru";

  const upcomingItemsCount =
    upcomingSchedules.length + reminders.length + exams.length;

  return (
    <div
      className={`gm-app-root ${theme === "light" ? "gm-light" : "gm-dark"} min-h-screen`}
    >
      <div className="flex min-h-screen">
        <aside className="gm-sidebar hidden w-64 shrink-0 flex-col lg:flex">
          <div className="gm-brand flex h-20 items-center gap-3 px-6">
            <div className="gm-brand-icon flex h-11 w-11 items-center justify-center rounded-2xl text-xl font-bold text-white">
              G
            </div>
            <div>
              <h1 className="text-lg font-extrabold">GuruMate</h1>
              <p className="gm-muted text-xs">Personal teaching workspace</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1 p-3">
            <p className="gm-section-label px-3 pb-3 pt-4">
              WORKSPACE
            </p>

            {menus.map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => {
                  setPage(item.name);
                  void recordGuruMateActivity(
                    "Membuka halaman",
                    "Navigasi",
                    `Pengguna membuka halaman ${item.name}.`,
                  );
                }}
                className={`gm-nav-item flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                  page === item.name ? "active" : ""
                }`}
              >
                <span className="gm-nav-icon flex h-9 w-9 items-center justify-center rounded-xl text-base">
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{item.name}</span>
                  <span className="gm-nav-description mt-0.5 block truncate text-[10px]">
                    {item.description}
                  </span>
                </span>
                {page === item.name && <span className="gm-nav-indicator" />}
              </button>
            ))}
          </nav>

          <div className="px-4 pb-3">
            <button
              type="button"
              onClick={() => setShowAdminPortal(true)}
              className="gm-admin-button flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl">
                ⚙
              </span>
              <span className="flex-1">Panel Admin</span>
              <span>→</span>
            </button>
          </div>

          <div className="gm-sidebar-promo m-4 rounded-2xl p-4">
            <div className="flex items-center gap-2">
              <span className="gm-promo-sparkle">✦</span>
              <p className="text-sm font-bold">GuruMate Assistant</p>
            </div>
            <p className="gm-muted mt-2 text-xs leading-relaxed">
              Semua kebutuhan mengajar, agenda, dan administrasi dalam satu
              workspace.
            </p>
            <div className="gm-promo-progress mt-4">
              <span />
            </div>
            <p className="gm-muted mt-2 text-[10px]">
              Workspace pribadi untuk guru
            </p>
          </div>

          <div className="gm-sidebar-profile mx-4 mb-4 flex items-center gap-3 rounded-2xl p-3">
            <div className="gm-avatar flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold">
              {teacherName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{teacherName}</p>
              <p className="gm-muted truncate text-[10px]">
                {authUser.email}
              </p>
            </div>
            <span className="gm-online-dot" title="Akun aktif" />
          </div>
        </aside>

        {showMobileMenu && (
          <div className="fixed inset-0 z-[100] lg:hidden">
            <button
              type="button"
              aria-label="Tutup menu"
              onClick={() => setShowMobileMenu(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            <aside className="gm-sidebar absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col shadow-2xl">
              <div className="gm-brand flex h-20 items-center justify-between px-5">
                <div className="flex items-center gap-3">
                  <div className="gm-brand-icon flex h-11 w-11 items-center justify-center rounded-2xl text-xl font-bold text-white">
                    G
                  </div>
                  <div>
                    <h1 className="text-lg font-extrabold">GuruMate</h1>
                    <p className="gm-muted text-xs">Teacher workspace</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMobileMenu(false)}
                  className="gm-icon-button flex h-10 w-10 items-center justify-center rounded-xl text-xl"
                  aria-label="Tutup navigasi"
                >
                  ×
                </button>
              </div>

              <nav className="flex-1 space-y-1 overflow-y-auto p-3">
                <p className="gm-section-label px-3 pb-3 pt-4">
                  WORKSPACE
                </p>
                {menus.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => {
                      setPage(item.name);
                      setShowMobileMenu(false);
                    }}
                    className={`gm-nav-item flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm ${
                      page === item.name ? "active" : ""
                    }`}
                  >
                    <span className="gm-nav-icon flex h-9 w-9 items-center justify-center rounded-xl">
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{item.name}</span>
                      <span className="gm-nav-description mt-0.5 block truncate text-[10px]">
                        {item.description}
                      </span>
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileMenu(false);
                    setShowAdminPortal(true);
                  }}
                  className="gm-admin-button mt-3 flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm font-semibold"
                >
                  ⚙ Panel Admin <span className="ml-auto">→</span>
                </button>
              </nav>

              <div className="gm-sidebar-profile m-4 flex items-center gap-3 rounded-2xl p-3">
                <div className="gm-avatar flex h-10 w-10 items-center justify-center rounded-full font-bold">
                  {teacherName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{teacherName}</p>
                  <p className="gm-muted truncate text-xs">{authUser.email}</p>
                </div>
              </div>
            </aside>
          </div>
        )}

        <main className="gm-main min-w-0 flex-1">
          <header className="gm-topbar sticky top-0 z-20 flex min-h-[76px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setShowMobileMenu(true)}
                aria-label="Buka navigasi"
                className="gm-icon-button flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg lg:hidden"
              >
                ☰
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="gm-header-mark" />
                  <p className="gm-header-eyebrow truncate">{page}</p>
                </div>
                <p className="gm-muted mt-1 truncate text-xs">
                  {new Date().toLocaleDateString("id-ID", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setPage("Agenda & Reminder")}
                className="gm-icon-button gm-notification-button relative flex h-10 w-10 items-center justify-center rounded-xl text-lg"
                aria-label="Buka pengingat"
                title="Pengingat"
              >
                ♢
                {reminders.length > 0 && (
                  <span className="gm-notification-dot absolute right-2 top-2 h-2 w-2 rounded-full" />
                )}
              </button>

              <button
                type="button"
                onClick={() =>
                  setTheme((current) =>
                    current === "dark" ? "light" : "dark",
                  )
                }
                className="gm-icon-button flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-semibold"
                aria-label={
                  theme === "dark"
                    ? "Aktifkan mode terang"
                    : "Aktifkan mode gelap"
                }
              >
                <span>{theme === "dark" ? "☀" : "☾"}</span>
                <span className="hidden sm:inline">
                  {theme === "dark" ? "Mode terang" : "Mode gelap"}
                </span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  try {
                    await logoutTeacher();
                    setAuthUser(null);
                    setShowAdminPortal(false);
                    setPage("Dashboard");
                  } catch (error) {
                    console.error("Logout GuruMate:", error);
                    setNotice("Logout gagal. Silakan coba lagi.");
                  }
                }}
                className="gm-logout-button flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-semibold"
                title="Keluar dari akun"
              >
                ↪ <span className="hidden sm:inline">Keluar</span>
              </button>
            </div>
          </header>

          <div className="gm-page-content mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
            {notice && (
              <div className="gm-toast rounded-xl border px-4 py-3 text-sm">
                <span className="mr-2">✓</span>
                {notice}
              </div>
            )}

            {page === "Dashboard" && (
              <>
                <section className="gm-dashboard-hero relative overflow-hidden rounded-[28px] border p-6 sm:p-8 lg:p-10">
                  <div className="gm-hero-orb gm-hero-orb-one pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full blur-3xl" />
                  <div className="gm-hero-orb gm-hero-orb-two pointer-events-none absolute -bottom-28 right-1/3 h-64 w-64 rounded-full blur-3xl" />
                  <div className="gm-hero-grid pointer-events-none absolute inset-0" />

                  <div className="relative z-10 grid items-center gap-8 lg:grid-cols-[1.25fr_0.75fr]">
                    <div>
                      <div className="gm-hero-kicker inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em]">
                        <span className="gm-status-pulse" />
                        Personal teaching workspace
                      </div>

                      <p className="gm-hero-greeting mt-6 text-sm font-semibold">
                        {greeting}, {teacherName} 👋
                      </p>

                      <h2 className="gm-hero-title mt-3 max-w-2xl text-3xl font-extrabold leading-[1.15] tracking-tight sm:text-4xl lg:text-[2.8rem]">
                        Mengajar lebih teratur,
                        <span className="gm-hero-gradient block">
                          hari lebih terarah.
                        </span>
                      </h2>

                      <p className="gm-hero-description mt-4 max-w-xl text-sm leading-7 sm:text-base">
                        Semua jadwal, pengingat, ujian, dan aktivitas kelas
                        dalam satu ruang kerja yang praktis. Yuk, siapkan
                        kegiatan mengajarmu hari ini.
                      </p>

                      <div className="mt-7 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => setPage("Jadwal Mengajar")}
                          className="gm-hero-primary inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-bold transition hover:-translate-y-0.5"
                        >
                          <span>＋</span> Kelola jadwal <span>→</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPage("Agenda & Reminder")}
                          className="gm-hero-secondary inline-flex items-center justify-center gap-2 rounded-xl border px-5 py-3.5 text-sm font-semibold transition"
                        >
                          <span>▤</span> Buka agenda
                        </button>
                      </div>

                      <div className="gm-hero-footer mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-5 text-xs">
                        <span className="inline-flex items-center gap-2">
                          <span className="gm-mini-check">✓</span>
                          Workspace pribadi
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <span className="gm-mini-check">✓</span>
                          Agenda terorganisasi
                        </span>
                      </div>
                    </div>

                    <div className="gm-hero-side relative">
                      <div className="gm-hero-side-glow pointer-events-none absolute inset-4 rounded-full blur-3xl" />
                      <div className="gm-hero-summary relative rounded-3xl border p-5 sm:p-6">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="gm-card-eyebrow">RINGKASAN HARI INI</p>
                            <h3 className="mt-2 text-lg font-bold">
                              Agenda kamu
                            </h3>
                          </div>
                          <div className="gm-summary-icon flex h-11 w-11 items-center justify-center rounded-2xl text-xl">
                            ✦
                          </div>
                        </div>

                        <div className="gm-summary-total mt-5 flex items-end justify-between gap-3 rounded-2xl p-4">
                          <div>
                            <p className="gm-muted text-xs">Total agenda hari ini</p>
                            <p className="mt-1 text-3xl font-extrabold">
                              {todayAgenda.length}
                            </p>
                          </div>
                          <span className="gm-summary-today rounded-full px-3 py-1.5 text-[10px] font-bold">
                            HARI INI
                          </span>
                        </div>

                        <div className="mt-4 space-y-3">
                          <MiniSummaryRow
                            icon="◷"
                            label="Jadwal mengajar"
                            value={schedulesToday.length}
                            accent="blue"
                          />
                          <MiniSummaryRow
                            icon="✓"
                            label="Pengingat aktif"
                            value={reminders.filter((item) => item.date === today).length}
                            accent="violet"
                          />
                          <MiniSummaryRow
                            icon="▤"
                            label="Ujian hari ini"
                            value={exams.filter((item) => item.date === today).length}
                            accent="amber"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => setPage("Kalender")}
                          className="gm-summary-link mt-5 flex w-full items-center justify-between rounded-xl border px-4 py-3 text-xs font-semibold transition"
                        >
                          Lihat kalender kegiatan <span>→</span>
                        </button>
                      </div>

                      <div className="gm-floating-chip relative ml-auto mt-3 flex w-fit items-center gap-3 rounded-2xl border px-4 py-3">
                        <div className="gm-floating-chip-icon flex h-9 w-9 items-center justify-center rounded-xl">
                          ✓
                        </div>
                        <div>
                          <p className="text-xs font-bold">Tetap terorganisasi</p>
                          <p className="gm-muted mt-1 text-[10px]">
                            Satu langkah setiap hari
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="gm-stats-grid grid grid-cols-2 gap-3 xl:grid-cols-4">
                  {[
                    {
                      label: "Jadwal hari ini",
                      value: schedulesToday.length,
                      icon: "◷",
                      detail: "Kelas terjadwal",
                      tone: "blue",
                    },
                    {
                      label: "Pengingat aktif",
                      value: reminders.length,
                      icon: "✓",
                      detail: "Belum diselesaikan",
                      tone: "violet",
                    },
                    {
                      label: "Ujian mendatang",
                      value: exams.length,
                      icon: "▤",
                      detail: "Perlu dipersiapkan",
                      tone: "amber",
                    },
                    {
                      label: "Kelas terdaftar",
                      value: new Set(data.schedules.map((item) => item.className)).size,
                      icon: "▦",
                      detail: "Dari jadwal tersimpan",
                      tone: "green",
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className={`gm-stat-card gm-stat-${stat.tone} rounded-2xl border p-4 sm:p-5`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="gm-stat-icon flex h-11 w-11 items-center justify-center rounded-2xl text-lg">
                          {stat.icon}
                        </div>
                        <span className="gm-stat-decoration text-xl">✦</span>
                      </div>
                      <p className="gm-stat-value mt-5 text-3xl font-extrabold">
                        {stat.value}
                      </p>
                      <p className="gm-stat-label mt-1 text-sm font-semibold">
                        {stat.label}
                      </p>
                      <p className="gm-muted mt-1 text-[10px] sm:text-xs">
                        {stat.detail}
                      </p>
                      <div className="gm-stat-line mt-4">
                        <span />
                      </div>
                    </div>
                  ))}
                </section>

                <section className={cardClass}>
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="gm-card-eyebrow">AGENDA MENGAJAR</p>
                      <h3 className="gm-heading mt-2 text-xl font-bold">
                        Jadwal kelas berikutnya
                      </h3>
                      <p className="gm-muted mt-1 text-sm">
                        Jadwal terdekat yang perlu kamu siapkan.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPage("Jadwal Mengajar")}
                      className="gm-secondary-button rounded-xl border px-4 py-2.5 text-xs font-semibold transition"
                    >
                      Kelola jadwal →
                    </button>
                  </div>

                  {upcomingSchedules.length ? (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {upcomingSchedules.slice(0, 3).map((item, index) => (
                        <div
                          key={item.id}
                          className="gm-upcoming-card rounded-2xl border p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="gm-upcoming-number flex h-10 w-10 items-center justify-center rounded-xl text-sm font-extrabold">
                              {String(index + 1).padStart(2, "0")}
                            </div>
                            <span className="gm-upcoming-date rounded-full px-3 py-1.5 text-[10px] font-semibold">
                              {dateLabel(item.date)}
                            </span>
                          </div>
                          <h4 className="gm-heading mt-4 font-bold">
                            {item.subject}
                          </h4>
                          <p className="gm-muted mt-1 text-sm">
                            Kelas {item.className}
                          </p>
                          <div className="gm-upcoming-meta mt-4 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-lg px-2.5 py-2">
                              ◷ {item.startTime}–{item.endTime}
                            </span>
                            {item.room && (
                              <span className="rounded-lg px-2.5 py-2">
                                ▣ {item.room}
                              </span>
                            )}
                          </div>
                          {item.topic && (
                            <p className="gm-muted mt-3 text-xs leading-relaxed">
                              <span className="font-semibold">Materi:</span>{" "}
                              {item.topic}
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setAttendanceClass(item.className);
                              setAttendanceDate(item.date);
                              setPage("Absensi");
                            }}
                            className="gm-attendance-link mt-4 w-full rounded-xl border px-3 py-2.5 text-xs font-semibold transition"
                          >
                            Buka absensi kelas →
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      title="Belum ada jadwal mengajar"
                      detail="Tambahkan jadwal terlebih dahulu agar agenda kelas tampil di dashboard."
                    />
                  )}
                </section>

                <section className={cardClass}>
                  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="gm-card-eyebrow">AGENDA HARIAN</p>
                      <h3 className="gm-heading mt-2 text-xl font-bold">
                        Yang perlu dilakukan hari ini
                      </h3>
                      <p className="gm-muted mt-1 text-sm">
                        Semua jadwal, pengingat, dan ujian dalam satu daftar.
                      </p>
                    </div>
                    <span className="gm-agenda-count rounded-full border px-3 py-2 text-xs font-bold">
                      {todayAgenda.length} agenda
                    </span>
                  </div>

                  {todayAgenda.length ? (
                    <div className="space-y-3">
                      {todayAgenda.map((item) => (
                        <div
                          key={`${item.type}-${item.id}`}
                          className="gm-agenda-row flex items-start gap-3 rounded-2xl border p-3 sm:p-4"
                        >
                          <div className="gm-agenda-time min-w-[76px] rounded-xl px-2 py-2.5 text-center">
                            <p className="text-sm font-extrabold">{item.time}</p>
                            {item.end && (
                              <p className="gm-muted mt-1 text-[10px]">
                                s.d. {item.end}
                              </p>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="gm-heading break-words text-sm font-bold">
                              {item.title}
                            </p>
                            {item.detail && (
                              <p className="gm-muted mt-1 break-words text-xs leading-relaxed">
                                {item.detail}
                              </p>
                            )}
                            <span className="gm-agenda-type mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold">
                              {item.type}
                            </span>
                          </div>
                          <span className="gm-agenda-check hidden h-8 w-8 items-center justify-center rounded-full sm:flex">
                            ✓
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      title="Hari ini belum ada agenda"
                      detail="Tambahkan jadwal mengajar, pengingat, atau ujian. Semuanya akan muncul otomatis di sini."
                    />
                  )}
                </section>

                <div className="grid gap-6 xl:grid-cols-2">
                  <section className={cardClass}>
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div>
                        <p className="gm-card-eyebrow">JADWAL</p>
                        <h3 className="gm-heading mt-2 font-bold">
                          Jadwal hari ini
                        </h3>
                        <p className="gm-muted mt-1 text-xs">
                          Urut berdasarkan waktu mengajar
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPage("Jadwal Mengajar")}
                        className="gm-text-link text-xs font-semibold"
                      >
                        Lihat semua →
                      </button>
                    </div>
                    {schedulesToday.length ? (
                      <div className="space-y-3">
                        {schedulesToday.map((item) => (
                          <ScheduleCard key={item.id} item={item} />
                        ))}
                      </div>
                    ) : (
                      <Empty
                        title="Belum ada jadwal"
                        detail="Tambahkan jadwal mengajar untuk hari ini."
                      />
                    )}
                  </section>

                  <section className={cardClass}>
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div>
                        <p className="gm-card-eyebrow">PENGINGAT</p>
                        <h3 className="gm-heading mt-2 font-bold">
                          Pengingat aktif
                        </h3>
                        <p className="gm-muted mt-1 text-xs">
                          Agenda yang belum selesai
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPage("Agenda & Reminder")}
                        className="gm-text-link text-xs font-semibold"
                      >
                        Kelola →
                      </button>
                    </div>
                    {reminders.slice(0, 5).length ? (
                      <div className="space-y-2">
                        {reminders.slice(0, 5).map((item) => (
                          <ReminderRow
                            key={item.id}
                            item={item}
                            onToggle={() => finishReminder(item.id)}
                            showDate
                          />
                        ))}
                      </div>
                    ) : (
                      <Empty
                        title="Tidak ada pengingat aktif"
                        detail="Agenda yang kamu tambahkan akan muncul di sini."
                      />
                    )}
                  </section>
                </div>

                <section className="gm-bottom-banner flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div className="flex items-start gap-3">
                    <div className="gm-bottom-banner-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl">
                      ✦
                    </div>
                    <div>
                      <h3 className="gm-heading font-bold">
                        Tetap siap untuk kegiatan berikutnya
                      </h3>
                      <p className="gm-muted mt-1 text-sm">
                        {upcomingItemsCount
                          ? `Kamu memiliki ${upcomingItemsCount} jadwal, pengingat, atau ujian yang perlu diperhatikan.`
                          : "Mulai dengan menambahkan jadwal atau pengingat pertamamu."}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPage("Agenda & Reminder")}
                    className="gm-primary-button shrink-0 rounded-xl px-4 py-3 text-sm font-bold transition"
                  >
                    Atur agenda →
                  </button>
                </section>
              </>
            )}

            {page === "Kalender" && (
              <section className={cardClass}>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="gm-card-eyebrow">KALENDER</p>
                    <h2 className="gm-heading mt-2 text-xl font-bold">
                      Kalender kegiatan
                    </h2>
                    <p className="gm-muted mt-1 text-sm">
                      Lihat jadwal, pengingat, dan ujian berdasarkan tanggal.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="gm-icon-button rounded-xl px-3 py-2"
                      aria-label="Bulan sebelumnya"
                      onClick={() =>
                        setCalendarMonth(
                          new Date(
                            calendarMonth.getFullYear(),
                            calendarMonth.getMonth() - 1,
                            1,
                          ),
                        )
                      }
                    >
                      ←
                    </button>
                    <span className="gm-heading min-w-32 text-center text-sm font-bold capitalize">
                      {monthName}
                    </span>
                    <button
                      type="button"
                      className="gm-icon-button rounded-xl px-3 py-2"
                      aria-label="Bulan berikutnya"
                      onClick={() =>
                        setCalendarMonth(
                          new Date(
                            calendarMonth.getFullYear(),
                            calendarMonth.getMonth() + 1,
                            1,
                          ),
                        )
                      }
                    >
                      →
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-2 text-center text-xs">
                  {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map(
                    (day) => (
                      <div key={day} className="gm-muted py-2 font-semibold">
                        {day}
                      </div>
                    ),
                  )}
                  {calendarDays.map((day, index) => {
                    const daySchedules = day
                      ? data.schedules.filter((item) => item.date === day).length
                      : 0;
                    const dayReminders = day
                      ? data.reminders.filter(
                          (item) => item.date === day && !item.completed,
                        ).length
                      : 0;
                    const dayExams = day
                      ? data.exams.filter(
                          (item) =>
                            item.date === day && item.status === "upcoming",
                        ).length
                      : 0;
                    const count = daySchedules + dayReminders + dayExams;

                    return (
                      <button
                        key={day ?? `empty-${index}`}
                        type="button"
                        disabled={!day}
                        onClick={() => {
                          if (day) {
                            setAttendanceDate(day);
                            setPage("Agenda & Reminder");
                          }
                        }}
                        className={`gm-calendar-day min-h-[66px] rounded-xl border p-2 text-left transition sm:min-h-24 sm:p-3 ${
                          day === today ? "is-today" : ""
                        } ${day ? "is-active" : "is-empty"}`}
                      >
                        {day && (
                          <>
                            <span className="text-xs font-semibold">
                              {Number(day.slice(-2))}
                            </span>
                            {count > 0 && (
                              <div className="mt-2 space-y-1">
                                <span className="gm-calendar-count inline-flex rounded-md px-1.5 py-1 text-[9px] font-bold sm:text-[10px]">
                                  {count} agenda
                                </span>
                                <div className="flex gap-1">
                                  {daySchedules > 0 && (
                                    <span className="gm-calendar-dot schedule" />
                                  )}
                                  {dayReminders > 0 && (
                                    <span className="gm-calendar-dot reminder" />
                                  )}
                                  {dayExams > 0 && (
                                    <span className="gm-calendar-dot exam" />
                                  )}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="gm-calendar-legend mt-5 flex flex-wrap gap-4 border-t pt-4 text-xs">
                  <span className="inline-flex items-center gap-2">
                    <span className="gm-calendar-dot schedule" /> Jadwal
                    mengajar
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="gm-calendar-dot reminder" /> Pengingat
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="gm-calendar-dot exam" /> Ujian
                  </span>
                </div>
              </section>
            )}

            {page === "Jadwal Mengajar" && (
              <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <section className={cardClass}>
                  <PageHeading
                    eyebrow="PENJADWALAN"
                    title="Tambah jadwal"
                    description="Catat waktu, kelas, dan materi yang akan diajarkan."
                  />
                  <form className="mt-5 space-y-4" onSubmit={submitSchedule}>
                    <Field label="Mata pelajaran">
                      <input
                        className={inputClass}
                        value={scheduleForm.subject}
                        onChange={(event) =>
                          setScheduleForm({
                            ...scheduleForm,
                            subject: event.target.value,
                          })
                        }
                        required
                        placeholder="Contoh: Matematika"
                      />
                    </Field>
                    <Field label="Kelas">
                      <input
                        className={inputClass}
                        value={scheduleForm.className}
                        onChange={(event) =>
                          setScheduleForm({
                            ...scheduleForm,
                            className: event.target.value,
                          })
                        }
                        required
                        placeholder="Contoh: VII A"
                      />
                    </Field>
                    <Field label="Tanggal">
                      <input
                        className={inputClass}
                        type="date"
                        value={scheduleForm.date}
                        onChange={(event) =>
                          setScheduleForm({
                            ...scheduleForm,
                            date: event.target.value,
                          })
                        }
                        required
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Mulai">
                        <input
                          className={inputClass}
                          type="time"
                          value={scheduleForm.startTime}
                          onChange={(event) =>
                            setScheduleForm({
                              ...scheduleForm,
                              startTime: event.target.value,
                            })
                          }
                          required
                        />
                      </Field>
                      <Field label="Selesai">
                        <input
                          className={inputClass}
                          type="time"
                          value={scheduleForm.endTime}
                          onChange={(event) =>
                            setScheduleForm({
                              ...scheduleForm,
                              endTime: event.target.value,
                            })
                          }
                          required
                        />
                      </Field>
                    </div>
                    <Field label="Ruang kelas">
                      <input
                        className={inputClass}
                        value={scheduleForm.room}
                        onChange={(event) =>
                          setScheduleForm({
                            ...scheduleForm,
                            room: event.target.value,
                          })
                        }
                        placeholder="Opsional"
                      />
                    </Field>
                    <Field label="Materi / catatan">
                      <textarea
                        className={inputClass}
                        rows={3}
                        value={scheduleForm.topic}
                        onChange={(event) =>
                          setScheduleForm({
                            ...scheduleForm,
                            topic: event.target.value,
                          })
                        }
                        placeholder="Materi yang akan diajarkan"
                      />
                    </Field>
                    <button className={buttonClass} type="submit">
                      Simpan jadwal →
                    </button>
                  </form>
                </section>

                <section className={cardClass}>
                  <PageHeading
                    eyebrow="JADWAL TERSIMPAN"
                    title="Jadwal mendatang"
                    description="Daftar jadwal yang belum lewat."
                  />
                  <div className="mt-5 space-y-3">
                    {upcomingSchedules.map((item) => (
                      <ScheduleCard key={item.id} item={item} showDate />
                    ))}
                    {!upcomingSchedules.length && (
                      <Empty
                        title="Belum ada jadwal"
                        detail="Jadwal yang kamu simpan akan muncul di sini."
                      />
                    )}
                  </div>
                </section>
              </div>
            )}

            {page === "Agenda & Reminder" && (
              <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <section className={cardClass}>
                  <PageHeading
                    eyebrow="PENGINGAT PRIBADI"
                    title="Buat pengingat"
                    description="Catat agenda supaya kegiatan penting tidak terlewat."
                  />
                  <form className="mt-5 space-y-4" onSubmit={submitReminder}>
                    <Field label="Judul agenda">
                      <input
                        className={inputClass}
                        value={reminderForm.title}
                        onChange={(event) =>
                          setReminderForm({
                            ...reminderForm,
                            title: event.target.value,
                          })
                        }
                        required
                        placeholder="Contoh: Persiapkan materi"
                      />
                    </Field>
                    <Field label="Keterangan">
                      <textarea
                        className={inputClass}
                        rows={3}
                        value={reminderForm.detail}
                        onChange={(event) =>
                          setReminderForm({
                            ...reminderForm,
                            detail: event.target.value,
                          })
                        }
                        placeholder="Detail pengingat"
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Tanggal">
                        <input
                          className={inputClass}
                          type="date"
                          value={reminderForm.date}
                          onChange={(event) =>
                            setReminderForm({
                              ...reminderForm,
                              date: event.target.value,
                            })
                          }
                          required
                        />
                      </Field>
                      <Field label="Waktu">
                        <input
                          className={inputClass}
                          type="time"
                          value={reminderForm.time}
                          onChange={(event) =>
                            setReminderForm({
                              ...reminderForm,
                              time: event.target.value,
                            })
                          }
                          required
                        />
                      </Field>
                    </div>
                    <Field label="Jenis pengingat">
                      <select
                        className={inputClass}
                        value={reminderForm.type}
                        onChange={(event) =>
                          setReminderForm({
                            ...reminderForm,
                            type: event.target.value as Reminder["type"],
                          })
                        }
                      >
                        <option value="today">Agenda hari ini</option>
                        <option value="tomorrow">Persiapan besok</option>
                        <option value="meeting">Rapat / pertemuan</option>
                      </select>
                    </Field>
                    <button className={buttonClass} type="submit">
                      Simpan pengingat →
                    </button>
                  </form>
                </section>

                <section className={cardClass}>
                  <PageHeading
                    eyebrow="DAFTAR AGENDA"
                    title="Daftar pengingat"
                    description="Tandai agenda yang sudah diselesaikan."
                  />
                  <div className="mt-5 space-y-3">
                    {data.reminders
                      .slice()
                      .sort((a, b) =>
                        `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
                      )
                      .map((item) => (
                        <ReminderRow
                          key={item.id}
                          item={item}
                          onToggle={() => finishReminder(item.id)}
                          showDate
                        />
                      ))}
                    {!data.reminders.length && (
                      <Empty
                        title="Belum ada pengingat"
                        detail="Buat pengingat pertama untuk mengatur agenda."
                      />
                    )}
                  </div>
                </section>
              </div>
            )}

            {page === "Ujian" && (
              <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <section className={cardClass}>
                  <PageHeading
                    eyebrow="EVALUASI AKADEMIK"
                    title="Tambah jadwal ujian"
                    description="Atur waktu ujian agar persiapannya lebih mudah."
                  />
                  <form className="mt-5 space-y-4" onSubmit={submitExam}>
                    <Field label="Nama ujian">
                      <input
                        className={inputClass}
                        value={examForm.title}
                        onChange={(event) =>
                          setExamForm({
                            ...examForm,
                            title: event.target.value,
                          })
                        }
                        required
                        placeholder="Contoh: Ulangan harian"
                      />
                    </Field>
                    <Field label="Mata pelajaran">
                      <input
                        className={inputClass}
                        value={examForm.subject}
                        onChange={(event) =>
                          setExamForm({
                            ...examForm,
                            subject: event.target.value,
                          })
                        }
                        required
                        placeholder="Contoh: IPA"
                      />
                    </Field>
                    <Field label="Kelas">
                      <input
                        className={inputClass}
                        value={examForm.className}
                        onChange={(event) =>
                          setExamForm({
                            ...examForm,
                            className: event.target.value,
                          })
                        }
                        required
                        placeholder="Contoh: VIII B"
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Tanggal">
                        <input
                          className={inputClass}
                          type="date"
                          value={examForm.date}
                          onChange={(event) =>
                            setExamForm({
                              ...examForm,
                              date: event.target.value,
                            })
                          }
                          required
                        />
                      </Field>
                      <Field label="Waktu">
                        <input
                          className={inputClass}
                          type="time"
                          value={examForm.time}
                          onChange={(event) =>
                            setExamForm({
                              ...examForm,
                              time: event.target.value,
                            })
                          }
                          required
                        />
                      </Field>
                    </div>
                    <Field label="Ruang">
                      <input
                        className={inputClass}
                        value={examForm.room}
                        onChange={(event) =>
                          setExamForm({
                            ...examForm,
                            room: event.target.value,
                          })
                        }
                        placeholder="Opsional"
                      />
                    </Field>
                    <button className={buttonClass} type="submit">
                      Simpan ujian →
                    </button>
                  </form>
                </section>

                <section className={cardClass}>
                  <PageHeading
                    eyebrow="JADWAL EVALUASI"
                    title="Ujian mendatang"
                    description="Daftar ujian yang masih berstatus akan datang."
                  />
                  <div className="mt-5 space-y-3">
                    {exams.map((item) => (
                      <div
                        key={item.id}
                        className="gm-exam-card rounded-2xl border p-4 sm:p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="gm-exam-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                              ▤
                            </div>
                            <div>
                              <h3 className="gm-heading font-bold">
                                {item.title}
                              </h3>
                              <p className="gm-muted mt-1 text-sm">
                                {item.subject} · {item.className}
                              </p>
                            </div>
                          </div>
                          <span className="gm-exam-date rounded-xl px-3 py-2 text-xs font-semibold">
                            {dateLabel(item.date)}
                          </span>
                        </div>
                        <div className="gm-muted mt-4 flex flex-wrap gap-3 border-t pt-3 text-xs">
                          <span>◷ {item.time}</span>
                          {item.room && <span>▣ Ruang {item.room}</span>}
                        </div>
                      </div>
                    ))}
                    {!exams.length && (
                      <Empty
                        title="Belum ada ujian"
                        detail="Jadwal ujian yang ditambahkan akan muncul di sini."
                      />
                    )}
                  </div>
                </section>
              </div>
            )}

            {page === "Akademik" && (
              <div className="space-y-6">
                <section className={cardClass}>
                  <PageHeading
                    eyebrow="PUSAT AKADEMIK"
                    title="Data akademik"
                    description="Kelola data siswa, ujian, dan nilai dalam satu tempat."
                  />
                  <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {[
                      {
                        label: "Jumlah siswa",
                        value: data.students.length,
                        icon: "◎",
                      },
                      {
                        label: "Data ujian",
                        value: data.exams.length,
                        icon: "▤",
                      },
                      {
                        label: "Nilai tersimpan",
                        value: data.grades.length,
                        icon: "✓",
                      },
                      {
                        label: "Jumlah kelas",
                        value: new Set(
                          data.students.map((item) => item.className),
                        ).size,
                        icon: "▦",
                      },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="gm-academic-stat rounded-2xl border p-4"
                      >
                        <div className="gm-academic-stat-icon flex h-9 w-9 items-center justify-center rounded-xl">
                          {stat.icon}
                        </div>
                        <p className="gm-heading mt-4 text-2xl font-extrabold">
                          {stat.value}
                        </p>
                        <p className="gm-muted mt-1 text-xs">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className={cardClass}>
                  <PageHeading
                    eyebrow="DATABASE SISWA"
                    title="Tambah siswa"
                    description="Masukkan identitas siswa untuk pencatatan akademik dan absensi."
                  />
                  <form
                    onSubmit={submitStudent}
                    className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
                  >
                    <Field label="Nama lengkap">
                      <input
                        className={inputClass}
                        value={studentForm.name}
                        onChange={(event) =>
                          setStudentForm({
                            ...studentForm,
                            name: event.target.value,
                          })
                        }
                        placeholder="Nama siswa"
                        required
                      />
                    </Field>
                    <Field label="Kelas">
                      <input
                        className={inputClass}
                        value={studentForm.className}
                        onChange={(event) =>
                          setStudentForm({
                            ...studentForm,
                            className: event.target.value,
                          })
                        }
                        placeholder="Contoh: X IPA 1"
                        required
                      />
                    </Field>
                    <Field label="NIS (opsional)">
                      <input
                        className={inputClass}
                        value={studentForm.nis}
                        onChange={(event) =>
                          setStudentForm({
                            ...studentForm,
                            nis: event.target.value,
                          })
                        }
                        placeholder="Nomor induk siswa"
                      />
                    </Field>
                    <div className="flex items-end">
                      <button className={`${buttonClass} w-full`} type="submit">
                        ＋ Simpan siswa
                      </button>
                    </div>
                  </form>
                </section>

                <section className={cardClass}>
                  <PageHeading
                    eyebrow="DATA TERSIMPAN"
                    title="Daftar siswa"
                    description="Daftar siswa yang telah dimasukkan."
                  />
                  <div className="mt-5 overflow-x-auto">
                    <table className="gm-data-table w-full min-w-[500px] text-left text-sm">
                      <thead>
                        <tr>
                          <th className="pb-3">Nama</th>
                          <th className="pb-3">Kelas</th>
                          <th className="pb-3">NIS</th>
                          <th className="pb-3">Rata-rata</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.students.map((item) => (
                          <tr key={item.id}>
                            <td className="py-3 font-semibold">{item.name}</td>
                            <td className="py-3">{item.className}</td>
                            <td className="py-3">{item.nis || "—"}</td>
                            <td className="py-3 font-bold">{item.average}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!data.students.length && (
                    <Empty
                      title="Belum ada data siswa"
                      detail="Data siswa yang tersedia akan muncul di tabel ini."
                    />
                  )}
                </section>

                <section className={cardClass}>
                  <PageHeading
                    eyebrow="PENILAIAN"
                    title="Input nilai siswa"
                    description="Nilai yang disimpan akan memperbarui rata-rata siswa secara otomatis."
                  />
                  <form
                    onSubmit={submitGrade}
                    className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
                  >
                    <Field label="Siswa">
                      <select
                        className={inputClass}
                        value={gradeForm.studentId}
                        onChange={(event) =>
                          setGradeForm({
                            ...gradeForm,
                            studentId: event.target.value,
                          })
                        }
                        required
                      >
                        <option value="">Pilih siswa</option>
                        {data.students.map((student) => (
                          <option key={student.id} value={student.id}>
                            {student.name} — {student.className}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Ujian">
                      <select
                        className={inputClass}
                        value={gradeForm.examId}
                        onChange={(event) =>
                          setGradeForm({
                            ...gradeForm,
                            examId: event.target.value,
                          })
                        }
                        required
                      >
                        <option value="">Pilih ujian</option>
                        {data.exams.map((exam) => (
                          <option key={exam.id} value={exam.id}>
                            {exam.title} — {exam.subject} ({exam.className})
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Nilai (0–100)">
                      <input
                        className={inputClass}
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={gradeForm.score}
                        onChange={(event) =>
                          setGradeForm({
                            ...gradeForm,
                            score: event.target.value,
                          })
                        }
                        placeholder="Contoh: 85"
                        required
                      />
                    </Field>
                    <div className="flex items-end">
                      <button
                        className={`${buttonClass} w-full`}
                        type="submit"
                        disabled={!data.students.length || !data.exams.length}
                      >
                        Simpan nilai
                      </button>
                    </div>
                  </form>
                  {(!data.students.length || !data.exams.length) && (
                    <p className="gm-inline-warning mt-3 rounded-xl px-3 py-2 text-xs">
                      Tambahkan data siswa dan jadwal ujian terlebih dahulu
                      sebelum memasukkan nilai.
                    </p>
                  )}
                </section>

                <section className={cardClass}>
                  <PageHeading
                    eyebrow="REKAP NILAI"
                    title="Nilai tersimpan"
                    description="Hasil penilaian yang sudah dimasukkan."
                  />
                  <div className="mt-5 space-y-2">
                    {data.grades.map((item) => (
                      <div
                        key={item.id}
                        className="gm-grade-row flex flex-wrap justify-between gap-3 rounded-xl border p-3 sm:p-4"
                      >
                        <span className="text-sm">
                          Siswa:{" "}
                          {data.students.find(
                            (student) => student.id === item.studentId,
                          )?.name ?? "Siswa dihapus"}{" "}
                          · Ujian:{" "}
                          {data.exams.find(
                            (exam) => exam.id === item.examId,
                          )?.title ?? "Ujian dihapus"}
                        </span>
                        <span className="gm-grade-score font-extrabold">
                          {item.score}
                        </span>
                      </div>
                    ))}
                    {!data.grades.length && (
                      <Empty
                        title="Belum ada nilai"
                        detail="Nilai yang sudah disimpan akan muncul di sini."
                      />
                    )}
                  </div>
                </section>
              </div>
            )}

            {page === "Absensi" && (
              <div className="space-y-6">
                <section className={cardClass}>
                  <PageHeading
                    eyebrow="KEHADIRAN KELAS"
                    title="Absensi siswa"
                    description="Pilih tanggal dan kelas, lalu tetapkan status kehadiran setiap siswa."
                  />
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <Field label="Tanggal absensi">
                      <input
                        className={inputClass}
                        type="date"
                        value={attendanceDate}
                        onChange={(event) =>
                          setAttendanceDate(event.target.value)
                        }
                      />
                    </Field>
                    <Field label="Kelas">
                      <select
                        className={inputClass}
                        value={attendanceClass}
                        onChange={(event) =>
                          setAttendanceClass(event.target.value)
                        }
                      >
                        <option value="">Pilih kelas</option>
                        {[
                          ...new Set(
                            data.students.map((student) => student.className),
                          ),
                        ]
                          .sort()
                          .map((className) => (
                            <option key={className} value={className}>
                              {className}
                            </option>
                          ))}
                      </select>
                    </Field>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="gm-heading font-bold">Daftar kehadiran</h3>
                    <span className="gm-muted text-xs">
                      {
                        data.students.filter(
                          (student) =>
                            !attendanceClass ||
                            student.className === attendanceClass,
                        ).length
                      }{" "}
                      siswa
                    </span>
                  </div>

                  {!data.students.length ? (
                    <Empty
                      title="Belum ada siswa"
                      detail="Tambahkan siswa terlebih dahulu di menu Akademik."
                    />
                  ) : !attendanceClass ? (
                    <Empty
                      title="Pilih kelas terlebih dahulu"
                      detail="Pilih kelas di atas untuk menampilkan daftar siswa yang akan diabsen."
                    />
                  ) : (
                    <div className="mt-4 space-y-2">
                      {data.students
                        .filter(
                          (student) => student.className === attendanceClass,
                        )
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((student, index) => {
                          const record = data.attendance.find(
                            (item) =>
                              item.studentId === student.id &&
                              item.date === attendanceDate,
                          );
                          const statusLabels: Record<
                            AttendanceStatus,
                            string
                          > = {
                            present: "Hadir",
                            late: "Terlambat",
                            permission: "Izin",
                            absent: "Alfa",
                          };

                          return (
                            <div
                              key={student.id}
                              className="gm-attendance-row grid gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_200px] sm:items-center"
                            >
                              <div>
                                <p className="gm-heading text-sm font-bold">
                                  {index + 1}. {student.name}
                                </p>
                                <p className="gm-muted mt-1 text-xs">
                                  NIS: {student.nis || "Belum diisi"} ·{" "}
                                  {student.className}
                                </p>
                                <p className="gm-muted mt-1 text-[11px]">
                                  Status:{" "}
                                  {record
                                    ? statusLabels[record.status]
                                    : "Belum diabsen"}
                                </p>
                              </div>
                              <Field label="Status kehadiran">
                                <select
                                  className={inputClass}
                                  value={record?.status ?? ""}
                                  onChange={(event) => {
                                    if (event.target.value) {
                                      saveAttendance(
                                        student.id,
                                        event.target.value as AttendanceStatus,
                                      );
                                    }
                                  }}
                                >
                                  <option value="">Pilih status</option>
                                  <option value="present">Hadir</option>
                                  <option value="late">Terlambat</option>
                                  <option value="permission">Izin</option>
                                  <option value="absent">Alfa</option>
                                </select>
                              </Field>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {attendanceClass &&
                    data.students.filter(
                      (student) => student.className === attendanceClass,
                    ).length === 0 && (
                      <Empty
                        title="Belum ada siswa di kelas ini"
                        detail="Tambahkan siswa dengan nama kelas yang sama di menu Akademik."
                      />
                    )}
                </section>

                <section className={cardClass}>
                  <PageHeading
                    eyebrow="RINGKASAN KEHADIRAN"
                    title={`Rekap absensi · ${dateLabel(attendanceDate)}`}
                    description={
                      attendanceClass
                        ? `Ringkasan kehadiran kelas ${attendanceClass}.`
                        : "Ringkasan seluruh kelas untuk tanggal yang dipilih."
                    }
                  />
                  <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {(
                      [
                        {
                          key: "present",
                          label: "Hadir",
                          icon: "✓",
                        },
                        {
                          key: "late",
                          label: "Terlambat",
                          icon: "◷",
                        },
                        {
                          key: "permission",
                          label: "Izin",
                          icon: "✉",
                        },
                        {
                          key: "absent",
                          label: "Alfa",
                          icon: "×",
                        },
                      ] as {
                        key: AttendanceStatus;
                        label: string;
                        icon: string;
                      }[]
                    ).map((status) => (
                      <div
                        key={status.key}
                        className="gm-attendance-stat rounded-2xl border p-4"
                      >
                        <span className="gm-muted text-lg">{status.icon}</span>
                        <p className="gm-heading mt-3 text-2xl font-extrabold">
                          {
                            data.attendance.filter(
                              (item) =>
                                item.date === attendanceDate &&
                                (!attendanceClass ||
                                  item.className === attendanceClass) &&
                                item.status === status.key,
                            ).length
                          }
                        </p>
                        <p className="gm-muted mt-1 text-xs">
                          {status.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {page === "Mengajar" && (
              <section className={cardClass}>
                <PageHeading
                  eyebrow="AKTIVITAS KELAS"
                  title="Ringkasan kegiatan mengajar"
                  description="Pantau pembagian kelas dan materi dari jadwal yang kamu simpan."
                />
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from(
                    new Set(data.schedules.map((item) => item.className)),
                  ).map((className) => {
                    const items = data.schedules
                      .filter((item) => item.className === className)
                      .sort((a, b) =>
                        `${a.date}${a.startTime}`.localeCompare(
                          `${b.date}${b.startTime}`,
                        ),
                      );

                    return (
                      <div
                        key={className}
                        className="gm-class-card rounded-2xl border p-4 sm:p-5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="gm-card-eyebrow">KELAS</p>
                            <h3 className="gm-heading mt-2 text-lg font-bold">
                              {className}
                            </h3>
                          </div>
                          <span className="gm-class-icon flex h-10 w-10 items-center justify-center rounded-xl">
                            ▣
                          </span>
                        </div>
                        <p className="gm-muted mt-1 text-xs">
                          {items.length} jadwal tersimpan
                        </p>
                        <div className="mt-4 space-y-3">
                          {items.slice(0, 4).map((item) => (
                            <div
                              key={item.id}
                              className="gm-class-schedule border-t pt-3"
                            >
                              <p className="gm-heading text-sm font-semibold">
                                {item.subject}
                              </p>
                              <p className="gm-muted mt-1 text-xs">
                                {dateLabel(item.date)} · {item.startTime}
                              </p>
                              {item.topic && (
                                <p className="gm-muted mt-1 text-xs">
                                  {item.topic}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {!data.schedules.length && (
                    <Empty
                      title="Belum ada kelas"
                      detail="Tambahkan jadwal mengajar terlebih dahulu."
                    />
                  )}
                </div>
              </section>
            )}

            {page === "Laporan" && (
              <div className="space-y-6">
                <section className={cardClass}>
                  <PageHeading
                    eyebrow="LAPORAN WORKSPACE"
                    title="Laporan aktivitas"
                    description="Ringkasan data GuruMate yang tersimpan saat ini."
                  />
                  <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
                    {[
                      {
                        label: "Jadwal mengajar",
                        value: data.schedules.length,
                        icon: "◷",
                      },
                      {
                        label: "Semua pengingat",
                        value: data.reminders.length,
                        icon: "✓",
                      },
                      {
                        label: "Ujian terdaftar",
                        value: data.exams.length,
                        icon: "▤",
                      },
                      {
                        label: "Nilai akademik",
                        value: data.grades.length,
                        icon: "◎",
                      },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="gm-report-stat rounded-2xl border p-4"
                      >
                        <span className="gm-report-icon flex h-9 w-9 items-center justify-center rounded-xl">
                          {stat.icon}
                        </span>
                        <p className="gm-heading mt-4 text-2xl font-extrabold">
                          {stat.value}
                        </p>
                        <p className="gm-muted mt-1 text-xs">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className={cardClass}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="gm-card-eyebrow">EKSPOR DATA</p>
                      <h3 className="gm-heading mt-2 text-lg font-bold">
                        Simpan laporan ke perangkat
                      </h3>
                      <p className="gm-muted mt-2 max-w-xl text-sm leading-relaxed">
                        Ekspor jadwal, agenda, ujian, data siswa, nilai, dan
                        absensi ke format CSV yang dapat dibuka di Excel atau
                        Google Sheets.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={downloadReport}
                      className={`${buttonClass} shrink-0`}
                    >
                      ↓ Unduh laporan CSV
                    </button>
                  </div>
                </section>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="gm-form-field block space-y-2">
      <span className="gm-field-label block text-xs font-semibold">
        {label}
      </span>
      {children}
    </label>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="gm-card-eyebrow">{eyebrow}</p>
      <h2 className="gm-heading mt-2 text-xl font-bold">{title}</h2>
      <p className="gm-muted mt-1 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function MiniSummaryRow({
  icon,
  label,
  value,
  accent,
}: {
  icon: string;
  label: string;
  value: number;
  accent: "blue" | "violet" | "amber";
}) {
  return (
    <div className={`gm-mini-summary gm-mini-${accent} flex items-center gap-3 rounded-xl border p-3`}>
      <div className="gm-mini-summary-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
        {icon}
      </div>
      <p className="gm-mini-summary-label min-w-0 flex-1 text-xs font-medium">
        {label}
      </p>
      <span className="gm-mini-summary-value text-lg font-extrabold">
        {value}
      </span>
    </div>
  );
}

function ScheduleCard({
  item,
  showDate = false,
}: {
  item: Schedule;
  showDate?: boolean;
}) {
  return (
    <div className="gm-schedule-card rounded-2xl border p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="gm-schedule-time flex h-14 min-w-20 flex-col items-center justify-center rounded-xl px-3">
          <span className="text-xs font-extrabold">{item.startTime}</span>
          <span className="gm-muted mt-1 text-[10px]">{item.endTime}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="gm-heading break-words font-bold">
            {item.subject} · {item.className}
          </h3>
          {item.topic && (
            <p className="gm-muted mt-1 break-words text-xs">{item.topic}</p>
          )}
          <div className="gm-muted mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {item.room && <span>▣ {item.room}</span>}
            {showDate && <span>▦ {dateLabel(item.date)}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReminderRow({
  item,
  onToggle,
  showDate = false,
}: {
  item: Reminder;
  onToggle: () => void;
  showDate?: boolean;
}) {
  return (
    <div className={`gm-reminder-row flex items-center gap-3 rounded-2xl border p-3 ${item.completed ? "is-completed" : ""}`}>
      <div className="gm-reminder-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
        {item.completed ? "✓" : "◷"}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`gm-heading break-words text-sm font-semibold ${
            item.completed ? "line-through opacity-60" : ""
          }`}
        >
          {item.title}
        </p>
        {item.detail && (
          <p className="gm-muted mt-1 break-words text-xs">{item.detail}</p>
        )}
        <p className="gm-muted mt-1 text-[10px]">
          {showDate ? dateLabel(item.date) : item.date} · {item.time}
        </p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className="gm-reminder-action shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition"
      >
        {item.completed ? "Aktifkan" : "Selesai"}
      </button>
    </div>
  );
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="gm-empty-state rounded-2xl border border-dashed p-8 text-center">
      <div className="gm-empty-icon mx-auto flex h-12 w-12 items-center justify-center rounded-2xl text-2xl">
        ◇
      </div>
      <p className="gm-heading mt-3 text-sm font-bold">{title}</p>
      <p className="gm-muted mx-auto mt-2 max-w-sm text-xs leading-relaxed">
        {detail}
      </p>
    </div>
  );
}

export default App;