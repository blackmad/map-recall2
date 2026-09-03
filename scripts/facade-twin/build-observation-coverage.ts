/**
 * RECON-6…9 — how much of the pilot can actually be seen.
 *
 * The build prompt is blunt that this comes first: "Coverage is the gating
 * resource, so measure it first and report it per neighbourhood before building
 * anything." Every fidelity tier above LoD2.2 is capped by it, and a
 * reconstruction that reports 100% detail over 30% coverage is 70% invented.
 *
 * The whole calculation is geometric and runs before any image is downloaded.
 * Whether a façade can be measured is decided by where the camera stood, not by
 * what the pixels contain: standoff, obliquity, and whether another building
 * sits in the way. Downloading images to find that out would cost gigabytes to
 * learn something the published camera poses already say.
 *
 * Usage:
 *   npx tsx scripts/facade-twin/build-observation-coverage.ts [--refresh]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AMSTERDAM_GRACHTENGORDEL_WEST } from '../../src/canalRecall/facade/areas.ts';
import { buildElevations, inFrontOf, obliquityDeg, segmentsCross, standoffM, type Elevation } from '../../src/canalRecall/facade/elevations.ts';
import { amsterdamPanoramas, isLeafOff } from '../../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import type { LngLat, PanoramaView, ProjectedPoint } from '../../src/canalRecall/facade/sources.ts';
import { resolveArea } from '../../src/canalRecall/facade/surveyArea.ts';
import { loadNamedWays } from './fetch-area-features.ts';

const AREA = AMSTERDAM_GRACHTENGORDEL_WEST;
const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
const refresh = process.argv.includes('--refresh');

/**
 * Thresholds, each chosen against what a measurement actually needs rather
 * than picked round.
 *
 * `MAX_OBLIQUITY_FRONTAL` 35°: past this a bay's width is foreshortened by more
 * than a fifth, which is the difference between a four-bay and a five-bay
 * reading on a 5.7 m façade.
 * `MAX_OBLIQUITY_OBLIQUE` 65°: past this the wall is compressed to under half
 * width and only the gable outline survives.
 * `MIN_STANDOFF` 3 m: closer than this a 15 m canal house does not fit in the
 * vertical field of view even from a full equirectangular capture.
 * `MAX_STANDOFF` 60 m: further than this the far bank of a canal is beyond
 * useful resolution — an 8000 px panorama gives ~2 cm/px at 25 m and ~5 cm/px
 * at 60 m, and window glazing bars stop resolving.
 */
const MAX_OBLIQUITY_FRONTAL = 35;
const MAX_OBLIQUITY_OBLIQUE = 65;
const MIN_STANDOFF_M = 3;
const MAX_STANDOFF_M = 60;

export type ObservationTier = 'frontal' | 'oblique' | 'aerial-only';

interface ElevationCoverage {
  buildingId: string;
  elevation: number;
  lengthM: number;
  facingDeg: number;
  tier: ObservationTier;
  /** Best view found, by obliquity then standoff. */
  panoramaId: string | null;
  standoffM: number | null;
  obliquityDeg: number | null;
  capturedAt: string | null;
  leafOff: boolean;
  /** Views that pass geometry, before and after occlusion is considered. */
  candidates: number;
  blocked: number;
}

const ways = await loadNamedWays(AREA);
const area = resolveArea(AREA, RD_NEW, ways);

const registry = JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-registry.json`), 'utf8')).data as
  Array<{ buildingId: string; footprintLngLat: LngLat[] }>;
const recon = JSON.parse(await readFile(path.join(STAGING, 'recon.json'), 'utf8'));
const inArea = new Set<string>(recon.buildings.map((b: { buildingId: string }) => b.buildingId));

// Footprints in metres, deduplicated, for both elevations and occlusion.
const footprints = new Map<string, ProjectedPoint[]>();
for (const entry of registry) {
  if (!inArea.has(entry.buildingId) || footprints.has(entry.buildingId)) continue;
  footprints.set(entry.buildingId, entry.footprintLngLat.map(p => RD_NEW.fromLngLat(p)));
}
console.log(`${footprints.size} buildings in the area`);

const elevations = new Map<string, Elevation[]>();
let elevationCount = 0;
for (const [buildingId, footprint] of footprints) {
  const walls = buildElevations(footprint);
  elevations.set(buildingId, walls);
  elevationCount += walls.length;
}
console.log(`${elevationCount} elevations (${(elevationCount / footprints.size).toFixed(1)} per building)`);

// ---- imagery ------------------------------------------------------------
const viewsFile = path.join(CACHE, `${AREA.areaId}-panoramas.json`);
let views: PanoramaView[];
if (!refresh) {
  try { views = JSON.parse(await readFile(viewsFile, 'utf8')).data; } catch { views = []; }
} else views = [];
if (!views.length) {
  console.log('Fetching panorama poses…');
  views = await amsterdamPanoramas.fetchViews(area.bboxLngLat);
  await mkdir(CACHE, { recursive: true });
  await writeFile(viewsFile, JSON.stringify({ retrieved: new Date().toISOString(), data: views }));
}
const posed = views.map(view => ({ view, point: RD_NEW.fromLngLat(view.lngLat), leafOff: isLeafOff(view.capturedAt) }));
console.log(`${posed.length} panorama poses, ${posed.filter(p => p.leafOff).length} of them leaf-off (Nov–Mar)`);

// ---- spatial indexes ----------------------------------------------------
const CELL = 40;
const key = (x: number, y: number) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;

const panoIndex = new Map<string, typeof posed>();
for (const pose of posed) {
  const k = key(pose.point.x, pose.point.y);
  (panoIndex.get(k) ?? panoIndex.set(k, []).get(k)!).push(pose);
}
/** Walls that could block a sight line, indexed by the cells they cross. */
const wallIndex = new Map<string, Array<{ buildingId: string; a: ProjectedPoint; b: ProjectedPoint }>>();
for (const [buildingId, footprint] of footprints) {
  for (let i = 0; i < footprint.length; i++) {
    const a = footprint[i], b = footprint[(i + 1) % footprint.length];
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / CELL) * 2);
    const seen = new Set<string>();
    for (let s = 0; s <= steps; s++) {
      const k = key(a.x + ((b.x - a.x) * s) / steps, a.y + ((b.y - a.y) * s) / steps);
      if (seen.has(k)) continue;
      seen.add(k);
      (wallIndex.get(k) ?? wallIndex.set(k, []).get(k)!).push({ buildingId, a, b });
    }
  }
}

/** Any building other than this one standing between the camera and the wall. */
function occluded(buildingId: string, from: ProjectedPoint, to: ProjectedPoint): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / CELL) * 2);
  const checked = new Set<string>();
  for (let s = 0; s <= steps; s++) {
    const k = key(from.x + ((to.x - from.x) * s) / steps, from.y + ((to.y - from.y) * s) / steps);
    if (checked.has(k)) continue;
    checked.add(k);
    for (const wall of wallIndex.get(k) ?? []) {
      if (wall.buildingId === buildingId) continue;
      if (segmentsCross(from, to, wall.a, wall.b)) return true;
    }
  }
  return false;
}

// ---- coverage -----------------------------------------------------------
const coverage: ElevationCoverage[] = [];
let processed = 0;
for (const [buildingId, walls] of elevations) {
  for (const wall of walls) {
    // Only panoramas within reach of this wall, from the cells around it.
    const nearby: typeof posed = [];
    const reach = Math.ceil(MAX_STANDOFF_M / CELL);
    const cx = Math.floor(wall.midpoint.x / CELL), cy = Math.floor(wall.midpoint.y / CELL);
    for (let dx = -reach; dx <= reach; dx++) for (let dy = -reach; dy <= reach; dy++) {
      for (const pose of panoIndex.get(`${cx + dx},${cy + dy}`) ?? []) nearby.push(pose);
    }

    let candidates = 0, blocked = 0;
    let best: { pose: typeof posed[number]; obliquity: number; standoff: number } | null = null;
    for (const pose of nearby) {
      if (!inFrontOf(wall, pose.point)) continue;
      const standoff = standoffM(wall, pose.point);
      if (standoff < MIN_STANDOFF_M || standoff > MAX_STANDOFF_M) continue;
      const obliquity = obliquityDeg(wall, pose.point);
      if (obliquity > MAX_OBLIQUITY_OBLIQUE) continue;
      candidates++;
      if (occluded(buildingId, pose.point, wall.midpoint)) { blocked++; continue; }
      // Prefer square-on; among comparable angles prefer leaf-off, then closer.
      const better = !best
        || obliquity < best.obliquity - 4
        || (Math.abs(obliquity - best.obliquity) <= 4 && pose.leafOff && !best.pose.leafOff)
        || (Math.abs(obliquity - best.obliquity) <= 4 && pose.leafOff === best.pose.leafOff && standoff < best.standoff);
      if (better) best = { pose, obliquity, standoff };
    }

    coverage.push({
      buildingId,
      elevation: wall.index,
      lengthM: Number(wall.lengthM.toFixed(1)),
      facingDeg: Number(wall.facingDeg.toFixed(0)),
      tier: !best ? 'aerial-only' : best.obliquity <= MAX_OBLIQUITY_FRONTAL ? 'frontal' : 'oblique',
      panoramaId: best?.pose.view.panoramaId ?? null,
      standoffM: best ? Number(best.standoff.toFixed(1)) : null,
      obliquityDeg: best ? Number(best.obliquity.toFixed(1)) : null,
      capturedAt: best?.pose.view.capturedAt ?? null,
      leafOff: best?.pose.leafOff ?? false,
      candidates,
      blocked,
    });
  }
  if (++processed % 400 === 0) process.stdout.write(`\r  ${processed}/${footprints.size} buildings`);
}
process.stdout.write(`\r  ${processed}/${footprints.size} buildings\n`);

// ---- report -------------------------------------------------------------
const share = (n: number, total: number) => `${((100 * n) / total).toFixed(1)}%`;
const byTier = (tier: ObservationTier) => coverage.filter(c => c.tier === tier);

console.log('\nObservation coverage, per elevation');
for (const tier of ['frontal', 'oblique', 'aerial-only'] as const) {
  const rows = byTier(tier);
  console.log(`  ${tier.padEnd(12)} ${String(rows.length).padStart(6)}  ${share(rows.length, coverage.length).padStart(6)}`);
}

const observed = coverage.filter(c => c.tier !== 'aerial-only');
const leafOff = observed.filter(c => c.leafOff);
console.log(`\n  ${leafOff.length} of ${observed.length} observed elevations have a leaf-off view as their best (${share(leafOff.length, observed.length)})`);
const totallyBlocked = coverage.filter(c => c.candidates > 0 && c.blocked === c.candidates);
console.log(`  ${totallyBlocked.length} elevations have views that geometry allows but other buildings block entirely`);

// Per building: what does its best-seen wall reach?
const rank: Record<ObservationTier, number> = { frontal: 2, oblique: 1, 'aerial-only': 0 };
const perBuilding = new Map<string, ObservationTier>();
for (const row of coverage) {
  const current = perBuilding.get(row.buildingId);
  if (!current || rank[row.tier] > rank[current]) perBuilding.set(row.buildingId, row.tier);
}
console.log('\nPer building, best elevation reached');
for (const tier of ['frontal', 'oblique', 'aerial-only'] as const) {
  const n = [...perBuilding.values()].filter(t => t === tier).length;
  console.log(`  ${tier.padEnd(12)} ${String(n).padStart(6)}  ${share(n, perBuilding.size).padStart(6)}`);
}

// Long walls are the ones that matter: they are the street frontage.
const frontage = coverage.filter(c => c.lengthM >= 4);
console.log(`\nElevations 4 m or longer (${frontage.length}) — the street and canal frontage`);
for (const tier of ['frontal', 'oblique', 'aerial-only'] as const) {
  const n = frontage.filter(c => c.tier === tier).length;
  console.log(`  ${tier.padEnd(12)} ${String(n).padStart(6)}  ${share(n, frontage.length).padStart(6)}`);
}

const standoffs = observed.map(c => c.standoffM!).sort((a, b) => a - b);
const obliquities = observed.map(c => c.obliquityDeg!).sort((a, b) => a - b);
const at = (values: number[], p: number) => values[Math.min(values.length - 1, Math.floor(values.length * p))];
console.log(`\n  standoff of the best view   p25 ${at(standoffs, 0.25)} m   p50 ${at(standoffs, 0.5)} m   p75 ${at(standoffs, 0.75)} m`);
console.log(`  obliquity of the best view  p25 ${at(obliquities, 0.25)}°   p50 ${at(obliquities, 0.5)}°   p75 ${at(obliquities, 0.75)}°`);

await mkdir(STAGING, { recursive: true });
await writeFile(path.join(STAGING, 'observation-coverage.json'), JSON.stringify({
  metadata: {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/facade-twin/build-observation-coverage.ts',
    imagery: { id: amsterdamPanoramas.id, name: amsterdamPanoramas.name, license: amsterdamPanoramas.license, attribution: amsterdamPanoramas.attribution },
    panoramaPoses: posed.length,
    thresholds: { MAX_OBLIQUITY_FRONTAL, MAX_OBLIQUITY_OBLIQUE, MIN_STANDOFF_M, MAX_STANDOFF_M },
    buildings: footprints.size,
    elevations: coverage.length,
    note: 'Computed from published camera poses and BAG footprints alone. No image has been downloaded or inspected, so this is an upper bound on what can be measured, not a measurement.',
  },
  coverage,
}));
console.log(`\nwrote ${path.relative(process.cwd(), path.join(STAGING, 'observation-coverage.json'))}`);
