// The crop D1 would read for each pand of an id list (the step-2 pilot buurt), chosen exactly as sample.ts does
// (describe.ts cropCandidates + tier.ts bestCrop, least-flagged fallback), copied to <out>/<pandId>.jpg with crops.json.
//
//   node --import tsx scripts/house-specs/describer-d1/crops-for.ts <ids.txt> <outDir>
// Reads the source-data archive only.
import fs from 'node:fs';
import path from 'node:path';
import { chooseCrop, cropBytes, hasCrop } from './sample.ts';

const [idsFile, out] = process.argv.slice(2);
if (!idsFile || !out) { console.error('usage: crops-for.ts <ids.txt> <outDir>'); process.exit(2); }
fs.mkdirSync(out, { recursive: true });
const rows: Record<string, unknown>[] = [];
for (const id of fs.readFileSync(idsFile, 'utf8').split(/\s+/).filter(Boolean)) {
  const c = hasCrop(id) ? chooseCrop(id) : null;
  const rel = c ? (c.file === 'front.jpg' ? 'front.jpg' : c.file.replace(/^.*pand-crops\/\d{16}\//, '')) : null;
  const bytes = c && rel ? cropBytes(id, rel) ?? cropBytes(id, 'front.jpg') : null;
  if (!c || !bytes) { rows.push({ pandId: id, crop: null }); continue; }
  fs.writeFileSync(path.join(out, `${id}.jpg`), bytes);
  rows.push({ pandId: id, ref: `source-data://pand-crops/${id}/${rel}`, tier: c.tier, year: c.year, gate: c.reasons.length ? 'fail' : 'pass', reasons: c.reasons });
}
fs.writeFileSync(path.join(out, 'crops.json'), `${JSON.stringify({ v: 1, rows }, null, 1)}\n`);
const n = (g: string) => rows.filter(r => r.gate === g).length;
console.log(`crops: ${rows.length} pands, gate-pass ${n('pass')}, gate-fail ${n('fail')}, no crop ${rows.filter(r => r.crop === null).length}`);
