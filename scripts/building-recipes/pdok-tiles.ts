/**
 * Cache of Kadaster 3D Basisvoorziening building tiles (PDOK, CC BY 4.0): the LoD2.2 fallback when api.3dbag.nl is
 * down. Tiles are 2 km RD "blades"; the newest published year is used.
 *
 *   node --import tsx scripts/building-recipes/pdok-tiles.ts --pand=0363100012080943   # locate, fetch the blade, print the item summary
 *   node --import tsx scripts/building-recipes/pdok-tiles.ts --blade=118000_486000
 *
 * Files land in $MAP_RECALL_SOURCE_DATA/datasets/pdok-3d-gebouwen-<year>/<bladnr>.zip (+ the unzipped
 * .city.json and an index.json: blade → year, bytes, fetchedAt, download_link, cityJson; only the zips and the index are
 * committed, and a missing .city.json is unzipped from its cached zip). That directory is the
 * source-data archive's own git repo; this script only writes files there.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {bladeBounds, bladeFor, cityObjectToFeature, type CityJsonTile} from '../../src/canalRecall/buildingRecipe/pdokLod2.ts';
import type {CityJsonItem} from '../../src/canalRecall/buildingRecipe/facts.ts';
import {lngLatToRd, rdToLngLat} from '../../src/canalRecall/facade/rdNew.ts';

const SOURCE_DATA = process.env.MAP_RECALL_SOURCE_DATA ?? '/Users/blackmad/Code/map-recall2-source-data';
const INDEX_API = 'https://api.pdok.nl/kadaster/3d-basisvoorziening/ogc/v1/collections/basisbestand_gebouwen/items';
const BAG_API = 'https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items';
const datasetDir = (year: number) => path.join(SOURCE_DATA, 'datasets', `pdok-3d-gebouwen-${year}`);

export interface BladeEntry { year: number; bytes: number; fetchedAt: string; download_link: string; cityJson: string }

async function getJson(url: string): Promise<any> {
  const r = await fetch(url, {signal: AbortSignal.timeout(60_000)});
  if (!r.ok) throw Error(`${r.status} ${url}`);
  return r.json();
}

/** Newest-year download for a blade, from the PDOK tile index. */
export async function bladeDownload(blade: string): Promise<{year: number; bytes: number; link: string}> {
  const [x0, y0, x1, y1] = bladeBounds(blade), [lng, lat] = rdToLngLat({x: (x0 + x1) / 2, y: (y0 + y1) / 2});
  const d = 0.001, data = await getJson(`${INDEX_API}?f=json&bbox=${lng - d},${lat - d},${lng + d},${lat + d}&limit=200`);
  const hits = (data.features as any[]).map(f => f.properties).filter(p => p.bladnr === blade).sort((a, b) => b.jaargang_luchtfoto - a.jaargang_luchtfoto);
  if (!hits.length) throw Error(`PDOK index has no blade ${blade}`);
  return {year: hits[0].jaargang_luchtfoto, bytes: hits[0].download_size_bytes, link: hits[0].download_link};
}

async function readIndex(dir: string): Promise<Record<string, BladeEntry>> {
  try { return JSON.parse(await fs.readFile(path.join(dir, 'index.json'), 'utf8')); } catch { return {}; }
}

/** Fetch (once) and unzip the newest year of a blade; returns the CityJSON path and its index entry. */
export async function ensureBlade(blade: string): Promise<{file: string; entry: BladeEntry}> {
  // Cached under any year? Prefer the newest cached; the index is consulted only on a miss.
  const datasets = path.join(SOURCE_DATA, 'datasets');
  const years = (await fs.readdir(datasets).catch(() => [] as string[])).map(n => /^pdok-3d-gebouwen-(\d{4})$/.exec(n)?.[1]).filter(Boolean).map(Number).sort((a, b) => b - a);
  for (const year of years) {
    const entry = (await readIndex(datasetDir(year)))[blade];
    if (entry) {
      const file = path.join(datasetDir(year), entry.cityJson);
      if (await fs.stat(file).then(() => true, () => false)) return {file, entry};
      // the source-data repo keeps only the zips (one unzipped tile is over GitHub's 100 MB limit): unzip on first use
      const zip = path.join(datasetDir(year), `${blade}.zip`);
      if (await fs.stat(zip).then(() => true, () => false)) {
        execFileSync('unzip', ['-o', '-q', zip, entry.cityJson, '-d', datasetDir(year)]);
        return {file, entry};
      }
    }
  }
  const dl = await bladeDownload(blade), dir = datasetDir(dl.year), zip = path.join(dir, `${blade}.zip`);
  await fs.mkdir(dir, {recursive: true});
  const r = await fetch(dl.link, {signal: AbortSignal.timeout(900_000)});
  if (!r.ok) throw Error(`${r.status} ${dl.link}`);
  const bytes = Buffer.from(await r.arrayBuffer());
  await fs.writeFile(zip, bytes);
  const listing = execFileSync('unzip', ['-Z1', zip], {encoding: 'utf8'}).split('\n').filter(n => n.endsWith('.city.json'));
  if (listing.length !== 1) throw Error(`${zip}: expected one .city.json, found ${listing.length}`);
  execFileSync('unzip', ['-o', '-q', zip, listing[0], '-d', dir]);
  const entry: BladeEntry = {year: dl.year, bytes: bytes.length, fetchedAt: new Date().toISOString(), download_link: dl.link, cityJson: listing[0]};
  const index = await readIndex(dir);
  index[blade] = entry;
  await fs.writeFile(path.join(dir, 'index.json'), JSON.stringify(Object.fromEntries(Object.entries(index).sort()), null, 1) + '\n');
  return {file: path.join(dir, listing[0]), entry};
}

const tiles = new Map<string, CityJsonTile>();
async function loadTile(file: string): Promise<CityJsonTile> {
  if (!tiles.has(file)) tiles.set(file, JSON.parse(await fs.readFile(file, 'utf8')));
  return tiles.get(file)!;
}

/** RD footprint ring of a pand: the game's building tiles first, the PDOK BAG API otherwise. */
export async function pandFootprintRD(pandId: string): Promise<{x: number; y: number}[]> {
  const {findPands, normId} = await import('../pand-reference/core.ts');
  const local = (await findPands([pandId])).get(normId(pandId));
  if (local) return local.ring;
  const data = await getJson(`${BAG_API}?f=json&identificatie=${pandId}`);
  const g = data.features?.[0]?.geometry;
  if (!g) throw Error(`Pand ${pandId} is in neither the building tiles nor the BAG API`);
  const ring: number[][] = g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0];
  return ring.map(p => lngLatToRd([p[0], p[1]]));
}

/**
 * The pand as a 3DBAG-shaped item from the newest PDOK tile, with provenance. Tries the blade under the footprint
 * centroid, then any other blade a footprint vertex falls in (pands straddling a blade edge).
 */
export async function pdokItem(pandId: string): Promise<{item: CityJsonItem & {id: string}; source: string; sourceUrl: string; blade: string}> {
  const ring = await pandFootprintRD(pandId);
  const cx = ring.reduce((s, p) => s + p.x, 0) / ring.length, cy = ring.reduce((s, p) => s + p.y, 0) / ring.length;
  const blades = [...new Set([bladeFor(cx, cy), ...ring.map(p => bladeFor(p.x, p.y))])];
  for (const blade of blades) {
    const {file, entry} = await ensureBlade(blade);
    const item = cityObjectToFeature(await loadTile(file), pandId);
    if (item) return {item, source: `pdok-3d-basisvoorziening-${entry.year}`, sourceUrl: `${entry.download_link}#NL.IMBAG.Pand.${pandId}`, blade};
  }
  throw Error(`Pand ${pandId} not in PDOK blades ${blades.join(', ')}`);
}

if (process.argv[1]?.endsWith('building-recipes/pdok-tiles.ts')) {
  const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const pand = arg('pand'), blade = arg('blade');
  if (blade) {
    const {file, entry} = await ensureBlade(blade);
    console.log(JSON.stringify({blade, file, ...entry}));
  } else if (pand) {
    const {item, source, sourceUrl, blade: b} = await pdokItem(pand);
    const objects = Object.entries(item.feature.CityObjects).map(([id, o]) => ({id, type: o.type, lods: (o.geometry ?? []).map(g => String(g.lod))}));
    console.log(JSON.stringify({pand, blade: b, source, sourceUrl, vertices: item.feature.vertices.length, objects}));
  } else throw Error('Use --pand=<16-digit id> or --blade=<x>_<y>');
}
