/** Prints the Batch 1 measurements table rows from artifacts/sculpture-reconstruction/<id>/source.json: node --import tsx scripts/sculptures/batch-table.ts */
import fs from 'node:fs';
const root = 'artifacts/sculpture-reconstruction';
for (const id of fs.readdirSync(root).sort()) {
  const f = `${root}/${id}/source.json`;
  if (!fs.existsSync(f)) continue;
  const s = JSON.parse(fs.readFileSync(f, 'utf8'));
  const k = fs.statSync(`docs/images/sculptures/${id}.jpg`, {throwIfNoEntry: false})?.size ?? 0;
  console.log([id, s.photo.title, String(s.photo.author).slice(0, 32), s.photo.licence, s.timingsS.networkTotalS, s.result.triangles,
    `${s.settings.rembg}${s.settings.box ? ' box' : ''}${s.settings.kitPlinth ? ' kit-plinth' : ''}`, `${Math.round(k / 1024)} KB`].join(' | '));
}
