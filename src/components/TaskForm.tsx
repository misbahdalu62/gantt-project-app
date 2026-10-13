import { useState, type FormEvent } from 'react';
import type { Priority, Task } from '../types';
import { PRIORITY_LABEL } from '../types';
import { createId, TASK_COLORS } from '../lib/palette';
import { todayISO } from '../lib/dateUtils';
import { useProject } from '../state/ProjectContext';
import { Modal } from './Modal';

interface TaskFormProps {
  task: Task | null;
  defaultParentId?: string | null;
  onClose: () => void;
}

const PRIORITIES: Priority[] = ['Low', 'Medium', 'High'];

export function TaskForm({ task, defaultParentId = null, onClose }: TaskFormProps) {
  const { state, dispatch } = useProject();
  const isEdit = task !== null;

  const [name, setName] = useState(task?.name ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [startDate, setStartDate] = useState(task?.startDate ?? todayISO());
  const [durationDays, setDurationDays] = useState(task?.durationDays ?? 5);
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'Medium');
  const [color, setColor] = useState(task?.color ?? TASK_COLORS[0]!);
  const [progress, setProgress] = useState(task?.progress ?? 0);
  const [parentId, setParentId] = useState<string>(task?.parentId ?? defaultParentId ?? '');
  const [resourceIds, setResourceIds] = useState<string[]>(task?.resourceIds ?? []);
  const [optimistic, setOptimistic] = useState<string>(
    task?.optimistic !== undefined ? String(task.optimistic) : ''
  );
  const [mostLikely, setMostLikely] = useState<string>(
    task?.mostLikely !== undefined ? String(task.mostLikely) : ''
  );
  const [pessimistic, setPessimistic] = useState<string>(
    task?.pessimistic !== undefined ? String(task.pessimistic) : ''
  );
  const [error, setError] = useState('');

  const parentCandidates = state.tasks.filter(
    (t) => t.id !== task?.id && t.parentId === null
  );

  const toggleResource = (id: string) => {
    setResourceIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const parseOptional = (value: string): number | undefined => {
    if (value.trim() === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim() === '') {
      setError('Nama tugas wajib diisi.');
      return;
    }
    if (durationDays < 1) {
      setError('Durasi minimal 1 hari kerja.');
      return;
    }
    const payload: Task = {
      id: task?.id ?? createId('task'),
      name: name.trim(),
      description: description.trim(),
      startDate,
      durationDays: Math.round(durationDays),
      priority,
      color,
      progress: Math.min(100, Math.max(0, Math.round(progress))),
      parentId: parentId === '' ? null : parentId,
      resourceIds,
      optimistic: parseOptional(optimistic),
      mostLikely: parseOptional(mostLikely),
      pessimistic: parseOptional(pessimistic),
    };
    dispatch(
      isEdit ? { type: 'UPDATE_TASK', task: payload } : { type: 'ADD_TASK', task: payload }
    );
    onClose();
  };

  return (
    <Modal
      title={isEdit ? 'Ubah Tugas' : 'Tambah Tugas'}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose} type="button">
            Batal
          </button>
          <button className="btn btn--primary" type="submit" form="task-form">
            {isEdit ? 'Simpan Perubahan' : 'Tambah Tugas'}
          </button>
        </>
      }
    >
      <form id="task-form" className="form" onSubmit={handleSubmit}>
        {error ? <div className="alert alert--error">{error}</div> : null}

        <div className="form-row">
          <label className="field field--grow">
            <span>Nama Tugas</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="cth. Pengembangan REST API"
              autoFocus
            />
          </label>
        </div>

        <label className="field">
          <span>Deskripsi</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Detail singkat tugas (opsional)"
          />
        </label>

        <div className="form-row">
          <label className="field">
            <span>Tanggal Mulai</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Durasi (hari kerja)</span>
            <input
              type="number"
              min={1}
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value))}
            />
          </label>
          <label className="field">
            <span>Prioritas</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Progres (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
            />
          </label>
        </div>

        <div className="form-row">
          <label className="field field--grow">
            <span>Tugas Induk (sub-tugas dari)</span>
            <select value={parentId ?? ''} onChange={(e) => setParentId(e.target.value)}>
              <option value="">— Tidak ada (tugas level atas) —</option>
              {parentCandidates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="field">
          <span>Warna Indikator</span>
          <div className="color-picker">
            {TASK_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                className={`swatch ${c === color ? 'swatch--active' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={`Warna ${c}`}
              />
            ))}
          </div>
        </div>

        <div className="field">
          <span>Alokasi Anggota Tim</span>
          {state.resources.length === 0 ? (
            <p className="muted">Belum ada anggota tim. Tambahkan di tab Sumber Daya.</p>
          ) : (
            <div className="checkbox-grid">
              {state.resources.map((r) => (
                <label key={r.id} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={resourceIds.includes(r.id)}
                    onChange={() => toggleResource(r.id)}
                  />
                  <span>
                    <strong>{r.name}</strong>
                    <em>{r.role}</em>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <details className="pert-fields">
          <summary>Estimasi PERT (opsional)</summary>
          <p className="muted">
            Kosongkan untuk memakai estimasi otomatis dari durasi: Optimistis = 80%,
            Realistis = durasi, Pesimistis = 150%.
          </p>
          <div className="form-row">
            <label className="field">
              <span>Optimistis (O)</span>
              <input
                type="number"
                min={1}
                value={optimistic}
                onChange={(e) => setOptimistic(e.target.value)}
                placeholder="auto"
              />
            </label>
            <label className="field">
              <span>Paling Mungkin (M)</span>
              <input
                type="number"
                min={1}
                value={mostLikely}
                onChange={(e) => setMostLikely(e.target.value)}
                placeholder="= durasi"
              />
            </label>
            <label className="field">
              <span>Pesimistis (P)</span>
              <input
                type="number"
                min={1}
                value={pessimistic}
                onChange={(e) => setPessimistic(e.target.value)}
                placeholder="auto"
              />
            </label>
          </div>
        </details>
      </form>
    </Modal>
  );
}
