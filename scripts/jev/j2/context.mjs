/**
 * J3 (#377): one text line per pand for the Gemini "+address" variant: street, house number and buurt from the open Amsterdam BAG API
 * (api.data.amsterdam.nl, no key). Cached in <cache>/address.json: {pandId: "line"}. node scripts/jev/j2/context.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {CACHE} from './lib.mjs';
const file = path.join(CACHE, 'address.json');
const get = async u => { for (let i = 0; i < 4; i++) { try { const r = await fetch(u); if (r.ok) return r.json(); } catch {} await new Promise(r => setTimeout(r, 1500)); } return null; };
export async function addressFor(p, cache) {
  if (cache[p]) return cache[p];
  const pand = await get(`https://api.data.amsterdam.nl/v1/bag/panden/${p}/`);
  const buurt = pand?._links?.ligtInBuurt?.title ?? pand?.ligtInBuurt?.title;
  const vbo = pand?._links?.bevatVerblijfsobjecten?.[0]?.identificatie ?? pand?.bevatVerblijfsobjecten?.[0]?.identificatie;
  let addr = null;
  if (vbo) { const v = await get(`https://api.data.amsterdam.nl/v1/bag/verblijfsobjecten/${vbo}/`); const na = v?.heeftHoofdadresId ?? v?._links?.heeftHoofdadres?.identificatie;
    if (na) { const n = await get(`https://api.data.amsterdam.nl/v1/bag/nummeraanduidingen/${na}/`); const street = n?._links?.ligtAanOpenbareruimte?.title; if (street) addr = `${street} ${n.huisnummer}${n.huisletter ?? ''}${n.huisnummertoevoeging ? '-' + n.huisnummertoevoeging : ''}`; } }
  cache[p] = addr && buurt ? `Address: ${addr}, ${buurt}, Amsterdam.` : addr ? `Address: ${addr}, Amsterdam.` : '';
  return cache[p];
}
if (import.meta.url === `file://${process.argv[1]}`) {
  let cache = {}; try { cache = JSON.parse(await fs.readFile(file, 'utf8')); } catch {}
  const sets = JSON.parse(await fs.readFile(path.join(CACHE, 'sets.json'), 'utf8'));
  const j1 = JSON.parse(await fs.readFile('/Users/blackmad/Code/map-recall2/.cache/jev-facades/set.json', 'utf8')).map(c => c.pandId);
  const pairs = JSON.parse(await fs.readFile(path.join(CACHE, 'pairs.json'), 'utf8')).map(p => p.pand);
  const triples = JSON.parse(await fs.readFile(path.join(CACHE, 'triples.json'), 'utf8')).map(t => t.pand);
  const all = [...new Set([...sets.A, ...sets.B, ...j1, ...pairs, ...triples])];
  for (const p of all) await addressFor(p, cache);
  await fs.writeFile(file, JSON.stringify(cache, null, 1));
  console.log(all.length, 'pands;', Object.values(cache).filter(Boolean).length, 'with an address line');
}
