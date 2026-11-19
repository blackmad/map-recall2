// piers-v1: OSM man_made=pier ways in the city box, for the own ground's pier decks (src/canalRecall/ownGround/piers.ts,
// feedback ee2b30 at the Haparandadam). One Overpass query; staging first, then --publish.
//
//   npx tsx scripts/own-ground/fetch-piers.ts                      # Overpass → artifacts/own-ground/staging/piers-v1/piers.json.gz
//   npx tsx scripts/own-ground/fetch-piers.ts --from raw.json      # an Overpass JSON already fetched (out tags geom)
//   npx tsx scripts/own-ground/fetch-piers.ts --publish            # also copy into public/data/extracts/amsterdam/piers-v1/
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { CITY_BOX } from '../../src/canalRecall/streetFurniture/extract.ts';
import type { PierRecord, PiersExtract } from '../../src/canalRecall/ownGround/piers.ts';

const STAGING = 'artifacts/own-ground/staging/piers-v1';
const PUBLISHED = 'public/data/extracts/amsterdam/piers-v1';
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const [w, s, e, n] = CITY_BOX;
const QUERY = `[out:json][timeout:180];way["man_made"="pier"](${s},${w},${n},${e});out tags geom;`;

async function fetchRaw(): Promise<any> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = ENDPOINTS[attempt % ENDPOINTS.length];
    try {
      const res = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: QUERY }), headers: { 'User-Agent': 'map-recall2 (https://github.com/blackmad/map-recall2)' } });
      if (res.ok) return await res.json();
      console.warn(`${url}: HTTP ${res.status}`);
    } catch (error) { console.warn(`${url}: ${String(error).slice(0, 120)}`); }
    await new Promise(r => setTimeout(r, 5000 * (attempt + 1)));
  }
  throw new Error('Overpass: no answer');
}

export function toRecords(raw: { elements: any[] }): { piers: PierRecord[]; skipped: Record<string, number> } {
  const piers: PierRecord[] = [], skipped: Record<string, number> = {};
  const skip = (why: string) => { skipped[why] = (skipped[why] ?? 0) + 1; };
  const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
  for (const el of raw.elements) {
    if (el.type !== 'way' || el.tags?.man_made !== 'pier') { skip('not a pier way'); continue; }
    const g = (el.geometry ?? []).map((p: { lon: number; lat: number }) => [r6(p.lon), r6(p.lat)] as [number, number]);
    if (g.length < 2) { skip('no geometry'); continue; }
    // A pier that is also a building (a boathouse on piles) is drawn by the buildings; a highway on a pier is drawn by the
    // street bands (they stay as they are), but its deck is still the pier.
    if (el.tags.building && el.tags.building !== 'no') { skip('building=*'); continue; }
    const closed = g.length >= 4 && g[0][0] === g[g.length - 1][0] && g[0][1] === g[g.length - 1][1];
    const rec: PierRecord = { id: el.id, g };
    if (closed && el.tags.area !== 'no') rec.a = 1;
    if (el.tags.floating === 'yes') rec.f = 1;
    const width = parseFloat(String(el.tags.width ?? '').replace(',', '.'));
    if (!rec.a && Number.isFinite(width) && width > 0 && width < 30) rec.w = width;
    piers.push(rec);
  }
  piers.sort((a, b) => a.id - b.id);
  return { piers, skipped };
}

async function main(): Promise<void> {
  const from = process.argv.indexOf('--from');
  const raw = from >= 0 ? JSON.parse(readFileSync(process.argv[from + 1], 'utf8')) : await fetchRaw();
  const { piers, skipped } = toRecords(raw);
  const out: PiersExtract = {
    version: 1,
    source: `OpenStreetMap via Overpass: ${QUERY}`,
    licence: '© OpenStreetMap contributors, ODbL 1.0',
    fetched: raw.osm3s?.timestamp_osm_base ?? new Date().toISOString(),
    piers,
  };
  mkdirSync(STAGING, { recursive: true });
  const text = JSON.stringify(out);
  const gz = gzipSync(text + '\n', { level: 9 });
  writeFileSync(`${STAGING}/piers.json.gz`, gz);
  const counts = { piers: piers.length, areas: piers.filter(p => p.a).length, lines: piers.filter(p => !p.a).length, floating: piers.filter(p => p.f).length, withWidth: piers.filter(p => p.w).length, bytes: text.length, gz: gz.length };
  console.log(JSON.stringify({ ...counts, skipped }, null, 2));
  if (existsSync(`${PUBLISHED}/piers.json.gz`)) {
    const old = JSON.parse(gunzipSync(readFileSync(`${PUBLISHED}/piers.json.gz`)).toString()) as PiersExtract;
    console.log(`diff vs published: ${old.piers.length} -> ${piers.length} piers`);
  }
  if (process.argv.includes('--publish')) {
    mkdirSync(PUBLISHED, { recursive: true });
    cpSync(`${STAGING}/piers.json.gz`, `${PUBLISHED}/piers.json.gz`);
    console.log(`published ${PUBLISHED}/piers.json.gz`);
  }
}

if (process.argv[1]?.endsWith('fetch-piers.ts')) void main();
