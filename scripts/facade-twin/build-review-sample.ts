/**
 * Draw a review sample and render its façades for a human to label.
 *
 * `calibration.ts` has been written and checked since early in this project and
 * has never been fed a single real `ReviewOutcome`. Until it is, no measurement
 * carries a confidence that means anything, every street-level field is capped
 * below auto-accept, and nothing can be promoted. This is the step that unblocks
 * that, and it is the one step that genuinely needs a person.
 *
 * Two properties matter more than convenience here.
 *
 * **Stratified.** A sample drawn at random is dominated by the common case —
 * five-metre 18th-century fronts seen square-on from the far quay — and tells
 * you nothing about where the detector breaks. The sample is spread across plot
 * width, era, view quality and the detector's own plausibility score, so the
 * hard cases are represented in proportion to how much they are worth knowing
 * about rather than how often they occur.
 *
 * **Blind.** The reviewer sees the rectified façade and nothing else. The
 * detector's reading is written to a separate file and joined afterwards. A
 * reviewer shown "the detector says 4 storeys — is that right?" agrees far more
 * often than one shown a photograph and asked how many storeys it has, and the
 * difference is exactly the bias this corpus exists to measure.
 *
 * Usage: npx tsx scripts/facade-twin/build-review-sample.ts --count=24
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { AMSTERDAM_GRACHTENGORDEL_WEST } from '../../src/canalRecall/facade/areas.ts';
import { rectifyFacade } from '../../src/canalRecall/facade/rectify.ts';
import { AMSTERDAM_CAMERA, GEOID_SEPARATION_M } from '../../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import type { MassingRecord, PanoramaView } from '../../src/canalRecall/facade/sources.ts';

const AREA = AMSTERDAM_GRACHTENGORDEL_WEST;
const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
const REVIEW = path.resolve('public/canal-drive/facade-review');
const arg = (name: string) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const COUNT = Number(arg('count') ?? 24);
const PPM = 34;

interface Measured {
  pandId: string; panoramaId: string; capturedAt: string;
  standoffM: number; obliquityDeg: number;
  wall: [number, number, number, number]; wallWidthM: number;
  wallRgb: [number, number, number] | null;
  storeyBands: number; storeyIntervalsM: number[];
  bays: number; bayOffsetsM: number[]; plausibility: number;
  openings: Array<{ xM: number; yM: number; widthM: number; heightM: number }>;
}

const store = JSON.parse(await readFile(path.join(STAGING, 'measured-facades.json'), 'utf8')) as { facades: Record<string, Measured> };
const views = new Map((JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-panoramas.json`), 'utf8')).data as PanoramaView[]).map(v => [v.panoramaId, v]));
const recon = JSON.parse(await readFile(path.join(STAGING, 'recon.json'), 'utf8'));
const massing = new Map<string, MassingRecord>(recon.massing.map((m: MassingRecord) => [m.buildingId, m]));
const years = new Map<string, number | null>(recon.buildings.map((b: any) => [b.buildingId, b.constructionYear]));
const heritage = new Map<string, string>();
for (const h of recon.heritage) if (h.buildingId && h.description) heritage.set(h.buildingId, h.description);

const all = Object.values(store.facades).filter(f => massing.get(f.pandId)?.eavesHeight != null);

/**
 * Stratify on the four axes the detector's accuracy plausibly varies along.
 * One cell per combination, sampled round-robin so no cell dominates.
 */
const cell = (f: Measured) => {
  const width = f.wallWidthM < 5 ? 'narrow' : f.wallWidthM < 7 ? 'typical' : 'wide';
  const view = f.obliquityDeg < 6 && f.standoffM < 30 ? 'good' : f.obliquityDeg < 14 ? 'fair' : 'poor';
  return `${width}/${view}`;
};
const cells = new Map<string, Measured[]>();
for (const f of all) (cells.get(cell(f)) ?? cells.set(cell(f), []).get(cell(f))!).push(f);
/**
 * Inside each cell, interleave flagged readings with clean ones.
 *
 * Deliberately over-sampling what the detector already doubts. A corpus drawn
 * only from clean readings measures accuracy on the easy half and calls it
 * accuracy; the flagged ones are where the confidence score has to earn its
 * place, because they are the ones it would route to review.
 *
 * Order is deterministic so a rerun draws the same sample and two reviewers can
 * be handed an identical set — which is the only way to measure agreement
 * between them later.
 */
for (const [key, list] of cells) {
  const byId = (a: Measured, b: Measured) => a.pandId.localeCompare(b.pandId);
  const clean = list.filter(f => f.plausibility >= 0.99).sort(byId);
  const flagged = list.filter(f => f.plausibility < 0.99).sort(byId);
  const woven: Measured[] = [];
  // Roughly one flagged in every three, or all of them if there are fewer.
  for (let i = 0, c = 0, g = 0; i < list.length; i++) {
    const wantFlagged = i % 3 === 2 && g < flagged.length;
    if (wantFlagged || c >= clean.length) woven.push(flagged[g++] ?? clean[c++]);
    else woven.push(clean[c++]);
  }
  cells.set(key, woven.filter(Boolean));
}

const order = [...cells.keys()].sort();
const sample: Measured[] = [];
for (let round = 0; sample.length < COUNT; round++) {
  let added = false;
  for (const key of order) {
    const list = cells.get(key)!;
    if (list[round] && sample.length < COUNT) { sample.push(list[round]); added = true; }
  }
  if (!added) break;
}
console.log(`${all.length} measured façades in ${cells.size} strata; drew ${sample.length}`);

const images = new Map<string, { width: number; height: number; data: Uint8ClampedArray }>();
async function panorama(view: PanoramaView) {
  if (images.has(view.panoramaId)) return images.get(view.panoramaId)!;
  const bytes = await readFile(path.join(CACHE, 'panoramas', `${view.panoramaId}.jpg`));
  const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
  const image = { width: decoded.width, height: decoded.height, data: decoded.data };
  images.set(view.panoramaId, image);
  return image;
}

await mkdir(path.join(REVIEW, 'facades'), { recursive: true });
const items = [], truth = [];
for (const f of sample) {
  const view = views.get(f.panoramaId);
  const mass = massing.get(f.pandId)!;
  if (!view || mass.groundLevel == null || mass.eavesHeight == null) continue;
  const point = RD_NEW.fromLngLat(view.lngLat);
  const image = await panorama(view);

  // Cut the strip generously: from below the stoep to above the ridge, so the
  // reviewer can count storeys and see the gable, which the detector's own
  // strip deliberately excludes.
  const top = (mass.ridgeHeight ?? mass.eavesHeight) + 2;
  const rect = rectifyFacade(image, {
    x: point.x, y: point.y, z: view.cameraHeight - GEOID_SEPARATION_M,
    headingDeg: view.headingDeg, pitchDeg: view.pitchDeg, rollDeg: view.rollDeg,
  }, {
    start: { x: f.wall[0], y: f.wall[1] }, end: { x: f.wall[2], y: f.wall[3] },
    baseZ: mass.groundLevel - 1.2, topZ: top,
  }, { pixelsPerMetre: PPM, camera: AMSTERDAM_CAMERA });

  const file = `facades/${f.pandId}.jpg`;
  await writeFile(path.join(REVIEW, file), jpeg.encode({ width: rect.width, height: rect.height, data: Buffer.from(rect.data) }, 90).data);

  // What the reviewer sees: the picture, its scale, and nothing about the
  // detector's answer.
  items.push({
    pandId: f.pandId, image: file,
    widthM: Number(f.wallWidthM.toFixed(2)),
    stripHeightM: Number((top - (mass.groundLevel - 1.2)).toFixed(2)),
    pixelsPerMetre: Number(rect.pixelsPerMetre.toFixed(1)),
    capturedAt: f.capturedAt.slice(0, 10),
  });

  // What it will be scored against, kept apart.
  truth.push({
    pandId: f.pandId,
    detector: { storeys: f.storeyBands, bays: f.bays, openings: f.openings.length, wallRgb: f.wallRgb, plausibility: f.plausibility },
    context: {
      constructionYear: years.get(f.pandId) ?? null,
      declaredStoreys: mass.storeys ?? null,
      eavesAboveGroundM: Number((mass.eavesHeight - mass.groundLevel).toFixed(2)),
      obliquityDeg: f.obliquityDeg, standoffM: f.standoffM,
      registerSays: heritage.get(f.pandId) ?? null,
      stratum: cell(f),
    },
  });
}

await writeFile(path.join(REVIEW, 'sample.json'), JSON.stringify({
  metadata: {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/facade-twin/build-review-sample.ts',
    attribution: '© Gemeente Amsterdam, Kernregistratie Panoramabeelden (CC BY 4.0)',
    count: items.length,
    strata: cells.size,
    note: 'The reviewer sees this file only. Detector readings live in truth.json and are joined after labelling, so the review is blind.',
  },
  items,
}, null, 2));
await writeFile(path.join(REVIEW, 'truth.json'), JSON.stringify({ truth }, null, 2));

const strata = new Map<string, number>();
for (const t of truth) strata.set(t.context.stratum, (strata.get(t.context.stratum) ?? 0) + 1);
console.log(`\n${items.length} façades rendered at ${PPM} px/m to ${path.relative(process.cwd(), REVIEW)}`);
console.log('strata drawn:');
for (const [key, n] of [...strata.entries()].sort()) console.log(`  ${String(n).padStart(2)}  ${key}`);
console.log(`\nreviewer sees sample.json; detector readings are held in truth.json`);
