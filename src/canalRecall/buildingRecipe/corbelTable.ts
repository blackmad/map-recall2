/**
 * Corbel table (`corbelTable`, Duivelseiland 1899-1900 rows, Cornelis Anthoniszstraat 50-72 and Balthasar Floriszstraat
 * 4-26; issue #160): the brick frieze under the white cornice of the late-19th-c. speculative rows of Oud-Zuid, a
 * projecting course with rows of corbelled header blocks hanging from it, the rows staggered by half a pitch so the
 * frieze reads as a diamond lattice of dark joints. Drawn as band-brick facings (`palette.band`, surface `accent`) 4.5 cm
 * proud of the wall, like the parapet band and the brick stripes:
 *   - a `course` of `courses` brick courses (0.055 m each) across the front, its top on the cornice foot (an
 *     entablature: on its cap's foot, the brick frieze under the cap);
 *   - `rows` rows of blocks under it, each block `blockCourses` courses tall and half a `pitch` wide, every `pitch`
 *     metres along the front; row k is shifted by half a pitch when k is odd.
 * Absent = byte-identical (no block is emitted).
 *
 * Measured on the 2024-12-11 strips at 40 px/m, 1 m grid: Cornelis Anthoniszstraat 62-68, the frieze 12.05-12.9 m under
 * the cornice (12.9-13.45 m), a light projecting course at its top and two staggered rows of dark-jointed blocks at
 * about 0.3 m pitch; Balthasar Floriszstraat 20-24, the frieze 12.15-12.75 m.
 */
import type {CanalhouseFacadeBlock} from '../canalhouseRecipes.ts';
import type {FrontIntent} from './intent.ts';
import {BRICK_STRIPE_DEPTH_M} from './brickStripes.ts';

export const CORBEL_TABLE = {courseM: 0.055, depthM: BRICK_STRIPE_DEPTH_M, minPitchM: 0.15, maxPitchM: 0.8, maxRows: 4, maxCourses: 6} as const;

export interface CorbelTableIntent { courses: number; rows: number; pitch: number; blockCourses: number }

const r3 = (v: number) => Math.round(v * 1000) / 1000;

export function corbelTableProblems(f: FrontIntent, at: string, band: string | undefined): string[] {
  const v = f.corbelTable as unknown as Record<string, unknown> | undefined, p: string[] = [];
  const keys = ['courses', 'rows', 'pitch', 'blockCourses'];
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).some(k => !keys.includes(k))) return [`${at}.corbelTable: {courses, rows, pitch, blockCourses}`];
  const int = (k: string, lo: number, hi: number) => { if (!(Number.isInteger(v[k]) && (v[k] as number) >= lo && (v[k] as number) <= hi)) p.push(`${at}.corbelTable.${k}: an integer ${lo}..${hi}`); };
  int('courses', 1, CORBEL_TABLE.maxCourses);
  int('rows', 1, CORBEL_TABLE.maxRows);
  int('blockCourses', 1, CORBEL_TABLE.maxCourses);
  if (!(typeof v.pitch === 'number' && v.pitch >= CORBEL_TABLE.minPitchM && v.pitch <= CORBEL_TABLE.maxPitchM)) p.push(`${at}.corbelTable.pitch: ${CORBEL_TABLE.minPitchM}..${CORBEL_TABLE.maxPitchM} m`);
  if (f.cornice === undefined || f.cornice === 'none') p.push(`${at}.corbelTable: needs a cornice (it hangs from the cornice foot)`);
  if (f.parapet) p.push(`${at}.corbelTable: a parapet front has no cornice foot`);
  if (!band) p.push(`${at}.corbelTable: needs palette.band (the frieze brick)`);
  return p;
}

/** Height of the whole table (course + block rows), metres. */
export function corbelTableHeight(c: CorbelTableIntent): number {
  return r3((c.courses + c.rows * c.blockCourses) * CORBEL_TABLE.courseM);
}

/**
 * The table's blocks across a front `width` metres wide whose cornice foot (or entablature cap foot) is at `top`.
 * Viewer-left metres; the lattice is laid from the front's left end (a mirrored front reads the same).
 */
export function corbelTableBlocks(c: CorbelTableIntent, width: number, top: number): CanalhouseFacadeBlock[] {
  const w = Math.floor(width * 1000) / 1000;
  if (w < 0.3) return [];
  const courseH = c.courses * CORBEL_TABLE.courseM, foot = top - courseH;
  const out: CanalhouseFacadeBlock[] = [{id: 'corbel-course', leftM: 0, bottomM: r3(foot), widthM: w, heightM: r3(courseH), depthM: CORBEL_TABLE.depthM, surface: 'accent'}];
  const n = Math.max(1, Math.round(w / c.pitch)), step = w / n, bw = step / 2, bh = c.blockCourses * CORBEL_TABLE.courseM;
  for (let row = 0; row < c.rows; row++) {
    const y0 = foot - (row + 1) * bh, shift = row % 2 ? step / 2 : 0;
    for (let k = 0; k < n; k++) {
      const x = k * step + step / 4 + shift;
      // A shifted row's last block would cross the right end: keep the part on the front.
      // Rounded left, width floored to the millimetre: the block never passes the front's right end.
      const x0 = r3(Math.max(0, x)), x1 = Math.min(w, x + bw), bwM = Math.floor((x1 - x0) * 1000) / 1000;
      if (bwM < 0.03) continue;
      out.push({id: `corbel-r${row}-${k}`, leftM: x0, bottomM: r3(y0), widthM: bwM, heightM: r3(bh + 0.002), depthM: CORBEL_TABLE.depthM, surface: 'accent'});
    }
  }
  return out;
}
