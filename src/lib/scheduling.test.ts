import { describe, expect, it } from 'vitest';
import type { Dependency, Task } from '../types';
import { buildCalendar, toISO } from './dateUtils';
import {
  computeProjectPert,
  computeSchedule,
  pertEstimate,
  topoSort,
} from './scheduling';

const wc = buildCalendar({ weekendDays: [0, 6], holidays: [] });

function task(
  id: string,
  startDate: string,
  durationDays: number,
  extra: Partial<Task> = {}
): Task {
  return {
    id,
    name: id,
    description: '',
    startDate,
    durationDays,
    priority: 'Medium',
    color: '#3b82f6',
    progress: 0,
    parentId: null,
    resourceIds: [],
    ...extra,
  };
}

function dep(
  predecessorId: string,
  successorId: string,
  type: 'FS' | 'SS',
  lagDays = 0
): Dependency {
  return { id: `${predecessorId}->${successorId}`, predecessorId, successorId, type, lagDays };
}

describe('scheduling — Finish-to-Start', () => {
  const tasks = [
    task('A', '2026-10-05', 5),
    task('B', '2026-10-05', 3),
    task('C', '2026-10-05', 2),
  ];
  const deps = [dep('A', 'B', 'FS', 0), dep('B', 'C', 'FS', 1)];
  const result = computeSchedule(tasks, deps, wc);

  it('menjadwalkan successor setelah predecessor selesai', () => {
    // A: Sen 5 Okt + 5 hari kerja -> Jum 9 Okt
    expect(toISO(result.tasks.get('A')!.start)).toBe('2026-10-05');
    expect(toISO(result.tasks.get('A')!.finish)).toBe('2026-10-09');
    // B mulai Senin berikutnya
    expect(toISO(result.tasks.get('B')!.start)).toBe('2026-10-12');
    expect(toISO(result.tasks.get('B')!.finish)).toBe('2026-10-14');
  });

  it('menerapkan lag hari kerja', () => {
    // C = B selesai (Rab 14 Okt) + 1 lag + 1 hari = Kam 15 Okt... lag 1 -> Jum 16 Okt
    expect(toISO(result.tasks.get('C')!.start)).toBe('2026-10-16');
  });

  it('mengenali jalur kritis penuh', () => {
    expect(result.criticalPath).toEqual(['A', 'B', 'C']);
    expect(result.tasks.get('A')!.critical).toBe(true);
    expect(result.tasks.get('C')!.slack).toBe(0);
  });
});

describe('scheduling — Start-to-Start', () => {
  it('memakai start predecessor ditambah lag', () => {
    const tasks = [task('A', '2026-10-05', 10), task('B', '2026-10-05', 4)];
    const result = computeSchedule([...tasks], [dep('A', 'B', 'SS', 2)], wc);
    // Sen 5 Okt + 2 hari kerja = Rab 7 Okt
    expect(toISO(result.tasks.get('B')!.start)).toBe('2026-10-07');
  });

  it('memilih start paling akhir bila ada beberapa constraint', () => {
    const tasks = [
      task('A', '2026-10-05', 3), // selesai Rab 7 Okt
      task('B', '2026-10-05', 3),
      task('C', '2026-10-05', 2),
    ];
    const result = computeSchedule(
      tasks,
      [dep('A', 'C', 'SS', 1), dep('B', 'C', 'FS', 0)],
      wc
    );
    // SS: 5 Okt +1 = Sel 6 Okt ; FS: B selesai Rab 7 Okt +1 = Kam 8 Okt -> menang
    expect(toISO(result.tasks.get('C')!.start)).toBe('2026-10-08');
  });
});

describe('scheduling — slack & jalur kritis', () => {
  it('memberi slack pada cabang yang tidak kritis', () => {
    const tasks = [
      task('A', '2026-10-05', 2), // selesai Sel 6
      task('Long', '2026-10-07', 8), // panjang
      task('Short', '2026-10-07', 2), // pendek
      task('End', '2026-10-19', 1),
    ];
    const deps = [
      dep('A', 'Long', 'FS', 0),
      dep('A', 'Short', 'FS', 0),
      dep('Long', 'End', 'FS', 0),
      dep('Short', 'End', 'FS', 0),
    ];
    const result = computeSchedule(tasks, deps, wc);
    expect(result.tasks.get('Long')!.critical).toBe(true);
    expect(result.tasks.get('Short')!.critical).toBe(false);
    expect(result.tasks.get('Short')!.slack).toBeGreaterThan(0);
    expect(result.criticalPath).toContain('Long');
    expect(result.criticalPath).not.toContain('Short');
  });
});

describe('scheduling — siklus', () => {
  it('mendeteksi siklus dan tidak crash', () => {
    const tasks = [task('A', '2026-10-05', 2), task('B', '2026-10-05', 2)];
    expect(topoSort(tasks, [dep('A', 'B', 'FS'), dep('B', 'A', 'FS')])).toBeNull();
    const result = computeSchedule(
      tasks,
      [dep('A', 'B', 'FS'), dep('B', 'A', 'FS')],
      wc
    );
    expect(result.hasCycle).toBe(true);
    expect(result.tasks.size).toBe(2);
  });
});

describe('PERT', () => {
  it('menghitung expected duration dan variance', () => {
    const e = pertEstimate(
      task('A', '2026-10-05', 6, { optimistic: 3, mostLikely: 6, pessimistic: 15 })
    );
    expect(e.expected).toBeCloseTo((3 + 24 + 15) / 6, 5); // 7
    expect(e.variance).toBeCloseTo(4, 5);
    expect(e.stdDev).toBeCloseTo(2, 5);
  });

  it('menurunkan estimasi PERT dari durasi bila kosong', () => {
    const e = pertEstimate(task('A', '2026-10-05', 10));
    expect(e.mostLikely).toBe(10);
    expect(e.optimistic).toBeLessThan(e.mostLikely);
    expect(e.pessimistic).toBeGreaterThan(e.mostLikely);
  });

  it('menjumlahkan variance sepanjang jalur kritis', () => {
    const tasks = [
      task('A', '2026-10-05', 4, { optimistic: 2, mostLikely: 4, pessimistic: 6 }),
      task('B', '2026-10-09', 2, { optimistic: 2, mostLikely: 2, pessimistic: 2 }),
    ];
    const pert = computeProjectPert(tasks, ['A', 'B']);
    // A: (2 + 16 + 6)/6 = 4 ; B: (2 + 8 + 2)/6 = 2
    expect(pert.expectedDuration).toBeCloseTo(4 + 2, 5);
    expect(pert.totalVariance).toBeCloseTo(((6 - 2) / 6) ** 2, 5);
    expect(pert.stdDev).toBeGreaterThan(0);
  });
});
