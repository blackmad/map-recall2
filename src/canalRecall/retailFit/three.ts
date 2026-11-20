// Browser adapter (lane retail-fit-20261120): signature-landmarks-source.js `_add` calls attachRetailFit on a model's
// full-level scene, with its placement transform, before the model is shown. Flag off or a model with no fits: nothing.
// THREE is passed in (as landmarkShading.ts does) so this module stays free of a three import.
import { retailFitOn } from './flag.js';
import { hasRetailFit, retailFitMesh } from './overlay.js';
import type { GlassSoup } from './openings.js';

const GLASS = /glass|glaz/i;

/**
 * `imported`: the GLB scene (not yet positioned). `toMercator`: the holder transform x group matrix (model metres to
 * Mercator), `mercatorOf(lng, lat)`: maplibre's MercatorCoordinate. Returns the triangle count added (0 when none).
 */
export function attachRetailFit(THREE: any, spec: { id: string }, imported: any, toMercator: any, mercatorOf: (lng: number, lat: number) => { x: number; y: number; z: number }): number {
  if (!retailFitOn() || !hasRetailFit(spec.id)) return 0;
  imported.updateMatrixWorld(true);
  const rootInverse = new THREE.Matrix4().copy(imported.matrixWorld).invert();
  const glass: GlassSoup[] = [];
  let sx = 0, sz = 0, n = 0;
  const v = new THREE.Vector3();
  imported.traverse((o: any) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const pos = o.geometry.attributes.position, m = new THREE.Matrix4().multiplyMatrices(rootInverse, o.matrixWorld);
    const out = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m); out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z; sx += v.x; sz += v.z; n++; }
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some((mt: any) => mt?.userData?.materialSlot === 'glass' || GLASS.test(mt?.name ?? ''))) glass.push({ positions: out, indices: o.geometry.index?.array ?? null });
  });
  if (!glass.length || !n) return 0;
  // Model metres (scene root frame, before recentring: the overlay is a child of `imported`) from (lng, lat).
  const inv = new THREE.Matrix4().copy(toMercator).multiply(imported.matrix).invert();
  const toNative = (lng: number, lat: number): [number, number] => { const c = mercatorOf(lng, lat); v.set(c.x, c.y, c.z).applyMatrix4(inv); return [v.x, v.z]; };
  const r = retailFitMesh(spec.id, glass, [sx / n, sz / n], toNative);
  if (!r) return 0;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(r.mesh.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(r.mesh.normals, 3));
  g.setAttribute('color', new THREE.BufferAttribute(r.mesh.colors, 3));
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.name = 'retail-fit';
  mesh.userData.retailFit = r.placed;
  imported.add(mesh);
  return r.mesh.triangles;
}
