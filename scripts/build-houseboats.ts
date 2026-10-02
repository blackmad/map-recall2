/**
 * Houseboat footprints for Canal Recall's three.js houseboat generator.
 *
 *   npx tsx scripts/build-houseboats.ts            # fetch, write the staging file, report
 *   npx tsx scripts/build-houseboats.ts --publish  # also publish into the versioned extract
 *
 * Source: OpenStreetMap `building=houseboat` ways (plus `boathouse` and floating buildings)
 * in the Amsterdam bounding box, via Overpass. The building tiles carry only ~55 of the
 * ~3,000 mapped houseboats, so they get their own small extract.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const BBOX = '52.28,4.75,52.43,5.05';
const STAGING = 'tmp/houseboats/houseboats.json';
const PUBLISHED = 'public/data/extracts/amsterdam/houseboats.json';
const QUERY = `[out:json][timeout:120];(way["building"="houseboat"](${BBOX});way["building"="boathouse"](${BBOX});way["building"]["floating"="yes"](${BBOX}););out tags geom;`;

type Way = { id: number; tags: Record<string, string>; geometry?: { lat: number; lon: number }[] };

async function fetchWays(): Promise<Way[]> {
  // Overpass answers 406 to an anonymous client; mirrors and retries absorb 504/429 blips.
  const endpoints = ['https://overpass.kumi.systems/api/interpreter', 'https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
  let last: Error | null = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const endpoint = endpoints[attempt % endpoints.length];
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'map-recall/1.0 (Canal Recall houseboats)' }, body: new URLSearchParams({ data: QUERY }) });
      if (!response.ok) throw new Error(`Overpass ${response.status} from ${endpoint}`);
      return (await response.json()).elements as Way[];
    } catch (error) {
      last = error as Error;
      console.warn(`  ${last.message}; retrying`);
      await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
    }
  }
  throw last ?? new Error('Overpass unavailable');
}

const ways = await fetchWays();
const round = (v: number) => Math.round(v * 1e6) / 1e6;
const boats = ways.filter(w => (w.geometry?.length ?? 0) >= 4).map(w => {
  const t = w.tags, levels = Number(t['building:levels']);
  return {
    id: `w${w.id}`,
    ring: w.geometry!.map(p => [round(p.lon), round(p.lat)]),
    ...(Number.isFinite(levels) && levels > 0 ? { levels } : {}),
    ...(t['roof:shape'] ? { roof: t['roof:shape'] } : {}),
    ...(t.name ? { name: t.name } : {}),
    ...(t.building !== 'houseboat' ? { kind: t.building } : {}),
  };
});
const out = { version: 1, source: 'OpenStreetMap building=houseboat (+boathouse, floating=yes) via Overpass', attribution: '© OpenStreetMap contributors, ODbL 1.0', bbox: BBOX, fetched: new Date().toISOString().slice(0, 10), boats };
const text = JSON.stringify(out);
mkdirSync(dirname(STAGING), { recursive: true });
writeFileSync(STAGING, text);
const vertexCounts = boats.map(b => b.ring.length - 1);
console.log(`${boats.length} houseboats (${ways.length} ways), ${boats.filter(b => b.levels).length} with levels, ${boats.filter(b => b.roof).length} with roof shape; rectangles ${vertexCounts.filter(n => n === 4).length}, traced hulls (>8 vertices) ${vertexCounts.filter(n => n > 8).length}; ${(text.length / 1024).toFixed(0)} KB -> ${STAGING}`);
if (process.argv.includes('--publish')) {
  writeFileSync(PUBLISHED, text);
  console.log(`published -> ${PUBLISHED}`);
}
