import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import * as T from 'three';
import { buildFeatureChunk, ORIGIN, type Feature } from '../src/canalRecall/threeBuildingFeatures';
import { cutHostWallOpening, type HostOpeningConfig } from './landmarks/host-opening-geometry';
import source from './landmarks/rasphuispoort-footprints.json';

const tilePath = 'public/data/extracts/amsterdam/building-tiles/14/8414/5384.geojson.gz';
const tileBytes = readFileSync(tilePath);
const features = (JSON.parse(gunzipSync(tileBytes).toString()) as { features: Feature[] }).features;
const installed = features.find(f => f.properties.id === source.hostIdentity)!;
assert(installed, 'exact installed host must exist');
assert.deepEqual(installed.geometry, source.installedHostFeature.geometry, 'installed outline still matches recorded evidence');
assert.equal(installed.properties.height, 29.36);
const offsetEast = (source.anchor[0] - ORIGIN.lng) * 111320 * Math.cos(ORIGIN.lat * Math.PI / 180);
const offsetNorth = (source.anchor[1] - ORIGIN.lat) * 110540;
const local = ([lng, lat]: number[]): [number, number] => [
  (lng - ORIGIN.lng) * 111320 * Math.cos(ORIGIN.lat * Math.PI / 180) - offsetEast,
  -(lat - ORIGIN.lat) * 110540 + offsetNorth,
];
// Exact installed edge indexes, not current BAG coordinates or nearest search.
const ring = (installed.geometry as { coordinates: number[][][] }).coordinates[0];
assert.deepEqual(ring[18], [4.891085, 52.367753]);
assert.deepEqual(ring[19], [4.891027, 52.367733]);
const config: HostOpeningConfig = {
  hostIdentity: source.hostIdentity, enabled: true, additiveModelAvailable: true,
  wallEdge: [local(ring[18]), local(ring[19])], authorAngleRadians: source.authorAngleRadians,
  halfWidth: 1.07, springHeight: 2.63, crownHeight: 3.70, portalDepth: .94,
};
const angle = source.authorAngleRadians, c = Math.cos(angle), s = Math.sin(angle);
const native = (x: number, y: number, z: number) => new T.Vector3(x * c + z * s, y, -x * s + z * c);
function installedGeometry(feature: Feature, mode: 'walls' | 'coarse' = 'walls') {
  const chunk = buildFeatureChunk([feature], 'photo', mode);
  const positions = new Float32Array(chunk.positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = chunk.positions[i] - offsetEast;
    positions[i + 1] = chunk.positions[i + 2];
    positions[i + 2] = -chunk.positions[i + 1] + offsetNorth;
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(positions, 3));
  g.setAttribute('uv', new T.BufferAttribute(chunk.uvs, 2));
  g.setAttribute('layer', new T.BufferAttribute(chunk.layers, 1));
  g.setAttribute('tint', new T.BufferAttribute(chunk.tints, 4, true));
  g.setAttribute('accent', new T.BufferAttribute(chunk.accents, 4, true));
  g.setIndex(new T.BufferAttribute(chunk.indices, 1));
  return g;
}
const material = new T.MeshBasicMaterial({ side: T.DoubleSide });
const mesh = (g: T.BufferGeometry) => { const m = new T.Mesh(g, material); m.updateMatrixWorld(); return m; };
const hit = (objects: T.Mesh[], x: number, y: number, z = 4, far = 5.5) =>
  new T.Raycaster(native(x, y, z), native(0, 0, -1).normalize(), 0, far).intersectObjects(objects)[0];
const results: Record<string, unknown>[] = [];
for (const mode of ['walls', 'coarse'] as const) {
  const original = installedGeometry(installed, mode), before = mesh(original);
  const bytes = createHash('sha256').update(Buffer.from(original.getAttribute('position').array.buffer)).digest('hex');
  const result = cutHostWallOpening(original, source.hostIdentity, config);
  const after = [mesh(result.geometry), ...result.reveals.map(mesh)];
  assert(result.active);
  // Probe the front boundary only. A later host wall remains a known blocker.
  for (const x of [-.9, -.7, 0, .7, .9]) for (const y of [.05, 1.5, 2.5, 3.1]) {
    if (y > 2.63 + 1.07 * Math.sqrt(1 - (x / 1.07) ** 2) - .03) continue;
    assert(hit([before], x, y), `installed ${mode} blocks ${x},${y} before`);
    assert(!hit(after, x, y), `bounded front ${mode} clears ${x},${y} after`);
  }
  for (const [x, y] of [[-1.5, 1.5], [1.5, 1.5], [0, 3.8], [0, 15], [0, 29]]) {
    const prior = hit([before], x, y), next = hit(after, x, y);
    assert(prior && next, `off-opening/upper ${mode} wall retained ${x},${y}`);
    assert(Math.abs(prior.distance - next.distance) < .002);
  }
  original.computeBoundingBox(); result.geometry.computeBoundingBox();
  assert(result.geometry.boundingBox!.equals(original.boundingBox!), 'whole host extents retained');
  assert(Math.abs(result.geometry.boundingBox!.max.y - 29.36) < .001);
  for (const variant of [{ enabled: false }, { additiveModelAvailable: false }]) {
    const fallback = cutHostWallOpening(original, source.hostIdentity, { ...config, ...variant });
    assert.equal(fallback.geometry, original); assert.equal(fallback.reveals.length, 0); assert(!fallback.active);
    assert(hit([mesh(fallback.geometry)], 0, 1.5), 'unavailable/disabled full ordinary fallback blocks again');
  }
  assert.equal(createHash('sha256').update(Buffer.from(original.getAttribute('position').array.buffer)).digest('hex'), bytes, 'original cached input is unmutated');
  // Non-selected source triangles survive byte-for-byte with every texture attribute.
  const flat = original.toNonIndexed();
  const attributes = Object.keys(flat.attributes);
  const signature = (g: T.BufferGeometry, i: number) => JSON.stringify(attributes.map(name => {
    const a = g.getAttribute(name); return Array.from({ length: 3 * a.itemSize }, (_, j) => a.array[i * a.itemSize + j]);
  }));
  const retained = new Set(Array.from({ length: result.geometry.getAttribute('position').count / 3 }, (_, i) => signature(result.geometry, i * 3)));
  let retainedSourceTriangles = 0;
  for (let i = 0; i < flat.getAttribute('position').count; i += 3) if (retained.has(signature(flat, i))) retainedSourceTriangles++;
  assert(retainedSourceTriangles >= flat.getAttribute('position').count / 3 - result.selectedTriangles);
  assert.deepEqual(Object.keys(result.geometry.attributes), attributes);
  // Every reveal has exact .94m depth and no ground threshold. Normals face opening.
  for (const g of result.reveals) {
    const pos = g.getAttribute('position'), normals = g.getAttribute('normal');
    for (let i = 0; i < pos.count; i += 3) {
      const y = [0, 1, 2].map(j => pos.getY(i + j));
      assert(!y.every(value => Math.abs(value) < .001), 'no threshold');
      assert(Math.max(...y) <= 3.7001, 'no invented interior ceiling above arch');
      const point = new T.Vector3().fromBufferAttribute(pos, i);
      const n = new T.Vector3().fromBufferAttribute(normals, i);
      const target = native(0, Math.min(point.y, 2.63), 0).sub(point);
      assert(n.dot(target) > -.002, 'reveal faces clear opening');
    }
    for (let i = 0; i < pos.count; i += 6) {
      const front = new T.Vector3().fromBufferAttribute(pos, i), back = new T.Vector3().fromBufferAttribute(pos, i + 2);
      assert(Math.abs(front.distanceTo(back) - .94) < .001);
    }
  }
  const centerFront = hit([before], 0, 1.5)!.point;
  const withinDepth = centerFront.clone().addScaledVector(native(0, 0, -1), .47);
  for (const [direction, role] of [[native(1, 0, 0), 'right jamb'], [native(-1, 0, 0), 'left jamb'], [native(0, 1, 0), 'arch soffit']] as const) {
    const revealHit = new T.Raycaster(withinDepth, direction, 0, 3).intersectObjects(result.reveals.map(mesh))[0];
    assert(revealHit, `${mode} ${role} bounds only verified portal depth`);
  }
  assert(!new T.Raycaster(withinDepth, native(0, -1, 0), 0, 2).intersectObjects(result.reveals.map(mesh))[0], 'no reveal threshold below opening');
  const deeper = hit(after, 0, 1.5, 4, 100);
  assert(deeper, 'deeper unverified host closure is preserved, not carved away');
  results.push({ mode, inputTriangles: flat.getAttribute('position').count / 3, outputTriangles: result.geometry.getAttribute('position').count / 3,
    selectedTriangles: result.selectedTriangles, retainedSourceTriangles, removedAreaSquareMetres: result.removedArea,
    beforeFrontDistance: hit([before], 0, 1.5)!.distance, afterFrontClear: true, deeperFirstHitDistance: deeper.distance,
    preservedHeight: result.geometry.boundingBox!.max.y, originalPositionSha256: bytes });
}
const neighborResults = source.preserveIds.filter(id => id !== source.hostIdentity).map(id => {
  const feature = features.find(f => f.properties.id === id)!;
  assert(feature, `installed neighbor ${id}`);
  const original = installedGeometry(feature), result = cutHostWallOpening(original, id, config);
  assert.equal(result.geometry, original); assert(!result.active);
  // A real neighbor facade ray from its edge midpoint toward its own wall.
  const edge = (feature.geometry as { coordinates: number[][][] }).coordinates[0].slice(0, 2).map(local);
  const tangent = new T.Vector3(edge[1][0] - edge[0][0], 0, edge[1][1] - edge[0][1]).normalize();
  const normal = new T.Vector3(-tangent.z, 0, tangent.x);
  const midpoint = new T.Vector3((edge[0][0] + edge[1][0]) / 2, 1, (edge[0][1] + edge[1][1]) / 2);
  const ray = new T.Raycaster(midpoint.clone().addScaledVector(normal, 1), normal.clone().negate(), 0, 2);
  assert(ray.intersectObject(mesh(result.geometry))[0], `neighbor wall remains ray-visible ${id}`);
  return { id, geometryUnchanged: true, wallRayRetained: true };
});
const record = {
  status: 'CPU CAPABILITY DRAFT; runtime/gallery/live acceptance HELD', sourceCommit: '9926aa1',
  tilePath, tileSha256: createHash('sha256').update(tileBytes).digest('hex'), config, results, neighbors: neighborResults,
  limitations: ['Front boundary only: deeper first-hit wall remains, so a full passage sightline is not accepted.',
    'No renderer/worker/cache/LOD integration; current released GPU attributes require pre-upload or source rebuild application.',
    'Runtime coordinates use actual 110540 latitude projection; attachment differs from 111320 source-check projection and needs gallery/native game review.',
    'Portal vertical/depth dimensions remain photo estimates. No 15m passage cut, floor/roof removal or invented interior ceiling.',
    'Browser/game/GPU/performance and independent reference comparison remain pending.'],
};
mkdirSync('artifacts/landmarks/rasphuispoort/host-opening', { recursive: true });
writeFileSync('artifacts/landmarks/rasphuispoort/host-opening/cpu-check.json', `${JSON.stringify(record, null, 2)}\n`);
console.log(JSON.stringify(record));
