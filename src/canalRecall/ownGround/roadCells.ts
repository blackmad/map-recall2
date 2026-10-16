// roads-v1 cell schema: the surveyed road partition per own-ground 1 km cell
// (pure, dependency-free; shared by the extractor scripts/own-ground/build-bgt-roads.ts,
// the ground worker's roadSurfaces.ts and the tests).
//
// Source: BGT `wegdeel` polygons (Kadaster via PDOK, CC0 1.0). Each polygon is one
// surface of the municipality's road partition: nothing overlaps at one height, so the
// worker can draw them as a plane without booleans. OSM centreline bands stay as the
// fallback for cells without the extract and for the far ring.
//
// Geometry is in the game's local frame (groundStore toLocal: metres east/north of
// 4.9 E 52.37 N) as whole decimetres, delta-encoded exactly as parks-v1 `EncodedLine`:
// [x0, y0, dx1, dy1, ...]; rings are open (the closing vertex is not repeated).

export const ROAD_CELL_VERSION = 1 as const;
export const ROADS_MANIFEST_VERSION = 1 as const;
export const ROADS_EXTRACT = 'roads-v1';
export const ROADS_ATTRIBUTION = 'BGT © Kadaster (CC0 1.0)';

/** Published budget (scripts/own-ground/build-bgt-roads.ts enforces it with the 0.15 m lever). */
export const ROAD_CELL_BUDGET_GZ = 350 * 1024;
export const ROADS_TOTAL_BUDGET_GZ = 30 * 1024 * 1024;

export type Vec2 = [number, number];
export type EncodedLine = number[];

/** What the surface is made of: the mesh / palette layer the worker draws it with. */
export type RoadMesh = 'asphalt' | 'klinker' | 'gravel' | 'paving' | 'cycle';
export const ROAD_MESHES: readonly RoadMesh[] = ['asphalt', 'klinker', 'gravel', 'paving', 'cycle'];

/** What the surface is for (bgtWidth.ts `classOf`, without `other`): lifts, kerbs and cover tests key on it. */
export type RoadClass = 'carriage' | 'foot' | 'cycle' | 'pedestrian' | 'parking' | 'driveway';
export const ROAD_CLASSES: readonly RoadClass[] = ['carriage', 'foot', 'cycle', 'pedestrian', 'parking', 'driveway'];

/** Classes drawn at carriageway level: the lower side of a kerb. */
export const KERB_LOW_CLASSES: readonly RoadClass[] = ['carriage', 'parking', 'cycle'];
/** Classes drawn at sidewalk level: the upper side of a kerb (an inrit is the lowered kerb across the pavement). */
export const KERB_HIGH_CLASSES: readonly RoadClass[] = ['foot', 'pedestrian', 'driveway'];

export interface RoadSurface {
  /** Mesh. */
  k: RoadMesh;
  /** Class. */
  c: RoadClass;
  /** BGT relatieve_hoogteligging: 0 on the ground, ≥ 1 a bridge or viaduct deck (drawn on the deck surface). */
  h: number;
  /** Rings, outer first, then holes. */
  r: EncodedLine[];
}

export interface RoadCell {
  version: typeof ROAD_CELL_VERSION;
  key: string;
  /** Polygons whose interior point lies in this cell. */
  surfaces: RoadSurface[];
  /** Kerb lines: shared edges between a low-class and a high-class polygon at equal `h`, merged into runs. */
  kerbs: EncodedLine[];
  /** OSM way ids (own-ground-osm-v1) whose 2 m stations lie ≥ 80 % inside polygons of a compatible class: no bands for them. */
  coverWays: number[];
}

export interface RoadsManifest {
  version: typeof ROADS_MANIFEST_VERSION;
  cells: string[];
  fetched: string;
  attribution: string;
  report?: Record<string, unknown>;
}

// ------------------------------------------------------------------ classification

/**
 * The mesh a BGT polygon is drawn with, from its class and `fysiek_voorkomen`.
 * Carriageways and parking: closed paving → asphalt, open paving → klinker, half paved or
 * unpaved → gravel (an unknown or `transitie` surface reads as asphalt). Footways and
 * pedestrian areas: paving (tiles) whatever the survey says. An inrit follows its survey
 * (klinker or asphalt across the pavement), tiles when unknown. Cycle paths: red cycle.
 * `fietsstraat` (from the OSM way on top) turns a carriageway red.
 */
export function roadMesh(cls: RoadClass, fysiekVoorkomen: string | null | undefined, fietsstraat = false): RoadMesh {
  if (cls === 'cycle') return 'cycle';
  if (cls === 'foot' || cls === 'pedestrian') return 'paving';
  const fv = (fysiekVoorkomen ?? '').toLowerCase();
  if (cls === 'driveway') return fv.startsWith('gesloten') ? 'asphalt' : fv.startsWith('open') ? 'klinker' : fv.startsWith('half') || fv.startsWith('onverhard') ? 'gravel' : 'paving';
  if (fietsstraat && cls === 'carriage') return 'cycle';
  if (fv.startsWith('open')) return 'klinker';
  if (fv.startsWith('half') || fv.startsWith('onverhard')) return 'gravel';
  return 'asphalt';
}

/** Metres of tram track along a rijbaan section that keep it grey under a fietsstraat (the Marnixstraat busway). */
export const FIETSSTRAAT_RAIL_MAX_M = 12;
/** A fietsstraat needs this many metres of its own centreline on a rijbaan section to paint it. */
export const FIETSSTRAAT_MIN_M = 4;
/**
 * Whether a BGT rijbaan section is the fietsstraat's (roads lane phase 2, 2026-10-16): decided per polygon in the
 * extractor from the OSM carriageway centrelines measured over it. `fiets`: metres of fietsstraat way
 * (cyclestreet / bicycle_road, osmGround `isFietsstraat`) inside the polygon; `other`: metres of any other
 * carriageway (the cross street through a junction polygon, a busway); `rails`: metres of tram track
 * (`embedded_rails=tram`). Red when the fietsstraat runs along the section at least as far as everything else and
 * no tram track runs along it: a junction polygon at a fietsstraat's end belongs to the cross street, and the
 * busway with four rails by the Tweede Marnixplantsoen stays grey (it was one red polygon with the rails on it).
 */
export function fietsstraatSection(m: { fiets: number; other: number; rails: number }): boolean {
  return m.fiets >= FIETSSTRAAT_MIN_M && m.fiets >= m.other && m.rails < FIETSSTRAAT_RAIL_MAX_M;
}

/** Whether a kerb runs between two touching polygons (one at road level, one at pavement level, same height). */
export function kerbBetween(a: Pick<RoadSurface, 'c' | 'h'>, b: Pick<RoadSurface, 'c' | 'h'>): boolean {
  if (a.h !== b.h) return false;
  const low = (c: RoadClass) => KERB_LOW_CLASSES.includes(c), high = (c: RoadClass) => KERB_HIGH_CLASSES.includes(c);
  return (low(a.c) && high(b.c)) || (high(a.c) && low(b.c));
}

// ------------------------------------------------------------------ decoding

/** parks-v1 `decodeLine`, duplicated so this module stays free of earcut and the mesh helpers. */
export function decodeRoadLine(e: readonly number[]): Vec2[] {
  const out: Vec2[] = [];
  let x = 0, y = 0;
  for (let i = 0; i + 1 < e.length; i += 2) { x += e[i]; y += e[i + 1]; out.push([x / 10, y / 10]); }
  return out;
}

export interface DecodedRoadSurface { k: RoadMesh; c: RoadClass; h: number; rings: Vec2[][] }

export interface DecodedRoadCell { key: string; surfaces: DecodedRoadSurface[]; kerbs: Vec2[][]; coverWays: Set<number> }

/** Decode a cell to metres in the local frame. Rings with fewer than three distinct vertices are dropped. */
export function decodeRoadCell(cell: RoadCell): DecodedRoadCell {
  const surfaces: DecodedRoadSurface[] = [];
  for (const s of cell.surfaces) {
    const rings = s.r.map(decodeRoadLine).filter(r => r.length >= 3);
    if (!rings.length || rings[0].length < 3) continue;
    surfaces.push({ k: s.k, c: s.c, h: s.h, rings });
  }
  return { key: cell.key, surfaces, kerbs: cell.kerbs.map(decodeRoadLine).filter(l => l.length >= 2), coverWays: new Set(cell.coverWays) };
}

// ------------------------------------------------------------------ schema check

/** Problems with a parsed cell file (empty when it is a valid `RoadCell`); the first `limit` only. */
export function roadCellProblems(v: unknown, limit = 20): string[] {
  const out: string[] = [];
  const bad = (m: string) => { if (out.length < limit) out.push(m); };
  if (!v || typeof v !== 'object') return ['not an object'];
  const c = v as Record<string, unknown>;
  if (c.version !== ROAD_CELL_VERSION) bad(`version ${String(c.version)} (expected ${ROAD_CELL_VERSION})`);
  if (typeof c.key !== 'string' || !/^-?\d+_-?\d+$/.test(c.key)) bad(`key ${String(c.key)}`);
  const line = (l: unknown, what: string, minPts: number): boolean => {
    if (!Array.isArray(l) || l.length % 2 !== 0 || l.length < minPts * 2) { bad(`${what}: not an even-length line of ≥ ${minPts} points`); return false; }
    for (const n of l) if (typeof n !== 'number' || !Number.isInteger(n)) { bad(`${what}: non-integer coordinate`); return false; }
    return true;
  };
  if (!Array.isArray(c.surfaces)) bad('surfaces: not an array');
  else c.surfaces.forEach((s: any, i) => {
    if (!s || typeof s !== 'object') return bad(`surfaces[${i}]: not an object`);
    if (!ROAD_MESHES.includes(s.k)) bad(`surfaces[${i}].k ${String(s.k)}`);
    if (!ROAD_CLASSES.includes(s.c)) bad(`surfaces[${i}].c ${String(s.c)}`);
    if (typeof s.h !== 'number' || !Number.isInteger(s.h) || s.h < 0) bad(`surfaces[${i}].h ${String(s.h)}`);
    if (!Array.isArray(s.r) || !s.r.length) bad(`surfaces[${i}].r: no rings`);
    else s.r.forEach((r: unknown, j: number) => line(r, `surfaces[${i}].r[${j}]`, 3));
  });
  if (!Array.isArray(c.kerbs)) bad('kerbs: not an array');
  else c.kerbs.forEach((k, i) => line(k, `kerbs[${i}]`, 2));
  if (!Array.isArray(c.coverWays)) bad('coverWays: not an array');
  else if (c.coverWays.some(w => typeof w !== 'number' || !Number.isInteger(w) || w <= 0)) bad('coverWays: not positive integer way ids');
  else if (new Set(c.coverWays).size !== c.coverWays.length) bad('coverWays: duplicate ids');
  return out;
}

export function isRoadCell(v: unknown): v is RoadCell {
  return roadCellProblems(v, 1).length === 0;
}

/** Problems with a parsed manifest (empty when valid). */
export function roadsManifestProblems(v: unknown): string[] {
  const out: string[] = [];
  if (!v || typeof v !== 'object') return ['not an object'];
  const m = v as Record<string, unknown>;
  if (m.version !== ROADS_MANIFEST_VERSION) out.push(`version ${String(m.version)}`);
  if (!Array.isArray(m.cells) || m.cells.some(k => typeof k !== 'string' || !/^-?\d+_-?\d+$/.test(k))) out.push('cells: not a list of cell keys');
  else if (new Set(m.cells).size !== m.cells.length) out.push('cells: duplicates');
  if (typeof m.fetched !== 'string' || Number.isNaN(Date.parse(m.fetched))) out.push('fetched: not a date');
  if (m.attribution !== ROADS_ATTRIBUTION) out.push(`attribution: ${String(m.attribution)}`);
  return out;
}
