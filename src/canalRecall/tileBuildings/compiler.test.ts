import assert from 'node:assert/strict';
import test from 'node:test';
import {apply, det3, mergeBuckets, mul, partHash, rotationY, soupHash, splitRoles, toCanonical, transformBuckets, translation, triangles, type BucketMap} from './soup.ts';
import {decomposeTRS, writeBucketUnit, writeMeshTile} from './writeTile.ts';
import {bucketTris, compareTriangles, decodeMeshTile, decodeUnit} from './readTile.ts';
import {mercatorFromModel, rotationForBearing, surveyedSpec, tileFromMercator, tileFromModel} from './placement.ts';
import {mercatorOf, metreUnitsAt, tileFrame, tileOf, toFrame} from './tiles.ts';
import type {MeshTileMeta} from './schema.ts';

/** A box house in the chunk frame: x along the street from x0, z towards the street (front at z = 0), with a shopfront band. */
function house(x0: number, width = 6, eaves = 14): BucketMap {
  const b: BucketMap = new Map();
  const quad = (key: string, slot: string, surface: string, p: number[][], n: number[]) => {
    let x = b.get(key);
    if (!x) b.set(key, x = {key, slot, tint: '#' + key.split('_')[0], surface, positions: [], normals: [], uvs: []});
    for (const tri of [[0, 1, 2], [0, 2, 3]]) for (const i of tri) { x.positions.push(...p[i]); x.normals.push(...n); x.uvs.push(p[i][0], p[i][1]); }
  };
  const x1 = x0 + width;
  quad('8a4a3a_brick', 'brick', 'wall', [[x0, 4, 0], [x1, 4, 0], [x1, eaves, 0], [x0, eaves, 0]], [0, 0, 1]);           // body front
  quad('2a3a42_door', 'door', 'shop', [[x0, 0, 0.05], [x1, 0, 0.05], [x1, 4, 0.05], [x0, 4, 0.05]], [0, 0, 1]);        // shopfront
  quad('cfc8b8_stone', 'stone', 'stone', [[x0, eaves, 0.1], [x1, eaves, 0.1], [x1, eaves + 1, 0.1], [x0, eaves + 1, 0.1]], [0, 0, 1]); // cornice
  quad('8a4a3a_brick', 'brick', 'wall', [[x1, 0, -10], [x0, 0, -10], [x0, eaves, -10], [x1, eaves, -10]], [0, 0, -1]); // rear
  quad('8a4a3a_brick', 'brick', 'wall', [[x0, 0, -10], [x0, 0, 0], [x0, eaves, 0], [x0, eaves, -10]], [-1, 0, 0]);     // party
  quad('555b66_slate', 'slate', 'roof', [[x0, eaves, 0], [x1, eaves, 0], [x1, eaves, -10], [x0, eaves, -10]], [0, 1, 0]); // roof
  return b;
}

test('split: shopfront is ground, cornice crown, front wall body; rear, party, roof never instance', () => {
  const roles = splitRoles(house(0), {groundTopM: 4, eavesM: 14});
  assert.deepEqual([...roles.keys()].sort(), ['body', 'crown', 'ground', 'party', 'rear', 'roof']);
  assert.equal(triangles(roles.get('ground')!), 2);
  assert.equal([...roles.get('roof')!.values()][0].slot, 'slate');
});

test('content hash: identical parts at different positions share a hash; a 2 cm wider one does not', () => {
  const a = splitRoles(house(0), {groundTopM: 4, eavesM: 14}), b = splitRoles(house(6.37), {groundTopM: 4, eavesM: 14}), c = splitRoles(house(12, 6.02), {groundTopM: 4, eavesM: 14});
  for (const role of ['ground', 'body', 'crown'] as const) {
    assert.equal(partHash(a.get(role)!).hash, partHash(b.get(role)!).hash, role);
    assert.notEqual(partHash(a.get(role)!).hash, partHash(c.get(role)!).hash, role);
  }
  const {origin} = partHash(b.get('body')!);
  assert.deepEqual(origin.map(v => +v.toFixed(3)), [6.37, 0, 0]);
  assert.notEqual(soupHash(house(0)), soupHash(house(0.002)), 'the pand hash sees a 2 mm move');
});

test('transforms: rotations keep normals unit and outward; a mirror flips the winding back', () => {
  const b = house(0), r = transformBuckets(b, mul(translation(10, 0, 5), rotationY(0.7)));
  const x = [...r.values()][0];
  assert.ok(Math.abs(Math.hypot(x.normals[0], x.normals[1], x.normals[2]) - 1) < 1e-9);
  const m = transformBuckets(b, [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), front = [...m.values()][0];
  const p = front.positions, e1 = [p[3] - p[0], p[4] - p[1], p[5] - p[2]], e2 = [p[6] - p[0], p[7] - p[1], p[8] - p[2]];
  const nz = e1[0] * e2[1] - e1[1] * e2[0];
  assert.ok(nz > 0 && front.normals[2] > 0.99, 'front still faces +z after mirroring in x');
});

test('TRS decomposition recomposes; shear is refused', () => {
  const m = mul(mul(translation(3, 1, -2), rotationY(1.1)), [1.05, 0, 0, 0, 0, 0.98, 0, 0, 0, 0, 1.01, 0, 0, 0, 0, 1]);
  const {t, r, s} = decomposeTRS(m);
  const [x, y, z, w] = r, rot = [1 - 2 * (y * y + z * z), 2 * (x * y + w * z), 2 * (x * z - w * y), 0, 2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x), 0, 2 * (x * z + w * y), 2 * (y * z - w * x), 1 - 2 * (x * x + y * y), 0, 0, 0, 0, 1];
  const back = mul(mul(translation(...t), rot), [s[0], 0, 0, 0, 0, s[1], 0, 0, 0, 0, s[2], 0, 0, 0, 0, 1]);
  back.forEach((v, i) => assert.ok(Math.abs(v - m[i]) < 1e-9, `element ${i}`));
  const mirrored = decomposeTRS([-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  assert.equal(mirrored.s[0], -1);
  assert.throws(() => decomposeTRS([1, 0, 0, 0, 0.3, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), /shear/);
});

test('placement: a surveyed model at north offset 0 keeps glTF +X east and stands on y = 0; tile frame agrees with toFrame', () => {
  const anchor: [number, number] = [4.8712833, 52.3681674], frame = tileFrame(tileOf(...anchor, 16));
  const m = tileFromModel(surveyedSpec('x', anchor, 0), {min: [-3, 2, -3], max: [3, 10, 3]}, frame);
  const [e, s] = toFrame(frame, ...anchor), o = apply(m, 0, 2, 0), east = apply(m, 1, 2, 0), up = apply(m, 0, 3, 0);
  assert.ok(Math.abs(o[0] - e) < 1e-6 && Math.abs(o[2] - s) < 1e-6 && Math.abs(o[1]) < 1e-9, `origin ${o} vs ${e},${s}`);
  assert.ok(Math.abs(east[0] - o[0] - 1) < 1e-3 && Math.abs(east[2] - o[2]) < 1e-6, 'glTF +X is east');
  assert.ok(Math.abs(up[1] - o[1] - 1) < 1e-3, '+Y is up');
  assert.ok(det3(m) > 0, 'Mercator handedness cancels: the model is not mirrored');
  // Bearing 90 (north offset 0) is no turn; the landmark loader's complement rule.
  assert.equal(rotationForBearing(90), 0);
  const merc = mercatorFromModel(surveyedSpec('x', anchor, 0), {min: [0, 0, 0], max: [1, 1, 1]}), [mx, my] = mercatorOf(...anchor);
  assert.ok(Math.abs(merc[12] - mx) < 1e-15 && Math.abs(merc[13] - my) < 1e-15);
  assert.ok(Math.abs(apply(tileFromMercator(frame), mx + metreUnitsAt(frame.anchor[1]), my, 0)[0] - e - 1) < 1e-3);
});

test('writer round trip: two identical bodies become one unit with two instances; the decoded pands equal the source', async () => {
  const frame = tileFrame(tileOf(4.8712833, 52.3681674, 16)), toTile = mul(translation(20, 0, -15), rotationY(0.4));
  const houses = [house(0), house(6.37)].map(h => splitRoles(h, {groundTopM: 4, eavesM: 14}));
  const body = houses.map(h => partHash(h.get('body')!));
  assert.equal(body[0].hash, body[1].hash);
  const unit = await writeBucketUnit('ptest', toCanonical(houses[0].get('body')!, body[0].origin));
  const uniques = houses.map((h, pand) => ({pand, buckets: transformBuckets(mergeBuckets(...[...h].filter(([role]) => role !== 'body').map(([, b]) => b)), toTile)}));
  const meta: MeshTileMeta = {version: 1, tile: [16, frame.tile.x, frame.tile.y], anchor: frame.anchor, pands: ['0363100012000001', '0363100012000002'], covers: [['NL.IMBAG.Pand.0363100012000001'], ['NL.IMBAG.Pand.0363100012000002']], specs: [], units: [{hash: 'ptest', triangles: unit.triangles}], names: ['a', 'b']};
  const written = await writeMeshTile(meta, uniques, [{hash: 'ptest', bounds: unit.bounds, items: body.map((b, pand) => ({matrix: mul(toTile, translation(...b.origin)), pand}))}]);
  const decoded = await decodeMeshTile(written.bytes, async () => unit.bytes);
  assert.deepEqual(decoded.meta.pands, meta.pands);
  assert.equal(decoded.drawPrimitives, 2, 'one merged draw + one instanced unit');
  for (const [pand, h] of houses.entries()) {
    const source = bucketTris(transformBuckets(mergeBuckets(...h.values()), toTile));
    const cmp = compareTriangles(source, decoded.pands[pand]);
    assert.ok(cmp.pass, JSON.stringify(cmp));
  }
  assert.equal((await decodeUnit(unit.bytes)).length, 2, "the body is the front wall quad");
  // The gate notices a pand that lost a triangle or drew one in the wrong place.
  const broken = decoded.pands[0].slice(1);
  assert.equal(compareTriangles(bucketTris(transformBuckets(mergeBuckets(...houses[0].values()), toTile)), broken).pass, false);
  const moved = decoded.pands[1].map(t => ({...t, p: t.p.map((v, i) => (i % 3 === 0 ? v + 0.01 : v))}));
  assert.equal(compareTriangles(bucketTris(transformBuckets(mergeBuckets(...houses[1].values()), toTile)), moved).pass, false);
});
