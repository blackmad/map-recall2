/**
 * Supermarket chains: which building holds which chain's store, so its ground floor gets that
 * chain's shopfront (fascia colour, logo block, wide glazing) and reads as an Albert Heijn or
 * a Jumbo from the street.
 *
 *   npx tsx scripts/build-supermarkets.ts            # fetch (or reuse), write the staging file, report
 *   npx tsx scripts/build-supermarkets.ts --publish  # also merge into the published shopfronts extract
 *
 * Overpass answers are kept in the scrape store (scripts/lib/scrapeStore.ts), one record per
 * query, and reused: a rerun only fetches a query it has never stored. Each OSM supermarket
 * (node, or a way/relation by its centre) lands on the building that is the same OSM way, else
 * the footprint containing it, else the nearest footprint edge within 8 m. The chain comes from
 * brand:wikidata, brand or name (SUPERMARKET_CHAINS); independents keep the generic shop.
 * Publishing sets those buildings' shopfront to the shop window and writes `chains` into
 * public/data/extracts/amsterdam/shopfronts.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { readScrape, writeScrape } from './lib/scrapeStore.ts';
import { loadGroundBuildings, local } from './lib/groundBuildings.ts';
import { chainForTags, SUPERMARKET_CHAINS, type ShopfrontExtract } from '../src/canalRecall/shopfronts.ts';

const BBOX = '52.28,4.75,52.43,5.05';
const STAGING = 'tmp/shopfronts/supermarkets.json', PUBLISHED = 'public/data/extracts/amsterdam/shopfronts.json';
const QUERIES = [
  `[out:json][timeout:60];nwr["shop"="supermarket"](${BBOX});out center tags;`,
  // Chain convenience stores (AH to go, Spar city, Jumbo City) carry the same fascia.
  `[out:json][timeout:60];nwr["shop"="convenience"]["brand"](${BBOX});out center tags;`,
];
const ENDPOINT = 'https://maps.mail.ru/osm/tools/overpass/api/interpreter';

type Element = { type: 'node' | 'way' | 'relation'; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags: Record<string, string> };
async function overpass(query: string): Promise<Element[]> {
  // POST bodies are keyed by the endpoint plus the encoded body, as the other Overpass scrapes are.
  const key = new URL(`${ENDPOINT}#body=${encodeURIComponent(new URLSearchParams({ data: query }).toString())}`);
  const stored = await readScrape<{ elements: Element[] }>(key);
  if (stored) return stored.body.elements;
  let last: Error | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'map-recall/1.0 (Canal Recall supermarkets)' }, body: new URLSearchParams({ data: query }) });
      if (!response.ok) throw new Error(`Overpass ${response.status}`);
      const json = await response.json() as { elements: Element[] };
      await writeScrape(key, json);
      return json.elements;
    } catch (error) {
      last = error as Error;
      console.warn(`  ${last.message}; retrying`);
      await new Promise(resolve => setTimeout(resolve, 5000 * (attempt + 1)));
    }
  }
  throw last ?? new Error('Overpass unavailable');
}

const elements = new Map<string, Element>();
for (const query of QUERIES) for (const e of await overpass(query)) elements.set(`${e.type}/${e.id}`, e);
const { byId, hostOf } = loadGroundBuildings();

const chains: NonNullable<ShopfrontExtract['chains']> = {};
const perChain = new Map<string, { stores: number; matched: number }>();
const unmatched: string[] = [], hows = { way: 0, inside: 0, edge: 0 };
let independents = 0, upstairs = 0, shared = 0;
for (const e of elements.values()) {
  const chain = chainForTags(e.tags);
  if (!chain) { independents++; continue; }
  if (Number(e.tags.level) > 0) { upstairs++; continue; }
  const stat = perChain.get(chain) ?? { stores: 0, matched: 0 }; perChain.set(chain, stat); stat.stores++;
  const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
  if (lat === undefined || lon === undefined) continue;
  const at: [number, number] = [Math.round(lon * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6];
  // A way that is itself the building (supermarket drawn as building=retail) matches by id.
  let id = e.type === 'way' && byId.has(`w${e.id}`) ? `w${e.id}` : null;
  if (id) hows.way++;
  else {
    const [x, y] = local(lon, lat), host = hostOf(x, y, 8);
    if (host) { id = host.b.id; hows[host.how]++; }
  }
  if (!id) { unmatched.push(`${chain} ${e.type}/${e.id} ${e.tags.name ?? ''} @${at.join(',')}`); continue; }
  // Two stores in one building (an AH and an AH to go in a mall): the first keeps it.
  if (chains[id]) { shared++; continue; }
  chains[id] = [chain, at[0], at[1]];
  stat.matched++;
}

const text = JSON.stringify({ version: 1, chains });
fs.mkdirSync(path.dirname(STAGING), { recursive: true });
fs.writeFileSync(STAGING, text);
const stores = [...perChain.values()].reduce((s, c) => s + c.stores, 0), matched = Object.keys(chains).length;
console.log(`${elements.size} OSM supermarkets and chain convenience stores; ${independents} independents, ${upstairs} upstairs`);
console.log(`${stores} chain stores: ${stores - unmatched.length} placed (${hows.way} by way id, ${hows.inside} inside a footprint, ${hows.edge} within 8 m of one) on ${matched} buildings (${shared} share a building with another branch), ${unmatched.length} with no building within 8 m`);
for (const [chain, s] of [...perChain].sort((a, b) => b[1].stores - a[1].stores)) console.log(`  ${SUPERMARKET_CHAINS[chain].name.padEnd(16)} ${String(s.matched).padStart(4)} / ${s.stores}`);
if (unmatched.length) console.log('unmatched:\n  ' + unmatched.join('\n  '));
if (process.argv.includes('--publish')) {
  const extract = JSON.parse(fs.readFileSync(PUBLISHED, 'utf8')) as ShopfrontExtract;
  const window = extract.kinds.indexOf('shopWindow');
  if (window < 0) throw new Error('published extract has no shopWindow kind');
  // A chain store's ground floor is its shop window, unless the POI pass found a café or food shop there too.
  const generic = extract.kinds.indexOf('groundShop');
  for (const id of Object.keys(chains)) if (extract.buildings[id] === undefined || extract.buildings[id] === generic) extract.buildings[id] = window;
  extract.chains = chains;
  fs.writeFileSync(PUBLISHED, JSON.stringify(extract));
  console.log(`published ${matched} chain stores -> ${PUBLISHED}`);
}
