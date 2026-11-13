/**
 * Crown profiles for the instanced crown draw (F1 S7, #380; docs/plans/facade-f1-design-20261112.md §4.1).
 *
 * One crown instance is a vertical strip of CROWN_SEGMENTS segments standing on the front wall's top edge. The vertex
 * shader lifts each top vertex to `crownProfileY` of its position `s` across the strip (0 at the left end, 1 at the
 * right). `CROWN_PROFILE_GLSL` is the shader's copy, kept line for line with the TypeScript below, as facadeTwin.ts is
 * with facadeShader.ts: the CPU copy is what the tests and the Node preview read.
 *
 * Heights are metres above the entry's eaves `z`:
 *   rise     the crown's top (the neck's top for neck/raised-neck/shouldered, under any cap);
 *   neck     the neck's half width as a share of the half width (default 0.42, the planner's);
 *   capRise  a cap's height over the neck (rounded, pediment or segmental; flat draws none);
 *   steps    treads a side for a step gable (default 3, the planner's).
 * The profile shapes follow roofMesh.ts gableProfile, in the planner's proportions, so that the same front draws the
 * same crown with the flag on and off. One difference: risers lean across one segment, and do not stand plumb.
 * Pure, no DOM.
 */
import { CROWN_CAPS, CROWN_SHOULDERS } from '../buildingRecipe/intent.ts';
import { CROWN_KINDS, type CrownEntry } from '../world/facadeStreams.ts';

/** Segments across one crown strip (design §4.1: a 2 x 24-segment strip). */
export const CROWN_SEGMENTS = 24;
/** The planner's neck half width over the half width, and the shoulder's height over the crown's rise. */
export const CROWN_NECK_DEFAULT = 0.42, CROWN_SHOULDER_SHARE = 0.45;
/** A raised neck's upright at the foot of each flank, as a share of the rise. */
export const CROWN_RAISED_FOOT = 0.3;
/** Bell flank (planner): flat crown over the middle CROWN_BELL_TOP of the half width, 0.12 of the rise at the foot. */
export const CROWN_BELL_TOP = 0.18, CROWN_BELL_FOOT = 0.12;
/** A step gable's tread, as a share of the half width: 1 / (steps + CROWN_STEP_PAD). */
export const CROWN_STEP_PAD = 0.6;

export type CrownShape = Pick<CrownEntry, 'kind' | 'rise' | 'neck' | 'capRise' | 'steps' | 'shoulder' | 'cap' | 'half'>;

const smooth01 = (e: number) => e * e * (3 - 2 * e);
/** The flank from the foot (e = 0) to the neck (e = 1): concave (the default), straight, convex or ogee. */
export function shoulderCurve(e: number, shoulder: CrownShape['shoulder']): number {
  const x = Math.min(1, Math.max(0, e));
  if (shoulder === 'straight') return x;
  if (shoulder === 'convex') return Math.pow(x, 0.6);
  if (shoulder === 'ogee') return smooth01(x);
  return Math.pow(x, 1.7);
}

/** The cap over the neck at u = |x| / neck half width (0 centre, 1 edge). */
export function capCurve(u: number, cap: CrownShape['cap']): number {
  const x = Math.min(1, Math.max(0, u));
  if (cap === 'rounded') return Math.sqrt(1 - x * x);
  if (cap === 'pediment') return 1 - x;
  if (cap === 'segmental') return 1 - x * x;
  return 0;
}

/** Distance from the crown's axis, 0 (axis) to 1 (foot), at s across the strip; a half crown rises to one end. */
export function crownT(s: number, half: CrownShape['half']): number {
  const x = Math.min(1, Math.max(0, s));
  if (half === 'left') return 1 - x;
  if (half === 'right') return x;
  return Math.abs(2 * x - 1);
}

/** The crown's top at s across the strip, in metres above the eaves. */
export function crownProfileY(c: CrownShape, s: number): number {
  const t = crownT(s, c.half), R = Math.max(0, c.rise), n = c.neck > 0 ? c.neck : CROWN_NECK_DEFAULT;
  const capped = (y: number) => (t <= n ? y + Math.max(0, c.capRise) * capCurve(t / n, c.cap) : y);
  switch (c.kind) {
    case 'flat': return 0;
    case 'cornice': case 'cornice-ledge': return R;
    case 'point': return R * (1 - t);
    case 'spout': return t <= n ? R : R * (1 - t) / (1 - n);
    case 'step': {
      const steps = c.steps > 0 ? c.steps : 3, w = 1 / (steps + CROWN_STEP_PAD), e = 1 - t;
      return R * (Math.min(steps, Math.floor(e / w + 1e-6)) + 1) / (steps + 1);
    }
    case 'bell': return t < CROWN_BELL_TOP ? R : R * (CROWN_BELL_FOOT + (1 - CROWN_BELL_FOOT) * (0.5 + 0.5 * Math.cos(Math.PI * Math.pow((t - CROWN_BELL_TOP) / (1 - CROWN_BELL_TOP), 0.85))));
    case 'shouldered': return capped(t <= n ? R : R * CROWN_SHOULDER_SHARE);
    case 'raised-neck': { const foot = R * CROWN_RAISED_FOOT, sh = R * CROWN_SHOULDER_SHARE; return capped(t <= n ? R : foot + (sh - foot) * shoulderCurve((1 - t) / (1 - n), c.shoulder)); }
    case 'neck': return capped(t <= n ? R : R * CROWN_SHOULDER_SHARE * shoulderCurve((1 - t) / (1 - n), c.shoulder));
    default: return 0;
  }
}

/** The strip's top line: CROWN_SEGMENTS + 1 heights, left to right. */
export const crownProfile = (c: CrownShape): number[] => Array.from({ length: CROWN_SEGMENTS + 1 }, (_, i) => crownProfileY(c, i / CROWN_SEGMENTS));

/** Instance attribute codes the shader reads (crownC): kind index, shoulder 0..4 (0 = default), cap 0..4, half 0..2. */
export const crownCodes = (c: CrownShape): [number, number, number, number] => [
  Math.max(0, CROWN_KINDS.indexOf(c.kind)), c.shoulder ? CROWN_SHOULDERS.indexOf(c.shoulder) + 1 : 0, c.cap ? CROWN_CAPS.indexOf(c.cap) + 1 : 0,
  c.half === 'left' ? 1 : c.half === 'right' ? 2 : 0,
];

const K = (k: (typeof CROWN_KINDS)[number]) => `${CROWN_KINDS.indexOf(k)}.0`;
const S = (k: (typeof CROWN_SHOULDERS)[number]) => `${CROWN_SHOULDERS.indexOf(k) + 1}.0`;
const C = (k: (typeof CROWN_CAPS)[number]) => `${CROWN_CAPS.indexOf(k) + 1}.0`;
const f = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : String(v));

/**
 * GLSL ES 3.00: `float crownProfileY(float s, vec4 shape, vec4 codes)` with shape = (rise, neck, capRise, steps) and
 * codes = crownCodes(). Line for line with crownProfileY above.
 */
export const CROWN_PROFILE_GLSL = /* glsl */ `
float crownShoulderCurve(float e, float sh) {
  float x = clamp(e, 0.0, 1.0);
  if (abs(sh - ${S('straight')}) < 0.5) return x;
  if (abs(sh - ${S('convex')}) < 0.5) return pow(x, 0.6);
  if (abs(sh - ${S('ogee')}) < 0.5) return x * x * (3.0 - 2.0 * x);
  return pow(x, 1.7);
}
float crownCapCurve(float u, float cap) {
  float x = clamp(u, 0.0, 1.0);
  if (abs(cap - ${C('rounded')}) < 0.5) return sqrt(1.0 - x * x);
  if (abs(cap - ${C('pediment')}) < 0.5) return 1.0 - x;
  if (abs(cap - ${C('segmental')}) < 0.5) return 1.0 - x * x;
  return 0.0;
}
float crownProfileY(float s, vec4 shape, vec4 codes) {
  float x = clamp(s, 0.0, 1.0);
  float t = codes.w > 1.5 ? x : (codes.w > 0.5 ? 1.0 - x : abs(2.0 * x - 1.0));
  float R = max(0.0, shape.x), n = shape.y > 0.0 ? shape.y : ${f(CROWN_NECK_DEFAULT)};
  float kind = codes.x, capAdd = t <= n ? max(0.0, shape.z) * crownCapCurve(t / n, codes.z) : 0.0;
  if (abs(kind - ${K('flat')}) < 0.5) return 0.0;
  if (abs(kind - ${K('cornice')}) < 0.5 || abs(kind - ${K('cornice-ledge')}) < 0.5) return R;
  if (abs(kind - ${K('point')}) < 0.5) return R * (1.0 - t);
  if (abs(kind - ${K('spout')}) < 0.5) return t <= n ? R : R * (1.0 - t) / (1.0 - n);
  if (abs(kind - ${K('step')}) < 0.5) {
    float steps = shape.w > 0.0 ? shape.w : 3.0, w = 1.0 / (steps + ${f(CROWN_STEP_PAD)}), e = 1.0 - t;
    return R * (min(steps, floor(e / w + 1e-6)) + 1.0) / (steps + 1.0);
  }
  if (abs(kind - ${K('bell')}) < 0.5) return t < ${f(CROWN_BELL_TOP)} ? R : R * (${f(CROWN_BELL_FOOT)} + ${f(1 - CROWN_BELL_FOOT)} * (0.5 + 0.5 * cos(3.141592653589793 * pow((t - ${f(CROWN_BELL_TOP)}) / ${f(1 - CROWN_BELL_TOP)}, 0.85))));
  if (abs(kind - ${K('shouldered')}) < 0.5) return (t <= n ? R : R * ${f(CROWN_SHOULDER_SHARE)}) + capAdd;
  if (abs(kind - ${K('raised-neck')}) < 0.5) { float foot = R * ${f(CROWN_RAISED_FOOT)}, sh = R * ${f(CROWN_SHOULDER_SHARE)}; return (t <= n ? R : foot + (sh - foot) * crownShoulderCurve((1.0 - t) / (1.0 - n), codes.y)) + capAdd; }
  if (abs(kind - ${K('neck')}) < 0.5) return (t <= n ? R : R * ${f(CROWN_SHOULDER_SHARE)} * crownShoulderCurve((1.0 - t) / (1.0 - n), codes.y)) + capAdd;
  return 0.0;
}`;
