import { test } from 'node:test';
import assert from 'node:assert/strict';

// The runtime registers itself on the page at import time.
(globalThis as any).window = { CanalRecallGameModules: [] };
const { GameLandmarkRuntime } = await import('./landmarkRuntime');

// Named regression (2026-11-01): since the facts store became lazy
// (cd5be8a55), a click on an ordinary building — a register row, no article —
// asked `ensureAt` from the card, and the refresh on arrival rebuilt the card
// through the same path, which asked again; a resident tile resolves at once,
// so the microtasks chained forever and the page hung. One request per card.
test('a clicked building with a row and no article asks for its tile once, and the refresh ends', async () => {
  let asks = 0;
  const host: any = {
    landmarks: [],
    vectorMap: {},
    _clickPoiInfo: null,
    _landmarkNotice: null,
    _buildingFacts: {
      lookup: () => [1887, -1, 0],
      article: () => null,
      ensureAt: () => { if (++asks > 20) throw new Error('facts requested in a loop'); return Promise.resolve(); },
    },
    _ensureLandmarkImage: () => {},
    _cardForClickedBuilding: GameLandmarkRuntime.prototype._cardForClickedBuilding,
    _requestBuildingFacts: GameLandmarkRuntime.prototype._requestBuildingFacts,
  };
  const building = { id: 'anonymous-footprint', name: '', lngLat: [4.9, 52.37] as [number, number] };
  const card = host._cardForClickedBuilding(building);
  assert.equal(card?.name, 'Built 1887');
  host._landmarkNotice = card;
  // Drain the microtask chain the refresh starts; a loop would never reach the timer.
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(asks, 1, 'ensureAt is asked once per card');
  assert.equal(host._landmarkNotice.name, 'Built 1887');
  // A second click on the same building asks again (the first request is over).
  host._cardForClickedBuilding(building);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(asks, 2);
});

// #258 follow-up (2026-11-09): a tapped POI label at point P resolves to the pand under it (engine/labelPand.ts), and the
// card carries the place's name and kind with that pand's year, and asks for that pand's fact tile.
test('a POI label at P over pand X opens a card with the POI name and pand X facts', async () => {
  const { ClickPoiIndex } = await import('../clickPoiInfo');
  const { withLabelPand } = await import('../engine/labelPand');
  const P: [number, number] = [4.849011, 52.390768];
  const X = 'NL.IMBAG.Pand.0363100012345678';
  const footprint = { type: 'Polygon', coordinates: [[[4.8488, 52.3906], [4.8492, 52.3906], [4.8492, 52.3909], [4.8488, 52.3909], [4.8488, 52.3906]]] };
  const looked: unknown[] = [];
  let rowReady = false;
  const host: any = {
    landmarks: [], vectorMap: { _spoils: () => false }, _landmarkNotice: null,
    _clickPoiInfo: new ClickPoiIndex({ version: 1, source: 'OSM', points: [
      ['n2628741158', 'Shri Guru Nanak Gurdwara Sahib', P[0], P[1], 'amenity', 'a Sikh gurdwara', 'Schakelstraat 21', '', ''],
    ] } as any),
    _buildingFacts: {
      lookup: (id: unknown) => { looked.push(id); return rowReady && id === X ? [1965, -1, 0] : null; },
      article: () => null,
      ensureAt: () => { rowReady = true; return Promise.resolve(); },
    },
    _ensureLandmarkImage: () => {},
    _cardForClickedBuilding: GameLandmarkRuntime.prototype._cardForClickedBuilding,
    _requestBuildingFacts: GameLandmarkRuntime.prototype._requestBuildingFacts,
  };
  const label = { id: 'own:gurdwara', landmarkId: 'own:gurdwara', name: 'Shri Guru Nanak Gurdwara Sahib', lngLat: P, poi: true as const, featureTarget: null };
  const hit = withLabelPand(label, [{ id: X, height: 9, footprint, featureTarget: { source: 'osm-building-appearance', id: X } }]);
  assert.equal(hit.pand?.id, X, 'the label resolves to pand X');
  const first = host._cardForClickedBuilding(hit);
  assert.equal(first.name, 'Shri Guru Nanak Gurdwara Sahib');
  assert.match(first.detail, /^A Sikh gurdwara at Schakelstraat 21\./);
  assert.equal(first.featureTarget?.id, X, 'the label\'s building is highlighted');
  host._landmarkNotice = first;
  await new Promise(resolve => setTimeout(resolve, 20));
  assert(looked.includes(X), 'the facts register is asked for pand X, not the label id');
  assert(!looked.includes('own:gurdwara'));
  assert.equal(host._landmarkNotice.name, 'Shri Guru Nanak Gurdwara Sahib', 'the refreshed card keeps the place name');
  assert.equal(host._landmarkNotice.detail,
    'A Sikh gurdwara at Schakelstraat 21. Built in 1965, in the post-war decades. About 9 m tall, some 3 storeys.');
});
