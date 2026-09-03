/**
 * Rectify real façades out of Amsterdam's open panoramas.
 *
 * Usage:
 *   npx tsx scripts/facade-twin/rectify-facades.ts --calibrate
 *   npx tsx scripts/facade-twin/rectify-facades.ts --address="Prinsengracht 263"
 *   npx tsx scripts/facade-twin/rectify-facades.ts --heroes
 *
 * Output is a rectified orthographic elevation per building, scaled by its own
 * BAG plot width, written to .cache/facade-twin/rectified/. These are working
 * images to be measured and discarded, not assets: what ships is the numbers
 * taken off them, with the panorama id kept as the observation.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { AMSTERDAM_GRACHTENGORDEL_WEST } from '../../src/canalRecall/facade/areas.ts';
import { buildElevations, inFrontOf, obliquityDeg, standoffM } from '../../src/canalRecall/facade/elevations.ts';
import { rectifyFacade, type CameraPose, type EquirectangularImage, type YawConvention } from '../../src/canalRecall/facade/rectify.ts';
import { GEOID_SEPARATION_M, isLeafOff } from '../../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import type { LngLat, PanoramaView } from '../../src/canalRecall/facade/sources.ts';

const AREA = AMSTERDAM_GRACHTENGORDEL_WEST;
const CACHE = path.resolve('.cache/facade-twin');
const OUT = path.join(CACHE, 'rectified');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
const arg = (name: string) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3);

const registry = JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-registry.json`), 'utf8')).data as
  Array<{ buildingId: string; footprintLngLat: LngLat[] }>;
const views = JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-panoramas.json`), 'utf8')).data as PanoramaView[];
const recon = JSON.parse(await readFile(path.join(STAGING, 'recon.json'), 'utf8'));
const massing = new Map<string, any>(recon.massing.map((m: any) => [m.buildingId, m]));
const heritage = new Map<string, any>();
for (const h of recon.heritage) if (h.buildingId && h.description) heritage.set(h.buildingId, h);

const footprints = new Map<string, ReturnType<typeof RD_NEW.fromLngLat>[]>();
for (const entry of registry) {
  if (footprints.has(entry.buildingId)) continue;
  footprints.set(entry.buildingId, entry.footprintLngLat.map(p => RD_NEW.fromLngLat(p)));
}
const posed = views.map(view => ({ view, point: RD_NEW.fromLngLat(view.lngLat) }));

/** Resolve a street address to its BAG building via PDOK, as the checks do. */
async function buildingIdFor(address: string): Promise<string> {
  const [street, number] = [address.replace(/\s+\d+\w*$/, ''), address.match(/(\d+)\w*$/)?.[1]];
  const url = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=*:*&rows=1&fq=type:adres`
    + `&fq=woonplaatsnaam:Amsterdam&fq=straatnaam:%22${encodeURIComponent(street)}%22&fq=huisnummer:${number}&fl=centroide_rd`;
  const payload = await (await fetch(url)).json() as any;
  const doc = payload.response.docs[0];
  if (!doc) throw new Error(`no BAG address for ${address}`);
  const [, x, y] = doc.centroide_rd.match(/([-\d.]+) ([-\d.]+)/)!.map(Number) as unknown as number[];
  const point = { x: Number(doc.centroide_rd.match(/([-\d.]+) ([-\d.]+)/)![1]), y: Number(doc.centroide_rd.match(/([-\d.]+) ([-\d.]+)/)![2]) };
  for (const [buildingId, ring] of footprints) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      if (ring[i].y > point.y !== ring[j].y > point.y
        && point.x < ((ring[j].x - ring[i].x) * (point.y - ring[i].y)) / (ring[j].y - ring[i].y) + ring[i].x) inside = !inside;
    }
    if (inside) return buildingId;
  }
  throw new Error(`no footprint contains ${address}`);
}

const imageCache = new Map<string, EquirectangularImage>();
async function loadPanorama(view: PanoramaView): Promise<EquirectangularImage> {
  const existing = imageCache.get(view.panoramaId);
  if (existing) return existing;
  const file = path.join(CACHE, 'panoramas', `${view.panoramaId}.jpg`);
  await mkdir(path.dirname(file), { recursive: true });
  let bytes: Buffer;
  try {
    bytes = await readFile(file);
  } catch {
    const response = await fetch(view.imageUrl, { headers: { 'User-Agent': 'MapRecallFacadeTwin/1.0' }, signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`panorama image: HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    await writeFile(file, bytes);
  }
  const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
  const image = { width: decoded.width, height: decoded.height, data: decoded.data };
  imageCache.set(view.panoramaId, image);
  return image;
}

/**
 * Rank the views of one wall.
 *
 * Leaf-off first, and not as a tie-break: the pilot's canal elms sit directly
 * between the camera and the façade, and a July capture of a quay-facing wall
 * is frequently a photograph of a tree. A slightly more oblique winter view
 * beats a square-on summer one, so leaf-off is worth a fixed angular allowance
 * rather than being consulted only when angles are equal.
 *
 * After that, square-on and close, in that order — obliquity costs measurable
 * width, distance costs resolution.
 */
function viewsOf(elevation: ReturnType<typeof buildElevations>[number]) {
  const found: Array<{ pose: typeof posed[number]; obliquity: number; standoff: number; leafOff: boolean; score: number }> = [];
  for (const pose of posed) {
    if (Math.abs(pose.point.x - elevation.midpoint.x) > 60 || Math.abs(pose.point.y - elevation.midpoint.y) > 60) continue;
    if (!inFrontOf(elevation, pose.point)) continue;
    const standoff = standoffM(elevation, pose.point);
    if (standoff < 3 || standoff > 60) continue;
    const obliquity = obliquityDeg(elevation, pose.point);
    if (obliquity > 35) continue;
    const leafOff = isLeafOff(pose.view.capturedAt);
    // Lower is better. A leaf-off view is worth 25° of obliquity; a metre of
    // standoff is worth about a third of a degree.
    found.push({ pose, obliquity, standoff, leafOff, score: obliquity + standoff * 0.35 - (leafOff ? 25 : 0) });
  }
  return found.sort((a, b) => a.score - b.score);
}

/**
 * Which wall is the front.
 *
 * Not the longest — on a canal house the longest wall is usually a party wall
 * running back into the block, and on the Anne Frank Huis complex it is a rear
 * annex 60 m across the water. The front is the wall the survey car drove past,
 * so it is the one with the most near, square-on views: the street is where the
 * cameras are, and the register's address point is on it.
 */
function frontageOf(buildingId: string) {
  const walls = buildElevations(footprints.get(buildingId)!);
  let best: { wall: typeof walls[number]; view: ReturnType<typeof viewsOf>[number]; close: number } | null = null;
  for (const wall of walls) {
    const views = viewsOf(wall);
    if (!views.length) continue;
    const close = views.filter(v => v.standoff < 25 && v.obliquity < 25).length;
    const candidate = { wall, view: views[0], close };
    if (!best
      || close > best.close
      || (close === best.close && candidate.view.score < best.view.score)) best = candidate;
  }
  return best;
}

function poseOf(view: PanoramaView, point: { x: number; y: number }): CameraPose {
  return {
    x: point.x, y: point.y,
    z: view.cameraHeight - GEOID_SEPARATION_M,
    headingDeg: view.headingDeg, pitchDeg: view.pitchDeg, rollDeg: view.rollDeg,
  };
}

async function rectify(buildingId: string, label: string, yaw: YawConvention, suffix = '') {
  const found = frontageOf(buildingId);
  if (!found) { console.log(`  ${label}: no usable view`); return null; }
  const { wall, view } = found;
  const mass = massing.get(buildingId);
  const ground = mass?.groundLevel ?? 1.0;
  const ridge = mass?.ridgeHeight ?? ground + 15;

  const image = await loadPanorama(view.pose.view);
  // Optional context margin: extend the sampled plane along the wall's own
  // line, past both ends. Used to check horizontal registration — if the target
  // building does not land in the middle of a symmetric context strip, the
  // azimuth is off, and that is invisible in a tightly cropped render.
  const contextM = Number(arg('context') ?? 0);
  const wallLen = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
  const ex = ((wall.end.x - wall.start.x) / wallLen) * contextM;
  const ey = ((wall.end.y - wall.start.y) / wallLen) * contextM;
  const result = rectifyFacade(image, poseOf(view.pose.view, view.pose.point), {
    start: { x: wall.start.x - ex, y: wall.start.y - ey },
    end: { x: wall.end.x + ex, y: wall.end.y + ey },
    baseZ: ground - 1.5,          // include the stoep and any souterrain light well
    topZ: ridge + 1.5,            // and headroom above the ridge for the gable top
  }, { pixelsPerMetre: 70, yaw });

  const encoded = jpeg.encode({ width: result.width, height: result.height, data: Buffer.from(result.data) }, 88);
  await mkdir(OUT, { recursive: true });
  const file = path.join(OUT, `${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}${suffix}.jpg`);
  await writeFile(file, encoded.data);
  console.log(`  ${label}${suffix}: ${result.width}×${result.height}px, ${result.wallWidthM.toFixed(1)}×${result.wallHeightM.toFixed(1)}m`
    + ` @ ${result.pixelsPerMetre.toFixed(0)}px/m, ${view.obliquity.toFixed(1)}° off square, ${view.standoff.toFixed(1)}m away`
    + `, ${view.leafOff ? 'leaf-off' : 'LEAF-ON'} ${view.pose.view.capturedAt.slice(0, 10)}`
    + ` → ${path.relative(process.cwd(), file)}`);
  return { file, wall, view, result };
}

// ---- entry points --------------------------------------------------------
if (process.argv.includes('--calibrate')) {
  // The yaw convention is undocumented, so render both and look at them.
  const buildingId = await buildingIdFor(arg('address') ?? 'Prinsengracht 263');
  console.log(`Calibrating yaw convention on ${arg('address') ?? 'Prinsengracht 263'} (${buildingId})`);
  for (const yaw of ['centre', 'edge'] as const) await rectify(buildingId, 'calibration', yaw, `-${yaw}`);
} else {
  // Calibrated, not assumed: rendering the same wall both ways showed 'centre'
  // pointing 180° away, at a building four metres behind the camera. The two
  // conventions differ by exactly half the image width, which is why a
  // "looks like a plausible canal scene" check cannot tell them apart — in
  // Amsterdam both directions look like a plausible canal scene.
  const yaw = (arg('yaw') as YawConvention) ?? 'edge';
  const ids = arg('ids')?.split(',');
  const addresses = ids ?? (arg('address')
    ? [arg('address')!]
    : ['Prinsengracht 263', 'Keizersgracht 123', 'Herengracht 172', 'Keizersgracht 324', 'Herengracht 386', 'Singel 140']);
  console.log(`Rectifying ${addresses.length} façade(s), yaw=${yaw}`);
  const manifest = [];
  for (const address of addresses) {
    const buildingId = ids ? address : await buildingIdFor(address);
    const out = await rectify(buildingId, address, yaw);
    if (out) manifest.push({
      address, buildingId,
      panoramaId: out.view.pose.view.panoramaId,
      capturedAt: out.view.pose.view.capturedAt,
      obliquityDeg: Number(out.view.obliquity.toFixed(1)),
      standoffM: Number(out.view.standoff.toFixed(1)),
      leafOff: out.view.leafOff,
      wallWidthM: Number(out.result.wallWidthM.toFixed(2)),
      pixelsPerMetre: Number(out.result.pixelsPerMetre.toFixed(1)),
      registerSays: heritage.get(buildingId)?.description ?? null,
      file: path.basename(out.file),
    });
  }
  await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify({
    attribution: '© Gemeente Amsterdam, Kernregistratie Panoramabeelden (CC BY 4.0)',
    note: 'Working images for measurement, not shippable assets. Scale is exact: pixelsPerMetre applies in both axes.',
    generatedAt: new Date().toISOString(),
    facades: manifest,
  }, null, 2));
  console.log(`\nwrote ${path.relative(process.cwd(), path.join(OUT, 'manifest.json'))}`);
}
