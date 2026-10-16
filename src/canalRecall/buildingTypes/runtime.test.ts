import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import * as THREE from 'three';
import {areaAnchor, createBuildingTypes, farMassing, mergedShaders, mergeParts, instanceMatrix, mercator, metreUnits, offsetMetres, pandOsmId, partitionByDistance, suppressionIds, yawOf, type RuntimeInstance} from './runtime.ts';

const inst = (over: Partial<RuntimeInstance> = {}): RuntimeInstance => ({pand: '0363100012061842', unit: 'u', anchor: [4.8, 52.364], northOffsetDegrees: 0, scale: [1, 1, 1], variant: 'v', groundAltitudeMetres: 0, ...over});
const apply = (m: number[], p: number[]) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
const bearingOf = (dx: number, dz: number) => (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
const angleDiff = (a: number, b: number) => Math.abs(((a - b) % 360 + 540) % 360 - 180);

test('offsetMetres: east is +x, south is +z, in true metres at the anchor latitude', () => {
  const o: [number, number] = [4.8, 52.364];
  const [e, s] = offsetMetres(o, [4.8 + 0.001, 52.364]);
  assert.ok(Math.abs(e - 0.001 * 111319.49 * Math.cos(52.364 * Math.PI / 180)) < 0.05, `east ${e}`);
  assert.ok(Math.abs(s) < 1e-6);
  const [e2, s2] = offsetMetres(o, [4.8, 52.364 + 0.001]);
  assert.ok(Math.abs(e2) < 1e-6 && s2 < 0 && Math.abs(s2 + 111.3) < 0.5, `north is -z: ${s2}`);
  assert.ok(Math.abs(mercator(4.8 + 1e-4, 52.364)[0] - mercator(4.8, 52.364)[0] - 1e-4 / 360) < 1e-12);
  assert.ok(metreUnits(52.364) > metreUnits(0));
});

test('instance matrix: front +z points at bearing 180 + northOffset, tangent at 90 + northOffset; scale and ground apply', () => {
  const origin: [number, number] = [4.8, 52.364];
  for (const north of [0, 72, 90, 180, 252, 300]) {
    const m = instanceMatrix(inst({northOffsetDegrees: north}), origin), at = apply(m, [0, 0, 0]), front = apply(m, [0, 0, 1]), tangent = apply(m, [1, 0, 0]);
    assert.ok(angleDiff(bearingOf(front[0] - at[0], front[2] - at[2]), 180 + north) < 1e-6, `front, north ${north}`);
    assert.ok(angleDiff(bearingOf(tangent[0] - at[0], tangent[2] - at[2]), 90 + north) < 1e-6, `tangent, north ${north}`);
  }
  assert.ok(Math.abs(yawOf(0)) < 1e-12, 'northOffset 0: front south, no yaw');
  const m = instanceMatrix(inst({scale: [2, 3, 0.5], groundAltitudeMetres: 1.5}), [4.8, 52.364]);
  assert.deepEqual(apply(m, [1, 1, 1]).map(v => +v.toFixed(6)), [2, 4.5, 0.5]);
});

test('placement of two instances keeps their real distance and direction', () => {
  const a = inst({anchor: [4.8, 52.364]}), b = inst({anchor: [4.8012, 52.3651]});
  const origin = areaAnchor([a, b]), ma = instanceMatrix(a, origin), mb = instanceMatrix(b, origin);
  const dx = mb[12] - ma[12], dz = mb[14] - ma[14];
  assert.ok(Math.abs(dx - 0.0012 * 111319.49 * Math.cos(52.3645 * Math.PI / 180)) < 0.2 && Math.abs(-dz - 0.0011 * 111319.49) < 0.4, `${dx} ${dz}`);
  assert.ok(Math.abs(ma[12] + mb[12]) < 1 && Math.abs(ma[14] + mb[14]) < 1, 'centred on the area anchor');
});

test('suppression set: unique BAG pand ids in the OSM id form', () => {
  const list = [inst({pand: '0363100012000002'}), inst({pand: '0363100012000001'}), inst({pand: '0363100012000002'})];
  assert.deepEqual(suppressionIds(list), [pandOsmId('0363100012000001'), pandOsmId('0363100012000002')]);
  assert.equal(pandOsmId('0363100012061842'), 'NL.IMBAG.Pand.0363100012061842');
  assert.deepEqual(suppressionIds([]), []);
});

test('suppression set: an instance also suppresses the panden its model absorbs (split-off end bay / entrance of the same slab)', () => {
  const list = [inst({pand: '0363100012095578', alsoSuppress: ['0363100012196327']}), inst({pand: '0363100012063809', alsoSuppress: ['0363100012201815']})];
  assert.deepEqual(suppressionIds(list), ['0363100012063809', '0363100012095578', '0363100012196327', '0363100012201815'].map(pandOsmId));
});

test('published instances.json: every unit has a GLB, ids unique, scales sane, suppression covers every instance', () => {
  const dir = path.join(import.meta.dirname, '../../../public/canal-drive/building-types');
  const list = JSON.parse(fs.readFileSync(path.join(dir, 'instances.json'), 'utf8')) as RuntimeInstance[];
  assert.ok(list.length >= 30);
  assert.equal(new Set(list.map(i => i.pand)).size, list.length);
  for (const i of list) {
    assert.ok(fs.existsSync(path.join(dir, `${i.unit}.glb`)), i.unit);
    assert.ok(i.scale.every(s => s > 0.85 && s < 1.2), `${i.pand} ${i.scale}`);
    assert.equal(i.groundAltitudeMetres, 0);
  }
  assert.equal(suppressionIds(list).length, list.length);
});

test('far massing: outward winding, roof only when pitched', () => {
  const pitched = farMassing({L0: 14.4, W0: 10.5, E0: 14.6, R0: 17.8}), flat = farMassing({L0: 15.7, W0: 9.9, E0: 16.1});
  assert.equal(pitched.walls.index.length / 3, 10, 'four wall quads + two gable triangles');
  assert.equal(pitched.roof.index.length / 3, 4);
  assert.equal(flat.roof.index.length / 3, 2);
  for (const m of [pitched.walls, pitched.roof, flat.roof, flat.walls]) {
    for (let t = 0; t < m.index.length; t += 3) {
      const [a, b, c] = [0, 1, 2].map(k => m.index[t + k] * 3), P = (o: number) => m.positions.slice(o, o + 3);
      const [pa, pb, pc] = [P(a), P(b), P(c)], u = pb.map((v, i) => v - pa[i]), w = pc.map((v, i) => v - pa[i]);
      const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], nn = m.normals.slice(a, a + 3);
      assert.ok(n[0] * nn[0] + n[1] * nn[1] + n[2] * nn[2] > 0, 'winding agrees with the normal');
    }
  }
  assert.equal(Math.max(...pitched.roof.positions.filter((_, i) => i % 3 === 1)), 17.8);
});

test('near/far partition: thresholds, cull and hysteresis', () => {
  const pts = [0, 100, 139, 141, 300, 699, 701, 5000].map(x => ({x, z: 0}));
  const first = partitionByDistance(pts, {x: 0, z: 0}, 140, 700);
  assert.deepEqual(first.near, [0, 1, 2]);
  assert.deepEqual(first.far, [3, 4, 5]);
  assert.equal(first.culled, 2);
  const moved = [{x: 150, z: 0}, {x: 150, z: 0}];
  const second = partitionByDistance(moved, {x: 0, z: 0}, 140, 700, {near: [0], far: [1], culled: 0});
  assert.deepEqual(second.near, [0]);
  assert.deepEqual(second.far, [1]);
  assert.deepEqual(partitionByDistance(moved, {x: 0, z: 0}, 140, 700).near, []);
});

const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const tri = {positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1], uvs: [0, 0, 1, 0, 0, 1]};

test('mergeParts: bakes matrix, scales UVs, carries sampler + tint, offsets indices', () => {
  const m = mergeParts([
    {...tri, index: [0, 1, 2], matrix: I4, uvScale: 0.5, texture: 2, tint: [0.1, 0.2, 0.3]},
    {...tri, matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 6, 7, 1], uvScale: 1, texture: 0, tint: [1, 1, 1]},
  ]);
  assert.deepEqual([...m.index], [0, 1, 2, 3, 4, 5]);
  assert.deepEqual([...m.positions.slice(9, 12)], [5, 6, 7]);
  assert.deepEqual([...m.uvs.slice(0, 4)], [0, 0, 0.5, 0]);
  assert.deepEqual([...m.textures], [2, 2, 2, 0, 0, 0]);
  assert.ok(Math.abs(m.tints[1] - 0.2) < 1e-6 && m.tints[10] === 1);
  assert.deepEqual([...m.normals.slice(0, 3)], [0, 0, 1]);
});

test('mergeParts: rotation turns normals, a mirroring matrix flips winding and keeps normals outward', () => {
  const rot = [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1]; // 90 degrees about y: +z -> +x
  const r = mergeParts([{...tri, index: [0, 1, 2], matrix: rot, uvScale: 1, texture: 0, tint: [1, 1, 1]}]);
  assert.ok(Math.abs(r.normals[0] - 1) < 1e-6 && Math.abs(r.normals[2]) < 1e-6);
  const mirror = [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const f = mergeParts([{...tri, index: [0, 1, 2], matrix: mirror, uvScale: 1, texture: 0, tint: [1, 1, 1]}]);
  assert.deepEqual([...f.index], [0, 2, 1]);
  assert.deepEqual([...f.normals.slice(0, 3)].map(Math.abs), [0, 0, 1]);
});

test('mergedShaders: one sampler uniform and one branch per texture, per-instance matrix in both transforms', () => {
  const {vertexShader, fragmentShader} = mergedShaders(3);
  assert.equal((fragmentShader.match(/uniform sampler2D/g) ?? []).length, 3);
  assert.ok(fragmentShader.includes('vTex < 0.5') && fragmentShader.includes('vTex < 1.5') && !fragmentShader.includes('vTex < 2.5'));
  assert.ok(vertexShader.includes('modelMatrix * instanceMatrix') && vertexShader.includes('modelViewMatrix * instanceMatrix'));
});

test('createBuildingTypes: a unit with several recipe materials is one draw near and one far; shared look across units', async () => {
  const enu = {value: new THREE.Matrix3()}, tex = ['brick', 'roof', 'glass'].map(() => new THREE.Texture());
  const mat = (slot: string, t: number, tint: [number, number, number], scale = 0.3) => {
    const m = new THREE.ShaderMaterial({uniforms: {map: {value: tex[t]}, tint: {value: new THREE.Vector3(...tint)}, uvScale: {value: scale}, enuFromWorld: enu}, vertexShader: 'void main(){}', fragmentShader: 'void main(){}'});
    m.userData = {materialSlot: slot};
    return m;
  };
  const box = (material: any, x = 0) => {
    const g = new THREE.BoxGeometry(1, 1, 1); g.translate(x, 0, 0);
    return new THREE.Mesh(g, material);
  };
  const unitScene = (extra: number) => {
    const scene = new THREE.Group();
    scene.add(box(mat('brick', 0, [0.5, 0.3, 0.2])), box(mat('roofTile', 1, [0.7, 0.3, 0.2]), 2), box(mat('glass', 2, [1, 1, 1]), 4));
    for (let i = 0; i < extra; i++) scene.add(box(mat('frame', 2, [0.9, 0.9, 0.9]), 6 + i));
    scene.userData.nominal = {L0: 10, W0: 8, E0: 9, R0: 12};
    return scene;
  };
  const here: RuntimeInstance[] = [inst({pand: 'a', unit: 'u1'}), inst({pand: 'b', unit: 'u2', anchor: [4.8002, 52.364]}), inst({pand: 'c', unit: 'u1', anchor: [4.8004, 52.364]})];
  const area = await createBuildingTypes({THREE, loadUnit: async unit => unitScene(unit === 'u1' ? 0 : 2), getCentre: () => ({lng: 4.8, lat: 52.364})}, here);
  const s = area.stats();
  assert.equal(s.near, 3);
  assert.equal(s.drawCalls, 2, 'two units, every material merged: 2 near draws, not 3 + 5');
  assert.equal(s.nearTriangles, 3 * 12 * 2 + 5 * 12 * 1, 'u1: 3 boxes x 2 instances, u2: 5 boxes x 1');
  const mats = new Set<any>();
  area.group.traverse((o: any) => { if (o.isInstancedMesh) mats.add(o.material); });
  assert.equal(mats.size, 1, 'one shared material');
  const mesh = area.group.children.find((o: any) => o.isInstancedMesh && o.name.startsWith('u1/near'));
  assert.deepEqual(area.pandForHit(mesh, 1), 'c');
  area.dispose();
});
