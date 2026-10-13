// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';
import { ProjectProvider } from './state/ProjectContext';

function renderApp() {
  return render(
    <ProjectProvider>
      <App />
    </ProjectProvider>
  );
}

describe('App — smoke test antarmuka', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('memuat data contoh dan menampilkan Gantt beserta tugasnya', () => {
    renderApp();
    expect(screen.getByText('Manajemen Proyek Gantt')).toBeTruthy();
    const company = screen.getAllByText(/Fase 1 — Analisis Kebutuhan/);
    expect(company.length).toBeGreaterThan(0);
    // Bar Gantt ikut ter-render.
    expect(document.querySelectorAll('.gantt-bar').length).toBeGreaterThan(0);
    // Panah dependency ter-render pada SVG.
    expect(document.querySelectorAll('.gantt-dep').length).toBeGreaterThan(0);
  });

  it('menambahkan tugas baru melalui form', () => {
    renderApp();
    fireEvent.click(screen.getByText('+ Tambah Tugas'));

    const dialog = screen.getByRole('dialog');
    const nameInput = within(dialog).getByPlaceholderText(
      'cth. Pengembangan REST API'
    );
    fireEvent.change(nameInput, { target: { value: 'Tugas Uji Otomatis' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tambah Tugas' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getAllByText('Tugas Uji Otomatis').length).toBeGreaterThan(0);
  });

  it('menyimpan data ke localStorage dan memuatnya kembali', () => {
    const first = renderApp();
    fireEvent.click(screen.getByText('+ Tambah Tugas'));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByPlaceholderText('cth. Pengembangan REST API'), {
      target: { value: 'Tugas Persisten' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tambah Tugas' }));

    expect(localStorage.getItem('gantt-project-manager:v1')).toContain('Tugas Persisten');
    first.unmount();

    // Render ulang tanpa membersihkan storage -> data harus dimuat dari localStorage.
    renderApp();
    expect(screen.getAllByText('Tugas Persisten').length).toBeGreaterThan(0);
  });

  it('berpindah antar tab dan menampilkan analisis jalur kritis', () => {
    renderApp();
    fireEvent.click(screen.getByRole('tab', { name: /Analisis/ }));
    expect(screen.getByText('Jalur Kritis (Critical Path)')).toBeTruthy();
    expect(screen.getByText('Diagram Jaringan PERT')).toBeTruthy();
    expect(document.querySelectorAll('.pert-node').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('tab', { name: /Kalender/ }));
    expect(screen.getByText('Kalender Proyek')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /Sumber Daya/ }));
    expect(screen.getByText('Sumber Daya (Tim)')).toBeTruthy();
  });
});
