/**
 * Write the builders' explicit material slots (material-slot-tags.ts) into the shipped landmark GLBs and their lod1.
 *
 *   npx tsx scripts/landmarks/apply-material-slot-tags.ts            # dry run: what would change
 *   npx tsx scripts/landmarks/apply-material-slot-tags.ts --write    # patch public/canal-drive/models in place
 *   npx tsx scripts/landmarks/apply-material-slot-tags.ts --check    # exit 1 when a shipped GLB lacks its tag
 *
 * --write also refreshes the model's modelAssetVersions.json fingerprint (sha256 of the GLB, as build-manual-landmarks.ts
 * writes it), so cached copies are dropped; then `npm run build:landmark-lods` re-exports lod1 from the patched GLB.
 *
 * JSON chunk only (infer-material-slots.ts readGlb/writeGlb): the BIN chunk is copied byte for byte, so geometry,
 * covers and footprints do not move. Models without tags are not opened for writing.
 */
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {readGlb, writeGlb} from './infer-material-slots';
import {INFERRED_SLOT_SOURCE, linearToSrgbHex} from '../../src/canalRecall/look/materialSlotInference';
import {MATERIAL_SLOT_TAG, MATERIAL_SLOT_TAGS} from './material-slot-tags';

const MODELS = path.resolve(import.meta.dirname, '../../public/canal-drive/models');
const VERSIONS = path.resolve(import.meta.dirname, '../../src/canalRecall/landmarks/modelAssetVersions.json');
const versions = JSON.parse(fs.readFileSync(VERSIONS, 'utf8')) as Record<string, string>;
let stale = 0;
const write = process.argv.includes('--write'), check = process.argv.includes('--check');
let missing = 0, changed = 0;
for (const [id, tags] of Object.entries(MATERIAL_SLOT_TAGS)) {
  for (const file of [`${id}.glb`, `${id}.lod1.glb`].map(f => path.join(MODELS, f)).filter(f => fs.existsSync(f))) {
    const {json, rest} = readGlb(fs.readFileSync(file));
    const seen = new Set<string>();
    let dirty = false;
    for (const m of (json.materials ?? []) as {name?: string; extras?: Record<string, unknown>; pbrMetallicRoughness?: {baseColorFactor?: number[]}}[]) {
      const tag = m.name ? tags[m.name] : undefined;
      if (!tag) continue;
      seen.add(m.name!);
      const [r, g, b] = m.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1];
      const want = {materialSlot: tag.slot, tint: linearToSrgbHex(r, g, b), materialSlotSource: INFERRED_SLOT_SOURCE, materialSlotTag: MATERIAL_SLOT_TAG};
      const ex = m.extras ?? {};
      if (Object.entries(want).every(([k, v]) => ex[k] === v)) continue;
      console.log(`${path.basename(file)} ${m.name}: ${ex.materialSlot ?? '-'} -> ${tag.slot} (${tag.why})`);
      m.extras = {...ex, ...want};
      dirty = true;
    }
    // lod1 may simplify a small material away; only the full model must carry every tag.
    if (!file.endsWith('.lod1.glb')) for (const name of Object.keys(tags)) if (!seen.has(name)) { console.log(`${path.basename(file)}: no material named ${name}`); missing++; }
    if (dirty) { changed++; if (write) fs.writeFileSync(file, writeGlb(json, rest)); }
  }
}
for (const id of Object.keys(MATERIAL_SLOT_TAGS)) {
  const file = path.join(MODELS, `${id}.glb`);
  if (!fs.existsSync(file) || !(id in versions)) continue;
  const fingerprint = createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16);
  if (versions[id] === fingerprint) continue;
  if (write) versions[id] = fingerprint; else stale++;
}
if (write) fs.writeFileSync(VERSIONS, JSON.stringify(versions, null, 2) + '\n');
if (stale) console.log(`${stale} modelAssetVersions fingerprint(s) out of date`);
console.log(`${changed} GLB(s) ${write ? 'patched' : check ? 'out of date' : 'would change'}${missing ? `; ${missing} tag(s) name a material the GLB lacks` : ''}`);
if (check && (changed || missing || stale)) process.exit(1);
