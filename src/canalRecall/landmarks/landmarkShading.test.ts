// node --import tsx --test src/canalRecall/landmarks/landmarkShading.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as THREE from 'three';
import { auditGltfMaterials, glbJson, hasSpecular, normaliseLandmarkMaterials, toDiffuseMaterial, GLASS_SKY_TINT } from './landmarkShading.js';

const ROOT = resolve(import.meta.dirname, '../../..');
const MODELS = join(ROOT, 'public/canal-drive/models');

test('standard materials become diffuse-only, keeping colour, maps and flags', () => {
  const map = new THREE.Texture();
  const source = new THREE.MeshStandardMaterial({ name: 'slate', color: 0x34383d, map, roughness: 0.9, metalness: 0, side: THREE.DoubleSide, transparent: true, opacity: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
  source.userData.materialSlot = 'roof';
  const out = toDiffuseMaterial(THREE, source);
  assert.equal(out.type, 'MeshLambertMaterial');
  assert.equal(hasSpecular(out), false);
  assert.equal(out.color.getHex(), source.color.getHex());
  assert.equal(out.map, map, 'textures are shared, not copied');
  assert.equal(out.side, THREE.DoubleSide);
  assert.equal(out.transparent, true);
  assert.equal(out.opacity, 0.7);
  assert.equal(out.polygonOffsetFactor, -2);
  assert.equal(out.userData.materialSlot, 'roof');
  assert.notEqual(out.color, source.color, 'colours are cloned so highlight edits do not leak');
});

test('glass gets a constant sky tint; unlit and shader materials pass through', () => {
  const glass = toDiffuseMaterial(THREE, new THREE.MeshStandardMaterial({ name: 'glass', color: 0x6e8497 }));
  assert.ok(Math.abs(glass.emissive.r - GLASS_SKY_TINT.r) < 1e-9 && Math.abs(glass.emissive.b - GLASS_SKY_TINT.b) < 1e-9);
  const brick = toDiffuseMaterial(THREE, new THREE.MeshStandardMaterial({ name: 'brick' }));
  assert.equal(brick.emissive.getHex(), 0);
  const basic = new THREE.MeshBasicMaterial();
  const shader = new THREE.ShaderMaterial();
  assert.equal(toDiffuseMaterial(THREE, basic), basic);
  assert.equal(toDiffuseMaterial(THREE, shader), shader);
});

test('normalising a scene keeps shared materials shared and leaves nothing specular', () => {
  const shared = new THREE.MeshStandardMaterial({ name: 'white' });
  const box = new THREE.BoxGeometry();
  const scene = new THREE.Group();
  const a = new THREE.Mesh(box, shared), b = new THREE.Mesh(box, shared);
  const c = new THREE.Mesh(box, [shared, new THREE.MeshPhysicalMaterial({ name: 'glass' })]);
  scene.add(a, b, c);
  assert.equal(normaliseLandmarkMaterials(THREE, scene), 2);
  assert.equal(a.material, b.material);
  assert.equal((c.material as any[])[0], a.material);
  scene.traverse((o: any) => { if (o.isMesh) for (const m of [o.material].flat()) assert.equal(hasSpecular(m), false); });
  assert.equal(normaliseLandmarkMaterials(THREE, scene), 0, 'idempotent');
});

test('audit flags metals, glossy and specular-extension materials', () => {
  const issues = auditGltfMaterials([
    { name: 'ok', pbrMetallicRoughness: { metallicFactor: 0, roughnessFactor: 0.9 } },
    { name: 'default-metal' },
    { name: 'glossy', pbrMetallicRoughness: { metallicFactor: 0, roughnessFactor: 0.2 } },
    { name: 'spec', pbrMetallicRoughness: { metallicFactor: 0, roughnessFactor: 1 }, extensions: { KHR_materials_specular: {} } },
    { name: 'unlit', extensions: { KHR_materials_unlit: {} } },
  ]);
  assert.deepEqual(issues.map(i => `${i.material}:${i.severity}`), ['default-metal:error', 'glossy:warning', 'spec:error']);
});

// Every GLB the game loads (signature landmarks, their lod1s, and recipe/ordinary chunks) stays in the
// agreed range: no metals and no specular extensions. Low roughness is reported but tolerated — the game
// renders diffuse-only, so it has no visible effect — and listed here so exporters can be fixed.
test('in-game GLB materials are within the agreed range', () => {
  const manifest = JSON.parse(readFileSync(join(MODELS, 'signature-landmarks.json'), 'utf8')).models as Record<string, any>;
  const files = new Set<string>();
  for (const spec of Object.values(manifest)) {
    if (!spec?.modelUrl) continue;
    const file = join(ROOT, 'public/canal-drive', spec.modelUrl);
    files.add(file);
    const lod = file.replace(/\.glb$/, '.lod1.glb');
    if (existsSync(lod)) files.add(lod);
  }
  const ordinary = join(MODELS, 'ordinary-buildings');
  if (existsSync(ordinary)) for (const f of readdirSync(ordinary)) if (f.endsWith('.glb')) files.add(join(ordinary, f));
  assert.ok(files.size > 100, `found ${files.size} GLBs`);
  const errors: string[] = [], warnings = new Map<string, number>();
  for (const file of files) {
    if (!existsSync(file)) continue;
    const json = glbJson(readFileSync(file));
    if (!json) continue;
    for (const issue of auditGltfMaterials(json.materials || [])) {
      const where = `${file.slice(MODELS.length + 1)} ${issue.material}: ${issue.problem}`;
      if (issue.severity === 'error') errors.push(where);
      else warnings.set(issue.problem, (warnings.get(issue.problem) || 0) + 1);
    }
  }
  if (warnings.size) console.log('material warnings (no in-game effect):', Object.fromEntries(warnings));
  assert.deepEqual(errors, []);
});
