// Stage D1 describer answers as partial HouseSpecs (house plan P1 step 2): one spec per pand from toSpecPart (source
// `vision-judge`), filtered to what the integrator ruled ships (STAGED below: step-1c fields that cleared the bar, and for
// crown, head and cornice only the answered classes with precision >= 0.8 on the adjudicated labels; per-class.md), plus
// the wall colour sampled from the same describe cut (cuts.json `wallHex`, source `streetlevel-measured`, as W1 does).
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
};

/**
 * Per-row heads (D1-fix 2): the answer's `heads` (one per row, ground first) staged into the intent's per-storey slots, so a
 * front whose rows differ (171218: flat, flat, round) is not flattened to `mixed` and dropped. Upper rows only (the head
 * precision was measured there). A row stages when its class is flat or segmental (per-class precision >= 0.8) or round.
 *   - every known upper row one of flat / segmental: `windowHead {kind}` exactly as before (byte-identical);
 *   - segmental rows among others: `windowHead {kind: segmental, storeys: [those rows]}`; flat rows are the default;
 *   - round rows: `archedStoreys` (ROUTE_C_ONLY: only the recipe compiler reads it; the generic view and the F1 record do not,
 *     until round has a precision figure: heads.ts scores it);
 *   - relieving, pointed, mixed and not-visible rows stage nothing (a front with only those and flat rows stages no head).
 * Returns the fields to set (none when the rows say nothing stageable).
 */
export function rowHeads(heads: readonly string[] | undefined, storeys: unknown): { windowHead?: { kind: 'flat' | 'segmental'; storeys?: number[] }; archedStoreys?: number[] } {
  if (!heads?.length) return {};
  const whole = upperHead(heads as DescriberAnswer['heads']);
  if (whole === 'flat' || whole === 'segmental') return { windowHead: { kind: whole } };
  // per row only when the list is one entry per row (a count that does not match cannot say which storey is which)
  if (!Number.isInteger(storeys) || heads.length !== storeys) return {};
  const rows = heads.map((h, s) => [h, s] as const).filter(([, s]) => heads.length === 1 || s > 0);
  const seg = rows.filter(([h]) => h === 'segmental').map(([, s]) => s), round = rows.filter(([h]) => h === 'round').map(([, s]) => s);
  const out: ReturnType<typeof rowHeads> = {};
  if (seg.length) out.windowHead = { kind: 'segmental', storeys: seg };
  if (round.length) out.archedStoreys = round;
  return out;
}
/** Staged paths only the recipe route (route C, toRecipe -> compile) draws: the generic view and the F1 record never read them. */
export const ROUTE_C_ONLY: ReadonlySet<string> = new Set(['fronts/0/archedStoreys']);

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

/** The staged spec for one answer: the shipping part of toSpecPart plus the measured wall colour when the cut sampled one. */
export function stageOne(a: DescriberAnswer, wallHex: string | null, at: string | null, registerGable: string | null = null) {
  const part = toSpecPart(a, at);
  const { spec } = shipOnly(part, a);
  // per-row heads: the receipt of the answer's head reading (toSpecPart, halved when `heads` is low) on each staged slot
  const prov = provenanceOf(part, 'fronts/0/windowHead');
  if (prov) for (const [k, v] of Object.entries(rowHeads(a.heads, a.storeys))) { setSpecField(spec, `fronts/0/${k}`, v); spec.provenance[`fronts/0/${k}`] = { ...prov }; }
  if (CURVED.has(String(a.crown))) setSpecField(spec, 'fronts/0/gable', curvedGable(registerGable));
  if (a.readable && wallHex && /^#[0-9a-f]{6}$/i.test(wallHex)) {
    setSpecField(spec, 'palette/brick', wallHex.toLowerCase());
    spec.provenance['palette/brick'] = { source: 'streetlevel-measured', confidence: 0.6, ref: a.image.ref, at };
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
  const hex = new Map<string, string>(), walls = new Map<string, Wall>();
  if (opt('cuts')) for (const r of JSON.parse(fs.readFileSync(opt('cuts')!, 'utf8')).rows ?? []) {
    if (r.wallHex) hex.set(r.pandId, r.wallHex);
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
    staged.set(id, stageOne(a, hex.get(id) ?? null, at, (probes[id] as { monumentGable?: string | null } | undefined)?.monumentGable ?? null));
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
