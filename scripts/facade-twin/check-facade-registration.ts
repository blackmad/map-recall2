/**
 * Does a rectified façade actually show the building we asked for?
 *
 * Nothing may be measured off a rectified image until this is answered, and it
 * cannot be answered by looking: the failure mode is a well-formed, upright,
 * entirely plausible picture of the wrong wall. Amsterdam is full of canal
 * frontages and any of them looks like the right answer.
 *
 * The check compares the image against ground truth BAG already holds: plot
 * boundaries, matched against where the *roofline steps*. In a terrace, a plot boundary is a party wall, and a party wall
 * is a vertical break in the photograph — a change of brick, of paint, of
 * storey height, or a downpipe. So a registered projection puts BAG's
 * boundaries on top of the image's strongest vertical edges, and a shifted one
 * puts every boundary the same distance off every edge.
 *
 * An earlier version of this check compared several views of one wall against
 * each other instead. That was the wrong instrument and it failed loudly and
 * wrongly: views 20 and 80 m from a façade differ in resolution, exposure,
 * season and what parked cars obscure, so their edge profiles do not correlate
 * even when both are correctly projected. It reported 2–3 m of disagreement on
 * a projection that a party-wall overlay then showed was registered to well
 * under a metre. Correlating two noisy measurements of the same thing tests
 * neither of them; comparing one against a register that knows the answer
 * tests it exactly.
 *
 * Usage: npx tsx scripts/facade-twin/check-facade-registration.ts [--views=5]
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { AMSTERDAM_GRACHTENGORDEL_WEST } from '../../src/canalRecall/facade/areas.ts';
import { buildElevations, inFrontOf, obliquityDeg, standoffM } from '../../src/canalRecall/facade/elevations.ts';
import { rectifyFacade, type CameraPose, type EquirectangularImage } from '../../src/canalRecall/facade/rectify.ts';
import { AMSTERDAM_CAMERA, GEOID_SEPARATION_M, isLeafOff } from '../../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import { normalise, skyline, skylineSteps } from '../../src/canalRecall/facade/skyline.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import type { LngLat, PanoramaView, ProjectedPoint } from '../../src/canalRecall/facade/sources.ts';

const AREA = AMSTERDAM_GRACHTENGORDEL_WEST;
const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
const arg = (name: string) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const VIEWS = Number(arg('views') ?? 5);
const PX_PER_M = 24;          // enough for party-wall and window edges, cheap to correlate
const CONTEXT_M = 6;          // margin each side, so a shifted view still overlaps
const MAX_SHIFT_M = 3;        // search window for the correlation peak
const SPAN_M = 26;           // strip width, wide enough to hold several party walls

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

const images = new Map<string, EquirectangularImage>();
async function panorama(view: PanoramaView): Promise<EquirectangularImage | null> {
  const cached = images.get(view.panoramaId);
  if (cached) return cached;
  const file = path.join(CACHE, 'panoramas', `${view.panoramaId}.jpg`);
  let bytes: Buffer;
  try { bytes = await readFile(file); } catch {
    const response = await fetch(view.imageUrl, { headers: { 'User-Agent': 'MapRecallFacadeTwin/1.0' }, signal: AbortSignal.timeout(120_000) });
    if (!response.ok) return null;
    bytes = Buffer.from(await response.arrayBuffer());
    await (await import('node:fs/promises')).writeFile(file, bytes);
  }
  const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
  const image = { width: decoded.width, height: decoded.height, data: decoded.data };
  images.set(view.panoramaId, image);
  return image;
}

/**
 * A vertical-edge profile across the wall.
 *
 * Party walls, window jambs and downpipes are vertical, so the horizontal
 * gradient summed down each column is a signature of where things are *along*
 * the wall — which is exactly the axis a registration error moves. Rows near
 * the top and bottom are dropped: sky and parked cars are not the building.
 */
function edgeProfile(rect: { width: number; height: number; data: Uint8ClampedArray }): number[] {
  const profile = new Array(rect.width).fill(0);
  const top = Math.floor(rect.height * 0.25), bottom = Math.floor(rect.height * 0.8);
  for (let y = top; y < bottom; y++) {
    for (let x = 1; x < rect.width; x++) {
      const a = (y * rect.width + x) * 4, b = (y * rect.width + x - 1) * 4;
      const grey = (i: number) => 0.299 * rect.data[i] + 0.587 * rect.data[i + 1] + 0.114 * rect.data[i + 2];
      profile[x] += Math.abs(grey(a) - grey(b));
    }
  }
  // Normalise so exposure differences between winter mornings do not dominate.
  const mean = profile.reduce((s, v) => s + v, 0) / profile.length;
  const sd = Math.sqrt(profile.reduce((s, v) => s + (v - mean) ** 2, 0) / profile.length) || 1;
  return profile.map(v => (v - mean) / sd);
}

/** Lateral shift, in pixels, that best aligns b onto a. */
function bestShift(a: number[], b: number[], maxShift: number): { shift: number; score: number } {
  let best = { shift: 0, score: -Infinity };
  for (let shift = -maxShift; shift <= maxShift; shift++) {
    let sum = 0, n = 0;
    for (let i = 0; i < a.length; i++) {
      const j = i + shift;
      if (j < 0 || j >= b.length) continue;
      sum += a[i] * b[j];
      n++;
    }
    if (n < a.length * 0.5) continue;
    const score = sum / n;
    if (score > best.score) best = { shift, score };
  }
  return best;
}

/**
 * A synthetic profile of where BAG says the party walls are.
 *
 * Each boundary becomes a narrow Gaussian bump, so correlating it against the
 * image's vertical-edge profile finds the lateral offset at which the register
 * and the photograph agree about where houses divide.
 */
function boundaryProfile(width: number, positionsPx: number[], sigmaPx: number): number[] {
  const profile = new Array(width).fill(0);
  for (const position of positionsPx) {
    const from = Math.max(0, Math.floor(position - sigmaPx * 3));
    const to = Math.min(width - 1, Math.ceil(position + sigmaPx * 3));
    for (let x = from; x <= to; x++) profile[x] += Math.exp(-((x - position) ** 2) / (2 * sigmaPx ** 2));
  }
  const mean = profile.reduce((s, v) => s + v, 0) / width;
  const sd = Math.sqrt(profile.reduce((s, v) => s + (v - mean) ** 2, 0) / width) || 1;
  return profile.map(v => (v - mean) / sd);
}

const poseOf = (view: PanoramaView, point: ProjectedPoint, headingSign = 1, yawOffsetDeg = 0): CameraPose => ({
  x: point.x, y: point.y, z: view.cameraHeight - GEOID_SEPARATION_M,
  headingDeg: view.headingDeg * headingSign + yawOffsetDeg,
  pitchDeg: view.pitchDeg, rollDeg: view.rollDeg,
});

/** The wall with the most well-conditioned leaf-off views — the street frontage. */
function frontage(buildingId: string) {
  const walls = buildElevations(footprints.get(buildingId)!);
  let best: { wall: typeof walls[number]; views: typeof posed; obliquity: number } | null = null;
  for (const wall of walls) {
    const usable = posed.filter(pose => {
      if (Math.abs(pose.point.x - wall.midpoint.x) > 60 || Math.abs(pose.point.y - wall.midpoint.y) > 60) return false;
      if (!inFrontOf(wall, pose.point)) return false;
      const so = standoffM(wall, pose.point);
      // Standoff proportional to the wall: closer than about two wall-widths
      // and the strip's ends are photographed at extreme angles.
      return so >= Math.max(12, wall.lengthM * 2.5) && so <= 45
        && obliquityDeg(wall, pose.point) <= 10 && isLeafOff(pose.view.capturedAt);
    });
    if (!usable.length) continue;
    // Squarest available view decides, not the busiest wall. Counting views
    // favours long rear walls that happen to face an open yard, and those are
    // exactly the walls with a taller building behind them and no sky.
    const squarest = usable.reduce((a, b) => (obliquityDeg(wall, b.point) < obliquityDeg(wall, a.point) ? b : a));
    const obliquity = obliquityDeg(wall, squarest.point);
    if (!best || obliquity < best.obliquity) best = { wall, views: usable, obliquity };
  }
  return best;
}

/**
 * Offset, in metres, between BAG's plot boundaries and the image's vertical
 * edges for one building. Null when the strip holds too few boundaries for the
 * correlation to mean anything.
 */
async function offsetFor(buildingId: string, headingSign: number, yawOffsetDeg: number) {
  const front = frontage(buildingId);
  if (!front || !front.views.length) { reason = 'no view meeting standoff/obliquity/leaf-off'; return null; }
  const wall = front.wall;
  const length = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
  const ux = (wall.end.x - wall.start.x) / length, uy = (wall.end.y - wall.start.y) / length;
  const centre = wall.midpoint;
  const along = (p: ProjectedPoint) => (p.x - centre.x) * ux + (p.y - centre.y) * uy;
  const offLine = (p: ProjectedPoint) => Math.abs((p.x - centre.x) * wall.normal.x + (p.y - centre.y) * wall.normal.y);

  // Plot boundaries of every building whose front sits on this same line, and
  // the tallest ridge among them — the strip has to clear the tallest
  // neighbour, not the target, or the columns in front of a taller house
  // contain no sky and report no roofline.
  const positions: number[] = [];
  let tallestRidge = massing.get(buildingId)?.ridgeHeight ?? 16;
  for (const [neighbourId, footprint] of footprints) {
    let touches = false;
    for (const vertex of footprint) {
      const a = along(vertex);
      if (Math.abs(a) > SPAN_M / 2 - 1 || offLine(vertex) > 1.2) continue;
      touches = true;
      if (positions.some(existing => Math.abs(existing - a) < 0.4)) continue;
      positions.push(a);
    }
    if (touches) tallestRidge = Math.max(tallestRidge, massing.get(neighbourId)?.ridgeHeight ?? 0);
  }
  if (positions.length < 3) { reason = `only ${positions.length} plot boundaries on the wall line`; return null; }

  // Squarest view available.
  const pose = front.views.reduce((a, b) => (obliquityDeg(wall, b.point) < obliquityDeg(wall, a.point) ? b : a));
  const image = await panorama(pose.view);
  if (!image) { reason = 'panorama image unavailable'; return null; }

  const rect = rectifyFacade(image, poseOf(pose.view, pose.point, headingSign, yawOffsetDeg), {
    start: { x: centre.x - ux * (SPAN_M / 2), y: centre.y - uy * (SPAN_M / 2) },
    end: { x: centre.x + ux * (SPAN_M / 2), y: centre.y + uy * (SPAN_M / 2) },
    // The strip must reach well above the tallest ridge in it: the signal is
    // the sky boundary, so there has to be sky.
    baseZ: (massing.get(buildingId)?.groundLevel ?? 1) + 4,
    topZ: tallestRidge + 14,
  }, { pixelsPerMetre: PX_PER_M, camera: AMSTERDAM_CAMERA });

  const toPx = (a: number) => ((a + SPAN_M / 2) / SPAN_M) * rect.width;
  const heights = skyline(rect);
  const found = heights.filter(h => h !== null).length;
  // Too little sky, or too little building, and there is no staircase to read.
  if (found < rect.width * 0.45) {
    reason = `sky found in only ${Math.round((100 * found) / rect.width)}% of columns`
      + ` (strip ${((massing.get(buildingId)?.groundLevel ?? 1) + 4).toFixed(1)}–${(tallestRidge + 14).toFixed(1)} m NAP)`;
    return null;
  }

  const expected = boundaryProfile(rect.width, positions.map(toPx), 0.3 * PX_PER_M);
  const observed = normalise(skylineSteps(heights, Math.round(0.9 * PX_PER_M)));
  const { shift } = bestShift(expected, observed, Math.round(MAX_SHIFT_M * PX_PER_M));
  return { offsetM: shift / PX_PER_M, boundaries: positions.length, standoff: standoffM(wall, pose.point), obliquity: obliquityDeg(wall, pose.point), wallLength: wall.lengthM };
}

const targets = (arg('ids') ?? [
  '0363100012167934', '0363100012165027', '0363100012165026', '0363100012165059',
  '0363100012169307', '0363100012167764', '0363100012168755', '0363100012165022',
  '0363100012176355', '0363100012168556', '0363100012176537', '0363100012169510',
].join(',')).split(',');

let reason = '';
console.log(`Registration against BAG plot boundaries — camera '${AMSTERDAM_CAMERA.id}'\n`);

const offsets: number[] = [];
const signed: number[] = [];
for (const buildingId of targets) {
  if (!footprints.has(buildingId)) { console.log(`${buildingId}  not in area`); continue; }
  reason = 'unknown';
  const result = await offsetFor(buildingId, 1, 0);
  if (!result) { console.log(`${buildingId}  skipped — ${reason}`); continue; }
  offsets.push(Math.abs(result.offsetM));
  signed.push(result.offsetM);
  console.log(`${buildingId}  wall ${result.wallLength.toFixed(1)}m, view ${result.standoff.toFixed(0)}m at ${result.obliquity.toFixed(1)}°,`
    + ` ${result.boundaries} boundaries  →  offset ${result.offsetM >= 0 ? '+' : ''}${result.offsetM.toFixed(2)} m`);
}

if (offsets.length < 3) { console.error('\ntoo few buildings measured to conclude anything'); process.exit(1); }
const sorted = [...offsets].sort((a, b) => a - b);
const median = sorted[Math.floor(sorted.length / 2)];
/**
 * Signed mean and unsigned median say different things, and the difference is
 * the whole diagnosis. A *bias* — every building offset the same way — is a
 * misregistered projection and is correctable. A *scatter* around zero is the
 * check's own resolution: BAG plot boundaries and visual roofline steps are
 * related but not identical, since one pand can span two visual houses.
 */
const bias = signed.reduce((sum, v) => sum + v, 0) / signed.length;
console.log(`\n${offsets.length} buildings — median |offset| ${median.toFixed(2)} m, worst ${sorted[sorted.length - 1].toFixed(2)} m`);
console.log(`signed mean (bias) ${bias >= 0 ? '+' : ''}${bias.toFixed(2)} m — a bias is a misregistration, scatter about zero is this check's resolution`);

/**
 * A canal house is 5.7 m wide at the median and its bays are about a metre, so
 * half a metre is half a bay — the difference between a three-bay and a
 * four-bay reading. That is the bar a measurement has to clear.
 */
const BAR_M = 0.5;
if (median > BAR_M) {
  console.error(`\nFAIL — the register's plot boundaries and the image's vertical edges disagree by more than ${BAR_M} m.`);
  process.exit(1);
}
console.log(`\nPASS — BAG's plot boundaries land on the image's vertical edges to within ${BAR_M} m.`);
