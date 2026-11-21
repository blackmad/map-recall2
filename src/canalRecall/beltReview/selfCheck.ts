/**
 * Belt review self-check (2026-11-21, after David marked every Herengracht 2-90 house "wrong" for misses Claude should have
 * caught, e.g. Herengracht 66: the read said 4 storeys, an attic frieze, white frames and a tall dwelling ground, and the
 * drawing had none of them). One vision call per house sees the picked crop, the current drawing and the photo read, and
 * lists concrete differences, each classed:
 *
 *   - `wiring`: the read states X and the drawing does not show X (a render/wiring bug: fix the code);
 *   - `read`:   the read itself is wrong against the photo (correct photo-read.json with a note);
 *   - `kit`:    the read is right but the kit has no way to say it (a kit gap).
 *
 * It also measures the photo's storey profile (each storey's height as a fraction of the wall, ground up) and the ground
 * windows against the upper ones, so storey heights come from the crops, not a guess.
 *
 * Pure: the prompt and the answer's validation. scripts/belt-review/self-check.ts renders, calls and stores.
 */

export const SELF_CHECK_CLASSES = ['wiring', 'read', 'kit'] as const;
export type SelfCheckClass = (typeof SELF_CHECK_CLASSES)[number];
export const SELF_CHECK_SEVERITIES = ['major', 'minor'] as const;
/** The fields a difference is filed under (the read's names, plus a few the read has no field for). */
export const SELF_CHECK_FIELDS = [
  'storeys', 'bays', 'crown', 'cornice', 'roofStorey', 'dormers', 'roofMaterial', 'heads', 'windows', 'windowSurround', 'wallFinish',
  'wallColour', 'whiteFrames', 'whiteHeads', 'stringCourses', 'speklagen', 'ground', 'groundHeight', 'groundWindows', 'door', 'stoop', 'basement',
  'storeyHeights', 'width', 'houses', 'ornaments', 'other',
] as const;
export type SelfCheckField = (typeof SELF_CHECK_FIELDS)[number];

export interface SelfCheckDiff { class: SelfCheckClass; field: SelfCheckField; expected: string; seen: string; severity: 'major' | 'minor' }
export interface StoreyProfile {
  /** Each full storey's height as a fraction of ground-to-cornice, ground first (sums to about 1). */
  fractions: number[];
  /** Ground-storey window height over a typical upper (first upper) window height; null when the ground has no windows. */
  groundWindowRatio: number | null;
  /** Street door height (incl. fanlight) over the ground storey's height; null when no door shows. */
  doorRatio: number | null;
  /** A gable's (or raised crown's) top over the main cornice / eaves line, as a share of the ground-to-cornice height;
   *  null for a cornice or flat front. */
  crownRiseRatio?: number | null;
  /** A basement / souterrain band under the raised ground floor (pavement-level windows, a sunken entrance): its height as
   *  a share of the ground storey (which runs from the pavement to the first floor); null when there is none. */
  basementRatio?: number | null;
}
export interface SelfCheckAnswer { photo: StoreyProfile; drawing: StoreyProfile; differences: SelfCheckDiff[]; good: boolean }

export function selfCheckPrompt(address: string, read: unknown): string {
  return `You check a procedural drawing of ONE Amsterdam canal house front (${address}) against its photo, before a human reviewer sees it.
Image 1 is the PHOTO (rectified street photo cut to the house; ignore trees, cars, boats, people and neighbour slivers at the edges).
Image 2 is the DRAWING (flat-lit, simplified on purpose; materials and texture detail do not matter).
Below is the READ: what an earlier look at the photo says the house is, in the kit's vocabulary. The drawing is built from the READ.

READ:
${JSON.stringify(read)}

Task 1: measure both images. For each, give the full storeys' heights as fractions of the wall from the ground to the main cornice
(ground storey first; the attic/roof storey above the cornice is not a storey here), the ground-storey window height over a
first-upper window height, the street door's height (with its fanlight) over the ground storey's height, and for a gable
front the gable's top above the eaves line (where the gable's shoulders start) as a fraction of the ground-to-eaves height
("crownRiseRatio", null on a cornice or flat front), and a basement band's height (pavement to the raised ground floor, with
its pavement-level windows or sunken entrance) as a fraction of the ground storey ("basementRatio", null when none). The
ground storey always runs from the pavement to the first floor, a basement band included. On a gable front the
"fractions" run from the ground to the eaves line.

Task 2: list every concrete, visible difference between PHOTO and DRAWING that a person who knows the street would notice.
Do not list rendering style, texture, lighting, or things hidden in the photo. Class each one:
- "wiring": the READ states it correctly but the DRAWING does not show it (e.g. READ storeys 4, drawing shows 3; READ whiteFrames
  true, drawing frames are dark; READ cornice attic-frieze, drawing has no frieze row);
- "read": the READ itself is wrong against the PHOTO (say what the READ field should be in "expected");
- "kit": the READ is right or has no field for it, and the drawing cannot show it (a missing part or shape in the kit).
field: one of ${SELF_CHECK_FIELDS.map(f => `"${f}"`).join(' | ')}. Use "groundHeight" for the ground storey's height,
"groundWindows" for the ground windows' size or shape, "storeyHeights" for the upper storeys' proportions, "basement" for a basement / souterrain band under the ground storey (windows at pavement level, a sunken entrance),
"houses" when the photo
shows a different number of houses than the drawing.
expected: what the photo shows (under 15 words). seen: what the drawing shows instead (under 15 words).
severity: "major" if it changes recognition (storeys, roof/crown, colour family, white frames, ground height/use, bays), else "minor".

Task 3: "good": would a strict reviewer who knows the street accept this drawing? He rejects it for ANY of: a wrong storey
count or storey profile (e.g. equal storeys where the photo has a tall ground storey and a low top storey), a squat ground
floor or small ground windows/door, the wrong window-frame colour, the wrong window-head shape, a missing basement band or
attic storey, two houses drawn as one (or one as two), a thin cornice where the photo has a deep one, the wrong roof/crown
form or the wrong colour family. Be strict: true only if none of these apply.

Reply with JSON only:
{"photo":{"fractions":[0.3,0.25,0.24,0.21],"groundWindowRatio":1.2,"doorRatio":0.8,"crownRiseRatio":null,"basementRatio":0.3},
 "drawing":{"fractions":[0.25,0.25,0.25,0.25],"groundWindowRatio":0.6,"doorRatio":0.6,"crownRiseRatio":null,"basementRatio":null},
 "differences":[{"class":"wiring","field":"storeys","expected":"4 storeys","seen":"3 storeys","severity":"major"}],"good":false}`;
}

const isIn = (xs: readonly string[], v: unknown) => typeof v === 'string' && xs.includes(v);
const profileOk = (p: Partial<StoreyProfile> | undefined) => !!p && Array.isArray(p.fractions) && p.fractions.length >= 1 && p.fractions.every(f => typeof f === 'number' && f > 0 && f < 1)
  && (p.groundWindowRatio === null || typeof p.groundWindowRatio === 'number') && (p.doorRatio === null || typeof p.doorRatio === 'number');

export function selfCheckProblems(a: Partial<SelfCheckAnswer>): string[] {
  const p: string[] = [];
  if (!profileOk(a.photo)) p.push('photo');
  if (!profileOk(a.drawing)) p.push('drawing');
  if (typeof a.good !== 'boolean') p.push('good');
  if (!Array.isArray(a.differences)) p.push('differences');
  else a.differences.forEach((d, i) => {
    if (!isIn(SELF_CHECK_CLASSES, d?.class) || !isIn(SELF_CHECK_SEVERITIES, d?.severity) || typeof d?.expected !== 'string' || typeof d?.seen !== 'string') p.push(`differences[${i}]`);
  });
  return p;
}

/** A difference's field, folded onto the list (an unknown name is `other`). */
export const fieldOf = (f: unknown): SelfCheckField => (isIn(SELF_CHECK_FIELDS, f) ? f as SelfCheckField : 'other');

/** Counts per class and field (`class:field` -> n), majors separately. */
export function tally(diffs: Iterable<SelfCheckDiff>): { byClass: Record<string, number>; byField: Record<string, number>; major: Record<string, number> } {
  const byClass: Record<string, number> = {}, byField: Record<string, number> = {}, major: Record<string, number> = {};
  for (const d of diffs) {
    byClass[d.class] = (byClass[d.class] ?? 0) + 1;
    const k = `${d.class}:${d.field}`;
    byField[k] = (byField[k] ?? 0) + 1;
    if (d.severity === 'major') major[d.class] = (major[d.class] ?? 0) + 1;
  }
  return { byClass, byField, major };
}

/**
 * A run's photo measures onto a read answer (mutated): the storey shares when they count the read storeys, the ground
 * window and door ratios when measured, a gable's rise in metres over the survey eaves when the read crown is a gable.
 * Returns the fields written.
 */
export function applyMeasures(a: Record<string, unknown>, ph: Partial<StoreyProfile>, eavesM: number): string[] {
  const out: string[] = [];
  const f = ph.fractions;
  if (Array.isArray(f) && f.length === a.storeys && f.every(x => x > 0 && x < 1)) {
    const sum = f.reduce((s, x) => s + x, 0);
    a.storeyShares = f.map(x => +(x / sum).toFixed(3)); out.push('storeyShares');
  }
  if (typeof ph.groundWindowRatio === 'number' && ph.groundWindowRatio > 0.3 && ph.groundWindowRatio < 3) { a.groundWindowRatio = ph.groundWindowRatio; out.push('groundWindowRatio'); }
  if (typeof ph.doorRatio === 'number' && ph.doorRatio > 0.4 && ph.doorRatio <= 1) { a.doorRatio = ph.doorRatio; out.push('doorRatio'); }
  if (typeof ph.basementRatio === 'number' && ph.basementRatio >= 0.12 && ph.basementRatio <= 0.5) { a.basementRatio = ph.basementRatio; out.push('basementRatio'); }
  const gable = ['spout', 'neck', 'raised-neck', 'bell', 'step', 'point'].includes(String(a.crown));
  if (gable && typeof ph.crownRiseRatio === 'number' && ph.crownRiseRatio > 0.05 && ph.crownRiseRatio < 1 && eavesM > 4) { a.crownRiseM = +(ph.crownRiseRatio * eavesM).toFixed(2); out.push('crownRiseM'); }
  return out;
}
