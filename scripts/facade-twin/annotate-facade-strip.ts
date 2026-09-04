/**
 * Rectify a stretch of quay and draw BAG's party walls on top of it.
 *
 * The decisive registration test, and the one that needs no correlation
 * heuristic: BAG knows exactly where each building's plot boundaries are. If
 * the projection is registered, the vertical breaks between neighbouring houses
 * in the image land on the plot boundaries drawn from the register. If it is
 * shifted, every tick sits the same distance off every house division, and that
 * distance is the correction.
 *
 * This is the same logic the build prompt uses for measurement itself — scale
 * from the one dimension already known exactly — turned around and used to
 * check the projection instead of the building.
 *
 * Usage: npx tsx scripts/facade-twin/annotate-facade-strip.ts --id=<pandId> [--span=40]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { AMSTERDAM_GRACHTENGORDEL_WEST } from '../../src/canalRecall/facade/areas.ts';
import { buildElevations, inFrontOf, obliquityDeg, standoffM } from '../../src/canalRecall/facade/elevations.ts';
import { rectifyFacade, type CameraPose, type EquirectangularImage, type YawConvention } from '../../src/canalRecall/facade/rectify.ts';
import { GEOID_SEPARATION_M, isLeafOff } from '../../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import { skyline, skylineSteps } from '../../src/canalRecall/facade/skyline.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import type { LngLat, PanoramaView, ProjectedPoint } from '../../src/canalRecall/facade/sources.ts';

const AREA = AMSTERDAM_GRACHTENGORDEL_WEST;
const CACHE = path.resolve('.cache/facade-twin');
const OUT = path.join(CACHE, 'rectified');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
const arg = (name: string) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3);

const targetId = arg('id') ?? '0363100012165026';
const SPAN_M = Number(arg('span') ?? 40);
const PX_PER_M = 55;
const yaw = (arg('yaw') as YawConvention) ?? 'centre';
const MIN_STANDOFF = Number(arg('min-standoff') ?? 4);
const MAX_STANDOFF = Number(arg('max-standoff') ?? 30);
const MAX_OBLIQUITY = Number(arg('max-obliquity') ?? 20);
const headingSign = Number(arg('heading-sign') ?? 1);
const yawOffset = Number(arg('yaw-offset') ?? 0);

const registry = JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-registry.json`), 'utf8')).data as
  Array<{ buildingId: string; footprintLngLat: LngLat[] }>;
const views = JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-panoramas.json`), 'utf8')).data as PanoramaView[];
const recon = JSON.parse(await readFile(path.join(STAGING, 'recon.json'), 'utf8'));
const massing = new Map<string, any>(recon.massing.map((m: any) => [m.buildingId, m]));

const footprints = new Map<string, ProjectedPoint[]>();
for (const entry of registry) {
  if (!footprints.has(entry.buildingId)) footprints.set(entry.buildingId, entry.footprintLngLat.map(p => RD_NEW.fromLngLat(p)));
}
const posed = views.map(view => ({ view, point: RD_NEW.fromLngLat(view.lngLat) }));

const target = footprints.get(targetId);
if (!target) throw new Error(`${targetId} not in area`);

// The target's street frontage, and the closest square-on leaf-off view of it.
const walls = buildElevations(target);
let chosen: { wall: typeof walls[number]; pose: typeof posed[number]; standoff: number; obliquity: number } | null = null;
for (const wall of walls) {
  for (const pose of posed) {
    if (Math.abs(pose.point.x - wall.midpoint.x) > 60 || Math.abs(pose.point.y - wall.midpoint.y) > 60) continue;
    if (!inFrontOf(wall, pose.point)) continue;
    const standoff = standoffM(wall, pose.point);
    const obliquity = obliquityDeg(wall, pose.point);
    if (standoff < MIN_STANDOFF || standoff > MAX_STANDOFF || obliquity > MAX_OBLIQUITY || !isLeafOff(pose.view.capturedAt)) continue;
    // Squarest view wins, not nearest: obliquity is what shears the strip.
    if (!chosen || obliquity < chosen.obliquity) chosen = { wall, pose, standoff, obliquity };
  }
}
if (!chosen) throw new Error(`no close leaf-off view of ${targetId}`);
const { wall, pose } = chosen;
console.log(`${targetId}: wall ${wall.lengthM.toFixed(2)} m, view ${chosen.standoff.toFixed(1)} m away at ${chosen.obliquity.toFixed(1)}°, ${pose.view.capturedAt.slice(0, 10)}`);

// The wall's infinite line, as an origin and a unit direction.
const len = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
const ux = (wall.end.x - wall.start.x) / len, uy = (wall.end.y - wall.start.y) / len;
const centre = wall.midpoint;
const along = (p: ProjectedPoint) => (p.x - centre.x) * ux + (p.y - centre.y) * uy;
const offLine = (p: ProjectedPoint) => Math.abs((p.x - centre.x) * wall.normal.x + (p.y - centre.y) * wall.normal.y);

/**
 * Party-wall positions: footprint vertices from any building whose front sits
 * on this same building line. A neighbour's front corners are its party walls,
 * and in a terrace they are exactly the vertical breaks a photograph shows.
 */
const ticks: Array<{ at: number; buildingId: string }> = [];
for (const [buildingId, footprint] of footprints) {
  for (const vertex of footprint) {
    const a = along(vertex);
    if (Math.abs(a) > SPAN_M / 2) continue;
    if (offLine(vertex) > 1.2) continue;     // must be on the building line, not a rear corner
    ticks.push({ at: a, buildingId });
  }
}
ticks.sort((a, b) => a.at - b.at);
// Collapse coincident corners: neighbours share a party wall and each records it.
const merged: typeof ticks = [];
for (const tick of ticks) {
  if (merged.length && Math.abs(merged[merged.length - 1].at - tick.at) < 0.35) continue;
  merged.push(tick);
}
console.log(`${merged.length} plot boundaries from BAG within the ${SPAN_M} m strip`);

const file = path.join(CACHE, 'panoramas', `${pose.view.panoramaId}.jpg`);
let bytes: Buffer;
try { bytes = await readFile(file); } catch {
  const response = await fetch(pose.view.imageUrl, { headers: { 'User-Agent': 'MapRecallFacadeTwin/1.0' }, signal: AbortSignal.timeout(120_000) });
  bytes = Buffer.from(await response.arrayBuffer());
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
}
const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
const image: EquirectangularImage = { width: decoded.width, height: decoded.height, data: decoded.data };

const cameraPose: CameraPose = {
  x: pose.point.x, y: pose.point.y, z: pose.view.cameraHeight - GEOID_SEPARATION_M,
  headingDeg: pose.view.headingDeg * headingSign + yawOffset,
  pitchDeg: pose.view.pitchDeg, rollDeg: pose.view.rollDeg,
};
const ground = massing.get(targetId)?.groundLevel ?? 1;
const ridge = massing.get(targetId)?.ridgeHeight ?? 16;
const rect = rectifyFacade(image, cameraPose, {
  start: { x: centre.x - ux * (SPAN_M / 2), y: centre.y - uy * (SPAN_M / 2) },
  end: { x: centre.x + ux * (SPAN_M / 2), y: centre.y + uy * (SPAN_M / 2) },
  baseZ: ground + 4, topZ: ridge + 7,
}, { pixelsPerMetre: PX_PER_M, yaw });

// Draw the register's boundaries over the photograph.
const paint = (x: number, colour: [number, number, number], width: number) => {
  for (let dx = -Math.floor(width / 2); dx <= Math.floor(width / 2); dx++) {
    const px = Math.round(x) + dx;
    if (px < 0 || px >= rect.width) continue;
    for (let y = 0; y < rect.height; y++) {
      // Dashed, so the façade underneath stays readable.
      if (Math.floor(y / 14) % 2 === 0) continue;
      const offset = (y * rect.width + px) * 4;
      rect.data[offset] = colour[0]; rect.data[offset + 1] = colour[1]; rect.data[offset + 2] = colour[2];
    }
  }
};
const toPx = (a: number) => ((a + SPAN_M / 2) / SPAN_M) * rect.width;
for (const tick of merged) paint(toPx(tick.at), tick.buildingId === targetId ? [255, 60, 40] : [40, 180, 255], 3);

// Draw the detected roofline, and mark where it steps. If the detector works,
// the green line traces the actual rooftops and the yellow marks land on the
// same columns as the blue plot boundaries.
const heights = skyline(rect);
const steps = skylineSteps(heights, Math.round(0.9 * PX_PER_M));
const maxStep = Math.max(...steps, 1);
for (let x = 0; x < rect.width; x++) {
  const y = heights[x];
  if (y !== null) {
    for (let dy = -2; dy <= 2; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= rect.height) continue;
      const offset = (yy * rect.width + x) * 4;
      rect.data[offset] = 40; rect.data[offset + 1] = 255; rect.data[offset + 2] = 90;
    }
  }
  if (steps[x] > maxStep * 0.45) {
    for (let yy = 0; yy < 26; yy++) {
      const offset = (yy * rect.width + x) * 4;
      rect.data[offset] = 255; rect.data[offset + 1] = 220; rect.data[offset + 2] = 0;
    }
  }
}
console.log(`skyline found in ${heights.filter(h => h !== null).length}/${rect.width} columns`);

const encoded = jpeg.encode({ width: rect.width, height: rect.height, data: Buffer.from(rect.data) }, 90);
await mkdir(OUT, { recursive: true });
const out = path.join(OUT, `strip-${targetId}.jpg`);
await writeFile(out, encoded.data);
console.log(`${rect.width}×${rect.height}px @ ${rect.pixelsPerMetre.toFixed(0)}px/m → ${path.relative(process.cwd(), out)}`);
console.log('red = the target pand’s own plot boundaries, blue = its neighbours’');
