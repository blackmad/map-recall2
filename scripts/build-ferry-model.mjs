import { writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createFerryModel } from '../src/canalRecall/ferry/model.mjs';
// GLTFExporter uses FileReader for binary serialization in the browser.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(buffer => { this.result = buffer; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(buffer => { this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`; this.onloadend?.(); }); }
};
const authored = createFerryModel(); authored.updateMatrixWorld(true);
const buckets = new Map();
authored.traverse(mesh => {
  if (!mesh.isMesh) return;
  const key = mesh.material.color.getHexString();
  if (!buckets.has(key)) buckets.set(key, { material: mesh.material, geometries: [] });
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  buckets.get(key).geometries.push(geometry.applyMatrix4(mesh.matrixWorld));
});
const runtime = new THREE.Group(); runtime.name = authored.name;
for (const [key, bucket] of buckets) {
  const mesh = new THREE.Mesh(mergeGeometries(bucket.geometries), bucket.material);
  mesh.name = `ferry-color-${key}`; runtime.add(mesh);
}
const binary = await new GLTFExporter().parseAsync(runtime, { binary: true });
writeFileSync('public/canal-drive/gvb-ferry-runtime.glb', Buffer.from(binary));
console.log(`GVB-style ferry: ${binary.byteLength} bytes`);
