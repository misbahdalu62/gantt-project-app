import { describe, expect, it } from 'vitest';
import {
  addWorkingDays,
  buildCalendar,
  countWorkingDays,
  isWorkingDay,
  parseISO,
  snapToWorkingDay,
  toISO,
} from './dateUtils';

const wc = buildCalendar({ weekendDays: [0, 6], holidays: [] });

describe('dateUtils — perhitungan hari kerja', () => {
  it('menandai Sabtu & Minggu sebagai bukan hari kerja', () => {
    expect(isWorkingDay(parseISO('2026-10-10'), wc)).toBe(false); // Sabtu
    expect(isWorkingDay(parseISO('2026-10-11'), wc)).toBe(false); // Minggu
    expect(isWorkingDay(parseISO('2026-10-12'), wc)).toBe(true); // Senin
  });

  it('menghormati hari libur kustom', () => {
    const withHoliday = buildCalendar({
      weekendDays: [0, 6],
      holidays: [{ id: 'h1', date: '2026-10-07', name: 'Libur' }],
    });
    expect(isWorkingDay(parseISO('2026-10-07'), withHoliday)).toBe(false);
    // 2 hari kerja dari Senin 5 Okt, lewati libur Rabu 7 Okt -> Kamis 8 Okt
    expect(toISO(addWorkingDays(parseISO('2026-10-05'), 2, withHoliday))).toBe(
      '2026-10-08'
    );
  });

  it('menggeser hari kerja melewati akhir pekan', () => {
    // Jumat 9 Okt + 1 hari kerja = Senin 12 Okt
    expect(toISO(addWorkingDays(parseISO('2026-10-09'), 1, wc))).toBe(
      '2026-10-12'
    );
    // Senin 5 Okt + 4 hari kerja = Jumat 9 Okt
    expect(toISO(addWorkingDays(parseISO('2026-10-05'), 4, wc))).toBe(
      '2026-10-09'
    );
  });

  it('mendukung geser mundur (nilai negatif)', () => {
    expect(toISO(addWorkingDays(parseISO('2026-10-12'), -1, wc))).toBe(
      '2026-10-09'
    );
  });

  it('menghitung jumlah hari kerja secara inklusif', () => {
    expect(
      countWorkingDays(parseISO('2026-10-05'), parseISO('2026-10-09'), wc)
    ).toBe(5);
    // Rentang melintasi satu akhir pekan: 5 + 5 = 10 hari kerja
    expect(
      countWorkingDays(parseISO('2026-10-05'), parseISO('2026-10-16'), wc)
    ).toBe(10);
    expect(
      countWorkingDays(parseISO('2026-10-09'), parseISO('2026-10-05'), wc)
    ).toBe(0);
  });

  it('snap ke hari kerja berikutnya', () => {
    expect(toISO(snapToWorkingDay(parseISO('2026-10-10'), wc))).toBe(
      '2026-10-12'
    );
  });
});
