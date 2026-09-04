/**
 * The LoD2.2 massing extract the game draws — M1's deliverable.
 *
 * Footprint, ground level, eaves and ridge for every building in the boundary,
 * keyed by BAG `pand_id`, in metres relative to the area's fixed local origin.
 * Nothing here is a façade: no openings, no gable form, no measured colour.
 * That is the correct resting tier for a building whose front nobody has
 * looked at, and 2,981 of the 3,025 are in exactly that state.
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

const AREA = AMSTERDAM_GRACHTENGORDEL_WEST;
const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);

const registry = JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-registry.json`), 'utf8')).data as
  Array<{ buildingId: string; footprintLngLat: LngLat[] }>;
const recon = JSON.parse(await readFile(path.join(STAGING, 'recon.json'), 'utf8'));
const massing = new Map<string, MassingRecord>(recon.massing.map((m: MassingRecord) => [m.buildingId, m]));
const inArea = new Set<string>(recon.buildings.map((b: { buildingId: string }) => b.buildingId));

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
    note: 'Massing only. No façade: no openings, no gable form, no measured colour. A building here has not had its front observed.',
  },
  buildings,
}));

const bytes = (await readFile(file)).length;
console.log(`${buildings.length} buildings, ${(bytes / 1024 / 1024).toFixed(2)} MB`);
console.log(`  ${buildings.filter(b => b.ridge !== null).length} with a ridge, ${buildings.filter(b => b.eaves !== null).length} with eaves`);
console.log('\nHeight resolution');
for (const [reason, n] of [...reasons.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${reason}`);
const roofs = new Map<string, number>();
for (const b of buildings) roofs.set(b.roof, (roofs.get(b.roof) ?? 0) + 1);
console.log('\nRoof form');
for (const [roof, n] of [...roofs.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${roof}`);
console.log(`\nwrote ${path.relative(process.cwd(), file)}`);
