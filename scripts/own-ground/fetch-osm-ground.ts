// Fetch the OSM ground layer for the own-ground prototype boxes: every highway
// way with the tags that decide its cross-section (width, lanes, sidewalk*,
// cycleway*, surface, bridge, layer, area), plus parks/grass and paved squares.
// Writes a compact extract to a staging path with a coverage report:
//
//   npx tsx scripts/own-ground/fetch-osm-ground.ts
//   # review artifacts/own-ground/staging/own-ground-osm-v1/report.json, then
//   cp -R artifacts/own-ground/staging/own-ground-osm-v1 public/data/extracts/amsterdam/
//
// Source: Overpass API (build time only; the game never calls it). © OpenStreetMap contributors, ODbL.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { OWN_GROUND_BOXES } from '../../src/canalRecall/ownGround/boxes.ts';
import { KEPT_TAGS, areaKind, type OsmGroundExtract } from '../../src/canalRecall/ownGround/osmGround.ts';

const OUT = 'artifacts/own-ground/staging/own-ground-osm-v1';
const ENDPOINT = 'https://overpass-api.de/api/interpreter';

type Element = { type: 'way' | 'relation'; id: number; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[]; members?: { type: string; role: string; geometry?: { lat: number; lon: number }[] }[] };

const round = (v: number) => Math.round(v * 1e7) / 1e7;

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const report: Record<string, unknown> = {};
  for (const box of OWN_GROUND_BOXES) {
    const m = box.halfM + 200; // margin so ribbons and parks reach past the box edge
    const dLng = m / (111_320 * Math.cos(box.lat * Math.PI / 180)), dLat = m / 111_320;
    const bb = `${(box.lat - dLat).toFixed(6)},${(box.lng - dLng).toFixed(6)},${(box.lat + dLat).toFixed(6)},${(box.lng + dLng).toFixed(6)}`;
    const query = `[out:json][timeout:120];(
      way[highway](${bb});
      way["area:highway"](${bb});
      way[leisure~"^(park|garden|playground|pitch|common)$"](${bb});
      relation[leisure~"^(park|garden)$"](${bb});
      way[landuse~"^(grass|recreation_ground|cemetery|village_green|flowerbed|meadow)$"](${bb});
      way[natural~"^(grass|scrub|wood)$"](${bb});
      way[place=square](${bb}); relation[place=square](${bb});
      way[amenity=parking][parking!~"underground|multi-storey"](${bb});
    );out tags geom;`;
    let res: Response;
    for (let attempt = 0; ; attempt++) {
      res = await fetch(ENDPOINT, { method: 'POST', body: new URLSearchParams({ data: query }), headers: { 'User-Agent': 'map-recall-own-ground/1 (prototype build script)' } });
      if (res.ok) break;
      // Overpass answers 429/504 when busy; back off and retry.
      if (attempt >= 5 || (res.status !== 429 && res.status !== 504)) throw new Error(`overpass ${box.id}: ${res.status} ${await res.text()}`);
      console.warn(`overpass ${box.id}: ${res.status}, retrying`);
      await new Promise(r => setTimeout(r, 15_000 * (attempt + 1)));
    }
    const body = await res.json() as { elements: Element[]; osm3s?: { timestamp_osm_base?: string } };
    const out: OsmGroundExtract = { version: 1, box: box.id, centre: [box.lng, box.lat], fetched: body.osm3s?.timestamp_osm_base ?? new Date().toISOString(), attribution: '© OpenStreetMap contributors (ODbL)', ways: [], areas: [] };
    const counts: Record<string, number> = {};
    for (const el of body.elements) {
      const tags = el.tags ?? {};
      const kind = areaKind(tags);
      if (el.type === 'way' && el.geometry && tags.highway && !kind) {
        const kept: Record<string, string> = {};
        for (const [k, v] of Object.entries(tags)) if (KEPT_TAGS.some(p => k === p || k.startsWith(`${p}:`))) kept[k] = v;
        out.ways.push({ id: el.id, tags: kept, g: el.geometry.map(p => [round(p.lon), round(p.lat)]) });
        counts[`way:${tags.highway}`] = (counts[`way:${tags.highway}`] ?? 0) + 1;
        continue;
      }
      if (!kind) continue;
      const rings: [number, number][][] = [];
      if (el.type === 'way' && el.geometry) rings.push(el.geometry.map(p => [round(p.lon), round(p.lat)]));
      // Multipolygon relations: outer members only (inner holes are rare for parks/squares here).
      if (el.type === 'relation') for (const mem of el.members ?? []) if (mem.role === 'outer' && mem.geometry) rings.push(mem.geometry.map(p => [round(p.lon), round(p.lat)]));
      const closed = rings.filter(r => r.length >= 4 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]);
      if (!closed.length) continue;
      out.areas.push({ id: `${el.type[0]}${el.id}`, kind, name: tags.name, rings: closed });
      counts[`area:${kind}`] = (counts[`area:${kind}`] ?? 0) + 1;
    }
    const withWidth = out.ways.filter(w => w.tags.width).length, withSidewalk = out.ways.filter(w => Object.keys(w.tags).some(k => k.startsWith('sidewalk'))).length;
    const withCycleway = out.ways.filter(w => Object.keys(w.tags).some(k => k.startsWith('cycleway'))).length;
    const text = JSON.stringify(out);
    writeFileSync(join(OUT, `${box.id}.json`), text + '\n');
    report[box.id] = { ways: out.ways.length, areas: out.areas.length, counts, tagCoverage: { width: withWidth, sidewalk: withSidewalk, cycleway: withCycleway, lanes: out.ways.filter(w => w.tags.lanes).length }, bytes: text.length, osmBase: out.fetched };
    console.log(box.id, JSON.stringify(report[box.id]));
    await new Promise(r => setTimeout(r, 2000));
  }
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}

main().catch(e => { console.error(e); process.exit(1); });
