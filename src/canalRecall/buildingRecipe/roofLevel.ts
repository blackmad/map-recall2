/**
 * Roof levelling for `kind: large` houses (intent `roof.levelRooftop`, 2026-10-23).
 *
 * Some 3DBAG LoD2.2 shells reconstruct a rooftop of glass roofs, plant and setbacks as dozens of small tilted planes
 * ("a crumpled, faceted roof made of many irregular dark triangles", user note 0132871b on Utrechtsestraat 15). The
 * kit draws them verbatim. The standing rule is that the front decides the roof mass and 3DBAG only the plain parts,
 * so this pass replaces every roof plane above the photographed fronts with one flat level (`rooftopLevel` picks the
 * heights from the shell, so the intent carries no metres):
 *
 * - `fromM`: the top of the fronts the intent's `walls[]` groups list, raised to the top of every roof plane that starts
 *   at or under it (repeated until stable), so no plane straddles it;
 * - `toM`: the area-weighted median height of the roof planes wholly above `fromM`.
 *
 * Then `levelRoofAbove`:
 *
 * - every shell vertex (walls and roofs, all rings) higher than `fromM` above the pand's ground moves to `toM`;
 * - roof planes lying wholly above `fromM` thus become flat at `toM` (slope 0); planes at or below are untouched;
 * - walls between two levelled planes collapse to nothing and are dropped; walls rising from below `fromM` keep their
 *   foot and end at `toM`.
 *
 * Because it is one function of each vertex, edges the 3DBAG shell shares stay shared, so a closed shell stays closed.
 * A roof plane that straddles `fromM` would be bent, so it is an error. Absent: unchanged output.
 */
import type {BuildingFacts, WallSurfaceFacts} from './facts.ts';

export interface RoofLevelSpec {
  /** metres above the pand's ground: shell vertices above this move to `toM` */
  fromM: number;
  /** metres above the pand's ground: the flat level the replaced roof planes take */
  toM: number;
}

/** Intent `roof.levelRooftop`: what shows the rooftop is not the crumpled plane field 3DBAG reconstructs. */
export interface RoofLevelIntent {
  evidence: string;
}

export interface RoofLevelReport {
  fromM: number;
  toM: number;
  /** roof planes moved to `toM` */
  levelledRoofs: number;
  levelledRoofAreaM2: number;
  /** walls wholly above `fromM`, dropped */
  droppedWalls: number;
  /** walls rising through `fromM`, cut to end at `toM` */
  cutWalls: number;
  /** 3DBAG roof max before and after */
  roofMaxBeforeM: number;
  roofMaxAfterM: number;
}

type V = number[];
const EPS = 1e-3;

/** Area of a 3D polygon ring (Newell). */
export function ringArea3(ring: V[]): number {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length];
    x += (p[1] - q[1]) * (p[2] + q[2]);
    y += (p[2] - q[2]) * (p[0] + q[0]);
    z += (p[0] - q[0]) * (p[1] + q[1]);
  }
  return Math.hypot(x, y, z) / 2;
}

const same = (a: V, b: V) => Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS && Math.abs(a[2] - b[2]) < EPS;

/** Drop consecutive (and wrap-around) duplicate vertices. */
function dedupe(ring: V[]): V[] {
  const out: V[] = [];
  for (const p of ring) if (!out.length || !same(out[out.length - 1], p)) out.push(p);
  while (out.length > 1 && same(out[0], out[out.length - 1])) out.pop();
  return out;
}

/** The level heights for `roof.levelRooftop` (see the header), from the shell and the fronts' wall surface numbers. */
export function rooftopLevel(facts: BuildingFacts, frontSurfaces: number[]): RoofLevelSpec {
  const g = facts.heights.groundNAP, fronts = new Set(frontSurfaces);
  const tops = (facts.wallsRD ?? []).filter(w => fronts.has(w.surface)).map(w => w.topM);
  if (!tops.length) throw Error(`${facts.pandId}: roof.levelRooftop needs the walls[] fronts in the shell`);
  const planes = facts.roofsRD.map(r => {
    const zs = r.ringsRD.flat().map(p => p[2] - g);
    return {lo: Math.min(...zs), hi: Math.max(...zs), mid: (Math.min(...zs) + Math.max(...zs)) / 2, area: r.areaM2};
  });
  let fromM = Math.max(...tops);
  for (;;) {
    const next = Math.max(fromM, ...planes.filter(p => p.lo <= fromM).map(p => p.hi));
    if (next === fromM) break;
    fromM = next;
  }
  const above = planes.filter(p => p.lo > fromM).sort((a, b) => a.mid - b.mid);
  if (!above.length) throw Error(`${facts.pandId}: roof.levelRooftop: no roof plane lies above the fronts (${fromM.toFixed(2)} m)`);
  const total = above.reduce((s, p) => s + p.area, 0);
  let run = 0, toM = above[above.length - 1].mid;
  for (const p of above) { run += p.area; if (run >= total / 2) { toM = p.mid; break; } }
  const r2 = (v: number) => Math.round(v * 100) / 100;
  // fromM rounds up and toM stays above it, so no plane is cut by the rounding
  return {fromM: Math.ceil(fromM * 100) / 100, toM: Math.max(r2(toM), Math.ceil(fromM * 100) / 100 + 0.01)};
}

export function levelRoofAbove(facts: BuildingFacts, spec: RoofLevelSpec): {facts: BuildingFacts; report: RoofLevelReport} {
  const g = facts.heights.groundNAP, from = g + spec.fromM, to = g + spec.toM;
  if (!(spec.toM > spec.fromM)) throw Error(`${facts.pandId}: roof level toM (${spec.toM}) must lie above fromM (${spec.fromM})`);
  const move = (p: V): V => p[2] > from ? [p[0], p[1], to] : p;
  const report: RoofLevelReport = {fromM: spec.fromM, toM: spec.toM, levelledRoofs: 0, levelledRoofAreaM2: 0, droppedWalls: 0, cutWalls: 0, roofMaxBeforeM: facts.heights.roofMaxM, roofMaxAfterM: 0};
  const roofsRD = facts.roofsRD.map(r => {
    const zs = r.ringsRD.flat().map(p => p[2]);
    const lo = Math.min(...zs), hi = Math.max(...zs);
    if (lo <= from && hi > from) throw Error(`${facts.pandId}: roof level fromM ${spec.fromM} m cuts roof plane ${r.surfaceId} (${(lo - g).toFixed(2)}..${(hi - g).toFixed(2)} m); pick a level in a gap of the roof heights`);
    if (lo <= from) return r;
    report.levelledRoofs++;
    report.levelledRoofAreaM2 += r.areaM2;
    return {...r, vertices: r.vertices.map(move), ringsRD: r.ringsRD.map(ring => ring.map(move)), slopeDeg: 0};
  });
  const wallsRD = facts.wallsRD?.flatMap((w): WallSurfaceFacts[] => {
    if (!w.ringsRD.flat().some(p => p[2] > from)) return [w];
    const [outer, ...holes] = w.ringsRD.map(ring => dedupe(ring.map(move)));
    const zs = outer.map(p => p[2]);
    if (outer.length < 3 || Math.max(...zs) - Math.min(...zs) < 0.01 || ringArea3(outer) < 1e-4) { report.droppedWalls++; return []; }
    report.cutWalls++;
    const kept = holes.filter(h => h.length >= 3 && ringArea3(h) >= 1e-4);
    const areaM2 = ringArea3(outer) - kept.reduce((s, h) => s + ringArea3(h), 0);
    return [{...w, ringsRD: [outer, ...kept], areaM2, topM: Math.max(...zs) - g}];
  });
  const roofZ = roofsRD.flatMap(r => r.ringsRD.flat().map(p => p[2] - g));
  report.roofMaxAfterM = Math.max(...roofZ);
  report.levelledRoofAreaM2 = Math.round(report.levelledRoofAreaM2 * 10) / 10;
  return {
    facts: {...facts, roofsRD, ...(wallsRD ? {wallsRD} : {}), heights: {...facts.heights, roofMaxM: report.roofMaxAfterM, roofMinM: Math.min(...roofZ)}},
    report,
  };
}
