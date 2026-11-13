// Stage D1 describer answers as partial HouseSpecs (house plan P1 step 2): one spec per pand from toSpecPart (source
// `vision-judge`), filtered to what the integrator ruled ships (STAGED below: step-1c fields that cleared the bar, and for
// crown, head and cornice only the answered classes with precision >= 0.8 on the adjudicated labels; per-class.md), plus
// the wall colour: finish from the reader (palette/wallMaterial), colour from the wall-sample pixels, i.e. lane W1's wall
// sample on the game-lens photo of the pinned capture (cuts.json `w1`, describe-cut.ts w1 mode), fitted through fitWallBrick
// so the brick renders onto the photo (pins render about PIN_RENDER_GAIN x the city tint); the describe cut's own `wallHex`
// is no colour source (D1-fix 3, item B).
// Storeys follow the row convention: rows below the crown, the ground row included, with `facts/groundKind` saying what that
// row is (shop, door-only, dwelling, warehouse) and `fronts/0/souterrain` stated true or false as read (D1-fix).
// A front whose storeys, crown or bands are not visible inherits them from a twin under the twin guard (twinGuard below,
// twin-guard.ts scores it): default `mutual` = each house's `sameAs` names the other, street-run width within 0.3 m and build
// year within 3 (D1-fix); `--twin-guard pr1` keeps the step-1c guard (own `sameAs` + PR1 `similar`, which also asks exposed
// height within 0.8 m). Writes <out>/<pandId>.json and <out>/coverage.json. Never publishes: house:publish stays the
// integrator's step.
//
//   node --import tsx scripts/house-specs/describer-d1/stage.ts --answers <dir> [--cuts <cuts.json>] [--probes <probe-cache.json>]
//     --out <dir> [--at 2026-11-13] [--twin-guard mutual|pr1]
import fs from 'node:fs';
import path from 'node:path';
import { toSpecPart, UNKNOWN, upperHead, type DescriberAnswer } from '../../../src/canalRecall/houseSpec/describer.ts';
import { emptySpec, provenanceOf, setSpecField, specField, specFields, specProblems, type HouseSpec } from '../../../src/canalRecall/houseSpec/spec.ts';
import { sideOf } from './twins.ts';
import { fitWallBrick } from '../../block-face/fit-wall-palette.ts';
import { CITY_BRICK_LIGHTNESS, cityWallTint, hexToRgb, hslToRgb, rgbToHex } from '../../../src/canalRecall/look/palette.ts';
import { rgbToHsl } from '../../../src/canalRecall/blockFace/wallColour.ts';
import { EXPOSURE, exposeHex, normGain, type ExposureRefLike, type WallExposureFact } from '../../../src/canalRecall/houseSpec/wallExposure.ts';
import { similar, similarWidthYear, type Probe } from './partyPairs.ts';
import { loadAnswers } from './score.ts';

/** Answer keys whose share of values (not `not-visible`) the pilot reports. */
export const ANSWER_FIELDS = ['storeys', 'bays', 'windows', 'heads', 'bands', 'windowSurround', 'sills', 'doorBay', 'ground', 'basement', 'crown', 'cornice', 'finish', 'pale'] as const;

const answered = (v: unknown): boolean =>
  v !== undefined && v !== UNKNOWN && !(Array.isArray(v) && (!v.length || v.every(x => x === UNKNOWN)));

/** What ships (integrator ruling on step 1c): a spec path, and for crown/head/cornice the classes that may be staged. Basement
 *  only from a crop (its cut score was below the bar). Everything else toSpecPart writes stays prior-only. */
export const STAGED: Record<string, ((v: unknown, a: DescriberAnswer) => boolean)> = {
  'fronts/0/storeys': () => true,
  'fronts/0/souterrain': () => true,
  'fronts/0/bays': () => true,
  'fronts/0/bands': () => true,
  'facts/pui': () => true,
  'facts/groundKind': () => true,
  'fronts/0/basement': (_v, a) => a.image.kind === 'crop',
  'palette/wallMaterial': () => true,
  // the answered crown class decides (a `mansard` answer compiles to gable cornice + roofFront mansard: precision 0.33, not staged)
  'fronts/0/gable': (_v, a) => a.crown === 'cornice' || a.crown === 'step' || CURVED.has(String(a.crown)),
  'fronts/0/windowHead': v => ['flat', 'segmental'].includes((v as { kind?: string })?.kind ?? ''),
  'fronts/0/cornice': v => v === 'none',
  // prompt v4.3 reads, stored with their receipt and held for every route (HELD_FOR_ALL_ROUTES) until scored (extras.ts)
  'fronts/0/readBalconies': () => true,
  'fronts/0/readDormers': () => true,
  'fronts/0/readBayWindow': () => true,
  'fronts/0/readDoorSurround': () => true,
};

/**
 * Per-row heads (D1-fix 2, ruled on D1-fix 3): the answer's `heads` (one per row, ground first) kept per row, so a front whose
 * rows differ (171218: flat, flat, round) is not flattened to `mixed` and dropped. A class ships only at precision >= 0.8 and
 * better than its fallback; per row, flat and segmental have not shown that (heads.ts, head-truth.ts), so:
 *   - every known upper row one of flat / segmental: the whole-front `windowHead {kind}` exactly as before (byte-identical);
 *   - otherwise the reading is kept as `rowHeads` (the list as read) with its receipt and staged for no route
 *     (spec.ts drawableDesign drops it for every compiler; the generic view and the F1 record never read it);
 *   - round rows also become `archedStoreys`, drawn by the recipe route only (ROUTE_C_ONLY) until round has a figure.
 * Per row only when `heads` has one entry per counted row. Returns the fields to set.
 */
export function rowHeads(heads: readonly string[] | undefined, storeys: unknown): { windowHead?: { kind: 'flat' | 'segmental' }; rowHeads?: string[]; archedStoreys?: number[] } {
  if (!heads?.length) return {};
  const whole = upperHead(heads as DescriberAnswer['heads']);
  if (whole === 'flat' || whole === 'segmental') return { windowHead: { kind: whole } };
  // per row only when the list is one entry per row (a count that does not match cannot say which storey is which)
  if (!Number.isInteger(storeys) || heads.length !== storeys || heads.every(h => h === UNKNOWN)) return {};
  const round = heads.map((h, s) => [h, s] as const).filter(([h, s]) => h === 'round' && (heads.length === 1 || s > 0)).map(([, s]) => s);
  return { rowHeads: [...heads], ...(round.length ? { archedStoreys: round } : {}) };
}
/** Staged paths only the recipe route (route C, toRecipe -> compile) draws: the generic view and the F1 record never read them. */
export const ROUTE_C_ONLY: ReadonlySet<string> = new Set(['fronts/0/archedStoreys']);
/** Staged paths no route draws (kept as read, with a receipt, for scoring and a later ruling). */
export const HELD_FOR_ALL_ROUTES: ReadonlySet<string> = new Set(['fronts/0/rowHeads', 'fronts/0/readBalconies', 'fronts/0/readDormers', 'fronts/0/readBayWindow', 'fronts/0/readDoorSurround']);

/** Neck and bell read as one class (a curved gable): precision 0.91 merged against 0.65 / 0.50 apart (per-class.md). */
export const CURVED: ReadonlySet<string> = new Set(['neck', 'bell']);
/** The gable a curved-gable reading stages: the register's neck or bell where it states one, otherwise neck. */
export const curvedGable = (registerGable: string | null | undefined): 'neck' | 'bell' => (registerGable === 'bell' ? 'bell' : 'neck');

/** Keep only the STAGED paths (and their provenance) of a spec; the dropped paths are listed. */
export function shipOnly(spec: HouseSpec, a: DescriberAnswer): { spec: HouseSpec; dropped: string[] } {
  const out = emptySpec(spec.pandId), dropped: string[] = [];
  for (const [path, value] of specFields(spec)) {
    if (STAGED[path]?.(value, a)) { setSpecField(out, path, value); out.provenance[path] = provenanceOf(spec, path)!; } else dropped.push(path);
  }
  if (spec.schemaLimits?.length) out.schemaLimits = spec.schemaLimits;
  return { spec: out, dropped };
}

/** A pinned pose renders a wall about this much lighter than cityWallTint(brick) (per channel; the reviewer's figure, D1-fix 3). */
export const PIN_RENDER_GAIN = 1.14;
/** The brick whose pinned render lands on the W1 photo sample: fitWallBrick(sample, PIN_RENDER_GAIN x tint(sample), sample).
 *  `floorTintL` (lane WC option a, #384): the city tint's floor for this fit, default CITY_BRICK_LIGHTNESS[0]. */
export function wallBrickFromSample(sample: string, floorTintL: number = CITY_BRICK_LIGHTNESS[0]): { brick: string; predicted: string; floor: boolean } {
  const tint = floorTintL === CITY_BRICK_LIGHTNESS[0] ? cityWallTint : (hex: string) => floorTint(hex, floorTintL);
  const model = rgbToHex(hexToRgb(tint(sample)).map(v => Math.min(255, Math.round(v * PIN_RENDER_GAIN))) as [number, number, number]);
  const fit = fitWallBrick(sample, model, sample, tint);
  // Below the city brick floor (CITY_BRICK_LIGHTNESS: tint L' = 0.12 + 0.9 L >= 0.3) every darker brick renders the same
  // tint and the grid search runs to near black; stage the lightest brick at the floor instead, in the sample's hue and
  // saturation (for a painted-black front about the sample itself). The render cannot go darker: `floor` says so.
  const lFloor = Math.max(0, (floorTintL - 0.12) / 0.9), [, , l] = rgbToHsl(hexToRgb(fit.brick));
  if (l >= lFloor - 0.005) return { ...fit, floor: false };
  const [h, sat] = rgbToHsl(hexToRgb(sample));
  return { brick: rgbToHex(hslToRgb([h, sat, lFloor])), predicted: fit.predicted, floor: true };
}
/** cityWallTint with another lightness floor (palette.ts: L' = 0.12 + 0.9 L clamped to [floor, CITY_BRICK_LIGHTNESS[1]]). */
function floorTint(hex: string, floor: number): string {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  return rgbToHex(hslToRgb([h, Math.min(0.5, Math.max(0.12, s)), Math.min(CITY_BRICK_LIGHTNESS[1], Math.max(floor, 0.12 + l * 0.9))]));
}
/**
 * The three wall-exposure options for one sample (lane WC, #384; src/canalRecall/houseSpec/wallExposure.ts), staged as
 * `facts/wallExposure` beside the off brick: (a) floor = the fit with EXPOSURE.floorTintL; (b) gain = the sample x
 * EXPOSURE.gainB; (c) norm = the sample x the capture's normGain (needs the capture's references, w1.ref). (b) and (c)
 * then take the existing floor; normfloor = (c) with (a)'s floor. Null without references.
 */
export function wallExposureFact(sample: string, ref: ExposureRefLike | null | undefined): WallExposureFact | null {
  if (!ref || !(ref.white > 0) || !(ref.scene > 0)) return null;
  const g = normGain(ref);
  return { off: wallBrickFromSample(sample).brick, floor: wallBrickFromSample(sample, EXPOSURE.floorTintL).brick, gain: wallBrickFromSample(exposeHex(sample, EXPOSURE.gainB)).brick, norm: wallBrickFromSample(exposeHex(sample, g)).brick, normfloor: wallBrickFromSample(exposeHex(sample, g), EXPOSURE.floorTintL).brick, g: +g.toFixed(3) };
}

/** The staged spec for one answer: the shipping part of toSpecPart plus the measured wall colour when the cut sampled one. */
export function stageOne(a: DescriberAnswer, wallHex: string | null, at: string | null, registerGable: string | null = null, exposureRef: ExposureRefLike | null = null) {
  const part = toSpecPart(a, at);
  const { spec } = shipOnly(part, a);
  // per-row heads: the receipt of the answer's head reading (toSpecPart, halved when `heads` is low) on each staged slot
  const prov = provenanceOf(part, 'fronts/0/windowHead');
  if (prov) for (const [k, v] of Object.entries(rowHeads(a.heads, a.storeys))) { setSpecField(spec, `fronts/0/${k}`, v); spec.provenance[`fronts/0/${k}`] = { ...prov }; }
  if (CURVED.has(String(a.crown))) setSpecField(spec, 'fronts/0/gable', curvedGable(registerGable));
  if (a.readable && wallHex && /^#[0-9a-f]{6}$/i.test(wallHex)) {
    setSpecField(spec, 'palette/brick', wallBrickFromSample(wallHex.toLowerCase()).brick);
    spec.provenance['palette/brick'] = { source: 'streetlevel-measured', confidence: 0.6, ref: a.image.ref, at };
    // lane WC (#384): the exposure options beside it, drawn only under ?wallExposure= (default off)
    const fact = wallExposureFact(wallHex.toLowerCase(), exposureRef);
    if (fact) { setSpecField(spec, 'facts/wallExposure', fact); spec.provenance['facts/wallExposure'] = { source: 'streetlevel-measured', confidence: 0.6, ref: a.image.ref, at }; }
  }
  return spec;
}

/** Fields a hidden front inherits from its guarded twin. */
export const INHERIT = ['fronts/0/storeys', 'fronts/0/gable', 'fronts/0/bands'] as const;
type Wall = { a: [number, number]; b: [number, number]; normal: [number, number] };
/** The street wall of a cut row (cuts.json: wall a/b and the camera position, RD metres); the normal points at the camera. */
export function wallOf(row: any): Wall | null {
  const w = row?.wall, c = row?.pose?.rd;
  if (!w?.a || !w?.b || !c) return null;
  const a: [number, number] = [w.a.x, w.a.y], b: [number, number] = [w.b.x, w.b.y];
  let nx = -(b[1] - a[1]), ny = b[0] - a[0];
  const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
  if ((c.x - (a[0] + b[0]) / 2) * nx + (c.y - (a[1] + b[1]) / 2) * ny < 0) { nx = -nx; ny = -ny; }
  return { a, b, normal: [nx, ny] };
}
const adjacentWalls = (w1: Wall, w2: Wall, tol = 1.5) => [w1.a, w1.b].some(p => [w2.a, w2.b].some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < tol));

type Side = 'left' | 'right';
/** A `sameAs` answer names `side` (or both sides). */
export const namesSide = (sameAs: unknown, side: Side): boolean => sameAs === side || sameAs === 'both';
export const opposite = (side: Side): Side => (side === 'left' ? 'right' : 'left');
export type TwinGuard = 'mutual' | 'pr1';
export const TWIN_GUARDS: readonly TwinGuard[] = ['mutual', 'pr1'];
/**
 * May front `a` copy from its neighbour `b` on `side`? `back` is the side `a` stands on as `b` sees it (the opposite side on one
 * street). `pr1` (step 1c): a's `sameAs` names the side and PR1 `similar` holds (year 3, width 0.3 m, exposed height 0.8 m).
 * `mutual` (D1-fix): each house's `sameAs` names the other, and street-run width within 0.3 m and build year within 3; no height
 * test (3DBAG exposed height split the row's one real mirrored pair, 168043 / 168096 at 13.9 vs 16.6 m).
 */
export function twinGuard(guard: TwinGuard, x: { side: Side; back: Side; a: { sameAs?: unknown }; b?: { sameAs?: unknown } | null; pa?: Probe; pb?: Probe }): boolean {
  if (!namesSide(x.a.sameAs, x.side) || !x.pa || !x.pb) return false;
  if (guard === 'pr1') return similar(x.pa, x.pb);
  return !!x.b && namesSide(x.b.sameAs, x.back) && similarWidthYear(x.pa, x.pb);
}

/** Copy INHERIT fields a spec lacks from the twin its answer names (`sameAs` left/right/both), only when the pair's twin guard
 *  holds (`guard`, from twinGuard). Returns the paths copied. The copy keeps the twin's provenance source at half confidence,
 *  ref `twin:<pandId>`. */
export function inheritFromTwin(spec: HouseSpec, a: DescriberAnswer, twins: { side: Side; id: string; spec: HouseSpec; guard: boolean }[]): string[] {
  const sides = (['left', 'right'] as const).filter(s => namesSide(a.sameAs, s));
  const copied: string[] = [];
  for (const t of twins) {
    if (!sides.includes(t.side) || !t.guard) continue;
    for (const path of INHERIT) {
      if (specField(spec, path) !== undefined || copied.includes(path)) continue;
      const v = specField(t.spec, path), pr = provenanceOf(t.spec, path);
      if (v === undefined || !pr || pr.ref?.startsWith('twin:')) continue;
      setSpecField(spec, path, v);
      spec.provenance[path] = { ...pr, confidence: pr.confidence / 2, ref: `twin:${t.id}` };
      copied.push(path);
    }
  }
  return copied;
}

function main() {
  const argv = process.argv.slice(2);
  const opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const dir = opt('answers'), out = opt('out');
  if (!dir || !out) { console.error('usage: stage.ts --answers <dir> [--cuts cuts.json] --out <dir>'); process.exit(2); }
  const at = opt('at') ?? null;
  const guard = (opt('twin-guard') ?? 'mutual') as TwinGuard;
  if (!TWIN_GUARDS.includes(guard)) { console.error(`--twin-guard ${TWIN_GUARDS.join('|')}`); process.exit(2); }
  const hex = new Map<string, string>(), walls = new Map<string, Wall>(), refs = new Map<string, ExposureRefLike>();
  if (opt('cuts')) for (const r of JSON.parse(fs.readFileSync(opt('cuts')!, 'utf8')).rows ?? []) {
    if (r.w1?.hex) hex.set(r.pandId, r.w1.hex);
    if (r.w1?.ref) refs.set(r.pandId, r.w1.ref);
    const w = wallOf(r); if (w) walls.set(r.pandId, w);
  }
  const probes: Record<string, Probe> = opt('probes') ? JSON.parse(fs.readFileSync(opt('probes')!, 'utf8')) : {};
  const A = loadAnswers(dir);
  fs.mkdirSync(out, { recursive: true });
  const fieldCount: Record<string, number> = {}, answerCount: Record<string, number> = {};
  let readable = 0, stagedN = 0, nv = 0, cells = 0;
  const problems: Record<string, string[]> = {};
  const staged = new Map<string, HouseSpec>();
  for (const [id, a] of A) {
    if (a.readable) readable++;
    for (const k of ANSWER_FIELDS) {
      if (!a.readable) continue;
      cells++;
      const v = (a as any)[k];
      if (answered(v)) answerCount[k] = (answerCount[k] ?? 0) + 1; else nv++;
    }
    staged.set(id, stageOne(a, hex.get(id) ?? null, at, (probes[id] as { monumentGable?: string | null } | undefined)?.monumentGable ?? null, refs.get(id) ?? null));
  }
  let inheritedFronts = 0; const inheritedFields: Record<string, number> = {};
  for (const [id, a] of A) {
    const me = walls.get(id), spec = staged.get(id)!;
    if (!me || !a.readable) continue;
    const twins = [...walls].filter(([nid, w]) => nid !== id && staged.has(nid) && adjacentWalls(me, w))
      .map(([nid, w]) => {
        const side = sideOf(me, w);
        return { side, id: nid, spec: staged.get(nid)!, guard: twinGuard(guard, { side, back: sideOf(w, me), a, b: A.get(nid), pa: probes[id], pb: probes[nid] }) };
      });
    const got = inheritFromTwin(spec, a, twins);
    if (got.length) inheritedFronts++;
    for (const g of got) inheritedFields[g] = (inheritedFields[g] ?? 0) + 1;
  }
  for (const [id, spec] of staged) {
    const p = specProblems(spec);
    if (p.length) { problems[id] = p; continue; }
    for (const [f] of specFields(spec)) fieldCount[f.replace(/^fronts\/\d+\//, 'fronts/*/')] = (fieldCount[f.replace(/^fronts\/\d+\//, 'fronts/*/')] ?? 0) + 1;
    fs.writeFileSync(path.join(out, `${id}.json`), `${JSON.stringify(spec, null, 1)}\n`);
    stagedN++;
  }
  const share = (n: number) => +(n / Math.max(1, readable)).toFixed(3);
  const report = {
    v: 1, twinGuard: guard, answers: A.size, readable, staged: stagedN, inheritedFronts, inheritedFields, notVisibleRate: +(nv / Math.max(1, cells)).toFixed(3),
    answerCoverage: Object.fromEntries(ANSWER_FIELDS.map(k => [k, share(answerCount[k] ?? 0)])),
    specFieldCoverage: Object.fromEntries(Object.entries(fieldCount).sort().map(([k, n]) => [k, share(n)])),
    problems,
  };
  fs.writeFileSync(path.join(out, 'coverage.json'), `${JSON.stringify(report, null, 1)}\n`);
  console.log(JSON.stringify({ ...report, problems: Object.keys(problems).length }, null, 1));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
