// node --import tsx --test src/canalRecall/ownMap/ownMap.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { toLocal, fromLocal, gameWorldToLngLat } from './frame';
import { toLocal as galleryToLocal } from '../galleryPipeline';
import { decodeLine, decodeOverview, encodeLine, streetClassOf, type OverviewFile } from './overviewFormat';
import { simplify, PolygonGrid } from './geometry';
import { cameraFrame, cameraForPoints, easeCamera, metresPerPixel, project, unproject, visibleBounds, type CameraState } from './mapCamera';
import { panBy, pinch, rotateAround, zoomAround, clampCamera } from './gestures';
import { mapLibreEye } from '../rendererSpike/ride';
import { placeLabels, CollisionGrid, type LabelCandidate } from './labels';
import { streetLabelVisible, poiLabelVisible, neighbourhoodLabelVisible, gameLabelContext, type LabelContext } from './labelPolicy';
import { buildSpoilerIndex } from '../orientationPois';
import { interpolateStops } from './style';
import type { Vec2 } from './frame';
import { answeredStreetPlacement, brandedPoiOverlay, ferryOverlay, transitOverlay, zoomStops, interpolateLinear } from './overlays';
import { ferryLabelVisible, brandIconVisible } from './labelPolicy';
import { footprintArrays } from './footprints';
import type { TransitNetwork } from '../transit/network';

const VP = { width: 1440, height: 900 };
const near = (a: number, b: number, eps: number, msg?: string) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} vs ${b}`);

test('frame: same local metres as galleryPipeline (buildings, own-ground)', () => {
  for (const [lng, lat] of [[4.88, 52.37], [4.95, 52.33], [4.80, 52.40]]) {
    const a = toLocal(lng, lat), b = galleryToLocal(lng, lat);
    near(a[0], b[0], 1e-9); near(a[1], b[1], 1e-9);
    const back = fromLocal(...a); near(back[0], lng, 1e-12); near(back[1], lat, 1e-12);
  }
  // The game's world frame (vector-map.js worldToLngLat), 3 px per metre.
  const loader = { _lastCenterLng: 4.9, _lastCenterLat: 52.37, _lastOffsetX: 1000, _lastOffsetY: 2000 };
  const [lng, lat] = gameWorldToLngLat(1000 + 300, 2000 - 300, loader);
  assert.ok(lng > 4.9 && lat > 52.37);
});

test('format: delta lines round-trip at the unit, classes map', () => {
  const pts: Vec2[] = [[0, 0], [10.2, -3.4], [10.2, -3.4], [-200.75, 99.5]];
  const back = decodeLine(encodeLine(pts, 0.5), 0.5);
  assert.equal(back.length, 3, 'repeated point dropped');
  near(back[2][0], -200.5, 0.26); near(back[2][1], 99.5, 0.26);
  assert.equal(streetClassOf('primary_link'), 'major');
  assert.equal(streetClassOf('busway'), 'service');
  assert.equal(streetClassOf('proposed'), null);
  assert.deepEqual(simplify([[0, 0], [1, 0.01], [2, 0], [3, 5]], 0.1), [[0, 0], [2, 0], [3, 5]]);
});

test('camera: the eye matches the renderer spike conversion of a MapLibre camera', () => {
  const center = toLocal(4.88475, 52.37395);
  for (const [zoom, pitch, bearing] of [[17, 0, 0], [18.4, 48, 40], [13.6, 0, 0], [16, 70, -120]]) {
    const f = cameraFrame({ center, zoom, pitch, bearing }, VP);
    const spike = mapLibreEye({ centre: center, zoom, pitchDeg: pitch, bearingDeg: bearing, fovDeg: 36.86989764584402, lat: 52.37395 }, VP.height);
    for (let i = 0; i < 3; i++) near(f.eye[i], spike.eye[i], Math.max(0.01, f.distance * 2e-4), `eye[${i}] z${zoom}`);
  }
});

test('camera: project/unproject round-trip, centre at screen centre, horizon null', () => {
  const cam: CameraState = { center: toLocal(4.89, 52.37), zoom: 16.5, pitch: 55, bearing: 30 };
  const f = cameraFrame(cam, VP);
  const c = project(f, cam.center); near(c.x, 720, 1e-6); near(c.y, 450, 1e-6);
  for (const [x, y] of [[0, 899], [1440, 600], [700, 300], [10, 450]]) {
    const g = unproject(f, x, y)!; assert.ok(g, `ground at ${x},${y}`);
    const p = project(f, g); near(p.x, x, 1e-6); near(p.y, y, 1e-6);
  }
  assert.equal(unproject(cameraFrame({ ...cam, pitch: 85 }, VP), 720, 0), null, 'sky above the horizon');
  // Plan view: one CSS px is metresPerPixel on the ground.
  const flat = cameraFrame({ ...cam, pitch: 0, bearing: 0 }, VP);
  const a = unproject(flat, 720, 450)!, b = unproject(flat, 721, 450)!;
  near(b[0] - a[0], metresPerPixel(16.5, 52.37), 1e-3);
  const box = visibleBounds(flat); assert.ok(box[2] - box[0] > 1440 * metresPerPixel(16.5, 52.37) * 0.99);
});

test('camera: cameraForPoints fits with padding at any bearing/pitch; ease is smooth', () => {
  const pts: Vec2[] = [toLocal(4.8837, 52.3747), toLocal(4.8826, 52.3641), toLocal(4.90, 52.37)];
  for (const [bearing, pitch] of [[0, 0], [45, 0], [0, 40]]) {
    const padding = { top: 140, bottom: 120, left: 56, right: 56 };
    const cam = cameraForPoints(pts, VP, { bearing, pitch, padding });
    const f = cameraFrame(cam, VP);
    const s = pts.map(p => project(f, p));
    for (const p of s) { assert.ok(p.x >= 55 && p.x <= 1385 && p.y >= 139 && p.y <= 781, `inside padding ${JSON.stringify(p)}`); }
    const tight = Math.min(...s.map(p => Math.min(p.x - 56, 1384 - p.x, p.y - 140, 780 - p.y)));
    assert.ok(tight < 3, `zoom is as large as fits (slack ${tight})`);
  }
  const a: CameraState = { center: [0, 0], zoom: 11, pitch: 0, bearing: 0 }, b: CameraState = { center: [3000, 1000], zoom: 18, pitch: 55, bearing: 350 };
  assert.deepEqual(easeCamera(a, b, 0).center, [0, 0]);
  const end = easeCamera(a, b, 1); near(end.center[0], 3000, 1e-6); near(end.zoom, 18, 1e-9); near(((end.bearing % 360) + 360) % 360, 350, 1e-6);
  near(easeCamera(a, b, 0.5).bearing, -5, 1e-6, 'bearing takes the short way');
});

test('gestures: drag grabs the ground, zoom and rotate keep the cursor point, pinch zooms', () => {
  const cam: CameraState = { center: toLocal(4.89, 52.37), zoom: 15, pitch: 40, bearing: 10 };
  const f0 = cameraFrame(cam, VP);
  const grabbed = unproject(f0, 400, 600)!;
  const panned = panBy(cam, VP, { x: 400, y: 600 }, { x: 650, y: 500 });
  const now = project(cameraFrame(panned, VP), grabbed); near(now.x, 650, 0.5); near(now.y, 500, 0.5);
  const at = { x: 1000, y: 300 }, under = unproject(f0, at.x, at.y)!;
  const zoomed = zoomAround(cam, VP, 1.5, at);
  near(zoomed.zoom, 16.5, 1e-9);
  const z = project(cameraFrame(zoomed, VP), under); near(z.x, at.x, 0.5); near(z.y, at.y, 0.5);
  const turned = rotateAround(cam, VP, 33, at);
  const r = project(cameraFrame(turned, VP), under); near(r.x, at.x, 0.5); near(r.y, at.y, 0.5);
  const spread = pinch(cam, VP, [[600, 450], [840, 450]], [[560, 450], [880, 450]]);
  assert.ok(spread.zoom > cam.zoom + 0.3, 'fingers apart zoom in');
  assert.equal(clampCamera({ ...cam, pitch: 99, zoom: 40 }).pitch, 70);
});

test('labels: collision never overlaps, curved text follows the line and reads upright', () => {
  const advance = () => 7;
  const fontSize = () => 12;
  const identity = (p: readonly number[]) => ({ x: p[0], y: p[1], depth: 10 });
  const cands: LabelCandidate[] = [];
  for (let i = 0; i < 60; i++) cands.push({ id: `p${i}`, text: `Place ${i}`, kind: 'poi', priority: i, at: [400 + (i % 6) * 20, 300 + Math.floor(i / 6) * 8] });
  // An arc drawn right-to-left: must come out reversed (upright) and bend glyph by glyph.
  const arc: Vec2[] = []; for (let a = 0; a <= 60; a += 3) { const t = a * Math.PI / 180; arc.push([700 - 300 * Math.sin(t), 700 - 300 * (1 - Math.cos(t))]); }
  cands.push({ id: 'street', text: 'Prinsengracht', kind: 'street', priority: 1000, path: arc });
  const placed = placeLabels(cands, { project: identity, width: 1440, height: 900, zoom: 17, advance, fontSize });
  const street = placed.find(l => l.id === 'street')!;
  assert.ok(street?.glyphs, 'line label placed');
  assert.ok(street.glyphs!.every(g => Math.cos(g.angle) > 0), 'upright');
  assert.ok(street.glyphs![street.glyphs!.length - 1].x > street.glyphs![0].x, 'left to right');
  const angles = street.glyphs!.map(g => g.angle);
  assert.ok(Math.max(...angles) - Math.min(...angles) > 0.05, 'curves with the line');
  const pois = placed.filter(l => l.kind === 'poi');
  assert.ok(pois.length > 3 && pois.length < 60, `collision thinned the cluster (${pois.length})`);
  const grid = new CollisionGrid();
  for (const l of pois) {
    const box: [number, number, number, number] = [l.x! - l.text.length * 3.5, l.y! - 6, l.x! + l.text.length * 3.5, l.y! + 6];
    assert.ok(!grid.hits(box), `no overlap at ${l.text}`); grid.insert(box);
  }
  // Behind the eye: nothing.
  assert.equal(placeLabels(cands, { project: p => ({ x: p[0], y: p[1], depth: -1 }), width: 1440, height: 900, zoom: 17, advance, fontSize }).length, 0);
});

test('label policy: earned names only; the asked name never, even when earned; POI spoilers; quiet quiz', () => {
  const ctx: LabelContext = { isLabelled: t => ['Nassaukade', 'Overtoom', 'Singelgracht'].includes(t), hiddenName: 'Nassaukade', spoilerIndex: buildSpoilerIndex(['Nassaukade', 'Overtoom']), quizQuiet: false };
  assert.equal(streetLabelVisible(ctx, 'Nassaukade', 0, 0), false, 'asked beats earned');
  assert.equal(streetLabelVisible(ctx, 'nassaukade', 0, 0), false, 'case-insensitive');
  assert.equal(streetLabelVisible(ctx, 'Overtoom', 0, 0), true);
  assert.equal(streetLabelVisible(ctx, 'Kinkerstraat', 0, 0), false, 'not earned');
  assert.equal(poiLabelVisible(ctx, 'Tramhalte Nassaukade'), false);
  assert.equal(poiLabelVisible(ctx, 'Café Overtoom'), false);
  assert.equal(poiLabelVisible(ctx, 'Kazerne Hendrik'), true);
  assert.equal(poiLabelVisible({ ...ctx, quizQuiet: true }, 'Kazerne Hendrik'), false);
  assert.equal(neighbourhoodLabelVisible({ ...ctx, quizQuiet: true }), false);
  // Earned per place (recallRules.isPlaceKnown), not per name.
  const game = gameLabelContext({ mapLabelNames: new Set(), knownPlaces: new Map([['Overtoom', [{ x: 0, y: 0 }]]]), knownRadius: 300, spoilerNames: [], quizQuiet: false, toWorld: (x, y) => ({ x: x * 3, y: -y * 3 }) });
  assert.equal(streetLabelVisible(game, 'Overtoom', 10, 10), true, 'near where it was answered');
  assert.equal(streetLabelVisible(game, 'Overtoom', 2000, 0), false, 'the far end has not been asked');
});

// Named regressions on the published extract.
const overview = decodeOverview(JSON.parse(gunzipSync(readFileSync('public/data/extracts/amsterdam/own-map-v1/overview.json.gz')).toString()) as OverviewFile);

test('extract: water test replaces queryRenderedFeatures (Singelgracht at the Da Costagracht mouth)', () => {
  const water = new PolygonGrid(overview.water);
  assert.equal(water.contains(...toLocal(4.87485, 52.37269)), true, 'Singelgracht water');
  assert.equal(water.contains(...toLocal(4.87567, 52.37259)), false, 'Kazerne Hendrik block, east bank');
  assert.equal(water.contains(...toLocal(4.8838, 52.3747)), false, 'Westermarkt');
  assert.ok(overview.streets.length > 60_000 && overview.water.length > 10_000 && overview.parks.length > 200);
});

test('extract: with every name earned, Nassaukade under question is never placed at Nassaukade', () => {
  const ctx: LabelContext = { isLabelled: () => true, hiddenName: 'Nassaukade', spoilerIndex: buildSpoilerIndex(['Nassaukade']), quizQuiet: false };
  const cands: LabelCandidate[] = [];
  overview.streets.forEach((s, i) => { const m = s.points[s.points.length >> 1]; if (s.name && streetLabelVisible(ctx, s.name, m[0], m[1])) cands.push({ id: `s${i}`, text: s.name, kind: 'street', priority: 1, path: s.points }); });
  overview.waterLines.forEach((w, i) => { const m = w.points[w.points.length >> 1]; if (streetLabelVisible(ctx, w.name, m[0], m[1])) cands.push({ id: `w${i}`, text: w.name, kind: 'water', priority: 2, path: w.points }); });
  for (const cam of [{ center: toLocal(4.87445, 52.37286), zoom: 16.8, pitch: 0, bearing: 0 }, { center: toLocal(4.87465, 52.37301), zoom: 18.4, pitch: 48, bearing: 40 }] as CameraState[]) {
    const f = cameraFrame(cam, VP);
    const placed = placeLabels(cands, { project: p => project(f, p), width: VP.width, height: VP.height, zoom: cam.zoom, advance: () => 7, fontSize: () => 12, maxDepth: f.distance * 4 });
    assert.ok(placed.length > 3, 'other names do draw');
    assert.deepEqual(placed.filter(l => /nassaukade/i.test(l.text)).map(l => l.text), []);
  }
});

test('extract v2: rail, tram, landuse, piers and neighbourhood outlines are in the overview', () => {
  const close = (pts: Vec2[], p: Vec2, r: number) => pts.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < r);
  const centraal = toLocal(4.9003, 52.3789);
  assert.ok(overview.rail.some(r => r.kind === 'rail' && !r.tunnel && close(r.points, centraal, 150)), 'rail into Centraal');
  assert.ok(overview.rail.some(r => r.kind === 'tram' && close(r.points, toLocal(4.8826, 52.3641), 80)), 'tram at Leidseplein');
  assert.ok(overview.rail.some(r => r.kind === 'subway' && r.tunnel), 'metro in tunnel');
  // Zorgvlied cemetery (Amsteldijk, 52.3356 N 4.9004 E).
  const cemeteries = new PolygonGrid(overview.landuse.filter(l => l.cls === 'cemetery').map(l => l.rings));
  assert.equal(cemeteries.contains(...toLocal(4.9004, 52.3356)), true, 'Zorgvlied is a cemetery');
  assert.ok(overview.piers.length > 300 && overview.hoodRings.length >= 40);
  assert.ok(overview.streets.filter(s => s.cls === 'path').length > 10_000, 'footways');
});

const network = JSON.parse(readFileSync('public/data/extracts/amsterdam/transit-network.json', 'utf8')) as TransitNetwork;

test('overlays: transit corridors use the game layer objects; GTFS colours without # fall back as MapLibre does', () => {
  assert.deepEqual(zoomStops(['interpolate', ['linear'], ['zoom'], 13, 7, 18, 18]), { stops: [[13, 7], [18, 18]], linear: true });
  assert.equal(interpolateLinear([[13, 7], [18, 18]], 15.5), 12.5);
  const sets = transitOverlay(network);
  const byId = Object.fromEntries(sets.map(s => [s.spec.id, s]));
  assert.ok(byId['transit-network-surface'].lines.length >= 15, 'every tram line');
  assert.ok(byId['transit-network-tunnel'].lines.length >= 5, 'every metro line');
  assert.deepEqual(byId['transit-network-tunnel'].spec.dash, [1.2, 1.6]);
  assert.equal(byId['transit-network-tunnel'].spec.above, true);
  assert.ok(byId['transit-network-tunnel'].lines.every(l => l.color === '#F59E0B'), 'metro: "187A36" is no colour to MapLibre');
  assert.ok(byId['transit-network-surface'].lines.every(l => l.color === '#E11D48'));
  near(byId['transit-network-tunnel-casing'].spec.opacity, 0.85 * 0.72, 1e-9, 'rgba alpha folded into opacity');
});

test('overlays: ferries, brands and the answered lettering; spoilers withheld', () => {
  const ferry = ferryOverlay(network);
  assert.ok(ferry.lines.length >= 10);
  assert.ok(ferry.terminals.some(t => t.name === 'Buiksloterweg'));
  const ctx: LabelContext = { isLabelled: () => true, hiddenName: 'Buiksloterweg', spoilerIndex: buildSpoilerIndex(['Buiksloterweg']), quizQuiet: true };
  assert.equal(ferryLabelVisible(ctx, 'Buiksloterweg'), false);
  assert.equal(ferryLabelVisible(ctx, 'NDSM-werf'), true, 'not quieted');
  assert.equal(brandIconVisible({ ...ctx, hiddenName: 'Overtoom', spoilerIndex: buildSpoilerIndex(['Overtoom']) }, 'Albert Heijn Overtoom'), false);
  const pois = [{ id: 'a', name: 'Albert Heijn', kind: 'albert-heijn', center: [52.37, 4.88] as [number, number] }, { id: 'b', name: 'Café Overtoom', kind: 'local-food', center: [52.36, 4.87] as [number, number] }];
  assert.deepEqual(brandedPoiOverlay(pois, n => /overtoom/i.test(n)).map(p => p.id), ['a']);
  // A straight street running north; rider heading north near its south end: lettering 40 m ahead (120 game px), top pointing north.
  const street: Vec2[] = [[0, 0], [0, 500]];
  const [p] = answeredStreetPlacement([street], { at: [0, 10], bearing: 0 });
  near(p.at[1], 50, 1e-6); near(p.at[0], 0, 1e-6); near(p.bearing, 0, 1e-6);
  const [back] = answeredStreetPlacement([street], { at: [0, 400], bearing: 180 });
  near(back.at[1], 360, 1e-6); near(back.bearing, 180, 1e-6);
});

test('footprints: arrays for the worker (top + walls, linear colour)', () => {
  const sq = [[[4.9, 52.37], [4.9001, 52.37], [4.9001, 52.3701], [4.9, 52.3701], [4.9, 52.37]]];
  const a = footprintArrays([{ properties: { height: 12 }, geometry: { type: 'Polygon', coordinates: sq } }], toLocal, '#ffffff', '#808080');
  assert.equal(a.position.length / 3, 5 + 4 * 4);
  assert.equal(a.index.length, 2 * 3 + 4 * 6, 'two roof triangles, two per wall');
  near(a.position[2], 12, 1e-6);
  near(a.color[0], 1, 1e-9);
  assert.ok(a.color[5 * 3] < 0.25, 'wall grey is linear (0.216 × shade)');
});

test('style: MapLibre-like exponential stops', () => {
  near(interpolateStops([[14, 2], [16, 8]], 15), 4, 1e-9);
  near(interpolateStops([[14, 2], [16, 8]], 10), 2, 1e-9);
});
