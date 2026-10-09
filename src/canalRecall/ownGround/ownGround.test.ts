// Own-ground prototype: relief field, surface + decks, draped meshes, cross-sections, water, placement.
//   node --import tsx --test src/canalRecall/ownGround/ownGround.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { deflateSync, gunzipSync, inflateSync } from 'node:zlib';
import { readGeoTiff, undoFloatPredictor } from './geotiff';
import { applyLocalToRd, decodeTile, downsample, encodeTile, fitLocalToRd, GroundField, NODATA, pullPushFill, type GroundIndex, type LocalToRd } from './heightField';
import { DECK_BLEND_M, GroundSurface, riderPose, type Vec2 } from './surface';
import { cutIntervals, drapeTriangles, edgeWall, emptyMesh, endCap, reliefGrid, ribbon, type MeshArrays } from './drape';
import { crossSection, parseMetres, areaKind } from './osmGround';
import { buildStreets, prepareWays, routeRibbon, LIFT } from './streets';
import { buildWaterMask, maskDistance, quayWallMesh, waterSurfaceMesh } from './water';
import { flatDeckBody, measuredDeckBody } from './decks';
import { binByBase, footprintBase, liftRanges } from './placement';
import { routeAhead } from './route';
import type { DeckProfile } from '../elevation/bridgeDeck';
import { decodeProfile } from '../elevation/bridgeDeck';
import { localToLngLat, type BridgeExtract, type ElevationIndex } from '../elevation/elevationData';
import { fromLocal, toLocal } from '../galleryPipeline';
import { lngLatToRd } from '../facade/rdNew';

// ------------------------------------------------------------- helpers
function faces(m: MeshArrays): { n: [number, number, number]; c: [number, number, number] }[] {
  const p = m.positions, out: { n: [number, number, number]; c: [number, number, number] }[] = [];
  for (let i = 0; i < m.indices.length; i += 3) {
    const [a, b, c] = [m.indices[i], m.indices[i + 1], m.indices[i + 2]].map(k => [p[k * 3], p[k * 3 + 1], p[k * 3 + 2]]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    out.push({ n: [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], c: [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3] });
  }
  return out;
}
const flatField = (h: (x: number, y: number) => number, step = 2, tile = 100, tiles: [number, number][] = [[0, 0], [1, 0], [0, 1], [1, 1]]) => {
  const f = new GroundField(step, tile), n = tile / step;
  for (const [tx, ty] of tiles) {
    const d = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) d[j * n + i] = h(tx * tile + (i + 0.5) * step, ty * tile + (j + 0.5) * step);
    f.addTile(tx, ty, d);
  }
  return f;
};
const IDENTITY: LocalToRd = { cx: 0, cy: 0, r: 1, a: [0, 1, 0, 0, 0, 0], b: [0, 0, 1, 0, 0, 0] };

/** A classic little-endian float32 TIFF with deflate + floating-point predictor, like PDOK's. */
function makeTiff(width: number, height: number, values: Float32Array, rowsPerStrip = 2): Uint8Array {
  const strips: Uint8Array[] = [];
  for (let y0 = 0; y0 < height; y0 += rowsPerStrip) {
    const rows = Math.min(rowsPerStrip, height - y0), raw = new Uint8Array(rows * width * 4);
    for (let r = 0; r < rows; r++) {
      const bytes = new Uint8Array(new Float32Array(values.subarray((y0 + r) * width, (y0 + r + 1) * width)).buffer);
      const row = new Uint8Array(width * 4);
      for (let x = 0; x < width; x++) for (let b = 0; b < 4; b++) row[b * width + x] = bytes[x * 4 + 3 - b];
      for (let i = row.length - 1; i > 0; i--) row[i] = (row[i] - row[i - 1]) & 0xff;
      raw.set(row, r * width * 4);
    }
    strips.push(new Uint8Array(deflateSync(raw)));
  }
  const nodata = '3.4028234663852886e+38\0';
  const entries: [number, number, number[] | string][] = [
    [256, 3, [width]], [257, 3, [height]], [258, 3, [32]], [259, 3, [8]], [262, 3, [1]], [273, 4, []], [277, 3, [1]], [278, 3, [rowsPerStrip]],
    [279, 4, strips.map(s => s.length)], [317, 3, [3]], [339, 3, [3]], [33550, 12, [0.5, 0.5, 0]], [33922, 12, [0, 0, 0, 1000, 2000, 0]], [42113, 2, nodata],
  ];
  const size = (t: number) => (t === 3 ? 2 : t === 4 ? 4 : t === 12 ? 8 : 1);
  const count = (e: (typeof entries)[number]) => (typeof e[2] === 'string' ? e[2].length : e[0] === 273 ? strips.length : e[2].length);
  let extra = 8 + 2 + entries.length * 12 + 4;
  const extraOffsets = entries.map(e => { const bytes = size(e[1]) * count(e); if (bytes <= 4) return -1; const o = extra; extra += bytes; return o; });
  const dataStart = extra, total = dataStart + strips.reduce((s, x) => s + x.length, 0);
  const buf = new Uint8Array(total), view = new DataView(buf.buffer);
  view.setUint16(0, 0x4949); view.setUint16(2, 42, true); view.setUint32(4, 8, true); view.setUint16(8, entries.length, true);
  const stripOffsets: number[] = []; let at = dataStart;
  for (const s of strips) { stripOffsets.push(at); buf.set(s, at); at += s.length; }
  entries.forEach((e, i) => {
    const p = 10 + i * 12, values = e[0] === 273 ? stripOffsets : e[2];
    view.setUint16(p, e[0], true); view.setUint16(p + 2, e[1], true); view.setUint32(p + 4, count(e), true);
    const target = extraOffsets[i] >= 0 ? extraOffsets[i] : p + 8;
    if (extraOffsets[i] >= 0) view.setUint32(p + 8, extraOffsets[i], true);
    if (typeof values === 'string') { for (let k = 0; k < values.length; k++) buf[target + k] = values.charCodeAt(k); return; }
    values.forEach((v, k) => { if (e[1] === 3) view.setUint16(target + k * 2, v, true); else if (e[1] === 4) view.setUint32(target + k * 4, v, true); else view.setFloat64(target + k * 8, v, true); });
  });
  return buf;
}

// ------------------------------------------------------------- geotiff + field
test('GeoTIFF reader decodes deflate + floating-point predictor strips and nodata', () => {
  const w = 5, h = 3, values = new Float32Array([1.25, -2.5, 3.0625, 0, 7.75, 0.1, 0.2, 3.4028234663852886e38, 0.4, 0.5, -1, -1.5, -2, -2.5, -3]);
  const r = readGeoTiff(makeTiff(w, h, values), b => inflateSync(b));
  assert.equal(r.width, 5); assert.equal(r.height, 3);
  assert.equal(r.originX, 1000); assert.equal(r.originY, 2000); assert.equal(r.pixelX, 0.5);
  assert.ok(Number.isNaN(r.data[7]), 'GDAL nodata becomes NaN');
  for (const i of [0, 1, 2, 4, 5, 10, 14]) assert.equal(r.data[i], Math.fround(values[i]));
  // The predictor alone: a row of zeros stays zeros.
  const out = new Float32Array(2); undoFloatPredictor(new Uint8Array(8), 2, out, 0); assert.deepEqual([...out], [0, 0]);
});

test('downsample flips to south-first rows and leaves sparse blocks as holes', () => {
  // 4×4 north-up raster, factor 2: top-left block measured, bottom-right has one valid pixel.
  const d = new Float32Array(16).fill(NaN);
  d[0] = 1; d[1] = 3; d[4] = 1; d[5] = 3; d[15] = 9;
  const g = downsample({ width: 4, height: 4, data: d }, 2, 2);
  assert.equal(g.width, 2);
  assert.equal(g.data[2], 2, 'north-west block lands in the top (north) output row');
  assert.ok(Number.isNaN(g.data[1]), 'one valid pixel of four is a hole when minValid=2');
});

test('pull-push fill keeps measured samples and fills holes within their range', () => {
  const w = 32, h = 32, data = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) data[j * w + i] = i < 16 ? 1 : 2;
  for (let j = 10; j < 20; j++) for (let i = 10; i < 22; i++) data[j * w + i] = NaN; // a building
  const before = data.slice();
  const filled = pullPushFill({ width: w, height: h, data });
  assert.equal(filled, 120);
  for (let k = 0; k < data.length; k++) {
    if (before[k] === before[k]) assert.equal(data[k], before[k]);
    else assert.ok(data[k] >= 1 && data[k] <= 2, `filled ${data[k]}`);
  }
  assert.ok(data[15 * w + 11] < data[15 * w + 20], 'fill follows the sides it is nearer');
});

test('tile encoding round-trips centimetres, wraps deltas and keeps nodata', () => {
  const n = 4, h = new Float32Array([-5.03, 300, -300, 0.01, 1, 1, 1, 1, NaN, 2.5, 2.49, 2.51, 0, 0, 0, 327]);
  const back = decodeTile(encodeTile(h, n), n);
  for (let i = 0; i < h.length; i++) {
    if (Number.isNaN(h[i])) assert.ok(Number.isNaN(back[i]));
    else assert.ok(Math.abs(back[i] - h[i]) <= 0.005 + 1e-6, `${i}: ${back[i]} vs ${h[i]}`);
  }
});

test('GroundField samples bilinearly across tile seams', () => {
  const f = flatField((x, y) => 0.01 * x + 0.02 * y);
  for (const [x, y] of [[99.5, 50], [100, 100], [3, 197], [150.25, 99.9]]) assert.ok(Math.abs(f.heightRd(x, y) - (0.01 * x + 0.02 * y)) < 1e-5, `${x},${y}`);
  assert.ok(Number.isNaN(f.heightRd(-50, -50)));
});

test('local → RD quadratic fit is centimetre-exact over a prototype box', () => {
  const toRd = (x: number, y: number): [number, number] => { const p = lngLatToRd(fromLocal(x, y)); return [p.x, p.y]; };
  const [cx, cy] = toLocal(4.869, 52.37);
  const { map, maxResidualM } = fitLocalToRd(toRd, cx, cy, 1000);
  assert.ok(maxResidualM < 0.01, `residual ${maxResidualM}`);
  const [x, y] = applyLocalToRd(map, cx + 640, cy - 310), [ex, ey] = toRd(cx + 640, cy - 310);
  assert.ok(Math.hypot(x - ex, y - ey) < 0.01);
});

// ------------------------------------------------------------- surface + decks
function syntheticDeck(): DeckProfile {
  // A 40 m bridge along +x at y = 0, humped 1.5 m in the middle, 8 m wide on the deck.
  const n = 81, x = new Float64Array(n), y = new Float64Array(n), s = new Float64Array(n), h = new Float64Array(n), hw = new Float64Array(n);
  // Approach ramps 0–8 m and 32–40 m (relief carries them in reality), hump over the deck span 8–32 m.
  for (let i = 0; i < n; i++) { x[i] = i * 0.5; s[i] = i * 0.5; h[i] = s[i] < 8 ? 0.3 * s[i] / 8 : s[i] > 32 ? 0.3 * (40 - s[i]) / 8 : 0.3 + 1.2 * Math.sin(Math.PI * (s[i] - 8) / 24); hw[i] = s[i] >= 8 && s[i] <= 32 ? 4 : 2; }
  return { id: 'T', name: 'test', family: 'masonry-arch', x, y, s, h, halfWidth: hw, water: [12, 28], deck: [8, 32], bbox: [-5, -9, 45, 9] };
}

test('a deck placed on the relief meets the ground at its ends and humps between', () => {
  const field = flatField((x, y) => 1 + 0.01 * x, 2, 100, [[-1, -1], [0, -1], [-1, 0], [0, 0]]);
  const s = new GroundSurface(field, IDENTITY, 1);
  const deck = s.addDeck(syntheticDeck());
  assert.deepEqual(deck.span, [8, 32]);
  assert.ok(Math.abs(deck.ends[0] - s.ground(0, 0)) < 1e-9 && Math.abs(deck.ends[1] - s.ground(40, 0)) < 1e-9);
  assert.equal(s.height(4, 0), s.ground(4, 0), 'approaches are relief only');
  for (const y of [0, 3.9]) {
    assert.ok(Math.abs(s.height(8.01, y) - s.ground(8.01, y)) < 0.01, 'no step where the deck starts');
    assert.ok(Math.abs(s.height(31.99, y) - s.ground(31.99, y)) < 0.01, 'no step where the deck ends');
  }
  assert.ok(Math.abs(s.height(20, 0) - (s.ground(20, 0) + 1.5)) < 0.02, 'crown is the measured height above the re-based approach chord');
  // Continuity along the axis: no jump bigger than the hump's slope allows.
  let worst = 0, at = 0; for (let x = -2; x < 42; x += 0.25) { const d = Math.abs(s.height(x + 0.25, 1) - s.height(x, 1)); if (d > worst) { worst = d; at = x; } }
  // Continuous: the steepest 0.25 m step is the ease taking up the 0.3 m approach ramp this flat test relief lacks.
  assert.ok(worst < 0.12, `max step ${worst} at x=${at}`);
  // Laterally: full height on the deck, blended to the ground within DECK_BLEND_M of the edge.
  assert.ok(Math.abs(s.height(20, 3.9) - s.height(20, 0)) < 1e-6);
  assert.ok(Math.abs(s.height(20, 4 + DECK_BLEND_M + 0.01) - s.ground(20, 4 + DECK_BLEND_M + 0.01)) < 1e-9);
  assert.ok(s.height(20, -20) === s.ground(20, -20));
  const pose = riderPose(s.height, 12, 0, [1, 0]);
  assert.ok(pose.pitch > 0.05, 'nose up on the way up');
});

test('measured deck body: outward side faces, a soffit/vault over water, abutments buried over land', () => {
  const field = flatField(() => 1, 2, 100, [[-1, -1], [0, -1], [-1, 0], [0, 0]]);
  const s = new GroundSurface(field, IDENTITY, 1);
  const deck = s.addDeck(syntheticDeck());
  const water = (x: number) => x > 12 && x < 28;
  const body = measuredDeckBody(deck, s.ground, x => water(x), -1.77);
  const f = faces(body);
  assert.ok(f.length > 100);
  for (const { n, c } of f) {
    if (Math.abs(n[2]) > Math.hypot(n[0], n[1])) continue; // tops / soffits
    if (Math.abs(c[1]) > 3.9) assert.ok(Math.sign(n[1]) === Math.sign(c[1]), `side face at y=${c[1].toFixed(2)} faces outward`);
    else if (Math.abs(c[1]) > 3.7) assert.ok(Math.sign(n[1]) === -Math.sign(c[1]), `parapet inner face at y=${c[1].toFixed(2)} faces the road`);
  }
  let lowest = Infinity;
  for (let i = 0; i < body.positions.length; i += 3) if (!water(body.positions[i])) lowest = Math.min(lowest, body.positions[i + 2]);
  assert.ok(lowest <= -0.39, `land abutments go below the relief (${lowest})`);
  assert.ok(f.some(x => water(x.c[0]) && x.n[2] < 0), 'downward faces over water');
});

test('flat deck: draped top, fascia only over water', () => {
  const ring: Vec2[] = [[0, -4], [20, -4], [20, 4], [0, 4]];
  const { top, body } = flatDeckBody(ring, () => 0.5, (x) => x > 5 && x < 15);
  for (const { n, c } of faces(top)) { assert.ok(n[2] > 0); assert.ok(Math.abs(c[2] - 0.52) < 1e-6); }
  const sides = faces(body).filter(x => Math.abs(x.n[2]) < 1e-9);
  assert.ok(sides.length > 0 && sides.every(x => x.c[0] > 4 && x.c[0] < 16), 'fascia only along the water');
  for (const x of sides) assert.ok(Math.sign(x.n[1]) === Math.sign(x.c[1]), 'fascia faces out');
});

// ------------------------------------------------------------- drape
test('ribbons, walls and caps are wound the way they face', () => {
  const h = (x: number, y: number) => 0.1 * x + 0.05 * y;
  const m = emptyMesh();
  ribbon(m, [[0, 0], [10, 0], [20, 5]], 1, 4, h, 0.03, { step: 2 });
  for (const { n, c } of faces(m)) { assert.ok(n[2] > 0, 'ribbon faces up'); assert.ok(Math.abs(c[2] - h(c[0], c[1]) - 0.03) < 0.05); }
  const w = emptyMesh(); edgeWall(w, [[0, 0], [10, 0]], 2, () => 0, 0.14, 0, 1);
  for (const { n } of faces(w)) assert.ok(n[1] > 0 && Math.abs(n[2]) < 1e-9, 'facing +1 is the left (+y) side');
  const r = emptyMesh(); edgeWall(r, [[0, 0], [10, 0]], -2, () => 0, 0.14, 0, -1);
  for (const { n } of faces(r)) assert.ok(n[1] < 0);
  const cap = emptyMesh(); endCap(cap, [10, 0], [1, 0], 0, 2, () => 0, 0.14, 0, true);
  for (const { n } of faces(cap)) assert.ok(n[0] > 0, 'forward cap faces forward');
  const tri = emptyMesh(); drapeTriangles(tri, [0, 0, 20, 0, 0, 20], [0, 2, 1], h, 0.01, 3);
  assert.ok(faces(tri).length >= 49 && faces(tri).every(f => f.n[2] > 0), 'subdivided and turned up');
  const grid = reliefGrid(0, 0, 20, 20, 5, h, (x) => x < 10);
  assert.equal(grid.indices.length / 3, 2 * 2 * 4);
});

test('cutIntervals removes station ranges and keeps the rest', () => {
  const pieces = cutIntervals([[0, 0], [100, 0]], [[10, 20], [15, 30], [90, 120]]);
  assert.deepEqual(pieces.map(p => [p[0][0], p[p.length - 1][0]]), [[0, 10], [30, 90]]);
});

// ------------------------------------------------------------- OSM cross-sections + streets
test('cross-sections use tags first and priors second', () => {
  assert.equal(parseMetres('3,5 m'), 3.5); assert.equal(parseMetres('wide'), null);
  const tagged = crossSection({ highway: 'residential', width: '7', sidewalk: 'left', cycleway: 'lane' })!;
  assert.equal(tagged.bands[0].width, 7); assert.equal(tagged.source.width, 'tag');
  assert.deepEqual(tagged.bands.filter(b => b.kind === 'sidewalk').map(b => Math.sign(b.offset)), [1]);
  assert.equal(tagged.bands.filter(b => b.kind === 'cycle_lane').length, 2);
  const lanes = crossSection({ highway: 'primary', lanes: '2', oneway: 'yes', sidewalk: 'separate', 'cycleway:right': 'track' })!;
  assert.equal(lanes.bands[0].width, 6.4); assert.equal(lanes.source.width, 'lanes');
  assert.equal(lanes.bands.filter(b => b.kind === 'sidewalk').length, 0, 'separately mapped sidewalks are not doubled');
  const track = lanes.bands.find(b => b.kind === 'cycle_track')!;
  assert.ok(track.offset < 0 && track.raised > 0);
  const prior = crossSection({ highway: 'residential' })!;
  assert.equal(prior.source.sidewalk, 'prior'); assert.equal(prior.bands.filter(b => b.kind === 'sidewalk').length, 2);
  assert.equal(crossSection({ highway: 'service', tunnel: 'yes' }), null);
  assert.equal(crossSection({ highway: 'platform' }), null);
  const zebra = crossSection({ highway: 'footway', footway: 'crossing', crossing: 'zebra' })!;
  assert.equal(zebra.paint.length, 1);
  assert.equal(crossSection({ highway: 'footway', footway: 'crossing', crossing: 'traffic_signals' })!.paint.length, 0);
  assert.equal(crossSection({ highway: 'cycleway' })!.bands[0].surface, 'cycle');
  assert.equal(areaKind({ highway: 'pedestrian', area: 'yes' }), 'square');
  assert.equal(areaKind({ leisure: 'park' }), 'park');
});

test('raised sidewalks stop at a side street on their side only; bands drape onto decks', () => {
  const field = flatField(() => 1, 2, 100, [[-1, -1], [0, -1], [-1, 0], [0, 0]]);
  const s = new GroundSurface(field, IDENTITY, 1);
  s.addDeck(syntheticDeck());
  const ll = (p: Vec2): [number, number] => p as [number, number];
  const ways = prepareWays([
    { id: 1, tags: { highway: 'residential', sidewalk: 'both' }, g: [[-40, 0], [0, 0], [40, 0], [60, 0]] },
    { id: 2, tags: { highway: 'residential', sidewalk: 'no' }, g: [[0, 0], [0, 40]] }, // side street to the left at x = 0
  ], p => ll(p as Vec2));
  const streets = buildStreets(ways, s.height);
  // Left sidewalk (y ≈ +3.5) has a gap around x = 0; the right one does not.
  const kerbX = (side: number) => faces(streets.paving).filter(f => Math.sign(f.c[1]) === side && Math.abs(f.c[0]) < 2).length;
  assert.equal(kerbX(1), 0, 'left sidewalk cut at the side street');
  assert.ok(kerbX(-1) > 0, 'right sidewalk continues');
  // The carriageway over the deck carries the hump.
  const onDeck = faces(streets.klinker).filter(f => Math.abs(f.c[0] - 20) < 1 && Math.abs(f.c[1]) < 2);
  assert.ok(onDeck.length > 0 && onDeck.every(f => Math.abs(f.c[2] - (s.height(f.c[0], f.c[1]) + LIFT.carriageway)) < 0.05));
  assert.ok(onDeck[0].c[2] > 1.1, 'carriageway is up on the crown');
  const route = routeRibbon([[-30, 0], [50, 0]], s.height);
  assert.ok(Math.max(...faces(route).map(f => f.c[2])) > 1.2, 'route ribbon rides over the hump');
});

test('routeAhead leaves along the facing direction and prefers the named street', () => {
  const ways = prepareWays([
    { id: 1, tags: { highway: 'residential', name: 'A' }, g: [[0, 0], [50, 0], [100, 0]] },
    { id: 2, tags: { highway: 'residential', name: 'B' }, g: [[50, 0], [80, 40]] },
  ], p => p as Vec2);
  const east = routeAhead(ways, [10, 1], [1, 0], 200);
  assert.deepEqual(east[east.length - 1], [100, 0]);
  const pref = routeAhead(ways, [10, 1], [1, 0], 200, 'B');
  assert.deepEqual(pref[pref.length - 1], [80, 40]);
});

// ------------------------------------------------------------- water + placement
test('water mask: exact signed distance at the shore; quay walls face the water and follow the bank', () => {
  // A 10 m canal along x between y = 0 and y = 10; shores run with the water on their left.
  const geo = { polygons: [[[[-50, 0], [50, 0], [50, 10], [-50, 10]] as Vec2[]]], shores: [[[-50, 0], [50, 0]] as Vec2[], [[50, 10], [-50, 10]] as Vec2[]] };
  const mask = buildWaterMask(geo, -60, -20, 60, 30, 1, 4);
  assert.ok(Math.abs(maskDistance(mask, 0, -1.3) - 1.3) < 0.05);
  assert.ok(Math.abs(maskDistance(mask, 3, 0.6) + 0.6) < 0.05);
  assert.ok(maskDistance(mask, 0, 5) <= -4 + 1e-6);
  const bank = (x: number, y: number) => (y < 5 ? 0.3 + 0.01 * x : 0);
  const walls = quayWallMesh(geo, bank, -1.77);
  const f = faces(walls);
  assert.ok(f.length > 0);
  for (const { n, c } of f) assert.ok(c[1] < 5 ? n[1] > 0 : n[1] < 0, 'walls face into the canal');
  const tops = walls.positions.filter((_, i) => i % 3 === 2);
  assert.ok(Math.max(...tops) > 0.75 && Math.max(...tops) < 0.81, 'top follows the sloping bank');
  // A bank at water level gets no wall.
  assert.equal(quayWallMesh(geo, () => -1.7, -1.77).indices.length, 0);
  // A bridge deck across the canal: the land channel still says water there, the street channel says deck.
  const decked = buildWaterMask(geo, -60, -20, 60, 30, 1, 4, [[[-4, -2], [4, -2], [4, 12], [-4, 12]]]);
  const fx = (m: typeof decked, x: number, y: number) => maskDistance({ ...m, sdf: m.sdfStreets }, x, y);
  assert.ok(maskDistance(decked, 0, 5) < 0, 'land is cut under the deck');
  assert.ok(fx(decked, 0, 5) > 0, 'street bands survive on the deck');
  assert.ok(fx(decked, 5.5, 5) < 0 && Math.abs(fx(decked, 5.5, 5) + 1.5) < 0.1, 'and stop at its edge over water');
  assert.ok(fx(decked, 20, 5) <= -4 + 1e-6);
  const surf = waterSurfaceMesh(geo, -1.77);
  assert.ok(faces(surf).every(x => x.n[2] > 0 && Math.abs(x.c[2] + 1.77) < 1e-9));
});

test('model bases: footprint minimum, floor binning, per-building range lift', () => {
  const h = (x: number) => 0.1 * x;
  const b = footprintBase([[0, 0], [10, 0], [10, 10], [0, 10]], h);
  assert.equal(b.base, 0); assert.equal(b.max, 1);
  const bins = binByBase([0.05, 0.19, 0.21, -0.01], z => z, 0.2);
  assert.deepEqual([...bins.keys()].sort((a, c) => a - c), [-0.2, 0, 0.2]);
  const pos = new Float32Array(12);
  assert.equal(liftRanges(pos, [{ id: 'a', start: 0, count: 2 }, { id: 'b', start: 2, count: 2 }], id => (id === 'a' ? 1.5 : undefined)), 1);
  assert.deepEqual([pos[2], pos[5], pos[8]], [1.5, 1.5, 0]);
});

// ------------------------------------------------------------- named regressions on the published extracts
const EXTRACT = 'public/data/extracts/amsterdam';
const haveExtracts = existsSync(`${EXTRACT}/ground-height-v1/index.json`) && existsSync(`${EXTRACT}/elevation-v1/bridges.json`);

function realSurface(lng: number, lat: number): GroundSurface {
  const index = JSON.parse(readFileSync(`${EXTRACT}/ground-height-v1/index.json`, 'utf8')) as GroundIndex;
  const field = new GroundField(index.stepM, index.tileSizeM);
  for (const [tx, ty] of index.tiles) field.addTile(tx, ty, decodeTile(gunzipSync(readFileSync(`${EXTRACT}/ground-height-v1/tiles/${tx}_${ty}.bin`)), index.samples));
  const [cx, cy] = toLocal(lng, lat);
  const toRd = (x: number, y: number): [number, number] => { const p = lngLatToRd(fromLocal(x, y)); return [p.x, p.y]; };
  return new GroundSurface(field, fitLocalToRd(toRd, cx, cy, 2000).map, index.sceneDatumNAP);
}
function realDeck(s: GroundSurface, id: string) {
  const eIndex = JSON.parse(readFileSync(`${EXTRACT}/elevation-v1/index.json`, 'utf8')) as ElevationIndex;
  const bridges = JSON.parse(readFileSync(`${EXTRACT}/elevation-v1/bridges.json`, 'utf8')) as BridgeExtract;
  const b = bridges.measured.find(m => m.id === id)!;
  const toScene = (x: number, y: number): Vec2 => { const [lng, lat] = localToLngLat(eIndex, x, y); return toLocal(lng, lat); };
  // The raw approach ends (first / last station by s), for checking our relief against the bridge pipeline's AHN.
  const q = eIndex.quantization.xy, st: { s: number; p: Vec2 }[] = [];
  for (let i = 0; i + 3 < b.p.length; i += 4) st.push({ s: b.p[i + 2], p: toScene(b.p[i] * q, b.p[i + 1] * q) });
  st.sort((a, c) => a.s - c.s);
  return { bridge: b, deck: s.addDeck(decodeProfile(b, q, toScene)), rawEnds: [st[0].p, st[st.length - 1].p] as [Vec2, Vec2] };
}

test('regression: Nassaukade bridge over the Bilderdijkgracht mouth (BRU0166) joins the kade', { skip: !haveExtracts }, () => {
  const s = realSurface(4.8747, 52.3731);
  const { bridge, deck, rawEnds } = realDeck(s, 'BRU0166');
  // Our relief at the approach ends agrees with the AHN heights the bridge pipeline measured there.
  rawEnds.forEach((p, k) => { const err = s.ground(p[0], p[1]) + s.datumNAP - bridge.endpointNAP[k]; assert.ok(Math.abs(err) < 0.15, `approach end ${k}: relief vs bridge pipeline ${err.toFixed(2)} m`); });
  // Ride the deck axis: continuous, and it rises above the kade.
  const p = deck.profile;
  let worst = 0, crown = -Infinity;
  for (let i = 0; i + 1 < p.x.length; i++) {
    worst = Math.max(worst, Math.abs(s.height(p.x[i + 1], p.y[i + 1]) - s.height(p.x[i], p.y[i])));
    crown = Math.max(crown, s.height(p.x[i], p.y[i]));
  }
  assert.ok(worst < 0.15, `largest 0.5 m step on the deck ${worst.toFixed(3)} m`);
  // The crown sits where AHN measured it: the profile's maximum above the approach-end chord (0.83 m here).
  const chord = (s.ground(rawEnds[0][0], rawEnds[0][1]) + s.ground(rawEnds[1][0], rawEnds[1][1])) / 2, maxH = Math.max(...bridge.p.filter((_, i) => i % 4 === 3)) / 100;
  assert.ok(Math.abs(crown - chord - maxH) < 0.25, `crown ${(crown - chord).toFixed(2)} above the approaches vs AHN ${maxH}`);
  // The Nassaukade quay sits near the old flat street level (scene z ≈ 0), not metres off.
  const [qx, qy] = toLocal(4.87445, 52.37286);
  assert.ok(Math.abs(s.ground(qx, qy)) < 1.2, `kade z ${s.ground(qx, qy).toFixed(2)}`);
});

test('regression: Leidsegracht masonry arch (BRU0044) humps over the canal belt', { skip: !haveExtracts }, () => {
  const s = realSurface(4.8875, 52.3665);
  const { bridge, deck, rawEnds } = realDeck(s, 'BRU0044');
  const p = deck.profile;
  let crown = -Infinity;
  for (let i = 0; i < p.x.length; i++) crown = Math.max(crown, s.height(p.x[i], p.y[i]));
  // AHN puts this crown 1.64 m above the approach-end chord; the relief carries the ramps, the profile the deck span.
  const chord = (s.ground(rawEnds[0][0], rawEnds[0][1]) + s.ground(rawEnds[1][0], rawEnds[1][1])) / 2, maxH = Math.max(...bridge.p.filter((_, i) => i % 4 === 3)) / 100;
  assert.ok(Math.abs(crown - chord - maxH) < 0.3, `crown ${(crown - chord).toFixed(2)} above the approaches vs AHN ${maxH}`);
  assert.ok(crown - chord > 1.2);
  assert.equal(s.height(p.x[0], p.y[0]), s.ground(p.x[0], p.y[0]), 'approach ramps are relief');
});

test('regression: relief is present (Postjeskade polder side lower than the Herengracht quay)', { skip: !haveExtracts }, () => {
  const s = realSurface(4.866, 52.366);
  // −0.59 m NAP west of the Kostverlorenvaart (RD 118150, 486500) vs +0.79 m NAP on the Herengracht at the Leidsegracht.
  const [wx, wy] = toLocal(4.84618, 52.36515), [ex, ey] = toLocal(4.88557, 52.36728);
  assert.ok(s.ground(ex, ey) - s.ground(wx, wy) > 0.5, `canal belt ${s.ground(ex, ey).toFixed(2)} vs west ${s.ground(wx, wy).toFixed(2)}`);
});
