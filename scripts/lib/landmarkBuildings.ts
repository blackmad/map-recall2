/**
 * Which streamed building a landmark card is about, decided at extract time.
 *
 * The runtime used to guess: the landmark's own way, else the footprint under
 * its point, else the nearest footprint within 10 m. The last step lit a 52 m²
 * shed 5 m from the Bevrijdingslinde — a tree (user report 2026-09-29, "why
 * can't we tie buildings to OSM ids and need to do this 10m thing?").
 *
 * The building tiles are keyed by BAG pand id (`NL.IMBAG.Pand.…`) where the
 * register has the building, else by OSM way (`w…`). OSM building ways carry
 * `ref:bag`, so a landmark resolves exactly:
 * 1. its own OSM way or relation, when that is a building;
 * 2. the buildings inside it, when it is a site (a museum's grounds);
 * 3. the building containing its point, when it is a node inside one;
 * 4. for a node naming an institution on the pavement outside its door, the
 *    nearest building within `ENTRANCE_METRES` — never for a tree, statue,
 *    plaque or other object, which has no building and keeps its dot.
 */

export type Ring = Array<[number, number]>;

export interface OsmBuilding {
  /** `w123` or `r123`. */
  osmId: string;
  refBag: string | null;
  wikidata: string | null;
  rings: Ring[];
  /** A `building:part`: the tiles draw a building's parts in place of its
   *  footprint where OSM maps them (Muziekgebouw, Royal Palace). */
  part?: boolean;
}

export interface LandmarkSource {
  id: string;
  /** The landmark's Wikidata item, which OSM building ways also carry. */
  wikidata: string | null;
  /** [lng, lat] */
  point: [number, number];
  /** The outline the extract carries for a way or relation landmark, [lng, lat]. */
  outline: Ring[];
  /** The OSM tags of the landmark's node (matched by name and position);
   *  null when it has an outline or no node was found. */
  nodeTags: Record<string, string> | null;
}

export interface LandmarkBuildingMatch {
  buildingIds: string[];
  how: 'wikidata' | 'own-way' | 'site' | 'contains-point' | 'entrance' | 'object' | 'none';
}

/** Metres an institution's node may sit outside its building (entrances are
 *  often mapped on the pavement). */
export const ENTRANCE_METRES = 10;
/** Most buildings a site may claim; beyond this it is a district, not a place. */
export const SITE_MAX_BUILDINGS = 12;

/** Tags that make a node an object in the street, not a building's name. */
const OBJECT_TAGS: Array<[string, RegExp]> = [
  ['natural', /./],
  ['historic', /^(memorial|monument|boundary_stone|wayside_cross|milestone|stone|cannon|tomb)$/],
  ['memorial', /./],
  ['artwork_type', /./],
  ['tourism', /^(artwork|viewpoint|information)$/],
  ['amenity', /^(fountain|bench|clock|drinking_water|bicycle_parking|toilets|post_box|waste_basket)$/],
  ['man_made', /^(statue|obelisk|flagpole|mast|lamp|survey_point)$/],
  ['leisure', /^(playground|picnic_table|pitch)$/],
];

export function isStreetObject(tags: Record<string, string> | null): boolean {
  if (!tags) return false;
  // An address is a building's: the Hollandsche Schouwburg's node carries
  // `historic=memorial` and a house number, and is the theatre.
  if (tags.building || tags['addr:housenumber']) return false;
  return OBJECT_TAGS.some(([key, pattern]) => tags[key] !== undefined && pattern.test(tags[key]));
}

/** The building-tile id for a BAG pand number as OSM writes it (leading zeros
 *  are often dropped: `363100012168783` is pand `0363100012168783`). */
export function pandTileId(refBag: string): string | null {
  const digits = refBag.trim().split(/[;,\s]/)[0];
  if (!/^\d{1,16}$/.test(digits)) return null;
  return `NL.IMBAG.Pand.${digits.padStart(16, '0')}`;
}

/** The tile id for an OSM building: its pand when the tiles have it, else its way. */
export function tileIdFor(building: OsmBuilding, tileIds: ReadonlySet<string>): string | null {
  const pand = building.refBag ? pandTileId(building.refBag) : null;
  if (pand && tileIds.has(pand)) return pand;
  if (tileIds.has(building.osmId)) return building.osmId;
  return null;
}

/** The tile ids that draw a building: itself, or the parts inside it. */
export function tileIdsDrawing(building: OsmBuilding, grid: BuildingGrid, tileIds: ReadonlySet<string>): string[] {
  const own = tileIdFor(building, tileIds);
  if (own) return [own];
  const [cx, cy] = ringCentroid(building.rings[0]);
  return grid.near(cx, cy, 2)
    .filter(part => part.part && building.rings.some(ring => pointInRing(...ringCentroid(part.rings[0]), ring)))
    .map(part => tileIdFor(part, tileIds))
    .filter((id): id is string => !!id);
}

export function pointInRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function ringCentroid(ring: Ring): [number, number] {
  let x = 0, y = 0;
  const n = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.length - 1 : ring.length;
  for (let i = 0; i < n; i++) { x += ring[i][0]; y += ring[i][1]; }
  return [x / n, y / n];
}

/** Metres from a point outside a ring to its nearest edge (equirectangular). */
export function metresToRing(lng: number, lat: number, ring: Ring): number {
  const kx = 111_320 * Math.cos(lat * Math.PI / 180), ky = 110_540;
  let best = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const ax = (ring[i][0] - lng) * kx, ay = (ring[i][1] - lat) * ky;
    const bx = (ring[i + 1][0] - lng) * kx, by = (ring[i + 1][1] - lat) * ky;
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(ax + dx * t, ay + dy * t));
  }
  return best;
}

/** A coarse grid over building bounding boxes, so 400 landmarks do not each
 *  scan every building in the city. */
export class BuildingGrid {
  private readonly cells = new Map<string, OsmBuilding[]>();
  readonly byOsmId = new Map<string, OsmBuilding>();
  constructor(private readonly cellDegrees = 0.002) {}

  add(building: OsmBuilding): void {
    this.byOsmId.set(building.osmId, building);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const ring of building.rings) for (const [x, y] of ring) {
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    for (let cx = Math.floor(minX / this.cellDegrees); cx <= Math.floor(maxX / this.cellDegrees); cx++) {
      for (let cy = Math.floor(minY / this.cellDegrees); cy <= Math.floor(maxY / this.cellDegrees); cy++) {
        const key = `${cx}:${cy}`;
        (this.cells.get(key) ?? this.cells.set(key, []).get(key)!).push(building);
      }
    }
  }

  near(lng: number, lat: number, radiusCells = 1): OsmBuilding[] {
    const found = new Set<OsmBuilding>();
    const cx = Math.floor(lng / this.cellDegrees), cy = Math.floor(lat / this.cellDegrees);
    for (let dx = -radiusCells; dx <= radiusCells; dx++) for (let dy = -radiusCells; dy <= radiusCells; dy++) {
      for (const building of this.cells.get(`${cx + dx}:${cy + dy}`) ?? []) found.add(building);
    }
    return [...found];
  }
}

const outer = (building: OsmBuilding) => building.rings[0];

export function resolveLandmarkBuildings(
  landmark: LandmarkSource, grid: BuildingGrid, tileIds: ReadonlySet<string>,
): LandmarkBuildingMatch {
  const ids = (buildings: OsmBuilding[]) =>
    [...new Set(buildings.flatMap(building => tileIdsDrawing(building, grid, tileIds)))];
  const near = (x: number, y: number, cells?: number) => grid.near(x, y, cells).filter(building => !building.part);

  const [lng, lat] = landmark.point;
  // 1. A building carrying the landmark's Wikidata item: the same thing, by
  //    identity. Near the landmark only, so a chain's item cannot reach across town.
  if (landmark.wikidata) {
    const same = near(lng, lat, 3).filter(building => building.wikidata === landmark.wikidata);
    const found = same.length <= SITE_MAX_BUILDINGS ? ids(same) : [];
    if (found.length) return { buildingIds: found, how: 'wikidata' };
  }

  if (landmark.outline.length) {
    // The landmark's outline is a building's own ring (the extract kept the
    // geometry but not the OSM id).
    const ring = landmark.outline[0];
    const [cx, cy] = ringCentroid(ring);
    const own = near(cx, cy).find(building => sameRing(outer(building), ring));
    const ownId = own ? ids([own]) : [];
    if (ownId.length) return { buildingIds: ownId, how: 'own-way' };
    // 2. A site: the buildings whose centre lies inside its outline.
    const inside = near(lng, lat, 3).filter(building => {
      const [x, y] = ringCentroid(outer(building));
      return landmark.outline.some(ring => pointInRing(x, y, ring));
    });
    const found = inside.length <= SITE_MAX_BUILDINGS ? ids(inside) : [];
    if (found.length) return { buildingIds: found, how: 'site' };
  }

  // A tree, statue or plaque is not a building's name, whatever stands near it.
  if (isStreetObject(landmark.nodeTags)) return { buildingIds: [], how: 'object' };

  // 3. A node inside a building.
  const nearby = near(lng, lat);
  const containing = nearby.filter(building => pointInRing(lng, lat, outer(building)));
  if (containing.length) {
    // Nested footprints: the smallest building the tiles actually draw.
    for (const building of containing.sort((a, b) => ringArea(outer(a)) - ringArea(outer(b)))) {
      const found = ids([building]);
      if (found.length) return { buildingIds: found, how: 'contains-point' };
    }
  }

  // 4. An institution's node on the pavement outside its door.
  if (landmark.nodeTags && !landmark.outline.length) {
    let best: OsmBuilding | null = null, bestMetres = ENTRANCE_METRES;
    for (const building of nearby) {
      const metres = metresToRing(lng, lat, outer(building));
      if (metres < bestMetres) { best = building; bestMetres = metres; }
    }
    const found = best ? ids([best]) : [];
    if (found.length) return { buildingIds: found, how: 'entrance' };
  }
  return { buildingIds: [], how: 'none' };
}

function ringArea(ring: Ring): number {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) area += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(area / 2);
}

/** Two rings are the same outline when they have the same vertex count and
 *  every vertex of one is within ~1 m of the other's. */
export function sameRing(a: Ring, b: Ring): boolean {
  if (a.length !== b.length || a.length < 4) return false;
  const tolerance = 0.00001;
  return b.every(([x, y]) => a.some(([ax, ay]) => Math.abs(ax - x) < tolerance && Math.abs(ay - y) < tolerance));
}
