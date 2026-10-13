/**
 * Named facade systems for `kind: large` building recipes: each name expands to a block-kit `System`
 * (compose.ts rows, bands, piers) from a handful of fitted numbers (bay pitch, storey lines). The large tier
 * compiles with `ComposeOptions.recessM`, so every window here is cut into the 3DBAG wall with reveals.
 *
 * Slot names are block-kit slots; `largeCompile.ts` maps them to recipe material slots (brick/stucco, stone,
 * frame, door, glass, accent, roofTile/slate/bitumen) with the palette colour as tint.
 */
import type { Row, System, WinParams } from './spec.ts';

export const LARGE_SYSTEMS = ['brick-bay-grid', 'ribbon-windows', 'curtain-wall', 'plinth-shopfronts', 'blank'] as const;
export type LargeSystemName = typeof LARGE_SYSTEMS[number];
export const LARGE_GROUNDS = ['system', 'plinth-shopfronts', 'glazed', 'blank'] as const;
export type LargeGround = typeof LARGE_GROUNDS[number];
export const LARGE_WINDOWS = ['plain', 'two-light', 'cross', 'transom'] as const;
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
  /** storeys (0 = ground) drawn as plain wall */
  blankStoreys?: number[];
  balconyRail?: 'glass' | 'bars' | 'solid';
  /** slot names for this wall group (per-group palette overrides get their own slots) */
  slots: { frame: string; stone: string; glass: string; door: string; curtain: string };
}

const glazing = (w: LargeWindow | undefined): Partial<WinParams> => {
  switch (w) {
    case 'two-light': return { mull: 1 };
    case 'cross': return { mull: 1, transom: 0.7 };
    case 'transom': return { transom: 0.78 };
    default: return {};
  }
};

function groundRow(f: SystemFit, upper: Row): Row {
  const s = f.slots;
  switch (f.ground) {
    case 'blank': return { kind: 'wall' };
    case 'glazed': return { kind: 'glazed', win: { w: 0.9, h: 0.86, sill: 0.1, mull: 1, transom: 0.82, frame: s.frame, glass: s.glass } };
    // Shop windows down to a low stall riser, a transom light under the fascia (the fascia band is a component).
    case 'plinth-shopfronts': return { kind: 'glazed', win: { w: 0.86, h: 0.74, sill: 0.35, mull: 1, transom: 0.8, frame: s.frame, glass: s.glass } };
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
      typical = { kind: 'punched', win: { w: f.pitchM < 2 ? 0.66 : 0.48, h: 0.6, sill: 0.85, frame: s.frame, glass: s.glass, sillSlot: s.stone, sillH: 0.08, sillOut: 0.1, frameW: 0.07, ...g } };
      break;
    case 'ribbon-windows':
      // One opening per bay per storey with a slim pier between bays: reads as a continuous band of glazing.
      typical = { kind: 'ribbon', pier: 0.18, win: { h: 0.56, sill: 0.9, mull: 1, frame: s.frame, glass: s.glass, frameW: 0.06, ...g } };
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
  const rowOverrides: Record<string, Row> = {};
  if (f.balconyStoreys?.length && name !== 'blank') {
    const balcony: Row = { kind: 'balcony', balcony: { depth: 1.2, slab: { h: 0.18, slot: s.stone }, rail: { kind: f.balconyRail ?? 'bars', h: 1.0, slot: s.frame, top: s.frame }, back: { w: 0.7, h: 0.72, sill: 0.25, frame: s.frame, glass: s.glass, mull: 1 } } };
    for (const st of f.balconyStoreys) rowOverrides[String(st)] = balcony;
  }
  // Storeys without openings (a blank storage floor over a shop, a plant floor): plain wall rows.
  for (const st of f.blankStoreys ?? []) rowOverrides[String(st)] = { kind: 'wall' };
  const ground = groundRow({ ...f, ground: name === 'plinth-shopfronts' && f.ground === 'system' ? 'plinth-shopfronts' : f.ground }, typical);
  return { pitch: f.pitchM, lines: f.lines, ground, typical, bands, piers, ...(Object.keys(rowOverrides).length ? { rowOverrides } : {}) };
}
