/** Publish model visual judgements, retaining exact source bindings and abstentions. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
const root = 'public/data/signage/v1';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sampleBytes = fs.readFileSync(`${root}/sample.json`), sample = JSON.parse(sampleBytes);
const sampleSha256 = sha(sampleBytes), entries = new Map(sample.entries.map(e => [e.id, e]));
const labels = {};
for (const file of process.argv.slice(2)) {
  const part = JSON.parse(fs.readFileSync(file));
  if (part.sampleSha256 !== sampleSha256) throw Error(`Stale sample: ${file}`);
  for (const [id, row] of Object.entries(part.labels)) {
    const entry = entries.get(id);
    if (!entry || row.id !== id || row.reviewOrigin !== 'model-visual-review' || !row.reviewer || row.reviewed !== true) throw Error(`Invalid model review: ${id}`);
    if (row.sourceSha256 !== sha(fs.readFileSync(path.join(root, 'crops', entry.crop)))) throw Error(`Stale crop: ${id}`);
    if (labels[id] && JSON.stringify(labels[id]) !== JSON.stringify(row)) throw Error(`Conflicting reviews: ${id}`);
    if (!Array.isArray(row.signs) || (row.noSign && row.signs.length)) throw Error(`Contradictory signs: ${id}`);
    for (const sign of row.signs) {
      if (![sign.left,sign.top,sign.width,sign.height].every(Number.isFinite) || sign.left < 0 || sign.top < 0 || sign.width <= 0 || sign.height <= 0 || sign.left+sign.width > entry.widthPx || sign.top+sign.height > entry.heightPx) throw Error(`Invalid sign rectangle: ${id}`);
      if (!['fascia','blade','window','awning','logo','gevelsteen'].includes(sign.type) || typeof sign.text !== 'string' || typeof sign.readable !== 'boolean') throw Error(`Invalid sign: ${id}`);
      if ([sign.bg,sign.fg].some(colour => colour != null && !/^#[a-f0-9]{6}$/i.test(colour))) throw Error(`Invalid colour: ${id}`);
    }
    labels[id] = row;
  }
}
if (Object.keys(labels).length !== entries.size) throw Error(`Incomplete review: ${Object.keys(labels).length}/${entries.size} unique frontages`);
const payload = {schemaVersion:1,kind:'signage/labels',sampleSha256,reviewOrigin:'model-visual-review',labelledAt:new Date().toISOString(),note:'Model visual judgements, not human gold. Unreadable text and occluded frontages remain uncertain. Colour samples describe these dated pixels.',labels};
fs.writeFileSync(`${root}/model-review.json`,JSON.stringify(payload,null,2)+'\n');
console.log(`Published ${entries.size} model-reviewed frontages (${sample.entries.length} sample rows), ${Object.values(labels).reduce((n,row)=>n+row.signs.length,0)} sign regions.`);
