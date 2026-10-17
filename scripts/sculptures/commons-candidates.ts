/**
 * Candidate photos of a statue on Wikimedia Commons: list the files of its categories (and their direct subcategories), keep the
 * admitted licences, download small thumbnails politely and number them on one contact sheet for picking side views.
 *
 *   node --import tsx scripts/sculptures/commons-candidates.ts --id=lieverdje [--max=56] [--thumb=360]
 *   node --import tsx scripts/sculptures/commons-candidates.ts --search="Teun de Jager"     (category search only, prints titles)
 *
 * Categories come from `scripts/sculptures/rebuild-20261017.json` (`statues.<id>.categories`). Output (gitignored):
 * `artifacts/sculpture-reconstruction/<id>/candidates/{candidates.json, sheet.jpg, thumbs/<sha1>.jpg}`. The sheet numbers match the
 * `n` field of candidates.json, which records title, author, licence, size and date. Commons answers 429 quickly from this
 * address; every request honours retry-after and requests are spaced by --gap ms (default 1200).
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {admitLicence} from '../../src/canalRecall/sculptures/licences.js';

const argv = process.argv.slice(2);
const arg = (k: string, d = '') => argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const UA = {'User-Agent': 'map-recall-sculpture-research/1.0 (open-data prototype)'};
const API = 'https://commons.wikimedia.org/w/api.php';
const gap = Number(arg('gap', '1200'));
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
let last = 0;

async function get(url: string): Promise<Response> {
  for (let i = 0; ; i++) {
    const wait = last + gap - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    const res = await fetch(url, {headers: UA});
    if (res.ok) return res;
    if (i > 10 || (res.status !== 429 && res.status < 500)) throw new Error(`${res.status} ${url}`);
    await sleep(Math.max(Number(res.headers.get('retry-after') ?? 0) * 1000 + 500, 4000 * (i + 1)));
  }
}
const api = async (p: Record<string, string>) => (await get(`${API}?${new URLSearchParams({format: 'json', formatversion: '2', ...p})}`)).json() as Promise<any>;
const clean = (s: unknown) => String(s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

if (arg('search')) {
  const d = await api({action: 'query', list: 'search', srnamespace: '14', srlimit: '10', srsearch: arg('search')});
  for (const r of d.query.search) console.log(r.title);
  process.exit(0);
}

const id = arg('id');
if (!id) throw new Error('--id or --search required');
const cfg = JSON.parse(fs.readFileSync('scripts/sculptures/rebuild-20261017.json', 'utf8')).statues[id];
if (!cfg?.categories?.length) throw new Error(`no categories for ${id} in rebuild-20261017.json`);
const max = Number(arg('max', '56')), thumbW = Number(arg('thumb', '360'));
const out = `artifacts/sculpture-reconstruction/${id}/candidates`;
fs.mkdirSync(path.join(out, 'thumbs'), {recursive: true});

async function members(cat: string, type: string): Promise<string[]> {
  const titles: string[] = [];
  let cont: Record<string, string> = {};
  for (;;) {
    const d = await api({action: 'query', list: 'categorymembers', cmtitle: cat, cmtype: type, cmlimit: '200', ...cont});
    titles.push(...d.query.categorymembers.map((m: any) => m.title));
    if (!d.continue) return titles;
    cont = {cmcontinue: d.continue.cmcontinue};
  }
}
const cats = [...cfg.categories];
if (cfg.subcategories !== false) for (const c of cfg.categories) cats.push(...(await members(c, 'subcat')).filter(s => !(cfg.skipCategories ?? []).includes(s)));
const files = [...new Set((await Promise.all(cats.map(async c => members(c, 'file')))).flat())]
  .filter(t => /\.(jpe?g|png|tiff?)$/i.test(t));
const rows: any[] = [];
for (let i = 0; i < files.length; i += 40) {
  const d = await api({action: 'query', titles: files.slice(i, i + 40).join('|'), prop: 'imageinfo', iiprop: 'url|extmetadata|size|sha1', iiurlwidth: String(thumbW)});
  for (const p of d.query.pages) {
    const ii = p.imageinfo?.[0]; if (!ii) continue;
    const m = ii.extmetadata ?? {};
    const licence = clean(m.LicenseShortName?.value);
    const v = admitLicence(licence);
    rows.push({title: p.title, pageUrl: ii.descriptionurl, author: clean(m.Artist?.value), licence, admitted: v.admitted,
      date: clean(m.DateTimeOriginal?.value ?? m.DateTime?.value).slice(0, 10), size: [ii.width, ii.height], thumbUrl: ii.thumburl, sha1: ii.sha1});
  }
}
// Prefer admitted photos from 1990 on, then undated ones (mostly modern uploads without EXIF), then older; large first within a band.
const band = (r: any) => { const y = Number(/\b(1[6-9]\d\d|20\d\d)\b/.exec(r.date)?.[1] ?? 0); return y >= 1990 ? 0 : y === 0 ? 1 : 2; };
const ok = rows.filter(r => r.admitted && Math.min(...r.size) >= 600)
  .sort((a, b) => band(a) - band(b) || (b.date || '0').localeCompare(a.date || '0') || b.size[0] * b.size[1] - a.size[0] * a.size[1]).slice(0, max);
ok.forEach((r, n) => (r.n = n));
const tiles: sharp.OverlayOptions[] = [];
const W = 240, H = 240, cols = 8;
for (const r of ok) {
  const f = path.join(out, 'thumbs', `${String(r.sha1).slice(0, 10)}.jpg`);
  if (!fs.existsSync(f)) fs.writeFileSync(f, Buffer.from(await (await get(r.thumbUrl)).arrayBuffer()));
  const img = await sharp(f).resize(W, H, {fit: 'contain', background: '#222'}).toBuffer();
  const label = Buffer.from(`<svg width="${W}" height="26"><rect width="64" height="26" fill="#000"/><text x="6" y="20" font-size="18" font-family="sans-serif" fill="#ff0">${r.n}</text></svg>`);
  const x = (r.n % cols) * W, y = Math.floor(r.n / cols) * H;
  tiles.push({input: img, left: x, top: y}, {input: label, left: x, top: y});
}
if (tiles.length) {
  await sharp({create: {width: cols * W, height: Math.ceil(ok.length / cols) * H, channels: 3, background: '#111'}}).composite(tiles).jpeg({quality: 80}).toFile(path.join(out, 'sheet.jpg'));
}
fs.writeFileSync(path.join(out, 'candidates.json'), JSON.stringify({id, categories: cats, total: rows.length, admitted: rows.filter(r => r.admitted).length,
  rejected: rows.filter(r => !r.admitted).map(r => ({title: r.title, licence: r.licence})), candidates: ok}, null, 1));
console.log(JSON.stringify({id, categories: cats.length, files: rows.length, shown: ok.length, sheet: path.join(out, 'sheet.jpg')}));
