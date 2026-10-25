/**
 * Named facade systems for `kind: large` building recipes: each name expands to a block-kit `System`
 * (compose.ts rows, bands, piers) from a handful of fitted numbers (bay pitch, storey lines). The large tier
 * compiles with `ComposeOptions.recessM`, so every window here is cut into the 3DBAG wall with reveals.
 *
 * Slot names are block-kit slots; `largeCompile.ts` maps them to recipe material slots (brick/stucco, stone,
 * frame, door, glass, accent, roofTile/slate/bitumen) with the palette colour as tint.
 */
import type { Row, System, WinParams } from './spec.ts';
import type { ArchKind, ArchParams } from './arch.ts';

/**
 * - `glazed-hall`: a brick base, then one glass skin up to the eaves with a mullion grid (largeCompile `drawGlazedHall`);
 * - `glazed-columns`: punched brick bays with full-height glass stripes in the listed bays (`drawGlazedColumns`);
 * - `french-window-ledge`: tall two-leaf windows (0.75 of the storey) over a continuous ledge at every storey line.
 */
export const LARGE_SYSTEMS = ['brick-bay-grid', 'ribbon-windows', 'curtain-wall', 'plinth-shopfronts', 'blank', 'glazed-hall', 'glazed-columns', 'french-window-ledge'] as const;
export type LargeSystemName = typeof LARGE_SYSTEMS[number];
/**
 * `mesh-plinth` (layered curtain wall only): the glass skin runs down to the ground and a closed dark panel covers the ground storey (largeCompile `drawPlinthPanel`).
 * `arcade`: a recessed shop arcade (Berlage's Mercatorplein galleries): one chamfered-head opening per bay between piers,
 * cut `arcade.depth` deep with the shopfronts (four transom lights) at the back, a rendered lintel band over the openings
 * and pier facings below it (largeCompile `drawArcadeFacing`).
 */
export const LARGE_GROUNDS = ['system', 'plinth-shopfronts', 'glazed', 'blank', 'portals', 'mesh-plinth', 'arcade'] as const;
export type LargeGround = typeof LARGE_GROUNDS[number];
export const LARGE_WINDOWS = ['plain', 'two-light', 'cross', 'transom', 'low', 'narrow', 'wide', 'stacked', 'three-light'] as const;
export type LargeWindow = typeof LARGE_WINDOWS[number];

/** Default bay pitch (m) per system when the intent gives no bay count. */
export const DEFAULT_PITCH_M: Record<LargeSystemName, number> = {
  'brick-bay-grid': 3.2, 'ribbon-windows': 2.7, 'curtain-wall': 1.8, 'plinth-shopfronts': 4.5, blank: 6,
  'glazed-hall': 15, 'glazed-columns': 1.5, 'french-window-ledge': 2.2,
};

/** French window: width of the bay, height of the storey, sill (m) over the storey line; the ledge stands under the sill. */
export const FRENCH_WINDOW = { w: 0.5, h: 0.75, sillM: 0.2, ledgeH: 0.14, ledgeOut: 0.12, rail: 0.3 };

export interface SystemFit {
  pitchM: number;
  /** absolute storey lines above ground [0, ground top, ..., wall top] (compose `System.lines`) */
  lines: number[];
  ground: LargeGround;
  windows?: LargeWindow;
  stringCourses?: boolean;
  piers?: boolean;
  /** storeys (0 = ground) with balconies across every bay */
  balconyStoreys?: number[];
  /** storeys (0 = ground) drawn as plain wall */
  blankStoreys?: number[];
  /** storeys (0 = ground) glazed like a shop ground across every bay (a glazed mezzanine over the shops) */
  glazedStoreys?: number[];
  balconyRail?: 'glass' | 'bars' | 'solid';
  /** balcony rail (and top rail) slot when the rails have their own colour (black iron), default the frame slot (opt-in) */
  balconyRailSlot?: string;
  /** balcony projection (m) when not the default 1.2 m (a shallow iron balcony on consoles; opt-in) */
  balconyDeepM?: number;
  /** the balcony stands in front of the storey's own windows (an iron balcony on a window row) instead of a French window (opt-in) */
  balconyOnWindows?: boolean;
  /** with balconyOnWindows: the balcony spans the full bay pitch so neighbouring bays join into one run (opt-in) */
  balconyRun?: boolean;
  /** grouped windows: each bay's opening is `count` windows with `gapM` of wall between them, on the listed storeys (default every upper storey; opt-in) */
  windowGroup?: { count: number; gapM: number; storeys?: number[] };
  /** balconies only in every `every`-th bay from `first`, or the listed bays (of `bays` per storey); default every bay */
  balconyBays?: { every?: number; first?: number; bays?: number[] };
  /** slot names for this wall group (per-group palette overrides get their own slots) */
  slots: { frame: string; stone: string; glass: string; door: string; curtain: string; wall?: string; /** flush brick arch bands (a shade darker than the wall) */ arch?: string };
  /** arched heads (upper windows / ground openings) and the band around them */
  arches?: { windows?: ArchKind; ground?: ArchKind; band?: 'brick' | 'stone' | 'voussoir' | 'blocks' | 'none'; /** only these storeys (0 = ground) get arched heads; the rest are square-headed */ storeys?: number[] };
  /** loading-door axis: every `every`-th bay from `first`, or the listed bays (of `bays` per storey) */
  hoist?: { every?: number; first?: number; bays?: number[]; arch?: ArchKind };
  /** a carriage gateway through the ground storey in the listed bays: a dark arched opening one bay wide, the other ground bays plain wall
   *  (`keepRow`: the other ground bays keep the ground row, and hall doors may take further bays) */
  gateways?: { bays: number[]; arch?: ArchKind; keepRow?: boolean };
  /** glazed hall doors in the listed ground bays (of `bays` per storey): square-headed (or arched) white-framed grids, the other ground bays keep the ground row */
  hallDoors?: HallDoors;
  /** bays per storey on the group's widest panel (for `hoist.bays`) */
  bays?: number;
  /** false = no projecting stone sills */
  sills?: boolean;
  /** false = no frame ring around the glass (dark frames that read as glass; saves triangles); glazing bars stay */
  frames?: boolean;
  /** true = glazing bars 3.5 cm proud of the glass (clears the z-fight audit's under-3 cm band) */
  deepBars?: boolean;
  /** tilted bay (box) windows in every `every`-th bay from `first`, or the listed bays, on the listed storeys (default every upper storey) */
  tilted?: TiltedBays | TiltedBays[];
  /** perforated-brick screen: the windows become scattered glass-block perforations (one bay in three, staggered per storey); the lattice is a component */
  screen?: boolean;
  /** layered kit (intent `layeredKit`): a curtain wall is a glass skin (the group's wall) with a mullion grid component, no cut openings */
  layered?: boolean;
  /** measured window proportions (intent `windowShape`): width of the bay, height of the storey, sill in metres; overrides the `windows` preset's size */
  shape?: { w: number; h: number; sillM: number };
  /** window proportions per upper storey (intent `storeyShapes`): width of the bay, height of the storey, sill in metres; opt-in */
  storeyShapes?: { storey: number; w: number; h: number; sillM: number }[];
  /** glazed-columns: bays (of `bays` per storey, cycling) that carry a glass stripe instead of windows */
  columnBays?: number[];
  /** ground `arcade`: the opening geometry (fitLarge fills the defaults, ARCADE_DEFAULTS) */
  arcade?: ArcadeFit;
  /** pane-split glazing on every window of the group (intent `glazing: "panes"`, compose `WinParams.paneSplit`) */
  paneSplit?: boolean;
  /** stone courses at the windows' sill line and/or head line on every upper storey (intent `courses`) */
  courses?: ('sill' | 'head')[];
  /** the ground storey is a souterrain: SOUTERRAIN.factor of an upper storey (fitLarge), two small windows per bay (`single`: one) (intent `souterrain`) */
  souterrain?: boolean | 'single';
  /** on each entry's storeys (1 = first floor; 0 = the ground row) only the listed bays (of `bays` per storey) keep the storey's openings; the rest is plain wall (intent `openBays`) */
  openBays?: { storeys: number[]; bays: number[] }[];
  /**
   * Window width per bay, cycling across the bays as fractions of the bay (intent `windowPattern`): `[0.85, 0.3]` draws
   * a wide drawing-room window on the even bays and a narrow slot on the odd ones (the pair rhythm of the 2023
   * Haarlemmerweg blocks). The bays stay on one pitch; only the opening width and so the pier width change.
   * `h` and `sill` stay the group's (`windowShape`).
   */
  windowPattern?: number[];
  /** recessed balconies on some storeys (intent `loggias`; fitLarge fills the defaults, LOGGIA) */
  loggias?: LoggiaFit;
  /** a glazed plinth with its own mullion pitch on the lowest storeys (intent `plinth`; fitLarge fills the defaults, PLINTH) */
  plinth?: PlinthFit;
}

/**
 * Loggias (recessed balconies) in a punched grid: on each listed storey (0 = ground) one opening per bay (or the listed
 * bays) `w` of the bay wide and `h` of the storey tall from `sill` (fractions), cut `deep` x the storey height into the
 * wall, `lights` glazed leaves at the back and a `rail` balustrade across the front in `railSlot` (none on the ground).
 */
export interface LoggiaFit { storeys: number[]; bays?: number[]; w: number; h: number; sill: number; deep: number; rail: 'glass' | 'bars' | 'solid' | 'none'; lights: number; railSlot: string }
/**
 * OBA IJburg (2019 crops w03-221L, w04-41L): 4.4 m loggias on a 5.6 m bay (0.78), 0.72-0.8 of a 3 m storey from the slab,
 * about 1.5 m deep (0.5 of the storey), two-leaf glazing at the back, pale glass balustrades about 1 m tall.
 */
export const LOGGIA = { w: 0.78, h: 0.8, sill: 0.03, deep: 0.5, rail: 'glass' as const, lights: 2, railM: 1.0 };
/**
 * A glazed plinth: on each listed storey (0 = ground) one glazed opening per bay (or the listed bays) leaving `pier` of
 * the bay as wall between bays, from `sill` to `sill + h` of the storey, split into `lights` equal lights (its own
 * mullion pitch, independent of the upper grid's windows) with an optional transom at `transom` of the glazing height.
 */
export interface PlinthFit { storeys: number[]; bays?: number[]; lights: number; sill: number; h: number; pier: number; transom: number }
/** Plinth defaults: a low kerb, glazing to 0.88 of the storey, 8 % piers (OBA IJburg's library storey, Reigersbos shops). */
export const PLINTH = { sill: 0.04, h: 0.84, pier: 0.08, transom: 0 };

/**
 * A souterrain (raised basement) under the piano nobile: the storey is `factor` of an upper storey, and each bay has a pair of
 * small windows, each `w` of the bay, `gap` apart, `h` of the storey tall from `sill` (fractions), arched when `arches.ground`
 * is given. Measured on the Tropenmuseum's Mauritskade and Linnaeusstraat crops (w01-331, w04-331, w16-61; 2.8-3.5 m storeys
 * under 4.5-5.5 m floors, 0.6-0.8 m lights in pairs 0.5 m apart, 1.25-1.65 m tall).
 */
export const SOUTERRAIN = { factor: 0.58, w: 0.22, gap: 0.15, h: 0.46, sill: 0.18 };
/** Stone course under the sill / over the head (`courses`): height and projection (m); runs shorter than `minRun` (returns, slivers) are left out. */
export const COURSE = { h: 0.14, out: 0.06, minRun: 1.5 };

/** Recessed shop arcade (ground `arcade`): pier width and walk depth in metres, the rest as fractions. */
export interface ArcadeFit {
  /** pier width between openings (m) */
  pierM: number;
  /** depth of the walk: the shopfront glazing stands this far behind the wall face (m) */
  depthM: number;
  /** opening head over the ground storey line, as a fraction of the ground storey */
  head: number;
  /** chamfered shoulders: vertical rise and horizontal run, fractions of the opening width */
  rise: number; chamfer: number;
}
/**
 * Arcade proportions of the Mercatorplein north front (all-walls crop w01-165, 2018/2022): 1.1 m piers on a 6.1 m
 * pitch (0.18 of the bay), the walk about 2.4 m deep in a 5 m storey (0.48), 4.2 m heads (0.84), shoulders 0.16 x 0.2
 * of the opening width. fitLarge turns the fractions into metres for the group's pitch and ground storey.
 */
export const ARCADE_PROPORTIONS = { pier: 0.18, walk: 0.48, head: 0.84, rise: 0.16, chamfer: 0.2 };
/** The proportions in metres for a 6.1 m bay and a 5 m ground storey (the fallback when no fit is given). */
export const ARCADE_DEFAULTS: ArcadeFit = { pierM: 1.1, depthM: 2.4, head: 0.84, rise: 0.16, chamfer: 0.2 };

/** Glass-block perforation in a screen cell: a small square opening with a cross of 3.5 cm closed bars, no frame ring or sill. */
const glassBlock = (f: SystemFit): WinParams => ({ w: 0.62, h: 0.34, sill: 0.95, mull: 1, rows: 1, frameW: 0, sillSlot: null, barD: 0.035, frame: f.slots.stone, glass: f.slots.glass });

/**
 * Glazed hall doors (De Hallen's tram-hall gables, 2026-10-14): in the listed ground bays a door opening `h` of the ground
 * storey tall and 94 % of the bay wide, down to 2 cm off the ground, glazed in `lights` columns and `rows` rows of
 * white-framed panes, square-headed unless `arch` is given. Adjacent door bays read as one wide portal split by slim
 * piers of wall; the other ground bays keep the system's ground row (the side windows).
 */
export interface HallDoors { bays: number[]; arch?: ArchKind; lights?: number; rows?: number; h?: number }
/** `archedSill`: arch.ts cuts an arched opening only clear of the wall's foot (a square one may trim its sill instead), so arched doors start 12 cm up. */
export const HALL_DOOR = { w: 0.94, h: 0.78, sill: 0.02, archedSill: 0.12, lights: 2, rows: 4 };

export interface TiltedBays { every?: number; first?: number; bays?: number[]; storeys?: number[] }

/** Tilted bay frame: 14 cm ring, 42 cm off the wall at the sill leaning back to 12 cm at the head (Engelsesteeg hotel wing). */
export const TILT_FRAME = { t: 0.14, outBottom: 0.42, outTop: 0.12 };

/** Arch params for a head of this kind with the group's band (brick bands are drawn in the wall slot). */
export function archFor(kind: ArchKind | undefined, f: SystemFit, extra: Partial<ArchParams> = {}): { arch?: ArchParams } {
  if (!kind) return {};
  const s = f.slots, b = f.arches?.band ?? 'brick';
  const band = b === 'none' ? undefined
    : b === 'brick' ? { slot: s.arch ?? s.wall ?? 'wall', t: 0.22, out: 0, imposts: s.stone }
    : b === 'stone' ? { slot: s.stone, t: 0.2, out: 0.03 }
    // stone blocks on a brick head without a drawn ring (speklagen arches): springers and a keystone
    : b === 'blocks' ? { slot: s.stone, t: 0.22, out: 0.03, ring: false, imposts: s.stone, keystone: s.stone }
    : { slot: s.stone, t: 0.24, out: 0.04, imposts: s.stone, keystone: s.stone };
  return { arch: { kind, ...(kind === 'segmental' ? { segments: 4 } : {}), ...(band ? { band } : {}), ...extra } };
}

const glazing = (w: LargeWindow | undefined): Partial<WinParams> => {
  switch (w) {
    case 'two-light': return { mull: 1 };
    case 'cross': return { mull: 1, transom: 0.7 };
    case 'transom': return { transom: 0.78 };
    // Wide, low office windows set high in the storey (1990s brick blocks: two rows of small horizontal windows per floor).
    case 'low': return { w: 0.62, h: 0.4, sill: 1.05 };
    // Tall single-light windows about half the bay wide (warehouse fronts on a 2 m bay rhythm).
    case 'narrow': return { w: 0.46, h: 0.56, sill: 0.95 };
    // Wide multi-light school windows two thirds of the bay: four lights and a transom (Amsterdam School classrooms).
    case 'wide': return { w: 0.68, h: 0.58, sill: 0.8, mull: 3, transom: 0.72 };
    // Tall warehouse window spanning several storeys: two lights and five horizontal bars (Pakhuis Wilhelmina's north front).
    case 'stacked': return { mull: 1, rows: 5 };
    // Three lights in two tiers (the Tropenmuseum's round-arched museum windows: two mullions and a mid rail under the fanlight).
    case 'three-light': return { mull: 2, rows: 1 };
    default: return {};
  }
};

function groundRow(f: SystemFit, upper: Row): Row {
  const s = f.slots;
  switch (f.ground) {
    case 'blank': case 'mesh-plinth': return { kind: 'wall' };
    // Tall arched (or square-headed) doors in every bay: warehouse ground floors.
    case 'portals': return { kind: 'punched', win: { w: 0.5, h: 0.78, sill: 0.06, mull: 1, frameW: 0, frame: s.frame, glass: s.door, ...archFor(f.arches?.ground ?? 'round', f) } };
    // Recessed arcade: chamfered openings between piers, the reveal is the walk (rendered soffit), shopfronts at the back.
    case 'arcade': {
      const a = f.arcade ?? ARCADE_DEFAULTS, w = Math.max(0.3, Math.min(0.92, 1 - a.pierM / f.pitchM));
      return { kind: 'punched', win: { w, h: a.head, sill: 0.05, mullAt: [0.25, 0.5, 0.75], rowsAt: [0.72], frameW: 0.06, frame: s.frame, glass: s.glass, sillSlot: null, ...(f.deepBars ? { barD: 0.035 } : {}),
        arch: { kind: 'chamfered', rise: a.rise, chamfer: a.chamfer, depth: a.depthM, revealSlot: s.stone } } };
    }
    case 'glazed': return { kind: 'glazed', win: { w: 0.9, h: 0.86, sill: 0.1, mull: 1, transom: 0.82, ...(f.deepBars ? { barD: 0.035 } : {}), frame: s.frame, glass: s.glass } };
    // Shop windows down to a low stall riser, a transom light under the fascia (the fascia band is a component).
    case 'plinth-shopfronts': return { kind: 'glazed', win: { w: 0.86, h: 0.74, sill: 0.35, mull: 1, transom: 0.8, ...(f.deepBars ? { barD: 0.035 } : {}), frame: s.frame, glass: s.glass } };
    // A windowed ground with arched heads (`arches.ground` without portals): the upper storeys' window, arched.
    default: return f.arches?.ground && upper.kind === 'punched' && upper.win ? { ...upper, win: { ...upper.win, ...archFor(f.arches.ground, f) } } : upper;
  }
}

/** Expand a system name into a compose `System`. */
export function largeSystem(name: LargeSystemName, f: SystemFit): System {
  const s = f.slots, g = { ...glazing(f.windows), ...(f.shape ? { w: f.shape.w, h: f.shape.h, sill: f.shape.sillM } : {}) };
  let bands: System['bands'] = f.stringCourses ? [{ slot: s.stone, h: 0.16, out: 0.05, skipGround: false }] : undefined;
  const piers = f.piers ? { w: 0.36, out: 0.1, slot: s.stone, segments: 3 } : null;
  let typical: Row;
  switch (name) {
    case 'brick-bay-grid':
      // Narrow bays (canal-house rhythm, < 2 m) take proportionally wider windows than civic 3 m bays.
      typical = { kind: 'punched', win: { w: f.pitchM < 2 ? 0.66 : 0.48, h: 0.6, sill: 0.85, frame: s.frame, glass: s.glass, sillSlot: f.sills === false ? null : s.stone, sillH: 0.08, sillOut: 0.1, frameW: f.frames === false ? 0 : 0.07, ...(f.deepBars ? {barD: 0.035} : {}), ...g, ...archFor(f.arches?.storeys ? undefined : f.arches?.windows, f) } };
      break;
    case 'ribbon-windows':
      // One opening per bay per storey with a slim pier between bays: reads as a continuous band of glazing.
      typical = { kind: 'ribbon', pier: f.shape ? Math.max(0.12, +((1 - f.shape.w) * f.pitchM).toFixed(3)) : 0.18, win: { h: 0.56, sill: 0.9, mull: 1, frame: s.frame, glass: s.glass, frameW: 0.06, ...(f.deepBars ? {barD: 0.035} : {}), ...g } };
      break;
    case 'curtain-wall':
      // Layered kit: the wall is the glass skin and the grid a component (largeCompile `drawCurtainGrid`): nothing is cut.
      if (f.layered) { typical = { kind: 'wall' }; break; }
      // Nearly full cells: the wall left between openings is the mullion/transom grid (the group's curtain slot).
      typical = { kind: 'punched', win: { w: 0.9, h: 0.88, sill: 0.12, frame: s.frame, glass: s.glass, frameW: 0.04, ...g } };
      break;
    case 'plinth-shopfronts':
      typical = { kind: 'punched', win: { w: 0.5, h: 0.6, sill: 0.85, frame: s.frame, glass: s.glass, sillSlot: s.stone, ...g } };
      break;
    case 'blank':
    // Glazed hall: the brick base and the glass skin are components over plain wall (largeCompile `drawGlazedHall`).
    case 'glazed-hall':
      typical = { kind: 'wall' };
      break;
    case 'glazed-columns': {
      // The brick bays' windows (narrow by default); the column bays are left as wall for the glass stripe component.
      const win: Row = { kind: 'punched', win: { w: 0.42, h: 0.6, sill: 0.85, frame: s.frame, glass: s.glass, sillSlot: null, frameW: f.frames === false ? 0 : 0.06, ...(f.deepBars ? {barD: 0.035} : {}), ...g } };
      const list = f.columnBays ?? [], every = Math.max(1, f.bays ?? 1, ...list.map(b => b + 1));
      typical = list.length ? { kind: 'wall', cycle: Array.from({ length: every }, (_, k) => (list.includes(k) ? ({ kind: 'wall' } as Row) : win)) } : win;
      break;
    }
    case 'french-window-ledge': {
      // A Juliet rail bar across the lower third (the French-window read at range; two leaves would cost a second deep bar per window), a thin frame, no sill box (the ledge is the sill).
      const F = FRENCH_WINDOW;
      typical = { kind: 'punched', win: { w: F.w, h: F.h, sill: F.sillM, rowsAt: [F.rail], frame: s.frame, glass: s.glass, sillSlot: null, frameW: f.frames === false ? 0 : 0.04, ...(f.deepBars ? {barD: 0.035} : {}), ...g } };
      typical.win!.sill = Math.max(F.ledgeH + 0.02, typical.win!.sill ?? F.sillM);
      // arched heads (`arches.windows`, e.g. segmental) with the group's arch ring (`palette.arch`)
      if (f.arches?.windows) typical = { ...typical, win: { ...typical.win!, ...archFor(f.arches.windows, f) } };
      break;
    }
  }
  // Perforated screen: glass blocks in one bay of three, the pattern shifted by two bays per storey (scattered, as built).
  if (f.screen && name !== 'blank') typical = { kind: 'wall', cycle: [{ kind: 'punched', win: glassBlock(f) }, { kind: 'wall' }, { kind: 'wall' }], shift: 2 };
  const rowOverrides: Record<string, Row> = {};
  // Window proportions per storey (tall first-floor windows under a frieze of small attic windows): the storey's own
  // punched row, before every later pass (arches, balconies, openBays, groups, plinth) builds on it.
  if (f.storeyShapes?.length && typical.kind === 'punched' && typical.win && !typical.cycle && !f.screen)
    for (const e of f.storeyShapes) if (e.storey > 0) rowOverrides[String(e.storey)] = { ...typical, win: { ...typical.win, w: e.w, h: e.h, sill: e.sillM } };
  // Arched heads on chosen storeys only (a round-headed piano nobile between a square ground and attic).
  const archedStoreys = name === 'brick-bay-grid' && f.arches?.windows && f.arches.storeys ? f.arches.storeys : [];
  const archedRow = (st: number): Row => { const r = rowOverrides[String(st)] ?? typical; return { ...r, win: { ...r.win!, ...archFor(f.arches!.windows, f) } }; };
  for (const st of archedStoreys) if (st > 0) rowOverrides[String(st)] = archedRow(st);
  if (f.balconyStoreys?.length && name !== 'blank') {
    const railSlot = f.balconyRailSlot ?? s.frame, onWin = f.balconyOnWindows && typical.win && !typical.cycle ? typical.win : null;
    // on a window row the balcony spans the bay's windows and 0.2 m either side (the pilasters between bays stay clear)
    const onW = onWin ? (onWin.w ?? 0.5) : 0, span = onWin ? (f.balconyRun ? f.pitchM : Math.min(f.pitchM - 0.1, (onW <= 1 ? onW * f.pitchM : onW) + 0.4)) : 0;
    const balcony: Row = { kind: 'balcony', balcony: { ...(onWin ? { w: +span.toFixed(3) } : {}), depth: f.balconyDeepM ?? 1.2, slab: { h: 0.18, slot: s.stone }, rail: { kind: f.balconyRail ?? 'bars', h: 1.0, slot: railSlot, top: railSlot }, back: onWin ? { ...onWin, w: +(Math.min(span, onW <= 1 ? onW * f.pitchM : onW) / span).toFixed(4), sillSlot: null } : { w: 0.7, h: 0.72, sill: 0.25, frame: s.frame, glass: s.glass, mull: 1 } } };
    const sel = f.balconyBays, list = sel?.bays, every = list ? Math.max(1, f.bays ?? 1, ...list.map(b => b + 1)) : Math.max(1, sel?.every ?? 1), at = ((sel?.first ?? 0) % every + every) % every;
    // the storey's own row (an arched piano nobile) fills the bays without a balcony
    for (const st of f.balconyStoreys) { const under = rowOverrides[String(st)] ?? typical; rowOverrides[String(st)] = !sel ? balcony
      : { kind: 'wall', cycle: Array.from({ length: every }, (_, k) => ((list ? list.includes(k) : k === at) ? balcony : under)) }; }
  }
  // Storeys without openings (a blank storage floor over a shop, a plant floor): plain wall rows.
  for (const st of f.blankStoreys ?? []) rowOverrides[String(st)] = { kind: 'wall' };
  // Glazed upper storeys (Kinkerstraat 32-54: the shops' mezzanine is one glass band over the shop windows): the
  // `glazed` ground row, framed glazing 90 % of each bay down to a low sill, on the listed storeys.
  for (const st of f.glazedStoreys ?? []) if (st > 0) rowOverrides[String(st)] = groundRow({ ...f, ground: 'glazed' }, typical);
  // Openings in only some bays (2006 Rietveld tower: ribbon windows over the middle of a blank metal front): a cycle per
  // bay on each listed storey, the storey's row in the listed bays and plain wall in the rest.
  for (const ob of name === 'blank' ? [] : f.openBays ?? []) {
    const every = Math.max(1, f.bays ?? 1, ...ob.bays.map(b => b + 1));
    for (const st of ob.storeys) {
      if (st < 1) continue;
      const under = rowOverrides[String(st)] ?? typical;
      rowOverrides[String(st)] = { kind: 'wall', cycle: Array.from({ length: every }, (_, k) => (ob.bays.includes(k) ? under : ({ kind: 'wall' } as Row))) };
    }
  }
  let ground = name === 'curtain-wall' && f.layered && (f.ground === 'system' || f.ground === 'glazed') ? typical
    : groundRow({ ...f, ground: name === 'plinth-shopfronts' && f.ground === 'system' ? 'plinth-shopfronts' : f.ground }, archedStoreys.includes(0) ? archedRow(0) : typical);
  // openBays on the ground storey (storey 0, issue #59: Kloveniersburgwal 72's blank pier bay with its stone plaque runs
  // down to the street): the ground row in the listed bays, plain wall in the rest. Validation keeps it off grounds that
  // claim their own bays (hoist, gateways, hall doors, souterrain, garage doors); a ground plinth
  // still replaces its own listed bays afterwards.
  for (const ob of name === 'blank' ? [] : f.openBays ?? []) if (ob.storeys.includes(0)) {
    const every = Math.max(1, f.bays ?? 1, ...ob.bays.map(b => b + 1)), under = ground;
    ground = { kind: 'wall', cycle: Array.from({ length: every }, (_, k) => (ob.bays.includes(k) ? under : ({ kind: 'wall' } as Row))) };
  }
  // Loading-door axis: a cycle of rows per bay with the hoist row at `first` (cycle index = bay % every).
  if (f.hoist && name !== 'blank') {
    const list = f.hoist.bays, every = list ? Math.max(1, f.bays ?? 1, ...list.map(b => b + 1)) : Math.max(1, f.hoist.every ?? 1), at = ((f.hoist.first ?? 0) % every + every) % every, kind = f.hoist.arch;
    const isHoist = (k: number) => (list ? list.includes(k) : k === at);
    // layered kit: the loading door is two leaves (one meeting stile, no hatch rail) under a 4-segment head, so
    // Entrepotdok's 33-bay front keeps a hoist axis every third bay within the 12k budget
    const door: Row = { kind: 'punched', win: { w: 0.72, h: 0.86, sill: 0.1, mull: 1, ...(f.layered ? {} : { rowsAt: [0.36] }), frameW: f.frames === false ? 0 : 0.07, frame: s.frame, glass: s.glass, sillSlot: s.stone, sillH: 0.1, sillOut: 0.14, sillOnWall: true, ...(f.deepBars ? { barD: 0.035 } : {}), ...archFor(kind, f, { springBar: true, ...(f.layered ? { segments: 4 } : {}) }) } };
    const portal: Row = { kind: 'punched', win: { w: 0.8, h: 0.84, sill: 0.06, mull: 1, frameW: 0, frame: s.frame, glass: s.door, ...archFor(f.arches?.ground ?? kind, f) } };
    const cycle = (hoistRow: Row, other: Row): Row => ({ kind: 'wall', cycle: Array.from({ length: every }, (_, k) => (isHoist(k) ? hoistRow : other)) });
    typical = cycle(door, typical);
    if (f.ground !== 'blank') ground = cycle(portal, ground);
    for (const k of Object.keys(rowOverrides)) if (rowOverrides[k].kind === 'balcony') rowOverrides[k] = cycle(door, rowOverrides[k]);
  }
  // Carriage gateways (Amsterdams Lyceum): wide arched openings in the listed bays of the ground storey, plain wall between them.
  if (f.gateways && name !== 'blank') {
    const every = Math.max(1, f.bays ?? 1, ...f.gateways.bays.map(b => b + 1));
    const gate: Row = { kind: 'punched', win: { w: 0.92, h: 0.86, sill: 0.06, mull: 0, frameW: 0, frame: s.frame, glass: s.door, ...archFor(f.gateways.arch ?? 'round', f) } };
    // keepRow: the other bays take the ground row; a per-bay cycle (windowPattern) is indexed by bay, cycles do not nest
    const other = (k: number): Row => (!f.gateways!.keepRow ? { kind: 'wall' } : ground.cycle ? ground.cycle[k % ground.cycle.length] : ground);
    ground = { kind: 'wall', cycle: Array.from({ length: every }, (_, k) => (f.gateways!.bays.includes(k) ? gate : other(k))) };
  }
  // Glazed hall doors (De Hallen gables): white-framed glazed doors in the listed ground bays, the other bays keep the ground row.
  if (f.hallDoors && name !== 'blank') {
    const hd = f.hallDoors, every = Math.max(1, f.bays ?? 1, ...hd.bays.map(b => b + 1)), other = ground;
    const door: Row = { kind: 'punched', win: { w: HALL_DOOR.w, h: hd.h ?? HALL_DOOR.h, sill: hd.arch ? HALL_DOOR.archedSill : HALL_DOOR.sill, mull: (hd.lights ?? HALL_DOOR.lights) - 1, rows: hd.rows ?? HALL_DOOR.rows, frameW: f.frames === false ? 0 : 0.07, frame: s.frame, glass: s.glass, sillSlot: null, ...(f.deepBars ? { barD: 0.035 } : {}), ...archFor(hd.arch, f) } };
    // beside keepRow gateways the ground is already a per-bay cycle: index it by bay (cycles do not nest)
    const at = (k: number): Row => (f.gateways?.keepRow && other.cycle ? other.cycle[k % other.cycle.length] : other);
    ground = { kind: 'wall', cycle: Array.from({ length: every }, (_, k) => (hd.bays.includes(k) ? door : at(k))) };
  }
  // Tilted bay windows: a cycle per bay on the chosen storeys, the box frame replacing the sill.
  for (const tb of !f.tilted || name === 'blank' ? [] : Array.isArray(f.tilted) ? f.tilted : [f.tilted]) {
    const list = tb.bays, every = list ? Math.max(1, f.bays ?? 1, ...list.map(b => b + 1)) : Math.max(1, tb.every ?? 1), at = ((tb.first ?? 0) % every + every) % every;
    const storeys = tb.storeys ?? Array.from({ length: Math.max(0, f.lines.length - 2) }, (_, k) => k + 1);
    for (const st of storeys) {
      const under = rowOverrides[String(st)] ?? (st === 0 ? ground : typical);
      if (!under.win || under.cycle) continue; // blank or balcony storeys, loading-door cycles: no box frame
      const box: Row = { ...under, win: { ...under.win, sillSlot: null, tilt: { slot: s.stone, ...TILT_FRAME } } };
      rowOverrides[String(st)] = { kind: 'wall', cycle: Array.from({ length: every }, (_, k) => ((list ? list.includes(k) : k === at) ? box : under)) };
    }
  }
  // French windows: a continuous ledge at every storey line above the ground, its top 2 cm under the window sill.
  if (name === 'french-window-ledge') {
    const F = FRENCH_WINDOW, sill = (typical.cycle ? undefined : typical.win?.sill) ?? F.sillM;
    bands = [...(bands ?? []), { slot: s.stone, h: F.ledgeH, out: F.ledgeOut, skipGround: false, lift: sill - 0.02 - F.ledgeH / 2 }];
  }
  // Souterrain: a pair of small windows per bay in the low ground storey (arched with `arches.ground`), no sills.
  if (f.souterrain && name !== 'blank' && typical.win && !typical.cycle && f.lines.length > 1) {
    const S = SOUTERRAIN, gh = f.lines[1] - f.lines[0], lw = S.w * f.pitchM, gap = S.gap * f.pitchM, mid = f.pitchM / 2, v: [number, number] = [+(S.sill * gh).toFixed(3), +((S.sill + S.h) * gh).toFixed(3)];
    const { mull: _m, mullAt: _ma, rows: _r, rowsAt: _ra, transom: _t, arch: _a, ...plain } = typical.win;
    // the lights are too small for the group's arch band: plain heads
    const win: WinParams = { ...plain, sillSlot: null, ...(f.arches?.ground ? { arch: { kind: f.arches.ground } } : {}) };
    ground = { kind: 'items', items: [f.souterrain === 'single' ? [{ kind: 'win', u: [mid - lw / 2, mid + lw / 2], v, win }]
      : [{ kind: 'win', u: [mid - gap / 2 - lw, mid - gap / 2], v, win }, { kind: 'win', u: [mid + gap / 2, mid + gap / 2 + lw], v, win }]] };
  }
  // Stone courses at the typical window's sill and head on every upper storey (the windows' own sills give way to the course).
  if (f.courses?.length && typical.win && !typical.cycle) {
    const sill = typical.win.sill ?? 0.9, h = typical.win.h ?? 0.6, C = COURSE;
    if (f.courses.includes('sill')) { typical = { ...typical, win: { ...typical.win, sillSlot: null } }; bands = [...(bands ?? []), { slot: s.stone, h: C.h, out: C.out, minRun: C.minRun, lift: +(sill - C.h / 2).toFixed(3) }]; }
    if (f.courses.includes('head')) bands = [...(bands ?? []), { slot: s.stone, h: C.h, out: C.out, minRun: C.minRun, ...(h > 1 ? { lift: +(sill + h + C.h / 2).toFixed(3) } : { lift: +(sill + C.h / 2).toFixed(3), liftFrac: h }) }];
    for (const k of Object.keys(rowOverrides)) { const r = rowOverrides[k]; if (r.win && !r.cycle && f.courses.includes('sill')) rowOverrides[k] = { ...r, win: { ...r.win, sillSlot: null } }; }
  }
  if (f.paneSplit) {
    const split = (r: Row): Row => ({ ...r, ...(r.win ? { win: { ...r.win, paneSplit: true } } : {}), ...(r.cycle ? { cycle: r.cycle.map(split) } : {}),
      ...(r.items ? { items: r.items.map(fl => fl.map(it => (it.win ? { ...it, win: { ...it.win, paneSplit: true } } : it))) } : {}), ...(r.stack ? { stack: r.stack.map(x => ({ ...x, row: split(x.row) })) } : {}) });
    typical = split(typical); ground = split(ground);
    for (const k of Object.keys(rowOverrides)) rowOverrides[k] = split(rowOverrides[k]);
  }
  // Per-bay window widths (the wide drawing-room window + narrow slot pair of a panel front): the last step, so every
  // storey row (arched, glazed, openBays) keeps its own openings and only their width changes per bay. Rows that are
  // already a per-bay cycle (loading doors, screens, tilted bays, gateway grounds) or not punched are left alone:
  // compose resolves one cycle level, so a nested cycle would draw plain wall.
  if (f.windowPattern?.length && name !== 'blank') {
    const pat = f.windowPattern, widen = (r: Row, w: number): Row => (r.kind === 'punched' && r.win ? { ...r, win: { ...r.win, w } } : r);
    // An openBays storey (a per-bay cycle of the storey's row and plain wall) takes the widths into its own cycle,
    // lengthened to a common multiple of both, so the blind bays stay blind and the windowed ones keep the rhythm.
    const openCycle = (r: Row) => r.kind === 'wall' && !!r.cycle?.length && r.cycle.every(x => (x.kind === 'wall' && !x.cycle) || x.kind === 'punched');
    const lcm = (a: number, b: number): number => { let x = a, y = b; while (y) [x, y] = [y, x % y]; return (a / x) * b; };
    const wrap = (r: Row): Row => (r.kind === 'punched' && r.win ? { kind: 'wall', cycle: pat.map(w => widen(r, w)) }
      : f.openBays?.length && openCycle(r) ? { kind: 'wall', cycle: Array.from({ length: lcm(r.cycle!.length, pat.length) }, (_, k) => widen(r.cycle![k % r.cycle!.length], pat[k % pat.length])) } : r);
    typical = wrap(typical); ground = wrap(ground);
    for (const k of Object.keys(rowOverrides)) rowOverrides[k] = wrap(rowOverrides[k]);
  }
  // Grouped windows (pairs and triples per bay): after the per-bay widths, so each bay's opening is split into its windows.
  if (f.windowGroup && f.windowGroup.count > 1 && name !== 'blank') {
    const group = { count: f.windowGroup.count, gap: f.windowGroup.gapM };
    const grp = (r: Row): Row => r.cycle ? { ...r, cycle: r.cycle.map(grp) }
      : r.kind === 'punched' && r.win && !r.win.loggia ? { ...r, win: { ...r.win, group } }
      : r.kind === 'balcony' && r.balcony?.back && f.balconyOnWindows ? { ...r, balcony: { ...r.balcony, back: { ...r.balcony.back, group } } } : r;
    if (f.windowGroup.storeys) {
      for (const st of f.windowGroup.storeys) { if (st === 0) ground = grp(ground); else rowOverrides[String(st)] = grp(rowOverrides[String(st)] ?? typical); }
    } else {
      typical = grp(typical);
      for (const k of Object.keys(rowOverrides)) if (k !== '0') rowOverrides[k] = grp(rowOverrides[k]);
    }
  }
  // Glazed plinth and loggias: the last step, so no later pass (windowPattern, paneSplit) reshapes them. In listed bays only,
  // the other bays keep the storey's row (one bay of a per-bay cycle each).
  const storeyH = (st: number) => (st + 1 < f.lines.length ? f.lines[st + 1] - f.lines[st] : 0);
  const inBays = (under: Row, row: Row, bays?: number[]): Row => {
    if (!bays) return row;
    const every = Math.max(1, f.bays ?? 1, ...bays.map(b => b + 1), under.cycle?.length ?? 1);
    return { kind: 'wall', cycle: Array.from({ length: every }, (_, k) => (bays.includes(k) ? row : under.cycle ? under.cycle[k % under.cycle.length] : under)) };
  };
  const put = (st: number, row: (under: Row) => Row) => { if (st === 0) ground = row(ground); else rowOverrides[String(st)] = row(rowOverrides[String(st)] ?? typical); };
  if (f.plinth) for (const st of f.plinth.storeys) {
    const P = f.plinth, sh = storeyH(st);
    if (sh <= 0) continue;
    const lights = Math.max(1, P.lights);
    const win: WinParams = { w: +(1 - P.pier).toFixed(3), h: P.h, sill: +(P.sill * sh).toFixed(3), ...(lights > 1 ? { mullAt: Array.from({ length: lights - 1 }, (_, k) => +((k + 1) / lights).toFixed(4)) } : {}),
      ...(P.transom > 0 ? { rowsAt: [P.transom] } : {}), frame: s.frame, glass: s.glass, sillSlot: null, frameW: f.frames === false ? 0 : 0.06, ...(f.deepBars ? { barD: 0.035 } : {}) };
    put(st, under => inBays(under, { kind: 'punched', win }, P.bays));
  }
  if (f.loggias) for (const st of f.loggias.storeys) {
    const L = f.loggias, sh = storeyH(st);
    if (sh <= 0) continue;
    const rail = L.rail !== 'none' && st > 0 ? { rail: { kind: L.rail, h: LOGGIA.railM, slot: L.railSlot } } : {};
    const win: WinParams = { w: L.w, h: L.h, sill: +(L.sill * sh).toFixed(3), mull: Math.max(1, L.lights) - 1, frame: s.frame, glass: s.glass, sillSlot: null, frameW: f.frames === false ? 0 : 0.06,
      ...(f.deepBars ? { barD: 0.035 } : {}), loggia: { depth: +(L.deep * sh).toFixed(3), ...rail } };
    put(st, under => inBays(under, { kind: 'punched', win }, L.bays));
  }
  return { pitch: f.pitchM, lines: f.lines, ground, typical, bands, piers, ...(Object.keys(rowOverrides).length ? { rowOverrides } : {}) };
}
