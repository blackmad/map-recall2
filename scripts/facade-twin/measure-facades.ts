/**
 * Measure façades from the rectified panoramas, and draw what was found.
 *
 * Usage:
 *   npx tsx scripts/facade-twin/measure-facades.ts --ids=<pandId>[,<pandId>...]
 *
 * For each building: rectify its own plot width square-on from a leaf-off
 * panorama, find the openings, group them into storeys and bays, and write an
 * annotated image alongside the numbers. The drawing is not decoration — a
 * measurement that cannot be checked against the photograph it came from is not
 * reviewable, and the brief requires every field to be traceable to an
 * observation of *this* building.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { AMSTERDAM_GRACHTENGORDEL_WEST } from '../../src/canalRecall/facade/areas.ts';
import { buildElevations, inFrontOf, obliquityDeg, standoffM } from '../../src/canalRecall/facade/elevations.ts';
import { measureFacade } from '../../src/canalRecall/facade/measure.ts';
import { rectifyFacade, type CameraPose } from '../../src/canalRecall/facade/rectify.ts';
import { GEOID_SEPARATION_M, isLeafOff } from '../../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import type { LngLat, PanoramaView, ProjectedPoint } from '../../src/canalRecall/facade/sources.ts';

const AREA = AMSTERDAM_GRACHTENGORDEL_WEST;
const CACHE = path.resolve('.cache/facade-twin');
const OUT = path.join(CACHE, 'measured');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
const arg = (name: string) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const PX_PER_M = 60;

const registry = JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-registry.json`), 'utf8')).data as
  Array<{ buildingId: string; footprintLngLat: LngLat[] }>;
const views = JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-panoramas.json`), 'utf8')).data as PanoramaView[];
const recon = JSON.parse(await readFile(path.join(STAGING, 'recon.json'), 'utf8'));
const massing = new Map<string, any>(recon.massing.map((m: any) => [m.buildingId, m]));
const plotWidths = new Map<string, number>(recon.buildings.map((b: any) => [b.buildingId, b.plotWidthM]));
const heritage = new Map<string, any>();
for (const h of recon.heritage) if (h.buildingId && h.description) heritage.set(h.buildingId, h);

const footprints = new Map<string, ProjectedPoint[]>();
for (const entry of registry) {
  if (!footprints.has(entry.buildingId)) footprints.set(entry.buildingId, entry.footprintLngLat.map(p => RD_NEW.fromLngLat(p)));
}
const posed = views.map(view => ({ view, point: RD_NEW.fromLngLat(view.lngLat) }));

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

/**
 * Which wall is the front, and the best view of it.
 *
 * Deciding the front from view *quality* keeps going wrong — it picks whichever
 * wall happens to have a squarer or closer camera, which on a corner plot is a
 * side elevation and in an alley is a party wall. The reliable signal is much
 * blunter: a survey car drives on streets and quays and never through a
 * courtyard, so the wall with the most cameras standing in front of it at all
 * is the public frontage. Quality then chooses among that wall's own views.
 */
function frontage(buildingId: string) {
  const walls = buildElevations(footprints.get(buildingId)!);
  const plotWidthM = plotWidths.get(buildingId) ?? 0;
  if (!plotWidthM) return null;
  let front: { wall: typeof walls[number]; exposure: number } | null = null;
  for (const wall of walls) {
    let exposure = 0;
    for (const pose of posed) {
      if (Math.abs(pose.point.x - wall.midpoint.x) > 35 || Math.abs(pose.point.y - wall.midpoint.y) > 35) continue;
      if (!inFrontOf(wall, pose.point)) continue;
      const standoff = standoffM(wall, pose.point);
      if (standoff < 3 || standoff > 35) continue;
      if (obliquityDeg(wall, pose.point) > 60) continue;
      exposure++;
    }
    /**
     * A canal house's front is the *short* side of its plot.
     *
     * The plot is narrow and deep — 5.7 m across the median frontage against
     * thirty or more of depth — so the long walls are party walls running back
     * into the block, however many cameras have driven past their far end. BAG
     * already gives the width exactly, via the short side of the footprint's
     * minimum-area rectangle, so a wall is only a candidate frontage if its
     * length is close to it. This is the constraint the earlier heuristics kept
     * having to guess at, and it was measured all along.
     */
    const fit = Math.abs(wall.lengthM - plotWidthM) / Math.max(plotWidthM, 1);
    if (fit > 0.35) continue;
    const weighted = exposure * (1 - fit);
    if (!front || weighted > front.exposure) front = { wall, exposure: weighted };
  }
  if (!front) return null;

  const wall = front.wall;
  let best: { wall: typeof walls[number]; pose: typeof posed[number]; standoff: number; obliquity: number; score: number } | null = null;
  for (const pose of posed) {
    if (Math.abs(pose.point.x - wall.midpoint.x) > 60 || Math.abs(pose.point.y - wall.midpoint.y) > 60) continue;
    if (!inFrontOf(wall, pose.point)) continue;
    const standoff = standoffM(wall, pose.point);
    const obliquity = obliquityDeg(wall, pose.point);
    if (standoff < Math.max(8, wall.lengthM * 1.5) || standoff > 48) continue;
    if (obliquity > 20 || !isLeafOff(pose.view.capturedAt)) continue;
    /**
     * Resolution and squareness trade against each other. An 8000 px
     * equirectangular gives about 1250 px per radian, so a façade 12 m away
     * resolves at ~100 px/m and the same façade at 45 m at ~28 px/m. Glazing
     * bars are centimetres wide. Ten degrees off square costs 1.5% of measured
     * width and is recoverable; a third of the resolution loses the bars.
     */
    const pixelsPerMetre = 1250 / standoff;
    const score = obliquity * 0.8 - pixelsPerMetre;
    if (!best || score < best.score) best = { wall, pose, standoff, obliquity, score };
  }
  return best;
}

const box = (data: Uint8ClampedArray, width: number, height: number, x0: number, y0: number, x1: number, y1: number, colour: [number, number, number], thickness = 2) => {
  const put = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 4;
    data[i] = colour[0]; data[i + 1] = colour[1]; data[i + 2] = colour[2];
  };
  for (let t = 0; t < thickness; t++) {
    for (let x = x0; x <= x1; x++) { put(x, y0 + t); put(x, y1 - t); }
    for (let y = y0; y <= y1; y++) { put(x0 + t, y); put(x1 - t, y); }
  }
};

const ids = (arg('ids') ?? '').split(',').filter(Boolean);
if (!ids.length) throw new Error('pass --ids=<pandId>[,<pandId>...]');

await mkdir(OUT, { recursive: true });
const results = [];
for (const buildingId of ids) {
  if (!footprints.has(buildingId)) { console.log(`${buildingId}: not in area`); continue; }
  const found = frontage(buildingId);
  if (!found) { console.log(`${buildingId}: no square-on leaf-off view`); continue; }
  const { wall, pose } = found;
  const image = await panorama(pose.view);
  if (!image) { console.log(`${buildingId}: imagery unavailable`); continue; }

  const mass = massing.get(buildingId);
  const ground = mass?.groundLevel ?? 1;
  const eaves = mass?.eavesHeight ?? ground + 12;
  // Measure the wall below the eaves: that is where openings live, and it keeps
  // the roof's dark slates out of the dark-region search.
  //
  // The base was `ground - 0.4`, and 40 cm is not enough. A canal house is
  // entered up a stoep, and the storey the stoep steps over is a souterrain
  // whose windows sit roughly 0.8–1.6 m *below* street level. At 40 cm the
  // strip's bottom edge cut straight through them, so every souterrain opening
  // ran off the bottom of the image and the detector clamped it to the edge:
  // 1,020 of 10,335 openings across the pilot came out at a sill of exactly
  // -0.40 m, which is not a measurement, it is the picture running out. The
  // front door went the same way, being the other thing that reaches the
  // ground — 1,213 of 1,340 measured façades had no door-shaped opening at all.
  //
  // 1.8 m clears the deepest souterrain sill in the fabric and takes in the
  // stoep with it. It costs a taller strip and some quay wall at the bottom,
  // which the detector's own plausibility test already rejects.
  const baseZ = ground - STRIP_BASE_BELOW_GROUND_M, topZ = eaves + 0.3;

  const rect = rectifyFacade(image, {
    x: pose.point.x, y: pose.point.y, z: pose.view.cameraHeight - GEOID_SEPARATION_M,
    headingDeg: pose.view.headingDeg, pitchDeg: pose.view.pitchDeg, rollDeg: pose.view.rollDeg,
  } satisfies CameraPose, { start: wall.start, end: wall.end, baseZ, topZ },
    // Do not invent pixels: sample at what the panorama holds at this range,
    // capped so a very close view does not produce an enormous strip.
    { pixelsPerMetre: Math.min(PX_PER_M, Math.max(24, 1250 / found.standoff)) });

  const measurement = measureFacade(rect, { pixelsPerMetre: rect.pixelsPerMetre });
  const ppm = rect.pixelsPerMetre;

  for (const opening of measurement.openings) {
    const x0 = Math.round(opening.xM * ppm), x1 = Math.round((opening.xM + opening.widthM) * ppm);
    const y1 = Math.round(rect.height - opening.yM * ppm);
    const y0 = Math.round(y1 - opening.heightM * ppm);
    box(rect.data, rect.width, rect.height, x0, y0, x1, y1, opening.yM < 0.6 ? [255, 190, 0] : [40, 230, 120]);
  }
  for (const storey of measurement.storeys) {
    const y = Math.round(rect.height - storey.centreM * ppm);
    for (let x = 0; x < rect.width; x++) {
      if (Math.floor(x / 9) % 2) continue;
      const i = (y * rect.width + x) * 4;
      rect.data[i] = 90; rect.data[i + 1] = 170; rect.data[i + 2] = 255;
    }
  }

  const encoded = jpeg.encode({ width: rect.width, height: rect.height, data: Buffer.from(rect.data) }, 90);
  const file = path.join(OUT, `${buildingId}.jpg`);
  await writeFile(file, encoded.data);

  const listing = heritage.get(buildingId);
  console.log(`\n${buildingId}  wall ${wall.lengthM.toFixed(2)} m, view ${found.standoff.toFixed(0)} m at ${found.obliquity.toFixed(1)}°, ${pose.view.capturedAt.slice(0, 10)}`);
  console.log(`  ${measurement.openings.length} openings · ${measurement.bays} bays at ${measurement.bayOffsetsM.join(', ')} m`);
  console.log(`  ${measurement.storeys.length} storey bands · heights ${measurement.storeyHeightsM.join(', ') || '—'} m`);
  console.log(`  ${measurement.groundOpenings.length} reaching the ground (door or shopfront)`);
  console.log(`  3DBAG says ${mass?.storeys ?? '—'} storeys; register says: ${listing ? listing.description.slice(0, 90) : '—'}`);
  console.log(`  → ${path.relative(process.cwd(), file)}`);

  results.push({
    buildingId, wallWidthM: Number(wall.lengthM.toFixed(2)),
    panoramaId: pose.view.panoramaId, capturedAt: pose.view.capturedAt,
    obliquityDeg: Number(found.obliquity.toFixed(1)), standoffM: Number(found.standoff.toFixed(1)),
    bays: measurement.bays, bayOffsetsM: measurement.bayOffsetsM,
    storeyBands: measurement.storeys.length, storeyHeightsM: measurement.storeyHeightsM,
    openings: measurement.openings.length, groundOpenings: measurement.groundOpenings.length,
    massingStoreys: mass?.storeys ?? null,
    registerSays: listing?.description ?? null,
  });
}

await writeFile(path.join(OUT, 'measurements.json'), JSON.stringify({
  attribution: '© Gemeente Amsterdam, Kernregistratie Panoramabeelden (CC BY 4.0)',
  generatedAt: new Date().toISOString(),
  pixelsPerMetre: PX_PER_M,
  measurements: results,
}, null, 2));
console.log(`\nwrote ${path.relative(process.cwd(), path.join(OUT, 'measurements.json'))}`);
