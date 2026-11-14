import assert from 'node:assert/strict';
import test from 'node:test';
import { AWNING, awningSpan, signatureQuads, signatureWall, type SignatureWall } from './shopSignature.ts';

/** Walls of a ring the way threeBuildingMesh.ringEdges makes them: CCW, outward normal on the right of travel. */
function ring(pts: [number, number][]): SignatureWall[] {
  let area2 = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) area2 += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  const p = area2 > 0 ? pts : [...pts].reverse(), out: SignatureWall[] = [];
  for (let i = 0; i < p.length; i++) {
    const [x0, y0] = p[i], [x1, y1] = p[(i + 1) % p.length], len = Math.hypot(x1 - x0, y1 - y0);
    if (len > 1e-6) out.push({ x0, y0, x1, y1, len, nx: (y1 - y0) / len, ny: -(x1 - x0) / len, hole: false });
  }
  return out;
}
const along = (w: SignatureWall) => (w.x1 - w.x0) / w.len;

test('a square corner keeps the end inset, a 45 deg chamfer stops the awning its depth short', () => {
  const square = ring([[0, 0], [10, 0], [10, 8], [0, 8]]);
  const front = square.find(w => w.y0 === 0 && w.y1 === 0)!;
  assert.deepEqual(awningSpan(front, square).map(v => +v.toFixed(6)), [AWNING.endInsetM, 10 - AWNING.endInsetM]);
  // Chamfer the (10,0) corner by 2 m each way.
  const cut = ring([[0, 0], [8, 0], [10, 2], [10, 8], [0, 8]]);
  const cutFront = cut.find(w => w.y0 === 0 && w.y1 === 0 && w.len === 8)!;
  const [, end] = awningSpan(cutFront, cut);
  assert.ok(Math.abs(end - (8 - AWNING.depthM)) < 1e-9, `end ${end}`);
  assert.ok(along(cutFront) > 0);
});

test('a near-collinear neighbour is the same frontage; a concave corner keeps the inset', () => {
  const bend = ring([[0, 0], [10, 0], [20, 1.5], [20, 8], [0, 8]]);
  const first = bend.find(w => w.x0 === 0 && w.y0 === 0)!;
  assert.equal(+awningSpan(first, bend)[1].toFixed(6), 10 - AWNING.endInsetM);
  const ell = ring([[0, 0], [10, 0], [10, 5], [16, 5], [16, 12], [0, 12]]);
  const inner = ell.find(w => w.y0 === 5 && w.y1 === 5)!;
  const [s, e] = awningSpan(inner, ell);
  assert.ok(s >= AWNING.endInsetM - 1e-9 && e <= inner.len - AWNING.endInsetM + 1e-9, `${s} ${e}`);
});

test('the wall: a street wall before a nearer hidden one, never a chamfer under 2.5 m', () => {
  const walls = ring([[0, 0], [10, 0], [10, 8], [0, 8]]);
  const front = walls.find(w => w.y0 === 0 && w.y1 === 0)!, side = walls.find(w => w.x0 === 10 && w.x1 === 10)!;
  assert.equal(signatureWall(10.5, 4, [front], walls, walls), front);
  assert.equal(signatureWall(10.5, 4, [], walls, walls), side);
  const chamfered = ring([[0, 0], [8.5, 0], [10, 1.5], [10, 8], [0, 8]]);
  const pick = signatureWall(9.6, 0.4, [], chamfered, chamfered)!;
  assert.ok(pick.len >= 2.5);
});

// Named regression, feedback 7be6c55a: café Hendrix, Bilderdijkkade / De Clercqstraat, BAG pand 0363100012132271
// (building-tiles/14/8413/5384), OSM pub point 4.868583, 52.370738. The footprint has a 2.1 m chamfer at the corner and a
// 0.13 m jog after it; the old slab stood 0.4 m in from the Bilderdijkkade wall's end and poked past the chamfer: the
// "bare beige rod sticking out past the corner".
const HENDRIX: [number, number][] = [[4.868616, 52.3708], [4.86852, 52.370778], [4.868584, 52.370681], [4.868612, 52.370673], [4.868613, 52.370674], [4.868681, 52.37069]];
const HENDRIX_AT: [number, number] = [4.868583, 52.370738];

test('Hendrix (pand 0363100012132271): the awning hangs on the Bilderdijkkade wall and stops short of the chamfer', () => {
  const lat0 = HENDRIX[0][1], lng0 = HENDRIX[0][0], kx = 111_320 * Math.cos(lat0 * Math.PI / 180), ky = 111_320;
  const local = ([lng, lat]: [number, number]): [number, number] => [(lng - lng0) * kx, (lat - lat0) * ky];
  const walls = ring(HENDRIX.map(local)), [px, py] = local(HENDRIX_AT);
  const wall = signatureWall(px, py, walls, walls, walls)!;
  // Bilderdijkkade: the ~11.7 m wall running NNW-SSE (the canal side), not the 2.1 m chamfer or the 4.9 m side street.
  assert.ok(wall.len > 10 && wall.len < 13, `len ${wall.len}`);
  const chamfer = walls.find(w => w.len > 1.5 && w.len < 2.5)!;
  assert.ok(chamfer, 'the chamfer is in the ring');
  const quads = signatureQuads(px, py, wall, walls, 0, 3.4, '#d6c7a1');
  assert.ok(quads.length > 12, 'awning and blade sign');
  // No awning or sign vertex stands proud of the chamfer face or the side-street wall.
  for (const w of walls.filter(w => w !== wall && w.len >= 0.5)) {
    for (const { q } of quads) for (const [x, y] of q) {
      const out = (x - w.x0) * w.nx + (y - w.y0) * w.ny, alongW = ((x - w.x0) * (w.x1 - w.x0) + (y - w.y0) * (w.y1 - w.y0)) / w.len;
      if (alongW > -0.05 && alongW < w.len + 0.05) assert.ok(out <= 1e-6, `vertex ${out.toFixed(3)} m in front of a ${w.len.toFixed(1)} m wall`);
    }
  }
  // The canvas slopes: its front edge hangs lower than its head, and the valance clears 2.2 m.
  const zs = quads.slice(0, 6).flatMap(({ q }) => q.map(p => p[2]));
  assert.ok(Math.max(...zs) - Math.min(...zs) > AWNING.dropM, 'sloped, with a valance');
  assert.ok(Math.min(...zs) >= 2.2, `head room ${Math.min(...zs)}`);
});
