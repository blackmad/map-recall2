// `own-map-v1/overview.json`: the whole-city flat map, from our own extracts.
// Built by scripts/own-map/build-own-map.ts. Coordinates are integers in
// `unit` metres in the ownMap frame (frame.ts), each line/ring delta-coded
// (first pair absolute), so the JSON gzips small.

import type { Vec2 } from './frame';

export const STREET_CLASSES = ['major', 'secondary', 'tertiary', 'minor', 'service', 'cycle', 'path'] as const;
export type StreetClass = typeof STREET_CLASSES[number];

/** OSM `highway` → drawing class. Busways are drawn like service roads. */
export function streetClassOf(highway: string | undefined): StreetClass | null {
  switch (highway) {
    case 'motorway': case 'motorway_link': case 'trunk': case 'trunk_link': case 'primary': case 'primary_link': return 'major';
    case 'secondary': case 'secondary_link': return 'secondary';
    case 'tertiary': case 'tertiary_link': return 'tertiary';
    case 'residential': case 'unclassified': case 'living_street': case 'pedestrian': case 'road': return 'minor';
    case 'service': case 'busway': return 'service';
    case 'cycleway': return 'cycle';
    case 'footway': case 'path': case 'steps': case 'track': case 'bridleway': return 'path';
    default: return null;
  }
}

/** Landuse drawing classes (v2). OSM landuse/natural/leisure values map onto these (`landuseClassOf`). */
export const LANDUSE_CLASSES = ['green', 'wood', 'wetland', 'sport', 'cemetery', 'allotments', 'farmland', 'industrial', 'construction', 'sand'] as const;
export type LanduseClass = typeof LANDUSE_CLASSES[number];

export function landuseClassOf(kind: string | undefined): LanduseClass | null {
  switch (kind) {
    case 'grass': case 'meadow': case 'recreation_ground': case 'village_green': case 'grassland': case 'dog_park': return 'green';
    case 'forest': case 'wood': case 'scrub': case 'heath': return 'wood';
    case 'wetland': return 'wetland';
    case 'pitch': case 'sports_centre': case 'stadium': case 'golf_course': case 'track': case 'playground': return 'sport';
    case 'cemetery': return 'cemetery';
    case 'allotments': return 'allotments';
    case 'farmland': case 'orchard': case 'greenhouse_horticulture': case 'plant_nursery': return 'farmland';
    case 'industrial': case 'commercial': case 'retail': case 'railway': case 'port': case 'military': case 'brownfield': return 'industrial';
    case 'construction': return 'construction';
    case 'beach': case 'sand': return 'sand';
    default: return null;
  }
}

/** Track kinds (v2), OSM `railway` values. */
export const RAIL_KINDS = ['rail', 'light_rail', 'subway', 'tram', 'narrow_gauge', 'monorail', 'funicular'] as const;
export type RailKind = typeof RAIL_KINDS[number];
export const RAIL_TUNNEL = 1, RAIL_BRIDGE = 2, RAIL_SERVICE = 4;

export interface OverviewFile {
  version: 1 | 2;
  frame: { origin: [number, number]; kx: number; ky: number };
  unit: number;
  bounds: [number, number, number, number];
  names: string[];
  /** Polygons; each ring delta-coded. */
  water: number[][][];
  /** [nameIndex | -1, ...rings] */
  parks: Array<[number, ...number[][]]>;
  /** [classIndex, nameIndex | -1, ...delta-coded line] */
  streets: number[][];
  /** Named water centrelines, for water labels: [nameIndex, ...line] */
  waterLines: number[][];
  /** Neighbourhoods: [nameIndex, labelX, labelY] (unit integers, absolute). */
  hoods: number[][];
  /** v2: [classIndex, ...rings] (LANDUSE_CLASSES). */
  landuse?: number[][][];
  /** v2: [kindIndex, flags, ...line] (RAIL_KINDS; flags RAIL_TUNNEL | RAIL_BRIDGE | RAIL_SERVICE). */
  rail?: number[][];
  /** v2: pier areas (one ring each) and pier lines. */
  piers?: number[][];
  pierLines?: number[][];
  /** v2: neighbourhood outlines (closed rings), for the dashed boundaries. */
  hoodRings?: number[][];
  sources: string[];
}

export function encodeLine(points: readonly Vec2[], unit: number): number[] {
  const out: number[] = [];
  let px = 0, py = 0;
  points.forEach(([x, y], i) => {
    const qx = Math.round(x / unit), qy = Math.round(y / unit);
    if (i > 0 && qx === px && qy === py) return;
    out.push(i === 0 ? qx : qx - px, i === 0 ? qy : qy - py);
    px = qx; py = qy;
  });
  return out;
}

export function decodeLine(data: readonly number[], unit: number, start = 0): Vec2[] {
  const out: Vec2[] = [];
  let x = 0, y = 0;
  for (let i = start; i + 1 < data.length; i += 2) {
    x += data[i]; y += data[i + 1];
    out.push([x * unit, y * unit]);
  }
  return out;
}

export interface OverviewStreet { cls: StreetClass; name: string; points: Vec2[] }
export interface OverviewPark { name: string; rings: Vec2[][] }
export interface OverviewData {
  bounds: [number, number, number, number];
  water: Vec2[][][];
  parks: OverviewPark[];
  streets: OverviewStreet[];
  waterLines: Array<{ name: string; points: Vec2[] }>;
  hoods: Array<{ name: string; at: Vec2 }>;
  landuse: Array<{ cls: LanduseClass; rings: Vec2[][] }>;
  rail: Array<{ kind: RailKind; tunnel: boolean; bridge: boolean; service: boolean; points: Vec2[] }>;
  piers: Vec2[][];
  pierLines: Vec2[][];
  hoodRings: Vec2[][];
}

export function decodeOverview(file: OverviewFile): OverviewData {
  if (file.version !== 1 && file.version !== 2) throw new Error(`own-map overview: unsupported version ${file.version}`);
  const u = file.unit;
  const name = (i: number) => (i >= 0 ? file.names[i] ?? '' : '');
  return {
    bounds: file.bounds,
    water: file.water.map(poly => poly.map(ring => decodeLine(ring, u))),
    parks: file.parks.map(([n, ...rings]) => ({ name: name(n), rings: rings.map(r => decodeLine(r, u)) })),
    streets: file.streets.map(row => ({ cls: STREET_CLASSES[row[0]], name: name(row[1]), points: decodeLine(row, u, 2) })),
    waterLines: file.waterLines.map(row => ({ name: name(row[0]), points: decodeLine(row, u, 1) })),
    hoods: file.hoods.map(([n, x, y]) => ({ name: name(n), at: [x * u, y * u] as Vec2 })),
    landuse: (file.landuse ?? []).map(([[c], ...rings]) => ({ cls: LANDUSE_CLASSES[c], rings: rings.map(r => decodeLine(r, u)) })),
    rail: (file.rail ?? []).map(row => ({ kind: RAIL_KINDS[row[0]], tunnel: !!(row[1] & RAIL_TUNNEL), bridge: !!(row[1] & RAIL_BRIDGE), service: !!(row[1] & RAIL_SERVICE), points: decodeLine(row, u, 2) })),
    piers: (file.piers ?? []).map(r => decodeLine(r, u)),
    pierLines: (file.pierLines ?? []).map(r => decodeLine(r, u)),
    hoodRings: (file.hoodRings ?? []).map(r => decodeLine(r, u)),
  };
}
