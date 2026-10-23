// Builds the Passayge brand assets from one drawing, in the henrycarto.com icon family's rules:
// 24 unit grid, 2 unit round line, corner radius 3, one idea (a pass with its tear line).
// Colour: Passayge's graphite, #27313b on light grounds and #dce3e9 on dark ones; raster favicons #7b858f.
// Writes assets/brand/* and copies the favicons into apps/web/public.
// Run: node scripts/brand/export.mjs   (uses the Chromium that Playwright installs)

import { chromium } from '@playwright/test';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'assets', 'brand');
const PUBLIC = join(ROOT, 'apps', 'web', 'public');
mkdirSync(OUT, { recursive: true });

export const LIGHT = '#27313b';
export const DARK = '#dce3e9';
// Raster favicons cannot follow the theme (Safari, for one, uses them): a mid graphite that reads
// on light and dark tabs alike (3.8:1 on white, 4.0:1 on #202124).
export const FAVICON = '#7b858f';
export const BODY =
  '<path d="M3 9.5V8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v1.5a2.5 2.5 0 0 0 0 5V16a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-1.5a2.5 2.5 0 0 0 0-5z"/>' +
  '<path d="M15 7.5v9" stroke-dasharray="0 3"/>';

const svg = (colour, { adaptive = false, size = 24 } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${colour}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
  `<title>Passayge</title>` +
  (adaptive ? `<style>@media (prefers-color-scheme: dark) { svg { stroke: ${DARK}; } }</style>` : '') +
  `${BODY}</svg>\n`;

// The icon follows the viewer's theme wherever SVG allows it (browser tabs, GitHub, the site).
writeFileSync(join(OUT, 'icon.svg'), svg(LIGHT, { adaptive: true }));
writeFileSync(join(OUT, 'icon-light.svg'), svg(LIGHT));
writeFileSync(join(OUT, 'icon-dark.svg'), svg(DARK));

const browser = await chromium.launch();
const page = await browser.newPage();

async function png(html, w, h, file) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;background:transparent}</style></head><body>${html}</body></html>`);
  const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  if (file) writeFileSync(join(OUT, file), buf);
  return buf;
}
const padded = (colour, px, pad = 0.08, bg = 'transparent') => {
  const inner = Math.round(px * (1 - 2 * pad));
  const off = Math.round((px - inner) / 2);
  return `<div style="width:${px}px;height:${px}px;background:${bg};position:relative"><div style="position:absolute;left:${off}px;top:${off}px">${svg(colour, { size: inner })}</div></div>`;
};

await png(padded(LIGHT, 512), 512, 512, 'icon-512.png');
await png(padded(DARK, 512), 512, 512, 'icon-512-dark.png');
await png(padded(LIGHT, 180, 0.16, '#ffffff'), 180, 180, 'apple-touch-icon.png');
const ico = [];
for (const px of [16, 32, 48]) ico.push([px, await png(padded(FAVICON, px, 0), px, px, px === 32 ? 'favicon-32.png' : undefined)]);

// favicon.ico with PNG payloads (supported by every current browser).
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(ico.length, 4);
let offset = 6 + 16 * ico.length;
const entries = ico.map(([px, data]) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(px === 256 ? 0 : px, 0);
  e.writeUInt8(px === 256 ? 0 : px, 1);
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(data.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += data.length;
  return e;
});
writeFileSync(join(OUT, 'favicon.ico'), Buffer.concat([header, ...entries, ...ico.map(([, d]) => d)]));

// Social preview, 1280 x 640, in the family's layout (as the portfolio's export.py draws it).
const NAME = 'Passayge';
const DESC = 'Who may open the record, and for how long.';
const FONTS =
  '<link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400&family=Inter:wght@400&family=Space+Mono&display=swap" rel="stylesheet">';
await page.setViewportSize({ width: 1280, height: 640 });
await page.setContent(`<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
html,body{margin:0;width:1280px;height:640px;background:#ffffff}
.wrap{position:relative;width:1280px;height:640px;display:flex;align-items:center;gap:72px;padding:0 110px;box-sizing:border-box}
.icon{flex:none;width:300px;height:300px}
.name{font-family:Newsreader,Georgia,serif;font-size:84px;line-height:1.02;color:#14181c;letter-spacing:-0.01em}
.desc{font-family:Inter,system-ui,sans-serif;font-size:30px;line-height:1.35;color:#5e666d;margin-top:22px;max-width:640px}
.site{position:absolute;left:110px;bottom:52px;font-family:'Space Mono',monospace;font-size:20px;letter-spacing:.08em;color:#5e666d}
</style></head><body><div class="wrap"><div class="icon">${svg(LIGHT, { size: 300 })}</div>
<div><div class="name">${NAME}</div><div class="desc">${DESC}</div></div><div class="site">henrycarto.com</div></div></body></html>`);
await page.evaluate(() => document.fonts.ready);
writeFileSync(join(OUT, 'social-preview.png'), await page.screenshot({ clip: { x: 0, y: 0, width: 1280, height: 640 } }));

await browser.close();

for (const f of ['favicon.ico', 'favicon-32.png', 'apple-touch-icon.png']) copyFileSync(join(OUT, f), join(PUBLIC, f));
copyFileSync(join(OUT, 'icon.svg'), join(PUBLIC, 'favicon.svg'));
console.log('Brand assets written to assets/brand:', readFileSync(join(OUT, 'icon.svg'), 'utf8').length, 'byte icon.svg');
