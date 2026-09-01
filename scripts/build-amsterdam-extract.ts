import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { FeatureCategory, FeatureType, StreetFeature } from '../src/types.ts';
import { pickNearestDistractors } from '../src/canalRecall/bridgeDistractors.ts';
import { findMunicipality, hasAreaGeometry } from './lib/municipality.ts';

type Position = [number, number];
interface GeoJsonFeature {
  geometry: { type: string; coordinates: unknown } | null;
  properties: Record<string, string | undefined>;
}

const inputFile = process.argv[2] || '/tmp/map-recall-amsterdam.geojson';
const boundaryFile = process.argv[3] || '/tmp/amsterdam-named-relations.geojson';
const neighborhoodBoundaryFile = process.argv[4] || '/tmp/amsterdam-place-boundaries.geojson';
const outputDirectory = path.resolve(process.argv[5] || 'public/data/extracts/amsterdam');
const cityId = process.argv[6] || 'amsterdam';
const cityName = process.argv[7] || 'Amsterdam';
const centerArgument = process.argv[8];
const center: [number, number] = centerArgument
  ? centerArgument.split(',').map(Number) as [number, number]
  : [52.372851, 4.8936];
if (center.length !== 2 || !center.every(Number.isFinite)) {
  throw new Error(`Invalid city center "${centerArgument}": expected latitude,longitude`);
}
const curationFile = path.resolve(`scripts/${cityId}-curation.json`);
const maximumPerCategory = 300;
// Landmarks carries museums, monuments, places of worship and now the civic
// venues, and it is the only category where the cap actually bites (795
// available against 300 kept). The extra budget is roughly the size of the
// civic classes, so adding them does not evict the existing tail.
const maximumFor = (category: FeatureCategory) => (category === 'landmarks' ? 420 : maximumPerCategory);

function pointInRing([lat, lon]: [number, number], ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointInMultiPolygon(point: [number, number], polygons: Position[][][]): boolean {
  return polygons.some((polygon) => pointInRing(point, polygon[0]) && !polygon.slice(1).some((hole) => pointInRing(point, hole)));
}

const distance = (a: [number, number], b: [number, number]) => {
  const latScale = 111_320;
  const lonScale = latScale * Math.cos(((a[0] + b[0]) / 2) * Math.PI / 180);
  return Math.hypot((a[0] - b[0]) * latScale, (a[1] - b[1]) * lonScale);
};

function simplify(points: [number, number][], tolerance = 3): [number, number][] {
  if (points.length <= 2) return points;
  const first = points[0];
  const last = points[points.length - 1];
  let furthest = 0;
  let furthestIndex = 0;
  for (let index = 1; index < points.length - 1; index++) {
    const a = distance(first, points[index]);
    const b = distance(points[index], last);
    const c = distance(first, last);
    const area = Math.max(0, (a + b + c) * (-a + b + c) * (a - b + c) * (a + b - c));
    const perpendicular = c > 0 ? Math.sqrt(area) / c : a;
    if (perpendicular > furthest) [furthest, furthestIndex] = [perpendicular, index];
  }
  if (furthest <= tolerance) return [first, last];
  return [...simplify(points.slice(0, furthestIndex + 1), tolerance).slice(0, -1), ...simplify(points.slice(furthestIndex), tolerance)];
}

/**
 * Snap a coordinate to ~11 cm.
 *
 * Two jobs at once. It removes about a fifth of the bytes from the routing
 * partition, which is the largest file the game fetches. And because
 * connectivity is decided by exact coordinate equality, quantising first makes
 * that test robust: two ways meeting at one OSM node can otherwise differ in
 * the last float digit after reprojection and silently fail to join.
 *
 * 11 cm is far below the ~33 cm a single game pixel covers, so nothing the
 * player can see moves.
 */
const COORD_DECIMALS = 6;
function quantise([lat, lon]: [number, number]): [number, number] {
  const factor = 10 ** COORD_DECIMALS;
  return [Math.round(lat * factor) / factor, Math.round(lon * factor) / factor];
}

/**
 * Raw `[lat, lon]` paths, deliberately *not* simplified.
 *
 * Connectivity is decided by ways sharing an identical vertex, and Douglas-
 * Peucker deletes exactly the vertices that carry that meaning: a junction node
 * lying within the tolerance of the line between its neighbours is dropped, and
 * two ways that genuinely met there stop sharing a coordinate. Measured on the
 * Amsterdam source: simplifying first destroyed 17,222 of 62,229 junction
 * vertices, fragmented the drivable network from 3,209 components into 11,132,
 * and cut the largest from 57,619 ways to 43,097. Simplify at output instead,
 * and keep the junctions — see `simplifyPreservingJunctions`.
 */
function pathsFromGeometry(feature: GeoJsonFeature): [number, number][][] {
  const geometry = feature.geometry;
  if (!geometry || geometry.type === 'Point') return [];
  const convert = (positions: Position[]) => positions.map(([lon, lat]) => quantise([lat, lon]));
  if (geometry.type === 'LineString') return [convert(geometry.coordinates as Position[])];
  if (geometry.type === 'MultiLineString' || geometry.type === 'Polygon') return (geometry.coordinates as Position[][]).map(convert);
  if (geometry.type === 'MultiPolygon') return (geometry.coordinates as Position[][][]).flatMap((polygon) => polygon.slice(0, 1).map(convert));
  return [];
}

// OSM amenity value -> the type the card shows on its badge.
const CIVIC_TYPES: Record<string, FeatureType> = {
  cinema: 'cinema',
  library: 'library',
  university: 'university',
  college: 'university',
  music_venue: 'music venue',
  community_centre: 'landmark',
};

// A prominence floor per civic class. Without it a cinema with no Wikidata
// link scores 12 - mapped length is nil for a node - against a landmark tail
// that starts at 35, so LAB111 was never going to be in the extract however
// well known it is locally.
const CIVIC_CLASS_SCORE: Record<string, number> = {
  university: 60,
  library: 50,
  cinema: 45,
  music_venue: 45,
  theatre: 40,
  arts_centre: 30,
  community_centre: 25,
  marketplace: 35,
};

function classify(tags: Record<string, string | undefined>): { type: FeatureType; category: FeatureCategory } | null {
  if (tags.bridge === 'yes' || tags.man_made === 'bridge') return { type: 'bridge', category: 'bridges' };
  if (tags.waterway || tags.natural === 'water' || tags.water || tags.landuse === 'basin') {
    return { type: tags.waterway === 'river' || tags.natural === 'water' ? 'water' : 'canal', category: 'water' };
  }
  if (tags.place === 'square' || tags.amenity === 'marketplace') return { type: 'square', category: 'squares' };
  if (tags.leisure || ['forest', 'meadow', 'grass'].includes(tags.landuse || '')) return { type: 'park', category: 'parks' };
  if (tags.tourism === 'museum') return { type: 'museum', category: 'landmarks' };
  if (tags.tourism === 'zoo') return { type: 'landmark', category: 'landmarks' };
  // Everyday civic venues. A cinema, a library or a faculty building is often
  // the thing a resident actually navigates by, and OSM rarely gives any of
  // them a Wikidata link, so they need both a class of their own and a
  // prominence floor (CIVIC_CLASS_SCORE) to survive the per-category cap.
  const civic = CIVIC_TYPES[tags.amenity || ''];
  // "P" is a real OSM name on a university building. It is not a name anyone
  // can learn a city by, and unlike a canal or a street a civic venue has no
  // geometry to make it recognisable, so hold them to a readable name.
  if (civic) {
    const civicName = (tags['name:en'] || tags.name || tags['name:nl'] || '').trim();
    return civicName.length >= 3 ? { type: civic, category: 'landmarks' } : null;
  }
  if (tags.tourism || tags.historic || ['theatre', 'arts_centre', 'townhall', 'place_of_worship'].includes(tags.amenity || '')) return { type: 'landmark', category: 'landmarks' };
  if (tags.highway) return { type: ['primary', 'secondary', 'tertiary'].includes(tags.highway) ? 'avenue' : 'street', category: 'streets' };
  return null;
}

const source = JSON.parse(await readFile(inputFile, 'utf8')) as { features: GeoJsonFeature[] };
type CuratedLandmark = {
  name: string;
  center: [number, number];
  type?: FeatureType;
  wikidata?: string;
  wikipedia?: string;
  prominenceScore: number;
};
const curation = await readFile(curationFile, 'utf8').then((contents) => JSON.parse(contents), () => ({ scoreBoosts: {}, landmarks: [] })) as {
  scoreBoosts: Record<string, number>;
  landmarks?: CuratedLandmark[];
};
const boundarySource = JSON.parse(await readFile(boundaryFile, 'utf8')) as { features: GeoJsonFeature[] };
// Which relation is "the city" is decided in `lib/municipality.ts`, shared with
// the refresh script's bbox step, because the two must not disagree: clipping
// features to one boundary and naming them after another is silent and wrong.
const municipality = findMunicipality(boundarySource.features, cityName);
if (!municipality || !hasAreaGeometry(municipality) || !municipality.geometry) {
  throw new Error(`${cityName} municipality polygon was not found`);
}
const municipalityPolygons = municipality.geometry.type === 'Polygon'
  ? [municipality.geometry.coordinates as Position[][]]
  : municipality.geometry.coordinates as Position[][][];
const neighborhoodSource = JSON.parse(await readFile(neighborhoodBoundaryFile, 'utf8')) as { features: GeoJsonFeature[] };
const vertexKey = ([lat, lon]: [number, number]) => `${lat},${lon}`;

/** Coordinates touched by more than one way: the junctions. */
function junctionVertices(pathGroups: Iterable<[number, number][][]>): Set<string> {
  const owners = new Map<string, number>();
  const junctions = new Set<string>();
  let index = 0;
  for (const paths of pathGroups) {
    index++;
    const seenHere = new Set<string>();
    for (const path of paths) {
      for (const point of path) {
        const key = vertexKey(point);
        if (seenHere.has(key)) continue;
        seenHere.add(key);
        const first = owners.get(key);
        if (first === undefined) owners.set(key, index);
        else if (first !== index) junctions.add(key);
      }
    }
  }
  return junctions;
}

/**
 * Douglas-Peucker, except that a junction is never dropped. Keeps the published
 * geometry small without silently disconnecting the network it describes — the
 * runtime road graph stitches on shared vertices too, so a junction deleted
 * here is a turn the player cannot make.
 */
function simplifyPreservingJunctions(
  points: [number, number][],
  junctions: Set<string>,
  tolerance = 3,
): [number, number][] {
  if (points.length <= 2) return points;
  const kept: [number, number][] = [];
  let segmentStart = 0;
  for (let index = 1; index <= points.length - 1; index++) {
    const isJunction = index < points.length - 1 && junctions.has(vertexKey(points[index]));
    if (!isJunction && index !== points.length - 1) continue;
    const run = simplify(points.slice(segmentStart, index + 1), tolerance);
    kept.push(...(kept.length ? run.slice(1) : run));
    segmentStart = index;
  }
  return kept;
}

const grouped = new Map<string, { feature: StreetFeature; category: FeatureCategory; paths: [number, number][][]; score: number }>();
const routingRoadCandidates: Array<{ feature: StreetFeature; category: FeatureCategory; paths: [number, number][][]; score: number }> = [];
const majorHighways = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary']);
const drivableHighways = new Set([
  ...majorHighways,
  'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link',
  'residential', 'living_street', 'unclassified', 'service', 'busway',
]);
type OrientationPoi = {
  id: string; name: string; kind: 'albert-heijn' | 'local-food'; center: [number, number];
  brand?: string; brandWikidata?: string; shop?: string; amenity?: string; icon?: string;
  orientationScore?: number;
};
const brandedCandidates: Array<Omit<OrientationPoi, 'kind'> & { brand: string }> = [];
const localFoodCandidates: OrientationPoi[] = [];

for (const item of source.features) {
  const tags = item.properties || {};
  const roadOrPlaceName = (tags['name:en'] || tags.name || tags['name:nl'] || '').trim();
  const classification = classify(tags);
  if (!item.geometry) continue;
  const paths = pathsFromGeometry(item).filter((line) => line.length > 1);
  let pointCenter: [number, number] | undefined;
  if (item.geometry.type === 'Point') {
    const [lon, lat] = item.geometry.coordinates as Position;
    pointCenter = [lat, lon];
  }
  const candidateCenter = pointCenter || paths[0]?.[Math.floor(paths[0].length / 2)];
  if (!candidateCenter) continue;
  // A long road or waterway may enter the municipality while its midpoint is
  // outside it. Use an interior vertex as the published centre in that case;
  // otherwise map labels and route projections can point into another city.
  const featureCenter = pointInMultiPolygon(candidateCenter, municipalityPolygons)
    ? candidateCenter
    : paths.flat().find((point) => pointInMultiPolygon(point, municipalityPolygons));
  if (!featureCenter) continue;
  // Keep shop chains outside the landmark competition. They are everyday
  // orientation cues, not quiz destinations, and frequency within this exact
  // municipality tells us which chains are locally useful.
  if (tags.shop) {
    // `name` alone is not evidence of a chain: unrelated independents often
    // share generic names such as "Supermarket". NSI-tagged brand/operator
    // identity is the stable signal, with brand:wikidata joining aliases.
    const brand = (tags.brand || tags.operator || '').trim();
    if (brand) brandedCandidates.push({
      id: String(tags['@id'] || `brand-${brandedCandidates.length}`),
      name: (tags.name || brand).trim(), brand, brandWikidata: tags['brand:wikidata'],
      shop: tags.shop, center: featureCenter,
    });
  }
  // Named local food venues are far better block-level cues than a directory
  // of interchangeable retail chains. A brand tag is the useful OSM/NSI
  // signal that a venue is a chain; leave those out even when the individual
  // branch has a name. Operator alone is not enough evidence here because it
  // is also commonly the name of a one-site hospitality business.
  if (['restaurant', 'cafe', 'pub', 'bar'].includes(tags.amenity || '')) {
    const name = (tags['name:en'] || tags.name || tags['name:nl'] || '').trim();
    if (name.length >= 3 && !tags.brand && !tags['brand:wikidata']) {
      localFoodCandidates.push({
        id: String(tags['@id'] || `local-food-${localFoodCandidates.length}`),
        name, kind: 'local-food', amenity: tags.amenity, center: featureCenter,
        // Completeness is a decent source-independent proxy for whether a
        // venue is established and recognizable. Restaurant names lead, then
        // useful identity/details break ties within a crowded block.
        orientationScore: (tags.amenity === 'restaurant' ? 4 : tags.amenity === 'pub' ? 3 : 2)
          + (tags.wikidata || tags.wikipedia ? 4 : 0)
          + (tags.website || tags['contact:website'] ? 2 : 0)
          + (tags.cuisine ? 1 : 0)
          + (tags.opening_hours ? 1 : 0),
      });
    }
  }
  if (!classification) continue;
  // OSM uses `name` for the road carried by a bridge and `bridge:name` for the
  // structure itself. Prefer the latter on quiz cards while retaining the road
  // name in the routing graph.
  const name = (classification.category === 'bridges' && tags['bridge:name']
    ? tags['bridge:name']
    : roadOrPlaceName).trim();
  if (tags.highway && drivableHighways.has(tags.highway) && paths.length) {
    const routingFeature: StreetFeature & { bridge?: boolean } = {
      id: `routing_${routingRoadCandidates.length}`, name: roadOrPlaceName, type: majorHighways.has(tags.highway) ? 'avenue' : 'street',
      cityId, center: featureCenter, funFact: '', clues: [], distractors: [], difficulty: 'hard', highway: tags.highway, railway: tags.railway,
    };
    if (tags.bridge === 'yes') routingFeature.bridge = true;
    routingRoadCandidates.push({
      category: 'streets', paths, score: 0,
      feature: routingFeature,
    });
  }
  if (!name) continue;
  const key = `${classification.category}:${name.toLocaleLowerCase()}`;
  const mappedLength = paths.reduce((total, line) => total + line.slice(1).reduce((sum, point, index) => sum + distance(line[index], point), 0), 0);
  const linkScore = (tags.wikidata ? 120 : 0) + (tags.wikipedia ? 80 : 0);
  const classScore = tags.waterway === 'river' ? 45 : tags.waterway === 'canal' ? 35 : tags.highway === 'primary' ? 35 : tags.highway === 'secondary' ? 25
    : CIVIC_CLASS_SCORE[tags.amenity || ''] || 0;
  const score = Math.round(linkScore + classScore + Math.log10(Math.max(10, mappedLength)) * 12
    + (curation.scoreBoosts[key] || 0));
  const existing = grouped.get(key);
  if (existing) {
    existing.paths.push(...paths);
    existing.score = Math.max(existing.score, score);
    existing.feature.wikidata ||= tags.wikidata;
    existing.feature.wikipedia ||= tags.wikipedia;
    continue;
  }
  grouped.set(key, {
    category: classification.category,
    paths,
    score,
    feature: {
      // Derived from the feature's identity, never from insertion order.
      // `grouped.size` meant the id depended on how many features of *any*
      // category happened to be inserted first, so adding one classification
      // renumbered every bridge in the city — which silently orphaned
      // `bridge-crossings.json`, keyed on those ids, and cost 229 bridges the
      // water beneath them without anything failing.
      id: `extract_${classification.category}_${Math.abs(stableStringHash(key))}`,
      name,
      type: classification.type,
      cityId,
      center: featureCenter,
      radius: pointCenter ? 70 : undefined,
      funFact: '', clues: [], distractors: [],
      difficulty: score >= 140 ? 'easy' : score >= 70 ? 'medium' : 'hard',
      wikidata: tags.wikidata, wikipedia: tags.wikipedia, prominenceScore: score,
      highway: tags.highway,
    },
  });
}

// Some relation-level POIs disappear in the GeoJSON conversion even though
// they are present in OSM (Artis), while an occasional node is absent from a
// particular source snapshot (OT301). Keep a small, reviewable fallback list
// for essential anchors. A source feature with the same name always wins.
for (const landmark of curation.landmarks || []) {
  const key = `landmarks:${landmark.name.toLocaleLowerCase()}`;
  if (grouped.has(key)) continue;
  const score = landmark.prominenceScore + (curation.scoreBoosts[key] || 0);
  grouped.set(key, {
    category: 'landmarks', paths: [], score,
    feature: {
      id: `curated_landmarks_${Math.abs(stableStringHash(key))}`,
      name: landmark.name, type: landmark.type || 'landmark', cityId,
      center: landmark.center, radius: 70, funFact: '', clues: [], distractors: [],
      difficulty: score >= 140 ? 'easy' : score >= 70 ? 'medium' : 'hard',
      wikidata: landmark.wikidata, wikipedia: landmark.wikipedia, prominenceScore: score,
    },
  });
}

await mkdir(outputDirectory, { recursive: true });
function stableStringHash(value: string): number {
  return [...value].reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) | 0, 17);
}
const stableId = (value: string) => -Math.abs(stableStringHash(value));
const toLatLonPolygons = (coordinates: Position[][][]) => coordinates.map((polygon) => polygon.map((ring) => simplify(ring.map(([lon, lat]) => [lat, lon]), 5)));
const makeArea = (name: string, kind: string, polygons: Position[][][], adminLevel: number) => {
  const geometry = toLatLonPolygons(polygons);
  const points = geometry.flat(2);
  return {
    id: stableId(`${kind}:${name}`), name, kind, adminLevel, geometry,
    bounds: {
      minlat: Math.min(...points.map(([lat]) => lat)), minlon: Math.min(...points.map(([, lon]) => lon)),
      maxlat: Math.max(...points.map(([lat]) => lat)), maxlon: Math.max(...points.map(([, lon]) => lon)),
    },
  };
};
const areas = [makeArea(cityName, 'municipality', municipalityPolygons, 8)];
for (const feature of neighborhoodSource.features) {
  if (!feature.properties.name || !feature.geometry || !['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) continue;
  const polygons = feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates as Position[][]]
    : feature.geometry.coordinates as Position[][][];
  if (!polygons.some((polygon) => polygon[0].some(([lon, lat]) => pointInMultiPolygon([lat, lon], municipalityPolygons)))) continue;
  areas.push(makeArea(feature.properties.name, feature.properties.place || 'neighborhood', polygons, feature.properties.place === 'suburb' ? 9 : 10));
}
await writeFile(path.join(outputDirectory, 'boundaries.json'), JSON.stringify(areas));

const normaliseBrand = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const BRAND_ICONS: Record<string, string> = {
  'albert heijn': 'albert-heijn',
  'albert heijn to go': 'albert-heijn',
  ah: 'albert-heijn',
  'ah to go': 'albert-heijn',
};
const chainGroups = new Map<string, Array<Omit<OrientationPoi, 'kind'> & { brand: string }>>();
for (const poi of brandedCandidates) {
  const key = poi.brandWikidata || normaliseBrand(poi.brand);
  const group = chainGroups.get(key) || [];
  group.push(poi);
  chainGroups.set(key, group);
}
const albertHeijnIdentities = new Set(['Q1653985', 'Q77971185']);
const majorChains = [...chainGroups.entries()]
  .map(([key, pois]) => ({
    key, name: pois[0].brand, brandWikidata: pois[0].brandWikidata,
    count: pois.length, icon: BRAND_ICONS[normaliseBrand(pois[0].brand)], pois,
  }))
  .filter((chain) => albertHeijnIdentities.has(chain.key)
    || ['albert heijn', 'albert heijn to go', 'ah', 'ah to go'].includes(normaliseBrand(chain.name)))
  .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
const seenLocalFood = new Set<string>();
const localFoodNameCounts = new Map<string, number>();
for (const poi of localFoodCandidates) {
  const name = normaliseBrand(poi.name);
  localFoodNameCounts.set(name, (localFoodNameCounts.get(name) || 0) + 1);
}
const deduplicatedLocalFood = localFoodCandidates.filter((poi) => {
  // A missing brand tag is common for small hospitality chains. Repeated
  // names are a useful conservative backstop: two sites can still be a local
  // venue represented twice or a tiny neighbourhood sibling, while three or
  // more reads as chain coverage—the exact catalogue effect we are avoiding.
  if ((localFoodNameCounts.get(normaliseBrand(poi.name)) || 0) >= 3) return false;
  // Nodes and building outlines sometimes map the same venue twice. Collapse
  // only near-identical copies; same-name venues elsewhere may be meaningful.
  const key = `${normaliseBrand(poi.name)}:${poi.center[0].toFixed(4)}:${poi.center[1].toFixed(4)}`;
  if (seenLocalFood.has(key)) return false;
  seenLocalFood.add(key);
  return true;
});
// At gameplay zoom, a 100 m cell is approximately a city block. Two labels
// per cell retains useful "restaurant X is on this block" anchors without
// turning the basemap into a hospitality directory. Stable tie-breakers keep
// rebuilds reproducible when OSM happens to change feature order.
const localFoodCellCounts = new Map<string, number>();
const LOCAL_FOOD_CELL_METERS = 100;
const LOCAL_FOOD_PER_CELL = 2;
const localFoodPois = deduplicatedLocalFood
  .sort((a, b) => (b.orientationScore || 0) - (a.orientationScore || 0)
    || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  .filter((poi) => {
    const x = poi.center[1] * 111_320 * Math.cos(poi.center[0] * Math.PI / 180);
    const y = poi.center[0] * 111_320;
    const cell = `${Math.floor(x / LOCAL_FOOD_CELL_METERS)}:${Math.floor(y / LOCAL_FOOD_CELL_METERS)}`;
    const count = localFoodCellCounts.get(cell) || 0;
    if (count >= LOCAL_FOOD_PER_CELL) return false;
    localFoodCellCounts.set(cell, count + 1);
    return true;
  });
const publishedBrandedPois = [
  ...majorChains.flatMap((chain) => chain.pois.map((poi) => ({ ...poi, kind: 'albert-heijn' as const, icon: chain.icon }))),
  ...localFoodPois,
];
await writeFile(path.join(outputDirectory, 'branded-pois.json'), JSON.stringify(publishedBrandedPois));
process.stdout.write(`Orientation POIs: ${majorChains.map(({ name, count }) => `${name} (${count})`).join(', ') || 'no Albert Heijn'}; ${localFoodPois.length} local food venues\n`);
// Build a connected street subgraph: keep only streets reachable from the
// highest-scored street so car-mode routing never hits disconnected segments.
function selectConnectedStreets(
  available: { feature: StreetFeature; paths: [number, number][][]; score: number }[],
  maxCount: number,
): { feature: StreetFeature; paths: [number, number][][]; score: number }[] {
  if (available.length === 0) return [];
  // GeoJSON no longer carries OSM node ids, but ways which really connect do
  // retain an identical coordinate. Index every vertex: junctions often sit
  // inside a through-way, not at its endpoints. Proximity is deliberately not
  // used here; it joined parallel roads and roads on different levels merely
  // because they passed within ~33 metres of one another.
  const featuresAtVertex = new Map<string, number[]>();
  for (let fi = 0; fi < available.length; fi++) {
    for (const path of available[fi].paths) {
      for (const [lat, lon] of path) {
        const key = `${lat},${lon}`;
        const owners = featuresAtVertex.get(key) || [];
        if (owners[owners.length - 1] !== fi) owners.push(fi);
        featuresAtVertex.set(key, owners);
      }
    }
  }
  const adjacency = new Map<number, Set<number>>();
  for (let i = 0; i < available.length; i++) adjacency.set(i, new Set());
  for (const owners of featuresAtVertex.values()) {
    for (let i = 0; i < owners.length; i++) {
      for (let j = i + 1; j < owners.length; j++) {
        adjacency.get(owners[i])!.add(owners[j]);
        adjacency.get(owners[j])!.add(owners[i]);
      }
    }
  }
  // Take the largest component, not whatever component index 0 happens to sit
  // in. Routing candidates all score 0, so "available is sorted by score desc"
  // gave no ordering at all among them: a refresh that reshuffled the ties
  // could seed the search on an isolated service-road stub, and the routing
  // extract silently collapsed from 16,551 ways to 7.
  const componentOf = new Int32Array(available.length).fill(-1);
  const components: number[][] = [];
  for (let start = 0; start < available.length; start++) {
    if (componentOf[start] >= 0) continue;
    const id = components.length;
    const members: number[] = [start];
    componentOf[start] = id;
    for (let cursor = 0; cursor < members.length; cursor++) {
      for (const neighbor of adjacency.get(members[cursor]) || []) {
        if (componentOf[neighbor] >= 0) continue;
        componentOf[neighbor] = id;
        members.push(neighbor);
      }
    }
    components.push(members);
  }
  const largest = components.reduce((best, group) => (group.length > best.length ? group : best), components[0] || []);
  const visited = new Set(largest);
  const connected = available.filter((_, i) => visited.has(i));
  const result = connected.slice(0, maxCount);
  process.stdout.write(`Streets: ${available.length} available, ${components.length} components, `
    + `${connected.length} in the largest, ${result.length} selected\n`);
  return result;
}

// Geometry is carried raw up to this point so that connectivity is decided on
// the vertices OSM actually shares. Everything published from here is
// simplified, keeping the junctions, so the files stay small without the
// network quietly coming apart at the seams.
const routableJunctions = junctionVertices([
  ...routingRoadCandidates.map((entry) => entry.paths),
  ...[...grouped.values()].filter((entry) => entry.category === 'water' || entry.category === 'streets')
    .map((entry) => entry.paths),
]);
const publish = (paths: [number, number][][], keepJunctions: boolean) => paths
  .map((line) => (keepJunctions
    ? simplifyPreservingJunctions(line, routableJunctions)
    : simplify(line)))
  .filter((line) => line.length > 1);

const partitions: Record<string, { file: string; count: number; availableCount: number; availableLinkedCount: number; bytes: number; linkedCount: number }> = {};
const selectedAll: StreetFeature[] = [];
for (const category of ['water', 'streets', 'bridges', 'squares', 'parks', 'landmarks'] as FeatureCategory[]) {
  const available = [...grouped.values()].filter((entry) => entry.category === category).sort((a, b) => b.score - a.score);
  const candidates = category === 'streets'
    ? selectConnectedStreets(available, maximumFor(category))
    : available.slice(0, maximumFor(category));
  // Water and streets are navigated; a junction dropped from either is a turn
  // the player cannot make. Bridges are gated on being crossed, so their spans
  // keep their junctions too.
  const navigable = category === 'water' || category === 'streets' || category === 'bridges';
  if (category === 'streets') {
    // The routing partition is the largest file the game fetches, and it is
    // read by exactly one consumer. Ship what that consumer uses — identity,
    // geometry, and the tags routing and the bridge checks depend on — rather
    // than the quiz-shaped fields, which are empty here anyway. Dropping
    // funFact/clues/distractors/difficulty/prominenceScore saves about 80
    // bytes on each of 35,000 ways.
    const routing = selectConnectedStreets(routingRoadCandidates, routingRoadCandidates.length).map(({ feature, paths }) => {
      const lines = publish(paths, true);
      const entry: Record<string, unknown> = {
        id: feature.id, name: feature.name, type: feature.type, cityId: feature.cityId,
        center: feature.center, highway: feature.highway,
        path: lines[0],
      };
      if (lines.length > 1) entry.paths = lines;
      if ((feature as { bridge?: boolean }).bridge) entry.bridge = true;
      if (feature.railway) entry.railway = feature.railway;
      return entry;
    });
    await writeFile(path.join(outputDirectory, 'streets-routing.json'), JSON.stringify(routing));
  }
  const selected = candidates.map(({ feature, paths, score }) => {
    const lines = publish(paths, navigable);
    return {
      ...feature, path: lines[0], paths: lines.length > 1 ? lines : undefined, prominenceScore: score,
    };
  });
  // `available` is sorted by score, so slicing the first twelve alternatives
  // handed every feature in a category the same dozen famous names: 300
  // bridges shared a 13-name distractor pool, and the right answer was the
  // only one anywhere near the player. Distractors are the nearest features
  // now, so the four options are all places you could plausibly be. Bridges
  // are refined further by `build-bridge-distractors.ts`, which can also see
  // which water each one crosses.
  const distractorPool = selected.map((feature) => ({
    id: feature.id, name: feature.name, center: feature.center as [number, number],
  }));
  for (const feature of selected) {
    feature.distractors = pickNearestDistractors(
      { id: feature.id, name: feature.name, center: feature.center as [number, number] },
      distractorPool,
    );
  }
  const json = JSON.stringify(selected);
  const file = `${category}.json`;
  await writeFile(path.join(outputDirectory, file), json);
  partitions[category] = {
    file, count: selected.length, availableCount: available.length, bytes: Buffer.byteLength(json),
    availableLinkedCount: available.filter(({ feature }) => feature.wikidata || feature.wikipedia).length,
    linkedCount: selected.filter(({ wikidata, wikipedia }) => wikidata || wikipedia).length,
  };
  selectedAll.push(...selected.slice(0, 75));
}

const allJson = JSON.stringify(selectedAll.sort((a, b) => (b.prominenceScore || 0) - (a.prominenceScore || 0)));
await writeFile(path.join(outputDirectory, 'all.json'), allJson);
partitions.all = {
  file: 'all.json', count: selectedAll.length, availableCount: grouped.size, bytes: Buffer.byteLength(allJson),
  availableLinkedCount: [...grouped.values()].filter(({ feature }) => feature.wikidata || feature.wikipedia).length,
  linkedCount: selectedAll.filter(({ wikidata, wikipedia }) => wikidata || wikipedia).length,
};
await writeFile(path.join(outputDirectory, 'manifest.json'), JSON.stringify({
  cityId, source: `OpenStreetMap / BBBike ${cityName} extract`, generatedAt: new Date().toISOString(), center, partitions,
  boundaries: { file: 'boundaries.json', count: areas.length },
  brandedPois: { file: 'branded-pois.json', count: publishedBrandedPois.length },
  localFoodPois: { count: localFoodPois.length },
  majorChains: majorChains.map(({ name, brandWikidata, count, icon }) => ({ name, brandWikidata, count, icon })),
}, null, 2));
process.stdout.write(`${JSON.stringify(partitions, null, 2)}\n`);
