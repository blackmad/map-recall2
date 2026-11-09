/**
 * Roof tidy for `kind: large` houses (intent `roof.tidy`, issue #87, 2026-11-09).
 *
 * The large tier draws every roof part except the measured front crown from 3DBAG LoD2.2 planes, which come with
 * noise: a dozen flat levels a few centimetres apart, slivers under a few m² and lone spikes. Three measured rules,
 * everything else verbatim (the front decides the roof mass, 3DBAG only the plain parts):
 *
 *  1. Flat levels within LEVEL_MERGE_M of each other (single linkage over the flat planes' heights) take their
 *     area-weighted mean height.
 *  2. A sliver (plane under SLIVER_M2) that stands more than SPIKE_M over the highest plane it touches is a spike:
 *     its vertices are clamped to that height. A flat sliver within SLIVER_FOLD_M of its largest neighbour's level
 *     folds into that level.
 *  3. Planes carrying a photographed front's top line (see `protectedPlane`) stay exactly as they are: the crown is authoritative.
 *
 * Heights are one function of each vertex (keyed by its x, y, z), applied to roofs and walls alike, so edges the shell
 * shares stay shared and a closed shell stays closed. Absent: unchanged output (the function is not called).
 */
import type {BuildingFacts, WallSurfaceFacts} from './facts.ts';

export const LEVEL_MERGE_M = 0.5;
export const SLIVER_M2 = 4;
export const SPIKE_M = 0.8;
export const SLIVER_FOLD_M = 1.5;
export const FRONT_ZONE_M = 1.5;
/** Two flat planes count as separate levels when more than this apart (the metric; the tidy merges up to LEVEL_MERGE_M). */
export const LEVEL_COUNT_M = 0.1;
const ON_FRONT_M = 0.3, FLAT_RANGE_M = 0.05, TOUCH_M = 0.1, STEP_M = 0.15;

/** Intent `roof.tidy`: why the 3DBAG plane field is noise here (photo ids, user note). */
export interface RoofTidyIntent { evidence: string }

type Surface = BuildingFacts['roofsRD'][number];
type V = number[];
/** `stepped`: slivers whose height differs by more than STEP_M from a plane they touch (the jagged look; folding removes it). */
export interface RoofMetrics { pieces: number; slivers: number; stepped: number; flatLevels: number; spikes: number; roofMaxM: number; crownM: number }
export interface RoofTidyReport { before: RoofMetrics; after: RoofMetrics; mergedLevels: number; foldedSlivers: number; clampedSpikes: number; protectedPlanes: number }

const ringOf = (s: Surface) => s.ringsRD?.[0] ?? s.vertices;
const key = (v: V) => `${v[0].toFixed(3)},${v[1].toFixed(3)},${v[2].toFixed(3)}`;
function segDist(p: V, a: V, b: V) {
  const dx = b[0] - a[0], dy = b[1] - a[1], den = dx * dx + dy * dy;
  const t = den ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / den)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
const chainDist = (p: V, chain: V[]) => chain.length < 2 ? Infinity : Math.min(...chain.slice(1).map((q, i) => segDist(p, chain[i], q)));
function touches(a: Surface, b: Surface) {
  const ra = ringOf(a), rb = ringOf(b);
  const near = (pts: V[], ring: V[]) => pts.some(p => ring.some((q, i) => segDist(p, q, ring[(i + 1) % ring.length]) < TOUCH_M));
  return near(ra, rb) || near(rb, ra);
}
const meanZ = (s: Surface) => s.vertices.reduce((n, v) => n + v[2], 0) / s.vertices.length;
const isFlat = (s: Surface) => { const zs = s.vertices.map(v => v[2]); return Math.max(...zs) - Math.min(...zs) < FLAT_RANGE_M; };

/** Piece / sliver / flat-level / spike counts of a roof (the report the lane and the tests read). */
export function roofMetrics(facts: BuildingFacts): RoofMetrics {
  const g = facts.heights.groundNAP, roofs = facts.roofsRD;
  const top = (s: Surface) => Math.max(...s.vertices.map(v => v[2])) - g;
  // distinct levels = single-linkage clusters over the sorted flat heights
  const sorted = roofs.filter(isFlat).map(s => meanZ(s) - g).sort((a, b) => a - b);
  const flatLevels = sorted.reduce((n, z, i) => i === 0 || z - sorted[i - 1] > LEVEL_COUNT_M ? n + 1 : n, 0);
  const isSliver = roofs.map(s => s.areaM2 < SLIVER_M2);
  let spikes = 0, stepped = 0;
  roofs.forEach((s, i) => {
    if (!isSliver[i]) return;
    const nb = roofs.filter((o, j) => j !== i && !isSliver[j] && touches(s, o));
    if (nb.some(o => Math.abs(meanZ(o) - meanZ(s)) > STEP_M)) stepped++;
    if (!nb.length || top(s) - Math.max(...nb.map(top)) > SPIKE_M) spikes++;
  });
  const crownM = Math.max(0, ...facts.fronts.map(f => f.topM));
  return {pieces: roofs.length, slivers: isSliver.filter(Boolean).length, stepped, flatLevels, spikes, roofMaxM: +Math.max(...roofs.map(top)).toFixed(2), crownM: +crownM.toFixed(2)};
}

/** `frontSurfaces`: the 3DBAG wall surface numbers of the intent's photographed fronts (`walls[].wallSurfaces`); their plan edges count as fronts too. */
export function tidyRoof(facts: BuildingFacts, options: {frontSurfaces?: number[]} = {}): {facts: BuildingFacts; report: RoofTidyReport} {
  const g = facts.heights.groundNAP, roofs = facts.roofsRD;
  const before = roofMetrics(facts);
  const top = (s: Surface) => Math.max(...s.vertices.map(v => v[2]));
  // A plane is a front plane (kept) when it carries a photographed front's top line: two or more of its vertices lie on
  // that wall's top edge (within ON_FRONT_M in plan and in height), or within FRONT_ZONE_M of a measured front chain
  // at the front's own top. Planes that merely touch the front's foot, or sit behind it, are free to tidy.
  const fs = new Set(options.frontSurfaces ?? []);
  const tops: {ring: V[]; topZ: number}[] = [];
  for (const w of facts.wallsRD ?? []) if (fs.has(w.surface)) tops.push({ring: w.ringsRD[0], topZ: g + w.topM});
  const onFrontTop = (v: V) => tops.some(t => Math.abs(v[2] - t.topZ) < ON_FRONT_M && t.ring.some((q, i) => segDist(v, q, t.ring[(i + 1) % t.ring.length]) < ON_FRONT_M && Math.abs(q[2] - t.topZ) < ON_FRONT_M || false))
    || facts.fronts.some(f => Math.abs(v[2] - g - f.topM) < ON_FRONT_M && chainDist(v, f.chainRD as V[]) < FRONT_ZONE_M);
  const protectedPlane = roofs.map(s => s.vertices.filter(onFrontTop).length >= 2);
  const protectedKeys = new Set(roofs.flatMap((s, i) => protectedPlane[i] ? (s.ringsRD ?? [s.vertices]).flat().map(key) : []));
  const target = new Map<string, number>(); // vertex key -> new absolute z
  // Rule 1: merge flat levels (single linkage, area-weighted mean). Protected planes take part as anchors but never move.
  const flats = roofs.map((s, i) => ({s, i})).filter(({s}) => isFlat(s)).sort((a, b) => meanZ(a.s) - meanZ(b.s));
  const clusters: (typeof flats)[] = [];
  for (const f of flats) {
    const last = clusters.at(-1);
    if (last && meanZ(f.s) - meanZ(last.at(-1)!.s) <= LEVEL_MERGE_M) last.push(f); else clusters.push([f]);
  }
  const levelOf = new Map<number, number>(); // plane index -> its level after merging
  let mergedLevels = 0;
  for (const c of clusters) {
    const anchors = c.filter(f => protectedPlane[f.i]), pool = anchors.length ? anchors : c;
    const area = pool.reduce((n, f) => n + f.s.areaM2, 0) || 1;
    const z = pool.reduce((n, f) => n + meanZ(f.s) * f.s.areaM2, 0) / area;
    if (c.length > 1) mergedLevels += c.length - 1;
    for (const f of c) {
      levelOf.set(f.i, z);
      if (!protectedPlane[f.i]) for (const v of f.s.vertices) if (!protectedKeys.has(key(v)) && Math.abs(v[2] - z) > 1e-6) target.set(key(v), z);
    }
  }
  // Rule 2: slivers.
  const isSliver = roofs.map(s => s.areaM2 < SLIVER_M2);
  let foldedSlivers = 0, clampedSpikes = 0;
  roofs.forEach((s, i) => {
    if (!isSliver[i] || protectedPlane[i]) return;
    const nb = roofs.map((o, j) => j).filter(j => j !== i && !isSliver[j] && touches(s, roofs[j]));
    if (!nb.length) return;
    const nbTop = Math.max(...nb.map(j => Math.max(...roofs[j].vertices.map(v => levelOf.has(j) ? levelOf.get(j)! : v[2]))));
    const big = nb.reduce((m, j) => roofs[j].areaM2 > roofs[m].areaM2 ? j : m, nb[0]);
    if (top(s) - nbTop > SPIKE_M) {
      clampedSpikes++;
      for (const v of s.vertices) if (!protectedKeys.has(key(v)) && v[2] > nbTop) target.set(key(v), nbTop);
    } else if (isFlat(s) && levelOf.has(big) && Math.abs(meanZ(s) - levelOf.get(big)!) <= SLIVER_FOLD_M) {
      foldedSlivers++;
      for (const v of s.vertices) if (!protectedKeys.has(key(v))) target.set(key(v), levelOf.get(big)!);
    }
  });
  if (!target.size) return {facts, report: {before, after: before, mergedLevels, foldedSlivers, clampedSpikes, protectedPlanes: protectedPlane.filter(Boolean).length}};
  const move = (v: V): V => { const z = target.get(key(v)); return z === undefined ? v : [v[0], v[1], z]; };
  const roofsRD = roofs.map(s => {
    if (![...s.vertices, ...(s.ringsRD ?? []).flat()].some(v => target.has(key(v)))) return s;
    const vertices = s.vertices.map(move), ringsRD = s.ringsRD?.map(r => r.map(move));
    const zs = vertices.map(v => v[2]);
    return {...s, vertices, ...(ringsRD ? {ringsRD} : {}), slopeDeg: Math.max(...zs) - Math.min(...zs) < FLAT_RANGE_M ? 0 : s.slopeDeg};
  });
  const wallsRD = facts.wallsRD?.map((w): WallSurfaceFacts => {
    if (!w.ringsRD.flat().some(v => target.has(key(v)))) return w;
    const ringsRD = w.ringsRD.map(r => r.map(move));
    return {...w, ringsRD, topM: Math.max(...ringsRD.flat().map(v => v[2] - g))};
  });
  const roofZ = roofsRD.flatMap(s => s.vertices.map(v => v[2] - g));
  const out: BuildingFacts = {...facts, roofsRD, ...(wallsRD ? {wallsRD} : {}), heights: {...facts.heights, roofMaxM: Math.max(...roofZ), roofMinM: Math.min(...roofZ)}};
  return {facts: out, report: {before, after: roofMetrics(out), mergedLevels, foldedSlivers, clampedSpikes, protectedPlanes: protectedPlane.filter(Boolean).length}};
}
