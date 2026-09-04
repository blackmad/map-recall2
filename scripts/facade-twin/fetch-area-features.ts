/**
 * Fetch the named linear features a corridor area's boundary follows.
 *
 * Generic over the feature selector the area declares — `waterway=canal` for
 * Amsterdam's canal ring, `highway=primary` or anything else for a city whose
 * edges are streets. The area names the features; this fetches them.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { NamedWay, SurveyArea } from '../../src/canalRecall/facade/surveyArea.ts';

const CACHE = path.resolve('.cache/facade-twin');
const FIXTURES = path.resolve('src/canalRecall/facade/fixtures');

export async function loadNamedWays(area: SurveyArea, options: { refresh?: boolean } = {}): Promise<NamedWay[]> {
  if (area.shape.kind !== 'corridor') return [];
  const file = `${area.areaId}-features.json`;

  if (!options.refresh) {
    // Committed fixture first on a cache miss, so the boundary regression check
    // stays deterministic and offline in the pre-integration gate.
    for (const directory of [CACHE, FIXTURES]) {
      try {
        return JSON.parse(await readFile(path.join(directory, file), 'utf8')).ways as NamedWay[];
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
  }

  const names = [...new Set(area.shape.edges.map(edge => edge.feature))];
  const selector = Object.entries(area.shape.featureSelector).map(([key, value]) => `["${key}"="${value}"]`).join('');
  const [south, west, north, east] = area.shape.featureBbox;
  const query = `[out:json][timeout:120];
(way${selector}["name"~"^(${names.join('|')})$"](${south},${west},${north},${east}););
out geom;`;

  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: query,
    headers: { 'User-Agent': 'MapRecallFacadeTwin/1.0', 'Content-Type': 'text/plain' },
  });
  if (!response.ok) throw new Error(`Overpass: HTTP ${response.status}`);
  const payload = await response.json() as { elements: Array<{ id: number; tags: Record<string, string>; geometry: Array<{ lon: number; lat: number }> }> };

  const ways: NamedWay[] = payload.elements
    .filter(element => element.geometry?.length >= 2)
    .map(element => ({ name: element.tags.name, points: element.geometry.map(point => [point.lon, point.lat] as [number, number]) }));

  await mkdir(CACHE, { recursive: true });
  await writeFile(path.join(CACHE, file), JSON.stringify({
    source: `OpenStreetMap via Overpass API, ${selector}`,
    retrieved: new Date().toISOString(),
    ways,
  }, null, 2));
  return ways;
}
