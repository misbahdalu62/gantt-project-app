import { useState, type FormEvent } from 'react';
import { DAY_NAMES } from '../types';
import { createId } from '../lib/palette';
import { formatLongDate, parseISO } from '../lib/dateUtils';
import { computeProjectPert, projectWorkDays } from '../lib/scheduling';
import { useProject } from '../state/ProjectContext';

export function CalendarPanel() {
  const { state, dispatch, schedule } = useProject();
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [error, setError] = useState('');

  const { calendar } = state;

  const toggleWeekend = (day: number) => {
    const set = new Set(calendar.weekendDays);
    if (set.has(day)) set.delete(day);
    else set.add(day);
    dispatch({
      type: 'SET_CALENDAR',
      calendar: { ...calendar, weekendDays: [...set].sort((a, b) => a - b) },
    });
  };

  const addHoliday = (e: FormEvent) => {
    e.preventDefault();
    if (!holidayDate) return setError('Pilih tanggal hari libur.');
    if (calendar.holidays.some((h) => h.date === holidayDate)) {
      return setError('Tanggal tersebut sudah terdaftar sebagai hari libur.');
    }
    dispatch({
      type: 'SET_CALENDAR',
      calendar: {
        ...calendar,
        holidays: [
          ...calendar.holidays,
          {
            id: createId('hol'),
            date: holidayDate,
            name: holidayName.trim() || 'Hari Libur',
          },
        ].sort((a, b) => a.date.localeCompare(b.date)),
      },
    });
    setHolidayDate('');
    setHolidayName('');
    setError('');
  };

  const removeHoliday = (id: string) => {
    dispatch({
      type: 'SET_CALENDAR',
      calendar: {
        ...calendar,
        holidays: calendar.holidays.filter((h) => h.id !== id),
      },
    });
  };

  const workDays = projectWorkDays(schedule, {
    weekendDays: calendar.weekendDays,
    holidaySet: new Set(calendar.holidays.map((h) => h.date)),
  });
  const pert = computeProjectPert(state.tasks, schedule.criticalPath);

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Kalender Proyek</h2>
        <p className="muted">
          Durasi tugas dihitung dalam <strong>hari kerja</strong>. Hari yang dipilih
          sebagai akhir pekan dan hari libur tidak dihitung.
        </p>
      </div>

      <div className="calendar-summary">
        <div className="stat-card">
          <span className="stat-card__label">Mulai Proyek</span>
          <span className="stat-card__value">
            {schedule.projectStart ? formatLongDate(schedule.projectStart) : '—'}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Selesai Proyek</span>
          <span className="stat-card__value">
            {schedule.projectFinish ? formatLongDate(schedule.projectFinish) : '—'}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Total Hari Kerja</span>
          <span className="stat-card__value">{workDays} hari</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Estimasi PERT</span>
          <span className="stat-card__value">
            {pert.expectedDuration.toFixed(1)} hari (± {pert.stdDev.toFixed(2)})
          </span>
        </div>
      </div>

      <h3>Akhir Pekan (Weekend)</h3>
      <div className="weekend-picker">
        {DAY_NAMES.map((name, index) => (
          <button
            key={index}
            className={`day-toggle ${calendar.weekendDays.includes(index) ? 'day-toggle--active' : ''}`}
            onClick={() => toggleWeekend(index)}
          >
            {name}
          </button>
        ))}
      </div>

      <h3>Hari Libur Khusus</h3>
      <form className="inline-form" onSubmit={addHoliday}>
        <label className="field">
          <span>Tanggal</span>
          <input
            type="date"
            value={holidayDate}
            onChange={(e) => setHolidayDate(e.target.value)}
          />
        </label>
        <label className="field field--grow">
          <span>Keterangan</span>
          <input
            value={holidayName}
            onChange={(e) => setHolidayName(e.target.value)}
            placeholder="cth. Libur Nasional"
          />
        </label>
        <button className="btn btn--primary" type="submit">
          + Tambah Hari Libur
        </button>
      </form>
      {error ? <div className="alert alert--error">{error}</div> : null}

      {calendar.holidays.length === 0 ? (
        <p className="muted">Belum ada hari libur khusus.</p>
      ) : (
        <ul className="holiday-list">
          {calendar.holidays.map((h) => (
            <li key={h.id}>
              <span className="holiday-date">{formatLongDate(parseISO(h.date))}</span>
              <span className="holiday-name">{h.name}</span>
              <button
                className="icon-btn icon-btn--danger"
                title="Hapus"
                onClick={() => removeHoliday(h.id)}
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
