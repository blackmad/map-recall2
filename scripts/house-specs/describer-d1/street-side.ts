// Street-side check for describe cuts (D1 ring tranche): the cutter takes the longest exposed wall on the nearest road, so a
// pand on a shopping street can be cut from a side street or the garden side (the rear-facade cuts 171198, 185507, 185997,
// 171217 on Weteringschans; TODO "D1 rear-facade cuts"). For each cut row: the distance from the camera and from the wall's
// midpoint to the street the tranche assigned the pand to (tranche-ring.ts ring-candidates.json), and the angle between the
// wall's outward normal (towards the camera) and the direction to that street. `onStreet` when the wall faces its street
// (angle <= 60 deg, wall midpoint <= 25 m from the street line); the camera may stand across the street. `side`: `street`,
// `cross` (60-120 deg: the front on a side street of a corner or deep pand) or `rear` (> 120 deg: facing away from it).
//
//   node --import tsx scripts/house-specs/describer-d1/street-side.ts --cuts <cuts.json> --candidates <ring-candidates.json> --out <street-side.json>
import fs from 'node:fs';
import path from 'node:path';
import { lngLatToRd } from '../../pand-reference/core.ts';
import { wallOf } from './stage.ts';

type P = [number, number];
const segDist = (p: P, a: P, b: P): { d: number; q: P } => {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0;
  const q: P = [a[0] + t * dx, a[1] + t * dy];
  return { d: Math.hypot(p[0] - q[0], p[1] - q[1]), q };
};

export function streetSide(row: any, streetSegs: [P, P][]): { cameraM: number; wallM: number; angleDeg: number; onStreet: boolean; side: 'street' | 'cross' | 'rear' } | null {
  const w = wallOf(row); if (!w || !streetSegs.length) return null;
  const cam: P = [row.pose.rd.x, row.pose.rd.y], mid: P = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2];
  const near = (p: P) => streetSegs.map(([a, b]) => segDist(p, a, b)).sort((x, y) => x.d - y.d)[0];
  const c = near(cam), m = near(mid);
  const to: P = [m.q[0] - mid[0], m.q[1] - mid[1]], L = Math.hypot(...to) || 1;
  const angleDeg = Math.acos(Math.max(-1, Math.min(1, (to[0] * w.normal[0] + to[1] * w.normal[1]) / L))) * 180 / Math.PI;
  const onStreet = m.d <= 25 && (m.d < 2 || angleDeg <= 60);
  return { cameraM: +c.d.toFixed(1), wallM: +m.d.toFixed(1), angleDeg: +angleDeg.toFixed(0), onStreet, side: onStreet ? 'street' : angleDeg > 120 ? 'rear' : 'cross' };
}

function main() {
  const argv = process.argv.slice(2);
  const opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const cutsF = opt('cuts'), candF = opt('candidates'), out = opt('out');
  if (!cutsF || !candF || !out) { console.error('street-side.ts --cuts <cuts.json> --candidates <ring-candidates.json> --out <file>'); process.exit(2); }
  const cand = JSON.parse(fs.readFileSync(candF, 'utf8'));
  const streetOf = new Map<string, string>();
  for (const r of cand.rows) for (const f of r.fronts) streetOf.set(f.id, r.key.split(' | ')[0]);
  const ways = JSON.parse(fs.readFileSync(path.join('public/data/extracts/amsterdam', 'streets-routing.json'), 'utf8')) as { name: string; path: [number, number][] }[];
  const segsOf = new Map<string, [P, P][]>();
  for (const w of ways) {
    if (!w.name) continue;
    const pts = w.path.map(([lat, lng]) => { const r = lngLatToRd([lng, lat]); return [r.x, r.y] as P; });
    const list = segsOf.get(w.name) ?? segsOf.set(w.name, []).get(w.name)!;
    for (let i = 0; i + 1 < pts.length; i++) list.push([pts[i], pts[i + 1]]);
  }
  const res: Record<string, unknown> = {};
  let on = 0, off = 0;
  for (const row of JSON.parse(fs.readFileSync(cutsF, 'utf8')).rows) {
    const street = streetOf.get(row.pandId) ?? null;
    const s = street ? streetSide(row, segsOf.get(street) ?? []) : null;
    res[row.pandId] = { street, ...(s ?? { onStreet: false }) };
    if (s?.onStreet) on++; else off++;
  }
  fs.writeFileSync(out, `${JSON.stringify(res, null, 1)}\n`);
  console.log(`on street ${on}, off ${off} -> ${out}`);
}
if (import.meta.url === `file://${process.argv[1]}`) main();
