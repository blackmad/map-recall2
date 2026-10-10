/** Authoring schema for a block-kit building. Every number is metres unless noted; no coordinates except sign/rule anchors. */
export type Slot = string;

export interface WinParams {
  /** window width: <=1 fraction of the bay, >1 metres */
  w?: number;
  /** window height: <=1 fraction of the storey, >1 metres */
  h?: number;
  /** height of the window sill above the storey's floor line (m) */
  sill?: number;
  /** vertical glazing bars (count of extra divisions) */
  mull?: number;
  /** horizontal transom at this fraction of the window height (0 = none) */
  transom?: number;
  frameW?: number;
  frame?: Slot; glass?: Slot; sillSlot?: Slot | null; headSlot?: Slot | null;
  /** stone/render surround of this thickness around the opening */
  surround?: { slot: Slot; t: number; out?: number };
  /** extra horizontal glazing bars (count of divisions - 1) */
  rows?: number;
  /** sill/ledge fascia height and projection (default 0.07 / 0.12) */
  sillH?: number; sillOut?: number;
  /** vertical louvre strip (m wide) on one side of the opening */
  louvre?: { w: number; side?: 'left' | 'right'; slot?: Slot };
  /** vertical glazing bars at these fractions (0-1) of the opening width; replaces `mull` (opt-in) */
  mullAt?: number[];
  /** horizontal glazing bars at these fractions of the opening height; replaces `rows` (opt-in) */
  rowsAt?: number[];
}

/**
 * Table-driven grid of panes for curtain walls (opt-in `panes` row). One cell = one bay on one floor. A layout is a list of
 * columns; a column is a width fraction, or [fraction, n] for n stacked sub-panes, or a negative fraction for a solid panel.
 * `table[floor][bay]` names the layout (floor/bay clamp to the last entry), so every cell is explicit and checkable against a photo.
 */
export interface PanesParams {
  layouts: Record<string, (number | [number, number])[]>;
  table: string[][];
  /** frame widths (m): outer edge of a heavy post/beam, light edge, and mullion */
  heavy: number; light: number; mull: number;
  /** horizontal frame thickness between floors (m); defaults to `light` */
  beam?: number;
  /** a cell is a "heavy" post on its left edge when bay % heavyEvery === 0, on its right edge when bay % heavyEvery === heavyEvery-1 */
  heavyEvery?: number; /** shifts the heavy-post phase; heavyEvery 0 = no heavy posts */ heavyShift?: number;
  glass: Slot; glass2?: Slot | null; solid?: Slot; frame?: Slot; inset?: number;
  /** projection of the frame boxes in front of the wall plane (0 = glass only) */
  frameOut?: number;
}

/** Explicit rectangle on the wall, in metres from the cell's left edge (u) and the floor line (v). */
export interface Item {
  kind: 'quad' | 'box' | 'win';
  u: [number, number]; v: [number, number];
  slot?: Slot; /** quad depth / box projection (m) */ d?: number;
  win?: WinParams;
}

export interface BalconyParams {
  depth?: number;
  /** balcony width (m), centred on the bay; default fills the cell */
  w?: number;
  slab?: { h?: number; slot?: Slot };
  rail?: { kind?: 'glass' | 'bars' | 'rods' | 'solid'; h?: number; slot?: Slot; top?: Slot | null };
  /** recessed glazing behind the balcony */
  back?: WinParams | null;
  /** side cheeks (m of wall each side, solid) */
  piers?: { w: number; slot?: Slot; out?: number } | null;
}

export interface CurtainParams {
  /** candidate subdivisions: list of rows, each a list of column fractions summing to 1 */
  variants: number[][][];
  frame?: number; glass?: Slot; glass2?: Slot | null;
  /** fraction of cells using glass2 (opaque panels) */
  glass2Ratio?: number;
  inset?: number;
}

/** Ground-floor shopfront: cream surround, upper panes, spandrel band, lower panes with a door. */
export interface ShopfrontParams {
  /** outer width incl. surround (m) and top above the row floor (m) */
  w: number; top: number; surround: { slot: Slot; t: number; out?: number };
  /** upper glazing v range, columns, rows */
  upper: { v0: number; v1: number; cols: number; rows: number; splitV?: number };
  spandrel: { v0: number; v1: number; slot?: Slot };
  lower: { v1: number; cols: number };
  /** door width/height and horizontal offset of its centre from the bay axis, per bay (modulo) */
  door: { w: number; h: number; offsets: number[]; slot?: Slot };
  frame?: Slot; glass?: Slot;
}

/** Double-height pointed window: lower pane, ledge, upper pane with shoulder and apex (absolute v offsets above the row floor). */
export interface PointedParams {
  w: number; bottom: number; shoulder: number; apex: number;
  ledge: { v0: number; v1: number; slot?: Slot; out?: number };
  lowerCols: number; lowerRows: number; upperCols: number; upperRows: number;
  surround?: { slot: Slot; t: number };
  frame?: Slot; glass?: Slot;
}

export interface GableParams extends WinParams { apex?: number; shoulder?: number; margin?: number }

export interface Row {
  kind: 'wall' | 'panes' | 'items' | 'shopfront' | 'pointed' | 'punched' | 'glazed' | 'balcony' | 'ribbon' | 'curtain' | 'gable' | 'stack';
  /** stack: sub-rows at v offsets (m) above the row's floor line */
  stack?: { v0: number; v1: number; row: Row }[];
  shopfront?: ShopfrontParams; pointed?: PointedParams;
  panes?: PanesParams;
  /** items: explicit rectangles per floor (index = floor, clamps to the last list), u/v relative to the cell and the floor line */
  items?: Item[][];
  win?: WinParams; balcony?: BalconyParams; curtain?: CurtainParams; gable?: GableParams;
  /** glazed: entrance door in the bay with these 0-based indices (modulo bays), or every n-th */
  door?: { bays?: number[]; w?: number; h?: number; slot?: Slot; portal?: { slot: Slot; t: number; out?: number } };
  /** ribbon: pier width between the glazing of adjacent bays */
  pier?: number;
  /** a cycle of rows chosen per bay (bay + shift*floor) */
  cycle?: Row[]; shift?: number;
}

export interface Band { slot: Slot; h: number; out: number; skipGround?: boolean; /** raise the band above the floor line */ lift?: number; fromFloor?: number }

export interface System {
  pitch: number; minWidth?: number;
  /** explicit bay axes: first axis (m from the panel's left edge), pitch and count; otherwise bays tile the panel */
  bays?: { first: number; pitch: number; count: number; /** widen the first cell leftwards / the last cell rightwards by these metres (opt-in) */ reach?: [number, number] };
  ground: Row; typical: Row; top?: Row; topCount?: number;
  /** explicit floor lines for this system only (overrides levels.lines; opt-in) */
  lines?: number[];
  rowOverrides?: Record<string, Row>;
  bands?: Band[];
  parapet?: { h: number; out: number; slot: Slot } | null;
  /** vertical piers/pilasters at bay joints */
  piers?: { w: number; out: number; slot: Slot; /** split each pier into this many stacked boxes so no open boundary loop exceeds the GLB audit's 30 m limit (opt-in) */ segments?: number } | null;
  /** extra storeys the first row sits above ground (arcades etc.) */
  base?: number;
  /** flat cladding laid over the wall from this height up (e.g. terracotta tiles) */
  cladding?: { slot: Slot; from: number; /** fraction range of the panel width */ u?: [number, number] } | null;
}

export interface Rule { at?: [number, number]; r?: number; bearing?: [number, number]; system: string; maxWidth?: number; minWidth?: number }
export interface Sign { text: string; at: [number, number]; /** baseline height (m) */ v: number; height: number; slot: Slot; /** fraction of panel width used */ span?: number; /** horizontal stretch of each glyph */ stretch?: number; offset?: number; letterSpacing?: number; font?: string }

export interface BlockSpec {
  id: string; pandId: string; name: string;
  palette: Record<Slot, string>;
  levels: { groundM: number; storeyM: number; first?: number; /** explicit floor lines above ground [0, g, ...]; the last is the wall top (opt-in) */ lines?: number[] };
  systems: Record<string, System>;
  default: string;
  rules?: Rule[];
  signs?: Sign[];
  /** system for panels touching a taller neighbour (default: blank wall) */
  party?: string;
  roofSlot?: Slot; wallSlot?: Slot;
  notes?: string;
}
