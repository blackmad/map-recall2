/**
 * The door band of a canal frontage, at native scale, in tiles a reader can read.
 *
 * House numbers are the one piece of evidence in a street photograph that names
 * the building rather than describing it. A detector can say "this looks like a
 * façade"; only the number says *which* façade, and that is the question this
 * project has never been able to answer from imagery.
 *
 * Three things decide whether it is readable at all, and all three are geometry:
 *
 *   - **Standoff.** A 13 cm digit subtends 1.9° at 4 m and 0.25° at 30 m. At
 *     8000 px of equirectangular width that is 41 px against 5. So numbers come
 *     from the *near-side pass* — the van driving along the building's own quay —
 *     and not from the across-canal view the façade is measured from. They are
 *     different panoramas of the same building, which is the point: an
 *     independent observation.
 *   - **Band.** Numbers sit beside doors, between about 0.5 m and 4.5 m above
 *     the pavement. Sampling the whole façade wastes resolution on windows.
 *   - **Width.** The band is deliberately wider than the pand — a frontage of
 *     context each side — because restricting the search to the wall we have
 *     guessed would let a wrong guess hide. A number found over the neighbour is
 *     a measurement, not a miss.
 *
 * Output is overlapping tiles with their along-wall metre offset recorded, so a
 * detection in tile pixels converts back to a position on the quay. Tiles rather
 * than one long strip because a recogniser rescales its input to a working
 * canvas, and a 40 m strip rescaled to fit is a 40 m strip with no digits in it.
 *
 * Usage: npx tsx scripts/facade-twin/number-bands.ts [--limit=24] [--ids=...]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { AMSTERDAM_GRACHTENGORDEL_WEST as AREA } from '../../src/canalRecall/facade/areas.ts';
import { buildElevations, inFrontOf, obliquityDeg, standoffM } from '../../src/canalRecall/facade/elevations.ts';
import { AMSTERDAM_CAMERA, hasUsablePose, isLeafOff } from '../../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import { loadTrackOffsets, resolveLens } from './panorama-render.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import type { LngLat, PanoramaView, ProjectedPoint } from '../../src/canalRecall/facade/sources.ts';

const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
const OUT = path.join(CACHE, 'number-bands');
const arg = (n: string) => process.argv.find(v => v.startsWith(`--${n}=`))?.slice(n.length + 3);

const MAX_PIXELS_PER_M = Number(arg('ppm') ?? 260);
/**
 * Below this, the source simply does not carry a house number.
 *
 * A Dutch doorplate digit is 10–15 cm. At 45 px/m that is 5–7 px tall, which no
 * recogniser reads and no amount of upsampling recovers — enlargement adds
 * pixels, not evidence. Tiles under the floor are dropped and counted, so the
 * coverage figure is honest about what the imagery can and cannot support.
 */
const MIN_NATIVE_PIXELS_PER_M = Number(arg('min-ppm') ?? 45);
const BASE_ABOVE_GROUND = 0.4, TOP_ABOVE_GROUND = 4.6;
const CONTEXT_FRONTAGES = 0.7;
const MAX_SPAN_M = 34;
const TILE_M = 5.5, TILE_OVERLAP_M = 1.5;

const registry = JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-registry.json`), 'utf8')).data as
  Array<{ buildingId: string; footprintLngLat: LngLat[] }>;
const views = JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-panoramas.json`), 'utf8')).data as PanoramaView[];
const recon = JSON.parse(await readFile(path.join(STAGING, 'recon.json'), 'utf8'));
const massing = new Map<string, any>(recon.massing.map((m: any) => [m.buildingId, m]));
const store = JSON.parse(await readFile(path.join(STAGING, 'measured-facades.json'), 'utf8')).facades as Record<string, any>;

const footprints = new Map<string, ProjectedPoint[]>();
for (const e of registry) if (!footprints.has(e.buildingId)) footprints.set(e.buildingId, e.footprintLngLat.map(p => RD_NEW.fromLngLat(p)));

const posed = views.filter(hasUsablePose).map(v => ({ v, p: RD_NEW.fromLngLat(v.lngLat) }));
const offsetOf = await loadTrackOffsets(CACHE);

const AUDIT = process.argv.includes('--audit-views');
const ids = (arg('ids') ?? '').split(',').filter(Boolean);
const limit = Number(arg('limit') ?? 24);
const queue = ids.length ? ids : Object.keys(store).sort();

await mkdir(OUT, { recursive: true });
const manifest: any[] = [];
const audit: Array<{ pandId: string; chosenObliquity: number; chosenPpm: number; bestObliquity: number; bestPpm: number; candidates: number }> = [];
let done = 0, downloaded = 0;

for (const pandId of queue) {
  if (done >= (ids.length ? ids.length : limit)) break;
  const record = store[pandId], ring = footprints.get(pandId), mass = massing.get(pandId);
  if (!record || !ring || !Number.isFinite(mass?.groundLevel)) continue;

  const [x0, y0, x1, y1] = record.wall;
  const mid = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
  const wall = buildElevations(ring)
    .map(e => ({ e, d: Math.hypot(e.midpoint.x - mid.x, e.midpoint.y - mid.y) }))
    .sort((a, b) => a.d - b.d)[0].e;

  /**
   * The closest view that can actually see the plaque.
   *
   * Not simply the nearest camera: a camera in the wall's own plane is at zero
   * standoff and 90° obliquity, and sees the façade edge-on. Leaf-off is
   * preferred but not required — a bare tree in front of a door still hides it,
   * and the ranking says so by preferring the squarer view.
   */
  const candidates = posed
    .filter(q => inFrontOf(wall, q.p))
    .map(q => ({ ...q, standoff: standoffM(wall, q.p), obliquity: obliquityDeg(wall, q.p) }))
    .filter(q => q.standoff >= 3 && q.standoff <= 18 && q.obliquity <= 55)
    // Resolution on the wall, not proximity: a camera 3 m away at 50° off
    // square delivers less across the façade than one 8 m away and square on.
    // 1250 px per radian is the equirectangular scale at 8000 px width.
    .map(q => ({ ...q, wallPixelsPerMetre: (1250 / q.standoff) * Math.cos((q.obliquity * Math.PI) / 180) }))
    .sort((a, b) => b.wallPixelsPerMetre - a.wallPixelsPerMetre);
  /**
   * Spend a bounded amount of resolution to stand square on.
   *
   * Resolution alone chose the camera until now, and cos is a feeble penalty --
   * 6% at 20° against a standoff term that varies by half -- so the close,
   * oblique camera won almost every time: the median band was shot at 15.1° when
   * a 3.1° view was available, and 107 of 366 panden could have been square-on
   * and were not.
   *
   * It matters because obliquity does not merely foreshorten. It makes the map
   * from image column to position along the wall ill-conditioned, so the same
   * pixel error lands further from where it belongs -- and a band that cannot
   * say *where* a plate is cannot say *whose* it is. Measured over the 400-pand
   * run: a band within 10° of square confirms its own house number 89% of the
   * time and one beyond 10° confirms 65% (z=2.16). Four fields were compared and
   * only this one separated, so the statistic alone would be thin; it is the
   * mechanism that makes it worth acting on.
   *
   * So: among the views that keep most of the best available resolution, take
   * the squarest. The floor is what stops this trading away the plate itself --
   * a 13 cm digit needs about 17 px, and the swap costs 18% of resolution at the
   * median but would halve it for the worst tenth.
   */
  const RESOLUTION_FLOOR = 0.7;
  const pool = candidates.filter(q => isLeafOff(q.v.capturedAt));
  const ranked = pool.length ? pool : candidates;
  const affordable = ranked.filter(q => q.wallPixelsPerMetre >= ranked[0].wallPixelsPerMetre * RESOLUTION_FLOOR);
  const chosen = affordable.reduce((a, b) => (b.obliquity < a.obliquity ? b : a), affordable[0]);
  if (!chosen) continue;

  /**
   * Was a squarer view available, and what would it have cost?
   *
   * Measured over the 400-pand run, a band shot within 10° of square confirms
   * its own house number 89% of the time and one beyond 10° confirms 65%. The
   * ranking penalises obliquity only by cos, which is 6% at 20° against a
   * standoff term that varies by half -- so the close, oblique camera keeps
   * winning. This says how much room there is to change that, before anything
   * is re-rendered.
   */
  if (AUDIT) {
    const leafOff = candidates.filter(q => isLeafOff(q.v.capturedAt));
    const pool = leafOff.length ? leafOff : candidates;
    const squarest = pool.reduce((a, b) => (b.obliquity < a.obliquity ? b : a));
    audit.push({
      pandId,
      chosenObliquity: Number(chosen.obliquity.toFixed(1)),
      chosenPpm: Number(chosen.wallPixelsPerMetre.toFixed(0)),
      bestObliquity: Number(squarest.obliquity.toFixed(1)),
      bestPpm: Number(squarest.wallPixelsPerMetre.toFixed(0)),
      candidates: pool.length,
    });
    done++;
    continue;
  }

  const file = path.join(CACHE, 'panoramas', `${chosen.v.panoramaId}.jpg`);
  if (!existsSync(file)) {
    if (!chosen.v.imageUrl) continue;
    try {
      const response = await fetch(chosen.v.imageUrl, { signal: AbortSignal.timeout(90_000) });
      if (!response.ok) continue;
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 100_000) continue;
      await writeFile(file, bytes);
      downloaded++;
    } catch { continue; }
  }
  let image;
  try { image = jpeg.decode(await readFile(file), { useTArray: true, formatAsRGBA: true }); } catch { continue; }

  const ground = mass.groundLevel;
  // This band is the most datum-sensitive thing the project renders, and it was
  // the one place that ignored the datum. It deliberately picks the closest
  // usable camera -- a 13 cm digit needs pixels -- and at a 4 m standoff half a
  // metre of lens error is about seven degrees of aim, which walks a door-height
  // band up to the first-floor windows. That is what was happening: the tiles
  // were photographs of brickwork and window mullions, the recogniser dutifully
  // found digit-shaped texture in them, and 21 of 30 panden came back unread.
  const lens = resolveLens(chosen.v, offsetOf, ground);
  if (!lens) continue;
  const pose = lens.pose;
  const baseZ = ground + BASE_ABOVE_GROUND, topZ = ground + TOP_ABOVE_GROUND;

  // The band runs along the wall's own line, extended by a frontage each side.
  const ux = (wall.end.x - wall.start.x) / wall.lengthM, uy = (wall.end.y - wall.start.y) / wall.lengthM;
  const pad = Math.min(wall.lengthM * CONTEXT_FRONTAGES, (MAX_SPAN_M - wall.lengthM) / 2);
  const spanM = wall.lengthM + Math.max(0, pad) * 2;
  const originX = wall.start.x - ux * pad, originY = wall.start.y - uy * pad;

  const tiles: any[] = [];
  let thin = 0;
  const midZ = (baseZ + topZ) / 2;
  /** Source pixels per metre actually delivered across a stretch of the band. */
  const nativePixelsPerMetre = (fromM: number, toM: number) => {
    const at = (m: number) => AMSTERDAM_CAMERA.project(
      [originX + ux * m - pose.x, originY + uy * m - pose.y, midZ - pose.z], pose, image);
    const [ua] = at(fromM), [ub] = at(toM);
    let du = ub - ua;
    while (du > image.width / 2) du -= image.width;
    while (du < -image.width / 2) du += image.width;
    return Math.abs(du) / Math.max(1e-6, toM - fromM);
  };

  for (let startM = 0; startM < spanM - 0.5; startM += TILE_M - TILE_OVERLAP_M) {
    const lengthM = Math.min(TILE_M, spanM - startM);
    const native = nativePixelsPerMetre(startM, startM + lengthM);
    if (native < MIN_NATIVE_PIXELS_PER_M) { thin++; continue; }
    // Sample at the rate the source carries, never above it.
    const scale = Math.min(MAX_PIXELS_PER_M, native);
    const width = Math.round(lengthM * scale);
    const height = Math.round((topZ - baseZ) * scale);
    if (width < 40) continue;
    const data = new Uint8ClampedArray(width * height * 4);
    let missing = 0;
    for (let py = 0; py < height; py++) {
      const z = topZ - ((py + 0.5) / height) * (topZ - baseZ);
      for (let px = 0; px < width; px++) {
        const along = startM + ((px + 0.5) / width) * lengthM;
        const [u, v] = AMSTERDAM_CAMERA.project(
          [originX + ux * along - pose.x, originY + uy * along - pose.y, z - pose.z], pose, image);
        const sx = Math.round(((u % image.width) + image.width) % image.width), sy = Math.round(v);
        const d = (py * width + px) * 4;
        data[d + 3] = 255;
        if (sy < 0 || sy >= image.height) { missing++; continue; }
        const s = (sy * image.width + sx) * 4;
        data[d] = image.data[s]; data[d + 1] = image.data[s + 1]; data[d + 2] = image.data[s + 2];
      }
    }
    // Tiles are named for everything that determines their content, so a
    // regenerated tile lands beside its predecessors rather than on top of one.
    // Derived imagery is expensive to make and impossible to reconstruct once
    // the inputs move on: nothing here deletes.
    const name = `${pandId}__${chosen.v.panoramaId}__${startM.toFixed(1)}__${Math.round(scale)}ppm.jpg`;
    if (!existsSync(path.join(OUT, name))) {
      await writeFile(path.join(OUT, name), jpeg.encode({ width, height, data: Buffer.from(data) }, 93).data);
    }
    tiles.push({ file: name, startM: Number(startM.toFixed(2)), lengthM: Number(lengthM.toFixed(2)), width, height,
      pixelsPerMetre: Number(scale.toFixed(1)), nativePixelsPerMetre: Number(native.toFixed(1)),
      missingFraction: Number((missing / (width * height)).toFixed(3)) });
  }
  if (!tiles.length) continue;

  manifest.push({
    pandId,
    panoramaId: chosen.v.panoramaId,
    capturedAt: chosen.v.capturedAt,
    standoffM: Number(chosen.standoff.toFixed(1)),
    obliquityDeg: Number(chosen.obliquity.toFixed(1)),
    leafOff: isLeafOff(chosen.v.capturedAt),
    maxPixelsPerMetre: MAX_PIXELS_PER_M,
    tilesDroppedTooCoarse: thin,
    // The band's own frame, so a tile pixel converts back to a world point.
    origin: { x: originX, y: originY }, direction: { x: ux, y: uy },
    spanM: Number(spanM.toFixed(2)), wallStartM: Number(pad.toFixed(2)), wallEndM: Number((pad + wall.lengthM).toFixed(2)),
    baseZ, topZ, tiles,
    // What the lens correction did here, so a band that read nothing can be
    // told apart from a band that was aimed with no correction available.
    datumOffsetM: Number(lens.offsetM.toFixed(3)), datumSource: lens.offsetSource,
    heightInferred: lens.heightInferred,
  });
  done++;
  process.stdout.write(`\r  ${done} panden, ${downloaded} panoramas downloaded`);
}
process.stdout.write('\r');

if (AUDIT) {
  const q = (a: number[], f: number) => a.length ? [...a].sort((x, y) => x - y)[Math.floor(f * a.length)] : 0;
  const chosen = audit.map(a => a.chosenObliquity), best = audit.map(a => a.bestObliquity);
  const squareNow = audit.filter(a => a.chosenObliquity <= 10).length;
  const squarePossible = audit.filter(a => a.bestObliquity <= 10).length;
  const gained = audit.filter(a => a.chosenObliquity > 10 && a.bestObliquity <= 10);
  const cost = gained.map(a => a.bestPpm / a.chosenPpm);
  console.log(`view audit over ${audit.length} panden\n`);
  console.log(`  obliquity chosen now   p50 ${q(chosen, 0.5).toFixed(1)}°  p90 ${q(chosen, 0.9).toFixed(1)}°`);
  console.log(`  squarest available     p50 ${q(best, 0.5).toFixed(1)}°  p90 ${q(best, 0.9).toFixed(1)}°`);
  console.log(`  within 10° of square:  ${squareNow} now, ${squarePossible} possible`
    + ` — ${gained.length} panden could be square-on and are not`);
  if (cost.length) {
    console.log(`  what the swap would cost those ${gained.length}: resolution × ${q(cost, 0.5).toFixed(2)} at the median,`
      + ` × ${q(cost, 0.1).toFixed(2)} at the 10th centile`);
  }
  console.log(`\n  (a 13 cm digit needs about 17 px, so a factor much below 0.5 loses the plate)`);
  process.exit(0);
}

await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify({
  metadata: {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/facade-twin/number-bands.ts',
    cameraModel: AMSTERDAM_CAMERA.id,
    note: 'Door-height bands sampled from the near-side pass, wider than the pand by one frontage '
      + 'each side so a wrong wall cannot hide. startM is measured along the band from origin.',
  },
  bands: manifest,
}, null, 1));
const kept = manifest.reduce((s, b) => s + b.tiles.length, 0);
const dropped = manifest.reduce((s, b) => s + b.tilesDroppedTooCoarse, 0);
const ppms = manifest.flatMap(b => b.tiles.map((t: any) => t.nativePixelsPerMetre)).sort((a: number, b: number) => a - b);
console.log(`${manifest.length} bands, ${kept} tiles kept, ${dropped} dropped below ${MIN_NATIVE_PIXELS_PER_M} px/m, ${downloaded} panoramas downloaded`);
if (ppms.length) console.log(`  native resolution across kept tiles: median ${ppms[Math.floor(ppms.length / 2)]} px/m `
  + `(a 13 cm digit is ${(0.13 * ppms[Math.floor(ppms.length / 2)]).toFixed(0)} px)`);
console.log(`→ ${path.relative(process.cwd(), OUT)}`);
