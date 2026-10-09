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
  kind: 'wall' | 'shopfront' | 'pointed' | 'punched' | 'glazed' | 'balcony' | 'ribbon' | 'curtain' | 'gable' | 'stack';
  /** stack: sub-rows at v offsets (m) above the row's floor line */
  stack?: { v0: number; v1: number; row: Row }[];
  shopfront?: ShopfrontParams; pointed?: PointedParams;
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
  bays?: { first: number; pitch: number; count: number };
  ground: Row; typical: Row; top?: Row; topCount?: number;
  rowOverrides?: Record<string, Row>;
  bands?: Band[];
  parapet?: { h: number; out: number; slot: Slot } | null;
  /** vertical piers/pilasters at bay joints */
  piers?: { w: number; out: number; slot: Slot } | null;
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
  levels: { groundM: number; storeyM: number; first?: number };
  systems: Record<string, System>;
  default: string;
  rules?: Rule[];
  signs?: Sign[];
  /** system for panels touching a taller neighbour (default: blank wall) */
  party?: string;
  roofSlot?: Slot; wallSlot?: Slot;
  notes?: string;
}
