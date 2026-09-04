/**
 * Measure façades across the whole boundary, panorama by panorama.
 *
 * The block runner measures a named street and downloads one panorama per
 * building. That is the wrong shape for 3,025 buildings: an 8000 px
 * equirectangular is ~2.6 MB, and a canal terrace is photographed from the far
 * quay, so one image sees a dozen fronts at once. Grouping the work by *image*
 * rather than by building turns thousands of downloads into hundreds, and it
 * costs nothing in fidelity — each building is still rectified onto its own
 * wall plane and measured from its own pixels.
 *
 * Resumable, because it will be interrupted. Results are appended to a store
 * keyed by pand_id and a rerun skips what is already there.
 *
 * Usage:
 *   npx tsx scripts/facade-twin/measure-boundary.ts --panoramas=40
 *   npx tsx scripts/facade-twin/measure-boundary.ts --panoramas=200 --fresh
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { AMSTERDAM_GRACHTENGORDEL_WEST } from '../../src/canalRecall/facade/areas.ts';
import { buildElevations, inFrontOf, obliquityDeg, standoffM, type Elevation } from '../../src/canalRecall/facade/elevations.ts';
import { plausibility, PLAUSIBLE_ENOUGH } from '../../src/canalRecall/facade/grammar.ts';
import { measureFacade } from '../../src/canalRecall/facade/measure.ts';
import { rectifyFacade } from '../../src/canalRecall/facade/rectify.ts';
import { GEOID_SEPARATION_M, isLeafOff } from '../../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import type { LngLat, MassingRecord, PanoramaView, ProjectedPoint } from '../../src/canalRecall/facade/sources.ts';

const AREA = AMSTERDAM_GRACHTENGORDEL_WEST;
const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
const STORE = path.join(STAGING, 'measured-facades.json');
const arg = (name: string) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const PANORAMA_BUDGET = Number(arg('panoramas') ?? 40);
const fresh = process.argv.includes('--fresh');

export interface MeasuredFacade {
  pandId: string;
  panoramaId: string;
  capturedAt: string;
  standoffM: number;
  obliquityDeg: number;
  wall: [number, number, number, number];
  wallWidthM: number;
  wallRgb: [number, number, number] | null;
  storeyBands: number;
  storeyIntervalsM: number[];
  /** How much this reading looks like a façade rather than a tree. */
  plausibility: number;
  plausibilityFailures: string[];
  obstructionColumns: number;
  bays: number;
  bayOffsetsM: number[];
  openings: Array<{ xM: number; yM: number; widthM: number; heightM: number }>;
}

const registry = JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-registry.json`), 'utf8')).data as
  Array<{ buildingId: string; footprintLngLat: LngLat[] }>;
const views = JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-panoramas.json`), 'utf8')).data as PanoramaView[];
const recon = JSON.parse(await readFile(path.join(STAGING, 'recon.json'), 'utf8'));
const massing = new Map<string, MassingRecord>(recon.massing.map((m: MassingRecord) => [m.buildingId, m]));
const plotWidths = new Map<string, number>(recon.buildings.map((b: any) => [b.buildingId, b.plotWidthM]));
const inArea = new Set<string>(recon.buildings.map((b: any) => b.buildingId));

const footprints = new Map<string, ProjectedPoint[]>();
for (const entry of registry) {
  if (!inArea.has(entry.buildingId) || footprints.has(entry.buildingId)) continue;
  footprints.set(entry.buildingId, entry.footprintLngLat.map(p => RD_NEW.fromLngLat(p)));
}

// Leaf-off poses only, indexed on a coarse grid so the assignment below is not
// 3,025 × 140,000.
const posed = views.filter(v => isLeafOff(v.capturedAt)).map(view => ({ view, point: RD_NEW.fromLngLat(view.lngLat) }));
const CELL = 50;
const poseIndex = new Map<string, typeof posed>();
for (const pose of posed) {
  const key = `${Math.floor(pose.point.x / CELL)},${Math.floor(pose.point.y / CELL)}`;
  (poseIndex.get(key) ?? poseIndex.set(key, []).get(key)!).push(pose);
}
console.log(`${footprints.size} buildings, ${posed.length} leaf-off panorama poses`);

/** The front wall — the plot-width-sized elevation with the most public exposure. */
function frontWall(buildingId: string): Elevation | null {
  const plotWidthM = plotWidths.get(buildingId) ?? 0;
  if (!plotWidthM) return null;
  let best: { wall: Elevation; exposure: number } | null = null;
  for (const wall of buildElevations(footprints.get(buildingId)!)) {
    if (Math.abs(wall.lengthM - plotWidthM) / plotWidthM > 0.35) continue;
    let exposure = 0;
    const reach = Math.ceil(35 / CELL);
    const cx = Math.floor(wall.midpoint.x / CELL), cy = Math.floor(wall.midpoint.y / CELL);
    for (let dx = -reach; dx <= reach; dx++) for (let dy = -reach; dy <= reach; dy++) {
      for (const pose of poseIndex.get(`${cx + dx},${cy + dy}`) ?? []) {
        if (!inFrontOf(wall, pose.point)) continue;
        const so = standoffM(wall, pose.point);
        if (so < 3 || so > 35 || obliquityDeg(wall, pose.point) > 60) continue;
        exposure++;
      }
    }
    if (!best || exposure > best.exposure) best = { wall, exposure };
  }
  return best && best.exposure > 0 ? best.wall : null;
}

/**
 * Every acceptable view of a wall, best first, capped.
 *
 * The cap is what keeps the set cover tractable: a wall on a canal has hundreds
 * of usable views and the difference between the 5th and the 200th is
 * negligible, so only the shortlist competes.
 */
function acceptableViews(wall: Elevation, limit = 24) {
  const found: Array<{ pose: typeof posed[number]; standoff: number; obliquity: number; score: number }> = [];
  const reach = Math.ceil(48 / CELL);
  const cx = Math.floor(wall.midpoint.x / CELL), cy = Math.floor(wall.midpoint.y / CELL);
  for (let dx = -reach; dx <= reach; dx++) for (let dy = -reach; dy <= reach; dy++) {
    for (const pose of poseIndex.get(`${cx + dx},${cy + dy}`) ?? []) {
      if (!inFrontOf(wall, pose.point)) continue;
      const standoff = standoffM(wall, pose.point);
      const obliquity = obliquityDeg(wall, pose.point);
      if (standoff < Math.max(8, wall.lengthM * 1.5) || standoff > 48 || obliquity > 20) continue;
      found.push({ pose, standoff, obliquity, score: obliquity * 0.8 - 1250 / standoff });
    }
  }
  return found.sort((a, b) => a.score - b.score).slice(0, limit);
}

let store: Record<string, MeasuredFacade> = {};
if (!fresh) {
  try { store = JSON.parse(await readFile(STORE, 'utf8')).facades; } catch { store = {}; }
}
console.log(`${Object.keys(store).length} already measured`);

// Shortlist every unmeasured building's acceptable views, then cover them with
// as few images as possible.
type Job = { pandId: string; wall: Elevation; standoff: number; obliquity: number };
const candidates = new Map<string, Array<{ pandId: string; wall: Elevation; standoff: number; obliquity: number; pose: typeof posed[number] }>>();
let noWall = 0, noView = 0, buildingsPending = 0;
for (const pandId of footprints.keys()) {
  if (store[pandId]) continue;
  const wall = frontWall(pandId);
  if (!wall) { noWall++; continue; }
  const views = acceptableViews(wall);
  if (!views.length) { noView++; continue; }
  buildingsPending++;
  for (const view of views) {
    const key = view.pose.view.panoramaId;
    (candidates.get(key) ?? candidates.set(key, []).get(key)!)
      .push({ pandId, wall, standoff: view.standoff, obliquity: view.obliquity, pose: view.pose });
  }
}
console.log(`${buildingsPending} buildings to measure, ${candidates.size} panoramas could serve them`);
console.log(`  skipped: ${noWall} with no plot-width frontage, ${noView} with no square-on leaf-off view`);

/**
 * Greedy set cover. Repeatedly take the image that still serves the most
 * unclaimed buildings. Optimal cover is NP-hard; greedy is within a log factor
 * and the gap does not matter next to the download it saves.
 */
const claimed = new Set<string>();
const plan: Array<{ panoramaId: string; pose: typeof posed[number]; jobs: Job[] }> = [];
while (plan.length < PANORAMA_BUDGET) {
  let best: { key: string; jobs: Job[]; pose: typeof posed[number] } | null = null;
  for (const [key, entries] of candidates) {
    const jobs = entries.filter(e => !claimed.has(e.pandId));
    if (!jobs.length) continue;
    if (!best || jobs.length > best.jobs.length) best = { key, jobs, pose: jobs[0].pose };
  }
  if (!best) break;
  for (const job of best.jobs) claimed.add(job.pandId);
  plan.push({ panoramaId: best.key, pose: best.pose, jobs: best.jobs });
  candidates.delete(best.key);
}
const planned = plan.reduce((sum, p) => sum + p.jobs.length, 0);
console.log(`  plan: ${planned} buildings from ${plan.length} images — ${(planned / Math.max(1, plan.length)).toFixed(1)} per image\n`);

async function panorama(view: PanoramaView) {
  const file = path.join(CACHE, 'panoramas', `${view.panoramaId}.jpg`);
  let bytes: Buffer;
  try { bytes = await readFile(file); } catch {
    const response = await fetch(view.imageUrl, { headers: { 'User-Agent': 'MapRecallFacadeTwin/1.0' }, signal: AbortSignal.timeout(120_000) });
    if (!response.ok) return null;
    bytes = Buffer.from(await response.arrayBuffer());
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
  }
  const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
  return { width: decoded.width, height: decoded.height, data: decoded.data };
}

function sampleWall(rect: { width: number; height: number; data: Uint8ClampedArray }, openings: Array<{ xM: number; yM: number; widthM: number; heightM: number }>, ppm: number): [number, number, number] {
  const blocked = new Uint8Array(rect.width * rect.height);
  for (const o of openings) {
    const x0 = Math.max(0, Math.round((o.xM - 0.25) * ppm)), x1 = Math.min(rect.width - 1, Math.round((o.xM + o.widthM + 0.25) * ppm));
    const y1 = Math.min(rect.height - 1, Math.round(rect.height - (o.yM - 0.25) * ppm));
    const y0 = Math.max(0, Math.round(rect.height - (o.yM + o.heightM + 0.25) * ppm));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) blocked[y * rect.width + x] = 1;
  }
  const channels: number[][] = [[], [], []];
  for (let y = Math.floor(rect.height * 0.12); y < rect.height * 0.88; y++) {
    for (let x = 0; x < rect.width; x++) {
      if (blocked[y * rect.width + x]) continue;
      const i = (y * rect.width + x) * 4;
      channels[0].push(rect.data[i]); channels[1].push(rect.data[i + 1]); channels[2].push(rect.data[i + 2]);
    }
  }
  // Upper percentile: lit brick, not the shadow beside it. See build-block.ts.
  return channels.map(v => { if (!v.length) return 128; v.sort((a, b) => a - b); return v[Math.floor(v.length * 0.72)]; }) as [number, number, number];
}

let images = 0, measured = 0, failed = 0, rejected = 0;
const rejectionReasons: string[] = [];
for (const { panoramaId, pose: planPose, jobs } of plan) {
  const entry = { pose: planPose, jobs };
  const image = await panorama(entry.pose.view);
  images++;
  if (!image) { failed += entry.jobs.length; continue; }

  for (const job of entry.jobs) {
    const mass = massing.get(job.pandId);
    const ground = mass?.groundLevel ?? null;
    const eaves = mass?.eavesHeight ?? null;
    if (ground === null || eaves === null || eaves <= ground) { failed++; continue; }

    const ppm = Math.min(60, Math.max(24, 1250 / job.standoff));
    const rect = rectifyFacade(image, {
      x: entry.pose.point.x, y: entry.pose.point.y, z: entry.pose.view.cameraHeight - GEOID_SEPARATION_M,
      headingDeg: entry.pose.view.headingDeg, pitchDeg: entry.pose.view.pitchDeg, rollDeg: entry.pose.view.rollDeg,
    }, { start: job.wall.start, end: job.wall.end, baseZ: ground - 0.4, topZ: eaves + 0.3 }, { pixelsPerMetre: ppm });

    const m = measureFacade(rect, { pixelsPerMetre: rect.pixelsPerMetre });
    // Is this a façade at all? The reference sheet showed that low obliquity and
    // short standoff are not enough: several such readings were of canal elms.
    const verdict = plausibility({
      wallWidthM: job.wall.lengthM,
      eavesHeightM: eaves - ground,
      declaredStoreys: mass?.storeys ?? null,
      storeyBands: m.storeys.length,
      storeyIntervalsM: m.storeyHeightsM,
      bays: m.bays,
      openings: m.openings,
    });
    if (verdict.score < PLAUSIBLE_ENOUGH) { rejected++; rejectionReasons.push(...verdict.failures); continue; }
    store[job.pandId] = {
      pandId: job.pandId,
      panoramaId, capturedAt: entry.pose.view.capturedAt,
      standoffM: Number(job.standoff.toFixed(1)), obliquityDeg: Number(job.obliquity.toFixed(1)),
      wall: [job.wall.start.x, job.wall.start.y, job.wall.end.x, job.wall.end.y],
      wallWidthM: Number(job.wall.lengthM.toFixed(2)),
      wallRgb: m.openings.length ? sampleWall(rect, m.openings, rect.pixelsPerMetre) : null,
      storeyBands: m.storeys.length,
      storeyIntervalsM: m.storeyHeightsM,
      plausibility: Number(verdict.score.toFixed(2)),
      plausibilityFailures: verdict.failures,
      obstructionColumns: m.obstructionColumns,
      bays: m.bays, bayOffsetsM: m.bayOffsetsM,
      openings: m.openings.map(o => ({
        xM: Number(o.xM.toFixed(2)), yM: Number(o.yM.toFixed(2)),
        widthM: Number(o.widthM.toFixed(2)), heightM: Number(o.heightM.toFixed(2)),
      })),
    };
    measured++;
  }

  if (images % 5 === 0 || images === plan.length) {
    await mkdir(STAGING, { recursive: true });
    await writeFile(STORE, JSON.stringify({
      metadata: {
        generatedAt: new Date().toISOString(),
        generator: 'scripts/facade-twin/measure-boundary.ts',
        attribution: '© Gemeente Amsterdam, Kernregistratie Panoramabeelden (CC BY 4.0)',
        measured: Object.keys(store).length,
        caveat: 'Unvalidated. The registration check is red and no field has been checked against a hand-labelled building; downstream these must stay below auto-accept confidence.',
      },
      facades: store,
    }));
    process.stdout.write(`\r  ${images}/${plan.length} images — ${Object.keys(store).length} buildings measured`);
  }
}
process.stdout.write('\n');

const all = Object.values(store);
const withOpenings = all.filter(f => f.openings.length > 0);
console.log(`\n${rejected} readings rejected as not façades`);
if (rejectionReasons.length) {
  const counts = new Map<string, number>();
  for (const reason of rejectionReasons) {
    const key = reason.replace(/[\d.]+/g, 'N');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const [reason, n] of [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)) console.log(`  ${String(n).padStart(4)}  ${reason}`);
}
console.log(`\n${all.length} buildings measured in total (${(100 * all.length / footprints.size).toFixed(1)}% of the boundary)`);
console.log(`  ${withOpenings.length} with at least one opening, ${all.reduce((s, f) => s + f.openings.length, 0)} openings total`);
if (withOpenings.length) {
  const bands = withOpenings.map(f => f.storeyBands).sort((a, b) => a - b);
  const bays = withOpenings.map(f => f.bays).sort((a, b) => a - b);
  console.log(`  storey bands  p25 ${bands[Math.floor(bands.length * 0.25)]}  p50 ${bands[Math.floor(bands.length / 2)]}  p75 ${bands[Math.floor(bands.length * 0.75)]}`);
  console.log(`  bays          p25 ${bays[Math.floor(bays.length * 0.25)]}  p50 ${bays[Math.floor(bays.length / 2)]}  p75 ${bays[Math.floor(bays.length * 0.75)]}`);
}
console.log(`\nwrote ${path.relative(process.cwd(), STORE)}`);
