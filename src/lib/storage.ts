import type { ProjectState } from '../types';
import { createSeedState } from './seed';

const STORAGE_KEY = 'gantt-project-manager:v1';

function isProjectState(value: unknown): value is ProjectState {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.projectName === 'string' &&
    Array.isArray(v.tasks) &&
    Array.isArray(v.dependencies) &&
    Array.isArray(v.resources) &&
    !!v.calendar &&
    typeof v.calendar === 'object'
  );
}

export function loadState(): ProjectState {
  if (typeof localStorage === 'undefined') return createSeedState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedState();
    const parsed: unknown = JSON.parse(raw);
    if (!isProjectState(parsed)) return createSeedState();
    // Normalisasi field opsional.
    return {
      ...parsed,
      calendar: {
        weekendDays: parsed.calendar.weekendDays ?? [0, 6],
        holidays: parsed.calendar.holidays ?? [],
      },
      tasks: parsed.tasks.map((t) => ({
        ...t,
        description: t.description ?? '',
        progress: t.progress ?? 0,
        resourceIds: t.resourceIds ?? [],
      })),
    };
  } catch {
    return createSeedState();
  }
}

export function saveState(state: ProjectState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota penuh / mode privat: abaikan agar UI tidak crash.
  }
}

export function clearState(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
