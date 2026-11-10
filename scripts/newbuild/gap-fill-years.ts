/**
 * Years for the OSM new-build gap fills (lane newbuild-kit-20261110): `fill-new-build-gaps.ts` draws OSM outlines with a
 * `start_date` from 2015 on into the building tiles under their OSM id (`w…`), but no building-facts row carried the
 * year, so the grammar drew them as undated houses (1860-1914 style; census: Sluisbuurt 10 outlines against 2 BAG
 * pands, Overhoeks 18 against 24). This adds `[year, -1, 0]` rows to the building-facts tiles for every OSM-id feature
 * the tiles draw that has no dated row yet and whose way carries a plausible `start_date`.
 *
 * Source: the same Overpass query as fill-new-build-gaps.ts, through the scrape store (offline once fetched; the
 * Sep-2026 OSM export that build-building-facts.ts reads predates these ways' start_date). A row with a
 * year is never touched; tiles and rows are otherwise byte-identical (same JSON order, gzip level 9).
 *
 *   node --import tsx scripts/newbuild/gap-fill-years.ts            # report only
 *   node --import tsx scripts/newbuild/gap-fill-years.ts --publish  # write the facts tiles
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { cachedJson } from '../lib/cachedFetch.ts';
import { plausibleYear, yearFromStartDate } from '../../src/canalRecall/buildingFacts.ts';

const BBOX = '52.28,4.72,52.43,5.08';
const QUERY = `[out:json][timeout:240];way["building"]["start_date"~"^(201[5-9]|202[0-9])"](${BBOX});out tags geom;`;
const OVERPASS = 'https://maps.mail.ru/osm/tools/overpass/api/interpreter';
const ROOT = 'public/data/extracts/amsterdam';
const publish = process.argv.includes('--publish');

const answer = await cachedJson<{ elements: Array<{ type: string; id: number; tags?: Record<string, string> }> }>(
  OVERPASS, { method: 'POST', body: new URLSearchParams({ data: QUERY }).toString(), contentType: 'application/x-www-form-urlencoded' });
const years = new Map<string, number>();
for (const e of answer.elements) {
  const year = e.type === 'way' ? yearFromStartDate(e.tags?.start_date) : null;
  if (year !== null && plausibleYear(year)) years.set(`w${e.id}`, year);
}

const gz = (file: string) => JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8'));
let added = 0, tilesTouched = 0, dated = 0;
const byYear: Record<number, number> = {};
const tileRoot = path.join(ROOT, 'building-tiles', '14');
for (const x of fs.readdirSync(tileRoot).sort()) for (const f of fs.readdirSync(path.join(tileRoot, x)).sort()) {
  if (!f.endsWith('.geojson.gz')) continue;
  const ids = (gz(path.join(tileRoot, x, f)).features as Array<{ properties: { id?: unknown } }>).map(ft => String(ft.properties.id ?? '')).filter(id => years.has(id));
  if (!ids.length) continue;
  const factsFile = path.join(ROOT, 'building-facts', '14', x, f.replace('.geojson.gz', '.json.gz'));
  const tile = fs.existsSync(factsFile) ? gz(factsFile) : { version: 1, buildings: {} };
  let changed = false;
  for (const id of ids) {
    const row = tile.buildings[id];
    if (row && plausibleYear(row[0])) { dated++; continue; }
    const year = years.get(id)!;
    tile.buildings[id] = row ? [year, ...row.slice(1)] : [year, -1, 0];
    byYear[year] = (byYear[year] ?? 0) + 1; added++; changed = true;
  }
  if (changed) {
    tilesTouched++;
    if (publish) { fs.mkdirSync(path.dirname(factsFile), { recursive: true }); fs.writeFileSync(factsFile, zlib.gzipSync(JSON.stringify(tile), { level: 9 })); }
  }
}
console.log(`OSM ways with a start_date: ${years.size}; drawn and already dated: ${dated}; rows added: ${added} in ${tilesTouched} tiles${publish ? '' : ' (report only: --publish writes)'}`);
console.log('by year', byYear);
