import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import * as T from 'three';
import { buildFeatureChunk, ORIGIN, type Feature } from '../src/canalRecall/threeBuildingFeatures';
import { applyHostWallOpenings, cutHostWallOpening as cutPlain, HostOpeningValidationError, type HostWallGeometry, type ChunkHostOpeningConfig } from '../src/canalRecall/hostWallOpenings';
import type { Chunk, VertexRange } from '../src/canalRecall/threeBuildingMesh';
import { cutHostWallOpening as cutOracle } from './landmarks/host-opening-geometry';
import source from './landmarks/rasphuispoort-footprints.json';

const tilePath = 'public/data/extracts/amsterdam/building-tiles/14/8414/5384.geojson.gz';
const bytes = readFileSync(tilePath);
const tile: Feature[] = JSON.parse(gunzipSync(bytes).toString()).features;
const features = tile.filter(f => source.preserveIds.includes(String(f.properties.id)));
assert.equal(features.length, source.preserveIds.length);
const featureBytesBefore = JSON.stringify(features);
const host = features.find(f => f.properties.id === source.hostIdentity)!;
assert.deepEqual(host.geometry, source.installedHostFeature.geometry);
const east = (source.anchor[0] - ORIGIN.lng) * 111320 * Math.cos(ORIGIN.lat * Math.PI / 180);
const north = (source.anchor[1] - ORIGIN.lat) * 110540;
const local = ([lng, lat]: number[]): [number, number] => [
  (lng - ORIGIN.lng) * 111320 * Math.cos(ORIGIN.lat * Math.PI / 180) - east,
  north - (lat - ORIGIN.lat) * 110540,
];
const ring = (host.geometry as { coordinates: number[][][] }).coordinates[0];
assert.deepEqual(ring[18], [4.891085, 52.367753]);
assert.deepEqual(ring[19], [4.891027, 52.367733]);
const config: ChunkHostOpeningConfig = {
  hostIdentity: source.hostIdentity, enabled: true, additiveModelAvailable: true,
  anchorLngLat: source.anchor as [number, number], wallEdge: [local(ring[18]), local(ring[19])],
  authorAngleRadians: source.authorAngleRadians, halfWidth: 1.07, springHeight: 2.63,
  crownHeight: 3.70, portalDepth: .94, revealLayer: 0,
};
const keys = ['positions', 'uvs', 'layers', 'tints', 'accents', 'indices'] as const;
const hash = (a: ArrayBufferView) => createHash('sha256').update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)).digest('hex');
const fingerprint = (chunk: Chunk) => keys.map(k => hash(chunk[k]));
const rangeOf = (c: Chunk, id: string) => c.ranges.find(r => r.id === id)!;
function ownedIndices(c: Chunk, r: VertexRange) {
  const result: number[] = [];
  for (let i = 0; i < c.indices.length; i += 3) {
    const tri = Array.from(c.indices.slice(i, i + 3));
    const within = tri.map(v => v >= r.start && v < r.start + r.count);
    assert(within.every(Boolean) || within.every(v => !v), 'triangle never spans source owners');
    if (within[0]) result.push(...tri);
  }
  return result;
}
function signatures(c: Chunk, r: VertexRange) {
  const idx = ownedIndices(c, r), result: string[] = [];
  for (let i = 0; i < idx.length; i += 3) result.push(JSON.stringify(idx.slice(i, i + 3).map(v => [
    ...c.positions.slice(v * 3, v * 3 + 3), ...c.uvs.slice(v * 2, v * 2 + 2), c.layers[v],
    ...c.tints.slice(v * 4, v * 4 + 4), ...c.accents.slice(v * 4, v * 4 + 4),
  ])));
  return result;
}
function mesh(c: Chunk) {
  const pos = new Float32Array(c.positions.length);
  for (let i = 0; i < pos.length; i += 3) {
    pos[i] = c.positions[i] - east; pos[i + 1] = c.positions[i + 2]; pos[i + 2] = north - c.positions[i + 1];
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
  g.setIndex(new T.BufferAttribute(c.indices, 1));
  const m = new T.Mesh(g, new T.MeshBasicMaterial({ side: T.DoubleSide })); m.updateMatrixWorld(); return m;
}
const c = Math.cos(source.authorAngleRadians), s = Math.sin(source.authorAngleRadians);
const native = (x: number, y: number, z: number) => new T.Vector3(x*c+z*s, y, -x*s+z*c);
const hit = (m: T.Mesh, x: number, y: number, far = 5.5) => new T.Raycaster(native(x, y, 4), native(0, 0, -1), 0, far).intersectObject(m)[0];
function area(chunk: Chunk, ids: number[]) {
  let value = 0;
  for (let i = 0; i < ids.length; i += 3) {
    const p = ids.slice(i, i + 3).map(v => new T.Vector3(...Array.from(chunk.positions.slice(v * 3, v * 3 + 3)) as [number, number, number]));
    value += p[1].sub(p[0]).cross(p[2].sub(p[0])).length() / 2;
  }
  return value;
}
const records = [];
for (const mode of ['walls', 'coarse'] as const) {
  const before = buildFeatureChunk(features, 'photo', mode);
  const beforeHash = fingerprint(before);
  assert.equal(applyHostWallOpenings(before, ORIGIN, []), before);
  for (const disabled of [{ enabled: false }, { additiveModelAvailable: false }, { hostIdentity: 'wrong-source' }]) {
    const configs = [{ ...config, ...disabled }];
    assert.equal(applyHostWallOpenings(before, ORIGIN, configs), before);
    const fallback = buildFeatureChunk(features, 'photo', mode, undefined, [], [], configs);
    assert.deepEqual(fallback, before, `${mode} full fallback chunk byte-for-byte`);
    assert(hit(mesh(fallback), 0, 1.5));
  }
  const ordinaryHost = rangeOf(before, source.hostIdentity);
  const [edgeP, edgeQ] = config.wallEdge;
  const edgeDx = edgeQ[0]-edgeP[0], edgeDz = edgeQ[1]-edgeP[1], edgeLength = Math.hypot(edgeDx,edgeDz);
  const onInstalledPlane = (v: number) => {
    const x = before.positions[v*3]-east, z = north-before.positions[v*3+1];
    const along = ((x-edgeP[0])*edgeDx+(z-edgeP[1])*edgeDz)/edgeLength;
    return v >= ordinaryHost.start && v < ordinaryHost.start+ordinaryHost.count && along >= -.002 && along <= edgeLength+.002
      && Math.abs((x-edgeP[0])*edgeDz-(z-edgeP[1])*edgeDx)/edgeLength < .002;
  };
  const driftedSource = { ...before, positions: before.positions.slice() };
  for (let v=ordinaryHost.start;v<ordinaryHost.start+ordinaryHost.count;v++) if(onInstalledPlane(v)) driftedSource.positions[v*3] += .02;
  assert.equal(applyHostWallOpenings(driftedSource,ORIGIN,[config]),driftedSource,'changed installed source plane preserves its ordinary geometry');
  const remainingIndices: number[] = [];
  for(let i=0;i<before.indices.length;i+=3) {
    const tri=Array.from(before.indices.slice(i,i+3));
    if(!tri.every(onInstalledPlane)) remainingIndices.push(...tri);
  }
  const missingSource = { ...before, indices: Uint32Array.from(remainingIndices) };
  assert(missingSource.indices.length < before.indices.length, 'missing-plane fixture actually removes installed plane');
  assert.equal(applyHostWallOpenings(missingSource,ORIGIN,[config]),missingSource,'missing installed source plane preserves its ordinary geometry');
  // Reject drift and missing planes without remapping to any nearby wall. The
  // installed input is unchanged, including winding, indexed topology and attributes.
  const drifted = { ...config, wallEdge: config.wallEdge.map(([x,z]) => [x,z + .02]) } as ChunkHostOpeningConfig;
  const missingPlane = { ...config, wallEdge: config.wallEdge.map(([x,z]) => [x,z + 20]) } as ChunkHostOpeningConfig;
  const invalidConfigs = [drifted, missingPlane,
    { ...config, anchorLngLat: undefined }, { ...config, anchorLngLat: [NaN,0] },
    { ...config, anchorLngLat: new Array(2) }, { ...config, wallEdge: new Array(2) },
    { ...config, revealLayer: undefined }, { ...config, revealLayer: 256 },
    { ...config, wallEdge: undefined }, { ...config, halfWidth: -1 }, { ...config, archSegments: 2 },
  ] as unknown as ChunkHostOpeningConfig[];
  for (const rejected of invalidConfigs) {
    assert.equal(applyHostWallOpenings(before, ORIGIN, [rejected]), before, `${mode} rejected config returns original chunk`);
    assert.deepEqual(buildFeatureChunk(features, 'photo', mode, undefined, [], [], [rejected]), before, `${mode} rejected config preserves full ordinary group`);
  }
  assert.equal(applyHostWallOpenings(before, ORIGIN, [config, config]), before, 'duplicate host rejects ambiguity');
  assert.equal(applyHostWallOpenings(before, ORIGIN, [config, config, config]), before, 'third duplicate cannot reactivate host');
  // Two exact installed host geometries, with distinct explicit identities: a
  // rejected host must not prevent the other valid host from being cut.
  const otherHostId = `${source.hostIdentity}:fallback-regression`;
  // Translate the second fixture to avoid the mesh builder's legitimate shared-wall removal.
  const otherHost: Feature = { ...host, properties: { ...host.properties, id: otherHostId },
    geometry: { ...(host.geometry as object), coordinates: (host.geometry as { coordinates: number[][][] }).coordinates.map(r => r.map(([lng,lat]) => [lng + .001,lat])) } };
  const mixedBefore = buildFeatureChunk([...features, otherHost], 'photo', mode);
  const otherConfig = { ...config, hostIdentity: otherHostId, anchorLngLat: [config.anchorLngLat[0] + .001, config.anchorLngLat[1]] as [number,number] };
  for (const rejected of [...invalidConfigs.map(c => [c]), [config, config]]) {
    const mixed = applyHostWallOpenings(mixedBefore, ORIGIN, [...rejected, otherConfig]);
    assert.deepEqual(signatures(mixed, rangeOf(mixed, source.hostIdentity)), signatures(mixedBefore, rangeOf(mixedBefore, source.hostIdentity)), 'failed host triangle order/winding/attributes unchanged');
    for (const id of source.preserveIds) {
      const oldRange = rangeOf(mixedBefore,id), newRange = rangeOf(mixed,id);
      for (const [key,width] of [['positions',3],['uvs',2],['layers',1],['tints',4],['accents',4]] as const) {
        assert.deepEqual(mixed[key].slice(newRange.start*width,(newRange.start+newRange.count)*width), mixedBefore[key].slice(oldRange.start*width,(oldRange.start+oldRange.count)*width), `mixed fallback ${id} ${key}`);
      }
    }
    assert.notDeepEqual(signatures(mixed,rangeOf(mixed,otherHostId)), signatures(mixedBefore,rangeOf(mixedBefore,otherHostId)), 'valid other host still opens');
    const validOnly = applyHostWallOpenings(mixedBefore, ORIGIN, [otherConfig]);
    assert.deepEqual(signatures(mixed, rangeOf(mixed,otherHostId)), signatures(validOnly, rangeOf(validOnly,otherHostId)), 'successful cut unchanged by invalid other config');
  }
  const hostPositions = before.positions.slice(ordinaryHost.start*3,(ordinaryHost.start+ordinaryHost.count)*3);
  for (let i=0;i<hostPositions.length;i+=3) {
    const up=hostPositions[i+2]; hostPositions[i]-=east;
    hostPositions[i+2]=north-hostPositions[i+1]; hostPositions[i+1]=up;
  }
  const attrs: HostWallGeometry['attributes'] = {
    position:{array:hostPositions,itemSize:3},
    uv:{array:before.uvs.slice(ordinaryHost.start*2,(ordinaryHost.start+ordinaryHost.count)*2),itemSize:2},
    layer:{array:before.layers.slice(ordinaryHost.start,ordinaryHost.start+ordinaryHost.count),itemSize:1},
    tint:{array:before.tints.slice(ordinaryHost.start*4,(ordinaryHost.start+ordinaryHost.count)*4),itemSize:4,normalized:true},
    accent:{array:before.accents.slice(ordinaryHost.start*4,(ordinaryHost.start+ordinaryHost.count)*4),itemSize:4,normalized:true},
  };
  const sourceIndices = Uint32Array.from(ownedIndices(before,ordinaryHost),v=>v-ordinaryHost.start);
  const oracleGeometry = new T.BufferGeometry();
  for (const [name,a] of Object.entries(attrs)) oracleGeometry.setAttribute(name,new T.BufferAttribute(a.array,a.itemSize,a.normalized));
  oracleGeometry.setIndex(new T.BufferAttribute(sourceIndices,1));
  const oracle = cutOracle(oracleGeometry,source.hostIdentity,config);
  const plain = cutPlain({attributes:attrs,indices:sourceIndices},source.hostIdentity,config);
  assert.throws(() => cutPlain({attributes:attrs,indices:sourceIndices},source.hostIdentity,drifted), HostOpeningValidationError, 'strict core exposes typed source rejection');
  assert.throws(() => cutPlain({attributes:{},indices:sourceIndices},source.hostIdentity,config), /Native position attribute required/, 'programming errors remain strict');
  assert.equal(plain.selectedTriangles,oracle.selectedTriangles);
  assert(Math.abs(plain.removedArea-oracle.removedArea)<1e-9,'numeric area matches reviewed Three prototype');
  for(const [name,a] of Object.entries(plain.geometry.attributes)) {
    assert.deepEqual(a.array,oracle.geometry.getAttribute(name).array,`${name} typed clipping matches reviewed prototype`);
    assert.equal(Boolean(a.normalized),oracle.geometry.getAttribute(name).normalized);
  }
  assert.deepEqual(plain.reveals,oracle.reveals.map(g=>g.getAttribute('position').array),'bounded reveals match reviewed prototype');
  const after = buildFeatureChunk(features, 'photo', mode, undefined, [], [], [config]);
  assert.deepEqual(fingerprint(before), beforeHash, 'ordinary cached CPU chunk is unmutated');
  assert.equal(after.buildingCount, before.buildingCount);
  assert.equal(after.wallCount, before.wallCount);
  assert.equal(after.vertexCount, after.positions.length / 3);
  assert.equal(after.ranges.reduce((n, r) => n + r.count, 0), after.vertexCount);
  let next = 0;
  for (const r of after.ranges) { assert.equal(r.start, next); next += r.count; ownedIndices(after, r); }
  assert(after.indices.every(v => v < after.vertexCount));
  for (const id of source.preserveIds.filter(id => id !== source.hostIdentity)) {
    const a = rangeOf(before, id), b = rangeOf(after, id);
    assert.equal(a.count, b.count);
    for (const [key, width] of [['positions', 3], ['uvs', 2], ['layers', 1], ['tints', 4], ['accents', 4]] as const) {
      assert.deepEqual(after[key].slice(b.start*width, (b.start+b.count)*width), before[key].slice(a.start*width, (a.start+a.count)*width), `${id} ${key}`);
    }
    assert.deepEqual(signatures(after, b), signatures(before, a), 'neighbor topology/roof/wall attributes retained');
  }
  const a = rangeOf(before, source.hostIdentity), b = rangeOf(after, source.hostIdentity);
  const sourceTris = signatures(before, a), retained = new Set(signatures(after, b));
  const retainedSourceTriangles = sourceTris.filter(t => retained.has(t)).length;
  assert.equal(retainedSourceTriangles, sourceTris.length - 2, 'only two installed-edge triangles replaced; other host roofs/walls exact');
  const front = mesh(before), opened = mesh(after);
  for (const [x, y] of [[0,.05], [0,1.5], [-.7,2.5], [.7,2.5], [0,3.55]]) {
    assert(hit(front,x,y), 'ordinary selected frontage blocks'); assert(!hit(opened,x,y), 'active arch clears front boundary');
  }
  for (const [x,y] of [[-1.5,1.5], [1.5,1.5], [0,3.8], [0,15], [0,29]]) {
    const old = hit(front,x,y), now = hit(opened,x,y); assert(old && now);
    assert(Math.abs(old.distance-now.distance) < .002, 'upper/side facade stays in place');
  }
  assert(hit(opened,0,1.5,100), 'deeper unverified closure remains; full passage is not accepted');
  // Independent area conservation: exclude appended reveal vertices from wall/roof area.
  const revealVertices = ((config.archSegments ?? 32) + 2) * 6;
  const wallIndices = ownedIndices(after,b).filter(v => v < b.start + b.count - revealVertices);
  const removedArea = area(before,ownedIndices(before,a)) - area(after,wallIndices);
  assert(Math.abs(removedArea - 7.425602674476217) < .002, 'only bounded ground-connected arch area removed');
  const revealIndices = ownedIndices(after,b).filter(v => v >= b.start+b.count-revealVertices);
  assert.equal(revealIndices.length, revealVertices);
  for (let i=0; i<revealIndices.length; i+=3) {
    assert(!revealIndices.slice(i,i+3).every(v => Math.abs(after.positions[v*3+2]) < .001), 'no solid threshold');
  }
  records.push({ mode, selectedSourceTriangles: 2, retainedSourceTriangles, removedAreaSquareMetres: removedArea,
    neighborsByteExact: source.preserveIds.length-1, inputVertices: before.vertexCount, outputVertices: after.vertexCount,
    plainCoreMatchesReviewedPrototype:true, rangesOwned: true, cachedSourceUnmutated: true, fallbackByteExact: true,
    driftAndMissingPlaneFallback:true, invalidConfigFallback:true, duplicateConfigFallback:true, validOtherHostRetained:true });
}
assert.equal(JSON.stringify(features), featureBytesBefore, 'installed source features remain unchanged');
const extras = buildFeatureChunk(features,'photo','extras');
assert.deepEqual(fingerprint(buildFeatureChunk(features,'photo','extras',undefined,[],[],[config])),fingerprint(extras), 'extras unaffected');
console.log(JSON.stringify({status:'CPU CHUNK INTEGRATION PASSED; runtime availability/cache/GPU/live acceptance HELD', tileSha256:hash(bytes), meshBaselineSha256:hash(readFileSync('src/canalRecall/threeBuildingMesh.ts')),
  meshBaselineNote:'Clean release mesh implementation; includes only focused host-opening integration.', records,
  limitations:['Front-edge subtraction only; deeper closure remains.', 'Rasphuispoort spec explicitly configured; loaded-model/native visual review remains pending.', 'Facade relief/extras retained; visual overlap remains for game review.', 'GPU and performance checks pending; worker/cache acceptance checked by check-host-opening-availability.ts.']},null,2));
