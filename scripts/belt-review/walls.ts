/**
 * belt-review:walls (2026-11-21, David's row view: Herengracht 62 drew 3.43 m of a 5.33 m front, a 1.9 m hole beside 60).
 * The review render framed the pand's wall by house preview's own rule (pickWall, or a pand-reference crop), while the
 * photos were cut on prepare.ts's wall (re-picked toward the face, a narrow or forced front widened to the footprint's
 * extent). This writes the wall the photos were cut on, as a line house preview frames whole (`--wall line:`), so the
 * render spans the same street front as the crop: review-data/belt-review/<faceId>/walls.json.
 *
 *   node --import tsx scripts/belt-review/walls.ts <faceId>
 *
 * No network (the building tiles). Derived data: re-run after prepare.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { rdToLngLat } from '../../src/canalRecall/facade/rdNew.ts';
import { faceWalls, footprintFront } from './prepare.ts';
import type { Wall } from '../pand-reference/select.ts';

const REPO = path.resolve(import.meta.dirname, '../..');
const faceId = process.argv[2];
if (!faceId) { console.error('usage: walls.ts <faceId>'); process.exit(2); }
const dir = path.join(REPO, 'review-data/belt-review', faceId);
const face = JSON.parse(fs.readFileSync(path.join(dir, 'face.json'), 'utf8'));
const { walls, notes, fronts, fps } = await faceWalls(face);
// The photos were cut when candidates.json was built; the tiles or the neighbours may have moved since. A wall whose length
// or bearing no longer matches the candidates' is re-chosen among the footprint's edges (each also widened to the extent
// along its line) as the one nearest the candidates' length and bearing.
const cands = JSON.parse(fs.readFileSync(path.join(dir, 'candidates.json'), 'utf8')) as { pands: Array<{ pandId: string; wall: { lenM: number; bearingDeg: number } | null }> };
const bearing = (w: { nx: number; ny: number }) => (Math.atan2(w.nx, w.ny) * 180 / Math.PI + 360) % 360;
const angDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
function edges(ring: { x: number; y: number }[]): Wall[] {
  let area = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) area += ring[j].x * ring[i].y - ring[i].x * ring[j].y;
  const r = area > 0 ? ring : [...ring].reverse(), out: Wall[] = [];
  for (let i = 0; i + 1 < r.length; i++) {
    const a = r[i], b = r[i + 1], len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1) continue;
    out.push({ a, b, len, nx: (b.y - a.y) / len, ny: -(b.x - a.x) / len, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, roadDistM: NaN, facing: 1 });
  }
  return out;
}
const rechosen: string[] = [];
for (const c of cands.pands) {
  const w = walls.get(c.pandId), fp = fps.get(`NL.IMBAG.Pand.${c.pandId}`);
  if (!c.wall || !fp) continue;
  const off = (x: Wall) => Math.abs(x.len - c.wall!.lenM) + angDiff(bearing(x), c.wall!.bearingDeg) / 10;
  if (w && off(w) < 0.1) continue;
  const options = edges(fp.ring).flatMap(e => [e, footprintFront(fp.ring, e)]);
  const best = options.sort((x, y) => off(x) - off(y))[0];
  if (best && off(best) < 0.3) { walls.set(c.pandId, best); notes.set(c.pandId, `re-chosen to match the candidates' wall (${c.wall.lenM} m at ${c.wall.bearingDeg} deg)`); rechosen.push(c.pandId); }
}
console.log(`re-chosen to the candidates' wall: ${rechosen.length}`);
const out: Record<string, { a: [number, number]; b: [number, number]; lengthM: number; note?: string }> = {};
for (const p of face.pands as Array<{ pandId: string; address: string }>) {
  const w = walls.get(p.pandId);
  if (!w) { console.log(`${p.address}: no wall (${notes.get(p.pandId) ?? '?'})`); continue; }
  const ll = (q: { x: number; y: number }) => rdToLngLat(q).map(v => +v.toFixed(8)) as [number, number];
  const note = [notes.get(p.pandId), fronts.get(p.pandId) ? `front ${fronts.get(p.pandId)!.bagEdgeM} -> ${fronts.get(p.pandId)!.extentM} m (${fronts.get(p.pandId)!.why})` : ''].filter(Boolean).join('; ');
  out[p.pandId] = { a: ll(w.a), b: ll(w.b), lengthM: +w.len.toFixed(2), ...(note ? { note } : {}) };
}
const file = { version: 1, faceId, about: 'Belt review: the front wall each pand\'s photos were cut on (prepare.ts faceWalls), left to right as seen, as lng/lat; the review render frames it whole (house preview --wall line:). Built by scripts/belt-review/walls.ts.', walls: out };
fs.writeFileSync(path.join(dir, 'walls.json'), JSON.stringify(file, null, 1) + '\n');
console.log(`walls.json: ${Object.keys(out).length} of ${face.pands.length} pands`);
