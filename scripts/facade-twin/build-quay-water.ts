/**
 * RECON-10 — quay crowns, water level and bridges.
 *
 * The brief admits these into an otherwise buildings-only scope for one reason:
 * "buildings are unreadable without it". A canal house sits on a quay a metre
 * or so above a water surface, and getting either wrong makes every façade
 * float or wade. It also warns specifically against the easy mistake — Amsterdam
 * is flat but not level, and "a canal that renders perfectly horizontal across
 * a kilometre is wrong".
 *
 * So the quay is measured rather than assumed, and the measurement is already
 * in hand: 3DBAG publishes `b3_h_maaiveld`, the ground level at each building,
 * derived from AHN. The buildings fronting a canal stand *on* its quay, so
 * their ground levels sample the quay crown along its length at roughly one
 * reading per five metres of frontage — a denser survey than anything this
 * project could acquire on its own.
 *
 * Water level is not measured here and is not pretended to be. Rijkswaterstaat
 * holds the Amsterdam boezem at a target level, and that constant lives in
 * rdNew.ts with its source. What this does is check the quays against it, which
 * is the part that can go wrong silently.
 *
 * Usage: npx tsx scripts/facade-twin/build-quay-water.ts
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AMSTERDAM_GRACHTENGORDEL_WEST } from '../../src/canalRecall/facade/areas.ts';
import { CANAL_WATER_LEVEL_NAP_M, NOMINAL_QUAY_CROWN_NAP_M } from '../../src/canalRecall/facade/rdNew.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import { chainWays, type NamedWay } from '../../src/canalRecall/facade/surveyArea.ts';
import type { LngLat, MassingRecord, ProjectedPoint } from '../../src/canalRecall/facade/sources.ts';
import { loadNamedWays } from './fetch-area-features.ts';

const AREA = AMSTERDAM_GRACHTENGORDEL_WEST;
const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
/** How far from a centreline a building must be to count as fronting that canal. */
const QUAY_REACH_M = 42;
/** Sampled along each canal at this spacing, which is about eight canal houses. */
const SEGMENT_M = 45;

const registry = JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-registry.json`), 'utf8')).data as
  Array<{ buildingId: string; footprintLngLat: LngLat[] }>;
const recon = JSON.parse(await readFile(path.join(STAGING, 'recon.json'), 'utf8'));
const massing = new Map<string, MassingRecord>(recon.massing.map((m: MassingRecord) => [m.buildingId, m]));
const inArea = new Set<string>(recon.buildings.map((b: any) => b.buildingId));

const centroids = new Map<string, ProjectedPoint>();
for (const entry of registry) {
  if (!inArea.has(entry.buildingId) || centroids.has(entry.buildingId)) continue;
  const points = entry.footprintLngLat.map(p => RD_NEW.fromLngLat(p));
  centroids.set(entry.buildingId, {
    x: points.reduce((s, p) => s + p.x, 0) / points.length,
    y: points.reduce((s, p) => s + p.y, 0) / points.length,
  });
}

const ways = await loadNamedWays(AREA);
const canals = new Map<string, ProjectedPoint[]>();
for (const name of new Set(ways.map((w: NamedWay) => w.name))) {
  const chains = chainWays(ways.filter((w: NamedWay) => w.name === name).map((w: NamedWay) => w.points), RD_NEW);
  const projected = chains.map(chain => chain.map(p => RD_NEW.fromLngLat(p)));
  const length = (chain: ProjectedPoint[]) => chain.reduce((t, p, i) => (i ? t + Math.hypot(p.x - chain[i - 1].x, p.y - chain[i - 1].y) : 0), 0);
  canals.set(name, projected.reduce((best, c) => (length(c) > length(best) ? c : best), projected[0]));
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[sorted.length >> 1];
};

/** Distance from a point to a polyline, and how far along it that lands. */
function project(polyline: ProjectedPoint[], p: ProjectedPoint) {
  let best = { distance: Infinity, along: 0 };
  let travelled = 0;
  for (let i = 1; i < polyline.length; i++) {
    const a = polyline[i - 1], b = polyline[i];
    const vx = b.x - a.x, vy = b.y - a.y;
    const len2 = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2));
    const cx = a.x + t * vx, cy = a.y + t * vy;
    const distance = Math.hypot(p.x - cx, p.y - cy);
    if (distance < best.distance) best = { distance, along: travelled + t * Math.sqrt(len2) };
    travelled += Math.sqrt(len2);
  }
  return best;
}

const results = [];
for (const [canal, centreline] of canals) {
  // Buildings fronting this canal, bucketed into segments along its length.
  const segments = new Map<number, number[]>();
  for (const [buildingId, centroid] of centroids) {
    const ground = massing.get(buildingId)?.groundLevel;
    if (ground == null) continue;
    const { distance, along } = project(centreline, centroid);
    if (distance > QUAY_REACH_M) continue;
    const bucket = Math.floor(along / SEGMENT_M);
    (segments.get(bucket) ?? segments.set(bucket, []).get(bucket)!).push(ground);
  }

  const crowns: Array<{ atM: number; crownNap: number; buildings: number }> = [];
  for (const [bucket, grounds] of [...segments.entries()].sort((a, b) => a[0] - b[0])) {
    // Three is the fewest that can outvote one mis-levelled building.
    if (grounds.length < 3) continue;
    crowns.push({ atM: bucket * SEGMENT_M, crownNap: Number(median(grounds).toFixed(2)), buildings: grounds.length });
  }
  if (crowns.length < 2) continue;

  const heights = crowns.map(c => c.crownNap);
  results.push({
    canal,
    lengthM: Math.round(crowns.length * SEGMENT_M),
    segments: crowns.length,
    crownNapM: { min: Math.min(...heights), median: Number(median(heights).toFixed(2)), max: Math.max(...heights) },
    /** The number the brief cares about: how far a quay rises and falls. */
    fallM: Number((Math.max(...heights) - Math.min(...heights)).toFixed(2)),
    freeboardM: Number((median(heights) - CANAL_WATER_LEVEL_NAP_M).toFixed(2)),
    crowns,
  });
}

results.sort((a, b) => b.lengthM - a.lengthM);
await mkdir(STAGING, { recursive: true });
await writeFile(path.join(STAGING, 'quay-water.json'), JSON.stringify({
  metadata: {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/facade-twin/build-quay-water.ts',
    method: 'Quay crown sampled from 3DBAG b3_h_maaiveld (AHN-derived ground level) of buildings within '
      + `${QUAY_REACH_M} m of each canal centreline, bucketed every ${SEGMENT_M} m and taken as a median.`,
    waterLevelNapM: CANAL_WATER_LEVEL_NAP_M,
    waterLevelSource: 'Rijkswaterstaat target level for the Amsterdam boezem; see rdNew.ts',
    nominalQuayCrownNapM: NOMINAL_QUAY_CROWN_NAP_M,
    attribution: '3DBAG LoD2.2, TU Delft (CC BY 4.0), from AHN; BAG, Kadaster (CC0); centrelines OpenStreetMap (ODbL)',
  },
  canals: results,
}, null, 2));

console.log(`Quay crowns from ${centroids.size} buildings' AHN ground levels, sampled every ${SEGMENT_M} m\n`);
console.log('  canal            length  segments   crown min/median/max (m NAP)   fall   freeboard');
for (const r of results) {
  console.log(`  ${r.canal.padEnd(16)} ${String(r.lengthM).padStart(5)} m  ${String(r.segments).padStart(6)}   `
    + `${r.crownNapM.min.toFixed(2).padStart(6)} / ${r.crownNapM.median.toFixed(2)} / ${r.crownNapM.max.toFixed(2).padStart(5)}      `
    + `${r.fallM.toFixed(2).padStart(4)}   ${r.freeboardM.toFixed(2)} m`);
}
const falls = results.map(r => r.fallM);
console.log(`\nA canal rendered level across its length would be wrong by up to ${Math.max(...falls).toFixed(2)} m.`);
const allCrowns = results.flatMap(r => r.crowns.map(c => c.crownNap));
console.log(`Quay crown across the boundary: median ${median(allCrowns).toFixed(2)} m NAP against the nominal ${NOMINAL_QUAY_CROWN_NAP_M} m.`);
console.log(`Freeboard above the ${CANAL_WATER_LEVEL_NAP_M} m water level: median ${(median(allCrowns) - CANAL_WATER_LEVEL_NAP_M).toFixed(2)} m.`);
console.log(`\nwrote ${path.relative(process.cwd(), path.join(STAGING, 'quay-water.json'))}`);
