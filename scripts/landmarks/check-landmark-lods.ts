// Fails when a landmark lod1 or lod2 is stale or missing: every modelLods.json entry
// must carry the fingerprint of the GLB deployed now (modelAssetVersions.json),
// every manifest model over the triangle threshold must have a lod1 file, and
// every lod2 record (lane R4-B #244) must have its file, match the manifest, and
// keep the lod2 set under LOD2_MAX_TOTAL_BYTES.
// Street chunks (lane R4-C #245): every chunks.json row's `lod2` must be current for its GLB's sha256, have its file at
// the recorded size, stay under the triangle cap, and the chunk lod2 set under CHUNK_LOD2_MAX_TOTAL_BYTES.
// Ordinary installs (lane R4-H #252): every modelLods.json row marked `ordinary` must be current for its catalogue GLB's
// sha256 and have its lod1/lod2 files at the recorded sizes, and every drawn own-GLB install whose largest embedded image
// is over ORDINARY_LOD1_MIN_ATLAS_PX must have one (the image sizes are read from the GLB's PNG headers).
// Fix with `npm run build:landmark-lods` (chunks: `-- --chunks`, ordinary installs: `-- --ordinary`).
import assert from 'node:assert/strict';
import fs from 'node:fs';

import catalogue from '../../public/canal-drive/ordinary-buildings-data/catalogue.json';
import versions from '../../src/canalRecall/landmarks/modelAssetVersions.json';
import { SHADOWED_BY_LANDMARK } from '../../src/canalRecall/landmarks/ordinaryModels';
import lods from '../../src/canalRecall/landmarks/modelLods.json';
import {
  ORDINARY_LOD1_MIN_ATLAS_PX, lod1Url,
  CHUNK_LOD2_BUILD_VERSION, chunkLod2IsCurrent, LOD2_MAX_TRIANGLES, lod2Url, LOD1_BUILD_VERSION, LOD1_MIN_SOURCE_TRIANGLES, LOD2_BUILD_VERSION, lod1IsCurrent, lod2IsCurrent,
  type LandmarkLodEntry, type LandmarkLodRecord,
} from '../../src/canalRecall/landmarks/landmarkLod';

/** The brief's budget for every lod2 together (the aerial set is fetched on top of lod1/full). */
const LOD2_MAX_TOTAL_BYTES = 6e6;
/** Lane R4-H (#252): the ordinary installs' lod1 + lod2 together (27 models; lod1 at 1024 px). */
const ORDINARY_LOD_MAX_TOTAL_BYTES = 8e6;
/** Lane R4-C (#245): the chunk stand-ins together (142 chunks, 5.34 MB at the cap; the full chunks are ~84 MB). */
const CHUNK_LOD2_MAX_TOTAL_BYTES = 6e6;

const manifest = JSON.parse(fs.readFileSync('public/canal-drive/models/signature-landmarks.json', 'utf8')) as { models: Record<string, { triangles: number; held?: boolean; lod1?: LandmarkLodRecord; lod2?: LandmarkLodRecord }> };
const table = lods as Record<string, LandmarkLodEntry>, asset = versions as Record<string, string>;
const problems: string[] = [];
let lod1Count = 0, lod2Count = 0, lod2Bytes = 0;
type CatalogueRow = { id: string; modelUrl: string; hash: string; instance?: unknown };
const ordinaryRows = new Map((catalogue as unknown as { models: CatalogueRow[] }).models.map(m => [m.id, m]));
/** Longest side of the largest PNG/JPEG-less image embedded in a GLB (PNG IHDR), without decoding the GLB. */
function largestEmbeddedPng(file: string): number {
  const glb = fs.readFileSync(file), jsonLength = glb.readUInt32LE(12), json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8'));
  const bin = 20 + jsonLength + 8;
  let best = 0;
  for (const image of json.images ?? []) {
    const view = json.bufferViews?.[image.bufferView];
    if (!view) continue;
    const at = bin + (view.byteOffset ?? 0);
    if (glb.readUInt32BE(at) !== 0x89504e47) continue;
    best = Math.max(best, glb.readUInt32BE(at + 16), glb.readUInt32BE(at + 20));
  }
  return best;
}
let ordinaryCount = 0, ordinaryBytes = 0;
for (const [id, entry] of Object.entries(table)) {
  if (entry.ordinary || entry.lod2?.ordinary) {
    const row = ordinaryRows.get(id);
    if (!row) { problems.push(`${id}: ordinary lod row without a catalogue model`); continue; }
    ordinaryCount++;
    const file = `public/canal-drive/${row.modelUrl.replace(/^\.\//, '').split('?')[0]}`;
    for (const [level, record, url] of [['lod1', entry, lod1Url(file)], ['lod2', entry.lod2, lod2Url(file)]] as const) {
      if (!record?.sourceHash) { problems.push(`${id}: ordinary ${level} record missing`); continue; }
      ordinaryBytes += record.bytes ?? 0;
      const current = level === 'lod1' ? lod1IsCurrent(record as LandmarkLodRecord, row.hash) : lod2IsCurrent(record as LandmarkLodRecord, row.hash);
      if (!current) problems.push(`${id}: ordinary ${level} built from ${record.sourceHash.slice(0, 16)} (v${record.buildVersion}), catalogue GLB is ${row.hash.slice(0, 16)}`);
      if (!fs.existsSync(url)) problems.push(`${id}: ${url} missing`);
      else if (fs.statSync(url).size !== record.bytes) problems.push(`${id}: ${url} is ${fs.statSync(url).size} B, record says ${record.bytes}`);
    }
    continue;
  }
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
for (const row of ordinaryRows.values()) {
  if (row.instance || SHADOWED_BY_LANDMARK[row.id]) continue;
  const file = `public/canal-drive/${row.modelUrl.replace(/^\.\//, '').split('?')[0]}`;
  if (!fs.existsSync(file)) continue;
  const atlas = largestEmbeddedPng(file);
  if (atlas > ORDINARY_LOD1_MIN_ATLAS_PX && !table[row.id]?.ordinary) problems.push(`${row.id}: ${atlas} px atlas but no ordinary lod1 (npm run build:landmark-lods -- --ordinary)`);
}
if (ordinaryBytes > ORDINARY_LOD_MAX_TOTAL_BYTES) problems.push(`ordinary lod set is ${(ordinaryBytes / 1e6).toFixed(2)} MB, over the ${ORDINARY_LOD_MAX_TOTAL_BYTES / 1e6} MB budget`);
const chunks = JSON.parse(fs.readFileSync('public/canal-drive/ordinary-buildings-data/chunks.json', 'utf8')) as { chunks: { id: string; modelUrl: string; sha256: string; lod2?: LandmarkLodRecord }[] };
let chunkCount = 0, chunkBytes = 0;
for (const chunk of chunks.chunks) {
  if (!chunk.lod2) continue;
  chunkCount++; chunkBytes += chunk.lod2.bytes;
  if (!chunkLod2IsCurrent(chunk.lod2, chunk.sha256)) problems.push(`${chunk.id}: chunk lod2 built from ${chunk.lod2.sourceHash} (v${chunk.lod2.buildVersion}), GLB row is ${chunk.sha256.slice(0, 16)} (chunk lod2 v${CHUNK_LOD2_BUILD_VERSION})`);
  if (chunk.lod2.triangles > LOD2_MAX_TRIANGLES) problems.push(`${chunk.id}: chunk lod2 has ${chunk.lod2.triangles} triangles, over ${LOD2_MAX_TRIANGLES}`);
  const file = `public/canal-drive/${lod2Url(chunk.modelUrl.split('?')[0])}`;
  if (!fs.existsSync(file)) problems.push(`${chunk.id}: ${file} missing`);
  else if (fs.statSync(file).size !== chunk.lod2.bytes) problems.push(`${chunk.id}: ${file} is ${fs.statSync(file).size} B, record says ${chunk.lod2.bytes}`);
}
if (chunkBytes > CHUNK_LOD2_MAX_TOTAL_BYTES) problems.push(`chunk lod2 set is ${(chunkBytes / 1e6).toFixed(2)} MB, over the ${CHUNK_LOD2_MAX_TOTAL_BYTES / 1e6} MB budget`);
if (lod2Bytes > LOD2_MAX_TOTAL_BYTES) problems.push(`lod2 set is ${(lod2Bytes / 1e6).toFixed(2)} MB, over the ${LOD2_MAX_TOTAL_BYTES / 1e6} MB budget`);
assert.equal(problems.length, 0, `landmark lods out of date (run npm run build:landmark-lods):\n${problems.join('\n')}`);
console.log(`${lod1Count} landmark lod1 models current; ${lod2Count} lod2 models current, ${(lod2Bytes / 1e6).toFixed(2)} MB; ${chunkCount} street-chunk lod2 current, ${(chunkBytes / 1e6).toFixed(2)} MB; ${ordinaryCount} ordinary installs' lod1 + lod2 current, ${(ordinaryBytes / 1e6).toFixed(2)} MB.`);
