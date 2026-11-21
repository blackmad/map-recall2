/**
 * belt-review:stepped-fronts (2026-11-21): how many belt pands (Grachtengordel AC01-AC04, AG01-AG06) have a street front
 * that BAG draws as near-collinear pieces with small jogs (src/canalRecall/steppedStreetFront.ts), and how many metres of
 * front the mesher lost on them (only a piece of at least 2.4 m facing the street carries a facade; a stub beside it drew
 * as a full-height side wall).
 *
 *   node --import tsx scripts/belt-review/stepped-fronts.ts [--json=<file>] [--list]
 *
 * Reads the BAG tiles and the routing streets; no network. Street test: the mesher's door-wall test (streetDistance
 * against the streets and the belt's walls).
 */
import '../world/useBrowserMath.ts';
import fs from 'node:fs';
import { districtPands } from '../buurt-generators/generate.ts';
import { BELT_BUURTEN } from '../belt-look/generate.ts';
import { shellStreets } from '../world/shellBake.ts';
import { ORIGIN } from '../../src/canalRecall/threeBuildingFeatures.ts';
import { featureStreetTest, absorbRingSteps, steppedFronts, ringArea2, STEP_STUB_M, absorbable, type XY } from '../../src/canalRecall/steppedStreetFront.ts';
import type { DistrictLibrary } from '../../src/canalRecall/buurtGenerator/generate.ts';

const REPO = new URL('../..', import.meta.url).pathname;
const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const pands = districtPands({ buurten: BELT_BUURTEN } as DistrictLibrary);
const features = pands.map(p => ({ geometry: { type: 'Polygon', coordinates: [p.ring.map(c => [c[0], c[1]])] }, properties: { id: p.id } }));
const streets = shellStreets(REPO, features as never);
if (!streets) throw new Error('no streets extract');
const faces = featureStreetTest(features, streets, ORIGIN);
const kx = 111_320 * Math.cos(ORIGIN.lat * Math.PI / 180), ky = 110_540;

type Row = { id: string; lengthM: number; mainM: number; drawnM: number; lostM: number; depthM: number; pieces: number[]; stub: boolean; absorbed: boolean };
const rows: Row[] = [];
features.forEach((f, i) => {
  const ring = f.geometry.coordinates[0];
  const open = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring;
  let pts: XY[] = open.map(([lng, lat]) => [(lng - ORIGIN.lng) * kx, (lat - ORIGIN.lat) * ky] as const);
  if (ringArea2(pts) < 0) pts = [...pts].reverse();
  const n = pts.length;
  const edge = (k: number) => { const a = pts[k], b = pts[(k + 1) % n], len = Math.hypot(b[0] - a[0], b[1] - a[1]); return { x0: a[0], y0: a[1], x1: b[0], y1: b[1], len, nx: (b[1] - a[1]) / len, ny: -(b[0] - a[0]) / len }; };
  const fronts = steppedFronts(pts, k => faces(i, edge(k)));
  if (!fronts.length) return;
  const changed = absorbRingSteps(ring, ORIGIN, e => faces(i, e)) !== ring;
  for (const s of fronts) {
    const lens = s.pieces.map(k => edge(k).len);
    // The facade the mesher drew: the pieces long enough to be door walls (each its own run).
    const drawnM = lens.filter(l => l >= STEP_STUB_M).reduce((a, b) => a + b, 0);
    rows.push({ id: f.properties.id, lengthM: +s.lengthM.toFixed(2), mainM: +s.mainM.toFixed(2), drawnM: +drawnM.toFixed(2), lostM: +(s.lengthM - drawnM).toFixed(2), depthM: +s.depthM.toFixed(2), pieces: lens.map(l => +l.toFixed(2)), stub: s.stub, absorbed: changed && absorbable(s) });
  }
});
const stub = rows.filter(r => r.stub), fixed = rows.filter(r => r.absorbed);
const sum = (rs: Row[], k: 'lostM' | 'lengthM') => +rs.reduce((a, r) => a + r[k], 0).toFixed(1);
const summary = {
  buurten: BELT_BUURTEN, pands: pands.length,
  steppedStreetFronts: rows.length, steppedPands: new Set(rows.map(r => r.id)).size,
  withStub: stub.length, withStubPands: new Set(stub.map(r => r.id)).size, lostM: sum(stub, 'lostM'), frontM: sum(stub, 'lengthM'),
  absorbed: fixed.length, absorbedPands: new Set(fixed.map(r => r.id)).size, absorbedLostM: sum(fixed, 'lostM'),
  allPiecesWhole: rows.length - stub.length, keptWide: stub.filter(r => !absorbable(r)).length, absorbFailed: stub.filter(r => absorbable(r) && !r.absorbed).length,
  lostOver1m: stub.filter(r => r.lostM > 1).length,
  depth: { under0_3: stub.filter(r => r.depthM < 0.3).length, under0_6: stub.filter(r => r.depthM < 0.6).length, under1_5: stub.length },
};
console.log(JSON.stringify(summary, null, 1));
if (process.argv.includes('--list')) for (const r of stub.sort((a, b) => b.lostM - a.lostM)) console.log(r.id.replace('NL.IMBAG.Pand.', ''), r.lengthM, 'drawn', r.drawnM, 'lost', r.lostM, 'depth', r.depthM, r.pieces.join('+'), r.absorbed ? '' : absorbable(r) ? 'NOT ABSORBED (ring check)' : 'kept (wide, deep)');
const out = arg('json');
if (out) fs.writeFileSync(out, JSON.stringify({ summary, rows }, null, 1) + '\n');
