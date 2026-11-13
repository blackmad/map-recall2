/**
 * Belt library step 1 (lane BL, 2026-11-13): the look key. Pure and Node-only; the CLI is scripts/belt-library/keys.ts.
 *
 * Why: David wants the nondescript canal-belt houses to reuse a small library of designs instead of one model each.
 * Before anything is built, this module answers how many designs that would take: every belt pand gets a key
 * (crown class, bays, storeys, finish, coarse colour family), each field taken from the best source that states it,
 * in this order (the lane brief, not the trust ladder of houseSpec/resolve.ts):
 *   hand > monument (monument-gables.json, register facts) > d1 (vision-judge readings) > measured (street-level
 *   measurements and wall hex) > prior (fitted here from the read houses; never presented as a reading).
 * Every resolved field keeps the source it came from, so a coverage table can be recomputed without the priors.
 */

export const SOURCES = ['hand', 'monument', 'd1', 'measured', 'prior'] as const;
export type Source = (typeof SOURCES)[number];
export const FIELDS = ['crown', 'bays', 'storeys', 'finish', 'colour'] as const;
export type Field = (typeof FIELDS)[number];

export const CROWN_CLASSES = ['cornice', 'curved', 'step', 'spout', 'cornice-dormer', 'mansard', 'flat-other'] as const;
export type CrownClass = (typeof CROWN_CLASSES)[number];
export const FINISHES = ['brick', 'painted'] as const;
export type Finish = (typeof FINISHES)[number];
export const COLOURS = ['light', 'grey', 'red', 'brown'] as const;
export type Colour = (typeof COLOURS)[number];

export interface Reading<T> { value: T; source: Source; ref?: string }
/** Every reading found for one pand, any order; `resolveField` picks by SOURCE rank. */
export type Readings = { [F in Field]?: Reading<F extends 'crown' ? CrownClass : F extends 'bays' | 'storeys' ? number : F extends 'finish' ? Finish : Colour>[] };

/** Map a spec-field provenance label (facade/evidence.ts SourceKind) to the lane's source. Unlisted labels are not readings. */
export function sourceOfLabel(label: string | undefined): Source | null {
  switch (label) {
    case 'reviewed': case 'author': return 'hand';
    case 'monument-text': return 'monument';
    case 'vision-judge': return 'd1';
    case 'streetlevel-measured': return 'measured';
    default: return null;
  }
}

/** Intent / register / D1 gable word (plus roof facts) -> crown class. */
export function crownClass(gable: string | undefined, o: { dormers?: boolean; roofFront?: string } = {}): CrownClass | null {
  if (!gable || gable === 'unknown' || gable === 'not-visible') return null;
  if (o.roofFront === 'mansard' || gable === 'mansard') return 'mansard';
  switch (gable) {
    case 'cornice': return o.dormers ? 'cornice-dormer' : 'cornice';
    case 'neck': case 'bell': case 'raised-neck': case 'raisedNeck': case 'clock': return 'curved';
    case 'step': return 'step';
    case 'spout': return 'spout';
    default: return 'flat-other'; // flat, plain, point, shouldered, pitched-eaves
  }
}

export function finishClass(word: string | undefined): Finish | null {
  switch (word) {
    case 'brick': case 'ornamentalBrick': return 'brick';
    case 'painted-brick': case 'painted': case 'stucco': case 'plaster': case 'stone': return 'painted';
    default: return null;
  }
}

/** D1 / hand-set wall-family word -> the coarse family. */
export function colourFromWord(w: string | undefined): Colour | null {
  switch (w) {
    case 'white': case 'buff': return 'light';
    case 'grey': return 'grey';
    case 'orange': case 'red': case 'red-brown': return 'red';
    case 'brown': case 'dark': return 'brown';
    default: return null;
  }
}

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
/** sRGB hex -> OKLab (L, a, b). */
export function hexOklab(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16), r = lin((n >> 16 & 255) / 255), g = lin((n >> 8 & 255) / 255), b = lin((n & 255) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), mm = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * mm - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * mm + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * mm - 0.808675766 * s];
}
/**
 * A measured wall hex -> coarse family. The street-photo medians in the house-specs extract are muted (1,419 belt-wide
 * readings: median L 0.44, chroma 0.033, hue 55 degrees), so the thresholds sit inside that spread, not at the textbook
 * values: light = L >= 0.70; grey = chroma < 0.018; red = hue <= 47 degrees with chroma >= 0.03; brown = the rest (dark browns
 * included). Not validated against painted-brick labels; colour is the weakest field of the key.
 */
export function colourFromHex(hex: string): Colour | null {
  const lab = hexOklab(hex);
  if (!lab) return null;
  const [L, a, b] = lab, C = Math.hypot(a, b), hue = (Math.atan2(b, a) * 180) / Math.PI;
  if (L >= 0.7) return 'light';
  if (C < 0.018) return 'grey';
  if (C >= 0.03 && hue <= 47 && hue >= 0) return 'red';
  return 'brown';
}

/** The first source in SOURCES order that has a reading; within a source the first listed. */
export function resolveField<T>(readings: Reading<T>[] | undefined): Reading<T> | null {
  if (!readings?.length) return null;
  let best: Reading<T> | null = null;
  for (const r of readings) if (!best || SOURCES.indexOf(r.source) < SOURCES.indexOf(best.source)) best = r;
  return best;
}

// ---- priors -------------------------------------------------------------------------------------------------------

export interface PandFacts {
  id: string;
  buurt: string;
  year: number | null;
  /** Front width (m): short side of the footprint's oriented box. */
  widthM: number;
  heightM: number;
  areaM2: number;
  corner: boolean;
  /** No exposed wall of 3 m or more faces a street or quay within 14 m: a rear building or shed, not a street house. */
  backland: boolean;
}
export const yearBucket = (y: number | null) => (y == null ? 'u' : y < 1700 ? 'a' : y < 1800 ? 'b' : y < 1880 ? 'c' : y < 1920 ? 'd' : y < 1946 ? 'e' : 'f');
export const widthBucket = (w: number) => Math.round(w / 0.75);
export const heightBucket = (h: number) => Math.round(h);

type Counter = Map<string | number, number>;
const bump = (m: Counter, k: string | number) => m.set(k, (m.get(k) ?? 0) + 1);
const modeOf = <T extends string | number>(m: Counter | undefined): T | undefined => {
  let best: T | undefined, n = 0;
  for (const [k, c] of m ?? []) if (c > n || (c === n && best !== undefined && String(k) < String(best))) { best = k as T; n = c; }
  return best;
};

/** Modal value per bucket among read houses; a bucket with fewer than `minN` reads falls back to the global mode. */
export class Prior<T extends string | number> {
  private by = new Map<string, Counter>();
  private all: Counter = new Map();
  constructor(private bucketOf: (p: PandFacts) => string, private minN = 3) {}
  add(p: PandFacts, v: T) {
    const k = this.bucketOf(p);
    if (!this.by.has(k)) this.by.set(k, new Map());
    bump(this.by.get(k)!, v); bump(this.all, v);
  }
  guess(p: PandFacts): T | undefined {
    const m = this.by.get(this.bucketOf(p));
    const n = m ? [...m.values()].reduce((a, b) => a + b, 0) : 0;
    return n >= this.minN ? modeOf<T>(m) : modeOf<T>(this.all);
  }
  /** A draw from the bucket's read values (u in [0,1)), the way the reads are distributed; the global distribution when the bucket is thin. */
  sample(p: PandFacts, u: number): T | undefined {
    const m0 = this.by.get(this.bucketOf(p));
    const m = m0 && [...m0.values()].reduce((a, b) => a + b, 0) >= this.minN ? m0 : this.all;
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    let acc = 0;
    for (const [k, c] of [...m].sort((a, b) => (String(a[0]) < String(b[0]) ? -1 : 1))) { acc += c; if (u * total < acc) return k as T; }
    return undefined;
  }
  get size() { return [...this.all.values()].reduce((a, b) => a + b, 0); }
}

export interface Priors {
  crown: Prior<CrownClass>; bays: Prior<number>; storeys: Prior<number>; finish: Prior<Finish>; colour: Prior<Colour>;
}
export function newPriors(): Priors {
  return {
    crown: new Prior(p => yearBucket(p.year)),
    bays: new Prior(p => String(widthBucket(p.widthM))),
    storeys: new Prior(p => String(heightBucket(p.heightM))),
    finish: new Prior(p => yearBucket(p.year)),
    colour: new Prior(p => p.buurt),
  };
}

// ---- keys ---------------------------------------------------------------------------------------------------------

export interface ResolvedPand {
  facts: PandFacts;
  crown: Reading<CrownClass>; bays: Reading<number>; storeys: Reading<number>; finish: Reading<Finish>; colour: Reading<Colour>;
}

/** Deterministic u in [0,1) for a pand and field (FNV-1a), so a sampled prior is stable between runs. */
export function unit(id: string, field: string): number {
  let h = 2166136261;
  for (const ch of `${id}/${field}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}
export type PriorMode = 'mode' | 'sample';
/**
 * Fit priors from every pand's non-prior readings, then resolve every pand. A prior fills what no source states: `mode` is
 * the bucket's most common read value (every unread house of a bucket gets the same one, so it undercounts the keys);
 * `sample` draws from the bucket's read distribution (a realistic spread, fields drawn independently).
 */
export function resolveAll(pands: { facts: PandFacts; readings: Readings }[], mode: PriorMode = 'mode'): { resolved: ResolvedPand[]; priors: Priors } {
  const priors = newPriors();
  for (const { facts, readings } of pands) for (const f of FIELDS) {
    const r = resolveField(readings[f] as Reading<never>[] | undefined);
    if (r) (priors[f] as Prior<never>).add(facts, r.value as never);
  }
  const resolved = pands.map(({ facts, readings }) => {
    const out: Record<string, Reading<unknown>> = {};
    for (const f of FIELDS) {
      const r = resolveField(readings[f] as Reading<unknown>[] | undefined);
      out[f] = r ?? { value: mode === 'mode' ? (priors[f] as Prior<never>).guess(facts) : (priors[f] as Prior<never>).sample(facts, unit(facts.id, f)), source: 'prior' };
    }
    return { facts, ...out } as unknown as ResolvedPand;
  });
  return { resolved, priors };
}

export type Variant = 'fine' | 'coarse' | 'bays-storeys';
export const VARIANTS: Variant[] = ['fine', 'coarse', 'bays-storeys'];
export const baysBand = (n: number) => (n <= 2 ? '1-2' : n <= 4 ? '3-4' : '5+');
export const storeysBand = (n: number) => (n <= 3 ? '<=3' : n <= 5 ? '4-5' : '6+');
const crownCoarse = (c: CrownClass) => (c === 'cornice' || c === 'flat-other' ? 'straight' : c === 'curved' || c === 'step' || c === 'spout' ? 'gable' : 'roofed');
const colourCoarse = (c: Colour) => (c === 'red' ? 'red' : c === 'brown' ? 'brown' : 'pale');

/**
 * The key string. fine: crown/bays/storeys/finish/colour as read. coarse: bays and storeys in bands (bays 1-2, 3-4, 5+;
 * storeys <=3, 4-5, 6+, i.e. within one storey), crown merged to straight/gable/roofed, colour to red/brown/pale.
 * bays-storeys: only the two counts coarsened. `omitPrior` writes `?` for a prior field (the read-fields-only key).
 */
export function keyOf(p: ResolvedPand, variant: Variant, omitPrior = false): string {
  const part = (f: Field): string => {
    const r = p[f] as Reading<string | number>;
    if (omitPrior && r.source === 'prior') return '?';
    const v = r.value;
    if (v === undefined) return '?';
    if (variant === 'fine') return String(v);
    switch (f) {
      case 'bays': return baysBand(v as number);
      case 'storeys': return storeysBand(v as number);
      case 'crown': return variant === 'coarse' ? crownCoarse(v as CrownClass) : String(v);
      case 'colour': return variant === 'coarse' ? colourCoarse(v as Colour) : String(v);
      default: return String(v);
    }
  };
  return FIELDS.map(part).join('|');
}

export interface CoverageRow { share: number; keys: number }
/** How many of the most common keys cover each share of the pands. */
export function keysForShares(counts: number[], shares = [0.5, 0.8, 0.95]): CoverageRow[] {
  const sorted = [...counts].sort((a, b) => b - a), total = sorted.reduce((a, b) => a + b, 0);
  return shares.map(share => {
    let acc = 0, k = 0;
    while (k < sorted.length && acc < share * total - 1e-9) acc += sorted[k++];
    return { share, keys: k };
  });
}

/** Pand ids grouped by key, most common key first (ties by key text). */
export function groupKeys(entries: { id: string; key: string }[]): { key: string; ids: string[] }[] {
  const m = new Map<string, string[]>();
  for (const { id, key } of entries) (m.get(key) ?? m.set(key, []).get(key)!).push(id);
  return [...m].map(([key, ids]) => ({ key, ids })).sort((a, b) => b.ids.length - a.ids.length || (a.key < b.key ? -1 : 1));
}

// ---- the distinctive residue ----------------------------------------------------------------------------------------

/** Register elements that are ornament, not plumbing: a building carrying two or more is a monument with an inventory. */
export const ORNAMENT_ELEMENTS = new Set(['sculpture', 'gablestone', 'festoons', 'claws', 'oeilDeBoeuf', 'pediment', 'pilasters', 'twinGable', 'anchors', 'crownCornice']);
export const UNUSUAL_WIDTH = { minM: 3.2, maxM: 9 } as const;
export const LARGE_AREA_M2 = 350;
export type Distinctive = 'ornament' | 'corner' | 'width' | 'large' | 'modelled';
export function distinctiveFlags(f: PandFacts, o: { elements?: string[]; modelled?: boolean }): Distinctive[] {
  const out: Distinctive[] = [];
  if ((o.elements ?? []).filter(e => ORNAMENT_ELEMENTS.has(e)).length >= 2) out.push('ornament');
  if (f.corner) out.push('corner');
  if (f.widthM < UNUSUAL_WIDTH.minM || f.widthM > UNUSUAL_WIDTH.maxM) out.push('width');
  if (f.areaM2 > LARGE_AREA_M2) out.push('large');
  if (o.modelled) out.push('modelled');
  return out;
}

/** Oriented-box short side, long side and corner test of a footprint ring (metres), given which edges are party walls. */
export function boxDims(ring: { x: number; y: number }[]): { shortM: number; longM: number } {
  let best = { shortM: Infinity, longM: Infinity, area: Infinity };
  const n = ring.length - (ring[0].x === ring[ring.length - 1].x && ring[0].y === ring[ring.length - 1].y ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    if (len < 0.5) continue;
    const ux = dx / len, uy = dy / len;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (let j = 0; j < n; j++) {
      const u = (ring[j].x - a.x) * ux + (ring[j].y - a.y) * uy, v = -(ring[j].x - a.x) * uy + (ring[j].y - a.y) * ux;
      u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
    }
    const w = u1 - u0, h = v1 - v0, area = w * h;
    if (area < best.area) best = { shortM: Math.min(w, h), longM: Math.max(w, h), area };
  }
  return best.area === Infinity ? { shortM: 0, longM: 0 } : { shortM: best.shortM, longM: best.longM };
}

export const polygonArea = (ring: { x: number; y: number }[]) => {
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) s += ring[j].x * ring[i].y - ring[i].x * ring[j].y;
  return Math.abs(s) / 2;
};

/** A corner has two exposed walls (>= 4 m) that meet at about a right angle. `exposed` are the exposed edges as [dx, dy] vectors. */
export function isCorner(exposed: [number, number][]): boolean {
  const long = exposed.filter(([dx, dy]) => Math.hypot(dx, dy) >= 4);
  for (let i = 0; i < long.length; i++) for (let j = i + 1; j < long.length; j++) {
    const [ax, ay] = long[i], [bx, by] = long[j];
    const cos = Math.abs((ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by)));
    if (cos < 0.5) return true; // angle between 60 and 120 degrees
  }
  return false;
}
