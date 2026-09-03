/**
 * RECON-1 — the pand inventory for the pilot boundary.
 *
 * Answers the question the build prompt refuses to let anyone guess: exactly
 * which BAG panden are in scope, and how many. Membership is footprint
 * intersection with the boundary ring, not a bounding box and not an address
 * point — a canal house's address point can sit thirty metres behind its own
 * façade, and the far bank of a boundary canal is in scope even though its
 * plot runs away from us.
 *
 * Every building is keyed by its BAG `identificatie`. A building without one is
 * a bug, not a building.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildPilotBoundary, intersectsBoundary, type CanalCentreline } from '../../src/canalRecall/facade/pilotBoundary.ts';
import { lngLatToRd, rdToLngLat, type LngLat, type RdPoint } from '../../src/canalRecall/facade/rdNew.ts';
import { loadBoundaryCanals } from './fetch-boundary-canals.ts';

const BAG_ITEMS = 'https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items';
const CACHE_FILE = path.resolve('.cache/facade-twin/bag-panden.json');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin');
const PAGE_SIZE = 1000;

export interface BagPand {
  pandId: string;
  bouwjaar: number | null;
  status: string;
  gebruiksdoel: string[];
  verblijfsobjecten: number;
  /** Outer ring only; BAG pand footprints in the centre are simple polygons. */
  footprintLngLat: LngLat[];
}

async function fetchAllPanden(bbox: readonly number[], refresh: boolean): Promise<BagPand[]> {
  if (!refresh) {
    try {
      return JSON.parse(await readFile(CACHE_FILE, 'utf8')).panden as BagPand[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  const panden: BagPand[] = [];
  let url: string | null = `${BAG_ITEMS}?bbox=${bbox.join(',')}&limit=${PAGE_SIZE}&f=json`;
  let page = 0;
  while (url) {
    const response = await fetch(url, { headers: { 'User-Agent': 'MapRecallFacadeTwin/1.0' } });
    if (!response.ok) throw new Error(`BAG: HTTP ${response.status}`);
    const payload = await response.json() as {
      features: Array<{ properties: Record<string, unknown>; geometry: { type: string; coordinates: number[][][] | number[][][][] } }>;
      links: Array<{ rel: string; href: string }>;
    };
    for (const feature of payload.features) {
      // A pand is authoritative only if it carries an identificatie.
      const pandId = feature.properties.identificatie as string | undefined;
      if (!pandId) continue;
      const rings = feature.geometry.type === 'Polygon'
        ? [feature.geometry.coordinates as number[][][]]
        : (feature.geometry.coordinates as number[][][][]);
      for (const polygon of rings) {
        panden.push({
          pandId,
          bouwjaar: typeof feature.properties.bouwjaar === 'number' ? feature.properties.bouwjaar : null,
          status: String(feature.properties.status ?? 'onbekend'),
          gebruiksdoel: String(feature.properties.gebruiksdoel ?? '').split(',').filter(Boolean),
          verblijfsobjecten: Number(feature.properties.aantal_verblijfsobjecten ?? 0),
          footprintLngLat: polygon[0].map(([lng, lat]) => [lng, lat] as LngLat),
        });
      }
    }
    page++;
    process.stdout.write(`\r  fetched page ${page} — ${panden.length} panden`);
    url = payload.links.find(link => link.rel === 'next')?.href ?? null;
  }
  process.stdout.write('\n');

  await mkdir(path.dirname(CACHE_FILE), { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify({
    source: 'PDOK Kadaster BAG OGC API Features v2, collection pand',
    retrieved: new Date().toISOString(),
    bbox,
    panden,
  }));
  return panden;
}

/** Shoelace area of a footprint in square metres. */
const areaM2 = (ring: RdPoint[]) => {
  let total = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) total += ring[j].x * ring[i].y - ring[i].x * ring[j].y;
  return Math.abs(total / 2);
};

/**
 * Plot width: the shorter side of the minimum-area rectangle enclosing the
 * footprint. For a canal house — a narrow deep plot between party walls — that
 * is the façade width, which is the one dimension the façade pipeline scales
 * everything else from.
 */
export function minimumRectangle(ring: RdPoint[]): { widthM: number; depthM: number; bearingDeg: number } {
  let best = { widthM: Infinity, depthM: Infinity, bearingDeg: 0, area: Infinity };
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < 1e-6) continue;
    const ux = (b.x - a.x) / length, uy = (b.y - a.y) / length;
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const p of ring) {
      const u = p.x * ux + p.y * uy, v = -p.x * uy + p.y * ux;
      minU = Math.min(minU, u); maxU = Math.max(maxU, u);
      minV = Math.min(minV, v); maxV = Math.max(maxV, v);
    }
    const side1 = maxU - minU, side2 = maxV - minV, area = side1 * side2;
    if (area < best.area) {
      best = {
        widthM: Math.min(side1, side2),
        depthM: Math.max(side1, side2),
        bearingDeg: (Math.atan2(uy, ux) * 180) / Math.PI,
        area,
      };
    }
  }
  return { widthM: best.widthM, depthM: best.depthM, bearingDeg: best.bearingDeg };
}

const refresh = process.argv.includes('--refresh');
const ways = await loadBoundaryCanals();
const boundary = buildPilotBoundary(ways.map(way => ({ name: way.name, points: way.points }) as CanalCentreline));

console.log(`Boundary: ${boundary.areaKm2.toFixed(3)} km², bbox ${boundary.bboxLngLat.map(v => v.toFixed(6)).join(',')}`);
console.log('Fetching BAG panden over the boundary bounding box…');
const all = await fetchAllPanden(boundary.bboxLngLat, refresh);
console.log(`  ${all.length} panden in the bounding box`);

const inside = all.filter(pand => intersectsBoundary(boundary.ringRd, pand.footprintLngLat.map(lngLatToRd)));
console.log(`  ${inside.length} panden intersect the boundary (${(100 * inside.length / all.length).toFixed(1)}% of the bbox)`);

const active = inside.filter(pand => pand.status.startsWith('Pand in gebruik') || pand.status === 'Verbouwing pand');
const measured = inside.map(pand => {
  const rd = pand.footprintLngLat.map(lngLatToRd);
  const rectangle = minimumRectangle(rd);
  return { ...pand, areaM2: areaM2(rd), ...rectangle };
});

const bucket = <T>(items: T[], key: (item: T) => string | null) => {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (k !== null) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
};

const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
};

const widths = measured.map(m => m.widthM);
const areas = measured.map(m => m.areaM2);
const withYear = measured.filter(m => m.bouwjaar !== null);

console.log('\nStatus');
for (const [status, count] of bucket(inside, p => p.status)) console.log(`  ${String(count).padStart(5)}  ${status}`);

console.log('\nBouwjaar (BAG registration year, not construction date — see the report)');
for (const [decade, count] of bucket(withYear, p => `${Math.floor(p.bouwjaar! / 50) * 50}s`)) console.log(`  ${String(count).padStart(5)}  ${decade}`);
console.log(`  ${String(inside.length - withYear.length).padStart(5)}  no bouwjaar`);

console.log('\nFootprint');
for (const p of [0.05, 0.25, 0.5, 0.75, 0.95]) console.log(`  p${String(p * 100).padStart(2)}  width ${percentile(widths, p).toFixed(1)} m   area ${percentile(areas, p).toFixed(0)} m²`);
console.log(`  canal-house-shaped plots (width 3.5–9 m): ${measured.filter(m => m.widthM >= 3.5 && m.widthM <= 9).length}`);

await mkdir(STAGING, { recursive: true });
await writeFile(path.join(STAGING, 'pand-inventory.json'), JSON.stringify({
  metadata: {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/facade-twin/build-pand-inventory.ts',
    source: 'PDOK Kadaster BAG OGC API Features v2, collection pand',
    boundaryAreaKm2: Number(boundary.areaKm2.toFixed(4)),
    bboxLngLat: boundary.bboxLngLat,
    pandenInBbox: all.length,
    pandenInBoundary: inside.length,
    activePanden: active.length,
  },
  panden: measured.map(m => ({
    pandId: m.pandId,
    bouwjaar: m.bouwjaar,
    status: m.status,
    gebruiksdoel: m.gebruiksdoel,
    verblijfsobjecten: m.verblijfsobjecten,
    areaM2: Number(m.areaM2.toFixed(1)),
    plotWidthM: Number(m.widthM.toFixed(2)),
    plotDepthM: Number(m.depthM.toFixed(2)),
    frontBearingDeg: Number(m.bearingDeg.toFixed(1)),
    centroidLngLat: rdToLngLat(m.footprintLngLat.map(lngLatToRd).reduce((sum, p, _, arr) => ({ x: sum.x + p.x / arr.length, y: sum.y + p.y / arr.length }), { x: 0, y: 0 })),
  })),
}));
console.log(`\nwrote ${path.relative(process.cwd(), path.join(STAGING, 'pand-inventory.json'))}`);
