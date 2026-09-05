/**
 * How far off is each panorama's aim, in metres and degrees?
 *
 * The same footprint projected into two panoramas of the same wall lands on two
 * different buildings. The wall is fixed, so the variable is the pose — and the
 * poses come from five different camera rigs across ten years of capture, which
 * is exactly where a convention differs quietly.
 *
 * Measuring it needs one trick. Rectifying onto the wall's own extent gives two
 * strips that share no content when the aim is off, so cross-correlation has
 * nothing to lock onto and returns noise. Rectify instead onto a plane several
 * times wider than the wall and the building appears *somewhere* in both
 * strips; then the shift that aligns them is the relative aim error, in metres
 * along the wall, and `atan(shift / standoff)` turns it into degrees of
 * heading.
 *
 * The output is per panorama pair, tagged with each one's rig prefix and
 * mission year, so a systematic error can be found by grouping rather than
 * guessed at.
 *
 * Usage: npx tsx scripts/facade-twin/aim-error.ts [--limit=20] [--margin=3]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { AMSTERDAM_GRACHTENGORDEL_WEST as AREA } from '../../src/canalRecall/facade/areas.ts';
import { MAX_PIXELS_PER_METRE, MIN_PIXELS_PER_METRE, STRIP_BASE_BELOW_GROUND_M } from '../../src/canalRecall/facade/measure.ts';
import { rectifyFacade } from '../../src/canalRecall/facade/rectify.ts';
import { AMSTERDAM_CAMERA, GEOID_SEPARATION_M } from '../../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import type { PanoramaView } from '../../src/canalRecall/facade/sources.ts';

const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
const OUT = path.join(CACHE, 'strips-wide');
const arg = (name: string) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const MARGIN = Number(arg('margin') ?? 3);
const LIMIT = Number(arg('limit') ?? 20);

const views = new Map<string, PanoramaView>(
  (JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-panoramas.json`), 'utf8')).data as PanoramaView[])
    .map(v => [v.panoramaId, v]));
const recon = JSON.parse(await readFile(path.join(STAGING, 'recon.json'), 'utf8'));
const massing = new Map<string, any>(recon.massing.map((m: any) => [m.buildingId, m]));
const store = JSON.parse(await readFile(path.join(STAGING, 'measured-facades.json'), 'utf8')).facades as Record<string, any>;
const multi = JSON.parse(await readFile(path.join(STAGING, 'multi-view.json'), 'utf8')).facades as Record<string, any[]>;

const rig = (id: string) => String(id).split('_')[0].replace(/-\d+$/, '');

await mkdir(OUT, { recursive: true });
const index: Record<string, any[]> = {};
const ids = Object.keys(multi).filter(id => (multi[id] ?? []).length >= 2).sort();
const queue = ids.filter((_, i) => i % Math.max(1, Math.floor(ids.length / LIMIT)) === 0).slice(0, LIMIT);

for (const buildingId of queue) {
  const record = store[buildingId];
  const mass = massing.get(buildingId);
  if (!record || !mass?.groundLevel) continue;
  const [x0, y0, x1, y1] = record.wall;
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 1) continue;
  // Extend the plane sideways about its own midpoint. Same plane, same normal,
  // just a wider window onto it — so both views contain the building somewhere
  // even when one of them is aimed wrong.
  const ux = (x1 - x0) / len, uy = (y1 - y0) / len;
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const half = (len * MARGIN) / 2;
  const start = { x: mx - ux * half, y: my - uy * half };
  const end = { x: mx + ux * half, y: my + uy * half };

  const written = [];
  await mkdir(path.join(OUT, buildingId), { recursive: true });
  for (const [i, v] of (multi[buildingId] ?? []).entries()) {
    const view = views.get(v.panoramaId);
    if (!view) continue;
    let bytes: Buffer;
    try { bytes = await readFile(path.join(CACHE, 'panoramas', `${view.panoramaId}.jpg`)); } catch { continue; }
    const image = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
    const cam = RD_NEW.fromLngLat(view.lngLat);
    // One pixels-per-metre for every view of a building, so the strips are
    // directly comparable and a shift means metres rather than resampling.
    const ppm = Math.min(MAX_PIXELS_PER_METRE * 0.5,
      Math.max(MIN_PIXELS_PER_METRE, 1250 / Math.max(v.standoffM, 8))) * 0.6;
    const rect = rectifyFacade(image, {
      x: cam.x, y: cam.y, z: view.cameraHeight - GEOID_SEPARATION_M,
      headingDeg: view.headingDeg, pitchDeg: view.pitchDeg, rollDeg: view.rollDeg,
    }, { start, end,
         baseZ: mass.groundLevel - STRIP_BASE_BELOW_GROUND_M,
         topZ: (mass.eavesHeight ?? mass.groundLevel + 12) + 0.3 },
       { pixelsPerMetre: ppm, camera: AMSTERDAM_CAMERA, maxPixels: 24e6 });
    const file = path.join(buildingId, `${i}.jpg`);
    await writeFile(path.join(OUT, file),
      jpeg.encode({ width: rect.width, height: rect.height, data: Buffer.from(rect.data) }, 86).data);
    written.push({
      file, panoramaId: view.panoramaId, rig: rig(view.panoramaId),
      missionYear: (view as any).missionYear ?? null,
      capturedAt: view.capturedAt.slice(0, 10),
      standoffM: v.standoffM, obliquityDeg: v.obliquityDeg,
      pixelsPerMetre: Number(rect.pixelsPerMetre.toFixed(2)),
      planeWidthM: Number((len * MARGIN).toFixed(2)),
      wallWidthM: Number(len.toFixed(2)),
    });
  }
  if (written.length >= 2) index[buildingId] = written;
  process.stdout.write(`\r  ${Object.keys(index).length}/${queue.length}`);
}
process.stdout.write('\n');

await writeFile(path.join(STAGING, 'wide-views.json'), JSON.stringify({
  metadata: {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/facade-twin/aim-error.ts',
    marginTimes: MARGIN,
    note: 'The same wall plane widened about its midpoint, rendered from each panorama at one '
      + 'shared scale. A horizontal shift between two of these is the relative aim error in '
      + 'metres along the wall.',
    stripDirectory: '.cache/facade-twin/strips-wide',
  },
  facades: index,
}, null, 1));
console.log(`${Object.keys(index).length} buildings, ${Object.values(index).flat().length} wide strips`);
