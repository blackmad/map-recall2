/**
 * Building-type specification (`types/<type>.json`). Data, not code: the
 * generator interprets bays and openings; the counts and photo evidence that
 * justify them live next to them so a reviewer can check the JSON against
 * the panorama.
 */
import type {Slot} from './mesh.ts';

export type FacadeId = 'front' | 'back' | 'left' | 'right';
export const FACADE_IDS: FacadeId[] = ['front', 'back', 'left', 'right'];

/** Floors an element repeats on. Floor 0 is the ground storey; `upper` = 1..storeys-1. */
export type Levels = 'ground' | 'upper' | 'all' | number[];

export type ElementKind = 'window' | 'balcony' | 'door' | 'storageDoor' | 'vents' | 'panel' | 'ribbon' | 'gallery';

/** Palette entries an element, annex or band can be drawn in (`gable` falls back to `wall` when the palette has none). */
export type PaletteKey = 'frame' | 'glass' | 'door' | 'accent' | 'rail' | 'dark' | 'column' | 'joint' | 'wall' | 'plinth' | 'roof' | 'gable';

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
  /** Horizontal bands (e.g. white slab edges) as [vFromGroundStoreyTopOffset, height] pairs, in storey index (0 = ground floor line). `levels` repeats the band on those storeys' floor lines instead of `floor`. */
  bands?: {floor: number; below: number; above: number; palette: string; levels?: Levels}[];
}

export interface Palette {
  wall: {slot: Slot; tint: string};
  /** Ground-storey wall when it differs (brick plinth under render). */
  plinth?: {slot: Slot; tint: string};
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
  roof: {slot: Slot; tint: string};
  /** Gable (short side) walls when they differ from the long walls (brick gables of a panel slab). */
  gable?: {slot: Slot; tint: string};
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
}

export interface GroundSpec {
  mode: 'solid' | 'pilotis';
  /** Set back of the open ground storey behind the facade line (pilotis). */
  recessM?: number;
  columnPitchM?: number;
  columnM?: number;
  /** Storage doors in the recessed wall. */
  storageDoorW?: number;
  /** Solid ground: the palette's `plinth` covers only the lowest `plinthM` metres as a proud band (tiled plinth under render) instead of the whole ground storey. */
  plinthM?: number;
  /** Columns at the footprint edge under cantilevered galleries/balconies (types with `insetM`), from the ground to `toM` (default one storey). */
  columns?: {facades: ('front' | 'back')[]; pitchM: number; sizeM: number; toM?: number};
}

/** A height on the block: metres above ground, a storey's floor line (+ metres), or metres above the eaves/roof surface. */
export type Height = number | {storey: number; plus?: number} | {eaves: number};

/**
 * A volume against one facade, outside or inside the footprint rectangle: lift and stair towers, garage rows, entrance halls,
 * a full-depth glazed storey. Positions are metres on the footprint rectangle's edge (not scaled with the bays).
 */
export interface Annex {
  id: string;
  facade: FacadeId;
  /** Metres along the facade's rectangle edge from its left end (seen from outside). */
  u: [number, number];
  /** Metres out from the rectangle edge (negative: inside the footprint, e.g. back to the wall line). */
  d: [number, number];
  from?: Height;
  to: Height;
  /** `solid` volume (default) or an open stair: a landing slab per storey with a screen on the outer face and a cap. */
  kind?: 'solid' | 'openStair';
  material?: PaletteKey;
  /** Top band (slab edge) in `colour` (default `column`). */
  fascia?: {h: number; colour?: PaletteKey};
  /** Row of door leaves on the outer face (garage doors between brick piers). */
  doors?: {pitchM: number; w: number; h: number; colour?: PaletteKey; marginM?: number};
  /** A glazed ribbon over these faces, `lightM` metres per light. */
  glaze?: {faces: ('out' | 'left' | 'right')[]; sill: number; h: number; lightM: number; frame?: PaletteKey; marginM?: number};
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
  /** Storeys incl. the ground storey, all below the eaves/roof edge. */
  storeys: number;
  /** The footprint rectangle includes galleries/balconies: the long walls stand this far inside it (the roof still covers the whole rectangle). */
  insetM?: {front: number; back: number};
  annexes?: Annex[];
  /** The footprint rectangle is the tall body only, measured from the 3DBAG roof (build.ts `bodyRectFromItem`), not the BAG ring with its low annexes. */
  bodyFromRoof?: boolean;
  roof: RoofSpec;
  ground: GroundSpec;
  defaultVariant: string;
  variants: Record<string, Variant>;
  facades: Record<FacadeId, FacadeSpec>;
  notes: string[];
}

export function validateSpec(spec: TypeSpec): string[] {
  const errors: string[] = [];
  if (!spec.variants[spec.defaultVariant]) errors.push(`defaultVariant ${spec.defaultVariant} not in variants`);
  for (const id of FACADE_IDS) {
    const f = spec.facades[id];
    if (!f) { errors.push(`facade ${id} missing`); continue; }
    if (!f.bays.length) errors.push(`${id}: no bays`);
    if (f.counted.bays !== f.bays.length) errors.push(`${id}: counted.bays ${f.counted.bays} != ${f.bays.length} bays`);
    if (!f.evidence.length) errors.push(`${id}: no evidence`);
    if (new Set(f.bays.map(b => b.id)).size !== f.bays.length) errors.push(`${id}: duplicate bay ids`);
    for (const b of f.bays) for (const e of b.elements) for (const v of [...(e.variants ?? []), ...(e.exceptVariants ?? [])]) if (!spec.variants[v]) errors.push(`${id}/${b.id}: unknown variant ${v}`);
  }
  if (spec.storeys < 2) errors.push('storeys < 2');
  for (const a of spec.annexes ?? []) {
    if (a.u[1] <= a.u[0] || a.d[1] <= a.d[0]) errors.push(`annex ${a.id}: empty u/d range`);
    for (const v of [...(a.variants ?? []), ...(a.exceptVariants ?? [])]) if (!spec.variants[v]) errors.push(`annex ${a.id}: unknown variant ${v}`);
  }
  if (spec.annexes && new Set(spec.annexes.map(a => a.id)).size !== spec.annexes.length) errors.push('duplicate annex ids');
  return errors;
}
