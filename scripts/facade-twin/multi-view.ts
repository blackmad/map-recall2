/**
 * Rectify each façade from several panoramas, not one.
 *
 * The pipeline has always picked the single best view of a wall and measured
 * that. It is the obvious thing and it caps what can ever be measured, because
 * the survey car photographs a canal from twenty to forty metres across the
 * water and the part of the wall it reliably cannot see is the bottom three
 * metres — which is where the front door is. Across 1,821 façades, 977 had
 * their ground storey more than 40% behind parked cars and bicycles. No
 * detector fixes that. A different photograph does.
 *
 * A car parked in front of a door in January's pass is not there in March's,
 * and the poses file already holds every panorama that ever saw each wall; the
 * pipeline simply threw all but one away. So: take the best few, rectify each
 * onto the same wall plane, and let the downstream merge choose per storey
 * rather than per building.
 *
 * The second reason is worth as much as the first. Two views of one wall are an
 * independent check on registration, which this project has never had. If two
 * panoramas taken from different places at different times both put a window at
 * 3.2 m along the wall, the wall is where we think it is. If they disagree by a
 * metre, something upstream is wrong and no amount of careful measurement of
 * either will reveal it. That is precisely the class of error — a confident,
 * well-formed picture of the wrong thing — that went undetected for the whole
 * project until someone looked at a contact sheet.
 *
 * Views are spread deliberately rather than taken by score alone: the top three
 * by quality are usually three frames from one drive-past, seconds apart, which
 * agree with each other because they share every mistake. Different capture
 * dates and different standoffs are what make the second opinion worth having.
 *
 * Usage:
 *   npx tsx scripts/facade-twin/multi-view.ts --limit=200 [--views=3]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { AMSTERDAM_GRACHTENGORDEL_WEST } from '../../src/canalRecall/facade/areas.ts';
import { buildElevations, inFrontOf, obliquityDeg, standoffM } from '../../src/canalRecall/facade/elevations.ts';
import { STRIP_BASE_BELOW_GROUND_M, MAX_PIXELS_PER_METRE, MIN_PIXELS_PER_METRE } from '../../src/canalRecall/facade/measure.ts';
import { rectifyFacade, type CameraPose } from '../../src/canalRecall/facade/rectify.ts';
import { AMSTERDAM_YAW_CONVENTION, GEOID_SEPARATION_M, isLeafOff } from '../../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import type { LngLat, PanoramaView, ProjectedPoint } from '../../src/canalRecall/facade/sources.ts';

const AREA = AMSTERDAM_GRACHTENGORDEL_WEST;
const CACHE = path.resolve('.cache/facade-twin');
const OUT = path.join(CACHE, 'strips-multi');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
const arg = (name: string) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const VIEWS = Number(arg('views') ?? 3);

const registry = JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-registry.json`), 'utf8')).data as
  Array<{ buildingId: string; footprintLngLat: LngLat[] }>;
const views = JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-panoramas.json`), 'utf8')).data as PanoramaView[];
const recon = JSON.parse(await readFile(path.join(STAGING, 'recon.json'), 'utf8'));
const massing = new Map<string, { groundLevel?: number; eavesHeight?: number }>(
  recon.massing.map((m: { buildingId: string }) => [m.buildingId, m]));
const store = JSON.parse(await readFile(path.join(STAGING, 'measured-facades.json'), 'utf8')) as
  { facades: Record<string, { pandId: string; wall: [number, number, number, number] }> };

const footprints = new Map<string, ProjectedPoint[]>();
for (const entry of registry) {
  if (!footprints.has(entry.buildingId)) {
    footprints.set(entry.buildingId, entry.footprintLngLat.map(p => RD_NEW.fromLngLat(p)));
  }
}
const posed = views.filter(v => isLeafOff(v.capturedAt)).map(view => ({ view, point: RD_NEW.fromLngLat(view.lngLat) }));

/**
 * The panorama, fetched if it is not already here.
 *
 * The single-view pipeline only ever needed one image per building, so the
 * cache holds about 1,200 of the 140,000 published poses. Reading cache-only
 * therefore silently reduced multi-view back to single-view — 1.04 strips per
 * façade — which looked like the spread rule being too strict and was really
 * just missing files.
 *
 * Downloads are budgeted rather than unlimited. An equirectangular is ~2.6 MB
 * and the point of this pass is to answer a question about a few hundred
 * buildings, not to mirror the city.
 */
let downloads = 0;
const DOWNLOAD_BUDGET = Number(arg('downloads') ?? 400);
async function panorama(view: PanoramaView) {
  const file = path.join(CACHE, 'panoramas', `${view.panoramaId}.jpg`);
  let bytes: Buffer;
  try {
    bytes = await readFile(file);
  } catch {
    if (downloads >= DOWNLOAD_BUDGET) return null;
    downloads++;
    try {
      const response = await fetch(view.imageUrl, {
        headers: { 'User-Agent': 'MapRecallFacadeTwin/1.0' },
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) return null;
      bytes = Buffer.from(await response.arrayBuffer());
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, bytes);
    } catch { return null; }
  }
  try {
    const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
    return { width: decoded.width, height: decoded.height, data: decoded.data };
  } catch { return null; }
}

/**
 * The best few views of one wall, deliberately spread.
 *
 * Quality alone returns three frames from a single drive-past taken seconds
 * apart. They agree because they share a viewpoint, a moment and every parked
 * car, so they are one observation wearing three hats. Candidates are ranked by
 * quality and then taken greedily under a spread rule: a different capture day,
 * or a camera position at least fifteen metres from any already chosen.
 */
function bestViews(wall: ReturnType<typeof buildElevations>[number]) {
  const candidates = [];
  for (const pose of posed) {
    if (Math.abs(pose.point.x - wall.midpoint.x) > 60 || Math.abs(pose.point.y - wall.midpoint.y) > 60) continue;
    if (!inFrontOf(wall, pose.point)) continue;
    const standoff = standoffM(wall, pose.point);
    const obliquity = obliquityDeg(wall, pose.point);
    if (standoff < Math.max(8, wall.lengthM * 1.2) || standoff > 48) continue;
    if (obliquity > 24) continue;
    candidates.push({ pose, standoff, obliquity, score: obliquity * 0.8 - 1250 / standoff });
  }
  candidates.sort((a, b) => a.score - b.score);

  const chosen: typeof candidates = [];
  for (const candidate of candidates) {
    if (chosen.length >= VIEWS) break;
    const day = candidate.pose.view.capturedAt.slice(0, 10);
    const novel = chosen.every(other =>
      other.pose.view.capturedAt.slice(0, 10) !== day
      || Math.hypot(other.pose.point.x - candidate.pose.point.x,
                    other.pose.point.y - candidate.pose.point.y) > 15);
    if (novel) chosen.push(candidate);
  }
  return chosen;
}

const ids = (arg('ids') ?? '').split(',').filter(Boolean);
const limit = Number(arg('limit') ?? 0);
const measured = Object.keys(store.facades).sort();
const queue = ids.length ? ids
  : limit ? measured.filter((_, i) => i % Math.max(1, Math.floor(measured.length / limit)) === 0).slice(0, limit)
  : measured;

await mkdir(OUT, { recursive: true });
const index: Record<string, Array<{ file: string; panoramaId: string; capturedAt: string; standoffM: number; obliquityDeg: number; pixelsPerMetre: number }>> = {};
let done = 0, single = 0, none = 0;
for (const buildingId of queue) {
  const record = store.facades[buildingId];
  const mass = massing.get(buildingId);
  if (!record || !mass?.groundLevel) { none++; continue; }
  const [x0, y0, x1, y1] = record.wall;
  // Rebuild the elevation from the footprint rather than from the four stored
  // numbers: `inFrontOf` and `standoffM` need the outward normal, and deriving
  // it here would be a second opinion about which side of the wall is outside.
  // The footprint already answers that, and it must be the same answer.
  const footprint = footprints.get(buildingId);
  if (!footprint) { none++; continue; }
  const mid = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
  const wall = buildElevations(footprint)
    .map(e => ({ e, d: Math.hypot(e.midpoint.x - mid.x, e.midpoint.y - mid.y) }))
    .sort((a, b) => a.d - b.d)[0];
  if (!wall || wall.d > 1.5) { none++; continue; }
  const picks = bestViews(wall.e);
  if (!picks.length) { none++; continue; }
  if (picks.length === 1) single++;

  await mkdir(path.join(OUT, buildingId), { recursive: true });
  const written = [];
  for (const [i, pick] of picks.entries()) {
    const image = await panorama(pick.pose.view);
    if (!image) continue;
    const ppm = Math.min(MAX_PIXELS_PER_METRE, Math.max(MIN_PIXELS_PER_METRE, 1250 / pick.standoff));
    const rect = rectifyFacade(image, {
      x: pick.pose.point.x, y: pick.pose.point.y,
      z: pick.pose.view.cameraHeight - GEOID_SEPARATION_M,
      headingDeg: pick.pose.view.headingDeg, pitchDeg: pick.pose.view.pitchDeg,
      rollDeg: pick.pose.view.rollDeg,
    } satisfies CameraPose,
      { start: wall.e.start, end: wall.e.end,
        baseZ: mass.groundLevel - STRIP_BASE_BELOW_GROUND_M,
        topZ: (mass.eavesHeight ?? mass.groundLevel + 12) + 0.3 },
      { pixelsPerMetre: ppm, yaw: AMSTERDAM_YAW_CONVENTION });
    const file = path.join(buildingId, `${i}.jpg`);
    await writeFile(path.join(OUT, file),
      jpeg.encode({ width: rect.width, height: rect.height, data: Buffer.from(rect.data) }, 86).data);
    written.push({
      file, panoramaId: pick.pose.view.panoramaId,
      capturedAt: pick.pose.view.capturedAt.slice(0, 10),
      standoffM: Number(pick.standoff.toFixed(1)),
      obliquityDeg: Number(pick.obliquity.toFixed(1)),
      pixelsPerMetre: Number(rect.pixelsPerMetre.toFixed(1)),
    });
  }
  if (written.length) index[buildingId] = written;
  done++;
  if (done % 25 === 0) process.stdout.write(`\r  ${done}/${queue.length}`);
}
process.stdout.write('\n');

await writeFile(path.join(STAGING, 'multi-view.json'), JSON.stringify({
  metadata: {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/facade-twin/multi-view.ts',
    attribution: '© Gemeente Amsterdam, Kernregistratie Panoramabeelden (CC BY 4.0)',
    viewsRequested: VIEWS,
    stripDirectory: '.cache/facade-twin/strips-multi',
    note: 'Several rectifications of the same wall from different panoramas. Views are spread '
      + 'across capture dates and camera positions, because three frames from one drive-past '
      + 'agree with each other by sharing their mistakes.',
  },
  facades: index,
}, null, 1));

const counts = Object.values(index).map(v => v.length);
const total = counts.reduce((a, b) => a + b, 0);
console.log(`${Object.keys(index).length} façades, ${total} strips (${(total / Math.max(counts.length, 1)).toFixed(2)} per façade)`);
console.log(`  with ${VIEWS} views: ${counts.filter(c => c >= VIEWS).length}`);
console.log(`  with 2 views     : ${counts.filter(c => c === 2).length}`);
console.log(`  only one view    : ${counts.filter(c => c === 1).length}`);
console.log(`  no usable view   : ${none}`);
console.log(`  panoramas fetched: ${downloads} of a ${DOWNLOAD_BUDGET} budget`);
