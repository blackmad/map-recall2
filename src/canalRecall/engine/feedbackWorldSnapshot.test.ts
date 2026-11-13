import test from 'node:test';
import assert from 'node:assert/strict';
import { worldSnapshot } from './feedbackWorldSnapshot';

test('no world view: null', () => {
  assert.equal(worldSnapshot({}), null);
  assert.equal(worldSnapshot(null), null);
});

test('own engine: pitch, tilt, tiers, context losses, residency, furniture', () => {
  const game = { vectorMap: {
    engine: 'own', _cameraTilt: 30,
    cameraMap: { api: { pitch: () => 75, zoom: () => 19.06532 } },
    worldSettled: () => ({ settled: false, ground: false, city: true, buildings: true, far: true, baked: true, detail: { big: [1, 2, 3] } }),
    host: { contextEvents: { lost: 1, restored: 1 } },
    _threeBuildings: { stats: () => ({ chunks: 16, buildings: 15942 }), loadingCount: 0 },
    _ownGround: { status: () => ({ ready: true, cells: { '0_0': 1, '-1_0': 0 }, pending: { a: 1 } }) },
  } };
  const s = worldSnapshot(game, { __canalStreetFurniture: { debug: { instances: 279, tiles: 4 } } })!;
  assert.deepEqual(s, {
    engine: 'own', pitch: 75, tilt: 30, zoom: 19.065,
    settled: { settled: false, ground: false, city: true, buildings: true, far: true, baked: true },
    context: { lost: 1, restored: 1 },
    buildings: { chunks: 16, buildings: 15942, loading: 0 },
    ground: { ready: true, resident: 2, pending: 1 },
    furniture: { instances: 279, tiles: 4 },
  });
});

test('a throwing reader never throws out, and nothing is undefined (Firestore rejects undefined)', () => {
  const game = { vectorMap: { engine: 'maplibre', camera: { pitch: () => { throw Error('x'); }, zoom: () => 17 }, worldSettled: () => { throw Error('y'); }, _threeBuildings: { stats: () => { throw Error('z'); } } } };
  const s = worldSnapshot(game, {})!;
  assert.deepEqual(s, { engine: 'maplibre', pitch: null, tilt: null, zoom: 17, buildings: { chunks: null, buildings: null, loading: null } });
  const walk = (v: unknown): void => { assert.notEqual(v, undefined); if (v && typeof v === 'object') Object.values(v).forEach(walk); };
  walk(s);
});
