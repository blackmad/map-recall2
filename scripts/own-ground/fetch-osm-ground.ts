// Fetch the OSM ground layer for the own-ground prototype boxes: every highway
// way with the tags that decide its cross-section (width, lanes, sidewalk*,
// cycleway*, surface, bridge, layer, area), plus parks/grass and paved squares.
// Writes a compact extract to a staging path with a coverage report:
//
//   npx tsx scripts/own-ground/fetch-osm-ground.ts
//   # review artifacts/own-ground/staging/own-ground-osm-v1/report.json, then
//   cp -R artifacts/own-ground/staging/own-ground-osm-v1 public/data/extracts/amsterdam/
//
//   npx tsx scripts/own-ground/fetch-osm-ground.ts --area west
//   # the game's streaming area (boxes.ts OWN_GROUND_AREAS) cut into the
//   # elevation-v1 1 km cells: cells/<cx>_<cy>.json.gz + cells.json. A way
//   # belongs to the cell of its midpoint, an area to the cell of its bbox
//   # centre, so nothing is drawn twice; the game's ground worker loads the
//   # 3×3 neighbourhood for the junction graph.
//
// Source: Overpass API (build time only; the game never calls it). © OpenStreetMap contributors, ODbL.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { cellBounds, gameCells } from './game-cells.ts';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { OWN_GROUND_BOXES, areaById } from '../../src/canalRecall/ownGround/boxes.ts';
import { cellKey, lngLatToLocal, type ElevationIndex } from '../../src/canalRecall/elevation/elevationData.ts';
import { KEPT_TAGS, areaKind, type OsmGroundExtract } from '../../src/canalRecall/ownGround/osmGround.ts';

const OUT = 'artifacts/own-ground/staging/own-ground-osm-v1';
const ENDPOINT = 'https://overpass-api.de/api/interpreter';

type Element = { type: 'way' | 'relation'; id: number; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[]; members?: { type: string; role: string; geometry?: { lat: number; lon: number }[] }[] };

const round = (v: number) => Math.round(v * 1e7) / 1e7;

function overpassQuery(bb: string): string {
  return `[out:json][timeout:300];(
      way[highway](${bb});
      way["area:highway"](${bb});
      way[leisure~"^(park|garden|playground|pitch|common)$"](${bb});
      relation[leisure~"^(park|garden)$"](${bb});
      way[landuse~"^(grass|recreation_ground|cemetery|village_green|flowerbed|meadow)$"](${bb});
      way[natural~"^(grass|scrub|wood)$"](${bb});
      way[place=square](${bb}); relation[place=square](${bb});
      way[amenity=parking][parking!~"underground|multi-storey"](${bb});
    );out tags geom;`;
}

/** Public Overpass instances, tried in turn when one is busy (429/504) or down. */
const ENDPOINTS = [ENDPOINT, 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
/** Raw chunk responses, so an interrupted city fetch resumes (not committed). */
const CHUNK_CACHE = 'artifacts/own-ground/raw/overpass';

async function overpass(label: string, bb: string): Promise<{ elements: Element[]; osm3s?: { timestamp_osm_base?: string } }> {
  const cached = join(CHUNK_CACHE, `${bb.replace(/,/g, '_')}.json`);
  if (existsSync(cached)) return JSON.parse(readFileSync(cached, 'utf8'));
  for (let attempt = 0; ; attempt++) {
    const endpoint = ENDPOINTS[attempt % ENDPOINTS.length];
    let status = 0, text = '';
    try {
      const res = await fetch(endpoint, { method: 'POST', body: new URLSearchParams({ data: overpassQuery(bb) }), headers: { 'User-Agent': 'map-recall-own-ground/1 (build script)' } });
      status = res.status;
      text = await res.text();
      if (res.ok && text.startsWith('{')) {
        const body = JSON.parse(text) as { elements: Element[]; remark?: string; osm3s?: { timestamp_osm_base?: string } };
        // A runtime error comes back as 200 with a remark and partial elements: retry.
        if (!body.remark || !/error/i.test(body.remark)) {
          mkdirSync(CHUNK_CACHE, { recursive: true });
          writeFileSync(cached, text);
          return body;
        }
        text = body.remark;
      }
    } catch (error) { text = String(error); }
    if (attempt >= 11) throw new Error(`overpass ${label}: ${status} ${text.slice(0, 300)}`);
    console.warn(`overpass ${label} @ ${new URL(endpoint).host}: ${status} ${text.slice(0, 80).replace(/\s+/g, ' ')}, retrying`);
    await new Promise(r => setTimeout(r, 5_000 * (1 + Math.floor(attempt / ENDPOINTS.length))));
  }
}

/** Overpass elements → the compact extract (ways with kept tags, closed area rings). */
function convert(elements: Element[], out: OsmGroundExtract, counts: Record<string, number>, seen = new Set<string>()): void {
  for (const el of elements) {
    const id = `${el.type[0]}${el.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
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
    out.areas.push({ id, kind, name: tags.name, rings: closed });
    counts[`area:${kind}`] = (counts[`area:${kind}`] ?? 0) + 1;
  }
}

const coverage = (out: OsmGroundExtract) => ({
  width: out.ways.filter(w => w.tags.width).length,
  sidewalk: out.ways.filter(w => Object.keys(w.tags).some(k => k.startsWith('sidewalk'))).length,
  cycleway: out.ways.filter(w => Object.keys(w.tags).some(k => k.startsWith('cycleway'))).length,
  lanes: out.ways.filter(w => w.tags.lanes).length,
});

/** `--area <id>`: fetch the area in ~1.2 km Overpass chunks and cut it into elevation-v1 cells. */
async function fetchArea(id: string): Promise<void> {
  const index = JSON.parse(readFileSync('public/data/extracts/amsterdam/elevation-v1/index.json', 'utf8')) as ElevationIndex;
  // `city`: the game's whole riding area (game-cells.ts), cut to exactly those cells.
  const game = id === 'city' ? gameCells() : null;
  const area = game ? (() => {
    const bs = [...game].map(k => cellBounds(index, k));
    return { id, label: 'Amsterdam: every 1 km cell the routing network passes through', west: Math.min(...bs.map(b => b[0])), south: Math.min(...bs.map(b => b[1])), east: Math.max(...bs.map(b => b[2])), north: Math.max(...bs.map(b => b[3])) };
  })() : areaById(id);
  if (!area) throw new Error(`unknown area ${id}`);
  const margin = 0.003;
  const rawPath = join(OUT, `all-${id}.json`);
  let all: OsmGroundExtract = { version: 1, box: id, centre: [(area.west + area.east) / 2, (area.south + area.north) / 2], fetched: '', attribution: '© OpenStreetMap contributors (ODbL)', ways: [], areas: [] };
  const counts: Record<string, number> = {}, seen = new Set<string>();
  if (process.argv.includes('--recut') && existsSync(rawPath)) {
    // Re-cut the merged raw fetch from a previous run (no Overpass).
    all = JSON.parse(readFileSync(rawPath, 'utf8')) as OsmGroundExtract;
    for (const w of all.ways) counts[`way:${w.tags.highway}`] = (counts[`way:${w.tags.highway}`] ?? 0) + 1;
    for (const a of all.areas) counts[`area:${a.kind}`] = (counts[`area:${a.kind}`] ?? 0) + 1;
  } else {
    const chunks: string[] = [];
    if (game) {
      // 2×2-cell chunks holding at least one game cell.
      const done = new Set<string>();
      for (const k of game) {
        const [cx, cy] = k.split('_').map(Number), bx = Math.floor(cx / 2) * 2, by = Math.floor(cy / 2) * 2;
        if (done.has(`${bx}_${by}`)) continue;
        done.add(`${bx}_${by}`);
        const [w, s] = cellBounds(index, `${bx}_${by}`), [, , e, n] = cellBounds(index, `${bx + 1}_${by + 1}`);
        chunks.push(`${(s - margin).toFixed(6)},${(w - margin).toFixed(6)},${(n + margin).toFixed(6)},${(e + margin).toFixed(6)}`);
      }
    } else {
      const stepLng = 0.018, stepLat = 0.011;
      for (let lng = area.west - margin; lng < area.east + margin; lng += stepLng) for (let lat = area.south - margin; lat < area.north + margin; lat += stepLat)
        chunks.push(`${lat.toFixed(6)},${lng.toFixed(6)},${Math.min(lat + stepLat, area.north + margin).toFixed(6)},${Math.min(lng + stepLng, area.east + margin).toFixed(6)}`);
    }
    let n = 0;
    for (const bb of chunks) {
      const body = await overpass(`${id} ${bb}`, bb);
      all.fetched = body.osm3s?.timestamp_osm_base ?? all.fetched;
      convert(body.elements, all, counts, seen);
      console.log(`chunk ${++n}/${chunks.length} ${bb}: ${body.elements.length} elements (total ways ${all.ways.length}, areas ${all.areas.length})`);
      await new Promise(r => setTimeout(r, 1500));
    }
    writeFileSync(rawPath, JSON.stringify(all));
  }
  const cellOf = (lng: number, lat: number) => { const [x, y] = lngLatToLocal(index, lng, lat); return cellKey(Math.floor(x / index.cellSizeM), Math.floor(y / index.cellSizeM)); };
  const cells = new Map<string, OsmGroundExtract>();
  let dropped = 0;
  const cellFor = (key: string) => {
    if (game && !game.has(key)) { dropped++; return { ways: [], areas: [] } as unknown as OsmGroundExtract; }
    return cells.get(key) ?? cells.set(key, { ...all, box: key, ways: [], areas: [] }).get(key)!;
  };
  for (const w of all.ways) {
    // Midpoint by vertex index is enough: ways are split at junctions and short.
    const m = w.g[Math.floor((w.g.length - 1) / 2)], n = w.g[Math.ceil((w.g.length - 1) / 2)];
    cellFor(cellOf((m[0] + n[0]) / 2, (m[1] + n[1]) / 2)).ways.push(w);
  }
  for (const a of all.areas) {
    const pts = a.rings.flat(), lngs = pts.map(p => p[0]), lats = pts.map(p => p[1]);
    cellFor(cellOf((Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2)).areas.push(a);
  }
  mkdirSync(join(OUT, 'cells'), { recursive: true });
  const cellReport: Record<string, unknown> = {};
  let gzTotal = 0;
  for (const [key, cell] of [...cells].sort()) {
    const gz = gzipSync(JSON.stringify(cell), { level: 9 });
    writeFileSync(join(OUT, 'cells', `${key}.json.gz`), gz);
    gzTotal += gz.byteLength;
    cellReport[key] = { ways: cell.ways.length, areas: cell.areas.length, gzBytes: gz.byteLength };
  }
  const manifest = { version: 1, area: id, label: area.label, bbox: [area.west, area.south, area.east, area.north], cellSizeM: index.cellSizeM, frame: 'elevation-v1 storage frame', fetched: all.fetched, attribution: all.attribution, cells: [...cells.keys()].sort() };
  writeFileSync(join(OUT, 'cells.json'), JSON.stringify(manifest) + '\n');
  const report = { area: id, ways: all.ways.length, areas: all.areas.length, droppedOutsideGame: dropped, counts, tagCoverage: coverage(all), cells: cells.size, gzBytes: gzTotal, osmBase: all.fetched, perCell: cellReport };
  writeFileSync(join(OUT, `report-${id}.json`), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ ...report, perCell: undefined }, null, 2));
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const ai = process.argv.indexOf('--area');
  if (ai >= 0) { await fetchArea(process.argv[ai + 1]); return; }
  const report: Record<string, unknown> = {};
  for (const box of OWN_GROUND_BOXES) {
    const m = box.halfM + 200; // margin so ribbons and parks reach past the box edge
    const dLng = m / (111_320 * Math.cos(box.lat * Math.PI / 180)), dLat = m / 111_320;
    const bb = `${(box.lat - dLat).toFixed(6)},${(box.lng - dLng).toFixed(6)},${(box.lat + dLat).toFixed(6)},${(box.lng + dLng).toFixed(6)}`;
    const body = await overpass(box.id, bb);
    const out: OsmGroundExtract = { version: 1, box: box.id, centre: [box.lng, box.lat], fetched: body.osm3s?.timestamp_osm_base ?? new Date().toISOString(), attribution: '© OpenStreetMap contributors (ODbL)', ways: [], areas: [] };
    const counts: Record<string, number> = {};
    convert(body.elements, out, counts);
    const text = JSON.stringify(out);
    writeFileSync(join(OUT, `${box.id}.json`), text + '\n');
    report[box.id] = { ways: out.ways.length, areas: out.areas.length, counts, tagCoverage: coverage(out), bytes: text.length, osmBase: out.fetched };
    console.log(box.id, JSON.stringify(report[box.id]));
    await new Promise(r => setTimeout(r, 2000));
  }
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}

main().catch(e => { console.error(e); process.exit(1); });
