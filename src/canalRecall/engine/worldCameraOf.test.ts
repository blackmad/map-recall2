// P5 B6: participants read WorldCamera (worldCameraOf.ts) instead of the MapLibre-shaped map.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boundsContain, onViewChange, worldCameraOf } from './worldCameraOf.js';
import type { WorldCamera } from './worldViewApi.js';

test('worldCameraOf: the CameraMap api as is; a MapLibre map through its getters, bounds as plain numbers too', () => {
  const api = { bounds: () => null, onFrame: () => () => {} } as unknown as WorldCamera;
  assert.equal(worldCameraOf({ api }), api);
  const listeners = new Map<string, () => void>();
  const ml = {
    getBounds: () => ({ getWest: () => 4.8, getEast: () => 4.9, getSouth: () => 52.3, getNorth: () => 52.4 }),
    getZoom: () => 17, getPitch: () => 60, getBearing: () => 10, getCenter: () => ({ lng: 4.85, lat: 52.35 }),
    project: () => ({ x: 1, y: 2 }), unproject: () => null,
    on: (t: string, f: () => void) => listeners.set(t, f), off: (t: string) => listeners.delete(t), once: (t: string, f: () => void) => listeners.set(`once:${t}`, f),
  };
  const cam = worldCameraOf(ml);
  const b = cam.bounds()!;
  assert.deepEqual([b.west, b.east, b.south, b.north, b.getWest!()], [4.8, 4.9, 52.3, 52.4, 4.8]);
  assert.equal(cam.zoom(), 17);
  let frames = 0;
  const off = cam.onFrame(() => frames++);
  listeners.get('render')!(); assert.equal(frames, 1);
  off(); assert.equal(listeners.has('render'), false);
});

test('boundsContain: MapLibre contains for [lng, lat] and {lng, lat}', () => {
  const b = { west: 4.8, east: 4.9, south: 52.3, north: 52.4 };
  assert.equal(boundsContain(b, [4.85, 52.35]), true);
  assert.equal(boundsContain(b, { lng: 4.95, lat: 52.35 }), false);
  assert.equal(boundsContain(null, [4.85, 52.35]), false);
});

test('onViewChange: moveend on WorldCamera, only for a frame whose view moved (a repaint never loops)', () => {
  let frame: (() => void) | null = null, zoom = 17, west = 4.8;
  const cam = { onFrame: (f: () => void) => { frame = f; return () => { frame = null; }; }, zoom: () => zoom, bounds: () => ({ west, east: 4.9, south: 52.3, north: 52.4 }) } as unknown as WorldCamera;
  let moves = 0;
  const off = onViewChange(cam, () => moves++);
  frame!(); frame!(); assert.equal(moves, 1, 'first frame, then a redraw of the same view');
  west = 4.81; frame!(); assert.equal(moves, 2);
  zoom = 17.5; frame!(); frame!(); assert.equal(moves, 3);
  off(); assert.equal(frame, null);
});
