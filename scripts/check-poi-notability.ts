// Notability-weighted route destinations. Starting a ride at Dam Square, the
// destinations a first-time visitor is offered should be the landmarks they
// recognise, not whatever modelled building used to win the old 220-floor
// tie-break or whatever OSM feature happened to carry a high prominence.
//
// This check builds the real Amsterdam destination pool the same way
// `game-route.js` does (curated POIs inherit their model's enrichment, then
// the teachable extract features fill out the pool), ranks the destinations
// within pairing range of Dam Square, and asserts the notability signal puts
// the famous landmarks on top. It prints the before (old prominence) and after
// (notability) top-20 so the improvement is legible in CI logs.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CANAL_CITIES } from '../src/canalRecall/game/cities.ts';
import { normaliseAnswer } from '../src/canalRecall/answerPath';
import {
  manualPoiForCuratedId,
  mergeManualPoiFeatures,
} from '../src/canalRecall/game/manualPoiCatalog';
import {
  isTeachableRouteDestination,
  kmBetween,
  ROUTE_POI_MAX_PAIR_KM,
  type RoutePoi,
} from '../src/canalRecall/game/routeSelection';
import { A_LIST, isAList, notabilityScore } from '../src/canalRecall/game/poiNotability';
import type { LandmarkFeature } from '../src/canalRecall/game/extracts';

const AMS = CANAL_CITIES.amsterdam;
const DAM_SQUARE = { lat: 52.3731, lng: 4.8913 };
/** The exact landmarks a visitor must be able to reach from Dam Square. */
const MUST_BE_OFFERED = ['Rijksmuseum', 'Anne Frank House', 'Westerkerk'];
/** Minimum share of the top-20 that must be on the curated A-list. */
const MIN_ALIST_IN_TOP_20 = 14;

/** A pool member plus the pre-existing prominence the old dropdown used. */
interface PoolPoi extends RoutePoi {
  prominenceScore?: number;
}

/**
 * Copy the enrichment fields the notability scorer reads, matching the names
 * in `game/poiNotability.ts` rather than the extract's verbose field names.
 * Mirrors `GameRouteRuntime._attachNotability` in `game-route.js`.
 */
function attachNotability(poi: PoolPoi, feature: LandmarkFeature): void {
  if (feature.wikidata) poi.wikidata = feature.wikidata;
  if (feature.wikidataSitelinks) poi.sitelinks = feature.wikidataSitelinks;
  if (feature.wikipediaPageviews60d != null) poi.pageviews60d = feature.wikipediaPageviews60d;
  if (feature.heritage) poi.heritage = feature.heritage;
  if (feature.wikidataInstanceOf) poi.wikidataInstanceOf = feature.wikidataInstanceOf;
  if (feature.type) poi.type = feature.type;
  if (feature.manualPoi) poi.manualPoi = feature.manualPoi;
  if (feature.prominenceScore != null) poi.prominenceScore = feature.prominenceScore;
}

/**
 * Rebuild `game-route.js`'s `_loadRoutePoiCatalog` pool, the city-centre
 * distance cap included, so the ranking is the one the game actually samples.
 * Every member is guaranteed to clear the arrival gate: extras are filtered by
 * it, and each curated destination is asserted against its matched content.
 */
function buildPool(): { pool: PoolPoi[]; curated: number } {
  const raw = JSON.parse(
    fs.readFileSync('public/data/extracts/amsterdam/landmarks.json', 'utf8'),
  ) as LandmarkFeature[];
  const features = mergeManualPoiFeatures(raw, 'amsterdam');

  const curated: PoolPoi[] = AMS.curatedPois.map(poi => ({ ...poi }));
  for (const poi of curated) {
    const modelId = manualPoiForCuratedId(poi.id);
    const model = modelId && features.find(feature => feature.modelId === modelId);
    const match = model || features.find(feature =>
      normaliseAnswer(feature.name) === normaliseAnswer(poi.name));
    if (match) {
      attachNotability(poi, match);
      // A curated destination is hand-picked precisely because it teaches
      // something; guard against a model whose content no longer clears the
      // tightened gate.
      assert.ok(isTeachableRouteDestination(match),
        `${poi.name} maps to content that fails the arrival gate`);
    }
  }

  const seen = new Set(curated.map(poi => normaliseAnswer(poi.name)));
  const curatedModels = new Set(curated.map(poi => manualPoiForCuratedId(poi.id)).filter(Boolean));
  const extras: PoolPoi[] = [];
  for (const feature of features) {
    const centre = feature.routeCenter || feature.center;
    if (!centre || !feature.name) continue;
    if (feature.modelId && curatedModels.has(feature.modelId)) continue;
    // Completing a route must reveal something worth learning; a bare OSM name
    // or a thin Wikidata one-liner stays map geometry, not an arrival reward.
    if (!isTeachableRouteDestination(feature)) continue;
    const key = normaliseAnswer(feature.name);
    if (seen.has(key)) continue;
    const poi: PoolPoi = { id: `lm-${feature.id}`, name: feature.name, lat: centre[0], lng: centre[1] };
    attachNotability(poi, feature);
    if (!feature.manualPoi && kmBetween(poi, AMS.center) > 4) continue;
    seen.add(key);
    extras.push(poi);
  }
  return { pool: [...curated, ...extras], curated: curated.length };
}

interface Ranked {
  poi: PoolPoi;
  alist: boolean;
  prominence: number;
  notability: number;
}

function printTop(title: string, entries: Ranked[], pick: (entry: Ranked) => number): number {
  const top = [...entries].sort((a, b) => pick(b) - pick(a)).slice(0, 20);
  const alist = top.filter(entry => entry.alist).length;
  process.stdout.write(`\n${title} — A-list ${alist}/20\n`);
  top.forEach((entry, index) => {
    process.stdout.write(
      `  ${String(index + 1).padStart(2)}. ${entry.alist ? 'A' : ' '} ${pick(entry).toFixed(2).padStart(6)}  ${entry.poi.name}\n`);
  });
  return alist;
}

const { pool, curated } = buildPool();
const ranked: Ranked[] = pool
  .map(poi => ({
    poi,
    alist: isAList(poi),
    prominence: poi.prominenceScore ?? 0,
    notability: notabilityScore(poi),
  }))
  .filter(entry => kmBetween(entry.poi, DAM_SQUARE) <= ROUTE_POI_MAX_PAIR_KM);

assert.ok(ranked.length >= 20, `expected at least 20 destinations within range of Dam Square, got ${ranked.length}`);

process.stdout.write(`Amsterdam destination pool: ${curated} curated + ${pool.length - curated} from the extract\n`);

const beforeAlist = printTop('BEFORE (old prominence order)', ranked, entry => entry.prominence);
const after = [...ranked].sort((a, b) => b.notability - a.notability).slice(0, 20);
const afterAlist = printTop('AFTER (notability score)', ranked, entry => entry.notability);

assert.ok(afterAlist >= MIN_ALIST_IN_TOP_20,
  `only ${afterAlist}/20 of the top destinations from Dam Square are A-list (want ${MIN_ALIST_IN_TOP_20})`);

for (const name of MUST_BE_OFFERED) {
  assert.ok(after.some(entry => normaliseAnswer(entry.poi.name) === normaliseAnswer(name)),
    `${name} is not among the top 20 destinations from Dam Square`);
}

// The A-list is the hand-curated reference; keep it large enough to satisfy
// the gate and the must-be-offered trio.
assert.ok(A_LIST.length >= MIN_ALIST_IN_TOP_20, 'the A-list must stay large enough to satisfy the gate');

console.log(`\nPOI notability OK: top-20 from Dam Square has ${afterAlist} A-list landmarks ` +
  `(${MUST_BE_OFFERED.join(', ')} present); before the change the prominence order had ${beforeAlist}.`);
