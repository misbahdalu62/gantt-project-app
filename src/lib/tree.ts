import type { Task } from '../types';

export interface FlatTask {
  task: Task;
  depth: number;
  hasChildren: boolean;
}

/**
 * Ratakan struktur parent-child menjadi daftar baris untuk tabel/Gantt.
 * Tugas yatim (parent tidak ditemukan) tetap ditampilkan di level atas.
 */
export function flattenTasks(tasks: Task[]): FlatTask[] {
  const ids = new Set(tasks.map((t) => t.id));
  const byParent = new Map<string | null, Task[]>();
  for (const t of tasks) {
    const parent = t.parentId && ids.has(t.parentId) ? t.parentId : null;
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent)!.push(t);
  }

  const out: FlatTask[] = [];
  const visited = new Set<string>();

  const walk = (parentId: string | null, depth: number) => {
    for (const t of byParent.get(parentId) ?? []) {
      if (visited.has(t.id)) continue;
      visited.add(t.id);
      const children = byParent.get(t.id) ?? [];
      out.push({ task: t, depth, hasChildren: children.length > 0 });
      if (depth < 6) walk(t.id, depth + 1);
    }
  };

  walk(null, 0);

  // Tugas yang tidak terjangkau karena siklus parent tetap ditampilkan.
  for (const t of tasks) {
    if (!visited.has(t.id)) {
      visited.add(t.id);
      out.push({ task: t, depth: 0, hasChildren: false });
    }
  }
  return out;
}

export function childrenOf(tasks: Task[], parentId: string): Task[] {
  return tasks.filter((t) => t.parentId === parentId);
}

/** Semua keturunan (rekursif) dari sebuah task. */
export function descendantsOf(tasks: Task[], parentId: string): Task[] {
  const out: Task[] = [];
  const stack = [parentId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const t of tasks) {
      if (t.parentId === current && !seen.has(t.id)) {
        seen.add(t.id);
        out.push(t);
        stack.push(t.id);
      }
    }
  }
  return out;
}
