// One streamed cell of the own ground (pure, DOM-free; built in the ground
// worker). The same layers as the prototype page (main.ts), restricted to
// what the cell owns so neighbouring cells never draw anything twice:
//
//   land grid     the cell rectangle exactly (grid aligned to global multiples
//                 of the step, so seams share vertices' heights)
//   water, quays  the cell's water polygons and shores (elevation-v1 clips them per cell)
//   decks         measured/flat decks whose first station lies in the cell
//   streets       OSM ways whose midpoint lies in the cell (the junction graph
//                 sees the 3×3 neighbourhood, so kerbs are trimmed at seams too)
//   areas         parks/squares/parking whose bbox centre lies in the cell
//
// LOD 0 is the prototype's detail. LOD 1 (the far ring) is a 10 m land grid,
// carriageways only (no kerbs, sidewalks or paint), coarser drape and walls.
//
// Detail (CANAL-RECALL-7): a `touch` cell (a touch device, far from the rider)
// is built as LOD 0's layers — the surveyed roads, kerbs, paint, tram — with the
// land grid, the drapes, the quay wall and the kerbs at the far ring's coarser
// steps and without bollards or park furniture. Every layer keeps its footprint,
// so the seams with a `full` neighbour are unchanged.
//
// The water mask (signed distance, R = water, G = water minus decks) covers
// the cell plus what its streets and areas reach past it (capped), at 1 m
// (LOD 0) or 2 m (LOD 1).

import earcut from 'earcut';
import { buildWaterMask, maskDistance, maskTexels, quayWallMesh, waterSurfaceMesh, waterZAt, type WaterGeometry } from './water.js';
import { drapeTriangles, emptyMesh, gridHeight, merge, reliefGrid, type MeshArrays } from './drape.js';
import { buildStreets, isBridgeWay, prepareWays, resolvePriorSidewalks, LIFT, ROAD_MARK_LIFT, type LocalWay } from './streets.js';
import { bandCorridor, COVERED_TOP_SINK_M, DECK_REACH_MAX_M, deckReach, deckWidths, flatDeckBody, floatingEnds, footprintAxis, measuredDeckBody, measuredDeckTop, movableFrame, movableLeaves, pointInRing, underDeck, type DeckBuildInfo } from './decks.js';
import { crossingWays } from './railingRuns.js';
import { inLandedPlatform } from './landedPlatforms.js';
import { pavedAreaSurface, type OsmGroundExtract } from './osmGround.js';
import { buildParks, cullCovered, decodeLine, drapeBisect, flatten, CULL_MARGIN_M, CULL_RES_M, CLEARANCE_M, CLEARANCE_FAR_M, PARK_LIFT, SURFACE_LAYER, SurfaceIndex, type ParkBuildStats, type ParksCell, type SurfaceRaster } from './parks.js';
import { COURTYARD_SURFACES, type CourtyardsCell } from './courtyards.js';
import { cycleThrough, type ThroughStats } from './cycleThrough.js';
import { fillPockets, POCKET_LIFT, type PocketCover, type PocketStats, type SurveyGap, SURVEY_GAP_MIN_R } from './pockets.js';
import { buildRoadSurfaces, deckLevelHeight, RoadIndex, type RoadBuildStats } from './roadSurfaces.js';
import { ANCILLARY_CLASSES, type RoadCell } from './roadCells.js';
import type { RoadMark } from './roadMarks.js';
import type { PhotoEvidence } from './photoEvidence.js';
import { buildSurveyMarkings, crossingStripPoints, SURVEY_MARKINGS, type SurveyMarkingStats } from './surveyMarkings.js';
import type { DeckSurface, GroundSurface, Vec2 } from './surface.js';
import { sourceTracing, triangleSources, type GroundSource } from './sourceTrace.js';
import type { Rect } from './groundStore.js';
import { RAIL_VIADUCTS, viaductMesh, type ViaductBuild } from './railViaducts.js';

export type GroundLayer =
  | 'land' | 'park' | 'wood' | 'square' | 'parking'
  | 'lawn' | 'bed' | 'shrub' | 'bark' | 'sand' | 'parkGravel' | 'parkPath' | 'pond' | 'hedge' | 'furniture'
  | 'asphalt' | 'klinker' | 'brick' | 'cycle' | 'paving' | 'gravel' | 'kerb' | 'paint' | 'tram' | 'bollard'
  | 'water' | 'quay' | 'deckBody' | 'deckTop'
  /** Courtyard green (lane road-look-continuity 2026-10-29): an OSM green fill that meets no road polygon. Appended: layer ids stay. */
  | 'garden';

export const GROUND_LAYERS: readonly GroundLayer[] = ['land', 'park', 'wood', 'square', 'parking', 'lawn', 'bed', 'shrub', 'bark', 'sand', 'parkGravel', 'parkPath', 'pond', 'hedge', 'furniture', 'asphalt', 'klinker', 'brick', 'cycle', 'paving', 'gravel', 'kerb', 'paint', 'tram', 'bollard', 'water', 'quay', 'deckBody', 'deckTop', 'garden'];

/** Transferable mesh arrays. Colours are sRGB 0..1 when present. */
export interface PackedMesh { positions: Float32Array; normals: Float32Array; uvs: Float32Array; indices: Uint32Array; colors?: Float32Array }

/**
 * How much detail a cell is built with (CANAL-RECALL-7). `full` is the desktop build and the near ring on every
 * device: every drape at its finest step, bollards and park furniture included. `touch` is a cell far from the rider
 * on a touch device: coarser drape steps and no small objects, with every layer's footprint unchanged (no holes at
 * the cell seams). It is a level of its own, not LOD 1: a touch cell keeps the surveyed road partition, kerbs, paint
 * and tram rails that LOD 1 drops.
 */
export type CellDetail = 'full' | 'touch';

export interface GroundMask { x0: number; y0: number; res: number; width: number; height: number; texels: Uint8Array }

export interface BuiltCell {
  key: string;
  lod: 0 | 1;
  /** The level this build used (gameGround.ts, touch devices far from the rider): see CellInput.detail. */
  detail: CellDetail;
  rect: Rect;
  layers: Partial<Record<GroundLayer, PackedMesh>>;
  mask: GroundMask | null;
  /** Source code per triangle per layer (sourceTrace.ts), only when tracing is on (diagnostics). */
  sources?: Partial<Record<GroundLayer, Uint8Array>>;
  stats: { triangles: number; byLayer: Record<string, number>; ways: number; areas: number; decks: number; flatDecks: number; buildMs: number; bytes: number; bridges: BridgeStats; parks: (ParkBuildStats & { ms: number; fillCulled?: number; landCulled?: number }) | null; pockets?: PocketStats | null; greenLandCulled?: number; /** OSM green rings cut out of the paved area fills (areas + holes). */ greenCut?: number; /** Build time per phase, ms (diagnostics). */ phases?: Record<string, number>; /** roads-v1 (roadSurfaces.ts): what the surveyed partition drew, the land quads culled under it, the street pass's clips. */ /** Rail viaducts over streets (railViaducts.ts) the cell drew: deck, wall and floor heights. */ viaducts?: ViaductBuild[]; /** OSM green fills drawn as courtyard `garden`. */ courtyardGreens?: number; roads?: (RoadBuildStats & { landCulled: number; coveredWays: number; clipped?: Record<string, number>; decksCovered: number; /** Footway islands between parking bays drawn as street. */ parkingIslands?: number; /** Footway strips across the road at a crossing drawn as carriageway. */ crossingStrips?: number; /** Fietsstraat sections drawn grey on the photo's evidence. */ greyFiets?: number; /** surveyMarkings.ts: what the survey-aware markings drew. */ markings?: SurveyMarkingStats | null; /** cycleThrough.ts: red bands across junction mouths. */ through?: ThroughStats | null }) | null; courtyards?: number };
}

/** What the cell's bridges drew: deck tops, railing posts, piers, arches, abutments, movable frames (lane report, named regressions). */
export interface BridgeStats { tops: number; railed: number; railingPosts: number; piers: number; arches: number; abutments: number; frames: number; decks: DeckBuildInfo[]; flat: { id: string; railingPosts: number; frames: number }[]; /** Deck ends that float (decks.ts floatingEnds; flat footprints still over water past the reach): "id:end:reason". */ floating: string[] }

export interface CellInput {
  key: string;
  lod: 0 | 1;
  /** Detail level of this build (CellDetail above); default 'full', the desktop build. */
  detail?: CellDetail;
  rect: Rect;
  surface: GroundSurface;
  water: WaterGeometry | null;
  /** Water of the 3×3 neighbourhood (for the mask's distances at seams). */
  waterAround: WaterGeometry[];
  decks: readonly DeckSurface[];
  /** Every placed deck's footprint near the cell (street mask exceptions). */
  deckRingsAround: readonly Vec2[][];
  flatDecks: readonly Vec2[][];
  /** Per flat deck (same order): register id and whether it is movable ('Beweegbare brug'). */
  flatDeckMeta?: readonly { id: string; movable: boolean }[];
  /** Landed platforms (landedPlatforms.ts, game frame): the quay wall leaves out shore segments inside them. */
  landedPlatforms?: readonly (readonly Vec2[])[];
  osm: OsmGroundExtract | null;
  osmAround: OsmGroundExtract[];
  /** The cell's parks (parks-v1), null when it has none or parks are off. */
  parks?: ParksCell | null;
  /** Parks of the 3×3 neighbourhood (a park's BGT surfaces lie in the cells of their own interior points). */
  parksAround?: readonly (ParksCell | null)[];
  /** Pave the land pockets near junctions (pockets.ts); default on at LOD 0. */
  pockets?: boolean;
  /** roads-v1: pave the survey-gap discs at junction nodes (default on; off only for the regression's pin). */
  surveyGaps?: boolean;
  /** Clip measured deck tops and faces to the water and the street bands (decks.ts deckWidths); default on. */
  clipDecks?: boolean;
  /** Sink a covered deck's top past its span under the survey's ground polygons (decks.ts COVERED_TOP_SINK_M); default on. */
  deckEnds?: boolean;
  /** The cell's surveyed road partition (roads-v1, roadSurfaces.ts), null when it has none or roads are off. */
  roads?: RoadCell | null;
  /** roads-v1 cells of the 3×3 neighbourhood (polygons live in the cell of their interior point). */
  roadsAround?: readonly (RoadCell | null)[];
  /** road-marks-v1 nodes of the 3×3 neighbourhood (roadMarks.ts): crossings, signals, give-way and stop nodes. */
  marks?: readonly RoadMark[];
  /** OSM way ids the neighbourhood's road polygons cover (roadCells coverWays): no bands for them. */
  coverWays?: readonly number[];
  /** What the orthophoto backs of the tag-driven paint (photoEvidence.ts): lane ribbons, centre dashes, grey fietsstraat sections. */
  evidence?: PhotoEvidence;
  /** roads-v1 ground drape overrides for the measurement scripts (roadSurfaces RoadBuildInput). */
  drape?: { drapeTol?: number; drapeFloatTol?: number };
  /** OSM path ways the 3×3 neighbourhood's park path polygons replace (not drawn as bands). */
  dropWays?: readonly number[];
  /** The cell's BGT courtyards (courtyards-v1), null when it has none or they are off. */
  courtyards?: CourtyardsCell | null;
  /** Courtyards of the 3×3 neighbourhood (their outer rings hide this cell's land quads too). */
  courtyardsAround?: readonly (CourtyardsCell | null)[];
  project: (lngLat: [number, number]) => Vec2;
}

/** How far the mask may extend past the cell, metres. */
const MASK_REACH_M = 150;
/** Layers whose material multiplies vertex colours that only some of their meshes carry: the rest are padded white. */
export const VERTEX_TINTED: ReadonlySet<GroundLayer> = new Set<GroundLayer>(['kerb']);
/** The roads-v1 lookup raster reaches this far past the cell (the cell's own ways and their paint seldom reach further). */
const ROAD_FAST_PAD_M = 60;
/**
 * Quay-wall stations in a `touch` cell (CANAL-RECALL-7): the wall is a bank of coping, brick and algae rows along the
 * shore; 16 m stations still follow a canal's curve at chase distance, while the near ring's is 4 m and LOD 1's 8.
 */
export const TOUCH_QUAY_STEP_M = 16;
/** Canal-belt water surface, scene z (−0.40 m NAP under the +1.37 m NAP datum): the default where no polder level is known. */
export const CANAL_WATER_Z = -1.77;
/** Signed-distance range of the water mask (texels saturate at ±this), metres. */
export const MASK_RANGE_M = 4;
/** Coping cap on every quay wall, reaching this far inland over the land's cut edge (water.ts). */
export const QUAY_CAP_M = 0.35;

/** Area-weighted vertex normals (three's computeVertexNormals), here so the main thread need not. */
export function vertexNormals(positions: Float32Array, indices: Uint32Array): Float32Array {
  const n = new Float32Array(positions.length);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) { n[k] += nx; n[k + 1] += ny; n[k + 2] += nz; }
  }
  for (let k = 0; k < n.length; k += 3) {
    const l = Math.hypot(n[k], n[k + 1], n[k + 2]);
    if (l > 0) { n[k] /= l; n[k + 1] /= l; n[k + 2] /= l; } else n[k + 2] = 1;
  }
  return n;
}

export function packMesh(m: MeshArrays): PackedMesh {
  const positions = Float32Array.from(m.positions), indices = Uint32Array.from(m.indices);
  return { positions, normals: vertexNormals(positions, indices), uvs: Float32Array.from(m.uvs), indices, ...(m.colors ? { colors: Float32Array.from(m.colors) } : {}) };
}

export const packedTriangles = (m: PackedMesh) => m.indices.length / 3;
export const packedBytes = (m: PackedMesh) => m.positions.byteLength + m.normals.byteLength + m.uvs.byteLength + m.indices.byteLength + (m.colors?.byteLength ?? 0);

/** Transfer list for postMessage. */
export function cellTransferables(cell: BuiltCell): ArrayBuffer[] {
  const out: ArrayBuffer[] = [];
  for (const m of Object.values(cell.layers)) if (m) { out.push(m.positions.buffer as ArrayBuffer, m.normals.buffer as ArrayBuffer, m.uvs.buffer as ArrayBuffer, m.indices.buffer as ArrayBuffer); if (m.colors) out.push(m.colors.buffer as ArrayBuffer); }
  if (cell.mask) out.push(cell.mask.texels.buffer as ArrayBuffer);
  return out;
}

/**
 * The far ring's cross-section: every band, flat (no kerbs), no paint. It
 * used to keep carriageways only, so beyond 350 m a street's cycle tracks,
 * sidewalks and separate cycle paths vanished into the land's paving: the
 * De Clercqstraat block past the Bilderdijkstraat cell seam read as an open
 * grey plaza with a ragged strip of asphalt (named regression in
 * check-ground-cells.ts).
 */
function farSection(w: LocalWay): LocalWay {
  const bands = w.section.bands.map(b => (b.raised ? { ...b, raised: 0, kerb: 'none' as const } : b));
  return { ...w, section: { ...w.section, bands, paint: [], rails: [] } };
}

/**
 * Where no survey draws the street (LOD 1 cells, and the cells without roads-v1): one grey carriageway per way
 * (lane roads-lanes 2026-10-23, R2). The painted cycle lanes join the carriageway in its own grey (BGT's rijbaan
 * holds them; the photo rarely shows them red) and the carriageway's paint goes (centre and edge lines from priors).
 * A klinker carriageway stays klinker only when its `surface` tag says so; a fietsstraat (tagged) stays red. Paths
 * keep their bands. The class-prior sidewalks stay: dropped, the De Clercqstraat LOD 1 regression read 20 % of its
 * band probes as bare land between the road and the houses (a gap is the user's first complaint, R1).
 */
export function plainSection(w: LocalWay): LocalWay {
  const own = w.section.bands[0];
  if (own?.kind !== 'carriageway') return w;
  const tagged = !!w.tags.surface || own.surface === 'cycle';
  const surface = tagged ? own.surface : 'asphalt';
  const bands = w.section.bands.map(b => (b.kind === 'carriageway' ? { ...b, surface } : b.kind === 'cycle_lane' ? { ...b, kind: 'carriageway' as const, surface } : b));
  return { ...w, section: { ...w.section, bands, paint: [] } };
}

export function buildCell(input: CellInput): BuiltCell {
  const t0 = Date.now();
  const { key, lod, rect, surface } = input;
  /** A cell far from the rider on a touch device: coarser drapes, no bollards or furniture (CellDetail). */
  const detail: CellDetail = input.detail === 'touch' ? 'touch' : 'full';
  const touch = detail === 'touch';
  /** The finest level this build uses: LOD 0 at `full` detail. */
  const fine = lod === 0 && !touch;
  const [x0, y0, x1, y1] = rect;
  const parts: Partial<Record<GroundLayer, MeshArrays[]>> = {};
  const tracing = sourceTracing(), from: Partial<Record<GroundLayer, GroundSource[]>> = {};
  const add = (layer: GroundLayer, m: MeshArrays, src: GroundSource = 'other') => { if (m.indices.length) { (parts[layer] ??= []).push(m); if (tracing) (from[layer] ??= []).push(src); } };
  const phases: Record<string, number> = {};
  let tPhase = t0;
  const phase = (name: string) => { const now = Date.now(); phases[name] = (phases[name] ?? 0) + now - tPhase; tPhase = now; };

  // Streets: the cell's own ways, with the neighbourhood in the junction graph.
  const dropped = new Set<number>(input.dropWays ?? []);
  const seen = new Set<number>(dropped), all: LocalWay[] = [], own = new Set<number>();
  for (const extract of [input.osm, ...input.osmAround]) if (extract) for (const w of prepareWays(extract.ways, input.project)) {
    if (seen.has(w.id)) continue;
    seen.add(w.id); all.push(w);
  }
  for (const w of input.osm?.ways ?? []) if (!dropped.has(w.id)) own.add(w.id);
  const resolved = resolvePriorSidewalks(all);
  // No survey under the cell's streets (LOD 1, or a cell without roads-v1 while roads are on): plainSection.
  const unsurveyed = lod === 1 || (input.roadsAround !== undefined && !input.roads?.surfaces.length);
  const ways = lod === 0 ? (unsurveyed ? resolved.map(plainSection) : resolved) : resolved.map(w => farSection(plainSection(w)));
  const areas = input.osm?.areas ?? [];

  // Mask extent: the cell plus what its ways and areas reach (capped).
  let mx0 = x0, my0 = y0, mx1 = x1, my1 = y1;
  const grow = (p: Vec2) => { mx0 = Math.min(mx0, p[0] - 8); my0 = Math.min(my0, p[1] - 8); mx1 = Math.max(mx1, p[0] + 8); my1 = Math.max(my1, p[1] + 8); };
  for (const w of ways) if (own.has(w.id)) w.points.forEach(grow);
  for (const a of areas) for (const r of a.rings) for (const p of r) grow(input.project(p));
  for (const d of input.decks) { grow([d.profile.bbox[0], d.profile.bbox[1]]); grow([d.profile.bbox[2], d.profile.bbox[3]]); }
  mx0 = Math.max(mx0, x0 - MASK_REACH_M); my0 = Math.max(my0, y0 - MASK_REACH_M); mx1 = Math.min(mx1, x1 + MASK_REACH_M); my1 = Math.min(my1, y1 + MASK_REACH_M);
  const res = fine ? 1 : 2;
  const geoAround: WaterGeometry = { polygons: input.waterAround.flatMap(g => g.polygons), shores: input.waterAround.flatMap(g => g.shores), levels: input.waterAround.flatMap(g => g.levels ?? g.polygons.map(() => CANAL_WATER_Z)) };
  const hasWater = geoAround.polygons.length > 0;
  const mask = hasWater ? buildWaterMask(geoAround, mx0, my0, mx1, my1, res, MASK_RANGE_M, input.deckRingsAround) : null;
  const overWater = (x: number, y: number) => !!mask && maskDistance(mask, x, y) < 0;
  const step = fine ? 5 : 10;
  // Everything flat on the land (areas, street bands) drapes on the land grid's own surface plus
  // the decks' lift, so the grid never pokes through between their vertices.
  const landZ = gridHeight(surface.ground, step);
  // On a deck the measured surface wins (blended over the deck's lateral blend).
  const onLand = (x: number, y: number) => {
    const w = surface.deckWeight(x, y);
    // Off every deck (nearly every vertex) the riding surface is the relief: the land grid's own surface, one lookup.
    if (w <= 0) return landZ(x, y);
    const h = surface.height(x, y);
    return w >= 1 ? h : h * w + (landZ(x, y) + h - surface.ground(x, y)) * (1 - w);
  };

  // Land: the relief grid over the rectangle; quads deep inside a canal skipped.
  const gx0 = Math.floor(x0 / step) * step, gy0 = Math.floor(y0 / step) * step;
  // Grid on global multiples of the step, clipped to the cell by whole quads
  // whose centre is inside, so two cells never both draw a quad.
  const inCell = (x: number, y: number) => x >= x0 && x < x1 && y >= y0 && y < y1;
  const areaLayer: Record<string, GroundLayer> = { park: 'park', grass: 'park', wood: 'wood', square: 'square', paved: 'square', parking: 'parking' };
  // The BGT park surfaces (parks-v1) hide what lies under them: the OSM park fill and the land grid, where a whole
  // triangle / quad lies inside one surface (parks.ts cullCovered). The park surfaces drape at 8 m and sag a few
  // centimetres under the 5 m land grid in hollows (the Vondelpark showed land through its lawn once the fill went),
  // so the land goes too, but only under the cell's own surfaces (drawn by this build, never missing).
  const surveyed = lod === 0 && input.parksAround?.some(p => p?.surfaces.length) ? new SurfaceIndex([input.parks, ...(input.parksAround ?? [])]) : null;
  let cover: SurfaceRaster | null = null;
  if (surveyed) {
    const sb = surveyed.bounds()!, ab: [number, number, number, number] = [x0 - 10, y0 - 10, x1 + 10, y1 + 10];
    for (const a of areas) if (areaLayer[a.kind] === 'park') for (const r of a.rings) for (const q of r) { const [px, py] = input.project(q); ab[0] = Math.min(ab[0], px); ab[1] = Math.min(ab[1], py); ab[2] = Math.max(ab[2], px); ab[3] = Math.max(ab[3], py); }
    const box: [number, number, number, number] = [Math.max(sb[0], ab[0]) - 1, Math.max(sb[1], ab[1]) - 1, Math.min(sb[2], ab[2]) + 1, Math.min(sb[3], ab[3]) + 1];
    if (box[2] > box[0] && box[3] > box[1]) cover = surveyed.raster(box, CULL_RES_M);
  }
  let landCulled = 0;
  /** OSM area fills that lie under a drawn BGT polygon are not drawn (roads lane R1: the Amstelstraat fill over the rijbaan). */
  let osmRoadCulled = 0;
  // Roads (roads-v1): the surveyed partition drawn before the land, so the land can be culled under the cell's own
  // polygons as under the park surfaces (never under a deck polygon that was not drawn: roadSurfaces skipped).
  phase('prepare');
  // The neighbours' polygons within ROAD_FAST_PAD_M of the cell and wherever the cell's own ways reach (the street pass
  // asks along all of them), uncapped.
  let rb: [number, number, number, number] = [x0 - ROAD_FAST_PAD_M, y0 - ROAD_FAST_PAD_M, x1 + ROAD_FAST_PAD_M, y1 + ROAD_FAST_PAD_M];
  for (const w of ways) if (own.has(w.id)) for (const p of w.points) rb = [Math.min(rb[0], p[0] - 10), Math.min(rb[1], p[1] - 10), Math.max(rb[2], p[0] + 10), Math.max(rb[3], p[1] + 10)];
  const roadIndex = lod === 0 && (input.roads?.surfaces.length || input.roadsAround?.some(r => r?.surfaces.length)) ? new RoadIndex([input.roads, ...(input.roadsAround ?? [])], rb) : null;
  // Footway islands between parking bays draw as street (RoadIndex.parkingIslands). A fietsstraat's red is decided
  // per section in the extract (roadCells fietsstraatSection), so there is no runtime override under tram track.
  const parkingIslands = roadIndex ? roadIndex.parkingIslands() : 0;
  // Fietsstraat sections the orthophoto shows grey draw as asphalt (photoEvidence greyFiets, RoadIndex.greyFietsstraat).
  const greyFiets = roadIndex && input.evidence ? roadIndex.greyFietsstraat(input.evidence.greyFiets) : 0;
  // Footway strips BGT maps across the road at a mapped crossing draw as the carriageway, zebra on them (crossingStrips).
  const crossingStrips = roadIndex && SURVEY_MARKINGS ? roadIndex.crossingStrips(crossingStripPoints(ways, input.marks ?? [])) : 0;
  phase('roadIndex');
  let roads: BuiltCell['stats']['roads'] = null;
  let roadCover: SurfaceRaster | null = null, roadSkipped: ReadonlySet<number> = new Set();
  const canalSide = fine && mask ? (x: number, y: number) => { const d = maskDistance(mask, x, y); return d > 0 && d < MASK_RANGE_M - 0.2; } : undefined;
  if (roadIndex && input.roads) {
    const built = buildRoadSurfaces(input.roads, roadIndex, { height: onLand, deckHeight: deckLevelHeight(surface, rect), deckWeight: surface.deckWeight, overWater, lod, canalSide, dataStep: (x, y) => surface.dataStepAt(x, y), ...(touch ? { detail: 'touch' as const } : {}), ...(input.drape ?? {}) });
    for (const [layer, m] of Object.entries(built.layers)) add(layer as GroundLayer, m!, 'bgtCarriage');
    roadSkipped = built.skipped;
    roads = { ...built.stats, landCulled: 0, coveredWays: input.coverWays?.length ?? 0, decksCovered: 0, parkingIslands, crossingStrips, greyFiets, markings: null };
  }
  // One raster serves the street pass's point lookups (RoadIndex.prepareFast) and the land culling under the own polygons.
  phase('roads');
  if (roadIndex) roadCover = roadIndex.prepareFast([x0 - ROAD_FAST_PAD_M, y0 - ROAD_FAST_PAD_M, x1 + ROAD_FAST_PAD_M, y1 + ROAD_FAST_PAD_M]);
  phase('roadRaster');
  let roadLandCulled = 0;
  // Own polygons that were drawn, and a neighbour cell's ground polygons reaching over the cell edge (the neighbour
  // draws them; its deck polygons may have been skipped there, so only h = 0 counts).
  const roadDrawn = roadIndex ? (() => {
    const ok = new Uint8Array(roadIndex.records.length);
    for (let k = 0; k < ok.length; k++) ok[k] = (k < roadIndex.own ? !roadSkipped.has(k) : roadIndex.records[k].h === 0) ? 1 : 0;
    return (k: number) => ok[k] === 1;
  })() : null;
  const underOwnSurface = (x: number, y: number) => {
    const h = step / 2 + CULL_MARGIN_M;
    if (cover && surveyed) {
      const k = cover.find(x, y);
      if (k >= 0 && k < surveyed.own && cover.uniform(x - h, y - h, x + h, y + h, k)) { landCulled++; return true; }
    }
    // Under the road partition: every texel of the quad (with the margin) on a drawn polygon, one or several (the
    // survey tiles the street, so a quad across a kerb is hidden by the two polygons either side; one polygon alone
    // left 99 % of the land under the streets, the 5 m quads rarely fit inside one pavement).
    if (roadCover && roadDrawn && roadCover.every(x - h, y - h, x + h, y + h, roadDrawn)) { roadLandCulled++; return true; }
    return false;
  };
  // The OSM green fills (park and grass areas, allotments, zoos) hide the land quads wholly inside them (ride review
  // 2026-10-14, Artis): a fill drapes at 8 m between vertices on the land grid's surface, so in a hollow of the 5 m grid
  // the land poked through it (14 % of the zoo read bare land). Nine points of the quad must lie inside one ring, and
  // none where a BGT park surface took the fill's place (that surface may be a neighbour's, not built here). A
  // neighbour's area counts too (an area is drawn whole by the cell of its bbox centre: Artis's west third lies in the
  // next cell, 54 % bare land there); at the resident ring's edge that cell may be the far ring's, or the basemap's.
  const greenAreas = [...areas, ...(input.osmAround ?? []).flatMap(o => o.areas)];
  // BGT courtyards (courtyards-v1, the cell's and its neighbours') are drawn with their holes (a hole may be a yard left
  // undrawn), so their probes must miss the holes. A ring narrower than a quad and its probes cannot hold one, so it is
  // not tested (same result, fewer tests: a Jordaan cell holds over a thousand courtyard rings).
  const courtyardRings = [input.courtyards, ...(input.courtyardsAround ?? [])].filter((c, i, all): c is CourtyardsCell => !!c && all.indexOf(c) === i)
    .flatMap(c => c.areas.map(a => { const r = a.r.map(decodeLine); return { pts: r[0], holes: r.slice(1) }; }));
  const greenRings = [...greenAreas.filter(a => areaLayer[a.kind] === 'park').flatMap(a => a.rings.map(r => ({ pts: r.slice(0, -1).map(input.project), holes: [] as Vec2[][] }))), ...courtyardRings]
    .filter(r => r.pts.length >= 3).map(({ pts, holes }) => ({ pts, holes, bb: [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))] }))
    .filter(g => g.bb[2] > x0 && g.bb[0] < x1 && g.bb[3] > y0 && g.bb[1] < y1 && g.bb[2] - g.bb[0] >= step + 0.5 && g.bb[3] - g.bb[1] >= step + 0.5);
  let greenCulled = 0;
  const underGreen = (x: number, y: number) => {
    if (!greenRings.length) return false;
    const h = step / 2 + 0.25, probes: Vec2[] = [];
    for (const dx of [-h, 0, h]) for (const dy of [-h, 0, h]) probes.push([x + dx, y + dy]);
    if (cover && probes.some(q => cover!.find(q[0], q[1]) >= 0)) return false;
    for (const g of greenRings) {
      if (x - h < g.bb[0] || x + h > g.bb[2] || y - h < g.bb[1] || y + h > g.bb[3]) continue;
      if (probes.every(q => pointInRing(g.pts, q[0], q[1]) && !g.holes.some(h => pointInRing(h, q[0], q[1])))) { greenCulled++; return true; }
    }
    return false;
  };
  const keepLand = (x: number, y: number) => inCell(x, y) && (!mask || maskDistance(mask, x, y) > -(step * 0.71 + 0.2)) && !underOwnSurface(x, y) && !underGreen(x, y);
  add('land', reliefGrid(gx0, gy0, Math.ceil(x1 / step) * step, Math.ceil(y1 / step) * step, step, surface.ground, keepLand), 'land');
  phase('land');

  // Areas.
  // A paved fill is cut where OSM green covers it. Both drape the same relief on their own triangulations, so on a
  // slope their heights cross by up to 2 cm (a square's 4 mm lift does not survive that), and at 300 m one depth
  // quantum is ~4 mm: the pair then interleaves per triangle, and the green shimmers through the paving in shards
  // that crawl as the camera moves (Rembrandtplein square, 2026-10-23). The green ring becomes a hole in the paving,
  // so there is no coplanar pair to fight over; what shows through is the green fill, or the BGT park surface that
  // replaced it (parks-v1 always draws one where its cover reaches), never the land.
  const greenCuts = greenAreas.filter(a => areaLayer[a.kind] === 'park' || areaLayer[a.kind] === 'wood')
    .flatMap(a => a.rings.slice(0, 1).map(r => r.slice(0, -1).map(input.project)))
    .filter(pts => pts.length >= 3)
    .map(pts => ({ pts, bb: [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))] as [number, number, number, number] }));
  /** A ring touching the paved outline would leave earcut a degenerate hole bridge; such a ring keeps its paving. */
  const HOLE_CLEARANCE_M = 0.05;
  const edgeDistance = (pts: Vec2[], x: number, y: number): number => {
    let best = Infinity;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const ax = pts[j][0], ay = pts[j][1], dx = pts[i][0] - ax, dy = pts[i][1] - ay, l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
      best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
    }
    return best;
  };
  const holesIn = (layer: GroundLayer, pts: Vec2[]): Vec2[][] => {
    if (layer === 'park' || layer === 'wood' || layer === 'garden' || !greenCuts.length) return [];
    const bb: [number, number, number, number] = [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))];
    return greenCuts.filter(g => g.bb[0] >= bb[0] && g.bb[1] >= bb[1] && g.bb[2] <= bb[2] && g.bb[3] <= bb[3]
      && g.pts.every(([x, y]) => pointInRing(pts, x, y) && edgeDistance(pts, x, y) >= HOLE_CLEARANCE_M)).map(g => g.pts);
  };
  let parkFillCulled = 0, greenCut = 0;
  // Culls an OSM fill's triangles wholly under drawn roads polygons (the fill would show as wiggly patches on the survey).
  const cullUnderRoads = (m: MeshArrays): MeshArrays => {
    if (!roadCover || !roadDrawn || !m.indices.length) return m;
    const p = m.positions, keep: number[] = [];
    for (let t = 0; t < m.indices.length; t += 3) {
      const a = m.indices[t] * 3, b = m.indices[t + 1] * 3, c = m.indices[t + 2] * 3;
      const cx = (p[a] + p[b] + p[c]) / 3, cy = (p[a + 1] + p[b + 1] + p[c + 1]) / 3;
      if (roadCover.find(cx, cy) >= 0 && roadCover.every(Math.min(p[a], p[b], p[c]) - CULL_MARGIN_M, Math.min(p[a + 1], p[b + 1], p[c + 1]) - CULL_MARGIN_M, Math.max(p[a], p[b], p[c]) + CULL_MARGIN_M, Math.max(p[a + 1], p[b + 1], p[c + 1]) + CULL_MARGIN_M, roadDrawn)) { osmRoadCulled++; continue; }
      keep.push(m.indices[t], m.indices[t + 1], m.indices[t + 2]);
    }
    return keep.length === m.indices.length ? m : { ...m, indices: keep };
  };
  // Courtyard green (lane road-look-continuity 2026-10-29): an OSM park, grass or wood fill that meets no road polygon
  // within COURTYARD_ROAD_M is a block-interior garden, drawn muted (groundLook gardenTone) instead of the saturated
  // park fill that read as lawn in every courtyard against the grey corridor. Parks meet their streets and paths.
  let courtyardGreens = 0;
  const isCourtyard = (a: { rings: [number, number][][] }): boolean => {
    if (!roadIndex) return false;
    const d = COURTYARD_ROAD_M;
    for (const r of a.rings) {
      const pts = r.map(input.project);
      for (let i = 0; i + 1 < pts.length; i++) {
        const p = pts[i], q = pts[i + 1], len = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.max(1, Math.ceil(len / 2));
        for (let k = 0; k < n; k++) {
          const x = p[0] + (q[0] - p[0]) * k / n, y = p[1] + (q[1] - p[1]) * k / n;
          if (roadIndex.findFast(x, y) >= 0 || roadIndex.findFast(x + d, y) >= 0 || roadIndex.findFast(x - d, y) >= 0 || roadIndex.findFast(x, y + d) >= 0 || roadIndex.findFast(x, y - d) >= 0) return false;
        }
      }
    }
    return true;
  };
  for (const a of areas) {
    let layer = a.kind === 'paved' ? pavedAreaSurface(a) : areaLayer[a.kind];
    if (!layer) continue;
    if ((layer === 'park' || layer === 'wood') && isCourtyard(a)) { layer = 'garden'; courtyardGreens++; }
    // Only the green fills need the clearance refinement (see drapeBisect): the land under a street or a square is
    // culled by the road partition or sits under paving that is already 3-4 cm clear.
    const clearance = layer === 'park' || layer === 'wood' || layer === 'garden' ? (fine ? CLEARANCE_M : CLEARANCE_FAR_M) : undefined;
    let m = emptyMesh();
    for (const r of a.rings) {
      const pts = r.slice(0, -1).map(input.project);
      if (pts.length < 3) continue;
      const holes = holesIn(layer, pts), holeAt: number[] = [];
      for (let h = 0, at = pts.length; h < holes.length; h++) { holeAt.push(at); at += holes[h].length; }
      const flat = pts.concat(...holes).flatMap(p => [p[0], p[1]]);
      greenCut += holes.length;
      // Longest-edge bisection (parks.ts): the n² split cost Westerpark's cell 159k triangles of park fill on earcut slivers.
      drapeBisect(m, flat, earcut(flat, holeAt), onLand, LIFT.area + (layer === 'square' ? 0.004 : 0), fine ? 8 : 16, clearance, fine ? 1 : 2, step);
    }
    if (cover && (layer === 'park' || layer === 'garden')) { const r = cullCovered(m, cover); m = r.mesh; parkFillCulled += r.dropped; }
    m = cullUnderRoads(m);
    add(layer, m, 'osmArea');
  }

  phase('areas');
  // Parks (parks-v1): BGT surfaces between the areas and the street bands, hedges, fences and furniture (parks.ts).
  let parkStats: BuiltCell['stats']['parks'] = null;
  if (input.parks) {
    const tp = Date.now();
    const built = input.parks.version === 2 ? buildParks(input.parks, onLand, lod, overWater, touch) : { layers: {}, stats: null };
    for (const [layer, m] of Object.entries(built.layers)) add(layer as GroundLayer, m!, 'park');
    if (built.stats) parkStats = { ...built.stats, ms: Date.now() - tp };
  }

  // Courtyards (courtyards-v1, courtyards.ts): BGT terrain of block interiors in the park surface layers, at their lifts,
  // holes kept (a hole is a shed or a neighbour's yard of another class); the land under them went with underGreen.
  let courtyards = 0;
  for (const a of input.courtyards?.areas ?? []) {
    if (!COURTYARD_SURFACES.includes(a.k)) continue;
    const { flat, holes } = flatten(a.r.map(decodeLine));
    if (flat.length < 6) continue;
    const m = emptyMesh();
    drapeBisect(m, flat, earcut(flat, holes), onLand, PARK_LIFT[a.k], fine ? 8 : 16, fine ? CLEARANCE_M : CLEARANCE_FAR_M, fine ? 1 : 2, step);
    // Their grass is courtyard green too (lane road-look-continuity 2026-10-29): the muted garden, not the park's lawn.
    add(SURFACE_LAYER[a.k] === 'lawn' ? 'garden' : SURFACE_LAYER[a.k], m, 'park');
    courtyards++;
  }

  // Streets: bridge ways sampled finer (decks hump over metres).
  const only = (bridge: boolean) => (w: LocalWay) => own.has(w.id) && isBridgeWay(w) === bridge;
  // Canal-side pavements (kerb within 3.8 m of water; the mask saturates at MASK_RANGE_M) get Amsterdammertjes, near ring only.
  // roads-v1: covered ways emit no bands; paint, rails and fills are clipped by the polygons (streets.ts RoadsOption).
  const roadsOpt = roadIndex ? { index: roadIndex, covered: new Set(input.coverWays ?? []), ...(input.evidence ? { evidence: input.evidence } : {}) } : undefined;
  phase('parks');
  const streets = buildStreets(ways, onLand, { step: fine ? 3 : 6, only: only(false), canalSide, markings: lod === 0, roads: roadsOpt });
  phase('streets');
  // Bridge ways follow the measured deck exactly (no land under a deck over water to poke through); 0.75 m at LOD 0:
  // on a hump a 1.5 m chord sags (~9 cm on a masonry arch, ~2 cm at 0.75 m), so the bands follow the profile closer.
  // Across, a vertex every 2 m (3 m far): a deck narrower than its mapped carriageway left the band's edges on the
  // relief beside it and the band sagged under the deck top (BRU0292 by 0.15 m; +1.8 % triangles per belt cell).
  const onBridges = buildStreets(ways, surface.height, { step: lod === 0 ? 0.75 : 3, only: only(true), acrossStep: lod === 0 ? 2 : 3, markings: lod === 0, roads: roadsOpt });
  for (const s of ['paving', 'klinker', 'asphalt', 'cycle', 'gravel', 'kerb', 'paint', 'tram', 'bollard'] as const) { add(s, streets[s], 'band'); add(s, onBridges[s], 'band'); }
  phase('bridgeStreets');
  // roads-v1: markings placed from the mapped crossings and the junction graph, measured on and clipped to the
  // surveyed carriageway polygons (surveyMarkings.ts; the old band paint stays off there, streets.ts PAINT_ON_SURVEY).
  let surveyMarks: SurveyMarkingStats | null = null;
  if (roadIndex && lod === 0 && SURVEY_MARKINGS) {
    const inCell = (p: Vec2) => p[0] >= x0 && p[0] < x1 && p[1] >= y0 && p[1] < y1;
    const mk = buildSurveyMarkings({ ways, ownsWay: w => own.has(w.id), ownsPoint: inCell, marks: input.marks ?? [], box: [rb[0] - 30, rb[1] - 30, rb[2] + 30, rb[3] + 30], index: roadIndex, height: onLand, lift: { paint: ROAD_MARK_LIFT.paint, red: ROAD_MARK_LIFT.lane }, ...(input.evidence ? { evidence: input.evidence } : {}) });
    add('paint', mk.paint, 'nodePaint'); add('cycle', mk.red, 'cycleCross');
    surveyMarks = mk.stats;
  }
  // The fietspad's red across the junction mouths the survey calls rijbaan (cycleThrough.ts; look over accuracy).
  let through: ThroughStats | null = null;
  if (roadIndex && lod === 0) {
    const red = emptyMesh();
    through = cycleThrough(red, ways, w => own.has(w.id), roadIndex, onLand);
    add('cycle', red, 'cycleCross');
  }
  phase('surveyMarkings');
  if (roads) {
    roads.landCulled = roadLandCulled;
    roads.markings = surveyMarks;
    roads.through = through;
    const a = streets.stats.markings.clipped, b = onBridges.stats.markings.clipped;
    if (a && b) roads.clipped = Object.fromEntries(Object.keys(a).map(k => [k, a[k as keyof typeof a] + b[k as keyof typeof b]]));
  }

  // Water, quays, decks.
  if (input.water) {
    add('water', waterSurfaceMesh(input.water, CANAL_WATER_Z), 'water');
    // No municipal quay wall under a bridge deck (its arches) or across a landed platform (the Homomonument's steps bring their own walls).
    const underDecks = input.decks.length ? underDeck(input.decks) : undefined, onPlatform = inLandedPlatform(input.landedPlatforms ?? []);
    add('quay', quayWallMesh({ polygons: [], shores: input.water.shores, shoreLevels: input.water.shoreLevels }, surface.height, CANAL_WATER_Z, fine ? 4 : touch ? TOUCH_QUAY_STEP_M : 8, QUAY_CAP_M, (x, y) => onPlatform(x, y) || !!underDecks?.(x, y)), 'quay');
  }
  const bridges: BridgeStats = { tops: 0, railed: 0, railingPosts: 0, piers: 0, arches: 0, abutments: 0, frames: 0, decks: [], flat: [], floating: [] };
  // The street bands of the bridge ways: on land the deck top stays under them (decks.ts deckWidths, ride review J6).
  const clip = input.clipDecks !== false, onBridgeBand = bandCorridor(ways.filter(isBridgeWay).map(w => ({ points: w.points, half: w.section.halfWidth })));
  // No parapet on a street or path crossing its line (railingRuns.ts crossingWays; a deck measured along the canal).
  const crossing = crossingWays(ways.filter(isBridgeWay).map(w => ({ points: w.points, half: w.section.halfWidth })));
  // roads-v1: where the survey's deck polygons (h ≥ 1) cover a measured deck, they are the visible deck out to the
  // parapet; the deck top keeps to the road's half-width under them (no sides), so no grey slab shows beside the road.
  const roadsOnDeck = (deck: DeckSurface): boolean => {
    if (!roadIndex?.hasDecks) return false;
    const p = deck.profile;
    let hit = 0;
    for (const f of [0.3, 0.5, 0.7]) { const i = p.s.findIndex(s => s >= p.deck[0] + (p.deck[1] - p.deck[0]) * f); if (i >= 0 && roadIndex.onDeck(p.x[i], p.y[i])) hit++; }
    return hit >= 2;
  };
  for (const deck of input.decks) {
    const xs = deck.profile.x, ys = deck.profile.y, mid = xs.length >> 1;
    const { reach } = deckReach(deck, overWater);
    for (const f of floatingEnds(deck, overWater, surface.height, surface.ground)) bridges.floating.push(`${deck.profile.id}:${f.end}:${f.reason}`);
    add('deckBody', measuredDeckBody(deck, surface.ground, overWater, waterZAt(input.waterAround, xs[mid], ys[mid], CANAL_WATER_Z), surface.height, bridges.decks, lod === 0, reach, clip ? deckWidths(deck, overWater) : undefined, crossing), 'deck');
    const covered = roadsOnDeck(deck);
    if (covered && roads) roads.decksCovered++;
    const top = measuredDeckTop(deck, surface.height, lod === 0 ? 4 : 2, lod === 0 ? 2 : 4, reach, covered ? { left: deck.profile.halfWidth, right: deck.profile.halfWidth } : clip ? deckWidths(deck, overWater, onBridgeBand) : undefined, covered && input.deckEnds !== false ? COVERED_TOP_SINK_M : 0);
    if (top.indices.length) { add('deckTop', top, 'deck'); bridges.tops++; }
  }
  for (const d of bridges.decks) { bridges.railingPosts += d.railingPosts; bridges.piers += d.piers; bridges.arches += d.arches; bridges.abutments += d.abutments; if (d.railingPosts) bridges.railed++; }
  // Bridge ways near the flat footprints give their crossing axis (movable frames).
  const bridgeLines = ways.filter(isBridgeWay).map(w => w.points);
  // The OSM ways that say where a bridge moves (bridge=movable): the leaves of a movable footprint (decks.ts movableLeaves).
  const movableLines = ways.filter(w => w.tags.bridge === 'movable' || !!w.tags['bridge:movable']).map(w => w.points);
  input.flatDecks.forEach((ring, k) => {
    const through = bridgeLines.filter(l => l.some(q => pointInRing(ring, q[0], q[1])) || l.some((q, i) => i > 0 && pointInRing(ring, (q[0] + l[i - 1][0]) / 2, (q[1] + l[i - 1][1]) / 2)));
    const axis = footprintAxis(ring, through).u, movingThrough = movableLines.filter(l => through.includes(l));
    const { top, body, railingPosts, floating } = flatDeckBody(ring, surface.height, overWater, 0.02, 0.45, { railings: lod === 0, axis, movableWays: movingThrough, crossing });
    if (floating) bridges.floating.push(`${input.flatDeckMeta?.[k]?.id ?? 'flat'}:${floating} end(s) over water past ${DECK_REACH_MAX_M} m`);
    add('deckTop', top, 'deck'); add('deckBody', body, 'deck');
    bridges.tops++; bridges.railingPosts += railingPosts; if (railingPosts) bridges.railed++;
    let frames = 0;
    if (input.flatDeckMeta?.[k]?.movable) {
      const frame = movableFrame(ring, surface.height, through, 0.02, lod === 0, movableLeaves(ring, axis, movingThrough));
      add('deckBody', frame.mesh, 'deck'); frames = frame.units; bridges.frames += frames;
    }
    bridges.flat.push({ id: input.flatDeckMeta?.[k]?.id ?? '', railingPosts, frames });
  });

  // Rail viaducts over streets (railViaducts.ts, issue #57): the deck over the passage, the abutment walls and their
  // blocks back into the track bed, piers. The cell holding the passage's centre draws it.
  const viaducts: ViaductBuild[] = [];
  for (const v of RAIL_VIADUCTS) {
    const r = v.ring.map(input.project), cx = r.reduce((s, p) => s + p[0], 0) / r.length, cy = r.reduce((s, p) => s + p[1], 0) / r.length;
    if (!inCell(cx, cy)) continue;
    const built = viaductMesh(v, input.project, surface.ground, lod);
    add('deckBody', built.body, 'deck'); add('deckTop', built.deckTop, 'deck'); add('land', built.top, 'land');
    viaducts.push(built.info);
  }

  phase('waterDecks');
  // Land pockets near junctions (pockets.ts): bare land every layer around encloses, paved under the bands. Near ring only.
  let pockets: PocketStats | null = null;
  if (lod === 0 && input.pockets !== false) {
    const cover: PocketCover<PocketSurface>[] = (Object.keys(parts) as GroundLayer[]).filter(l => !NOT_COVER.has(l)).map(l => ({ meshes: parts[l]!, as: POCKET_VOTE[l] ?? null }));
    // roads-v1: a junction on the survey seeds no pocket (the polygons tile it; a pocket fill there was a pavement
    // wedge). A gap in the survey near the node shows the land the survey leaves there (a berm, a tree pit).
    const seeds = [...streets.junctionPoints, ...onBridges.junctionPoints].filter(p => !roadIndex || roadIndex.findFast(p[0], p[1]) < 0);
    // A junction node in a gap of the survey (a plein such as the Nieuwmarkt, filed as terrain, not wegdeel): its
    // covered ways draw no bands there, so the pocket pass paves the bare land within the junction's reach again
    // (pockets.ts SurveyGap; probe-survey-gaps.ts). Only where the survey is around: a node off it keeps its bands.
    const gaps: SurveyGap[] = [];
    if (roadIndex && input.surveyGaps !== false) streets.junctionPoints.forEach((p, i) => {
      if (roadIndex.find(p[0], p[1]) >= 0 || p[0] < rect[0] || p[0] >= rect[2] || p[1] < rect[1] || p[1] >= rect[3]) return;
      const r = Math.max(SURVEY_GAP_MIN_R, streets.junctionReach[i] ?? 0);
      if (r > 0 && [[r, 0], [-r, 0], [0, r], [0, -r]].some(([dx, dy]) => roadIndex.find(p[0] + dx, p[1] + dy) >= 0)) gaps.push({ p, r });
    });
    // Version-2 surfaces (verges, islands, squares) that the partition drew leave no pocket (roadCells ANCILLARY_CLASSES).
    const ancillaryDrawn = roadIndex && roadDrawn ? (x: number, y: number): boolean => { const k = roadIndex.findFast(x, y); return k >= 0 && roadDrawn(k) && ANCILLARY_CLASSES.includes(roadIndex.drawClass(k)); } : undefined;
    const occupied = ancillaryDrawn && roadIndex!.records.some(r => ANCILLARY_CLASSES.includes(r.c)) ? ancillaryDrawn : undefined;
    const r = fillPockets(cover, rect, seeds, onLand, POCKET_LIFT, { gaps, occupied });
    for (const [s, m] of Object.entries(r.meshes)) add(s as PocketSurface, m as MeshArrays, 'pocket');
    pockets = r.stats;
  }

  phase('pockets');
  const packed: Partial<Record<GroundLayer, PackedMesh>> = {}, sources: Partial<Record<GroundLayer, Uint8Array>> = {};
  const byLayer: Record<string, number> = {};
  let triangles = 0, bytes = 0;
  for (const layer of GROUND_LAYERS) {
    const list = parts[layer];
    if (!list?.length) continue;
    let m = list.length === 1 ? list[0] : merge(list);
    // The kerb material is vertex-coloured (roadSurfaces KERB_SHADOW_M): a kerb mesh without colours (OSM bands only) is white.
    if (VERTEX_TINTED.has(layer) && !m.colors) m = { ...m, colors: new Array(m.positions.length).fill(1) };
    const p = packMesh(m);
    packed[layer] = p;
    if (tracing) sources[layer] = triangleSources(list, from[layer] ?? []);
    byLayer[layer] = packedTriangles(p);
    triangles += byLayer[layer];
    bytes += packedBytes(p);
  }
  const maskOut: GroundMask | null = mask ? { x0: mask.x0, y0: mask.y0, res: mask.res, width: mask.width, height: mask.height, texels: maskTexels(mask) } : null;
  if (maskOut) bytes += maskOut.texels.byteLength;
  phase('pack');
  return {
    key, lod, detail, rect, layers: packed, mask: maskOut, ...(tracing ? { sources } : {}),
    stats: { triangles, byLayer, ways: [...own].length, areas: areas.length, decks: input.decks.length, flatDecks: input.flatDecks.length, buildMs: Date.now() - t0, bytes, bridges, parks: parkStats ? { ...parkStats, fillCulled: parkFillCulled, landCulled } : null, pockets, greenLandCulled: greenCulled, greenCut, courtyardGreens, roads, phases, courtyards, ...(viaducts.length ? { viaducts } : {}) },
  };
}

/** Layers that do not hide the land from above (vertical faces, thin marks on bands, the land itself). */
const NOT_COVER: ReadonlySet<GroundLayer> = new Set<GroundLayer>(['land', 'kerb', 'bollard', 'furniture', 'hedge', 'deckBody', 'paint', 'tram']);

type PocketSurface = 'asphalt' | 'klinker' | 'paving';
/** What a pocket bordered by a layer becomes (pockets.ts): street surfaces vote for themselves, cycle paths and squares for paving; water, parks and decks for nothing. */
const POCKET_VOTE: Partial<Record<GroundLayer, PocketSurface>> = { asphalt: 'asphalt', klinker: 'klinker', brick: 'klinker', paving: 'paving', cycle: 'paving', square: 'paving', gravel: 'paving' };

/** Park surfaces rank between the OSM areas (1) and the street bands (2+), as their lifts do (parks.ts PARK_LIFT). */
export const PARK_RANK: Partial<Record<GroundLayer, number>> = { lawn: 1.2, garden: 1.2, bed: 1.4, shrub: 1.4, bark: 1.4, sand: 1.5, pond: 1.5, parkGravel: 1.7, parkPath: 1.7 };
/** Polygon-offset rank of coplanar layers (gameGround.ts OFFSET): later wins a tie. */
/** An OSM green fill with no road polygon within this of its outline is a courtyard (drawn as `garden`). */
export const COURTYARD_ROAD_M = 3;
export const DRAW_RANK: Partial<Record<GroundLayer, number>> = { deckTop: 1, park: 1, wood: 1, square: 1, parking: 1, ...PARK_RANK, klinker: 2, brick: 2, asphalt: 2, gravel: 3, cycle: 3, paving: 3, paint: 4, tram: 5 };
/** Mask channel that cuts a layer (gameGround.ts CUT): 0 = R (water), 1 = G (water minus decks). */
export const CUT_CHANNEL: Partial<Record<GroundLayer, 0 | 1>> = { land: 0, park: 0, garden: 0, wood: 0, square: 0, parking: 0, lawn: 0, bed: 0, shrub: 0, bark: 0, sand: 0, parkGravel: 0, parkPath: 0, pond: 0, asphalt: 1, klinker: 1, brick: 1, cycle: 1, paving: 1, gravel: 1, kerb: 1, paint: 1, tram: 1, bollard: 1 };

/** Topmost first; within 2 cm the higher draw rank wins, as the polygon offsets make it on screen. */
export function compareHits(p: { layer: GroundLayer; z: number }, q: { layer: GroundLayer; z: number }): number {
  return Math.abs(p.z - q.z) > 0.02 ? q.z - p.z : (DRAW_RANK[q.layer] ?? 0) - (DRAW_RANK[p.layer] ?? 0);
}

/**
 * What a camera straight above sees at (x, y) in one built cell: every
 * triangle under the point, the mask discard applied as the shader does
 * (bilinear, < 0.5 discards), topmost first, ties within 2 cm to the higher
 * draw rank. For named regressions (walks every triangle).
 */
export function layersAt(cell: BuiltCell, x: number, y: number): { top: GroundLayer | null; hits: { layer: GroundLayer; z: number; cut: boolean }[] } {
  const hits: { layer: GroundLayer; z: number; cut: boolean; rank: number }[] = [];
  for (const layer of GROUND_LAYERS) {
    const m = cell.layers[layer];
    if (!m) continue;
    const pos = m.positions, idx = m.indices;
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      if (Math.max(pos[a], pos[b], pos[c]) < x || Math.min(pos[a], pos[b], pos[c]) > x || Math.max(pos[a + 1], pos[b + 1], pos[c + 1]) < y || Math.min(pos[a + 1], pos[b + 1], pos[c + 1]) > y) continue;
      const d = (pos[b + 1] - pos[c + 1]) * (pos[a] - pos[c]) + (pos[c] - pos[b]) * (pos[a + 1] - pos[c + 1]);
      if (Math.abs(d) < 1e-12) continue;
      const u = ((pos[b + 1] - pos[c + 1]) * (x - pos[c]) + (pos[c] - pos[b]) * (y - pos[c + 1])) / d;
      const v = ((pos[c + 1] - pos[a + 1]) * (x - pos[c]) + (pos[a] - pos[c]) * (y - pos[c + 1])) / d;
      if (u < 0 || v < 0 || u + v > 1) continue;
      const ch = CUT_CHANNEL[layer];
      const cut = ch !== undefined && !!cell.mask && maskChannelAt(cell.mask, x, y, ch) < 0.5;
      hits.push({ layer, z: u * pos[a + 2] + v * pos[b + 2] + (1 - u - v) * pos[c + 2], cut, rank: DRAW_RANK[layer] ?? 0 });
    }
  }
  hits.sort(compareHits);
  return { top: hits.find(h => !h.cut && h.layer !== 'water')?.layer ?? null, hits: hits.map(({ layer, z, cut }) => ({ layer, z: +z.toFixed(3), cut })) };
}

/** Bilinear mask channel (0..1) at a scene point, as the GPU's LinearFilter samples it; 1 (land) outside. */
export function maskChannelAt(m: GroundMask, x: number, y: number, ch: 0 | 1): number {
  const fx = (x - m.x0) / m.res - 0.5, fy = (y - m.y0) / m.res - 0.5;
  if (fx <= -0.5 || fy <= -0.5 || fx >= m.width - 0.5 || fy >= m.height - 0.5) return 1;
  const i = Math.max(0, Math.min(m.width - 2, Math.floor(fx))), j = Math.max(0, Math.min(m.height - 2, Math.floor(fy)));
  const u = Math.max(0, Math.min(1, fx - i)), v = Math.max(0, Math.min(1, fy - j)), t = m.texels, w = m.width;
  const at = (a: number, b: number) => t[(b * w + a) * 2 + ch] / 255;
  return (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - v) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * v;
}
