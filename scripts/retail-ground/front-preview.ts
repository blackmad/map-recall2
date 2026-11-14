/**
 * Elevation preview of the retail templates (lane retail-look-20261114): every template's front drawn by
 * retailFrontTris on a brick wall, seen from 25 deg to the side and a little above pavement eye height, so depth (frame
 * boxes, recesses, fascia projection, awnings) reads. Node only, no browser: a quick look while tuning proportions; the
 * acceptance frames are house:frames.
 *
 *   node --import tsx scripts/retail-ground/front-preview.ts [--out=artifacts/retail-look/templates.png] [--only=ah,hema]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { retailFrontTris, type FrontTri } from '../../src/canalRecall/retailFront.ts';
import { RETAIL_TEMPLATES, type RetailTemplate } from '../../src/canalRecall/retailTemplates.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const OUT = arg('out') ?? 'artifacts/retail-look/templates.png';
const only = arg('only')?.split(',') as RetailTemplate[] | undefined;
const list = only ?? [...RETAIL_TEMPLATES];
const WORDS: Partial<Record<RetailTemplate, string>> = { brownBar: 'PAPENEILAND', bakery: 'VERHAGEN', doner: 'KEBAB HOUSE', books: 'KOOKBOEKHANDEL', greengrocer: 'SENER', bike: 'DAMSKO', coffeeshop: 'BLUEBIRD', toko: 'TOKO JOYCE', turkishBakery: 'FIRIN', nuts: 'NOTENBAR', waffle: 'WAFFLE', pancake: 'PANCAKES', smartshop: 'MAGIC' };
const COLS = 4, CW = 760, CH = 470, SPAN = 7, GROUND = 3.6;
const canvas = createCanvas(CW * COLS, CH * Math.ceil(list.length / COLS));
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#20242a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
// Camera: the wall is the x-z plane (y out of the wall). Eye 9 m out, 1.7 m up, 2 m right of the middle, looking at it.
const yaw = 18 * Math.PI / 180, f = 95;
function project(p: [number, number, number], ox: number, oy: number): [number, number, number] {
  const cx = SPAN / 2 + 2.6, cy = 9, cz = 1.7;
  const dx = p[0] - cx, dy = p[1] - cy, dz = p[2] - cz;
  // Rotate about z so the camera looks along -y turned by yaw.
  const rx = dx * Math.cos(yaw) - dy * Math.sin(yaw), ry = dx * Math.sin(yaw) + dy * Math.cos(yaw);
  const depth = -ry;
  return [ox + CW / 2 + (rx / depth) * f * 9, oy + CH * 0.62 - (dz / depth) * f * 9, depth];
}
const shade = (hex: string, n: number[], lit?: boolean) => {
  const c = parseInt(hex.slice(1), 16), rgb = [(c >> 16) & 255, (c >> 8) & 255, c & 255];
  const L = [0.35, 0.75, 0.55], ln = Math.hypot(...L), k = lit ? 1 : 0.55 + 0.5 * Math.max(0, (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / ln);
  return `rgb(${rgb.map(v => Math.min(255, Math.round(v * k))).join(',')})`;
};
list.forEach((t, i) => {
  const ox = (i % COLS) * CW, oy = Math.floor(i / COLS) * CH;
  const e = { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: 1 };
  const tris: FrontTri[] = retailFrontTris({ template: t, word: WORDS[t] ?? 'WINKEL', seed: `preview-${t}`, door: { a0: SPAN - 1.9, a1: SPAN - 0.9, depthM: 0.5 } }, e, 0, SPAN, 0, GROUND);
  // Wall: brick from -1 to SPAN+1, to 7 m; the pavement under it.
  const wall: FrontTri[] = [];
  const quad = (a: [number, number, number][], hex: string, n: [number, number, number]) => { wall.push({ p: [a[0], a[1], a[2]], hex, n }, { p: [a[0], a[2], a[3]], hex, n }); };
  quad([[-1.5, 0, 0], [SPAN + 1.5, 0, 0], [SPAN + 1.5, 0, 7], [-1.5, 0, 7]], '#7a3a2a', [0, 1, 0]);
  quad([[-1.5, 0, 0], [SPAN + 1.5, 0, 0], [SPAN + 1.5, 4, 0], [-1.5, 4, 0]], '#9a958c', [0, 0, 1]);
  const all = [...wall, ...tris].map((tr, k) => { const q = tr.p.map(p => project(p as [number, number, number], ox, oy)); return { q, tr, k, d: (tr.p[0][1] + tr.p[1][1] + tr.p[2][1]) / 3 }; });
  // Painter's order by distance out of the wall (nearly everything is wall-parallel), wall and pavement first.
  const back = all.slice(0, wall.length), rest = all.slice(wall.length).sort((a, b) => a.d - b.d || a.k - b.k);
  ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, CW, CH); ctx.clip();
  ctx.fillStyle = '#9db7cc'; ctx.fillRect(ox, oy, CW, CH);
  for (const { q, tr } of [...back, ...rest]) {
    ctx.fillStyle = tr.layer !== undefined ? '#ffffff' : shade(tr.hex, tr.n, tr.lit);
    ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); ctx.lineTo(q[1][0], q[1][1]); ctx.lineTo(q[2][0], q[2][1]); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 0.6; ctx.stroke();
  }
  ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif'; ctx.fillText(`${t}  (${tris.length} tris)`, ox + 10, oy + 24);
  ctx.restore();
});
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, canvas.toBuffer('image/png'));
console.log(`wrote ${OUT} (${list.length} templates)`);
