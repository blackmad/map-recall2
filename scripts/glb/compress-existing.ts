/**
 * One-off (and re-runnable) re-encode of installed GLBs: quantize + meshopt, in place.
 *
 *   node --import tsx scripts/glb/compress-existing.ts --dir=public/canal-drive/models/ordinary-buildings/chunks           (dry run)
 *   node --import tsx scripts/glb/compress-existing.ts --dir=public/canal-drive/models/ordinary-buildings --write
 *
 * Per file: triangles must be unchanged and every vertex's world position must move by at most 1 cm.
 * A file that fails either check is left as it is and listed. Files already meshopt-compressed are skipped.
 * Prints a table: file, bytes before, bytes after, triangles, max position delta (m), verdict.
 * Writing also refreshes the manifests named by --manifest=<a.json,b.json> (chunks.json and catalogue.json):
 * every entry whose modelUrl points at a rewritten file gets the new sha256 and bytes (and a new ?asset= stamp
 * where the entry has one). Each manifest keeps its own indentation.
 */
import fs from 'node:fs';
import path from 'node:path';
import {Document} from '@gltf-transform/core';
import {compressGlb, describeInstalledGlb, glbIO} from '../../src/canalRecall/glb/compressGlb.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const dir = arg('dir');
if (!dir) throw Error('--dir=<directory of .glb files> is required');
const write = process.argv.includes('--write');
const MAX_DELTA_M = 0.01;
const manifests = (arg('manifest') ?? '').split(',').filter(Boolean);

/** Triangles and world-space positions per primitive, in document order. Nodes are assumed un-parented (chunk and house GLBs are). */
function worldPrimitives(doc: Document) {
  const out: {tris: number; positions: Float64Array[]}[] = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    if (node.getParentNode()) throw Error(`node ${node.getName()} has a parent; the checker assumes flat nodes`);
    const m = node.getMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION')!, idx = prim.getIndices();
      const count = pos.getCount(), positions = new Float64Array(count * 3);
      for (let i = 0; i < count; i++) {
        const [x, y, z] = pos.getElement(i, [0, 0, 0]);
        positions.set([m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]], i * 3);
      }
      out.push({tris: (idx ? idx.getCount() : count) / 3, positions: [positions]});
    }
  }
  return out;
}

const usesMeshopt = (doc: Document) => doc.getRoot().listExtensionsUsed().some(e => e.extensionName === 'EXT_meshopt_compression');

async function main() {
  const io = await glbIO();
  const files = fs.readdirSync(dir!).filter(f => f.endsWith('.glb')).sort();
  const rows: string[] = [];
  const totals = {before: 0, after: 0, passed: 0, skipped: 0, failed: [] as string[]};
  const beforeSizes: number[] = [], afterSizes: number[] = [];
  const rewritten = new Map<string, Uint8Array>();
  for (const file of files) {
    const full = path.join(dir!, file), original = new Uint8Array(fs.readFileSync(full));
    const src = await io.readBinary(original);
    if (usesMeshopt(src)) { totals.skipped++; rows.push(`${file}\t${original.length}\t-\t-\t-\tskip (already meshopt)`); continue; }
    const packed = await compressGlb(original);
    const out = await io.readBinary(packed);
    const a = worldPrimitives(src), b = worldPrimitives(out);
    let verdict = 'pass', maxDelta = 0;
    if (a.length !== b.length) verdict = 'FAIL primitive count';
    const trisA = a.reduce((s, p) => s + p.tris, 0), trisB = b.reduce((s, p) => s + p.tris, 0);
    if (verdict === 'pass' && trisA !== trisB) verdict = `FAIL triangles ${trisA} -> ${trisB}`;
    for (let k = 0; verdict === 'pass' && k < a.length; k++) {
      const pa = a[k].positions[0], pb = b[k].positions[0];
      if (pa.length !== pb.length) { verdict = 'FAIL vertex count'; break; }
      for (let i = 0; i < pa.length; i++) maxDelta = Math.max(maxDelta, Math.abs(pa[i] - pb[i]));
    }
    if (verdict === 'pass' && maxDelta > MAX_DELTA_M) verdict = `FAIL position delta ${maxDelta.toFixed(4)} m`;
    totals.before += original.length;
    if (verdict !== 'pass') { totals.failed.push(file); totals.after += original.length; rows.push(`${file}\t${original.length}\t${packed.length}\t${trisA}\t${maxDelta.toFixed(4)}\t${verdict} (left uncompressed)`); continue; }
    totals.passed++; totals.after += packed.length; beforeSizes.push(original.length); afterSizes.push(packed.length);
    rows.push(`${file}\t${original.length}\t${packed.length}\t${trisA}\t${maxDelta.toFixed(4)}\tpass`);
    if (write) { fs.writeFileSync(full, packed); rewritten.set(file, packed); }
  }
  for (const manifest of manifests) refreshManifest(manifest, rewritten);
  console.log(['file', 'bytes before', 'bytes after', 'triangles', 'max pos delta (m)', 'verdict'].join('\t'));
  console.log(rows.join('\n'));
  const median = (xs: number[]) => { const s = [...xs].sort((p, q) => p - q); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  console.log(`\n${write ? 'WRITTEN' : 'DRY RUN (no files changed; add --write)'}: ${totals.passed} compressed, ${totals.skipped} already meshopt, ${totals.failed.length} left uncompressed`);
  console.log(`total ${totals.before} -> ${totals.after} bytes over compressed files; median ${median(beforeSizes)} -> ${median(afterSizes)}`);
  if (totals.failed.length) console.log(`left uncompressed: ${totals.failed.join(', ')}`);
  if (write) console.log(`manifests refreshed: ${manifests.join(', ') || 'none (pass --manifest=)'}`);
}

/** Re-describe every manifest entry whose modelUrl names a rewritten file. The indent of the file is kept. */
function refreshManifest(file: string, rewritten: Map<string, Uint8Array>) {
  const text = fs.readFileSync(file, 'utf8');
  const doc = JSON.parse(text);
  const render = (n: number) => (n ? JSON.stringify(doc, null, n) : JSON.stringify(doc)) + '\n';
  const indent = [1, 2, 0].find(n => render(n) === text) ?? 1;
  let changed = 0;
  const visit = (entry: any) => {
    if (!entry || typeof entry.modelUrl !== 'string') return;
    const name = entry.modelUrl.split('?')[0].split('/').pop();
    const packed = rewritten.get(name);
    if (!packed) return;
    const next = describeInstalledGlb(entry, packed);
    Object.assign(entry, {sha256: next.sha256, bytes: next.bytes, modelUrl: entry.modelUrl.includes('?asset=') ? next.modelUrl : entry.modelUrl});
    changed++;
  };
  for (const key of ['chunks', 'models']) if (Array.isArray(doc[key])) doc[key].forEach(visit);
  fs.writeFileSync(file, render(indent));
  console.log(`manifest ${file}: ${changed} entries re-described`);
}

main().catch(e => { console.error(e); process.exit(1); });
