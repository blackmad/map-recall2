import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { anchorAt, buurtAt, PLACE_AT_MAX_M, PLACE_AT_SLACK_M, placeReach, plaqueBuurtAt, type PlaceAnchor } from './placeBuurt.ts';
import { buildChecklists, CHECKLIST_MAX_PLACES } from './freeRideCollection.ts';
import { buildLandmarks, buildNeighborhoods, isWorthACard } from './landmarkData.ts';
import { secondMarkerIds } from './freeRide.ts';
import { mergeManualPoiFeatures } from './manualPoiCatalog.ts';
import { BARE_CITY_NAMES, landmarkDisplayName, withDisplayNames } from './placeNames.ts';
import { buurtAt as knowledgeBuurtAt, geometryFromExtract } from '../knowledgeMap.ts';
import { CANAL_CITIES } from './cities.ts';

const PX = 3;
const square = (name: string, x0: number, y0: number, size: number) => ({
  name, rings: [[{ x: x0, y: y0 }, { x: x0 + size, y: y0 }, { x: x0 + size, y: y0 + size }, { x: x0, y: y0 + size }]],
});

test('the plaque names the buurt of the place the rider stands at, else the finest buurt holding the rider', () => {
  // Finest first, as buildNeighborhoods sorts: West is a 100 px square, Centrum the coarse fallback.
  const hoods = [square('Jordaan', 0, 0, 100), square('Grachtengordel', 100, 0, 100), square('Centrum', -1000, -1000, 3000)];
  assert.equal(buurtAt(hoods, 50, 50), 'Jordaan');
  assert.equal(buurtAt(hoods, 150, 50), 'Grachtengordel');
  assert.equal(buurtAt(hoods, 500, 500), 'Centrum');
  assert.equal(buurtAt(hoods, 5000, 5000), null);
  // A Grachtengordel place 10 px inside the line, reaching 30 px: the kerb across the line still reads Grachtengordel.
  const anchors: PlaceAnchor[] = [{ x: 110, y: 50, hood: 'Grachtengordel', reach: 30 }];
  assert.equal(plaqueBuurtAt(hoods, 95, 50, anchors), 'Grachtengordel');
  assert.equal(plaqueBuurtAt(hoods, 70, 50, anchors), 'Jordaan');
  assert.equal(plaqueBuurtAt(hoods, 95, 50), 'Jordaan');
  // The nearest of two covering anchors wins.
  const two: PlaceAnchor[] = [...anchors, { x: 80, y: 50, hood: 'Jordaan', reach: 30 }];
  assert.equal(anchorAt(two, 92, 50)?.hood, 'Jordaan');
  assert.equal(anchorAt(two, 99, 50)?.hood, 'Grachtengordel');
});

test('a place reaches its road distance plus slack, capped; with no road close by it reaches the furthest', () => {
  assert.equal(placeReach(0, PX), PLACE_AT_SLACK_M * PX);
  assert.equal(placeReach(20 * PX, PX), (20 + PLACE_AT_SLACK_M) * PX);
  assert.equal(placeReach(500 * PX, PX), PLACE_AT_MAX_M * PX);
  assert.equal(placeReach(null, PX), PLACE_AT_MAX_M * PX);
});

test('display names: one spelling per place, no place called by a city name', () => {
  assert.equal(landmarkDisplayName({ name: 'Amsterdam', wikidata: 'Q478353' }), 'VOC ship Amsterdam');
  assert.equal(landmarkDisplayName({ name: 'The National Maritime Museum', wikidata: 'Q1616123' }), 'National Maritime Museum');
  assert.equal(landmarkDisplayName({ name: 'Rijksmuseum' }), 'Rijksmuseum');
  const renamed = withDisplayNames([
    { name: 'Amsterdam', wikidata: 'Q478353', distractors: ['The National Maritime Museum', 'Arcam'] },
    { name: 'Arcam', distractors: ['Amsterdam'] },
  ]);
  assert.deepEqual(renamed.map(f => f.name), ['VOC ship Amsterdam', 'Arcam']);
  assert.deepEqual(renamed[0].distractors, ['National Maritime Museum', 'Arcam']);
  assert.deepEqual(renamed[1].distractors, ['VOC ship Amsterdam']);
});

// ---- The whole Amsterdam catalogue ----

const extract = (file: string) => JSON.parse(readFileSync(new URL(`../../../public/data/extracts/amsterdam/${file}`, import.meta.url), 'utf8'));
const boundaries = extract('boundaries.json');
const features = withDisplayNames(mergeManualPoiFeatures(extract('landmarks.json'), 'amsterdam'));
const [lat0, lng0] = [52.3731, 4.8926];
const toWorld = ([lat, lng]: readonly [number, number]) => ({
  x: (lng - lng0) * 111320 * Math.cos(lat0 * Math.PI / 180) * PX,
  y: -(lat - lat0) * 111320 * PX,
});
const hoods = buildNeighborhoods(boundaries, [], toWorld);
const landmarks = buildLandmarks(features, (lat, lng) => toWorld([lat, lng]));
const worth = landmarks.filter(landmark => isWorthACard(landmark));
const second = secondMarkerIds(worth);
const places = worth.filter(l => !second.has(String(l.id)))
  .map(l => ({ key: String(l.id), name: l.name, x: l.x, y: l.y, prominence: l.prominenceScore, lngLat: l.lngLat }));
const lists = buildChecklists(places, place => buurtAt(hoods, place.x, place.y));
const knowledge = geometryFromExtract(boundaries, []);

test('catalogue: every checklist place is in the buurt the plaque, the passport and the knowledge map name for its point', () => {
  assert.ok(lists.size > 20, `${lists.size} lists`);
  const anchors: PlaceAnchor[] = [];
  for (const list of lists.values()) for (const p of list.places) anchors.push({ x: p.x, y: p.y, hood: list.hood, reach: PLACE_AT_SLACK_M * PX });
  let checked = 0;
  for (const list of lists.values()) {
    assert.ok(list.places.length <= CHECKLIST_MAX_PLACES);
    for (const place of list.places) {
      const lngLat = (place as { lngLat?: [number, number] }).lngLat!;
      assert.equal(knowledgeBuurtAt(knowledge, [lngLat[1], lngLat[0]])?.name, list.hood, `${place.name}: knowledge map`);
      assert.equal(buurtAt(hoods, place.x, place.y), list.hood, `${place.name}: plaque without anchors`);
      assert.equal(plaqueBuurtAt(hoods, place.x, place.y, anchors), list.hood, `${place.name}: plaque at the place`);
      checked++;
    }
  }
  assert.ok(checked > 150, `${checked} places`);
});

test('catalogue: no checklist place is named by a bare city name or shares its name with another place', () => {
  const seen = new Map<string, string>();
  for (const list of lists.values()) {
    for (const place of list.places) {
      assert.ok(!BARE_CITY_NAMES.has(place.name), `${place.key} is called "${place.name}"`);
      assert.ok(!seen.has(place.name), `"${place.name}" in ${list.hood} and ${seen.get(place.name)}`);
      seen.set(place.name, list.hood);
    }
  }
  assert.ok(!landmarks.some(l => BARE_CITY_NAMES.has(l.name)), 'a landmark is called by a city name');
});

test('catalogue: a daily-ride destination and the landmark at it are spelled the same', () => {
  const norm = (s: string) => s.toLowerCase().replace(/^the /, '').replace(/[’']/g, "'").replace(/\s+science museum$/, '');
  const amsterdam = CANAL_CITIES.amsterdam;
  for (const poi of amsterdam.curatedPois) {
    const at = toWorld([poi.lat, poi.lng]);
    for (const l of landmarks) {
      if (Math.hypot(l.x - at.x, l.y - at.y) > 60 * PX) continue;
      if (norm(l.name) === norm(poi.name)) assert.equal(l.name, poi.name, `${poi.id}`);
    }
  }
});
