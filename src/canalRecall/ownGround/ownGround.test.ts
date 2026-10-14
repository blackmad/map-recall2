// Own-ground prototype: relief field, surface + decks, draped meshes, cross-sections, water, placement.
//   node --import tsx --test src/canalRecall/ownGround/ownGround.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { deflateSync, gunzipSync, inflateSync } from 'node:zlib';
import { readGeoTiff, undoFloatPredictor } from './geotiff';
import { applyLocalToRd, coarsenTile, decodeTile, downsample, encodeTile, extendTile, readGroundTile, upsampleTile, fitLocalToRd, GroundField, NODATA, pullPushFill, type GroundIndex, type LocalToRd } from './heightField';
import { DECK_BLEND_M, DECK_MAX_GRADE, GroundSurface, clampDeckGrade, riderPose, type Vec2 } from './surface';
import { cutIntervals, disc, drapeTriangles, edgeWall, emptyMesh, endCap, gridHeight, merge, reliefGrid, ribbon, type MeshArrays } from './drape';
import { bandCoverage, deckStreetTop, DE_CLERCQSTRAAT, KNOWN_SPOT_M, RAIL_ON_BAND_M, shoreSamples, spotDistanceM } from './roadRegressions';
import { crossSection, parseMetres, areaKind, pavedAreaSurface, carriagewayClass, SURFACE_LEGEND } from './osmGround';
import { herringboneBricks, KLINKER_TONES } from './streetTextures';
import { mouthMarking, sharkTeeth, TEETH } from './roadMarkings';
import { RADIUS_STEP_M, residentRadius, viewReachM } from './residency';
import { basemapGroundPatches } from './basemapPalette';
import { groundLookFrom, groundPalette } from './groundLook';
import { drawnGrey, flatGroundLuminance, FLAT_GROUND_GAIN } from './groundLight';
import { GROUND_TONES, STREET_GROUND } from '../look/palette';
import { BgtIndex, classOf, polygonBox, sectionWidths, toDm, wayWidths, type BgtPolygon, type SurfaceClass } from './bgtWidth';
import { buildStreets, prepareWays, resolvePriorSidewalks, routeRibbon, shadowedWays, LIFT } from './streets';
import { benchesAlong, bgtParkSurface, buildParks, cullCovered, decodeLine, encodeLine, playgroundKit, playgroundPiece, CULL_RES_M, PARK_LIFT, SurfaceIndex, type ParksCell } from './parks';
import { buildWaterMask, maskDistance, openUnderFootbridges, quayWallMesh, waterSurfaceMesh, waterZAt, type WaterGeometry } from './water';
import { buildFarBlock, farBlockCells, farBlockOf, farBlocksWithin, farRadiusM, simplify, FAR_BLOCK_BUDGET, FAR_LIFT, FAR_MAX_M } from './farRing';
import type { OsmGroundExtract, OsmWay } from './osmGround';
import { DECK_TOP_LIFT, FRAME, RAILING, flatDeckBody, measuredDeckBody, measuredDeckTop, movableFrame, type DeckBuildInfo } from './decks';
import { binByBase, footprintBase, liftRanges } from './placement';
import { routeAhead } from './route';
import { fillPockets, POCKET_LIFT } from './pockets';
import { berthRect, openUnderHouseboats, MOORING_MARGIN_M } from './moorings';
import { houseboatsOnLand, HOUSEBOAT_LAND_CELLS } from './houseboatLand';
import type { DeckProfile } from '../elevation/bridgeDeck';
import { decodeProfile } from '../elevation/bridgeDeck';
import { localToLngLat, type BridgeExtract, type ElevationIndex } from '../elevation/elevationData';
import { fromLocal, toLocal } from '../galleryPipeline';
import { lngLatToRd } from '../facade/rdNew';
import { groundMercatorFromLocal, groundParticipant, mul4, ndcOf } from './sharedFrameGround';
import { groundVertices, liftPands, remapAttribute, separatePands } from './chunkBases';
import { mercatorOfLngLat, mercatorUnitsPerMetre } from '../rendererShared/frameMath';

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

test('planar predictor round-trips like delta-x, nodata included', () => {
  const n = 4, h = new Float32Array([-5.03, 300, -300, 0.01, 1, 1, 1, 1, NaN, 2.5, 2.49, 2.51, 0, 0, 0, 327]);
  const back = decodeTile(encodeTile(h, n, 'planar'), n, 'planar');
  for (let i = 0; i < h.length; i++) {
    if (Number.isNaN(h[i])) assert.ok(Number.isNaN(back[i]));
    else assert.ok(Math.abs(back[i] - h[i]) <= 0.005 + 1e-6, `${i}: ${back[i]} vs ${h[i]}`);
  }
  // A plane costs nothing past the first row and column: residuals are zero.
  const m = 8, plane = new Float32Array(m * m).map((_, k) => 0.07 * (k % m) - 0.03 * Math.floor(k / m));
  const res = new Int16Array(encodeTile(plane, m, 'planar').buffer);
  for (let j = 1; j < m; j++) for (let i = 1; i < m; i++) assert.equal(res[j * m + i], 0);
});

test('coarse (4 m) tiles decode onto the 2 m grid: a plane is kept, edges clamp', () => {
  const n = 8, h = new Float32Array(n * n).map((_, k) => 0.1 * (k % n) + 0.2 * Math.floor(k / n));
  const coarse = coarsenTile(h, n, 2);
  assert.equal(coarse.length, 16);
  const index = { stepM: 2, tileSizeM: 16, samples: n, predictor: 'planar' as const };
  const up = readGroundTile(index, [0, 0, 1, 4], encodeTile(coarse, 4, 'planar'));
  assert.equal(up.length, n * n);
  // Interior samples reproduce the plane to the centimetre; the clamped rim is within half a coarse step's slope.
  for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) assert.ok(Math.abs(up[j * n + i] - h[j * n + i]) < 0.011, `${i},${j}`);
  for (let k = 0; k < n * n; k++) assert.ok(Math.abs(up[k] - h[k]) < 0.5 * (0.1 + 0.2) + 0.006); // half a fine step of slope per axis
  // Full-resolution entries are untouched.
  const same = readGroundTile(index, [0, 0, 1], encodeTile(h, n, 'planar'));
  for (let k = 0; k < n * n; k++) assert.ok(Math.abs(same[k] - h[k]) < 0.006);
  assert.ok(upsampleTile(new Float32Array([1]), 1, 4).every(v => v === 1));
});

test('partly covered edge: a missing tile is extended from its neighbours, continuous at the seam', () => {
  // Tiles (0,0) and (0,1) exist; (1,0) is missing: extend it from them.
  const f = flatField((x, y) => 0.01 * x + 0.02 * y, 2, 100, [[0, 0], [0, 1]]);
  assert.ok(Number.isNaN(f.heightRd(150, 50)));
  f.addTile(1, 0, extendTile(f, 1, 0, (tx, ty) => (tx === 0 && ty === 0) || (tx === 0 && ty === 1)));
  // No step across the seam (x = 100): the extension starts at the neighbour's edge value.
  for (const y of [5, 50, 95]) assert.ok(Math.abs(f.heightRd(100.9, y) - f.heightRd(99.1, y)) < 0.05, `seam at y=${y}`);
  // Everywhere finite, and within the neighbours' range (no overshoot).
  for (let x = 101; x < 200; x += 7) for (let y = 1; y < 100; y += 7) { const z = f.heightRd(x, y); assert.ok(z === z && z >= 0 && z <= 0.01 * 100 + 0.02 * 200, `${x},${y}: ${z}`); }
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
    if (Math.abs(n[2]) > Math.hypot(n[0], n[1]) || Math.abs(n[1]) < Math.abs(n[0])) continue; // tops / soffits / post sides
    // The deck edge (side faces, the plinth's outer face) faces out; the plinth's inner face (RAILING.plinthWidth in) faces the road.
    if (Math.abs(c[1]) > 3.99) assert.ok(Math.sign(n[1]) === Math.sign(c[1]), `side face at y=${c[1].toFixed(2)} faces outward`);
    else if (Math.abs(Math.abs(c[1]) - (4 - RAILING.plinthWidth)) < 0.01) assert.ok(Math.sign(n[1]) === -Math.sign(c[1]), `parapet inner face at y=${c[1].toFixed(2)} faces the road`);
  }
  let lowest = Infinity;
  for (let i = 0; i < body.positions.length; i += 3) if (!water(body.positions[i])) lowest = Math.min(lowest, body.positions[i + 2]);
  assert.ok(lowest <= -0.39, `land abutments go below the relief (${lowest})`);
  assert.ok(f.some(x => water(x.c[0]) && x.n[2] < 0), 'downward faces over water');
});

test('measured deck: the top fills the footprint, railings on both edges, abutments at the water, piers only over long spans', () => {
  const field = flatField(() => 1, 2, 100, [[-1, -1], [0, -1], [-1, 0], [0, 0]]);
  const s = new GroundSurface(field, IDENTITY, 1);
  const deck = s.addDeck(syntheticDeck());
  const water = (x: number) => x > 12 && x < 28;
  const top = measuredDeckTop(deck, s.height);
  const tf = faces(top);
  assert.ok(tf.length > 0 && tf.every(x => x.n[2] > 0), 'deck top faces up');
  // Every point of the deck span, edge to edge, is under the top (no water between road and railing).
  for (const x of [9, 14, 20, 26, 31]) for (const y of [-3.9, -2, 0, 2, 3.9]) {
    const hit = tf.some(t => Math.abs(t.c[0] - x) < 0.5 && Math.abs(t.c[1] - y) < 0.8);
    assert.ok(hit, `deck top covers (${x}, ${y})`);
  }
  for (const t of tf) assert.ok(Math.abs(t.c[2] - s.height(t.c[0], t.c[1]) - DECK_TOP_LIFT) < 0.05, 'top drapes on the surface');
  const info: DeckBuildInfo[] = [];
  const body = measuredDeckBody(deck, s.ground, x => water(x), -1.77, s.height, info);
  assert.equal(info.length, 1);
  // The kit (bridgeKit.ts): a masonry deck is an arch bridge, within the near budget, stone pillars at the ends and at least one between on each side (the iron railing runs between them).
  assert.equal(info[0].kind, 'arch');
  assert.ok(info[0].triangles <= 600, `triangles ${info[0].triangles}`);
  assert.ok(info[0].railingPosts >= 2 * 3, `posts ${info[0].railingPosts}`);
  const f = faces(body);
  const railTop = f.filter(x => x.n[2] > 0 && Math.abs(x.c[0] - 20) < 1 && Math.abs(x.c[1]) > 3.5);
  assert.ok(railTop.some(x => x.c[2] > s.height(20, 0) + RAILING.height - 0.1), 'rails stand a railing height over the crown');
  assert.equal(info[0].abutments, 2, 'one abutment at each bank');
  // The outer springing faces stand at the banks, facing the opening, down past the water.
  const abut = f.filter(x => Math.abs(x.n[2]) < 1e-6 && Math.abs(x.c[1]) < 3 && Math.abs(x.n[0]) > Math.abs(x.n[1]) * 10 && (Math.abs(x.c[0] - 12) < 0.6 || Math.abs(x.c[0] - 28) < 0.6));
  assert.ok(abut.length >= 2 && abut.every(x => Math.sign(x.n[0]) === (x.c[0] < 20 ? 1 : -1)), 'abutments face the water');
  let lowest = Infinity; for (let i = 0; i < body.positions.length; i += 3) if (Math.abs(body.positions[i] - 12) < 0.6) lowest = Math.min(lowest, body.positions[i + 2]);
  assert.ok(lowest <= -1.77 - 0.3, `abutment reaches below the water (${lowest})`);
  // 16 m of measured water (over PIER_SPAN_M): three arches on two piers.
  assert.equal(info[0].piers, 2);
  assert.equal(info[0].arches, 3);
  const narrow = syntheticDeck(); narrow.water = [15, 25];
  const short: DeckBuildInfo[] = [];
  measuredDeckBody(s.addDeck(narrow), s.ground, x => x > 15 && x < 25, -1.77, s.height, short);
  assert.deepEqual([short[0].piers, short[0].arches], [0, 1], '10 m of water: one arch, no piers');
  // A 30 m span: three arches as well (five only past 60 m).
  const long = syntheticDeck(); long.water = [5, 35]; long.deck = [4, 36];
  const wide = (x: number) => x > 5 && x < 35;
  const info2: DeckBuildInfo[] = [];
  measuredDeckBody(s.addDeck(long), s.ground, x => wide(x), -1.77, s.height, info2);
  assert.ok(info2[0].piers === 2 && info2[0].arches === 3, JSON.stringify(info2[0]));
});

test('deck grade clamp: spikes over 1:8 come out, the crown stays', () => {
  const s = Float64Array.from({ length: 41 }, (_, i) => i * 0.5), h = Float64Array.from(s, v => 1 - Math.abs(v - 10) * 0.05);
  h[10] += 0.4; // a parked van on the DSM
  const out = clampDeckGrade(s, h, [2, 18], DECK_MAX_GRADE);
  assert.ok(out[10] < h[10] - 0.3, 'the spike is gone');
  assert.ok(Math.abs(Math.max(...out) - 1) < 1e-9, 'the crown is kept');
  assert.equal(out[0], h[0], 'outside the deck span untouched');
});

test('movable frame: one portal unit across the crossing axis, two on a long double bascule', () => {
  const ring: Vec2[] = [[0, -4], [14, -4], [14, 4], [0, 4]];
  const one = movableFrame(ring, () => 0.5);
  assert.equal(one.units, 1);
  let zMax = -Infinity, yMax = 0; for (let i = 0; i < one.mesh.positions.length; i += 3) { zMax = Math.max(zMax, one.mesh.positions[i + 2]); yMax = Math.max(yMax, Math.abs(one.mesh.positions[i + 1])); }
  assert.ok(zMax > 0.5 + FRAME.postHeight && zMax < 0.5 + FRAME.postHeight + 1.2, `frame top ${zMax}`);
  assert.ok(yMax > 4.3 && yMax < 5.2, `posts stand beside the deck (|y| ${yMax})`);
  // A footprint 8 m long but 20 m wide, with the road along +y through it: the posts go either side of the road, not of the long axis.
  const squat: Vec2[] = [[0, 0], [20, 0], [20, 8], [0, 8]];
  const across = movableFrame(squat, () => 0, [[[10, -5], [10, 13]]]);
  let xs = [Infinity, -Infinity]; for (let i = 0; i < across.mesh.positions.length; i += 3) { xs = [Math.min(xs[0], across.mesh.positions[i]), Math.max(xs[1], across.mesh.positions[i])]; }
  assert.ok(xs[0] < 0 && xs[1] > 20, 'posts outside the 20 m width');
  const dbl = movableFrame([[0, -4], [40, -4], [40, 4], [0, 4]], () => 0);
  assert.equal(dbl.units, 2);
});

test('flat deck: draped top, fascia only over water', () => {
  const ring: Vec2[] = [[0, -4], [20, -4], [20, 4], [0, 4]];
  const { top, body } = flatDeckBody(ring, () => 0.5, (x) => x > 5 && x < 15);
  for (const { n, c } of faces(top)) { assert.ok(n[2] > 0); assert.ok(Math.abs(c[2] - 0.52) < 1e-6); }
  const sides = faces(body).filter(x => Math.abs(x.n[2]) < 1e-9 && Math.abs(Math.abs(x.c[1]) - 4) < 1e-6);
  assert.ok(sides.length > 0 && sides.every(x => x.c[0] > 4 && x.c[0] < 16), 'fascia only along the water');
  for (const x of sides) assert.ok(Math.sign(x.n[1]) === Math.sign(x.c[1]), 'fascia faces out');
  // Railings along the water edges only, posts inside the footprint.
  const { railingPosts } = flatDeckBody(ring, () => 0.5, (x) => x > 5 && x < 15);
  assert.ok(railingPosts >= 2 * 5 && railingPosts <= 2 * 8, `posts ${railingPosts}`);
  for (let i = 0; i < body.positions.length; i += 3) if (body.positions[i + 2] > 0.6) assert.ok(body.positions[i] > 4 && body.positions[i] < 16 && Math.abs(body.positions[i + 1]) <= 4 + 1e-6, 'railing parts stay on the water edges');
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

test('junctions: one fill from the incoming cross-sections; lanes, paint and paths stop at its edge', () => {
  const flat = () => 0;
  const ll = (p: Vec2): [number, number] => p as [number, number];
  const ways = prepareWays([
    { id: 1, tags: { highway: 'tertiary', 'cycleway:both': 'lane', sidewalk: 'both' }, g: [[-60, 0], [0, 0], [60, 0]] },
    { id: 2, tags: { highway: 'residential', sidewalk: 'both' }, g: [[0, 0], [0, 60]] },
    { id: 3, tags: { highway: 'residential', sidewalk: 'both' }, g: [[0, -60], [0, 0]] },
    { id: 4, tags: { highway: 'cycleway' }, g: [[40, 40], [0, 0]] }, // a cycle path ending at the junction node
  ], p => ll(p as Vec2));
  const s = buildStreets(ways, flat);
  assert.equal(s.stats.junctions, 1);
  assert.equal(s.stats.corners, 4, 'four kerb corners');
  const inside = (m: MeshArrays, r: number) => faces(m).filter(f => Math.abs(f.c[0]) < r && Math.abs(f.c[1]) < r);
  // The junction box: tertiary road half (3 + 1.6 lanes) one way, residential half 2.6 the other.
  assert.equal(inside(s.cycle, 2.4).length, 0, 'no red in the junction: lanes and the cycle path end at its edge');
  assert.equal(inside(s.paint, 2.4).length, 0, 'no paint across the junction');
  assert.equal(inside(s.paving, 4.4).length, 0, 'sidewalks stop at the kerb corners');
  assert.ok(inside(s.asphalt, 2).length > 0, 'the junction is filled with the main road\'s asphalt');
  // Corner patches at kerb height join the two sidewalks at each corner.
  const corner = faces(s.paving).filter(f => f.c[0] > 2.6 && f.c[0] < 4.4 && f.c[1] > 4.6 && f.c[1] < 6.4);
  assert.ok(corner.length > 0 && corner.every(f => Math.abs(f.c[2] - (LIFT.raisedBase + 0.11)) < 1e-6), 'corner patch at kerb height');
  // A one-way fietsstraat has no centre line.
  assert.ok(!crossSection({ highway: 'residential', lanes: '2', cyclestreet: 'yes' })!.paint.some(p => p.offset === 0));
  assert.ok(crossSection({ highway: 'residential', lanes: '2' })!.paint.some(p => p.offset === 0));
});

test('a short carriageway lying inside a wider one draws nothing; cycle slivers left by a junction cut are dropped', () => {
  const flat = () => 0;
  const ll = (p: Vec2): [number, number] => p as [number, number];
  const ways = prepareWays([
    { id: 1, tags: { highway: 'primary', lanes: '4' }, g: [[-60, 0], [0, 0], [60, 0]] },
    { id: 2, tags: { highway: 'residential', sidewalk: 'both' }, g: [[0, 0], [0, 60]] },
    // De Clercqstraat's 13 m stub, mapped through the Rozengracht asphalt: klinker, 2.4 m wide, inside the wider road.
    { id: 3, tags: { highway: 'residential', oneway: 'yes' }, g: [[-13, 0.5], [0, 0.5]] },
    // A 12 m cycleway across a junction: the road's half-width cut either side leaves slivers under 3 m.
    { id: 4, tags: { highway: 'cycleway' }, g: [[-6, 8], [0, 8], [6, 8]] },
    { id: 5, tags: { highway: 'primary', lanes: '2' }, g: [[0, 8], [0, 50]] },
    { id: 6, tags: { highway: 'primary', lanes: '2' }, g: [[-60, 8], [0, 8]] },
    { id: 7, tags: { highway: 'primary', lanes: '2' }, g: [[0, 8], [60, 8]] },
  ], p => ll(p as Vec2));
  assert.deepEqual([...shadowedWays(ways)], [3], 'only the stub is a duplicate of the wider road');
  const s = buildStreets(ways, flat);
  assert.equal(faces(s.klinker).filter(f => f.c[0] < -3 && Math.abs(f.c[1] - 0.5) < 1.5).length, 0, 'no brown parallelogram on the asphalt');
  assert.equal(faces(s.cycle).filter(f => Math.abs(f.c[0]) < 6 && Math.abs(f.c[1] - 8) < 2).length, 0, 'no red sliver between the cuts');
});

test('area:highway areas draw as what they are: carriageway asphalt, red cycleway, platforms as tiles, verges as grass', () => {
  assert.equal(pavedAreaSurface({ hw: 'tertiary' }), 'asphalt');
  assert.equal(pavedAreaSurface({ hw: 'residential', surface: 'sett' }), 'klinker');
  assert.equal(pavedAreaSurface({ hw: 'cycleway' }), 'cycle');
  assert.equal(pavedAreaSurface({ hw: 'platform' }), 'paving');
  assert.equal(pavedAreaSurface({ hw: 'verge' }), 'park');
  assert.equal(pavedAreaSurface({}), 'square');
  assert.equal(pavedAreaSurface({ hw: 'something_new' }), 'square');
});

test('resident radius follows what the camera sees: chase stays on the base ring, the user\'s aerial shot grows, capped', () => {
  const chase = viewReachM(17, 60, 52.37);
  assert.ok(chase > 500 && chase < 1100, `chase reach ${chase.toFixed(0)} m`);
  assert.equal(residentRadius(chase, 1400, 2600), 1400);
  // zoom 15.8, pitch 76: ~285 m up, the top of the screen ~2.9 km past the rider.
  const aerial = viewReachM(15.8, 76, 52.37);
  assert.ok(aerial > 2500 && aerial < 3300, `aerial reach ${aerial.toFixed(0)} m`);
  assert.equal(residentRadius(aerial, 1400, 2600), 2600, 'capped');
  const mid = residentRadius(1900, 1400, 2600);
  assert.ok(mid > 1400 && mid < 2600 && (mid - 1400) % RADIUS_STEP_M === 0, `${mid}`);
  assert.equal(residentRadius(5000, 1400, 1400), 1400, 'no growth when the cap equals the base');
  assert.ok(viewReachM(15.8, 76, 52.37) > viewReachM(15.8, 60, 52.37), 'a steeper pitch sees further');
});

test('basemap ground layers take the own ground palette; buildings and labels are left alone', () => {
  const layers = [
    { id: 'background', type: 'background' }, { id: 'water', type: 'fill', 'source-layer': 'water' }, { id: 'waterway_river', type: 'line', 'source-layer': 'waterway' },
    { id: 'park', type: 'fill', 'source-layer': 'park' }, { id: 'road_minor', type: 'line', 'source-layer': 'transportation' }, { id: 'road_path_pedestrian', type: 'line', 'source-layer': 'transportation' },
    { id: 'building', type: 'fill', 'source-layer': 'building' }, { id: 'label_road', type: 'symbol', 'source-layer': 'transportation_name' },
  ];
  const by = Object.fromEntries(basemapGroundPatches(layers, groundPalette('default')).map(p => [`${p.id}:${p.property}`, p.value]));
  assert.equal(by['water:fill-color'], GROUND_TONES.water);
  assert.equal(by['waterway_river:line-color'], GROUND_TONES.water);
  assert.equal(by['road_minor:line-color'], `rgb(${STREET_GROUND.asphalt.base.join(',')})`);
  assert.equal(by['road_path_pedestrian:line-color'], `rgb(${STREET_GROUND.pavement.base.join(',')})`);
  assert.equal(by['park:fill-color'], `rgb(${GROUND_TONES.park.join(',')})`);
  assert.ok(by['background:background-color']);
  assert.ok(!Object.keys(by).some(k => k.startsWith('building') || k.startsWith('label_road')));
});

test('prior sidewalks are dropped where another mapped way lies (split carriageways, separate cycle paths)', () => {
  const ll = (p: Vec2): [number, number] => p as [number, number];
  const ways = resolvePriorSidewalks(prepareWays([
    { id: 1, tags: { highway: 'tertiary', oneway: 'yes' }, g: [[-50, 3.5], [50, 3.5]] },
    { id: 2, tags: { highway: 'tertiary', oneway: 'yes' }, g: [[50, -3.5], [-50, -3.5]] },
    { id: 3, tags: { highway: 'tertiary', oneway: 'yes', sidewalk: 'both' }, g: [[-50, 40], [50, 40]] },
    { id: 4, tags: { highway: 'tertiary', oneway: 'yes', sidewalk: 'both' }, g: [[50, 33], [-50, 33]] },
  ], p => ll(p as Vec2)));
  const sides = (id: number) => ways.find(w => w.id === id)!.section.bands.filter(b => b.kind === 'sidewalk').map(b => Math.sign(b.offset));
  assert.deepEqual(sides(1), [1], 'way 1 keeps only its outer (left, north) sidewalk');
  assert.deepEqual(sides(2), [1], 'way 2 (westbound) keeps its left (south) sidewalk');
  assert.deepEqual(sides(3).sort(), [-1, 1], 'tagged sidewalks stay');
});

test('street vocabulary: tram rails, cycle-path edge lines, kerb line, Amsterdammertjes on canal-side pavements', () => {
  const flat = () => 0;
  const ll = (p: Vec2): [number, number] => p as [number, number];
  const ways = prepareWays([
    { id: 1, tags: { highway: 'tertiary', embedded_rails: 'tram', sidewalk: 'both' }, g: [[0, 0], [100, 0]] },
    { id: 2, tags: { highway: 'cycleway', width: '2.5' }, g: [[0, 30], [100, 30]] },
  ], p => ll(p as Vec2));
  // Water north of y = 6 (the left pavement's kerb at y ≈ 3 is canal-side; the right one is not).
  const s = buildStreets(ways, flat, { canalSide: (_x, y) => y > 0 && y < 8 });
  const rails = faces(s.tram);
  const ys = [...new Set(rails.map(f => Math.round(f.c[1] * 10) / 10))].sort((a, b) => a - b);
  assert.deepEqual(ys, [-2.2, -0.8, 0.8, 2.2], 'two tracks 3 m apart, rails at standard gauge (1.435 m)');
  assert.ok(faces(s.paint).some(f => Math.abs(f.c[1] - (30 + 1.1)) < 0.05) && faces(s.paint).some(f => Math.abs(f.c[1] - (30 - 1.1)) < 0.05), 'white edge lines on the cycle path');
  const kerbTop = faces(s.kerb).filter(f => Math.abs(f.n[2]) > 0.9 * Math.hypot(...f.n));
  assert.ok(kerbTop.some(f => f.c[1] > 0) && kerbTop.some(f => f.c[1] < 0), 'kerb line on both pavements');
  const posts = faces(s.bollard);
  assert.ok(posts.length > 0 && posts.every(f => f.c[1] > 0), 'bollards only on the canal-side pavement');
  assert.ok(Math.max(...posts.map(f => f.c[2])) > 0.8, 'posts stand ~0.8 m');
});

test('BGT widths read inside a junction are capped by class and lanes', () => {
  assert.equal(crossSection({ highway: 'tertiary', lanes: '1', oneway: 'yes' }, [213, 0, 0])!.bands[0].width, 5.25);
  assert.equal(crossSection({ highway: 'cycleway', oneway: 'yes' }, [142, 0, 0])!.bands[0].width, 4.5);
  assert.equal(crossSection({ highway: 'cycleway', width: '1.8' }, [40, 0, 0])!.source.width, 'tag', 'a tagged path width wins over a BGT reading 1.8× wider');
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
  // Coping cap (phone stair steps at the cut): faces up, sits just over the land, reaches 0.35 m inland, never over the water.
  const capped = faces(quayWallMesh(geo, bank, -1.77, 2, 0.35)).filter(t => Math.abs(t.n[2]) > 1e-9 && Math.abs(t.n[0]) + Math.abs(t.n[1]) < 1e-6 * Math.abs(t.n[2]) + 0.05 * Math.abs(t.n[2]));
  assert.ok(capped.length > 0 && capped.every(t => t.n[2] > 0), 'cap faces up');
  for (const t of capped) {
    const inland = t.c[1] < 5 ? -t.c[1] : t.c[1] - 10;
    assert.ok(inland > 0 && inland < 0.35, `cap centroid ${inland.toFixed(2)} m inland`);
    assert.ok(t.c[2] > bank(t.c[0], t.c[1]) && t.c[2] - bank(t.c[0], t.c[1]) < 0.03, 'a centimetre over the land');
  }
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

test('shared-frame adapter maps the ground frame to Mercator like the facades', () => {
  const m = groundMercatorFromLocal();
  const [x, y] = [523.4, -1210.7], [lng, lat] = fromLocal(x, y);
  const want = mercatorOfLngLat(lng, lat, 0);
  const got = [m[0] * x + m[4] * y + m[12], m[1] * x + m[5] * y + m[13]];
  const metre = mercatorUnitsPerMetre(want[1]);
  assert.ok(Math.hypot(got[0] - want[0], got[1] - want[1]) / metre < 0.5, 'within half a metre 1.3 km from the origin');
  const p = groundParticipant({});
  assert.equal(p.mercatorFromLocal!({} as never), p.mercatorFromLocal!({} as never));
});

// ------------------------------------------------------------- named regressions on the published extracts
const EXTRACT = 'public/data/extracts/amsterdam';
const haveExtracts = existsSync(`${EXTRACT}/ground-height-v1/index.json`) && existsSync(`${EXTRACT}/elevation-v1/bridges.json`);

function realSurface(lng: number, lat: number): GroundSurface {
  const index = JSON.parse(readFileSync(`${EXTRACT}/ground-height-v1/index.json`, 'utf8')) as GroundIndex;
  const field = new GroundField(index.stepM, index.tileSizeM);
  const [cx, cy] = toLocal(lng, lat);
  const toRd = (x: number, y: number): [number, number] => { const p = lngLatToRd(fromLocal(x, y)); return [p.x, p.y]; };
  // Only the tiles within 3 km (the city-wide extract has ~300).
  const [rx, ry] = toRd(cx, cy), T = index.tileSizeM;
  for (const entry of index.tiles) {
    const [tx, ty] = entry;
    if (Math.hypot((tx + 0.5) * T - rx, (ty + 0.5) * T - ry) > 3000) continue;
    field.addTile(tx, ty, readGroundTile(index, entry, gunzipSync(readFileSync(`${EXTRACT}/ground-height-v1/tiles/${tx}_${ty}.bin`))));
  }
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

// ------------------------------------------------------------- streaming in the game (groundStore / groundCell)
import { GroundStore, toLocal as storeToLocal, fromLocal as storeFromLocal, GAME_ORIGIN } from './groundStore';
import { buildCell, vertexNormals } from './groundCell';
import { ORIGIN } from '../threeBuildingFeatures';

test('ground frame is the facades\' frame (duplicated to keep the worker bundle small)', () => {
  assert.deepEqual({ ...GAME_ORIGIN }, { ...ORIGIN });
  for (const [lng, lat] of [[4.87445, 52.37286], [4.95, 52.33]]) {
    assert.deepEqual(storeToLocal(lng, lat), toLocal(lng, lat));
    const [x, y] = toLocal(lng, lat);
    assert.deepEqual(storeFromLocal(x, y), fromLocal(x, y));
  }
});

test('vertexNormals: a flat upward quad', () => {
  const n = vertexNormals(new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]), new Uint32Array([0, 1, 2, 0, 2, 3]));
  for (let i = 0; i < 4; i++) assert.deepEqual([...n.slice(i * 3, i * 3 + 3)], [0, 0, 1]);
});

test('street chunks: a vertex shared by two pands is split, each pand lifts alone', () => {
  // Two quads (pand 0: tris 0–1, pand 1: tris 2–3) sharing the edge 1–2 (a party wall corner).
  const index = [0, 1, 2, 0, 2, 3, 1, 4, 5, 1, 5, 2];
  const sep = separatePands(index, 6, [[0, 0, 2], [1, 2, 2]]);
  assert.equal(sep.duplicated, 2, 'the two shared vertices are duplicated for the second pand');
  assert.equal(sep.source.length, 8);
  for (let t = 0; t < 4; t++) { const pand = t < 2 ? 0 : 1; for (let k = 0; k < 3; k++) assert.equal(sep.owner[sep.index[t * 3 + k]], pand); }
  // Model up is +y here; pand 1 sits 0.5 m higher.
  const base = remapAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 1, 3, 0, 0, 3, 0, 2, 0, 0, 2, 3, 0]), 3, sep.source);
  const ground = groundVertices(sep.owner, i => base[i * 3 + 1], 0.3);
  assert.deepEqual([...ground.keys()].sort(), [0, 1]);
  for (const list of ground.values()) for (const i of list) assert.equal(base[i * 3 + 1], 0, 'ground vertices are the bottom ones');
  const lifted = liftPands(base, sep.owner, [0, 1, 0], p => (p === 1 ? 0.5 : 0));
  for (let i = 0; i < sep.owner.length; i++) assert.equal(lifted[i * 3 + 1] - base[i * 3 + 1], sep.owner[i] === 1 ? 0.5 : 0);
  assert.equal(base[1 * 3 + 1], 0, 'the unlifted copy is kept');
});

test('canvas pin lift: clip ← local product and NDC of a raised point', () => {
  // A camera looking down −y with z up on screen: raising a point moves it up in NDC.
  const clip = [1, 0, 0, 0, 0, 0, 0, -1, 0, 1, 0, 0, 0, 0, 0, 10]; // column-major: x→x, z→y, w = 10 − y
  const a = ndcOf(clip, 2, 0, 0)!, b = ndcOf(clip, 2, 0, 1.5)!;
  assert.ok(Math.abs(a[0] - 0.2) < 1e-12 && Math.abs(b[1] - a[1] - 0.15) < 1e-12);
  assert.equal(ndcOf(clip, 0, 20, 0), null, 'behind the eye');
  const id = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  assert.deepEqual([...mul4(id, clip)], clip);
  assert.deepEqual([...mul4(clip, id)], clip);
});

const haveCells = existsSync('public/data/extracts/amsterdam/own-ground-osm-v1/cells.json');
const fsStore = () => new GroundStore(async path => {
  const bytes = readFileSync(`public/data/extracts/amsterdam/${path}`);
  return new Uint8Array(bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes);
});

// BRU0009 Torensluis (2026-10-14): its e2e hump readout flipped on main while this deck, its body and top were
// byte-identical to the bridge lane's; the crown (1.66 m over the higher end) is pinned here, not only in pixels.
for (const [id, lng, lat] of [['BRU0166', 4.87445, 52.37286], ['BRU0044', 4.8875, 52.3665], ['BRU0009', 4.88938, 52.37455]] as const) {
  test(`regression (streamed cell): ${id} deck is placed and street bands ride over it`, { skip: !haveCells }, async () => {
    const store = fsStore();
    await store.init();
    const [x, y] = storeToLocal(lng, lat);
    let owner = '';
    for (const k of GroundStore.neighbours(store.cellAt(x, y))) { await store.prepareCell(k); if (store.decks(k).some(d => d.profile.id === id)) { owner = k; break; } }
    assert.ok(owner, `${id} placed in a streamed cell`);
    const deck = store.surface.decks.find(d => d.profile.id === id)!;
    let crown = -Infinity;
    for (let i = 0; i < deck.profile.x.length; i++) crown = Math.max(crown, store.surface.height(deck.profile.x[i], deck.profile.y[i]));
    assert.ok(crown - Math.max(...deck.ends) > 0.4, `crown ${crown.toFixed(2)} over ends ${deck.ends}`);
    const cell = buildCell(await store.cellInput(owner, 0));
    assert.ok(cell.layers.deckBody && cell.layers.water && cell.layers.quay && cell.layers.land);
    assert.ok(cell.mask && cell.mask.texels.length === cell.mask.width * cell.mask.height * 2);
    const far = buildCell(await store.cellInput(owner, 1));
    assert.ok(far.stats.triangles < cell.stats.triangles * 0.6, 'LOD 1 lighter');
  });
}

test('regression (streamed cells): De Clercqstraat Bilderdijkstraat → Kostverlorenvaart reads as street at both LODs', { skip: !haveCells }, async () => {
  const store = fsStore();
  await store.init();
  const [x, y] = storeToLocal(DE_CLERCQSTRAAT.at[0], DE_CLERCQSTRAAT.at[1]), key = store.cellAt(x, y);
  const input = await store.cellInput(key, 0), ids = new Set(DE_CLERCQSTRAAT.ways), seen = new Set<number>();
  const ways = resolvePriorSidewalks([input.osm, ...input.osmAround].flatMap(e => (e ? prepareWays(e.ways, input.project) : [])).filter(w => !seen.has(w.id) && seen.add(w.id))).filter(w => ids.has(w.id));
  assert.equal(ways.length, DE_CLERCQSTRAAT.ways.length);
  // The block sits on the seam with the next cell east: build both, as the game does.
  const keys = [key, ...GroundStore.neighbours(key).filter(k => k !== key && store.covers(k) && store.cellRect(k)[0] > store.cellRect(key)[0] && store.cellRect(k)[1] === store.cellRect(key)[1])];
  for (const lod of [0, 1] as const) {
    const cells = [];
    for (const k of keys) cells.push(buildCell(await store.cellInput(k, lod)));
    const r = bandCoverage(cells, ways);
    assert.ok(r.share >= DE_CLERCQSTRAAT.minShare, `LOD ${lod}: ${(100 * r.share).toFixed(1)} % street, misses ${JSON.stringify(r.misses.slice(0, 5))}`);
  }
});

test('gridHeight is the relief grid\'s own surface (its vertices and its two triangles per quad)', () => {
  const h = (x: number, y: number) => Math.sin(x * 0.3) * 2 + Math.cos(y * 0.2) * 1.5 + x * y * 0.001;
  const g = gridHeight(h, 5);
  assert.ok(Math.abs(g(10, 15) - h(10, 15)) < 1e-12 && Math.abs(g(-35, 20) - h(-35, 20)) < 1e-12, 'exact at grid vertices');
  const grid = reliefGrid(0, 0, 10, 10, 5, h);
  // Centroid of every grid triangle sits on gridHeight.
  for (let t = 0; t < grid.indices.length; t += 3) {
    const [a, b, c] = [grid.indices[t] * 3, grid.indices[t + 1] * 3, grid.indices[t + 2] * 3], p = grid.positions;
    const cx = (p[a] + p[b] + p[c]) / 3, cy = (p[a + 1] + p[b + 1] + p[c + 1]) / 3, cz = (p[a + 2] + p[b + 2] + p[c + 2]) / 3;
    assert.ok(Math.abs(g(cx, cy) - cz) < 1e-9, `triangle ${t / 3}`);
  }
});

// ------------------------------------------------------------- per-polder water levels
test('water levels: each polygon sits at its own level, each shore wall measures from its own', () => {
  const sq = (x: number): Vec2[] => [[x, 0], [x + 10, 0], [x + 10, 10], [x, 10]];
  const geo = { polygons: [[sq(0)], [sq(20)]], shores: [[[0, 0], [0, 10]] as Vec2[], [[20, 0], [20, 10]] as Vec2[]], levels: [-1.77, -3.47], shoreLevels: [-1.77, -3.47] };
  const surf = waterSurfaceMesh(geo, -1.77), zs = (lo: number, hi: number) => { const out: number[] = []; for (let i = 0; i < surf.positions.length; i += 3) if (surf.positions[i] >= lo && surf.positions[i] <= hi) out.push(surf.positions[i + 2]); return out; };
  assert.ok(zs(0, 10).every(z => z === -1.77) && zs(20, 30).every(z => z === -3.47));
  const bank = () => 0.2; // 0.2 m above the datum on both banks
  const wall = (lines: Vec2[][], levels?: number[]) => quayWallMesh({ polygons: [], shores: lines, shoreLevels: levels }, bank, -1.77);
  const lowest = (m: { positions: ArrayLike<number> }) => { let lo = Infinity; for (let i = 2; i < m.positions.length; i += 3) lo = Math.min(lo, m.positions[i]); return lo; };
  assert.ok(Math.abs(lowest(wall([geo.shores[0]], [-1.77])) - (-1.77 - 0.25)) < 1e-4);
  assert.ok(Math.abs(lowest(wall([geo.shores[1]], [-3.47])) - (-3.47 - 0.25)) < 1e-4, 'polder wall reaches its own water');
  assert.ok(Math.abs(lowest(wall([geo.shores[1]])) - (-1.77 - 0.25)) < 1e-4, 'no shore levels: the default');
  assert.equal(waterZAt([geo], 25, 5, -9), -3.47);
  assert.equal(waterZAt([geo], 15, 5, -9), -9, 'land: the fallback');
});

test('regression (polder levels): Osdorpplein ground sits above its local water; the canal belt stays at −1.77', { skip: !haveCells || !existsSync('public/data/extracts/amsterdam/elevation-v1/water-levels.json') }, async () => {
  const store = fsStore();
  await store.init();
  assert.ok(store.waterLevels, 'water-levels.json loaded');
  const probe = async (lng: number, lat: number) => {
    const [x, y] = storeToLocal(lng, lat), key = store.cellAt(x, y);
    await store.cellInput(key, 0);
    return { ground: store.surface.height(x, y), key, water: (await store.waterCell(key))! };
  };
  // Osdorpplein (AGV peilgebied 3640-2, vast peil −2.17 m NAP): ground ≈ −2.1 m scene, polder water ≈ −3.5 m.
  const osdorp = await probe(4.8076, 52.3585);
  const lowest = Math.min(...(osdorp.water.levels ?? [0]));
  assert.ok(lowest < -3, `polder water well below the datum: ${lowest}`);
  assert.ok(osdorp.ground > lowest + 0.5, `Osdorp ground ${osdorp.ground.toFixed(2)} above local water ${lowest.toFixed(2)}`);
  assert.ok(osdorp.ground < -1.77, 'the old single level would have flooded it');
  // Canal belt: the Herengracht cell is uniformly the stadsboezem.
  const belt = await probe(4.8985, 52.3695);
  assert.ok(belt.water.levels!.every(z => Math.abs(z + 1.77) < 0.011) && belt.water.shoreLevels!.every(z => Math.abs(z + 1.77) < 0.011), 'canal belt at −1.77');
  assert.equal(store.sceneZ(-0.4), -1.77);
});

// ------------------------------------------------------------- 2026-10-13 ground review regressions
test('regression: a junction disc follows a ramp (bridge-end seam: 56 of 365 deck ends tore by 0.10-0.29 m under centre-and-rim fans)', () => {
  // A deck approach: height rises quadratically; the old fan chorded across it.
  const ramp = (x: number) => 0.012 * Math.max(0, x) ** 2;
  const m = emptyMesh();
  disc(m, [0, 0], 6, x => ramp(x), 0.03, 14);
  let worst = 0;
  const p = m.positions, idx = m.indices;
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3];
    for (const [u, v] of [[1 / 3, 1 / 3], [0.6, 0.2], [0.2, 0.6]]) {
      const w = 1 - u - v, x = u * p[a] + v * p[b] + w * p[c], z = u * p[a + 2] + v * p[b + 2] + w * p[c + 2];
      worst = Math.max(worst, Math.abs(z - (ramp(x) + 0.03)));
    }
    assert.ok((p[b] - p[a]) * (p[c + 1] - p[a + 1]) - (p[b + 1] - p[a + 1]) * (p[c] - p[a]) > 0, 'disc triangle wound CCW');
  }
  assert.ok(worst < 0.03, `disc deviates ${worst.toFixed(3)} m from the surface it drapes`);
});

test('regression: allotments are the park ground class (Westerpark / Sloterdijkermeer allotments were painted as dark land)', () => {
  assert.equal(areaKind({ landuse: 'allotments' }), 'park');
});

// ------------------------------------------------------------- BGT widths
test('BGT widths: own surface, footpath and cycle path per side from a cross-line', () => {
  const rect = (x0: number, x1: number): Vec2[][] => [[[x0, -50], [x1, -50], [x1, 50], [x0, 50]]];
  const poly = (cls: SurfaceClass, x0: number, x1: number): BgtPolygon => { const rings = rect(x0, x1); return { cls, h: 0, rings, bbox: polygonBox(rings) }; };
  // A street running north: footpath 2 m | cycle path 2 m | carriageway 5.5 m | footpath 2.4 m, offset so the centreline is x = 0.
  const polys = [poly('foot', -9.1, -7.1), poly('cycle', -7.1, -5.1), poly('carriage', -5.1, 0.4), poly('foot', 0.4, 2.8)].map(p => ({ ...p }));
  // Re-centre: the way's own run is −5.1…0.4, so the centreline x = −2.35.
  const s = sectionWidths(polys, [-2.35, 0], [1, 0], new Set<SurfaceClass>(['carriage']))!;
  assert.ok(Math.abs(s.widthM - 5.5) < 1e-6, `carriageway ${s.widthM}`);
  assert.ok(Math.abs(s.cycleM - 2) < 1e-6 && Math.abs(s.sidewalkM - (2 + 2.4) / 2) < 1e-6, `cycle ${s.cycleM}, footpath ${s.sidewalkM}`);
  // A parking bay is not the carriageway; a centreline far from any own surface finds nothing.
  assert.equal(sectionWidths([poly('parking', -5, 5)], [0, 0], [1, 0], new Set<SurfaceClass>(['carriage'])), null);
  assert.equal(sectionWidths(polys, [30, 0], [1, 0], new Set<SurfaceClass>(['carriage'])), null);
  // Median over stations along a way drops a junction that inflates one of three.
  const wideRings: Vec2[][] = [[[-5.1, 10], [12, 10], [12, 30], [-5.1, 30]]];
  const idx = new BgtIndex([poly('carriage', -5.1, 0.4), { cls: 'carriage', h: 0, rings: wideRings, bbox: polygonBox(wideRings) }]);
  const w = wayWidths(idx, [[-2.35, -40], [-2.35, 40]], new Set<SurfaceClass>(['carriage']))!;
  assert.ok(Math.abs(w.widths.widthM - 5.5) < 1e-6 && w.stations === 3);
  // A dual carriageway merged with its tram bed: the way on one half measures its own half.
  const dual = [poly('carriage', -3, 9)];
  assert.ok(Math.abs(sectionWidths(dual, [0, 0], [1, 0], new Set<SurfaceClass>(['carriage']))!.widthM - 6) < 1e-6, 'twice the distance to the near edge');
  assert.ok(Math.abs(sectionWidths(dual, [3, 0], [1, 0], new Set<SurfaceClass>(['carriage']))!.widthM - 12) < 1e-6, 'a centred way keeps the whole run');
  assert.equal(classOf('rijbaan lokale weg'), 'carriage');
  assert.equal(classOf('voetpad op trap'), 'foot');
  assert.equal(classOf('fietspad'), 'cycle');
  assert.equal(toDm(5.54), 55);
});

test('crossSection prefers the BGT width, takes painted lanes off it, and says where each width came from', () => {
  const tags = { highway: 'residential', cycleway: 'lane', sidewalk: 'both' };
  const prior = crossSection(tags)!;
  assert.equal(prior.source.width, 'prior');
  const measured = crossSection({ ...tags, width: '4' }, [74, 22, 0])!;
  assert.equal(measured.source.width, 'bgt');
  assert.ok(Math.abs(measured.bands[0].width - (7.4 - 2 * 1.6)) < 1e-9, 'two painted lanes come off the BGT rijbaan');
  const sidewalk = measured.bands.find(b => b.kind === 'sidewalk')!;
  assert.ok(Math.abs(sidewalk.width - 2.2) < 1e-9 && measured.source.sidewalk === 'bgt');
  // Without a measurement nothing changes.
  assert.deepEqual(crossSection(tags, undefined), prior);
  assert.equal(crossSection({ highway: 'cycleway' }, [31, 0, 0])!.bands[0].width, 3.1);
  assert.equal(crossSection({ highway: 'cycleway' }, [31, 0, 0])!.source.width, 'bgt');
  assert.equal(crossSection({ highway: 'footway', width: '1' }, [0, 0, 0])!.source.width, 'tag', 'bw zero = not measured');
  const track = crossSection({ highway: 'secondary', cycleway: 'track' }, [70, 0, 22])!;
  assert.ok(Math.abs(track.bands.find(b => b.kind === 'cycle_track')!.width - (2.2 + 0.8)) < 1e-9 && track.source.cycleway === 'bgt');
});

// The bridge kit's own tests (lane bridge-kit 2026-10-13), run with this file.
import './bridgeKit.test';
// ------------------------------------------------------------- parks (lane parks 2026-10-13)

test('parks: BGT terrain classes map to park surfaces; streets and yards are not parks', () => {
  assert.equal(bgtParkSurface('begroeidterreindeel', { fysiek_voorkomen: 'groenvoorziening', plus_fysiek_voorkomen: 'gras- en kruidachtigen' }), 'lawn');
  assert.equal(bgtParkSurface('begroeidterreindeel', { fysiek_voorkomen: 'groenvoorziening', plus_fysiek_voorkomen: null }), 'lawn');
  assert.equal(bgtParkSurface('begroeidterreindeel', { fysiek_voorkomen: 'groenvoorziening', plus_fysiek_voorkomen: 'heesters' }), 'shrub');
  assert.equal(bgtParkSurface('begroeidterreindeel', { fysiek_voorkomen: 'groenvoorziening', plus_fysiek_voorkomen: 'bosplantsoen' }), 'shrub');
  assert.equal(bgtParkSurface('begroeidterreindeel', { fysiek_voorkomen: 'groenvoorziening', plus_fysiek_voorkomen: 'struikrozen' }), 'bed');
  assert.equal(bgtParkSurface('begroeidterreindeel', { fysiek_voorkomen: 'groenvoorziening', plus_fysiek_voorkomen: 'boomschors' }), 'bark');
  assert.equal(bgtParkSurface('begroeidterreindeel', { fysiek_voorkomen: 'loofbos' }), 'shrub');
  assert.equal(bgtParkSurface('onbegroeidterreindeel', { fysiek_voorkomen: 'zand' }), 'sand');
  assert.equal(bgtParkSurface('onbegroeidterreindeel', { fysiek_voorkomen: 'half verhard' }), 'gravel');
  assert.equal(bgtParkSurface('onbegroeidterreindeel', { fysiek_voorkomen: 'erf' }), null);
  assert.equal(bgtParkSurface('wegdeel', { functie: 'voetpad', fysiek_voorkomen: 'gesloten verharding' }), 'path');
  assert.equal(bgtParkSurface('wegdeel', { functie: 'fietspad', fysiek_voorkomen: 'gesloten verharding' }), 'cycle');
  assert.equal(bgtParkSurface('wegdeel', { functie: 'voetpad', fysiek_voorkomen: 'half verhard' }), 'gravel');
  assert.equal(bgtParkSurface('wegdeel', { functie: 'rijbaan lokale weg', fysiek_voorkomen: 'gesloten verharding' }), null);
  assert.equal(bgtParkSurface('waterdeel', {}), 'pond');
  assert.equal(playgroundPiece('basketswing'), 'swing');
  assert.equal(playgroundPiece('climbingframe'), 'climb');
  assert.equal(playgroundPiece('bench'), null);
});

test('parks: the default playground kit fits inside, apart and clear of the edge; benches follow a path at the spacing, facing it', () => {
  const rect: Vec2[] = [[0, 0], [30, 0], [30, 20], [0, 20], [0, 0]];
  const kit = playgroundKit([rect]);
  assert.deepEqual(kit.map(k => k.k), ['sandpit', 'swing', 'slide']);
  for (const k of kit) assert.ok(k.p[0] >= 2.2 && k.p[0] <= 27.8 && k.p[1] >= 2.2 && k.p[1] <= 17.8, `${k.k} inside`);
  for (let i = 0; i < kit.length; i++) for (let j = i + 1; j < kit.length; j++) assert.ok(Math.hypot(kit[i].p[0] - kit[j].p[0], kit[i].p[1] - kit[j].p[1]) >= 6);
  assert.equal(playgroundKit([[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]]]).length, 0, 'too small for a kit');
  const benches = benchesAlong([[[0, 0], [100, 0]]], 40, 2, () => true);
  assert.deepEqual(benches.map(b => b.p.map(v => +v.toFixed(3))), [[20, 2], [60, 2]]);
  // Left of an eastbound path, facing south (toward it): a = −π/2.
  for (const b of benches) assert.ok(Math.abs(b.a + Math.PI / 2) < 1e-9);
  assert.equal(benchesAlong([[[0, 0], [100, 0]]], 40, 2, x => x > 50).length, 1, 'vetoed spots are skipped');
});

test('parks: surfaces drape between the OSM areas and the street bands; furniture only in the near ring', () => {
  const sq = (x: number, y: number, s: number) => encodeLine([[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]]);
  const cell: ParksCell = {
    version: 2, key: '0_0', parks: [{ id: 'a1', kind: 'park' }],
    surfaces: [{ k: 'lawn', r: [sq(0, 0, 20)] }, { k: 'path', r: [sq(20, 0, 3)] }, { k: 'sand', r: [sq(30, 0, 5)] }],
    hedges: [[sq(40, 0, 2)]],
    lines: [{ k: 'hedge', g: encodeLine([[0, -2], [20, -2]]) }, { k: 'fence', g: encodeLine([[0, -4], [20, -4]]) }],
    points: [{ k: 'bench', p: [50, 50], a: 0 }, { k: 'lamp', p: [100, 100] }, { k: 'swing', p: [320, 100], a: 0, gen: 1 }],
    dropWays: [7],
  };
  assert.deepEqual(decodeLine(encodeLine([[1.04, -2.26], [1.04, -2.26], [3, 4]])), [[1, -2.3], [3, 4]], 'decimetres, duplicates dropped');
  const ground = (x: number, y: number) => 0.01 * x;
  const near = buildParks(cell, ground, 0);
  assert.ok(near.layers.lawn && near.layers.parkPath && near.layers.sand && near.layers.hedge && near.layers.furniture);
  const lawn = near.layers.lawn!;
  for (let i = 0; i < lawn.positions.length; i += 3) assert.ok(Math.abs(lawn.positions[i + 2] - ground(lawn.positions[i], lawn.positions[i + 1]) - PARK_LIFT.lawn) < 1e-9);
  assert.ok(PARK_LIFT.lawn > LIFT.area && PARK_LIFT.path < LIFT.carriageway && PARK_LIFT.cycle < LIFT.carriageway, 'park lifts sit between areas and street bands');
  assert.deepEqual([near.stats.benches, near.stats.lamps, near.stats.play, near.stats.generated], [1, 1, 1, 1]);
  assert.ok(Math.abs(near.stats.hedgeM - 20) < 1e-9 && Math.abs(near.stats.fenceM - 20) < 1e-9);
  let top = -Infinity;
  const f = near.layers.furniture!;
  for (let i = 2; i < f.positions.length; i += 3) top = Math.max(top, f.positions[i]);
  assert.ok(top > 4.5 && top < 5, `lamp head ${top}`);
  const far = buildParks(cell, ground, 1);
  assert.ok(far.layers.lawn && far.layers.hedge && !far.layers.furniture, 'far ring: surfaces and hedges, no furniture');
  assert.ok(far.layers.lawn!.indices.length < lawn.indices.length);
});

test('belt audit deck top: a tram rail lying on a street band is street, over the deck top it is not (BRU0030, 2026-10-14)', () => {
  assert.equal(deckStreetTop([{ layer: 'tram', z: 1.134 }, { layer: 'asphalt', z: 1.114 }, { layer: 'deckTop', z: 1.084 }]), true);
  assert.equal(deckStreetTop([{ layer: 'tram', z: 1.134 }, { layer: 'deckTop', z: 1.114 }]), false);
  assert.equal(deckStreetTop([{ layer: 'tram', z: 1.2 }, { layer: 'asphalt', z: 1.2 - RAIL_ON_BAND_M - 0.01 }]), false);
  assert.equal(deckStreetTop([{ layer: 'deckBody', z: 2.517 }, { layer: 'cycle', z: 2.422 }]), false);
  assert.equal(deckStreetTop([]), false);
});

test('belt audit quay samples: a shore split into 0.5 m pieces near a berth samples as the uncut shore (Westerdok, 2026-10-14)', () => {
  // The berth rule (moorings.ts) re-cuts shores near a houseboat into collinear 0.5 m pieces; the audit sampled
  // each piece, so the reviewed Westerdok spot went from 16 to 106 samples and its key moved off KNOWN.
  const shore: [number, number][] = [[0, 0], [40, 0], [40, 23]];
  const split: [number, number][] = [[0, 0]];
  for (let i = 1; i <= 80; i++) split.push([i * 0.5, 0]);
  for (let i = 1; i <= 46; i++) split.push([40, i * 0.5]);
  assert.deepEqual(shoreSamples(split), shoreSamples(shore));
  assert.equal(shoreSamples(shore).length, 8 + 4);
  // A real corner is kept, a doubled vertex is dropped, a hairpin is not merged into one segment.
  assert.equal(shoreSamples([[0, 0], [10, 0], [10, 0], [10, 10]]).length, 4);
  assert.equal(shoreSamples([[0, 0], [10, 0], [5, 0]]).length, 3);
  // Reviewed spots match a finding a metre or two off, not the next spot along the dock.
  assert.ok(spotDistanceM('4.90719,52.38449', '4.90721,52.38449') < KNOWN_SPOT_M);
  assert.ok(spotDistanceM('4.90719,52.38449', '4.90768,52.38468') > KNOWN_SPOT_M);
});

test('bridge bands carry vertices across: a 5 m band over a 4.2 m deck follows it instead of sagging under it (BRU0292)', () => {
  // The Schottenburchsbrug: the deck rises 0.35 m over the relief beside it, the mapped carriageway is wider than the deck.
  const height = (_x: number, y: number) => (Math.abs(y) <= 2.1 ? 1.06 : 0.71);
  const ways = prepareWays([{ id: 1, tags: { highway: 'residential', bridge: 'yes', width: '5', sidewalk: 'no', surface: 'asphalt' }, g: [[0, 0], [12, 0]] }], p => p as [number, number]);
  const centre = (acrossStep?: number) => faces(buildStreets(ways, height, { step: 0.75, acrossStep }).asphalt).filter(f => Math.abs(f.c[1]) < 1).map(f => f.c[2]);
  const before = centre(), after = centre(2);
  assert.ok(before.length && Math.min(...before) < 1.06 - 0.05, `edges-only band sags under the deck (${Math.min(...before).toFixed(3)})`);
  assert.ok(after.length && Math.min(...after) >= 1.06 + LIFT.carriageway - 1e-6, `band on the deck (${Math.min(...after).toFixed(3)})`);
});

test('land pockets: a small gap enclosed by sidewalks near a junction is paved; open land, far gaps and park-bordered gaps are not', () => {
  // A 40 m cell; four 2 m sidewalks enclose a 4 × 4 m gap at (10..14, 10..14); a park ring encloses another at (26..30, 10..14).
  const quad = (m: MeshArrays, x0: number, y0: number, x1: number, y1: number) => { const b = m.positions.length / 3; m.positions.push(x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y1, 0); m.uvs.push(0, 0, 0, 0, 0, 0, 0, 0); m.indices.push(b, b + 1, b + 2, b, b + 2, b + 3); };
  const paving = emptyMesh(), park = emptyMesh();
  quad(paving, 8, 8, 16, 10); quad(paving, 8, 14, 16, 16); quad(paving, 8, 10, 10, 14); quad(paving, 14, 10, 16, 14);
  quad(park, 24, 8, 32, 10); quad(park, 24, 14, 32, 16); quad(park, 24, 10, 26, 14); quad(park, 30, 10, 32, 14);
  const cover = [{ meshes: [paving], as: 'paving' as const }, { meshes: [park], as: null }];
  const r = fillPockets(cover, [0, 0, 40, 40], [[12, 20]], () => 0, POCKET_LIFT);
  assert.equal(r.stats.pockets, 1, 'the sidewalk pocket only (the park one is skipped, the open land touches the cell edge)');
  assert.equal(r.stats.skipped, 1);
  assert.equal(r.stats.m2, 16);
  const tris = faces(r.meshes.paving!);
  assert.ok(tris.every(f => f.c[0] > 9.7 && f.c[0] < 14.3 && f.c[1] > 9.7 && f.c[1] < 14.3), 'inside the gap, grown by half a pixel');
  assert.ok(tris.every(f => Math.abs(f.c[2] - POCKET_LIFT) < 1e-9), 'under every band');
  assert.equal(fillPockets(cover, [0, 0, 40, 40], [[12, 80]], () => 0, POCKET_LIFT).stats.pockets, 0, 'no junction within POCKET_NEAR_M');
  assert.equal(fillPockets(cover, [0, 0, 40, 40], [[12, 20]], () => 0, POCKET_LIFT, { maxM2: 10 }).stats.pockets, 0, 'larger than the cap');
});

test('water opens under a footbridge whose water polygon stops at it (Melkmeisjesbrug), not under a wide deck', () => {
  // A canal along x (y 0..10) cut by a 3 m land strip at x 19..21; a footbridge along y at x = 20, 2.4 m wide.
  const west: Vec2[] = [[0, 0], [19, 0], [19, 10], [0, 10]], east: Vec2[] = [[21, 0], [40, 0], [40, 10], [21, 10]];
  const geo = { polygons: [[west], [east]], shores: [[[19, 10], [19, 0]], [[21, 0], [21, 10]], [[0, 0], [19, 0]]] as Vec2[][] };
  const n = 31, deck = (hw: number) => ({ id: 'B', x: Float64Array.from({ length: n }, () => 20), y: Float64Array.from({ length: n }, (_, i) => -2.5 + i * 0.5), s: Float64Array.from({ length: n }, (_, i) => i * 0.5), halfWidth: Float64Array.from({ length: n }, () => hw), deck: [2, 13] as [number, number] });
  const r = openUnderFootbridges(geo, [deck(1.2)], [0, -5, 40, 15], -1.77);
  assert.deepEqual(r.opened, ['B']);
  assert.equal(r.geo.polygons.length, 3, 'one opening polygon added');
  assert.equal(r.geo.shores.length, 1, 'the two walls across the canal dropped, the bank kept');
  const mask = buildWaterMask(r.geo, 0, -5, 40, 15, 0.5, 4);
  for (const y of [1, 5, 9]) assert.ok(maskDistance(mask, 20, y) < 0, `water under the deck at y ${y}`);
  for (const x of [18.5, 21.5]) assert.ok(maskDistance(mask, x, 5) < 0, 'the overlap with the water either side stays water (OR, not even-odd)');
  assert.ok(maskDistance(mask, 20, 12) > 0, 'land beyond the bank');
  assert.equal(openUnderFootbridges(geo, [deck(4)], [0, -5, 40, 15], -1.77).opened.length, 0, 'an 8 m deck (a road on a dam) is left alone');
});

test('a houseboat half over the generalised shore gets its berth opened: water under the hull, the wall behind it', () => {
  // A canal y 0..10 along x with its north bank at y = 10; a 4 x 12 m boat at y 7..11 (1 m over the bank), one wholly in the water, one on land.
  const geo = { polygons: [[[[0, 0], [40, 0], [40, 10], [0, 10]] as Vec2[]]], shores: [[[0, 10], [40, 10]]] as Vec2[][] };
  const box = (x: number, y0: number, y1: number): Vec2[] => [[x, y0], [x + 12, y0], [x + 12, y1], [x, y1], [x, y0]];
  const boats = [{ id: 'over', ring: box(2, 7, 11) }, { id: 'afloat', ring: box(20, 2, 6) }, { id: 'yard', ring: box(26, 14, 18) }];
  const r = openUnderHouseboats(geo, boats, [0, -5, 40, 25], -1.77);
  assert.deepEqual(r.opened, ['over']);
  const berth = berthRect(boats[0].ring, MOORING_MARGIN_M)!;
  assert.ok(Math.abs(berth.area - 48) < 1e-6, 'min-area rectangle of the hull');
  const mask = buildWaterMask(r.geo, -2, -5, 42, 25, 0.25, 4);
  for (const [x, y] of [[3, 10.8], [8, 10.5], [13.5, 10.9]] as Vec2[]) assert.ok(maskDistance(mask, x, y) < 0, `water under the hull at ${x},${y}`);
  assert.ok(maskDistance(mask, 8, 12) > 0, 'land past the berth');
  // The old wall no longer runs through the hull; a new one stands behind it (water on its left).
  const crosses = (line: Vec2[]) => line.some((a, i) => i > 0 && (a[0] + line[i - 1][0]) / 2 > 2 && (a[0] + line[i - 1][0]) / 2 < 14 && Math.abs((a[1] + line[i - 1][1]) / 2 - 10) < 0.01);
  assert.ok(!r.geo.shores.some(crosses), 'no wall through the boat');
  const behind = r.geo.shores.filter(l => l.some(p => Math.abs(p[1] - 11.4) < 1e-6));
  assert.equal(behind.length, 1, 'one wall around the berth on the land side');
  const top = behind[0].filter(p => Math.abs(p[1] - 11.4) < 1e-6);
  assert.ok(top[0][0] > top[top.length - 1][0], 'its back runs west (water on its left, to the south)');
  assert.ok(behind[0].every(p => p[1] > 9.9), 'only where the berth is on land');
});

const haveBoats = existsSync('public/data/extracts/amsterdam/houseboats.json') && existsSync('public/data/extracts/amsterdam/own-ground-osm-v1/cells.json');
test('regression (houseboats, user 2026-10-14): no houseboat in the Frederik Hendrikbuurt / Westerkanaal / Spaarndammerbuurt cells lies under land', { skip: !haveBoats }, async () => {
  const store = fsStore();
  await store.init();
  const boats = (JSON.parse(readFileSync('public/data/extracts/amsterdam/houseboats.json', 'utf8')).boats as { id: string; ring: [number, number][] }[]).map(b => ({ id: b.id, ring: b.ring.map(([lng, lat]) => storeToLocal(lng, lat)) }));
  let total = 0;
  const covered: unknown[] = [];
  for (const key of HOUSEBOAT_LAND_CELLS) {
    if (!store.covers(key)) continue;
    const r = houseboatsOnLand(buildCell(await store.cellInput(key, 0)), boats);
    total += r.boats; covered.push(...r.covered.map(c => ({ key, ...c })));
  }
  assert.ok(total > 300, `boats checked: ${total}`);
  assert.deepEqual(covered, [], 'houseboat footprints under land');
});

// ------------------------------------------------------------- surface classes (user 2026-10-14, Houtmankade)
/** CIE76 ΔE between two sRGB colours. */
function deltaE(a: readonly number[], b: readonly number[]): number {
  const lab = (c: readonly number[]) => {
    const lin = c.map(v => { const u = v / 255; return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4; });
    const X = (0.4124 * lin[0] + 0.3576 * lin[1] + 0.1805 * lin[2]) / 0.95047, Y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2], Z = (0.0193 * lin[0] + 0.1192 * lin[1] + 0.9505 * lin[2]) / 1.08883;
    const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
    return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
  };
  const p = lab(a), q = lab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

test('surface legend: six classes on five meshes; a fietsstraat is a red road, a brick fietsstraat stays brick', () => {
  assert.deepEqual(Object.keys(SURFACE_LEGEND).sort(), ['asphalt', 'brick', 'concrete', 'cycle', 'fietsstraat', 'gravel']);
  const fiets = crossSection({ highway: 'residential', cyclestreet: 'yes', surface: 'asphalt' })!;
  assert.equal(carriagewayClass({ highway: 'residential', cyclestreet: 'yes' }, 'klinker'), 'fietsstraat');
  assert.equal(fiets.bands[0].kind, 'carriageway');
  assert.equal(fiets.bands[0].surface, 'cycle', 'red asphalt');
  assert.ok(!fiets.paint.some(p => p.offset === 0), 'no centre line');
  assert.equal(fiets.paint.filter(p => p.dash === null && Math.abs(p.offset) > 1).length, 2, 'edge lines: drawn as a road');
  assert.equal(crossSection({ highway: 'residential', bicycle_road: 'yes', surface: 'paving_stones' })!.bands[0].surface, 'klinker', 'brick fietsstraat stays brick');
  assert.equal(crossSection({ highway: 'tertiary', 'surface:colour': 'red', surface: 'asphalt' })!.bands[0].surface, 'cycle');
  assert.equal(carriagewayClass({ highway: 'residential' }, 'klinker'), 'brick');
});

test('klinker reads as brick, not cycle red: base colours ΔE ≥ 22 (was 18), herringbone covers its tile once, the tone mix keeps the base', () => {
  assert.ok(deltaE(STREET_GROUND.klinker.base, STREET_GROUND.cycle.base) >= 22, `ΔE ${deltaE(STREET_GROUND.klinker.base, STREET_GROUND.cycle.base).toFixed(1)}`);
  const units = 20, grid = new Uint8Array(units * units * 16);
  for (const b of herringboneBricks(units, KLINKER_TONES.length)) {
    for (let y = Math.max(0, b.y * 4); y < Math.min(units * 4, (b.y + b.h) * 4); y++) for (let x = Math.max(0, b.x * 4); x < Math.min(units * 4, (b.x + b.w) * 4); x++) grid[y * units * 4 + x]++;
  }
  assert.ok(grid.every(v => v === 1), 'every quarter-unit covered exactly once (seamless, no overlaps)');
  for (let c = 0; c < 3; c++) assert.ok(Math.abs(KLINKER_TONES.reduce((s, t) => s + t[c], 0) / KLINKER_TONES.length - 1) < 0.02);
});

test('regression (Houtmankade pair, user 2026-10-14): the west quay is asphalt with a centre line, the east quay klinker with tram rails', { skip: !haveCells }, () => {
  const ways = new Map<number, { tags: Record<string, string> }>();
  for (const k of ['-2_1', '-2_2']) for (const w of (JSON.parse(gunzipSync(readFileSync(`public/data/extracts/amsterdam/own-ground-osm-v1/cells/${k}.json.gz`)).toString()) as OsmGroundExtract).ways) ways.set(w.id, w);
  // 118447399: Houtmankade, primary, surface=asphalt (BGT rijbaan regionale weg, gesloten verharding), separate red cycleway beside it.
  const west = crossSection(ways.get(118447399)!.tags)!;
  assert.equal(west.bands[0].surface, 'asphalt');
  assert.ok(west.paint.some(p => p.offset === 0 && p.dash), 'centre dashes');
  // 743746050: Houtmankade, residential, embedded_rails=tram, no surface tag (BGT rijbaan lokale weg, open verharding = klinkers).
  const east = crossSection(ways.get(743746050)!.tags)!;
  assert.equal(carriagewayClass(ways.get(743746050)!.tags, 'klinker'), 'brick');
  assert.equal(east.bands[0].surface, 'klinker');
  assert.ok(east.rails.length > 0, 'the two dark lines are tram rails');
  assert.ok(!east.bands.some(b => b.surface === 'cycle'), 'nothing on the east quay is cycle red');
});

// ------------------------------------------------------------- junction road markings (user 2026-10-14)
test('junction markings: a side street gives way with shark teeth, a signalised junction gets stop lines, a painted cycle lane runs through', () => {
  assert.equal(mouthMarking('residential', 5, false), 'giveWay');
  assert.equal(mouthMarking('primary', 5, false), null, 'the main road keeps priority, unmarked');
  assert.equal(mouthMarking('residential', 1, false), null, 'equal classes: rechts voorrang, unmarked');
  assert.equal(mouthMarking('residential', 5, true), 'stop');
  assert.equal(mouthMarking('service', 5, false), null, 'an exit is not a junction arm to mark');
  const m = emptyMesh();
  assert.equal(sharkTeeth(m, { o: [0, 0], u: [1, 0] }, 0.15, 2.9, () => 0, 0.05), 4, '2.75 m inbound half: four teeth at a 0.75 m pitch');
  assert.ok(m.positions.length > 0);
  // A T: primary along x (two-way, painted cycle lanes both sides), a residential side street north from x = 0.
  const main: OsmWay = { id: 1, tags: { highway: 'primary', cycleway: 'lane', lanes: '2', sidewalk: 'no' }, g: [[-60, 0], [0, 0], [60, 0]] };
  const side: OsmWay = { id: 2, tags: { highway: 'residential', sidewalk: 'no' }, g: [[0, 0], [0, 50]] };
  const local = (ways: OsmWay[]) => prepareWays(ways, p => [p[0], p[1]]);
  const plain = buildStreets(local([main, side]), () => 0);
  assert.equal(plain.stats.markings.giveWays, 1, 'the side street gives way');
  assert.ok(plain.stats.markings.teeth >= 2);
  assert.equal(plain.stats.markings.stopLines, 0);
  assert.equal(plain.stats.markings.laneLinks, 2, 'both cycle lanes carried through the junction');
  assert.equal(plain.stats.markings.cycleCrossings, 1, 'the north lane crosses the side street mouth: block markings');
  const teeth = faces(plain.paint).filter(f => f.c[1] > 3 && f.c[1] < 12 && f.c[0] < 0 && f.c[0] > -3);
  assert.ok(teeth.length >= 2, 'teeth on the side street, on its inbound (west) half');
  const crossing: OsmWay = { id: 3, tags: { highway: 'footway', footway: 'crossing', crossing: 'traffic_signals' }, g: [[-4, 8], [4, 8]] };
  const lit = buildStreets(local([main, side, crossing]), () => 0);
  assert.equal(lit.stats.markings.stopLines, 3, 'signalised: every arm gets a stop line across its inbound half');
  assert.equal(lit.stats.markings.giveWays, 0, 'and no teeth');
});

test('regression (Nassaukade / Frederik Hendrikplantsoen, OSM n2306196651, user 2026-10-14): the junction carries its road paint', { skip: !haveCells }, async () => {
  const store = fsStore();
  await store.init();
  const [x, y] = storeToLocal(4.8776303, 52.3785795);
  const cell = buildCell(await store.cellInput(store.cellAt(x, y), 0));
  const area = (layer: 'paint' | 'cycle') => {
    const mesh = cell.layers[layer]!, p = mesh.positions, idx = mesh.indices;
    let a = 0;
    for (let t = 0; t < idx.length; t += 3) {
      const i = idx[t] * 3, j = idx[t + 1] * 3, k = idx[t + 2] * 3;
      if (Math.hypot((p[i] + p[j] + p[k]) / 3 - x, (p[i + 1] + p[j + 1] + p[k + 1]) / 3 - y) > 30) continue;
      a += Math.abs((p[j] - p[i]) * (p[k + 1] - p[i + 1]) - (p[k] - p[i]) * (p[j + 1] - p[i + 1])) / 2;
    }
    return a;
  };
  // Within 30 m: paint 43 m² and red 224 m² before the junction markings, 70 m² and 296 m² after.
  assert.ok(area('paint') >= 60, `paint ${area('paint').toFixed(1)} m²`);
  assert.ok(area('cycle') >= 270, `cycle red ${area('cycle').toFixed(1)} m² (lanes carried through)`);
});

test('park fill culling: a fill triangle inside one BGT surface goes; one over a hole or across two surfaces stays', () => {
  // Lawn A covers 0..20 x 0..20 with a 3 x 3 m hole at (12..15, 12..15); lawn B covers 20..40 x 0..20.
  const cell = { version: 2, key: 't', parks: [], hedges: [], lines: [], points: [], dropWays: [], surfaces: [
    { k: 'lawn', r: [encodeLine([[0, 0], [20, 0], [20, 20], [0, 20]]), encodeLine([[12, 12], [12, 15], [15, 15], [15, 12]])] },
    { k: 'lawn', r: [encodeLine([[20, 0], [40, 0], [40, 20], [20, 20]])] },
  ] } as unknown as ParksCell;
  const index = new SurfaceIndex([cell]), raster = index.raster([-1, -1, 41, 21], CULL_RES_M);
  assert.equal(index.own, 2, 'both surfaces belong to the first cell');
  const tri = (pts: [number, number][]) => { const m = emptyMesh(); for (const [x, y] of pts) { m.positions.push(x, y, 0); m.uvs.push(0, 0); } m.indices.push(0, 1, 2); return m; };
  assert.equal(cullCovered(tri([[2, 2], [8, 2], [2, 8]]), raster).dropped, 1, 'inside lawn A, clear of its edges');
  assert.equal(cullCovered(tri([[10, 10], [17, 10], [10, 17]]), raster).dropped, 0, 'over the hole');
  assert.equal(cullCovered(tri([[17, 2], [24, 2], [17, 8]]), raster).dropped, 0, 'across the seam between A and B');
  assert.equal(cullCovered(tri([[0.2, 2], [6, 2], [0.2, 8]]), raster).dropped, 0, 'within CULL_MARGIN_M of the edge');
  const kept = cullCovered(merge([tri([[2, 2], [8, 2], [2, 8]]), tri([[10, 10], [17, 10], [10, 17]])]), raster);
  assert.equal(kept.mesh.indices.length, 3);
  assert.equal(kept.mesh.positions.length, 9, 'vertices compacted');
});

test('far ring: radius only past the resident ring, blocks nearest first, one part per covered cell, under budget', () => {
  assert.equal(farRadiusM(1800, 2000), 0, 'the resident ring reaches the view');
  assert.equal(farRadiusM(3200, 2000), 4000);
  assert.equal(farRadiusM(40000, 2000), FAR_MAX_M);
  assert.deepEqual(farBlockCells('-1_0'), ['-2_0', '-1_0', '-2_1', '-1_1']);
  assert.equal(farBlockOf('-1_1'), '-1_0');
  const cellRect = (k: string): [number, number, number, number] => { const [cx, cy] = k.split('_').map(Number); return [cx * 1000, cy * 1000, cx * 1000 + 1000, cy * 1000 + 1000]; };
  const blocks = farBlocksWithin([500, 500], '0_0', 2500, 1000, cellRect);
  assert.equal(blocks[0].key, '0_0');
  assert.ok(blocks.every((b, i) => i === 0 || b.d >= blocks[i - 1].d), 'nearest first');
  assert.ok(blocks.some(b => b.key === '1_0') && !blocks.some(b => b.key === '2_0'), 'block 2_0 starts 3.5 km away');
  assert.deepEqual(simplify([[0, 0], [10, 0.5], [20, 0], [30, 10]], 1), [[0, 0], [20, 0], [30, 10]]);
  const ll = (p: Vec2): [number, number] => p as [number, number];
  const osm = { version: 1, box: '', centre: [0, 0], fetched: '', attribution: '', areas: [{ id: 'a', kind: 'park', rings: [[[100, 100], [300, 100], [300, 300], [100, 300], [100, 100]]] }],
    ways: [{ id: 1, tags: { highway: 'residential' }, g: [[0, 500], [1000, 500]] }, { id: 2, tags: { highway: 'primary' }, g: [[500, 0], [500, 1000]] }] } as unknown as OsmGroundExtract;
  const water = { polygons: [[[[600, 600], [900, 600], [900, 900], [600, 900]]]], shores: [] } as WaterGeometry;
  const b = buildFarBlock({ key: '0_0', rect: [0, 0, 1000, 1000], ground: () => 1, project: p => ll(p as Vec2), cells: [{ key: '0_0', rect: [0, 0, 1000, 1000], osm, water }] });
  assert.deepEqual(b.parts.map(p => p.key), ['0_0']);
  assert.equal(b.stats.byLayer.land, 2 * 20 * 20, 'a 50 m grid over 1 km');
  assert.equal(b.stats.byLayer.green, 2);
  assert.equal(b.stats.byLayer.water, 2);
  assert.equal(b.stats.byLayer.street, 4, 'two straight bands, one quad each');
  assert.ok(b.stats.triangles <= FAR_BLOCK_BUDGET && b.parts[0].mesh.colors, 'vertex coloured, under budget');
  const zs = [...b.parts[0].mesh.positions].filter((_, i) => i % 3 === 2);
  assert.equal(Math.min(...zs), 1, 'land on the relief');
  assert.ok(Math.abs(Math.max(...zs) - 1 - FAR_LIFT.street) < 1e-6, 'streets lifted over the relief');
});

test('ground light: level sunlit ground draws its palette luminance; the road stays above the shade floor in cast shadow (live play 2026-10-14)', () => {
  // Before the gain the rig drew level ground at 0.83 of its albedo (sRGB ≈ 0.92): the "city too dark".
  assert.ok(Math.abs(flatGroundLuminance() - 0.828) < 0.01, `rig lights level ground at ${flatGroundLuminance()}`);
  assert.ok(Math.abs(FLAT_GROUND_GAIN * flatGroundLuminance() - 1) < 1e-9);
  for (const v of [60, 104, 164, 220]) assert.ok(Math.abs(drawnGrey(v, FLAT_GROUND_GAIN) - v) < 0.01, `palette ${v} draws ${drawnGrey(v, FLAT_GROUND_GAIN)}`);
  const asphalt = 0.2126 * STREET_GROUND.asphalt.base[0] + 0.7152 * STREET_GROUND.asphalt.base[1] + 0.0722 * STREET_GROUND.asphalt.base[2];
  const klinker = 0.2126 * STREET_GROUND.klinker.base[0] + 0.7152 * STREET_GROUND.klinker.base[1] + 0.0722 * STREET_GROUND.klinker.base[2];
  // docs/LOOK.md §Driving corridor readability: the road under the rider never below the shade-side range (65–75).
  assert.ok(drawnGrey(asphalt, FLAT_GROUND_GAIN, true) >= 75, `asphalt in cast shadow draws ${drawnGrey(asphalt, FLAT_GROUND_GAIN, true)}`);
  assert.ok(asphalt < klinker, 'asphalt stays darker than the klinker carriageway');
});

// ------------------------------------------------------------- Westerkanaal lock island (live play 2026-10-14)
// The "mid-canal land blob" on the Westerkanaal off the Houtmankade is the middle head of the
// Westerkanaalschutsluis (OSM w797542031 / w1308281538, Q85308137): an inner ring of the water
// multipolygon r1142453, ~75 m² of concrete with the lock's lamps and posts, flanked by the two
// lock passages and the bank heads (PDOK aerial 2025; docs/images/live-play-20261014/anomaly-blob-before-after.jpg).
// It is real ground and must stay land; the berth rule (moorings.ts) must not open it.
const WESTERKANAAL_LOCK_ISLAND = { at: [4.884192, 52.387752] as const, areaM2: [50, 120] as const };
test('regression: the Westerkanaalschutsluis middle head stays an island, with and without houseboat berths', { skip: !haveCells }, async () => {
  for (const moorings of [true, false]) {
    const store = new GroundStore(async path => {
      const bytes = readFileSync(`public/data/extracts/amsterdam/${path}`);
      return new Uint8Array(bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes);
    }, { moorings });
    await store.init();
    const [x, y] = storeToLocal(...WESTERKANAAL_LOCK_ISLAND.at);
    const geo = (await store.waterCell(store.cellAt(x, y)))!;
    const holes = geo.polygons.flatMap(poly => poly.slice(1)).filter(ring => {
      const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length, cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
      return Math.hypot(cx - x, cy - y) < 30;
    });
    assert.equal(holes.length, 1, `moorings=${moorings}: one island at the lock`);
    let a = 0; const ring = holes[0];
    for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; a += p[0] * q[1] - q[0] * p[1]; }
    assert.ok(Math.abs(a / 2) > WESTERKANAAL_LOCK_ISLAND.areaM2[0] && Math.abs(a / 2) < WESTERKANAAL_LOCK_ISLAND.areaM2[1], `island ${Math.abs(a / 2).toFixed(1)} m²`);
    const mask = buildWaterMask(geo, x - 40, y - 40, x + 40, y + 40, 0.5);
    assert.ok(maskDistance(mask, x, y) > 0, 'land on the island');
    assert.ok(maskDistance(mask, x - 12, y) < 0 && maskDistance(mask, x + 12, y) < 0, 'both lock passages are water');
  }
});

// ------------------------------------------------------------- ground look variants (user 2026-10-14, "city too dark")
test('ground looks: default is palette.ts untouched; measured/bright/legacy-ish hit their luma targets and keep the legend ΔE ≥ 20', () => {
  const luma = (c: readonly number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const rgbOf = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const d = groundPalette('default');
  assert.equal(d.street, STREET_GROUND); assert.equal(d.tones, GROUND_TONES);
  const def = basemapGroundPatches([{ id: 'road_minor', type: 'line', 'source-layer': 'transportation' }, { id: 'water', type: 'fill', 'source-layer': 'water' }], groundPalette('default'));
  assert.deepEqual(def.map(p => p.value), ['rgb(86,88,93)', '#46707c', '#46707c'], 'default basemap patches unchanged');
  // Targets: measured = the dehazed sunlit orthophoto medians (docs/ground-tones-20261014.md); bright road ~130 / pavement ~175; legacy-ish road ~200 / pavement ~215 / water ~170.
  const target: Record<string, { asphalt: number; pavement: number; water: number }> = { measured: { asphalt: 166, pavement: 165, water: 54 }, bright: { asphalt: 130, pavement: 175, water: 118 }, 'legacy-ish': { asphalt: 200, pavement: 215, water: 170 } };
  for (const look of ['measured', 'bright', 'legacy-ish'] as const) {
    const { street, tones } = groundPalette(look);
    assert.ok(Math.abs(luma(street.asphalt.base) - target[look].asphalt) <= 4, `${look} road luma ${luma(street.asphalt.base).toFixed(0)}`);
    assert.ok(Math.abs(luma(street.pavement.base) - target[look].pavement) <= 4, `${look} pavement luma ${luma(street.pavement.base).toFixed(0)}`);
    assert.ok(Math.abs(luma(rgbOf(tones.water)) - target[look].water) <= 4, `${look} water luma ${luma(rgbOf(tones.water)).toFixed(0)}`);
    for (const [a, b] of [['asphalt', 'cycle'], ['asphalt', 'klinker'], ['klinker', 'cycle']] as const) {
      const e = deltaE(street[a].base, street[b].base);
      assert.ok(e >= 20, `${look} ${a}/${b} ΔE ${e.toFixed(1)}`);
    }
    // Only ground: paint, rails, bollards, parks and woods are today's.
    for (const k of ['paint', 'rail', 'bollard'] as const) assert.equal(street[k], STREET_GROUND[k]);
    for (const k of ['park', 'wood', 'lawn', 'shrub', 'bed', 'bark', 'sand', 'gravel', 'parkGravel'] as const) assert.equal(tones[k], GROUND_TONES[k]);
    assert.equal(tones.pond, tones.water);
    if (look !== 'measured') { const [r, g, b] = rgbOf(tones.water); assert.ok(g > b && g > r, `${look} canal grey-green, not teal: ${tones.water}`); }
  }
  assert.equal(groundLookFrom('?ownGround=1&groundLook=bright'), 'bright');
  assert.equal(groundLookFrom('?groundLook=legacy-ish'), 'legacy-ish');
  assert.equal(groundLookFrom('?groundLook=nonsense'), 'bright');
  assert.equal(groundLookFrom(''), 'bright');
  assert.equal(groundLookFrom('?groundLook=default'), 'default');
  const bright = basemapGroundPatches([{ id: 'water', type: 'fill', 'source-layer': 'water' }], groundPalette('bright'));
  assert.equal(bright[0].value, groundPalette('bright').tones.water);
});
