/**
 * Choose one representation per building, and record which tier won.
 *
 * Phase 1 merges two sources that describe the same city differently. 3DBAG
 * covers every pand with a measured height and no shape beyond a footprint.
 * OSM covers a tenth of the city, guesses most of its heights, and carries the
 * one thing no government dataset holds: buildings a human has modelled in
 * three dimensions, as stacked `building:part` ways with their own heights and
 * roof shapes.
 *
 * Neither source wins outright. The rule from BUILDING_RENDERER_DESIGN.md is
 * that government geometry is the floor for the city and never the ceiling for
 * a landmark, so the ladder is:
 *
 *   tier 2  hand-mapped OSM parts, where a mapper has modelled the building
 *   tier 3  the 3DBAG extrusion at its AHN-measured height
 *   tier 4  an OSM footprint BAG does not hold at all
 *
 * The failure this exists to prevent is concrete. The Waag is three panden at
 * 16.0, 13.0 and 12.9 m and fourteen OSM parts at 6 to 26 m; letting the
 * measured height win because it is measured turns a landmark into three
 * boxes. The failure in the other direction is just as real, and much larger:
 * leaving OSM in charge everywhere means nine tenths of the city has no
 * building at all, and the tenth that does has invented heights.
 *
 * **Ownership never overlaps.** Two neighbours at different tiers is the
 * design; two representations of one building is the bug that shows up as
 * z-fighting. So a pand claimed by tier 2 is *suppressed* rather than
 * recoloured, and the OSM parts render in its place.
 */

/** A closed ring of `[lng, lat]`. */
export type Ring = [number, number][];
export type Bbox = [number, number, number, number];

export type LadderTier = 2 | 3 | 4;

/** The minimum an OSM feature needs for the join; the real one carries more. */
export type OsmFootprint = {
  osmId: string;
  rings: Ring[];
  /** Above-ground base. Non-zero is the signal that this is a stacked part. */
  minHeightM: number;
  heightM: number;
  roofShape?: string;
};

/** The minimum a BAG pand needs for the join. */
export type BagFootprint = {
  bagId: string;
  rings: Ring[];
};

export const ringBbox = (ring: Ring): Bbox => {
  let [west, south, east, north] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [lng, lat] of ring) {
    west = Math.min(west, lng); east = Math.max(east, lng);
    south = Math.min(south, lat); north = Math.max(north, lat);
  }
  return [west, south, east, north];
};

export const bboxesOverlap = (a: Bbox, b: Bbox): boolean =>
  a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

/** Area-weighted centroid of a ring, falling back to the mean for degenerate rings. */
export function ringCentroid(ring: Ring): [number, number] {
  let twiceArea = 0;
  let x = 0;
  let y = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    twiceArea += cross;
    x += (ring[j][0] + ring[i][0]) * cross;
    y += (ring[j][1] + ring[i][1]) * cross;
  }
  if (Math.abs(twiceArea) < 1e-12) {
    return [ring.reduce((sum, p) => sum + p[0], 0) / ring.length, ring.reduce((sum, p) => sum + p[1], 0) / ring.length];
  }
  return [x / (3 * twiceArea), y / (3 * twiceArea)];
}

/** Ray casting. Points exactly on an edge are not worth special-casing here. */
export function pointInRing([lng, lat]: [number, number], ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * A uniform grid over footprints, for "what is near this polygon".
 *
 * A city is a few hundred thousand buildings against ten thousand OSM
 * features, so the join is run hundreds of thousands of times and a linear
 * scan is not an option. Buildings are small and evenly spread, which is
 * exactly the case a uniform grid handles as well as an R-tree and with far
 * less code.
 */
export class FootprintGrid<T extends { rings: Ring[] }> {
  private readonly cells = new Map<string, T[]>();
  /** Roughly 100 m at Amsterdam's latitude; a cell holds a block, not a city. */
  constructor(private readonly cellSize = 0.0015) {}

  private key(cellX: number, cellY: number): string { return `${cellX}/${cellY}`; }

  add(item: T): void {
    for (const cell of this.cellsFor(item.rings)) {
      const bucket = this.cells.get(cell);
      if (bucket) bucket.push(item);
      else this.cells.set(cell, [item]);
    }
  }

  private cellsFor(rings: Ring[]): string[] {
    const [west, south, east, north] = rings.length === 1
      ? ringBbox(rings[0])
      : rings.map(ringBbox).reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] as Bbox);
    const cells: string[] = [];
    for (let x = Math.floor(west / this.cellSize); x <= Math.floor(east / this.cellSize); x++) {
      for (let y = Math.floor(south / this.cellSize); y <= Math.floor(north / this.cellSize); y++) {
        cells.push(this.key(x, y));
      }
    }
    return cells;
  }

  /** Candidates whose cells meet these rings. May repeat; callers dedupe. */
  near(rings: Ring[]): T[] {
    const found = new Set<T>();
    for (const cell of this.cellsFor(rings)) {
      for (const item of this.cells.get(cell) ?? []) found.add(item);
    }
    return [...found];
  }
}

/** What the ladder decided for one pand, and why. */
export type LadderDecision = {
  tier: LadderTier;
  /** OSM features standing in for this pand when tier 2 wins. */
  osmIds: string[];
  /**
   * Every OSM footprint overlapping this pand, whatever the tier. The caller
   * needs the full list, not just the winner: an OSM feature that overlapped
   * *any* pand is already represented in the output, and re-emitting it as a
   * tier 4 structure is how one building becomes two.
   */
  matchedOsmIds: string[];
};

/**
 * Decide a pand's tier against the OSM features that overlap it.
 *
 * A match is an OSM footprint whose centroid falls inside the pand, or a pand
 * whose centroid falls inside the OSM footprint. Centroid containment rather
 * than area intersection is deliberate: the two sources digitise the same wall
 * from different surveys, so their edges disagree by up to a metre or so
 * everywhere, and an intersection test spends most of its time on slivers that
 * mean nothing. Containment either way round also handles the two real cases —
 * one OSM outline over several panden, and one pand under several parts.
 *
 * Tier 2 requires a *stacked* part (`minHeightM > 0`). An OSM outline with a
 * single height is not a three-dimensional model; it is a footprint with a
 * guessed height, and the measured extrusion beats it.
 */
export function decideTier(pand: BagFootprint, candidates: OsmFootprint[]): LadderDecision {
  const pandRing = pand.rings[0];
  const pandCentroid = ringCentroid(pandRing);
  const matches: OsmFootprint[] = [];

  for (const osm of candidates) {
    const hit = osm.rings.some(ring => pointInRing(ringCentroid(ring), pandRing)) ||
      osm.rings.some(ring => pointInRing(pandCentroid, ring));
    if (hit) matches.push(osm);
  }

  const matchedOsmIds = matches.map(match => match.osmId);
  const stacked = matches.filter(match => match.minHeightM > 0);
  if (stacked.length > 0) {
    // The whole modelled composition stands in for the pand, not just the
    // raised parts: dropping the ground-level part would leave the building
    // floating above a hole.
    return { tier: 2, osmIds: matchedOsmIds, matchedOsmIds };
  }
  return { tier: 3, osmIds: [], matchedOsmIds };
}
