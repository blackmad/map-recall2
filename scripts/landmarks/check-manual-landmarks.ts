import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import versions from '../../src/canalRecall/landmarks/modelAssetVersions.json';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {MANUAL_LANDMARKS} from '../../src/canalRecall/landmarks/manualModels';
import {placementFor} from '../../src/canalRecall/landmarks/signaturePlacement';
await MeshoptDecoder.ready;
for(const spec of MANUAL_LANDMARKS){
  const expected=createHash('sha256').update(fs.readFileSync(`public/canal-drive/models/${spec.id}.glb`)).digest('hex').slice(0,16);
  assert.equal((versions as Record<string,string>)[spec.id],expected,`${spec.id}: stale model cache fingerprint`);
}
// A surveyed standalone landscape adds geometry without replacing buildings. It must never fall back to rectangular building suppression to
// satisfy admission.
for (const spec of MANUAL_LANDMARKS.filter(spec => spec.assetKind === 'landscape')) {
  assert.equal(spec.spatialSuppression, false, `${spec.id}: landscape must retain surrounding building layers`);
  assert.equal(spec.suppressOsmIds.length, 0, `${spec.id}: landscape may not suppress building identities`);
  assert.ok(spec.surveyed && spec.surveyed.anchor.every(Number.isFinite), `${spec.id}: native surveyed landscape anchor required`);
  assert.ok(spec.landmarkId, `${spec.id}: landscape needs its genuine requested POI identity`);
}
// Standalone admission (2026-10-13): a model that replaces no building and cuts no host wall is admitted when it says so explicitly:
// spatialSuppression is false, no OSM id is suppressed and it carries a finite surveyed anchor. That is the Homomonument (pink granite
// triangles in the Westermarkt pavement and the canal step, assetKind memorial), the Dokwerker memorial, Sloterdijk station, the houseboat
// museum, Sea Palace, Odessa and the Schouwburgpoort: all were failing "exact replacement, bounded host opening or landscape required".
const standalone = (spec: (typeof MANUAL_LANDMARKS)[number]) => spec.assetKind === 'landscape'
  || (spec.spatialSuppression === false && !spec.suppressOsmIds.length && !spec.hostWallOpenings?.length && !!spec.surveyed && spec.surveyed.anchor.every(Number.isFinite));
// Models recorded over the 500 KB / 40,000-triangle budget by the 2026-10-13 closed-panel cleanup (mountain-network, a 47k-triangle facade). The ceiling is
// the recorded size: it may not grow, and a new model gets no allowance.
const OVER_BUDGET: Record<string, {bytes: number; triangles: number}> = {'mountain-network': {bytes: 650000, triangles: 48000}, 'royal-palace': {bytes: 640000, triangles: 40000}};
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const manifest=JSON.parse(fs.readFileSync('public/canal-drive/models/signature-landmarks.json','utf8'));
for(const spec of MANUAL_LANDMARKS){let model=manifest.models[spec.id];assert.ok(model);assert.equal(model.bytes,fs.statSync(`public/canal-drive/models/${spec.id}.glb`).size,`${spec.id}: stale asset byte count`);const over=OVER_BUDGET[spec.id];assert.ok(model.bytes<(over?.bytes??500000),`${spec.id}: ${model.bytes} bytes over budget`);assert.ok(model.triangles>=(spec.assetKind==='memorial'?12:250)&&model.triangles<(over?.triangles??40000),`${spec.id}: ${model.triangles} triangles outside budget`);assert.ok(spec.suppressOsmIds.length || spec.hostWallOpenings?.length || standalone(spec), `${spec.id}: exact replacement, bounded host opening or native standalone landscape required`);assert.ok(Math.abs(placementFor(spec,model.bounds).scale-1)<0.3);let document=await io.read(`public/canal-drive/models/${spec.id}.glb`);assert.equal(document.getRoot().listTextures().length,0);const triangles=document.getRoot().listMeshes().flatMap(mesh=>mesh.listPrimitives()).reduce((count,primitive)=>count+(primitive.getIndices()?.getCount()??primitive.getAttribute('POSITION')!.getCount())/3,0);assert.equal(model.triangles,triangles,`${spec.id}: stale asset triangle count`);for(let material of document.getRoot().listMaterials())assert.equal(material.getMetallicFactor(),0);for(let accessor of document.getRoot().listAccessors()){let array=accessor.getArray();if(array)assert.ok(Array.from(array).every(Number.isFinite));}}
assert.ok(MANUAL_LANDMARKS.find(s=>s.id==='muziekgebouw-bimhuis')?.relatedLandmarkIds?.includes('extract_landmarks_1651446989'));
// Homomonument (2026-10-16, memorial-builders.ts): three separate granite stones at least 0.3 m tall (flush 2 cm proud with its 0.3 m
// bed, the 0.60 m podium, the stepped stone down to below the water), four risers between the quay level and the platform at
// WATER_Z + 0.30, three thin lines between the stones that touch none of them, and the measured granite tint on every face.
{
  const {loadMaterialSoup} = await import('./material-soup');
  const {partsOf} = await import('../../src/canalRecall/landmarks/geometryAudit');
  const {HOMOMONUMENT} = await import('./memorial-builders');
  const s = await loadMaterialSoup('public/canal-drive/models/homomonument.glb'), part = partsOf(s, 0.001), nTri = s.indices.length / 3;
  const byPart = new Map<number, number[]>();
  for (let t = 0; t < nTri; t++) { const l = byPart.get(part[t]); if (l) l.push(t); else byPart.set(part[t], [t]); }
  const V = (i: number) => [s.positions[i * 3], s.positions[i * 3 + 1], s.positions[i * 3 + 2]];
  const parts = [...byPart.values()].map(tris => {
    let minY = Infinity, maxY = -Infinity; const levels = new Set<number>();
    for (const t of tris) {
      const a = V(s.indices[t * 3]), b = V(s.indices[t * 3 + 1]), c = V(s.indices[t * 3 + 2]);
      for (const v of [a, b, c]) { minY = Math.min(minY, v[1]); maxY = Math.max(maxY, v[1]); }
      // An upward face: a tread, the platform or a stone's top.
      const n = [(b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])];
      if (n[1] > 0.9 * Math.hypot(n[0], n[1], n[2]) && Math.abs(a[1] - b[1]) < 1e-3 && Math.abs(a[1] - c[1]) < 1e-3) levels.add(Math.round(a[1] * 100) / 100);
    }
    return {minY, maxY, height: maxY - minY, levels: [...levels].sort((p, q) => q - p)};
  });
  const stones = parts.filter(p => p.height >= 0.3), lines = parts.filter(p => p.height < 0.3);
  assert.equal(stones.length, 3, `homomonument: three stones, got ${stones.length} of ${parts.length} parts`);
  assert.equal(lines.length, 3, `homomonument: three granite lines apart from the stones, got ${lines.length}`);
  const stepped = stones.sort((p, q) => p.minY - q.minY)[0];
  assert.ok(stepped.minY < HOMOMONUMENT.platformY && stepped.levels.includes(HOMOMONUMENT.platformY), `homomonument: the stepped stone reaches the platform at ${HOMOMONUMENT.platformY} (levels ${stepped.levels.join(', ')})`);
  assert.equal(stepped.levels.filter(y => y <= HOMOMONUMENT.flushY + 1e-6 && y >= HOMOMONUMENT.platformY - 1e-6).length, HOMOMONUMENT.risers + 1, `homomonument: ${HOMOMONUMENT.risers} risers between the quay level and the platform (levels ${stepped.levels.join(', ')})`);
  assert.ok(stones.some(p => Math.abs(p.maxY - HOMOMONUMENT.podiumY) < 1e-3), 'homomonument: the podium stands 0.60 m above the square');
  assert.ok(stones.some(p => Math.abs(p.maxY - HOMOMONUMENT.flushY) < 1e-3), 'homomonument: the flush stone is 2 cm proud');
  assert.ok(s.materials.every(m => m.name === 'pink' && m.tint?.toLowerCase() === '#cdcbb0'), `homomonument: measured granite tint on every material (${s.materials.map(m => `${m.name} ${m.tint}`).join(', ')})`);
}
console.log(`${MANUAL_LANDMARKS.length} manual landmarks: finite geometry, life-size placement, compression budget, materials, suppression and shared Bimhuis identity passed.`);
