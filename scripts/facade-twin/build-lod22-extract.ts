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
import { STRIP_BASE_BELOW_GROUND_M } from '../../src/canalRecall/facade/measure.ts';
import { AMSTERDAM_GRACHTENGORDEL_WEST } from '../../src/canalRecall/facade/areas.ts';
import { resolveHeights, type HeightReason } from '../../src/canalRecall/facade/buildRecord.ts';
import { CANAL_WATER_LEVEL_NAP_M } from '../../src/canalRecall/facade/rdNew.ts';
import { nearestMaterial, wallFamily } from '../../src/canalRecall/facade/materials.ts';
import { readGable } from '../../src/canalRecall/facade/heritageText.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import type { LngLat, MassingRecord } from '../../src/canalRecall/facade/sources.ts';

interface MeasuredFacade {
  pandId: string;
  wall: [number, number, number, number];
  wallWidthM: number;
  wallRgb: [number, number, number] | null;
  openings: Array<{ xM: number; yM: number; widthM: number; heightM: number }>;
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
 * Construction year, and the gable the register names.
 *
 * Both were sitting in the reconnaissance file unused, and their absence was
 * visible: with no year, `assumedGable` falls to its own default and every
 * building in the boundary got a `lijst` — a 19th-century parapet cornice
 * stamped across four centuries of fabric. With no register reading, the 695
 * panden whose gable is actually *stated* in prose were guessing alongside the
 * ones that are not.
 *
 * The distinction the renderer needs is not which gable but how we know: a
 * stated gable and an assumed one are different kinds of claim and are coloured
 * differently in evidence mode, so `stated` travels with the type.
 */
const years = new Map<string, number | null>(
  recon.buildings.map((b: { buildingId: string; constructionYear: number | null }) =>
    [b.buildingId, b.constructionYear ?? null]));
const statedGables = new Map<string, string>();
for (const listing of recon.heritage as Array<{ buildingId: string | null; description: string | null }>) {
  if (!listing.buildingId || !listing.description) continue;
  const reading = readGable(listing.description);
  if (reading.gable) statedGables.set(listing.buildingId, reading.gable);
}

/**
 * Measured façades, where any exist yet.
 *
 * Optional on purpose: the extract must build before any façade has been
 * measured, and the renderer must draw a boundary in which almost nothing has.
 */
let facades = new Map<string, MeasuredFacade>();
try {
  const store = JSON.parse(await readFile(path.join(STAGING, 'measured-facades.json'), 'utf8')) as { facades: Record<string, MeasuredFacade> };
  facades = new Map(Object.values(store.facades).filter(f => f.openings?.length).map(f => [f.pandId, f]));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

const origin = AREA.localOrigin;
const round = (value: number) => Math.round(value * 10) / 10;

/**
 * Canal water, in the same local frame as the buildings.
 *
 * Real OSM polygons rather than a buffer around the centrelines. A buffer needs
 * an assumed half-width, and the running score for assumed constants in this
 * project is three found and all three wrong by roughly a third.
 *
 * Drawn at the water level in rdNew.ts, which is Rijkswaterstaat's target for
 * the Amsterdam boezem — the one number here that is a published constant
 * rather than a measurement, and it says so.
 */
const water = JSON.parse(await readFile(
  path.resolve('src/canalRecall/facade/fixtures', `${AREA.areaId}-water.json`), 'utf8')) as
  { rings: Array<{ name: string | null; ring: LngLat[] }> };
const waterRings = water.rings
  .map(entry => {
    const ring: number[] = [];
    for (const point of entry.ring) {
      const p = RD_NEW.fromLngLat(point);
      ring.push(round(p.x - origin.x), round(p.y - origin.y));
    }
    return ring;
  })
  // Anything wholly outside the boundary's bounding box is another canal.
  .filter(ring => {
    for (let i = 0; i < ring.length; i += 2) {
      if (ring[i] > -700 && ring[i] < 900 && ring[i + 1] > -1200 && ring[i + 1] < 1200) return true;
    }
    return false;
  });

/**
 * Openings as the renderer wants them: metres along the wall, metres above the
 * building's own ground.
 */
function openingsOf(record: MeasuredFacade): Array<[number, number, number, number]> {
  return record.openings.flatMap(o => {
          /**
           * An opening sitting on the strip's bottom edge was not measured to
           * the bottom; the picture ran out under it.
           *
           * Lowering the strip from 0.4 m to 1.8 m below ground moved this
           * problem, it did not remove it — 1,223 of 15,178 openings still come
           * back with `yM` at exactly 0, which is the image edge, not a sill.
           * Some are genuine shopfronts and doors running to the pavement;
           * others are the strip's dark bottom — quay wall, shadow, the water —
           * read as one tall dark region.
           *
           * Either way the *sill* is unobserved, and drawing it at -1.8 m puts a
           * window floating in the air below a wall that starts at ground level,
           * which is worse than either reading. So the bottom is brought to the
           * building's own ground: a door or a shopfront does reach it, and the
           * top of the opening — which *was* observed — is left where it was
           * measured. Anything with no height left above ground is dropped
           * rather than drawn as a sliver.
           */
          const bottom = o.yM - STRIP_BASE_BELOW_GROUND_M;
          const top = bottom + o.heightM;
          const truncated = o.yM <= 0.08;
          if (!truncated) return [[o.xM, bottom, o.widthM, o.heightM] as [number, number, number, number]];
          if (top <= 0.4) return [];
          return [[o.xM, 0, o.widthM, Number(top.toFixed(2))] as [number, number, number, number]];
        });
}

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
    wallMaterial: string | null;
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
    year: years.get(entry.buildingId) ?? null,
    gable: statedGables.has(entry.buildingId)
      ? { type: statedGables.get(entry.buildingId)!, stated: true }
      : null,
    facade: (() => {
      const record = facades.get(entry.buildingId);
      if (!record) return null;
      const material = record.wallRgb
        ? nearestMaterial(record.wallRgb, wallFamily(record.wallRgb)).material.id
        : null;
      const openings = openingsOf(record);
      // Rejecting every reading leaves nothing observed, and a façade record
      // with no openings in it is a claim to have looked with nothing to show
      // for it. The building falls back to massing, which is what it is.
      if (!openings.length) return null;
      return {
        wall: [
          round(record.wall[0] - origin.x), round(record.wall[1] - origin.y),
          round(record.wall[2] - origin.x), round(record.wall[3] - origin.y),
        ] as [number, number, number, number],
        // Null, not a default brick: a wall whose colour was never sampled must
        // not arrive at the renderer wearing one.
        wallMaterial: material,
        openings,
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
    waterRings: waterRings.length,
    facadesMeasured: buildings.filter(b => b.facade).length,
    openingsMeasured: buildings.reduce((sum, b) => sum + (b.facade?.openings.length ?? 0), 0),
    note: 'Massing for every building; a measured façade only where one exists. `facade: null` means nobody has observed that building\'s front, which is true of almost all of them.',
  },
  buildings,
  water: { levelNap: CANAL_WATER_LEVEL_NAP_M, rings: waterRings },
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
