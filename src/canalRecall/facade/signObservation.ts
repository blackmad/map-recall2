/**
 * Sign observations: the schema the readers emit and the renderer consumes.
 *
 * A reader returns text *lines*, but a sign is a physical object that may carry
 * several lines — the first Apple Vision run on our crops returned
 * `NINA'S / Exclusieve / Handwork BoutiquR` as three lines of one fascia, and
 * returned the same fascia twice. So this module owns two pieces of logic that
 * are easy to get wrong and worth testing: mapping an image quad into wall
 * metres, and grouping lines into signs.
 *
 * Wall metres are the frame the whole project already uses: `along` is metres
 * from the wall plane's `start` end, `up` is metres above `plane.baseZ`.
 */

export type SignType = 'fascia' | 'blade' | 'window' | 'awning' | 'logo' | 'gevelsteen';
export type SignFontClass = 'serif' | 'sans' | 'script' | 'display' | 'unknown';

export interface WallRect {
  along: number;
  up: number;
  width: number;
  height: number;
}

/** A normalised image-space quad, y already top-down (0 at the top). */
export interface ImageQuad {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
}

export interface SignObservation {
  text: string;
  type: SignType;
  boxWallM: WallRect;
  quadWallM?: Array<readonly [number, number]>;
  fg?: string;
  bg?: string;
  textCase?: 'upper' | 'lower' | 'mixed';
  fontClass: SignFontClass;
  confidence: number;
  reader: string;
  captureDate?: string;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/**
 * Map a normalised image quad onto the wall plane. The crop is axis-aligned to
 * the wall (`start -> end` horizontally, `baseZ -> topZ` vertically), so this is
 * a straight scale; the quad is kept as a quad so a tilted sign is not squared
 * off.
 */
export function quadToWallMetres(quad: ImageQuad, wallWidthM: number, wallHeightM: number) {
  const corners = [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft] as const;
  const points = corners.map((corner) => [
    clamp01(corner.x) * wallWidthM,
    (1 - clamp01(corner.y)) * wallHeightM,
  ] as const);
  const alongs = points.map(([along]) => along);
  const ups = points.map(([, up]) => up);
  const minAlong = Math.min(...alongs);
  const minUp = Math.min(...ups);
  return {
    boxWallM: {
      along: minAlong,
      up: minUp,
      width: Math.max(...alongs) - minAlong,
      height: Math.max(...ups) - minUp,
    } as WallRect,
    quadWallM: points,
  };
}

/** True when two wall rects share at least `fraction` of the narrower one's width. */
export function horizontalOverlapFraction(a: WallRect, b: WallRect): number {
  const left = Math.max(a.along, b.along);
  const right = Math.min(a.along + a.width, b.along + b.width);
  const overlap = right - left;
  const narrower = Math.min(a.width, b.width);
  return narrower > 0 && overlap > 0 ? overlap / narrower : 0;
}

export interface MergeLineOptions {
  /** Lines stacked closer than this are one sign. */
  maximumGapM?: number;
  /** …provided they overlap horizontally by at least this fraction. */
  minimumOverlap?: number;
  /** Collapse one business name read on more than one pane of the same frontage. */
  dedupeRepeatedSigns?: boolean;
  /** Repeated instances further apart than this along the wall are separate signs. */
  maximumRepeatGapM?: number;
}

/** Punctuation-free key for deciding whether two readings are the same sign. */
const signIdentityKey = (text: string | null): string | null =>
  text === null ? null : (text.replace(/[^A-Z0-9]/g, '') || null);

/** Same name, allowing the shorter reading to be a truncation of the longer. */
const sameSignIdentity = (a: string, b: string): boolean => {
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length >= 4 && longer.startsWith(shorter);
};

/**
 * Group a reader's text lines into signs. Lines are attached to a sign when they
 * overlap horizontally and sit within `maximumGapM` of it vertically, so a
 * stacked fascia collapses to one sign while a separate blade sign does not.
 * Returned in reading order (top to bottom, then left to right).
 *
 * A shop can letter the same fascia on several panes, and a reader returns each
 * instance: the De Clercqstraat 70 crop yields `NINA'S / Exclusieve / Handwork
 * Boutique` twice, once per window. Those are one business, so after stacking,
 * groups whose main line is the same name and which sit close together collapse
 * to the most complete reading. Counting them separately would both double the
 * sign and inflate any invention rate computed per sign.
 */
export function mergeLinesIntoSigns<T extends { boxWallM: WallRect; text: string }>(
  lines: readonly T[],
  options: MergeLineOptions = {},
): Array<{ boxWallM: WallRect; lines: T[] }> {
  const maximumGapM = options.maximumGapM ?? 0.5;
  const minimumOverlap = options.minimumOverlap ?? 0.5;
  const ordered = [...lines].sort((a, b) => (b.boxWallM.up + b.boxWallM.height) - (a.boxWallM.up + a.boxWallM.height)
    || a.boxWallM.along - b.boxWallM.along);

  const groups: Array<{ boxWallM: WallRect; lines: T[] }> = [];
  for (const line of ordered) {
    const group = groups.find((candidate) => {
      const gap = Math.max(candidate.boxWallM.up, line.boxWallM.up)
        - Math.min(candidate.boxWallM.up + candidate.boxWallM.height, line.boxWallM.up + line.boxWallM.height);
      return gap <= maximumGapM && horizontalOverlapFraction(candidate.boxWallM, line.boxWallM) >= minimumOverlap;
    });
    if (!group) {
      groups.push({ boxWallM: { ...line.boxWallM }, lines: [line] });
      continue;
    }
    group.lines.push(line);
    const left = Math.min(group.boxWallM.along, line.boxWallM.along);
    const bottom = Math.min(group.boxWallM.up, line.boxWallM.up);
    const right = Math.max(group.boxWallM.along + group.boxWallM.width, line.boxWallM.along + line.boxWallM.width);
    const top = Math.max(group.boxWallM.up + group.boxWallM.height, line.boxWallM.up + line.boxWallM.height);
    group.boxWallM = { along: left, up: bottom, width: right - left, height: top - bottom };
  }
  if (options.dedupeRepeatedSigns === false) return groups;

  const maximumRepeatGapM = options.maximumRepeatGapM ?? 3;
  const kept: typeof groups = [];
  for (const group of groups) {
    const key = signIdentityKey(mainSignLine(group.lines));
    const existingIndex = key
      ? kept.findIndex((candidate) => {
        const other = signIdentityKey(mainSignLine(candidate.lines));
        if (other === null || !sameSignIdentity(key, other)) return false;
        const alongGap = Math.max(candidate.boxWallM.along, group.boxWallM.along)
          - Math.min(candidate.boxWallM.along + candidate.boxWallM.width, group.boxWallM.along + group.boxWallM.width);
        const upGap = Math.max(candidate.boxWallM.up, group.boxWallM.up)
          - Math.min(candidate.boxWallM.up + candidate.boxWallM.height, group.boxWallM.up + group.boxWallM.height);
        return alongGap <= maximumRepeatGapM && upGap <= maximumGapM;
      })
      : -1;
    if (existingIndex < 0) { kept.push(group); continue; }
    const existing = kept[existingIndex];
    const existingKey = signIdentityKey(mainSignLine(existing.lines));
    if (key !== null && (existingKey === null || key.length > existingKey.length)) kept[existingIndex] = group;
  }
  return kept;
}

/**
 * Normalise sign text for comparison only. Case, whitespace, punctuation and
 * surrounding quotes are removed; diacritics are kept, because "IJscuypje" and
 * "Ijs cuypje" are not the same word to a reader but "IJSCUYPJE" and "ijscuypje"
 * are. The readers run Dutch **and** English, so a correct English reading of an
 * English sign must compare equal — this function must never translate.
 */
export function normaliseSignText(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”]/g, '"')
    .toUpperCase()
    .replace(/[^A-Z0-9À-ÖØ-ÞÀ-ÿ' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A sign's most prominent line: the longest, which is the name on a fascia. */
export function mainSignLine(lines: readonly { text: string }[]): string | null {
  let best: string | null = null;
  for (const line of lines) {
    const normalised = normaliseSignText(line.text);
    if (!normalised) continue;
    if (best === null || normalised.length > best.length) best = normalised;
  }
  return best;
}
