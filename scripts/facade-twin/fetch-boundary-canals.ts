/**
 * Cache the OSM centrelines of the five canals that define the pilot boundary.
 *
 * The boundary is not a hand-drawn box. It follows Brouwersgracht, Singel,
 * Herengracht, Leidsegracht and Prinsengracht, because a straight chord between
 * corner junctions cuts the corners off a canal ring that visibly curves and
 * would silently drop the buildings on the outside of every bend.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const BOUNDARY_CANALS = ['Brouwersgracht', 'Singel', 'Herengracht', 'Leidsegracht', 'Prinsengracht'] as const;
export type BoundaryCanal = (typeof BOUNDARY_CANALS)[number];

/** Generous enough to hold every way of all five canals, tight enough to stay a cheap query. */
const QUERY_BBOX = [52.358, 4.870, 52.388, 4.907] as const;

export interface CanalWay {
  id: number;
  name: string;
  points: Array<[longitude: number, latitude: number]>;
}

const CACHE_FILE = path.resolve('.cache/facade-twin/boundary-canals.json');
/**
 * Committed copy. The boundary regression check must be deterministic and must
 * not reach the network from the pre-integration gate, so the centrelines it
 * runs against are a fixture, refreshed deliberately rather than implicitly.
 */
const FIXTURE_FILE = path.resolve('src/canalRecall/facade/fixtures/boundary-canals.json');

export async function loadBoundaryCanals(options: { refresh?: boolean } = {}): Promise<CanalWay[]> {
  if (!options.refresh) {
    for (const file of [CACHE_FILE, FIXTURE_FILE]) {
      try {
        return JSON.parse(await readFile(file, 'utf8')).ways as CanalWay[];
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
  }

  const [south, west, north, east] = QUERY_BBOX;
  const query = `[out:json][timeout:120];
(way["waterway"="canal"]["name"~"^(${BOUNDARY_CANALS.join('|')})$"](${south},${west},${north},${east}););
out geom;`;

  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: query,
    headers: { 'User-Agent': 'MapRecallFacadeTwin/1.0', 'Content-Type': 'text/plain' },
  });
  if (!response.ok) throw new Error(`Overpass: HTTP ${response.status}`);
  const payload = await response.json() as { elements: Array<{ id: number; tags: Record<string, string>; geometry: Array<{ lon: number; lat: number }> }> };

  const ways: CanalWay[] = payload.elements
    .filter(element => element.geometry?.length >= 2)
    .map(element => ({ id: element.id, name: element.tags.name, points: element.geometry.map(point => [point.lon, point.lat] as [number, number]) }));

  await mkdir(path.dirname(CACHE_FILE), { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify({
    source: 'OpenStreetMap via Overpass API, waterway=canal',
    retrieved: new Date().toISOString(),
    queryBbox: QUERY_BBOX,
    ways,
  }, null, 2));
  return ways;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ways = await loadBoundaryCanals({ refresh: process.argv.includes('--refresh') });
  const counts = new Map<string, number>();
  for (const way of ways) counts.set(way.name, (counts.get(way.name) ?? 0) + 1);
  for (const canal of BOUNDARY_CANALS) console.log(`${canal.padEnd(16)} ${counts.get(canal) ?? 0} ways`);
  console.log(`cached ${ways.length} ways to ${path.relative(process.cwd(), CACHE_FILE)}`);
}
