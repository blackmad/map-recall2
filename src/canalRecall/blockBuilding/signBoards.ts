/**
 * Shop-hall fronts (issue #83): flat sign boards on a sheet front, and a false front that rises flat to the wall's
 * highest point and hides the roof profile behind it.
 *
 * Haarlemmerweg 337 / Vredenhofweg 1 (1954 shop hall, 2019/2021 panoramas w01-269, w03-359): the Haarlemmerweg front
 * carries a dark sign band of three boards about 1.6 m tall across its full width between the shopfront and the first
 * storey's windows; the Vredenhofweg side carries three dark boards up to the top of a ~7 m sheet front that stands in
 * front of a sawtooth roof (3DBAG: eaves 4.4 m, teeth to 7.5 m). Neither the fascia (0.5 m, at the ground storey's top)
 * nor the name band (lettering under a cornice) can draw a plain dark board, and the kit had no way to close the
 * sawtooth's gable ends into one flat front.
 *
 * Intent contract (no metric fields): a board's `along` is [from, to] as fractions of the main panel's width from the
 * viewer's left, its `up` [from, to] fractions of the panel's top height above the ground. A board stands
 * `SIGN_BOARD.out` proud of the wall (clear of cladding lines at 3.5-4 cm and of a false front's face). The false
 * front is a closed slab from the panel's eaves to its top, `FALSE_FRONT.back` inside the wall plane to `FALSE_FRONT.out`
 * in front of it, so the gable triangles behind it are hidden and nothing is coplanar. Absent: byte-identical output.
 */
import {solid, type PanelCtx} from './compose.ts';

export interface SignBoardIntent {
  /** [from, to] fractions of the main panel's width, from the viewer's left */
  along: [number, number];
  /** [from, to] fractions of the panel's top height above the ground */
  up: [number, number];
  /** board colour (#rrggbb or swatch; default the group's door colour) */
  colour?: string;
}

export interface SignBoardFit { along: [number, number]; up: [number, number]; slot: string }

export const SIGN_BOARD = {out: 0.12, minM: 0.3} as const;
export const FALSE_FRONT = {back: -0.12, out: 0.06, minRise: 0.3} as const;

const frac = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && v.every(x => typeof x === 'number' && x >= 0 && x <= 1) && v[1] - v[0] >= 0.02;

export function signBoardsProblems(input: unknown, at: string): string[] {
  if (!Array.isArray(input) || !input.length || input.length > 12) return [`${at}: list of 1..12 {along, up, colour}`];
  const out: string[] = [];
  input.forEach((b, i) => {
    const w = `${at}[${i}]`;
    if (!b || typeof b !== 'object' || Array.isArray(b)) { out.push(`${w}: object {along, up, colour}`); return; }
    for (const k of Object.keys(b)) if (!['along', 'up', 'colour'].includes(k)) out.push(`${w}.${k}: unknown field (along, up, colour)`);
    const r = b as Record<string, unknown>;
    if (!frac(r.along)) out.push(`${w}.along: [from, to] fractions 0..1 of the panel width, at least 0.02 apart`);
    if (!frac(r.up)) out.push(`${w}.up: [from, to] fractions 0..1 of the panel's top height, at least 0.02 apart`);
    if (r.colour !== undefined && (typeof r.colour !== 'string' || !r.colour.trim())) out.push(`${w}.colour: a #rrggbb colour or swatch`);
  });
  return out;
}

/** Board boxes on a panel (the group's main panel). Returns the boards drawn. */
export function drawSignBoards(c: PanelCtx, boards: readonly SignBoardFit[], groundM = 0): number {
  const p = c.p, W = p.uMax - p.uMin, top = p.vMax - groundM;
  let n = 0;
  for (const b of boards) {
    const u0 = p.uMin + W * b.along[0], u1 = p.uMin + W * b.along[1];
    const v0 = Math.max(p.vMin, groundM + top * b.up[0]), v1 = Math.min(p.vMax, groundM + top * b.up[1]);
    if (u1 - u0 < SIGN_BOARD.minM || v1 - v0 < SIGN_BOARD.minM) continue;
    const part = c.part();
    solid(c, b.slot, (i, j, k) => c.P(i ? u1 : u0, j ? v1 : v0, k ? SIGN_BOARD.out : 0), part);
    n++;
  }
  return n;
}

/**
 * The false front over a panel whose top rises above its eaves (gable ends of a sawtooth or pitched hall): a closed
 * slab across the panel from `eavesM` to its top. Returns 1 when drawn.
 */
export function drawFalseFront(c: PanelCtx, slot: string, eavesM: number): number {
  const p = c.p, v0 = Math.max(p.vMin, eavesM - 0.02), v1 = p.vMax;
  if (v1 - eavesM < FALSE_FRONT.minRise) return 0;
  solid(c, slot, (i, j, k) => c.P(i ? p.uMax : p.uMin, j ? v1 : v0, k ? FALSE_FRONT.out : FALSE_FRONT.back), c.part());
  return 1;
}
