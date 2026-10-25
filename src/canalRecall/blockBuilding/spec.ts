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
  /**
   * Grouped windows (opt-in, issue #35): the opening `w` wide is drawn as `count` separate windows with `gap` m of wall
   * between them (the paired and tripled windows of one bay: Stadhouderskade's school, the Hirsch building's bays).
   */
  group?: { count: number; gap: number };
  /** recess mode: stand the sill on the cut wall's own plane (3DBAG walls merged into a panel can sit cm off its plane; opt-in) */
  sillOnWall?: boolean;
  /** recess mode: glazing bars stand this far (m) in front of the glass (default 0.015; 0.035 clears the audit's z-fight band; opt-in) */
  barD?: number;
  /**
   * recess mode, pane-split glazing (opt-in): one frame-coloured sheet fills the opening at the back of the recess and the glass
   * is laid over it as separate panes `PANE_OUT_M` in front, so the frame ring, mullions, transom and glazing bars are the
   * sheet showing between the panes: 2 triangles per pane and 2 for the sheet, where a ring costs 8 and each closed bar box 10.
   * `frameW` is the ring and bar width (default 0.07). White-framed cross windows on a byte budget (Tropenmuseum, 2026-10-16).
   */
  paneSplit?: boolean;
  /**
   * tilted bay (box) window: a frame ring of closed solids round the opening, `t` wide, standing `outBottom` off the wall at
   * the sill and `outTop` at the head, so its face leans (hotel box windows); the glass stays in the opening (opt-in)
   */
  tilt?: { slot: Slot; t: number; outTop: number; outBottom: number };
  /** arched head (round, segmental or pointed) with reveals and an optional arch band (opt-in, arch.ts) */
  arch?: import('./arch.ts').ArchParams;
  /**
   * recess mode, a loggia (recessed balcony, opt-in): the opening is cut `depth` m deep instead of the wall's recess, so
   * its floor, soffit and side returns read as an outdoor room, the glazing at the back; `rail` is a balustrade across
   * the front `inset` m behind the wall face (default 0.12), `h` m tall: one glass or solid sheet, or a top rail with
   * bars about every `BAR_PITCH_M`. Where the opening cannot be cut it is laid flat like any window and has no rail.
   */
  loggia?: { depth: number; rail?: { kind: 'glass' | 'bars' | 'solid'; h: number; slot: Slot; inset?: number };
    /**
     * the loggia's back is wall (the cut wall's slot) with rows of windows: per row, from `lo` to `hi` of the opening
     * height, a window `winW` m wide centred in every `pitch` m (opt-in, GitHub #86: the GWL gallery storeys, whose
     * photo shows the flats' doors and windows in a brick back wall behind the rail, not a glass wall)
     */
    back?: { rows: { lo: number; hi: number; pitch: number; winW: number }[] } };
  /**
   * recess mode, a side light in its own frame colour (opt-in, GitHub #86: the Da Vinci building's white-framed transom
   * windows each hold a blue-framed opening sash in their left third): a glazing bar (the window's frame slot) at `w` of
   * the opening width from `side` (none when `w` >= 1, the whole light), full-width bars at `low` and `high` of its height
   * (none at 0 / 1), and a ring `t` m wide in `slot` round the light those bars enclose, as deep as the glazing bars.
   */
  sash?: { side: 'left' | 'right'; w: number; low: number; high: number; slot: Slot; t?: number };
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

export interface Band { slot: Slot; h: number; out: number; skipGround?: boolean; /** raise the band above the floor line */ lift?: number; fromFloor?: number;
  /** also raise it by this fraction of the storey above the line (a course at the windows' head: sill + h x storey); storeys only, not the wall top (opt-in) */
  liftFrac?: number;
  /** leave out runs shorter than this (m; default 0.2) */
  minRun?: number }

export interface System {
  pitch: number; minWidth?: number;
  /** explicit bay axes: first axis (m from the panel's left edge), pitch and count; otherwise bays tile the panel */
  bays?: { first: number; pitch: number; count: number; /** widen the first cell leftwards / the last cell rightwards by these metres (opt-in) */ reach?: [number, number];
    /** explicit bay axes (m from the panel's left edge), each cell `pitch` wide; replaces first/count (curved runs, curve.ts; opt-in) */ centres?: number[] };
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
  /**
   * Recessed loggia bands (opt-in, GitHub #86: the GWL blocks' recessed gallery storeys in a punched brick front): one
   * opening per panel across bays `bays[0]..bays[1]` (cell edges, less `inset` m each side) from `sill` m above floor
   * line `floors[0]` to `head` m above floor line `floors[1]`, drawn as `win` (a loggia: cut `win.loggia.depth` deep, the
   * glazing at its back, a rail across it). The cells it covers draw nothing; panels with fewer bays or floors skip it.
   */
  recessBands?: RecessBand[];
  /** dark columns standing in front of the ground storey on every `every`-th bay edge from `first`, and a strip along the ground (GitHub #86; opt-in) */
  groundPiers?: GroundPiers;
}

export interface RecessBand { floors: [number, number]; bays: [number, number]; sill: number; head: number; inset: number; win: WinParams }

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

/**
 * Ground piers (GitHub #86, the Da Vinci south wing): boxes `w` m wide, `out` m proud, from the ground to `top` m, on bay
 * edges `first`, `first + every`, ... (edge 0 = the panel's left end); with `plinth` a flat strip `h` m tall along the
 * ground in its own slot (a vent grille under brick infill).
 */
export interface GroundPiers { every: number; first: number; w: number; out: number; top: number; slot: Slot; plinth?: { h: number; slot: Slot } }
