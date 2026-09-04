/**
 * The evidence behind a measured façade, rendered so a person can check it.
 *
 * Every measurement in this project has, so far, been checkable only by reading
 * JSON. That is how a storey ladder returned six storeys on a street of four
 * for weeks, how a bond ended up stretched across whole walls, and how 1,020
 * openings came to share a sill of exactly -0.40 m. Each of those took
 * paragraphs of prose to find and would have taken one glance at the
 * photograph beside the numbers.
 *
 * So: for each measured building, the rectified strip it was measured from with
 * the detector's own findings drawn on it, plus an index carrying the numbers
 * and where to stand to see the real thing. The strip is regenerated from the
 * cached panorama rather than stored during measurement, because the boundary
 * runner measures thousands of buildings and does not need thousands of JPEGs
 * on disk to do it — only the ones somebody is about to look at.
 *
 * Usage:
 *   npx tsx scripts/facade-twin/build-evidence.ts             # index only
 *   npx tsx scripts/facade-twin/build-evidence.ts --strips=200
 *   npx tsx scripts/facade-twin/build-evidence.ts --ids=<pandId>,<pandId>
 *
 * Strips land in `public/canal-drive/facade-evidence/`, which is gitignored:
 * they are derived from third-party imagery and must never be committed or
 * redistributed. They exist so a reviewer can look, and for nothing else.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { AMSTERDAM_GRACHTENGORDEL_WEST } from '../../src/canalRecall/facade/areas.ts';
import { STRIP_BASE_BELOW_GROUND_M } from '../../src/canalRecall/facade/measure.ts';
import { nearestMaterial } from '../../src/canalRecall/facade/materials.ts';
import { rectifyFacade, type CameraPose } from '../../src/canalRecall/facade/rectify.ts';
import { GEOID_SEPARATION_M } from '../../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import type { LngLat, PanoramaView } from '../../src/canalRecall/facade/sources.ts';

const AREA = AMSTERDAM_GRACHTENGORDEL_WEST;
const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
const STRIPS = path.resolve('public/canal-drive/facade-evidence');
const arg = (name: string) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3);

interface Stored {
  pandId: string; panoramaId: string; capturedAt: string;
  standoffM: number; obliquityDeg: number;
  wall: [number, number, number, number]; wallWidthM: number;
  wallRgb: [number, number, number] | null;
  storeyBands: number; storeyIntervalsM: number[];
  plausibility: number; plausibilityFailures: string[]; obstructionColumns: number;
  bays: number; bayOffsetsM: number[];
  openings: Array<{ xM: number; yM: number; widthM: number; heightM: number }>;
}

const store = JSON.parse(await readFile(path.join(STAGING, 'measured-facades.json'), 'utf8')) as
  { facades: Record<string, Stored> };
const views = new Map<string, PanoramaView>(
  (JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-panoramas.json`), 'utf8')).data as PanoramaView[])
    .map(v => [v.panoramaId, v]));
const recon = JSON.parse(await readFile(path.join(STAGING, 'recon.json'), 'utf8'));
const massing = new Map<string, { groundLevel?: number; eavesHeight?: number; storeys?: number }>(
  recon.massing.map((m: { buildingId: string }) => [m.buildingId, m]));
const heritage = new Map<string, string>();
for (const h of recon.heritage) if (h.buildingId && h.description) heritage.set(h.buildingId, h.description);

/**
 * Where to stand to see this façade, and which way to look.
 *
 * Computed from the wall rather than from the camera that measured it, because
 * the point of the link is to check the measurement against a *different*
 * observation — a second opinion is worth nothing if it is taken from the same
 * seat. Stand off the wall on its outward normal and look back at it.
 */
function viewpoint(wall: [number, number, number, number], standoff: number) {
  const [x0, y0, x1, y1] = wall;
  const length = Math.hypot(x1 - x0, y1 - y0) || 1;
  const ux = (x1 - x0) / length, uy = (y1 - y0) / length;
  const nx = uy, ny = -ux;                                  // outward, as elsewhere
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const back = Math.min(Math.max(standoff, 8), 25);
  const eye = RD_NEW.toLngLat({ x: mx + nx * back, y: my + ny * back });
  // Bearing from the eye back to the wall: clockwise from north, as every
  // street-imagery service wants it.
  const heading = (Math.atan2(-nx, -ny) * 180 / Math.PI + 360) % 360;
  return { eye, heading: Number(heading.toFixed(1)), at: RD_NEW.toLngLat({ x: mx, y: my }) };
}

const box = (data: Uint8ClampedArray, width: number, height: number,
             x0: number, y0: number, x1: number, y1: number,
             colour: [number, number, number], thickness = 2) => {
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

async function panorama(view: PanoramaView) {
  const file = path.join(CACHE, 'panoramas', `${view.panoramaId}.jpg`);
  let bytes: Buffer;
  try { bytes = await readFile(file); } catch { return null; }   // cached only
  const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
  return { width: decoded.width, height: decoded.height, data: decoded.data };
}

/** Redraw the strip this façade was measured from, with the findings on it. */
async function strip(record: Stored): Promise<boolean> {
  const view = views.get(record.panoramaId);
  const mass = massing.get(record.pandId);
  if (!view || !mass?.groundLevel) return false;
  const image = await panorama(view);
  if (!image) return false;

  const ground = mass.groundLevel;
  const eaves = mass.eavesHeight ?? ground + 12;
  const [x0, y0, x1, y1] = record.wall;
  const rect = rectifyFacade(image, {
    x: RD_NEW.fromLngLat(view.lngLat).x, y: RD_NEW.fromLngLat(view.lngLat).y,
    z: view.cameraHeight - GEOID_SEPARATION_M,
    headingDeg: view.headingDeg, pitchDeg: view.pitchDeg, rollDeg: view.rollDeg,
  } satisfies CameraPose,
    { start: { x: x0, y: y0 }, end: { x: x1, y: y1 },
      baseZ: ground - STRIP_BASE_BELOW_GROUND_M, topZ: eaves + 0.3 },
    { pixelsPerMetre: Math.min(60, Math.max(24, 1250 / record.standoffM)) });

  const ppm = rect.pixelsPerMetre;
  for (const o of record.openings) {
    const bx0 = Math.round(o.xM * ppm), bx1 = Math.round((o.xM + o.widthM) * ppm);
    const by1 = Math.round(rect.height - o.yM * ppm);
    const by0 = Math.round(by1 - o.heightM * ppm);
    // Amber for anything sitting at or below street level — the souterrain and
    // the front door, which are the readings the strip's base was cutting off.
    const low = o.yM < STRIP_BASE_BELOW_GROUND_M + 0.6;
    box(rect.data, rect.width, rect.height, bx0, by0, bx1, by1, low ? [255, 190, 0] : [40, 230, 120]);
  }
  // The ground line, so a reviewer can see what is souterrain and what is not.
  const gy = Math.round(rect.height - STRIP_BASE_BELOW_GROUND_M * ppm);
  for (let x = 0; x < rect.width; x++) {
    if (Math.floor(x / 7) % 2) continue;
    const i = (gy * rect.width + x) * 4;
    rect.data[i] = 255; rect.data[i + 1] = 90; rect.data[i + 2] = 90;
  }

  const encoded = jpeg.encode({ width: rect.width, height: rect.height, data: Buffer.from(rect.data) }, 82);
  await writeFile(path.join(STRIPS, `${record.pandId}.jpg`), encoded.data);
  return true;
}

const records = Object.values(store.facades).filter(f => f.openings?.length);
const wanted = (arg('ids') ?? '').split(',').filter(Boolean);
const budget = Number(arg('strips') ?? 0);

await mkdir(STRIPS, { recursive: true });
let drawn = 0;
const queue = wanted.length
  ? records.filter(r => wanted.includes(r.pandId))
  // Worst first: a reviewer's time is best spent where the detector is least
  // sure of itself, not on a random sample of the ones it found easy.
  : [...records].sort((a, b) =>
      (a.plausibility - b.plausibility) || (b.obstructionColumns - a.obstructionColumns)
      || (b.obliquityDeg - a.obliquityDeg)).slice(0, budget);
for (const record of queue) {
  if (await strip(record)) drawn++;
  if (drawn % 25 === 0 && drawn) process.stdout.write(`\r  ${drawn}/${queue.length} strips`);
}

const index = records.map(record => {
  const spot = viewpoint(record.wall, record.standoffM);
  const rgb = record.wallRgb;
  const material = rgb ? nearestMaterial(rgb) : null;
  const openingsLow = record.openings.filter(o => o.yM < STRIP_BASE_BELOW_GROUND_M + 0.6).length;
  return {
    pandId: record.pandId,
    panoramaId: record.panoramaId,
    capturedAt: record.capturedAt.slice(0, 10),
    standoffM: record.standoffM, obliquityDeg: record.obliquityDeg,
    wallWidthM: record.wallWidthM,
    wallRgb: rgb, wallMaterial: material?.id ?? null, wallMaterialName: material?.name ?? null,
    storeyBands: record.storeyBands, storeyIntervalsM: record.storeyIntervalsM,
    bays: record.bays, bayOffsetsM: record.bayOffsetsM,
    openings: record.openings.length, openingsAtStreetLevel: openingsLow,
    // Every rectangle the detector kept, so the inspector can draw what was
    // found against what the bay-and-storey grid led it to expect. The gaps are
    // the interesting part: a façade with four openings on a five-storey grid
    // has one cell where the detector looked and found nothing, and saying
    // which cell is the difference between a number and a diagnosis.
    openingRects: record.openings.map(o => [
      Number(o.xM.toFixed(2)), Number((o.yM - STRIP_BASE_BELOW_GROUND_M).toFixed(2)),
      Number(o.widthM.toFixed(2)), Number(o.heightM.toFixed(2)),
    ]),
    // What the strip could actually resolve. An 8000 px equirectangular gives
    // about 1250 px per radian, so this is the honest limit on how fine a
    // detail could have been seen at all.
    pixelsPerMetre: Math.round(1250 / record.standoffM),
    plausibility: record.plausibility, plausibilityFailures: record.plausibilityFailures,
    obstructionColumns: record.obstructionColumns,
    massingStoreys: massing.get(record.pandId)?.storeys ?? null,
    register: heritage.get(record.pandId) ?? null,
    lngLat: spot.at.map(v => Number(v.toFixed(6))) as LngLat,
    viewFrom: spot.eye.map(v => Number(v.toFixed(6))) as LngLat,
    headingDeg: spot.heading,
  };
});

await writeFile(path.join(STAGING, 'facade-evidence.json'), JSON.stringify({
  metadata: {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/facade-twin/build-evidence.ts',
    attribution: '© Gemeente Amsterdam, Kernregistratie Panoramabeelden (CC BY 4.0)',
    note: 'Rectified strips are derived from third-party imagery. They live in a gitignored directory, '
      + 'are reference for review only, and must never be committed or shipped as assets.',
    stripDirectory: 'public/canal-drive/facade-evidence',
    stripsDrawn: drawn,
    strippedBy: wanted.length ? 'explicit ids' : 'lowest plausibility first',
  },
  facades: index,
}, null, 1));

const low = index.filter(f => f.plausibility < 1).length;
const noStreet = index.filter(f => f.openingsAtStreetLevel === 0).length;
console.log(`\n${index.length} measured façades indexed, ${drawn} strips drawn.`);
console.log(`  ${low} below full plausibility, ${noStreet} with nothing at street level (no door found).`);
console.log(`  → ${path.relative(process.cwd(), path.join(STAGING, 'facade-evidence.json'))}`);
