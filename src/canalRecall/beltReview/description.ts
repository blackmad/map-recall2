/**
 * Belt review stage 2 (lane C, the library; plan "The loop" check 2): a house's description assembled from what we already
 * hold, one readable field at a time, each with the source that said it and how sure it is. Reviewing a house should cost a
 * glance at fields we already know, and a new read only where nothing in the library speaks.
 *
 * The fields are the ones David checks beside the photo: storeys, bays, crown (gable or cornice), cornice, roof storey,
 * dormers, window heads, windows, surrounds, wall finish and colour, white frames, ground floor, door, stoop, eaves height,
 * facade year. Sources, strongest first (DESC_SOURCES):
 *   reviewed       a person looked (a reviewed or authored HouseSpec field, a row review)
 *   face-intent    a block-face intent measured on its rectified strip (HouseSpec streetlevel-measured)
 *   own-read       this house's own photo read (D1 describer answer, the belt photo readers, a vision-judge spec field)
 *   register       the Rijksmonument register's words (monument-facts, HouseSpec monument-text)
 *   survey         a measurement not read off the front photo (AHN front band, 3DBAG eaves, BAG)
 *   based-on       another house's design through HouseSpec `basedOn` (R4)
 *   donor          the belt look's nearest read house (beltLook/donors.ts), not this house
 *   period-default the era default (HouseSpec `default`, row solve period-default)
 * The ledger splits fields into `library` (any source above `donor`) and `newRead` (donor, period default, or nothing):
 * the second count is the work a block still costs.
 *
 * Pure: no fs. scripts/belt-review/describe.ts loads the inputs.
 */
import { frontBays, type HouseSpec, type Prov, type SpecSource } from '../houseSpec/spec.ts';
import type { DescriberAnswer } from '../houseSpec/describer.ts';

export const DESC_FIELDS = [
  'storeys', 'bays', 'crown', 'cornice', 'roofStorey', 'dormers', 'heads', 'windows', 'windowSurround',
  'wallFinish', 'wallColour', 'whiteFrames', 'ground', 'door', 'stoop', 'eavesM', 'facadeYear',
] as const;
export type DescField = (typeof DESC_FIELDS)[number];

export const DESC_SOURCES = ['reviewed', 'face-intent', 'own-read', 'register', 'survey', 'based-on', 'donor', 'period-default'] as const;
export type DescSource = (typeof DESC_SOURCES)[number];
/** Sources that count as "from the library" in the ledger; the rest (and an absent field) need a new read. */
export const LIBRARY_SOURCES: ReadonlySet<DescSource> = new Set(['reviewed', 'face-intent', 'own-read', 'register', 'survey', 'based-on']);
const RANK = new Map<DescSource, number>(DESC_SOURCES.map((s, i) => [s, DESC_SOURCES.length - i]));
/** Default confidence per source when the input states none. */
export const SOURCE_CONFIDENCE: Readonly<Record<DescSource, number>> = {
  reviewed: 0.95, 'face-intent': 0.85, 'own-read': 0.6, register: 0.7, survey: 0.75, 'based-on': 0.7, donor: 0.35, 'period-default': 0.2,
};

/** One statement of one field by one source. */
export interface FieldCandidate { field: DescField; value: unknown; source: DescSource; confidence: number; ref: string }
/** A field as the description shows it: the winning statement, and what else was said (for the review page). */
export interface DescFieldValue {
  value: unknown;
  source: DescSource;
  confidence: number;
  ref: string;
  /** Other sources' values that disagree with the winner (same value statements are folded into the winner's `agree`). */
  others?: Array<{ value: unknown; source: DescSource; ref: string }>;
  /** Sources that state the same value. */
  agree?: DescSource[];
}

/** HouseSpec receipt source -> description source. */
export function descSourceOfSpec(source: SpecSource | string | undefined): DescSource {
  switch (source) {
    case 'reviewed': case 'author': return 'reviewed';
    case 'streetlevel-measured': return 'face-intent';
    case 'vision-judge': return 'own-read';
    case 'monument-text': return 'register';
    case 'based-on': return 'based-on';
    case 'ahn': case '3dbag': case 'bag': case 'osm': case 'pdok-ortho': return 'survey';
    default: return 'period-default';
  }
}

const isWhite = (hex: unknown) => {
  if (typeof hex !== 'string') return undefined;
  if (hex === 'white') return true;
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return undefined;
  const [r, g, b] = [m[1], m[2], m[3]].map(x => parseInt(x, 16));
  return Math.min(r, g, b) >= 0xd8;
};

/** The description fields a resolved HouseSpec states, each with its receipt's source (street front = `fronts/0`). */
export function candidatesFromSpec(spec: HouseSpec, refPrefix = 'house-spec'): FieldCandidate[] {
  const out: FieldCandidate[] = [];
  const prov = (path: string): Prov | undefined => {
    const parts = path.split('/');
    for (let n = parts.length; n >= 0; n--) { const p = spec.provenance?.[parts.slice(0, n).join('/')]; if (p) return p; }
    return undefined;
  };
  const put = (field: DescField, path: string, value: unknown) => {
    if (value === undefined || value === null) return;
    const p = prov(path), source = descSourceOfSpec(p?.source);
    out.push({ field, value, source, confidence: p?.confidence ?? SOURCE_CONFIDENCE[source], ref: `${refPrefix} ${path} (${p?.source ?? 'unreceipted'}${p?.ref ? `: ${p.ref}` : ''})` });
  };
  const f = (spec.design?.fronts?.[0] ?? {}) as Record<string, any>;
  put('storeys', 'fronts/0/storeys', f.storeys);
  put('bays', f.axisGrid !== undefined ? 'fronts/0/axisGrid' : 'fronts/0/bays', frontBays(f));
  put('crown', 'fronts/0/gable', f.gable);
  put('cornice', 'fronts/0/cornice', f.cornice);
  put('roofStorey', 'fronts/0/roofStorey', f.roofStorey);
  if (f.readDormers) put('dormers', 'fronts/0/readDormers', f.readDormers);
  else if (typeof f.dormers === 'number') put('dormers', 'fronts/0/dormers', { count: f.dormers, ...(f.dormerStyle ? { kind: f.dormerStyle } : {}) });
  put('heads', 'fronts/0/windowHead', f.windowHead?.kind);
  put('windows', 'fronts/0/windows', f.windows);
  put('windowSurround', 'fronts/0/windowSurround', f.windowSurround);
  put('wallFinish', 'palette/wallMaterial', spec.design?.palette?.wallMaterial);
  put('wallColour', 'palette/brick', spec.design?.palette?.brick ?? (spec.facts?.wallFamily));
  put('whiteFrames', 'palette/frame', isWhite(spec.design?.palette?.frame));
  const ground = spec.facts?.groundKind ?? (spec.facts?.pui === 'residential' ? 'dwelling' : spec.facts?.pui) ?? (f.shopfront ? 'shop' : undefined);
  put('ground', spec.facts?.groundKind ? 'facts/groundKind' : spec.facts?.pui ? 'facts/pui' : 'fronts/0/shopfront', ground);
  put('door', 'fronts/0/doorBay', f.doorBay);
  put('stoop', 'fronts/0/basement', f.basement);
  put('facadeYear', 'facts/facadeYear', spec.facts?.facadeYear);
  return out;
}

const SKIP = new Set(['not-visible', 'unclear', 'none-visible', 'unknown']);
const ok = (v: unknown) => v !== undefined && v !== null && !(typeof v === 'string' && SKIP.has(v));
/** D1 answer keys the reader marked low -> description fields. */
const LOW_FIELD: Readonly<Record<string, DescField>> = {
  storeys: 'storeys', storeyParts: 'storeys', bays: 'bays', crown: 'crown', cornice: 'cornice', heads: 'heads', windows: 'windows',
  storeyWindows: 'windows', windowSurround: 'windowSurround', finish: 'wallFinish', wallFamily: 'wallColour', whiteFrames: 'whiteFrames',
  ground: 'ground', doorBay: 'door', doorIndex: 'door', doorSurround: 'door', basement: 'stoop', dormers: 'dormers',
};
const mode = (xs: readonly string[]) => { const n = new Map<string, number>(); for (const x of xs) n.set(x, (n.get(x) ?? 0) + 1); return [...n].sort((a, b) => b[1] - a[1])[0]?.[0]; };

/** The fields a D1 describer answer states (`own-read`; a field the reader marked `low` at 0.4). */
export function candidatesFromRead(a: DescriberAnswer & Record<string, any>, ref: string, source: DescSource = 'own-read'): FieldCandidate[] {
  if (a.readable === false) return [];
  const low = new Set((a.low ?? []).map((k: string) => LOW_FIELD[k]).filter(Boolean));
  const out: FieldCandidate[] = [];
  const put = (field: DescField, value: unknown) => { if (ok(value)) out.push({ field, value, source, confidence: low.has(field) ? 0.4 : SOURCE_CONFIDENCE[source], ref }); };
  put('storeys', a.storeys ?? a.storeyParts?.full);
  put('bays', a.bays);
  put('crown', a.crown);
  put('cornice', a.crown === 'cornice' || a.cornice !== 'none' ? a.cornice : undefined);
  put('roofStorey', a.storeyParts?.roof);
  if (a.dormers && typeof a.dormers === 'object') put('dormers', a.dormers.count === 0 ? { count: 0 } : a.dormers);
  const heads = Array.isArray(a.heads) ? a.heads.filter((h: string) => ok(h)) : [];
  put('heads', heads.length ? mode(heads.slice(heads.length > 1 ? 1 : 0)) : undefined);
  put('windows', a.windows);
  put('windowSurround', a.windowSurround);
  put('wallFinish', a.finish);
  put('wallColour', a.wallFamily);
  put('whiteFrames', typeof a.whiteFrames === 'boolean' ? a.whiteFrames : undefined);
  put('ground', a.ground);
  if (Number.isInteger(a.doorIndex) || a.doorSurround === true) put('door', { ...(Number.isInteger(a.doorIndex) ? { bay: a.doorIndex } : {}), ...(a.doorSurround === true ? { surround: true } : {}) });
  put('stoop', a.basement);
  return out;
}

/** The belt photo readers' fields for a pand (data/buurt-generators/belt/photo-reads.json `reads[pand]`). */
export function candidatesFromPhotoRead(r: Record<string, any>, ref: string): FieldCandidate[] {
  const out: FieldCandidate[] = [];
  const put = (field: DescField, value: unknown, c: unknown) => { if (ok(value)) out.push({ field, value, source: 'own-read', confidence: typeof c === 'number' ? Math.min(c, 0.8) : 0.5, ref }); };
  put('wallFinish', r.finish, r.confidence);
  put('crown', r.crown, r.cc);
  put('cornice', r.cornice, r.cc);
  if (r.colour && ok(r.colour.family)) put('wallColour', r.colour.family, r.colour.confidence);
  return out;
}

const REGISTER_GABLE: Readonly<Record<string, string>> = { raisedNeck: 'raised-neck', plain: 'point' };
const REGISTER_FINISH: Readonly<Record<string, string>> = { plaster: 'stucco', ornamentalBrick: 'brick', painted: 'painted-brick', brick: 'brick', stone: 'stone' };

/** The register's fields (monument-facts `buildings[NL.IMBAG.Pand.<id>]`). */
export function candidatesFromRegister(m: Record<string, any>): FieldCandidate[] {
  const ref = `monument-facts rce:${m.nr ?? '?'}`, out: FieldCandidate[] = [];
  const put = (field: DescField, value: unknown, c = SOURCE_CONFIDENCE.register) => { if (ok(value)) out.push({ field, value, source: 'register', confidence: c, ref }); };
  if (typeof m.gable === 'string') put('crown', REGISTER_GABLE[m.gable] ?? m.gable, 0.55);
  if (Number.isInteger(m.storeys)) put('storeys', m.storeys);
  if (typeof m.finish === 'string') put('wallFinish', REGISTER_FINISH[m.finish] ?? m.finish);
  const d = m.facadeDate;
  if (d && Number.isFinite(d.from)) put('facadeYear', Math.round(Number.isFinite(d.to) ? (d.from + d.to) / 2 : d.from), d.confidence === 'year' ? 0.85 : 0.5);
  const el = new Set((m.elements ?? []).map((e: { key: string }) => e.key));
  if (el.has('corniceConsoles')) put('cornice', 'bracketed', 0.6);
  if (el.has('stoop')) put('stoop', 'stoop', 0.6);
  if (el.has('dormer')) put('dormers', { count: 1, kind: 'unknown', note: 'register names a dormer' }, 0.5);
  if (el.has('shopfront')) put('ground', 'shop', 0.55);
  if (el.has('doorSurround')) put('door', { surround: true }, 0.55);
  return out;
}

/** A belt look row-front record (beltLook): the look's own read when it names this pand, else its donor's. */
export function candidatesFromBeltLook(rec: Record<string, any>): FieldCandidate[] {
  const pand = String(rec.pandId), wallText = String(rec.sources?.wall ?? '');
  const readOf = /D1 answers: (\d{16})/.exec(wallText)?.[1];
  const source: DescSource = readOf === pand ? 'own-read' : 'donor';
  const conf = source === 'own-read' ? 0.5 : SOURCE_CONFIDENCE.donor;
  const ref = `belt look ${rec.series?.id ?? ''}${readOf && readOf !== pand ? ` (donor ${readOf})` : ''}`.trim();
  const out: FieldCandidate[] = [];
  const put = (field: DescField, value: unknown, s: DescSource = source, c = conf) => { if (ok(value)) out.push({ field, value, source: s, confidence: c, ref }); };
  put('crown', rec.crown?.family);
  put('storeys', rec.storeys);
  put('bays', rec.bays);
  put('cornice', rec.series?.cornice);
  put('windows', rec.series?.glazing?.kind);
  put('whiteFrames', typeof rec.series?.look?.whiteFrames === 'boolean' ? rec.series.look.whiteFrames : undefined);
  put('wallColour', rec.wall?.hex);
  put('wallFinish', rec.wall?.finish);
  put('roofStorey', rec.series?.roofStorey?.kind);
  const eavesSrc = String(rec.sources?.eaves ?? '').split(':')[0];
  if (Number.isFinite(rec.eavesM)) put('eavesM', rec.eavesM, eavesSrc === 'period-default' ? 'period-default' : source, eavesSrc === 'period-default' ? SOURCE_CONFIDENCE['period-default'] : conf);
  return out;
}

/** Eaves from the AHN front band (`p90`, beltLook/ahnFront.ts) and 3DBAG's eaves (bag tiles). */
export function candidatesFromSurvey(ahn: { n: number; p90: number } | undefined, bagEavesM: number | null | undefined, ahnRef: string): FieldCandidate[] {
  const out: FieldCandidate[] = [];
  if (ahn && ahn.n >= 8 && Number.isFinite(ahn.p90)) out.push({ field: 'eavesM', value: ahn.p90, source: 'survey', confidence: 0.75, ref: `${ahnRef} p90 (n ${ahn.n})` });
  // 3DBAG's eaves under 4 m on a street front is usually a rear or annex roof part: kept, at low confidence.
  if (Number.isFinite(bagEavesM)) out.push({ field: 'eavesM', value: bagEavesM, source: 'survey', confidence: (bagEavesM as number) < 4 ? 0.2 : 0.5, ref: 'bag-tiles 3DBAG eaves' });
  return out;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Pick each field's winner: the strongest source, then higher confidence, then input order. */
export function pickFields(cands: readonly FieldCandidate[]): Partial<Record<DescField, DescFieldValue>> {
  const by = new Map<DescField, FieldCandidate[]>();
  for (const c of cands) (by.get(c.field) ?? by.set(c.field, []).get(c.field)!).push(c);
  const out: Partial<Record<DescField, DescFieldValue>> = {};
  for (const field of DESC_FIELDS) {
    const list = by.get(field);
    if (!list?.length) continue;
    const sorted = list.map((c, i) => ({ c, i })).sort((x, y) => (RANK.get(y.c.source)! - RANK.get(x.c.source)!) || (y.c.confidence - x.c.confidence) || (x.i - y.i)).map(x => x.c);
    const w = sorted[0];
    const agree = [...new Set(sorted.slice(1).filter(c => same(c.value, w.value)).map(c => c.source))];
    const others = sorted.slice(1).filter(c => !same(c.value, w.value)).map(c => ({ value: c.value, source: c.source, ref: c.ref }));
    out[field] = { value: w.value, source: w.source, confidence: +w.confidence.toFixed(2), ref: w.ref, ...(agree.length ? { agree } : {}), ...(others.length ? { others } : {}) };
  }
  return out;
}

/** Ledger counts for one pand or a face: fields from the library against fields that need a new read (absent included). */
export interface DescCounts { fields: number; library: number; newRead: number; bySource: Partial<Record<DescSource | 'missing', number>> }
export function countFields(fieldSets: ReadonlyArray<Partial<Record<DescField, DescFieldValue>>>): DescCounts {
  const c: DescCounts = { fields: 0, library: 0, newRead: 0, bySource: {} };
  for (const fs of fieldSets) for (const field of DESC_FIELDS) {
    const v = fs[field], s = v?.source ?? 'missing';
    c.fields++;
    c.bySource[s] = (c.bySource[s] ?? 0) + 1;
    if (v && LIBRARY_SOURCES.has(v.source)) c.library++; else c.newRead++;
  }
  return c;
}
