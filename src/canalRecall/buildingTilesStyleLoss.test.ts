import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { BuildingTileStreamer } from './buildingTilesBrowser';
import { mapHasStyle, mapRemoved } from './mapStyle';

// Sentry CANAL-RECALL-8 (Chrome Mobile, Android 10): a building flush ran in the animation frame
// after MapLibre lost the WebGL context. MapLibre had destroyed the style (map.style = null), so
// map.getSource threw. The streamer now waits for the restored style and resends everything.

function fakeMap() {
  const sent: unknown[] = [];
  const source = { setData(data: unknown) { sent.push(data); } };
  const map = {
    style: {} as unknown,
    _removed: false,
    getSource(_id: string) {
      if (!map.style) throw new TypeError("Cannot read properties of null (reading 'getSource')");
      return source;
    },
    getBounds: () => ({ getWest: () => 4.89, getSouth: () => 52.37, getEast: () => 4.9, getNorth: () => 52.38 }),
    getCenter: () => ({ lng: 4.895, lat: 52.375 }),
    getZoom: () => 17,
    on() {},
  };
  return { map, sent };
}

const building = {
  type: 'Feature',
  properties: { id: 'way/1', height: 10 },
  geometry: { type: 'Polygon', coordinates: [[[4.895, 52.375], [4.8951, 52.375], [4.8951, 52.3751], [4.895, 52.375]]] },
};

test('mapHasStyle / mapRemoved read MapLibre\'s lost-context and removed states', () => {
  assert.equal(mapHasStyle({ style: {} }), true);
  assert.equal(mapHasStyle({ style: null }), false);
  assert.equal(mapHasStyle({}), true, 'a double without a style field counts as styled');
  assert.equal(mapHasStyle(null), false);
  assert.equal(mapRemoved({ _removed: true }), true);
  assert.equal(mapRemoved({ _removed: false }), false);
});

test('a flush while the WebGL context is lost does not throw, and republishes once the style is back', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { map, sent } = fakeMap();
    const streamer = new BuildingTileStreamer(map as never, 'buildings', '/data');
    const internals = streamer as unknown as { cache: { adopt(key: string, features: unknown[]): void }; flush(): void };
    internals.cache.adopt('14/8414/5383', [structuredClone(building)]);

    map.style = null; // webglcontextlost
    assert.doesNotThrow(() => internals.flush());
    assert.equal(sent.length, 0);
    mock.timers.tick(1000);
    assert.equal(sent.length, 0, 'nothing is sent while the style is gone');

    map.style = {}; // webglcontextrestored
    mock.timers.tick(250);
    // scheduleFlush falls back to a microtask outside the browser; drive the flush it queued.
    internals.flush();
    assert.equal(sent.length, 1, 'the restored source gets the whole resident set');
    streamer.dispose();
  } finally {
    mock.timers.reset();
  }
});

test('a removed map stops the wait', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { map } = fakeMap();
    const streamer = new BuildingTileStreamer(map as never, 'buildings', '/data');
    const internals = streamer as unknown as { cache: { adopt(key: string, features: unknown[]): void }; flush(): void; styleWait: unknown };
    internals.cache.adopt('14/8414/5383', [structuredClone(building)]);
    map.style = null;
    map._removed = true;
    internals.flush();
    mock.timers.tick(250);
    assert.equal(internals.styleWait, null);
  } finally {
    mock.timers.reset();
  }
});
