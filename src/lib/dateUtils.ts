import type { CalendarConfig } from '../types';

/** Mulai hari (jam 00:00 waktu lokal). */
export function startOfDay(d: Date): Date {
  const c = new Date(d.getTime());
  c.setHours(0, 0, 0, 0);
  return c;
}

export function addDays(d: Date, n: number): Date {
  const c = startOfDay(d);
  c.setDate(c.getDate() + n);
  return c;
}

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISO(s: string): Date {
  const parts = s.split('-').map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(y, m - 1, d);
}

export function todayISO(): string {
  return toISO(new Date());
}

/** Representasi kalender yang sudah dioptimasi untuk pengecekan cepat. */
export interface WorkCalendar {
  weekendDays: number[];
  holidaySet: Set<string>;
}

export function buildCalendar(config: CalendarConfig): WorkCalendar {
  return {
    weekendDays: config.weekendDays,
    holidaySet: new Set(config.holidays.map((h) => h.date)),
  };
}

export function isWorkingDay(d: Date, wc: WorkCalendar): boolean {
  if (wc.weekendDays.includes(d.getDay())) return false;
  return !wc.holidaySet.has(toISO(d));
}

/** Maju ke hari kerja berikutnya bila `d` bukan hari kerja. */
export function snapToWorkingDay(d: Date, wc: WorkCalendar): Date {
  let cur = startOfDay(d);
  let guard = 0;
  while (!isWorkingDay(cur, wc) && guard < 3660) {
    cur = addDays(cur, 1);
    guard++;
  }
  return cur;
}

/**
 * Geser `n` hari kerja dari `date`. `n` boleh negatif.
 * Jika `date` bukan hari kerja dan `n` positif, hari kerja pertama yang
 * ditemukan dihitung sebagai langkah ke-1.
 */
export function addWorkingDays(date: Date, n: number, wc: WorkCalendar): Date {
  if (n === 0) return startOfDay(date);
  const step = n > 0 ? 1 : -1;
  let remaining = Math.abs(n);
  let cur = startOfDay(date);
  let guard = 0;
  while (remaining > 0 && guard < 100000) {
    cur = addDays(cur, step);
    if (isWorkingDay(cur, wc)) remaining--;
    guard++;
  }
  return cur;
}

/** Jumlah hari kerja antara `a` dan `b` (inklusif). 0 bila b < a. */
export function countWorkingDays(a: Date, b: Date, wc: WorkCalendar): number {
  let cur = startOfDay(a);
  const end = startOfDay(b);
  if (cur > end) return 0;
  let count = 0;
  let guard = 0;
  while (cur <= end && guard < 100000) {
    if (isWorkingDay(cur, wc)) count++;
    cur = addDays(cur, 1);
    guard++;
  }
  return count;
}

/** Jumlah hari kalender antara dua tanggal (inklusif). */
export function daysBetweenInclusive(a: Date, b: Date): number {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / 86400000) + 1;
}

/** Daftar tanggal dari `a` sampai `b` (inklusif). */
export function eachDay(a: Date, b: Date): Date[] {
  const out: Date[] = [];
  let cur = startOfDay(a);
  const end = startOfDay(b);
  let guard = 0;
  while (cur <= end && guard < 20000) {
    out.push(cur);
    cur = addDays(cur, 1);
    guard++;
  }
  return out;
}

export function formatShortDate(d: Date): string {
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export function formatLongDate(d: Date): string {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatIDR(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}
