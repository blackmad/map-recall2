// Piers over the water (piers.ts, feedback ee2b30): outlines, the clip to the water, the deck mesh, the furniture base,
// and the Haparandadam pin against the published extracts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { PIER_FREEBOARD_M, PIER_LINE_WIDTH_M, bufferLine, pierMesh, pierOverWater, pierTopAt, placePiers, type PiersExtract } from './piers';
import type { Vec2 } from './surface';
import type { WaterGeometry } from './water';

const area = (r: readonly Vec2[]) => { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]); return s / 2; };
const id = (p: [number, number]): Vec2 => [p[0], p[1]];
/** Water: the square x 0..100, y 0..100, at z -1.77. */
const POOL: WaterGeometry = { polygons: [[[[0, 0], [100, 0], [100, 100], [0, 100]]]], shores: [], levels: [-1.77] };

test('an open pier way is buffered to its width; closed ways keep their outline, counter-clockwise', () => {
  const [ring] = bufferLine([[0, 0], [10, 0]], 2);
  assert.ok(Math.abs(Math.abs(area(ring)) - 20) < 1e-6, 'a 10 m line at 2 m is 20 m²');
  const bent = bufferLine([[0, 0], [10, 0], [10, 10]], 2);
  assert.equal(bent.length, 1, 'a bent jetty is one outline');
  const placed = placePiers([{ id: 1, g: [[0, 0], [10, 0]] }, { id: 2, g: [[0, 0], [0, 5], [5, 5], [5, 0], [0, 0]], a: 1, f: 1 }], id);
  assert.equal(placed.length, 2);
  assert.ok(Math.abs(area(placed[0].ring) - 10 * PIER_LINE_WIDTH_M) < 1e-6, 'default width');
  assert.ok(area(placed[1].ring) > 0, 'clockwise input comes out counter-clockwise');
  assert.equal(placed[1].floating, true);
});

test('only the part over the water is drawn, at the freeboard over that water, sides facing out', () => {
  // A jetty from the quay (x < 0, land) 20 m out into the pool.
  const [pier] = placePiers([{ id: 7, g: [[-10, 50], [20, 50]], w: 2 }], id);
  const parts = pierOverWater(pier, [POOL], -1.77);
  assert.equal(parts.length, 1);
  const xs = parts[0].poly[0].map(p => p[0]);
  assert.ok(Math.min(...xs) >= -1e-6 && Math.max(...xs) <= 20 + 1e-6, 'clipped at the shore');
  assert.equal(pierOverWater(pier, [POOL], -1.77, [50, 0, 100, 100]).length, 0, 'a cell the pier does not reach draws nothing');
  const { top, body } = pierMesh(parts.map(p => ({ ...p, floating: false })));
  const zs = new Set<number>(); for (let i = 2; i < top.positions.length; i += 3) zs.add(+top.positions[i].toFixed(3));
  assert.deepEqual([...zs], [+(-1.77 + PIER_FREEBOARD_M.fixed).toFixed(3)]);
  // Every top triangle faces up; every side quad faces away from the deck's centre.
  const P = (m: typeof top, k: number) => [m.positions[3 * k], m.positions[3 * k + 1], m.positions[3 * k + 2]];
  for (let i = 0; i < top.indices.length; i += 3) {
    const [a, b, c] = [0, 1, 2].map(j => P(top, top.indices[i + j]));
    assert.ok((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0, 'up');
  }
  for (let i = 0; i < body.indices.length; i += 3) {
    const [a, b, c] = [0, 1, 2].map(j => P(body, body.indices[i + j]));
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2]];
    const m = [(a[0] + b[0] + c[0]) / 3 - 10, (a[1] + b[1] + c[1]) / 3 - 50];
    assert.ok(n[0] * m[0] + n[1] * m[1] > 0, 'out');
  }
});

test('furniture on a pier stands on its deck; off it, or on land, there is no pier top', () => {
  const piers = placePiers([{ id: 3, g: [[10, 10], [10, 40]], w: 2 }], id);
  const wet = (x: number, y: number) => x >= 0 && x <= 100 && y >= 0 && y <= 100;
  assert.equal(pierTopAt(piers, 10, 20, wet, () => -1.77), -1.77 + PIER_FREEBOARD_M.fixed);
  assert.equal(pierTopAt(piers, 20, 20, wet, () => -1.77), undefined, 'beside the pier');
  assert.equal(pierTopAt(piers, 10, 20, () => false, () => -1.77), undefined, 'not over water');
});

const AMS = 'public/data/extracts/amsterdam';
test('pin ee2b30: the Haparandasteiger lamps stand on a drawn pier (piers-v1)', { skip: !existsSync(`${AMS}/piers-v1/piers.json.gz`) }, () => {
  const ex = JSON.parse(gunzipSync(readFileSync(`${AMS}/piers-v1/piers.json.gz`)).toString()) as PiersExtract;
  const KX = 111320 * Math.cos(52.37 * Math.PI / 180), KY = 110540, P = (p: [number, number]): Vec2 => [(p[0] - 4.9) * KX, (p[1] - 52.37) * KY];
  const piers = placePiers(ex.piers, P);
  // BGT lichtmasten bgt-G0363.deafc918… and …d0c2f023… on the Haparandasteiger (OSM way 171610575), the note's frame.
  for (const at of [[4.8823716, 52.396814], [4.8829191, 52.3964194]] as [number, number][]) {
    const [x, y] = P(at);
    assert.ok(pierTopAt(piers, x, y, () => true, () => -1.77) !== undefined, `lamp at ${at} on a pier`);
  }
  assert.ok(ex.piers.some(p => p.id === 171610575), 'the Haparandasteiger is in the extract');
});
