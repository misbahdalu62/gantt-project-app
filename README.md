# 📈 Manajemen Proyek berbasis Gantt Chart

Aplikasi manajemen proyek lengkap dengan **Gantt Chart interaktif**, **perhitungan hari kerja**,
**manajemen sumber daya**, dan **analisis jalur kritis (CPM) + diagram PERT**.

Dibangun dengan **React 18 + TypeScript + Vite**. Seluruh data disimpan otomatis di
`localStorage` peramban — tanpa backend, tanpa database.

---

## ✨ Fitur

### 1. Manajemen Tugas (Task Management)
- Tambah, ubah, dan hapus tugas lengkap dengan deskripsi.
- **Durasi dalam hari kerja** (weekend & hari libur tidak dihitung).
- Tanggal mulai, **prioritas** (Low / Medium / High), dan **warna indikator**.
- **Sub-tugas (parent–child)** berlapis dengan indentasi pada tabel & Gantt.
- Progres tugas (0–100 %) yang tampil sebagai overlay pada bar Gantt.
- Ekspor / impor seluruh proyek ke file JSON.

### 2. Predecessors & Tampilan Timeline
- Hubungan antar tugas:
  - **FS (Finish-to-Start)** — tugas lanjutan mulai setelah pendahulu selesai.
  - **SS (Start-to-Start)** — tugas lanjutan mulai bersamaan dengan pendahulu.
  - Masing-masing mendukung **jeda (lag) dalam hari kerja**.
- **Gantt Chart** dengan bar tugas, **panah dependency**, dan penanda jalur kritis.
- **Drag bar** untuk memindahkan tanggal mulai, **tarik ujung kanan** untuk mengubah durasi.
- Zoom timeline, mode ringkas, garis “hari ini”, serta shading akhir pekan/libur.

### 3. Manajemen Sumber Daya (Resource Management)
- Pendaftaran anggota tim: **nama, email, peran, dan gaji bulanan**.
- Alokasi anggota ke tugas tertentu (multi-pilih) saat membuat/mengubah tugas.
- Ringkasan tugas per anggota dan total biaya bulanan tim.

### 4. Kalender Proyek
- Pengaturan **hari akhir pekan** (weekend) secara bebas per hari.
- Penambahan **hari libur khusus (custom holiday)** beserta keterangan.
- **Semua perhitungan durasi hanya menghitung hari kerja.**

### 5. Analisis Proyek
- **Jalur kritis (Critical Path)** lengkap dengan total slack tiap tugas
  (forward & backward pass CPM).
- Tabel jadwal: Early Start / Early Finish / Late Start / Late Finish / Slack.
- **Estimasi PERT** per tugas: `TE = (O + 4M + P) / 6` dan varians `σ² = ((P − O)/6)²`.
- **Diagram jaringan PERT** (activity-on-node) dengan jalur kritis disorot merah.
- **Analisis peluang**: probabilitas proyek selesai pada/atau sebelum tanggal target.

### Tambahan
- **Data contoh (seed)** otomatis dimuat saat aplikasi pertama kali dibuka.
- Tampilan rapi, responsif (desktop → mobile), dan mudah dipakai.

---

## 🚀 Cara Install & Menjalankan

Prasyarat: **Node.js 18+** dan npm.

```bash
# 1. Install dependensi
npm install

# 2. Jalankan mode pengembangan (hot reload)
npm run dev
# buka http://localhost:5173

# 3. Build untuk produksi
npm run build

# 4. Pratinjau hasil build
npm run preview
```

### Perintah lain

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Menjalankan dev server Vite |
| `npm run build` | Typecheck (`tsc --noEmit`) lalu build ke `dist/` |
| `npm run preview` | Menyajikan hasil build secara lokal |
| `npm run typecheck` | Memeriksa tipe TypeScript tanpa output |
| `npm run test` | Menjalankan seluruh unit & smoke test (Vitest) |
| `npm run test:watch` | Menjalankan test dalam mode watch |

---

## 🧭 Cara Pakai Singkat

1. **Tambah tugas** — klik `+ Tambah Tugas`. Isi durasi (hari kerja), tanggal mulai,
   prioritas, warna, dan alokasi anggota tim.
2. **Buat sub-tugas** — tombol `＋` pada baris tugas di kolom kiri Gantt.
3. **Geser jadwal** — tarik bar pada Gantt; tanggal mengikuti hari kerja terdekat.
   Tarik **ujung kanan bar** untuk mengubah durasi.
4. **Atur hubungan** — pada panel *Hubungan Antar Tugas*, pilih pendahulu, tipe
   (FS/SS), jeda, lalu tugas lanjutan.
5. **Sesuaikan kalender** — tab *Kalender*: tentukan weekend & hari libur khusus.
6. **Lihat analisis** — tab *Analisis*: jalur kritis, diagram PERT, dan peluang tanggal selesai.

> Catatan: tanggal mulai yang di-*pin* pada tiap tugas berperan sebagai **batas minimum**.
> Jika constraint dari predecessor lebih lambat, jadwal otomatis menggeser mulai tugas tersebut.
> Bila ada **siklus** dependency, aplikasi memberi peringatan dan memakai jadwal manual.

---

## 🧮 Cara Perhitungan

- **Durasi (hari kerja)**: selesai = `mulai + (durasi − 1)` hari kerja.
  Fungsi `addWorkingDays`, `countWorkingDays`, dan `snapToWorkingDay` pada
  `src/lib/dateUtils.ts`.
- **FS + lag**: `mulai_successor ≥ selesai_predecessor + 1 + lag` (hari kerja).
- **SS + lag**: `mulai_successor ≥ mulai_predecessor + lag` (hari kerja).
- **CPM**: forward pass (Early Start/Finish) → backward pass (Late Start/Finish) →
  `slack = LF − EF`; tugas dengan **slack 0** adalah **jalur kritis**.
- **PERT**: `TE = (O + 4M + P)/6`, `σ² = ((P − O)/6)²`. Bila estimasi O/M/P tidak diisi,
  diturunkan otomatis dari durasi (O = 80 %, M = durasi, P = 150 %).
  Peluang penyelesaian dihitung dengan distribusi normal `N(TE_total, σ_total²)`.

---

## 📁 Struktur Proyek

```
.
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .gitignore
├── README.md
└── src
    ├── main.tsx                 # Entry point React
    ├── App.tsx                  # Header, tab, orkestrasi panel & modal
    ├── styles.css               # Seluruh styling (termasuk Gantt)
    ├── types.ts                 # Model domain (Task, Dependency, Resource, Calendar)
    ├── lib
    │   ├── dateUtils.ts         # Perhitungan hari kerja & format tanggal
    │   ├── scheduling.ts        # CPM (forward/backward), jalur kritis, PERT
    │   ├── stats.ts             # Distribusi normal untuk analisis peluang
    │   ├── storage.ts           # Persistensi localStorage
    │   ├── seed.ts              # Data contoh proyek
    │   ├── tree.ts              # Perataan struktur parent–child
    │   └── palette.ts           # Palet warna & id
    ├── state
    │   └── ProjectContext.tsx   # Reducer + context global
    └── components
        ├── GanttChart.tsx       # Bar, panah dependency, drag & resize
        ├── DependencyPanel.tsx  # Pengelolaan FS/SS + lag
        ├── ResourcePanel.tsx    # Anggota tim & alokasi
        ├── CalendarPanel.tsx    # Weekend & hari libur
        ├── AnalysisPanel.tsx    # Jalur kritis & tabel PERT
        ├── PertChart.tsx        # Diagram jaringan PERT (SVG)
        ├── TaskForm.tsx         # Form tambah/ubah tugas
        └── Modal.tsx            # Komponen modal
```

---

## ✅ Verifikasi

```bash
npm run typecheck   # tanpa error
npm run test        # 23 test lulus (unit + smoke test UI)
npm run build       # build sukses ke dist/
```

Unit test mencakup aritmetika hari kerja (weekend & hari libur), penjadwalan FS/SS
dengan lag, perhitungan slack/jalur kritis, deteksi siklus, dan estimasi PERT.
Smoke test UI memastikan Gantt, panah dependency, form tugas, serta tab analisis
benar-benar ter-render dan berfungsi.

---

## 📄 Lisensi

MIT — bebas digunakan dan dimodifikasi.
