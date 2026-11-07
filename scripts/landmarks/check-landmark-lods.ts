// Fails when a landmark lod1 or lod2 is stale or missing: every modelLods.json entry
// must carry the fingerprint of the GLB deployed now (modelAssetVersions.json),
// every manifest model over the triangle threshold must have a lod1 file, and
// every lod2 record (lane R4-B #244) must have its file, match the manifest, and
// keep the lod2 set under LOD2_MAX_TOTAL_BYTES.
// Fix with `npm run build:landmark-lods`.
import assert from 'node:assert/strict';
import fs from 'node:fs';

import versions from '../../src/canalRecall/landmarks/modelAssetVersions.json';
import lods from '../../src/canalRecall/landmarks/modelLods.json';
import {
  LOD1_BUILD_VERSION, LOD1_MIN_SOURCE_TRIANGLES, LOD2_BUILD_VERSION, lod1IsCurrent, lod2IsCurrent,
  type LandmarkLodEntry, type LandmarkLodRecord,
} from '../../src/canalRecall/landmarks/landmarkLod';

/** The brief's budget for every lod2 together (the aerial set is fetched on top of lod1/full). */
const LOD2_MAX_TOTAL_BYTES = 6e6;

const manifest = JSON.parse(fs.readFileSync('public/canal-drive/models/signature-landmarks.json', 'utf8')) as { models: Record<string, { triangles: number; held?: boolean; lod1?: LandmarkLodRecord; lod2?: LandmarkLodRecord }> };
const table = lods as Record<string, LandmarkLodEntry>, asset = versions as Record<string, string>;
const problems: string[] = [];
let lod1Count = 0, lod2Count = 0, lod2Bytes = 0;
for (const [id, entry] of Object.entries(table)) {
  if ('sourceHash' in entry && entry.sourceHash) {
    lod1Count++;
    if (!lod1IsCurrent(entry as LandmarkLodRecord, asset[id])) problems.push(`${id}: lod1 built from ${entry.sourceHash} (v${entry.buildVersion}), GLB is ${asset[id]} (lod build v${LOD1_BUILD_VERSION})`);
    if (!fs.existsSync(`public/canal-drive/models/${id}.lod1.glb`)) problems.push(`${id}: ${id}.lod1.glb missing`);
  }
  if (entry.lod2) {
    lod2Count++; lod2Bytes += entry.lod2.bytes;
    if (!lod2IsCurrent(entry.lod2, asset[id])) problems.push(`${id}: lod2 built from ${entry.lod2.sourceHash} (v${entry.lod2.buildVersion}), GLB is ${asset[id]} (lod2 build v${LOD2_BUILD_VERSION})`);
    const file = `public/canal-drive/models/${id}.lod2.glb`;
    if (!fs.existsSync(file)) problems.push(`${id}: ${id}.lod2.glb missing`);
    else if (fs.statSync(file).size !== entry.lod2.bytes) problems.push(`${id}: ${id}.lod2.glb is ${fs.statSync(file).size} B, record says ${entry.lod2.bytes}`);
  }
}
for (const [id, model] of Object.entries(manifest.models)) {
  // Held models are out of the game; their manifest counts may lag the GLB.
  if (model.held || !fs.existsSync(`public/canal-drive/models/${id}.glb`)) continue;
  const row = table[id] as LandmarkLodEntry | undefined;
  if (model.triangles >= LOD1_MIN_SOURCE_TRIANGLES && !row?.sourceHash) problems.push(`${id}: ${model.triangles} triangles but no lod1`);
  if (model.lod1 && row?.sourceHash && model.lod1.sourceHash !== row.sourceHash) problems.push(`${id}: manifest lod1 and modelLods.json disagree`);
  if ((model.lod2?.sourceHash ?? null) !== (row?.lod2?.sourceHash ?? null)) problems.push(`${id}: manifest lod2 and modelLods.json disagree`);
}
if (lod2Bytes > LOD2_MAX_TOTAL_BYTES) problems.push(`lod2 set is ${(lod2Bytes / 1e6).toFixed(2)} MB, over the ${LOD2_MAX_TOTAL_BYTES / 1e6} MB budget`);
assert.equal(problems.length, 0, `landmark lods out of date (run npm run build:landmark-lods):\n${problems.join('\n')}`);
console.log(`${lod1Count} landmark lod1 models current; ${lod2Count} lod2 models current, ${(lod2Bytes / 1e6).toFixed(2)} MB.`);
