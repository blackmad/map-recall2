/**
 * Merge 3DBAG and OSM into one building source, one winner per building.
 *
 * This is Phase 1's deliverable. Today the game draws buildings from three
 * layers that each describe the same city — the basemap's gray extrusion, an
 * OSM colour layer and an OSM roof cap — and keeps them from z-fighting by
 * offsetting their heights by centimetres. Only a tenth of the city is
 * described at all, and most of its heights are `levels * 3` or a flat 9 m.
 *
 * The output is a single source in which every building appears exactly once,
 * at the best tier available for it, carrying that tier so a screenshot can be
 * traced back to whether the game measured something or inherited it:
 *
 *   tier 2  hand-mapped OSM parts — the Waag keeps its fourteen stepped parts
 *   tier 3  the 3DBAG extrusion at its AHN-measured height — most of the city
 *   tier 4  an OSM footprint BAG does not hold — canopies, ruins, some parts
 *
 * The BAG table is streamed a line at a time rather than parsed whole. It is
 * one feature per line by construction, and a complete city does not want to
 * be a single JSON value in memory.
 *
 * Staging only. It reports what changed and does not publish into the
 * versioned extract; promotion stays a decision someone makes.
 *
 * Usage:
 *   npm run build:lod1-city                 # amsterdam, from staging + extract
 *   npm run build:lod1-city -- --city=utrecht
 */

import { createReadStream, createWriteStream } from 'node:fs';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BAG3D_VERSION } from '../src/canalRecall/bag3dTiles.js';
import { decideTier, FootprintGrid, type LadderTier, type OsmFootprint, type Ring } from '../src/canalRecall/buildingLadder.js';

const flag = (name: string): string | undefined =>
  process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);

const city = flag('city') ?? 'amsterdam';
const extractDir = path.join('public', 'data', 'extracts', city);
const stagingDir = path.join(extractDir, 'staging');
const bagFile = path.join(stagingDir, 'bag-buildings.geojson');
// Complete OSM geometry — every building and building:part, colour or not.
// Appearance still comes from buildings-colored.geojson and is joined by id.
const osmFileCandidates = [
  path.join(stagingDir, 'buildings-osm.geojson'),
  path.join(extractDir, 'buildings-osm.geojson'),
];
const osmFile = (await Promise.all(osmFileCandidates.map(async candidate =>
  (await stat(candidate).catch(() => null)) ? candidate : null))).find(Boolean);

const colourFile = path.join(extractDir, 'buildings-colored.geojson');
const outputFile = path.join(stagingDir, 'lod1-city.geojson');
const reportFile = path.join(stagingDir, 'lod1-city.report.json');

type Geometry = { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] };
type Feature = { properties: Record<string, unknown>; geometry: Geometry };

const ringsOf = (geometry: Geometry): Ring[] =>
  geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat();

const asGeometry = (rings: Ring[]): Geometry =>
  rings.length === 1 ? { type: 'Polygon', coordinates: rings } : { type: 'MultiPolygon', coordinates: rings.map(ring => [ring]) };

if (!(await stat(bagFile).catch(() => null))) {
  process.stderr.write(`${bagFile} is missing — run \`npm run build:bag-buildings\` first\n`);
  process.exit(1);
}
if (!osmFile) {
  process.stderr.write(
    `buildings-osm.geojson is missing — run \`npm run build:osm-buildings\` into staging/ or the extract first\n`,
  );
  process.exit(1);
}
process.stdout.write(`OSM geometry: ${osmFile}\n`);

// --- appearance, keyed by osmId so geometry need not carry colour ------------
const colourById = new Map<string, Record<string, unknown>>();
if (await stat(colourFile).catch(() => null)) {
  const coloured = JSON.parse(await readFile(colourFile, 'utf8')) as { features: Feature[] };
  for (const feature of coloured.features) {
    const osmId = String(feature.properties.osmId ?? '');
    if (osmId) colourById.set(osmId, feature.properties);
  }
}

// --- the OSM side, indexed ---------------------------------------------------
type OsmBuilding = OsmFootprint & { properties: Record<string, unknown> };
const osm = JSON.parse(await readFile(osmFile, 'utf8')) as { features: Feature[] };
const grid = new FootprintGrid<OsmBuilding>();
const osmById = new Map<string, OsmBuilding>();
for (const feature of osm.features) {
  const rings = ringsOf(feature.geometry);
  if (rings.length === 0) continue;
  const osmId = String(feature.properties.osmId ?? '');
  const colour = colourById.get(osmId) ?? {};
  const properties = { ...feature.properties, ...colour, osmId };
  const building: OsmBuilding = {
    osmId,
    rings,
    minHeightM: Number(feature.properties.minHeight ?? 0),
    heightM: Number(feature.properties.height ?? colour.height ?? 0),
    roofShape: (feature.properties.roofShape as string) || (colour.roofShape as string) || undefined,
    isPart: Boolean(feature.properties.isPart),
    properties,
  };
  grid.add(building);
  osmById.set(building.osmId, building);
}

// --- pass one: every pand, decided against the OSM features overlapping it ----
await mkdir(stagingDir, { recursive: true });
const output = createWriteStream(outputFile);
let written = 0;
const write = async (line: string): Promise<void> => {
  const chunk = `${written === 0 ? '' : ',\n'}${line}`;
  written++;
  if (!output.write(chunk)) await once(output, 'drain');
};

const tiers = new Map<LadderTier, number>();
const bump = (tier: LadderTier): void => { tiers.set(tier, (tiers.get(tier) ?? 0) + 1); };
/** OSM features standing in for a pand — emitted at tier 2. */
const standIns = new Set<string>();
/** OSM features overlapping any pand — already represented, never tier 4. */
const represented = new Set<string>();
const heightChange: number[] = [];
let pands = 0;
let colouredFromOsm = 0;
/**
 * How far the BAG table actually reaches.
 *
 * Tier 4 means "BAG does not hold this structure", which is only a claim worth
 * making where BAG was consulted. The cached tiles cover the drivable area and
 * stop, while the OSM extract runs to the edges of the BBBike region, so an
 * OSM feature out in Zaandam is not evidence of a gap in the register — it is
 * a place nobody looked. Counting the two together would quietly overstate how
 * much of the city OSM still owns.
 */
const coverage = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity };

await output.write('{"type":"FeatureCollection","features":[\n');

const reader = createInterface({ input: createReadStream(bagFile), crlfDelay: Infinity });
for await (const rawLine of reader) {
  const line = rawLine.replace(/,\s*$/, '');
  if (!line.startsWith('{"type":"Feature"')) continue;
  const feature = JSON.parse(line) as Feature;
  const rings = ringsOf(feature.geometry);
  if (rings.length === 0) continue;
  pands++;
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      coverage.west = Math.min(coverage.west, lng);
      coverage.east = Math.max(coverage.east, lng);
      coverage.south = Math.min(coverage.south, lat);
      coverage.north = Math.max(coverage.north, lat);
    }
  }

  const bagId = String(feature.properties.bagId ?? '');
  const decision = decideTier({ bagId, rings }, grid.near(rings));
  for (const osmId of decision.matchedOsmIds) represented.add(osmId);

  if (decision.tier === 2) {
    bump(2);
    for (const osmId of decision.osmIds) standIns.add(osmId);
    continue; // its OSM parts are emitted below, standing in for this pand
  }

  bump(3);
  const matched = decision.matchedOsmIds.length > 0 ? osmById.get(decision.matchedOsmIds[0]) : undefined;
  if (matched) {
    colouredFromOsm++;
    const bagHeight = Number(feature.properties.height ?? 0);
    // What the measured height actually changes, building by building. This is
    // the number that says whether Phase 1 is a visible upgrade or a rounding
    // difference, and it is worth reporting rather than asserting.
    if (matched.heightM > 0 && bagHeight > 0) heightChange.push(bagHeight - matched.heightM);
  }

  await write(JSON.stringify({
    type: 'Feature',
    properties: {
      ...feature.properties,
      tier: 3,
      // Appearance rides along where an OSM footprint matched; the colour
      // pipeline replaces this with a measured value later.
      osmId: matched?.osmId ?? null,
      colour: matched?.properties.colour ?? null,
      roofColour: matched?.properties.roofColour ?? null,
      roofShape: matched?.properties.roofShape ?? null,
      roofHeight: matched?.properties.roofHeight ?? null
    },
    geometry: feature.geometry
  }));
}

// --- pass two: OSM features that stand in for a pand, or that BAG lacks -------
const insideCoverage = (rings: Ring[]): boolean => {
  const [lng, lat] = rings[0][0];
  return lng >= coverage.west && lng <= coverage.east && lat >= coverage.south && lat <= coverage.north;
};
let outsideCoverage = 0;
let suppressedUnmatched = 0;
for (const building of osmById.values()) {
  const isStandIn = standIns.has(building.osmId);
  // Anything else overlapping a pand is already out at tier 3. What remains is
  // a structure with no pand under it at all.
  if (!isStandIn && represented.has(building.osmId)) continue;
  const covered = isStandIn || insideCoverage(building.rings);
  if (!isStandIn && covered) {
    // With the complete OSM file, most "unmatched" outlines inside BAG
    // coverage are digitisation disagreements with a pand we already drew —
    // emitting them doubles the city and reintroduces z-fighting. Keep only
    // parts, stacked members, and named leftovers (true gaps in the register).
    const named = typeof building.properties.name === 'string' && building.properties.name.length > 0;
    if (!building.isPart && building.minHeightM <= 0 && !named) {
      suppressedUnmatched++;
      continue;
    }
  }
  if (!covered) outsideCoverage++;
  const tier: LadderTier = isStandIn ? 2 : 4;
  bump(tier === 2 ? 2 : 4);
  await write(JSON.stringify({
    type: 'Feature',
    properties: {
      ...building.properties,
      tier,
      bagId: null,
      heightSource: 'osm',
      // Distinguishes "BAG has no such building" from "BAG was never asked
      // here". Only the first is a statement about the register.
      bagConsulted: covered
    },
    geometry: asGeometry(building.rings)
  }));
}

output.write('\n]}\n');
output.end();
await once(output, 'finish');

// --- report ------------------------------------------------------------------
// Tier 2 is counted twice above on purpose — once as panden suppressed, once
// as the OSM features emitted in their place — so separate the two.
const standInFeatures = standIns.size;
const suppressedPands = (tiers.get(2) ?? 0) - standInFeatures;
const median = (values: number[]): number => (values.length === 0 ? 0 : [...values].sort((a, b) => a - b)[values.length >> 1]);
const quantile = (values: number[], q: number): number =>
  values.length === 0 ? 0 : [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * q))];

const report = {
  version: BAG3D_VERSION,
  city,
  generatedAt: new Date().toISOString(),
  pands,
  features: written,
  tiers: {
    '2-osm-parts': standInFeatures,
    '3-bag-extrusion': tiers.get(3) ?? 0,
    '4-osm-only': tiers.get(4) ?? 0
  },
  pandsSuppressedByOsmParts: suppressedPands,
  bagCoverage: coverage,
  osmOutsideBagCoverage: outsideCoverage,
  osmUnmatchedSuppressed: suppressedUnmatched,
  pandsWithOsmAppearance: colouredFromOsm,
  osmFeatures: osmById.size,
  heightChangeVsOsm: {
    compared: heightChange.length,
    medianM: Math.round(median(heightChange) * 100) / 100,
    p05M: Math.round(quantile(heightChange, 0.05) * 100) / 100,
    p95M: Math.round(quantile(heightChange, 0.95) * 100) / 100
  },
  outputBytes: (await stat(outputFile)).size
};
await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`);

const share = (count: number): string => `${count} (${Math.round((count / written) * 100)}%)`;
process.stdout.write(`\nlod1 city -> ${outputFile}\n`);
process.stdout.write(`  panden in       ${pands}\n`);
process.stdout.write(`  features out    ${written}\n`);
process.stdout.write(`  tier 2 osm      ${share(standInFeatures)} parts standing in for ${suppressedPands} panden\n`);
process.stdout.write(`  tier 3 bag      ${share(tiers.get(3) ?? 0)} measured extrusions\n`);
process.stdout.write(`  tier 4 osm only ${share(tiers.get(4) ?? 0)}, of which ${outsideCoverage} lie outside the area BAG was fetched for\n`);
process.stdout.write(`                  ${(tiers.get(4) ?? 0) - outsideCoverage} are genuine gaps in the register inside it\n`);
process.stdout.write(`  unmatched skip  ${suppressedUnmatched} plain outlines inside BAG coverage (digitisation doubles)\n`);
process.stdout.write(`  appearance      ${colouredFromOsm} panden inherit an OSM colour\n`);
process.stdout.write(`  height vs osm   median ${report.heightChangeVsOsm.medianM} m (p05 ${report.heightChangeVsOsm.p05M}, p95 ${report.heightChangeVsOsm.p95M}) over ${heightChange.length} buildings\n`);
process.stdout.write(`  output          ${(report.outputBytes / 1e6).toFixed(1)} MB\n`);
process.stdout.write('\nStaging only. Review the report before publishing into the versioned extract.\n');
