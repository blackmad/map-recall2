/**
 * BAG use of every generic kit's pand (GitHub #37): the pand's bouwjaar, status and gebruiksdoel, and each live
 * verblijfsobject's use and floor area, from the PDOK BAG OGC API (open data). Responses are cached under
 * .cache/bag-pand-uses/<pand>.json so a rerun is offline.
 *
 *   node --import tsx scripts/landmarks/fetch-kit-pand-uses.ts [--pands=id,id] [--out=tmp/kit-pands/pand-uses.json]
 *
 * Default pands: every generic worship and public kit's BAG pand (direct ids, and the pands kit-pands.json joins
 * their OSM parts to). The summary feeds src/canalRecall/kitTypeOverrides.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { WORSHIP_BUILDINGS } from '../../src/canalRecall/worshipBuildingData.ts';
import { PUBLIC_BUILDINGS } from '../../src/canalRecall/publicBuildingData.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const CACHE = path.join(ROOT, '.cache/bag-pand-uses');
const API = 'https://api.pdok.nl/kadaster/bag/ogc/v2/collections';
const out = path.resolve(ROOT, arg('out', 'tmp/kit-pands/pand-uses.json'));

const kitPands = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/extracts/amsterdam/kit-pands.json'), 'utf8')).ids as Record<string, { pand: string | null }>;
const pandOf = (id: string) => id.startsWith('NL.IMBAG.Pand.') ? id.slice(14) : kitPands[id]?.pand ?? null;
const pands = arg('pands') ? arg('pands').split(',') : [...new Set([...WORSHIP_BUILDINGS, ...PUBLIC_BUILDINGS].map(e => pandOf(e[0])).filter(Boolean) as string[])];

async function get(url: string): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'map-recall/1.0 (kit pand uses)' } });
    if (r.ok) return r.json();
    if (attempt >= 4) throw new Error(`${r.status} ${url}`);
    await new Promise(res => setTimeout(res, 2000 * (attempt + 1)));
  }
}

type Use = { pand: string; year: number | null; status: string; uses: string; vbos: number; area: Record<string, number> };
async function usesOf(pand: string): Promise<Use | null> {
  const file = path.join(CACHE, `${pand}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const p = (await get(`${API}/pand/items?identificatie=${pand}&f=json`)).features?.[0];
  if (!p) return null;
  const area: Record<string, number> = {};
  let vbos = 0;
  for (const href of (p.properties['verblijfsobject.href'] ?? []) as string[]) {
    const v = (await get(`${href}?f=json`)).properties;
    if (!/in gebruik|gevormd|verbouwing/i.test(v.status)) continue;
    vbos++;
    for (const use of String(v.gebruiksdoel ?? 'unknown').split(',')) area[use.trim()] = (area[use.trim()] ?? 0) + (Number(v.oppervlakte) || 0) / String(v.gebruiksdoel ?? '').split(',').length;
  }
  const use: Use = { pand, year: p.properties.bouwjaar ?? null, status: p.properties.status, uses: p.properties.gebruiksdoel ?? '', vbos, area };
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(use));
  return use;
}

const results: Record<string, Use | null> = {};
const queue = [...pands];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) { const p = queue.shift()!; try { results[p] = await usesOf(p); } catch (e) { console.log(`  ${p}: ${(e as Error).message}`); } }
}));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(results, null, 1) + '\n');
console.log(`pand uses: ${Object.keys(results).length} of ${pands.length} pands -> ${path.relative(ROOT, out)}`);
