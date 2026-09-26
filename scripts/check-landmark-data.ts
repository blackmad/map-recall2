// Contract for the landmark subsystem's pure core. These are the decisions
// that change what the game teaches — which building a click names, which
// bridges are worth a question, which postcard borrows which photograph — so
// they are asserted directly rather than inferred from a screenshot.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  buildBridges,
  buildLandmarks,
  buildNeighborhoods,
  englishTitle,
  kmBetween,
  matchLandmarkToBuilding,
  GENERIC_BRIDGE_NAME_PATTERN,
  isLocatorMapImage,
  isWorthACard,
  neighborhoodAt,
  pointInPolygon,
  splitDetail,
} from '../src/canalRecall/game/landmarkData';
import type {
  BoundaryFeature,
  BridgeFeature,
  LandmarkFeature,
  LatLng,
  NeighborhoodEnrichment,
} from '../src/canalRecall/game/extracts';
import type { BuildingHit, Landmark, WorldPoint } from '../src/canalRecall/game/worldTypes';
import {
  buildRouteKnowledgeIndex,
  routeKnowledgeFor,
  shouldOfferStreetKnowledge,
} from '../src/canalRecall/game/routeKnowledge';

const checks: string[] = [];
function check(name: string, run: () => void): void {
  run();
  checks.push(name);
}

/** A projection with the same shape as the real one: metres-ish per degree,
 *  centred on the Dam, with a window outside which nothing is placed. */
const CENTRE = { lat: 52.3676, lng: 4.9041 };
function project(lat: number, lng: number): WorldPoint | null {
  if (Math.abs(lat - CENTRE.lat) > 0.05 || Math.abs(lng - CENTRE.lng) > 0.08) return null;
  return { x: (lng - CENTRE.lng) * 100_000, y: -(lat - CENTRE.lat) * 100_000 };
}
const toWorld = ([lat, lng]: LatLng): WorldPoint => ({
  x: (lng - CENTRE.lng) * 100_000,
  y: -(lat - CENTRE.lat) * 100_000,
});

// ---- Text ----

check('street encyclopedia stays off a novel unasked name and an open quiz', () => {
  assert.equal(shouldOfferStreetKnowledge({
    hasExtract: true, alreadyShownThisDrive: false, quizOpen: true, landmarkCardOpen: false,
  }), false);
  assert.equal(shouldOfferStreetKnowledge({
    hasExtract: false, alreadyShownThisDrive: false, quizOpen: false, landmarkCardOpen: false,
  }), false);
  assert.equal(shouldOfferStreetKnowledge({
    hasExtract: true, alreadyShownThisDrive: true, quizOpen: false, landmarkCardOpen: false,
  }), false);
  assert.equal(shouldOfferStreetKnowledge({
    hasExtract: true, alreadyShownThisDrive: false, quizOpen: false, landmarkCardOpen: true,
  }), false);
  assert.equal(shouldOfferStreetKnowledge({
    hasExtract: true, alreadyShownThisDrive: false, quizOpen: false, landmarkCardOpen: true,
    replaceOpenCard: true,
  }), true);
  assert.equal(shouldOfferStreetKnowledge({
    hasExtract: true, alreadyShownThisDrive: false, quizOpen: false, landmarkCardOpen: false,
  }), true);
});

check('street and canal knowledge keeps exact IDs and homonyms separate', () => {
  const normalise = (name: string) => name.toLowerCase().replace(/\s+/g, '');
  const index = buildRouteKnowledgeIndex(
    [{ name: 'Nes', wikipediaExtract: 'Legacy summary.' }],
    [{ id: 'street:nes', name: 'Nes', wikipediaUrl: 'https://en.wikipedia.org/wiki/Nes' }],
    [{
      id: 'water:nes',
      name: 'Nes',
      wikipediaUrl: 'https://en.wikipedia.org/wiki/Nes_water',
      wikipediaImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/n.jpg',
    }],
    normalise,
  );
  assert.equal(routeKnowledgeFor(index, 'NES', 'street', normalise)?.id, 'street:nes');
  assert.equal(routeKnowledgeFor(index, 'Nes', 'water', normalise)?.id, 'water:nes');
  assert.equal(
    routeKnowledgeFor(index, 'Nes', 'water', normalise)?.wikipediaImageUrl,
    'https://upload.wikimedia.org/wikipedia/commons/n.jpg',
    'water extract photos must survive the route-knowledge index',
  );
});

check('splitDetail keeps whole sentences and caps both lengths', () => {
  const text = 'One. Two. Three. Four.';
  assert.deepEqual(splitDetail(text), { detail: 'One.', longDetail: 'One. Two. Three.' });
  assert.deepEqual(splitDetail(undefined), { detail: '', longDetail: '' });

  const long = `${'a'.repeat(400)}. second.`;
  const split = splitDetail(long);
  assert.equal(split.detail.length, 150, 'collapsed card body is capped at 150');
  assert.equal(split.longDetail.length, 280, 'expanded card body is capped at 280');
});

check('englishTitle accepts only an en: article', () => {
  assert.equal(englishTitle('en:Blue Bridge'), 'Blue Bridge');
  assert.equal(englishTitle('nl:Blauwbrug'), '', 'a Dutch article must not fill an English card');
  assert.equal(englishTitle('Blauwbrug'), '', 'an untagged title has no known language');
  assert.equal(englishTitle(undefined), '');
  assert.equal(englishTitle(''), '');
});

// ---- Geometry ----

check('pointInPolygon tests containment, not bounding box', () => {
  const square: WorldPoint[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  assert.equal(pointInPolygon(5, 5, square), true);
  assert.equal(pointInPolygon(15, 5, square), false);
  assert.equal(pointInPolygon(-1, 5, square), false);

  // An L shape: the notch is inside the bounding box but outside the polygon.
  const ell: WorldPoint[] = [
    { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 10 }, { x: 0, y: 10 },
  ];
  assert.equal(pointInPolygon(2, 8, ell), true, 'the upright of the L is inside');
  assert.equal(pointInPolygon(8, 8, ell), false, 'the notch is outside despite being in the bbox');
});

check('kmBetween shrinks longitude by latitude', () => {
  assert.equal(kmBetween(CENTRE, CENTRE), 0);
  const northSouth = kmBetween({ lat: 52.3676, lng: 4.9041 }, { lat: 52.3766, lng: 4.9041 });
  const eastWest = kmBetween({ lat: 52.3676, lng: 4.9041 }, { lat: 52.3676, lng: 4.9131 });
  assert.ok(Math.abs(northSouth - 1.0019) < 0.01, `expected ~1 km, got ${northSouth}`);
  assert.ok(eastWest < northSouth * 0.65,
    'a degree of longitude at 52°N is well under two thirds of a degree of latitude');
});

// ---- Landmarks ----

const landmarkFixtures: LandmarkFeature[] = [
  {
    id: 'closed-way', name: 'Royal Palace', type: 'palace',
    center: [52.3732, 4.8918],
    path: [[52.3732, 4.8918], [52.3733, 4.8919], [52.3734, 4.8918], [52.3732, 4.8918]],
    wikipediaExtract: 'A palace. Built later. Third sentence. Fourth.',
    wikipediaImageUrl: 'https://example.invalid/palace.jpg',
    prominenceScore: 900, wikipediaUrl: 'https://en.wikipedia.org/wiki/Royal_Palace',
  },
  {
    id: 'open-way', name: 'Some Quay', center: [52.3700, 4.9000],
    path: [[52.3700, 4.9000], [52.3701, 4.9002]],
    funFact: 'A quay.',
  },
  { id: 'point-only', name: 'Marker', center: [52.3690, 4.9010] },
  { id: 'far-away', name: 'Weesp Fort', center: [52.3080, 5.0410] },
  { id: 'no-centre', name: 'Nowhere' },
];

check('buildLandmarks places, splits and shapes the extract', () => {
  const landmarks = buildLandmarks(landmarkFixtures, project);
  assert.deepEqual(landmarks.map(l => l.id), ['closed-way', 'open-way', 'point-only'],
    'landmarks outside the fetched window, or with no centre, are dropped rather than clamped');

  const palace = landmarks[0];
  assert.equal(palace.detail, 'A palace.');
  assert.equal(palace.longDetail, 'A palace. Built later. Third sentence.');
  assert.equal(palace.extractLang, 'en');
  assert.deepEqual(palace.lngLat, [4.8918, 52.3732], 'world lngLat is [lng, lat]');
  assert.equal(palace.geojson.features[0].geometry.type, 'Polygon',
    'a way that returns to its first point is drawn as a footprint');

  assert.equal(landmarks[1].geojson.features[0].geometry.type, 'LineString',
    'an open way stays a line');
  assert.equal(landmarks[2].geojson.features[0].geometry.type, 'Point',
    'a landmark with no path still gets drawable geometry');
  assert.deepEqual(landmarks[2].geojson.features[0].geometry.coordinates, [4.9010, 52.3690]);

  assert.equal(landmarks[1].prominenceScore, 0, 'missing extract fields become empty, not undefined');
  assert.equal(landmarks[1].wikipediaUrl, '');
  assert.equal(landmarks[1].imageUrl, '');
});

check('a landmark with nothing to say is not offered as a card', () => {
  // "A landmark in Prinses Irenebuurt e.o.. No encyclopedia article yet." is an
  // interruption of the driving corridor that teaches nothing.
  assert.equal(isWorthACard({ detail: '', longDetail: '', imageUrl: '', wikipediaUrl: '' }), false);
  assert.equal(isWorthACard({}), false, 'a bare name is not content');
  assert.equal(isWorthACard({ detail: 'A palace.' }), true);
  assert.equal(isWorthACard({ imageUrl: 'https://example.invalid/x.jpg' }), true,
    'a photograph is worth showing even with no text');
  assert.equal(isWorthACard({ wikipediaUrl: 'https://en.wikipedia.org/wiki/X' }), true,
    'an article exists, so the summary fetch will fill the card and W can open it');

  const placedCards = buildLandmarks(landmarkFixtures, project).filter(isWorthACard);
  assert.deepEqual(placedCards.map(l => l.id), ['closed-way', 'open-way'],
    'the point-only fixture has a name and nothing else, so it is not offered');
});

// ---- Building clicks ----

const placed = buildLandmarks(landmarkFixtures, project);

check('matchLandmarkToBuilding prefers id, then normalised name, then proximity', () => {
  const byId: BuildingHit = { id: 'open-way', name: 'Totally Different', lngLat: [4.9, 52.37], featureTarget: null };
  assert.equal(matchLandmarkToBuilding(placed, byId, byId.name || '')?.id, 'open-way');

  // Punctuation, casing and diacritics used to defeat the match and show the
  // generic "Mapped building" card over a landmark with a full article.
  const byName: BuildingHit = { name: 'royal  PALACE', lngLat: [4.0, 52.0], featureTarget: null };
  assert.equal(matchLandmarkToBuilding(placed, byName, byName.name || '')?.id, 'closed-way');

  const near: BuildingHit = { name: '', lngLat: [4.8918, 52.3734], featureTarget: null };
  assert.equal(matchLandmarkToBuilding(placed, near, '')?.id, 'closed-way',
    'a nameless footprint 20 m from a landmark is that landmark');

  const far: BuildingHit = { name: '', lngLat: [4.8918, 52.3742], featureTarget: null };
  assert.equal(matchLandmarkToBuilding(placed, far, ''), null,
    'a footprint 110 m away must not be relabelled as its neighbour');
});

// ---- Neighborhoods ----

function ring(cx: number, cy: number, half: number): LatLng[] {
  return [
    [cy - half, cx - half], [cy - half, cx + half],
    [cy + half, cx + half], [cy + half, cx - half], [cy - half, cx - half],
  ];
}

const boundaryFixtures: BoundaryFeature[] = [
  { id: 'centrum', name: 'Centrum', kind: 'locality', geometry: [[ring(4.9041, 52.3676, 0.02)]] },
  { id: 'pijp', name: 'De Pijp', kind: 'neighbourhood', geometry: [[ring(4.9041, 52.3676, 0.004)]] },
  // Two points cannot enclose anything, so this quarter must not survive.
  { id: 'sliver', name: 'Sliver', kind: 'quarter', geometry: [[[[52.36, 4.90], [52.36, 4.91]]]] },
  { id: 'unranked', name: 'Water', kind: 'sea', geometry: [[ring(4.9041, 52.3676, 0.01)]] },
];

const enrichmentFixtures: NeighborhoodEnrichment[] = [
  { name: 'Centrum', imageUrl: 'https://example.invalid/centrum.jpg', imageAttribution: 'CC BY' },
  { name: 'De Pijp', wikipediaExtract: 'A busy quarter.' },
];

check('buildNeighborhoods ranks finest-first and borrows a parent photograph', () => {
  const hoods = buildNeighborhoods(boundaryFixtures, enrichmentFixtures, toWorld);
  assert.deepEqual(hoods.map(h => h.name), ['De Pijp', 'Centrum'],
    'unranked kinds and rings with under three points are dropped; the rest sort finest-first');

  const pijp = hoods[0];
  assert.equal(pijp.imageUrl, 'https://example.invalid/centrum.jpg',
    'a quarter with no photograph of its own shows the containing district');
  assert.equal(pijp.imageAttribution, 'CC BY', 'the borrowed attribution travels with the borrowed image');
  assert.equal(pijp.imageArea, 'Centrum', 'the card records whose picture it is showing');
  assert.equal(hoods[1].imageArea, undefined, 'an area using its own photograph names no other area');
});

check('locator maps are not treated as postcard photographs', () => {
  assert.equal(isLocatorMapImage(
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Map_NL_-_Amsterdam_-_Weesperbuurt-Plantage.png/500px-Map.png'),
  true);
  assert.equal(isLocatorMapImage('https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Hortus.jpg/500px.jpg'), false);

  const hoods = buildNeighborhoods(boundaryFixtures, [
    { name: 'Centrum', imageUrl: 'https://example.invalid/centrum.jpg', imageAttribution: 'CC BY' },
    {
      name: 'De Pijp',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/x/Map_NL_-_Amsterdam_-_De_Pijp.png/500px.png',
    },
  ], toWorld);
  assert.equal(hoods[0].imageUrl, 'https://example.invalid/centrum.jpg',
    'a Map_NL_ thumbnail is discarded so the parent photograph can be borrowed');
  assert.equal(hoods[0].imageArea, 'Centrum');
});

check('neighborhoodAt reports the finest area containing the vehicle', () => {
  const hoods = buildNeighborhoods(boundaryFixtures, enrichmentFixtures, toWorld);
  const inside = toWorld([52.3676, 4.9041]);
  assert.equal(neighborhoodAt(hoods, inside.x, inside.y)?.name, 'De Pijp',
    'a point inside De Pijp is in De Pijp, not in Centrum');

  const outerOnly = toWorld([52.3676, 4.9141]);
  assert.equal(neighborhoodAt(hoods, outerOnly.x, outerOnly.y)?.name, 'Centrum');

  const nowhere = toWorld([52.5000, 5.5000]);
  assert.equal(neighborhoodAt(hoods, nowhere.x, nowhere.y), null);
});

// ---- Bridges ----

const bridgeFixtures: BridgeFeature[] = [
  {
    id: 'blauwbrug', name: 'Blauwbrug', center: [52.3670, 4.9020],
    path: [[52.3670, 4.9018], [52.3670, 4.9022]],
    distractors: ['Magere Brug', 'Brug 117', '42'],
    wikipediaExtract: 'A bridge. And more.',
  },
  { id: 'numbered', name: 'Brug 117', center: [52.3671, 4.9021], path: [[52.3671, 4.9020], [52.3671, 4.9022]] },
  { id: 'bare-number', name: '42', center: [52.3672, 4.9021], path: [[52.3672, 4.9020], [52.3672, 4.9022]] },
  {
    id: 'rail-only', name: 'Westelijke Ringspoorbaan', center: [52.3673, 4.9021],
    path: [[52.3673, 4.9020], [52.3673, 4.9022]], carriesRailway: true,
  },
  {
    id: 'rail-and-road', name: 'Mixed Viaduct', center: [52.3674, 4.9021],
    path: [[52.3674, 4.9020], [52.3674, 4.9022]], carriesRailway: true, carriesRoad: true,
  },
  { id: 'nameless', center: [52.3675, 4.9021], path: [[52.3675, 4.9020], [52.3675, 4.9022]] },
  { id: 'no-geometry', name: 'Ghost Bridge', center: [52.3676, 4.9021] },
  { id: 'no-centre', name: 'Uncentred Bridge', path: [[52.3677, 4.9020], [52.3677, 4.9022]] },
];

check('buildBridges keeps only bridges a player could name', () => {
  const bridges = buildBridges(bridgeFixtures, { bridges: {} }, toWorld);
  assert.deepEqual(bridges.map(b => b.id), ['blauwbrug', 'rail-and-road'],
    'register numbers, rail-only viaducts, nameless and geometry-less spans all ask nothing');

  const blauwbrug = bridges[0];
  assert.deepEqual(blauwbrug.distractors, ['Magere Brug'],
    'register numbers are not offered as wrong answers either');
  assert.equal(blauwbrug.detail, 'A bridge.');
  assert.equal(blauwbrug.crossings.length, 1, 'a bridge missing from the index still asks its one question');
  assert.equal(blauwbrug.crossings[0].waterway, null, 'with no water to gate on');
  assert.deepEqual(
    { x: blauwbrug.crossings[0].x, y: blauwbrug.crossings[0].y },
    toWorld([52.3670, 4.9020]),
    'the fallback crossing is placed at the feature centre',
  );
});

check('buildBridges uses the published crossings when the index has them', () => {
  const bridges = buildBridges(bridgeFixtures, {
    bridges: {
      blauwbrug: [
        { index: 0, center: [52.3670, 4.9018], waterway: 'Amstel', waterwayType: 'river', waterDistractors: ['IJ'], spans: 1 },
        { index: 1, center: [52.3670, 4.9022], waterway: 'Singel', waterwayType: 'canal', waterDistractors: [], spans: 1 },
      ],
    },
  }, toWorld);
  const blauwbrug = bridges.find(b => b.id === 'blauwbrug');
  assert.ok(blauwbrug);
  assert.deepEqual(blauwbrug.crossings.map(c => c.waterway), ['Amstel', 'Singel'],
    'each physical span carries the water under it');
  assert.deepEqual(
    { x: blauwbrug.crossings[1].x, y: blauwbrug.crossings[1].y },
    toWorld([52.3670, 4.9022]),
    'every crossing is projected into the current world',
  );
});

check('one malformed bridge cannot blank the whole extract', () => {
  const bridges = buildBridges(bridgeFixtures, { bridges: {} }, toWorld);
  assert.ok(bridges.some(b => b.id === 'blauwbrug'),
    'the uncentred bridge is skipped without throwing, so the good ones survive');
});

// ---- The shipped Amsterdam extract ----
// Treating OSM data as imperfect means asserting on the real file, not only on
// fixtures: a refresh that silently halves the landmark count should fail here.

const extractDir = path.resolve('public/data/extracts/amsterdam');
function readExtract<T>(name: string, fallback: T): T {
  const file = path.join(extractDir, name);
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

check('the shipped Amsterdam extract builds a usable world', () => {
  const features = readExtract<LandmarkFeature[]>('landmarks.json', []);
  const boundaries = readExtract<BoundaryFeature[]>('boundaries.json', []);
  const enriched = readExtract<NeighborhoodEnrichment[]>('neighborhoods-enriched.json', []);
  const bridgeFeatures = readExtract<BridgeFeature[]>('bridges.json', []);
  const crossings = readExtract('bridge-crossings.json', { bridges: {} });

  // Deliberately invariants, not counts. The extract is regenerated by a
  // pipeline this lane does not own, and a refresh that legitimately changes
  // how many landmarks Amsterdam has must not turn this check red. What must
  // never change is what the builders guarantee about whatever they are given.
  // Measured on 2026-08-30 for context: 420 features -> 374 placed landmarks,
  // 90 neighborhoods (12 borrowing a parent photograph), 300 -> 248 bridges.
  const landmarks = buildLandmarks(features, project);
  assert.ok(features.length > 0, 'the landmark extract is present and non-empty');
  assert.ok(landmarks.length > 0, 'landmarks place inside the central window');
  assert.ok(landmarks.every(l => l.name && l.geojson.features.length > 0),
    'every placed landmark has a name and something to draw');
  assert.ok(landmarks.every(l => Number.isFinite(l.x) && Number.isFinite(l.y)),
    'every placed landmark has finite world coordinates');

  const hoods = buildNeighborhoods(boundaries, enriched, toWorld);
  assert.ok(hoods.length > 0, 'boundaries produce neighborhoods');
  assert.ok(hoods.every((hood, i) => i === 0 || hoods[i - 1].rank >= hood.rank),
    'neighborhoods stay sorted finest-first, which is what makes the finest-match lookup correct');
  assert.ok(hoods.every(h => h.rings.every(ring => ring.length > 2)),
    'no neighborhood keeps a ring too small to enclose anything');
  assert.ok(hoods.every(h => !h.imageArea || h.imageUrl),
    'a postcard never credits a borrowed photograph it does not have');

  const bridges = buildBridges(bridgeFeatures, crossings, toWorld);
  assert.ok(bridges.length > 0, 'bridges survive into the quiz');
  assert.ok(!bridges.some(b => GENERIC_BRIDGE_NAME_PATTERN.test(b.name)),
    'no register-numbered bridge reaches the quiz');
  assert.ok(!bridges.some(b => b.distractors.some(d => GENERIC_BRIDGE_NAME_PATTERN.test(d))),
    'no register-numbered bridge reaches the answer choices');
  assert.ok(bridges.every(b => b.crossings.length > 0),
    'every nameable bridge has at least one crossing to ask about');
  assert.ok(bridges.every(b => b.crossings.every(c => Number.isFinite(c.x) && Number.isFinite(c.y))),
    'every crossing projected to a finite point');
});

console.log(`Landmark data OK: ${checks.length} checks.`);
for (const name of checks) console.log(`  · ${name}`);
