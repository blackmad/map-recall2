// P5 B6: participants read WorldCamera (worldCameraOf.ts) instead of the MapLibre-shaped map.
import test from 'node:test';
import assert from 'node:assert/strict';
import { VIEW_CHANGE_HZ, boundsContain, onViewChange, viewChangeHz, worldCameraOf } from './worldCameraOf.js';
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
  const off = onViewChange(cam, () => moves++, { hz: 0 });
  frame!(); frame!(); assert.equal(moves, 1, 'first frame, then a redraw of the same view');
  west = 4.81; frame!(); assert.equal(moves, 2);
  zoom = 17.5; frame!(); frame!(); assert.equal(moves, 3);
  off(); assert.equal(frame, null);
});

test('onViewChange throttle (lane cell-hidden-skip): at most hz a second while the view moves, the last change always runs, ?viewChangeHz=0 every frame', () => {
  assert.equal(viewChangeHz('', {}), VIEW_CHANGE_HZ);
  assert.equal(viewChangeHz('?viewChangeHz=0', {}), 0);
  assert.equal(viewChangeHz('?viewChangeHz=30', {}), 30);
  assert.equal(viewChangeHz('', { __canalRecallViewChangeHz: 0 }), 0);
  assert.equal(viewChangeHz('?viewChangeHz=x', {}), VIEW_CHANGE_HZ);
  let frame: (() => void) | null = null, west = 4.8, t = 0;
  const cam = { onFrame: (f: () => void) => { frame = f; return () => { frame = null; }; }, zoom: () => 17, bounds: () => ({ west, east: 4.9, south: 52.3, north: 52.4 }) } as unknown as WorldCamera;
  const timers: { f: () => void; at: number }[] = [];
  const clock = { now: () => t, setTimer: (f: () => void, ms: number) => { const x = { f, at: t + ms }; timers.push(x); return x; }, clearTimer: (x: unknown) => { const i = timers.indexOf(x as any); if (i >= 0) timers.splice(i, 1); } };
  let moves = 0;
  const off = onViewChange(cam, () => moves++, { hz: 10, ...clock });
  // A 60 fps ride for one second: the view changes every frame.
  for (let k = 0; k < 60; k++) { t = k * 1000 / 60; west += 1e-5; frame!(); }
  assert.ok(moves >= 9 && moves <= 11, `${moves} calls in a second at 10 Hz`);
  // The rider stops mid-interval: the timer runs the last view's work, and no frame is needed for it.
  t = 1000; west += 1e-5; frame!();
  const before = moves;
  t = 1030; west += 1e-5; frame!();
  assert.equal(moves, before, 'within the interval: waits');
  assert.equal(timers.length, 1);
  t = timers[0].at; const due = timers.shift()!; due.f();
  assert.equal(moves, before + 1, 'the trailing call');
  frame!(); assert.equal(moves, before + 1, 'a redraw of the same view: nothing');
  off(); assert.equal(frame, null);
  // hz 0: every changed frame, as before.
  let every = 0; west = 4.8;
  const off0 = onViewChange(cam, () => every++, { hz: 0, ...clock });
  for (let k = 0; k < 10; k++) { west += 1e-5; frame!(); frame!(); }
  assert.equal(every, 10);
  off0();
});
