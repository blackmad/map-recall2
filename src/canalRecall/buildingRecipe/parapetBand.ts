/**
 * Dark parapet band (Transvaalbuurt 1925-1930 rows, Albert Luthulistraat 29-31; issue #149): the top courses of a tall
 * plain parapet laid in a second, near-black (glazed) brick under the thin coping, often with a crenellated foot: short
 * blocks of the same dark brick hanging below the band at a fixed pitch. Where the front carries a stair tower over
 * some bays (`tower.bays`), the band stops at the tower's flanks and is laid again under the tower's own top.
 *
 * `FrontIntent.parapet.band`: `{courses, dentils?: {pitch, courses}}` — `courses` brick courses (0.055 m each) of band
 * brick under the coping; `dentils` = blocks `courses` courses tall, half a `pitch` wide, every `pitch` metres along the
 * band's foot (the first one half a pitch in from each end of a run). Drawn in the palette's band brick
 * (`surface: accent`, needs `palette.band`) as facings 4.5 cm proud, like `brickStripes`. Absent = byte-identical.
 */
import type {CanalhouseFacadeBlock} from '../canalhouseRecipes.ts';
import {BRICK_STRIPE_DEPTH_M} from './brickStripes.ts';

export interface ParapetBandIntent {
  /** Brick courses of band brick under the coping (2..30). */
  courses: number;
  /** Blocks hanging below the band: one `courses` courses tall and pitch/2 wide every `pitch` metres (0.3..3). */
  dentils?: {pitch: number; courses: number};
}

/** `towerInsetM`: the band under the tower top stays this far inside the tower's flanks, so millimetre rounding never
 * carries it past the tower's wall onto the lower parapet (the library's wall-support check). */
export const PARAPET_BAND = {courseM: 0.055, depthM: BRICK_STRIPE_DEPTH_M, towerInsetM: 0.005} as const;
const num = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** Problems with `parapet.band` (`parapetCourses`: the parapet's own course count; `band`: the band brick colour). */
export function parapetBandProblems(b: unknown, parapetCourses: number, band: string | undefined, at: string): string[] {
  const a = `${at}.parapet.band`;
  if (!b || typeof b !== 'object' || Array.isArray(b) || Object.keys(b).some(k => !['courses', 'dentils'].includes(k))) return [`${a}: {courses, dentils?: {pitch, courses}}`];
  const o = b as Record<string, unknown>, p: string[] = [];
  if (!(Number.isInteger(o.courses) && (o.courses as number) >= 2 && (o.courses as number) <= 30)) p.push(`${a}.courses: 2..30 brick courses`);
  else if ((o.courses as number) > parapetCourses) p.push(`${a}.courses: at most the parapet's ${parapetCourses} courses`);
  if (o.dentils !== undefined) {
    const d = o.dentils as Record<string, unknown>;
    if (!d || typeof d !== 'object' || Object.keys(d).some(k => !['pitch', 'courses'].includes(k)) || !num(d.pitch, 0.3, 3) || !(Number.isInteger(d.courses) && (d.courses as number) >= 1 && (d.courses as number) <= 10))
      p.push(`${a}.dentils: {pitch: 0.3..3 m, courses: 1..10}`);
    else if (Number.isInteger(o.courses) && (o.courses as number) + (d.courses as number) > parapetCourses) p.push(`${a}.dentils: band and dentils pass the parapet's ${parapetCourses} courses`);
  }
  if (!band) p.push(`${a}: needs palette.band (the dark band brick)`);
  return p;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/**
 * The band (and its dentils) on one run [x0, x1] of the module, viewer-left metres, its top at `top` (the wall top under
 * the coping). Ids carry `tag`.
 */
function runBlocks(b: ParapetBandIntent, x0: number, x1: number, top: number, tag: string): {leftM: number; widthM: number; bottomM: number; heightM: number; id: string}[] {
  const w = Math.floor((x1 - x0) * 1000) / 1000;
  if (w < 0.1) return [];
  const h = b.courses * PARAPET_BAND.courseM, foot = top - h, out = [{id: `parapet-band-${tag}`, leftM: r3(x0), widthM: w, bottomM: r3(foot), heightM: r3(h)}];
  if (b.dentils) {
    const {pitch, courses} = b.dentils, dw = pitch / 2, dh = courses * PARAPET_BAND.courseM, n = Math.max(1, Math.round(w / pitch));
    const step = w / n;
    for (let k = 0; k < n; k++) {
      const c = x0 + (k + 0.5) * step;
      out.push({id: `parapet-dentil-${tag}-${k}`, leftM: r3(c - dw / 2), widthM: r3(dw), bottomM: r3(foot - dh), heightM: r3(dh + 0.002)});
    }
  }
  return out;
}

/**
 * The band blocks for a front of `count` modules `mw` wide: under the coping at `eaves` (minus `copingM`) on each module
 * except over its tower span, and under the tower top on the span. `place(k, x, w)` maps module-left metres to front
 * metres (mirrorAlternate), `flipX` to facade metres.
 */
export function parapetBandBlocks(b: ParapetBandIntent, o: {count: number; mw: number; eaves: number; copingM: number; tower: {span: [number, number]; top: number} | null;
  place: (k: number, x: number, w?: number) => number; flipX: (x: number, w: number) => number}): CanalhouseFacadeBlock[] {
  const out: CanalhouseFacadeBlock[] = [];
  for (let k = 0; k < o.count; k++) {
    const runs: {x0: number; x1: number; top: number; tag: string}[] = o.tower
      ? [{x0: 0, x1: o.tower.span[0], top: o.eaves - o.copingM, tag: `m${k}-l`}, {x0: o.tower.span[0] + PARAPET_BAND.towerInsetM, x1: o.tower.span[1] - PARAPET_BAND.towerInsetM, top: o.tower.top - o.copingM, tag: `m${k}-t`}, {x0: o.tower.span[1], x1: o.mw, top: o.eaves - o.copingM, tag: `m${k}-r`}]
      : [{x0: 0, x1: o.mw, top: o.eaves - o.copingM, tag: `m${k}`}];
    for (const run of runs) for (const blk of runBlocks(b, run.x0, run.x1, run.top, run.tag)) {
      const left = o.place(k, blk.leftM, blk.widthM);
      out.push({id: blk.id, leftM: r3(o.flipX(left, blk.widthM)), bottomM: blk.bottomM, widthM: blk.widthM, heightM: blk.heightM, depthM: PARAPET_BAND.depthM, surface: 'accent'});
    }
  }
  return out;
}
