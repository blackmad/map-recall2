/**
 * A tower standing on part of a broad, low pand: draw the podium at its own
 * height and the tower over its own footprint, instead of one slab at the ridge.
 *
 * `bagHeightM` raises a pand to its ridge when the ridge stands at least
 * `TOWER_PODIUM_GAP_M` above the LoD1.2 height (`b3_h_dak_70p`), so Zuidas
 * keeps its towers. It cannot say where the tower stands, so a three-storey
 * school with a hotel tower in one corner became a 72 m block over 14,000 m²
 * (Hotelschool The Hague, Jan Evertsenstraat 171-175, NL.IMBAG.Pand.0363100012148630).
 *
 * 3DBAG's LoD1.3 solids answer the question: each roof face is a flat prism
 * top at its own height. A face is tall when it stands past the midpoint
 * between the percentile (the podium) and the ridge; the tall faces, merged,
 * are the tower's footprint.
 *
 * Measured over the 201 pands that take the ridge-tower height in the cached
 * Amsterdam 3DBAG (v20250903), tall area over the LoD0 footprint: p10 0.03,
 * median 0.15, p90 0.27, max 0.41. That is the arithmetic of the rule itself —
 * a 70th percentile can only sit on the podium when less than about 30 % of
 * the roof points are tower — so the split is the ordinary case (192 pands)
 * and the whole-footprint ridge is kept only from `TOWER_WHOLE_SHARE` (0.7), a
 * band nothing measured reaches, as headroom for a later vintage. Nine pands
 * keep the ridge-tower height unchanged because their tower cannot be located:
 * four have no tall LoD1.3 face at all and five have one under
 * `TOWER_MIN_AREA_M2` (1–4 m²: masts, chimneys, spire tips; the next smallest
 * real tower is 6 m²). Podiums run p10 3.8 / median 15.2 / p90 33.2 m, towers
 * 16.9 / 32.4 / 65.9 m over 37 / 396 / 1,618 m².
 */

/** A point in RD New metres. */
export type Rd = [number, number];
/** One polygon in RD New: outer ring first, then holes, each closed or open. */
export type RdPolygon = Rd[][];

/** One LoD1.3 roof face: a flat top over a polygon, height above the pand's ground. */
export type RoofFace = { polygon: RdPolygon; topM: number };

/** Where between the podium (70p) and the ridge a roof face counts as tower. */
export const TOWER_CUT_FRACTION = 0.5;
/**
 * Tall share of the footprint at and above which the ridge-over-everything
 * height stays. The measured population tops out at 0.41 and the percentile
 * rule cannot produce much past ~0.3, so 0.7 leaves a wide dead band: a pand
 * near the cut never flips between the two drawings on a re-measure.
 */
export const TOWER_WHOLE_SHARE = 0.7;
/** A tall area smaller than this is a mast, chimney or spire tip, not a locatable tower. */
export const TOWER_MIN_AREA_M2 = 5;

export type TowerSplit =
  /** Podium over the whole footprint at `podiumM`; tower over `polygons` from `podiumM` to `towerM`. */
  | { kind: 'split'; podiumM: number; towerM: number; polygons: RdPolygon[]; towerAreaM2: number; tallShare: number }
  /** The tower is most of the pand: one extrusion at the ridge, as before. */
  | { kind: 'whole'; heightM: number; tallShare: number }
  /** No usable tall face: the tower cannot be placed, so the ridge height is kept as before. */
  | { kind: 'unlocated'; heightM: number; tallShare: number };

const signedArea = (ring: readonly Rd[]): number => {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return -a / 2;
};
const open = (ring: readonly Rd[]): Rd[] => {
  const last = ring[ring.length - 1];
  return ring.length > 1 && last[0] === ring[0][0] && last[1] === ring[0][1] ? ring.slice(0, -1) : [...ring];
};
export const polygonAreaM2 = (polygon: RdPolygon): number =>
  polygon.reduce((sum, ring, k) => sum + (k === 0 ? 1 : -1) * Math.abs(signedArea(open(ring))), 0);

function pointInRing(x: number, y: number, ring: readonly Rd[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Drop vertices that sit on the straight line between their neighbours (T-junction leftovers). */
function dropCollinear(ring: Rd[]): Rd[] {
  let out = ring;
  for (let changed = true; changed && out.length > 3;) {
    changed = false;
    for (let i = 0; i < out.length && out.length > 3; i++) {
      const a = out[(i + out.length - 1) % out.length], b = out[i], c = out[(i + 1) % out.length];
      const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
      if (Math.abs(cross) / len < 0.005) { out = [...out.slice(0, i), ...out.slice(i + 1)]; changed = true; i--; }
    }
  }
  return out;
}

/**
 * Merge faces that tile one area (LoD1.3 roof faces of one solid share their
 * vertices) by cancelling every edge walked in both directions. Returns null
 * when the leftover edges do not chain into closed rings — a T-junction or a
 * gap — and the caller keeps the faces as separate polygons instead.
 */
export function mergeFaces(polygons: readonly RdPolygon[]): RdPolygon[] | null {
  const key = (p: Rd): string => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`;
  const point = new Map<string, Rd>();
  const edges = new Map<string, number>();
  const add = (a: string, b: string): void => {
    const back = `${b}|${a}`;
    const backCount = edges.get(back) ?? 0;
    if (backCount > 0) { if (backCount === 1) edges.delete(back); else edges.set(back, backCount - 1); return; }
    edges.set(`${a}|${b}`, (edges.get(`${a}|${b}`) ?? 0) + 1);
  };
  for (const polygon of polygons) {
    polygon.forEach((raw, k) => {
      let ring = open(raw);
      if (ring.length < 3 || Math.abs(signedArea(ring)) < 1e-6) return;
      // Outer rings counter-clockwise, holes clockwise, so shared edges run opposite ways.
      if ((signedArea(ring) > 0) !== (k === 0)) ring = [...ring].reverse();
      const keys = ring.map(p => { const k2 = key(p); point.set(k2, p); return k2; });
      for (let i = 0; i < keys.length; i++) if (keys[i] !== keys[(i + 1) % keys.length]) add(keys[i], keys[(i + 1) % keys.length]);
    });
  }
  const next = new Map<string, string[]>();
  for (const [edge, count] of edges) {
    const [a, b] = edge.split('|');
    for (let c = 0; c < count; c++) next.set(a, [...(next.get(a) ?? []), b]);
  }
  const rings: Rd[][] = [];
  for (const start of [...next.keys()]) {
    while ((next.get(start)?.length ?? 0) > 0) {
      const ring: Rd[] = [];
      let at = start;
      for (let guard = 0; ; guard++) {
        const outs = next.get(at);
        if (!outs?.length || guard > edges.size + 1) return null;
        const to = outs.shift()!;
        ring.push(point.get(at)!);
        at = to;
        if (at === start) break;
      }
      const clean = dropCollinear(ring);
      if (clean.length >= 3 && Math.abs(signedArea(clean)) > 1e-6) rings.push(clean);
    }
  }
  const outers = rings.filter(ring => signedArea(ring) > 0);
  const holes = rings.filter(ring => signedArea(ring) < 0);
  if (!outers.length) return null;
  const out: RdPolygon[] = outers.map(ring => [ring]);
  for (const hole of holes) {
    const owner = out
      .map((polygon, index) => ({ index, area: signedArea(polygon[0]), inside: pointInRing(hole[0][0], hole[0][1], polygon[0]) || hole.some(p => pointInRing(p[0], p[1], polygon[0])) }))
      .filter(candidate => candidate.inside)
      .sort((a, b) => a.area - b.area)[0];
    if (!owner) return null;
    out[owner.index].push(hole);
  }
  return out.map(polygon => polygon.map(ring => [...ring, ring[0]]));
}

/**
 * Decide how a ridge-tower pand is drawn from its LoD1.3 roof faces.
 *
 * `podiumM` is the percentile height (`b3_h_dak_70p` above ground), `ridgeM`
 * the ridge-tower height `bagHeightM` returned, and `footprintAreaM2` the
 * LoD0 footprint the podium extrudes — the denominator, because 3DBAG's parts
 * do not always cover the whole footprint (Hotelschool: 7,250 of 14,270 m²).
 */
export function splitTowerPodium(input: { podiumM: number; ridgeM: number; footprintAreaM2: number; faces: readonly RoofFace[] }): TowerSplit {
  const { podiumM, ridgeM, faces } = input;
  const cut = podiumM + TOWER_CUT_FRACTION * (ridgeM - podiumM);
  const tall = faces.filter(face => face.topM >= cut);
  const tallArea = tall.reduce((sum, face) => sum + Math.max(0, polygonAreaM2(face.polygon)), 0);
  const roofArea = faces.reduce((sum, face) => sum + Math.max(0, polygonAreaM2(face.polygon)), 0);
  const denominator = Math.max(input.footprintAreaM2, roofArea);
  const tallShare = denominator > 0 ? tallArea / denominator : 0;
  if (tallArea < TOWER_MIN_AREA_M2) return { kind: 'unlocated', heightM: ridgeM, tallShare };
  if (tallShare >= TOWER_WHOLE_SHARE) return { kind: 'whole', heightM: ridgeM, tallShare };
  const polygons = mergeFaces(tall.map(face => face.polygon)) ?? tall.map(face => face.polygon.map(ring => [...open(ring), open(ring)[0]]));
  return { kind: 'split', podiumM, towerM: ridgeM, polygons, towerAreaM2: tallArea, tallShare };
}

/** The minimal CityJSON shape the LoD1.3 reader needs. */
type CityGeometry = { type: string; lod?: string; boundaries: unknown; semantics?: { surfaces: { type: string }[]; values: unknown } };
type CityObjectLike = { type: string; children?: string[]; geometry?: CityGeometry[] };

/**
 * Every LoD1.3 roof face of a pand's `BuildingPart` children, in RD New, with
 * its top above `groundNapM`. A face's height is the mean of its ring's
 * vertex heights; LoD1.3 tops are flat, so that is the face.
 */
export function lod13RoofFaces(
  objects: Record<string, CityObjectLike>,
  building: CityObjectLike,
  vertexRd: (index: number) => [number, number, number] | undefined,
  groundNapM: number,
): RoofFace[] {
  const faces: RoofFace[] = [];
  for (const childId of building.children ?? []) {
    const solid = objects[childId]?.geometry?.find(geometry => geometry.lod === '1.3' && geometry.type === 'Solid');
    if (!solid?.semantics) continue;
    const shell = (solid.boundaries as number[][][][])[0] ?? [];
    const values = ((solid.semantics.values as (number | null)[][])[0] ?? []);
    shell.forEach((surface, k) => {
      const semantic = values[k] === null || values[k] === undefined ? undefined : solid.semantics!.surfaces[values[k] as number];
      if (semantic?.type !== 'RoofSurface') return;
      const rings = surface.map(ring => ring.map(vertexRd).filter((p): p is [number, number, number] => !!p));
      if (!rings[0] || rings[0].length < 3) return;
      const top = rings[0].reduce((sum, p) => sum + p[2], 0) / rings[0].length;
      faces.push({ polygon: rings.map(ring => ring.map(([x, y]) => [x, y] as Rd)), topM: top - groundNapM });
    });
  }
  return faces;
}

/**
 * The tile id of a pand's tower feature. Tile ids must stay unique (MapLibre
 * `promoteId`, `planSourceDiff`), and it must not start with the pand prefix:
 * `isPandId` is a prefix test, and `shortPandId`/`fullPandId` would not
 * round-trip a suffixed id through covers.json. The pand rides in `pand`.
 */
export const towerFeatureId = (pandId: string): string => `tower:${pandId}`;

/** A WGS84 ring, `[lng, lat]`. */
type LngLatRing = [number, number][];
const round6 = (value: number): number => Math.round(value * 1e6) / 1e6;
const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * The tower as a building-tile feature: its own footprint, standing from the
 * podium roof to the tower top, so its walls stack on the podium's instead of
 * running coplanar inside them (and `dropNestedDuplicates` sees disjoint
 * height ranges, so neither feature is dropped as the other's twin).
 */
export function towerTileFeature(pandId: string, tower: { polygons: LngLatRing[][]; minHeightM: number; heightM: number }): {
  type: 'Feature'; properties: Record<string, unknown>; geometry: { type: 'Polygon'; coordinates: LngLatRing[] } | { type: 'MultiPolygon'; coordinates: LngLatRing[][] };
} {
  const polygons = tower.polygons.map(polygon => polygon.map(ring => ring.map(([lng, lat]) => [round6(lng), round6(lat)] as [number, number])));
  return {
    type: 'Feature',
    properties: { id: towerFeatureId(pandId), pand: pandId, tier: 3, minHeight: round2(tower.minHeightM), height: round2(tower.heightM) },
    geometry: polygons.length === 1 ? { type: 'Polygon', coordinates: polygons[0] } : { type: 'MultiPolygon', coordinates: polygons },
  };
}
