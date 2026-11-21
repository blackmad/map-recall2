/**
 * Belt review lane C, the per-house photo read (2026-11-21, after David on stage 2's 17 dropdowns per house: "this is going
 * to be impossible for a human"): one vision call per house reads every description field off David's picked crop, each
 * answer constrained to the kit's enum values, plus what the kit cannot say. The fields enter the description at source
 * `photo-read` (description.ts: above own-read, below reviewed and face-intent); David's edits stay on top (edits.json).
 *
 * Pure: the prompt, the answer's validation, and the answer -> description candidates. scripts/belt-review/read-house.ts
 * crops, calls and stores; scripts/belt-review/likeness.ts scores render against photo.
 */
import { BALCONY_STYLES, BASEMENTS, DORMER_STYLES, GABLES, ROOF_MATERIALS, WINDOWS, WINDOW_HEADS, WALL_MATERIALS } from '../buildingRecipe/intent.ts';
import { STOOP_FLIGHTS } from '../buildingRecipe/stoop.ts';
import { SPEC_CORNICES, SPEC_WINDOW_SURROUNDS } from '../houseSpec/spec.ts';
import type { DescField, FieldCandidate } from './description.ts';

export const WALL_FAMILIES = ['white', 'grey', 'buff', 'orange', 'red', 'red-brown', 'brown', 'dark'] as const;
/** The enums each read field may take (kit values; the extra spec-level values the page also offers). */
export const READ_ENUMS = {
  crown: [...GABLES, 'pitched-eaves'],
  cornice: SPEC_CORNICES,
  roofStorey: ['none', 'mansard', 'attic', 'dormers', 'gable-attic'],
  dormerStyle: DORMER_STYLES,
  roofMaterial: [...ROOF_MATERIALS, 'not-visible'],
  heads: [...WINDOW_HEADS, 'pointed', 'mixed'],
  windows: WINDOWS,
  windowSurround: SPEC_WINDOW_SURROUNDS,
  wallFinish: [...WALL_MATERIALS, 'stone'],
  wallFamily: WALL_FAMILIES,
  whiteHeads: ['keystone', 'blocks', 'band', 'none'],
  speklagen: ['ground', 'all', 'none'],
  ground: ['dwelling', 'shop', 'door-only', 'warehouse'],
  stoop: BASEMENTS,
  stoopFlight: [...STOOP_FLIGHTS, 'none'],
  balconies: [...BALCONY_STYLES, 'none'],
} as const satisfies Record<string, readonly string[]>;

/** The answer one call returns (validated by readProblems). */
export interface HouseRead {
  readable: boolean;
  storeys: number;
  bays: number;
  crown: string;
  cornice: string;
  roofStorey: string;
  dormers: { count: number; style: string };
  roofMaterial: string;
  heads: string;
  windows: string;
  windowSurround: string;
  wallFinish: string;
  wallColour: { hex: string; family: string };
  whiteFrames: boolean;
  whiteHeads: string;
  stringCourses: boolean;
  speklagen: string;
  ground: string;
  door: { bay: number; surround: boolean } | null;
  stoop: string;
  stoopFlight: string;
  balconies: string;
  facadeYear: number | null;
  ornaments: string[];
  kitCannotSay: string[];
  low: string[];
  notes?: string;
}

const list = (xs: readonly string[]) => xs.map(x => `"${x}"`).join(' | ');

/** The read prompt: the house is the whole image (cut to its facade); answers from the kit's values only. */
export function houseReadPrompt(address: string): string {
  const E = READ_ENUMS;
  return `You are describing ONE Amsterdam canal-belt house front (${address}) from a rectified street photo, so that a
procedural kit can rebuild it. The image is cut to this house's facade width, ground at the bottom; slivers of the neighbours
may show at the very edges: ignore them. Trees, cars and boats may hide parts; say what you can see and put unsure fields in "low".

Answer every field with one of the listed values only (they are the kit's vocabulary). Where the kit's words do not fit what
you see, pick the nearest value AND say precisely what the kit cannot say in "kitCannotSay" (a short phrase each naming
the part and its shape, material or colour).

- storeys: full street storeys below the crown, the ground storey counted once; no souterrain, no attic or gable storey.
- bays: window axes of the upper storeys (the storey with the most).
- crown: what tops the front: ${list(E.crown)}. "cornice" = a straight cornice with the roof behind it; "pitched-eaves" = an
  eaves line with the roof slope itself in view (no gable); "flat" = a plain parapet with no cornice.
- cornice: the main cornice: ${list(E.cornice)}.
- roofStorey: what is lived in above the main cornice: ${list(E.roofStorey)}.
- dormers: {"count": roof windows on the roofline you can see (0 if none), "style": ${list(E.dormerStyle)}}.
- roofMaterial: the roof covering you can see: ${list(E.roofMaterial)}.
- heads: the upper windows' head shape: ${list(E.heads)}.
- windows: the upper windows' glazing: ${list(E.windows)}.
- windowSurround: the dressing round the upper windows: ${list(E.windowSurround)}.
- wallFinish: ${list(E.wallFinish)}.
- wallColour: {"hex": the wall's typical colour in sunlight-neutral terms, "#rrggbb", "family": ${list(E.wallFamily)}}.
- whiteFrames: true if the window frames are white or cream.
- whiteHeads: light dressing at the upper window heads: ${list(E.whiteHeads)}.
- stringCourses: true if light horizontal courses run across the front at sill or floor level.
- speklagen: horizontal stripes of light stone or brick in the brickwork: ${list(E.speklagen)}.
- ground: the ground storey: ${list(E.ground)}.
- door: the street door: {"bay": its 0-based index among the ground-storey openings (doors and windows) from the left,
  "surround": true if it has a dressed doorcase (pilasters, pediment, stone frame)}, or null if no street door shows.
- stoop: ${list(E.stoop)} ("windows" = souterrain windows below the ground storey; "stoop" = steps up to the door).
- stoopFlight: ${list(E.stoopFlight)}.
- balconies: ${list(E.balconies)}.
- facadeYear: your best estimate of when this FRONT was built or last refronted (style date), or null.
- ornaments: things on this front the fields above do not cover (reliefs, gable stones, carved tops, hoist beams, shop signs).
- kitCannotSay: see above; [] when the fields say it all.
- low: the field names you are unsure of.
- notes: one sentence, only if something important is not covered.

Reply with JSON only, no prose:
{"readable":true,"storeys":4,"bays":3,"crown":"neck","cornice":"none","roofStorey":"gable-attic","dormers":{"count":0,"style":"plain"},
"roofMaterial":"not-visible","heads":"flat","windows":"sash-small-panes","windowSurround":"none","wallFinish":"brick",
"wallColour":{"hex":"#7a4a3a","family":"red-brown"},"whiteFrames":true,"whiteHeads":"none","stringCourses":false,"speklagen":"none",
"ground":"dwelling","door":{"bay":0,"surround":false},"stoop":"stoop","stoopFlight":"front","balconies":"none","facadeYear":1730,
"ornaments":[],"kitCannotSay":[],"low":[]}
If the house cannot be seen at all, reply {"readable":false,"notes":"why"}.`;
}

const isIn = (xs: readonly string[], v: unknown) => typeof v === 'string' && xs.includes(v);
const int = (v: unknown, a: number, b: number) => Number.isInteger(v) && (v as number) >= a && (v as number) <= b;

/** What is wrong with an answer (empty = valid). A field outside its enum is a problem; the merge drops just that field. */
export function readProblems(a: Partial<HouseRead>): string[] {
  if (a.readable === false) return [];
  const p: string[] = [];
  if (!int(a.storeys, 1, 12)) p.push('storeys');
  if (!int(a.bays, 1, 15)) p.push('bays');
  for (const k of ['crown', 'cornice', 'roofStorey', 'roofMaterial', 'heads', 'windows', 'windowSurround', 'wallFinish', 'whiteHeads', 'speklagen', 'ground', 'stoop', 'stoopFlight', 'balconies'] as const)
    if (!isIn(READ_ENUMS[k], a[k])) p.push(k);
  if (!a.dormers || !int(a.dormers.count, 0, 9) || !isIn(READ_ENUMS.dormerStyle, a.dormers.style)) p.push('dormers');
  if (!a.wallColour || !/^#[0-9a-f]{6}$/i.test(a.wallColour.hex ?? '') || !isIn(READ_ENUMS.wallFamily, a.wallColour.family)) p.push('wallColour');
  if (typeof a.whiteFrames !== 'boolean') p.push('whiteFrames');
  if (a.door !== null && (!a.door || !int(a.door.bay, 0, 15))) p.push('door');
  if (a.facadeYear !== null && !int(a.facadeYear, 1400, 2030)) p.push('facadeYear');
  return p;
}

/** Answer field -> the description fields it feeds (for `low`). */
const LOW_TO_FIELD: Record<string, DescField> = {
  storeys: 'storeys', bays: 'bays', crown: 'crown', cornice: 'cornice', roofStorey: 'roofStorey', dormers: 'dormers', heads: 'heads',
  windows: 'windows', windowSurround: 'windowSurround', wallFinish: 'wallFinish', wallColour: 'wallColour', whiteFrames: 'whiteFrames',
  ground: 'ground', door: 'door', stoop: 'stoop', facadeYear: 'facadeYear',
};
export const PHOTO_READ_CONFIDENCE = 0.75;
export const PHOTO_READ_LOW_CONFIDENCE = 0.5;
/** A style-dated facade year is a guess: below the register's dated years, above nothing. */
export const PHOTO_READ_YEAR_CONFIDENCE = 0.35;

/**
 * The description candidates of a read (`photo-read`). Fields outside their enum are dropped (readProblems). Dormers keep the
 * page's two kinds (`gabled` for a pointed dormer, else `plain`); the read's own style stays in the extras.
 */
export function candidatesFromHouseRead(a: Partial<HouseRead>, ref: string): FieldCandidate[] {
  if (!a || a.readable === false) return [];
  const bad = new Set(readProblems(a)), low = new Set((a.low ?? []).map(k => LOW_TO_FIELD[k]).filter(Boolean));
  const out: FieldCandidate[] = [];
  const put = (field: DescField, key: string, value: unknown, conf = PHOTO_READ_CONFIDENCE) => {
    if (bad.has(key) || value === undefined) return;
    out.push({ field, value, source: 'photo-read', confidence: low.has(field) ? Math.min(conf, PHOTO_READ_LOW_CONFIDENCE) : conf, ref });
  };
  put('storeys', 'storeys', a.storeys);
  put('bays', 'bays', a.bays);
  put('crown', 'crown', a.crown);
  put('cornice', 'cornice', a.cornice);
  put('roofStorey', 'roofStorey', a.roofStorey);
  if (a.dormers) put('dormers', 'dormers', a.dormers.count === 0 ? { count: 0 } : { count: a.dormers.count, kind: a.dormers.style === 'pointed' ? 'gabled' : 'plain' });
  put('heads', 'heads', a.heads);
  put('windows', 'windows', a.windows);
  put('windowSurround', 'windowSurround', a.windowSurround);
  put('wallFinish', 'wallFinish', a.wallFinish);
  put('wallColour', 'wallColour', a.wallColour?.family);
  put('whiteFrames', 'whiteFrames', a.whiteFrames);
  put('ground', 'ground', a.ground);
  put('door', 'door', a.door === null ? null : a.door && { bay: a.door.bay, ...(a.door.surround ? { surround: true } : {}) });
  put('stoop', 'stoop', a.stoop);
  if (a.facadeYear !== null) put('facadeYear', 'facadeYear', a.facadeYear, PHOTO_READ_YEAR_CONFIDENCE);
  return out;
}

/** What a read says beyond the description fields: kept on the pand's description entry for the kit and lane A. */
export function readExtras(a: Partial<HouseRead>) {
  if (!a || a.readable === false) return null;
  return {
    wallHex: a.wallColour?.hex, dormerStyle: a.dormers?.style, roofMaterial: a.roofMaterial, whiteHeads: a.whiteHeads, stringCourses: a.stringCourses,
    speklagen: a.speklagen, stoopFlight: a.stoopFlight, balconies: a.balconies, ornaments: a.ornaments ?? [], kitCannotSay: a.kitCannotSay ?? [],
    ...(a.notes ? { notes: a.notes } : {}),
  };
}

// ------------------------------------------------------------------------------------------------------------ likeness

export const LIKENESS_TAGS = ['roof', 'storeys', 'windows', 'colour', 'ground', 'door', 'white', 'other'] as const;
export type LikenessTag = typeof LIKENESS_TAGS[number];
export interface LikenessAnswer { score: number; differences: Array<{ tag: LikenessTag; what: string }> }

export const LIKENESS_PROMPT = `Two images of the same Amsterdam canal house front. Image 1 is a street PHOTO (cut to the house; ignore trees,
cars, people and neighbour slivers at the edges). Image 2 is a procedural RENDER that is meant to look like it. The render is
flat-lit and simplified on purpose: judge whether a person who knows the street would recognise this house in it, not
rendering quality.

Score likeness from 0 to 1: 1 = unmistakably this house (storeys, roofline/gable, window pattern, wall colour, white
accents, ground floor and door all match); 0.7 = right type with one clear miss; 0.4 = the type is right but several things
are wrong; 0.1 = a different kind of building (wrong roof form, wrong height, wrong colour family).

List the 3 most important differences, most important first, each tagged with one of
"roof" | "storeys" | "windows" | "colour" | "ground" | "door" | "white" | "other" and said in under 15 words,
written as what the render should do ("needs a red-tile hipped roof, not a grey block").

Reply with JSON only: {"score":0.55,"differences":[{"tag":"roof","what":"..."},{"tag":"colour","what":"..."},{"tag":"white","what":"..."}]}`;

export function likenessProblems(a: Partial<LikenessAnswer>): string[] {
  const p: string[] = [];
  if (typeof a.score !== 'number' || a.score < 0 || a.score > 1) p.push('score');
  if (!Array.isArray(a.differences) || a.differences.some(d => !(LIKENESS_TAGS as readonly string[]).includes(d?.tag) || typeof d?.what !== 'string')) p.push('differences');
  return p;
}

/** Opus 5.5 list price, $ per token. */
export const PRICE = { input: 4 / 1e6, output: 20 / 1e6 };
export const costOf = (u: { input_tokens: number; output_tokens: number }) => +(u.input_tokens * PRICE.input + u.output_tokens * PRICE.output).toFixed(5);
