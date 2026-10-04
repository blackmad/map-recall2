import assert from 'node:assert/strict';
import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import * as T from 'three';
import { MANUAL_LANDMARKS } from '../src/canalRecall/landmarks/manualModels';
import { placementFor } from '../src/canalRecall/landmarks/signaturePlacement';
await MeshoptDecoder.ready;

const spec = MANUAL_LANDMARKS.find(s => s.id === 'muiderpoort');
assert.ok(spec, 'muiderpoort spec registered');

// Placement must be surveyed, scale 1, on the BAG anchor.
const manifest = JSON.parse(fs.readFileSync('public/canal-drive/models/signature-landmarks.json', 'utf8'));
const model = manifest.models['muiderpoort'];
assert.ok(model, 'model manifest entry present');
const placement = placementFor(spec, model.bounds);
assert.equal(placement.scale, 1, 'native scale 1');
assert.ok(Math.abs(placement.anchor[0] - 4.919485) < 1e-4, 'anchor lng');
assert.ok(Math.abs(placement.anchor[1] - 52.3637232) < 1e-4, 'anchor lat');

// Bounds: facade ~24 m wide, passage ~17.6 m deep, dome ~20 m tall.
const [min, max] = [model.bounds.min, model.bounds.max];
const w = max[0] - min[0], d = max[2] - min[2], h = max[1] - min[1];
assert.ok(w > 23 && w < 26, `facade width ${w.toFixed(1)} m`);
assert.ok(d > 16 && d < 20, `passage depth ${d.toFixed(1)} m`);
assert.ok(h > 18 && h < 24, `height ${h.toFixed(1)} m`);

// Exact replaced identities.
assert.deepEqual(spec.suppressOsmIds, ['w45038672', 'NL.IMBAG.Pand.0363100012169095']);

// Load the GLB and merge into one mesh for the open-passage ray test.
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read('public/canal-drive/models/muiderpoort.glb');
assert.equal(doc.getRoot().listTextures().length, 0, 'no textures');
const allPositions: number[] = [];
let leadDown = 0, leadUp = 0;
function walk(node: any) {
  for (const child of node.listChildren?.() ?? []) walk(child);
  const mesh = node.getMesh?.();
  if (!mesh) return;
  for (const p of mesh.listPrimitives?.() ?? []) {
    const pos = p.getAttribute('POSITION')?.getArray?.();
    const norm = p.getAttribute('NORMAL')?.getArray?.();
    if (!pos) continue;
    const posArr = Array.from(pos as Float32Array);
    const normArr = norm ? Array.from(norm as Float32Array) : null;
    const idx = p.getIndices?.()?.getArray?.();
    const isDome = p.getMaterial()?.getName?.() === 'lead';
    if (idx) {
      for (const vi of Array.from(idx as Uint32Array)) {
        allPositions.push(posArr[vi * 3], posArr[vi * 3 + 1], posArr[vi * 3 + 2]);
        if (isDome && normArr) {
          const ny = normArr[vi * 3 + 1];
          if (ny < -0.1) leadDown++; else if (ny > 0.1) leadUp++;
        }
      }
    } else {
      allPositions.push(...posArr);
      if (isDome && normArr) {
        for (let i = 0; i < normArr.length; i += 3) {
          const ny = normArr[i + 1];
          if (ny < -0.1) leadDown++; else if (ny > 0.1) leadUp++;
        }
      }
    }
  }
}
walk(doc.getRoot().getDefaultScene());
const merged = new T.BufferGeometry();
merged.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(allPositions), 3));
const rayMesh = new T.Mesh(merged);

// Carriage arch must be genuinely open: a ray through the centre hits nothing.
const raycaster = new T.Raycaster(new T.Vector3(0, 3, 9.4), new T.Vector3(0, 0, -1), 0, 40);
assert.equal(raycaster.intersectObject(rayMesh, false).length, 0, 'carriage arch passage must be open');

// The grey lead/slate dome must be wound upward, not downward.
assert.ok(leadUp > 0 && leadDown === 0, `lead dome normals upward (up ${leadUp}, down ${leadDown})`);

console.log(`muiderpoort geometry passed: scale=1, ${w.toFixed(1)}x${d.toFixed(1)}x${h.toFixed(1)} m, open carriage arch, upward dome, ${model.triangles} triangles, ${model.bytes} bytes.`);
