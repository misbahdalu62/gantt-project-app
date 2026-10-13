import type { ProjectState } from '../types';
import { createId } from './palette';

/**
 * Data contoh (seed) sehingga aplikasi langsung terisi saat pertama dibuka.
 * Tanggal dipilih pada Oktober–November 2026.
 */
export function createSeedState(): ProjectState {
  const r = (name: string, email: string, role: string, salary: number) => ({
    id: createId('res'),
    name,
    email,
    role,
    salary,
  });

  const budi = r('Budi Santoso', 'budi@example.com', 'Project Manager', 18000000);
  const siti = r('Siti Aminah', 'siti@example.com', 'UI/UX Designer', 12000000);
  const andi = r('Andi Pratama', 'andi@example.com', 'Backend Engineer', 15000000);
  const dewi = r('Dewi Lestari', 'dewi@example.com', 'Frontend Engineer', 14000000);
  const rizky = r('Rizky Nugraha', 'rizky@example.com', 'QA Engineer', 11000000);

  const t = (
    name: string,
    startDate: string,
    durationDays: number,
    color: string,
    resourceIds: string[],
    priority: ProjectState['tasks'][number]['priority'] = 'Medium',
    parentId: string | null = null,
    description = ''
  ): ProjectState['tasks'][number] => ({
    id: createId('task'),
    name,
    description,
    startDate,
    durationDays,
    priority,
    color,
    progress: 0,
    parentId,
    resourceIds,
  });

  // ---- Fase (parent) ----
  const phase1 = t(
    'Fase 1 — Analisis Kebutuhan',
    '2026-10-01',
    5,
    '#3b82f6',
    [budi.id],
    'High',
    null,
    'Pengumpulan dan pendokumentasian kebutuhan sistem.'
  );
  const phase2 = t(
    'Fase 2 — Desain UI/UX',
    '2026-10-08',
    8,
    '#8b5cf6',
    [siti.id, budi.id],
    'High',
    null,
    'Perancangan antarmuka dan pengalaman pengguna.'
  );
  const phase3 = t(
    'Fase 3 — Pengembangan',
    '2026-10-14',
    14,
    '#22c55e',
    [andi.id, dewi.id],
    'High',
    null,
    'Implementasi backend dan frontend.'
  );
  const phase4 = t(
    'Fase 4 — Pengujian',
    '2026-11-03',
    8,
    '#f97316',
    [rizky.id, andi.id],
    'Medium',
    null,
    'Integrasi, QA, dan UAT.'
  );
  const phase5 = t(
    'Fase 5 — Peluncuran',
    '2026-11-13',
    3,
    '#ef4444',
    [budi.id, dewi.id],
    'High',
    null,
    'Deployment ke produksi dan monitoring awal.'
  );

  // ---- Sub-tugas ----
  const subWawancara = t(
    'Wawancara Stakeholder',
    '2026-10-01',
    3,
    '#60a5fa',
    [budi.id],
    'Medium',
    phase1.id
  );
  const subSRS = t(
    'Penyusunan Dokumen SRS',
    '2026-10-06',
    3,
    '#60a5fa',
    [budi.id],
    'High',
    phase1.id
  );
  const subWireframe = t(
    'Wireframe & User Flow',
    '2026-10-08',
    4,
    '#a78bfa',
    [siti.id],
    'Medium',
    phase2.id
  );
  const subPrototipe = t(
    'Prototipe High-Fidelity',
    '2026-10-14',
    4,
    '#a78bfa',
    [siti.id],
    'High',
    phase2.id
  );
  const subInfra = t(
    'Setup Infrastruktur & Database',
    '2026-10-14',
    4,
    '#4ade80',
    [andi.id],
    'High',
    phase3.id
  );
  const subApi = t(
    'Pengembangan REST API',
    '2026-10-20',
    9,
    '#4ade80',
    [andi.id],
    'High',
    phase3.id
  );
  const subFrontend = t(
    'Implementasi Antarmuka Web',
    '2026-10-19',
    10,
    '#2dd4bf',
    [dewi.id],
    'High',
    phase3.id
  );
  const subQa = t(
    'QA & Bug Fixing',
    '2026-11-03',
    5,
    '#fb923c',
    [rizky.id],
    'Medium',
    phase4.id
  );
  const subUat = t(
    'User Acceptance Test',
    '2026-11-10',
    3,
    '#fb923c',
    [budi.id, rizky.id],
    'Medium',
    phase4.id
  );

  const tasks = [
    phase1,
    subWawancara,
    subSRS,
    phase2,
    subWireframe,
    subPrototipe,
    phase3,
    subInfra,
    subApi,
    subFrontend,
    phase4,
    subQa,
    subUat,
    phase5,
  ];

  const dep = (
    predecessorId: string,
    successorId: string,
    type: 'FS' | 'SS',
    lagDays: number
  ) => ({ id: createId('dep'), predecessorId, successorId, type, lagDays });

  const dependencies = [
    // Fase-fase utama
    dep(phase1.id, phase2.id, 'FS', 0),
    dep(phase2.id, phase3.id, 'SS', 2),
    dep(phase3.id, phase4.id, 'FS', 0),
    dep(phase4.id, phase5.id, 'FS', 0),
    // Sub-tugas dalam fase
    dep(subWawancara.id, subSRS.id, 'FS', 0),
    dep(subWireframe.id, subPrototipe.id, 'FS', 0),
    dep(subInfra.id, subApi.id, 'FS', 0),
    dep(subApi.id, subFrontend.id, 'SS', 1),
    dep(subFrontend.id, subQa.id, 'FS', 0),
    dep(subQa.id, subUat.id, 'FS', 0),
  ];

  return {
    projectName: 'Peluncuran Aplikasi Mobile',
    tasks,
    dependencies,
    resources: [budi, siti, andi, dewi, rizky],
    calendar: {
      weekendDays: [0, 6],
      holidays: [
        { id: createId('hol'), date: '2026-10-05', name: 'Cuti Bersama' },
        { id: createId('hol'), date: '2026-10-26', name: 'Libur Nasional' },
      ],
    },
  };
}
