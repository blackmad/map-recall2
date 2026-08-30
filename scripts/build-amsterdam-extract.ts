import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { FeatureCategory, FeatureType, StreetFeature } from '../src/types.ts';
import { pickNearestDistractors } from '../src/canalRecall/bridgeDistractors.ts';

type Position = [number, number];
interface GeoJsonFeature {
  geometry: { type: string; coordinates: unknown } | null;
  properties: Record<string, string | undefined>;
}

const inputFile = process.argv[2] || '/tmp/map-recall-amsterdam.geojson';
const boundaryFile = process.argv[3] || '/tmp/amsterdam-named-relations.geojson';
const neighborhoodBoundaryFile = process.argv[4] || '/tmp/amsterdam-place-boundaries.geojson';
const curationFile = path.resolve('scripts/amsterdam-curation.json');
const outputDirectory = path.resolve(process.argv[5] || 'public/data/extracts/amsterdam');
const center: [number, number] = [52.372851, 4.8936];
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

function pathsFromGeometry(feature: GeoJsonFeature): [number, number][][] {
  const geometry = feature.geometry;
  if (!geometry || geometry.type === 'Point') return [];
  const convert = (positions: Position[]) => simplify(positions.map(([lon, lat]) => [lat, lon]));
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
const curation = JSON.parse(await readFile(curationFile, 'utf8')) as { scoreBoosts: Record<string, number> };
const boundarySource = JSON.parse(await readFile(boundaryFile, 'utf8')) as { features: GeoJsonFeature[] };
const municipality = boundarySource.features.find((feature) => feature.properties.name === 'Amsterdam'
  && feature.properties.boundary === 'administrative' && feature.properties.admin_level === '8');
if (!municipality || municipality.geometry?.type !== 'MultiPolygon') throw new Error('Amsterdam municipality polygon was not found');
const municipalityPolygons = municipality.geometry.coordinates as Position[][][];
const neighborhoodSource = JSON.parse(await readFile(neighborhoodBoundaryFile, 'utf8')) as { features: GeoJsonFeature[] };
const grouped = new Map<string, { feature: StreetFeature; category: FeatureCategory; paths: [number, number][][]; score: number }>();
const routingRoadCandidates: Array<{ feature: StreetFeature; category: FeatureCategory; paths: [number, number][][]; score: number }> = [];
const drivableHighways = new Set(['primary', 'secondary', 'tertiary', 'residential', 'living_street', 'unclassified', 'service', 'busway']);

for (const item of source.features) {
  const tags = item.properties || {};
  const name = (tags['name:en'] || tags.name || tags['name:nl'] || '').trim();
  const classification = classify(tags);
  if (!classification || !item.geometry) continue;
  const paths = pathsFromGeometry(item).filter((line) => line.length > 1);
  let pointCenter: [number, number] | undefined;
  if (item.geometry.type === 'Point') {
    const [lon, lat] = item.geometry.coordinates as Position;
    pointCenter = [lat, lon];
  }
  const featureCenter = pointCenter || paths[0]?.[Math.floor(paths[0].length / 2)];
  if (!featureCenter) continue;
  if (!pointInMultiPolygon(featureCenter, municipalityPolygons)
    && !paths.some((line) => line.some((point) => pointInMultiPolygon(point, municipalityPolygons)))) continue;
  if (tags.highway && drivableHighways.has(tags.highway) && paths.length) {
    const routingFeature: StreetFeature & { bridge?: boolean } = {
      id: `routing_${routingRoadCandidates.length}`, name, type: ['primary', 'secondary', 'tertiary'].includes(tags.highway) ? 'avenue' : 'street',
      cityId: 'amsterdam', center: featureCenter, funFact: '', clues: [], distractors: [], difficulty: 'hard', highway: tags.highway, railway: tags.railway,
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
      id: `extract_${classification.category}_${grouped.size}`,
      name,
      type: classification.type,
      cityId: 'amsterdam',
      center: featureCenter,
      radius: pointCenter ? 70 : undefined,
      funFact: '', clues: [], distractors: [],
      difficulty: score >= 140 ? 'easy' : score >= 70 ? 'medium' : 'hard',
      wikidata: tags.wikidata, wikipedia: tags.wikipedia, prominenceScore: score,
      highway: tags.highway,
    },
  });
}

await mkdir(outputDirectory, { recursive: true });
const stableId = (value: string) => -Math.abs([...value].reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) | 0, 17));
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
const areas = [makeArea('Amsterdam', 'municipality', municipalityPolygons, 8)];
for (const feature of neighborhoodSource.features) {
  if (!feature.properties.name || !feature.geometry || !['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) continue;
  const polygons = feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates as Position[][]]
    : feature.geometry.coordinates as Position[][][];
  if (!polygons.some((polygon) => polygon[0].some(([lon, lat]) => pointInMultiPolygon([lat, lon], municipalityPolygons)))) continue;
  areas.push(makeArea(feature.properties.name, feature.properties.place || 'neighborhood', polygons, feature.properties.place === 'suburb' ? 9 : 10));
}
await writeFile(path.join(outputDirectory, 'boundaries.json'), JSON.stringify(areas));
// Build a connected street subgraph: keep only streets reachable from the
// highest-scored street so car-mode routing never hits disconnected segments.
function selectConnectedStreets(
  available: { feature: StreetFeature; paths: [number, number][][]; score: number }[],
  maxCount: number,
): { feature: StreetFeature; paths: [number, number][][]; score: number }[] {
  if (available.length === 0) return [];
  const SNAP_THRESHOLD = 0.0003; // ~33 m in Amsterdam
  type Endpoint = { lat: number; lon: number; featureIndex: number };
  const endpoints: Endpoint[] = [];
  for (let fi = 0; fi < available.length; fi++) {
    for (const path of available[fi].paths) {
      if (path.length < 2) continue;
      endpoints.push({ lat: path[0][0], lon: path[0][1], featureIndex: fi });
      endpoints.push({ lat: path[path.length - 1][0], lon: path[path.length - 1][1], featureIndex: fi });
    }
  }
  // Build adjacency via endpoint proximity
  const adjacency = new Map<number, Set<number>>();
  for (let i = 0; i < available.length; i++) adjacency.set(i, new Set());
  for (let i = 0; i < endpoints.length; i++) {
    for (let j = i + 1; j < endpoints.length; j++) {
      if (endpoints[i].featureIndex === endpoints[j].featureIndex) continue;
      const dlat = endpoints[i].lat - endpoints[j].lat;
      const dlon = endpoints[i].lon - endpoints[j].lon;
      if (Math.abs(dlat) < SNAP_THRESHOLD && Math.abs(dlon) < SNAP_THRESHOLD) {
        adjacency.get(endpoints[i].featureIndex)!.add(endpoints[j].featureIndex);
        adjacency.get(endpoints[j].featureIndex)!.add(endpoints[i].featureIndex);
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

const partitions: Record<string, { file: string; count: number; availableCount: number; availableLinkedCount: number; bytes: number; linkedCount: number }> = {};
const selectedAll: StreetFeature[] = [];
for (const category of ['water', 'streets', 'bridges', 'squares', 'parks', 'landmarks'] as FeatureCategory[]) {
  const available = [...grouped.values()].filter((entry) => entry.category === category).sort((a, b) => b.score - a.score);
  const candidates = category === 'streets'
    ? selectConnectedStreets(available, maximumFor(category))
    : available.slice(0, maximumFor(category));
  if (category === 'streets') {
    const routing = selectConnectedStreets(routingRoadCandidates, routingRoadCandidates.length).map(({ feature, paths, score }) => ({
      ...feature,
      path: paths[0],
      paths: paths.length > 1 ? paths : undefined,
      prominenceScore: score,
      distractors: [],
    }));
    await writeFile(path.join(outputDirectory, 'streets-routing.json'), JSON.stringify(routing));
  }
  const selected = candidates.map(({ feature, paths, score }) => ({
    ...feature, path: paths[0], paths: paths.length > 1 ? paths : undefined, prominenceScore: score,
  }));
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
  cityId: 'amsterdam', source: 'OpenStreetMap / BBBike Amsterdam extract', generatedAt: new Date().toISOString(), center, partitions,
  boundaries: { file: 'boundaries.json', count: areas.length },
}, null, 2));
process.stdout.write(`${JSON.stringify(partitions, null, 2)}\n`);
