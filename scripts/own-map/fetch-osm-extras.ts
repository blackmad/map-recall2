// The basemap layers our extracts lack, for the own map's city overview:
// rail / tram / metro tracks, footways and paths, landuse (cemeteries, sports,
// industrial, allotments, woods, …) and piers. Build time only. Reads the
// cached BBBike Amsterdam PBF (the same source as the city extract) with
// osmium, and writes a compact lng/lat cache to the staging path, which
// scripts/own-map/build-own-map.ts folds into own-map-v1/overview.json.gz:
//
//   npx tsx scripts/own-map/fetch-osm-extras.ts [--pbf .cache/osm-source/Amsterdam.osm.pbf]
//   # → artifacts/own-map/staging/osm-extras.json (+ osm-extras-report.json)
//   npx tsx scripts/own-map/build-own-map.ts
//
// (Overpass was the first plan; overpass-api.de answered 504 for every chunk on
// 2026-10-10, and the PBF is already on disk and dated.)
//
// Footways that are sidewalks or crossings are left out: they shadow the
// street they belong to. © OpenStreetMap contributors, ODbL.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fromLocal } from '../../src/canalRecall/ownMap/frame.ts';

const OUT = 'artifacts/own-map/staging';
// The overview's bounds (report.json `bounds`, local metres) in degrees.
const [W, S] = fromLocal(-13448, -11258), [E, N] = fromLocal(14928, 8028);

const RAIL = ['rail', 'light_rail', 'subway', 'tram', 'narrow_gauge', 'monorail', 'funicular'];
const PATHS = ['footway', 'path', 'steps', 'track', 'bridleway'];
const LANDUSE = ['cemetery', 'industrial', 'commercial', 'retail', 'railway', 'allotments', 'farmland', 'meadow', 'grass', 'recreation_ground', 'forest', 'construction', 'brownfield', 'village_green', 'orchard', 'greenhouse_horticulture', 'plant_nursery', 'military', 'port', 'religious'];
const NATURAL = ['wood', 'scrub', 'heath', 'wetland', 'grassland', 'beach', 'sand'];
const LEISURE = ['pitch', 'sports_centre', 'stadium', 'golf_course', 'track', 'playground', 'dog_park'];

export interface OsmExtras {
  version: 1;
  source: string;
  timestamp: string;
  attribution: string;
  bbox: [number, number, number, number];
  /** [lng, lat] lines. `kind` = OSM railway value. */
  rail: Array<{ kind: string; tunnel?: 1; bridge?: 1; service?: 1; g: [number, number][] }>;
  /** Footways / paths / steps / tracks (not sidewalks or crossings). */
  paths: Array<{ kind: string; name?: string; tunnel?: 1; g: [number, number][] }>;
  /** Polygons (outer ring first). `kind` = the OSM value (landuse/natural/leisure; grave_yard → cemetery). */
  landuse: Array<{ kind: string; rings: [number, number][][] }>;
  /** Piers: areas as rings, open ways as lines. */
  piers: Array<{ area: boolean; g: [number, number][] }>;
}

type Geometry = { type: string; coordinates: unknown };
type Feature = { type: 'Feature'; properties: Record<string, string>; geometry: Geometry };

const round = (v: number) => Math.round(v * 1e6) / 1e6;
const pts = (c: number[][]) => c.map(([x, y]) => [round(x), round(y)] as [number, number]);
const yes = (v: string | undefined) => !!v && v !== 'no';

function landuseKind(t: Record<string, string>): string | null {
  if (t.landuse && LANDUSE.includes(t.landuse)) return t.landuse;
  if (t.amenity === 'grave_yard') return 'cemetery';
  if (t.natural && NATURAL.includes(t.natural)) return t.natural;
  if (t.leisure && LEISURE.includes(t.leisure)) return t.leisure;
  return null;
}

function main(): void {
  const ai = process.argv.indexOf('--pbf');
  const pbf = resolve(ai >= 0 ? process.argv[ai + 1] : '.cache/osm-source/Amsterdam.osm.pbf');
  const pbfPath = existsSync(pbf) ? pbf : resolve('/Users/blackmad/Code/map-recall2/.cache/osm-source/Amsterdam.osm.pbf');
  if (!existsSync(pbfPath)) throw new Error(`no PBF at ${pbf}; pass --pbf <file>`);
  const tmp = mkdtempSync(join(tmpdir(), 'own-map-osm-'));
  const run = (...args: string[]) => execFileSync('osmium', args, { stdio: ['ignore', 'pipe', 'inherit'] }).toString();
  const timestamp = /timestamp=(\S+)/.exec(run('fileinfo', pbfPath))?.[1] ?? '';
  run('extract', '-O', '-b', [W, S, E, N].map(v => v.toFixed(4)).join(','), pbfPath, '-o', join(tmp, 'bbox.pbf'), '--set-bounds');
  run('tags-filter', '-O', join(tmp, 'bbox.pbf'),
    `w/railway=${RAIL.join(',')}`, `w/highway=${PATHS.join(',')}`,
    `nwr/landuse=${LANDUSE.join(',')}`, `nwr/natural=${NATURAL.join(',')}`, `nwr/leisure=${LEISURE.join(',')}`,
    'nwr/amenity=grave_yard', 'nwr/man_made=pier', '-o', join(tmp, 'filtered.pbf'));
  run('export', '-O', join(tmp, 'filtered.pbf'), '-f', 'geojsonseq', '-a', 'type,id', '-o', join(tmp, 'extras.geojsonseq'));

  const out: OsmExtras = { version: 1, source: `BBBike Amsterdam PBF (${pbfPath.split('/').pop()})`, timestamp, attribution: '© OpenStreetMap contributors (ODbL)', bbox: [round(W), round(S), round(E), round(N)], rail: [], paths: [], landuse: [], piers: [] };
  const counts: Record<string, number> = {};
  const bump = (k: string) => { counts[k] = (counts[k] ?? 0) + 1; };
  for (const raw of readFileSync(join(tmp, 'extras.geojsonseq'), 'utf8').split('\n')) {
    const line = raw.replace(/^\x1e/, '').trim();
    if (!line) continue;
    const f = JSON.parse(line) as Feature;
    const t = f.properties, g = f.geometry;
    if (g.type === 'Point') continue;
    if (t.railway && RAIL.includes(t.railway) && g.type === 'LineString') {
      out.rail.push({ kind: t.railway, ...(yes(t.tunnel) ? { tunnel: 1 as const } : {}), ...(yes(t.bridge) ? { bridge: 1 as const } : {}), ...(t.service ? { service: 1 as const } : {}), g: pts(g.coordinates as number[][]) });
      bump(`rail:${t.railway}`); continue;
    }
    if (t.highway && PATHS.includes(t.highway) && g.type === 'LineString') {
      if (/^(sidewalk|crossing|traffic_island)$/.test(t.footway ?? '')) { bump('path:skipped-sidewalk-crossing'); continue; }
      out.paths.push({ kind: t.highway, ...(t.name ? { name: t.name } : {}), ...(yes(t.tunnel) ? { tunnel: 1 as const } : {}), g: pts(g.coordinates as number[][]) });
      bump(`path:${t.highway}`); continue;
    }
    if (t.man_made === 'pier') {
      if (g.type === 'LineString') out.piers.push({ area: false, g: pts(g.coordinates as number[][]) });
      else if (g.type === 'Polygon') out.piers.push({ area: true, g: pts((g.coordinates as number[][][])[0]) });
      else if (g.type === 'MultiPolygon') for (const p of g.coordinates as number[][][][]) out.piers.push({ area: true, g: pts(p[0]) });
      bump('pier'); continue;
    }
    const kind = landuseKind(t);
    if (!kind) continue;
    const polys = g.type === 'Polygon' ? [g.coordinates as number[][][]] : g.type === 'MultiPolygon' ? g.coordinates as number[][][][] : [];
    for (const p of polys) out.landuse.push({ kind, rings: p.map(pts) });
    if (polys.length) bump(`landuse:${kind}`);
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'osm-extras.json'), JSON.stringify(out));
  const report = { source: out.source, timestamp, bbox: out.bbox, rail: out.rail.length, paths: out.paths.length, landuse: out.landuse.length, piers: out.piers.length, counts };
  writeFileSync(join(OUT, 'osm-extras-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}

main();
