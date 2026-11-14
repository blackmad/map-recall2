// D1 rear-facade guard (TODO "D1 rear-facade cuts", 2026-11-14): describe-cut takes the longest exposed wall near a road,
// which on a canal-belt pand can be the garden side (Weteringschans 171198, 185507, 185997, 171217). A cut is held as `rear`
// when its wall is no nearer the pand's address street than the footprint centroid is (a front wall stands between the
// centroid and its street), or when the panorama stands more than 30 m from that street (the camera is on another street).
// Inputs: cuts.json (describe-cut cut) and belt-select.json (address street per pand). Writes <out> = {held: {pandId: why}}.
//
//   node --import tsx scripts/house-specs/describer-d1/rear-check.ts --cuts <cuts.json> --select <belt-select.json> --out <holds.json>
import fs from 'node:fs';
import path from 'node:path';
import { lngLatToRd } from '../../../src/canalRecall/facade/rdNew.ts';

type P = { x: number; y: number };
const segDist = (p: P, a: P, b: P) => {
  const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};
export const polyDist = (p: P, lines: P[][]) => Math.min(...lines.flatMap(l => l.slice(1).map((q, i) => segDist(p, l[i], q))));

/** Why a cut is a rear/side cut, or null when its wall faces the address street. */
export function rearReason(wallMid: P, centroid: P, camera: P, street: P[][]): string | null {
  const dw = polyDist(wallMid, street), dc = polyDist(centroid, street), dcam = polyDist(camera, street);
  if (dw >= dc - 0.5) return `wall ${dw.toFixed(1)} m from the address street, centroid ${dc.toFixed(1)} m: not the street front`;
  if (dcam > 30) return `panorama ${dcam.toFixed(1)} m from the address street`;
  return null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2), opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
  const cuts = JSON.parse(fs.readFileSync(opt('cuts')!, 'utf8')).rows as any[];
  const sel = new Map((JSON.parse(fs.readFileSync(opt('select')!, 'utf8')).rows as any[]).map(r => [r.pandId, r]));
  const streets = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/extracts/amsterdam/streets-routing.json'), 'utf8')) as any[];
  const lines = new Map<string, P[][]>();
  for (const s of streets) for (const p of s.paths ?? (s.path ? [s.path] : [])) lines.set(s.name, [...(lines.get(s.name) ?? []), (p as [number, number][]).map(([lat, lng]) => lngLatToRd([lng, lat]))]);
  const held: Record<string, string> = {};
  for (const c of cuts) {
    const s = sel.get(c.pandId); if (!s) continue;
    const street = lines.get(s.street);
    if (!street) { held[c.pandId] = `no centreline for ${s.street}`; continue; }
    const why = rearReason({ x: (c.wall.a.x + c.wall.b.x) / 2, y: (c.wall.a.y + c.wall.b.y) / 2 }, lngLatToRd(s.lngLat), c.pose.rd, street);
    if (why) held[c.pandId] = why;
  }
  fs.writeFileSync(opt('out')!, `${JSON.stringify({ v: 1, cuts: cuts.length, held }, null, 1)}\n`);
  console.log(`cuts ${cuts.length}, held as rear/side ${Object.keys(held).length}`);
}
