// Writes `<id>.lod1.glb` beside each curated landmark GLB: ~15% of the
// triangles by meshoptimizer simplification, same materials, meshopt-compressed.
// Resumable: a model is rebuilt only when its source GLB's fingerprint (or the
// build version) differs from the one recorded in the manifest's `lod1` field.
//
//   npm run build:landmark-lods [-- --force] [-- --only=id,id]
//
// Also writes src/canalRecall/landmarks/modelLods.json (id -> lod1 record), the
// small table the browser bundle uses to know which models have a lod1.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { NodeIO, type Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, normals, prune, simplify, textureCompress, unweld, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

import {
  LOD1_BUILD_VERSION, LOD1_MAX_ERROR, LOD1_MAX_TEXTURE_SIZE, LOD1_MIN_SOURCE_TRIANGLES, LOD1_TRIANGLE_RATIO,
  lod1IsCurrent, lod1Url, type LandmarkLodRecord,
} from '../../src/canalRecall/landmarks/landmarkLod';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const MODELS = path.join(ROOT, 'public', 'canal-drive', 'models');
const MANIFEST = path.join(MODELS, 'signature-landmarks.json');
const TABLE = path.join(ROOT, 'src', 'canalRecall', 'landmarks', 'modelLods.json');

function triangles(document: Document): number {
  let total = 0;
  for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
    const indices = primitive.getIndices();
    total += (indices ? indices.getCount() : primitive.getAttribute('POSITION')?.getCount() ?? 0) / 3;
  }
  return Math.round(total);
}

const sha = (file: string) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16);

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const only = process.argv.find(a => a.startsWith('--only='))?.slice(7).split(',');
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as { models: Record<string, any> };
  const table: Record<string, LandmarkLodRecord> = {};
  let built = 0, skipped = 0, tiny = 0, addedBytes = 0;
  for (const [id, entry] of Object.entries(manifest.models)) {
    const source = path.join(MODELS, `${id}.glb`);
    if (!fs.existsSync(source) || (only && !only.includes(id))) { if (entry.lod1) table[id] = entry.lod1; continue; }
    const output = path.join(MODELS, path.basename(lod1Url(`${id}.glb`)));
    const hash = sha(source);
    if (!force && fs.existsSync(output) && lod1IsCurrent(entry.lod1, hash)) {
      table[id] = entry.lod1; skipped++; addedBytes += entry.lod1.bytes; continue;
    }
    const document = await io.read(source);
    const sourceTriangles = triangles(document);
    if (sourceTriangles < LOD1_MIN_SOURCE_TRIANGLES) {
      tiny++; delete entry.lod1; if (fs.existsSync(output)) fs.unlinkSync(output); continue;
    }
    // The runtime GLBs are flat-shaded: every face has its own normals, so the
    // vertices never merge and the simplifier sees every edge as a seam and
    // removes ~5% of the triangles. Drop the normals, weld on position and UV,
    // simplify, then rebuild flat normals from the result.
    for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) primitive.setAttribute('NORMAL', null);
    await document.transform(
      weld(),
      simplify({ simplifier: MeshoptSimplifier, ratio: LOD1_TRIANGLE_RATIO, error: LOD1_MAX_ERROR }),
      unweld(),
      normals({ overwrite: true }),
      weld(),
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [LOD1_MAX_TEXTURE_SIZE, LOD1_MAX_TEXTURE_SIZE] }),
      prune(),
      meshopt({ encoder: MeshoptEncoder }),
    );
    await io.write(output, document);
    const record: LandmarkLodRecord = {
      sourceHash: hash, buildVersion: LOD1_BUILD_VERSION,
      bytes: fs.statSync(output).size, triangles: triangles(document),
    };
    entry.lod1 = record; table[id] = record; built++; addedBytes += record.bytes;
    console.log(`${id}: ${sourceTriangles} -> ${record.triangles} triangles, ${record.bytes} B`);
    fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`); // resumable after each model
  }
  fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(TABLE, `${JSON.stringify(table, null, 1)}\n`);
  console.log(`lod1: built ${built}, up to date ${skipped}, too small ${tiny}; ${(addedBytes / 1e6).toFixed(2)} MB total`);
}

main().catch(error => { console.error(error); process.exit(1); });
