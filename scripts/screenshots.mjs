/**
 * Menghasilkan screenshot UI untuk dokumentasi (README).
 *
 * Pemakaian:
 *   1. Jalankan dev server:  npm run dev
 *   2. Lalu:                 npm run screenshots
 *
 * Skrip ini memakai Chrome yang sudah terpasang di sistem (via puppeteer-core),
 * jadi tidak mengunduh Chromium. Lokasi Chrome bisa dioverride dengan env CHROME_PATH.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'docs');
const APP_URL = process.env.APP_URL ?? 'http://localhost:5173/';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  `${process.env.LOCALAPPDATA ?? ''}\\Google\\Chrome\\Application\\chrome.exe`,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    'Chrome tidak ditemukan. Set variabel lingkungan CHROME_PATH ke executable Chrome.'
  );
}

/** Klik elemen berdasarkan teksnya. */
async function clickByText(page, selector, text) {
  const clicked = await page.evaluate(
    (sel, txt) => {
      const el = [...document.querySelectorAll(sel)].find((node) =>
        (node.textContent ?? '').includes(txt)
      );
      if (!el) return false;
      el.click();
      return true;
    },
    selector,
    text
  );
  if (!clicked) throw new Error(`Elemen "${selector}" dengan teks "${text}" tidak ditemukan`);
}

async function main() {
  const chromePath = findChrome();
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Chrome   : ${chromePath}`);
  console.log(`App URL  : ${APP_URL}`);
  console.log(`Output   : ${OUT_DIR}`);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1500, height: 1000, deviceScaleFactor: 1 });

    // Bersihkan storage agar seed data dimuat apa adanya.
    await page.goto(APP_URL, { waitUntil: 'networkidle0' });
    await page.evaluate(() => window.localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.gantt-bar', { timeout: 15000 });
    await sleep(600);

    const shot1 = resolve(OUT_DIR, '01-gantt-chart.png');
    await page.screenshot({ path: shot1, fullPage: true });
    console.log(`✓ ${shot1}`);

    // Pindah ke tab Analisis lalu ambil screenshot kedua.
    await clickByText(page, '.tab', 'Analisis');
    await page.waitForSelector('.pert-node', { timeout: 15000 });
    await sleep(600);

    const shot2 = resolve(OUT_DIR, '02-analisis-pert.png');
    await page.screenshot({ path: shot2, fullPage: true });
    console.log(`✓ ${shot2}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Gagal membuat screenshot:', err.message);
  process.exit(1);
});
