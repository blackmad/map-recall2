// A world view that draws nothing, for a browser that refuses WebGL (engine round, 2026-11-27).
// Sentry CANAL-RECALL-C: Chrome blocks WebGL for a page after repeated context losses. Until MapLibre was deleted,
// game.js fell back to the map-less VectorBasemap from vector-map.js, whose methods all existed with a null map
// inside. With the own engine the only engine, ownWorldViewOrNull returns null and the ~90 `vectorMap.` call sites
// in game.js, game-route.js and the runtimes would throw (the ride never opened; webgl-refused.spec.ts).
// This stands in for that VectorBasemap: the listed members answer like an idle, empty view, and any other member
// is a no-op method, so a call site the list misses cannot stop the ride.
import type { WorldCamera } from './worldViewApi';

const noop = (): undefined => undefined;

const camera: WorldCamera = {
  project: () => ({ x: 0, y: 0 }),
  unproject: () => null,
  center: () => ({ lng: 0, lat: 0, toArray: () => [0, 0] as [number, number] }),
  zoom: () => 0,
  bounds: () => null,
  pitch: () => 0,
  bearing: () => 0,
  onFrame: () => noop,
  whenIdle: () => Promise.resolve(),
};

function members(): Record<string | symbol, unknown> {
  return {
    isNullWorldView: true,
    ready: true,
    map: null,
    camera,
    _pitchSmoothed: null,
    captureFrame: () => Promise.resolve(null),
    frameCanvas: () => null,
    pitchForViewMode: () => 0,
    zoomOffsetForViewMode: () => 0,
    projectWorld: () => ({ x: 0, y: 0 }),
    toggleLabels: () => false,
    buildingLook: () => 'default',
    _spoils: () => false,
    whenIdle: () => Promise.resolve(),
    onFrame: () => noop,
    // Promise-likes and iteration must not see a callable `then` / iterator.
    then: undefined,
    [Symbol.iterator]: undefined,
    [Symbol.toPrimitive]: undefined,
    toJSON: () => ({ nullWorldView: true }),
  };
}

/** A view that draws nothing; every member not listed above is a no-op method returning undefined. */
export function nullWorldView(): Record<string | symbol, unknown> {
  const own = members();
  return new Proxy(own, {
    get(target, key) {
      if (key in target) return target[key];
      return noop;
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });
}
