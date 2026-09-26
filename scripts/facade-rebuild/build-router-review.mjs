/** Prepare a deduplicated, local-only classification queue from current photo studies. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
const out = path.resolve('.cache/facade-rebuild/router-review');
await fs.mkdir(path.join(out, 'images'), { recursive: true });
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const roots = ['dino-base-city-variety-raw-01', 'dino-base-pilot-study-02', 'dino-base-expansion-study-02'];
const items = [], seen = new Set();
for (const run of roots) {
  const root = path.resolve('public/canal-drive/facade-photo-review/local', run);
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'manifest.json')));
  for (const record of manifest.records) {
    const s = record.source;
    if (seen.has(s.pandId)) continue;
    let bytes;
    try { bytes = await fs.readFile(path.join(root, record.image ?? s.file)); }
    catch (e) { if (e.code === 'ENOENT') { console.log(`Missing cached image, omitted: ${record.id}`); continue; } throw e; }
    if (sha(bytes) !== record.sourceSha256) throw Error(`Changed source: ${record.id}`);
    seen.add(s.pandId);
    const id = `${s.pandId}-${record.sourceSha256.slice(0, 12)}`;
    const full = `${id}.jpg`, ground = `${id}-ground.jpg`;
    const metadata = await sharp(bytes).metadata();
    await fs.writeFile(path.join(out, 'images', full), bytes);
    const top = Math.floor(metadata.height * .55);
    const groundBytes = await sharp(bytes).extract({ left: 0, top, width: metadata.width, height: metadata.height - top }).jpeg({ quality: 92 }).toBuffer();
    await fs.writeFile(path.join(out, 'images', ground), groundBytes);
    // Shared street OR camera mission is a conservative group; unioned below.
    const street = !s.address?.startsWith('BAG ') ? s.address?.replace(/\s+\d.*$/, '').toLowerCase() : null;
    const mission = s.panoramaId?.split('_pano_')[0] ?? s.panoramaId;
    items.push({ id, pandId: s.pandId, sourceSha256: record.sourceSha256, image: full, groundImage: ground, groundSha256: sha(groundBytes),
      sourceRun: run, address: s.address, capturedAt: s.capturedAt, panoramaId: s.panoramaId, street, mission,
      geometry: { widthM: s.wallWidthM, heightM: s.topZ - s.groundZ, year: s.constructionYear ?? null },
      classificationOnly: true });
  }
}
const parent = items.map((_, i) => i);
function find(i) { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; }
for (let i = 0; i < items.length; i++) for (let j = 0; j < i; j++) {
  if ((items[i].street && items[i].street === items[j].street) || (items[i].mission && items[i].mission === items[j].mission)) parent[find(i)] = find(j);
}
for (let i = 0; i < items.length; i++) items[i].group = 'group-' + items[find(i)].pandId;
const tasks = {
  shopfront: { title: 'Is there a shopfront?', help: 'Look for a shop, café, restaurant or commercial display at street level. A house can have a shop underneath. Choose “Can’t tell” when the ground floor is hidden or missing.', choices: [['yes', 'Yes'], ['no', 'No'], ['unclear', 'Can’t tell']] },
  awning: { title: 'Is there an awning?', help: 'A projecting fabric canopy attached to the building. Ignore cornices, umbrellas and market stalls. Choose “Can’t tell” if the frontage is hidden.', choices: [['yes', 'Yes'], ['no', 'No'], ['unclear', 'Can’t tell']] },
  visibility: { title: 'How much of the shown façade is blocked?', help: 'Judge the wall shown in this crop. Trees, vehicles and stalls count as obstructions. A roof outside the crop does not.', choices: [['clear', 'Mostly clear'], ['partial', 'Partly blocked'], ['severe', 'Mostly blocked'], ['unclear', 'Can’t tell']] },
  family: { title: 'Which broad building family fits?', help: 'Choose the visible architecture. Ground-floor business use is a separate question. Use “Can’t tell” for mixed or ambiguous crops.', choices: [['traditional-house', 'Traditional narrow house'], ['apartment-row', 'Apartment row / block'], ['institutional', 'Institution / church'], ['industrial', 'Warehouse / workshop'], ['modern', 'Modern infill / cladding'], ['other', 'Other'], ['unclear', 'Can’t tell']] },
};
const manifest = { schemaVersion: 1, datasetId: sha(JSON.stringify(items)), generatedAt: new Date().toISOString(), tasks, items,
  attribution: 'Panoramabeelden Gemeente Amsterdam, CC BY 4.0',
  note: `${items.length}-image development seed; mostly central Amsterdam. Labels describe pictured crops and do not certify geometry or building identity. Shared street/camera-mission groups reduce leakage; additional geographically held-out neighbourhoods are required before deployment.` };
await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ out, images: items.length, groups: new Set(items.map(i => i.group)).size, datasetId: manifest.datasetId }));
