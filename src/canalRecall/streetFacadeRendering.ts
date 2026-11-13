import { bayLookFor, bayLayer, BAY_STYLES } from './bayLook.js';
import { STYLE_DIMS, CELL_LAYER_COUNT } from './facadeCells.js';
import { recipeForWall, type ArchitecturalRecipe, type StreetAppearanceProfile } from './streetAppearance.js';
import type { MeshBuilding, Origin } from './threeBuildingMesh.js';
import { levelWallHex } from './look/paletteLevel.js';
import type { Openings, OpeningRow } from './facadeOpenings.js';
import type { LayoutScale } from './facadeLayout.js';

/**
 * A recipe's own measured wall stays as measured; a wall the bay look picked from the buurt profile or the period (no
 * `recipe.wallHex`) takes the palette level like every other generic wall (look/paletteLevel.ts, `?paletteLevel=0`).
 */
const levelGenericWall = (hex: string, recipe: { wallHex?: string }): string => recipe.wallHex ? hex : levelWallHex(hex);

export const PROCEDURAL_RECIPE_LAYER_OFFSET = CELL_LAYER_COUNT + 4;
export type StreetFacadeContext = {
  profiles: readonly StreetAppearanceProfile[];
  look: 'photo' | 'storybook' | 'cartoon' | 'procedural';
  year: number | null;
  /** Native total height, separate from the roof-adjusted wall top. */
  sourceHeightM?: number;
  streetCorner?: boolean;
  mappedWallHex?: string;
  shopfront?: Parameters<typeof bayLookFor>[4];
  /** The measured period wall (`?walls=measured`), else the period prior. */
  periodWallHex?: string;
};

const boundsCache = new WeakMap<object, Array<{ profile: StreetAppearanceProfile; west: number; east: number; south: number; north: number }>>();
/** Cull unrelated street evidence before doing wall-level matching in a city tile. */
export function profilesNearBuilding(profiles: readonly StreetAppearanceProfile[], polygons: number[][][][]): StreetAppearanceProfile[] {
  let bounds = boundsCache.get(profiles);
  if (!bounds) {
    bounds = profiles.map(profile => {
      const [a, b] = profile.segment, latPad = profile.reachM / 110540;
      const lngPad = profile.reachM / (111320 * Math.cos(a[1] * Math.PI / 180));
      return { profile, west: Math.min(a[0], b[0]) - lngPad, east: Math.max(a[0], b[0]) + lngPad, south: Math.min(a[1], b[1]) - latPad, north: Math.max(a[1], b[1]) + latPad };
    });
    boundsCache.set(profiles, bounds);
  }
  let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
  for (const polygon of polygons) for (const [lng, lat] of polygon[0] ?? []) {
    west = Math.min(west, lng); east = Math.max(east, lng); south = Math.min(south, lat); north = Math.max(north, lat);
  }
  return bounds.filter(b => b.west <= east && b.east >= west && b.south <= north && b.north >= south).map(b => b.profile);
}

/** Resolve only exposed, street-facing runs. Geometry and building identity stay unchanged. */
export function streetWallBuilding(building: MeshBuilding, wall: {
  x0: number; y0: number; x1: number; y1: number; nx: number; ny: number; hole: boolean;
}, origin: Origin, streetSide: boolean): MeshBuilding {
  const context = building.streetAppearance;
  if (!context || wall.hole || building.bare || building.plainWalls) return building;
  const terrace=building.roof?.plan.repeatedTerrace;
  if(terrace){
    const dx=terrace.front.end[0]-terrace.front.start[0],dy=terrace.front.end[1]-terrace.front.start[1],length=Math.hypot(dx,dy);
    const endFacing=(wall.nx*dx+wall.ny*dy)/length;
    // The register explicitly describes blind end walls. Keep ordinary rear
    // walls and neighbors, and never invent side windows on the two exposed ends.
    if(Math.abs(endFacing)>.85&&terrace.exposedEnds?.[endFacing<0?0:1])
      return {...building,bare:true,recipe:undefined,wallHex:terrace.wallHex??building.wallHex};
  }
  const inheritedReturn=shortBakedFrontReturn(building,wall,origin);
  if(inheritedReturn)return inheritedReturn;
  const kx = 111_320 * Math.cos(origin.lat * Math.PI / 180);
  const recipe = streetSide ? recipeForWall(context.profiles, {
    start: [origin.lng + wall.x0 / kx, origin.lat + wall.y0 / 110_540],
    end: [origin.lng + wall.x1 / kx, origin.lat + wall.y1 / 110_540],
    normal: [wall.nx, wall.ny],
    frontage: { start: [origin.lng + wall.x0 / kx, origin.lat + wall.y0 / 110_540], end: [origin.lng + wall.x1 / kx, origin.lat + wall.y1 / 110_540], widthM: Math.hypot(wall.x1 - wall.x0, wall.y1 - wall.y0) },
  }, { id: building.id, year: context.year, heightM: context.sourceHeightM ?? building.heightM, streetCorner: context.streetCorner }) : undefined;
  if (!recipe) return building;
  const bay = bayLookFor(building.id, context.year, building.heightM,
    context.look === 'procedural' ? 'photo' : context.look, context.shopfront, recipe, context.periodWallHex);
  const offset = context.look === 'procedural' ? PROCEDURAL_RECIPE_LAYER_OFFSET : 0;
  return {
    ...building, style: bay.layout, period: recipe.period,
    wallHex: context.mappedWallHex ?? levelGenericWall(bay.wallHex, recipe),
    accentHex: recipe.openingGroup ? bay.accentHex : building.shopfront ? building.accentHex : bay.accentHex,
    layers: { upper: bay.layers.upper + offset, ground: bay.layers.ground + offset, door: bay.layers.door + offset },
    plainLayer: bay.plain + offset, groundHex: recipe.groundWallHex && !context.mappedWallHex ? bay.groundHex : building.groundHex ?? bay.groundHex,
    recipe,
    ...((recipe.facadeAssembly === 'stacked-open-balcony' || recipe.entranceAssembly || recipe.openingGroup) && !building.shopfront ? { shop: false } : {}),
  };
}

/** Profile fields are procedural priors, never registered facade measurements. */
export function recipeLayoutScale(recipe: ArchitecturalRecipe | undefined, fallback: { bay: number; storey: number; ground: number }) {
  return recipe ? {
    bay: (recipe.bayScale ?? 1) * (.98 + (fallback.bay - .88) / .3 * .04),
    storey: (recipe.storeyScale ?? 1) * (.99 + (fallback.storey - .93) / .16 * .02),
    ground: (recipe.groundScale ?? 1) * (recipe.shopCanopy ? 1 : .99 + (fallback.ground - .92) / .2 * .02),
  } : fallback;
}

/** The fitted cell width for a stated bay count stays within these multiples of the style's nominal bay. */
export const SPEC_BAY_SCALE = { min: 0.7, max: 1.5 } as const;
/** A street front's stated window bays (HouseSpec, houseSpec/decorate.ts), and how many window axes one texture cell
 *  of this building carries (bay-look cells hold 2 or 3; `MeshBuilding.openings.upper.axes`). */
export type FrontageBays = { bays?: number; axesPerCell: number; storeys?: number; exposedM?: number;
  /** H11 (#361, released with SPEC_DESIGN_HELD.storeys): the stated ground storey's height (m). */
  groundM?: number;
  /** H11: `nearest` draws the nearest count the clamp allows and lets the ground storey yield first; absent = H9's exact fit. */
  fit?: 'nearest';
  /** Lane WG: a souterrain ground cell may go down to this ground scale (SPEC_SOUTERRAIN_GROUND_MIN), below SPEC_GROUND_SCALE.min. */
  groundMin?: number };
/** Storey pitch scale a stated storey count may set (lane H9): 0.75..1.45 of the style's storey (2.2..4.5 m). */
export const SPEC_STOREY_SCALE = { min: 0.75, max: 1.45 } as const;
/** A stated ground-storey height (H11) stays within these multiples of the style's nominal ground storey. */
export const SPEC_GROUND_SCALE = { min: 0.7, max: 1.7 } as const;
/** Lane WG: the lowest ground scale a souterrain ground cell draws (storeyPlan.ts storeyDraw): 1.8 m on c19, 1.65 m on canal.
 *  SPEC_GROUND_SCALE.min drew 171218's 2.17 m souterrain at 2.52 m against about 2.0 m in the photo. */
export const SPEC_SOUTERRAIN_GROUND_MIN = 0.5;
const clampTo = (v: number, r: { min: number; max: number }) => Math.min(r.max, Math.max(r.min, v));

/**
 * The one storey fit for a HouseSpec's storey count (lanes H9 and H11; docs/house-line.md §1): the storey and ground
 * scales that make layoutWall (facadeLayout.ts) draw `storeys` storeys (ground included, spec.ts STOREYS_DEFINITION)
 * on `exposedM` of wall, the upper storeys sharing what the ground storey leaves.
 *  - exact (H9, the default): the run's own ground; null when the count does not fit within SPEC_STOREY_SCALE (the
 *    drawn count then stays the style's own) or there is no upper storey.
 *  - nearest (H11, `fit: 'nearest'`): the stated ground height (`groundM`, SPEC_GROUND_SCALE); on a wall too short for
 *    both (3DBAG's eaves under a measured cornice) the ground storey gives way first, down to SPEC_GROUND_SCALE.min,
 *    then the pitch clamps to the nearest count. Null only with no upper storey or no room above the ground.
 */
export function specStoreyFit(style: MeshBuilding['style'], exposedM: number, storeys: number, groundScale: number, opts: { groundM?: number; fit?: 'nearest'; groundMin?: number } = {}): { storey: number; ground: number } | null {
  const dims = STYLE_DIMS[style], upper = Math.floor(storeys) - 1;
  if (!(upper >= 1) || !(exposedM > 0)) return null;
  let ground = groundScale;
  if (opts.fit === 'nearest') {
    const range = opts.groundMin !== undefined ? { min: opts.groundMin, max: SPEC_GROUND_SCALE.max } : SPEC_GROUND_SCALE;
    if (opts.groundM && opts.groundM > 0) ground = clampTo(opts.groundM / dims.ground, range);
    const room = exposedM - upper * dims.storey * SPEC_STOREY_SCALE.min;
    if (dims.ground * ground > room) ground = Math.max(range.min, Math.min(ground, room / dims.ground));
  }
  const upperM = exposedM - Math.min(dims.ground * ground, exposedM);
  const scale = upperM / upper / dims.storey;
  if (opts.fit === 'nearest') return upperM >= dims.storey * SPEC_STOREY_SCALE.min ? { storey: clampTo(scale, SPEC_STOREY_SCALE), ground } : null;
  return scale >= SPEC_STOREY_SCALE.min && scale <= SPEC_STOREY_SCALE.max ? { storey: scale, ground } : null;
}
/** H9's exact fit as a storey scale (specStoreyFit without options). */
export function specStoreyScale(style: MeshBuilding['style'], exposedM: number, storeys: number, groundScale: number): number | null {
  return specStoreyFit(style, exposedM, storeys, groundScale)?.storey ?? null;
}

/** No drawn window column is narrower than this: a stated bay count never packs columns tighter (H1b, #349). */
export const MIN_COLUMN_M = 1.8;

/**
 * How many whole texture cells draw a stated bay count (`bays` = columns of window openings per facade, see
 * docs/house-line.md §1). A cell holds `axesPerCell` columns, so the drawn count is cells x axes: the cell count is
 * the one whose drawn count is nearest `bays`, a tie going to the fewer (an odd count on 2-axis cells lands on the
 * even number below, never above: 5 bays draw 4 columns, not 6; the 2026-11-10 doubling was round(5 / 2) = 3 cells).
 * Then it is held to what the run can carry: cells no narrower than `axesPerCell` columns of MIN_COLUMN_M, and a
 * count the bay-scale clamp (SPEC_BAY_SCALE) lets `layoutWall` reproduce.
 */
export function specCellCount(bays: number, axesPerCell: number, lengthM: number, nominalBayM: number): number {
  const axes = Math.max(1, Math.floor(axesPerCell || 1));
  const lo = Math.max(1, Math.floor(bays / axes)), hi = Math.max(1, Math.ceil(bays / axes));
  let cells = Math.abs(lo * axes - bays) <= Math.abs(hi * axes - bays) ? lo : hi;
  const widest = Math.max(1, Math.floor(lengthM / (axes * MIN_COLUMN_M)));
  const reach = (scale: number) => Math.max(1, Math.round(lengthM / (nominalBayM * scale)));
  cells = Math.min(cells, widest, reach(SPEC_BAY_SCALE.min));
  return Math.max(cells, reach(SPEC_BAY_SCALE.max));
}

/**
 * A scoped canal cell represents the complete native frontage, including polygon kinks.
 * With a bay count (`recipe.bays`, else `spec` for a street run of a building without a street-appearance recipe), the
 * run gets `specCellCount` cells and the bay scale that makes `layoutWall` round to exactly that many.
 * A spec storey count (`spec.storeys` over `spec.exposedM` of wall) sets the storey pitch (specStoreyScale, lane H9).
 */
export function frontageLayoutScale(recipe: ArchitecturalRecipe | undefined, fallback: {bay:number;storey:number;ground:number}, style: MeshBuilding['style'], lengthM:number, spec?: FrontageBays) {
  const scale=recipeLayoutScale(recipe,fallback);
  if (recipe?.openingGroup) return {...scale,bay:lengthM/STYLE_DIMS[style].bay};
  // A HouseSpec's storey count (no street-appearance recipe): the storey pitch that draws that many storeys.
  const fit = !recipe && spec?.storeys && spec.exposedM ? specStoreyFit(style, spec.exposedM, spec.storeys, scale.ground, { groundM: spec.groundM, fit: spec.fit, ...(spec.groundMin !== undefined ? { groundMin: spec.groundMin } : {}) }) : null;
  const scaled = fit ? {...scale, ...fit} : scale;
  const bays = recipe?.bays ?? spec?.bays;
  if (!(bays && bays > 0 && lengthM > 0)) return scaled;
  const nominal = STYLE_DIMS[style].bay;
  // A street-appearance recipe's own bays keep their original fit (whole cells, scale clamped); only a spec's bays,
  // counted in window columns, go through specCellCount.
  if (recipe?.bays) return {...scaled,bay:Math.min(SPEC_BAY_SCALE.max,Math.max(SPEC_BAY_SCALE.min,lengthM / Math.max(1,Math.round(recipe.bays)) / nominal))};
  const cells = specCellCount(bays, spec?.axesPerCell ?? 1, lengthM, nominal);
  return {...scaled,bay:lengthM / cells / nominal};
}

// --- Axis units: odd bay counts on 2-axis cells (H1c, #350, docs/house-line.md §1 "Odd bays") ---------------------
//
// Every canal/c19 bay-look cell with two windows paints them on axes 0.25 and 0.75 (facadeOpenings.ts rowPx), so each
// half of the cell is a one-window cell with the same sill, head, frame, lintel and white accents. A front whose stated
// bay count is odd is laid out in half-cell units: one window axis per unit, the texture sampled half a cell per unit
// (u advances 0.5 per unit), so three units draw three windows of the building's own cell and one unit draws one. The
// door unit samples the half of the door cell around the door, clear of its side window (axisUnitOpenings `doorU`). No atlas layer is added,
// and a front without an odd stated count is laid out exactly as before.

/** How far u advances per axis unit: half a texture cell. */
export const AXIS_UNIT_U = 0.5;
/**
 * The narrowest axis pitch an axis-unit front draws, for up to AXIS_UNIT_NARROW_MAX bays: the 10th percentile of
 * 80 hand-counted three-axis fronts on the H4 crop archive (pitch = wall width / 3, median 1.85 m, p10 1.49 m,
 * scripts/house-specs/bays-audit-photo.json). Wider counts keep MIN_COLUMN_M (no narrower 4+ axis front was measured).
 */
export const MIN_AXIS_PITCH_M = 1.45;
export const AXIS_UNIT_NARROW_MAX = 3;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

/** A cell's two-window row as a one-window unit row, or null when its windows are not centred in the cell's halves. */
function unitRow(row: OpeningRow): OpeningRow | null {
  if (row.axes.length !== 2 || !near(row.axes[0], 0.25) || !near(row.axes[1], 0.75)) return null;
  if (row.widths && !near(row.widths[0], row.widths[1])) return null;
  const width = (row.widths?.[0] ?? row.width) * 2;
  return width < 1 ? { axes: [0.5], width, sill: row.sill, head: row.head, ...(row.arch !== undefined ? { arch: row.arch } : {}) } : null;
}

/** Clearance (fraction of a cell) kept between the door unit's sampled half and the door cell's side window: its frame
 *  and stone surround reach about 16 px of the 520 px bay beyond the glass (bayTextures.ts windowAt). */
export const DOOR_UNIT_CLEARANCE = 0.035;
/**
 * The openings of one axis unit of a two-window cell (fractions of the unit), or null when the cell cannot be halved:
 * not two windows centred in the halves (upper and ground), a ribbon, or a door half a cell cannot hold clear of its
 * side window. `doorU` is where the door unit's half-cell sample starts in the door cell (centred on the door, kept
 * DOOR_UNIT_CLEARANCE off the side window on both sides, the cell wrapping): the restrained door window starts at 0.497.
 */
export function axisUnitOpenings(o: Openings | undefined): (Openings & { doorU: number }) | null {
  if (!o || o.ribbon) return null;
  const upper = unitRow(o.upper), ground = o.ground ? unitRow(o.ground) : null;
  if (!upper || (o.ground && !ground)) return null;
  const d = o.door, w = o.doorWindow;
  let lo = d.axis + d.width / 2 - 0.5, hi = d.axis - d.width / 2;
  if (w) for (const axis of w.axes) {
    const half = (w.widths?.[0] ?? w.width) / 2;
    hi = Math.min(hi, axis - half - 0.5 - DOOR_UNIT_CLEARANCE);
    lo = Math.max(lo, axis + half - 1 + DOOR_UNIT_CLEARANCE);
  }
  if (lo > hi) return null;
  const doorU = Math.min(hi, Math.max(lo, d.axis - 0.25));
  return { upper, ground, doorWindow: null, door: { ...d, axis: (d.axis - doorU) * 2, width: d.width * 2 }, doorU };
}

/** ODD_AXIS_CELLS=0 (Node) or `?oddAxisCells=0` keeps every stated odd count on whole cells (the H1b fit). The page flag
 *  reaches only a main-thread build: in the building worker `location` is the worker script's URL. */
export function oddAxisCellsEnabled(search?: string): boolean {
  try {
    if (search === undefined && typeof process !== 'undefined' && process.env?.ODD_AXIS_CELLS === '0') return false;
    const q = search ?? (typeof location !== 'undefined' ? location.search : '');
    return new URLSearchParams(q).get('oddAxisCells') !== '0';
  } catch { return true; }
}

export type AxisUnitPlan = { units: number; scale: LayoutScale; openings: Openings; doorU: number };
/**
 * The axis-unit layout of a street run for a stated bay count, or null (whole cells, `frontageLayoutScale`): only an
 * odd count on a halvable two-window cell, at an axis pitch from MIN_AXIS_PITCH_M (MIN_COLUMN_M above
 * AXIS_UNIT_NARROW_MAX bays) up to half the style's bay times SPEC_BAY_SCALE.max. The scale makes `layoutWall` lay
 * exactly `units` bays; doors recur every doorEvery cells (twice as many units) and fit a unit half the usual width.
 */
export function axisUnitPlan(spec: FrontageBays | undefined, openings: Openings | undefined, style: MeshBuilding['style'], lengthM: number, fallback: { bay: number; storey: number; ground: number }): AxisUnitPlan | null {
  const bays = spec?.bays;
  if (!spec || bays === undefined || spec.axesPerCell !== 2 || !Number.isInteger(bays) || bays % 2 !== 1 || !(lengthM > 0) || !oddAxisCellsEnabled()) return null;
  const unit = axisUnitOpenings(openings);
  if (!unit) return null;
  const nominal = STYLE_DIMS[style], pitch = lengthM / bays;
  if (pitch < (bays <= AXIS_UNIT_NARROW_MAX ? MIN_AXIS_PITCH_M : MIN_COLUMN_M) || pitch > nominal.bay / 2 * SPEC_BAY_SCALE.max) return null;
  const { doorU, ...openingsOfUnit } = unit;
  return { units: bays, openings: openingsOfUnit, doorU, scale: { ...fallback, bay: pitch / nominal.bay, doorEvery: nominal.doorEvery * 2, doorMinBayM: 1.2 } };
}

/** Carry admitted color onto a shallow exposed return, never a new opening/source class. */
function shortBakedFrontReturn(building:MeshBuilding, wall:{x0:number;y0:number;x1:number;y1:number;hole:boolean},origin:Origin):MeshBuilding|undefined {
  const context=building.streetAppearance!;
  if(Math.hypot(wall.x1-wall.x0,wall.y1-wall.y0)>2 || wall.hole)return;
  const kx=111320*Math.cos(origin.lat*Math.PI/180);
  const xy=(p:readonly number[])=>[(p[0]-origin.lng)*kx,(p[1]-origin.lat)*110540];
  const a=[wall.x0,wall.y0],b=[wall.x1,wall.y1];
  const distance=(p:number[],c:number[],d:number[])=>{const dx=d[0]-c[0],dy=d[1]-c[1],l=dx*dx+dy*dy;if(!l)return Math.hypot(p[0]-c[0],p[1]-c[1]);const t=Math.max(0,Math.min(1,((p[0]-c[0])*dx+(p[1]-c[1])*dy)/l));return Math.hypot(p[0]-c[0]-t*dx,p[1]-c[1]-t*dy);};
  for(const profile of context.profiles){
    const baked=profile.frontages?.find(f=>f.buildingId===building.id);
    if(!baked?.frontage)continue;
    const c=xy(baked.frontage.start),d=xy(baked.frontage.end);
    if(Math.min(distance(a,c,d),distance(b,c,d),distance(c,a,b),distance(d,a,b))>1.5)continue;
    const ps=xy(profile.segment[0]),pe=xy(profile.segment[1]),dx=pe[0]-ps[0],dy=pe[1]-ps[1];
    const recipe=recipeForWall([profile],{...baked.frontage,frontage:baked.frontage,normal:[profile.side*dy,-profile.side*dx]},{id:building.id,year:context.year,heightM:context.sourceHeightM??building.heightM,streetCorner:context.streetCorner});
    if(!recipe?.openingGroup)continue;
    const bay=bayLookFor(building.id,context.year,building.heightM,context.look==='procedural'?'photo':context.look,'quiet',recipe,context.periodWallHex);
    const offset=context.look==='procedural'?PROCEDURAL_RECIPE_LAYER_OFFSET:0;
    const style=BAY_STYLES.canal.findIndex(v=>v.openingGroup==='canal-return');
    const upper=bayLayer('canal',style,'upper')+offset,ground=bayLayer('canal',style,'ground')+offset;
    return {...building,style:'canal',wallHex:context.mappedWallHex??levelGenericWall(bay.wallHex,recipe),accentHex:bay.accentHex,plainLayer:bay.plain+offset,layers:{upper,ground,door:ground},groundHex:undefined,shop:false,shopfront:false,plainWalls:false,recipe:undefined};
  }
}

