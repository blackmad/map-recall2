import {envelopeFootprintFingerprint} from './surveyedBuildingEnvelope.js';
import type {SurveyedMeshBinding} from './surveyedEnvelopeMeshBinding.js';
// Streamed building features -> mesh buildings -> a chunk, for the three.js building layer.
// CPU only (no DOM), so it runs in the chunk worker as well as on the main thread.

import type { ChunkHostOpeningConfig } from './hostWallOpenings.js';
import { CELL_LAYER_COUNT, STYLE_DIMS, cellLayer } from './facadeCells.js';
import { ROOF_CELL_M } from './roofCells.js';
import { roofPlanForFeature, type RoofPlan } from './roofMesh.js';
import { sourceVisualRoof } from './sourceVisualRoof.js';
import { BAY_LAYER_COUNT, BAY_STYLES, FATIH_MASONRY_LAYER, bayLayer, bayLookFor } from './bayLook.js';
import { paletteFor } from './bayTextures.js';
import { lookHex } from './landmarkFronts.js';
import { largeTierSystem } from './largeBuildingTier.js';
import type { Look, ShopKind } from './bayTextures.js';
import { buildChunk, lookVariant, wallTopHeightM, type Chunk, type MeshBuilding } from './threeBuildingMesh.js';
import { FACADE_STYLES, type FacadeStyle } from './genericFacades.js';
import { profilesNearBuilding } from './streetFacadeRendering.js';
import { bayVariantOpenings, proceduralOpenings } from './facadeOpenings.js';
import type { StreetAppearanceProfile } from './streetAppearance.js';
import { SUPERMARKET_CHAINS } from './shopfronts.js';
import { appendAllotmentHouses, isAllotmentHouse } from './allotmentHouses.js';

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

/**
 * The large-building tier (largeBuildingTier.ts): a civic facade system from the shared cells,
 * civic storey heights, one entrance per street run, a parapet band, no shopfront guesses.
 */
function applyLargeTier(building: MeshBuilding, p: Record<string, unknown>, look: BuildingLook, id: string): void {
  const wall = typeof p.largeTierWall === 'string' ? p.largeTierWall : building.wallHex;
  const archetype = (['c19', 'school', 'modern'] as const).find(a => a === p.largeTier) ?? 'modern';
  const system = largeTierSystem(id, archetype, wall, Number(p.height) || building.heightM);
  const set = cellSetOf(look);
  const nominal = STYLE_DIMS[set === 'procedural' ? building.style : system.layout];
  if (set !== 'procedural') {
    const bayLook = set as Look;
    building.style = system.layout;
    building.layers = { upper: bayLayer(system.archetype, system.style, 'upper'), ground: bayLayer(system.archetype, system.style, 'ground'), door: bayLayer(system.archetype, system.style, 'groundDoor') };
    building.plainLayer = bayLayer(system.archetype, system.style, 'plain');
    building.openings = bayVariantOpenings({ archetype: system.archetype, kind: 'upper', ...BAY_STYLES[system.archetype][system.style] }, bayLook);
    building.accentHex = paletteFor(id, system.archetype, bayLook).accent;
    building.wallHex = lookHex(wall, bayLook);
    building.groundHex = undefined;
  } else building.wallHex = wall;
  building.shop = false;
  building.layoutScale = { bay: system.bayM / nominal.bay, storey: system.storeyM / nominal.storey, ground: system.groundM / nominal.ground, doorEvery: 1000 };
  building.parapetM = system.parapetM;
}

export function meshBuildingFor(feature: Feature, look: BuildingLook, coarse = false, sourceRoofPlan?: RoofPlan): MeshBuilding | null {
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
    building.openings = bayVariantOpenings({ ...bay.variant, kind: 'upper' }, look as Look);
    plain = bay.plain; roofBase = BAY_LAYER_COUNT; layout = bay.layout; building.plainLayer = bay.plain;
    if ((FACADE_STYLES as readonly string[]).includes(String(p.facadeStyle)) && p.facadeStyle !== bay.layout) building.period = p.facadeStyle as FacadeStyle;
  } else {
    layout = (FACADE_STYLES as readonly string[]).includes(String(p.facadeStyle)) ? p.facadeStyle as FacadeStyle : 'c19';
    building = { id, polygons, heightM, minHeightM, style: layout, wallHex: typeof p.sideColour === 'string' ? p.sideColour : '#a4523b', shop: layout !== 'tower' && (shopfrontOf(p) ? shopfrontOf(p) !== 'quiet' : hashShop(id)) };
    building.openings = proceduralOpenings(layout);
    plain = cellLayer(layout, 'plain', lookVariant(id)); roofBase = CELL_LAYER_COUNT; building.plainLayer = plain;
  }
  // A sourced hex color survives PHOTO decoration; material-only hues remain explicitly display priors.
  if (look === 'photo') {
    const sourced = [p.facadeMappedColour, p.sideColourSource === 'measured-accepted' ? p.sideColour : undefined, p.facadeMaterialColourPrior].find(v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v));
    if (sourced) building.wallHex = String(sourced);
  }
  const front = shopfrontOf(p);
  building.shopfront = front ? front !== 'quiet' : false;
  // A named business's own colour goes on its sign and awning (the cells' accent), and a
  // labelled business gets its signature storefront.
  if (building.shopfront && typeof p.shopColour === 'string') building.accentHex = p.shopColour;
  // A hand-modelled front (frontCarrier) replaces the generated signature.
  if (building.shopfront && Array.isArray(p.shopSignature) && !p.frontCarrier) building.signature = { at: p.shopSignature as [number, number], hex: typeof p.shopColour === 'string' ? p.shopColour : '#1f4d3a' };
  // A chain supermarket: its own fascia, logo panel and brand word (shopfronts.ts SUPERMARKET_CHAINS).
  const chain = Array.isArray(p.shopChain) ? p.shopChain as [string, number, number] : null;
  if (building.shopfront && chain && SUPERMARKET_CHAINS[chain[0]] && !p.frontCarrier) building.chain = { at: [chain[1], chain[2]], look: SUPERMARKET_CHAINS[chain[0]] };
  if (p.largeTier && typeof p.facade === 'string') applyLargeTier(building, p, look, id);
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
    if (id === 'NL.IMBAG.Pand.0363100012167944' && look === 'photo') building.plainLayer = FATIH_MASONRY_LAYER;
    if (p.kitWall === 'flat') { building.bare = true; building.plainLayer = roofBase + 3; }
  }
  if (p.roofPlanned && !coarse) {
    // The decorator's own plan, recomputed from the same feature (pure), so the two agree.
    const plan = sourceRoofPlan ?? roofPlanForFeature(feature);
    if (plan) {
      const dims = STYLE_DIMS[layout];
      building.roof = { plan, roofHex: roofHexFor(look, plan), dims: { bayM: dims.bay, storeyM: dims.storey, cellM: ROOF_CELL_M },
        layers: { slope: roofBase + (plan.material === 'tile' ? 0 : 1), plain, dormer: roofBase + 2 } };
      if(plan.repeatedTerrace){
        // One observed material family also owns exposed returns and roof-side closures.
        building.wallHex=plan.repeatedTerrace.wallHex??building.wallHex;
        building.shop=false;building.shopfront=false;building.signature=undefined;building.chain=undefined;
      }
    }
  }
  // Facade extras for every faced building; the plain and Untextured looks stay light.
  // Never on a landmark kit's walls: church hosts drew hoist beams and stray strips (user 2026-10-03).
  building.extras = !building.bare && !p.kitWall && !p.largeTier && look !== 'untextured';
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
export function buildFeatureChunk(features: readonly Feature[], look: BuildingLook, mode: 'walls' | 'extras' | 'coarse' = 'walls', streets?: Float32Array, profiles: readonly StreetAppearanceProfile[] = [], contextFeatures: readonly Feature[] = [], hostOpenings: readonly ChunkHostOpeningConfig[] = [], surveyedEnvelopes: ReadonlyMap<string,SurveyedMeshBinding> = new Map()): Chunk {
  const garden = features.filter(isAllotmentHouse);
  const chunk = buildChunk(features.filter(f => !isAllotmentHouse(f)).map(f => {
    const visualRoof = mode !== 'coarse' && profiles.length ? sourceVisualRoof(f, profiles) : undefined;
    const building = meshBuildingFor(visualRoof?.feature ?? f, look, mode === 'coarse', visualRoof?.plan);
    if(building){
      const binding=surveyedEnvelopes.get(building.id),geometry=f.geometry as {type?:string;coordinates?:number[][][]};
      if(binding&&binding.nativeParentId===building.id&&geometry.type==='Polygon'&&binding.installedFootprintFingerprint===envelopeFootprintFingerprint(geometry as {type:'Polygon';coordinates:number[][][]})&&binding.nativeMetadata.aggregateHeightM===Number(f.properties.height)&&binding.nativeMetadata.constructionYear===Number(f.properties.constructionYear)&&binding.meshOrigin.lng===ORIGIN.lng&&binding.meshOrigin.lat===ORIGIN.lat)building.surveyedEnvelope=binding;
    }
    if (building && mode === 'coarse') {
      // Keep textured windows and ground-floor doors at every distance. Simplify
      // roofs and omit relief; a plain shell made normal street views look empty.
      // A church host's raw maximum can be its towers. Its semantic kit eaves
      // must survive coarse LOD or a full-height capped shell buries the roof.
      building.heightM = f.properties.kitRoof ? wallTopHeightM(f.properties) : Number(f.properties.height) || building.heightM;
      building.roof = undefined;
      building.extras = false;
      // Continue into local facade context below: coarse LOD drops relief and
      // shaped roofs, while its existing cheap window cells keep the street rhythm.
    }
    if (building && profiles.length && look !== 'untextured' && !f.properties.kitWall && !f.properties.frontCarrier && !f.properties.largeTier) {
      const localProfiles = profilesNearBuilding(profiles, building.polygons);
      if (!localProfiles.length) return building;
      const p = f.properties;
      const sourcedWall = [p.facadeMappedColour, p.sideColourSource === 'measured-accepted' ? p.sideColour : undefined].find(value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value));
      const mappedWallHex = look === 'photo' ? sourcedWall as string | undefined : undefined;
      building.streetAppearance = { profiles: localProfiles, look, sourceHeightM: Number(f.properties.height) || building.heightM, year: p.constructionYear == null || !Number.isFinite(Number(p.constructionYear)) ? null : Number(p.constructionYear), mappedWallHex, shopfront: shopfrontOf(p) };
    }
    return building;
  }).filter((b): b is MeshBuilding => !!b), ORIGIN, mode === 'coarse' ? 'walls' : mode, streets, contextFeatures.map(f=>{const b=meshBuildingFor(f,look,mode==='coarse');if(b){const binding=surveyedEnvelopes.get(b.id),g=f.geometry as {type?:string;coordinates?:number[][][]};if(binding&&binding.nativeParentId===b.id&&g.type==='Polygon'&&binding.installedFootprintFingerprint===envelopeFootprintFingerprint(g as {type:'Polygon';coordinates:number[][][]})&&binding.nativeMetadata.aggregateHeightM===Number(f.properties.height)&&binding.nativeMetadata.constructionYear===Number(f.properties.constructionYear)&&binding.meshOrigin.lng===ORIGIN.lng&&binding.meshOrigin.lat===ORIGIN.lat)b.surveyedEnvelope=binding;}if(b&&mode==='coarse'){b.heightM=f.properties.kitRoof?wallTopHeightM(f.properties):Number(f.properties.height)||b.heightM;b.roof=undefined;}return b;}).filter((b):b is MeshBuilding=>!!b), hostOpenings);
  if (!garden.length || mode === 'extras') return chunk;
  const flatLayer = (cellSetOf(look) === 'procedural' ? CELL_LAYER_COUNT : BAY_LAYER_COUNT) + 3;
  return appendAllotmentHouses(chunk, garden, ORIGIN, flatLayer, mode === 'coarse');
}
