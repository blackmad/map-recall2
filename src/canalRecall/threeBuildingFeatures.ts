// Streamed building features -> mesh buildings -> a chunk, for the three.js building layer.
// Pure (no DOM, no three), so it runs in the chunk worker as well as on the main thread.

import { CELL_LAYER_COUNT, STYLE_DIMS, cellLayer } from './facadeCells.js';
import { ROOF_CELL_M } from './roofCells.js';
import { fitRect, localOuterRing, planRoof, type RoofPlan } from './roofMesh.js';
import { BAY_LAYER_COUNT, bayLookFor } from './bayLook.js';
import type { Look, ShopKind } from './bayTextures.js';
import { buildChunk, lookVariant, wallTopHeightM, type Chunk, type MeshBuilding } from './threeBuildingMesh.js';
import { FACADE_STYLES, type FacadeStyle } from './genericFacades.js';

/** 'untextured' draws with the procedural cells' flat layer only: plain colours, real shapes. */
export type BuildingLook = 'procedural' | 'untextured' | Look;
/** The shopfront the decorator stamped (`shopKind`, or `shopQuiet` for none); undefined without the extract. */
const shopfrontOf = (p: Record<string, unknown>): ShopKind | 'quiet' | undefined =>
  typeof p.shopKind === 'string' ? p.shopKind as ShopKind : p.shopQuiet ? 'quiet' : undefined;
/** The texture set a look draws from. */
export const cellSetOf = (look: BuildingLook): 'procedural' | Look => (look === 'untextured' ? 'procedural' : look);
export type Feature = { type: 'Feature'; properties: Record<string, unknown>; geometry: unknown };
/** One fixed origin for the whole city: float32 metres stay sub-millimetre within 10 km. */
export const ORIGIN = { lng: 4.9, lat: 52.37 };

const hashShop = (id: string) => { let h = 2166136261; for (const c of `${id}:shop`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296 < 0.3; };

export const asPolygons = (geometry: unknown): number[][][][] => {
  const g = geometry as { type?: string; coordinates?: unknown } | null;
  if (!g || !g.coordinates) return [];
  return g.type === 'Polygon' ? [g.coordinates as number[][][]] : g.type === 'MultiPolygon' ? g.coordinates as number[][][][] : [];
};

/** Wall colour for a building with no facade and no mapped colour (MapLibre's neutral building colour). */
const BARE_WALL_HEX = '#c9bfae';
const FLAT_ROOF_GREYS = ['#8f8a83', '#9a958c', '#85817c', '#a09789'];

/** Roof colours per look: pantile and slate (a look's own tones, picked by the plan's `tone`). */
export const ROOF_TONES: Record<BuildingLook, { tile: string[]; slate: string[] }> = {
  procedural: { tile: ['#b5543a', '#a8482f', '#c0603f', '#9c4a35'], slate: ['#4b525c', '#3f464f', '#5a6068'] },
  untextured: { tile: ['#b5543a', '#a8482f', '#c0603f', '#9c4a35'], slate: ['#4b525c', '#3f464f', '#5a6068'] },
  photo: { tile: ['#b5543a', '#a8482f', '#c0603f', '#9c4a35'], slate: ['#4b525c', '#3f464f', '#5a6068'] },
  storybook: { tile: ['#b9553a', '#a94a33', '#c46a45'], slate: ['#556070', '#4a5666', '#657282'] },
  cartoon: { tile: ['#e85a3c', '#f08a2b', '#d94a3a'], slate: ['#3f5f8f', '#2f4a78', '#4f7bb0'] },
};
const roofHexFor = (look: BuildingLook, plan: RoofPlan) => { const set = ROOF_TONES[look][plan.material]; return set[Math.min(set.length - 1, Math.floor(plan.tone * set.length))]; };

export function meshBuildingFor(feature: Feature, look: BuildingLook): MeshBuilding | null {
  const p = feature.properties;
  const polygons = asPolygons(feature.geometry);
  const minHeightM = Number(p.minHeight) || 0;
  const heightM = wallTopHeightM(p);
  if (!polygons.length || !Number.isFinite(heightM)) return null;
  const id = String(p.id ?? '');
  let building: MeshBuilding;
  let plain: number, roofBase: number, layout: FacadeStyle;
  if (cellSetOf(look) !== 'procedural') {
    const year = p.constructionYear === null || p.constructionYear === undefined || !Number.isFinite(Number(p.constructionYear)) ? null : Number(p.constructionYear);
    const bay = bayLookFor(id, year, Number(p.height) || heightM, look as Look, shopfrontOf(p));
    building = { id, polygons, heightM, minHeightM, style: bay.layout, wallHex: bay.wallHex, accentHex: bay.accentHex, layers: bay.layers, groundHex: bay.groundHex };
    plain = bay.plain; roofBase = BAY_LAYER_COUNT; layout = bay.layout; building.plainLayer = bay.plain;
  } else {
    layout = (FACADE_STYLES as readonly string[]).includes(String(p.facadeStyle)) ? p.facadeStyle as FacadeStyle : 'c19';
    building = { id, polygons, heightM, minHeightM, style: layout, wallHex: typeof p.sideColour === 'string' ? p.sideColour : '#a4523b', shop: layout !== 'tower' && (shopfrontOf(p) ? shopfrontOf(p) !== 'quiet' : hashShop(id)) };
    plain = cellLayer(layout, 'plain', lookVariant(id)); roofBase = CELL_LAYER_COUNT; building.plainLayer = plain;
  }
  const front = shopfrontOf(p);
  building.shopfront = front ? front !== 'quiet' : false;
  // A named business's own colour goes on its sign and awning (the cells' accent), and a
  // labelled business gets its signature storefront.
  if (building.shopfront && typeof p.shopColour === 'string') building.accentHex = p.shopColour;
  // A hand-modelled front (frontCarrier) replaces the generated signature.
  if (building.shopfront && Array.isArray(p.shopSignature) && !p.frontCarrier) building.signature = { at: p.shopSignature as [number, number], hex: typeof p.shopColour === 'string' ? p.shopColour : '#1f4d3a' };
  if (typeof p.facade !== 'string' || !p.facadeStyle) {
    // No facade (a shed, a landmark part, a building with no style or colour): bare walls in its mapped colour.
    building.bare = true;
    const mappedWall = [p.sideColour, p.colour, p.color].find(v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) as string | undefined;
    building.wallHex = mappedWall ?? BARE_WALL_HEX;
  }
  // The mesh owns the top: walls to full height and, for a flat roof, a lid in the mapped roof
  // colour (or a neutral bitumen/gravel grey when the roof colour just repeats the wall's).
  const mapped = typeof p.roofColour === 'string' && p.roofColour !== p.colour ? p.roofColour : null;
  building.lid = { hex: mapped ?? FLAT_ROOF_GREYS[lookVariant(id) % FLAT_ROOF_GREYS.length], flatLayer: roofBase + 3 };
  if (p.kitWall) {
    // A landmark kit's walls: its own stone or brick colour, bare or in a window grid.
    building.wallHex = String(p.kitWallHex ?? building.wallHex);
    building.plainWalls = p.kitWall === 'plain' || p.kitWall === 'flat';
    if (p.kitWall === 'flat') { building.bare = true; building.plainLayer = roofBase + 3; }
  }
  if (p.roofPlanned) {
    const ring = localOuterRing(feature.geometry);
    const plan = ring ? planRoof(id, String(p.facadeStyle ?? ''), Number(p.height), minHeightM, fitRect(ring)) : null;
    if (plan) {
      const dims = STYLE_DIMS[layout];
      building.roof = { plan, roofHex: roofHexFor(look, plan), dims: { bayM: dims.bay, storeyM: dims.storey, cellM: ROOF_CELL_M },
        layers: { slope: roofBase + (plan.material === 'tile' ? 0 : 1), plain, dormer: roofBase + 2 } };
    }
  }
  // Facade extras for every faced building; the plain and Untextured looks stay light.
  building.extras = !building.bare && look !== 'untextured';
  if (look === 'untextured') {
    // Untextured: one flat layer for every wall and roof face, so only colour and shape remain.
    const flat = roofBase + 3;
    building.bare = true; building.plainLayer = flat;
    if (building.roof) building.roof = { ...building.roof, layers: { slope: flat, plain: flat, dormer: flat } };
  }
  return building;
}


/** A chunk for a group of streamed features in one look. */
/** `streets`: flat street segments near the chunk, metres from ORIGIN (streetFronts.ts); doors then go only on the street side. */
export function buildFeatureChunk(features: readonly Feature[], look: BuildingLook, mode: 'walls' | 'extras' = 'walls', streets?: Float32Array): Chunk {
  return buildChunk(features.map(f => meshBuildingFor(f, look)).filter((b): b is MeshBuilding => !!b), ORIGIN, mode, streets);
}
