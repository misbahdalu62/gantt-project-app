import { useState, type FormEvent } from 'react';
import type { Resource } from '../types';
import { createId } from '../lib/palette';
import { formatIDR } from '../lib/dateUtils';
import { useProject } from '../state/ProjectContext';
import { Modal } from './Modal';

interface ResourceFormProps {
  resource: Resource | null;
  onClose: () => void;
}

function ResourceForm({ resource, onClose }: ResourceFormProps) {
  const { dispatch } = useProject();
  const [name, setName] = useState(resource?.name ?? '');
  const [email, setEmail] = useState(resource?.email ?? '');
  const [role, setRole] = useState(resource?.role ?? '');
  const [salary, setSalary] = useState(resource?.salary ?? 0);
  const [error, setError] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim() === '') return setError('Nama wajib diisi.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Email tidak valid.');
    dispatch({
      type: 'SAVE_RESOURCE',
      resource: {
        id: resource?.id ?? createId('res'),
        name: name.trim(),
        email: email.trim(),
        role: role.trim(),
        salary: Math.max(0, Number(salary) || 0),
      },
    });
    onClose();
  };

  return (
    <Modal
      title={resource ? 'Ubah Anggota Tim' : 'Tambah Anggota Tim'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" type="button" onClick={onClose}>
            Batal
          </button>
          <button className="btn btn--primary" type="submit" form="resource-form">
            Simpan
          </button>
        </>
      }
    >
      <form id="resource-form" className="form" onSubmit={submit}>
        {error ? <div className="alert alert--error">{error}</div> : null}
        <label className="field">
          <span>Nama</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@perusahaan.com"
          />
        </label>
        <div className="form-row">
          <label className="field field--grow">
            <span>Peran</span>
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="cth. Backend Engineer"
            />
          </label>
          <label className="field">
            <span>Gaji per Bulan (IDR)</span>
            <input
              type="number"
              min={0}
              step={500000}
              value={salary}
              onChange={(e) => setSalary(Number(e.target.value))}
            />
          </label>
        </div>
      </form>
    </Modal>
  );
}

export function ResourcePanel() {
  const { state, dispatch, schedule } = useProject();
  const [editing, setEditing] = useState<Resource | null | 'new'>(null);

  const allocatedTasks = (resourceId: string) =>
    state.tasks.filter((t) => t.resourceIds.includes(resourceId));

  const totalMonthly = state.resources.reduce((sum, r) => sum + r.salary, 0);

  return (
    <section className="panel">
      <div className="panel__toolbar">
        <div className="panel__head">
          <h2>Sumber Daya (Tim)</h2>
          <p className="muted">
            {state.resources.length} anggota • total biaya bulanan {formatIDR(totalMonthly)}
          </p>
        </div>
        <button className="btn btn--primary" onClick={() => setEditing('new')}>
          + Tambah Anggota
        </button>
      </div>

      {state.resources.length === 0 ? (
        <p className="muted">Belum ada anggota tim terdaftar.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Email</th>
                <th>Peran</th>
                <th className="num">Gaji / Bulan</th>
                <th className="num">Tugas Terkait</th>
                <th>Alokasi Tugas</th>
                <th aria-label="Aksi" />
              </tr>
            </thead>
            <tbody>
              {state.resources.map((r) => {
                const tasks = allocatedTasks(r.id);
                return (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.name}</strong>
                    </td>
                    <td>{r.email}</td>
                    <td>{r.role}</td>
                    <td className="num">{formatIDR(r.salary)}</td>
                    <td className="num">{tasks.length}</td>
                    <td className="cell-wrap">
                      {tasks.length === 0 ? (
                        <span className="muted">— belum dialokasikan —</span>
                      ) : (
                        tasks.map((t) => (
                          <span
                            key={t.id}
                            className="chip"
                            style={{ borderColor: t.color }}
                            title={`${t.durationDays} hari kerja${
                              schedule.tasks.get(t.id)
                                ? ` • slack ${schedule.tasks.get(t.id)!.slack} hari`
                                : ''
                            }`}
                          >
                            {t.name}
                          </span>
                        ))
                      )}
                    </td>
                    <td className="row-actions-cell">
                      <button className="icon-btn" title="Ubah" onClick={() => setEditing(r)}>
                        ✎
                      </button>
                      <button
                        className="icon-btn icon-btn--danger"
                        title="Hapus"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Hapus ${r.name}? Alokasi pada tugas juga akan dihapus.`
                            )
                          ) {
                            dispatch({ type: 'DELETE_RESOURCE', id: r.id });
                          }
                        }}
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

      {editing !== null ? (
        <ResourceForm
          resource={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </section>
  );
}
