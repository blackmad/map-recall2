/**
 * List wall panels facing a bearing with their position along the wall (t, metres, viewer's left to right in the facade-compare frame),
 * plane depth (metres towards the viewer) and height range.
 *   node --import tsx scripts/haparandaweg/panels-at.ts <id> <bearing> [tol=12]
 */
import { compose, bearingOf } from '../../src/canalRecall/blockBuilding/compose.ts';
import { loadSpec } from './build.ts';

const { spec, set } = loadSpec(process.argv[2]);
const want = Number(process.argv[3]), tol = Number(process.argv[4] ?? 12);
const res = compose(set, spec);
const rad = want * Math.PI / 180, nx = Math.sin(rad), nz = -Math.cos(rad), tx = nz, tz = -nx;
const rows = res.panels.filter(p => Math.abs(((bearingOf(p.n) - want + 540) % 360) - 180) <= tol && p.uMax - p.uMin > 0.4).map(p => {
  const x0 = p.o[0] + p.r[0] * p.uMin, z0 = p.o[2] + p.r[2] * p.uMin, x1 = p.o[0] + p.r[0] * p.uMax, z1 = p.o[2] + p.r[2] * p.uMax;
  return { i: p.index, t0: x0 * tx + z0 * tz, t1: x1 * tx + z1 * tz, depth: (x0 * nx + z0 * nz + x1 * nx + z1 * nz) / 2, v: [p.vMin, p.vMax], party: p.partyH, br: bearingOf(p.n), uMin: p.uMin, uMax: p.uMax };
}).sort((a, b) => a.t0 - b.t0);
for (const r of rows) console.log(`#${r.i} t ${r.t0.toFixed(2)}..${r.t1.toFixed(2)} depth ${r.depth.toFixed(2)} v ${r.v[0].toFixed(1)}-${r.v[1].toFixed(1)} party ${r.party.toFixed(0)} br ${r.br.toFixed(0)} u ${r.uMin.toFixed(2)}..${r.uMax.toFixed(2)}`);
