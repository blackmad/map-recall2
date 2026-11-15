/**
 * Chain logos for every Amsterdam chain with 3+ shop POIs (lane retail-real-20261115). The chain list is counted from
 * the template Overpass cache (.cache/retail-ground/overpass.json: shop/amenity nodes at ground level, grouped by brand
 * or name). For a chain with brand:wikidata the logo is the item's P154 (logo image) on Wikimedia Commons, rendered to
 * PNG by Commons; the licence comes from Commons' metadata. Chains without one take a manual source from
 * data/retail-ground/chain-logo-sources.json ({key: {url, page?, licence?}}; David 2026-11-15: web sources allowed with
 * source URL and fetch date). Writes data/retail-ground/chain-logos/<key>.png and provenance.json there.
 *   node --import tsx scripts/retail-real/fetch-chain-logos.ts [--min=3] [--only=lidl,aldi] [--refetch]
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const MIN = Number(arg('min') ?? 3), only = arg('only')?.split(','), refetch = process.argv.includes('--refetch');
const UA = 'MapRecall/1.0 (+https://github.com/blackmad/map-recall2)';
const OUT = 'data/retail-ground/chain-logos', PROV = path.join(OUT, 'provenance.json');
fs.mkdirSync(OUT, { recursive: true });
const prov: Record<string, Record<string, unknown>> = fs.existsSync(PROV) ? JSON.parse(fs.readFileSync(PROV, 'utf8')) : {};
const manual: Record<string, { url: string; page?: string; licence?: string }> = Object.assign({}, ...['data/retail-ground/chain-logo-sources-wiki.json', 'data/retail-ground/chain-logo-sources.json'].filter(f => fs.existsSync(f)).map(f => JSON.parse(fs.readFileSync(f, 'utf8'))));

export const chainKey = (name: string) => name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const SKIP_AMENITY = new Set(['parking', 'bank', 'atm', 'money', 'post_box', 'bicycle_parking', 'charging_station', 'car_sharing', 'vending_machine', 'parcel_locker', 'toilets', 'fuel', 'car_rental', 'post_office', 'dentist', 'doctors', 'clinic', 'school', 'kindergarten', 'place_of_worship', 'library', 'community_centre', 'social_facility', 'bicycle_rental', 'brothel']);
const SKIP_SHOP = new Set(['storage_rental', 'ticket', 'kiosk', 'vacant', 'car', 'car_repair', 'tyres', 'funeral_directors', 'travel_agency', 'trade', 'wholesale']);
type Chain = { key: string; name: string; n: number; wikidata: string; kinds: Record<string, number>; names: Record<string, number> };
const els = (JSON.parse(fs.readFileSync('.cache/retail-ground/overpass.json', 'utf8')) as { elements: Array<{ tags?: Record<string, string> }> }).elements;
const chains = new Map<string, Chain>();
for (const e of els) {
  const t = e.tags ?? {}, kind = t.shop ?? t.amenity;
  if (!kind || (!t.shop && SKIP_AMENITY.has(t.amenity)) || SKIP_SHOP.has(t.shop ?? '') || Number(t.level) > 0) continue;
  const name = (t.brand ?? t.name ?? '').trim(); if (!name) continue;
  const key = chainKey(name), c = chains.get(key) ?? { key, name, n: 0, wikidata: '', kinds: {}, names: {} };
  c.n++; c.kinds[kind] = (c.kinds[kind] ?? 0) + 1; if (t.name) c.names[t.name] = (c.names[t.name] ?? 0) + 1;
  if (t['brand:wikidata'] && !c.wikidata) c.wikidata = t['brand:wikidata'];
  chains.set(key, c);
}
const list = [...chains.values()].filter(c => c.n >= MIN && (!only || only.includes(c.key))).sort((a, b) => b.n - a.n);
fs.writeFileSync('data/retail-ground/chains-counted.json', JSON.stringify(list, null, 0));
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function get(url: string): Promise<Response> {
  for (let k = 0; k < 4; k++) { const r = await fetch(url, { headers: { 'User-Agent': UA } }); if (r.status !== 429 && r.status < 500) return r; await sleep(2000 * (k + 1)); }
  return fetch(url, { headers: { 'User-Agent': UA } });
}
let got = 0, none = 0;
for (const c of list) {
  const file = path.join(OUT, `${c.key}.png`);
  if (fs.existsSync(file) && !refetch) { got++; continue; }
  const m = manual[c.key];
  try {
    if (m) {
      const r = await get(m.url); if (!r.ok) throw new Error(`${r.status}`);
      // Normalise SVG, WebP and JPEG sources to a PNG about 640 px wide (an SVG rasterised at a density that gets there).
      const raw = Buffer.from(await r.arrayBuffer()), svg = /<svg[\s>]/i.test(raw.subarray(0, 2000).toString('utf8'));
      const meta = await sharp(raw).metadata(), density = svg && meta.width ? Math.min(2400, Math.max(72, 72 * 640 / meta.width)) : undefined;
      await sharp(raw, density ? { density } : {}).resize({ width: 640, withoutEnlargement: !svg }).png().toFile(file);
      prov[c.key] = { name: c.name, pois: c.n, source: m.page ?? m.url, renderUrl: m.url, licence: m.licence ?? 'trademark logo; source web page', fetched: new Date().toISOString().slice(0, 10) };
      got++; continue;
    }
    if (!c.wikidata) { none++; continue; }
    const wd = await (await get(`https://www.wikidata.org/wiki/Special:EntityData/${c.wikidata}.json`)).json() as { entities: Record<string, { claims?: Record<string, Array<{ mainsnak: { datavalue?: { value: string } } }>> }> };
    const ent = Object.values(wd.entities)[0], logo = ent?.claims?.P154?.[0]?.mainsnak.datavalue?.value;
    if (!logo) {
      // Fallback: the lead image of the brand's Dutch or English Wikipedia article when its file name says logo (a
      // non-free logo is hosted by that wiki, not Commons; web sources are allowed since 2026-11-15).
      const links = (ent as unknown as { sitelinks?: Record<string, { title: string }> }).sitelinks ?? {};
      let done = false;
      for (const wiki of ['nlwiki', 'enwiki']) {
        const t = links[wiki]?.title; if (!t) continue;
        const host = `https://${wiki.slice(0, 2)}.wikipedia.org`;
        const pj = await (await get(`${host}/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail|name&pithumbsize=640&titles=${encodeURIComponent(t)}`)).json() as { query: { pages: Record<string, { pageimage?: string; thumbnail?: { source: string } }> } };
        const pg = Object.values(pj.query.pages)[0];
        if (!pg?.pageimage || !pg.thumbnail || !/logo|beeldmerk/i.test(pg.pageimage)) continue;
        const r = await get(pg.thumbnail.source); if (!r.ok) continue;
        fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
        prov[c.key] = { name: c.name, pois: c.n, wikidata: c.wikidata, file: `File:${pg.pageimage}`, source: `${host}/wiki/File:${encodeURIComponent(pg.pageimage)}`, article: `${host}/wiki/${encodeURIComponent(t)}`, renderUrl: pg.thumbnail.source,
          licence: 'trademark logo (Wikipedia non-free or PD-textlogo file)', fetched: new Date().toISOString().slice(0, 10) };
        got++; done = true; break;
      }
      if (!done) { none++; console.log(`no P154: ${c.key} (${c.wikidata}, ${c.n})`); }
      continue;
    }
    const title = `File:${logo}`;
    const info = await (await get(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|sha1|extmetadata&iiurlwidth=640&titles=${encodeURIComponent(title)}`)).json() as { query: { pages: Record<string, { imageinfo?: Array<{ thumburl: string; url: string; descriptionurl: string; sha1: string; extmetadata?: Record<string, { value: string }> }> }> } };
    const ii = Object.values(info.query.pages)[0]?.imageinfo?.[0];
    if (!ii) { none++; console.log(`no imageinfo: ${c.key} ${title}`); continue; }
    const r = await get(ii.thumburl ?? ii.url); if (!r.ok) throw new Error(`render ${r.status}`);
    fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    const md = ii.extmetadata ?? {};
    prov[c.key] = { name: c.name, pois: c.n, wikidata: c.wikidata, file: title, source: ii.descriptionurl, renderUrl: ii.thumburl ?? ii.url, sha1: ii.sha1,
      licence: md.LicenseShortName?.value ?? null, artist: (md.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim() || null, fetched: new Date().toISOString().slice(0, 10) };
    got++;
    await sleep(300);
  } catch (err) { none++; console.log(`fail ${c.key}: ${(err as Error).message}`); }
}
fs.writeFileSync(PROV, JSON.stringify(prov, null, 1));
console.log(`${list.length} chains with >= ${MIN} POIs (${list.reduce((t, c) => t + c.n, 0)} POIs); logos ${got}, missing ${none}`);
