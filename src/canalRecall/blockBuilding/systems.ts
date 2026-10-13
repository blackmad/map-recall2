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

export const LARGE_SYSTEMS = ['brick-bay-grid', 'ribbon-windows', 'curtain-wall', 'plinth-shopfronts', 'blank'] as const;
export type LargeSystemName = typeof LARGE_SYSTEMS[number];
export const LARGE_GROUNDS = ['system', 'plinth-shopfronts', 'glazed', 'blank', 'portals'] as const;
export type LargeGround = typeof LARGE_GROUNDS[number];
export const LARGE_WINDOWS = ['plain', 'two-light', 'cross', 'transom', 'low', 'narrow'] as const;
export type LargeWindow = typeof LARGE_WINDOWS[number];

/** Default bay pitch (m) per system when the intent gives no bay count. */
export const DEFAULT_PITCH_M: Record<LargeSystemName, number> = {
  'brick-bay-grid': 3.2, 'ribbon-windows': 2.7, 'curtain-wall': 1.8, 'plinth-shopfronts': 4.5, blank: 6,
};

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
  /** balconies only in these bays of `bays` (a balcony over the entrance); every bay when absent */
  balconyBays?: number[];
  /** storeys (0 = ground) drawn as plain wall */
  blankStoreys?: number[];
  balconyRail?: 'glass' | 'bars' | 'solid';
  /** slot names for this wall group (per-group palette overrides get their own slots) */
  slots: { frame: string; stone: string; glass: string; door: string; curtain: string; wall?: string; /** flush brick arch bands (a shade darker than the wall) */ arch?: string };
  /** arched heads (upper windows / ground openings) and the band around them */
  arches?: { windows?: ArchKind; ground?: ArchKind; band?: 'brick' | 'stone' | 'voussoir' | 'none'; /** only these storeys (0 = ground) get arched heads; the rest are square-headed */ storeys?: number[] };
  /** loading-door axis: every `every`-th bay from `first`, or the listed bays (of `bays` per storey) */
  hoist?: { every?: number; first?: number; bays?: number[]; arch?: ArchKind };
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
}

/** Glass-block perforation in a screen cell: a small square opening with a cross of 3.5 cm closed bars, no frame ring or sill. */
const glassBlock = (f: SystemFit): WinParams => ({ w: 0.62, h: 0.34, sill: 0.95, mull: 1, rows: 1, frameW: 0, sillSlot: null, barD: 0.035, frame: f.slots.stone, glass: f.slots.glass });

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
    default: return {};
  }
};

function groundRow(f: SystemFit, upper: Row): Row {
  const s = f.slots;
  switch (f.ground) {
    case 'blank': return { kind: 'wall' };
    // Tall arched (or square-headed) doors in every bay: warehouse ground floors.
    case 'portals': return { kind: 'punched', win: { w: 0.5, h: 0.78, sill: 0.06, mull: 1, frameW: 0, frame: s.frame, glass: s.door, ...archFor(f.arches?.ground ?? 'round', f) } };
    case 'glazed': return { kind: 'glazed', win: { w: 0.9, h: 0.86, sill: 0.1, mull: 1, transom: 0.82, ...(f.deepBars ? { barD: 0.035 } : {}), frame: s.frame, glass: s.glass } };
    // Shop windows down to a low stall riser, a transom light under the fascia (the fascia band is a component).
    case 'plinth-shopfronts': return { kind: 'glazed', win: { w: 0.86, h: 0.74, sill: 0.35, mull: 1, transom: 0.8, ...(f.deepBars ? { barD: 0.035 } : {}), frame: s.frame, glass: s.glass } };
    default: return upper;
  }
}

/** Expand a system name into a compose `System`. */
export function largeSystem(name: LargeSystemName, f: SystemFit): System {
  const s = f.slots, g = glazing(f.windows);
  const bands = f.stringCourses ? [{ slot: s.stone, h: 0.16, out: 0.05, skipGround: false }] : undefined;
  const piers = f.piers ? { w: 0.36, out: 0.1, slot: s.stone, segments: 3 } : null;
  let typical: Row;
  switch (name) {
    case 'brick-bay-grid':
      // Narrow bays (canal-house rhythm, < 2 m) take proportionally wider windows than civic 3 m bays.
      typical = { kind: 'punched', win: { w: f.pitchM < 2 ? 0.66 : 0.48, h: 0.6, sill: 0.85, frame: s.frame, glass: s.glass, sillSlot: f.sills === false ? null : s.stone, sillH: 0.08, sillOut: 0.1, frameW: f.frames === false ? 0 : 0.07, ...(f.deepBars ? {barD: 0.035} : {}), ...g, ...archFor(f.arches?.storeys ? undefined : f.arches?.windows, f) } };
      break;
    case 'ribbon-windows':
      // One opening per bay per storey with a slim pier between bays: reads as a continuous band of glazing.
      typical = { kind: 'ribbon', pier: 0.18, win: { h: 0.56, sill: 0.9, mull: 1, frame: s.frame, glass: s.glass, frameW: 0.06, ...(f.deepBars ? {barD: 0.035} : {}), ...g } };
      break;
    case 'curtain-wall':
      // Nearly full cells: the wall left between openings is the mullion/transom grid (the group's curtain slot).
      typical = { kind: 'punched', win: { w: 0.9, h: 0.88, sill: 0.12, frame: s.frame, glass: s.glass, frameW: 0.04, ...g } };
      break;
    case 'plinth-shopfronts':
      typical = { kind: 'punched', win: { w: 0.5, h: 0.6, sill: 0.85, frame: s.frame, glass: s.glass, sillSlot: s.stone, ...g } };
      break;
    case 'blank':
      typical = { kind: 'wall' };
      break;
  }
  // Perforated screen: glass blocks in one bay of three, the pattern shifted by two bays per storey (scattered, as built).
  if (f.screen && name !== 'blank') typical = { kind: 'wall', cycle: [{ kind: 'punched', win: glassBlock(f) }, { kind: 'wall' }, { kind: 'wall' }], shift: 2 };
  const rowOverrides: Record<string, Row> = {};
  // Arched heads on chosen storeys only (a round-headed piano nobile between a square ground and attic).
  const archedStoreys = name === 'brick-bay-grid' && f.arches?.windows && f.arches.storeys ? f.arches.storeys : [];
  const archedRow = (): Row => ({ ...typical, win: { ...typical.win!, ...archFor(f.arches!.windows, f) } });
  for (const st of archedStoreys) if (st > 0) rowOverrides[String(st)] = archedRow();
  if (f.balconyStoreys?.length && name !== 'blank') {
    const balcony: Row = { kind: 'balcony', balcony: { depth: 1.2, slab: { h: 0.18, slot: s.stone }, rail: { kind: f.balconyRail ?? 'bars', h: 1.0, slot: s.frame, top: s.frame }, back: { w: 0.7, h: 0.72, sill: 0.25, frame: s.frame, glass: s.glass, mull: 1 } } };
    for (const st of f.balconyStoreys) {
      const under = rowOverrides[String(st)] ?? typical;
      // balconies in the listed bays only: a cycle of bays with the balcony at those indices, the storey's own row elsewhere
      if (f.balconyBays?.length) {
        const every = Math.max(1, f.bays ?? 1, ...f.balconyBays.map(b => b + 1));
        rowOverrides[String(st)] = { kind: 'wall', cycle: Array.from({ length: every }, (_, k) => (f.balconyBays!.includes(k) ? balcony : under)) };
      } else rowOverrides[String(st)] = balcony;
    }
  }
  // Storeys without openings (a blank storage floor over a shop, a plant floor): plain wall rows.
  for (const st of f.blankStoreys ?? []) rowOverrides[String(st)] = { kind: 'wall' };
  let ground = groundRow({ ...f, ground: name === 'plinth-shopfronts' && f.ground === 'system' ? 'plinth-shopfronts' : f.ground }, archedStoreys.includes(0) ? archedRow() : typical);
  // Loading-door axis: a cycle of rows per bay with the hoist row at `first` (cycle index = bay % every).
  if (f.hoist && name !== 'blank') {
    const list = f.hoist.bays, every = list ? Math.max(1, f.bays ?? 1, ...list.map(b => b + 1)) : Math.max(1, f.hoist.every ?? 1), at = ((f.hoist.first ?? 0) % every + every) % every, kind = f.hoist.arch;
    const isHoist = (k: number) => (list ? list.includes(k) : k === at);
    const door: Row = { kind: 'punched', win: { w: 0.72, h: 0.86, sill: 0.1, mull: 1, rowsAt: [0.36], frameW: f.frames === false ? 0 : 0.07, frame: s.frame, glass: s.glass, sillSlot: s.stone, sillH: 0.1, sillOut: 0.14, sillOnWall: true, ...(f.deepBars ? { barD: 0.035 } : {}), ...archFor(kind, f, { springBar: true }) } };
    const portal: Row = { kind: 'punched', win: { w: 0.8, h: 0.84, sill: 0.06, mull: 1, frameW: 0, frame: s.frame, glass: s.door, ...archFor(f.arches?.ground ?? kind, f) } };
    const cycle = (hoistRow: Row, other: Row): Row => ({ kind: 'wall', cycle: Array.from({ length: every }, (_, k) => (isHoist(k) ? hoistRow : other)) });
    typical = cycle(door, typical);
    if (f.ground !== 'blank') ground = cycle(portal, ground);
    for (const k of Object.keys(rowOverrides)) if (rowOverrides[k].kind === 'balcony') rowOverrides[k] = cycle(door, rowOverrides[k]);
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
  return { pitch: f.pitchM, lines: f.lines, ground, typical, bands, piers, ...(Object.keys(rowOverrides).length ? { rowOverrides } : {}) };
}
