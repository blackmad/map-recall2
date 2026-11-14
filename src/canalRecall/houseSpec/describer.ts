/**
 * Describer answers (house plan P1, lane D1, 2026-11-13): one record per pand, written by a Claude agent that reads the pand's
 * best square winter crop (or, for a benchmark pand without a crop, the benchmark's pose photo) and states what it sees, in the
 * HouseSpec vocabulary (spec.ts / buildingRecipe/intent.ts enums) where one exists. What the spec cannot say goes into `gaps`
 * (`SpecLimit`, the kit-gap queue shape); nothing is force-fitted. `toSpecPart` turns an answer into a partial HouseSpec at
 * source `vision-judge`, so a step-2 run can merge it with the other writers (writers/merge.ts) field by field.
 *
 * Files: artifacts/describer-d1/answers/<pandId>.json, written through `writeAnswer` (validates first).
 */
import fs from 'node:fs';
import path from 'node:path';
import { BASEMENTS, GABLES, WINDOWS, type WindowKind } from '../buildingRecipe/intent.ts';
import { emptySpec, setSpecField, SPEC_CORNICES, SPEC_WINDOW_SURROUNDS, toSpecLimit, type HouseSpec, type SpecGable, type SpecLimit } from './spec.ts';

/** Any field the image cannot show (hidden by a tree or van, cut off, too dark): never guessed. */
export const UNKNOWN = 'not-visible' as const;
type U = typeof UNKNOWN;

/** Head shape of a storey's windows; `relieving` = flat head under a brick relieving arch (intent WINDOW_HEADS), `pointed` and `mixed`
 *  are describer words the intent has no head kind for (`mixed`: two shapes on one storey). */
export const HEADS = ['flat', 'segmental', 'round', 'relieving', 'pointed', 'mixed'] as const;
export type Head = (typeof HEADS)[number];
/** intent `FrontIntent.bands` plus `none` (absent in the intent). */
export const BANDS = ['none', 'storey', 'lintel', 'both', 'courses', 'speklagen', 'painted'] as const;
/** Sills: `stone` a plain stone/painted sill under each window (intent: windowSurround `sill`), `consoles` a sill slab on consoles
 *  (intent windowSills `consoles`), `none` brick or no visible sill. */
export const SILLS = ['none', 'stone', 'consoles'] as const;
/** `off-centre`: one street door that is neither the outer bay nor the middle one (the third of four axes). */
export const DOOR_BAYS = ['left', 'centre', 'right', 'off-centre', 'several', 'none'] as const;
/** The window dressing: the intent surrounds plus the spec-level `block-dressings` (spec.ts SPEC_WINDOW_SURROUNDS). */
export const SURROUNDS = SPEC_WINDOW_SURROUNDS;
/** The cornice: the intent cornices plus the spec-level `attic-frieze` (spec.ts SPEC_CORNICES). */
export const ANSWER_CORNICES = SPEC_CORNICES;
export const GROUNDS = ['shopfront', 'dwelling', 'warehouse'] as const;
/** The crown: the intent gables plus `mansard` (intent: gable cornice + roofFront mansard) and `pitched-eaves` (an eaves line
 *  with the roof slope in view: no intent gable says it). */
export const CROWNS = [...GABLES, 'mansard', 'pitched-eaves'] as const;
export type Crown = (typeof CROWNS)[number];
/** facts.wallFamily (spec.ts). */
export const WALL_FAMILIES = ['white', 'grey', 'buff', 'orange', 'red', 'red-brown', 'brown', 'dark'] as const;
export type WallFamily = (typeof WALL_FAMILIES)[number];
/** palette.wallMaterial plus `stone` (stone-faced; the generic wall has no stone material). */
export const FINISHES = ['brick', 'painted-brick', 'stucco', 'stone'] as const;

/** The describer prompts (repo paths) and the default a reader is given (integrator ruling D1-fix 3: v4.2 for the volume tranche; v4.3 since item A, no shipped field dropped beyond its interval on the 147 crops). */
export const DESCRIBER_PROMPTS = {
  'v4': 'scripts/house-line/describer/prompt-v4.md',
  'v4.1': 'scripts/house-line/describer/prompt-v4.1.md',
  'v4.2': 'scripts/house-line/describer/prompt-v4.2.md',
  'v4.3': 'scripts/house-line/describer/prompt-v4.3.md',
} as const;
export type DescriberPromptVersion = keyof typeof DESCRIBER_PROMPTS;
export const DESCRIBER_PROMPT: DescriberPromptVersion = 'v4.3';
/** The prompt file of a version (default DESCRIBER_PROMPT) under the repo root. */
export const describerPromptPath = (root: string, v: DescriberPromptVersion = DESCRIBER_PROMPT): string => path.join(root, DESCRIBER_PROMPTS[v]);

export const SAME_AS = ['left', 'right', 'both', 'none'] as const;

/** What the ground row of `storeys` is (D1-fix row convention): a shop pui, a ground storey whose one opening is the street door
 *  (`door-only`), a house ground storey with windows (`dwelling`), loading doors (`warehouse`). Souterrain and roof storey are
 *  separate flags (`fronts/N/souterrain`, the `storeyParts.roof` reading); none of them changes the row count. */
export const GROUND_KINDS = ['shop', 'door-only', 'dwelling', 'warehouse'] as const;
export type GroundKind = (typeof GROUND_KINDS)[number];

/** prompt v3: a tall upper-storey window whose horizontal bar (sash meeting rail or T-window transom) is not resolvable. */
export const TALL_UPPER = 'tall-upper' as const;

export interface DescriberAnswer {
  v: 1;
  pandId: string;
  /** What was read: the crop file (`source-data://pand-crops/<id>/front.jpg`) or the benchmark pose photo. */
  image: { ref: string; kind: 'crop' | 'pose-photo' | 'render'; tier?: 'good' | 'fallback' | 'none' | null; year?: number | null; gate?: 'pass' | 'fail' | null };
  /** Who read it, e.g. `D1 opus` or `D1 sonnet`. */
  reader: string;
  /** The prompt version the reader was given (DESCRIBER_PROMPTS); stamped by write-answer.ts since D1-fix 3. */
  prompt?: string;
  readable: boolean;
  /** `multi`: the pand's wall carries more than one house front (read the dominant/target one, say so in notes). */
  extent: 'single' | 'multi';
  /** Rows below the crown: full street storeys, the ground storey included once (a shop, a door-only ground, a bel-etage), no
   *  souterrain, no attic in the crown. Prompt v4 writes it from `storeyParts.full` (write-answer.ts). */
  storeys: number | U;
  /** Prompt v4: the storey parts as read (`storeys` = `full`); kept on the stored answer. */
  storeyParts?: { full: number | U; roof: string; souterrain: boolean | U };
  /** Window axes of the upper storeys (the storey with the most); an erker is one axis, a mullioned pair one. 0: a front with
   *  no upper storey (a one-storey wall), never staged as bays. */
  bays: number | U;
  /** Openings per storey, ground first (optional detail). */
  columns?: number[];
  /** Dominant upper-storey window kind (intent WINDOWS). */
  windows: WindowKind | typeof TALL_UPPER | U;
  /** Per storey (index from the ground) where it differs from `windows`. */
  storeyWindows?: Record<string, WindowKind>;
  /** Window head per storey, ground first (length = storeys when known). */
  heads: (Head | U)[];
  bands: (typeof BANDS)[number] | U;
  windowSurround: (typeof SURROUNDS)[number] | U;
  sills: (typeof SILLS)[number] | U;
  /** Where the street door to the upper house(s) is, seen from the street. */
  doorBay: (typeof DOOR_BAYS)[number] | U;
  /** Door position as an index into the ground-storey openings (intent doorBay), with the ground opening count. */
  doorIndex?: number | null;
  groundBays?: number;
  ground: (typeof GROUNDS)[number] | U;
  basement: (typeof BASEMENTS)[number] | U;
  souterrain?: boolean;
  crown: Crown | U;
  cornice: (typeof ANSWER_CORNICES)[number] | U;
  wallFamily: WallFamily | U;
  finish: (typeof FINISHES)[number] | U;
  /** White-painted window joinery. */
  whiteFrames?: boolean;
  /** This front is the same design as its left/right neighbour (`both`: a front inside a series of twins), else `none` (prompt v2). */
  sameAs?: (typeof SAME_AS)[number] | U;
  /** With `sameAs`: the twin is mirrored (door and asymmetric parts on the other side). */
  mirrored?: boolean | U;
  /** Prompt v4.3 (held, scored before any route draws them): rows (ground = 0, as `heads`) with a balcony or balconette. */
  balconies?: number[] | U;
  /** Prompt v4.3: roof dormers and wall dormers / part-front gables over the cornice line, `gabled` when any has a gable or pediment top. */
  dormers?: { count: number; kind: (typeof DORMER_KINDS)[number] } | U;
  /** Prompt v4.3: rows (ground = 0) with a projecting bay window (erker, oriel). */
  bayWindow?: number[] | U;
  /** Prompt v4.3: the street door has a dressed doorcase (pilasters, a frame, a hood or cornice over it). */
  doorSurround?: boolean | U;
  /** Fields read at low confidence (named by key). */
  low?: string[];
  gaps: SpecLimit[];
  notes?: string;
}

const isIn = <T extends readonly unknown[]>(list: T, v: unknown): boolean => v === UNKNOWN || (list as readonly unknown[]).includes(v);
const countOk = (v: unknown, lo: number, hi: number) => v === UNKNOWN || (Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi);

/** The keys `low` may name: the answer's fields, and the v4 storey components as `storeyParts.<part>`. */
export const LOW_KEYS: ReadonlySet<string> = new Set(['extent', 'storeys', 'bays', 'columns', 'windows', 'storeyWindows', 'heads', 'bands',
  'windowSurround', 'sills', 'doorBay', 'doorIndex', 'groundBays', 'ground', 'basement', 'souterrain', 'crown', 'cornice', 'wallFamily',
  'finish', 'whiteFrames', 'sameAs', 'mirrored', 'pale', 'paneLayout', 'storeyParts', 'storeyParts.full', 'storeyParts.roof',
  'storeyParts.souterrain', 'balconies', 'dormers', 'bayWindow', 'doorSurround']);
/** Prompt v4.3 dormer kinds: `none` with count 0. */
export const DORMER_KINDS = ['plain', 'gabled', 'none'] as const;
const rowList = (v: unknown) => v === UNKNOWN || (Array.isArray(v) && v.every(r => Number.isInteger(r) && r >= 0 && r <= 30) && new Set(v).size === v.length);

/** Problems with an answer (empty = valid). */
export function answerProblems(a: any): string[] {
  const p: string[] = [];
  if (!a || typeof a !== 'object') return ['an answer is an object'];
  if (a.v !== 1) p.push('v must be 1');
  if (!/^\d{16}$/.test(a.pandId ?? '')) p.push('pandId: 16 digits');
  if (!a.image || typeof a.image.ref !== 'string' || !['crop', 'pose-photo', 'render'].includes(a.image.kind)) p.push('image: {ref, kind crop|pose-photo|render}');
  if (typeof a.reader !== 'string' || !a.reader) p.push('reader: who read it');
  if (typeof a.readable !== 'boolean') p.push('readable: boolean');
  if (!['single', 'multi'].includes(a.extent)) p.push('extent: single|multi');
  if (!countOk(a.storeys, 1, 30)) p.push(`storeys: 1..30 or ${UNKNOWN}`);
  if (!countOk(a.bays, 0, 30)) p.push(`bays: 0..30 or ${UNKNOWN}`);
  if (a.columns !== undefined && !(Array.isArray(a.columns) && a.columns.every((c: unknown) => Number.isInteger(c) && (c as number) >= 0 && (c as number) <= 40))) p.push('columns: counts');
  if (!isIn(WINDOWS, a.windows) && a.windows !== TALL_UPPER) p.push(`windows: ${JSON.stringify(a.windows)} not in WINDOWS`);
  for (const [k, w] of Object.entries(a.storeyWindows ?? {})) if (!isIn(WINDOWS, w) || w === UNKNOWN) p.push(`storeyWindows.${k}: ${JSON.stringify(w)} not in WINDOWS`);
  if (!Array.isArray(a.heads) || !a.heads.every((h: unknown) => isIn(HEADS, h))) p.push(`heads: a list of ${HEADS.join('|')}|${UNKNOWN}`);
  else if (Number.isInteger(a.storeys) && a.heads.length && a.heads.length !== a.storeys) p.push(`heads: ${a.heads.length} entries for ${a.storeys} storeys`);
  if (!isIn(BANDS, a.bands)) p.push(`bands: ${BANDS.join('|')}|${UNKNOWN}`);
  if (!isIn(SURROUNDS, a.windowSurround)) p.push(`windowSurround: ${SURROUNDS.join('|')}|${UNKNOWN}`);
  if (!isIn(SILLS, a.sills)) p.push(`sills: ${SILLS.join('|')}|${UNKNOWN}`);
  if (!isIn(DOOR_BAYS, a.doorBay)) p.push(`doorBay: ${DOOR_BAYS.join('|')}|${UNKNOWN}`);
  if (a.doorIndex !== undefined && a.doorIndex !== null && !countOk(a.doorIndex, 0, 40)) p.push('doorIndex: index or null');
  if (!isIn(GROUNDS, a.ground)) p.push(`ground: ${GROUNDS.join('|')}|${UNKNOWN}`);
  if (!isIn(BASEMENTS, a.basement)) p.push(`basement: ${BASEMENTS.join('|')}|${UNKNOWN}`);
  if (!isIn(CROWNS, a.crown)) p.push(`crown: ${CROWNS.join('|')}|${UNKNOWN}`);
  if (!isIn(ANSWER_CORNICES, a.cornice)) p.push(`cornice: ${ANSWER_CORNICES.join('|')}|${UNKNOWN}`);
  if (!isIn(WALL_FAMILIES, a.wallFamily)) p.push(`wallFamily: ${WALL_FAMILIES.join('|')}|${UNKNOWN}`);
  if (!isIn(FINISHES, a.finish)) p.push(`finish: ${FINISHES.join('|')}|${UNKNOWN}`);
  if (a.sameAs !== undefined && !isIn(SAME_AS, a.sameAs)) p.push(`sameAs: ${SAME_AS.join('|')}|${UNKNOWN}`);
  if (a.mirrored !== undefined && !(typeof a.mirrored === 'boolean' || a.mirrored === UNKNOWN)) p.push(`mirrored: boolean or ${UNKNOWN}`);
  if (a.low !== undefined && !(Array.isArray(a.low) && a.low.every((k: unknown) => typeof k === 'string' && LOW_KEYS.has(k)))) p.push(`low: answer keys only (${[...LOW_KEYS].join('|')})`);
  if (!Array.isArray(a.gaps) || a.gaps.some((g: unknown) => typeof g !== 'object' || !toSpecLimit(g))) p.push('gaps: a list of {component, what}');
  if (a.balconies !== undefined && !rowList(a.balconies)) p.push(`balconies: a list of rows (ground = 0) or ${UNKNOWN}`);
  if (a.bayWindow !== undefined && !rowList(a.bayWindow)) p.push(`bayWindow: a list of rows (ground = 0) or ${UNKNOWN}`);
  if (a.dormers !== undefined && a.dormers !== UNKNOWN && !(a.dormers && typeof a.dormers === 'object' && Number.isInteger(a.dormers.count) && a.dormers.count >= 0 && a.dormers.count <= 12
    && (DORMER_KINDS as readonly string[]).includes(a.dormers.kind) && (a.dormers.count === 0) === (a.dormers.kind === 'none'))) p.push(`dormers: {count 0..12, kind ${DORMER_KINDS.join('|')}} (none exactly when count 0) or ${UNKNOWN}`);
  if (a.doorSurround !== undefined && !(typeof a.doorSurround === 'boolean' || a.doorSurround === UNKNOWN)) p.push(`doorSurround: boolean or ${UNKNOWN}`);
  return p;
}

/** Row-convention problems of an answer (empty = consistent): `columns` lists every row of `storeys`, the ground row first, so a
 *  count that leaves the ground row out (or a columns list that skips a row) shows here. write-answer.ts refuses new reads with
 *  one; stored reads still load (rows.ts counts them). */
export function rowProblems(a: Pick<DescriberAnswer, 'columns' | 'storeys'>): string[] {
  return Array.isArray(a.columns) && a.columns.length && Number.isInteger(a.storeys) && a.columns.length !== a.storeys
    ? [`columns: ${a.columns.length} rows for ${a.storeys} storeys (one count per row below the crown, the ground row first)`] : [];
}

export function validateAnswer(a: unknown): DescriberAnswer {
  const p = answerProblems(a);
  if (p.length) throw new Error(`Invalid describer answer ${(a as any)?.pandId ?? '?'}:\n - ${p.join('\n - ')}`);
  return a as DescriberAnswer;
}

export const ANSWERS_DIR = (root: string) => path.join(root, 'artifacts/describer-d1/answers');

/** Validate and write `<dir>/<pandId>.json` (stable key order, 1-space indent). */
export function writeAnswer(dir: string, a: unknown): string {
  const ok = validateAnswer(a);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${ok.pandId}.json`);
  fs.writeFileSync(file, `${JSON.stringify(ok, null, 1)}\n`);
  return file;
}

/** The upper-storey head as one word: the single shape of every known upper storey, `mixed` when they differ, else unknown. */
export function upperHead(heads: readonly (Head | U)[]): Head | U {
  const up = (heads.length > 1 ? heads.slice(1) : heads).filter(h => h !== UNKNOWN);
  if (!up.length) return UNKNOWN;
  return new Set(up).size === 1 ? up[0] : 'mixed';
}

/** The ground row of an answer's `storeys` (GROUND_KINDS), or unknown. `door-only`: not a shop and the street door is the only
 *  ground opening (groundBays 1 with the door at 0, else a ground column count of 1 with a door). */
export function groundKindOf(a: Pick<DescriberAnswer, 'ground' | 'groundBays' | 'doorIndex' | 'doorBay' | 'columns' | 'readable'>): GroundKind | U {
  if (!a.readable || a.ground === UNKNOWN) return UNKNOWN;
  if (a.ground === 'shopfront') return 'shop';
  if (a.ground === 'warehouse') return 'warehouse';
  const hasDoor = a.doorBay !== 'none' && a.doorIndex !== null;
  const groundOpenings = a.groundBays ?? a.columns?.[0];
  return hasDoor && groundOpenings === 1 && (a.doorIndex === undefined || a.doorIndex === 0) ? 'door-only' : 'dwelling';
}

/** The answer key a spec path's `low` flag is read from: prompt v4 names the storey parts, not `storeys`. */
const READ_KEYS: Record<string, string> = { readBalconies: 'balconies', readDormers: 'dormers', readBayWindow: 'bayWindow', readDoorSurround: 'doorSurround' };
const lowKeys = (key: string): string[] => (key in READ_KEYS ? [READ_KEYS[key]] : key === 'storeys' ? ['storeys', 'storeyParts', 'storeyParts.full'] : key === 'souterrain' ? ['souterrain', 'storeyParts', 'storeyParts.souterrain']
  : key === 'windowHead' || key === 'archedStoreys' ? [key, 'heads'] : [key]);

/** An answer as a partial HouseSpec at source `vision-judge`. Stone, pitched-eaves and pointed/mixed heads are stored as read (spec.ts
 *  SPEC_*; compilers draw the nearest form and report it); schemaLimits holds only the reader's own gaps. */
export function toSpecPart(a: DescriberAnswer, at: string | null = null, confidence = 0.7): HouseSpec {
  const spec = emptySpec(a.pandId);
  if (!a.readable) return spec;
  const set = (p: string, v: unknown) => {
    if (v === undefined || v === UNKNOWN) return;
    setSpecField(spec, p, v);
    spec.provenance[p] = { source: 'vision-judge', confidence: lowKeys(p.split('/').pop()!).some(k => a.low?.includes(k)) ? confidence / 2 : confidence, ref: a.image.ref, at };
  };
  set('fronts/0/storeys', a.storeys);
  if (a.bays !== 0) set('fronts/0/bays', a.bays);
  if (a.windows !== TALL_UPPER) set('fronts/0/windows', a.windows);
  if (a.storeyWindows && Object.keys(a.storeyWindows).length) set('fronts/0/storeyWindows', a.storeyWindows);
  const head = upperHead(a.heads);
  if (head !== UNKNOWN) set('fronts/0/windowHead', { kind: head });
  if (a.bands !== 'none') set('fronts/0/bands', a.bands);
  if (a.sills === 'consoles') set('fronts/0/windowSills', 'consoles');
  set('fronts/0/windowSurround', a.windowSurround === 'none' && a.sills === 'stone' ? 'sill' : a.windowSurround);
  if (a.doorIndex !== undefined) set('fronts/0/doorBay', a.doorIndex);
  set('fronts/0/basement', a.basement);
  // the souterrain flag as read: true, or false when the v4 storey parts answered it (a stated no, so no step adds a row below the ground)
  if (a.souterrain || a.storeyParts?.souterrain === true) set('fronts/0/souterrain', true);
  else if (a.storeyParts?.souterrain === false) set('fronts/0/souterrain', false);
  if (a.crown === 'mansard') { set('fronts/0/gable', 'cornice'); set('fronts/0/roofFront', 'mansard'); }
  else set('fronts/0/gable', a.crown as SpecGable | U);
  set('fronts/0/cornice', a.cornice);
  set('palette/wallMaterial', a.finish);
  set('facts/wallFamily', a.wallFamily);
  set('facts/pui', a.ground === 'shopfront' ? 'shop' : a.ground === 'dwelling' ? 'residential' : a.ground);
  if (Number.isInteger(a.storeys)) set('facts/groundKind', groundKindOf(a));
  // prompt v4.3 reads, held for every route (spec.ts SPEC_HELD_READS) until scored
  if (a.balconies !== undefined) set('fronts/0/readBalconies', a.balconies);
  if (a.dormers !== undefined) set('fronts/0/readDormers', a.dormers);
  if (a.bayWindow !== undefined) set('fronts/0/readBayWindow', a.bayWindow);
  if (a.doorSurround !== undefined) set('fronts/0/readDoorSurround', a.doorSurround);
  const limits = [...a.gaps];
  if (limits.length) spec.schemaLimits = limits;
  return spec;
}

/** A twin-pass answer (prompt v2 `sameAs`/`mirrored` only, read from a row image: the front in the middle with its neighbours). */
export interface TwinAnswer {
  v: 1; pandId: string; image: DescriberAnswer['image']; reader: string; readable: boolean;
  sameAs: (typeof SAME_AS)[number] | U; mirrored: boolean | U; notes?: string;
}
export function twinProblems(a: any): string[] {
  const p: string[] = [];
  if (!a || typeof a !== 'object') return ['an answer is an object'];
  if (a.v !== 1 || !/^\d{16}$/.test(a.pandId ?? '') || typeof a.reader !== 'string' || !a.image?.ref) p.push('v 1, pandId, reader, image.ref');
  if (typeof a.readable !== 'boolean') p.push('readable: boolean');
  if (!isIn(SAME_AS, a.sameAs)) p.push(`sameAs: ${SAME_AS.join('|')}|${UNKNOWN}`);
  if (!(typeof a.mirrored === 'boolean' || a.mirrored === UNKNOWN)) p.push(`mirrored: boolean or ${UNKNOWN} (false when sameAs is none)`);
  return p;
}
