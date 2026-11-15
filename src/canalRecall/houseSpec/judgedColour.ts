/**
 * Judged wall colour (lane d1-colour-judged, 2026-11-14; docs/house-line.md §16). The user's ruling on the D1 hold: "stop
 * worrying so much about exact color matches - use your understanding of color from nearby buildings and your innate
 * knowledge of bricks". The D1 shapes were fine; the measured palette brick (wall sample v1/v2) turned pale, painted,
 * buff and red fronts near-black because the panorama captures are underexposed by a varying amount (§15: a per-capture
 * variance floor of about |dL| 0.115). So the wall colour is now a judged FAMILY with a representative tone, not a
 * calibrated sample.
 *
 * The palette (`JUDGED_PALETTE`) is eleven facade families that cover Amsterdam's canal belt and 19th/20th-century ring,
 * each with an OKLab tone chosen to draw well through the game's wall chain (decorate.ts specWallColour: specWallSource,
 * specWallDisplay's lift, the pale-warm guard): every family's varied tones draw (never held, never swapped for the
 * family tone; judgedColour.test.ts runs the real chain).
 *
 * The decision per front (`judgeFront`, then `judgeRow` over a street row in order):
 *  1. words   the D1 reader's own phrase about the described front ("black-painted front", "white stucco front",
 *             "yellow brick", "red brick front"); a word about a neighbour, a side wall or the light is not taken.
 *  2. finish  the reader's finish and its pale flag: stucco / stone / painted-brick pale are pale families (the sample may
 *             pick cream vs grey vs white, never dark); painted-brick not pale is dark paint; brick pale is buff.
 *  3. sample  only for brick and dark paint, and only as a hint of the family: the sample's OKLab L relative to the
 *             row's median sample (one street, similar exposure) steps red-brown to purple-brown (darker) or orange-red
 *             (lighter and red), or buff (much lighter and yellow); its warmth tells dark paint from dark brown paint.
 *             A dark sample never overrides a pale or painted-pale reading, and its absolute value is never drawn.
 *  4. era     the build year sets the default when nothing else speaks (red-brown brick before 1860, the canal belt;
 *             mid grey-brown brick from 1860, the 19th-century ring, as its photos show) and how easily a lighter, red
 *             sample steps to orange-red (1905 onwards: Amsterdam School and the late ring).
 *  5. neighbours (judgeRow) a front with no reading (finish not visible, unreadable) takes its row's brick family; a
 *             front made dark only by its sample, with pale-family fronts on both sides, is a lone dark outlier (shade, a
 *             tree, a doorway) and takes the row's brick family instead.
 * Each house then gets a small deterministic variation inside its family (`variedTone`, a hash of the pand id), so a
 * row is not one flat tint. The choice is recorded as `facts.wallJudged` (source `judged`, the deciding signal, the
 * hint values) and drawn through `palette/brick` + `facts.wallFamily`.
 *
 * Pure: no DOM, no fs.
 */
import { describerDarkPhrase } from './darkFinish.ts';
import { hexToOklab, oklabToHex, type WallFamily } from './wallColour.ts';
import type { HouseSpec, SpecFacts } from './spec.ts';

export const JUDGED_FAMILIES = [
  'red-brown-brick', 'brown-brick', 'purple-brown-brick', 'orange-red-brick', 'buff-brick',
  'painted-white', 'cream-render', 'pale-grey-stucco', 'grey-stone', 'painted-dark', 'sandstone',
  'dark-grey-brick',
] as const;
export type JudgedFamily = (typeof JUDGED_FAMILIES)[number];

/** One family: its OKLab tone (L, C, hue degrees), the variation range, the reader family the wall rule checks it
 *  against (facts.wallFamily), and whether it is a pale family (a dark sample never moves a pale family). */
export type JudgedTone = { L: number; C: number; h: number; dL: number; dC: number; dh: number; maxL: number; wallFamily: WallFamily; pale: boolean; label: string };
/**
 * The tones. Brick tones sit at or under the wall rule's family tone (wallColour.ts FAMILY_TONE) so the trim-misread rule
 * never swaps them, and the orange-red ceiling (`maxL` 0.485) keeps the lifted tone under the pale-warm guard (drawn
 * OKLab L 0.6). Pale tones keep hue under 85 degrees so the display keeps their warmth (specWallDisplay's warm band).
 */
export const JUDGED_PALETTE: Record<JudgedFamily, JudgedTone> = {
  'red-brown-brick':    { L: 0.45, C: 0.075, h: 36, dL: 0.025, dC: 0.012, dh: 4, maxL: 0.48, wallFamily: 'red-brown', pale: false, label: 'red-brown brick' },
  'brown-brick':        { L: 0.47, C: 0.038, h: 50, dL: 0.02, dC: 0.008, dh: 5, maxL: 0.49, wallFamily: 'brown', pale: false, label: 'mid (grey-)brown brick' },
  'purple-brown-brick': { L: 0.385, C: 0.045, h: 28, dL: 0.02, dC: 0.008, dh: 5, maxL: 0.43, wallFamily: 'brown', pale: false, label: 'dark purple-brown brick' },
  'orange-red-brick':   { L: 0.47, C: 0.105, h: 42, dL: 0.015, dC: 0.012, dh: 3, maxL: 0.485, wallFamily: 'orange', pale: false, label: 'orange-red brick' },
  'buff-brick':         { L: 0.70, C: 0.07, h: 78, dL: 0.025, dC: 0.01, dh: 4, maxL: 0.75, wallFamily: 'buff', pale: true, label: 'yellow / buff brick' },
  'painted-white':      { L: 0.905, C: 0.01, h: 90, dL: 0.012, dC: 0.004, dh: 6, maxL: 0.92, wallFamily: 'white', pale: true, label: 'painted white' },
  'cream-render':       { L: 0.875, C: 0.045, h: 80, dL: 0.015, dC: 0.008, dh: 3, maxL: 0.93, wallFamily: 'white', pale: true, label: 'cream / ivory render' },
  'pale-grey-stucco':   { L: 0.82, C: 0.008, h: 95, dL: 0.02, dC: 0.003, dh: 8, maxL: 0.9, wallFamily: 'white', pale: true, label: 'pale grey stucco' },
  'grey-stone':         { L: 0.63, C: 0.012, h: 85, dL: 0.02, dC: 0.004, dh: 6, maxL: 0.68, wallFamily: 'grey', pale: true, label: 'mid grey stone' },
  'painted-dark':       { L: 0.30, C: 0.012, h: 150, dL: 0.015, dC: 0.004, dh: 25, maxL: 0.33, wallFamily: 'dark', pale: false, label: 'painted black / dark green-black' },
  'sandstone':          { L: 0.76, C: 0.055, h: 76, dL: 0.02, dC: 0.008, dh: 3, maxL: 0.8, wallFamily: 'buff', pale: true, label: 'sandstone' },
  // Herengracht's old canal brick under overcast cuts: dark and nearly grey (55 L .41 C .004, 63 L .40 C .017, 65 L .37
  // C .015), where purple-brown (C .045) drew maroon (round 4, lane D bins by chroma). Appended: unused, nothing changes.
  'dark-grey-brick':    { L: 0.40, C: 0.010, h: 40, dL: 0.02, dC: 0.004, dh: 8, maxL: 0.44, wallFamily: 'brown', pale: false, label: 'dark, nearly grey canal brick' },
};

/** The decision's knobs (see the header). */
export const JUDGED = {
  /** sample L under the row median by more than this: one step darker (red-brown -> purple-brown) */
  darkerRel: -0.07,
  /** sample L over the row median by more than this, hue under `redHue`: orange-red (before 1905 / from 1905) */
  lighterRel: 0.09, lighterRelLate: 0.04, lateYear: 1905, redHue: 58,
  /** from this build year a brick front with no other reading defaults to mid brown brick (the 19th-century ring) */
  ringYear: 1860,
  /** buff: much lighter than the row and yellow */
  buffRel: 0.12, buffHue: 68, buffMinC: 0.02,
  /** a warm sample (dark paint that is a brown/oxblood, not black; a cream render vs a grey one) */
  warmMinC: 0.02, warmHue: [20, 100] as const,
  /** a neutral pale stucco reads white rather than grey when this much lighter than its row */
  whiteRel: 0.05,
  /** painted brick that is not pale reads dark brown paint (not black) when its sample is this warm and not darker than its row */
  paintBrownMinC: 0.028,
  /** the neighbour rules look this many fronts either side for the row's brick family */
  rowWindow: 5,
} as const;

export type JudgedSignal = 'words' | 'finish' | 'sample' | 'era' | 'neighbours';
/** What one front offers. `sample` is a hint hex (the pinned or exposure-normalised wall sample), never drawn. */
export type JudgedInput = {
  pandId: string;
  readable?: boolean;
  finish?: string | null;
  pale?: boolean | null;
  notes?: string | null;
  year?: number | null;
  sample?: string | null;
  /** The sample is a measured wall colour from the reader's own cut (the canal belt rows, which have no row of face
   *  samples to stand against): a brick front takes the family nearest its sample's lightness, not the era default. */
  absolute?: boolean;
};
export type Judgement = {
  pandId: string;
  family: JudgedFamily;
  by: JudgedSignal;
  why: string;
  words?: string;
  /** the sample's OKLab L minus the row median, when both exist */
  rel?: number;
};
/** The receipt (`facts.wallJudged`). */
export type WallJudgedFact = {
  v: 1;
  source: 'judged';
  family: JudgedFamily;
  hex: string;
  by: JudgedSignal;
  why: string;
  words?: string;
  sample?: string;
  rel?: number;
  year?: number;
  ruling: string;
};
export const JUDGED_RULING = 'user 2026-11-14: judge colour from neighbours and brick knowledge, not exact samples';

export function isWallJudgedFact(v: unknown): v is WallJudgedFact {
  const o = v as WallJudgedFact | null;
  return !!o && typeof o === 'object' && o.v === 1 && o.source === 'judged' && (JUDGED_FAMILIES as readonly string[]).includes(o.family)
    && /^#[0-9a-f]{6}$/i.test(o.hex) && typeof o.by === 'string' && typeof o.why === 'string';
}

// --- the reader's words about the described front --------------------------------------------------------------------
const NOUN = String.raw`(?:front|house|wall|facade|façade|gable|neck-gable|step-gable|double front|corner front|corner house|corner building|building|block|warehouse|brick|stucco|render|plaster|paint)`;
const COLOUR = String.raw`(white|cream|ivory|off-white|yellow|buff|ochre|sand|sandstone|beige|grey|gray|red|orange|pink|salmon|brown|purple)`;
const COLOUR_FRONT = new RegExp(String.raw`\b${COLOUR}(?:[- ](?:painted|plastered|rendered|stuccoed|brick|stone|glazed))?((?:\s+[\w-]+){0,3}?)\s+${NOUN}\b`, 'gi');
const OTHER = /neighbou?r|side wall|beyond|across|next door|beside|behind|left|right|adjoining/;
/** Trim words: "white cornice", "white frames" are not the wall. */
const TRIM = /cornice|frame|band|sill|trim|window|door|dormer|top|frieze|balustrade|bay|oriel|surround|lintel|pilaster|pediment|shop/;
/** The colour word the reader used for the described front, or null (darkFinish.ts handles dark/black). */
export function describerColourWord(a: { readable?: boolean; notes?: string | null } | null | undefined): string | null {
  if (!a || a.readable === false) return null;
  const t = String(a.notes ?? '');
  for (const m of t.matchAll(COLOUR_FRONT)) {
    const at = m.index ?? 0, pre = t.slice(Math.max(0, at - 24), at).toLowerCase(), mid = m[2].toLowerCase(), whole = m[0].toLowerCase();
    if (TRIM.test(mid) || OTHER.test(mid)) continue;
    if (OTHER.test(pre.slice(-16)) && !/\bthis\b|described/.test(pre)) continue;
    if (/neighbou?r|side/.test(whole)) continue;
    const post = t.slice(at + m[0].length, at + m[0].length + 24).toLowerCase();
    if (/^\s*(?:\w+\s+){0,2}(?:beside|next to|of the neighbou?r|to the (?:left|right))/.test(post) && !/\bthis\b|described/.test(pre)) continue;
    return m[0];
  }
  return null;
}
/** The family a colour word names, given the finish (a "red" stucco is not a brick). */
function familyOfWord(word: string, finish: string): JudgedFamily | null {
  const w = word.toLowerCase();
  if (/sandstone|\bsand\b/.test(w)) return 'sandstone';
  if (/cream|ivory|beige|ochre/.test(w)) return 'cream-render';
  if (/white/.test(w)) return finish === 'brick' && !/painted|plaster|stucco|render/.test(w) ? null : 'painted-white';
  if (/yellow|buff/.test(w)) return finish === 'stucco' ? 'cream-render' : 'buff-brick';
  if (/gr[ae]y/.test(w)) return finish === 'stone' ? 'grey-stone' : 'pale-grey-stucco';
  if (/orange|salmon|pink/.test(w)) return finish === 'brick' || finish === 'painted-brick' ? 'orange-red-brick' : null;
  if (/\bred\b|red[- ]/.test(w)) return finish === 'brick' || finish === 'painted-brick' ? 'red-brown-brick' : null;
  if (/brown|purple/.test(w)) return finish === 'brick' || finish === 'painted-brick' ? 'purple-brown-brick' : null;
  return null;
}

// --- the sample hint -------------------------------------------------------------------------------------------------
type Lch = { L: number; C: number; h: number };
export const lchOf = (hex: string): Lch => { const [L, a, b] = hexToOklab(hex); return { L, C: Math.hypot(a, b), h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 }; };
const warm = (s: Lch) => s.C >= JUDGED.warmMinC && s.h >= JUDGED.warmHue[0] && s.h <= JUDGED.warmHue[1];

/**
 * One front, with its row's median sample L (null when the row has fewer than three samples: then no relative step).
 */
export function judgeFront(input: JudgedInput, rowMedianL: number | null = null): Judgement {
  const finish = String(input.finish ?? 'not-visible'), id = input.pandId;
  const s = input.sample && /^#[0-9a-f]{6}$/i.test(input.sample) ? lchOf(input.sample) : null;
  const rel = s && rowMedianL !== null ? +(s.L - rowMedianL).toFixed(3) : undefined;
  const out = (family: JudgedFamily, by: JudgedSignal, why: string, words?: string): Judgement =>
    ({ pandId: id, family, by, why, ...(words ? { words } : {}), ...(rel !== undefined ? { rel } : {}) });
  const readable = input.readable !== false && finish !== 'not-visible';
  if (!readable) return out(eraBrick(input.year, s, rel), 'era', 'no finish read: era brick (judgeRow may take the row family)');

  // 1. the reader's words about the front
  const dark = describerDarkPhrase({ readable: true, finish, notes: input.notes, pale: input.pale });
  if (dark) {
    const black = /black/i.test(dark) || finish === 'painted-brick';
    return out(black ? 'painted-dark' : 'purple-brown-brick', 'words', `reader calls the front dark: "${dark}"`, dark);
  }
  // With a measured cut sample, a colour word in the notes is not taken: belt readers' notes name neighbours' colours
  // (Herengracht 58, painted dark: "the right neighbour is ... in unpainted red brick").
  const word = input.absolute && s ? null : describerColourWord({ readable: true, notes: input.notes });
  const wf = word ? familyOfWord(word, finish) : null;
  // a word that contradicts the reader's own pale flag (a "white" front the reader called not pale) is not taken, except
  // on brick, whose pale flag is about the brick and whose words name its colour
  const conflict = !!wf && finish !== 'brick' && typeof input.pale === 'boolean' && JUDGED_PALETTE[wf].pale !== input.pale;
  if (wf && !conflict) {
    return out(wf, 'words', `reader's words: "${word}"`, word ?? undefined);
  }

  // 2. the finish
  const pale = input.pale === true;
  if (finish === 'stucco') {
    if (input.pale === false) return out('grey-stone', 'finish', 'stucco, not pale: a darker render');
    if (s && warm(s)) return out('cream-render', 'finish', 'pale stucco; the sample is warm: cream');
    if (rel !== undefined && rel > JUDGED.whiteRel) return out('painted-white', 'finish', 'pale stucco, lighter than its row: white');
    return out('pale-grey-stucco', 'finish', 'pale stucco; a neutral or no sample: pale grey');
  }
  if (finish === 'stone') {
    if (input.pale === false) return out('grey-stone', 'finish', 'stone, not pale');
    return s && warm(s) && s.h < 95 ? out('sandstone', 'finish', 'pale stone, warm sample: sandstone') : out('pale-grey-stucco', 'finish', 'pale stone, neutral sample: pale grey stone');
  }
  if (finish === 'painted-brick') {
    if (pale) return s && warm(s) && s.C > 0.035 ? out('cream-render', 'finish', 'pale paint, warm sample: cream') : out('painted-white', 'finish', 'pale paint: white');
    // dark paint: black / dark green-black unless the sample is clearly a warm brown (oxblood, dark brown paint)
    if (s && warm(s) && s.C >= JUDGED.paintBrownMinC && s.h < 80 && (rel === undefined || rel > JUDGED.darkerRel)) return out('purple-brown-brick', 'sample', 'painted brick, not pale, a warm sample: dark brown / oxblood paint');
    return out('painted-dark', 'finish', 'painted brick, not pale: dark paint');
  }
  if (finish === 'brick') {
    if (pale) return out('buff-brick', 'finish', 'brick the reader calls pale: buff / yellow brick');
    if (input.absolute && s) { const f = brickFromSample(s); return out(f, 'sample', `brick, the cut's measured wall L ${s.L.toFixed(2)} C ${s.C.toFixed(3)} h ${Math.round(s.h)}: ${JUDGED_PALETTE[f].label}`); }
    const f = eraBrick(input.year, s, rel);
    return out(f, rel !== undefined && f !== 'red-brown-brick' && f !== 'brown-brick' ? 'sample' : 'era', eraWhy(f, input.year, rel));
  }
  return out(eraBrick(input.year, s, rel), 'era', `finish ${finish}: era brick`);
}

/**
 * A brick family from a measured cut sample alone (overcast winter cuts: chroma is low, so lightness leads). Herengracht's
 * 17th-century brick reads L 0.36-0.44: dark purple-brown, not the era default's red-brown (integrator, 2026-11-15).
 */
export function brickFromSample(s: Lch): JudgedFamily {
  if (s.L >= 0.56 && s.C >= 0.045 && s.h >= 60) return 'buff-brick';
  if (s.L < 0.44) return 'purple-brown-brick';
  if (s.C >= 0.05 && s.h < 50) return 'red-brown-brick';
  return 'brown-brick';
}

/** The brick family from era and the sample's place in its row. */
function eraBrick(year: number | null | undefined, s: Lch | null, rel: number | undefined): JudgedFamily {
  const y = Number.isFinite(year) ? (year as number) : null;
  // the default by era: the canal belt's red-brown before the 19th-century ring, its mid (grey-)brown brick after
  const base: JudgedFamily = y !== null && y >= JUDGED.ringYear ? 'brown-brick' : 'red-brown-brick';
  if (!s || rel === undefined) return base;
  const late = y !== null && y >= JUDGED.lateYear;
  if (rel < JUDGED.darkerRel) return 'purple-brown-brick';
  if (rel > JUDGED.buffRel && s.h >= JUDGED.buffHue && s.C >= JUDGED.buffMinC) return 'buff-brick';
  if (rel > (late ? JUDGED.lighterRelLate : JUDGED.lighterRel) && s.h < JUDGED.redHue && s.C >= JUDGED.warmMinC) return late || base === 'red-brown-brick' ? 'orange-red-brick' : 'red-brown-brick';
  return base;
}
const eraWhy = (f: JudgedFamily, year: number | null | undefined, rel: number | undefined) =>
  `brick${Number.isFinite(year) ? ` (${year})` : ''}${rel !== undefined ? `, sample ${rel >= 0 ? '+' : ''}${rel.toFixed(2)} L against its row` : ', no sample'}: ${JUDGED_PALETTE[f].label}`;

const median = (xs: number[]) => { const v = [...xs].sort((a, b) => a - b), m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
const BRICKS: readonly JudgedFamily[] = ['red-brown-brick', 'brown-brick', 'purple-brown-brick', 'orange-red-brick', 'buff-brick', 'dark-grey-brick'];

/**
 * A street row in order (left to right along the street): each front judged against the row's median sample (or, with
 * `window`, the median of the fronts within that many places), then the neighbour rules (header, 5).
 */
export function judgeRow(row: readonly JudgedInput[], opts: { window?: number } = {}): Judgement[] {
  const Ls = row.map(r => (r.sample && /^#[0-9a-f]{6}$/i.test(r.sample) ? lchOf(r.sample).L : null));
  // the median over the whole row, or over the `window` fronts either side (a long street side spans several exposures)
  const medAt = (i: number) => {
    const lo = opts.window === undefined ? 0 : Math.max(0, i - opts.window), hi = opts.window === undefined ? row.length : Math.min(row.length, i + opts.window + 1);
    const xs = Ls.slice(lo, hi).filter((x): x is number => x !== null);
    return xs.length >= 3 ? median(xs) : null;
  };
  const out = row.map((r, i) => judgeFront(r, medAt(i)));
  // the row's brick family near a front: the most common brick family among the read fronts within `rowWindow` places
  // (ties: red-brown, the city's commonest brick)
  const brickNear = (i: number): JudgedFamily => {
    const tally = new Map<JudgedFamily, number>();
    for (let k = Math.max(0, i - JUDGED.rowWindow); k <= Math.min(out.length - 1, i + JUDGED.rowWindow); k++) {
      const f = String(row[k].finish ?? 'not-visible');
      if (k !== i && row[k].readable !== false && f !== 'not-visible' && BRICKS.includes(out[k].family)) tally.set(out[k].family, (tally.get(out[k].family) ?? 0) + 1);
    }
    const best = [...tally.entries()].sort((a, b) => b[1] - a[1] || (a[0] === 'red-brown-brick' ? -1 : b[0] === 'red-brown-brick' ? 1 : 0))[0];
    return best?.[0] ?? 'red-brown-brick';
  };
  return out.map((j, i) => {
    const input = row[i], finish = String(input.finish ?? 'not-visible'), rowBrick = brickNear(i);
    if (input.readable === false || finish === 'not-visible') return { ...j, family: rowBrick, by: 'neighbours' as const, why: `no finish read: the row's brick (${JUDGED_PALETTE[rowBrick].label})` };
    const darkBySample = j.by === 'sample' && (j.family === 'purple-brown-brick' || j.family === 'painted-dark');
    if (darkBySample) {
      const sides = [out[i - 1], out[i + 1]].filter(Boolean);
      if (sides.length && sides.every(n => JUDGED_PALETTE[n.family].pale)) {
        const fam = rowBrick === 'purple-brown-brick' ? 'red-brown-brick' : rowBrick;
        return { ...j, family: fam, by: 'neighbours' as const, why: `a lone dark sample between pale fronts: the row's brick (${JUDGED_PALETTE[fam].label})` };
      }
    }
    return j;
  });
}

// --- variation and the spec ------------------------------------------------------------------------------------------
/** FNV-1a of the pand id, as three uniform numbers in [-1, 1]. */
function jitter(id: string): [number, number, number] {
  let h = 0x811c9dc5;
  const out: number[] = [];
  for (let k = 0; k < 3; k++) {
    for (const ch of `${id}:${k}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    out.push(((h >>> 0) / 0xffffffff) * 2 - 1);
  }
  return out as [number, number, number];
}
/** The family's tone for one house: a stable small variation in lightness, chroma and hue. */
export function variedTone(family: JudgedFamily, pandId: string): string {
  const t = JUDGED_PALETTE[family], [u, v, w] = jitter(pandId);
  const L = Math.min(t.maxL, t.L + u * t.dL), C = Math.max(0, t.C + v * t.dC), h = ((t.h + w * t.dh) * Math.PI) / 180;
  return oklabToHex([L, C * Math.cos(h), C * Math.sin(h)]);
}

/**
 * The spec with the judged wall: `palette/brick` = the varied tone, `facts/wallFamily` = the family's reader family,
 * `facts/wallJudged` = the receipt. Any measured-wall receipts (`facts/wallSample`, `facts/wallExposure`) go, because
 * the brick they describe is no longer the staged one. Everything else is kept as it was. Returns a copy.
 */
export function withJudgedWall(spec: HouseSpec, j: Judgement, ctx: { ref: string; at: string; sample?: string | null; year?: number | null }): HouseSpec {
  const out = structuredClone(spec);
  const hex = variedTone(j.family, spec.pandId);
  out.design.palette = { ...(out.design.palette ?? {}), brick: hex };
  const facts: SpecFacts = { ...(out.facts ?? {}) };
  delete facts.wallSample; delete facts.wallExposure;
  facts.wallFamily = JUDGED_PALETTE[j.family].wallFamily;
  const receipt: WallJudgedFact = {
    v: 1, source: 'judged', family: j.family, hex, by: j.by, why: j.why,
    ...(j.words ? { words: j.words } : {}), ...(ctx.sample ? { sample: ctx.sample } : {}), ...(j.rel !== undefined ? { rel: j.rel } : {}),
    ...(Number.isFinite(ctx.year) ? { year: ctx.year as number } : {}), ruling: JUDGED_RULING,
  };
  facts.wallJudged = receipt;
  out.facts = facts;
  const prov = { ...out.provenance };
  delete prov['facts/wallSample']; delete prov['facts/wallExposure'];
  const p = { source: 'vision-judge' as const, confidence: 0.5, ref: `judged:${j.by}:${ctx.ref}`, at: ctx.at };
  prov['palette/brick'] = p; prov['facts/wallFamily'] = p; prov['facts/wallJudged'] = p;
  out.provenance = prov;
  return out;
}

/**
 * A front whose wall colour a stronger source already states (a block face's street-level measurement, an author): the
 * judged colour defers to it. The spec keeps every other field and drops its own sampled wall (`palette/brick` and the
 * measured-wall receipts), so the stronger colour draws as today. Returns a copy.
 */
export function withoutSampledWall(spec: HouseSpec): HouseSpec {
  const out = structuredClone(spec);
  if (out.design.palette) { delete out.design.palette.brick; if (!Object.keys(out.design.palette).length) delete out.design.palette; }
  if (out.facts) { delete out.facts.wallSample; delete out.facts.wallExposure; if (!Object.keys(out.facts).length) delete out.facts; }
  for (const k of ['palette/brick', 'facts/wallSample', 'facts/wallExposure']) delete out.provenance[k];
  return out;
}
