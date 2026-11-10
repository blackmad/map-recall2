/**
 * The city-wide OSM business extract that block-face intake cuts per face (src/canalRecall/blockFace/osmPoiExtract.ts).
 *
 *   node --import tsx scripts/block-face/osm-pois.ts --build [--pbf=.cache/osm-source/Amsterdam.osm.pbf]
 *        the project's cached OSM extract through osmium (tags-filter + export), no network; dated by the pbf's timestamp
 *   node --import tsx scripts/block-face/osm-pois.ts --fetch     one Overpass query for the whole city instead (often rate-limited)
 *   node --import tsx scripts/block-face/osm-pois.ts             print the extract intake will use
 *
 * Lives in the source-data checkout ($MAP_RECALL_SOURCE_DATA, else ../map-recall2-source-data or ../../map-recall2-source-data)
 * at datasets/osm-pois/amsterdam-pois-YYYYMMDD.json.gz; intake reads the newest one. Override with BLOCK_FACE_OSM_POIS=<file>.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {newestExtract, POI_KEYS, poiQuery, type OverpassExtract} from '../../src/canalRecall/blockFace/osmPoiExtract.ts';

/** Amsterdam municipality with a margin, [s, w, n, e]. */
export const CITY_BBOX = [52.27, 4.72, 52.44, 5.1];

export function sourceDataRoot(): string | null {
  const c = [process.env.MAP_RECALL_SOURCE_DATA, path.resolve('../map-recall2-source-data'), path.resolve('../../map-recall2-source-data')];
  return c.find(d => d && fs.existsSync(path.join(d, 'datasets'))) ?? null;
}

/** Path of the newest local extract, or null (intake then asks Overpass per face). */
export function localExtractPath(): string | null {
  if (process.env.BLOCK_FACE_OSM_POIS) return fs.existsSync(process.env.BLOCK_FACE_OSM_POIS) ? process.env.BLOCK_FACE_OSM_POIS : null;
  const root = sourceDataRoot();
  if (!root) return null;
  const dir = path.join(root, 'datasets/osm-pois');
  const name = fs.existsSync(dir) ? newestExtract(fs.readdirSync(dir)) : null;
  return name ? path.join(dir, name) : null;
}

let loaded: Promise<OverpassExtract> | null = null;
/** The extract at `file`, read once per process. */
export function loadExtract(file: string): Promise<OverpassExtract> {
  loaded ??= fsp.readFile(file).then(b => JSON.parse((file.endsWith('.gz') ? zlib.gunzipSync(b) : b).toString('utf8')));
  return loaded;
}

async function fetchCity() {
  const root = sourceDataRoot();
  if (!root) throw Error('no map-recall2-source-data checkout (set MAP_RECALL_SOURCE_DATA)');
  const query = poiQuery(CITY_BBOX, 300);
  for (const endpoint of ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']) {
    const t0 = performance.now();
    try {
      const r = await fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'map-recall/1.0 (block-face osm extract)'}, body: new URLSearchParams({data: query})});
      if (!r.ok) { console.log(`${endpoint}: HTTP ${r.status}`); continue; }
      const json = await r.json() as any;
      const fetchedAt = new Date().toISOString(), stamp = fetchedAt.slice(0, 10).replace(/-/g, '');
      const out: OverpassExtract = {bbox: CITY_BBOX, fetchedAt, endpoint, query, elements: json.elements};
      const file = path.join(root, 'datasets/osm-pois', `amsterdam-pois-${stamp}.json.gz`);
      await fsp.mkdir(path.dirname(file), {recursive: true});
      await fsp.writeFile(file, zlib.gzipSync(JSON.stringify({...out, osmBase: json.osm3s?.timestamp_osm_base, licence: 'OpenStreetMap contributors, ODbL'})));
      console.log(`${json.elements.length} elements from ${endpoint} in ${((performance.now() - t0) / 1000).toFixed(1)} s -> ${file}`);
      return;
    } catch (e) { console.log(`${endpoint}: ${(e as Error).message}`); }
  }
  throw Error('Overpass unavailable');
}

/** GeoJSON geometry -> Overpass `out center` position: a node's point, else the centre of the bbox (what Overpass reports). */
export function centreOf(g: {type: string; coordinates: any}): {lat: number; lon: number} {
  if (g.type === 'Point') return {lon: g.coordinates[0], lat: g.coordinates[1]};
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  const walk = (c: any) => { if (typeof c[0] === 'number') { w = Math.min(w, c[0]); e = Math.max(e, c[0]); s = Math.min(s, c[1]); n = Math.max(n, c[1]); } else c.forEach(walk); };
  walk(g.coordinates);
  return {lon: +((w + e) / 2).toFixed(7), lat: +((s + n) / 2).toFixed(7)};
}

async function buildFromPbf(pbf: string) {
  const root = sourceDataRoot();
  if (!root) throw Error('no map-recall2-source-data checkout (set MAP_RECALL_SOURCE_DATA)');
  const t0 = performance.now(), tmp = fs.mkdtempSync(path.join(process.env.TMPDIR ?? '/tmp', 'osm-pois-'));
  const stamp = execFileSync('osmium', ['fileinfo', '-g', 'header.option.osmosis_replication_timestamp', pbf]).toString().trim() || fs.statSync(pbf).mtime.toISOString();
  const [s, w, n, e] = CITY_BBOX;
  execFileSync('osmium', ['extract', '-b', `${w},${s},${e},${n}`, '--overwrite', '-o', path.join(tmp, 'city.osm.pbf'), pbf]);
  execFileSync('osmium', ['tags-filter', '--overwrite', '-o', path.join(tmp, 'pois.osm.pbf'), path.join(tmp, 'city.osm.pbf'), ...POI_KEYS.map(k => `nwr/${k}`)]);
  execFileSync('osmium', ['export', '--overwrite', '-f', 'geojsonseq', '-a', 'type,id', '-u', 'type_id', '-x', 'print_record_separator=false', '-o', path.join(tmp, 'pois.geojsonseq'), path.join(tmp, 'pois.osm.pbf')]);
  const elements: any[] = [];
  for (const line of fs.readFileSync(path.join(tmp, 'pois.geojsonseq'), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const f = JSON.parse(line), {['@type']: type, ['@id']: id, ...tags} = f.properties;
    if (!POI_KEYS.some(k => k in tags)) continue;
    const c = centreOf(f.geometry);
    elements.push(type === 'node' ? {type, id: Number(id), lat: c.lat, lon: c.lon, tags} : {type, id: Number(id), center: c, tags});
  }
  fs.rmSync(tmp, {recursive: true, force: true});
  const day = stamp.slice(0, 10).replace(/-/g, '');
  const out: OverpassExtract & Record<string, unknown> = {bbox: CITY_BBOX, fetchedAt: stamp, endpoint: `osmium:${path.basename(pbf)}`, query: `osmium tags-filter ${POI_KEYS.map(k => `nwr/${k}`).join(' ')}; export geojsonseq; centre = node or bbox centre`, elements, licence: 'OpenStreetMap contributors, ODbL'};
  const file = path.join(root, 'datasets/osm-pois', `amsterdam-pois-${day}.json.gz`);
  await fsp.mkdir(path.dirname(file), {recursive: true});
  await fsp.writeFile(file, zlib.gzipSync(JSON.stringify(out)));
  console.log(`${elements.length} elements (OSM ${stamp}) in ${((performance.now() - t0) / 1000).toFixed(1)} s -> ${file}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pbf = process.argv.find(a => a.startsWith('--pbf='))?.slice(6) ?? '.cache/osm-source/Amsterdam.osm.pbf';
  if (process.argv.includes('--build')) await buildFromPbf(pbf);
  else if (process.argv.includes('--fetch')) await fetchCity();
  else console.log(localExtractPath() ?? 'no local extract');
}
