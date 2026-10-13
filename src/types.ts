export type Priority = 'Low' | 'Medium' | 'High';

export type DependencyType = 'FS' | 'SS';

/** Sebuah tugas / task pada proyek. */
export interface Task {
  id: string;
  name: string;
  description: string;
  /** Tanggal mulai yang di-pin manual (ISO yyyy-MM-dd). */
  startDate: string;
  /** Durasi dalam hari kerja (working days), minimal 1. */
  durationDays: number;
  priority: Priority;
  /** Warna indikator bar (hex). */
  color: string;
  /** Progres 0..100 (%). */
  progress: number;
  /** id task induk untuk sub-tugas (parent-child). null = tugas level atas. */
  parentId: string | null;
  /** Anggota tim yang dialokasikan pada tugas ini. */
  resourceIds: string[];

  /** Estimasi PERT (opsional). Jika kosong, diturunkan dari durationDays. */
  optimistic?: number;
  mostLikely?: number;
  pessimistic?: number;
}

/** Hubungan antar tugas (predecessor -> successor). */
export interface Dependency {
  id: string;
  predecessorId: string;
  successorId: string;
  type: DependencyType;
  /** Jeda / lag dalam hari kerja. */
  lagDays: number;
}

/** Anggota tim. */
export interface Resource {
  id: string;
  name: string;
  email: string;
  role: string;
  /** Gaji bulanan (IDR). */
  salary: number;
}

export interface Holiday {
  id: string;
  /** ISO yyyy-MM-dd */
  date: string;
  name: string;
}

/** Konfigurasi kalender proyek. */
export interface CalendarConfig {
  /** Hari akhir pekan, 0 = Minggu ... 6 = Sabtu. */
  weekendDays: number[];
  holidays: Holiday[];
}

/** Seluruh state aplikasi. */
export interface ProjectState {
  projectName: string;
  tasks: Task[];
  dependencies: Dependency[];
  resources: Resource[];
  calendar: CalendarConfig;
}

export const PRIORITY_ORDER: Record<Priority, number> = {
  Low: 0,
  Medium: 1,
  High: 2,
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  Low: 'Rendah',
  Medium: 'Sedang',
  High: 'Tinggi',
};

export const DAY_NAMES = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
];

export const DAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];
