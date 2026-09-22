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
 *     [--headroom-m=0.5] [--views-per-wall=1] [--out=<dir>] [--pands-from=<manifest.json>]
 *
 * `--headroom-m` replaces the fixed half-metre of sky above the roof, so a
 * roofline has room to be found above the 3DBAG ridge. `--views-per-wall` keeps
 * the best *n* qualifying views per wall instead of stopping at the first, and
 * requires them to be at least three metres apart so the extra views are
 * genuinely different rather than the same pass twice. `--pands-from` re-cuts
 * exactly the pand IDs named by an earlier manifest, which is how a set is
 * re-rendered with a different frame without re-selecting the buildings.
 */
import { execSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jpeg from 'jpeg-js';
import { AMSTERDAM_GRACHTENGORDEL_WEST as AREA } from '../../src/canalRecall/facade/areas.ts';
import { AMSTERDAM_CAMERA, hasUsableGeometry, lensHeightNap } from '../../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import { isAtLeastApart, pickDistinctViews, stripFrame } from '../../src/canalRecall/facade/stripFrame.ts';
import { loadTrackOffsets, rectifyWall } from './panorama-render.ts';
import { blockedFraction, buildProbe, chooseFrontage, rankViews, verticalPixelsPerMetre } from './frontage.ts';
import type { LngLat, PanoramaView, ProjectedPoint } from '../../src/canalRecall/facade/sources.ts';

const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
const arg = (n: string) => process.argv.find(v => v.startsWith(`--${n}=`))?.slice(n.length + 3);
// Defaults preserve the original run exactly: half a metre above the ridge,
// one view per wall, into strips-confident.
const HEADROOM_M = Number(arg('headroom-m') ?? 0.5);
const VIEWS_PER_WALL = Math.max(1, Math.floor(Number(arg('views-per-wall') ?? 1)));
const MIN_VIEW_SEPARATION_M = 3;
const PANDS_FROM = arg('pands-from');
const OUT = arg('out') ? path.resolve(arg('out')!) : path.join(CACHE, 'strips-confident');
const WANT = arg('count') !== undefined ? Number(arg('count'))
  : PANDS_FROM ? Number.POSITIVE_INFINITY : 80;
const DOWNLOAD_BUDGET = Number(arg('downloads') ?? 150);
const GENERATOR_SHA = (() => {
  try { return execSync('git rev-parse HEAD', { cwd: path.dirname(fileURLToPath(import.meta.url)) }).toString().trim(); }
  catch { return null; }
})();

// Gates. Every one is knowable before rendering.
const MIN_CLEAR_VIEWS = 30;
const MAX_BLOCKED = 0.12;
const MIN_PIXELS_PER_M = 34;
const MAX_OBLIQUITY = 25;
/** Where the density gate is evaluated: the wall top, above the eave. */
const WALL_TOP_OFFSET_M = 0.5;
/** The survey lens height `rankViews` assumes when it scores sampling. */
const LENS_HEIGHT_M = 2.4;

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

/** Greyscale spread of a rendered strip, or null if it cannot be read back. */
function standardDeviation(encoded: Buffer): number | null {
  try {
    const image = jpeg.decode(encoded, { useTArray: true, formatAsRGBA: true });
    let sum = 0, sumSquares = 0, count = 0;
    for (let i = 0; i < image.data.length; i += 4 * 17) {
      const grey = (image.data[i] + image.data[i + 1] + image.data[i + 2]) / 3;
      sum += grey; sumSquares += grey * grey; count++;
    }
    if (!count) return null;
    const mean = sum / count;
    return Math.sqrt(Math.max(0, sumSquares / count - mean * mean));
  } catch { return null; }
}

let downloads = 0;
/**
 * Why a panorama could not be produced, so "no image" is a count per cause
 * rather than one number that hides whether the network, the budget or the
 * source file is at fault.
 */
const imageFailure = { budget: 0, noUrl: 0, download: 0, undecodable: 0 };
/** Source-frame mean luma per panorama, for flagging underexposed renders. */
const sourceMeanLuma = new Map<string, number>();
async function panorama(id: string) {
  const file = path.join(CACHE, 'panoramas', `${id}.jpg`);
  if (!existsSync(file)) {
    if (downloads >= DOWNLOAD_BUDGET) { imageFailure.budget++; return null; }
    const view = byId.get(id);
    if (!view?.imageUrl) { imageFailure.noUrl++; return null; }
    try {
      const response = await fetch(view.imageUrl, { signal: AbortSignal.timeout(120_000) });
      if (!response.ok) { imageFailure.download++; return null; }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 100_000) { imageFailure.download++; return null; }
      await writeFile(file, bytes);
      downloads++;
    } catch { imageFailure.download++; return null; }
  }
  try {
    const image = jpeg.decode(await readFile(file), { useTArray: true, formatAsRGBA: true });
    /**
     * The source frame's own brightness, so a strip cut from an underexposed
     * frame can be flagged rather than shipped as noise. Geometry, occlusion
     * and resolution gates are all blind to exposure: a dark frame scores as
     * well as a bright one and rectifies into mostly JPEG grain.
     */
    let sum = 0, count = 0;
    for (let i = 0; i < image.data.length; i += 4 * 997) {
      sum += (image.data[i] + image.data[i + 1] + image.data[i + 2]) / 3;
      count++;
    }
    sourceMeanLuma.set(id, count ? sum / count : 0);
    return image;
  } catch { imageFailure.undecodable++; return null; }
}

// Re-cutting "exactly these pand IDs" is a promise, so an unnamed pand list
// removes the count cap rather than letting `--count` quietly truncate it.
let pandIds = Object.keys(store).sort();
if (PANDS_FROM) {
  const source = path.resolve(PANDS_FROM);
  if (!existsSync(source)) { console.error(`--pands-from=${PANDS_FROM} does not exist`); process.exit(1); }
  const old = await read(source, { strips: [] });
  const wanted = new Set<string>((old?.strips ?? []).map((s: any) => s.pandId).filter(Boolean));
  pandIds = [...wanted].filter(id => footprints.has(id) && massing.has(id)).sort();
  console.log(`${pandIds.length} of ${wanted.size} pands named by ${path.relative(process.cwd(), source)} have a footprint and massing`);
}

await mkdir(OUT, { recursive: true });
const manifest: any[] = [];
let considered = 0, missing = 0, noFrontage = 0, noViewGeometry = 0, ppmTooLow = 0, noRender = 0, tooClose = 0;
const renderDrop = { image: 0, lens: 0, strip: 0, blank: 0 };

for (const pandId of pandIds) {
  if (manifest.length >= WANT) break;
  const ring = footprints.get(pandId), mass = massing.get(pandId), record = store[pandId];
  /**
   * A named pand is authoritative; the measured-facade record is not a gate.
   *
   * The record carries only an old wall *proposal*, and `chooseFrontage` does
   * not use the proposal to choose — it is compared afterwards and reported as
   * `frontageChangedByVisibility`. Requiring it therefore narrows a re-cut to
   * whichever pands happen to survive in the latest `measured-facades.json`,
   * which is a property of that file's generation, not of the building. When
   * this run is handed an explicit pand list, the footprint and massing are
   * what it needs, and the proposal is a bonus.
   */
  if (!ring || (!PANDS_FROM && !record) || !Number.isFinite(mass?.groundLevel)) { missing++; continue; }
  considered++;

  const choice = chooseFrontage(ring, pandId, probe,
    { proposal: record?.wall ?? null, addressPoints: addressesOf.get(pandId) ?? [] });
  if (!choice.elevation || choice.clearViews < MIN_CLEAR_VIEWS) { noFrontage++; continue; }
  const wall = choice.elevation;

  const ground = mass.groundLevel;
  const top = Math.max(mass.ridgeHeight ?? 0, mass.eavesHeight ?? 0, ground + 8);
  const bottomNap = ground - 0.8;
  const topNap = top + HEADROOM_M;

  /**
   * The density gate is pinned to the wall top, and the headroom band above it
   * never disqualifies a wall.
   *
   * The gate exists to stop a wall being resampled at more detail than its
   * source carries, and the wall is what has to be resolved. Headroom is empty
   * sky added for the roofline work, so letting it veto the wall would throw
   * away buildings whose façades are perfectly well photographed. Instead the
   * gate is evaluated at `top + 0.5` — the height the strip's top edge sat at
   * before headroom existed — for every run, and the headroom band carries its
   * own number, `roofBandPixelsPerMetre`, so the roofline step can abstain on a
   * band that is too coarse without the strip being refused outright.
   */
  const gateTopNap = top + WALL_TOP_OFFSET_M;
  const ranked = rankViews(wall, pandId, probe, posed, { wallHeightM: gateTopNap - ground });
  const eligible = ranked.filter(r => r.obliquityDeg <= MAX_OBLIQUITY && r.blockedFraction <= MAX_BLOCKED);
  if (!eligible.length) { noViewGeometry++; continue; }
  const qualifying = eligible.filter(r => r.worstPixelsPerMetre >= MIN_PIXELS_PER_M);
  if (!qualifying.length) { ppmTooLow++; continue; }

  // One view is the original path, unchanged. More than one draws its
  // candidates from a set whose members are all at least three metres apart,
  // so a second view is a second position and not a second frame.
  const candidates = VIEWS_PER_WALL === 1
    ? qualifying.slice(0, 4)
    : pickDistinctViews(qualifying, VIEWS_PER_WALL * 6, MIN_VIEW_SEPARATION_M);

  const chosen: typeof ranked = [];
  for (const candidate of candidates) {
    if (chosen.length >= VIEWS_PER_WALL) break;
    if (VIEWS_PER_WALL > 1 && chosen.some(c => !isAtLeastApart(c, candidate, MIN_VIEW_SEPARATION_M))) { tooClose++; continue; }
    const image = await panorama(candidate.view.panoramaId);
    if (!image) { renderDrop.image++; continue; }
    // Render at what the source carries, never above it: a blurry enlargement
    // is a worse picture that looks like a better one.
    const ppm = Math.min(48, Math.max(20, Math.round(candidate.worstPixelsPerMetre)));
    /**
     * The lens height, inferred where the frame publishes none.
     *
     * `hasUsableGeometry` admits a frame with no published height because
     * azimuth never reads z — which is right for asking *where* a wall is and
     * wrong for rendering it. Left alone, `cameraHeight - GEOID_SEPARATION_M`
     * turns the zero into a lens 43.5 m under the quay and the strip comes out
     * white. Two of the first ninety did exactly that. `lensHeightNap` is the
     * function that exists for this, and the manifest carries its verdict so
     * the extra metre of vertical uncertainty travels with the picture.
     */
    const lens = lensHeightNap(candidate.view, ground);
    if (!lens) { renderDrop.lens++; continue; }
    const track = trackOffset(candidate.view);
    const heightOffsetM = lens.inferred ? 0 : track.offsetM;
    const strip = rectifyWall(image, candidate.view, AMSTERDAM_CAMERA,
      [wall.start.x, wall.start.y, wall.end.x, wall.end.y], bottomNap, topNap,
      { pixelsPerMetre: ppm, margin: 1.06, maxWidth: 1400, quality: 92,
        heightOffsetM, lensZNap: lens.inferred ? lens.z : null });
    if (!strip) { renderDrop.strip++; continue; }
    /**
     * A last look at the pixels before the strip counts as a strip.
     *
     * Every other gate here is geometry, checked before anything is resampled,
     * and geometry cannot notice that the render came out blank. A flat image
     * is a lens in the wrong place, a ray outside the frame, or a source that
     * failed to decode — this does not care which. Cheap, and it catches the
     * whole class rather than the one cause that prompted it.
     */
    const flat = standardDeviation(strip.jpeg);
    if (flat !== null && flat < 8) { renderDrop.blank++; continue; }
    // A second view of one wall keeps the same address and date, so it needs a
    // suffix; the first view (and every single-view strip) keeps its old name.
    const suffix = chosen.length ? `__v${chosen.length + 1}` : '';
    const name = `${(label.get(pandId) ?? pandId).replace(/[^A-Za-z0-9]+/g, '-')}__${pandId}__${candidate.view.capturedAt.slice(0, 10)}${suffix}.jpg`;
    await writeFile(path.join(OUT, name), strip.jpeg);
    manifest.push({
      file: name, pandId, address: label.get(pandId) ?? null,
      capturedAt: candidate.view.capturedAt.slice(0, 10), panoramaId: candidate.view.panoramaId,
      viewIndex: chosen.length + 1, viewsOnWall: VIEWS_PER_WALL,
      wallWidthM: Number(wall.lengthM.toFixed(2)),
      wallFacingDeg: Number(wall.facingDeg.toFixed(0)),
      // Null where there was no proposal to differ from (a named re-cut).
      frontageChangedByVisibility: record ? choice.changed : null,
      clearViews: choice.clearViews,
      standoffM: Number(candidate.standoffM.toFixed(1)),
      obliquityDeg: Number(candidate.obliquityDeg.toFixed(1)),
      blockedFraction: Number(candidate.blockedFraction.toFixed(2)),
      sourcePixelsPerMetre: Number(candidate.worstPixelsPerMetre.toFixed(1)),
      // Vertical source sampling at the top of the headroom band. The wall gate
      // does not look here, so a coarse band travels as a number the roofline
      // step can abstain on rather than as a reason to refuse the strip.
      roofBandPixelsPerMetre: Number(verticalPixelsPerMetre(
        candidate.standoffM, Math.max(1, (topNap - ground) - LENS_HEIGHT_M)).toFixed(1)),
      renderedPixelsPerMetre: ppm,
      leafOff: candidate.leafOff,
      // The source frame's own brightness; low values are underexposed frames
      // that rectify into noise, which no geometry gate can see.
      sourceMeanLuma: Number((sourceMeanLuma.get(candidate.view.panoramaId) ?? 0).toFixed(1)),
      groundZ: Number(ground.toFixed(2)), topZ: Number(top.toFixed(2)),
      wallBowM: wall.maxDeviationM ?? 0,
      heightInferred: lens.inferred,
      pixelStdDev: flat === null ? null : Number(flat.toFixed(1)),
      size: `${strip.width}x${strip.height}`,
      frame: stripFrame({
        wallStart: wall.start, wallEnd: wall.end, bottomNap, topNap,
        marginFactor: 1.06, requestedPixelsPerMetre: ppm,
        renderedWidth: strip.width, renderedHeight: strip.height,
      }),
      lensVerdict: {
        inferred: lens.inferred, lensZNap: Number(lens.z.toFixed(3)),
        offsetM: Number(heightOffsetM.toFixed(3)),
        offsetSource: lens.inferred ? 'inferred' : track.source,
      },
      generatorGitSha: GENERATOR_SHA,
    });
    chosen.push(candidate);
    process.stdout.write(`\r  ${manifest.length} strips, ${downloads} downloads`);
  }
  if (!chosen.length) noRender++;
}
process.stdout.write('\r');

const dropOuts = { missing, noFrontage, noViewGeometry, ppmTooLow, noRender, tooClose, renderDrop, imageFailure };
await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify({
  metadata: {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/facade-twin/build-strip-set.ts',
    generatorGitSha: GENERATOR_SHA,
    cameraModel: AMSTERDAM_CAMERA.id,
    headroomM: HEADROOM_M,
    viewsPerWall: VIEWS_PER_WALL,
    minViewSeparationM: MIN_VIEW_SEPARATION_M,
    pandsFrom: PANDS_FROM ? path.resolve(PANDS_FROM) : null,
    gates: { minClearViews: MIN_CLEAR_VIEWS, maxBlockedFraction: MAX_BLOCKED,
      minSourcePixelsPerMetre: MIN_PIXELS_PER_M, maxObliquityDeg: MAX_OBLIQUITY,
      minRenderedStdDev: 8 },
    dropOuts,
    note: 'Selected on geometry and source quality, never on cross-view agreement — that '
      + 'measures image similarity rather than registration. Rendered at the rate the source '
      + 'carries, so nothing is upsampled. Street imagery © Gemeente Amsterdam, CC BY 4.0.',
  },
  strips: manifest,
}, null, 1));

const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))];
const walls = new Set(manifest.map(m => m.pandId)).size;
console.log(`${manifest.length} strips from ${considered} panden considered (${walls} walls rendered)`);
console.log(`  drop-outs: ${noFrontage} no frontage with ${MIN_CLEAR_VIEWS}+ clear views, `
  + `${noViewGeometry} no view through the obliquity/occlusion gates, `
  + `${ppmTooLow} wall top too coarse for ${MIN_PIXELS_PER_M} px/m, ${noRender} no renderable view`);
console.log(`  render failures: ${renderDrop.image} image `
  + `(budget ${imageFailure.budget}, no url ${imageFailure.noUrl}, download ${imageFailure.download}, undecodable ${imageFailure.undecodable}), `
  + `${renderDrop.lens} lens, ${renderDrop.strip} strip, ${renderDrop.blank} blank`
  + `${tooClose ? `, ${tooClose} candidate views within ${MIN_VIEW_SEPARATION_M} m` : ''}`);
console.log(`  ${downloads} panoramas downloaded, ${missing} pands missing footprint/massing`);
if (manifest.length) {
  console.log(`  source px/m   median ${q(manifest.map(m => m.sourcePixelsPerMetre), 0.5)}   min ${q(manifest.map(m => m.sourcePixelsPerMetre), 0)}`);
  const band = manifest.map(m => m.roofBandPixelsPerMetre);
  console.log(`  roof band px/m  p10 ${q(band, 0.1)}  median ${q(band, 0.5)}  p90 ${q(band, 0.9)}  min ${q(band, 0)}`);
  console.log(`  standoff      median ${q(manifest.map(m => m.standoffM), 0.5)} m`);
  console.log(`  obliquity     median ${q(manifest.map(m => m.obliquityDeg), 0.5)}°`);
  console.log(`  leaf-off      ${manifest.filter(m => m.leafOff).length} of ${manifest.length}`);
  console.log(`  frontage changed by visibility: ${manifest.filter(m => m.frontageChangedByVisibility).length}`);
}
console.log(`→ ${path.relative(process.cwd(), OUT)}`);
