/**
 * Is the merged building source complete, unique, and still standing at the Waag?
 *
 * Run after `npm run build:lod1-city`. It reads the staging output, so it is
 * not part of `check:canal` — that gate must pass on a clean checkout, and this
 * needs a 374 MB CityJSON cache. It fails loudly rather than skipping when the
 * staging file is absent, because a data check that quietly passes on missing
 * data is worse than no check.
 *
 * The three properties worth failing a build over:
 *
 *   completeness — the point of Phase 1 is that the city stops being a tenth
 *     described and nine tenths absent, and that heights stop being invented;
 *   uniqueness — one building, one feature. Two representations in the same
 *     place is the z-fighting the current three-layer stack works around, and
 *     it is exactly what a careless merge reintroduces;
 *   the Waag — the named regression for "a measured height beat a hand-mapped
 *     composition", which is the way this change could quietly make the game
 *     worse while every aggregate number improved.
 */

import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { ringCentroid, type Ring } from '../src/canalRecall/buildingLadder.js';

const city = process.argv.find(value => value.startsWith('--city='))?.slice(7) ?? 'amsterdam';
const file = path.join('public', 'data', 'extracts', city, 'staging', 'lod1-city.geojson');
assert.ok(await stat(file).catch(() => null), `${file} is missing — run \`npm run build:lod1-city\` first`);

/** The Waag, on the Nieuwmarkt. Its OSM parts are the thing being protected. */
const WAAG: [number, number] = [4.90034, 52.37262];
const metresApart = (a: [number, number], b: [number, number]): number =>
  Math.hypot((a[0] - b[0]) * 68000, (a[1] - b[1]) * 111320);

type Properties = {
  tier: number; bagId: string | null; osmId: string | null;
  height: number | null; heightSource: string | null; roofShape: string | null;
};

const bagIds = new Set<string>();
const tiers = new Map<number, number>();
const heightSources = new Map<string, number>();
const waag: Properties[] = [];
let features = 0;
let duplicateBagIds = 0;
let missingIdentity = 0;
let tier3WithoutMeasuredHeight = 0;

const reader = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
for await (const rawLine of reader) {
  const line = rawLine.replace(/,\s*$/, '');
  if (!line.startsWith('{"type":"Feature"')) continue;
  const feature = JSON.parse(line) as {
    properties: Properties;
    geometry: { type: string; coordinates: Ring[] | Ring[][] };
  };
  const properties = feature.properties;
  features++;

  if (properties.bagId) {
    if (bagIds.has(properties.bagId)) duplicateBagIds++;
    bagIds.add(properties.bagId);
  } else if (!properties.osmId) {
    missingIdentity++;
  }

  tiers.set(properties.tier, (tiers.get(properties.tier) ?? 0) + 1);
  heightSources.set(properties.heightSource ?? 'null', (heightSources.get(properties.heightSource ?? 'null') ?? 0) + 1);
  if (properties.tier === 3 && (properties.heightSource === 'none' || properties.height === null)) tier3WithoutMeasuredHeight++;

  const rings = (feature.geometry.type === 'Polygon' ? feature.geometry.coordinates : (feature.geometry.coordinates as Ring[][]).flat()) as Ring[];
  if (metresApart(ringCentroid(rings[0]), WAAG) < 45) waag.push(properties);
}

// --- completeness ------------------------------------------------------------
// The extract that ships today is 10,578 buildings. Anything close to that
// means the BAG side did not land and the merge is dressing up the status quo.
assert.ok(features > 250_000, `the merged city covers the whole city, not a fraction of it (${features} features)`);
assert.ok(bagIds.size > 250_000, `most features are BAG-identified panden (${bagIds.size})`);
assert.equal(missingIdentity, 0, 'every feature carries either a BAG id or an OSM id');

// --- uniqueness --------------------------------------------------------------
assert.equal(duplicateBagIds, 0, `no pand appears twice (${duplicateBagIds} duplicates)`);

// --- heights are measured, not invented --------------------------------------
const measured = (heightSources.get('roof-70p') ?? 0) + (heightSources.get('lod12-volume') ?? 0);
assert.ok(
  measured > features * 0.95,
  `nearly every building stands at an AHN-measured height (${measured}/${features})`
);
assert.ok(
  tier3WithoutMeasuredHeight < features * 0.001,
  `a measured extrusion without a measured height is a contradiction (${tier3WithoutMeasuredHeight})`
);

// --- the Waag ----------------------------------------------------------------
// It must still stand as its hand-mapped composition. The failure this catches
// is the whole thing collapsing to one 16 m box because the measured height won.
const waagHeights = [...new Set(waag.map(part => part.height))].filter((height): height is number => height !== null);
const waagOsm = waag.filter(part => part.osmId && part.bagId === null);
assert.ok(waag.length >= 12, `the Waag is still a composition, not a box (${waag.length} features within 45 m)`);
assert.ok(waagOsm.length >= 10, `its hand-mapped parts survived the merge (${waagOsm.length} OSM features)`);
assert.ok(waagHeights.length >= 5, `its parts still stand at distinct heights (${waagHeights.length}: ${waagHeights.join(', ')})`);
assert.ok(Math.max(...waagHeights) >= 24, `the tallest turret is still there (${Math.max(...waagHeights)} m)`);
assert.ok(waag.some(part => part.roofShape === 'pyramidal'), 'its pyramidal roofs survived the merge');
// The pand underneath must be gone, or the box is inside the composition.
assert.ok(
  !waag.some(part => part.bagId === 'NL.IMBAG.Pand.0363100012171850'),
  'the Waag pand is suppressed rather than drawn inside its own hand-mapped parts'
);

process.stdout.write(
  `LoD1 city checks passed (${features} features, ${bagIds.size} panden, ` +
  `${Math.round((measured / features) * 100)}% measured heights, ` +
  `Waag ${waag.length} parts at ${waagHeights.sort((a, b) => a - b).join('/')} m)\n`
);
