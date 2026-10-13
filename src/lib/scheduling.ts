import type { Dependency, Task } from '../types';
import {
  addWorkingDays,
  countWorkingDays,
  parseISO,
  snapToWorkingDay,
  startOfDay,
  type WorkCalendar,
} from './dateUtils';

export interface ScheduledTask {
  id: string;
  /** Mulai paling awal (hasil constraint dependency + start yang di-pin). */
  start: Date;
  /** Selesai paling awal (inklusif). */
  finish: Date;
  lateStart: Date;
  lateFinish: Date;
  /** Total float/slack dalam hari kerja. */
  slack: number;
  critical: boolean;
  durationDays: number;
}

export interface ScheduleResult {
  tasks: Map<string, ScheduledTask>;
  order: string[];
  projectStart: Date | null;
  projectFinish: Date | null;
  criticalPath: string[];
  hasCycle: boolean;
}

function dependencyMap(deps: Dependency[]) {
  const preds = new Map<string, Dependency[]>();
  const succs = new Map<string, Dependency[]>();
  for (const d of deps) {
    if (!preds.has(d.successorId)) preds.set(d.successorId, []);
    preds.get(d.successorId)!.push(d);
    if (!succs.has(d.predecessorId)) succs.set(d.predecessorId, []);
    succs.get(d.predecessorId)!.push(d);
  }
  return { preds, succs };
}

/** Urutkan task secara topologis (Kahn). Mengembalikan null bila ada siklus. */
export function topoSort(
  tasks: Task[],
  deps: Dependency[]
): string[] | null {
  const ids = tasks.map((t) => t.id);
  const idSet = new Set(ids);
  const indegree = new Map<string, number>();
  const succs = new Map<string, string[]>();
  for (const id of ids) {
    indegree.set(id, 0);
    succs.set(id, []);
  }
  for (const d of deps) {
    if (!idSet.has(d.predecessorId) || !idSet.has(d.successorId)) continue;
    succs.get(d.predecessorId)!.push(d.successorId);
    indegree.set(d.successorId, (indegree.get(d.successorId) ?? 0) + 1);
  }
  const queue = ids.filter((id) => (indegree.get(id) ?? 0) === 0);
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const s of succs.get(id) ?? []) {
      const next = (indegree.get(s) ?? 0) - 1;
      indegree.set(s, next);
      if (next === 0) queue.push(s);
    }
  }
  if (order.length !== ids.length) return null;
  return order;
}

/**
 * Hitung jadwal CPM: forward pass (early start/finish) dan backward pass
 * (late start/finish), lalu tentukan jalur kritis.
 */
export function computeSchedule(
  tasks: Task[],
  deps: Dependency[],
  wc: WorkCalendar
): ScheduleResult {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const empty: ScheduleResult = {
    tasks: new Map(),
    order: [],
    projectStart: null,
    projectFinish: null,
    criticalPath: [],
    hasCycle: false,
  };
  if (tasks.length === 0) return empty;

  const order = topoSort(tasks, deps);
  const validDeps = deps.filter(
    (d) => byId.has(d.predecessorId) && byId.has(d.successorId)
  );
  const { preds, succs } = dependencyMap(validDeps);

  const starts = new Map<string, Date>();
  const finishes = new Map<string, Date>();

  const calcFinish = (t: Task, start: Date): Date =>
    addWorkingDays(start, Math.max(1, Math.round(t.durationDays)) - 1, wc);

  if (!order) {
    // Ada siklus: fallback hanya pakai start yang di-pin.
    const map = new Map<string, ScheduledTask>();
    for (const t of tasks) {
      const s = snapToWorkingDay(parseISO(t.startDate), wc);
      const f = calcFinish(t, s);
      starts.set(t.id, s);
      finishes.set(t.id, f);
      map.set(t.id, {
        id: t.id,
        start: s,
        finish: f,
        lateStart: s,
        lateFinish: f,
        slack: 0,
        critical: false,
        durationDays: Math.max(1, Math.round(t.durationDays)),
      });
    }
    const allF = [...finishes.values()];
    const allS = [...starts.values()];
    return {
      tasks: map,
      order: tasks.map((t) => t.id),
      projectStart: new Date(Math.min(...allS.map((d) => d.getTime()))),
      projectFinish: new Date(Math.max(...allF.map((d) => d.getTime()))),
      criticalPath: [],
      hasCycle: true,
    };
  }

  // ---- Forward pass ----
  for (const id of order) {
    const t = byId.get(id);
    if (!t) continue;
    let start = snapToWorkingDay(parseISO(t.startDate), wc);
    for (const dep of preds.get(id) ?? []) {
      const pf = finishes.get(dep.predecessorId);
      const ps = starts.get(dep.predecessorId);
      if (!pf || !ps) continue;
      let candidate: Date;
      if (dep.type === 'FS') {
        candidate = addWorkingDays(pf, dep.lagDays + 1, wc);
      } else {
        candidate = addWorkingDays(ps, dep.lagDays, wc);
      }
      if (candidate.getTime() > start.getTime()) start = candidate;
    }
    start = snapToWorkingDay(start, wc);
    starts.set(id, start);
    finishes.set(id, calcFinish(t, start));
  }

  let projectFinish = startOfDay(starts.get(order[0]!)!);
  let projectStart = projectFinish;
  for (const [, f] of finishes) {
    if (f.getTime() > projectFinish.getTime()) projectFinish = f;
  }
  for (const [, s] of starts) {
    if (s.getTime() < projectStart.getTime()) projectStart = s;
  }

  // ---- Backward pass ----
  const lateStarts = new Map<string, Date>();
  const lateFinishes = new Map<string, Date>();
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i]!;
    const t = byId.get(id)!;
    let lf = projectFinish;
    const outEdges = (succs.get(id) ?? []).filter((d) =>
      lateFinishes.has(d.successorId)
    );
    if (outEdges.length > 0) {
      let minLf: Date | null = null;
      for (const dep of outEdges) {
        const succLateStart = lateStarts.get(dep.successorId)!;
        const dur = Math.max(1, Math.round(t.durationDays));
        // FS: pred.finish <= succ.start - 1 - lag
        // SS: pred.start <= succ.start - lag  =>  pred.finish <= succ.start - lag + dur - 1
        const candidate =
          dep.type === 'FS'
            ? addWorkingDays(succLateStart, -(dep.lagDays + 1), wc)
            : addWorkingDays(succLateStart, dur - 1 - dep.lagDays, wc);
        if (minLf === null || candidate.getTime() < minLf.getTime())
          minLf = candidate;
      }
      lf = minLf ?? projectFinish;
    }
    lateFinishes.set(id, lf);
    lateStarts.set(
      id,
      addWorkingDays(lf, -(Math.max(1, Math.round(t.durationDays)) - 1), wc)
    );
  }

  // ---- Slack & critical ----
  const map = new Map<string, ScheduledTask>();
  for (const id of order) {
    const start = starts.get(id)!;
    const finish = finishes.get(id)!;
    const ls = lateStarts.get(id)!;
    const lf = lateFinishes.get(id)!;
    const slack = Math.max(0, countWorkingDays(finish, lf, wc) - 1);
    map.set(id, {
      id,
      start,
      finish,
      lateStart: ls,
      lateFinish: lf,
      slack,
      critical: slack <= 0,
      durationDays: Math.max(1, Math.round(byId.get(id)!.durationDays)),
    });
  }

  const criticalPath = buildCriticalPath(order, validDeps, map);

  return {
    tasks: map,
    order,
    projectStart,
    projectFinish,
    criticalPath,
    hasCycle: false,
  };
}

/**
 * Rangkai satu jalur kritis yang berkesinambungan: mulai dari task kritis
 * tanpa predecessor kritis, lalu telusuri successor kritis.
 */
function buildCriticalPath(
  order: string[],
  deps: Dependency[],
  map: Map<string, ScheduledTask>
): string[] {
  const criticalIds = new Set(
    [...map.values()].filter((s) => s.critical).map((s) => s.id)
  );
  if (criticalIds.size === 0) return [];
  const incoming = new Map<string, string[]>();
  for (const d of deps) {
    if (!criticalIds.has(d.predecessorId) || !criticalIds.has(d.successorId))
      continue;
    if (!incoming.has(d.successorId)) incoming.set(d.successorId, []);
    incoming.get(d.successorId)!.push(d.predecessorId);
  }
  const starts = order.filter(
    (id) => criticalIds.has(id) && (incoming.get(id)?.length ?? 0) === 0
  );
  if (starts.length === 0) {
    // Siklus pada jalur kritis: ambil task kritis dengan start paling awal.
    const sorted = order
      .filter((id) => criticalIds.has(id))
      .sort(
        (a, b) =>
          map.get(a)!.start.getTime() - map.get(b)!.start.getTime()
      );
    return sorted;
  }
  const path: string[] = [];
  let current = starts[0]!;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    path.push(current);
    const next = deps.find(
      (d) => d.predecessorId === current && criticalIds.has(d.successorId)
    );
    current = next ? next.successorId : '';
  }
  return path;
}

export interface PertEstimate {
  optimistic: number;
  mostLikely: number;
  pessimistic: number;
  expected: number;
  variance: number;
  stdDev: number;
}

/** Estimasi PERT dari sebuah task (durasi dalam hari kerja). */
export function pertEstimate(task: Task): PertEstimate {
  const m = Math.max(1, Math.round(task.mostLikely ?? task.durationDays));
  const o = Math.max(1, Math.round(task.optimistic ?? Math.max(1, m * 0.8)));
  const p = Math.max(o, Math.round(task.pessimistic ?? Math.round(m * 1.5)));
  const expected = (o + 4 * m + p) / 6;
  const variance = Math.pow((p - o) / 6, 2);
  return {
    optimistic: o,
    mostLikely: m,
    pessimistic: p,
    expected,
    variance,
    stdDev: Math.sqrt(variance),
  };
}

export interface ProjectPert {
  /** Total durasi ekspektasi (hari kerja) sepanjang jalur kritis. */
  expectedDuration: number;
  totalVariance: number;
  stdDev: number;
  perTask: { id: string; estimate: PertEstimate }[];
}

export function computeProjectPert(
  tasks: Task[],
  criticalPath: string[]
): ProjectPert {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const perTask = tasks.map((t) => ({ id: t.id, estimate: pertEstimate(t) }));
  const estById = new Map(perTask.map((p) => [p.id, p.estimate]));
  const chain = criticalPath.length > 0 ? criticalPath : tasks.map((t) => t.id);
  let expected = 0;
  let variance = 0;
  for (const id of chain) {
    if (!byId.has(id)) continue;
    const e = estById.get(id)!;
    expected += e.expected;
    variance += e.variance;
  }
  return {
    expectedDuration: expected,
    totalVariance: variance,
    stdDev: Math.sqrt(variance),
    perTask,
  };
}

/** Durasi proyek dalam hari kerja berdasarkan jadwal CPM. */
export function projectWorkDays(
  schedule: ScheduleResult,
  wc: WorkCalendar
): number {
  if (!schedule.projectStart || !schedule.projectFinish) return 0;
  return countWorkingDays(schedule.projectStart, schedule.projectFinish, wc);
}
