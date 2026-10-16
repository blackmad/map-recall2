/**
 * 3DBAG CityJSON, read as footprints and heights.
 *
 * This is the source the hosted 3D Tiles cannot replace: their geometry is
 * meshopt-compressed mesh with no ground polygon, and a flat-topped LoD1 city
 * is built by extruding a footprint. In CityJSON the footprint is the LoD0
 * MultiSurface on the `Building` object; the `BuildingPart` children carry the
 * LoD1.2/1.3/2.2 solids this stage does not need.
 *
 * Coordinates are quantised integers in RD New. Real position is
 * `vertex * transform.scale + transform.translate`, so nothing here can be
 * read without the transform.
 */

import { rdToLngLat } from './rdCoordinates.js';
import { lod13RoofFaces, polygonAreaM2, splitTowerPodium, type RdPolygon } from './towerPodium.js';

type Transform = { scale: [number, number, number]; translate: [number, number, number] };
type Geometry = { type: string; lod?: string; boundaries: unknown; semantics?: { surfaces: { type: string }[]; values: unknown } };
type CityObject = { type: string; attributes?: Record<string, unknown>; geometry?: Geometry[]; children?: string[] };
export type CityJson = { transform: Transform; vertices: number[][]; CityObjects: Record<string, CityObject> };

/** A ring of `[lng, lat]`, closed. */
export type Ring = [number, number][];

/** One BAG pand, reduced to what a flat-topped extrusion needs. */
export type BagBuilding = {
  /** `NL.IMBAG.Pand.…`, the join key for appearance and for OSM aliases. */
  bagId: string;
  /** Outer ring first, then holes — GeoJSON Polygon ring order. */
  rings: Ring[];
  /** Extrusion height above local ground, in metres. */
  heightM: number | null;
  heightSource: BagHeightSource;
  /** Ground level in metres NAP, so a building can sit on real terrain later. */
  groundNapM: number | null;
  /** Ridge above ground: roof geometry for later phases, never the extrusion. */
  ridgeM: number | null;
  /**
   * Lowest roof point above ground (`b3_h_dak_min`): the eave line of a pitched
   * roof, and simply the roof height of a flat one. Null when 3DBAG measured none.
   */
  eavesM: number | null;
  roofType: string | null;
  constructionYear: number | null;
  storeys: number | null;
  /** Non-zero means terraced, which is how rows get promoted together. */
  partyWallAreaM2: number | null;
  groundAreaM2: number | null;
  /** LoD2.2 reconstruction error; the gate for trusting a detailed mesh. */
  rmseLod22: number | null;
  /** BAG lifecycle status — demolished pands are still published. */
  status: string | null;
  /**
   * The tower of a `tower-podium` pand: its own footprint (WGS84 polygons,
   * outer ring first), standing from the podium roof (`minHeightM`, which is
   * this pand's `heightM`) to the ridge. Null for every other pand.
   */
  tower: BagTower | null;
};

/** A tower drawn over part of its pand's footprint; see `splitTowerPodium`. */
export type BagTower = { polygons: Ring[][]; minHeightM: number; heightM: number; areaM2: number; tallShare: number };

/**
 * `tower-podium`: a ridge-tower pand whose LoD1.3 parts place the tower on part
 * of the footprint, so `heightM` is the podium (70p) and `tower` carries the rest.
 */
export type BagHeightSource = 'roof-70p' | 'lod12-volume' | 'ridge' | 'ridge-tower' | 'tower-podium' | 'none';

const number = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

/**
 * How far the AHN ridge may sit above the ordinary LoD1.2 height before we
 * treat the pand as a tower on a podium and raise the extrusion.
 *
 * `b3_h_dak_70p` is correct for pitched canal houses: most roof points are on
 * the slope, so the 70th percentile sits between eave and ridge. On a slim
 * tower with a broad podium, most points belong to the podium and the
 * percentile collapses to podium height while `b3_h_nok` still records the
 * tip. Ten metres is the gap the comparison page measured across 201 Zuidas
 * panden that were more than 10 m below their own ridge.
 */
export const TOWER_PODIUM_GAP_M = 10;

/**
 * How far 3DBAG's ground (`b3_h_maaiveld`) may sit below the AHN terrain under
 * the footprint before it is treated as a failed ground estimate.
 *
 * Where a pand has no ground points around it (in or over the water, between
 * canal houses with no open yard) 3DBAG falls back to a ground level that can
 * be ten metres below NAP: Nassaukade 63X, a box standing in the Singelgracht
 * (NL.IMBAG.Pand.0363100012124441), has its roof at +5.9 NAP and its ground at
 * −9.67 NAP, so it extruded to 15.6 m. Across the cached 3DBAG (273,599 pands
 * with a terrain sample) the ground sits a median 0.14 m below the terrain and
 * 1 % sit more than 1.6 m below it; past 3 m (540 pands) the values cluster on
 * a few shared fallbacks (−6.36, −6.46, −6.73, −8.38, −9.67 NAP) rather than
 * real sunken ground.
 */
export const GROUND_OUTLIER_M = 3;
/** The terrain reference is AHN4 (PDOK dtm_05m, flown 2020–2022): a pand built later may stand on ground it never saw. */
export const TERRAIN_VINTAGE_YEAR = 2021;
/** The roof must stand at least this far above the terrain for the terrain to be a usable base. */
export const MIN_ROOF_ABOVE_TERRAIN_M = 2;
/** Distance outside the footprint at which `sampleTerrain` reads the terrain around a pand. */
export const TERRAIN_AROUND_M = 4;
/**
 * 3DBAG's ground is real when the terrain just outside the footprint comes
 * within this of it, however high the terrain under the footprint reads.
 *
 * The terrain under a footprint is interpolated across the building's hole in
 * AHN, so a pand on split-level ground reads the high side there: Stadsloket
 * West (0363100012118358) stands on the A10 side street at +0.82 NAP and
 * against the raised Bos en Lommerplein deck at +4.7; Westerdoksdijk 9
 * (0363100012184746) at the foot of the dike; Politie West at the Overtoomse
 * Sluis (0363100012080943). Of the 410 pands the under-footprint test alone
 * replaces, the lowest terrain 4 m outside the walls minus 3DBAG's ground is
 * bimodal: 98 within 1.5 m (median ground −0.26 NAP, one on a fallback value),
 * 4 more in 1.5–2 m, and the rest 2–12 m (111 of them on the shared fallbacks).
 * A failed fallback has no low ground beside it; Nassaukade 63X's nearest
 * terrain is +0.29 NAP against its −9.67.
 */
export const GROUND_REACH_M = 1.5;

export type GroundSource = '3dbag' | 'terrain';

/** AHN terrain in metres NAP at an RD New point (NaN where unknown); see `trustedGroundNap`. */
export type TerrainAt = (rdX: number, rdY: number) => number;

/** The terrain around one footprint: under its centre and the lowest just outside its walls (null where unknown). */
export type TerrainSample = { underNapM: number | null; aroundMinNapM: number | null };

/**
 * Read the terrain for one footprint ring (RD New metres, open or closed): at
 * the mean of its vertices, and the minimum at the vertices and quarter points
 * of every edge pushed `TERRAIN_AROUND_M` away from that centre.
 */
export function sampleTerrain(terrainAt: TerrainAt, ringRd: readonly (readonly number[])[]): TerrainSample {
  const last = ringRd[ringRd.length - 1];
  const ring = ringRd.length > 1 && last[0] === ringRd[0][0] && last[1] === ringRd[0][1] ? ringRd.slice(0, -1) : ringRd;
  if (!ring.length) return { underNapM: null, aroundMinNapM: null };
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length, cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  let around: number | null = null;
  for (let k = 0; k < ring.length; k++) {
    const a = ring[k], b = ring[(k + 1) % ring.length];
    for (const t of [0, 0.25, 0.5, 0.75]) {
      const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, d = Math.hypot(x - cx, y - cy) || 1;
      const h = number(terrainAt(x + (x - cx) / d * TERRAIN_AROUND_M, y + (y - cy) / d * TERRAIN_AROUND_M));
      if (h !== null && (around === null || h < around)) around = h;
    }
  }
  return { underNapM: number(terrainAt(cx, cy)), aroundMinNapM: around };
}

/**
 * The ground to measure a pand's height from: 3DBAG's own, unless it sits
 * more than `GROUND_OUTLIER_M` below the AHN terrain under the footprint, in
 * which case that terrain. Kept when there is no terrain sample, when the pand
 * postdates the terrain survey, when the roof would not clear the terrain by
 * `MIN_ROOF_ABOVE_TERRAIN_M` (an underground or sunken pand), or when the
 * terrain just outside the walls reaches 3DBAG's ground (`GROUND_REACH_M`:
 * split-level ground, not a failed estimate). A bare number is the terrain
 * under the footprint with nothing known around it.
 */
export function trustedGroundNap(attributes: Record<string, unknown>, terrain?: number | TerrainSample | null): { groundNapM: number | null; source: GroundSource } {
  const ground = number(attributes.b3_h_maaiveld);
  const sample: TerrainSample = typeof terrain === 'object' && terrain !== null ? terrain : { underNapM: number(terrain), aroundMinNapM: null };
  const under = number(sample.underNapM);
  if (ground === null || under === null || ground >= under - GROUND_OUTLIER_M) return { groundNapM: ground, source: '3dbag' };
  const year = number(attributes.oorspronkelijkbouwjaar);
  if (year !== null && year > TERRAIN_VINTAGE_YEAR) return { groundNapM: ground, source: '3dbag' };
  const roof = number(attributes.b3_h_dak_70p) ?? number(attributes.b3_h_dak_max);
  if (roof === null || roof - under < MIN_ROOF_ABOVE_TERRAIN_M) return { groundNapM: ground, source: '3dbag' };
  const around = number(sample.aroundMinNapM);
  if (around !== null && around <= ground + GROUND_REACH_M) return { groundNapM: ground, source: '3dbag' };
  return { groundNapM: under, source: 'terrain' };
}

/**
 * The one entry point for a pand's ground: `trustedGroundNap` on the terrain
 * read around its footprint ring (RD New). Without a terrain field or a ring
 * it is 3DBAG's own ground, so a caller that injects nothing is unchanged.
 */
export function pandGroundNap(
  attributes: Record<string, unknown>,
  terrainAt?: TerrainAt | null,
  ringRd?: readonly (readonly number[])[] | null
): { groundNapM: number | null; source: GroundSource; terrain: TerrainSample | null } {
  const terrain = terrainAt && ringRd?.length ? sampleTerrain(terrainAt, ringRd) : null;
  return { ...trustedGroundNap(attributes, terrain), terrain };
}

/**
 * The height to extrude a pand to.
 *
 * 3DBAG builds its own LoD1.2 by extruding to the 70th percentile of the roof
 * points, so `b3_h_dak_70p - b3_h_maaiveld` is not an approximation of the
 * official geometry — it is the official geometry's height. It sits below the
 * ridge and above the eave, which is what a flat top should do for a pitched
 * roof.
 *
 * The tower exception comes first: when the ridge stands far above the
 * percentile, the percentile is measuring the podium, not the building the
 * player recognises. Preferring the ridge there is what stops Zuidas from
 * collapsing into one slab.
 *
 * The two fallbacks exist because the same decision has to be made from the
 * hosted 3D Tiles, whose metadata publishes neither percentile. There,
 * `b3_volume_lod12 / b3_opp_grond` recovers the same number: measured over a
 * central Amsterdam tile it differs from the percentile by a median of 4 mm
 * (p05 −0.10 m, p95 +0.04 m). Agreement that close between an area-weighted
 * volume and a point-cloud percentile is the two sources describing one
 * extrusion, and it is why the tiles-only path is trustworthy.
 *
 * The ridge is otherwise last and reluctant. It is missing for every flat roof
 * by definition, and standing a flat top at the ridge of a steep canal house
 * overstates the whole row.
 *
 * Heights stand on `trustedGroundNap(attributes, terrain)`.
 */
export function bagHeightM(attributes: Record<string, unknown>, terrain?: number | TerrainSample | null): { heightM: number | null; source: BagHeightSource } {
  const ground = trustedGroundNap(attributes, terrain).groundNapM;
  const replaced = ground !== number(attributes.b3_h_maaiveld);
  const roof70 = number(attributes.b3_h_dak_70p);
  const ridge = number(attributes.b3_h_nok);
  const roof70h = roof70 !== null && ground !== null ? roof70 - ground : null;
  const ridgeH = ridge !== null && ground !== null ? ridge - ground : null;

  if (
    roof70h !== null && roof70h > 0 &&
    ridgeH !== null && ridgeH > 0 &&
    ridgeH - roof70h >= TOWER_PODIUM_GAP_M
  ) {
    return { heightM: ridgeH, source: 'ridge-tower' };
  }

  if (roof70h !== null && roof70h > 0) return { heightM: roof70h, source: 'roof-70p' };

  const volume = number(attributes.b3_volume_lod12);
  const area = number(attributes.b3_opp_grond);
  // The LoD1.2 volume was extruded from 3DBAG's own ground, so it is no fallback once that ground is replaced.
  if (!replaced && volume !== null && area !== null && area > 0 && volume / area > 0) return { heightM: volume / area, source: 'lod12-volume' };

  if (ridgeH !== null && ridgeH > 0) return { heightM: ridgeH, source: 'ridge' };

  return { heightM: null, source: 'none' };
}

/** Decode a LoD0 MultiSurface into closed WGS84 rings, outer ring first. */
function footprintRings(geometry: Geometry[] | undefined, vertices: [number, number][]): Ring[] {
  const lod0 = geometry?.find(part => part.lod === '0' && part.type === 'MultiSurface');
  if (!lod0) return [];
  const surfaces = lod0.boundaries as number[][][];
  const rings: Ring[] = [];
  for (const surface of surfaces ?? []) {
    for (const ring of surface ?? []) {
      const points = ring.map(index => vertices[index]).filter(Boolean);
      if (points.length < 3) continue;
      const closed: Ring = [...points];
      const [firstLng, firstLat] = closed[0];
      const [lastLng, lastLat] = closed[closed.length - 1];
      if (firstLng !== lastLng || firstLat !== lastLat) closed.push([firstLng, firstLat]);
      rings.push(closed);
    }
  }
  return rings;
}

/** The LoD0 outer ring in RD New metres, as stored (open), or null without a footprint. */
function footprintRingRd(geometry: Geometry[] | undefined, rd: (index: number) => [number, number] | undefined): [number, number][] | null {
  const lod0 = geometry?.find(part => part.lod === '0' && part.type === 'MultiSurface');
  const ring = ((lod0?.boundaries as number[][][] | undefined)?.[0]?.[0] ?? []).map(rd).filter((p): p is [number, number] => !!p);
  return ring.length ? ring : null;
}

/**
 * Place the tower of a ridge-tower pand from its `BuildingPart` LoD1.3 roof
 * faces (`splitTowerPodium`), or null when the tower covers most of the pand
 * or cannot be located — those keep the ridge over the whole footprint.
 */
export function towerSplitOf(city: CityJson, object: CityObject, attributes: Record<string, unknown>, groundNapM: number, ridgeM: number): BagTower | null {
  const roof70 = number(attributes.b3_h_dak_70p);
  if (roof70 === null) return null;
  const { scale, translate } = city.transform;
  const rd = (index: number): [number, number, number] | undefined => {
    const v = city.vertices[index];
    return v ? [v[0] * scale[0] + translate[0], v[1] * scale[1] + translate[1], v[2] * scale[2] + translate[2]] : undefined;
  };
  const lod0 = object.geometry?.find(part => part.lod === '0' && part.type === 'MultiSurface');
  const footprintAreaM2 = ((lod0?.boundaries as number[][][] | undefined) ?? [])
    .reduce((sum, surface) => sum + polygonAreaM2(surface.map(ring => ring.map(rd).filter((p): p is [number, number, number] => !!p).map(([x, y]) => [x, y] as [number, number]))), 0);
  const faces = lod13RoofFaces(city.CityObjects, object, rd, groundNapM);
  const split = splitTowerPodium({ podiumM: roof70 - groundNapM, ridgeM, footprintAreaM2, faces });
  if (split.kind !== 'split') return null;
  const toLngLat = (polygon: RdPolygon): Ring[] => polygon.map(ring => ring.map(([x, y]) => rdToLngLat(x, y)));
  return { polygons: split.polygons.map(toLngLat), minHeightM: split.podiumM, heightM: split.towerM, areaM2: split.towerAreaM2, tallShare: split.tallShare };
}

/** Every `Building` in one CityJSON tile, with its footprint already in WGS84. `terrainAt` lets heights reject a failed 3DBAG ground. */
export function readBagBuildings(city: CityJson, terrainAt?: TerrainAt): BagBuilding[] {
  const { scale, translate } = city.transform;
  // Project once per vertex rather than once per ring reference: vertices are
  // shared between a footprint and its solids, and the polynomial is the
  // expensive part of this loop.
  const vertices: [number, number][] = city.vertices.map(([x, y]) =>
    rdToLngLat(x * scale[0] + translate[0], y * scale[1] + translate[1])
  );

  const buildings: BagBuilding[] = [];
  for (const object of Object.values(city.CityObjects)) {
    if (object.type !== 'Building') continue;
    const attributes = object.attributes ?? {};
    const bagId = text(attributes.identificatie);
    if (!bagId) continue;
    const rings = footprintRings(object.geometry, vertices);
    if (rings.length === 0) continue;

    const ringRd = terrainAt ? footprintRingRd(object.geometry, index => {
      const v = city.vertices[index];
      return v ? [v[0] * scale[0] + translate[0], v[1] * scale[1] + translate[1]] : undefined;
    }) : null;
    const { groundNapM: ground, terrain } = pandGroundNap(attributes, terrainAt, ringRd);
    const ridge = number(attributes.b3_h_nok);
    let { heightM, source } = bagHeightM(attributes, terrain);
    let tower: BagTower | null = null;
    if (source === 'ridge-tower' && heightM !== null && ground !== null) {
      const split = towerSplitOf(city, object, attributes, ground, heightM);
      if (split) { tower = split; heightM = split.minHeightM; source = 'tower-podium'; }
    }
    const roofMin = number(attributes.b3_h_dak_min);
    buildings.push({
      bagId,
      rings,
      heightM,
      heightSource: source,
      tower,
      groundNapM: ground,
      ridgeM: ridge !== null && ground !== null && ridge - ground > 0 ? ridge - ground : null,
      eavesM: roofMin !== null && ground !== null && roofMin - ground > 0 ? roofMin - ground : null,
      roofType: text(attributes.b3_dak_type),
      constructionYear: number(attributes.oorspronkelijkbouwjaar),
      storeys: number(attributes.b3_bouwlagen),
      partyWallAreaM2: number(attributes.b3_opp_scheidingsmuur),
      groundAreaM2: number(attributes.b3_opp_grond),
      rmseLod22: number(attributes.b3_rmse_lod22),
      status: text(attributes.status)
    });
  }
  return buildings;
}
