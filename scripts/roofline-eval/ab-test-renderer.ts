/**
 * A/B test: does the CANAL-BELT renderer (`rectifyWall`, building-twin
 * worktree, branch `feat/roofline-strips`) explain the +3.2 m roofline
 * offset, or does the same wall/panorama land near 3DBAG's `b3_h_dak_max`
 * when rendered with `rectifyFacade` (the renderer A5 already validated
 * against real scan ground truth, landing within 0.34-0.45 m on its clean
 * elevations)?
 *
 * Both renderers share the SAME angular projection math for the
 * world-aligned camera (`equirectangular()` in roofline-strips' rectify.ts
 * vs `directionToPixel()` here -- compared by hand, identical formulas:
 * azimuth = atan2(dx,dy), elevation = asin(dz/len), u = azimuth/(2*PI) +
 * 0.5, v = 0.5 - elevation/PI). So the one variable genuinely isolated by
 * this test is the CAMERA POSE:
 *   - rectifyWall (path A, "as cut"): pose.z = cameraHeight - heightOffsetM
 *     - GEOID_SEPARATION_M, where heightOffsetM is `solve-track-datum.ts`'s
 *     per-run/per-segment correction (`loadTrackOffsets`), recorded in the
 *     v2 manifest's `lensVerdict.offsetM`.
 *   - rectifyFacade (path B, A5's method): pose.z = cameraHeight -
 *     GEOID_SEPARATION_M (`lensFor`'s non-inferred branch) -- NO track
 *     offset.
 * Path A is not re-rendered here: the existing v2 strip file already IS
 * that render (same code, same inputs), so it is reused directly rather
 * than reproduced. Only path B is newly rendered, with the SAME wall plane
 * extent (ground - 0.8 to 3DBAG roof max + 6 m -- already exact for these 5
 * walls per `check-stale-massing.ts`) and the closest achievable match on
 * pixels-per-metre and horizontal margin (rectifyWall's `margin: 1.06` is
 * reproduced by extending the plane's start/end outward by the v2 frame's
 * own `marginM` on each side).
 *
 * Run: npx tsx scripts/roofline-eval/ab-test-renderer.ts
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import sharp from 'sharp';
import { AMSTERDAM_WORLD_ALIGNED, rectifyFacade, type FacadePlane } from '../../src/canalRecall/facade/rectify.ts';
import { lngLatToRd } from '../../src/canalRecall/facade/rdNew.ts';
import { stripFrame } from '../../src/canalRecall/facade/stripFrame.ts';
import { stripBoundaries, rescueSky, resampleProfile, type Luma, type Mask } from '../../src/canalRecall/facade/stripRoofline.ts';
import type { StripFrame } from '../../src/canalRecall/facade/stripFrame.ts';

const buildingTwinCache = '/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-building-twin/.cache/facade-twin';
const v2StripsDir = path.join(buildingTwinCache, 'strips-roofline-v2');
const v2MasksDir = '/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-facade-rebuild/.cache/roofline-eval/v2/masks/s1';
const panoramaListingPath = path.join(buildingTwinCache, 'amsterdam-grachtengordel-west-panoramas.json');
const panoramaDir = path.join(buildingTwinCache, 'panoramas');
const threeDBagCachePath = '/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-facade-rebuild/.cache/roofline-eval/3dbag/3dbag-strips.json';
const outDir = '/Users/blackmad/Code/map-recall2/.worktrees/amsterdam-facade-rebuild/.cache/roofline-eval/ab-renderer-test';
const GEOID_SEPARATION_M = 43.5;

const TARGET_ADDRESSES = ['Herengracht 203', 'Herengracht 163', 'Singel 279', 'Keizersgracht 149', 'Singel 273'];

interface ManifestStrip {
  file: string; pandId: string; address: string | null; panoramaId: string;
  frame: StripFrame; lensVerdict: { inferred: boolean; lensZNap: number; offsetM: number; offsetSource: string };
}
const v2Manifest = JSON.parse(await readFile(path.join(v2StripsDir, 'manifest.json'), 'utf8')) as { strips: ManifestStrip[] };
const chosen: ManifestStrip[] = [];
for (const address of TARGET_ADDRESSES) {
  const strip = v2Manifest.strips.find(s => s.address === address);
  if (!strip) { console.warn(`no v2 strip for ${address}`); continue; }
  chosen.push(strip);
}

const panoramaListing = JSON.parse(await readFile(panoramaListingPath, 'utf8')) as { data: Array<{ panoramaId: string; lngLat: [number, number]; cameraHeight: number }> };
const panoById = new Map(panoramaListing.data.map(p => [p.panoramaId, p]));

interface ThreeDBagCache { features: Array<{ pandId: string; response: unknown }> }
const threeDBagCache = JSON.parse(await readFile(threeDBagCachePath, 'utf8')) as ThreeDBagCache;
const threeDBagByPand = new Map<string, unknown>(threeDBagCache.features.map(f => [f.pandId, f.response]));
function roofMaxFor(pandId: string): number | null {
  const response = threeDBagByPand.get(pandId) as { feature?: { CityObjects?: Record<string, { type?: string; attributes?: Record<string, unknown> }> } } | undefined;
  const cityObjects = response?.feature?.CityObjects ?? {};
  for (const object of Object.values(cityObjects)) {
    if (object.type !== 'Building') continue;
    const v = object.attributes?.b3_h_dak_max;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
}

await mkdir(outDir, { recursive: true });

async function loadLuma(buf: Buffer): Promise<Luma> {
  const { data, info } = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, values: new Uint8Array(data.buffer, data.byteOffset, data.length) };
}
async function loadMaskFile(file: string): Promise<Mask> {
  const { data, info } = await sharp(file).greyscale().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 1) throw new Error(`${file}: expected 1-channel mask, got ${info.channels}`);
  return { width: info.width, height: info.height, labels: new Uint8Array(data.buffer, data.byteOffset, data.length) };
}

/** Median of resolved `up` values -- a robust single-number "roofline height" per view, matching how medianOffset elsewhere summarises a profile. */
function medianUp(profile: Array<[number, number | null]>): number | null {
  const ups = profile.map(([, up]) => up).filter((u): u is number => u !== null);
  if (!ups.length) return null;
  const sorted = [...ups].sort((a, b) => a - b);
  const n = sorted.length;
  return n % 2 === 1 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

const results: Array<{
  address: string; pandId: string; panoramaId: string; roofMax3dbag: number | null;
  pathAFile: string; pathAFrame: StripFrame; pathACoverage: number; pathAMedianUp: number | null;
  pathBFile: string; pathBFrame: StripFrame;
  poseA: { note: string; cameraHeight: number; offsetM: number; z: number };
  poseB: { note: string; cameraHeight: number; z: number };
}> = [];

for (const strip of chosen) {
  const pano = panoById.get(strip.panoramaId);
  if (!pano) { console.warn(`${strip.address}: panorama metadata not found for ${strip.panoramaId}`); continue; }
  const roofMax3dbag = roofMaxFor(strip.pandId);
  const frame = strip.frame;

  // ---- Path A: reuse the existing v2 strip (rectifyWall, WITH track offset) ----
  const pathAFile = path.join(v2StripsDir, strip.file);
  const pathAMaskFile = path.join(v2MasksDir, strip.file.replace(/\.jpg$/i, '.mask.png'));
  const lumaA = await loadLuma(await readFile(pathAFile));
  const maskA = await loadMaskFile(pathAMaskFile);
  const rescueA = rescueSky(maskA, lumaA);
  const boundariesA = stripBoundaries({ width: maskA.width, height: maskA.height, labels: rescueA.labels }, lumaA);
  const profileA = resampleProfile(frame, boundariesA.rowPx);
  const coverageA = boundariesA.rowPx.filter(v => v !== null).length / boundariesA.rowPx.length;

  // ---- Path B: rectifyFacade, pose WITHOUT track offset (A5's method) ----
  const poseXY = lngLatToRd(pano.lngLat);
  const poseZ = pano.cameraHeight - GEOID_SEPARATION_M; // lensFor's non-inferred branch; none of these 5 are inferred
  const pose = { x: poseXY.x, y: poseXY.y, z: poseZ, headingDeg: 0, pitchDeg: 0, rollDeg: 0 };

  // Extend the plane outward by the v2 frame's own marginM, to reproduce rectifyWall's `margin: 1.06` as closely as rectifyFacade's API allows.
  const dx = frame.end.x - frame.start.x, dy = frame.end.y - frame.start.y;
  const wallLen = Math.hypot(dx, dy);
  const ux = dx / wallLen, uy = dy / wallLen;
  const extendedStart = { x: frame.start.x - ux * frame.marginM, y: frame.start.y - uy * frame.marginM };
  const extendedEnd = { x: frame.end.x + ux * frame.marginM, y: frame.end.y + uy * frame.marginM };
  const plane: FacadePlane = { start: extendedStart, end: extendedEnd, baseZ: frame.bottomNap, topZ: frame.topNap };

  const image = jpeg.decode(await readFile(path.join(panoramaDir, `${strip.panoramaId}.jpg`)), { useTArray: true, formatAsRGBA: true });
  const rect = rectifyFacade(image, pose, plane, { camera: AMSTERDAM_WORLD_ALIGNED, pixelsPerMetre: frame.requestedPixelsPerMetre, maxPixels: 6_000_000 });
  const pathBFile = path.join(outDir, `${strip.pandId}__pathB.jpg`);
  await writeFile(pathBFile, jpeg.encode({ width: rect.width, height: rect.height, data: Buffer.from(rect.data) }, 92).data);

  const pathBFrame = stripFrame({
    wallStart: frame.start, wallEnd: frame.end, bottomNap: frame.bottomNap, topNap: frame.topNap,
    marginFactor: (wallLen + 2 * frame.marginM) / wallLen, requestedPixelsPerMetre: frame.requestedPixelsPerMetre,
    renderedWidth: rect.width, renderedHeight: rect.height,
  });

  results.push({
    address: strip.address ?? strip.pandId, pandId: strip.pandId, panoramaId: strip.panoramaId, roofMax3dbag,
    pathAFile, pathAFrame: frame, pathACoverage: coverageA, pathAMedianUp: medianUp(profileA),
    pathBFile: `${strip.pandId}__pathB.jpg`, pathBFrame,
    poseA: { note: 'rectifyWall (existing v2 render); z = cameraHeight - offsetM - GEOID', cameraHeight: pano.cameraHeight, offsetM: strip.lensVerdict.offsetM, z: pano.cameraHeight - strip.lensVerdict.offsetM - GEOID_SEPARATION_M },
    poseB: { note: 'rectifyFacade (A5 method); z = cameraHeight - GEOID, no track offset', cameraHeight: pano.cameraHeight, z: poseZ },
  });
  console.log(`${strip.address}: path A (existing v2 strip) coverage ${(coverageA * 100).toFixed(0)}%, median up ${medianUp(profileA)?.toFixed(2) ?? 'n/a'} -- rendered path B to ${pathBFile} (${rect.width}x${rect.height})`);
}

// segment.py-compatible manifest so `segment.py --strips=<outDir>` works unmodified.
await writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify({
  metadata: { note: 'A/B renderer test path-B crops (rectifyFacade, no track offset)' },
  strips: results.map(r => ({ file: r.pathBFile, pandId: r.pandId, address: r.address })),
}, null, 2)}\n`);
await writeFile(path.join(outDir, 'ab-manifest.json'), `${JSON.stringify(results, null, 2)}\n`);
console.log(`\nWrote ${results.length} path-B renders, manifest.json (for segment.py), and ab-manifest.json to ${outDir}`);
