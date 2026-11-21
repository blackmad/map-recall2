/**
 * Design units round 2 (#399, David 2026-11-20: "neutral-to-worse - you're over aggressively collapsing buildings"): an
 * ordekaart project of 2-6 plots is still separate houses. Each plot's street front draws its own crown cornice, ending at
 * the plot line on a cornice end block, over a brick pier on the party-wall line, so the row reads as houses of one family
 * (one eaves line, one brick, one window) and never one slab.
 *
 * Geometry only (metres in the wall frame: `a` along the wall from its start, `o` out from the face, `z` up); the extras
 * pass (facadeExtras.ts dressWall) draws the boxes. `start`/`end`: a party-wall break at that end of this wall (false
 * inside a run, or where the neighbour is the same facade by photo evidence).
 */
export interface PlotBox { a0: number; a1: number; o0: number; o1: number; z0: number; z1: number; tone: 'pier' | 'cornice' | 'lid' | 'end'; bottom?: boolean }

/** Half a party-wall pier (m): two neighbours' halves make one pier. */
export const PIER_HALF_M = 0.16;
const PIER_OUT_M = 0.08, END_W_M = 0.22, END_OUT_M = 0.42, END_DROP_M = 0.6;

export function plotBreakBoxes(lenM: number, base: number, top: number, start: boolean, end: boolean): PlotBox[] {
  if (!(lenM > 1.2) || !(top - base > 2)) return [];
  const out: PlotBox[] = [];
  const c0 = start ? PIER_HALF_M : 0, c1 = end ? lenM - PIER_HALF_M : lenM;
  // The plot's crown: a corona and a drip lid, stopping short of the pier where the plot ends. Kept within 0.32 m of the
  // top so it never covers the top storey's window heads.
  out.push({ a0: c0, a1: c1, o0: 0, o1: 0.24, z0: top - 0.32, z1: top - 0.1, tone: 'cornice', bottom: true });
  out.push({ a0: c0, a1: c1, o0: 0, o1: 0.36, z0: top - 0.1, z1: top, tone: 'lid', bottom: true });
  for (const [on, a0, a1] of [[start, 0, PIER_HALF_M], [end, lenM - PIER_HALF_M, lenM]] as const) {
    if (!on) continue;
    // The pier: brick on the party-wall line from the plinth to the cornice, a shade off the wall.
    out.push({ a0, a1, o0: 0, o1: PIER_OUT_M, z0: base, z1: top - 0.1, tone: 'pier' });
  }
  // The cornice's end blocks: a deep console at each broken end, standing proud of the cornice (where it ends).
  if (start) out.push({ a0: PIER_HALF_M, a1: PIER_HALF_M + END_W_M, o0: 0, o1: END_OUT_M, z0: top - END_DROP_M, z1: top, tone: 'end', bottom: true });
  if (end) out.push({ a0: lenM - PIER_HALF_M - END_W_M, a1: lenM - PIER_HALF_M, o0: 0, o1: END_OUT_M, z0: top - END_DROP_M, z1: top, tone: 'end', bottom: true });
  return out;
}
