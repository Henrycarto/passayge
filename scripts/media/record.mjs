// Records the README media from a running sandbox (docker compose up): the tour GIF with an
// access-denied case, and screenshots at desktop and phone width in light and dark.
// Synthetic data only. Needs ffmpeg on the PATH for the GIF.
// Run: node scripts/media/record.mjs [http://localhost:8080]

import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.argv[2] ?? 'http://localhost:8080';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'docs', 'media');
const TMP = join(OUT, 'tmp');
mkdirSync(join(OUT, 'screens'), { recursive: true });
mkdirSync(TMP, { recursive: true });

const reset = () => fetch(`${BASE}/api/reset`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
const browser = await chromium.launch();

// ---------------------------------------------------------------------------- GIF
await reset();
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: TMP, size: { width: 1280, height: 800 } }, colorScheme: 'light' });
  const page = await ctx.newPage();
  const pause = (ms) => page.waitForTimeout(ms);
  await page.goto(BASE + '/');
  await pause(2200);
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'Next' }).click();
    await pause(2200);
  }
  await page.getByRole('button', { name: 'Done' }).click();
  await pause(800);
  // Access denied: a doctor who has never seen this patient.
  await page.getByLabel('Acting as').selectOption('prov-wimmer');
  await pause(2600);
  await page.getByRole('button', { name: 'Insert e-card' }).click();
  await pause(2600);
  await page.getByRole('link', { name: /Audit and network log/ }).click();
  await pause(3200);
  await ctx.close();
}
const video = readdirSync(TMP).find((f) => f.endsWith('.webm'));
const gif = join(OUT, 'passayge.gif');
const palette = join(TMP, 'palette.png');
// Lean enough for a README: 6 fps, 880 px wide, 64 colours, without the first second of page load.
const filters = 'fps=6,scale=880:-1:flags=lanczos';
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '1.2', '-i', join(TMP, video), '-vf', `${filters},palettegen=max_colors=64:stats_mode=diff`, palette]);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '1.2', '-i', join(TMP, video), '-i', palette, '-lavfi', `${filters} [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`, gif]);

// ---------------------------------------------------------------------------- screenshots
const SHOTS = [
  ['chart', '/patients/pas-theresia'],
  ['denied', '/patients/pas-theresia', 'prov-wimmer'],
  ['log', '/log?patient=pas-theresia'],
  ['home', '/'],
];
const SIZES = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
for (const theme of ['light', 'dark']) {
  for (const [size, viewport] of Object.entries(SIZES)) {
    for (const [name, path, actor] of SHOTS) {
      await reset();
      if (actor) await fetch(`${BASE}/api/session/actor`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ providerId: actor }) });
      const ctx = await browser.newContext({ viewport, colorScheme: theme, deviceScaleFactor: size === 'phone' ? 2 : 1 });
      await ctx.addInitScript(() => localStorage.setItem('passayge.tour.done', '1'));
      const page = await ctx.newPage();
      await page.goto(BASE + path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(600);
      await page.screenshot({ path: join(OUT, 'screens', `${name}-${size}-${theme}.png`), fullPage: size === 'phone' });
      await ctx.close();
    }
  }
}
await reset();
await browser.close();
rmSync(TMP, { recursive: true, force: true });
console.log('Media written to docs/media');
