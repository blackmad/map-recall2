import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { cutMesh, growTileSpheres } from './tiledGeometry';
import { overviewTileGrid, OVERVIEW_TILES, OVERVIEW_TILES_BEFORE } from '../engine/overviewLayer';

/** A flat grid of `cells`² unit quads, `size` m wide, at z = 0 (an overview-like layer). */
function quadGrid(cells: number, size: number): THREE.BufferGeometry {
  const pos: number[] = [], idx: number[] = [], s = size / cells;
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) {
    const v = pos.length / 3, x = i * s - size / 2, y = j * s - size / 2;
    pos.push(x, y, 0, x + s * 0.9, y, 0, x + s * 0.9, y + s * 0.9, 0, x, y + s * 0.9, 0);
    idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

/** Every triangle with a vertex inside `frustum` (world), as positions in the rewritten index. */
function visibleTriangles(mesh: THREE.Mesh, frustum: THREE.Frustum): number[] {
  const g = mesh.geometry, p = g.attributes.position, ix = g.index!.array, out: number[] = [], v = new THREE.Vector3();
  for (let t = 0; t < ix.length / 3; t++) {
    for (let k = 0; k < 3; k++) if (frustum.containsPoint(v.fromBufferAttribute(p, ix[3 * t + k]).applyMatrix4(mesh.matrixWorld))) { out.push(t); break; }
  }
  return out;
}

function chaseCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(50, 1.6, 1, 3000);
  camera.position.set(120, -300, 90);
  camera.up.set(0, 0, 1);
  camera.lookAt(200, 400, 0);
  camera.updateMatrixWorld(true);
  return camera;
}

test('drawAsSpans: the local-frame span test keeps every on-screen triangle under a scaled, rotated, moved owner', () => {
  const mesh = new THREE.Mesh(quadGrid(64, 8000), new THREE.MeshBasicMaterial());
  mesh.position.set(300, -200, -3); mesh.rotation.z = 0.3; mesh.scale.set(1.2, 0.8, 1);
  mesh.updateMatrixWorld(true);
  assert.ok(cutMesh(THREE, mesh, 32, 100, { draw: 'spans' }));
  const camera = chaseCamera();
  mesh.onBeforeRender({} as any, {} as any, camera, mesh.geometry, mesh.material, null as any);
  const { start, count } = mesh.geometry.drawRange;
  const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const seen = visibleTriangles(mesh, frustum);
  assert.ok(seen.length > 0 && count > 0);
  for (const t of seen) assert.ok(3 * t >= start && 3 * t + 3 <= start + count, `triangle ${t} on screen but outside [${start}, ${start + count})`);
  assert.ok(count < mesh.geometry.index!.count * 0.6, `the span culls part of the grid (${count / 3} of ${mesh.geometry.index!.count / 3})`);
});

test('drawAsSpans: meshes sharing the geometry reuse the range; a camera move or grown spheres choose again', () => {
  const geometry = quadGrid(48, 6000), material = new THREE.MeshBasicMaterial();
  const owner = new THREE.Mesh(geometry, material);
  owner.updateMatrixWorld(true);
  assert.ok(cutMesh(THREE, owner, 32, 100, { draw: 'spans' }));
  const camera = chaseCamera();
  const range = () => { owner.onBeforeRender({} as any, {} as any, camera, geometry, material, null as any); return [geometry.drawRange.start, geometry.drawRange.count]; };
  const a = range();
  geometry.drawRange.start = 0; geometry.drawRange.count = Infinity; // the casing's onAfterRender
  assert.deepEqual(range(), a, 'same camera, same spheres: same range');
  camera.position.x += 2500; camera.lookAt(2700, 400, 0); camera.updateMatrixWorld(true);
  const b = range();
  assert.notDeepEqual(b, a, 'the camera moved');
  const spans = owner.userData.spans as { radius: number }[];
  const r0 = spans[0].radius;
  growTileSpheres(owner, 4000);
  assert.equal(spans[0].radius, r0 + 4000);
  const c = range();
  assert.ok(c[1] >= b[1], 'grown spheres: at least as much drawn');
  assert.notDeepEqual(c, b, 'the grown spheres are re-tested, not the memo reused');
  const version = owner.userData.spanVersion;
  growTileSpheres(owner, 4000);
  assert.equal(owner.userData.spanVersion, version, 'an unchanged margin keeps the memo');
});

test('overview span grid: 32, or the old 8 under ?overviewCull=0', () => {
  const g = globalThis as any, saved = { location: g.location, flag: g.__canalRecallOverviewCull };
  try {
    g.location = { search: '?engine=own' };
    assert.equal(overviewTileGrid(), OVERVIEW_TILES);
    assert.equal(OVERVIEW_TILES, 32);
    g.location = { search: '?engine=own&overviewCull=0' };
    assert.equal(overviewTileGrid(), OVERVIEW_TILES_BEFORE);
    g.location = { search: '' }; g.__canalRecallOverviewCull = false;
    assert.equal(overviewTileGrid(), 8);
  } finally { g.location = saved.location; g.__canalRecallOverviewCull = saved.flag; }
});
