/**
 * A deck of façades for a person to judge, and the questions worth asking.
 *
 * Everything in this pipeline is capped at confidence 0.4 because no human has
 * ever checked any of it. The blind-review machinery — `calibration.ts`,
 * `fieldAccuracy`, `fieldVerdict` — was written for exactly this and has never
 * been fed a real answer. What was missing was not the scoring but a way to
 * *ask*, that takes minutes rather than an afternoon.
 *
 * The five questions are the five things I actually do not know, in the order
 * that the answers would change what the pipeline does:
 *
 *  1. **Is this the right building at all?** After a 180° yaw error sampled the
 *     wrong side of the canal for every measurement in the pilot, this is the
 *     only question whose answer can invalidate everything else. It is asked
 *     first and it is the one question with a hard consequence.
 *  2. **Floors above the pavement.** We read a mean of +1.09 storeys against 92
 *     human counts in OpenStreetMap. The hypothesis is that we count the
 *     souterrain and people do not. Asking for above-ground floors *and*
 *     whether there is a basement settles it in one card.
 *  3. **Where is the front door?** 977 of 1,821 façades have their ground
 *     storey behind parked cars. A person can see a doorway a model cannot, and
 *     can also say "hidden", which is a different answer from "none".
 *  4. **Bays.** Never validated against anything.
 *  5. **Gable.** Stated by the register for 636 of 3,025 and assumed for the
 *     rest; a person can name it in a second from the silhouette.
 *
 * The sample is stratified rather than random, because a random sample of a
 * boundary that is 60% brick terraces mostly measures brick terraces. Strata
 * are what the pipeline finds hard: the gate rejected it, the ground floor is
 * occluded, the storey ladder disagreed with 3DBAG, the model and YOLO-World
 * disagreed, and — as a control — the ones it found easy.
 *
 * Usage: npx tsx scripts/facade-twin/build-review-deck.ts [--size=40]
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AMSTERDAM_GRACHTENGORDEL_WEST as AREA } from '../../src/canalRecall/facade/areas.ts';

const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
const arg = (name: string) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const SIZE = Number(arg('size') ?? 40);

const evidence = JSON.parse(await readFile(path.join(STAGING, 'facade-evidence.json'), 'utf8'));
const segmented = JSON.parse(await readFile(path.join(STAGING, 'segmented-openings.json'), 'utf8')).facades as Record<string, any>;
const extract = JSON.parse(await readFile(path.join(STAGING, 'lod22.json'), 'utf8'));
const kept = new Set(extract.buildings.filter((b: any) => b.facade).map((b: any) => b.id));
let addresses: Record<string, any> = {};
try { addresses = JSON.parse(await readFile(path.join(CACHE, 'addresses.json'), 'utf8')).addresses; } catch { /* optional */ }

const rendered = new Set((await readFile(path.join(STAGING, 'facade-evidence.json'), 'utf8')) ? [] : []);
const { readdirSync, existsSync } = await import('node:fs');
const stripDir = path.resolve('public/canal-drive/facade-evidence');
const haveStrip = new Set(existsSync(stripDir)
  ? readdirSync(stripDir).filter(f => f.endsWith('.jpg')).map(f => f.replace('.jpg', ''))
  : []);

const rows = evidence.facades
  .filter((f: any) => haveStrip.has(f.pandId))
  .map((f: any) => ({ ...f, seg: segmented[f.pandId], kept: kept.has(f.pandId) }));

/** What the pipeline finds hard, plus a control. */
const strata: Array<[string, (f: any) => boolean]> = [
  ['gate rejected it', f => !f.kept],
  ['ground floor occluded', f => (f.seg?.groundStoreyOccluded ?? 0) > 0.4],
  ['storeys disagree with 3DBAG', f => f.massingStoreys && Math.abs(f.storeyBands - f.massingStoreys) >= 2],
  ['ground residual over 1.5 m', f => Math.abs(f.seg?.groundResidualM ?? 0) > 1.5],
  ['mostly grid-inferred openings', f => {
    const all = [...(f.seg?.windows ?? []), ...(f.seg?.doors ?? [])];
    return all.length > 2 && all.filter(o => o.inferred).length / all.length > 0.6;
  }],
  ['the pipeline found it easy', f => f.kept && f.plausibility >= 1
    && (f.seg?.groundStoreyOccluded ?? 1) < 0.25],
];

const perStratum = Math.max(3, Math.floor(SIZE / strata.length));
const chosen = new Map<string, any>();
for (const [name, test] of strata) {
  const pool = rows.filter(test).filter((f: any) => !chosen.has(f.pandId));
  // Spread through the pool rather than taking the head, so a stratum is not
  // one street.
  const step = Math.max(1, Math.floor(pool.length / perStratum));
  for (let i = 0, taken = 0; i < pool.length && taken < perStratum; i += step, taken++) {
    chosen.set(pool[i].pandId, { ...pool[i], stratum: name });
  }
}

const deck = [...chosen.values()].map(f => ({
  pandId: f.pandId,
  address: addresses[f.pandId]?.label ?? null,
  stratum: f.stratum,
  strip: `/canal-drive/facade-evidence/${f.pandId}.jpg`,
  capturedAt: f.capturedAt,
  wallWidthM: f.wallWidthM,
  // What the pipeline currently believes, held back until the reviewer answers.
  guess: {
    storeys: f.storeyBands,
    massingStoreys: f.massingStoreys,
    bays: f.bays,
    doors: (f.seg?.doors ?? []).length,
    windows: (f.seg?.windows ?? []).length,
    occluded: f.seg?.groundStoreyOccluded ?? null,
    kept: f.kept,
    material: f.wallMaterialName,
  },
}));

await writeFile(path.join(STAGING, 'review-deck.json'), JSON.stringify({
  metadata: {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/facade-twin/build-review-deck.ts',
    note: 'Stratified toward what the pipeline finds hard. The pipeline’s own answers are '
      + 'included but must stay hidden until the reviewer has committed, or the review measures '
      + 'agreement with a suggestion rather than the truth.',
    size: deck.length,
  },
  deck,
}, null, 1));

console.log(`${deck.length} façades for review, from ${rows.length} with a rendered strip`);
for (const [name] of strata) {
  console.log(`  ${String(deck.filter(d => d.stratum === name).length).padStart(3)}  ${name}`);
}
console.log(`→ ${path.relative(process.cwd(), path.join(STAGING, 'review-deck.json'))}`);
