import { useEffect, useMemo, useRef, useState } from 'react';
import type { Task } from '../types';
import { DAY_SHORT, MONTH_SHORT, PRIORITY_LABEL } from '../types';
import { PRIORITY_COLORS } from '../lib/palette';
import {
  addDays,
  countWorkingDays,
  daysBetweenInclusive,
  eachDay,
  isWorkingDay,
  parseISO,
  snapToWorkingDay,
  startOfDay,
  toISO,
  todayISO,
} from '../lib/dateUtils';
import { flattenTasks } from '../lib/tree';
import { useProject } from '../state/ProjectContext';

const LABEL_WIDTH = 268;
const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 58;

interface DragState {
  mode: 'move' | 'resize';
  task: Task;
  startX: number;
  origPinnedStart: Date;
  origSchedStart: Date;
  origSchedFinish: Date;
  lastDelta: number;
}

function xForDate(date: Date, rangeStart: Date, pxPerDay: number): number {
  return (daysBetweenInclusive(rangeStart, date) - 1) * pxPerDay;
}

export function GanttChart() {
  const { state, dispatch, calendar, schedule } = useProject();
  const [pxPerDay, setPxPerDay] = useState(30);
  const [showCritical, setShowCritical] = useState(true);
  const [compact, setCompact] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const rows = useMemo(() => flattenTasks(state.tasks), [state.tasks]);

  const range = useMemo(() => {
    const dates: Date[] = [];
    for (const s of schedule.tasks.values()) {
      dates.push(s.start, s.finish);
    }
    for (const t of state.tasks) dates.push(parseISO(t.startDate));
    if (dates.length === 0) {
      const now = startOfDay(new Date());
      return { start: addDays(now, -3), end: addDays(now, 21) };
    }
    let min = dates[0]!;
    let max = dates[0]!;
    for (const d of dates) {
      if (d.getTime() < min.getTime()) min = d;
      if (d.getTime() > max.getTime()) max = d;
    }
    return { start: addDays(min, -2), end: addDays(max, 3) };
  }, [schedule, state.tasks]);

  const days = useMemo(() => {
    const all = eachDay(range.start, range.end);
    return all.slice(0, 500);
  }, [range]);

  const timelineWidth = days.length * pxPerDay;
  const bodyHeight = rows.length * ROW_HEIGHT;

  const rowIndex = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r, i) => m.set(r.task.id, i));
    return m;
  }, [rows]);

  const todayX = useMemo(() => {
    const t = startOfDay(new Date());
    if (t < range.start || t > range.end) return null;
    return xForDate(t, range.start, pxPerDay);
  }, [range, pxPerDay]);

  // ---- Drag & resize ----
  useEffect(() => {
    if (!draggingId) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const deltaDays = Math.round((e.clientX - d.startX) / pxPerDay);
      if (deltaDays === d.lastDelta) return;
      d.lastDelta = deltaDays;
      if (d.mode === 'move') {
        const raw = addDays(d.origPinnedStart, deltaDays);
        const snapped = snapToWorkingDay(raw, calendar);
        dispatch({
          type: 'UPDATE_TASK',
          task: { ...d.task, startDate: toISO(snapped) },
        });
      } else {
        const rawFinish = addDays(d.origSchedFinish, deltaDays);
        const snapped = snapToWorkingDay(rawFinish, calendar);
        const dur = Math.max(1, countWorkingDays(d.origSchedStart, snapped, calendar));
        dispatch({
          type: 'UPDATE_TASK',
          task: { ...d.task, durationDays: dur },
        });
      }
    };
    const onUp = () => {
      dragRef.current = null;
      setDraggingId(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [draggingId, pxPerDay, calendar, dispatch]);

  const beginDrag = (
    e: React.PointerEvent,
    task: Task,
    mode: 'move' | 'resize'
  ) => {
    const sched = schedule.tasks.get(task.id);
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      mode,
      task,
      startX: e.clientX,
      origPinnedStart: parseISO(task.startDate),
      origSchedStart: sched?.start ?? parseISO(task.startDate),
      origSchedFinish: sched?.finish ?? parseISO(task.startDate),
      lastDelta: 0,
    };
    setDraggingId(task.id);
  };

  const handleDelete = (task: Task) => {
    if (window.confirm(`Hapus tugas "${task.name}" beserta sub-tugasnya?`)) {
      dispatch({ type: 'DELETE_TASK', id: task.id });
    }
  };

  const barGeometry = (task: Task) => {
    const sched = schedule.tasks.get(task.id);
    const start = sched?.start ?? parseISO(task.startDate);
    const finish = sched?.finish ?? start;
    const left = xForDate(start, range.start, pxPerDay);
    const width = Math.max(pxPerDay * 0.6, daysBetweenInclusive(start, finish) * pxPerDay);
    return { left, width, critical: sched?.critical ?? false, progress: task.progress };
  };

  const monthBands = useMemo(() => {
    const bands: { label: string; left: number; width: number }[] = [];
    days.forEach((d, i) => {
      if (i === 0 || d.getDate() === 1) {
        bands.push({
          label: `${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`,
          left: i * pxPerDay,
          width: pxPerDay,
        });
      } else {
        bands[bands.length - 1]!.width += pxPerDay;
      }
    });
    return bands;
  }, [days, pxPerDay]);

  return (
    <section className="panel">
      <div className="panel__toolbar">
        <div className="toolbar-group">
          <button
            className="btn btn--primary"
            onClick={() => {
              const evt = new CustomEvent('open-task-form');
              window.dispatchEvent(evt);
            }}
          >
            + Tambah Tugas
          </button>
          <button className="btn" onClick={() => setCompact((c) => !c)}>
            {compact ? 'Tampilkan Semua Kolom' : 'Mode Ringkas'}
          </button>
        </div>
        <div className="toolbar-group">
          <label className="toggle">
            <input
              type="checkbox"
              checked={showCritical}
              onChange={(e) => setShowCritical(e.target.checked)}
            />
            <span>Tandai Jalur Kritis</span>
          </label>
          <span className="muted">Zoom</span>
          <button
            className="btn btn--sm"
            onClick={() => setPxPerDay((p) => Math.max(12, p - 6))}
          >
            −
          </button>
          <span className="zoom-value">{pxPerDay}px/hari</span>
          <button
            className="btn btn--sm"
            onClick={() => setPxPerDay((p) => Math.min(80, p + 6))}
          >
            +
          </button>
        </div>
      </div>

      {schedule.hasCycle ? (
        <div className="alert alert--warning">
          Terdeteksi siklus pada dependency. Jadwal memakai tanggal mulai manual —
          hapus salah satu hubungan untuk mendapatkan jadwal otomatis.
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="empty-state">
          <p>Belum ada tugas. Klik “+ Tambah Tugas” untuk memulai.</p>
        </div>
      ) : (
        <div className="gantt-viewport">
          <div
            className="gantt-inner"
            style={{ width: LABEL_WIDTH + timelineWidth, position: 'relative' }}
          >
            {/* Header */}
            <div
              className="gantt-header"
              style={{ height: HEADER_HEIGHT, position: 'sticky', top: 0, zIndex: 6 }}
            >
              <div
                className="gantt-header__label"
                style={{
                  width: LABEL_WIDTH,
                  position: 'sticky',
                  left: 0,
                  zIndex: 2,
                }}
              >
                Tugas
              </div>
              <div className="gantt-header__days" style={{ width: timelineWidth }}>
                <div className="gantt-months" style={{ height: 24 }}>
                  {monthBands.map((b, i) => (
                    <span
                      key={i}
                      className="gantt-month"
                      style={{ left: b.left, width: b.width }}
                    >
                      {b.width > 48 ? b.label : ''}
                    </span>
                  ))}
                </div>
                <div className="gantt-days" style={{ height: HEADER_HEIGHT - 24 }}>
                  {days.map((d, i) => (
                    <div
                      key={i}
                      className={`gantt-day ${isWorkingDay(d, calendar) ? '' : 'gantt-day--off'} ${
                        toISO(d) === todayISO() ? 'gantt-day--today' : ''
                      }`}
                      style={{ width: pxPerDay }}
                    >
                      <span className="gantt-day__num">{d.getDate()}</span>
                      {pxPerDay >= 24 ? (
                        <span className="gantt-day__dow">{DAY_SHORT[d.getDay()]}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Track area with zebra/shading */}
            <div className="gantt-body" style={{ position: 'relative' }}>
              <div
                className="gantt-shading"
                style={{ left: LABEL_WIDTH, width: timelineWidth, height: bodyHeight }}
              >
                {days.map((d, i) =>
                  isWorkingDay(d, calendar) ? null : (
                    <div
                      key={i}
                      className="gantt-shade"
                      style={{ left: i * pxPerDay, width: pxPerDay }}
                    />
                  )
                )}
                {todayX !== null ? (
                  <div className="gantt-today-line" style={{ left: todayX }} />
                ) : null}
              </div>

              {/* Rows */}
              {rows.map(({ task, depth, hasChildren }) => {
                const geo = barGeometry(task);
                const sched = schedule.tasks.get(task.id);
                const isCritical = geo.critical && showCritical;
                return (
                  <div
                    key={task.id}
                    className={`gantt-row ${draggingId === task.id ? 'is-dragging' : ''}`}
                    style={{ height: ROW_HEIGHT }}
                  >
                    <div
                      className="gantt-row__label"
                      style={{
                        width: LABEL_WIDTH,
                        position: 'sticky',
                        left: 0,
                        paddingLeft: 10 + depth * 16,
                      }}
                    >
                      {hasChildren ? <span className="tree-marker">▾</span> : null}
                      <span
                        className="color-dot"
                        style={{ background: task.color }}
                      />
                      <button
                        className="link-btn task-name"
                        title={task.description || task.name}
                        onClick={() => {
                          window.dispatchEvent(
                            new CustomEvent('edit-task', { detail: task.id })
                          );
                        }}
                      >
                        {task.name}
                      </button>
                      {!compact ? (
                        <span
                          className="priority-badge"
                          style={{ background: PRIORITY_COLORS[task.priority] }}
                          title={`Prioritas: ${PRIORITY_LABEL[task.priority]}`}
                        >
                          {task.priority === 'High' ? 'H' : task.priority === 'Low' ? 'L' : 'M'}
                        </span>
                      ) : null}
                      <span className="row-actions">
                        <button
                          className="icon-btn"
                          title="Tambah sub-tugas"
                          onClick={() =>
                            window.dispatchEvent(
                              new CustomEvent('add-subtask', { detail: task.id })
                            )
                          }
                        >
                          ＋
                        </button>
                        <button
                          className="icon-btn"
                          title="Ubah tugas"
                          onClick={() =>
                            window.dispatchEvent(
                              new CustomEvent('edit-task', { detail: task.id })
                            )
                          }
                        >
                          ✎
                        </button>
                        <button
                          className="icon-btn icon-btn--danger"
                          title="Hapus tugas"
                          onClick={() => handleDelete(task)}
                        >
                          🗑
                        </button>
                      </span>
                    </div>
                    <div
                      className="gantt-row__track"
                      style={{ width: timelineWidth, height: ROW_HEIGHT }}
                    >
                      <div
                        className={`gantt-bar ${isCritical ? 'gantt-bar--critical' : ''}`}
                        style={{
                          left: geo.left,
                          width: geo.width,
                          background: task.color,
                        }}
                        onPointerDown={(e) => {
                          if ((e.target as HTMLElement).dataset.handle) return;
                          beginDrag(e, task, 'move');
                        }}
                        title={`${task.name}\n${toISO(sched?.start ?? parseISO(task.startDate))} → ${toISO(
                          sched?.finish ?? parseISO(task.startDate)
                        )}\n${task.durationDays} hari kerja•slack ${sched?.slack ?? 0} hari`}
                      >
                        {task.progress > 0 ? (
                          <div
                            className="gantt-bar__progress"
                            style={{ width: `${task.progress}%` }}
                          />
                        ) : null}
                        <span className="gantt-bar__label">
                          {geo.width > 70 ? `${task.durationDays}h` : ''}
                        </span>
                        <span
                          className="gantt-bar__handle"
                          data-handle="resize"
                          onPointerDown={(e) => beginDrag(e, task, 'resize')}
                          title="Tarik untuk mengubah durasi"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Dependency arrows */}
              <svg
                className="gantt-arrows"
                style={{
                  left: LABEL_WIDTH,
                  top: 0,
                  width: timelineWidth,
                  height: bodyHeight,
                }}
              >
                <defs>
                  <marker
                    id="gantt-arrow"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
                  </marker>
                  <marker
                    id="gantt-arrow-critical"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
                  </marker>
                </defs>
                {state.dependencies.map((dep) => {
                  const pi = rowIndex.get(dep.predecessorId);
                  const si = rowIndex.get(dep.successorId);
                  const pred = schedule.tasks.get(dep.predecessorId);
                  const succ = schedule.tasks.get(dep.successorId);
                  if (pi === undefined || si === undefined || !pred || !succ) return null;
                  const y1 = pi * ROW_HEIGHT + ROW_HEIGHT / 2;
                  const y2 = si * ROW_HEIGHT + ROW_HEIGHT / 2;
                  const x1 =
                    dep.type === 'FS'
                      ? xForDate(pred.finish, range.start, pxPerDay) + pxPerDay
                      : xForDate(pred.start, range.start, pxPerDay);
                  const x2 = xForDate(succ.start, range.start, pxPerDay);
                  const critical =
                    showCritical && pred.critical && succ.critical && pred.slack === 0;
                  const midX =
                    dep.type === 'FS'
                      ? Math.max(x1 + 10, x2 - 10)
                      : Math.min(x1 - 10, x2 - 10);
                  const d = `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;
                  return (
                    <g key={dep.id} className="gantt-dep">
                      <path
                        d={d}
                        fill="none"
                        stroke={critical ? '#ef4444' : '#64748b'}
                        strokeWidth={critical ? 2 : 1.4}
                        markerEnd={
                          critical ? 'url(#gantt-arrow-critical)' : 'url(#gantt-arrow)'
                        }
                      />
                      <title>
                        {`${dep.type}${dep.lagDays ? ` +${dep.lagDays} hari` : ''}`}
                      </title>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
