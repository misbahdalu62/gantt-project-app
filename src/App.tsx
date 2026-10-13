import { useEffect, useRef, useState } from 'react';
import type { ProjectState, Task } from './types';
import { useProject } from './state/ProjectContext';
import { GanttChart } from './components/GanttChart';
import { DependencyPanel } from './components/DependencyPanel';
import { ResourcePanel } from './components/ResourcePanel';
import { CalendarPanel } from './components/CalendarPanel';
import { AnalysisPanel } from './components/AnalysisPanel';
import { TaskForm } from './components/TaskForm';
import { projectWorkDays } from './lib/scheduling';
import { formatShortDate } from './lib/dateUtils';

type Tab = 'gantt' | 'resources' | 'calendar' | 'analysis';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'gantt', label: 'Gantt & Tugas', icon: '📊' },
  { id: 'resources', label: 'Sumber Daya', icon: '👥' },
  { id: 'calendar', label: 'Kalender', icon: '📅' },
  { id: 'analysis', label: 'Analisis', icon: '🧭' },
];

interface FormState {
  open: boolean;
  task: Task | null;
  parentId: string | null;
}

export default function App() {
  const { state, dispatch, calendar, schedule } = useProject();
  const [tab, setTab] = useState<Tab>('gantt');
  const [form, setForm] = useState<FormState>({ open: false, task: null, parentId: null });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onAdd = () => setForm({ open: true, task: null, parentId: null });
    const onEdit = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const task = state.tasks.find((t) => t.id === id) ?? null;
      setForm({ open: true, task, parentId: null });
    };
    const onSub = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      setForm({ open: true, task: null, parentId: id });
    };
    window.addEventListener('open-task-form', onAdd);
    window.addEventListener('edit-task', onEdit);
    window.addEventListener('add-subtask', onSub);
    return () => {
      window.removeEventListener('open-task-form', onAdd);
      window.removeEventListener('edit-task', onEdit);
      window.removeEventListener('add-subtask', onSub);
    };
  }, [state.tasks]);

  const totalWorkDays = projectWorkDays(schedule, calendar);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.projectName.replace(/\s+/g, '-').toLowerCase() || 'proyek'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as ProjectState;
        if (!parsed.tasks || !parsed.calendar) throw new Error('format');
        dispatch({ type: 'IMPORT', state: parsed });
      } catch {
        window.alert('Berkas tidak valid. Pastikan berupa JSON hasil ekspor.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__brand">
          <span className="logo">📈</span>
          <div>
            <h1>Manajemen Proyek Gantt</h1>
            <p className="muted">
              {state.tasks.length} tugas • {state.resources.length} anggota •{' '}
              {totalWorkDays} hari kerja
            </p>
          </div>
        </div>

        <label className="project-name">
          <span className="muted">Nama Proyek</span>
          <input
            value={state.projectName}
            onChange={(e) => dispatch({ type: 'SET_PROJECT_NAME', name: e.target.value })}
          />
        </label>

        <div className="app-header__actions">
          <span className="muted header-dates">
            {schedule.projectStart && schedule.projectFinish
              ? `${formatShortDate(schedule.projectStart)} → ${formatShortDate(schedule.projectFinish)}`
              : 'Belum ada jadwal'}
          </span>
          <button className="btn btn--sm" onClick={exportJson}>
            Ekspor JSON
          </button>
          <button className="btn btn--sm" onClick={() => fileInputRef.current?.click()}>
            Impor JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importJson(file);
              e.target.value = '';
            }}
          />
          <button
            className="btn btn--sm"
            onClick={() => {
              if (window.confirm('Kembalikan ke data contoh? Perubahan Anda akan hilang.')) {
                dispatch({ type: 'RESET_SEED' });
                setTab('gantt');
              }
            }}
          >
            Muat Data Contoh
          </button>
          <button
            className="btn btn--sm btn--danger"
            onClick={() => {
              if (window.confirm('Kosongkan semua data proyek?')) {
                dispatch({ type: 'CLEAR' });
              }
            }}
          >
            Kosongkan
          </button>
        </div>
      </header>

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`tab ${tab === t.id ? 'tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span aria-hidden>{t.icon}</span> {t.label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {tab === 'gantt' ? (
          <>
            <GanttChart />
            <DependencyPanel />
          </>
        ) : null}
        {tab === 'resources' ? <ResourcePanel /> : null}
        {tab === 'calendar' ? <CalendarPanel /> : null}
        {tab === 'analysis' ? <AnalysisPanel /> : null}
      </main>

      <footer className="app-footer">
        <span className="muted">
          Data disimpan otomatis di localStorage peramban Anda. Geser bar untuk mengubah
          tanggal mulai, tarik ujung kanan untuk mengubah durasi.
        </span>
      </footer>

      {form.open ? (
        <TaskForm
          task={form.task}
          defaultParentId={form.parentId}
          onClose={() => setForm({ open: false, task: null, parentId: null })}
        />
      ) : null}
    </div>
  );
}
