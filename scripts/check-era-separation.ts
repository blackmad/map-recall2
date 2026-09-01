/**
 * Does construction year actually predict what the city looks like?
 *
 * The era palette in `buildingAppearance.ts` is a prior, and a prior that does
 * not separate is decoration. This joins the staged 3DBAG buildings (which
 * carry `oorspronkelijkbouwjaar`) against the colours already on `main`, and
 * reports the measured colour distribution per era.
 *
 * The two sides are keyed differently — 3DBAG by BAG pand, the extract by OSM
 * way — so the join is geometric: an OSM footprint's centroid must fall inside
 * exactly one BAG footprint. Point-in-polygon rather than a radius, because in
 * a city of adjoining terraces a 12 m radius holds several BAG panden and
 * cannot say which one was measured; accepting the nearest would invent
 * agreement. A centroid inside two overlapping footprints is dropped for the
 * same reason.
 *
 * Both surfaces are tested, because they are evidence about different things.
 * OSM `colour` is a human-entered *wall* colour, and the wall is what the era
 * prior is really a claim about. The aerial sample measures roofs, which the
 * prior also assigns and which `ROOF_ENRICHMENT.md` already found to be
 * mostly dark grey whatever the building.
 *
 * Usage: tsx scripts/check-era-separation.ts
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { eraForYear } from '../src/canalRecall/buildingAppearance.ts';

interface Feature {
  geometry: { type: string; coordinates: number[][][] | number[][][][] } | null;
  properties: Record<string, unknown>;
}

const outerRing = (feature: Feature): number[][] | undefined => {
  if (!feature.geometry) return undefined;
  const rings = feature.geometry.type === 'MultiPolygon'
    ? (feature.geometry.coordinates as number[][][][])[0]
    : feature.geometry.coordinates as number[][][];
  const ring = rings?.[0];
  return ring && ring.length >= 3 ? ring : undefined;
};

const centroid = (ring: number[][]): [number, number] => {
  let lon = 0, lat = 0;
  for (const [x, y] of ring) { lon += x; lat += y; }
  return [lon / ring.length, lat / ring.length];
};

/** Ray casting, in lon/lat directly: the join is over metres, not degrees. */
const inRing = ([x, y]: [number, number], ring: number[][]): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

const staged = JSON.parse(await readFile(
  path.resolve('.cache/3dbag-appearance/amsterdam-buildings.staging.geojson'), 'utf8')) as { features: Feature[] };
const measured = JSON.parse(await readFile(
  path.resolve('public/data/extracts/amsterdam/buildings-colored.geojson'), 'utf8')) as { features: Feature[] };

// Index the BAG footprints on a ~40 m grid by their own bounding boxes, so a
// lookup only tests the handful of buildings that could contain the point.
const cell = 0.0005; // about 35 m of latitude
const key = (x: number, y: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
const grid = new Map<string, { ring: number[][]; year: number }[]>();
let stagedWithYear = 0;
for (const feature of staged.features) {
  const ring = outerRing(feature);
  const year = feature.properties.constructionYear as number | undefined;
  if (!ring || typeof year !== 'number') continue;
  stagedWithYear++;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  for (let gx = Math.floor(minX / cell); gx <= Math.floor(maxX / cell); gx++) {
    for (let gy = Math.floor(minY / cell); gy <= Math.floor(maxY / cell); gy++) {
      const bucket = `${gx},${gy}`;
      (grid.get(bucket) || grid.set(bucket, []).get(bucket)!).push({ ring, year });
    }
  }
}

const hexToRgb = (hex: string): [number, number, number] | undefined => {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return undefined;
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

interface Surface {
  label: string;
  /** Which property on the extract feature carries this surface's colour. */
  property: string;
  /** Only count features whose measurement really is of this surface. */
  accept: (feature: Feature) => boolean;
  byEra: Map<string, [number, number, number][]>;
  counted: number;
  joined: number;
  ambiguous: number;
  outside: number;
}

const surfaces: Surface[] = [
  {
    label: 'wall (OSM building:colour, human-entered)', property: 'colour',
    accept: (feature) => typeof feature.properties.colour === 'string',
    byEra: new Map(), counted: 0, joined: 0, ambiguous: 0, outside: 0,
  },
  {
    label: 'roof (PDOK aerial sample)', property: 'roofColour',
    accept: (feature) => feature.properties.roofSource === 'aerial',
    byEra: new Map(), counted: 0, joined: 0, ambiguous: 0, outside: 0,
  },
];

for (const feature of measured.features) {
  const ring = outerRing(feature);
  if (!ring) continue;
  const point = centroid(ring);

  let year: number | undefined;
  let ambiguous = false;
  const candidates = grid.get(key(point[0], point[1])) || [];
  for (const candidate of candidates) {
    if (!inRing(point, candidate.ring)) continue;
    if (year !== undefined) { ambiguous = true; break; }
    year = candidate.year;
  }

  for (const surface of surfaces) {
    if (!surface.accept(feature)) continue;
    surface.counted++;
    const rgb = typeof feature.properties[surface.property] === 'string'
      ? hexToRgb(feature.properties[surface.property] as string) : undefined;
    if (!rgb) continue;
    if (ambiguous) { surface.ambiguous++; continue; }
    if (year === undefined) { surface.outside++; continue; }
    const era = eraForYear(year);
    if (!era) continue;
    surface.joined++;
    const bucket = surface.byEra.get(era.label) || [];
    bucket.push(rgb);
    surface.byEra.set(era.label, bucket);
  }
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};
const luminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

process.stdout.write(`staged BAG buildings with a construction year: ${stagedWithYear}\n\n`);

for (const surface of surfaces) {
  process.stdout.write(`## ${surface.label}\n`);
  process.stdout.write(
    `extract features: ${surface.counted}, joined inside one BAG footprint: ${surface.joined}`
    + ` (${surface.ambiguous} ambiguous, ${surface.outside} outside the staged tiles)\n`);
  const rows = [...surface.byEra.entries()]
    .map(([label, samples]) => ({
      label, n: samples.length,
      r: median(samples.map((s) => s[0])),
      g: median(samples.map((s) => s[1])),
      b: median(samples.map((s) => s[2])),
    }))
    .filter((row) => row.n >= 20)
    .sort((a, b) => luminance(a.r, a.g, a.b) - luminance(b.r, b.g, b.b));

  if (rows.length < 2) {
    process.stdout.write('  too few joined samples per era to say anything.\n\n');
    continue;
  }
  process.stdout.write('  era                          n    median      lum   warmth(r-b)\n');
  for (const row of rows) {
    const hex = `#${[row.r, row.g, row.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    process.stdout.write(
      `  ${row.label.padEnd(26)} ${String(row.n).padStart(4)}   ${hex}   `
      + `${luminance(row.r, row.g, row.b).toFixed(1).padStart(5)}   ${String(row.r - row.b).padStart(5)}\n`);
  }
  const lums = rows.map((row) => luminance(row.r, row.g, row.b));
  const warmth = rows.map((row) => row.r - row.b);
  process.stdout.write(
    `  spread: luminance ${(Math.max(...lums) - Math.min(...lums)).toFixed(1)},`
    + ` warmth ${Math.max(...warmth) - Math.min(...warmth)}\n\n`);
}

process.stdout.write(
  'A spread of a few units is noise: the eras do not separate on that surface and\n'
  + 'the prior is decoration there. Tens of units is signal worth rendering.\n');
