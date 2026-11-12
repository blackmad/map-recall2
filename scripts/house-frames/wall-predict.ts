/**
 * Offline wall-colour prediction for a pick-rule change (lane W2, 2026-11-12): the mesher's wall for every pand of a
 * reference wall-stages run under the current flags, and its pixel predicted from the reference pixel through the
 * measured render transfer (pixel L = 0.43 x mesher L + 0.24, a/b x 0.59, over 169 walls of F4 round 0):
 *   predicted = ref pixel + T(new mesher) - T(ref mesher).
 * A screen before a browser run, not a substitute for one: smooth painted cells draw lighter than the transfer says.
 *   node --import tsx scripts/house-frames/wall-predict.ts <ref wall-stages.json> [--json out.json]
 */
import fs from 'node:fs';
import { PreviewSession } from '../house-preview/preview.ts';
import { meshBuildingFor } from '../../src/canalRecall/threeBuildingFeatures.ts';
import { bayLookFor } from '../../src/canalRecall/bayLook.ts';
import { asPolygons } from '../../src/canalRecall/threeBuildingFeatures.ts';
import { buurtProfileAt } from '../../src/canalRecall/buurtProfiles/data.ts';
import { rgbOklab } from './analyse.ts';

type Lab3 = { L: number; a: number; b: number; hex?: string };
const hexLab = (hex: string): Lab3 => { const n = parseInt(hex.slice(1), 16), [L, a, b] = rgbOklab((n >> 16) & 255, (n >> 8) & 255, n & 255); return { L, a, b, hex }; };

import { tunePoolDraw } from '../../src/canalRecall/look/measuredWallPool.ts';
// Tuning: POOL_DRAW overrides as JSON in WALL_DRAW_TUNE, e.g. '{"band":0.5}'.
if (process.env.WALL_DRAW_TUNE) tunePoolDraw(JSON.parse(process.env.WALL_DRAW_TUNE));
const ref = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
// --base <wall-stages.json>: also count pairs worse than that run (the pre-W1 before) by more than 0.02.
const baseArg = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : null;
const base = baseArg ? new Map<string, any>(JSON.parse(fs.readFileSync(baseArg, 'utf8')).rows.map((r: any) => [r.key, r.lab.pixel])) : null;
const out = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
const session = new PreviewSession('photo');
const T = (l: Lab3) => [0.43 * l.L + 0.24, 0.59 * l.a, 0.59 * l.b];
const rows: any[] = [];
for (const r of ref.rows) {
  if (!r.lab.photo || !r.lab.pixel || !r.hex.mesher || r.cls === 'model') { rows.push({ key: r.key, street: r.street, same: true, photo: r.lab.photo, ref: r.lab.pixel, pred: r.lab.pixel }); continue; }
  const trows = await session.rows(session.tileOf(r.pandId));
  const row = trows.find((x: any) => String(x.raw.properties?.id ?? '').endsWith(r.pandId));
  const b = row ? meshBuildingFor(row.styled as any, 'photo') : null;
  let painted = false;
  if (row) {
    const p = row.styled.properties as any, ring = asPolygons(row.styled.geometry)[0]?.[0] ?? [];
    const year = p.constructionYear == null || !Number.isFinite(Number(p.constructionYear)) ? null : Number(p.constructionYear);
    const c = [ring.reduce((s: number, q: number[]) => s + q[0], 0) / ring.length, ring.reduce((s: number, q: number[]) => s + q[1], 0) / ring.length] as const;
    painted = !!bayLookFor(String(p.id), year, Number(p.height) || 10, 'photo', 'quiet', undefined, undefined, ring[0] ? buurtProfileAt(ring[0][0], ring[0][1]) : null, undefined, undefined, c).painted;
  }
  const m = b?.wallHex ? hexLab(b.wallHex) : null;
  if (!m) { rows.push({ key: r.key, street: r.street, same: true, photo: r.lab.photo, ref: r.lab.pixel, pred: r.lab.pixel }); continue; }
  const t0 = T(r.lab.mesher), t1 = T(m), px = r.lab.pixel;
  const pa = px.a + t1[1] - t0[1], pb = px.b + t1[2] - t0[2];
  rows.push({ key: r.key, street: r.street, same: m.hex === r.hex.mesher, painted, mesher: m.hex, photo: r.lab.photo, ref: px, pred: { L: px.L + t1[0] - t0[0], a: pa, b: pb, C: Math.hypot(pa, pb) } });
}
const dE = (p: any, q: any) => Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);
let worse = 0, better = 0; const e0: number[] = [], e1: number[] = [];
for (const r of rows) {
  if (!r.photo || !r.ref) continue;
  const a = dE(r.ref, r.photo), b = dE(r.pred, r.photo); e0.push(a); e1.push(b); r.dE = [a, b];
  if (b - a > 0.02) worse++; else if (a - b > 0.02) better++;
}
let worseBase = 0, betterBase = 0; const eb: number[] = [];
if (base) for (const r of rows) { const bp = base.get(r.key); if (!bp || !r.photo) continue; const a = dE(bp, r.photo), b = dE(r.pred, r.photo); eb.push(a); if (b - a > 0.02) worseBase++; else if (a - b > 0.02) betterBase++; }
const mean = (x: number[]) => x.reduce((s, v) => s + v, 0) / x.length;
// Row variety: per street with 3 or more pairs, the std of wall L, photo against drawn.
const std = (x: number[]) => { const m = mean(x); return Math.sqrt(mean(x.map(v => (v - m) ** 2))); };
const streets = [...new Set(rows.map(r => r.street))].filter(s => rows.filter(r => r.street === s && r.photo).length >= 3);
const variety = streets.map(s => { const rs = rows.filter(r => r.street === s && r.photo); return { street: s, n: rs.length, photo: +std(rs.map(r => r.photo.L)).toFixed(3), ref: +std(rs.map(r => r.ref.L)).toFixed(3), pred: +std(rs.map(r => r.pred.L)).toFixed(3) }; });
console.log(JSON.stringify({ n: e0.length, refMean: +mean(e0).toFixed(4), predMean: +mean(e1).toFixed(4), better, worse, changed: rows.filter(r => !r.same).length, painted: rows.filter(r => r.painted).length, ...(base ? { baseMean: +mean(eb).toFixed(4), betterThanBase: betterBase, worseThanBase: worseBase } : {}) }));
for (const v of variety) console.log(`${v.street.padEnd(32)} n ${v.n}  L std photo ${v.photo}  ref ${v.ref}  pred ${v.pred}`);
const vm = (k: 'photo' | 'ref' | 'pred') => +mean(variety.map(v => v[k])).toFixed(3);
console.log(`row L std mean: photo ${vm('photo')} ref ${vm('ref')} pred ${vm('pred')}`);
if (out) fs.writeFileSync(out, JSON.stringify({ rows, variety }, null, 1));
