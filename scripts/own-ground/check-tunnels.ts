// Named tunnel regressions (tunnels.ts): the open-data cuts at the surveyed tunnel sites, built offline from the
// published extracts (the worker's code path). Exit code 1 on a failed check.
//
//   npx tsx scripts/own-ground/check-tunnels.ts            # every site
//   npx tsx scripts/own-ground/check-tunnels.ts --png      # also writes artifacts/tunnel-places/cuts-<id>.png (orthophoto + cuts)
//   npx tsx scripts/own-ground/check-tunnels.ts <id> …     # only these sites
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { cutMedianQuads, insideCut, locateCut, type Cut } from '../../src/canalRecall/ownGround/tunnels.ts';
import { describeCut } from './probe-cuts.ts';
import { TUNNEL_SITES, type TunnelSite } from '../../src/canalRecall/ownGround/tunnelRegressions.ts';

const ROOT = 'public/data/extracts/amsterdam';
const args = process.argv.slice(2), only = args.filter(a => !a.startsWith('--'));
const store = new GroundStore(async p => { const b = readFileSync(join(ROOT, p)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); });
await store.init();
let failed = 0;
const fail = (site: TunnelSite, msg: string) => { failed++; console.log(`  FAIL ${site.id}: ${msg}`); };
for (const site of TUNNEL_SITES) {
  if (only.length && !only.includes(site.id)) continue;
  const [x, y] = toLocal(site.at[0], site.at[1]);
  await store.prepareCell(store.cellAt(x, y));
  const s = store.surface;
  const near = (c: Cut, r: number) => c.x.some((cx, i) => Math.hypot(cx - x, c.y[i] - y) < r);
  const cuts = s.cuts.filter(c => near(c, 120));
  console.log(`${site.id}: ${site.label}`);
  for (const c of cuts) console.log(`  ${describeCut(c)}`);
  const e = site.expect;
  // The strip and its floor at the probe point.
  const floor = s.cutFloor(x, y), relief = s.relief(x, y);
  console.log(`  at probe: cut floor ${floor === floor ? floor.toFixed(2) : '-'}, relief ${relief.toFixed(2)}, riding height ${s.height(x, y).toFixed(2)}`);
  if (e.kind) {
    const c = cuts.find(q => q.kind === e.kind && (() => { const h = locateCut(q, x, y); return !!h && insideCut(q, h); })());
    if (!c) { fail(site, `no ${e.kind} cut holds the probe point`); continue; }
    if (e.motor !== undefined && c.motor !== e.motor) fail(site, `motor ${c.motor}, expected ${e.motor}`);
    if (e.minWallM !== undefined) {
      const h = locateCut(c, x, y)!;
      const depth = Math.max(h.wallL >= 0.5 ? h.rimL - h.floor : 0, h.wallR >= 0.5 ? h.rimR - h.floor : 0);
      if (depth < e.minWallM) fail(site, `wall ${depth.toFixed(2)} m at the probe, expected at least ${e.minWallM}`);
    }
    if (e.floorBelowReliefM !== undefined && !(relief - floor >= e.floorBelowReliefM)) fail(site, `floor ${floor.toFixed(2)} only ${(relief - floor).toFixed(2)} m under the relief ${relief.toFixed(2)}, expected ${e.floorBelowReliefM}`);
  } else if (e.noCut && floor === floor) fail(site, `a cut holds the probe point (floor ${floor.toFixed(2)}), expected none`);
  if (e.portalNear) {
    const [px, py] = toLocal(e.portalNear[0], e.portalNear[1]);
    const d = Math.min(Infinity, ...s.cuts.flatMap(c => c.portals.map(p => Math.hypot(c.x[p.at] - px, c.y[p.at] - py))));
    console.log(`  nearest portal ${d.toFixed(1)} m from ${e.portalNear.join(',')}`);
    if (!(d < 20)) fail(site, `no portal within 20 m of ${e.portalNear.join(',')}`);
  }
  for (const q of e.groundIntact ?? []) {
    const [qx, qy] = toLocal(q[0], q[1]), g = s.ground(qx, qy), r = s.relief(qx, qy), f = s.cutFloor(qx, qy);
    console.log(`  ground over the tunnel at ${q.join(',')}: ${g.toFixed(2)} (relief ${r.toFixed(2)})`);
    if (Math.abs(g - r) > 0.05 || f === f) fail(site, `ground over the tunnel at ${q.join(',')} changed: ${g.toFixed(2)} vs relief ${r.toFixed(2)}${f === f ? `, cut floor ${f.toFixed(2)}` : ''}`);
  }
  for (const q of e.groundAtFloor ?? []) {
    // The cut floors within 8 m around (the median lies outside both strips, sloping from one floor to the other).
    const [qx, qy] = toLocal(q[0], q[1]), g = s.ground(qx, qy);
    let lo = Infinity, hi = -Infinity;
    for (let a = 0; a < 16; a++) for (const r of [2, 4, 6, 8]) { const v = s.cutFloor(qx + Math.cos(a * Math.PI / 8) * r, qy + Math.sin(a * Math.PI / 8) * r); if (v === v) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }
    console.log(`  ground at ${q.join(',')}: ${g.toFixed(2)}, cut floors around ${lo.toFixed(2)}..${hi.toFixed(2)} (relief ${s.relief(qx, qy).toFixed(2)})`);
    if (!(lo <= hi) || g < lo - 0.1 || g > hi + 0.3) fail(site, `ground at ${q.join(',')} ${g.toFixed(2)} is not on the cut floors ${lo.toFixed(2)}..${hi.toFixed(2)}`);
  }
  for (const q of e.grassAt ?? []) {
    const [qx, qy] = toLocal(q[0], q[1]);
    const inQuad = (r: [number, number][]) => { let k = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > qy) !== (r[j][1] > qy) && qx < r[j][0] + (r[i][0] - r[j][0]) * (qy - r[j][1]) / (r[i][1] - r[j][1])) k = !k; return k; };
    const hit = s.cuts.some(c => cutMedianQuads(c, () => true).some(inQuad));
    console.log(`  median grass at ${q.join(',')}: ${hit ? 'yes' : 'no'}`);
    if (!hit) fail(site, `no median grass at ${q.join(',')}`);
  }
  if (e.rideMaxClimbM !== undefined && e.ride) {
    // The riding height along the routed way through the passage: the climb above the lower portal level.
    const pts = e.ride.map(p => toLocal(p[0], p[1]));
    const ext = (a: [number, number], b: [number, number]): [number, number] => { const l = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; return [a[0] + (a[0] - b[0]) / l * 10, a[1] + (a[1] - b[1]) / l * 10]; };
    pts.unshift(ext(pts[0], pts[1])); pts.push(ext(pts[pts.length - 1], pts[pts.length - 2]));
    const zs: number[] = [];
    for (let i = 0; i + 1 < pts.length; i++) { const L = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); for (let t = 0; t < L; t += 1) zs.push(s.height(pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t / L, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t / L)); }
    const ends = Math.max(zs[0], zs[zs.length - 1]), climb = Math.max(...zs) - ends;
    if (process.env.DEBUG_RIDE) console.log("  ride profile", zs.map(z => z.toFixed(1)).join(" "));
    console.log(`  ride: ends ${zs[0].toFixed(2)} / ${zs[zs.length - 1].toFixed(2)}, highest ${Math.max(...zs).toFixed(2)} (climb ${climb.toFixed(2)} m over the higher end)`);
    if (climb > e.rideMaxClimbM) fail(site, `the ride climbs ${climb.toFixed(2)} m over the passage, expected at most ${e.rideMaxClimbM}`);
  }
}
console.log(failed ? `${failed} tunnel check(s) failed` : 'tunnel checks passed');
process.exit(failed ? 1 : 0);
