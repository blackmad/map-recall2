/**
 * Snapshot Amsterdam's bridge register (municipal data API,
 * `civieleconstructies`: `brug` for every bridge the city manages, joined by
 * object number to `brug_vast` for fixed bridges' construction year and who
 * they carry). The register's geometry is in RD New, turned into lng/lat here.
 *
 * Writes `scripts/data/amsterdam-bridge-register.json` (committed, so the
 * bridge facts rebuild without the network) and reports coverage.
 *
 * Usage: npm run fetch:amsterdam-bridge-register
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { rdToLngLat } from '../src/canalRecall/rdCoordinates';

const BASE = 'https://api.data.amsterdam.nl/v1/civieleconstructies';

async function all<T>(table: string, fields: string): Promise<T[]> {
  const rows: T[] = [];
  let url: string | undefined = `${BASE}/${table}/?_format=json&_pageSize=1000&_fields=${fields}`;
  while (url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${table}: HTTP ${response.status}`);
    const page = await response.json() as { _embedded: Record<string, T[]>; _links: { next?: { href: string } } };
    rows.push(...Object.values(page._embedded)[0]);
    url = page._links.next?.href;
  }
  return rows;
}

interface Polygon { type: string; coordinates: number[][][] | number[][][][] }
interface Brug { objectnummer: string; objectnaam: string | null; type: string | null; materiaal: string | null; geometrie: Polygon | null }
interface BrugVast { objectnummer: string; jaarVanAanleg: number | null; modaliteit: string | null; openbareruimte: string | null; status: string | null }

const bridges = await all<Brug>('brug', 'objectnummer,objectnaam,type,materiaal,geometrie');
const fixed = await all<BrugVast>('brug_vast', 'objectnummer,jaarVanAanleg,modaliteit,openbareruimte,status');
const fixedByNumber = new Map(fixed.filter(row => row.objectnummer).map(row => [row.objectnummer, row]));

/** The outer ring of the first polygon, lng/lat to 6 decimals (~0.1 m). */
function outerRing(geometry: Polygon | null): Array<[number, number]> {
  if (!geometry) return [];
  const ring = (geometry.type === 'MultiPolygon'
    ? (geometry.coordinates as number[][][][])[0]?.[0]
    : (geometry.coordinates as number[][][])[0]) ?? [];
  return ring.map(([x, y]) => rdToLngLat(x, y).map(value => Number(value.toFixed(6))) as [number, number]);
}

// [number, name, type, material, year, modality, street, ring]
const register = bridges
  .map(bridge => {
    const detail = fixedByNumber.get(bridge.objectnummer);
    return [
      bridge.objectnummer ?? '', bridge.objectnaam ?? '', bridge.type ?? '', bridge.materiaal ?? '',
      detail?.jaarVanAanleg ?? 0, detail?.modaliteit ?? '', detail?.openbareruimte ?? '', outerRing(bridge.geometrie),
    ] as const;
  })
  .filter(row => row[7].length >= 3)
  .sort((a, b) => a[0].localeCompare(b[0]));

const out = path.resolve('scripts/data/amsterdam-bridge-register.json');
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify({
  source: 'Gemeente Amsterdam, civiele constructies (api.data.amsterdam.nl/v1/civieleconstructies: brug, brug_vast)',
  fetched: new Date().toISOString().slice(0, 10),
  fields: ['number', 'name', 'type', 'material', 'year', 'modality', 'street', 'ring'],
  bridges: register,
})}\n`);
const withYear = register.filter(row => row[4]).length;
process.stdout.write(`${register.length} bridges (${withYear} with a construction year, ${register.filter(row => row[1]).length} named) → ${path.relative(process.cwd(), out)}\n`);
