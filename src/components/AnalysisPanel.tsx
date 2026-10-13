import { useMemo, useState } from 'react';
import { flattenTasks } from '../lib/tree';
import {
  computeProjectPert,
  pertEstimate,
  projectWorkDays,
  type ScheduledTask,
} from '../lib/scheduling';
import {
  countWorkingDays,
  formatShortDate,
  parseISO,
  toISO,
  todayISO,
} from '../lib/dateUtils';
import { probabilityWithin } from '../lib/stats';
import { useProject } from '../state/ProjectContext';
import { PertChart } from './PertChart';

function formatDateOrDash(d: Date | null | undefined): string {
  return d ? formatShortDate(d) : '—';
}

export function AnalysisPanel() {
  const { state, calendar, schedule } = useProject();
  const [targetDate, setTargetDate] = useState<string>(
    schedule.projectFinish ? toISO(schedule.projectFinish) : todayISO()
  );

  const workDays = projectWorkDays(schedule, calendar);
  const pert = useMemo(
    () => computeProjectPert(state.tasks, schedule.criticalPath),
    [state.tasks, schedule.criticalPath]
  );
  const criticalNames = schedule.criticalPath
    .map((id) => state.tasks.find((t) => t.id === id)?.name ?? id)
    .filter(Boolean);

  const rows = flattenTasks(state.tasks);
  const nameOf = (id: string) => state.tasks.find((t) => t.id === id)?.name ?? id;

  const probability = useMemo(() => {
    if (!schedule.projectStart || !targetDate) return null;
    const days = countWorkingDays(schedule.projectStart, parseISO(targetDate), calendar);
    return probabilityWithin(days, pert.expectedDuration, pert.stdDev);
  }, [schedule.projectStart, targetDate, calendar, pert]);

  const scheduleRows = useMemo(
    () =>
      rows
        .map(({ task, depth }) => ({ task, depth, sched: schedule.tasks.get(task.id) }))
        .filter((r) => r.sched),
    [rows, schedule]
  );

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Analisis Proyek</h2>
        <p className="muted">
          Jalur kritis dihitung dengan metode CPM (forward &amp; backward pass),
          sedangkan estimasi PERT memakai rata-rata berbobot (O + 4M + P) / 6.
        </p>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-card__label">Durasi Proyek (hari kerja)</span>
          <span className="stat-card__value">{workDays} hari</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Tanggal Selesai</span>
          <span className="stat-card__value">
            {formatDateOrDash(schedule.projectFinish)}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Jumlah Tugas Kritis</span>
          <span className="stat-card__value">
            {schedule.criticalPath.length} / {state.tasks.length}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Durasi PERT (TE)</span>
          <span className="stat-card__value">
            {pert.expectedDuration.toFixed(2)} hari
            <small> ± {pert.stdDev.toFixed(2)} hari</small>
          </span>
        </div>
      </div>

      <h3>Jalur Kritis (Critical Path)</h3>
      {schedule.hasCycle ? (
        <div className="alert alert--warning">
          Jalur kritis tidak dapat dihitung karena ada siklus pada dependency.
        </div>
      ) : criticalNames.length === 0 ? (
        <p className="muted">Tidak ada jalur kritis terdeteksi.</p>
      ) : (
        <ol className="critical-path">
          {criticalNames.map((name, i) => (
            <li key={i} className="chip chip--critical">
              {name}
              {i < criticalNames.length - 1 ? <span className="cp-arrow">→</span> : null}
            </li>
          ))}
        </ol>
      )}

      <h3>Analisis Peluang Penyelesaian (PERT)</h3>
      <div className="prob-box">
        <label className="field">
          <span>Target Tanggal Selesai</span>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </label>
        <div className="prob-result">
          {probability === null ? (
            <span className="muted">—</span>
          ) : (
            <>
              <strong>{(probability * 100).toFixed(1)}%</strong>
              <span className="muted">
                peluang proyek selesai pada atau sebelum tanggal tersebut
              </span>
            </>
          )}
        </div>
        <ul className="prob-ranges">
          <li>± 1σ: {Math.round(pert.expectedDuration - pert.stdDev)} – {Math.round(pert.expectedDuration + pert.stdDev)} hari (≈ 68%)</li>
          <li>± 2σ: {Math.round(pert.expectedDuration - 2 * pert.stdDev)} – {Math.round(pert.expectedDuration + 2 * pert.stdDev)} hari (≈ 95%)</li>
        </ul>
      </div>

      <h3>Diagram Jaringan PERT</h3>
      <PertChart
        tasks={state.tasks}
        dependencies={state.dependencies}
        criticalPath={schedule.criticalPath}
      />

      <h3>Jadwal CPM &amp; Slack per Tugas</h3>
      <div className="table-wrap">
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Tugas</th>
              <th className="num">Durasi</th>
              <th>Mulai (ES)</th>
              <th>Selesai (EF)</th>
              <th>Mulai Terlambat (LS)</th>
              <th>Selesai Terlambat (LF)</th>
              <th className="num">Slack</th>
              <th>Kritis</th>
            </tr>
          </thead>
          <tbody>
            {scheduleRows.map(({ task, depth, sched }) => (
              <ScheduleRow
                key={task.id}
                name={task.name}
                depth={depth}
                color={task.color}
                sched={sched!}
              />
            ))}
          </tbody>
        </table>
      </div>

      <h3>Estimasi PERT per Tugas</h3>
      <div className="table-wrap">
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Tugas</th>
              <th className="num">Optimistis (O)</th>
              <th className="num">Paling Mungkin (M)</th>
              <th className="num">Pesimistis (P)</th>
              <th className="num">TE = (O+4M+P)/6</th>
              <th className="num">Varians (σ²)</th>
              <th>Pendahulu</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ task, depth }) => {
              const est = pertEstimate(task);
              const preds = state.dependencies
                .filter((d) => d.successorId === task.id)
                .map((d) => `${nameOf(d.predecessorId)} (${d.type}${d.lagDays ? ` +${d.lagDays}` : ''})`);
              return (
                <tr key={task.id} className={schedule.tasks.get(task.id)?.critical ? 'row-critical' : ''}>
                  <td style={{ paddingLeft: 12 + depth * 16 }}>
                    <span className="color-dot" style={{ background: task.color }} />
                    {task.name}
                  </td>
                  <td className="num">{est.optimistic}</td>
                  <td className="num">{est.mostLikely}</td>
                  <td className="num">{est.pessimistic}</td>
                  <td className="num">
                    <strong>{est.expected.toFixed(2)}</strong>
                  </td>
                  <td className="num">{est.variance.toFixed(2)}</td>
                  <td className="muted">{preds.length ? preds.join(', ') : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ScheduleRow({
  name,
  depth,
  color,
  sched,
}: {
  name: string;
  depth: number;
  color: string;
  sched: ScheduledTask;
}) {
  return (
    <tr className={sched.critical ? 'row-critical' : ''}>
      <td style={{ paddingLeft: 12 + depth * 16 }}>
        <span className="color-dot" style={{ background: color }} />
        {name}
      </td>
      <td className="num">{sched.durationDays}</td>
      <td>{formatShortDate(sched.start)}</td>
      <td>{formatShortDate(sched.finish)}</td>
      <td>{formatShortDate(sched.lateStart)}</td>
      <td>{formatShortDate(sched.lateFinish)}</td>
      <td className="num">{sched.slack}</td>
      <td>{sched.critical ? <span className="badge-critical">Kritis</span> : '—'}</td>
    </tr>
  );
}
