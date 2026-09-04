/**
 * The LoD2.2 massing extract the game draws — M1's deliverable.
 *
 * Footprint, ground level, eaves and ridge for every building in the boundary,
 * keyed by BAG `pand_id`, in metres relative to the area's fixed local origin.
 * Most of it is not a façade: no openings, no gable form, no measured colour.
 * That is the correct resting tier for a building whose front nobody has looked
 * at, and it is the state the great majority are in.
 *
 * Where a façade *has* been measured, it is merged in here so the renderer can
 * draw it — the openings found in that building's own photograph, its measured
 * wall material, and the front wall they sit on. The two tiers live in one
 * extract because the renderer has to resolve one representation per building,
 * and a building carries `facade: null` when nobody has observed its front.
 *
 * Heights come through `resolveHeights` rather than straight off the massing
 * model, so the 198 buildings across the pilot whose modelled ridge sits below
 * their own measured roof height never reach the renderer as an eaves line
 * above its own ridge.
 *
 * Coordinates are metres from the local origin, rounded to 10 cm — a tenth of
 * the 12.5 cm orthophoto pixel everything upstream measures from, and it halves
 * the extract.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AMSTERDAM_GRACHTENGORDEL_WEST } from '../../src/canalRecall/facade/areas.ts';
import { resolveHeights, type HeightReason } from '../../src/canalRecall/facade/buildRecord.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import type { LngLat, MassingRecord } from '../../src/canalRecall/facade/sources.ts';

interface BlockRecord {
  house: { pandId: string };
  frontWall: { start: [number, number]; end: [number, number]; widthM: number } | null;
  measuredOpenings: Array<{ xM: number; yM: number; widthM: number; heightM: number }>;
  render: { wallMaterial: string; wallSource: string };
}

const AREA = AMSTERDAM_GRACHTENGORDEL_WEST;
const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);

const registry = JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-registry.json`), 'utf8')).data as
  Array<{ buildingId: string; footprintLngLat: LngLat[] }>;
const recon = JSON.parse(await readFile(path.join(STAGING, 'recon.json'), 'utf8'));
const massing = new Map<string, MassingRecord>(recon.massing.map((m: MassingRecord) => [m.buildingId, m]));
const inArea = new Set<string>(recon.buildings.map((b: { buildingId: string }) => b.buildingId));

/**
 * Measured façades, where any exist yet.
 *
 * Optional on purpose: the extract must build before any façade has been
 * measured, and the renderer must draw a boundary in which almost nothing has.
 */
let facades = new Map<string, BlockRecord>();
try {
  const block = JSON.parse(await readFile(path.join(STAGING, 'block.json'), 'utf8')) as { buildings: BlockRecord[] };
  facades = new Map(block.buildings
    .filter(record => record.frontWall && record.measuredOpenings?.length)
    .map(record => [record.house.pandId, record]));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

const origin = AREA.localOrigin;
const round = (value: number) => Math.round(value * 10) / 10;

const seen = new Set<string>();
const buildings: Array<{
  id: string;
  ring: number[];
  ground: number;
  eaves: number | null;
  ridge: number | null;
  roof: string;
  reason: HeightReason | null;
  /** Present only where this building's front has actually been observed. */
  facade: {
    wall: [x0: number, y0: number, x1: number, y1: number];
    wallMaterial: string;
    openings: Array<[alongM: number, upM: number, widthM: number, heightM: number]>;
  } | null;
}> = [];

const reasons = new Map<string, number>();
for (const entry of registry) {
  if (!inArea.has(entry.buildingId) || seen.has(entry.buildingId)) continue;
  seen.add(entry.buildingId);

  const mass = massing.get(entry.buildingId);
  const heights = mass ? resolveHeights(mass) : null;
  if (heights) reasons.set(heights.reason, (reasons.get(heights.reason) ?? 0) + 1);

  const ring: number[] = [];
  for (const point of entry.footprintLngLat) {
    const p = RD_NEW.fromLngLat(point);
    ring.push(round(p.x - origin.x), round(p.y - origin.y));
  }

  buildings.push({
    id: entry.buildingId,
    ring,
    ground: round(mass?.groundLevel ?? 0),
    // Above ground, not above NAP: the renderer places a building on its own
    // quay, and quay heights vary along a canal.
    eaves: heights?.eavesM != null ? round(heights.eavesM) : null,
    ridge: heights?.ridgeM != null ? round(heights.ridgeM) : null,
    roof: mass?.roofForm ?? 'unknown',
    reason: heights?.reason ?? null,
    facade: (() => {
      const record = facades.get(entry.buildingId);
      if (!record?.frontWall) return null;
      return {
        wall: [
          round(record.frontWall.start[0] - origin.x), round(record.frontWall.start[1] - origin.y),
          round(record.frontWall.end[0] - origin.x), round(record.frontWall.end[1] - origin.y),
        ] as [number, number, number, number],
        wallMaterial: record.render.wallMaterial,
        // Openings are metres along the wall from its start, and metres above
        // the strip base, which was cut 0.4 m below the measured ground.
        openings: record.measuredOpenings.map(o =>
          [o.xM, o.yM - 0.4, o.widthM, o.heightM] as [number, number, number, number]),
      };
    })(),
  });
}

await mkdir(STAGING, { recursive: true });
const file = path.join(STAGING, 'lod22.json');
await writeFile(file, JSON.stringify({
  metadata: {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/facade-twin/build-lod22-extract.ts',
    areaId: AREA.areaId,
    tier: 'lod2.2',
    crs: 'EPSG:28992 metres relative to localOrigin; heights in metres above each building’s own ground level',
    localOrigin: origin,
    localOriginLngLat: RD_NEW.toLngLat(origin),
    attribution: 'BAG, Kadaster (CC0); 3DBAG LoD2.2, TU Delft (CC BY 4.0), from AHN',
    buildings: buildings.length,
    withRidge: buildings.filter(b => b.ridge !== null).length,
    withEaves: buildings.filter(b => b.eaves !== null).length,
    facadesMeasured: buildings.filter(b => b.facade).length,
    openingsMeasured: buildings.reduce((sum, b) => sum + (b.facade?.openings.length ?? 0), 0),
    note: 'Massing for every building; a measured façade only where one exists. `facade: null` means nobody has observed that building\'s front, which is true of almost all of them.',
  },
  buildings,
}));

const bytes = (await readFile(file)).length;
console.log(`${buildings.length} buildings, ${(bytes / 1024 / 1024).toFixed(2)} MB`);
console.log(`  ${buildings.filter(b => b.ridge !== null).length} with a ridge, ${buildings.filter(b => b.eaves !== null).length} with eaves`);
console.log(`  ${buildings.filter(b => b.facade).length} with a measured façade, ${buildings.reduce((s, b) => s + (b.facade?.openings.length ?? 0), 0)} openings in total`);
console.log('\nHeight resolution');
for (const [reason, n] of [...reasons.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${reason}`);
const roofs = new Map<string, number>();
for (const b of buildings) roofs.set(b.roof, (roofs.get(b.roof) ?? 0) + 1);
console.log('\nRoof form');
for (const [roof, n] of [...roofs.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${roof}`);
console.log(`\nwrote ${path.relative(process.cwd(), file)}`);
