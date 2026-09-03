/**
 * RECON-2 — join 3DBAG LoD2.2 massing and reconstruction quality onto the BAG
 * inventory, keyed by pand_id.
 *
 * This is the layer that decides how far up the fidelity ladder a building is
 * *allowed* to go. 3DBAG publishes, per building, how well its own
 * reconstruction fitted the AHN point cloud (`b3_rmse_lod22`), whether the
 * geometry is valid (`b3_val3dity_lod22`), how much of the roof had no laser
 * returns (`b3_nodata_fractie_*`) and which AHN campaign it used. A building
 * whose own publisher says the reconstruction is poor must not be promoted to
 * detailed geometry on the strength of a confident-looking façade photograph.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildPilotBoundary, type CanalCentreline } from '../../src/canalRecall/facade/pilotBoundary.ts';
import { lngLatToRd } from '../../src/canalRecall/facade/rdNew.ts';
import { loadBoundaryCanals } from './fetch-boundary-canals.ts';

const ITEMS = 'https://api.3dbag.nl/collections/pand/items';
const CACHE_FILE = path.resolve('.cache/facade-twin/3dbag-attributes.json');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin');
const TILE_M = 250;
const PAGE = 100;

export interface MassingAttributes {
  pandId: string;
  storeys: number | null;
  roofType: string | null;
  groundLevelNap: number | null;
  eavesHeightNap: number | null;   // b3_h_dak_50p — the 50th percentile roof height
  roof70Nap: number | null;
  ridgeHeightNap: number | null;
  roofMinNap: number | null;
  rmseLod22: number | null;
  valid: boolean | null;
  qualityFlag: boolean | null;
  ahnSource: string | null;
  ahnYear: number | null;
  nodataFraction: number | null;
  groundAreaM2: number | null;
  exteriorWallM2: number | null;
  partyWallM2: number | null;
  pitchedRoofM2: number | null;
  flatRoofM2: number | null;
  insufficientPointCloud: boolean | null;
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Page by following the server's own `next` link.
 *
 * Do not synthesise the offset: this API's offsets are 1-based, and asking for
 * `offset=0` returns HTTP 500 rather than the first page. Following the link it
 * gives us sidesteps the question entirely.
 */
async function fetchTile(minX: number, minY: number): Promise<Record<string, any>> {
  const objects: Record<string, any> = {};
  let url: string | null = `${ITEMS}?bbox=${minX},${minY},${minX + TILE_M},${minY + TILE_M}&limit=${PAGE}`;
  while (url) {
    let payload: any;
    for (let attempt = 0; ; attempt++) {
      const response = await fetch(url, { headers: { 'User-Agent': 'MapRecallFacadeTwin/1.0' } });
      if (response.ok) { payload = await response.json(); break; }
      if (attempt >= 4) throw new Error(`3DBAG: HTTP ${response.status} for ${url}`);
      await wait(500 * 2 ** attempt);
    }
    for (const feature of payload.features ?? []) {
      for (const [key, object] of Object.entries(feature.CityObjects ?? {}) as Array<[string, any]>) {
        if (object.type !== 'Building') continue;
        objects[key] = object.attributes;
      }
    }
    url = (payload.links ?? []).find((link: any) => link.rel === 'next')?.href ?? null;
  }
  return objects;
}

async function loadAttributes(bbox: readonly number[], refresh: boolean): Promise<Record<string, any>> {
  if (!refresh) {
    try {
      return JSON.parse(await readFile(CACHE_FILE, 'utf8')).attributes;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  const min = lngLatToRd([bbox[0], bbox[1]]), max = lngLatToRd([bbox[2], bbox[3]]);
  const x0 = Math.floor(min.x / TILE_M) * TILE_M, y0 = Math.floor(min.y / TILE_M) * TILE_M;
  const tiles: Array<[number, number]> = [];
  for (let x = x0; x <= max.x; x += TILE_M) for (let y = y0; y <= max.y; y += TILE_M) tiles.push([x, y]);

  const attributes: Record<string, any> = {};
  let done = 0;
  for (const [x, y] of tiles) {
    Object.assign(attributes, await fetchTile(x, y));
    done++;
    process.stdout.write(`\r  tile ${done}/${tiles.length} — ${Object.keys(attributes).length} buildings`);
  }
  process.stdout.write('\n');
  await mkdir(path.dirname(CACHE_FILE), { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify({
    source: '3DBAG API (api.3dbag.nl), collection pand',
    collectionVersion: 'see api.3dbag.nl/collections — v2023.10.08 at time of writing',
    retrieved: new Date().toISOString(),
    attributes,
  }));
  return attributes;
}

const number = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

export function toMassing(pandId: string, a: Record<string, any>): MassingAttributes {
  return {
    pandId,
    storeys: number(a.b3_bouwlagen),
    roofType: typeof a.b3_dak_type === 'string' ? a.b3_dak_type : null,
    groundLevelNap: number(a.b3_h_maaiveld),
    eavesHeightNap: number(a.b3_h_dak_50p),
    roof70Nap: number(a.b3_h_dak_70p),
    ridgeHeightNap: number(a.b3_h_nok) ?? number(a.b3_h_dak_max),
    roofMinNap: number(a.b3_h_dak_min),
    rmseLod22: number(a.b3_rmse_lod22),
    valid: typeof a.b3_val3dity_lod22 === 'string' ? a.b3_val3dity_lod22 === '[]' : null,
    qualityFlag: typeof a.b3_kwaliteitsindicator === 'boolean' ? a.b3_kwaliteitsindicator : null,
    ahnSource: typeof a.b3_pw_bron === 'string' ? a.b3_pw_bron : null,
    ahnYear: number(a.b3_pw_datum),
    nodataFraction: number(a.b3_nodata_fractie_ahn5) ?? number(a.b3_nodata_fractie_ahn4),
    groundAreaM2: number(a.b3_opp_grond),
    exteriorWallM2: number(a.b3_opp_buitenmuur),
    partyWallM2: number(a.b3_opp_scheidingsmuur),
    pitchedRoofM2: number(a.b3_opp_dak_schuin),
    flatRoofM2: number(a.b3_opp_dak_plat),
    insufficientPointCloud: typeof a.b3_pw_onvoldoende === 'boolean' ? a.b3_pw_onvoldoende : null,
  };
}

const refresh = process.argv.includes('--refresh');
const ways = await loadBoundaryCanals();
const boundary = buildPilotBoundary(ways.map(w => ({ name: w.name, points: w.points }) as CanalCentreline));
const inventory = JSON.parse(await readFile(path.join(STAGING, 'pand-inventory.json'), 'utf8')) as {
  panden: Array<{ pandId: string; bouwjaar: number | null; plotWidthM: number; status: string }>;
};

console.log(`Fetching 3DBAG attributes over the boundary (${TILE_M} m tiles)…`);
const raw = await loadAttributes(boundary.bboxLngLat, refresh);

const byPandId = new Map<string, MassingAttributes>();
for (const [key, attributes] of Object.entries(raw)) {
  const pandId = key.replace(/^NL\.IMBAG\.Pand\./, '').split('-')[0];
  if (!byPandId.has(pandId)) byPandId.set(pandId, toMassing(pandId, attributes));
}
console.log(`  ${byPandId.size} distinct panden with 3DBAG attributes in the bbox`);

const joined = inventory.panden.map(pand => ({ pand, massing: byPandId.get(pand.pandId) ?? null }));
const matched = joined.filter(j => j.massing);
console.log(`\nCoverage: ${matched.length}/${inventory.panden.length} inventory panden matched (${(100 * matched.length / inventory.panden.length).toFixed(1)}%)`);

const histogram = (label: string, values: Array<string | null>) => {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(String(value), (counts.get(String(value)) ?? 0) + 1);
  console.log(`\n${label}`);
  for (const [key, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(count).padStart(5)}  ${key}`);
};

histogram('Roof type (b3_dak_type)', matched.map(j => j.massing!.roofType));
histogram('AHN campaign used (b3_pw_bron)', matched.map(j => j.massing!.ahnSource));
histogram('LoD2.2 geometry valid (b3_val3dity_lod22)', matched.map(j => String(j.massing!.valid)));
histogram('Quality indicator (b3_kwaliteitsindicator)', matched.map(j => String(j.massing!.qualityFlag)));

const rmse = matched.map(j => j.massing!.rmseLod22).filter((v): v is number => v !== null).sort((a, b) => a - b);
const at = (p: number) => rmse[Math.min(rmse.length - 1, Math.floor(rmse.length * p))];
console.log('\nLoD2.2 reconstruction RMSE against the point cloud (metres)');
for (const p of [0.25, 0.5, 0.75, 0.9, 0.95, 0.99]) console.log(`  p${String(p * 100).padStart(2)}  ${at(p).toFixed(2)} m`);

/**
 * Do NOT read `b3_rmse_lod22` as a promotion gate on its own.
 *
 * The obvious move is to threshold it — say 0.5 m, a sixth of a canal-house
 * storey — and promote what passes. Measured across the pilot that keeps only
 * 39% of buildings, which would gut the boundary. But splitting the same number
 * by roof type shows what it is actually tracking:
 *
 *     horizontal (flat)   median 0.11 m
 *     slanted (pitched)   median 0.60 m
 *
 * and it is flat across plot width and across century. So the residual is a
 * measure of *roof complexity*, not reconstruction failure: a canal roof with
 * dormers, chimneys, a stepped gable and a ridge has real geometry that LoD2.2
 * planes do not represent, and the point cloud dutifully reports the difference.
 * A single global threshold would therefore reject buildings for being
 * interesting, which is precisely backwards for this project.
 *
 * So this reports the split rather than a verdict. The real gate has to be
 * calibrated per roof type against hand-verified buildings before it decides
 * anything — that is what M4's calibration corpus is for.
 */
const gate = (rows: typeof matched, limit: number) =>
  rows.filter(j => (j.massing!.rmseLod22 ?? 99) <= limit && j.massing!.valid !== false && j.massing!.insufficientPointCloud !== true);
const pitched = matched.filter(j => j.massing!.roofType === 'slanted');
const flat = matched.filter(j => j.massing!.roofType !== 'slanted');
console.log('\nReconstruction quality — reported per roof type, because a single threshold measures complexity, not failure');
console.log(`  pitched roofs  ${String(pitched.length).padStart(5)}  within 0.5 m: ${(100 * gate(pitched, 0.5).length / pitched.length).toFixed(0)}%   within 1.0 m: ${(100 * gate(pitched, 1.0).length / pitched.length).toFixed(0)}%`);
console.log(`  flat roofs     ${String(flat.length).padStart(5)}  within 0.5 m: ${(100 * gate(flat, 0.5).length / flat.length).toFixed(0)}%   within 1.0 m: ${(100 * gate(flat, 1.0).length / flat.length).toFixed(0)}%`);
const structurallySound = matched.filter(j => j.massing!.valid !== false && j.massing!.insufficientPointCloud !== true && j.massing!.qualityFlag !== false);
console.log(`  structurally sound (valid geometry, sufficient point cloud, quality flag set): ${structurallySound.length} (${(100 * structurallySound.length / matched.length).toFixed(1)}%)`);
const trustworthy = structurallySound;

const storeys = matched.map(j => j.massing!.storeys).filter((v): v is number => v !== null);
const storeyCounts = new Map<number, number>();
for (const s of storeys) storeyCounts.set(s, (storeyCounts.get(s) ?? 0) + 1);
console.log('\nStoreys (b3_bouwlagen)');
for (const [s, count] of [...storeyCounts.entries()].sort((a, b) => a[0] - b[0])) if (count > 5) console.log(`  ${String(s).padStart(3)}  ${String(count).padStart(5)}  ${'#'.repeat(Math.round(count / 20))}`);

const heights = matched.filter(j => j.massing!.ridgeHeightNap !== null && j.massing!.groundLevelNap !== null);
const above = heights.map(j => j.massing!.ridgeHeightNap! - j.massing!.groundLevelNap!).sort((a, b) => a - b);
console.log('\nRidge height above ground (m)');
for (const p of [0.05, 0.25, 0.5, 0.75, 0.95]) console.log(`  p${String(p * 100).padStart(2)}  ${above[Math.floor(above.length * p)].toFixed(1)} m`);

await writeFile(path.join(STAGING, 'massing-join.json'), JSON.stringify({
  metadata: {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/facade-twin/build-massing-join.ts',
    source: '3DBAG API (api.3dbag.nl) joined to the BAG pand inventory by pand_id',
    inventoryPanden: inventory.panden.length,
    matched: matched.length,
    trustworthyMassing: trustworthy.length,
  },
  massing: matched.map(j => j.massing),
}));
console.log(`\nwrote ${path.relative(process.cwd(), path.join(STAGING, 'massing-join.json'))}`);
