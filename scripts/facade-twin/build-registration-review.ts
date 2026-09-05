/**
 * A deck of buildings for a person to adjudicate, one at a time.
 *
 * Separate from the explorer on purpose. The explorer is for browsing — many
 * buildings, small pictures, a note when something catches the eye. This is for
 * deciding: one building, pictures as large as the screen allows, three
 * questions, a keystroke each, and the answer in SQLite before the next card
 * loads. Those are different jobs and a page that tries to do both does neither.
 *
 * The three questions are the ones no measurement in this project can answer,
 * in the order that makes later ones worth asking:
 *
 *   1. **Is the outline on the right building?** Identity. Everything
 *      downstream is measurement performed on the assumption that it is, and
 *      until a person has said so it is an assumption.
 *   2. **Is it on the right wall of it?** A corner building has two fronts and a
 *      deep pand has a rear; a footprint edge chosen by geometry is a proposal.
 *   3. **Can the façade actually be seen?** Occlusion is what the residual tail
 *      turned out to be — 83% of pairs that miss by two metres or more have a
 *      blocked view, against 27% of those that lock — so a reviewer's judgement
 *      here is worth more than another metric.
 *
 * Deliberately no detector boxes and no measurements on the card. A reviewer
 * shown a confident overlay agrees with it; the question is whether the
 * photograph is of the building the registry names, and nothing else belongs on
 * screen while that is being asked.
 *
 * Usage: npx tsx scripts/facade-twin/build-registration-review.ts [--limit=60]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { AMSTERDAM_GRACHTENGORDEL_WEST as AREA } from '../../src/canalRecall/facade/areas.ts';
import { buildElevations, obliquityDeg, standoffM } from '../../src/canalRecall/facade/elevations.ts';
import { AMSTERDAM_CAMERA, hasUsablePose } from '../../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import { planSvg, projectFootprint, rectifyWall } from './panorama-render.ts';
import type { LngLat, PanoramaView, ProjectedPoint } from '../../src/canalRecall/facade/sources.ts';

const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
const OUT = path.join(CACHE, 'registration-review');
const arg = (n: string) => process.argv.find(v => v.startsWith(`--${n}=`))?.slice(n.length + 3);

const readJson = async (p: string, fallback: any = null) => {
  try { return JSON.parse(await readFile(p, 'utf8')); } catch { return fallback; }
};

const registry = (await readJson(path.join(CACHE, `${AREA.areaId}-registry.json`))).data as
  Array<{ buildingId: string; footprintLngLat: LngLat[]; constructionYear?: number }>;
const views = new Map<string, PanoramaView>(
  ((await readJson(path.join(CACHE, `${AREA.areaId}-panoramas.json`))).data as PanoramaView[]).map(v => [v.panoramaId, v]));
const recon = await readJson(path.join(STAGING, 'recon.json'));
const massing = new Map<string, any>(recon.massing.map((m: any) => [m.buildingId, m]));
const store = (await readJson(path.join(STAGING, 'measured-facades.json'), { facades: {} })).facades as Record<string, any>;
const multi = (await readJson(path.join(STAGING, 'multi-view.json'), { facades: {} })).facades as Record<string, Array<{ panoramaId: string }>>;
const addressPoints = (await readJson(path.join(CACHE, 'address-points.json'), { addresses: [] })).addresses as
  Array<{ street: string; houseNumber: number; display: string; rd: ProjectedPoint; pandId: string | null }>;
const registration = (await readJson(path.join(CACHE, 'cross-view-registration.json'), { panden: [] })).panden as any[];

const footprints = new Map<string, ProjectedPoint[]>();
const years = new Map<string, number | undefined>();
for (const e of registry) if (!footprints.has(e.buildingId)) {
  footprints.set(e.buildingId, e.footprintLngLat.map(p => RD_NEW.fromLngLat(p)));
  years.set(e.buildingId, e.constructionYear);
}
const addressesOf = new Map<string, typeof addressPoints>();
for (const a of addressPoints) if (a.pandId) (addressesOf.get(a.pandId) ?? addressesOf.set(a.pandId, []).get(a.pandId)!).push(a);

const decoded = new Map<string, any>();
async function panorama(id: string) {
  if (decoded.has(id)) return decoded.get(id);
  if (decoded.size > 4) decoded.clear();
  const file = path.join(CACHE, 'panoramas', `${id}.jpg`);
  if (!existsSync(file)) return null;
  const image = jpeg.decode(await readFile(file), { useTArray: true, formatAsRGBA: true });
  decoded.set(id, image);
  return image;
}

const limit = Number(arg('limit') ?? 60);
await mkdir(OUT, { recursive: true });
const cards: any[] = [];
let done = 0;

for (const pandId of Object.keys(store).sort()) {
  if (done >= limit) break;
  const record = store[pandId], ring = footprints.get(pandId), mass = massing.get(pandId);
  if (!record || !ring || !Number.isFinite(mass?.groundLevel)) continue;

  const chosen: PanoramaView[] = [];
  for (const id of [record.panoramaId, ...(multi[pandId] ?? []).map(m => m.panoramaId)]) {
    const v = views.get(id);
    if (v && hasUsablePose(v) && !chosen.some(c => c.panoramaId === id)) chosen.push(v);
  }
  if (!chosen.length) continue;
  const shown = chosen.slice(0, 3);
  const ground = mass.groundLevel, eaves = mass.eavesHeight ?? ground + 12;
  const wallElevation = buildElevations(ring)
    .map(e => ({ e, d: Math.hypot(e.midpoint.x - (record.wall[0] + record.wall[2]) / 2,
                                  e.midpoint.y - (record.wall[1] + record.wall[3]) / 2) }))
    .sort((a, b) => a.d - b.d)[0].e;

  const frames: any[] = [];
  for (const view of shown) {
    const image = await panorama(view.panoramaId);
    if (!image) continue;
    const camera = RD_NEW.fromLngLat(view.lngLat);
    const projected = projectFootprint(image, view, AMSTERDAM_CAMERA, ring, record.wall, ground, eaves,
      { maxWidth: 900, quality: 84, contextFraction: 0.75 });
    const strip = rectifyWall(image, view, AMSTERDAM_CAMERA, record.wall, ground - 1, eaves + 1.5,
      { pixelsPerMetre: 34, margin: 1.2, maxWidth: 620, quality: 84 });
    if (!projected && !strip) continue;
    const stem = `${pandId}__${view.panoramaId}`;
    if (projected) await writeFile(path.join(OUT, `${stem}__proj.jpg`), projected.jpeg);
    if (strip) await writeFile(path.join(OUT, `${stem}__wall.jpg`), strip.jpeg);
    frames.push({
      panoramaId: view.panoramaId, capturedAt: view.capturedAt.slice(0, 10),
      heading: Number(view.headingDeg.toFixed(1)),
      standoffM: Number(standoffM(wallElevation, camera).toFixed(1)),
      obliquityDeg: Number(obliquityDeg(wallElevation, camera).toFixed(1)),
      projection: projected ? `${stem}__proj.jpg` : null,
      wall: strip ? `${stem}__wall.jpg` : null,
    });
  }
  if (!frames.length) continue;

  // Neighbours give the plan its context, and are what "one house along" means.
  const centre = wallElevation.midpoint;
  const neighbours: ProjectedPoint[][] = [];
  for (const [otherId, other] of footprints) {
    if (otherId === pandId) continue;
    if (Math.hypot(other[0].x - centre.x, other[0].y - centre.y) < 45) neighbours.push(other);
    if (neighbours.length > 40) break;
  }
  const addresses = addressesOf.get(pandId) ?? [];
  const reg = registration.find(r => r.pandId === pandId);

  cards.push({
    pandId,
    label: addresses.length
      ? `${addresses[0].street} ${[...new Set(addresses.map(a => a.houseNumber))].sort((a, b) => a - b).join(', ')}`
      : pandId,
    addressCount: addresses.length,
    constructionYear: years.get(pandId) ?? null,
    wallWidthM: record.wallWidthM,
    plan: planSvg(ring, record.wall,
      shown.map((v, i) => ({ point: RD_NEW.fromLngLat(v.lngLat), primary: i === 0,
        label: `${v.capturedAt.slice(0, 10)} · heading ${v.headingDeg.toFixed(1)}°` })),
      addresses.map(a => a.rd), neighbours, { width: 300, minHeight: 170, maxHeight: 240 }),
    frames,
    // Shown after answering, never before: a reviewer told the machine's answer
    // agrees with it, and the point of a review is an independent opinion.
    hint: reg ? { shiftM: reg.shiftM, peak: reg.peak, occluded: !!(reg.occludedA || reg.occludedB) } : null,
  });
  done++;
  process.stdout.write(`\r  ${done} cards`);
}
process.stdout.write('\r');

await writeFile(path.join(OUT, 'deck.json'), JSON.stringify({
  metadata: {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/facade-twin/build-registration-review.ts',
    cameraModel: AMSTERDAM_CAMERA.id,
    area: AREA.areaId,
    note: 'The wall on each card is a proposal from the pre-correction measurement run. It is the '
      + 'thing being judged, not accepted evidence.',
  },
  cards,
}, null, 1));
console.log(`${cards.length} cards, ${cards.reduce((s, c) => s + c.frames.length, 0)} frames → ${path.relative(process.cwd(), OUT)}`);
