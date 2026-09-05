/**
 * A set of rectified façade strips good enough to look at, and a manifest
 * saying why each one qualified.
 *
 * "Confident" is deliberately *not* defined by cross-view agreement. That
 * metric measures image similarity rather than registration — two frames of one
 * pass share their pose error and cancel it — so a set selected on it would be
 * selected on the thing least worth trusting. Every gate here is a property of
 * the geometry and the source, checkable before a single pixel is resampled:
 *
 *   - the wall is a **frontage**, chosen because survey cameras can see it,
 *     not because it happened to lie near a stale proposal;
 *   - the view **can see the wall**, sampled at nine points along it rather
 *     than at the midpoint alone;
 *   - the source **holds the detail**, measured as the worse of vertical
 *     (cos²φ at the top of the wall) and horizontal (foreshortened by
 *     obliquity) sampling, so nothing is upsampled into looking better than it
 *     is;
 *   - the view is **leaf-off** where one exists, because an Amsterdam canal elm
 *     covers the façade this project exists to measure.
 *
 * The strip is rendered at the rate the source actually carries, capped, so a
 * distant wall produces a small honest image rather than a large blurry one.
 *
 * Usage:
 *   npx tsx scripts/facade-twin/build-strip-set.ts [--count=80] [--downloads=150]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { AMSTERDAM_GRACHTENGORDEL_WEST as AREA } from '../../src/canalRecall/facade/areas.ts';
import { AMSTERDAM_CAMERA, hasUsableGeometry } from '../../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import { loadTrackOffsets, rectifyWall } from './panorama-render.ts';
import { blockedFraction, buildProbe, chooseFrontage, rankViews } from './frontage.ts';
import type { LngLat, PanoramaView, ProjectedPoint } from '../../src/canalRecall/facade/sources.ts';

const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
const OUT = path.join(CACHE, 'strips-confident');
const arg = (n: string) => process.argv.find(v => v.startsWith(`--${n}=`))?.slice(n.length + 3);
const WANT = Number(arg('count') ?? 80);
const DOWNLOAD_BUDGET = Number(arg('downloads') ?? 150);

// Gates. Every one is knowable before rendering.
const MIN_CLEAR_VIEWS = 30;
const MAX_BLOCKED = 0.12;
const MIN_PIXELS_PER_M = 34;
const MAX_OBLIQUITY = 25;

const read = async (p: string, fallback: any = null) => { try { return JSON.parse(await readFile(p, 'utf8')); } catch { return fallback; } };
const registry = (await read(path.join(CACHE, `${AREA.areaId}-registry.json`))).data as Array<{ buildingId: string; footprintLngLat: LngLat[] }>;
const views = (await read(path.join(CACHE, `${AREA.areaId}-panoramas.json`))).data as PanoramaView[];
const byId = new Map(views.map(v => [v.panoramaId, v]));
const recon = await read(path.join(STAGING, 'recon.json'));
const massing = new Map<string, any>(recon.massing.map((m: any) => [m.buildingId, m]));
const store = (await read(path.join(STAGING, 'measured-facades.json'), { facades: {} })).facades as Record<string, any>;
const addressRows = (await read(path.join(CACHE, 'address-points.json'), { addresses: [] })).addresses as
  Array<{ street: string; houseNumber: number; rd: ProjectedPoint; pandId: string | null }>;

const footprints = new Map<string, ProjectedPoint[]>();
for (const e of registry) if (!footprints.has(e.buildingId)) footprints.set(e.buildingId, e.footprintLngLat.map(p => RD_NEW.fromLngLat(p)));
const addressesOf = new Map<string, ProjectedPoint[]>();
const label = new Map<string, string>();
for (const a of addressRows) if (a.pandId) {
  (addressesOf.get(a.pandId) ?? addressesOf.set(a.pandId, []).get(a.pandId)!).push(a.rd);
  if (!label.has(a.pandId)) label.set(a.pandId, `${a.street} ${a.houseNumber}`);
}

const posed = views.filter(hasUsableGeometry)
  .map(view => ({ view, point: RD_NEW.fromLngLat(view.lngLat), capturedAt: view.capturedAt }));
const probe = buildProbe(footprints, posed.map(p => p.point));
const trackOffset = await loadTrackOffsets(CACHE);

let downloads = 0;
async function panorama(id: string) {
  const file = path.join(CACHE, 'panoramas', `${id}.jpg`);
  if (!existsSync(file)) {
    if (downloads >= DOWNLOAD_BUDGET) return null;
    const view = byId.get(id);
    if (!view?.imageUrl) return null;
    try {
      const response = await fetch(view.imageUrl, { signal: AbortSignal.timeout(120_000) });
      if (!response.ok) return null;
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 100_000) return null;
      await writeFile(file, bytes);
      downloads++;
    } catch { return null; }
  }
  try { return jpeg.decode(await readFile(file), { useTArray: true, formatAsRGBA: true }); } catch { return null; }
}

await mkdir(OUT, { recursive: true });
const manifest: any[] = [];
let considered = 0, noFrontage = 0, noView = 0;

for (const pandId of Object.keys(store).sort()) {
  if (manifest.length >= WANT) break;
  const ring = footprints.get(pandId), mass = massing.get(pandId), record = store[pandId];
  if (!ring || !record || !Number.isFinite(mass?.groundLevel)) continue;
  considered++;

  const choice = chooseFrontage(ring, pandId, probe,
    { proposal: record.wall, addressPoints: addressesOf.get(pandId) ?? [] });
  if (!choice.elevation || choice.clearViews < MIN_CLEAR_VIEWS) { noFrontage++; continue; }
  const wall = choice.elevation;

  const ground = mass.groundLevel;
  const top = Math.max(mass.ridgeHeight ?? 0, mass.eavesHeight ?? 0, ground + 8);
  const ranked = rankViews(wall, pandId, probe, posed, { wallHeightM: top - ground })
    .filter(r => r.obliquityDeg <= MAX_OBLIQUITY
      && r.worstPixelsPerMetre >= MIN_PIXELS_PER_M
      && r.blockedFraction <= MAX_BLOCKED);
  if (!ranked.length) { noView++; continue; }

  let made = false;
  for (const candidate of ranked.slice(0, 4)) {
    const image = await panorama(candidate.view.panoramaId);
    if (!image) continue;
    // Render at what the source carries, never above it: a blurry enlargement
    // is a worse picture that looks like a better one.
    const ppm = Math.min(48, Math.max(20, Math.round(candidate.worstPixelsPerMetre)));
    const strip = rectifyWall(image, candidate.view, AMSTERDAM_CAMERA,
      [wall.start.x, wall.start.y, wall.end.x, wall.end.y], ground - 0.8, top + 0.5,
      { pixelsPerMetre: ppm, margin: 1.06, maxWidth: 1400, quality: 92,
        heightOffsetM: trackOffset(candidate.view).offsetM });
    if (!strip) continue;
    const name = `${(label.get(pandId) ?? pandId).replace(/[^A-Za-z0-9]+/g, '-')}__${pandId}__${candidate.view.capturedAt.slice(0, 10)}.jpg`;
    await writeFile(path.join(OUT, name), strip.jpeg);
    manifest.push({
      file: name, pandId, address: label.get(pandId) ?? null,
      capturedAt: candidate.view.capturedAt.slice(0, 10), panoramaId: candidate.view.panoramaId,
      wallWidthM: Number(wall.lengthM.toFixed(2)),
      wallFacingDeg: Number(wall.facingDeg.toFixed(0)),
      frontageChangedByVisibility: choice.changed,
      clearViews: choice.clearViews,
      standoffM: Number(candidate.standoffM.toFixed(1)),
      obliquityDeg: Number(candidate.obliquityDeg.toFixed(1)),
      blockedFraction: Number(candidate.blockedFraction.toFixed(2)),
      sourcePixelsPerMetre: Number(candidate.worstPixelsPerMetre.toFixed(1)),
      renderedPixelsPerMetre: ppm,
      leafOff: candidate.leafOff,
      groundZ: Number(ground.toFixed(2)), topZ: Number(top.toFixed(2)),
      wallBowM: wall.maxDeviationM ?? 0,
      size: `${strip.width}x${strip.height}`,
    });
    made = true;
    process.stdout.write(`\r  ${manifest.length}/${WANT} strips, ${downloads} downloads`);
    break;
  }
  if (!made) noView++;
}
process.stdout.write('\r');

await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify({
  metadata: {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/facade-twin/build-strip-set.ts',
    cameraModel: AMSTERDAM_CAMERA.id,
    gates: { minClearViews: MIN_CLEAR_VIEWS, maxBlockedFraction: MAX_BLOCKED,
      minSourcePixelsPerMetre: MIN_PIXELS_PER_M, maxObliquityDeg: MAX_OBLIQUITY },
    note: 'Selected on geometry and source quality, never on cross-view agreement — that '
      + 'measures image similarity rather than registration. Rendered at the rate the source '
      + 'carries, so nothing is upsampled. Street imagery © Gemeente Amsterdam, CC BY 4.0.',
  },
  strips: manifest,
}, null, 1));

const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))];
console.log(`${manifest.length} strips from ${considered} panden considered`);
console.log(`  ${noFrontage} had no frontage with ${MIN_CLEAR_VIEWS}+ clear views, ${noView} no view meeting the gates`);
console.log(`  ${downloads} panoramas downloaded`);
if (manifest.length) {
  console.log(`  source px/m   median ${q(manifest.map(m => m.sourcePixelsPerMetre), 0.5)}   min ${q(manifest.map(m => m.sourcePixelsPerMetre), 0)}`);
  console.log(`  standoff      median ${q(manifest.map(m => m.standoffM), 0.5)} m`);
  console.log(`  obliquity     median ${q(manifest.map(m => m.obliquityDeg), 0.5)}°`);
  console.log(`  leaf-off      ${manifest.filter(m => m.leafOff).length} of ${manifest.length}`);
  console.log(`  frontage changed by visibility: ${manifest.filter(m => m.frontageChangedByVisibility).length}`);
}
console.log(`→ ${path.relative(process.cwd(), OUT)}`);
