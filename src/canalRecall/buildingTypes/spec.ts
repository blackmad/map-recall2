/**
 * Building-type specification (`types/<type>.json`). Data, not code: the
 * generator interprets bays and openings; the counts and photo evidence that
 * justify them live next to them so a reviewer can check the JSON against
 * the panorama.
 */
import type {Slot} from './mesh.ts';
import {validateMottle, type Mottle} from './mottle.ts';

export type FacadeId = 'front' | 'back' | 'left' | 'right';
export const FACADE_IDS: FacadeId[] = ['front', 'back', 'left', 'right'];

/** Floors an element repeats on. Floor 0 is the ground storey; `upper` = 1..storeys-1. */
export type Levels = 'ground' | 'upper' | 'all' | number[];

export type ElementKind = 'window' | 'balcony' | 'door' | 'storageDoor' | 'vents' | 'panel' | 'ribbon' | 'gallery' | 'canopy';

/** Palette entries an element, annex or band can be drawn in (`gable` falls back to `wall` when the palette has none). */
export type PaletteKey = 'frame' | 'glass' | 'door' | 'accent' | 'rail' | 'dark' | 'column' | 'joint' | 'wall' | 'plinth' | 'roof' | 'gable' | 'fascia';

export interface Element {
  kind: ElementKind;
  levels: Levels;
  /** Which bay edge `u` is measured from: the bay centre (default) or its left/right edge (u > 0 moves inwards). */
  ref?: 'centre' | 'left' | 'right';
  /** Offset of the element's centre from `ref`, metres. */
  u?: number;
  w?: number;
  h?: number;
  /** Bottom edge above the floor line of its level, metres (negative: centred on a stair landing). */
  sill?: number;
  /** Window lights (vertical mullions = lights - 1). */
  lights?: number;
  /** Balcony projection / box depth (gallery: default the facade's inset, so the gallery reaches the footprint edge). */
  depth?: number;
  /** Gallery: `solid` is a concrete parapet, `panel` a thin infill plate (the measured mix of bars and what shows through) under a top rail. */
  railing?: 'bars' | 'slats' | 'solid' | 'panel';
  /** Number of repeats for `vents`. */
  count?: number;
  /** Palette entry: the fill of panels, the frame of windows/ribbons (default `frame`), the parapet of galleries (default `column`). */
  colour?: string;
  /** Width = the bay width (minus 2 x `inset`) instead of `w`; galleries always span their bay. */
  span?: boolean;
  inset?: number;
  /** Repeat the element this many times, one copy centred in each equal slot of the bay (`u` offsets each copy). */
  repeat?: number;
  /**
   * Window only (plate frame): chunky joinery (#75). `frameM` is the frame border drawn INSIDE the measured opening (default: the
   * 6 cm border outside it); `transomM` puts a horizontal bar that far below the head (top lights over casements). Absent: unchanged.
   */
  frameM?: number;
  transomM?: number;
  /**
   * Window only, with `frameM` (#80): a sash of another colour inside the frame (white outer frames with yellow or red sashes, Osdorp
   * 1980s rows). `sash` names the palette entry of the sash ring and its bars, `sashM` its width (default 0.05 m). Absent: unchanged.
   */
  sash?: PaletteKey;
  sashM?: number;
  /** Window only, with `frameM` (#80): round glazing (a porthole) inside the square frame, as a 16-sided pane of diameter min(w, h) - 2 frameM. Absent: unchanged. */
  round?: boolean;
  /** Window only, with `frameM` (#85): the glass divided into `panesHigh` rows by horizontal bars, evenly spaced (the white-framed glazed screens of the 2003 Aker-Oost fronts). Absent: unchanged. */
  panesHigh?: number;
  /**
   * Panel only (#80): the top `archM` metres of the panel are a pointed (parabolic) arch head, drawn as a front plate, and the panel
   * is clipped to its bay, so an arch centred on a party line (ref left/right, u 0) draws half in each mirrored pand (Amsterdam
   * School portiek portals). Absent: the panel is the usual box.
   */
  archM?: number;
  /** Panel with `archM` (#82): `round` draws the head as a half ellipse (a round-arched porch or portal) instead of the pointed arch. Absent: pointed (unchanged). */
  archShape?: 'pointed' | 'round';
  /** Panel only (#85): `count` horizontal slats in the `palette` colour evenly up the panel's face (louvred shutters, the grooves of a sectional garage door). Absent: the plain panel. */
  louvres?: {count: number; palette: PaletteKey};
  /** Panel only (#82): a rhombus plate (a square set on its point, `w` wide and `h` tall) instead of the box, e.g. the white diamond surround of a small window (Weesp-Zuid 1950). Absent: the box. */
  diamond?: boolean;
  /** Window/ribbon/door: `strips` draws the frame (door: surround) as border strips 4.5 cm in front instead of a plate stacked 5 mm under the glass/leaf (big glazing, many openings: no z-fight). */
  frameStyle?: 'plate' | 'strips';
  /** Gallery only: vertical cross walls (fins) evenly from end to end of the gallery, ends included. */
  fins?: number;
  /** Only in these cladding variants / in all but these. */
  variants?: string[];
  exceptVariants?: string[];
  /** Only when the ground storey is built this way (open pilotis vs closed storage cells). */
  groundModes?: ('solid' | 'pilotis')[];
  /** Door only: raised entrance steps. */
  steps?: number;
  /**
   * Door with steps (#85): a stoop up to a raised ground floor. `stepRiseM` per step (default 0.17), `stepTreadM` (default 0.3),
   * `stepWidthM` the stoop's width (default w + 0.7), `stepRail` the palette entry of a sloping handrail on both sides.
   * Any of them set draws the stoop: steps as blocks from the ground, the door surround from the landing up. Absent: unchanged.
   */
  stepRiseM?: number;
  stepTreadM?: number;
  stepWidthM?: number;
  stepRail?: PaletteKey;
  /** Canopy only (door hoods): `flat` slab, `gable` a small pitched hood (ridge out from the wall), `arch` a curved hood; `h` is the hood's rise (flat: slab thickness), `sill` its underside above the floor line, `depth` its projection. Default palette `accent`. */
  canopy?: 'flat' | 'gable' | 'arch';
  note?: string;
}

export interface Bay {
  id: string;
  /** Relative width; the facade scales all bays to its real length. */
  w: number;
  role: 'balcony' | 'stair' | 'windows' | 'storage' | 'corner';
  /** Ground storey stays solid in this bay even for `ground.mode = pilotis`. */
  core?: boolean;
  elements: Element[];
}

export interface Evidence {
  /** Photo file in the scratchpad survey (type-N*.jpg) and the pand/address it shows. */
  photo: string;
  pand: string;
  address: string;
  note: string;
}

export interface FacadeSpec {
  confidence: 'measured' | 'partly-measured' | 'inferred';
  evidence: Evidence[];
  /** Counts written down from the photos, checked against the generated model by the test. */
  counted: {
    bays: number;
    /** Openings per upper storey (windows + glazed doors, not balconies). */
    openingsPerUpperStorey: number;
    /** Door/storage-door leaves on the ground storey. */
    groundDoors: number;
    balconiesPerUpperStorey: number;
  };
  bays: Bay[];
  /** Concrete-panel joints. */
  joints?: {panelW: number; panelH: number};
  /** Horizontal bands (e.g. white slab edges) as [vFromGroundStoreyTopOffset, height] pairs, in storey index (0 = ground floor line). `levels` repeats the band on those storeys' floor lines instead of `floor`. `palette` names the palette entry (default/`column`: the white band). */
  bands?: {floor: number; below: number; above: number; palette: string; levels?: Levels}[];
  /**
   * Board cladding (vertical timber boards, painted or stained): battens `widthM` wide every `pitchM`, `depthM` proud of the wall (default 0.05),
   * over the storeys in `levels` (the top storey reaches the wall top), interrupted where a window, door or canopy of this facade sits.
   */
  boards?: {levels: Levels; pitchM: number; widthM: number; depthM?: number; palette: PaletteKey}[];
  /**
   * Striped brickwork (horizontal bands of a second brick): bands `heightM` tall every `pitchM`, the first `offsetM` above each storey's
   * floor line, over the storeys in `levels` (the top storey reaches the wall top), 1 cm proud of the wall and cut where a window, door
   * or canopy of this facade sits. `depthM` (#75) sets how far proud (default 0.01 m): a dark brick plinth course in front of a
   * `ground.plinthM` band (2.5 cm proud) needs more.
   */
  stripes?: {levels: Levels; pitchM: number; heightM: number; offsetM?: number; depthM?: number; palette: PaletteKey}[];
}

/**
 * A wall/roof colour. `measured: true` marks `tint` as the sunlit photo colour, drawn as is (runtime `tintSource: 'measured'`,
 * look/palette.ts `cityMeasuredWallTint`) rather than mapped into the city brick range (L <= 0.6, S >= 0.12), which turns a
 * pale yellow or cream brick tan or olive. Absent, the material and the GLB are unchanged.
 *
 * On `palette.roof` (issue #75) a measured pitched roof (`roofTile` or `slate`) is the photo colour of the slope (sunlit street
 * crop, cross-checked against the PDOK orthophoto reading of the design's pands: roofColour.ts, roof-colours.ts), drawn as is
 * (look/palette.ts `cityMeasuredPitchedRoofTint`) instead of `cityRoofTint`, which floors a tile's saturation at 0.35 and
 * lifts it to L 0.38-0.5 (brown-red tiles drew orange) and turns any tile with S < 0.2 into the city slate (olive concrete
 * tiles drew blue-grey). Measured colours must be #rrggbb on a slot the look keeps measured (MEASURED_TINT_SLOTS).
 */
export interface SlotTint {
  slot: Slot;
  tint: string;
  measured?: boolean;
  /**
   * Mottled multi-tone brick (#77, mottle.ts): the brick tones of the blend, measured from sunlit (or white-referenced)
   * crops, with shares; `tint` stays the wall's mean. Brick slot only. Absent: material, GLB and look unchanged.
   */
  mottle?: Mottle;
}

export interface Palette {
  wall: SlotTint;
  /** Ground-storey wall when it differs (brick plinth under render). */
  plinth?: SlotTint;
  frame: string;
  glass: string;
  door: string;
  /** Concrete slabs, surrounds, sills. */
  accent: string;
  rail: string;
  /** Balcony slab edge / dark fascia. */
  dark: string;
  /** Pilotis columns and white bands. */
  column: string;
  joint: string;
  roof: SlotTint;
  /** Gable (short side) walls when they differ from the long walls (brick gables of a panel slab). */
  gable?: SlotTint;
  /** #85: painted fascia / gutter board (a facade band with `palette: 'fascia'`), e.g. the blue fascias of 1990s rows. Absent: bands naming it take `dark`. */
  fascia?: string;
}

export interface Variant {
  label: string;
  /** Roof windows of this cladding variant (default: the type's roof.rooflights; `{u: []}` switches them off). */
  rooflights?: RoofSpec['rooflights'];
  /** Draw concrete-panel joints on the facades that declare them. */
  joints?: boolean;
  evidence: string;
  palette: Palette;
}

export interface RoofSpec {
  form: 'gable' | 'hip' | 'flat';
  /** Ridge direction relative to the long side when pitched (3DBAG decides per pand; this is the default). */
  ridge: 'long' | 'short';
  eavesOverhangM: number;
  vergeOverhangM: number;
  thicknessM: number;
  /** Fallback pitch when 3DBAG gives no ridge height. */
  pitchDeg: number;
  /** Roof windows in the front slope of an eaves-front gable: `u` are fractions of the frontage (0 = left edge), `along` the position up the slope (0 eaves, 1 ridge). */
  rooflights?: {u: number[]; w: number; h: number; along: number};
  /**
   * Terraced gables whose b3_h_dak_min is not the eaves (a rear lean-to, a catslide or a dormer drags it): build.ts reads the eaves
   * of the two main roof slopes from the 3DBAG roof planes (`slopeEavesFromItem`). 'lower': both eaves take the lower slope's (a
   * dormer or a raised rear slope lifts the other). 'low-back' / 'low-front': the design (read from the photos) has one slope carried
   * lower, a catslide at the back or a front slope swept down to the ground storey; the lower of the two measured eaves goes to that
   * side and the roof is drawn asymmetric at one pitch. The side comes from the design, not per house: a house's front/back reading
   * of the planes flips with an ambiguous front, and the row keeps one roof.
   */
  eavesFromPlanes?: 'lower' | 'low-back' | 'low-front';
  /** Dormers on the front slope of an eaves-front gable (one design, every house); mirrored houses mirror them. */
  dormers?: DormerSpec[];
  /**
   * Half of a front-facing gable shared by a mirrored pair of terraced houses: each house carries one mono-pitch roof rising across
   * its frontage from its free-side eaves (u = 0, left) to the ridge on the party wall it shares with its partner (u = frontage); the
   * front and back gable triangles are in the `gable` palette, optionally with vertical battens. build.ts reads the side the roof falls
   * to from the 3DBAG roof plane (the pair's handedness, measured per house), not from an alternation rule.
   */
  pairGable?: {boards?: {pitchM: number; widthM: number; depthM?: number; palette: PaletteKey}};
  /**
   * Eaves height measured from the photos (metres above ground), used instead of 3DBAG's: a low front eaves under a big roof that
   * the 3DBAG reconstruction misses on many houses of a row (b3_h_dak_min read at a dormer cheek or a raised rear slope).
   */
  eavesPinM?: number;
  /**
   * Mono-pitch (lessenaarsdak) terraced roof read as one 3DBAG plane: 'rise-back' rises from the front eaves (b3_h_dak_min) to the ridge
   * standing on the back wall, which carries the full height (build.ts sets the back eaves to the ridge; the generator draws it as the
   * asymmetric gable whose ridge sits on the back wall line).
   */
  monoPitch?: 'rise-back';
  /**
   * Ridge from the photographed pitch (`pitchDeg` over half the depth above the eaves) instead of 3DBAG's b3_h_nok: rows where 3DBAG's
   * ridge reads a rooftop extension at the back on many houses, which the street does not see.
   */
  ridgeFromPitch?: boolean;
  /**
   * Terraced rows whose ends are hipped (#77, Tuindorp Nieuwendam): 3DBAG reads a hip on row-end houses and on some mid-row
   * ones. With this set a long-ridge house builds a hip only on its free end(s) (params.freeSides) and a gable against each
   * neighbour; a mid-row house is a plain gable whatever 3DBAG says. A short-ridge 'hip' (the row end's front-facing gable
   * house, whose steep gable 3DBAG reads as a hip) is drawn as a front gable. Absent: the 3DBAG roof form as is (byte-identical).
   */
  hipFreeEnds?: boolean;
  /**
   * Flat roof only (#82): the slab overhangs the two party-wall sides by `vergeOverhangM` and only the front and back by
   * `eavesOverhangM`, so a projecting front fascia does not run into the neighbour's roof (terraced flat roofs). Absent: all four
   * sides take `eavesOverhangM` (unchanged).
   */
  flatVerge?: boolean;
  /** Chimney stacks on the ridge of a long-ridge gable or hip (one design, every house); mirrored houses mirror them. */
  chimneys?: ChimneySpec[];
}

/**
 * A brick chimney stack standing on the ridge line: `w` along the ridge, `d` across it, rising `h` above the ridge, optionally with a
 * cap course `capM` thick that oversails the shaft by 5 cm. Not drawn on flat roofs, short-ridge gables or pair gables.
 */
export interface ChimneySpec {
  /** As elements: `u` is the stack centre's offset from the frontage centre (default) or inward from its left/right end. */
  ref?: 'centre' | 'left' | 'right';
  u: number;
  w: number;
  d: number;
  h: number;
  /** Offset of the stack centre from the ridge line towards the front (+) or back (-), metres. */
  offsetM?: number;
  /** Shaft material (default `wall`); the cap course (when `capM` > 0) is in `cap` (default `accent`). */
  palette?: PaletteKey;
  cap?: PaletteKey;
  capM?: number;
  variants?: string[];
  exceptVariants?: string[];
  note?: string;
}

/** A dormer on the front roof slope: front face `setBackM` behind the wall line, flat roof, cheeks down to the roof plane. */
export interface DormerSpec {
  /** As elements: `u` is the dormer centre's offset from the frontage centre (default) or inward from its left/right end. */
  ref?: 'centre' | 'left' | 'right';
  u: number;
  w: number;
  /** Height of the front face, from where it meets the roof plane to the underside of the dormer roof. */
  h: number;
  /** Horizontal distance of the front face behind the front wall line. */
  setBackM: number;
  lights: number;
  /** Glazing inset from the cheeks (default 0.12 m). */
  marginM?: number;
  /**
   * Glazing inset at an end flush with the frontage end (default `marginM` / 2): the wall dormer of a mirrored pair whose two
   * windows stand apart with a pier between them across the party wall (#77, De Eendracht box fronts). Absent: unchanged.
   */
  marginEndM?: number;
  /** Front face and cheeks (default `column`), window frame (default `frame`). */
  cheek?: PaletteKey;
  frame?: PaletteKey;
  /** Dormer roof overhang beyond the face and free cheeks (default 0.12 m). */
  overhangM?: number;
  /** Lead/zinc apron on the roof below the front face, this deep along the slope (default none), in the `rail` palette. */
  apronM?: number;
  variants?: string[];
  exceptVariants?: string[];
  note?: string;
}

export interface GroundSpec {
  mode: 'solid' | 'pilotis';
  /** Set back of the open ground storey behind the facade line (pilotis). */
  recessM?: number;
  columnPitchM?: number;
  columnM?: number;
  /** Pilotis (#82): palette entry of the 0.5 m slab edge under the first floor (default `column`, the white band); `wall` when the brick storey runs down to the soffit (Sporenburg garage rows). */
  slabPalette?: PaletteKey;
  /** Storage doors in the recessed wall. */
  storageDoorW?: number;
  /** Solid ground: the palette's `plinth` covers only the lowest `plinthM` metres as a proud band (tiled plinth under render) instead of the whole ground storey. */
  plinthM?: number;
  /**
   * Solid ground without `plinthM` (#80): the palette's `plinth` covers this many storeys from the ground (default 1), the `wall` the
   * storeys above: two brick storeys under a sheet-clad top storey (Osdorp 1988 rows). Absent: unchanged.
   */
  plinthStoreys?: number;
  /** Columns at the footprint edge under cantilevered galleries/balconies (types with `insetM`), from the ground to `toM` (default one storey). */
  columns?: {facades: ('front' | 'back')[]; pitchM: number; sizeM: number; toM?: number};
}

/** A height on the block: metres above ground, a storey's floor line (+ metres), or metres above the eaves/roof surface. */
export type Height = number | {storey: number; plus?: number} | {eaves: number};

/**
 * A volume against one facade, outside or inside the footprint rectangle: lift and stair towers, garage rows, entrance halls,
 * a full-depth glazed storey. Positions are metres on the footprint rectangle's edge (not scaled with the bays).
 */
/** A glazed ribbon (or a glazed door: sill 0) over some faces of an annex; an annex may carry several (a side entrance door and a front window). */
export interface AnnexGlaze {faces: ('out' | 'left' | 'right')[]; sill: number; h: number; lightM: number; frame?: PaletteKey; marginM?: number}

export interface Annex {
  id: string;
  facade: FacadeId;
  /** Metres along the facade's rectangle edge from its left end (seen from outside). */
  u: [number, number];
  /** #85: `u[1]` is the margin from the edge's far end instead of a position (the annex spans every frontage of a design: set-back top storeys over rows of mixed widths). Absent: `u` are positions. */
  uFromEnd?: boolean;
  /** Metres out from the rectangle edge (negative: inside the footprint, e.g. back to the wall line). */
  d: [number, number];
  from?: Height;
  to: Height;
  /** `solid` volume (default) or an open stair: a landing slab per storey with a screen on the outer face and a cap. */
  kind?: 'solid' | 'openStair';
  /**
   * Plan of a solid annex: `rect` (default) or `segment`, a segmental bay whose outer face is a circular arc from (u0, d0) to (u1, d0)
   * bulging out to d1 at the middle, drawn as `segments` flat facets (default 5). A segment bay's glaze (faces 'out') runs over every
   * facet; `fascia` is drawn as a cap course on the arc; `doors` are not supported.
   */
  plan?: 'rect' | 'segment';
  segments?: number;
  material?: PaletteKey;
  /** Top band (slab edge) in `colour` (default `column`). */
  fascia?: {h: number; colour?: PaletteKey};
  /** Row of door leaves on the outer face (garage doors between brick piers). */
  doors?: {pitchM: number; w: number; h: number; colour?: PaletteKey; marginM?: number};
  /** A glazed ribbon over these faces, `lightM` metres per light. */
  glaze?: AnnexGlaze | AnnexGlaze[];
  /** Open stair only: screen colour (the measured mix of bars) and storeys it has landings on. */
  screen?: PaletteKey;
  /** Open stair only: screen height above each landing (default the storey height under the next slab: a full screen; ~1 m: a parapet). */
  screenH?: number;
  variants?: string[];
  exceptVariants?: string[];
  evidence?: string;
}

export interface TypeSpec {
  id: string;
  label: string;
  source: {clusterRank: number; panden: number; bouwjaar: [number, number]; lengthM: number; widthM: number; bouwlagen: number; roof: 'pitched' | 'flat'; dwellingsMedian: number};
  /** Terraced houses: the front is the SHORT side of the footprint (the generator's lengthM is the frontage, widthM the depth). */
  frontOnShort?: boolean;
  /** Houses whose footprint rectangle lies outside these ranges [min, max] metres (frontage x depth) are extended/notched variants of the design and are held by build.ts. */
  footprintRangeM?: {frontage: [number, number]; depth: [number, number]};
  /** Terraced houses built in mirrored pairs (door beside door): build.ts alternates `mirror` along each terrace. */
  alternateMirror?: boolean;
  /** Houses whose 3DBAG eaves height lies outside this range [min, max] metres are not this design (extra storey, raised eaves) and are held by build.ts. */
  eavesRangeM?: [number, number];
  /** Houses whose ridge height lies outside this range [min, max] metres (a raised or rebuilt roof) are not this design and are held by build.ts. */
  ridgeRangeM?: [number, number];
  /** One design built in distinct plot sizes (e.g. 6.5 m and 8.8 m deep cottages of one row type): ascending thresholds (metres) split the
   *  instances into size classes, each with its own unit mesh, so no instance is stretched across the gap. See sizeClass(). */
  sizeClassesM?: {frontage?: number[]; depth?: number[]};
  /** Terraced rows built as one project: every house of a row (same design, side by side, three or more) takes the row's median eaves, back eaves and ridge (build.ts; after the eavesRangeM hold). */
  rowCoherentHeights?: boolean;
  /** Storeys incl. the ground storey, all below the eaves/roof edge. */
  storeys: number;
  /** The footprint rectangle includes galleries/balconies: the long walls stand this far inside it (the roof still covers the whole rectangle). */
  insetM?: {front: number; back: number};
  annexes?: Annex[];
  /** The footprint rectangle is the tall body only, measured from the 3DBAG roof (build.ts `bodyRectFromItem`), not the BAG ring with its low annexes. */
  /** `{tolM}`: roof surfaces within `tolM` of the largest one's mean height count as the body (default 0.6 m, flat slabs); a pitched body needs
   * both slopes, whose mean heights differ by a metre or more when one is a catslide. */
  /** `from: 'highest'` (#82): the reference surface is the highest roof surface instead of the largest (a row whose low garden sheds
   *  out-cover the tall body on some pands); absent: the largest, unchanged. */
  bodyFromRoof?: boolean | {tolM: number; from?: 'largest' | 'highest'};
  roof: RoofSpec;
  ground: GroundSpec;
  defaultVariant: string;
  variants: Record<string, Variant>;
  facades: Record<FacadeId, FacadeSpec>;
  notes: string[];
}

/** Unit-key token of a house's size class ('f1d0': second frontage class, first depth class); undefined when the spec has no sizeClassesM. */
export function sizeClass(spec: Pick<TypeSpec, 'sizeClassesM'>, frontageM: number, depthM: number): string | undefined {
  const c = spec.sizeClassesM;
  if (!c) return undefined;
  const idx = (ts: number[] | undefined, v: number) => (ts ?? []).filter(t => v >= t).length;
  return `f${idx(c.frontage, frontageM)}d${idx(c.depth, depthM)}`;
}

/** Slots whose `measured` tint the look keeps (look/palette.ts MEASURED_SLOTS, minus glass and stone: not palette slots here). */
export const MEASURED_TINT_SLOTS: readonly Slot[] = ['brick', 'accent', 'bitumen', 'slate', 'roofTile'];

export function validateSpec(spec: TypeSpec): string[] {
  const errors: string[] = [];
  for (const [name, v] of Object.entries(spec.variants)) for (const [key, t] of Object.entries(v.palette)) {
    if (!t || typeof t !== 'object' || !(t as SlotTint).measured) continue;
    const st = t as SlotTint;
    if (!/^#[0-9a-f]{6}$/i.test(st.tint)) errors.push(`variant ${name}: measured ${key} tint ${st.tint} is not #rrggbb`);
    if (!MEASURED_TINT_SLOTS.includes(st.slot)) errors.push(`variant ${name}: ${key} slot ${st.slot} has no measured look`);
  }
  for (const [name, v] of Object.entries(spec.variants)) for (const [key, t] of Object.entries(v.palette)) {
    const st = t as SlotTint | string;
    if (!st || typeof st !== 'object' || !st.mottle) continue;
    if (st.slot !== 'brick') errors.push(`variant ${name}: ${key} mottle needs the brick slot`);
    for (const e of validateMottle(st.mottle)) errors.push(`variant ${name}: ${key} ${e}`);
  }
  if (spec.ground.plinthStoreys !== undefined && !(Number.isInteger(spec.ground.plinthStoreys) && spec.ground.plinthStoreys >= 1 && spec.ground.plinthStoreys < spec.storeys && !spec.ground.plinthM && spec.ground.mode === 'solid')) errors.push(`ground.plinthStoreys ${spec.ground.plinthStoreys} must be a whole number of storeys below the top, on a solid ground without plinthM`);
  if (!spec.variants[spec.defaultVariant]) errors.push(`defaultVariant ${spec.defaultVariant} not in variants`);
  for (const [axis, ts] of Object.entries(spec.sizeClassesM ?? {})) if (!ts?.length || ts.some((t, i) => !(t > 0) || (i > 0 && t <= ts[i - 1]))) errors.push(`sizeClassesM.${axis}: thresholds must be positive and ascending`);
  for (const id of FACADE_IDS) {
    const f = spec.facades[id];
    if (!f) { errors.push(`facade ${id} missing`); continue; }
    if (!f.bays.length) errors.push(`${id}: no bays`);
    if (f.counted.bays !== f.bays.length) errors.push(`${id}: counted.bays ${f.counted.bays} != ${f.bays.length} bays`);
    if (!f.evidence.length) errors.push(`${id}: no evidence`);
    if (new Set(f.bays.map(b => b.id)).size !== f.bays.length) errors.push(`${id}: duplicate bay ids`);
    for (const b of f.bays) for (const e of b.elements) for (const v of [...(e.variants ?? []), ...(e.exceptVariants ?? [])]) if (!spec.variants[v]) errors.push(`${id}/${b.id}: unknown variant ${v}`);
    for (const b of f.bays) for (const e of b.elements) {
      if (e.archShape !== undefined && e.archM === undefined) errors.push(`${id}/${b.id}: archShape needs archM`);
      if (e.diamond && (e.kind !== 'panel' || e.archM !== undefined)) errors.push(`${id}/${b.id}: diamond is for plain panels`);
      if (e.archM !== undefined && (e.kind !== 'panel' || !(e.archM > 0 && e.archM < (e.h ?? 1)))) errors.push(`${id}/${b.id}: archM needs a panel and 0 < archM < h`);
      if ((e.sash !== undefined || e.sashM !== undefined || e.round) && (e.kind !== 'window' || e.frameM === undefined || e.frameStyle === 'strips')) errors.push(`${id}/${b.id}: sash/round need a plate-frame window with frameM`);
      if (e.sashM !== undefined && !(e.sashM > 0 && e.sashM < Math.min(e.w ?? Infinity, e.h ?? Infinity) / 4)) errors.push(`${id}/${b.id}: sashM ${e.sashM} out of range`);
      if (e.round && (e.lights ?? 1) > 1) errors.push(`${id}/${b.id}: a round window has one light`);
      if ((e.stepRiseM !== undefined || e.stepTreadM !== undefined || e.stepWidthM !== undefined || e.stepRail !== undefined) && (e.kind !== 'door' || !(e.steps && e.steps > 0) || e.frameStyle === 'strips')) errors.push(`${id}/${b.id}: stoop fields need a plate door with steps`);
      if (e.stepRiseM !== undefined && !(e.stepRiseM > 0.1 && e.stepRiseM < 0.3)) errors.push(`${id}/${b.id}: stepRiseM ${e.stepRiseM} out of range`);
      if (e.panesHigh !== undefined && (e.kind !== 'window' || e.frameM === undefined || e.frameStyle === 'strips' || e.round || !Number.isInteger(e.panesHigh) || e.panesHigh < 2 || e.panesHigh > 8)) errors.push(`${id}/${b.id}: panesHigh needs a plate-frame window with frameM and 2-8 rows`);
      if (e.louvres !== undefined && (e.kind !== 'panel' || e.archM !== undefined || e.diamond || !Number.isInteger(e.louvres.count) || e.louvres.count < 1 || e.louvres.count > 30)) errors.push(`${id}/${b.id}: louvres need a plain panel and 1-30 slats`);
      if (e.stepTreadM !== undefined && !(e.stepTreadM >= 0.15 && e.stepTreadM <= 0.5)) errors.push(`${id}/${b.id}: stepTreadM ${e.stepTreadM} out of range`);
      if (e.frameM === undefined && e.transomM === undefined) continue;
      if (e.kind !== 'window' || e.frameStyle === 'strips') errors.push(`${id}/${b.id}: frameM/transomM are for plate-frame windows`);
      if (e.frameM !== undefined && !(e.frameM > 0 && e.frameM < Math.min(e.w ?? Infinity, e.h ?? Infinity) / 3)) errors.push(`${id}/${b.id}: frameM ${e.frameM} out of range`);
      if (e.transomM !== undefined && !(e.transomM > (e.frameM ?? 0.06) && e.transomM < (e.h ?? Infinity) - (e.frameM ?? 0.06))) errors.push(`${id}/${b.id}: transomM ${e.transomM} outside the window`);
    }
  }
  if (spec.storeys < 2) errors.push('storeys < 2');
  for (const a of spec.annexes ?? []) {
    if ((a.uFromEnd ? a.u[0] < 0 || a.u[1] < 0 : a.u[1] <= a.u[0]) || a.d[1] <= a.d[0]) errors.push(`annex ${a.id}: empty u/d range`);
    if (a.plan === 'segment' && (a.kind === 'openStair' || a.doors || (a.segments !== undefined && !(a.segments >= 2)))) errors.push(`annex ${a.id}: a segment bay is solid, without doors, with >= 2 segments`);
    for (const v of [...(a.variants ?? []), ...(a.exceptVariants ?? [])]) if (!spec.variants[v]) errors.push(`annex ${a.id}: unknown variant ${v}`);
  }
  for (const [i, d] of (spec.roof.dormers ?? []).entries()) {
    if (d.w <= 0 || d.h <= 0 || d.lights < 1) errors.push(`dormer ${i}: empty size or no lights`);
    for (const v of [...(d.variants ?? []), ...(d.exceptVariants ?? [])]) if (!spec.variants[v]) errors.push(`dormer ${i}: unknown variant ${v}`);
  }
  for (const [i, ch] of (spec.roof.chimneys ?? []).entries()) {
    if (!(ch.w > 0) || !(ch.d > 0) || !(ch.h > 0)) errors.push(`chimney ${i}: empty size`);
    for (const v of [...(ch.variants ?? []), ...(ch.exceptVariants ?? [])]) if (!spec.variants[v]) errors.push(`chimney ${i}: unknown variant ${v}`);
  }
  if (spec.roof.monoPitch && (spec.roof.form !== 'gable' || spec.roof.ridge !== 'long' || spec.roof.eavesFromPlanes || spec.roof.pairGable)) errors.push('monoPitch needs a long-ridge gable without eavesFromPlanes or pairGable');
  if (spec.roof.flatVerge && spec.roof.form !== 'flat') errors.push('flatVerge is for flat roofs');
  if (spec.roof.pairGable && spec.roof.form === 'flat') errors.push('pairGable needs a pitched roof');
  if (spec.annexes && new Set(spec.annexes.map(a => a.id)).size !== spec.annexes.length) errors.push('duplicate annex ids');
  return errors;
}
