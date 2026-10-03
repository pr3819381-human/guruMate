
import { saveCloudData } from "./firebaseService";

export type Schedule = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  subject: string;
  className: string;
  room: string;
  topic: string;
  color: string;
};

export type ReminderType = "today" | "tomorrow" | "meeting";

export type Reminder = {
  id: string;
  title: string;
  detail: string;
  date: string;
  time: string;
  type: ReminderType;
  completed: boolean;
};

export type Exam = {
  id: string;
  title: string;
  subject: string;
  className: string;
  date: string;
  time: string;
  room: string;
  status: "upcoming" | "completed";
};

export type Student = {
  id: string;
  name: string;
  className: string;
  nis: string;
  average: number;
};

export type Grade = {
  id: string;
  studentId: string;
  examId: string;
  score: number;
};

export type Activity = {
  id: string;
  title: string;
  detail: string;
  date: string;
  type: "schedule" | "reminder" | "exam" | "grade";
};

export type GuruMateData = {
  schedules: Schedule[];
  reminders: Reminder[];
  exams: Exam[];
  students: Student[];
  grades: Grade[];
  activities: Activity[];
};

const STORAGE_KEY = "gurumateData";
const CHANGE_EVENT = "gurumateDataChanged";

const createId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// Menghasilkan tanggal lokal tanpa pergeseran zona waktu.
function getLocalDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return getLocalDate(date);
}

const initialData: GuruMateData = {
  schedules: [
    {
      id: "schedule-1",
      date: getLocalDate(),
      startTime: "07:00",
      endTime: "08:30",
      subject: "Matematika",
      className: "X IPA 1",
      room: "Ruang 12",
      topic: "Persamaan Kuadrat",
      color: "from-blue-500 to-indigo-500",
    },
    {
      id: "schedule-2",
      date: getLocalDate(),
      startTime: "09:00",
      endTime: "10:30",
      subject: "Matematika",
      className: "XI IPA 2",
      room: "Ruang 15",
      topic: "Integral Dasar",
      color: "from-violet-500 to-purple-500",
    },
    {
      id: "schedule-3",
      date: getLocalDate(),
      startTime: "11:00",
      endTime: "12:30",
      subject: "Matematika",
      className: "X IPA 3",
      room: "Ruang 10",
      topic: "Fungsi Kuadrat",
      color: "from-cyan-500 to-blue-500",
    },
  ],

  reminders: [
    {
      id: "reminder-1",
      title: "Meeting Guru",
      detail: "Ruang Guru",
      date: getLocalDate(),
      time: "09:30",
      type: "today",
      completed: false,
    },
    {
      id: "reminder-2",
      title: "Ulangan Matematika",
      detail: "XI IPA 2",
      date: addDays(1),
      time: "08:00",
      type: "tomorrow",
      completed: false,
    },
    {
      id: "reminder-3",
      title: "Rapat Wali Kelas",
      detail: "Aula Sekolah",
      date: addDays(3),
      time: "13:00",
      type: "meeting",
      completed: false,
    },
  ],

  exams: [
    {
      id: "exam-1",
      title: "Ulangan Matematika",
      subject: "Matematika",
      className: "XI IPA 2",
      date: addDays(1),
      time: "08:00",
      room: "Ruang 15",
      status: "upcoming",
    },
  ],

  students: [
    {
      id: "student-1",
      name: "Andi Pratama",
      className: "X IPA 1",
      nis: "1001",
      average: 82,
    },
    {
      id: "student-2",
      name: "Siti Rahma",
      className: "X IPA 1",
      nis: "1002",
      average: 88,
    },
    {
      id: "student-3",
      name: "Budi Santoso",
      className: "XI IPA 2",
      nis: "1101",
      average: 76,
    },
    {
      id: "student-4",
      name: "Ayu Lestari",
      className: "XI IPA 2",
      nis: "1102",
      average: 91,
    },
  ],

  grades: [],
  activities: [],
};

function cloneInitialData(): GuruMateData {
  return JSON.parse(JSON.stringify(initialData)) as GuruMateData;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeData(value: unknown): GuruMateData {
  const parsed = isObject(value) ? value : {};

  return {
    schedules: Array.isArray(parsed.schedules)
      ? (parsed.schedules as Schedule[])
      : [],
    reminders: Array.isArray(parsed.reminders)
      ? (parsed.reminders as Reminder[])
      : [],
    exams: Array.isArray(parsed.exams)
      ? (parsed.exams as Exam[])
      : [],
    students: Array.isArray(parsed.students)
      ? (parsed.students as Student[])
      : [],
    grades: Array.isArray(parsed.grades)
      ? (parsed.grades as Grade[])
      : [],
    activities: Array.isArray(parsed.activities)
      ? (parsed.activities as Activity[])
      : [],
  };
}

function notifyDataChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  }
}

export function getGuruMateData(): GuruMateData {
  try {
    if (typeof window === "undefined") {
      return cloneInitialData();
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      const initial = cloneInitialData();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }

    return normalizeData(JSON.parse(raw) as unknown);
  } catch (error) {
    console.warn("GuruMate gagal membaca penyimpanan lokal:", error);
    return cloneInitialData();
  }
}

export function saveGuruMateData(data: GuruMateData): void {
  const normalized = normalizeData(data);

  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(normalized),
      );

      notifyDataChanged();
    }
  } catch (error) {
    console.error("GuruMate gagal menyimpan data lokal:", error);
  }

  // Simpan ke cloud tanpa menghambat penggunaan aplikasi.
  void saveCloudData(normalized).catch((error: unknown) => {
    console.warn("GuruMate gagal menyimpan data cloud:", error);
  });
}

export function resetGuruMateData(): GuruMateData {
  const data = cloneInitialData();
  saveGuruMateData(data);
  return data;
}

export function addSchedule(
  data: GuruMateData,
  schedule: Omit<Schedule, "id">,
): GuruMateData {
  return {
    ...data,
    schedules: [
      ...data.schedules,
      {
        ...schedule,
        id: createId("schedule"),
      },
    ],
  };
}

export function updateSchedule(
  data: GuruMateData,
  scheduleId: string,
  updates: Partial<Omit<Schedule, "id">>,
): GuruMateData {
  return {
    ...data,
    schedules: data.schedules.map((schedule) =>
      schedule.id === scheduleId
        ? { ...schedule, ...updates }
        : schedule,
    ),
  };
}

export function deleteSchedule(
  data: GuruMateData,
  scheduleId: string,
): GuruMateData {
  return {
    ...data,
    schedules: data.schedules.filter(
      (schedule) => schedule.id !== scheduleId,
    ),
  };
}

export function addReminder(
  data: GuruMateData,
  reminder: Omit<Reminder, "id" | "completed">,
): GuruMateData {
  return {
    ...data,
    reminders: [
      ...data.reminders,
      {
        ...reminder,
        id: createId("reminder"),
        completed: false,
      },
    ],
  };
}

export function updateReminder(
  data: GuruMateData,
  reminderId: string,
  updates: Partial<Omit<Reminder, "id">>,
): GuruMateData {
  return {
    ...data,
    reminders: data.reminders.map((reminder) =>
      reminder.id === reminderId
        ? { ...reminder, ...updates }
        : reminder,
    ),
  };
}

export function deleteReminder(
  data: GuruMateData,
  reminderId: string,
): GuruMateData {
  return {
    ...data,
    reminders: data.reminders.filter(
      (reminder) => reminder.id !== reminderId,
    ),
  };
}

export function toggleReminder(
  data: GuruMateData,
  reminderId: string,
): GuruMateData {
  return {
    ...data,
    reminders: data.reminders.map((reminder) =>
      reminder.id === reminderId
        ? { ...reminder, completed: !reminder.completed }
        : reminder,
    ),
  };
}

export function addExam(
  data: GuruMateData,
  exam: Omit<Exam, "id" | "status">,
): GuruMateData {
  return {
    ...data,
    exams: [
      ...data.exams,
      {
        ...exam,
        id: createId("exam"),
        status: "upcoming",
      },
    ],
  };
}

export function updateExam(
  data: GuruMateData,
  examId: string,
  updates: Partial<Omit<Exam, "id">>,
): GuruMateData {
  return {
    ...data,
    exams: data.exams.map((exam) =>
      exam.id === examId ? { ...exam, ...updates } : exam,
    ),
  };
}

export function deleteExam(
  data: GuruMateData,
  examId: string,
): GuruMateData {
  return {
    ...data,
    exams: data.exams.filter((exam) => exam.id !== examId),
  };
}

export function addStudent(
  data: GuruMateData,
  student: Omit<Student, "id">,
): GuruMateData {
  return {
    ...data,
    students: [
      ...data.students,
      {
        ...student,
        id: createId("student"),
      },
    ],
  };
}

export function updateStudent(
  data: GuruMateData,
  studentId: string,
  updates: Partial<Omit<Student, "id">>,
): GuruMateData {
  return {
    ...data,
    students: data.students.map((student) =>
      student.id === studentId
        ? { ...student, ...updates }
        : student,
    ),
  };
}

export function deleteStudent(
  data: GuruMateData,
  studentId: string,
): GuruMateData {
  return {
    ...data,
    students: data.students.filter(
      (student) => student.id !== studentId,
    ),
    grades: data.grades.filter(
      (grade) => grade.studentId !== studentId,
    ),
  };
}

export function addGrade(
  data: GuruMateData,
  grade: Omit<Grade, "id">,
): GuruMateData {
  const newGrade: Grade = {
    ...grade,
    id: createId("grade"),
  };

  const grades = [...data.grades, newGrade];

  const studentGrades = grades.filter(
    (item) => item.studentId === grade.studentId,
  );

  const average = studentGrades.length
    ? Math.round(
        studentGrades.reduce((total, item) => total + item.score, 0) /
          studentGrades.length,
      )
    : 0;

  return {
    ...data,
    grades,
    students: data.students.map((student) =>
      student.id === grade.studentId
        ? { ...student, average }
        : student,
    ),
  };
}

export function updateGrade(
  data: GuruMateData,
  gradeId: string,
  updates: Partial<Omit<Grade, "id">>,
): GuruMateData {
  const grades = data.grades.map((grade) =>
    grade.id === gradeId ? { ...grade, ...updates } : grade,
  );

  const students = data.students.map((student) => {
    const studentGrades = grades.filter(
      (grade) => grade.studentId === student.id,
    );

    if (!studentGrades.length) {
      return student;
    }

    const average = Math.round(
      studentGrades.reduce((total, grade) => total + grade.score, 0) /
        studentGrades.length,
    );

    return { ...student, average };
  });

  return {
    ...data,
    grades,
    students,
  };
}

export function deleteGrade(
  data: GuruMateData,
  gradeId: string,
): GuruMateData {
  const grades = data.grades.filter((grade) => grade.id !== gradeId);

  const students = data.students.map((student) => {
    const studentGrades = grades.filter(
      (grade) => grade.studentId === student.id,
    );

    const average = studentGrades.length
      ? Math.round(
          studentGrades.reduce((total, grade) => total + grade.score, 0) /
            studentGrades.length,
        )
      : 0;

    return { ...student, average };
  });

  return {
    ...data,
    grades,
    students,
  };
}

export function addActivity(
  data: GuruMateData,
  activity: Omit<Activity, "id">,
): GuruMateData {
  return {
    ...data,
    activities: [
      {
        ...activity,
        id: createId("activity"),
      },
      ...data.activities,
    ],
  };
}

export function subscribeToGuruMateData(
  callback: () => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = () => callback();

  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);

  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export { STORAGE_KEY };