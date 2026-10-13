// Collect every Wikimedia Commons photo of a sculpture with its licence and
// author, download the admitted ones outside the repo, and write the
// provenance index the reconstruction and the docs read.
//
//   node --import tsx scripts/sculptures/fetch-commons.ts dokwerker
//
// Config: scripts/sculptures/<id>/config.json ({ categories, depth, outDir }).
// Output: scripts/sculptures/<id>/sources.json (committed) and the images in
// `outDir/images/` (not committed; archived to map-recall2-source-data).
// Open data only: CC0 / PD / CC BY / CC BY-SA. Anything else is listed as
// rejected with its licence so the decision is visible.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { admitLicence } from '../../src/canalRecall/sculptures/licences.js';

const id = process.argv[2];
if (!id) throw new Error('usage: fetch-commons.ts <sculpture id>');
const dir = path.join('scripts/sculptures', id);
const config = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));
const outDir = (config.outDir as string).replace(/^~/, os.homedir());
const UA = 'MapRecall-sculptures/1.0 (open-data research)';
const API = 'https://commons.wikimedia.org/w/api.php';

async function api(params: Record<string, string>): Promise<any> {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return res.json();
    if (attempt > 4) throw new Error(`${res.status} ${url}`);
    await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
  }
}

async function categoryFiles(root: string, depth: number): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  const seen = new Set<string>();
  const walk = async (cat: string, d: number) => {
    if (seen.has(cat)) return;
    seen.add(cat);
    let cont: string | undefined;
    do {
      const r = await api({ action: 'query', list: 'categorymembers', cmtitle: cat, cmtype: 'file|subcat', cmlimit: '500', ...(cont ? { cmcontinue: cont } : {}) });
      for (const m of r.query.categorymembers) {
        if (m.ns === 6 && !files.has(m.title)) files.set(m.title, cat);
        else if (m.ns === 14 && d > 0) await walk(m.title, d - 1);
      }
      cont = r.continue?.cmcontinue;
    } while (cont);
  };
  await walk(root, depth);
  return files;
}

const strip = (s: unknown) => String(s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

const titles = new Map<string, string>();
for (const cat of config.categories as string[]) for (const [t, c] of await categoryFiles(cat, config.depth ?? 1)) titles.set(t, c);
for (const t of config.extraFiles ?? []) titles.set(t, 'search (manual)');

const records: any[] = [];
const list = [...titles.keys()];
for (let i = 0; i < list.length; i += 40) {
  const r = await api({ action: 'query', prop: 'imageinfo|coordinates', titles: list.slice(i, i + 40).join('|'), iiprop: 'url|size|sha1|extmetadata|mime', iiurlwidth: '2000', coprop: 'type|dim', coprimary: 'all' });
  for (const p of r.query.pages) {
    const ii = p.imageinfo?.[0];
    if (!ii) continue;
    const md = ii.extmetadata || {};
    const licence = strip(md.LicenseShortName?.value) || strip(md.License?.value);
    const verdict = admitLicence(licence);
    const camera = (p.coordinates || []).find((c: any) => c.primary === false) || (p.coordinates || [])[0] || null;
    records.push({
      title: p.title,
      commons: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`,
      category: titles.get(p.title),
      licence, licenceUrl: strip(md.LicenseUrl?.value) || null, admitted: verdict.admitted, ...(verdict.admitted ? {} : { rejectReason: verdict.reason }),
      author: strip(md.Artist?.value) || null, credit: strip(md.Credit?.value) || null,
      date: strip(md.DateTimeOriginal?.value).slice(0, 10) || null,
      mime: ii.mime, originalSize: [ii.width, ii.height], sha1: ii.sha1,
      downloadUrl: ii.thumburl || ii.url,
      cameraLatLon: camera ? [camera.lat, camera.lon] : null,
    });
  }
}
records.sort((a, b) => a.title.localeCompare(b.title));
fs.mkdirSync(path.join(outDir, 'images'), { recursive: true });
// `--cache <index.json>` ({ title: path }): adopt images already on disk (an
// earlier run, the 2026-10-09 pilot) instead of downloading them again.
// Commons rate-limits upload.wikimedia.org hard (429, retry-after 600 s).
const cacheArg = process.argv.indexOf('--cache');
const cache: Record<string, string> = cacheArg > 0 ? JSON.parse(fs.readFileSync(process.argv[cacheArg + 1], 'utf8')) : {};
let n = 0;
for (const rec of records) {
  if (!rec.admitted || !/^image\/(jpeg|png|tiff)/.test(rec.mime)) { rec.local = null; continue; }
  const cached = cache[rec.title];
  rec.local = cached ? `images/${path.basename(cached)}` : `images/c${String(n++).padStart(3, '0')}.jpg`;
  const target = path.join(outDir, rec.local);
  if (fs.existsSync(target)) continue;
  if (cached) { fs.copyFileSync(cached, target); rec.localNote = 'pilot cache: Commons thumbnail (1280–1920 px), resized to ≤1200 px'; continue; }
  let res = await fetch(rec.downloadUrl, { headers: { 'User-Agent': UA } });
  // upload.wikimedia.org rate-limits bursts with 429; back off and retry.
  for (let attempt = 1; res.status === 429 && attempt <= 6; attempt++) {
    await new Promise(r => setTimeout(r, 5000 * attempt));
    res = await fetch(rec.downloadUrl, { headers: { 'User-Agent': UA } });
  }
  if (!res.ok) { rec.local = null; rec.downloadError = res.status; continue; }
  fs.writeFileSync(target, Buffer.from(await res.arrayBuffer()));
  await new Promise(r => setTimeout(r, 1200));
}
const out = path.join(dir, 'sources.json');
const prev = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : {};
fs.writeFileSync(out, JSON.stringify({
  ...prev, statue: config.statue, landmarkId: config.landmarkId, osm: config.osm, fetched: new Date().toISOString().slice(0, 10),
  note: 'Provenance index. Images are not committed; they live in outDir/images (archived to map-recall2-source-data). `local` paths are relative to that folder.',
  outDir: config.outDir, categories: config.categories, commons: records,
}, null, 1) + '\n');
const admitted = records.filter(r => r.local);
console.log(`${records.length} files, ${admitted.length} admitted and downloaded, ${records.filter(r => !r.admitted).length} rejected by licence`);
