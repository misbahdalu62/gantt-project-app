import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import type {
  CalendarConfig,
  Dependency,
  ProjectState,
  Resource,
  Task,
} from '../types';
import { buildCalendar, type WorkCalendar } from '../lib/dateUtils';
import { createSeedState } from '../lib/seed';
import { clearState, loadState, saveState } from '../lib/storage';
import { computeSchedule, type ScheduleResult } from '../lib/scheduling';

export type ProjectAction =
  | { type: 'ADD_TASK'; task: Task }
  | { type: 'UPDATE_TASK'; task: Task }
  | { type: 'DELETE_TASK'; id: string }
  | { type: 'ADD_DEPENDENCY'; dependency: Dependency }
  | { type: 'UPDATE_DEPENDENCY'; dependency: Dependency }
  | { type: 'DELETE_DEPENDENCY'; id: string }
  | { type: 'SAVE_RESOURCE'; resource: Resource }
  | { type: 'DELETE_RESOURCE'; id: string }
  | { type: 'SET_CALENDAR'; calendar: CalendarConfig }
  | { type: 'SET_PROJECT_NAME'; name: string }
  | { type: 'IMPORT'; state: ProjectState }
  | { type: 'RESET_SEED' }
  | { type: 'CLEAR' };

function reducer(state: ProjectState, action: ProjectAction): ProjectState {
  switch (action.type) {
    case 'ADD_TASK':
      return { ...state, tasks: [...state.tasks, action.task] };

    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.task.id ? action.task : t)),
      };

    case 'DELETE_TASK': {
      const tasks = state.tasks
        .filter((t) => t.id !== action.id)
        // Sub-tugas dari task yang dihapus dinaikkan ke level atas.
        .map((t) => (t.parentId === action.id ? { ...t, parentId: null } : t));
      const dependencies = state.dependencies.filter(
        (d) =>
          d.predecessorId !== action.id && d.successorId !== action.id
      );
      return { ...state, tasks, dependencies };
    }

    case 'ADD_DEPENDENCY':
      return {
        ...state,
        dependencies: [...state.dependencies, action.dependency],
      };

    case 'UPDATE_DEPENDENCY':
      return {
        ...state,
        dependencies: state.dependencies.map((d) =>
          d.id === action.dependency.id ? action.dependency : d
        ),
      };

    case 'DELETE_DEPENDENCY':
      return {
        ...state,
        dependencies: state.dependencies.filter((d) => d.id !== action.id),
      };

    case 'SAVE_RESOURCE': {
      const exists = state.resources.some((r) => r.id === action.resource.id);
      return {
        ...state,
        resources: exists
          ? state.resources.map((r) =>
              r.id === action.resource.id ? action.resource : r
            )
          : [...state.resources, action.resource],
      };
    }

    case 'DELETE_RESOURCE':
      return {
        ...state,
        resources: state.resources.filter((r) => r.id !== action.id),
        tasks: state.tasks.map((t) => ({
          ...t,
          resourceIds: t.resourceIds.filter((id) => id !== action.id),
        })),
      };

    case 'SET_CALENDAR':
      return { ...state, calendar: action.calendar };

    case 'SET_PROJECT_NAME':
      return { ...state, projectName: action.name };

    case 'IMPORT':
      return action.state;

    case 'RESET_SEED':
      return createSeedState();

    case 'CLEAR':
      return {
        projectName: 'Proyek Baru',
        tasks: [],
        dependencies: [],
        resources: [],
        calendar: { weekendDays: [0, 6], holidays: [] },
      };

    default:
      return state;
  }
}

interface ProjectContextValue {
  state: ProjectState;
  dispatch: Dispatch<ProjectAction>;
  calendar: WorkCalendar;
  schedule: ScheduleResult;
  taskById: Map<string, Task>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const calendar = useMemo(() => buildCalendar(state.calendar), [state.calendar]);

  const schedule = useMemo(
    () => computeSchedule(state.tasks, state.dependencies, calendar),
    [state.tasks, state.dependencies, calendar]
  );

  const taskById = useMemo(
    () => new Map(state.tasks.map((t) => [t.id, t])),
    [state.tasks]
  );

  const value = useMemo<ProjectContextValue>(
    () => ({ state, dispatch, calendar, schedule, taskById }),
    [state, calendar, schedule, taskById]
  );

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject harus dipakai di dalam ProjectProvider');
  return ctx;
}

export { clearState };
