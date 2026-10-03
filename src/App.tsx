
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import "./App.css";

import {
  getGuruMateData,
  saveGuruMateData,
  subscribeToGuruMateData,
  addSchedule,
  addReminder,
  addExam,
  toggleReminder,
  type GuruMateData,
  type Schedule,
  type Reminder,
} from "./data/storage";

import { loadCloudData, saveCloudData } from "./data/firebaseService";

const menus = [
  { name: "Dashboard", icon: "⌂" },
  { name: "Kalender", icon: "▦" },
  { name: "Jadwal Mengajar", icon: "◷" },
  { name: "Agenda & Reminder", icon: "✓" },
  { name: "Ujian", icon: "▤" },
  { name: "Akademik", icon: "◎" },
  { name: "Mengajar", icon: "▣" },
  { name: "Laporan", icon: "▥" },
];

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  "w-full rounded-xl border border-white/10 bg-[#0b101b] px-3 py-3 text-sm text-white outline-none focus:border-blue-400";
const buttonClass =
  "rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500";
const cardClass =
  "rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5";

function App() {
  const [page, setPage] = useState("Dashboard");
  const [data, setData] = useState<GuruMateData>(() => getGuruMateData());
  const [notice, setNotice] = useState("");

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
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useEffect(() => {
    const unsubscribe = subscribeToGuruMateData(() => {
      setData(getGuruMateData());
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function syncCloud() {
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
  }, []);

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
        .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)),
    [data.reminders],
  );

  const exams = useMemo(
    () =>
      data.exams
        .filter((item) => item.status === "upcoming")
        .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)),
    [data.exams],
  );

  function commit(next: GuruMateData, message = "Perubahan berhasil disimpan.") {
    saveGuruMateData(next);
    setData(next);
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3000);
  }

  function submitSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

  function finishReminder(id: string) {
    commit(toggleReminder(data, id), "Status pengingat diperbarui.");
  }

  function downloadReport() {
    const rows = [
      ["Jenis", "Nama", "Tanggal", "Waktu", "Keterangan"],
      ...data.schedules.map((s) => [
        "Jadwal",
        `${s.subject} - ${s.className}`,
        s.date,
        s.startTime,
        `${s.endTime}; ${s.room}; ${s.topic}`,
      ]),
      ...data.reminders.map((r) => [
        "Pengingat",
        r.title,
        r.date,
        r.time,
        `${r.detail}; ${r.completed ? "Selesai" : "Aktif"}`,
      ]),
      ...data.exams.map((e) => [
        "Ujian",
        `${e.title} - ${e.subject}`,
        e.date,
        e.time,
        `${e.className}; ${e.room}; ${e.status}`,
      ]),
      ...data.students.map((s) => [
        "Siswa",
        s.name,
        "",
        "",
        `${s.className}; NIS ${s.nis}; rata-rata ${s.average}`,
      ]),
      ...data.grades.map((g) => [
        "Nilai",
        g.studentId,
        "",
        "",
        `Ujian ${g.examId}; nilai ${g.score}`,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      )
      .join("\r\n");

    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `GuruMate-Laporan-${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const title = page === "Dashboard" ? "Dashboard" : page;
  const monthName = calendarMonth.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const count = new Date(year, month + 1, 0).getDate();
    const offset = (firstDay + 6) % 7;

    return [
      ...Array.from({ length: offset }, () => null),
      ...Array.from({ length: count }, (_, i) => {
        const day = i + 1;
        return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }),
    ];
  }, [calendarMonth]);

  return (
    <div className="min-h-screen bg-[#080b12] text-slate-200">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-white/[0.07] bg-[#0b0f18] lg:flex">
          <div className="flex h-20 items-center gap-3 border-b border-white/[0.07] px-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-xl font-bold text-white">
              G
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">GuruMate</h1>
              <p className="text-xs text-slate-500">Teacher Assistant</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1 p-3">
            <p className="px-3 pb-3 pt-4 text-[10px] font-bold uppercase tracking-widest text-slate-600">
              Menu utama
            </p>
            {menus.map((item) => (
              <button
                key={item.name}
                onClick={() => setPage(item.name)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                  page === item.name
                    ? "bg-blue-500/10 font-semibold text-blue-300"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                <span className="w-6 text-center">{item.icon}</span>
                {item.name}
              </button>
            ))}
          </nav>

          <div className="m-4 rounded-2xl border border-blue-400/10 bg-blue-500/[0.06] p-4">
            <p className="text-sm font-semibold text-white">GuruMate Assistant</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Kelola jadwal, agenda, ujian, dan administrasi mengajar dalam satu tempat.
            </p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 pb-24 lg:pb-0">
          <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-white/[0.07] bg-[#080b12]/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-300">
                {title}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {new Date().toLocaleDateString("id-ID", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <button
              onClick={() => setPage("Agenda & Reminder")}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-lg hover:bg-white/5"
              aria-label="Buka pengingat"
            >
              ♢
              {reminders.length > 0 && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-blue-400" />
              )}
            </button>
          </header>

          <div className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
            {notice && (
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
                {notice}
              </div>
            )}

            {page === "Dashboard" && (
              <>
                <section className="relative overflow-hidden rounded-3xl border border-blue-400/10 bg-gradient-to-br from-[#142341] via-[#101729] to-[#11121d] p-6 sm:p-8">
                  <div className="pointer-events-none absolute -right-12 -top-16 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
                  <div className="relative">
                    <span className="rounded-full border border-blue-300/20 bg-blue-400/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-blue-200">
                      Personal Teaching Workspace
                    </span>
                    <h2 className="mt-6 max-w-xl text-3xl font-bold leading-tight text-white sm:text-4xl">
                      Semua aktivitas mengajar, lebih teratur.
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
                      Pantau jadwal kelas, persiapkan ujian, dan jangan lewatkan agenda penting hari ini.
                    </p>
                    <button
                      onClick={() => setPage("Jadwal Mengajar")}
                      className={`${buttonClass} mt-6`}
                    >
                      Kelola jadwal →
                    </button>
                  </div>
                </section>

                <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                  {[
                    { label: "Jadwal hari ini", value: schedulesToday.length, icon: "◷" },
                    { label: "Pengingat aktif", value: reminders.length, icon: "✓" },
                    { label: "Ujian mendatang", value: exams.length, icon: "▤" },
                    {
                      label: "Kelas terdaftar",
                      value: new Set(data.schedules.map((s) => s.className)).size,
                      icon: "▦",
                    },
                  ].map((stat) => (
                    <div key={stat.label} className={cardClass}>
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300">
                        {stat.icon}
                      </div>
                      <p className="mt-4 text-2xl font-bold text-white">{stat.value}</p>
                      <p className="mt-1 text-xs text-slate-500">{stat.label}</p>
                    </div>
                  ))}
                </section>

                <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
                  <section className={cardClass}>
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-white">Jadwal hari ini</h3>
                        <p className="mt-1 text-xs text-slate-500">Agenda kegiatan mengajar</p>
                      </div>
                      <button onClick={() => setPage("Jadwal Mengajar")} className="text-xs text-blue-300">
                        Lihat semua →
                      </button>
                    </div>
                    {schedulesToday.length ? (
                      <div className="space-y-3">
                        {schedulesToday.map((s) => <ScheduleCard key={s.id} item={s} />)}
                      </div>
                    ) : (
                      <Empty title="Belum ada jadwal hari ini" detail="Tambahkan jadwal mengajar agar agenda tampil di sini." />
                    )}
                  </section>

                  <section className={cardClass}>
                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-white">Pengingat aktif</h3>
                        <p className="mt-1 text-xs text-slate-500">Agenda yang belum selesai</p>
                      </div>
                      <button onClick={() => setPage("Agenda & Reminder")} className="text-xs text-blue-300">
                        Kelola →
                      </button>
                    </div>
                    {reminders.slice(0, 5).length ? (
                      <div className="space-y-2">
                        {reminders.slice(0, 5).map((r) => (
                          <ReminderRow key={r.id} item={r} onToggle={() => finishReminder(r.id)} />
                        ))}
                      </div>
                    ) : (
                      <Empty title="Semua agenda selesai" detail="Pengingat baru akan muncul di sini." />
                    )}
                  </section>
                </div>

                <section className={cardClass}>
                  <div className="mb-5 flex items-center justify-between">
                    <h3 className="font-semibold text-white">Agenda berikutnya</h3>
                    <button onClick={() => setPage("Kalender")} className="text-xs text-blue-300">Buka kalender →</button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {upcomingSchedules.slice(0, 3).map((s) => (
                      <div key={s.id} className="rounded-xl border border-white/[0.07] p-4">
                        <p className="text-xs text-blue-300">{dateLabel(s.date)}</p>
                        <p className="mt-2 font-semibold text-white">{s.subject}</p>
                        <p className="mt-1 text-xs text-slate-500">{s.className} · {s.startTime}</p>
                      </div>
                    ))}
                    {!upcomingSchedules.length && (
                      <p className="text-sm text-slate-500">Belum ada agenda mendatang.</p>
                    )}
                  </div>
                </section>
              </>
            )}

            {page === "Jadwal Mengajar" && (
              <div className="grid items-start gap-6 xl:grid-cols-[360px_1fr]">
                <section className={cardClass}>
                  <h2 className="mb-5 text-lg font-semibold text-white">Tambah jadwal</h2>
                  <form onSubmit={submitSchedule} className="space-y-3">
                    <Field label="Mata pelajaran">
                      <input required className={inputClass} value={scheduleForm.subject} onChange={(e) => setScheduleForm({ ...scheduleForm, subject: e.target.value })} placeholder="Contoh: Matematika" />
                    </Field>
                    <Field label="Kelas">
                      <input required className={inputClass} value={scheduleForm.className} onChange={(e) => setScheduleForm({ ...scheduleForm, className: e.target.value })} placeholder="Contoh: X IPA 1" />
                    </Field>
                    <Field label="Tanggal">
                      <input required type="date" className={inputClass} value={scheduleForm.date} onChange={(e) => setScheduleForm({ ...scheduleForm, date: e.target.value })} />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Mulai">
                        <input required type="time" className={inputClass} value={scheduleForm.startTime} onChange={(e) => setScheduleForm({ ...scheduleForm, startTime: e.target.value })} />
                      </Field>
                      <Field label="Selesai">
                        <input required type="time" className={inputClass} value={scheduleForm.endTime} onChange={(e) => setScheduleForm({ ...scheduleForm, endTime: e.target.value })} />
                      </Field>
                    </div>
                    <Field label="Ruangan">
                      <input required className={inputClass} value={scheduleForm.room} onChange={(e) => setScheduleForm({ ...scheduleForm, room: e.target.value })} placeholder="Ruang 12" />
                    </Field>
                    <Field label="Materi">
                      <input required className={inputClass} value={scheduleForm.topic} onChange={(e) => setScheduleForm({ ...scheduleForm, topic: e.target.value })} placeholder="Materi pembelajaran" />
                    </Field>
                    <button className={`${buttonClass} w-full`}>Simpan jadwal</button>
                  </form>
                </section>

                <section className={cardClass}>
                  <h2 className="mb-5 text-lg font-semibold text-white">Semua jadwal</h2>
                  <div className="space-y-3">
                    {upcomingSchedules.map((s) => <ScheduleCard key={s.id} item={s} showDate />)}
                    {!upcomingSchedules.length && <Empty title="Belum ada jadwal" detail="Jadwal yang kamu buat akan ditampilkan di sini." />}
                  </div>
                </section>
              </div>
            )}

            {page === "Agenda & Reminder" && (
              <div className="grid items-start gap-6 xl:grid-cols-[360px_1fr]">
                <section className={cardClass}>
                  <h2 className="mb-5 text-lg font-semibold text-white">Buat pengingat</h2>
                  <form onSubmit={submitReminder} className="space-y-3">
                    <Field label="Nama agenda">
                      <input required className={inputClass} value={reminderForm.title} onChange={(e) => setReminderForm({ ...reminderForm, title: e.target.value })} placeholder="Contoh: Siapkan materi" />
                    </Field>
                    <Field label="Keterangan">
                      <textarea required className={inputClass} rows={3} value={reminderForm.detail} onChange={(e) => setReminderForm({ ...reminderForm, detail: e.target.value })} placeholder="Catatan tambahan" />
                    </Field>
                    <Field label="Tanggal">
                      <input required type="date" className={inputClass} value={reminderForm.date} onChange={(e) => setReminderForm({ ...reminderForm, date: e.target.value })} />
                    </Field>
                    <Field label="Waktu">
                      <input required type="time" className={inputClass} value={reminderForm.time} onChange={(e) => setReminderForm({ ...reminderForm, time: e.target.value })} />
                    </Field>
                    <Field label="Jenis pengingat">
                      <select className={inputClass} value={reminderForm.type} onChange={(e) => setReminderForm({ ...reminderForm, type: e.target.value as Reminder["type"] })}>
                        <option value="today">Agenda hari ini</option>
                        <option value="tomorrow">Persiapan besok</option>
                        <option value="meeting">Rapat / pertemuan</option>
                      </select>
                    </Field>
                    <button className={`${buttonClass} w-full`}>Simpan pengingat</button>
                  </form>
                </section>

                <section className={cardClass}>
                  <h2 className="mb-5 text-lg font-semibold text-white">Agenda aktif</h2>
                  <div className="space-y-3">
                    {reminders.map((r) => <ReminderRow key={r.id} item={r} onToggle={() => finishReminder(r.id)} showDate />)}
                    {!reminders.length && <Empty title="Tidak ada pengingat aktif" detail="Buat pengingat untuk mencatat agenda penting." />}
                  </div>
                  <h3 className="mb-3 mt-8 font-semibold text-white">Agenda selesai</h3>
                  <div className="space-y-2">
                    {data.reminders.filter((r) => r.completed).map((r) => (
                      <ReminderRow key={r.id} item={r} onToggle={() => finishReminder(r.id)} showDate />
                    ))}
                    {!data.reminders.some((r) => r.completed) && (
                      <p className="text-xs text-slate-500">Belum ada agenda yang diselesaikan.</p>
                    )}
                  </div>
                </section>
              </div>
            )}

            {page === "Ujian" && (
              <div className="grid items-start gap-6 xl:grid-cols-[360px_1fr]">
                <section className={cardClass}>
                  <h2 className="mb-5 text-lg font-semibold text-white">Tambah ujian</h2>
                  <form onSubmit={submitExam} className="space-y-3">
                    <Field label="Nama ujian">
                      <input required className={inputClass} value={examForm.title} onChange={(e) => setExamForm({ ...examForm, title: e.target.value })} placeholder="Ujian Tengah Semester" />
                    </Field>
                    <Field label="Mata pelajaran">
                      <input required className={inputClass} value={examForm.subject} onChange={(e) => setExamForm({ ...examForm, subject: e.target.value })} placeholder="Bahasa Indonesia" />
                    </Field>
                    <Field label="Kelas">
                      <input required className={inputClass} value={examForm.className} onChange={(e) => setExamForm({ ...examForm, className: e.target.value })} placeholder="XI IPA 2" />
                    </Field>
                    <Field label="Tanggal">
                      <input required type="date" className={inputClass} value={examForm.date} onChange={(e) => setExamForm({ ...examForm, date: e.target.value })} />
                    </Field>
                    <Field label="Waktu">
                      <input required type="time" className={inputClass} value={examForm.time} onChange={(e) => setExamForm({ ...examForm, time: e.target.value })} />
                    </Field>
                    <Field label="Ruangan">
                      <input required className={inputClass} value={examForm.room} onChange={(e) => setExamForm({ ...examForm, room: e.target.value })} placeholder="Ruang ujian" />
                    </Field>
                    <button className={`${buttonClass} w-full`}>Simpan ujian</button>
                  </form>
                </section>
                <section className={cardClass}>
                  <h2 className="mb-5 text-lg font-semibold text-white">Daftar ujian</h2>
                  <div className="space-y-3">
                    {exams.map((exam) => (
                      <div key={exam.id} className="rounded-xl border border-white/[0.07] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-white">{exam.title}</h3>
                            <p className="mt-1 text-sm text-slate-400">{exam.subject} · {exam.className}</p>
                            <p className="mt-2 text-xs text-slate-500">{dateLabel(exam.date)} · {exam.time} · {exam.room}</p>
                          </div>
                          <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs text-blue-300">Mendatang</span>
                        </div>
                      </div>
                    ))}
                    {!exams.length && <Empty title="Belum ada ujian" detail="Tambahkan jadwal ujian pada formulir." />}
                  </div>
                </section>
              </div>
            )}

            {page === "Kalender" && (
              <section className={cardClass}>
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-white">{monthName}</h2>
                    <p className="mt-1 text-xs text-slate-500">Jadwal mengajar dan ujian</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded-lg border border-white/10 px-3 py-2 hover:bg-white/5" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>←</button>
                    <button className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/5" onClick={() => setCalendarMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Hari ini</button>
                    <button className="rounded-lg border border-white/10 px-3 py-2 hover:bg-white/5" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>→</button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => (
                    <div key={day} className="py-2 text-center text-xs text-slate-500">{day}</div>
                  ))}
                  {calendarDays.map((date, i) => {
                    if (!date) return <div key={`empty-${i}`} />;
                    const daySchedules = data.schedules.filter((s) => s.date === date);
                    const dayExams = data.exams.filter((e) => e.date === date);
                    const isToday = date === today;
                    return (
                      <div key={date} className={`min-h-24 rounded-xl border p-2 ${isToday ? "border-blue-400/40 bg-blue-500/10" : "border-white/[0.06] bg-white/[0.015]"}`}>
                        <p className={`text-xs font-semibold ${isToday ? "text-blue-300" : "text-slate-400"}`}>{Number(date.slice(-2))}</p>
                        {daySchedules.slice(0, 2).map((s) => (
                          <p key={s.id} className="mt-2 truncate rounded bg-blue-500/10 px-1 py-1 text-[9px] text-blue-300" title={s.subject}>{s.startTime} {s.subject}</p>
                        ))}
                        {dayExams.slice(0, 1).map((e) => (
                          <p key={e.id} className="mt-1 truncate rounded bg-violet-500/10 px-1 py-1 text-[9px] text-violet-300" title={e.title}>{e.time} Ujian</p>
                        ))}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-5 flex flex-wrap gap-4 text-xs text-slate-400">
                  <span>🔵 Jadwal mengajar</span><span>🟣 Ujian</span>
                </div>
              </section>
            )}

            {page === "Akademik" && (
              <div className="space-y-6">
                <section className={cardClass}>
                  <h2 className="text-lg font-semibold text-white">Data akademik</h2>
                  <p className="mt-2 text-sm text-slate-500">Ringkasan data siswa dan nilai yang tersimpan.</p>
                  <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {[
                      ["Jumlah siswa", data.students.length],
                      ["Data ujian", data.exams.length],
                      ["Nilai tersimpan", data.grades.length],
                      ["Kelas", new Set(data.students.map((s) => s.className)).size],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-xl border border-white/[0.07] p-4">
                        <p className="text-2xl font-bold text-white">{value}</p>
                        <p className="mt-1 text-xs text-slate-500">{label}</p>
                      </div>
                    ))}
                  </div>
                </section>
                <section className={cardClass}>
                  <h3 className="mb-4 font-semibold text-white">Daftar siswa</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px] text-left text-sm">
                      <thead className="text-xs text-slate-500">
                        <tr><th className="pb-3">Nama</th><th className="pb-3">Kelas</th><th className="pb-3">NIS</th><th className="pb-3">Rata-rata</th></tr>
                      </thead>
                      <tbody>
                        {data.students.map((student) => (
                          <tr key={student.id} className="border-t border-white/[0.06]">
                            <td className="py-3 text-white">{student.name}</td>
                            <td className="py-3 text-slate-400">{student.className}</td>
                            <td className="py-3 text-slate-400">{student.nis}</td>
                            <td className="py-3 text-blue-300">{student.average}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!data.students.length && <Empty title="Belum ada data siswa" detail="Data siswa yang tersedia akan muncul di tabel ini." />}
                </section>
                <section className={cardClass}>
                  <h3 className="mb-4 font-semibold text-white">Nilai tersimpan</h3>
                  <div className="space-y-2">
                    {data.grades.map((grade) => (
                      <div key={grade.id} className="flex flex-wrap justify-between gap-3 rounded-xl border border-white/[0.06] p-3">
                        <span className="text-sm text-slate-300">Siswa: {grade.studentId} · Ujian: {grade.examId}</span>
                        <span className="font-semibold text-blue-300">{grade.score}</span>
                      </div>
                    ))}
                    {!data.grades.length && <p className="text-sm text-slate-500">Belum ada nilai tersimpan.</p>}
                  </div>
                </section>
              </div>
            )}

            {page === "Mengajar" && (
              <section className={cardClass}>
                <h2 className="text-xl font-semibold text-white">Ringkasan kegiatan mengajar</h2>
                <p className="mt-2 text-sm text-slate-500">Pantau pembagian kelas dan materi dari jadwal yang kamu simpan.</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from(new Set(data.schedules.map((s) => s.className))).map((className) => {
                    const items = data.schedules.filter((s) => s.className === className);
                    return (
                      <div key={className} className="rounded-xl border border-white/[0.07] p-4">
                        <p className="text-xs text-blue-300">Kelas</p>
                        <h3 className="mt-2 text-lg font-semibold text-white">{className}</h3>
                        <p className="mt-1 text-xs text-slate-500">{items.length} jadwal tersimpan</p>
                        <div className="mt-4 space-y-2">
                          {items.slice(0, 4).map((s) => (
                            <div key={s.id} className="border-t border-white/[0.06] pt-2">
                              <p className="text-sm text-slate-300">{s.subject}</p>
                              <p className="mt-1 text-xs text-slate-500">{dateLabel(s.date)} · {s.topic}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {!data.schedules.length && <Empty title="Belum ada kelas" detail="Tambahkan jadwal mengajar terlebih dahulu." />}
                </div>
              </section>
            )}

            {page === "Laporan" && (
              <section className={cardClass}>
                <h2 className="text-xl font-semibold text-white">Laporan aktivitas</h2>
                <p className="mt-2 text-sm text-slate-500">Ringkasan data GuruMate yang tersimpan saat ini.</p>
                <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
                  {[
                    ["Jadwal mengajar", data.schedules.length],
                    ["Semua pengingat", data.reminders.length],
                    ["Ujian terdaftar", data.exams.length],
                    ["Nilai akademik", data.grades.length],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-xl border border-white/[0.07] p-4">
                      <p className="text-2xl font-bold text-white">{value}</p>
                      <p className="mt-1 text-xs text-slate-500">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 rounded-xl border border-white/[0.07] p-4">
                  <h3 className="font-semibold text-white">Ekspor data</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">Unduh jadwal, agenda, ujian, siswa, dan nilai sebagai CSV yang bisa dibuka di Excel atau Google Sheets.</p>
                  <button onClick={downloadReport} className={`${buttonClass} mt-4`}>Unduh laporan CSV</button>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-white/[0.08] bg-[#0b0f18]/95 px-1 py-2 backdrop-blur-xl lg:hidden">
        {menus.slice(0, 5).map((item) => (
          <button
            key={item.name}
            onClick={() => setPage(item.name)}
            className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[9px] ${page === item.name ? "text-blue-300" : "text-slate-500"}`}
          >
            <span className="text-lg">{item.icon}</span>
            <span>{item.name === "Agenda & Reminder" ? "Agenda" : item.name}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function ScheduleCard({ item, showDate = false }: { item: Schedule; showDate?: boolean }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.015] p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-12 min-w-20 flex-col items-center justify-center rounded-lg bg-blue-500/10 px-2">
          <span className="text-xs font-semibold text-blue-300">{item.startTime}</span>
          <span className="mt-1 text-[10px] text-slate-500">{item.endTime}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-white">{item.subject} · {item.className}</h3>
          <p className="mt-1 text-xs text-slate-400">{item.topic}</p>
          <p className="mt-2 text-xs text-slate-500">{item.room}{showDate ? ` · ${dateLabel(item.date)}` : ""}</p>
        </div>
      </div>
    </div>
  );
}

function ReminderRow({ item, onToggle, showDate = false }: { item: Reminder; onToggle: () => void; showDate?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">✓</div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${item.completed ? "text-slate-500 line-through" : "text-white"}`}>{item.title}</p>
        <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
        <p className="mt-1 text-[10px] text-slate-600">{showDate ? dateLabel(item.date) : item.date} · {item.time}</p>
      </div>
      <button onClick={onToggle} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5">
        {item.completed ? "Aktifkan" : "Selesai"}
      </button>
    </div>
  );
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
      <div className="text-2xl text-slate-600">◇</div>
      <p className="mt-3 text-sm font-semibold text-slate-300">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-slate-500">{detail}</p>
    </div>
  );
}

export default App;