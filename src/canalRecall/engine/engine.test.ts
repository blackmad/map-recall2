import assert from 'node:assert/strict';
import test from 'node:test';
import { EngineCamera, mercatorX, mercatorY, unitsPerMetre } from './cameraMap';
import { StepClock } from './frameHost';
import { frameMatrices } from '../rendererShared/frameMath';
import { engineFlag } from './worldViewApi';

const vp = { width: 1440, height: 900 };

function clipProject(m: number[], lng: number, lat: number, altM = 0) {
  const x = mercatorX(lng), y = mercatorY(lat), z = altM * unitsPerMetre(lat);
  const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
  const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
  const cz = m[2] * x + m[6] * y + m[10] * z + m[14];
  const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
  return { x: (cx / cw + 1) / 2 * vp.width, y: (1 - cy / cw) / 2 * vp.height, z: cz / cw, w: cw };
}

test('clipFromMercator draws where camera.project says, at every view mode pitch', () => {
  for (const [zoom, pitch, bearing] of [[11.6, 0, 0], [14.5, 14, 30], [18.4, 48, -120], [18.2, 60, 170], [19.5, 84, 45]]) {
    const cam = new EngineCamera(() => vp, { center: [4.8839, 52.3752], zoom, pitch, bearing });
    const m = cam.clipFromMercator();
    for (const [dx, dy] of [[0, 0], [0.0004, 0.0002], [-0.0003, 0.0005], [0.0001, -0.0001]]) {
      const lng = 4.8839 + dx, lat = 52.3752 + dy + (pitch > 50 ? 0.0003 : 0);
      const a = cam.project([lng, lat]);
      if (a.depth <= 0) continue;
      const b = clipProject(m, lng, lat);
      assert.ok(Math.abs(a.x - b.x) < 1e-3 && Math.abs(a.y - b.y) < 1e-3, `z${zoom} p${pitch}: ${a.x},${a.y} vs ${b.x},${b.y}`);
      assert.ok(b.z > -1 && b.z < 1, `depth inside the near/far range at z${zoom} p${pitch}: ${b.z}`);
    }
  }
});

test('the centre projects to the viewport centre and unprojects back', () => {
  const cam = new EngineCamera(() => vp, { center: [4.9, 52.37], zoom: 17.3, pitch: 55, bearing: 72 });
  const c = cam.project([4.9, 52.37]);
  assert.ok(Math.abs(c.x - 720) < 1e-6 && Math.abs(c.y - 450) < 1e-6);
  const back = cam.unproject(300, 700)!;
  const again = cam.project([back.lng, back.lat]);
  assert.ok(Math.abs(again.x - 300) < 1e-6 && Math.abs(again.y - 700) < 1e-6);
});

test('the shared frame recovers the engine eye from the clip matrix', () => {
  const cam = new EngineCamera(() => vp, { center: [4.9, 52.37], zoom: 18, pitch: 60, bearing: 10, elevation: 2 });
  const fm = frameMatrices(cam.clipFromMercator())!;
  const e = cam.eye();
  const u = unitsPerMetre(52.37);
  assert.ok(Math.abs(fm.eye[0] - mercatorX(e.lng)) < 1e-10);
  assert.ok(Math.abs(fm.eye[1] - mercatorY(e.lat)) < 1e-10);
  assert.ok(Math.abs(fm.eye[2] / u - e.altitudeM) < 0.01, `${fm.eye[2] / u} vs ${e.altitudeM}`);
});

test('MapLibre zoom: metres per pixel at the centre', () => {
  // MapLibre: 512·2^z px per world; world = 2π·6371008.8·cos(lat) metres along the parallel.
  const cam = new EngineCamera(() => vp, { center: [4.9, 52.37], zoom: 16, pitch: 0 });
  const east = cam.enuOf(4.9 + 0.001, 52.37);
  const a = cam.project([4.9, 52.37]), b = cam.project([4.9 + 0.001, 52.37]);
  const expectPx = 0.001 / 360 * 512 * 2 ** 16;
  assert.ok(Math.abs((b.x - a.x) - expectPx) < 1e-6, `${b.x - a.x} vs ${expectPx} (${east[0]} m)`);
});

test('StepClock: fixed steps, leftover alpha, stalls capped', () => {
  const clock = new StepClock(1 / 120, 8);
  assert.deepEqual(clock.advance(1 / 60).steps, 2);
  const r = clock.advance(0.004);
  assert.equal(r.steps, 0);
  assert.ok(r.alpha > 0.47 && r.alpha < 0.49);
  const stall = clock.advance(5);
  assert.equal(stall.steps, 8);
  assert.ok(clock.dropped > 0);
  assert.equal(clock.advance(0).steps, 0);
});

test('engine flag', () => {
  assert.equal(engineFlag('?engine=own'), 'own');
  assert.equal(engineFlag('?engine=maplibre'), 'maplibre');
  assert.equal(engineFlag(''), 'maplibre');
});

test('FrameHost: fixed ticks, render on demand, context loss and restore, guarded', async () => {
  const { FrameHost } = await import('./frameHost');
  const { guardFrameHost } = await import('./frameGuards');
  const listeners: Record<string, (e: { preventDefault(): void }) => void> = {};
  const canvas: any = { style: {}, width: 0, height: 0, addEventListener: (t: string, f: any) => { listeners[t] = f; }, remove() {} };
  const container: any = { clientWidth: 400, clientHeight: 300, ownerDocument: { createElement: () => canvas }, appendChild() {} };
  let lost = false; const made: any[] = [];
  const createRenderer = () => { const r = { disposed: false, autoClear: true, getContext: () => ({ isContextLost: () => lost }), clear() {}, setViewport() {}, setRenderTarget() {}, dispose() { r.disposed = true; } }; made.push(r); return r; };
  let frames: Array<(t: number) => void> = [];
  const ticks: number[] = []; let renders = 0;
  const host = new FrameHost({}, container, { tick: dt => ticks.push(dt), render: () => { renders++; } }, { createRenderer, pixelRatio: 2, requestFrame: cb => { frames.push(cb); return frames.length; }, cancelFrame() {} });
  const reports: string[] = [];
  const { guarded } = guardFrameHost(host, { governor: false, report: f => reports.push(f.event) });
  assert.ok(guarded);
  assert.equal(canvas.width, 800); assert.equal(canvas.height, 600);
  host.start();
  const step = (t: number) => { const f = frames; frames = []; for (const cb of f) cb(t); };
  step(0); step(1000 / 60);
  assert.equal(ticks.length, 2);
  assert.equal(renders, 2); // first frame (dirty) and the ticked one
  step(1000 / 60 + 1); // no tick, nothing dirty
  assert.equal(renders, 2);
  host.triggerRepaint(); step(1000 / 60 + 2);
  assert.equal(renders, 3);
  let sawLoss = 0, sawRestore = 0;
  host.on('webglcontextlost', () => sawLoss++).on('webglcontextrestored', () => sawRestore++);
  lost = true; let prevented = false;
  listeners.webglcontextlost({ preventDefault: () => { prevented = true; } });
  assert.ok(prevented && sawLoss === 1 && host.renderer === null && made[0].disposed);
  host.triggerRepaint(); step(100);
  assert.equal(renders, 3, 'nothing draws while lost');
  lost = false; listeners.webglcontextrestored({ preventDefault() {} });
  assert.ok(sawRestore === 1 && host.renderer === made[1]);
  step(120);
  assert.equal(renders, 4);
  assert.deepEqual(reports, ['webgl-context-lost']);
  host.stop();
});

test('isWater over the overview water: Singelgracht at the Da Costagracht mouth (named regression)', async () => {
  const { readFileSync } = await import('node:fs');
  const { gunzipSync } = await import('node:zlib');
  const { decodeOverview } = await import('../ownMap/overviewFormat');
  const { WaterIndex } = await import('./waterIndex');
  const file = JSON.parse(gunzipSync(readFileSync(new URL('../../../public/data/extracts/amsterdam/own-map-v1/overview.json.gz', import.meta.url))).toString());
  const water = new WaterIndex(decodeOverview(file).water);
  // The Da Costagracht's south end, where it opens into the Singelgracht (OSM waterway end node).
  assert.equal(water.isWater(4.874311, 52.366508), true, 'Da Costagracht mouth');
  assert.equal(water.isWater(4.87359, 52.367539), true, 'Da Costagracht');
  assert.equal(water.isWater(4.877533, 52.366766), true, 'Singelgracht east of the mouth');
  assert.equal(water.isWater(4.8749, 52.3668), false, 'Da Costakade block beside it');
});

test('camera clearance: lowers the pitch until the sightline clears, at most CLEARANCE_MAX_DROP', async () => {
  const { clearCamera, CLEARANCE_MAX_DROP } = await import('./cameraClearance');
  const square = (w: number, s: number, e: number, n: number, height: number) => ({ properties: { id: 'b', height }, geometry: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] } });
  const rider: [number, number] = [4.9, 52.37];
  // A 12 m building 10–20 m south of the rider; the camera sits south, behind it.
  const mLat = 111320;
  const wall = square(4.8998, 52.37 - 20 / mLat, 4.9002, 52.37 - 10 / mLat, 12);
  const eyeAt = (pitch: number) => { const d = 60; const h = d * Math.cos(pitch * Math.PI / 180), back = d * Math.sin(pitch * Math.PI / 180); return { lngLat: [4.9, 52.37 - back / mLat] as [number, number], altitude: h }; };
  const r = clearCamera(70, rider, rider, eyeAt, () => [wall])!;
  assert.ok(r.constrained && r.safePitch < 70 && r.safePitch >= 70 - CLEARANCE_MAX_DROP, JSON.stringify(r));
  const open = clearCamera(70, rider, rider, eyeAt, () => [])!;
  assert.equal(open.constrained, false);
});

test('rider cover: covered after the enter hold, cleared after the leave hold', async () => {
  const { RiderCoverTracker } = await import('./riderCover');
  const shed = { properties: { id: 'cs', min_height: 0 }, geometry: { type: 'Polygon', coordinates: [[[4.89, 52.37], [4.91, 52.37], [4.91, 52.38], [4.89, 52.38], [4.89, 52.37]]] } };
  const t = new RiderCoverTracker();
  let r = t.update([4.9, 52.375], true, 0, () => [shed]);
  assert.equal(r.covered, false);
  r = t.update([4.9, 52.375], true, 0.5, () => [shed]);
  assert.ok(r.covered && r.changed && r.id === 'cs');
  r = t.update([4.95, 52.375], true, 0.7, () => []);
  r = t.update([4.95, 52.375], true, 1.5, () => []);
  assert.equal(r.covered, false);
});

// Regression (Nieuwmarkt, 4.90009, 52.37255): asking "Nieuwmarkt" while the extract square is labelled
// "New Market" (wikipedia nl:Nieuwmarkt (Amsterdam)) drew the answer in English.
test('a place label is screened by its Dutch name too', async () => {
  const { placeAliases } = await import('./placeNames');
  const { poiLabelVisible } = await import('../ownMap/labelPolicy');
  const square = { name: 'New Market', wikipedia: 'nl:Nieuwmarkt (Amsterdam)' };
  assert.deepEqual(placeAliases(square), ['Nieuwmarkt']);
  assert.deepEqual(placeAliases({ name: 'Dam', wikipedia: 'nl:Dam' }), []);
  assert.deepEqual(placeAliases({ name: 'Westerkerk' }), []);
  const ctx = { isLabelled: () => true, hiddenName: 'Nieuwmarkt', spoilerIndex: null, quizQuiet: false };
  assert.equal(poiLabelVisible(ctx, square.name), true, 'the English name alone does not match');
  assert.equal(placeAliases(square).every(a => poiLabelVisible(ctx, a)), false, 'the alias does');
});

test('landmark ground re-bases are throttled with a trailing pass; trees re-base at once', async () => {
  const { CityExtras, LANDMARK_REBASE_MS } = await import('./cityExtras');
  let landmark = 0, trees = 0;
  const extras = new CityExtras({ cameraMap: {}, sharedFrame: {}, mercator: {}, extractPath: () => '', threeBuildings: () => null, completeCity: () => null,
    measuredColoursOnly: () => false, trees3d: false, repaint: () => {}, relight: () => {}, fail: () => {} });
  extras.signature = { refreshGroundBases: () => { landmark++; } };
  extras.trees = { refreshGroundBases: () => { trees++; } };
  for (let t = 0; t < 1000; t += 100) extras.refreshGroundBases(t);
  assert.equal(trees, 10);
  assert.equal(landmark, 1, 'one re-base inside the window');
  extras.tick(LANDMARK_REBASE_MS - 1); assert.equal(landmark, 1);
  extras.tick(LANDMARK_REBASE_MS); assert.equal(landmark, 2, 'the trailing pass');
  extras.tick(LANDMARK_REBASE_MS * 3); assert.equal(landmark, 2, 'nothing due');
});

test('labels: full placement only after real camera movement', async () => {
  const { movedEnough, samePose } = await import('./overlays/labelLayer');
  const a = [0, 0, 18, 30, 60] as const;
  assert.equal(samePose(a, [0, 0, 18, 30, 60]), true);
  assert.equal(movedEnough(a, [2, 0, 18, 30, 60]), false, '2 m at z18 is ~6 px');
  assert.equal(movedEnough(a, [12, 0, 18, 30, 60]), true);
  assert.equal(movedEnough(a, [0, 0, 18, 31, 60]), false);
  assert.equal(movedEnough(a, [0, 0, 18, 33, 60]), true);
  assert.equal(movedEnough([0, 0, 18, 359, 60], [0, 0, 18, 1, 60]), false, 'bearing wraps');
});

test('overview: the covered disc is the largest radius the ground covers', async () => {
  const { coveredRadius } = await import('./overviewLayer');
  const ground = (r: number) => ({ coversRect: (x0: number, _y0: number, x1: number) => (x1 - x0) / 2 <= r });
  assert.equal(coveredRadius(ground(1000), 0, 0), 900);
  assert.equal(coveredRadius(ground(100), 0, 0), 0);
  assert.equal(coveredRadius(ground(5000), 0, 0), 1200);
});

test('FrameHost.setSimulation: the same fixed steps at every display rate, one frame call per animation frame', async () => {
  const { FrameHost } = await import('./frameHost');
  for (const hz of [30, 60, 120, 144]) {
    const canvas: any = { style: {}, width: 0, height: 0, addEventListener() {}, remove() {} };
    const container: any = { clientWidth: 400, clientHeight: 300, ownerDocument: { createElement: () => canvas }, appendChild() {} };
    const createRenderer = () => ({ autoClear: true, getContext: () => ({ isContextLost: () => false }), clear() {}, setViewport() {}, setRenderTarget() {}, dispose() {} });
    let frames: Array<(t: number) => void> = [];
    const host = new FrameHost({}, container, { render: () => {} }, { createRenderer, requestFrame: cb => { frames.push(cb); return 1; }, cancelFrame() {} });
    let ticks = 0, simulated = 0, frameCalls = 0, frameSeconds = 0;
    host.setSimulation({ tick: dt => { ticks++; simulated += dt; }, frame: dt => { frameCalls++; frameSeconds += dt; } });
    host.start();
    const n = hz * 2; // two seconds
    for (let i = 0; i <= n; i++) { const f = frames; frames = []; for (const cb of f) cb(i * 1000 / hz); }
    assert.ok(Math.abs(simulated - 2) <= 1 / 120 + 1e-9, `${hz} Hz simulated ${simulated}`);
    assert.equal(frameCalls, n + 1, `${hz} Hz frame calls`);
    assert.ok(Math.abs(frameSeconds - 2) < 1e-6);
    host.setSimulation(null);
    const before = ticks; { const f = frames; frames = []; for (const cb of f) cb((n + 1) * 1000 / hz); }
    assert.equal(ticks, before, 'handed back: no more ticks');
    host.stop();
  }
});
