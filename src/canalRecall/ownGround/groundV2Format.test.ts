// GRD2 format (lane G2a #372): round trip, the frame refusal, and one cell's RD ↔ file round trip pinned
// (judgement ruling 2: game-frame coordinates are accepted provided the header records the frame and this is pinned).
import '../../../scripts/world/useBrowserMath.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { localToLngLat, type ElevationIndex } from '../elevation/elevationData';
import { lngLatToRd, rdToLngLat } from '../rdCoordinates';
import { fromLocal, GAME_FRAME_SCALE, GAME_ORIGIN, toLocal, type Rect } from './groundStore';
import { decodeGrd2, encodeGrd2, frameMismatch, frameOf, grd2Layers, GRID_Q, octDecode, octEncode, readGrd2Header, unitX, unitY, type Grd2Content } from './groundV2Format';

const frame = frameOf(GAME_ORIGIN, GAME_FRAME_SCALE);
const elevation = JSON.parse(readFileSync('public/data/extracts/amsterdam/elevation-v1/index.json', 'utf8')) as ElevationIndex;
/** groundStore.cellRect without the store. */
const cellRect = (key: string): Rect => {
  const [cx, cy] = key.split('_').map(Number), s = elevation.cellSizeM;
  const a = toLocal(...localToLngLat(elevation, cx * s, cy * s)), b = toLocal(...localToLngLat(elevation, (cx + 1) * s, (cy + 1) * s));
  return [a[0], a[1], b[0], b[1]];
};

const content = (key: string, rect: Rect, pts: [number, number, number][]): Grd2Content => {
  const n = pts.length, u = new Uint16Array(n), v = new Uint16Array(n), zMm = new Int32Array(n), oct = new Int8Array(2 * n);
  pts.forEach(([x, y, z], i) => { u[i] = Math.round((x - rect[0]) / (rect[2] - rect[0]) * GRID_Q); v[i] = Math.round((y - rect[1]) / (rect[3] - rect[1]) * GRID_Q); zMm[i] = Math.round(z * 1000); const [a, b] = octEncode(0.1, -0.2, 0.97); oct[2 * i] = a; oct[2 * i + 1] = b; });
  const indices = Uint32Array.from({ length: Math.floor(n / 3) * 3 }, (_, i) => i);
  const side = (f: (i: number) => boolean) => Uint32Array.from([...Array(n).keys()].filter(f));
  return { key, lod: 0, levels: 2, frame, rect, u, v, zMm, oct, indices, groups: [{ layer: 'asphalt', kind: 0, tile: 4, first: 0, count: indices.length / 3 }], seams: [side(i => u[i] === 0), side(i => u[i] === GRID_Q), side(i => v[i] === 0), side(i => v[i] === GRID_Q)] };
};

test('GRD2 round trip, raw and meshopt', async () => {
  await MeshoptEncoder.ready; await MeshoptDecoder.ready;
  const rect = cellRect('-4_-3');
  const c = content('-4_-3', rect, [[rect[0], rect[1] + 10, -1.234], [rect[0] + 500, rect[1] + 20, 0.5], [rect[2], rect[3], 2.25], [rect[0] + 1, rect[1] + 2, 3], [rect[0] + 3, rect[1] + 2, 3.001], [rect[0] + 2, rect[1] + 5, 2.999]]);
  for (const enc of [undefined, MeshoptEncoder]) {
    const bytes = encodeGrd2(c, enc), d = decodeGrd2(bytes, MeshoptDecoder);
    assert.deepEqual([...d.u], [...c.u]); assert.deepEqual([...d.v], [...c.v]); assert.deepEqual([...d.zMm], [...c.zMm]); assert.deepEqual([...d.oct], [...c.oct]);
    assert.deepEqual([...d.indices], [...c.indices]);
    assert.deepEqual(d.header.rect, rect);
    assert.equal(d.header.frame.originLng, GAME_ORIGIN.lng); assert.equal(d.header.frame.kx, GAME_FRAME_SCALE.kx);
    assert.deepEqual(d.seams.map(s => s.length), c.seams.map(s => s.length));
    const L = grd2Layers(d);
    // 0 and GRID_Q decode to the rect's edges exactly: seams are bitwise equal in both neighbours.
    assert.equal(unitX(rect, 0), rect[0]); assert.equal(unitY(rect, GRID_Q), rect[3]);
    assert.equal(L.positions[0], Math.fround(rect[0])); assert.equal(L.layers.asphalt!.indices.length, 6);
  }
});

test('GRD2: the loader refuses a file baked in another frame, version or rect', () => {
  const rect = cellRect('-4_-3');
  const h = readGrd2Header(encodeGrd2(content('-4_-3', rect, [[rect[0], rect[1], 0], [rect[0] + 1, rect[1], 0], [rect[0], rect[1] + 1, 0]])));
  assert.equal(frameMismatch(h, frame, rect), null);
  assert.match(frameMismatch(h, { ...frame, originLng: 4.9001 }, rect)!, /origin/);
  assert.match(frameMismatch(h, { ...frame, kx: frame.kx + 0.01 }, rect)!, /scale/);
  assert.match(frameMismatch(h, { ...frame, transform: 2 }, rect)!, /transform/);
  assert.match(frameMismatch({ ...h, version: 2 }, frame, rect)!, /version/);
  assert.match(frameMismatch(h, frame, [rect[0] + 0.01, rect[1], rect[2], rect[3]])!, /rect/);
});

test('GRD2 pin: one cell (-4_-3, the Delflandlaan sportpark) round-trips RD → file → RD within the quantum', () => {
  const key = '-4_-3', rect = cellRect(key);
  // The cell's game-frame rect, pinned (useBrowserMath): a change of origin, scale or cell grid fails here first.
  assert.deepEqual(rect.map(v => Math.round(v * 1000) / 1000), [-4000, -2978.98, -3000, -1985.986]);
  const rd = lngLatToRd(4.848, 52.347);
  const [x, y] = toLocal(...rdToLngLat(rd[0], rd[1]));
  assert.ok(x > rect[0] && x < rect[2] && y > rect[1] && y < rect[3]);
  const d = decodeGrd2(encodeGrd2(content(key, rect, [[x, y, 0.4], [rect[0], rect[1], 0], [rect[2], rect[3], 0]])));
  const back = lngLatToRd(...fromLocal(unitX(d.header.rect, d.u[0]), unitY(d.header.rect, d.v[0])));
  const err = Math.hypot(back[0] - rd[0], back[1] - rd[1]);
  // Half the 15.3 mm quantum diagonal, plus the equirectangular frame's departure from RD over the cell.
  assert.ok(err < 0.012, `RD round trip ${err.toFixed(4)} m`);
  assert.equal(d.zMm[0], 400);
});

test('octahedral normals round-trip within a degree', () => {
  for (const n of [[0, 0, 1], [0.3, -0.2, 0.93], [-0.7, 0.1, 0.7], [0.01, 0.99, 0.1]]) {
    const l = Math.hypot(n[0], n[1], n[2]); const [a, b] = octEncode(n[0] / l, n[1] / l, n[2] / l); const m = octDecode(a, b);
    const dot = (m[0] * n[0] + m[1] * n[1] + m[2] * n[2]) / l;
    assert.ok(dot > Math.cos(Math.PI / 180), `${n} → ${m}`);
  }
});
