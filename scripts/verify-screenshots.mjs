/**
 * Memverifikasi screenshot benar-benar berisi UI yang ter-render:
 * membaca dimensi PNG dari header IHDR dan menghitung statistik piksel
 * (rasio piksel non-putih + jumlah warna unik) lewat canvas di Chrome.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'docs');

const CHROME =
  process.env.CHROME_PATH ??
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

/** Baca lebar/tinggi dari chunk IHDR (byte 16..24). */
function pngSize(path) {
  const buf = readFileSync(path);
  const isPng = buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (!isPng) throw new Error('bukan PNG');
  return {
    signature: 'PNG OK',
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bytes: buf.length,
  };
}

async function pixelStats(page, file) {
  const base64 = readFileSync(file).toString('base64');
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const colors = new Set();
    let nonWhite = 0;
    let colored = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const key = (r << 16) | (g << 8) | b;
      if (colors.size < 60000) colors.add(key);
      if (r < 245 || g < 245 || b < 245) nonWhite++;
      if (Math.max(r, g, b) - Math.min(r, g, b) > 24) colored++;
    }
    const total = data.length / 4;
    return {
      width: canvas.width,
      height: canvas.height,
      uniqueColors: colors.size,
      nonWhiteRatio: +(nonWhite / total).toFixed(4),
      saturatedRatio: +(colored / total).toFixed(4),
    };
  }, base64);
}

async function main() {
  const files = ['01-gantt-chart.png', '02-analisis-pert.png'];
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });
  try {
    const page = await browser.newPage();
    await page.goto('about:blank');
    for (const name of files) {
      const file = resolve(OUT_DIR, name);
      if (!existsSync(file)) throw new Error(`hilang: ${file}`);
      const size = pngSize(file);
      const stats = await pixelStats(page, file);
      console.log(`\n${name}`);
      console.log(`  ${size.signature}  ${stats.width}x${stats.height}px  ${(size.bytes / 1024).toFixed(0)} KB`);
      console.log(`  warna unik      : ${stats.uniqueColors}`);
      console.log(`  piksel non-putih: ${(stats.nonWhiteRatio * 100).toFixed(1)}%`);
      console.log(`  piksel berwarna : ${(stats.saturatedRatio * 100).toFixed(1)}%`);
      const ok =
        stats.width > 800 &&
        stats.height > 600 &&
        stats.uniqueColors > 200 &&
        stats.nonWhiteRatio > 0.05 &&
        stats.saturatedRatio > 0.005;
      console.log(`  VERDICT         : ${ok ? 'BERISI UI (lulus)' : 'MENCURIGAKAN'}`);
      if (!ok) process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error('verifikasi gagal:', e.message);
  process.exit(1);
});
