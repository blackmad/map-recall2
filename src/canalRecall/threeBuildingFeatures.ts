import { groundFloorOf, groundFloorOn } from './groundFloor/extract.js';
import { logoFor, retailLogoLayer } from './retailLogos.js';
import { CHAIN_LOGO_BASE, GOODS_BASE, TYPE_BASE, VARIETY_BASE, retailBrandOn, retailPartsOn, retailRealOn } from './retailPages.js';
import { shopVarietyOn } from './shopVariety.js';
import { BRAND_STYLES } from './retailBrandStyles.js';
import { RETAIL_CHAINS, chainOfWord, chainOwnFront } from './retailChains.js';
import { templateLogoKey, chainLogo } from './retailChainLogos.js';
import {envelopeFootprintFingerprint} from './surveyedBuildingEnvelope.js';
import { structurePriorOn, STRUCTURE_PRIOR_TABLE } from './houseSpec/structurePrior.js';
import type { StoopIntent } from './buildingRecipe/stoop.ts';
import type {SurveyedMeshBinding} from './surveyedEnvelopeMeshBinding.js';
// Streamed building features -> mesh buildings -> a chunk, for the three.js building layer.
// CPU only (no DOM), so it runs in the chunk worker as well as on the main thread.

import type { ChunkHostOpeningConfig } from './hostWallOpenings.js';
import { CELL_LAYER_COUNT, STYLE_DIMS, cellLayer } from './facadeCells.js';
import { ROOF_CELL_M } from './roofCells.js';
import { designUnitOf } from './designUnits/drawProps.js';
import { replanTerraceRoof, roofPlanForFeature, roofTrianglesForOutline, roofTrianglesForOutlineUncut, type RoofDims, type RoofPlan } from './roofMesh.js';
import { sourceVisualRoof } from './sourceVisualRoof.js';
import { BAY_LAYER_COUNT, BAY_STYLES, FATIH_MASONRY_LAYER, bayLayer, bayLookFor } from './bayLook.js';
import { ROW_FRONT_EXTRAS, rowFrontShopHex, type RowHeadsDraw, type RowGlazingDraw, type RowGroundWallDraw, type RowBasementDraw } from './houseLine/rowFront.js';
import { segmentPoolDraw, wallVarietyOn } from './look/measuredWallPool.js';
import { paletteFor } from './bayTextures.js';
import { SPEC_SHOP_KIND } from './houseSpec/decorate.js';
import { fieldsDraw, ownFields, specFieldsOn, type RouteAFields } from './houseSpec/routeAFields.js';
import { PERIOD_WALLS, BARE_WALL_HEX, DEFAULT_FACADE_WALL_HEX, DEFAULT_SHOP_SIGN_HEX, FLAT_ROOF_GREYS, LOOK_VARIANTS, ROOF_SLOT_TONES, cellSetOf, hexToRgb, lookHex, roofTone, type BuildingLook } from './look/palette.js';
import { decodeFurniture, MIN_CONFIDENCE, roofSlotHex } from './roofs/roofSlots.js';
import { FLAT_LID_EXPOSURE, flatRoofPriorHex, flatRoofToneEnabled, lowConfidenceReading, mappedTowardPrior, roofStampConfident, scaleHex } from './roofs/flatRoofTone.js';
import { BOX_MIN_M2, LIP_MIN_M2, flatRoofSurfaceEnabled, flatRoofSurfaceLayer } from './roofs/flatRoofSurface.js';
import { isRoofSlot } from './roofs/roofFacts.js';
import { largeTierSystem, plinthHex } from './largeBuildingTier.js';
import type { Look, ShopKind } from './bayTextures.js';
import { buildChunk, lookVariant, wallTopHeightM, type Chunk, type ChunkOptions, type MeshBuilding } from './threeBuildingMesh.js';
import { FACADE_STYLES, footprintAreaM2, type FacadeStyle } from './genericFacades.js';
import { profilesNearBuilding } from './streetFacadeRendering.js';
import { bayVariantOpenings, proceduralOpenings } from './facadeOpenings.js';
import type { StreetAppearanceProfile } from './streetAppearance.js';
import { SUPERMARKET_CHAINS, type RedLightRow } from './shopfronts.js';
import { appendAllotmentHouses, isAllotmentHouse } from './allotmentHouses.js';
import { SHED_LID_HEX, isGardenShed, ringAreaM2, shedHeightM, shedWallHex } from './gardenSheds.js';
import { SegmentGrid } from './streetFronts.js';
import { ccwRing, designInLook, gardenRoomDesign, gardenRoomGlassHex, gardenRoomLidHex, gardenRoomRule, gardenRoomTriangles, glassEdge, mainHouse, nearestStreetPoint, partyWalls, HOUSE_REACH_M, type Neighbour, type Pt } from './gardenRooms.js';
import { GARDEN_ROOM_TONES } from './look/palette.js';
import { buurtProfileAt } from './buurtProfiles/data.js';
import { SETBACK_CLADDING_HEX, SETBACK_INSET_M, SETBACK_STOREY_M, insetRing } from './contemporaryFamily.js';
import { profileWallBeatsMaterial, storeyScaleOf } from './buurtProfiles/profiles.js';
import { levelWallHex } from './look/paletteLevel.js';
import { heldBrickWall } from './houseSpec/wallColour.js';
import { periodWallList } from './look/brickLift.js';
import { hashSeed } from './wallBays.js';
import { industrialKitEnabled, industrialMeshSpec, industrialWallHex } from './industrial/industrialKit.js';
import { applyGlazing, glazingOf } from './glassParts.js';
import { REAL_ONLY_TEMPLATES, RETAIL_HELD, RETAIL_TEMPLATES, realAccepted, retailGroundOn, type RetailTemplate } from './retailTemplates.js';
import { paintOverGuess } from './retailPuiPaint.js';
import { terraceSeedOf, withTerraceSeeds } from './terraceRows.js';
import { kitRoofEdge, lipMinAreaM2 } from './roofs/roofEdge.js';
import { bikeFromCode } from './retailBikes.js';
import { postwarExtraIds, type PostwarKit } from './postwarKit/kit.js';

/** 'untextured' draws with the procedural cells' flat layer only: plain colours, real shapes (look/palette.ts). */
export type { BuildingLook };
/**
 * The shopfront the decorator stamped (`shopKind`, or `shopQuiet` for none); undefined without the extract. Undefined
 * draws NO shop: the old random third (hashShop, bayLook's hash draw) put shops on warehouses (shopGate.ts, 2026-11-10).
 */
const shopfrontOf = (p: Record<string, unknown>): ShopKind | 'quiet' | undefined => {
  const kind = shopfrontKindOf(p);
  // Lane 1 step e (rowFront flag): a front record's shop is the plain shop window, no awning, terrace or produce.
  return typeof p.rowFront === 'string' && kind && kind !== 'quiet' ? 'shopWindow' : kind;
};
const shopfrontKindOf = (p: Record<string, unknown>): ShopKind | 'quiet' | undefined =>
  // A HouseSpec's stated ground storey (houseSpec/decorate.ts `specShop`, lane H11) outranks the OSM-based extract: a quiet
  // front drops the extract's shop, a shop keeps the extract's kind or draws the plain shop window. Absent = as before.
  p.specShop === false ? 'quiet' : typeof p.shopKind === 'string' ? p.shopKind as ShopKind : p.specShop === true ? SPEC_SHOP_KIND : p.shopQuiet ? 'quiet' : undefined;
/** The texture set a look draws from (look/palette.ts `LOOK_VARIANTS`). */
export { cellSetOf };
export type Feature = { type: 'Feature'; properties: Record<string, unknown>; geometry: unknown };
/** One fixed origin for the whole city: float32 metres stay sub-millimetre within 10 km. */
export const ORIGIN = { lng: 4.9, lat: 52.37 };

export const asPolygons = (geometry: unknown): number[][][][] => {
  const g = geometry as { type?: string; coordinates?: unknown } | null;
  if (!g || !g.coordinates) return [];
  return g.type === 'Polygon' ? [g.coordinates as number[][][]] : g.type === 'MultiPolygon' ? g.coordinates as number[][][][] : [];
};

const roofHexFor = (look: BuildingLook, plan: RoofPlan) => roofTone(look, plan.material, plan.tone);

/** The roof-facts stamp (roofs/roofFacts.ts) as a display colour, texture cell and measured furniture; null without one. */
function measuredRoofOf(p: Record<string, unknown>, look: BuildingLook): { hex: string; cell: 'tile' | 'slate' | 'flat'; furniture?: MeshBuilding['measuredRoof'] } | null {
  // A low-confidence stamp (sidecar at --min-confidence=0.2) only biases the flat-roof prior (applyFlatRoof).
  if (!isRoofSlot(p.roofSlot) || !roofStampConfident(p, MIN_CONFIDENCE)) return null;
  const rgb = typeof p.roofMeasured === 'string' && /^#[0-9a-f]{6}$/i.test(p.roofMeasured) ? hexToRgb(p.roofMeasured) : null;
  const base = roofSlotHex(p.roofSlot, rgb), hex = cellSetOf(look) === 'procedural' ? base : lookHex(base, look);
  const encoded = typeof p.roofFurniture === 'string' && p.roofFurniture ? p.roofFurniture.split(',').map(Number) : [];
  const furniture = encoded.length || p.roofTerrace ? { furniture: decodeFurniture(encoded), terrace: p.roofTerrace === true } : undefined;
  return { hex, cell: ROOF_SLOT_TONES[p.roofSlot].cell, furniture };
}

/**
 * Lane R5-E (#265): an unmeasured, unmapped flat roof takes its build-year band's prior (`?flatRoofTone=0` keeps the
 * hashed slot base), and a flat lid gets its own surface layer, a parapet lip from LIP_MIN_M2 and a generic roof box
 * from BOX_MIN_M2 without measured furniture (`?flatRoofSurface=0` keeps the shared flat cell and nothing on top).
 */
function applyFlatRoof(building: MeshBuilding, p: Record<string, unknown>, look: BuildingLook, id: string, measured: ReturnType<typeof measuredRoofOf>, mapped: boolean, cells: ReturnType<typeof cellSetOf>, areaM2: number): void {
  if (!building.lid) return;
  if (flatRoofToneEnabled()) {
    const year = p.constructionYear === null || p.constructionYear === undefined || !Number.isFinite(Number(p.constructionYear)) ? null : Number(p.constructionYear);
    const prior = flatRoofPriorHex(id, year, measured ? null : lowConfidenceReading(p, MIN_CONFIDENCE), MIN_CONFIDENCE);
    const priorHex = cells === 'procedural' ? prior : lookHex(prior, look);
    let hex = building.lid.hex;
    if (!measured && !mapped) hex = priorHex;
    else if (!measured && mapped) hex = mappedTowardPrior(hex, priorHex);
    // The lid's render gain (1.135 at U1) is a look-cells figure; procedural and cartoon lids keep their tint.
    if (cells !== 'procedural' && !LOOK_VARIANTS[look].cartoonRoofCells) hex = scaleHex(hex, FLAT_LID_EXPOSURE);
    building.lid = { ...building.lid, hex };
  }
  if (!flatRoofSurfaceEnabled() || LOOK_VARIANTS[look].cartoonRoofCells) return;
  const surfaceLayer = flatRoofSurfaceLayer(cells);
  if (surfaceLayer !== null) building.lid = { ...building.lid, surfaceLayer };
  // A design-unit member's flat top sits behind its cornice with nothing wall-coloured over the eaves line (no lip, no box).
  building.flatRoof = { lip: areaM2 >= lipMinAreaM2(LIP_MIN_M2) && !designUnitOf(p), box: areaM2 >= BOX_MIN_M2 && !building.measuredRoof?.furniture.length && !designUnitOf(p), areaM2 };
}

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
    // A real shop in the building (shopfronts extract) keeps its shop windows; otherwise a ground floor of windows.
    const front = shopfrontOf(p);
    const shopCell = !system.tuned && front && front !== 'quiet' ? front : system.groundShop;
    const ground = shopCell ? bayLayer(system.archetype, 0, shopCell) : bayLayer(system.archetype, system.style, 'ground');
    building.layers = { upper: bayLayer(system.archetype, system.style, 'upper'), ground, door: bayLayer(system.archetype, system.style, 'groundDoor') };
    building.plainLayer = bayLayer(system.archetype, system.style, 'plain');
    building.openings = bayVariantOpenings({ archetype: system.archetype, kind: 'upper', ...BAY_STYLES[system.archetype][system.style] }, bayLook);
    building.accentHex = paletteFor(id, system.archetype, bayLook).accent;
    building.wallHex = lookHex(wall, bayLook);
    // A darker plinth under the window grid (the shop paint keeps its own colour).
    building.groundHex = shopCell ? undefined : lookHex(plinthHex(wall), bayLook);
  } else building.wallHex = wall;
  building.shop = false;
  building.layoutScale = { bay: system.bayM / nominal.bay, storey: system.storeyM / nominal.storey, ground: system.groundM / nominal.ground, doorEvery: 1000 };
  building.parapetM = system.parapetM;
}

/** House rows: a feature's `rowDress` (houseLine/rowFront.ts rowDressOf), validated. */
type RowSide = 'left' | 'right' | 'centre';
const rowSideOf = (v: unknown): RowSide | null => v === 'left' || v === 'right' || v === 'centre' ? v : null;
function rowDressOf(v: unknown): { omitExtras?: string[]; cornice?: string; corniceDress?: import('./houseSpec/row/types.js').RowCorniceDress; heads?: RowHeadsDraw[]; extras?: string[]; stoop?: { side: RowSide; steps?: false; form?: 'straight' | 'side' | 'double'; railing?: true; doorcase?: import('./houseSpec/row/types.js').RowDoorcase }; door?: { side: RowSide; index?: number; bays?: number; doorcase?: import('./houseSpec/row/types.js').RowDoorcase }; balcony?: { storeys: number[]; axis: 'centre' | 'all' }; erker?: { storeys: number[]; kind: 'box' | 'canted'; roofBalcony?: true; width?: 'full'; side?: 'left' | 'right' }; windowShare?: number; mullionShare?: number; glazing?: RowGlazingDraw; floorsM?: number[]; groundWalls?: RowGroundWallDraw[]; basements?: RowBasementDraw[]; shopFront?: { frameHex: string; side: RowSide } } | null {
  if (!v || typeof v !== 'object') return null;
  const ws = (v as { windowShare?: unknown }).windowShare, windowShare = typeof ws === 'number' && ws > 0.3 && ws < 0.95 ? { windowShare: ws } : {};
  const ms = (v as { mullionShare?: unknown }).mullionShare, mullionShare = typeof ms === 'number' && ms > 0 && ms < 0.6 ? { mullionShare: ms } : {};
  const d = v as { cornice?: unknown; heads?: unknown; extras?: unknown; stoop?: { side?: unknown }; door?: { side?: unknown; index?: unknown; bays?: unknown }; balcony?: { storeys?: unknown; axis?: unknown } };
  const doorcaseOf = (dc: { material?: unknown; top?: unknown; fanlight?: unknown; door?: unknown } | undefined) => dc && (dc.material === 'stone' || dc.material === 'timber') ? { doorcase: { material: dc.material as 'stone' | 'timber', ...(dc.top === 'entablature' || dc.top === 'pediment' || dc.top === 'segmental' ? { top: dc.top as 'entablature' | 'pediment' | 'segmental' } : {}), ...(dc.fanlight === false || dc.fanlight === 'diamond' || dc.fanlight === 'oval' || dc.fanlight === 'oval-spoked' ? { fanlight: dc.fanlight as false | 'diamond' | 'oval' | 'oval-spoked' } : {}), ...((dc as { span?: unknown }).span === 'ground' || (dc as { span?: unknown }).span === 'frame' ? { span: (dc as { span: 'ground' | 'frame' }).span } : {}), ...(typeof (dc as { entresol?: unknown }).entresol === 'number' ? { entresol: (dc as { entresol: number }).entresol } : {}), ...((dc as { tiers?: unknown }).tiers === 2 ? { tiers: 2 as const } : {}), ...(dc.door === 'black' || (typeof dc.door === 'string' && /^#[0-9a-f]{6}$/i.test(dc.door)) ? { door: dc.door as string } : {}) } } : {};
  const doorSide = rowSideOf(d.door?.side), door = doorSide ? { side: doorSide, ...(typeof d.door?.index === 'number' && typeof d.door?.bays === 'number' && d.door.bays > 0 ? { index: d.door.index, bays: d.door.bays } : {}), ...doorcaseOf((d.door as { doorcase?: { material?: unknown } } | undefined)?.doorcase) } : null;
  // A stated erker (lane R round 24): its rows, plan and roof balcony; malformed or absent, none.
  const er = (v as { erker?: { storeys?: unknown; kind?: unknown; roofBalcony?: unknown; width?: unknown; side?: unknown } }).erker;
  const erker = er && Array.isArray(er.storeys) && er.storeys.length && er.storeys.every(k => Number.isInteger(k) && (k as number) >= 0) ? { storeys: er.storeys as number[], kind: er.kind === 'canted' ? 'canted' as const : 'box' as const, ...(er.roofBalcony === true ? { roofBalcony: true as const } : {}), ...(er.width === 'full' ? { width: 'full' as const } : {}), ...(er.side === 'left' || er.side === 'right' ? { side: er.side as 'left' | 'right' } : {}) } : null;
  const balcony = d.balcony && Array.isArray(d.balcony.storeys) && d.balcony.storeys.every(k => typeof k === 'number') ? { storeys: d.balcony.storeys as number[], axis: d.balcony.axis === 'all' ? 'all' as const : 'centre' as const } : null;
  const sf = (v as { shopFront?: { frameHex?: unknown; side?: unknown } }).shopFront, sfSide = rowSideOf(sf?.side);
  const shopFront = sf && typeof sf.frameHex === 'string' && /^#[0-9a-f]{6}$/i.test(sf.frameHex) && sfSide ? { shopFront: { frameHex: sf.frameHex, side: sfSide } } : {};
  const gz = (v as { glazing?: { kind?: unknown; frameM?: unknown; barM?: unknown; panes?: unknown } }).glazing;
  const glazing = gz && typeof gz.kind === 'string' && typeof gz.frameM === 'number' && typeof gz.barM === 'number' ? { glazing: { kind: gz.kind, frameM: gz.frameM, barM: gz.barM, ...(typeof gz.panes === 'number' ? { panes: gz.panes } : {}) } } : {};
  const fl = (v as { floorsM?: unknown }).floorsM, floorsM = Array.isArray(fl) && fl.length && fl.every(x => typeof x === 'number' && Number.isFinite(x)) ? { floorsM: fl as number[] } : {};
  // Stated basement fronts (row-basement), each validated.
  const bs = (v as { basements?: unknown }).basements, basements = Array.isArray(bs) ? (bs as RowBasementDraw[]).filter(b => b && Number.isFinite(b.a0) && Number.isFinite(b.a1) && typeof b.hex === 'string' && /^#[0-9a-f]{6}$/i.test(b.hex)).map(b => ({ a0: b.a0, a1: b.a1, hex: b.hex, head: b.head === 'segmental' ? 'segmental' as const : 'round' as const, doors: Array.isArray(b.doors) ? b.doors.filter(d => Array.isArray(d) && d.length === 2 && d.every(Number.isFinite)).map(d => [d[0], d[1]] as [number, number]) : [] })) : [];
  const gws = (v as { groundWalls?: unknown }).groundWalls, groundWalls = Array.isArray(gws) ? (gws as RowGroundWallDraw[]).filter(g => g && Number.isFinite(g.a0) && Number.isFinite(g.a1) && typeof g.hex === 'string' && /^#[0-9a-f]{6}$/i.test(g.hex)).map(g => ({ a0: g.a0, a1: g.a1, hex: g.hex, top: g.top === 'plain' || g.top === 'scrolled' ? g.top : 'ledge' as const })) : [];
  const steps = d.stoop && (d.stoop as { steps?: unknown }).steps === false ? { steps: false as const } : {};
  // The flight's form and railing as the ground states them (house rows stoops, Herengracht 130, 148).
  const sf0 = (d.stoop as { form?: unknown; railing?: unknown } | undefined), stoopForm = sf0?.form === 'straight' || sf0?.form === 'side' || sf0?.form === 'double' ? { form: sf0.form as 'straight' | 'side' | 'double' } : {};
  const stoopRail = sf0?.railing === true ? { railing: true as const } : {};
  const dc = (d.stoop as { doorcase?: { material?: unknown; top?: unknown; fanlight?: unknown } } | undefined)?.doorcase;
  const doorcase = doorcaseOf(dc);
  const side: 'left' | 'right' | 'centre' | null = d.stoop && (d.stoop.side === 'left' || d.stoop.side === 'right' || d.stoop.side === 'centre') ? d.stoop.side : null;
  const heads = Array.isArray(d.heads) ? (d.heads as RowHeadsDraw[]).filter(h => h && Number.isFinite(h.a0) && Number.isFinite(h.a1) && typeof h.dressing === 'string') : [];
  const extras = Array.isArray(d.extras) ? (d.extras as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  const om = (v as { omitExtras?: unknown }).omitExtras, omitExtras = Array.isArray(om) ? om.filter((x): x is string => typeof x === 'string') : [];
  // A stated timber cornice (RowDesign.corniceDress), its parts validated one by one.
  const cd = (v as { corniceDress?: Record<string, unknown> }).corniceDress;
  const corniceDress = cd && typeof cd === 'object' ? { corniceDress: {
    ...(typeof cd.paint === 'string' && /^(#[0-9a-f]{6}|white|cream|grey)$/i.test(cd.paint) ? { paint: cd.paint } : {}),
    ...(cd.supports === 'modillions' || cd.supports === 'consoles' || cd.supports === 'dentils' || cd.supports === 'none' ? { supports: cd.supports as 'modillions' | 'consoles' | 'dentils' | 'none' } : {}),
    ...(cd.frieze === 'plain' || cd.frieze === 'attic-lights' || cd.frieze === 'panels' ? { frieze: cd.frieze as 'plain' | 'attic-lights' | 'panels' } : {}),
    ...(cd.centre === 'pediment' || cd.centre === 'segmental' || cd.centre === 'balustrade' ? { centre: cd.centre as 'pediment' | 'segmental' | 'balustrade' } : {}),
    ...(typeof cd.centreShare === 'number' && cd.centreShare > 0.1 && cd.centreShare <= 1 ? { centreShare: cd.centreShare } : {}),
  } } : {};
  const out = { ...(omitExtras.length ? { omitExtras } : {}), ...(typeof d.cornice === 'string' ? { cornice: d.cornice } : {}), ...corniceDress, ...(heads.length ? { heads } : {}), ...(extras.length ? { extras } : {}), ...(side ? { stoop: { side, ...steps, ...stoopForm, ...stoopRail, ...doorcase } } : {}), ...(door ? { door } : {}), ...(balcony ? { balcony } : {}), ...(erker ? { erker } : {}), ...windowShare, ...mullionShare, ...glazing, ...floorsM, ...(groundWalls.length ? { groundWalls } : {}), ...(basements.length ? { basements } : {}), ...shopFront };
  return Object.keys(out).length ? out : null;
}

/** Lane WG step 2: route A's fields (houseSpec/routeAFields.ts), unless `?specFields=0`. */
const fieldsOf = (p: Record<string, unknown>): RouteAFields | undefined => (specFieldsOn() ? ownFields(specRecipeOf(p)?.fields) : undefined);
/** The window look the bay pick takes: H11's stated look (held), then route A's head (flat/segmental) and the street
 *  template's pale surround; absent fields leave it as before. */
/** House rows: the series' look (houseLine/rowFront.ts RowSeriesDraw.look), validated. */
/** House rows: the wall band a row cornice takes over the storeys (m), by cornice kind. */
const ROW_CORNICE_BAND_M: Record<string, number> = { simple: 0.35, bracketed: 0.7, heavy: 0.75, frieze: 0.45, 'attic-frieze': 0.9 };
type RowSash = 'plain' | 'transom' | 'paired-transom' | 'six-over-six';
const ROW_SASHES: readonly RowSash[] = ['plain', 'transom', 'paired-transom', 'six-over-six'];
function rowLookOf(p: Record<string, unknown>): { bays: number; year?: number | null; heightM?: number | null; seed?: string; whiteFrames?: boolean; sash?: RowSash } | null {
  const v = p.rowLook as { bays?: unknown; year?: unknown; heightM?: unknown } | undefined;
  if (!v || typeof v !== 'object' || !(Number.isInteger(v.bays) && (v.bays as number) > 0)) return null;
  const num = (x: unknown) => typeof x === 'number' && Number.isFinite(x) ? x : null;
  return { bays: v.bays as number, year: num(v.year), heightM: num(v.heightM), ...(typeof (v as { seed?: unknown }).seed === 'string' ? { seed: (v as { seed: string }).seed } : {}), ...(typeof (v as { whiteFrames?: unknown }).whiteFrames === 'boolean' ? { whiteFrames: (v as { whiteFrames: boolean }).whiteFrames } : {}), ...(ROW_SASHES.includes((v as { sash?: RowSash }).sash as RowSash) ? { sash: (v as { sash: RowSash }).sash } : {}) };
}
function specLookOf(p: Record<string, unknown>): { pale?: boolean; dark?: boolean; arch?: boolean; tall?: boolean; bays?: number; windowH?: number; painted?: boolean; sash?: RowSash; plainHead?: boolean } | undefined {
  const r = specRecipeOf(p), draw = fieldsDraw(fieldsOf(p));
  // Lane WC (`?wallFinish=1`): a spec'd render, painted or stone finish takes the painted preset's smooth cells (bayLook).
  const painted = r?.finish ? { painted: true } : {};
  const extra = { ...(draw.arch !== undefined && r?.look?.arch === undefined ? { arch: draw.arch } : {}), ...(draw.pale !== undefined && r?.look?.pale === undefined ? { pale: draw.pale } : {}) };
  // Lane 1 step e (rowFront flag, houseLine/rowFront.ts): a front record's house takes no block surrounds (the pale
  // presets' alternating masonry blocks) unless a record states them; it states none yet.
  // House rows (lane R): a series member's window look is the series' (its preset seeded by the series id); a per-pand
  // spec look (a D1 reading of this building alone) does not move it.
  if (typeof p.rowFront === 'string' && typeof p.rowSeries === 'string') {
    const windowH = Number((r as { windowH?: number } | undefined)?.windowH), rl = rowLookOf(p), perFront = rl?.bays;
    // The series' white joinery is the light-sash trait (dark: false); unstated keeps the preset's own.
    // arch: false: the painted cells keep square heads; a stated segmental or round head draws its own glass under the
    // arch (houseLine/headGrammar.ts), so an unstated preset arch never appears (Weteringschans 168096/168042 top row).
    // Stated joinery (row-sash, round 5): the record draws the window, so the preset paints no lintel blocks over it (they
    // stood over the arched glass on Herengracht 71); a stated head dressing draws its own (row-heads).
    const plainHead = !!(p.rowDress as { glazing?: unknown } | undefined)?.glazing;
    return { pale: false, arch: false, ...(plainHead ? { plainHead: true } : {}), ...(rl?.sash ? { sash: rl.sash } : {}), ...(rl?.whiteFrames !== undefined ? { dark: !rl.whiteFrames } : {}), ...(perFront ? { bays: perFront } : r?.bays ? { bays: r.bays } : {}), ...(Number.isFinite(windowH) && windowH > 0 ? { windowH } : {}) };
  }
  if (typeof p.rowFront === 'string') {
    const windowH = Number((r as { windowH?: number } | undefined)?.windowH);
    return { ...r?.look, ...extra, pale: false, ...(r?.bays ? { bays: r.bays } : {}), ...(Number.isFinite(windowH) && windowH > 0 ? { windowH } : {}), ...painted };
  }
  if (!r?.look && !Object.keys(extra).length && !r?.finish) return undefined;
  // The spec's bay count narrows the preset pool only under H11's stated look: a route A field changes its own trait, not the pool.
  return { ...r?.look, ...extra, ...(r?.look ? { bays: r?.bays } : {}), ...painted };
}
/** A HouseSpec's reads (houseSpec/decorate.ts `specRecipe`), when the decorator wrote one. */
const specRecipeOf = (p: Record<string, unknown>): NonNullable<MeshBuilding['specRecipe']> | undefined =>
  p.specRecipe && typeof p.specRecipe === 'object' && !Array.isArray(p.specRecipe) ? p.specRecipe as NonNullable<MeshBuilding['specRecipe']> : undefined;

/** The `?walls=measured` stamp (genericFacades.ts constructionYearEnricher), when present and well formed. */
const periodWallOf = (p: Record<string, unknown>): string | undefined => typeof p.periodWallHex === 'string' && /^#[0-9a-f]{6}$/i.test(p.periodWallHex) ? p.periodWallHex : undefined;

/**
 * Where the measured wall pool looks for a pand's neighbours: its outer ring's vertex mean, as the pool table's points are
 * (scripts/house-specs/measured-wall-pool.ts), with the variety draw on (lane W2); the first vertex as lane W1 shipped
 * with `?wallVariety=0`.
 */
function poolPointOf(polygons: ReturnType<typeof asPolygons>, first: readonly number[] | undefined): readonly [number, number] | undefined {
  if (!first) return undefined;
  const ring = polygons[0]?.[0];
  if (!wallVarietyOn() || !ring?.length) return [first[0], first[1]];
  return [ring.reduce((s, q) => s + q[0], 0) / ring.length, ring.reduce((s, q) => s + q[1], 0) / ring.length];
}
export function meshBuildingFor(feature: Feature, look: BuildingLook, coarse = false, sourceRoofPlan?: RoofPlan): MeshBuilding | null {
  const p = feature.properties;
  const polygons = asPolygons(feature.geometry);
  const minHeightM = Number(p.minHeight) || 0;
  const heightM = wallTopHeightM(p);
  if (!polygons.length || !Number.isFinite(heightM)) return null;
  const id = String(p.id ?? '');
  // Design units (`?designUnits=1`, designUnits/draw.ts): a segment member hashes every per-building prior on its
  // segment's seed and lays its bays out on its slice of the segment's frontage. Absent: `sid` is the pand id.
  // Post-war terraces outside the profiled buurten (`?terraceRows=1`, terraceRows.ts): the row's seed. Absent: the pand id.
  const design = designUnitOf(p), sid = design ? design.seed : terraceSeedOf(p) ?? id;
  let building: MeshBuilding;
  let archetype: string | undefined, plain: number, roofBase: number, layout: FacadeStyle, profileWall: string | undefined, spandrelAccent: string | undefined, quietGround: number | undefined, postwar: PostwarKit | undefined;
  if (cellSetOf(look) !== 'procedural') {
    const year = p.constructionYear === null || p.constructionYear === undefined || !Number.isFinite(Number(p.constructionYear)) ? null : Number(p.constructionYear);
    const at = polygons[0]?.[0]?.[0];
    const profile = at ? buurtProfileAt(at[0], at[1]) : null;
    // House rows (lane R): a series member's bay preset is the series' (one preset per series, seeded by its id).
    // The series' look (rowLook): its year, cornice line and bays per front, and no positional pool draw.
    const rowLook = rowLookOf(p);
    const lookYear = rowLook ? rowLook.year ?? year : year;
    const bay = bayLookFor(rowLook?.seed ?? (typeof p.rowSeries === 'string' ? p.rowSeries : sid), lookYear, rowLook?.heightM ?? (Number(p.height) || heightM), look as Look, shopfrontOf(p) ?? 'quiet', undefined, periodWallOf(p), rowLook ? null : profile,
      lookYear !== null && lookYear >= 1945 ? { footprintM2: footprintAreaM2(feature.geometry), buildingType: typeof p.buildingType === 'string' ? p.buildingType : null, at: at ? [at[0], at[1]] as const : undefined } : undefined,
      design?.look || design?.bays ? { ...design.look, ...(design.bays ? { bays: design.bays } : {}), ...specLookOf(p) } : specLookOf(p), rowLook ? undefined : design ? design.at : poolPointOf(polygons, at));
    archetype = bay.archetype; profileWall = bay.profileWall; spandrelAccent = bay.modern?.accent; postwar = bay.postwar;
    // Design units: every unpainted member draws its segment's mid-range brick from the measured pool (one per segment,
    // never the darkest tones; measuredWallPool.ts segmentPoolDraw), whatever its own profile or period wall said.
    const segWall = design?.at && !specLookOf(p)?.painted ? segmentPoolDraw(design.at[0], design.at[1], bay.archetype, design.seed) : null;
    if (segWall) profileWall = segWall;
    building = { id, polygons, heightM, minHeightM, style: bay.layout, wallHex: segWall ?? bay.wallHex, accentHex: bay.accentHex, layers: bay.layers, groundHex: bay.groundHex };
    // Lane retail-look round 3c (`?retailGround=1`): bay.groundHex here is the shop grammar's guess (no recipe is passed),
    // so a pale one goes dark; a measured paint (spec shopHex, row-front trace, a street recipe's groundWallHex) wins later.
    const storeyScale = storeyScaleOf(profile?.eras[bay.archetype], STYLE_DIMS[bay.layout].storey);
    if (storeyScale !== 1) building.storeyScale = storeyScale;
    building.openings = bayVariantOpenings({ ...bay.variant, kind: 'upper' }, look as Look);
    plain = bay.plain; roofBase = BAY_LAYER_COUNT; layout = bay.layout; building.plainLayer = bay.plain;
    quietGround = bay.quietGround ?? bayLayer(bay.archetype, bay.style, 'ground');
    if ((FACADE_STYLES as readonly string[]).includes(String(p.facadeStyle)) && p.facadeStyle !== bay.layout) building.period = p.facadeStyle as FacadeStyle;
    if (bay.contemporary?.setback) building.setbackCrown = true;
  } else {
    layout = (FACADE_STYLES as readonly string[]).includes(String(p.facadeStyle)) ? p.facadeStyle as FacadeStyle : 'c19';
    building = { id, polygons, heightM, minHeightM, style: layout, wallHex: typeof p.sideColour === 'string' ? p.sideColour : DEFAULT_FACADE_WALL_HEX, shop: layout !== 'tower' && !!shopfrontOf(p) && shopfrontOf(p) !== 'quiet' };
    building.openings = proceduralOpenings(layout);
    plain = cellLayer(layout, 'plain', lookVariant(sid)); roofBase = CELL_LAYER_COUNT; building.plainLayer = plain;
  }
  // A HouseSpec's reads (houseSpec/decorate.ts): the street run's bay count, crown and period, and a wall colour
  // measured on a street photo. Absent unless the spec extract stamped the pand (`?houseSpecs=0` = absent).
  const specRecipe = specRecipeOf(p);
  if (specRecipe) building.specRecipe = specRecipe;
  // Lane PR1: a pre-war photo-look pand with no stated storeys or bays guesses its street runs' grid from the read houses
  // around it (houseSpec/structurePrior.ts; the mesher applies it per run). `?structurePrior=0`: nothing set.
  if (structurePriorOn() && !design && cellSetOf(look) !== 'procedural' && !specRecipe?.storeys && !specRecipe?.bays && !p.kitWall && !p.largeTier && !p.frontCarrier && !p.gardenShed) {
    const year = Number(p.constructionYear), at = polygons[0]?.[0];
    if (p.constructionYear !== null && p.constructionYear !== undefined && Number.isFinite(year) && year < STRUCTURE_PRIOR_TABLE.maxYear && at?.length && (building.style === 'canal' || building.style === 'c19' || building.style === 'school')) {
      building.structurePrior = { year, lng: at.reduce((s, q) => s + q[0], 0) / at.length, lat: at.reduce((s, q) => s + q[1], 0) / at.length };
    }
  }
  if (p.registerFinish === 'light' || p.registerFinish === 'brick') building.registerFinish = p.registerFinish;
  // A spec'd shopfront's measured paint (H11) on the shop's ground storey, in the look's palette.
  if (specRecipe?.shopHex && building.groundHex && shopfrontOf(p) !== 'quiet' && cellSetOf(look) !== 'procedural') building.groundHex = lookHex(specRecipe.shopHex, look as Look);
  // Lane retail-look round 4 (`?retailGround=1`): the pui paint measured on a street panorama (measure-pui.ts, stamped by
  // decorateShopTemplate) outranks both the guess and the spec's shop read.
  const puiPaint = retailGroundOn() && cellSetOf(look) !== 'procedural' && typeof p.puiPaint === 'string' ? lookHex(p.puiPaint, look as Look) : undefined;
  // Round 5b: a dark reading only replaces a pale guess (retailPuiPaint.ts paintOverGuess).
  if (puiPaint && building.groundHex && shopfrontOf(p) !== 'quiet') building.groundHex = paintOverGuess(building.groundHex, puiPaint, p.puiDark === 1);
  // A sourced hex color survives PHOTO decoration; material-only hues remain explicitly display priors.
  let sourcedWall: string | undefined;
  if (look === 'photo') {
    // A buurt profile's measured wall (bayLook.ts) outranks a city-wide material-family hue of the same family.
    const materialPrior = profileWall && profileWallBeatsMaterial(p.material, profileWall) ? undefined : p.facadeMaterialColourPrior;
    const sourced = [specRecipe?.wallHex, p.facadeMappedColour, p.sideColourSource === 'measured-accepted' ? p.sideColour : undefined, materialPrior].find(v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v));
    if (sourced) building.wallHex = String(sourced);
    sourcedWall = sourced ? String(sourced) : undefined;
    // A wall the pale-warm guard held keeps its period colour, in a brick family (wallColour.ts heldBrickWall, H9g).
    if (specRecipe?.heldBrick && p.sideColourSource !== 'measured-accepted' && archetype) building.wallHex = heldBrickWall(building.wallHex, periodWallList('photo', archetype, PERIOD_WALLS.photo[archetype as keyof typeof PERIOD_WALLS.photo]), hashSeed(sid) >>> 7);
  }
  const front = shopfrontOf(p);
  building.shopfront = front ? front !== 'quiet' : false;
  // A named business's own colour goes on its sign and awning (the cells' accent), and a
  // labelled business gets its signature storefront.
  // Not on a modern ribbon or curtain front: the accent paints its spandrel bands, which a brand red striped (#117).
  if (building.shopfront && typeof p.shopColour === 'string' && !spandrelAccent) building.accentHex = p.shopColour;
  // A hand-modelled front (frontCarrier) replaces the generated signature.
  if (building.shopfront && Array.isArray(p.shopSignature) && !p.frontCarrier) building.signature = { at: p.shopSignature as [number, number], hex: typeof p.shopColour === 'string' ? p.shopColour : DEFAULT_SHOP_SIGN_HEX };
  // A chain supermarket: its own fascia, logo panel and brand word (shopfronts.ts SUPERMARKET_CHAINS).
  const chain = Array.isArray(p.shopChain) ? p.shopChain as [string, number, number] : null;
  if (building.shopfront && chain && SUPERMARKET_CHAINS[chain[0]] && !p.frontCarrier) building.chain = { at: [chain[1], chain[2]], look: SUPERMARKET_CHAINS[chain[0]] };
  // Lane retail-ground (`?retailGround=1`): a shopfront template stamped from the template extract (shopfronts.ts
  // decorateShopTemplate, which only runs with the extract installed, which only the flag's loader installs).
  const template = Array.isArray(p.shopTemplate) ? p.shopTemplate as [string, number, number, string?, (0 | 1)?, RedLightRow?] : null;
  // Lane retail-real: lane R's De Wallen audit on a red-light row (shopfronts.ts RedLightRow): closed or not a window
  // draws no template under retailReal; a measured window front draws over its own span.
  const redRow = retailRealOn() && template?.[0] === 'redLight' ? template[5] : undefined;
  // Round 4 (`?retailParts=1`): a per-pand front colour read on a photo (shopfronts.ts fronts, front-overrides.json).
  const ovRaw = retailPartsOn() ? p.shopFrontOverride as { frame?: string; awning?: string } | undefined : undefined, hex6 = (v: unknown) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
  const ov = ovRaw ? { ...(hex6(ovRaw.frame) ? { frame: ovRaw.frame } : {}), ...(hex6(ovRaw.awning) ? { awning: ovRaw.awning } : {}) } : undefined;
  // Lane retail-real: a chain's row carries '@<key>' as its word (retailChains.ts); its type template draws only with
  // retailReal on, under the chain's colours and logo.
  const chainKey = chainOfWord(template?.[3]), chainRow = chainKey ? RETAIL_CHAINS[chainKey] : undefined;
  // A chain under a template whose real look has not won (REAL_ACCEPTED) draws as round n would: the template with its
  // name lettered, no chain colours or logo.
  const retailChain = chainRow && retailRealOn() && (realAccepted(template![0]) || chainOwnFront(chainKey!)) ? chainRow : undefined, chainWord = chainRow && !retailChain ? chainRow.word : undefined;
  if (template && !redRow?.x && !(chainKey && !chainRow) && retailGroundOn() && (RETAIL_TEMPLATES as readonly string[]).includes(template[0]) && (!RETAIL_HELD.includes(template[0]) || (retailRealOn() && realAccepted(template[0]))) && !p.frontCarrier && cellSetOf(look) !== 'procedural'
    && (!(REAL_ONLY_TEMPLATES as readonly string[]).includes(template[0]) || (retailRealOn() && realAccepted(template[0])))) {
    const logoLayer = retailLogoLayer(cellSetOf(look)), tk = templateLogoKey(template[0], retailRealOn(), realAccepted(template[0])), cl = retailChain && chainKey ? chainLogo(chainKey) : tk ? chainLogo(tk) : null;
    const logo = cl ? { rect: cl.rect, aspect: cl.aspect, page: CHAIN_LOGO_BASE + cl.page } : logoFor(template[0] as RetailTemplate);
    building.retailFront = { template: template[0] as RetailTemplate, at: [template[1], template[2]], ...(template[3] && !chainKey ? { word: template[3] } : chainWord ? { word: chainWord } : {}), ...(retailChain ? { chain: { fascia: retailChain.fascia, letters: retailChain.letters, word: retailChain.word } } : {}), ...(redRow?.s ? { redLight: { span: redRow.s, ...(redRow.d ? { doors: redRow.d } : {}), ...(redRow.t ? { tube: redRow.t } : {}), ...(redRow.c ? { curtains: redRow.c } : {}), ...(redRow.f ? { frameHex: redRow.f } : {}) } } : {}), ...(template[4] === 1 ? { nearest: true } : {}), ...(logo && logoLayer !== null ? { logo: { layer: logoLayer + logo.page, rect: logo.rect, aspect: logo.aspect } } : {}), ...(logoLayer !== null ? { letters: logoLayer } : {}), ...(logoLayer !== null && retailRealOn() && realAccepted(template[0]) ? { goods: logoLayer + GOODS_BASE, faces: logoLayer + TYPE_BASE, ...(shopVarietyOn() ? { variety: logoLayer + VARIETY_BASE } : {}) } : {}), ...(puiPaint && p.puiDark !== 1 && !retailChain ? { paint: puiPaint } : {}), ...(bikeFromCode(p.bikeShop) ? { bike: bikeFromCode(p.bikeShop)! } : {}), ...(typeof p.shopAwning === 'string' && /^#[0-9a-f]{6}$/i.test(p.shopAwning) ? { awning: p.shopAwning } : {}), ...(ov?.awning ? { awning: ov.awning } : {}), ...(ov?.frame ? { frameHex: ov.frame } : {}), ...(retailBrandOn() && (chainKey ?? template[0]) in BRAND_STYLES ? { brand: chainKey ?? template[0] } : {}) };
    // Lane ground-floor (`?groundFloor=1`): the building's own ground floor, the shop in its openings.
    const gf = groundFloorOn() ? groundFloorOf(p.groundFloor) : undefined;
    if (gf && !redRow?.s) building.retailFront.groundFloor = gf;
    delete building.signature;
  } else if (template && !redRow && !p.frontCarrier && cellSetOf(look) !== 'procedural' && retailGroundOn() && groundFloorOn() && (RETAIL_TEMPLATES as readonly string[]).includes(template[0])) {
    // Lane ground-floor fix round: a pand whose template is held or not accepted still draws its ground-floor record,
    // with a neutral shop fill (retailFront.ts `neutral`) and its name lettered on a dark board.
    const gf = groundFloorOf(p.groundFloor), letters = retailLogoLayer(cellSetOf(look));
    if (gf) {
      building.retailFront = { template: template[0] as RetailTemplate, at: [template[1], template[2]], ...(chainRow ? { word: chainRow.word } : template[3] && !chainKey ? { word: template[3] } : {}), ...(template[4] === 1 ? { nearest: true } : {}), ...(letters !== null ? { letters } : {}), neutral: true, groundFloor: gf };
      delete building.signature;
    }
  }
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
  // A roof read from the orthophoto (roof-facts sidecar) outranks the mapped tag and the grey prior.
  const measured = measuredRoofOf(p, look);
  building.lid = { hex: measured?.hex ?? mapped ?? FLAT_ROOF_GREYS[lookVariant(sid) % FLAT_ROOF_GREYS.length], flatLayer: roofBase + 3 };
  if (measured?.furniture) building.measuredRoof = measured.furniture;
  // A real flat roof (no planned pitched roof): lane R5-E's tone and surface (roofs/flatRoofTone.ts, flatRoofSurface.ts).
  if ((!p.roofPlanned || p.roofShape === 'parapet') && !p.kitRoof && !p.kitWall && look !== 'untextured') applyFlatRoof(building, p, look, sid, measured, !!mapped, cellSetOf(look), footprintAreaM2(feature.geometry));
  // `?roofEdge=1` (roofs/roofEdge.ts): a flat kit roof (the generic school, feedback 8022e3's building) takes the edge band only.
  else if (!building.flatRoof && look !== 'untextured' && (p.kitRoof || p.kitWall)) { const edge = kitRoofEdge(!building.roof, footprintAreaM2(feature.geometry)); if (edge) building.flatRoof = edge; }
  if (p.gardenShed) {
    // A back-garden shed (gardenSheds.ts): bare walls in a weathered muted colour, a tarred flat lid, nothing else.
    building.bare = true; building.wallHex = shedWallHex(id); building.lid = { hex: SHED_LID_HEX, flatLayer: roofBase + 3 };
    building.shop = false; building.shopfront = false; building.signature = undefined; building.chain = undefined;
    if (p.gardenRoom) {
      // A garden room (gardenRooms.ts): flat-colour slat or black walls, the measured (or EPDM) lid. The glass,
      // joints and fascia come from buildFeatureChunk, which knows the neighbours.
      const year = p.constructionYear === null || p.constructionYear === undefined || !Number.isFinite(Number(p.constructionYear)) ? null : Number(p.constructionYear);
      building.wallHex = designInLook(gardenRoomDesign(id, year), look).wallHex;
      building.plainLayer = roofBase + 3;
      building.lid = { hex: gardenRoomLidHex(p, measured?.hex ?? null, look), flatLayer: roofBase + 3 };
    }
  }
  if (p.kitWall) {
    // A landmark kit's walls: its own stone or brick colour, bare or in a window grid.
    building.wallHex = String(p.kitWallHex ?? building.wallHex);
    building.plainWalls = p.kitWall === 'plain' || p.kitWall === 'flat';
    if (id === 'NL.IMBAG.Pand.0363100012167944' && look === 'photo') building.plainLayer = FATIH_MASONRY_LAYER;
    if (p.kitWall === 'flat') { building.bare = true; building.plainLayer = roofBase + 3; }
  }
  if (p.roofPlanned && !coarse) {
    // The decorator's own plan, recomputed from the same feature (pure), so the two agree.
    let plan = sourceRoofPlan ?? roofPlanForFeature(feature);
    if (plan) {
      const dims = STYLE_DIMS[layout];
      // A measured pitched slot picks the cell (pantile or slate) and the tint; other slots keep the planned tone.
      // A row roof (rowRoof: rowDormers set) keeps its stated material: the stamp's pantile drew Herengracht 51's slate red.
      if (measured?.cell && measured.cell !== 'flat' && !plan.rowDormers) plan = { ...plan, material: measured.cell };
      // Where dormers are a choice (not a mansard's or a school roof's own), 3DBAG's roof parts decide, not the dice.
      if (typeof p.roofDormer === 'boolean' && (plan.kind === 'pitched' || plan.kind === 'hipped' || plan.kind === 'gable' || plan.kind === 'halfHipped')) plan = { ...plan, dormers: p.roofDormer };
      // A row roof is its series' slate (roofMesh.ts ROW_SLATE_TONE), never a per-pand measured stamp; a buurt kit row its
      // series' tile as the panorama measured it (buurtGenerator/kit/roofKit.ts roofHex).
      building.roof = { plan, roofHex: plan.buurtKit?.roofHex ? (cellSetOf(look) === 'procedural' ? plan.buurtKit.roofHex : lookHex(plan.buurtKit.roofHex, look)) : measured?.cell && measured.cell !== 'flat' && !plan.rowDormers ? measured.hex : roofHexFor(look, plan), dims: { bayM: dims.bay, storeyM: dims.storey, cellM: ROOF_CELL_M },
        layers: { slope: roofBase + (plan.material === 'tile' ? 0 : 1), plain, dormer: roofBase + 2 } };
      if(plan.repeatedTerrace){
        // One observed material family also owns exposed returns and roof-side closures.
        building.wallHex=plan.repeatedTerrace.wallHex??building.wallHex;
        building.shop=false;building.shopfront=false;building.signature=undefined;building.chain=undefined;
      }
    }
  }
  // The industrial kit (industrial/industrialKit.ts): tanks, silos and sheds the industrial table names lose the house
  // grammar; offices on an estate keep their windows but not a guessed shopfront. Without the stamp, nothing changes.
  const industrial = typeof p.industrial === 'string' && look !== 'untextured' && !p.kitWall && !p.frontCarrier && !p.gardenShed && industrialKitEnabled() ? p.industrial : null;
  if (industrial === 'office') {
    if (!building.shopfront && !p.largeTier) { building.shop = false; if (building.layers && quietGround !== undefined) building.layers = { ...building.layers, ground: quietGround }; building.groundHex = undefined; }
  } else if (industrial === 'tank' || industrial === 'silo' || industrial === 'shed' || industrial === 'works') {
    const cells = cellSetOf(look), tone = (hex: string) => cells === 'procedural' ? hex : lookHex(hex, look as Look);
    building.bare = true; building.plainWalls = false;
    building.wallHex = sourcedWall ?? tone(industrialWallHex(id, industrial));
    const surface = (industrial === 'shed' || industrial === 'works') && flatRoofSurfaceEnabled() ? flatRoofSurfaceLayer(cells) : null;
    building.plainLayer = surface ?? roofBase + 3;
    building.layers = undefined; building.groundHex = undefined; building.openings = undefined; building.parapetM = undefined; building.layoutScale = undefined;
    building.shop = false; building.shopfront = false; building.signature = undefined; building.chain = undefined;
    if (industrial === 'tank') { building.roof = undefined; building.flatRoof = undefined; building.measuredRoof = undefined; }
    building.industrial = industrialMeshSpec(id, industrial, heightM - minHeightM, footprintAreaM2(feature.geometry), tone);
  }
  // Facade extras for every faced building; the plain and Untextured looks stay light.
  // Never on a landmark kit's walls: church hosts drew hoist beams and stray strips (user 2026-10-03).
  building.extras = !building.bare && !p.kitWall && !p.largeTier && look !== 'untextured';
  // The post-1965 housing kit (`?postwarKit=1`, postwarKit/kit.ts): the read's balconies, arcade and erkers on the street
  // walls, forced like register parts. Never on a spec'd, row, design-unit, kit or glazed pand. Off: postwar is undefined.
  if (postwar && building.extras && !specRecipe && !design && typeof p.rowFront !== 'string' && !p.frontCarrier && !industrial) {
    const ids = postwarExtraIds(postwar);
    if (ids.length) {
      building.registerForce = [...(building.registerForce ?? []), ...ids];
      building.postwarKit = { balconyHex: postwar.balconyHex, pierHex: postwar.painted ? '#e4e0d6' : levelWallHex(building.wallHex) };
    }
  }
  if (design) { building.seed = design.seed; building.designSlice = { fromM: design.fromM, toM: design.toM, moduleM: design.moduleM }; if (design.bays) building.designBays = design.bays; if (design.bayPitchM) building.designPitchM = design.bayPitchM; }
  if (Array.isArray(p.registerForce) && p.registerForce.length && building.extras) building.registerForce = p.registerForce as string[];
  // A spec-stated stoop (houseSpec/decorate.ts specStoop, K-stoep #360): the extras draw it typed, first, on the door
  // wall nearest the street (threeBuildingMesh.ts stoopFor).
  if (p.specStoop && typeof p.specStoop === 'object' && building.extras) building.stoop = p.specStoop as StoopIntent;
  // Lane WG step 2 (houseSpec/routeAFields.ts): stated bands force the band-line components at the stated height.
  if (fieldsOf(p) && building.extras) {
    const draw = fieldsDraw(fieldsOf(p));
    const force = draw.force.filter(id => !building.registerForce?.includes(id));
    if (force.length) building.registerForce = [...(building.registerForce ?? []), ...force];
    if (draw.bandM && draw.force.length) building.specBandM = draw.bandM;
    if (draw.force.length) building.specFieldsForce = draw.force;
  }
  // Lane 1 step e (rowFront flag): subtract before adding. A front record's house draws only the plain extras
  // (ROW_FRONT_EXTRAS) and what a register or spec states; its shopfront takes the photo's colour muted, never a guessed brand colour.
  if (typeof p.rowFront === 'string') {
    // Window boxes (step d): the placed cell crops carry their own frame and sill; the grid's sill and frame extras would
    // cross the glass of a window that is not on the grid.
    const boxed = !!specRecipeOf(p)?.windowBoxes?.length;
    if (building.extras) building.onlyExtras = [...ROW_FRONT_EXTRAS.filter(id => !boxed || (id !== 'window-sills' && id !== 'white-window-frames')), ...(building.registerForce ?? []), ...(building.specFieldsForce ?? []), ...(p.rowFrontHoist ? ['hoist-beam'] : [])];
    // House rows (lane R): a series member's stated dressing (heads, cornice) dresses first, its dice seeded by the series.
    // The series record is the description: a per-pand spec's forced parts give way to what the series states
    // (`rowDress.extras`: bands and the like, read for the series), the register's stated parts stay.
    const dress = rowDressOf(p.rowDress);
    if (building.extras && typeof p.rowSeries === 'string') {
      building.rowSeries = p.rowSeries;
      // The series cornice's band: the storey cells stop under it so the top storey keeps its head dressing and the
      // frieze sits above (Kinkerstraat 100-106: the block course ran under the consoles).
      const band = ROW_CORNICE_BAND_M[String(dress?.cornice ?? 'none')] ?? 0;
      if (band > 0) building.parapetM = band;
      const ids = [...(dress?.heads?.length ? ['row-heads'] : []), ...(dress?.cornice ? ['row-cornice'] : []), ...(dress?.extras ?? []), ...(dress?.erker ? ['row-erker'] : [])];
      const register = Array.isArray(p.registerForce) ? p.registerForce as string[] : [];
      if (dress) building.rowDress = dress;
      building.registerForce = [...register, ...ids];
      building.specFieldsForce = ids;
      delete building.specBandM;
      building.onlyExtras = [...ROW_FRONT_EXTRAS.filter(id => (!boxed || (id !== 'window-sills' && id !== 'white-window-frames')) && !dress?.omitExtras?.includes(id)), ...register, ...ids, ...(p.rowFrontHoist ? ['hoist-beam'] : [])];
    }
    if (building.shopfront || building.shop) {
      // The photo's shopfront colour, muted (the row keeps its variety); none read: the plain dark band.
      const traced = (specRecipeOf(p) as { fasciaHex?: unknown } | undefined)?.fasciaHex;
      const hex = typeof traced === 'string' && /^#[0-9a-f]{6}$/i.test(traced) ? traced : rowFrontShopHex(specRecipeOf(p)?.shopHex ?? (p.houseSpec as { shopHex?: unknown } | undefined)?.shopHex);
      building.accentHex = hex; building.signature = undefined; building.chain = undefined; if (building.layers) building.groundHex = hex;
    }
  }
  if (look === 'untextured') {
    // Untextured: one flat layer for every wall and roof face, so only colour and shape remain.
    const flat = roofBase + 3;
    building.bare = true; building.plainLayer = flat;
    if (building.roof) building.roof = { ...building.roof, layers: { slope: flat, plain: flat, dormer: flat } };
  }
  // The city-wide palette level (look/paletteLevel.ts, `?paletteLevel=0` for the before): generic photo-look walls only; a
  // landmark kit, a large recipe and a bare shed keep their authored colour.
  if (look === 'photo' && !p.kitWall && !p.kitWallHex && !p.largeTier && !building.bare) building.wallHex = levelWallHex(building.wallHex);
  // An OSM glass or mirror part (skybridge, oriel, atrium; glassParts.ts) is a curtain wall, not a blue slab. Absent tag = as before.
  const glazing = glazingOf(p);
  if (glazing && !p.kitWall && !p.gardenShed && !p.frontCarrier && !(industrial && industrial !== 'office')) applyGlazing(building, glazing, look, p.colour);
  return building;
}


/**
 * The contemporary family's set-back top storey (contemporaryFamily.ts): the body stops a storey short under its own
 * flat lid (the terrace), and the top storey stands SETBACK_INSET_M in from the outer walls, glazed in the curtain
 * cell under anthracite panel cladding. Only for a faced flat-roofed building the family marked, with a clean inset
 * outline (insetRing); anything else draws as before.
 */
export function withSetbackCrown(b: MeshBuilding, look: BuildingLook): MeshBuilding[] {
  if (!b.setbackCrown || b.bare || b.roof || !b.lid || !b.layers || b.surveyedEnvelope || b.polygons.length !== 1) return [b];
  const top = b.heightM, bodyTop = top - SETBACK_STOREY_M;
  if (bodyTop - b.minHeightM < 2 * SETBACK_STOREY_M) return [b];
  const inset = insetRing(b.polygons[0][0], SETBACK_INSET_M);
  if (!inset) return [b];
  const cladding = lookHex(SETBACK_CLADDING_HEX, look);
  const body: MeshBuilding = { ...b, heightM: bodyTop, setbackCrown: false, measuredRoof: undefined, flatRoof: b.flatRoof ? { ...b.flatRoof, box: false } : undefined };
  const crown: MeshBuilding = {
    ...b, id: `${b.id}:setback`, rangeOwner: b.id, polygons: [[inset]], minHeightM: bodyTop, heightM: top, setbackCrown: false,
    wallHex: cladding, accentHex: cladding, groundHex: undefined, layers: { upper: bayLayer('modern', 7, 'upper'), ground: bayLayer('modern', 7, 'upper'), door: bayLayer('modern', 7, 'upper') },
    shop: false, shopfront: false, signature: undefined, chain: undefined, extras: false, streetAppearance: undefined, gardenRoom: undefined,
    flatRoof: b.flatRoof ? { ...b.flatRoof, lip: false } : undefined, period: undefined,
  };
  return [body, crown];
}

/** `gardenRoom: rule` for a shed that is a garden room (gardenRooms.ts), nothing otherwise. */
const gardenRoomMark = (f: Feature): { gardenRoom?: string } => {
  const ring = asPolygons(f.geometry)[0]?.[0], rule = ring ? gardenRoomRule(f.properties, ringAreaM2(ring)) : null;
  return rule ? { gardenRoom: rule } : {};
};
type RoomContext = { items: Array<{ id: string; ring: Pt[]; areaM2: number; box: [number, number, number, number] }> };
const KX_ORIGIN = 111_320 * Math.cos(ORIGIN.lat * Math.PI / 180), KY_ORIGIN = 110_540;
const localRing = (ring: number[][]): Pt[] => ccwRing(ring.map(([lng, lat]) => [(lng - ORIGIN.lng) * KX_ORIGIN, (lat - ORIGIN.lat) * KY_ORIGIN] as Pt));
const ringArea = (r: readonly Pt[]) => Math.abs(r.reduce((s, a, i) => { const b = r[(i + 1) % r.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0) / 2);

/** Every pand's outer rings in local metres, for the garden rooms' party walls and main house. */
function gardenRoomContext(features: readonly Feature[]): RoomContext {
  const items: RoomContext['items'] = [];
  for (const f of features) for (const polygon of asPolygons(f.geometry)) {
    if (!polygon[0] || polygon[0].length < 4) continue;
    const ring = localRing(polygon[0]);
    const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
    items.push({ id: String(f.properties.id ?? ''), ring, areaM2: ringArea(ring), box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] });
  }
  return { items };
}

/** One garden room's extra triangles (gardenRooms.ts), from its outline, its neighbours and the chunk's streets. */
function gardenRoomTrisFor(f: Feature, building: MeshBuilding, look: BuildingLook, ctx: RoomContext, streets: SegmentGrid | null) {
  const polygons = asPolygons(f.geometry);
  if (polygons.length !== 1 || !polygons[0][0] || polygons[0][0].length < 4) return [];
  const id = String(f.properties.id ?? ''), ring = localRing(polygons[0][0]);
  const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]), r = HOUSE_REACH_M;
  const box = [Math.min(...xs) - r, Math.min(...ys) - r, Math.max(...xs) + r, Math.max(...ys) + r];
  const neighbours: Neighbour[] = ctx.items.filter(n => n.id !== id && n.box[0] <= box[2] && n.box[2] >= box[0] && n.box[1] <= box[3] && n.box[3] >= box[1]);
  const party = partyWalls(ring, neighbours);
  const house = mainHouse(ring, ringArea(ring), neighbours, streets);
  const year = f.properties.constructionYear === null || f.properties.constructionYear === undefined || !Number.isFinite(Number(f.properties.constructionYear)) ? null : Number(f.properties.constructionYear);
  const tone = (hex: string) => cellSetOf(look) === 'procedural' ? hex : lookHex(hex, look);
  return gardenRoomTriangles({ ring, heightM: building.heightM, glass: glassEdge(ring, party, house, house ? nearestStreetPoint(ring, streets) : null), party, design: designInLook(gardenRoomDesign(id, year), look), lidHex: building.lid?.hex ?? GARDEN_ROOM_TONES.lidEpdm, frameHex: tone(GARDEN_ROOM_TONES.frame), fasciaHex: tone(GARDEN_ROOM_TONES.fascia), glassHex: gardenRoomGlassHex(look) });
}

/**
 * Shell roofs (lane R1-A, #223, `?shellRoofs=0` off): a coarse or touch shell under a planned roof stops its walls at
 * the eaves and carries the detail path's planned roof, low-poly (no dormers, chimneys, white trim, shutters, turned
 * street ridges or ornamental crowns; a shaped gable becomes a plain one) in the same measured or planned roof colour.
 * Before, it was a full-height box under a flat lid (often a grey prior), so the detail chunk replacing it two to five
 * blocks out changed grey lid → pitched coloured roof in one frame (the user's S1 pop-in at the Hoftuin).
 */
export const shellRoofPlan = (plan: RoofPlan): RoofPlan => ({
  ...plan, kind: SHELL_ROOF_KIND[plan.kind] ?? plan.kind, dormers: false, chimney: false, accents: false, shutters: false, streetRidge: undefined, streetEnds: undefined, sourceCrownFront: undefined,
  gable: 'plain', clipToOutline: plan.clipToOutline, pieces: plan.pieces?.map(p => ({ ...p, plan: shellRoofPlan(p.plan) })),
});
/**
 * #257 (user shots 2026-11-08, the Stadhouderskade by the Hobbemastraat and the Geldersekade): where the detail cuts
 * a planned roof at the walls (roofMesh planBuildingRoof `clipToOutline`: a fitted box over a skewed wall, or an
 * irregular block roofed from its fitted box), the shell used to drop the cut and drew the whole box, up to 22 m of
 * roof beyond walls that stop at the eaves. The cut costs triangles (each slope is cut per outline triangle), and a
 * third of the planned roofs carry it for an eaves line a few decimetres out, invisible from a shell's distance; so a
 * shell cuts only where its uncut box stands more than this far past the walls.
 */
export const SHELL_ROOF_HANG_CLIP_M = 1;
const KX_SHELL = 111_320 * Math.cos(ORIGIN.lat * Math.PI / 180), KY_SHELL = 110_540;
/** How far (m) the roof of `plan` built uncut over `outer` (lng/lat) stands past the outline at most, from above. */
export function roofHangM(outer: readonly number[][], plan: RoofPlan, dims: RoofDims): number {
  const ring = outer.map(([lng, lat]) => [(lng - ORIGIN.lng) * KX_SHELL, (lat - ORIGIN.lat) * KY_SHELL]);
  if (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring.pop();
  const inside = (x: number, y: number) => { let r = false; for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) if ((ring[a][1] > y) !== (ring[b][1] > y) && x < (ring[b][0] - ring[a][0]) * (y - ring[a][1]) / (ring[b][1] - ring[a][1]) + ring[a][0]) r = !r; return r; };
  const toWall = (x: number, y: number) => { let d = Infinity; for (let a = 0; a < ring.length; a++) { const p = ring[a], q = ring[(a + 1) % ring.length], dx = q[0] - p[0], dy = q[1] - p[1], t = Math.max(0, Math.min(1, ((x - p[0]) * dx + (y - p[1]) * dy) / (dx * dx + dy * dy || 1))); d = Math.min(d, Math.hypot(x - p[0] - t * dx, y - p[1] - t * dy)); } return d; };
  let hang = 0;
  for (const t of roofTrianglesForOutlineUncut(outer, ORIGIN, plan, 0, dims, KX_SHELL)) for (const [x, y] of t.p) if (!inside(x, y)) hang = Math.max(hang, toWall(x, y));
  return hang;
}
/** The shell's roof plan for a building: shellRoofPlan, cut at the walls only where the uncut roof hangs past them (#257). */
export function shellRoofPlanFor(outer: readonly number[][], plan: RoofPlan, dims: RoofDims): RoofPlan {
  const low = shellRoofPlan(plan);
  return low.clipToOutline && roofHangM(outer, low, dims) <= SHELL_ROOF_HANG_CLIP_M ? { ...low, clipToOutline: false } : low;
}
/** Two-pitch and broken roofs read as a hip from a shell's distance (a mansard's kink is a few pixels); 6–9× fewer triangles. */
const SHELL_ROOF_KIND: Partial<Record<RoofPlan['kind'], RoofPlan['kind']>> = { mansard: 'hipped', mansardHip: 'hipped', school: 'hipped', halfHipped: 'hipped', sawtooth: 'pitched' };
/** A parapet roof is flat behind its parapet: the shell's lid at the same height already draws it. */
const shellRoofed = (plan: RoofPlan) => plan.kind !== 'parapet';
export type FeatureChunkOptions = { /** Coarse/touch shells get their planned roof, low-poly (shellRoofPlan). */ shellRoofs?: boolean;
  /** F1 (#380): the record-mode chunk (threeBuildingMesh ChunkOptions); absent, byte-identical. */ facadeRecord?: boolean; specFor?: ChunkOptions['specFor'] };

/** A chunk for a group of streamed features in one look. */
/** `streets`: flat street segments near the chunk, metres from ORIGIN (streetFronts.ts); doors then go only on the street side. */
export function buildFeatureChunk(features: readonly Feature[], look: BuildingLook, mode: 'walls' | 'extras' | 'coarse' | 'shell' = 'walls', streets?: Float32Array, profiles: readonly StreetAppearanceProfile[] = [], contextFeatures: readonly Feature[] = [], hostOpenings: readonly ChunkHostOpeningConfig[] = [], surveyedEnvelopes: ReadonlyMap<string,SurveyedMeshBinding> = new Map(), chunkOptions: FeatureChunkOptions = {}): Chunk {
  const garden = features.filter(isAllotmentHouse);
  // Garden sheds draw as low muted boxes in the near tier and not at all beyond it (gardenSheds.ts). Without the
  // chunk's streets nothing is classified, so a street kiosk is never dropped for want of a street file.
  const shedStreets = streets?.length ? new SegmentGrid(streets) : null;
  const marked = withTerraceSeeds(features.filter(f => !isAllotmentHouse(f)).map(f => isGardenShed(f, shedStreets, ORIGIN) ? { ...f, properties: { ...f.properties, gardenShed: true, height: shedHeightM(f.properties), ...gardenRoomMark(f) } } : f), (lng, lat) => !!buurtProfileAt(lng, lat), contextFeatures, replanTerraceRoof);
  // Garden rooms need their neighbours (party walls, the main house): only built when the chunk has one.
  const roomContext = mode === 'walls' && marked.some(f => f.properties.gardenRoom) ? gardenRoomContext([...marked, ...contextFeatures]) : null;
  const chunk = buildChunk(marked.filter(f => !(mode === 'coarse' && f.properties.gardenShed)).map(f => {
    const flat = mode === 'coarse' || mode === 'shell';
    // Shell roofs: the same roof decision as the detail chunk (its visual roof from the street profiles included).
    const shellRoof = flat && !!chunkOptions.shellRoofs && !f.properties.gardenShed && !f.properties.kitRoof;
    // House rows: a series member's roof is its series' (no surveyed visual roof in place of it).
    const visualRoof = (!flat || shellRoof) && profiles.length && typeof f.properties.rowSeries !== 'string' ? sourceVisualRoof(f, profiles) : undefined;
    const building = meshBuildingFor(visualRoof?.feature ?? f, look, flat && !shellRoof, visualRoof?.plan);
    if (building && roomContext && f.properties.gardenRoom) building.gardenRoom = { tris: gardenRoomTrisFor(f, building, look, roomContext, shedStreets) };
    if(building){
      const binding=surveyedEnvelopes.get(building.id),geometry=f.geometry as {type?:string;coordinates?:number[][][]};
      // House rows: a series member draws its series' roof storey, not 3DBAG's surveyed envelope over its wall top.
      if(binding&&typeof f.properties.rowSeries!=='string'&&binding.nativeParentId===building.id&&geometry.type==='Polygon'&&binding.installedFootprintFingerprint===envelopeFootprintFingerprint(geometry as {type:'Polygon';coordinates:number[][][]})&&binding.nativeMetadata.aggregateHeightM===Number(f.properties.height)&&binding.nativeMetadata.constructionYear===Number(f.properties.constructionYear)&&binding.meshOrigin.lng===ORIGIN.lng&&binding.meshOrigin.lat===ORIGIN.lat)building.surveyedEnvelope=binding;
    }
    if (building && shellRoof && building.roof && !building.surveyedEnvelope && shellRoofed(building.roof.plan)) {
      // Walls (and their windows) stop at the eaves under the low-poly planned roof, in the detail's roof colour.
      building.roof = { ...building.roof, plan: shellRoofPlanFor(building.polygons[0]?.[0] ?? [], building.roof.plan, building.roof.dims), lowPoly: true };
      building.extras = false;
    } else if (building && (mode === 'coarse' || mode === 'shell')) {
      // Keep textured windows and ground-floor doors at every distance. Simplify
      // roofs and omit relief; a plain shell made normal street views look empty.
      // A church host's raw maximum can be its towers. Its semantic kit eaves
      // must survive coarse LOD or a full-height capped shell buries the roof.
      building.heightM = f.properties.kitRoof ? wallTopHeightM(f.properties) : Number(f.properties.height) || building.heightM;
      building.roof = undefined;
      building.extras = false;
      if (building.flatRoof) building.flatRoof = { ...building.flatRoof, coarse: true };
      // Continue into local facade context below: coarse LOD drops relief and
      // shaped roofs, while its existing cheap window cells keep the street rhythm.
    }
    if (building && mode !== 'shell' && profiles.length && look !== 'untextured' && !f.properties.kitWall && !f.properties.frontCarrier && !f.properties.largeTier && !f.properties.gardenShed && !building.industrial) {
      const localProfiles = profilesNearBuilding(profiles, building.polygons);
      if (!localProfiles.length) return building;
      const p = f.properties;
      const sourcedWall = [p.facadeMappedColour, p.sideColourSource === 'measured-accepted' ? p.sideColour : undefined].find(value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value));
      const mappedWallHex = look === 'photo' ? sourcedWall as string | undefined : undefined;
      building.streetAppearance = { profiles: localProfiles, look, sourceHeightM: Number(f.properties.height) || building.heightM, year: p.constructionYear == null || !Number.isFinite(Number(p.constructionYear)) ? null : Number(p.constructionYear), mappedWallHex, shopfront: shopfrontOf(p), periodWallHex: periodWallOf(p) };
    }
    return building;
  }).filter((b): b is MeshBuilding => !!b).flatMap(b => b.setbackCrown ? withSetbackCrown(b, look) : [b]), ORIGIN, mode === 'coarse' ? 'walls' : mode, streets, contextFeatures.map(f=>{const roofed=(mode==='coarse'||mode==='shell')&&!!chunkOptions.shellRoofs&&!f.properties.gardenShed&&!f.properties.kitRoof;const b=meshBuildingFor(f,look,(mode==='coarse'||mode==='shell')&&!roofed);if(b){const binding=surveyedEnvelopes.get(b.id),g=f.geometry as {type?:string;coordinates?:number[][][]};if(binding&&typeof f.properties.rowSeries!=='string'&&binding.nativeParentId===b.id&&g.type==='Polygon'&&binding.installedFootprintFingerprint===envelopeFootprintFingerprint(g as {type:'Polygon';coordinates:number[][][]})&&binding.nativeMetadata.aggregateHeightM===Number(f.properties.height)&&binding.nativeMetadata.constructionYear===Number(f.properties.constructionYear)&&binding.meshOrigin.lng===ORIGIN.lng&&binding.meshOrigin.lat===ORIGIN.lat)b.surveyedEnvelope=binding;}if(b&&(mode==='coarse'||mode==='shell')&&!(roofed&&b.roof&&shellRoofed(b.roof.plan))){b.heightM=f.properties.kitRoof?wallTopHeightM(f.properties):Number(f.properties.height)||b.heightM;b.roof=undefined;}return b;}).filter((b):b is MeshBuilding=>!!b), hostOpenings, chunkOptions.facadeRecord ? { facadeRecord: true, ...(chunkOptions.specFor ? { specFor: chunkOptions.specFor } : {}) } : {});
  // F1 record mode: allotment houses are appended in the legacy layout only (no record arrays for them yet).
  if (!garden.length || mode === 'extras' || chunk.record) return chunk;
  const flatLayer = (cellSetOf(look) === 'procedural' ? CELL_LAYER_COUNT : BAY_LAYER_COUNT) + 3;
  return appendAllotmentHouses(chunk, garden, ORIGIN, flatLayer, mode === 'coarse' || mode === 'shell');
}
