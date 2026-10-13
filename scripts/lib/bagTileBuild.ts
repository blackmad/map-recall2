/**
 * Write the BAG-keyed base tiles, the facts sidecar and the coverage report.
 *
 * Called by `build-bag-buildings.ts --tiles`. The tiles are the shipped
 * `building-tiles` features (so geometry, paint and heights are what is drawn
 * today) with the 3DBAG facts and the overlapping OSM ids added; the facts
 * sidecar holds the mid-tier descriptor per pand.
 */
import { createReadStream } from 'node:fs';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { FootprintGrid, ringCentroid, type Ring } from '../../src/canalRecall/buildingLadder.js';
import {
  factsTile, isPandId, matchOsm, midDescriptor, plausibleYear, shortPandId, tileFactProperties,
  type MidDescriptor, type OsmCandidate, type PandFacts,
} from '../../src/canalRecall/bagTiles.js';

export type OsmBuilding = OsmCandidate & { isPart: boolean; refBag: string | null };

type Geometry = { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] };
type TileFeature = { type: 'Feature'; properties: Record<string, unknown>; geometry: Geometry };

const outerRingsOf = (geometry: Geometry): Ring[] =>
  geometry.type === 'Polygon' ? [geometry.coordinates[0]] : geometry.coordinates.map(polygon => polygon[0]);

/** Stream the osmium GeoJSONSeq export (`@type`/`@id` properties) into footprints with canonical `w123`/`r123` ids. */
export async function readOsmBuildings(seqFile: string): Promise<OsmBuilding[]> {
  const out: OsmBuilding[] = [];
  const reader = createInterface({ input: createReadStream(seqFile), crlfDelay: Infinity });
  for await (const raw of reader) {
    const line = raw.replace(/^\u001e/, '').trim();
    if (!line) continue;
    const feature = JSON.parse(line) as { geometry?: Geometry; properties?: Record<string, unknown> };
    const props = feature.properties ?? {};
    if (!props.building && !props['building:part']) continue;
    const type = props['@type'];
    if (type !== 'way' && type !== 'relation') continue;
    if (!feature.geometry || (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon')) continue;
    const rings = outerRingsOf(feature.geometry).filter(ring => ring && ring.length >= 4);
    if (!rings.length) continue;
    const ref = typeof props['ref:bag'] === 'string' ? props['ref:bag'].replace(/^0*(?=\d{16}$)/, '') : null;
    out.push({
      osmId: `${type === 'way' ? 'w' : 'r'}${props['@id']}`,
      rings,
      isPart: Boolean(props['building:part']) && !props.building,
      refBag: ref && /^\d{16}$/.test(ref) ? ref : null,
    });
  }
  return out;
}

export type BagTileOptions = {
  facts: ReadonlyMap<string, PandFacts>;
  osm: readonly OsmBuilding[];
  /** Published `building-tiles/<z>` directory to augment. */
  baseDir: string;
  zoom: number;
  outDir: string;
};

const kb = (bytes: number): number => Math.round(bytes / 1024);

export async function writeBagTiles(options: BagTileOptions): Promise<Record<string, unknown>> {
  const { facts, osm, baseDir, zoom, outDir } = options;
  const grid = new FootprintGrid<OsmBuilding>();
  for (const building of osm) grid.add(building);

  const tilesOut = path.join(outDir, 'bag-tiles', String(zoom));
  const factsOut = path.join(outDir, 'bag-facts', String(zoom));
  await rm(path.join(outDir, 'bag-tiles'), { recursive: true, force: true });
  await rm(path.join(outDir, 'bag-facts'), { recursive: true, force: true });

  let pands = 0, osmOnly = 0, withFacts = 0, withEaves = 0, withRidge = 0, withRoof = 0, withYear = 0, noFacts = 0;
  let noOsm = 0, osmAliases = 0, multiAlias = 0;
  let baseGzip = 0, bagGzip = 0, factsGzip = 0, baseRaw = 0, bagRaw = 0;
  const matchedOsm = new Set<string>();
  const pandOsm = new Map<string, string[]>();
  const archetypes = new Map<number, number>();
  const west = { w: Infinity, s: Infinity, e: -Infinity, n: -Infinity };
  const tileList: string[] = [];

  for (const x of (await readdir(baseDir)).filter(name => /^\d+$/.test(name)).sort()) {
    for (const file of (await readdir(path.join(baseDir, x))).filter(name => name.endsWith('.geojson.gz')).sort()) {
      const y = file.replace('.geojson.gz', '');
      const baseBytes = await readFile(path.join(baseDir, x, file));
      baseGzip += baseBytes.byteLength;
      const baseText = gunzipSync(baseBytes).toString('utf8');
      baseRaw += Buffer.byteLength(baseText);
      const collection = JSON.parse(baseText) as { features: TileFeature[] };
      const pandFacts: Record<string, MidDescriptor> = {};
      const features: string[] = [];
      for (const feature of collection.features) {
        const id = String(feature.properties.id ?? '');
        if (!isPandId(id)) { osmOnly++; features.push(JSON.stringify(feature)); continue; }
        pands++;
        const rings = outerRingsOf(feature.geometry);
        for (const ring of rings) for (const [lng, lat] of ring) {
          if (lng < west.w) west.w = lng; if (lng > west.e) west.e = lng;
          if (lat < west.s) west.s = lat; if (lat > west.n) west.n = lat;
        }
        const matches = matchOsm(rings, grid.near(rings));
        for (const osmId of matches) matchedOsm.add(osmId);
        if (matches.length === 0) noOsm++;
        if (matches.length > 1) multiAlias++;
        osmAliases += matches.length;
        pandOsm.set(id, matches);
        const pandFactsRow = facts.get(id);
        if (!pandFactsRow) noFacts++;
        else {
          withFacts++;
          if (pandFactsRow.eavesM !== null) withEaves++;
          if (pandFactsRow.ridgeM !== null) withRidge++;
          if (pandFactsRow.roofType) withRoof++;
          if (plausibleYear(pandFactsRow.year)) withYear++;
          const descriptor = midDescriptor(pandFactsRow);
          pandFacts[shortPandId(id)] = descriptor;
          archetypes.set(descriptor[0], (archetypes.get(descriptor[0]) ?? 0) + 1);
        }
        features.push(JSON.stringify({
          type: 'Feature',
          properties: { ...feature.properties, ...(pandFactsRow ? tileFactProperties(pandFactsRow, matches) : tileFactProperties(emptyFacts, matches)) },
          geometry: feature.geometry,
        }));
      }
      const body = `{"type":"FeatureCollection","features":[\n${features.join(',\n')}\n]}\n`;
      bagRaw += Buffer.byteLength(body);
      const gz = gzipSync(body);
      bagGzip += gz.byteLength;
      await mkdir(path.join(tilesOut, x), { recursive: true });
      await writeFile(path.join(tilesOut, x, file), gz);
      if (Object.keys(pandFacts).length) {
        const fz = gzipSync(JSON.stringify(factsTile(pandFacts)));
        factsGzip += fz.byteLength;
        await mkdir(path.join(factsOut, x), { recursive: true });
        await writeFile(path.join(factsOut, x, `${y}.json.gz`), fz);
      }
      tileList.push(`${zoom}/${x}/${y}`);
    }
  }

  // OSM buildings (not parts) inside the area BAG was consulted for that no pand claims.
  let osmBuildings = 0, osmNoPand = 0, refBagKnown = 0, refBagAgree = 0;
  const knownPandIds = new Set([...pandOsm.keys()].map(shortPandId));
  const matchedPandsOf = new Map<string, Set<string>>();
  for (const [pand, ids] of pandOsm) for (const id of ids) {
    const set = matchedPandsOf.get(id) ?? new Set<string>();
    set.add(shortPandId(pand));
    matchedPandsOf.set(id, set);
  }
  const osmNoPandSamples: string[] = [];
  for (const building of osm) {
    if (building.isPart) continue;
    const [lng, lat] = ringCentroid(building.rings[0]);
    if (lng < west.w || lng > west.e || lat < west.s || lat > west.n) continue;
    osmBuildings++;
    if (!matchedOsm.has(building.osmId)) { osmNoPand++; if (osmNoPandSamples.length < 8) osmNoPandSamples.push(building.osmId); }
    if (building.refBag && knownPandIds.has(building.refBag)) {
      refBagKnown++;
      if (matchedPandsOf.get(building.osmId)?.has(building.refBag)) refBagAgree++;
    }
  }

  await writeFile(path.join(outDir, 'bag-tiles', `index-z${zoom}.json`), `${JSON.stringify({ zoom, features: pands + osmOnly, tiles: tileList.length, tileList }, null, 1)}\n`);

  return {
    zoom,
    tiles: tileList.length,
    features: pands + osmOnly,
    pands,
    osmOnlyFeatures: osmOnly,
    pandsWith3dbagFacts: withFacts,
    pandsWithout3dbagFacts: noFacts,
    pandFactCoverage: Math.round((withFacts / pands) * 10000) / 10000,
    withEaves, withRidge, withRoofType: withRoof, withConstructionYear: withYear,
    pandsWithNoOsmMatch: noOsm,
    pandsWithMultipleOsmMatches: multiAlias,
    osmAliasesWritten: osmAliases,
    osmBuildingsInBagArea: osmBuildings,
    osmBuildingsWithNoPand: osmNoPand,
    osmNoPandSamples,
    refBag: { osmWithKnownRefBag: refBagKnown, ourMatchAgrees: refBagAgree },
    archetypes: Object.fromEntries([...archetypes].sort((a, b) => a[0] - b[0])),
    size: {
      currentBuildingTilesGzipKB: kb(baseGzip), bagTilesGzipKB: kb(bagGzip), factsSidecarGzipKB: kb(factsGzip),
      currentRawMB: Math.round(baseRaw / 1e5) / 10, bagRawMB: Math.round(bagRaw / 1e5) / 10,
      bagTilesVsCurrent: Math.round((bagGzip / baseGzip) * 1000) / 1000,
    },
  };
}

const emptyFacts: PandFacts = {
  heightM: null, eavesM: null, ridgeM: null, roofType: null, year: null, storeys: null, groundAreaM2: null, partyWallAreaM2: null,
};

export async function fileSize(file: string): Promise<number | null> {
  return (await stat(file).catch(() => null))?.size ?? null;
}
