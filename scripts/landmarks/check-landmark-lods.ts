// Fails when a landmark lod1 is stale or missing: every modelLods.json entry
// must carry the fingerprint of the GLB deployed now (modelAssetVersions.json),
// and every manifest model over the triangle threshold must have a lod1 file.
// Fix with `npm run build:landmark-lods`.
import assert from 'node:assert/strict';
import fs from 'node:fs';

import versions from '../../src/canalRecall/landmarks/modelAssetVersions.json';
import lods from '../../src/canalRecall/landmarks/modelLods.json';
import { LOD1_BUILD_VERSION, LOD1_MIN_SOURCE_TRIANGLES, lod1IsCurrent, type LandmarkLodRecord } from '../../src/canalRecall/landmarks/landmarkLod';

const manifest = JSON.parse(fs.readFileSync('public/canal-drive/models/signature-landmarks.json', 'utf8')) as { models: Record<string, { triangles: number; held?: boolean; lod1?: LandmarkLodRecord }> };
const table = lods as Record<string, LandmarkLodRecord>, asset = versions as Record<string, string>;
const problems: string[] = [];
for (const [id, record] of Object.entries(table)) {
  if (!lod1IsCurrent(record, asset[id])) problems.push(`${id}: lod1 built from ${record.sourceHash} (v${record.buildVersion}), GLB is ${asset[id]} (lod build v${LOD1_BUILD_VERSION})`);
  if (!fs.existsSync(`public/canal-drive/models/${id}.lod1.glb`)) problems.push(`${id}: ${id}.lod1.glb missing`);
}
for (const [id, model] of Object.entries(manifest.models)) {
  // Held models are out of the game; their manifest counts may lag the GLB.
  if (model.held || !fs.existsSync(`public/canal-drive/models/${id}.glb`)) continue;
  if (model.triangles >= LOD1_MIN_SOURCE_TRIANGLES && !table[id]) problems.push(`${id}: ${model.triangles} triangles but no lod1`);
  if (model.lod1 && table[id] && model.lod1.sourceHash !== table[id].sourceHash) problems.push(`${id}: manifest lod1 and modelLods.json disagree`);
}
assert.equal(problems.length, 0, `landmark lod1 out of date (run npm run build:landmark-lods):\n${problems.join('\n')}`);
console.log(`${Object.keys(table).length} landmark lod1 models current.`);
