#!/usr/bin/env node
// Fetch Wikimedia Commons reference photos with their licence record (landmark lanes: model from open photos, never from meshes).
//   node scripts/landmarks/commons-ref.mjs --id=<landmark id> [--width=1600] "File:A.jpg" "File:B.jpg" ...
//   node scripts/landmarks/commons-ref.mjs --search="Rembrandtplein standbeeld" [--limit=30]
// Images go to artifacts/landmark-refs/<id>/ (not committed); the licence record is written next to them and is meant to be
// summarised into the landmark's inventory/spec attribution (author, licence, url).
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d = '') => args.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const UA = 'MapRecall-LandmarkRefs/1.0 (https://github.com/blackmad/map-recall2; open-data reference photos)';
const api = async params => {
  const url = `https://commons.wikimedia.org/w/api.php?format=json&${new URLSearchParams(params)}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch(url, {headers: {'User-Agent': UA}});
    if (r.status === 429) { await new Promise(s => setTimeout(s, 4000 * (attempt + 1))); continue; }
    return r.json();
  }
  throw new Error('rate limited');
};
if (opt('search')) {
  const d = await api({action: 'query', list: 'search', srsearch: opt('search'), srnamespace: '6', srlimit: opt('limit', '30')});
  for (const m of d.query.search) console.log(m.title);
  process.exit(0);
}
const id = opt('id');
if (!id) { console.error('--id=<landmark id> required'); process.exit(2); }
const width = opt('width', '1600');
const dir = path.resolve('artifacts/landmark-refs', id);
fs.mkdirSync(dir, {recursive: true});
const recordFile = path.join(dir, 'licences.json');
const records = fs.existsSync(recordFile) ? JSON.parse(fs.readFileSync(recordFile, 'utf8')) : {};
for (const title of args.filter(a => !a.startsWith('--'))) {
  const d = await api({action: 'query', titles: title, prop: 'imageinfo', iiprop: 'url|extmetadata|size', iiurlwidth: width});
  const page = Object.values(d.query.pages)[0], info = page.imageinfo?.[0];
  if (!info) { console.log('no imageinfo', title); continue; }
  const m = info.extmetadata ?? {};
  const strip = s => (s?.value ?? '').replace(/<[^>]+>/g, '').trim();
  const file = title.replace(/^File:/, '').replace(/[^\w.-]+/g, '_');
  const r = await fetch(info.thumburl ?? info.url, {headers: {'User-Agent': UA}});
  if (!r.ok) { console.log('download failed', title, r.status); continue; }
  fs.writeFileSync(path.join(dir, file), Buffer.from(await r.arrayBuffer()));
  records[file] = {title, page: info.descriptionurl, author: strip(m.Artist), licence: strip(m.LicenseShortName), licenceUrl: strip(m.LicenseUrl), credit: strip(m.Credit), date: strip(m.DateTimeOriginal), size: [info.width, info.height]};
  console.log(file, '|', records[file].licence, '|', records[file].author.slice(0, 60));
  await new Promise(s => setTimeout(s, 1200));
}
fs.writeFileSync(recordFile, JSON.stringify(records, null, 1) + '\n');
