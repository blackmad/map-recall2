/**
 * Kadaster's 3D Basisvoorziening (PDOK) as a fallback for the 3DBAG API.
 *
 * PDOK publishes the same TU Delft LoD1.2/1.3/2.2 reconstruction (CC BY 4.0) as whole 2 km tiles ("blades") of
 * CityJSON 2.0: one `transform`, one `vertices` array, `CityObjects` keyed `NL.IMBAG.Pand.<16 digits>` (Building,
 * LoD0 MultiSurface footprint, BAG attributes) and `NL.IMBAG.Pand.<id>-0` (BuildingPart, LoD1.2/1.3/2.2 Solids
 * with RoofSurface/WallSurface/GroundSurface semantics). The reconstruction attributes are named `rf_*` (the
 * "roofer" pipeline) where the 3DBAG API says `b3_*`, and the BAG fields keep their camelCase spelling.
 *
 * `cityObjectToFeature` cuts one pand out of a tile into the 3DBAG API's per-pand `CityJsonItem` shape, renaming
 * attributes onto the 3DBAG names `buildFacts` reads, so the facts step runs unchanged on either source.
 */
import type {CityJsonItem} from './facts.ts';

export interface CityJsonTile {
  type: 'CityJSON';
  version: string;
  transform: {scale: number[]; translate: number[]};
  CityObjects: CityJsonItem['feature']['CityObjects'];
  vertices: number[][];
  metadata?: Record<string, unknown>;
}

/** PDOK blades are 2 km RD squares named by their south-west corner (years 2021 onward). */
export const BLADE_M = 2000;
export function bladeFor(rdX: number, rdY: number): string {
  return `${Math.floor(rdX / BLADE_M) * BLADE_M}_${Math.floor(rdY / BLADE_M) * BLADE_M}`;
}
/** RD bounds [minX, minY, maxX, maxY] of a blade name. */
export function bladeBounds(blade: string): [number, number, number, number] {
  const m = /^(\d+)_(\d+)$/.exec(blade);
  if (!m) throw Error(`Not a 2 km blade name: ${blade}`);
  const x = Number(m[1]), y = Number(m[2]);
  return [x, y, x + BLADE_M, y + BLADE_M];
}

/** Building-level attributes: 3DBAG API name ← PDOK name. Values copied as-is unless noted in `convert`. */
export const BUILDING_ATTRIBUTE_MAP: Record<string, string> = {
  b3_h_maaiveld: 'rf_h_ground',
  b3_h_dak_max: 'rf_roof_elevation_max',
  b3_h_dak_min: 'rf_roof_elevation_min',
  b3_h_dak_50p: 'rf_roof_elevation_50p',
  b3_h_dak_70p: 'rf_roof_elevation_70p',
  b3_h_nok: 'rf_h_roof_ridge',
  b3_n_nok: 'rf_ridgelines',
  b3_n_vlakken: 'rf_roof_n_planes',
  b3_dak_type: 'rf_roof_type',
  b3_extrusie: 'rf_extrusion_mode',
  b3_is_glas_dak: 'rf_is_glass_roof',
  b3_rmse_lod12: 'rf_rmse_lod12',
  b3_rmse_lod13: 'rf_rmse_lod13',
  b3_rmse_lod22: 'rf_rmse_lod22',
  b3_volume_lod12: 'rf_volume_lod12',
  b3_volume_lod13: 'rf_volume_lod13',
  b3_volume_lod22: 'rf_volume_lod22',
  b3_pw_bron: 'rf_pc_source',
  b3_pw_datum: 'rf_pc_year',
  b3_pw_selectie_reden: 'rf_pc_select',
  b3_pw_onvoldoende: 'rf_pointcloud_unusable',
  b3_t_run: 'rf_reconstruction_time',
  b3_puntdichtheid_ahn5: 'rf_pt_density_AHN5',
  b3_nodata_fractie_ahn5: 'rf_nodata_frac_AHN5',
  b3_nodata_radius_ahn5: 'rf_nodata_r_AHN5',
};
/** 3DBAG API attributes with no PDOK counterpart; left absent (readers treat them as unknown). */
export const UNMAPPED_3DBAG_ATTRIBUTES = [
  'b3_bouwlagen', 'b3_opp_grond', 'b3_opp_dak_plat', 'b3_opp_dak_schuin', 'b3_opp_buitenmuur', 'b3_opp_scheidingsmuur',
  'b3_kwaliteitsindicator', 'b3_kas_warenhuis', 'b3_bag_bag_overlap', 'b3_mutatie_ahn3_ahn4', 'b3_mutatie_ahn4_ahn5',
  'b3_val3dity_lod12', 'b3_val3dity_lod13', 'b3_val3dity_lod22',
  'b3_puntdichtheid_ahn3', 'b3_puntdichtheid_ahn4', 'b3_nodata_fractie_ahn3', 'b3_nodata_fractie_ahn4',
  'b3_nodata_radius_ahn3', 'b3_nodata_radius_ahn4', 'fid',
] as const;
/** Per-surface semantic attributes (LoD1.2/1.3/2.2 RoofSurface): 3DBAG API name ← PDOK name. */
export const SURFACE_ATTRIBUTE_MAP: Record<string, string> = {
  b3_h_dak_max: 'rf_roof_elevation_max',
  b3_h_dak_min: 'rf_roof_elevation_min',
  b3_h_dak_50p: 'rf_roof_elevation_50p',
  b3_h_dak_70p: 'rf_roof_elevation_70p',
  b3_azimut: 'rf_azimuth',
  b3_hellingshoek: 'rf_slope',
};

const BAG_DATE = /^(\d{4})\/(\d{2})\/(\d{2})(?: (\d{2}:\d{2}:\d{2})(?:\.\d+)?)?$/;
/** PDOK writes BAG dates as `2010/11/04 16:55:13.348`; the 3DBAG API as `2010-11-04T16:55:13Z`. */
function bagDate(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  const m = BAG_DATE.exec(v);
  return m ? (m[4] ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}Z` : `${m[1]}-${m[2]}-${m[3]}`) : v;
}

/**
 * PDOK Building attributes renamed onto the 3DBAG API spelling: `rf_*` per `BUILDING_ATTRIBUTE_MAP`, BAG fields
 * lower-cased (`oorspronkelijkBouwjaar` → `oorspronkelijkbouwjaar`) with ISO dates, `geconstateerd` as a boolean.
 * Reconstruction fields with no 3DBAG name keep their `rf_*` name so nothing is lost.
 */
export function mapBuildingAttributes(pdok: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const mapped = new Set(Object.values(BUILDING_ATTRIBUTE_MAP));
  for (const [b3, rf] of Object.entries(BUILDING_ATTRIBUTE_MAP)) if (rf in pdok) out[b3] = pdok[rf];
  if (typeof out.b3_pw_bron === 'string') out.b3_pw_bron = out.b3_pw_bron.toLowerCase();
  for (const [k, v] of Object.entries(pdok)) {
    if (mapped.has(k)) continue;
    if (k.startsWith('rf_')) { out[k] = v; continue; }
    const key = k.toLowerCase();
    out[key] = key === 'geconstateerd' ? (v === true || v === '1' || v === 'J') : bagDate(v);
  }
  return out;
}

function mapSurface(s: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const mapped = new Set(Object.values(SURFACE_ATTRIBUTE_MAP));
  for (const [k, v] of Object.entries(s)) if (!mapped.has(k)) out[k] = v;
  for (const [b3, rf] of Object.entries(SURFACE_ATTRIBUTE_MAP)) if (rf in s) out[b3] = s[rf];
  return out;
}

export const pandKey = (pandId: string) => pandId.startsWith('NL.IMBAG.Pand.') ? pandId : `NL.IMBAG.Pand.${pandId}`;

function remapIndices(b: unknown, map: (k: number) => number): unknown {
  return Array.isArray(b) ? b.map(x => remapIndices(x, map)) : map(b as number);
}

/**
 * One pand cut out of a PDOK tile in the 3DBAG API item shape: the Building and its children, only the vertices
 * they use (re-indexed, still quantised under the tile's transform), attributes renamed onto the 3DBAG names.
 * Returns null when the tile does not hold the pand.
 */
export function cityObjectToFeature(tile: CityJsonTile, pandId: string): CityJsonItem & {id: string} | null {
  const key = pandKey(pandId), building = tile.CityObjects[key];
  if (!building) return null;
  const ids = [key, ...(((building as {children?: string[]}).children) ?? [])];
  const remap = new Map<number, number>(), vertices: number[][] = [];
  const index = (k: number) => {
    let n = remap.get(k);
    if (n === undefined) { n = vertices.length; remap.set(k, n); vertices.push(tile.vertices[k]); }
    return n;
  };
  const CityObjects: CityJsonItem['feature']['CityObjects'] = {};
  for (const id of ids) {
    const o = tile.CityObjects[id] as CityJsonItem['feature']['CityObjects'][string] & Record<string, unknown>;
    if (!o) continue;
    const copy: Record<string, unknown> = {...o};
    if (o.attributes) copy.attributes = o.type === 'Building' ? mapBuildingAttributes(o.attributes) : {...o.attributes};
    if (o.geometry) copy.geometry = o.geometry.map(g => ({
      ...g,
      boundaries: remapIndices(g.boundaries, index),
      ...(g.semantics ? {semantics: {...g.semantics, surfaces: g.semantics.surfaces.map(s => mapSurface(s as Record<string, unknown>))}} : {}),
    }));
    CityObjects[id] = copy as CityJsonItem['feature']['CityObjects'][string];
  }
  const referenceSystem = (tile.metadata as {referenceSystem?: string} | undefined)?.referenceSystem;
  const item = {id: key, feature: {type: 'CityJSONFeature', id: key, CityObjects, vertices}, metadata: {transform: tile.transform, referenceSystem}};
  return item;
}

/** Every Building in a tile whose LoD0 footprint has a vertex within `radiusM` of an RD point: pand ids. */
export function pandsNear(tile: CityJsonTile, x: number, y: number, radiusM: number): string[] {
  const t = tile.transform, out: string[] = [];
  for (const [id, o] of Object.entries(tile.CityObjects)) {
    if (o.type !== 'Building') continue;
    const lod0 = o.geometry?.find(g => String(g.lod) === '0');
    if (!lod0) continue;
    const near = (lod0.boundaries as number[][][]).some(s => s.some(r => r.some(k => {
      const v = tile.vertices[k];
      return Math.hypot(v[0] * t.scale[0] + t.translate[0] - x, v[1] * t.scale[1] + t.translate[1] - y) <= radiusM;
    })));
    if (near) out.push(id.replace('NL.IMBAG.Pand.', ''));
  }
  return out;
}
