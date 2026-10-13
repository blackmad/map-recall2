/**
 * One-time material-slot inference for the legacy landmark GLBs
 * (docs/plans/digital-twin-direction-20261013.md §7 GLB cleanup goal 2; src/canalRecall/look/materialSlotInference.ts).
 *
 *   npx tsx scripts/landmarks/infer-material-slots.ts                      # dry run: coverage before/after per model, ambiguous materials
 *   npx tsx scripts/landmarks/infer-material-slots.ts --id=westerkerk,rijksmuseum
 *   npx tsx scripts/landmarks/infer-material-slots.ts --write              # write patched GLBs to the staging dir (default artifacts/material-slots/glb)
 *   npx tsx scripts/landmarks/infer-material-slots.ts --write --in-place   # overwrite public/canal-drive/models (integrator only)
 *   npx tsx scripts/landmarks/infer-material-slots.ts --file=path/to.glb --write --in-place   # a new export from a draft script
 *   flags: --out=artifacts/material-slots  --no-lod (skip *.lod1.glb siblings)
 *
 * The write patches only the GLB's JSON chunk: each material without a slot gets
 * `extras: {materialSlot, tint, materialSlotSource: 'inferred'}`. The BIN chunk is copied byte for byte (no meshopt
 * re-encode, no quantisation change), so geometry is untouched. Inferred slots take part only under `?cityLook=1`
 * (signature-landmarks-source.js `_dress`, recipeLook.ts), so a rewritten GLB renders identically with the flag off.
 * The report keeps every original's SHA-256 so a rewrite can be verified or reverted.
 *
 * Unlit (KHR_materials_unlit) materials are left as they are: decals and printed signs stay outside the lit look.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {INFERRED_SLOT_SOURCE, inferMaterialSlot, linearToSrgbHex, type SlotInference} from '../../src/canalRecall/look/materialSlotInference';
import {materialSlotCoverage} from '../../src/canalRecall/landmarks/glbQuality';
import {loadMaterialSoup} from './material-soup';

const ROOT = path.resolve(import.meta.dirname, '../..');
const MODELS = path.join(ROOT, 'public/canal-drive/models');

const arg = (name: string) => process.argv.find(x => x.startsWith(`--${name}=`))?.slice(name.length + 3);
const flag = (name: string) => process.argv.includes(`--${name}`);

type GltfMaterial = {name?: string; extras?: Record<string, unknown>; extensions?: Record<string, unknown>; alphaMode?: string; pbrMetallicRoughness?: {baseColorFactor?: number[]}};

/** Split a GLB into its JSON object and the raw bytes after the JSON chunk. */
export function readGlb(bytes: Buffer): {json: {materials?: GltfMaterial[]} & Record<string, unknown>; rest: Buffer} {
  if (bytes.readUInt32LE(0) !== 0x46546c67) throw Error('not a GLB');
  const jsonLength = bytes.readUInt32LE(12);
  if (bytes.readUInt32LE(16) !== 0x4e4f534a) throw Error('first chunk is not JSON');
  return {json: JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8')), rest: bytes.subarray(20 + jsonLength)};
}

/** Reassemble a GLB from a JSON object and the untouched chunks that followed the JSON chunk. */
export function writeGlb(json: object, rest: Buffer): Buffer {
  let text = Buffer.from(JSON.stringify(json), 'utf8');
  const pad = (4 - (text.length % 4)) % 4;
  if (pad) text = Buffer.concat([text, Buffer.alloc(pad, 0x20)]);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(20 + text.length + rest.length, 8);
  header.writeUInt32LE(text.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([header, text, rest]);
}

/** What inference would write for one glTF material (null: authored already, or unlit). */
export function inferenceFor(m: GltfMaterial): (SlotInference & {skipped?: string}) | null {
  if (m.extras && typeof m.extras.materialSlot === 'string') return null;
  if (m.extensions?.KHR_materials_unlit) return null;
  const [r, g, b] = m.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1, 1];
  return inferMaterialSlot(m.name, linearToSrgbHex(r, g, b));
}

/** Patch a GLB's materials with inferred slots; returns the new bytes and what changed. */
export function patchGlb(bytes: Buffer): {bytes: Buffer; changed: {name: string; inference: SlotInference}[]} {
  const {json, rest} = readGlb(bytes);
  const changed: {name: string; inference: SlotInference}[] = [];
  for (const m of json.materials ?? []) {
    const inference = inferenceFor(m);
    if (!inference) continue;
    m.extras = {...(m.extras ?? {}), materialSlot: inference.slot, tint: inference.tint, materialSlotSource: INFERRED_SLOT_SOURCE};
    changed.push({name: m.name ?? 'unnamed', inference});
  }
  return {bytes: changed.length ? writeGlb(json, rest) : bytes, changed};
}

function listTargets(): {id: string; file: string}[] {
  const file = arg('file');
  if (file) return [{id: path.basename(file, '.glb'), file: path.resolve(file)}];
  const catalogue = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/canalRecall/landmarks/manualCatalogue.json'), 'utf8')) as {id: string; modelUrl: string}[];
  const sig = JSON.parse(fs.readFileSync(path.join(MODELS, 'signature-landmarks.json'), 'utf8')).models as Record<string, {modelUrl: string}>;
  const all = new Map<string, string>();
  for (const [id, m] of Object.entries(sig)) all.set(id, m.modelUrl);
  for (const c of catalogue) all.set(c.id, c.modelUrl);
  let ids = [...all.keys()].sort();
  const only = arg('id');
  if (only) ids = only.split(',');
  return ids.map(id => ({id, file: path.join(MODELS, (all.get(id) ?? `./models/${id}.glb`).replace(/^\.\/models\//, ''))})).filter(t => fs.existsSync(t.file));
}

const sha = (b: Buffer) => crypto.createHash('sha256').update(b).digest('hex');
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

async function main(): Promise<void> {
  const out = path.resolve(ROOT, arg('out') ?? 'artifacts/material-slots');
  const write = flag('write'), inPlace = flag('in-place');
  const glbOut = inPlace ? null : path.join(out, 'glb');
  fs.mkdirSync(out, {recursive: true});
  if (glbOut && write) fs.mkdirSync(glbOut, {recursive: true});
  const rows: any[] = [];
  const ambiguous = new Map<string, {name: string; slot: string; rule: string; confidence: string; models: Set<string>; area: number}>();
  for (const t of listTargets()) {
    const original = fs.readFileSync(t.file);
    const soup = await loadMaterialSoup(t.file);
    const before = materialSlotCoverage(soup);
    const {json} = readGlb(original);
    const inferred = (json.materials ?? []).map(inferenceFor);
    const after = materialSlotCoverage({...soup, materials: soup.materials.map((m, i) => inferred[i] ? {...m, materialSlot: inferred[i]!.slot, tint: inferred[i]!.tint, materialSlotSource: INFERRED_SLOT_SOURCE} : m)});
    const areaOf = new Map(after.materials.map(m => [m.name, m.area]));
    for (const [i, inf] of inferred.entries()) {
      if (!inf || inf.confidence === 'name') continue;
      const name = json.materials![i].name ?? 'unnamed', key = `${name.toLowerCase().replace(/[-_.\s]*\d+$/, '')}→${inf.slot}`;
      const entry = ambiguous.get(key) ?? {name, slot: inf.slot, rule: inf.rule, confidence: inf.confidence, models: new Set<string>(), area: 0};
      entry.models.add(t.id); entry.area += areaOf.get(name) ?? 0;
      ambiguous.set(key, entry);
    }
    const files: {file: string; sha256: string; patchedSha256?: string; changed: number}[] = [];
    const lod = t.file.replace(/\.glb$/, '.lod1.glb');
    for (const file of [t.file, ...(!flag('no-lod') && fs.existsSync(lod) ? [lod] : [])]) {
      const bytes = file === t.file ? original : fs.readFileSync(file);
      const patched = patchGlb(bytes);
      const record: (typeof files)[number] = {file: path.relative(ROOT, file), sha256: sha(bytes), changed: patched.changed.length};
      if (patched.changed.length) record.patchedSha256 = sha(patched.bytes);
      if (write && patched.changed.length) fs.writeFileSync(inPlace ? file : path.join(glbOut!, path.basename(file)), patched.bytes);
      files.push(record);
    }
    rows.push({id: t.id, before: +before.coverage.toFixed(4), after: +after.coverage.toFixed(4), areaM2: +after.area.toFixed(1), exemptM2: +after.exemptArea.toFixed(1),
      materials: after.materials.map(m => ({...m, rule: inferred[soup.materials.findIndex(x => x.name === m.name)]?.rule})), files});
  }
  const mean = (k: 'before' | 'after') => rows.reduce((s, r) => s + r[k], 0) / Math.max(1, rows.length);
  const areaWeighted = (k: 'before' | 'after') => rows.reduce((s, r) => s + r[k] * (r.areaM2 - r.exemptM2), 0) / Math.max(1e-9, rows.reduce((s, r) => s + r.areaM2 - r.exemptM2, 0));
  const full = rows.filter(r => r.after >= 0.9999).length;
  const summary = {generated: new Date().toISOString(), mode: write ? (inPlace ? 'write in place' : `write to ${path.relative(ROOT, glbOut!)}`) : 'dry run', models: rows.length,
    coverageBefore: {mean: +mean('before').toFixed(4), areaWeighted: +areaWeighted('before').toFixed(4)},
    coverageAfter: {mean: +mean('after').toFixed(4), areaWeighted: +areaWeighted('after').toFixed(4), modelsAt100: full},
    ambiguous: [...ambiguous.values()].sort((a, b) => b.area - a.area).map(a => ({...a, models: a.models.size, area: +a.area.toFixed(0)}))};
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({...summary, rows}, null, 1));
  const md = [
    '# Material slot inference', '',
    `${summary.mode}; ${rows.length} landmark GLBs (+ lod1 siblings in the file list).`, '',
    `Coverage (share of lit surface area whose material carries materialSlot + tint): before mean ${pct(summary.coverageBefore.mean)} (area-weighted ${pct(summary.coverageBefore.areaWeighted)}), after mean ${pct(summary.coverageAfter.mean)} (area-weighted ${pct(summary.coverageAfter.areaWeighted)}); ${full} of ${rows.length} models at 100 %.`, '',
    '## Ambiguous materials (colour words and colour-only guesses)', '', '| material | → slot | rule | models | area m² |', '|---|---|---|---|---|',
    ...summary.ambiguous.map(a => `| ${a.name} | ${a.slot} | ${a.rule} | ${a.models} | ${a.area} |`), '',
    '## Per model', '', '| id | before | after | area m² | largest materials (slot) |', '|---|---|---|---|---|',
    ...rows.map(r => `| ${r.id} | ${pct(r.before)} | ${pct(r.after)} | ${r.areaM2} | ${r.materials.slice(0, 4).map((m: any) => `${m.name} ${pct(m.share)} → ${m.slot ?? (m.exempt ? 'unlit' : '—')}`).join(', ')} |`),
  ].join('\n') + '\n';
  fs.writeFileSync(path.join(out, 'summary.md'), md);
  console.log(`${summary.mode}: ${rows.length} models; coverage before ${pct(summary.coverageBefore.mean)} → after ${pct(summary.coverageAfter.mean)} (area-weighted ${pct(summary.coverageBefore.areaWeighted)} → ${pct(summary.coverageAfter.areaWeighted)}); ${full} at 100 %; ${ambiguous.size} ambiguous material kinds. Wrote ${path.relative(ROOT, out)}/report.json and summary.md`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('infer-material-slots.ts')) await main();
