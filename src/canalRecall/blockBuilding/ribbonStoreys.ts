/**
 * Ribbon storeys (kit gap "ribbon under punched", city-coverage C3, 2026-11-10): a storey whose openings are one
 * continuous band of glazing across the front, over or under storeys of punched windows. Triage (landmarks/triage.ts)
 * held 28 ride-visible pands on it: the photo's rows (rowOpenings.ts) show an opening >= 8 m on one storey, and the kit
 * drew that storey as the group's punched row. `glazedStoreys` draws a shop-ground row (90 % of each bay, a fixed sill
 * and transom), which is a row of shop windows, not a ribbon; `plinth` is a glazed opening per bay between piers.
 *
 * Here, per storey, everything is measured from the photo: the band's sill and height as fractions of the storey, its
 * lights per bay (the ribbon's own mullion pitch), horizontal bars at fractions of the band (transoms), an opaque spandrel
 * panel in the band's lowest part (the enamelled borstwering of a 1950s-70s office ribbon), an opaque head panel at its top
 * (the coloured fascia lights of a shopfront strip) and the band's frame colour.
 * Neighbouring bays' openings stand `RIBBON_STOREY.postM` apart so their frames touch and read as one post: the band is
 * continuous along the panel. The group's pane-split glazing (`glazing: "panes"`) carries over: a long ribbon of many lights
 * is cheaper as panes over a frame sheet than as rings and bar boxes. Pure: compose rows only, no I/O.
 */
import type { Row, WinParams } from './spec.ts';

export const RIBBON_STOREY = {
  /** wall left between neighbouring bays' openings (m): with the 0.06 m frames either side it reads as one 0.16 m post */
  postM: 0.04,
  frameW: 0.06,
};

export interface RibbonStoreyFit {
  storeys: number[];
  /** only these bays (of `SystemFit.bays`, cycling) carry the band; the others keep the storey's row */
  bays?: number[];
  /** band from `sill` to `sill + h` of the storey (fractions) */
  sill: number; h: number;
  /** lights per bay */
  lights: number;
  /** horizontal glazing bars at these fractions of the glazed height (above any spandrel) */
  rows?: number[];
  /** opaque panel filling the band's lowest `h` (fraction of the band) in `slot` */
  spandrel?: { h: number; slot: string };
  /** opaque panel filling the band's top `h` (fraction of the band) in `slot`: a shopfront's fascia lights */
  head?: { h: number; slot: string };
  /** the band's frame slot */
  frame: string;
}

const mulls = (n: number) => (n > 1 ? { mullAt: Array.from({ length: n - 1 }, (_, k) => +((k + 1) / n).toFixed(4)) } : {});

/**
 * The compose row of one ribbon storey `sh` m tall: a `ribbon` row (one opening per bay, `postM` apart), or with opaque
 * panels a `stack` over the whole storey cell: the spandrel's ribbon under the glass, the head panel's over it, each its
 * own framed opening so the frames meet as the band's transoms.
 */
export function ribbonStoreyRow(r: RibbonStoreyFit, sh: number, o: { glass: string; frames?: boolean; deepBars?: boolean; paneSplit?: boolean }): Row {
  const frameW = o.frames === false ? 0 : RIBBON_STOREY.frameW, bars = { ...(o.deepBars ? { barD: 0.035 } : {}), ...(o.paneSplit ? { paneSplit: true } : {}) };
  const panelH = r.spandrel ? r.h * r.spandrel.h : 0, headH = r.head ? r.h * r.head.h : 0, glassSill = r.sill + panelH, glassH = r.h - panelH - headH;
  const glass: WinParams = { h: +glassH.toFixed(4), sill: +(glassSill * sh).toFixed(3), ...mulls(r.lights), ...(r.rows?.length ? { rowsAt: [...r.rows] } : {}),
    frame: r.frame, glass: o.glass, sillSlot: null, frameW, ...bars };
  const glassRow: Row = { kind: 'ribbon', pier: RIBBON_STOREY.postM, win: glass };
  if (!r.spandrel && !r.head) return glassRow;
  const panel = (h: number, sill: number, slot: string): Row => ({ kind: 'ribbon', pier: RIBBON_STOREY.postM,
    win: { h: +h.toFixed(4), sill: +(sill * sh).toFixed(3), ...mulls(r.lights), frame: r.frame, glass: slot, sillSlot: null, frameW, ...bars } });
  const stack: NonNullable<Row['stack']> = [];
  if (r.spandrel) stack.push({ v0: 0, v1: sh, row: panel(panelH, r.sill, r.spandrel.slot) });
  stack.push({ v0: 0, v1: sh, row: glassRow });
  if (r.head) stack.push({ v0: 0, v1: sh, row: panel(headH, glassSill + glassH, r.head.slot) });
  return { kind: 'stack', stack };
}
