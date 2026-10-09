/**
 * 3DBAG LoD2.2 roof clean-up for recipe houses.
 *
 * LoD2.2 reconstructs roofs from point clouds; on narrow street houses it
 * leaves small raised artefacts that read as wrong at street distance: a
 * stair-housing box standing 2.5 m proud of a flat roof (Bilderdijkstraat
 * 079721), a 2 m² 66° spike (155417), a 15 m² lump where the crown sits
 * (081118), and a steep pyramid where the photo shows a cornice front with a
 * flat roof behind it (153622). Two measured rules, everything else verbatim:
 *
 *  1. Raised small cluster: connected surfaces each under SMALL_SURFACE_M2,
 *     together under SMALL_CLUSTER_M2, whose top stands more than RAISE_M
 *     above every surface around it → clamp the cluster's vertices to the
 *     surrounding roof's top. (Boxes become flat at the base, spikes become
 *     facets that end at the base height.)
 *     Clusters touching the frontage of a gabled front (step/neck/bell/...)
 *     are that gable's crown as LoD2.2 saw it and stay.
 *  2. Gable end behind a horizontal front: when a front declares a cornice or
 *     flat crown, a ridge that LoD2.2 runs out to the frontage more than
 *     HIP_ALLOWANCE_M above the front eaves (seen from the street as a
 *     "pyramid" over the cornice; 153622) is hipped back: the ridge end drops
 *     to the eaves and a hip point is inserted on the ridge at the roof's own
 *     slope. The recipe's declared roof (behind the cornice) wins.
 *
 * The cleaned facts keep the 3DBAG roofMax in `heights.surveyRoofMaxM`;
 * gates compare against the cleaned max and report what was removed.
 */
import type {BuildingFacts} from './facts.ts';

export const SMALL_SURFACE_M2 = 12;
export const SMALL_CLUSTER_M2 = 25;
export const RAISE_M = 0.8;
export const HIP_ALLOWANCE_M = 1;
export const FRONT_ZONE_M = 3;
const TOUCH_M = 0.1, ON_FRONT_M = 0.3;

type Surface = BuildingFacts['roofsRD'][number];
export interface RoofCleanupAction { kind: 'raised-cluster' | 'front-hip'; surfaceIds: string[]; areaM2: number; fromTopM: number; toTopM: number }
export interface RoofCleanupReport { actions: RoofCleanupAction[]; surveyRoofMaxM: number; roofMaxM: number; removedAreaM2: number; roofAreaM2: number }

const ringOf = (s: Surface) => (s.ringsRD?.[0] ?? s.vertices);
function segmentDistance(p: number[], a: number[], b: number[]) {
  const dx = b[0] - a[0], dy = b[1] - a[1], den = dx * dx + dy * dy;
  const t = den ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / den)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
/** Surfaces touch in plan when a vertex of one lies within TOUCH_M of an edge of the other. */
function touches(a: Surface, b: Surface) {
  const ra = ringOf(a), rb = ringOf(b);
  const near = (pts: number[][], ring: number[][]) => pts.some(p => ring.some((q, i) => segmentDistance(p, q, ring[(i + 1) % ring.length]) < TOUCH_M));
  return near(ra, rb) || near(rb, ra);
}

const chainDistance = (p: number[], chain: number[][]) => Math.min(...chain.slice(1).map((q, i) => segmentDistance(p, chain[i], q)));

/** `horizontalFronts`: streets whose front declares a cornice/flat crown (others are gabled). */
export function cleanRoof(facts: BuildingFacts, options: {horizontalFronts: string[]}): {facts: BuildingFacts; report: RoofCleanupReport} {
  const ground = facts.heights.groundNAP, roofs = facts.roofsRD;
  const top = (s: Surface) => Math.max(...s.vertices.map(v => v[2])) - ground;
  const bottom = (s: Surface) => Math.min(...s.vertices.map(v => v[2])) - ground;
  const neighbours = roofs.map((s, i) => roofs.map((o, j) => j !== i && touches(s, o) ? j : -1).filter(j => j >= 0));
  const clamp = new Map<number, number>(); // surface index -> max height above ground
  const actions: RoofCleanupAction[] = [];
  // Rule 1: raised small clusters.
  const small = roofs.map(s => s.areaM2 < SMALL_SURFACE_M2), seen = new Set<number>();
  for (let i = 0; i < roofs.length; i++) {
    if (!small[i] || seen.has(i)) continue;
    const cluster: number[] = [], stack = [i];
    while (stack.length) { const k = stack.pop()!; if (seen.has(k)) continue; seen.add(k); cluster.push(k); for (const j of neighbours[k]) if (small[j] && !seen.has(j)) stack.push(j); }
    const outside = [...new Set(cluster.flatMap(k => neighbours[k]))].filter(j => !cluster.includes(j));
    if (!outside.length) continue;
    const gabledFronts = facts.fronts.filter(f => !options.horizontalFronts.includes(f.street));
    if (cluster.some(k => roofs[k].vertices.some(v => gabledFronts.some(f => chainDistance(v, f.chainRD) < FRONT_ZONE_M)))) continue;
    const area = cluster.reduce((s, k) => s + roofs[k].areaM2, 0), clusterTop = Math.max(...cluster.map(k => top(roofs[k]))), base = Math.max(...outside.map(j => top(roofs[j])));
    if (area >= SMALL_CLUSTER_M2 || clusterTop - base <= RAISE_M) continue;
    for (const k of cluster) clamp.set(k, base);
    actions.push({kind: 'raised-cluster', surfaceIds: cluster.map(k => roofs[k].surfaceId), areaM2: +area.toFixed(2), fromTopM: +clusterTop.toFixed(2), toTopM: +base.toFixed(2)});
  }
  const surveyRoofMaxM = facts.heights.roofMaxM, roofAreaM2 = roofs.reduce((s, r) => s + r.areaM2, 0);
  const cap = (v: number[], k: number) => clamp.has(k) ? [v[0], v[1], Math.min(v[2], clamp.get(k)! + ground)] : v;
  let rings = roofs.map((s, k) => (s.ringsRD ?? [s.vertices]).map(r => r.map(v => cap(v, k))));
  // Rule 2: hip a ridge end that LoD2.2 runs out to a horizontal front.
  for (const front of facts.fronts.filter(f => options.horizontalFronts.includes(f.street))) {
    const limit = front.eavesM + HIP_ALLOWANCE_M + ground, eaves = front.eavesM + ground;
    const same = (a: number[], b: number[]) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
    const ends = rings.flat(2).filter(v => v[2] > limit && chainDistance(v, front.chainRD) < ON_FRONT_M);
    const done: number[][] = [];
    for (const end of ends) {
      if (done.some(d => same(d, end))) continue;
      done.push(end);
      // The ridge leaves the front at the neighbouring high vertex off the frontage, in every ring sharing the end.
      let ridge: number[] | null = null, slope = 0;
      rings.forEach((surface, k) => surface.forEach(r => r.forEach((v, i) => {
        if (!same(v, end)) return;
        for (const w of [r[(i + 1) % r.length], r[(i + r.length - 1) % r.length]]) if (w[2] > limit && chainDistance(w, front.chainRD) > ON_FRONT_M && (!ridge || w[2] > ridge[2])) { ridge = w; slope = Math.max(slope, roofs[k].slopeDeg); }
      })));
      if (!ridge) continue;
      const r0 = ridge as number[], length = Math.hypot(r0[0] - end[0], r0[1] - end[1]);
      const run = Math.min(length * 0.8, (end[2] - eaves) / Math.tan(Math.max(30, Math.min(70, slope)) * Math.PI / 180)), t = run / length;
      const hip = [end[0] + (r0[0] - end[0]) * t, end[1] + (r0[1] - end[1]) * t, end[2] + (r0[2] - end[2]) * t];
      const touched: number[] = [];
      rings = rings.map((surface, k) => surface.map(r => {
        const out: number[][] = [];
        r.forEach((v, i) => {
          const next = r[(i + 1) % r.length], prev = r[(i + r.length - 1) % r.length];
          if (same(v, end)) { touched.push(k); if (same(prev, r0)) out.push(hip); out.push([v[0], v[1], eaves]); if (same(next, r0)) out.push(hip); }
          else out.push(v);
        });
        return out;
      }));
      actions.push({kind: 'front-hip', surfaceIds: [...new Set(touched)].map(k => roofs[k].surfaceId), areaM2: 0, fromTopM: +(end[2] - ground).toFixed(2), toTopM: +(eaves - ground).toFixed(2)});
    }
  }
  if (!actions.length) return {facts, report: {actions, surveyRoofMaxM, roofMaxM: surveyRoofMaxM, removedAreaM2: 0, roofAreaM2: +roofAreaM2.toFixed(2)}};
  const roofsRD = roofs.map((s, k) => {
    const ringsRD = rings[k], vertices = s.ringsRD ? ringsRD.flat() : ringsRD[0];
    if (JSON.stringify(vertices) === JSON.stringify(s.vertices)) return s;
    const zs = vertices.map(v => v[2]), flat = Math.max(...zs) - Math.min(...zs) < 0.05;
    return {...s, vertices, ...(s.ringsRD ? {ringsRD} : {}), slopeDeg: flat ? 0 : s.slopeDeg};
  });
  const roofMaxM = Math.max(...roofsRD.flatMap(s => s.vertices.map(v => v[2] - ground)));
  const cleaned: BuildingFacts = {
    ...facts, roofsRD,
    heights: {...facts.heights, roofMaxM, ridgeM: Math.min(facts.heights.ridgeM, roofMaxM), surveyRoofMaxM} as BuildingFacts['heights'],
    fronts: facts.fronts.map(f => ({...f, topM: Math.min(f.topM, roofMaxM), topProfile: f.topProfile.map(p => ({...p, heightM: Math.min(p.heightM, roofMaxM)}))})),
  };
  const removedAreaM2 = actions.reduce((s, a) => s + a.areaM2, 0);
  return {facts: cleaned, report: {actions, surveyRoofMaxM: +surveyRoofMaxM.toFixed(2), roofMaxM: +roofMaxM.toFixed(2), removedAreaM2: +removedAreaM2.toFixed(2), roofAreaM2: +roofAreaM2.toFixed(2)}};
}
