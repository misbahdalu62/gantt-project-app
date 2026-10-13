import { useState, type FormEvent } from 'react';
import type { Dependency, DependencyType } from '../types';
import { createId } from '../lib/palette';
import { flattenTasks } from '../lib/tree';
import { useProject } from '../state/ProjectContext';

export function DependencyPanel() {
  const { state, dispatch, schedule } = useProject();
  const rows = flattenTasks(state.tasks);
  const [predecessorId, setPredecessorId] = useState('');
  const [successorId, setSuccessorId] = useState('');
  const [type, setType] = useState<DependencyType>('FS');
  const [lagDays, setLagDays] = useState(0);
  const [error, setError] = useState('');

  const nameOf = (id: string) =>
    state.tasks.find((t) => t.id === id)?.name ?? '(tidak ada)';

  const addDependency = (e: FormEvent) => {
    e.preventDefault();
    if (!predecessorId || !successorId) {
      setError('Pilih tugas pendahulu dan tugas lanjutan.');
      return;
    }
    if (predecessorId === successorId) {
      setError('Tugas tidak boleh menjadi pendahulu dirinya sendiri.');
      return;
    }
    const duplicate = state.dependencies.some(
      (d) => d.predecessorId === predecessorId && d.successorId === successorId
    );
    if (duplicate) {
      setError('Hubungan ini sudah ada.');
      return;
    }
    const dependency: Dependency = {
      id: createId('dep'),
      predecessorId,
      successorId,
      type,
      lagDays: Math.max(0, Math.round(lagDays)),
    };
    dispatch({ type: 'ADD_DEPENDENCY', dependency });
    setError('');
    setPredecessorId('');
    setSuccessorId('');
    setLagDays(0);
  };

  const update = (dependency: Dependency) =>
    dispatch({ type: 'UPDATE_DEPENDENCY', dependency });

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Hubungan Antar Tugas (Predecessors)</h2>
        <p className="muted">
          <strong>FS</strong> (Finish-to-Start): tugas lanjutan mulai setelah pendahulu
          selesai. <strong>SS</strong> (Start-to-Start): tugas lanjutan mulai bersamaan
          dengan pendahulu, ditambah jeda (lag) dalam hari kerja.
        </p>
      </div>

      <form className="inline-form" onSubmit={addDependency}>
        <label className="field">
          <span>Pendahulu</span>
          <select value={predecessorId} onChange={(e) => setPredecessorId(e.target.value)}>
            <option value="">— Pilih —</option>
            {rows.map(({ task, depth }) => (
              <option key={task.id} value={task.id}>
                {'\u00A0'.repeat(depth * 2)}
                {task.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Tipe</span>
          <select value={type} onChange={(e) => setType(e.target.value as DependencyType)}>
            <option value="FS">Finish-to-Start (FS)</option>
            <option value="SS">Start-to-Start (SS)</option>
          </select>
        </label>
        <label className="field">
          <span>Jeda (hari kerja)</span>
          <input
            type="number"
            min={0}
            value={lagDays}
            onChange={(e) => setLagDays(Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span>Lanjutan</span>
          <select value={successorId} onChange={(e) => setSuccessorId(e.target.value)}>
            <option value="">— Pilih —</option>
            {rows.map(({ task, depth }) => (
              <option key={task.id} value={task.id}>
                {'\u00A0'.repeat(depth * 2)}
                {task.name}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn--primary" type="submit">
          + Tambah
        </button>
      </form>
      {error ? <div className="alert alert--error">{error}</div> : null}

      {state.dependencies.length === 0 ? (
        <p className="muted">Belum ada hubungan antar tugas.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Pendahulu</th>
                <th>Tipe</th>
                <th>Jeda</th>
                <th>Lanjutan</th>
                <th>Slack Lanjutan</th>
                <th aria-label="Aksi" />
              </tr>
            </thead>
            <tbody>
              {state.dependencies.map((dep) => {
                const succSched = schedule.tasks.get(dep.successorId);
                return (
                  <tr key={dep.id}>
                    <td>{nameOf(dep.predecessorId)}</td>
                    <td>
                      <select
                        value={dep.type}
                        onChange={(e) =>
                          update({ ...dep, type: e.target.value as DependencyType })
                        }
                      >
                        <option value="FS">FS</option>
                        <option value="SS">SS</option>
                      </select>
                    </td>
                    <td>
                      <input
                        className="input--tiny"
                        type="number"
                        min={0}
                        value={dep.lagDays}
                        onChange={(e) =>
                          update({ ...dep, lagDays: Math.max(0, Number(e.target.value)) })
                        }
                      />
                    </td>
                    <td>{nameOf(dep.successorId)}</td>
                    <td>
                      {succSched ? (
                        <span
                          className={
                            succSched.critical ? 'text-critical' : 'muted'
                          }
                        >
                          {succSched.slack} hari
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <button
                        className="icon-btn icon-btn--danger"
                        title="Hapus hubungan"
                        onClick={() => dispatch({ type: 'DELETE_DEPENDENCY', id: dep.id })}
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
