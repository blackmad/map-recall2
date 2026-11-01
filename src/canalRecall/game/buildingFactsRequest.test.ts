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
