/**
 * House rows, the row solve (lane D, #386; docs/house-line.md "Rows"). Pure: the script (`scripts/house-specs/rows/`)
 * loads the files and hands this module a `RowInput`; nothing here reads the disk.
 *
 *  1. Fronts: a pand is one front unless its face intent splits it into modules (m0/m1), or its reading counts at least
 *     twice the row's bays on a pand at least 1.6x the row's median width with two house numbers (the reader said
 *     `extent: single` on Kinkerstraat 106–108 and counted 6 bays: flagged `extent-mismatch`, split).
 *  2. Held reads: a reading whose notes or gaps mention scaffold or netting is not used at all (`readHeld`); the front
 *     takes its series (Kinkerstraat 92–94, 236213, whose W1 colour was the netting).
 *  3. Series: fronts with one face-stated design (type, head dressing, dormers); without a face, fronts with one read
 *     class signature (crown, cornice class, roof storey, storeys, bays). A front that states nothing joins its left
 *     neighbour's series (else its right).
 *  4. Per series and field: face intent (mode of the members' face values) > series consensus (mode of class reads,
 *     median of metre fields; two or more reads) > single read > period default. A face value and a read consensus of
 *     an incompatible class flag the row (`class-disagreement`); the face value is drawn and the flag is printed.
 *  5. Fronts: a front differs from its series only on per-house fields (ground, door side, shop paint, basement), or on
 *     a field its face intent states for that house; every other differing reading is `overruled`.
 *  6. Read, not drawn: kit gaps, balconies, bay windows, bands, sampled hexes, face schema limits.
 */
import type { DescriberAnswer } from '../describer.ts';
import { JUDGED_PALETTE, judgeFront, variedTone, type JudgedFamily } from '../judgedColour.ts';
import {
  ROW_RECORD_VERSION, ROW_SOURCE_RANK, type ReadNotDrawn, type Overruled, type RowCorniceKind, type RowCrownKind, type RowDesign,
  type RowDesignKey, type RowDormerKind, type RowField, type RowFieldSource, type RowFlag, type RowFront, type RowGround, type RowGroundColour, type RowHeadDressing,
  type RowHeadShape, type RowHeads, type RowMember, type RowRecord, type RowRoofStorey, type RowRoofStoreyKind, type RowSeries, type RowWall,
  type RowWallMaterial, type RowWallOnly, type RowWindowKind,
} from './types.ts';

/** rowFront.ts ROW_FRONT_EXTRAS (kept as a copy so this module does not pull the mesher; row.test.ts pins the two equal). */
export const ROW_EXTRAS_DEFAULT: readonly string[] = ['window-sills', 'white-window-frames', 'door-surround', 'wall-anchors', 'plinth', 'downpipe'];
/** A storey standing behind the cornice when the only height is 3DBAG's (which reads the mansard): its height (m). */
export const ROOF_STOREY_M = 3.0;
const HELD_READ = /scaffold|netting|steiger|blue mesh/i;
/** A reader's `bands` -> the wall extras that draw them (lane R's names): read and drawn, not dropped. */
export const BAND_EXTRAS: Readonly<Record<string, string[]>> = {
  storey: ['floor-cornices'], lintel: ['string-courses'], both: ['floor-cornices', 'string-courses'], courses: ['string-courses'], speklagen: ['speklagen'],
};

// --- inputs -------------------------------------------------------------------------------------------------------------

/** What a face intent states for one house front (a module of a two-module pand is its own entry). */
export interface FaceFront {
  type?: string;
  /** A module front's share of the pand's street wall (the face's module share); absent = equal split. */
  share?: number;
  crown?: RowCrownKind;
  cornice?: RowCorniceKind;
  storeys?: number;
  bays?: number;
  windows?: RowWindowKind;
  heads?: RowHeads;
  wallMaterial?: RowWallMaterial;
  wallFamily?: JudgedFamily;
  roofKind?: RowRoofStoreyKind;
  roofMaterial?: RowRoofStorey['material'];
  dormers?: number;
  dormerKind?: RowDormerKind;
  /** The measured cornice top above the street ground (m). */
  corniceTopM?: number;
  ground?: RowGround;
  /** Sampled hexes the face carries (measuredPalette): reported, never drawn. */
  sampledHex?: string;
  /** The face's citation for the house (what the zoomed strip shows). */
  citation?: string;
  limits?: string[];
}
export interface MemberInput {
  pandId: string;
  label: string;
  numbers: number[];
  built: number | null;
  widthM: number | null;
  groundOffsetM?: number | null;
  /** 3DBAG height of the wall (m above the pand's ground), when no face measures the cornice. */
  height3dbag?: number | null;
  /** 3DBAG eaves of the pand (m above its ground, the game's decorated feature: threeBuildingMesh.ts wallTopHeightM), when no
   *  face measures the cornice: the wall top under a roof storey, so no roof-storey allowance is taken off it. */
  eaves3dbag?: number | null;
  /** Face statements per front (length 2 for a two-module pand). */
  face?: FaceFront[];
  read?: DescriberAnswer | null;
  readRef?: string;
  /** A read of an `extent: multi` capture that describes one module only (the re-read of 92-94 describes the right one):
   *  the index of that front, left to right as seen; the other fronts take their series and the face. */
  readFront?: number;
  /** The read is a re-read from another capture year, the first read having been held (scaffold, netting). */
  reread?: { panoId: string; captured: string; ref: string; firstRead: { ref: string; panoId?: string; captured?: string; held: string } };
  /** The measured wall colour of the reader's cut (canal belt rows: cuts.json w1 hex): judges a brick read's family. */
  wallSample?: string;
  /** The pand belongs to another street's face chunk: the row draws only this street's wall (RowMember.wallOnly). */
  wallOnly?: RowWallOnly;
}
export interface RowInput {
  id: string;
  street: string;
  side: RowRecord['side'];
  face?: string;
  faceRef?: string;
  members: MemberInput[];
  inputs: string[];
  solvedAt: string;
  /** Reviewed statements (a reviewer read the photo; precedence over everything): `scripts/house-specs/rows/reviewed.json`. */
  reviewed?: ReviewedStatement[];
  limits?: Array<{ fronts: string[]; component: string; what: string; ref: string }>;
}
/** `fronts`: front ids (`<pandId>` or `<pandId>#m1` for one module of a two-front pand). */
/** `add`: the value is a list merged into the field's current list (an extra the reviewer adds), not a replacement. */
/** `ground.colour` sets `front.ground.colour` (a RowGroundColour) on each listed front; it outranks a read and the face's shopPaint. */
export interface ReviewedStatement { fronts: string[]; field: RowDesignKey | 'ground.colour' | 'series'; value: unknown; ref: string; at: string; note?: string; add?: boolean }

// --- compatibility of classes (a face value and a read that name the same thing) ------------------------------------------

const COMPAT: Record<string, string[][]> = {
  cornice: [['heavy', 'bracketed'], ['frieze', 'attic-frieze'], ['simple', 'none']],
  windows: [['tall-upper', 't-window', 'sash', 'sash-1-over-1'], ['casement-toplight', 'casement']],
  heads: [['block-course', 'dentil-lintel', 'jack-blocks'], ['keystone'], ['segmental-tympanum'], ['stone-lintel'], ['arch-ring'], ['none']],
  dormerKind: [['pediment', 'gabled']],
  wallFamily: [['red-brown-brick', 'brown-brick', 'purple-brown-brick', 'orange-red-brick'], ['painted-white', 'cream-render', 'pale-grey-stucco'], ['buff-brick', 'sandstone']],
};
export function compatible(field: string, a: unknown, b: unknown): boolean {
  const ka = classKey(field, a), kb = classKey(field, b);
  if (ka === kb) return true;
  return (COMPAT[field] ?? []).some(g => g.includes(ka) && g.includes(kb));
}
function classKey(field: string, v: unknown): string {
  if (v && typeof v === 'object') {
    if (field === 'heads') return headsList(v as RowHeads | RowHeads[]).map(h => h.dressing).join('+');
    if (field === 'wall' || field === 'wallFamily') return (v as RowWall).family;
    return JSON.stringify(v);
  }
  return String(v);
}
const compatField = (k: string) => k === 'wall' ? 'wallFamily' : k;

// --- a reading in the row vocabulary ------------------------------------------------------------------------------------

const NV = 'not-visible';
const num = (v: unknown): number | undefined => typeof v === 'number' && Number.isFinite(v) ? v : undefined;
const WORD_N: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, a: 1, an: 1 };

/** The dormers a reading states: v4.3 `dormers`, else a gap sentence ("one pedimented dormer with a hoist beam"). */
export function readDormers(a: DescriberAnswer): { count: number; kind?: RowDormerKind; hoist?: boolean; from: string } | null {
  const d = a.dormers;
  const ornate = (a.gaps ?? []).find(g => /dormer/i.test(g.what) && /finial|pinnacle/i.test(g.what) && /wall dormer|rising out of the front|tall|ornate/i.test(g.what));
  if (d && d !== NV && typeof d === 'object') {
    if (ornate && d.kind !== 'none') return { count: d.count, kind: 'ornate-pinnacle', from: `dormers ${d.kind} + gap: ${ornate.what}` };
    return { count: d.kind === 'none' ? 0 : d.count, ...(d.kind !== 'none' ? { kind: d.kind as RowDormerKind } : {}), from: 'dormers' };
  }
  for (const g of a.gaps ?? []) {
    const m = /\b(one|two|three|four|an?|\d)\s+(?:[\w-]+\s+){0,3}?dormers?\b/i.exec(g.what);
    if (!m) continue;
    const count = WORD_N[m[1].toLowerCase()] ?? Number(m[1]);
    const kind: RowDormerKind = /finial|pinnacle/i.test(g.what) && /wall dormer|rising out of the front|tall|ornate/i.test(g.what) ? 'ornate-pinnacle' : /pediment/i.test(g.what) ? 'pediment' : /gable/i.test(g.what) ? 'gabled' : 'plain';
    return { count, kind, ...(/hoist/i.test(g.what) ? { hoist: true } : {}), from: `gap: ${g.what}` };
  }
  return null;
}
const CROWN_OF: Record<string, RowCrownKind> = { cornice: 'cornice', flat: 'cornice', mansard: 'cornice', 'pitched-eaves': 'cornice', neck: 'neck', 'raised-neck': 'neck', shouldered: 'neck', bell: 'bell', point: 'point', step: 'step', spout: 'spout' };
const DRESSING_OF: Record<string, RowHeadDressing> = {
  'dentil-lintel': 'dentil-lintel', 'block-dressings': 'block-course', 'jack-blocks': 'jack-blocks', keystone: 'keystone', 'eared-keystone': 'keystone',
  'stone-lintel': 'stone-lintel', 'full-frame': 'stone-lintel', sill: 'none', none: 'none',
};
/** A reading's head row: the upper storeys' head shape and dressing; relieving or segmental heads on some upper storeys
 *  read as a segmental head with a tympanum on those storeys. */
export function readHeads(a: DescriberAnswer): RowHeads | RowHeads[] | undefined {
  const up = (a.heads ?? []).slice(1);
  const arched = up.map((h, i) => (h === 'relieving' || h === 'segmental') ? i + 1 : 0).filter(Boolean);
  if (arched.length && arched.length < up.filter(h => h !== NV).length) return { shape: 'segmental', dressing: 'segmental-tympanum', storeys: arched };
  const shapes = up.filter(h => h !== NV);
  const shape = (mode(shapes.map(h => h === 'relieving' ? 'segmental' : h)) ?? 'flat') as string;
  const dressing = a.windowSurround && a.windowSurround !== NV ? DRESSING_OF[a.windowSurround] : undefined;
  if (!dressing) return undefined;
  const round = up.map((h, i) => h === 'round' ? i + 1 : 0).filter(Boolean), other = up.map((h, i) => h !== 'round' && h !== NV ? i + 1 : 0).filter(Boolean);
  if (round.length && other.length) {
    // Round heads on some storeys only (Weteringschans 171218's top storey): one entry per head kind, each with its storeys.
    // A round head is `arch-ring` only when the reader names the ring; the other storeys keep the read surround.
    const ring = (a.gaps ?? []).some(g => /arch[- ]ring|arched .*ring|ring[s]? .*keystone/i.test(g.what));
    return [{ shape: 'flat', dressing, storeys: other }, { shape: 'round', dressing: ring ? 'arch-ring' : 'none', storeys: round }];
  }
  // A gap that names the storey of the dressing ("a crown of small white blocks stepped over each first-storey window head")
  // restricts it to that storey; the other storeys keep plain heads.
  const on = dressingStoreys(a, dressing);
  return { shape: (['flat', 'segmental', 'round', 'relieving'].includes(shape) ? shape : 'flat') as RowHeadShape, dressing, ...(on ? { storeys: on } : {}) };
}
const STOREY_WORD: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4 };
const DRESSING_WORDS: Partial<Record<RowHeadDressing, RegExp>> = { 'jack-blocks': /blocks?/i, 'stone-lintel': /lintel/i, keystone: /keystone/i, 'dentil-lintel': /dentil|cogged/i };
/** Storeys a gap names for a head dressing (1 = the first storey above the ground), else undefined. */
export function dressingStoreys(a: DescriberAnswer, dressing: RowHeadDressing): number[] | undefined {
  const w = DRESSING_WORDS[dressing];
  if (!w) return undefined;
  for (const g of a.gaps ?? []) {
    if (!w.test(g.what) || !/head|lintel|over each/i.test(g.what)) continue;
    const m = [...g.what.matchAll(/\b(first|second|third|fourth)[- ]storey/gi)].map(x => STOREY_WORD[x[1].toLowerCase()]);
    if (m.length && !/top storey/i.test(g.what)) return [...new Set(m)];
  }
  return undefined;
}
/** The storeys a gap places a balcony on ("on the centre axis of the first storey", "in front of the centre first-storey window"). */
export function balconyOf(a: DescriberAnswer): { storeys: number[]; axis: 'centre' | 'all'; what: string } | null {
  for (const g of a.gaps ?? []) {
    if (!/balcon/i.test(g.what)) continue;
    const m = [...g.what.matchAll(/\b(first|second|third|fourth)[- ]storey/gi)].map(x => STOREY_WORD[x[1].toLowerCase()]);
    if (m.length) return { storeys: [...new Set(m)], axis: /centre|center|middle/i.test(g.what) ? 'centre' : 'all', what: g.what };
  }
  return null;
}
/** A heads value as a list (a front may state one head kind per storey group). */
export const headsList = (v: RowHeads | RowHeads[] | null | undefined): RowHeads[] => v == null ? [] : Array.isArray(v) ? v : [v];
/** Wall extras a reading's kit gaps state that the row kit draws (lane R round 2): read and drawn. */
export const GAP_EXTRAS: ReadonlyArray<{ id: string; test: RegExp }> = [
  { id: 'row-balcony', test: /balcon/i },
  { id: 'row-porch', test: /(?:door|entrance)[^.]*(?:aedicule|pediment|porch|surround)|(?:aedicule|porch)[^.]*(?:door|entrance)/i },
  { id: 'row-rustication', test: /(?:rough|rusticat)[^.]*(?:souterrain|basement|plinth)|(?:souterrain|basement|plinth)[^.]*(?:rough stone|rusticat)/i },
];
export function gapExtras(a: DescriberAnswer): Array<{ id: string; what: string }> {
  const out: Array<{ id: string; what: string }> = [];
  for (const g of a.gaps ?? []) for (const x of GAP_EXTRAS) if (x.test.test(g.what) && !out.some(o => o.id === x.id)) out.push({ id: x.id, what: g.what });
  return out;
}
export interface ReadValues { [k: string]: unknown }
/** The class and metre values one reading states, in the row vocabulary (undefined = not stated). */
export function readValues(a: DescriberAnswer, year: number | null, sample?: string): Partial<Record<RowDesignKey, unknown>> & { dormers?: ReturnType<typeof readDormers>; roofKind?: RowRoofStoreyKind; bands?: string[] } {
  const out: ReturnType<typeof readValues> = {};
  if (a.crown && a.crown !== NV) out.crown = CROWN_OF[a.crown];
  if (a.cornice && a.cornice !== NV) out.cornice = a.cornice;
  if (num(a.storeys)) out.storeys = a.storeys;
  if (num(a.bays) && (a.bays as number) > 0) out.bays = a.bays;
  if (a.windows && a.windows !== NV) out.windows = a.windows;
  const h = readHeads(a); if (h) out.heads = h;
  if (typeof a.whiteFrames === 'boolean') out.whiteFrames = a.whiteFrames;
  if (a.sills && a.sills !== NV) out.sills = a.sills !== 'none';
  if (a.finish && a.finish !== NV) {
    const j = judgeFront({ pandId: a.pandId, readable: a.readable, finish: a.finish, pale: (a as { pale?: boolean }).pale ?? null, notes: a.notes ?? null, year, ...(sample ? { sample, absolute: true } : {}) });
    out.wall = { material: a.finish as RowWallMaterial, family: j.family, hex: '' } satisfies RowWall;
  }
  const roof = a.storeyParts?.roof;
  if (roof === 'mansard' || a.crown === 'mansard') out.roofKind = 'mansard';
  else if (roof === 'attic') out.roofKind = 'attic';
  else if (roof === 'none') out.roofKind = 'none';
  const d = readDormers(a); if (d) out.dormers = d;
  if (a.bands && BAND_EXTRAS[a.bands]) out.bands = BAND_EXTRAS[a.bands];
  return out;
}

// --- helpers --------------------------------------------------------------------------------------------------------------

function mode<T>(xs: T[]): T | undefined {
  const c = new Map<string, { v: T; n: number; first: number }>();
  xs.forEach((v, i) => { const k = JSON.stringify(v); const e = c.get(k); if (e) e.n++; else c.set(k, { v, n: 1, first: i }); });
  return [...c.values()].sort((a, b) => b.n - a.n || a.first - b.first)[0]?.v;
}
function votes<T>(xs: T[]): Array<{ value: T; n: number }> {
  const c = new Map<string, { value: T; n: number }>();
  for (const v of xs) { const k = JSON.stringify(v); const e = c.get(k); if (e) e.n++; else c.set(k, { value: v, n: 1 }); }
  return [...c.values()].sort((a, b) => b.n - a.n);
}
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const r2 = (v: number) => Math.round(v * 100) / 100;
const PERIOD: { [K in RowDesignKey]?: NonNullable<RowDesign[K]>['value'] } = {
  crown: 'cornice', cornice: 'simple', windows: 'tall-upper', whiteFrames: true, sills: true,
  heads: { shape: 'flat', dressing: 'none' },
};

// --- the solve ------------------------------------------------------------------------------------------------------------

interface Ev { front: RowFront; face?: FaceFront; read?: ReturnType<typeof readValues>; readRef?: string; member: MemberInput; frontsOfPand: number }

export function splitCount(m: MemberInput, rowBays: number | null, rowWidth: number | null): { n: number; why?: string } {
  if ((m.face?.length ?? 0) >= 2) return { n: m.face!.length, why: 'face intent modules' };
  // A face that states one front is the description: a wide reading never splits it (Kinkerstraat 244-248, the 1985 infill).
  if (m.face?.length === 1) return { n: 1 };
  const b = num(m.read?.bays);
  if (b && rowBays && m.numbers.length >= 2 && b >= 2 * rowBays && m.widthM && rowWidth && m.widthM >= 1.6 * rowWidth)
    return { n: 2, why: `read ${b} bays on ${m.widthM} m against the row's ${rowBays} on ${rowWidth} m, two numbers` };
  return { n: 1 };
}

export function solveRow(input: RowInput): RowRecord {
  const flags: RowFlag[] = [], readNotDrawn: ReadNotDrawn[] = [], overruled: Overruled[] = [];
  const members: RowMember[] = [], fronts: RowFront[] = [], evs: Ev[] = [];
  const readsOk = input.members.filter(m => m.read && !heldReason(m.read));
  const rowBays = readsOk.length ? mode(readsOk.map(m => num(m.read!.bays)).filter((b): b is number => !!b)) ?? null : null;
  const widths = input.members.map(m => m.widthM).filter((w): w is number => !!w);
  const rowWidth = widths.length ? median(widths) : null;
  const firstN = input.members[0]?.numbers[0], lastN = input.members[input.members.length - 1]?.numbers[0];
  const descending = firstN !== undefined && lastN !== undefined && firstN > lastN;

  for (const m of input.members) {
    const held = m.read ? heldReason(m.read) : null;
    const { n, why } = splitCount(m, rowBays, rowWidth);
    if (n >= 2 && !m.face?.length && m.read?.extent === 'single') flags.push({ kind: 'extent-mismatch', field: 'extent', fronts: [m.pandId], detail: `read extent single, split into ${n} fronts: ${why}` });
    else if (n >= 2 && m.read?.extent === 'single' && num(m.read.bays) && (m.read.bays as number) >= 2 * (rowBays ?? 99))
      flags.push({ kind: 'extent-mismatch', field: 'extent', fronts: [m.pandId], detail: `read extent single with ${m.read.bays} bays; ${why}: ${n} fronts` });
    const ids = n === 1 ? [m.pandId] : Array.from({ length: n }, (_, i) => `${m.pandId}#m${i}`);
    const nums = [...m.numbers].sort((a, b) => descending ? b - a : a - b);
    members.push({ pandId: m.pandId, label: m.label, numbers: m.numbers, built: m.built, widthM: m.widthM, fronts: ids, ...(m.wallOnly ? { wallOnly: m.wallOnly } : {}) });
    const readVals = m.read && !held ? readValues(m.read, m.built, m.wallSample) : undefined;
    if (m.reread) flags.push({ kind: 'reread', fronts: ids, detail: `re-read from the ${m.reread.captured} capture ${m.reread.panoId} (${m.reread.ref}); the first read (${m.reread.firstRead.captured ?? '?'} ${m.reread.firstRead.ref}) was held: ${m.reread.firstRead.held}${m.readFront !== undefined ? `; it describes front ${m.readFront + 1} of ${n} only` : ''}` });
    if (held) {
      flags.push({ kind: 'scaffold', fronts: ids, detail: `reading not used: ${held}; queued for a re-read from another capture year (scripts/house-specs/rows/reread-queue.ts)` });
      readNotDrawn.push({ front: m.pandId, field: 'reading', value: m.readRef ?? m.read!.image?.ref, reason: `held: ${held}; the front takes its series` });
    }
    // Module shares from the face (Kinkerstraat 126-138: two narrow gable axes among wider modules); else an equal split.
    const shares = m.face?.length === n && m.face.every(f => typeof f.share === 'number' && f.share > 0) ? m.face.map(f => f.share!) : Array.from({ length: n }, () => 1);
    const total = shares.reduce((a, b) => a + b, 0);
    const cut = shares.reduce<number[]>((acc, x) => [...acc, acc[acc.length - 1] + x / total], [0]);
    ids.forEach((id, i) => {
      const face = m.face?.[i];
      const label = n === 1 ? m.label : `${input.street} ${nums[i] ?? `${m.numbers.join('–')} (${i + 1}/${n})`}`;
      const front: RowFront = {
        id, pandId: m.pandId, label, numbers: n === 1 ? m.numbers : nums[i] !== undefined ? [nums[i]] : m.numbers,
        ...(n > 1 ? { sub: { index: i, of: n, a0: r2(cut[i]), a1: r2(cut[i + 1]) } } : {}),
        widthM: m.widthM === null ? null : r2(m.widthM * (cut[i + 1] - cut[i])), seriesId: '', ground: face?.ground ?? groundOfRead(m.read && !held ? m.read : null),
        overrides: {}, groundOffsetM: m.groundOffsetM ?? null, topM: null, ...(held ? { readHeld: held } : {}),
        ...(m.readFront !== undefined && m.readFront !== i ? { readElsewhere: `the read describes front ${m.readFront + 1} of ${n} only` } : {}),
      };
      // The pui colour is read from the ground storey, which a scaffold over the upper front does not hide.
      const gc = m.read ? groundColourOfRead(m.read) : null;
      if (gc) front.ground = { ...front.ground, colour: { value: gc.value, source: 'single-read', ref: `${m.readRef ?? m.read!.image?.ref ?? m.pandId}: "${gc.phrase}"` } };
      const one = m.read && !held && m.read.ground === 'shopfront' ? oneShopfront(m.read) : null;
      if (one && front.ground.use !== 'dwelling') front.ground = { ...front.ground, shopUnits: { value: 1, source: 'single-read', ref: `${m.readRef ?? m.pandId}: "${one}"` } };
      fronts.push(front);
      evs.push({ front, face, read: m.readFront === undefined || m.readFront === i ? readVals : undefined, readRef: m.readRef, member: m, frontsOfPand: n });
    });
    if (m.read && !held) for (const r of notDrawnOfRead(m.read)) readNotDrawn.push({ front: m.pandId, ...r });
    for (const f of m.face ?? []) {
      if (f.sampledHex) readNotDrawn.push({ front: m.pandId, field: 'measuredPalette.brick', value: f.sampledHex, reason: 'a sampled hex is never drawn: the wall is the series judged family' });
      for (const l of f.limits ?? []) readNotDrawn.push({ front: m.pandId, field: 'face schemaLimit', value: l, reason: 'kit cannot say it (face intent)' });
    }
  }
  dedupeNotDrawn(readNotDrawn);

  // Series partition.
  const sampled = input.members.some(m => m.wallSample);
  const sig = (e: Ev): string | null => {
    if (e.face) {
      const f = e.face;
      if (!f.heads && !f.type) return null;
      return JSON.stringify([f.type, f.heads?.dressing ?? null, f.heads?.storeys ?? null, f.dormers ?? null, f.crown ?? null]);
    }
    if (!e.read) return null;
    const r = e.read;
    const cornice = r.cornice === undefined ? null : (COMPAT.cornice.find(g => g.includes(String(r.cornice)))?.[0] ?? r.cornice);
    const shapes = headsList(r.heads as RowHeads | RowHeads[] | undefined).map(h => h.shape).sort().join('+') || null;
    const key = [r.crown ?? null, cornice, r.roofKind ?? null, r.storeys ?? null, e.frontsOfPand > 1 ? Math.round((r.bays as number) / e.frontsOfPand) : r.bays ?? null, shapes];
    // Rows of measured cuts (the canal belt): a front never shares a series with another wall family, so the series wall
    // never repaints a front (Herengracht 56 brick beside 58 painted dark; 26 buff beside 32 purple-brown).
    if (sampled) key.push(String((r.wall as RowWall | undefined)?.family ?? null));
    return JSON.stringify(key);
  };
  // A face front that states the type but no head joins its neighbour (rule 2: unstated takes the series value) - the
  // nearest one that states the same type, dormers and crown: only the head is unstated. A different type or crown is a
  // statement, not a gap (Kinkerstraat 31-49, round 2: the 1893 neo-renaissance corner 49 and the dormerless 31 had
  // joined the keystone series of 33-47 and drawn its dormer).
  const stated = (e: Ev) => e.face ? JSON.stringify([e.face.type, e.face.dormers ?? null, e.face.crown ?? null]) : null;
  const keys = evs.map(e => e.face && !e.face.heads && evs.some(o => o !== e && o.face?.heads) ? null : sig(e));
  const joined = keys.map((k, i) => {
    if (k !== null) return k;
    // No face and no usable reading (canal belt: no cut, or a held read): nothing is stated, so the front draws the plain
    // period default on its own - never a neighbour's design (Herengracht 82, a 1905 front beside 1615 neck gables).
    if (!evs[i].face && !evs[i].read) return `unread:${evs[i].front.id}`;
    const like = (j: number) => keys[j] !== null && stated(evs[j]) === stated(evs[i]);
    const order = [...Array(keys.length).keys()].filter(j => j !== i).sort((a, b) => Math.abs(a - i) - Math.abs(b - i) || a - b);
    const j = order.find(like);
    return j !== undefined ? keys[j]! : sig(evs[i]) ?? 'none';
  });
  keys.splice(0, keys.length, ...joined);
  // A reviewed `series` statement: the listed fronts are one design of their own (Kinkerstraat 138-134, the left building
  // of pand 233461: a lower cornice and plainer windows than the gabled right building it shares a face type with).
  for (const st of input.reviewed ?? []) if (st.field === 'series') evs.forEach((e, i) => { if (st.fronts.includes(e.front.id)) keys[i] = `${keys[i]}|series:${String(st.value)}`; });
  const seriesKeys: string[] = [];
  for (const k of keys) if (!seriesKeys.includes(k!)) seriesKeys.push(k!);
  const series: RowSeries[] = seriesKeys.map((k, si) => {
    const id = `${input.id}/s${si + 1}`;
    const ev = evs.filter((_, i) => keys[i] === k);
    ev.forEach(e => { e.front.seriesId = id; });
    const design = solveSeries(id, ev, input, flags, evs);
    const type = ev.find(e => e.face?.type)?.face?.type;
    const runs = runsOf(evs.map((_, i) => keys[i] === k));
    return { id, label: `${type ?? 'read series'}${headsList(design.heads.value).some(h => h.dressing !== 'none') ? `, ${headsList(design.heads.value).map(h => h.dressing).join(' + ')} heads` : ''}${design.roofStorey.value.dormersPerFront ? `, ${design.roofStorey.value.dormersPerFront} ${design.roofStorey.value.dormerKind ?? ''} dormer` : ''}${runs > 1 ? ` (${runs} runs)` : ''}`,
      ...(type ? { type } : {}), fronts: ev.map(e => e.front.id), design };
  });

  // Fronts against their series.
  for (const e of evs) {
    const s = series.find(x => x.id === e.front.seriesId)!;
    for (const [k, v] of Object.entries(e.read ?? {})) {
      if (k === 'bands') continue;
      const key = k === 'roofKind' || k === 'dormers' ? 'roofStorey' : k as RowDesignKey;
      const drawn = s.design[key]?.value;
      if (drawn === undefined) continue;
      const read = k === 'roofKind' ? v : k === 'dormers' ? (v as { count: number }).count / e.frontsOfPand : k === 'bays' && e.frontsOfPand > 1 ? (v as number) / e.frontsOfPand : v;
      const drawnCmp = k === 'roofKind' ? (drawn as RowRoofStorey).kind : k === 'dormers' ? (drawn as RowRoofStorey).dormersPerFront : drawn;
      if (k === 'wall' ? compatible('wallFamily', read, drawnCmp) && (read as RowWall).material === (drawnCmp as RowWall).material : k === 'heads' ? sameHeads(read as RowHeads | RowHeads[], drawnCmp as RowHeads | RowHeads[]) : JSON.stringify(read) === JSON.stringify(drawnCmp)) continue;
      const cf = k === 'roofKind' ? 'roofStorey' : k === 'dormers' ? 'dormers' : compatField(k);
      const same = typeof read !== 'number' && compatible(cf, read, drawnCmp);
      overruled.push({ front: e.front.id, field: k, read, drawn: drawnCmp, by: s.design[key]!.source,
        why: same ? `compatible class (${classKey(cf, read)} ~ ${classKey(cf, drawnCmp)}): the series' word is drawn` : `series ${s.id} (${s.design[key]!.ref})` });
    }
    // Per-house reads drawn on the front: its own bands (as extras) and a hoist in its dormer.
    const ownBands = (e.read?.bands ?? []).filter(b => !s.design.extras.value.includes(b));
    const ownGaps = e.read && e.member.read ? gapExtras(e.member.read).filter(x => !s.design.extras.value.includes(x.id)) : [];
    if (ownBands.length || ownGaps.length) e.front.overrides.extras = { value: [...s.design.extras.value, ...ownBands, ...ownGaps.map(x => x.id)], source: 'single-read',
      ref: [ownBands.length ? `${e.member.pandId} reading: bands ${e.member.read?.bands}` : '', ...ownGaps.map(x => `${x.id} from the gap "${x.what}"`)].filter(Boolean).join('; ') };
    const bal = e.read && e.member.read && e.front.overrides.extras?.value.includes('row-balcony') ? balconyOf(e.member.read) : null;
    if (bal) e.front.overrides.balcony = { value: { storeys: bal.storeys, axis: bal.axis }, source: 'single-read', ref: `${e.member.pandId} gap "${bal.what}"` };
    const rsv = s.design.roofStorey.value;
    if (e.read?.dormers?.hoist && !rsv.hoist && rsv.dormersPerFront > 0)
      e.front.overrides.roofStorey = { value: { ...rsv, hoist: true }, source: 'single-read', ref: `${e.member.pandId} reading: ${e.read.dormers.from}` };
    // An ornate wall dormer (pediment and finial) on one house of a series: a member difference, drawn on the front when two
    // readings say it (the D1 gap, and the face's citation of a larger or ornate dormer; without a face, the reading alone).
    const ornateFace = !e.face || /larger|ornate|tall|pinnacle|finial/i.test(e.face.citation ?? '');
    if (e.read?.dormers?.kind === 'ornate-pinnacle' && rsv.dormerKind !== 'ornate-pinnacle' && rsv.dormersPerFront > 0 && ornateFace)
      e.front.overrides.roofStorey = { value: { ...(e.front.overrides.roofStorey?.value ?? rsv), dormerKind: 'ornate-pinnacle' }, source: e.face ? 'face-intent' : 'single-read',
        ref: `${e.member.pandId} reading: ${e.read.dormers.from}${e.face?.citation ? `; face: ${e.face.citation}` : ''}` };
    if (e.face) {
      // A face statement for this house that differs from the series (a head variant inside a type) is drawn on the front.
      const fh = e.face.heads;
      if (fh && !sameHeads(fh, s.design.heads.value)) e.front.overrides.heads = { value: fh, source: 'face-intent', ref: `${input.faceRef ?? input.face} houses[${e.member.pandId}]` };
    }
    const top = s.design.corniceTopM.value;
    e.front.topM = top === null ? null : r2(top - (e.front.groundOffsetM ?? 0));
  }
  // A face head restricted to some storeys (Kinkerstraat 90: segmental tympana on storeys 1-2) says nothing about the others.
  // The upper storeys it leaves out take the series' readings when they agree: the read's head shape on that storey, with a
  // keystone when the read's surround is a keystone (90: flat heads with a white keystone on storey 3, face "flat heads on storey 3").
  for (const s of series) {
    const hv = s.design.heads;
    if (hv.source !== 'face-intent' || Array.isArray(hv.value) || !hv.value.storeys?.length) continue;
    const covered = new Set(hv.value.storeys);
    const reads = evs.filter(e => e.front.seriesId === s.id && e.member.read && !e.front.readHeld && Array.isArray(e.member.read.heads) && e.member.read.heads.length > 1);
    if (!reads.length) continue;
    // The shapes must agree. The dressing is the reads' surround by vote; a read of a multi-front capture (it may mix in the
    // other module's dressing) weighs half, so 90's single-front keystone outranks 92's multi re-read's jack-blocks.
    const shapes = (e: Ev) => (e.member.read!.heads as string[]).slice(1).map((h, k) => covered.has(k + 1) ? null : h);
    const first = JSON.stringify(shapes(reads[0]));
    if (!reads.every(e => JSON.stringify(shapes(e)) === first)) continue;
    const tally = new Map<string, number>();
    for (const e of reads) { const w = e.member.read!.extent === 'multi' ? 0.5 : 1, d = e.member.read!.windowSurround === 'keystone' ? 'keystone' : 'none'; tally.set(d, (tally.get(d) ?? 0) + w); }
    const dressingOf = [...tally].sort((x, y) => y[1] - x[1])[0][0] as RowHeadDressing;
    const extra: RowHeads[] = [];
    shapes(reads[0]).forEach((shape0, k) => {
      if (!shape0) return;
      const shape = shape0 as RowHeadShape, dressing = dressingOf;
      if (shape !== 'flat' && shape !== 'segmental' && shape !== 'round') return;
      const same = extra.find(x => x.shape === shape && x.dressing === dressing);
      if (same) same.storeys!.push(k + 1); else extra.push({ shape, dressing, storeys: [k + 1] });
    });
    if (!extra.length) continue;
    const cites = reads.map(e => e.face?.citation).filter((c): c is string => !!c).sort((x, y) => Number(/flat heads on storey/i.test(y)) - Number(/flat heads on storey/i.test(x)));
    s.design.heads = { ...hv, value: [hv.value, ...extra], ref: `${hv.ref}; storeys ${extra.flatMap(x => x.storeys).join(',')} from ${reads.map(e => `${e.member.pandId} reading${e.member.read!.extent === 'multi' ? ' (multi, half weight)' : ''} heads ${JSON.stringify(e.member.read!.heads)} surround ${e.member.read!.windowSurround}`).join('; ')}${cites.length ? `; face: ${cites[0]}` : ''}` };
  }
  // Reviewed statements: a series whose fronts all fall in the statement takes the value; otherwise each listed front does.
  for (const st of input.reviewed ?? []) {
    const ref = `${st.ref} (${st.at})${st.note ? `: ${st.note}` : ''}`;
    if (st.field === 'ground.colour') {
      const inside = fronts.filter(f => st.fronts.includes(f.id));
      for (const f of inside) {
        const was = f.ground.colour?.value ?? (f.ground.shopPaint ? `face shopPaint ${f.ground.shopPaint}` : null);
        f.ground = { ...f.ground, colour: { value: st.value as RowGroundColour, source: 'reviewed', ref } };
        if (was !== st.value) flags.push({ kind: 'reviewed', field: 'ground.colour', fronts: [f.id], detail: `reviewed ${JSON.stringify(st.value)} overrides ${was ?? 'no reading'}${f.ground.shopPaint ? ': the face intent shopPaint needs correcting' : ''}` });
      }
      continue;
    }
    if (st.field === 'series') continue;
    const field = st.field;
    const merged = (cur: unknown) => ({ value: st.add && Array.isArray(cur) ? [...cur, ...(st.value as unknown[]).filter(x => !cur.includes(x))] : st.value, source: 'reviewed' as const, ref });
    for (const s of series) {
      const fs = fronts.filter(f => f.seriesId === s.id), inside = fs.filter(f => st.fronts.includes(f.id));
      if (!inside.length) continue;
      const was = s.design[field] as RowField<unknown> | undefined;
      const sd = s.design as unknown as Record<string, RowField<unknown>>;
      if (inside.length === fs.length) sd[field] = merged(was?.value);
      // A front's own value (a read override) is outranked too: the reviewed value goes on the front, over its own.
      for (const f of inside) {
        const fo = f.overrides as Record<string, RowField<unknown>>;
        if (fo[field] || inside.length !== fs.length) fo[field] = merged((fo[field] ?? was)?.value);
      }
      if (was && JSON.stringify(was.value) !== JSON.stringify(st.value))
        flags.push({ kind: 'reviewed', field: field, fronts: inside.map(f => f.id), detail: `reviewed ${st.add ? 'adds ' : ''}${JSON.stringify(st.value)} ${st.add ? 'to' : 'overrides'} ${was.source} ${JSON.stringify(was.value)} (${was.ref}): the ${was.source === 'face-intent' ? 'face intent' : 'source'} needs correcting` });
      // A reviewed cornice line moves the fronts' tops with it (Kinkerstraat 126-138: the gable axes' line, not their apex).
      if (field === 'corniceTopM') for (const f of inside) f.topM = st.value === null ? null : r2((st.value as number) - (f.groundOffsetM ?? 0));
    }
  }
  if (fronts.some(f => f.groundOffsetM === null || f.groundOffsetM === undefined))
    flags.push({ kind: 'no-reading', field: 'groundOffsetM', fronts: fronts.filter(f => f.groundOffsetM == null).map(f => f.id), detail: 'no street ground: topM is the series line above the pand ground (offset 0 assumed)' });

  const schemaLimits = (input.limits ?? []).flatMap(l => l.fronts.filter(id => fronts.some(f => f.id === id)).map(front => ({ front, component: l.component, what: l.what, ref: l.ref })));
  return { v: ROW_RECORD_VERSION, id: input.id, street: input.street, side: input.side, ...(input.face ? { face: input.face } : {}), members, fronts, series, flags, readNotDrawn, overruled, ...(schemaLimits.length ? { schemaLimits } : {}), inputs: input.inputs, solvedAt: input.solvedAt };
}

const sameHeads = (a: RowHeads | RowHeads[], b: RowHeads | RowHeads[]) => { const x = headsList(a), y = headsList(b); return x.length === y.length && x.every((h, i) => h.dressing === y[i].dressing && h.shape === y[i].shape && JSON.stringify(h.storeys ?? null) === JSON.stringify(y[i].storeys ?? null)); };
const runsOf = (mask: boolean[]) => mask.reduce((n, v, i) => n + (v && !mask[i - 1] ? 1 : 0), 0);
export function heldReason(a: DescriberAnswer): string | null {
  const text = [a.notes ?? '', ...(a.gaps ?? []).map(g => g.what)].join(' ');
  const m = HELD_READ.exec(text);
  return m ? `the reading mentions ${m[0].toLowerCase()}: "${(a.notes ?? text).slice(0, 140)}"` : null;
}
const GROUND_COLOUR_WORDS: Array<[RegExp, RowGroundColour]> = [
  [/^(dark|black|charcoal|anthracite|dark[- ]grey|grey-black)$/, 'dark'],
  [/^(light|pale|cream|light[- ]grey|beige)$/, 'light'],
  [/^(white|white-painted)$/, 'white'],
  [/^(green|dark[- ]green|bottle[- ]green)$/, 'green'],
  [/^(red|dark[- ]red|maroon|oxblood|red[- ]and[- ]white)$/, 'red'],
  [/^(timber|wooden|wood|oak|varnished)$/, 'timber'],
];
/**
 * The shopfront colour a reading names: a colour word directly before shopfront / shop front / pui / shutter in a
 * shopfront gap or the notes (`the dark shopfront`). `painted timber` says paint without a colour, so it is not read.
 */
export function groundColourOfRead(a: DescriberAnswer): { value: RowGroundColour; phrase: string } | null {
  const texts = [...(Array.isArray(a.gaps) ? a.gaps.filter(g => g.component === 'shopfront' || g.component === 'ground').map(g => g.what) : []), typeof a.notes === 'string' ? a.notes : ''];
  const re = /\b((?:painted\s+)?(?:[a-z]+[- ]and[- ])?[a-z]+(?:[- ](?:grey|green|red))?)(?:-(?:framed|painted))?\s+(?:painted\s+)?(shop ?fronts?|puis?|shutters?)\b/gi;
  for (const t of texts) for (const mt of t.matchAll(re)) {
    const word = mt[1].toLowerCase();
    if (word.startsWith('painted ')) continue;
    const hit = GROUND_COLOUR_WORDS.find(([w]) => w.test(word));
    if (hit) return { value: hit[1], phrase: mt[0] };
  }
  return null;
}

/** A reading that describes ONE shopfront (a shopfront gap starting "a" / "one", not "two" or "shops"): its sentence. */
export function oneShopfront(a: DescriberAnswer): string | null {
  const g = (Array.isArray(a.gaps) ? a.gaps : []).find(x => x.component === 'shopfront' && /^(a|an|one)\b[^.]*\bshop ?front\b/i.test(x.what) && !/\b(two|three|several|shops|units)\b/i.test(x.what));
  return g?.what ?? null;
}

function groundOfRead(a: DescriberAnswer | null): RowGround {
  if (!a) return { use: 'other' };
  const use: RowGround['use'] = a.ground === 'shopfront' ? 'shop' : a.ground === 'dwelling' ? 'dwelling' : a.ground === 'warehouse' ? 'warehouse' : 'other';
  const doorSide = a.doorBay === 'left' || a.doorBay === 'right' || a.doorBay === 'several' || a.doorBay === 'none' ? a.doorBay : a.doorBay === 'centre' || a.doorBay === 'off-centre' ? 'centre' as const : undefined;
  const basement = a.basement === 'stoop-and-windows' ? 'stoop-and-windows' as const : a.basement === 'windows' ? 'windows' as const : a.basement === 'stoop' ? 'stoop' as const
    : a.basement === 'none' ? 'none' as const : a.souterrain ? 'souterrain' as const : undefined;
  return { use, ...(doorSide ? { doorSide } : {}), ...(Number.isInteger(a.doorIndex) ? { doorIndex: a.doorIndex as number } : {}), ...(Number.isInteger(a.groundBays) ? { groundBays: a.groundBays } : {}), ...(basement ? { basement } : {}) };
}
/** Fields a reading states that the row design has no place for (programme rule 3). */
function notDrawnOfRead(a: DescriberAnswer): Array<Omit<ReadNotDrawn, 'front'>> {
  const out: Array<Omit<ReadNotDrawn, 'front'>> = [];
  if (Array.isArray(a.balconies) && a.balconies.length) out.push({ field: 'balconies', value: a.balconies, reason: 'not on the row allow-list: a balcony needs a reviewed statement (ROW_FRONT_EXTRAS)' });
  if (Array.isArray(a.bayWindow) && a.bayWindow.length) out.push({ field: 'bayWindow', value: a.bayWindow, reason: 'not on the row allow-list (the oriel dice drew the Kinkerstraat centre strip)' });
  if (a.bands && a.bands !== NV && a.bands !== 'none' && !BAND_EXTRAS[a.bands]) out.push({ field: 'bands', value: a.bands, reason: 'the row design has no band field; the head dressing carries the white course' });
  if (a.cornice === 'frieze' || a.cornice === 'attic-frieze') out.push({ field: 'cornice', value: a.cornice, reason: 'drawn as the series cornice; the frieze panels are not drawn' });
  if (a.doorSurround === true) out.push({ field: 'doorSurround', value: true, reason: 'door-surround is on the allow-list; its shape is not described' });
  for (const g of a.gaps ?? []) {
    const drawnBy = GAP_EXTRAS.find(x => x.test.test(g.what));
    out.push({ field: `gap:${g.component}`, value: g.what, reason: drawnBy ? `drawn as ${drawnBy.id} (its ornament detail is not)` : 'kit gap (the kit cannot say it)' });
  }
  return out;
}
function dedupeNotDrawn(xs: ReadNotDrawn[]): void {
  const seen = new Set<string>();
  for (let i = xs.length - 1; i >= 0; i--) { const k = JSON.stringify(xs[i]); if (seen.has(k)) xs.splice(i, 1); else seen.add(k); }
}

function field<T>(value: T, source: RowFieldSource, ref: string, extra: Partial<RowField<T>> = {}): RowField<T> { return { value, source, ref, ...extra }; }

/** One class field of a series: face mode > read consensus (2+ reads) > single read > period default; flags a face/read class disagreement. */
function classField<T>(key: string, faceVals: T[], readVals: T[], faceRef: string, readRef: string, flags: RowFlag[], frontIds: string[], period: T | undefined, periodRef = 'period default'): RowField<T> | undefined {
  const rv = votes(readVals), rMode = rv[0]?.value;
  if (faceVals.length) {
    const v = mode(faceVals) as T;
    if (rMode !== undefined && !compatible(compatField(key), v, rMode) && rv[0].n >= 2)
      flags.push({ kind: 'class-disagreement', field: key, fronts: frontIds, detail: `face intent ${JSON.stringify(classKey(key, v))} vs D1 consensus ${JSON.stringify(classKey(key, rMode))} (${rv[0].n} of ${readVals.length} reads): face drawn, needs a second look` });
    return field<T>(v, 'face-intent', faceRef, readVals.length ? { votes: rv } : {});
  }
  if (readVals.length >= 2) {
    if (rv.length > 1 && rv[0].n === rv[1].n) flags.push({ kind: 'weak-consensus', field: key, fronts: frontIds, detail: `tie ${rv.map(x => `${JSON.stringify(classKey(key, x.value))} x${x.n}`).join(', ')}: the confident read (else the first in street order) is drawn` });
    const v = (rv.length > 1 && rv[0].n === rv[1].n ? readVals[0] : rMode) as T;
    return field<T>(v, 'series-consensus', readRef, { votes: rv });
  }
  if (readVals.length === 1) return field<T>(readVals[0], 'single-read', readRef);
  return period === undefined ? undefined : field<T>(period, 'period-default', periodRef);
}

function solveSeries(id: string, ev: Ev[], input: RowInput, flags: RowFlag[], all: Ev[]): RowDesign {
  const faceRef = `${input.faceRef ?? input.face ?? 'face'}`;
  const ids = ev.map(e => e.front.id);
  const readRef = 'D1 answers: ' + [...new Set(ev.filter(e => e.read).map(e => e.member.pandId))].join(',');
  const F = <K extends keyof FaceFront>(k: K) => ev.map(e => e.face?.[k]).filter((v): v is NonNullable<FaceFront[K]> => v !== undefined);
  // Reads in street order, those the reader marked low-confidence last (a tie goes to a confident read).
  const lowOf = (e: Ev, k: string) => (e.member.read?.low ?? []).some(l => l === k || (k === 'heads' && (l === 'windowSurround' || l === 'heads')) || (k === 'wall' && l === 'finish'));
  const R = (k: string) => [...ev].sort((a, b) => Number(lowOf(a, k)) - Number(lowOf(b, k))).map(e => e.read?.[k as RowDesignKey]).filter(v => v !== undefined);
  const out: Partial<RowDesign> = {};
  const set = <K extends RowDesignKey>(k: K, v: RowDesign[K] | undefined) => { if (v) out[k] = v; };
  set('crown', classField('crown', F('crown'), R('crown') as RowCrownKind[], faceRef, readRef, flags, ids, PERIOD.crown));
  set('cornice', classField('cornice', F('cornice'), R('cornice') as RowCorniceKind[], faceRef, readRef, flags, ids, PERIOD.cornice));
  // Bays per front: a two-front pand's read counts both fronts.
  const readBays = ev.filter(e => num(e.read?.bays)).map(e => Math.round((e.read!.bays as number) / e.frontsOfPand));
  set('storeys', classField('storeys', F('storeys'), R('storeys') as number[], faceRef, readRef, flags, ids, undefined));
  set('bays', classField('bays', F('bays'), readBays, faceRef, readRef, flags, ids, undefined));
  set('windows', classField('windows', F('windows'), R('windows') as RowWindowKind[], faceRef, readRef, flags, ids, PERIOD.windows));
  set('heads', classField('heads', F('heads'), R('heads') as RowHeads[], faceRef, readRef, flags, ids, PERIOD.heads));
  set('whiteFrames', classField('whiteFrames', [], R('whiteFrames') as boolean[], faceRef, readRef, flags, ids, PERIOD.whiteFrames));
  set('sills', classField('sills', [], R('sills') as boolean[], faceRef, readRef, flags, ids, PERIOD.sills));
  // Wall: one family per series (face palette name, else the reads' judged families); the tone is seeded by row and family,
  // so series of one family in a row (and the two fronts of a module pand, which carry one palette) share one tone.
  const faceWall = ev.filter(e => e.face?.wallFamily).map(e => ({ material: e.face!.wallMaterial ?? 'brick', family: e.face!.wallFamily!, hex: '' } as RowWall));
  // A series with no wall evidence in a row of measured cuts (the canal belt) takes its neighbours' family: the nearest
  // read walls either side (wall colour by judgement, 2026-11-14), never the era default's red-brown.
  const near = input.members.some(m => m.wallSample) ? nearestWall(all, all.indexOf(ev[0])) : null;
  const wall = classField('wall', faceWall, R('wall') as RowWall[], faceRef, readRef, flags, ids,
    near ? { material: near.material, family: near.family, hex: '' } as RowWall : { material: 'brick', family: eraFamily(ev[0]?.member.built ?? null), hex: '' } as RowWall,
    near ? `neighbours: ${near.family} from ${near.from.join(', ')}` : 'period default: era brick');
  if (wall) { wall.value = { ...wall.value, hex: variedTone(wall.value.family, `${input.id}:${wall.value.family}`) }; delete wall.votes; wall.votes = votes((R('wall') as RowWall[]).map(w => ({ ...w, hex: '' }))).map(x => ({ value: x.value, n: x.n })); if (!wall.votes.length) delete wall.votes; }
  set('wall', wall);
  // Roof storey: kind, dormers per front, dormer kind, hoist.
  const faceKind = F('roofKind'), readKind = ev.map(e => e.read?.roofKind).filter((v): v is RowRoofStoreyKind => !!v);
  const kindF = classField<RowRoofStoreyKind>('roofStorey', faceKind, readKind, faceRef, readRef, flags, ids, 'none', 'period default: a flat lid behind the cornice');
  const readDorm = ev.map(e => e.read?.dormers ? { ...e.read.dormers, count: e.read.dormers.count / e.frontsOfPand } : undefined).filter((d): d is NonNullable<typeof d> => !!d);
  const dormersF = classField('dormers', F('dormers'), readDorm.map(d => d.count), faceRef, readRef, flags, ids, 0, 'period default: no dormers');
  const dkF = classField('dormerKind', F('dormerKind'), readDorm.map(d => d.kind).filter((k): k is RowDormerKind => !!k), faceRef, readRef, flags, ids, undefined);
  // A hoist is per house: the series draws one only when every dormer reading in it names one (fronts below carry their own).
  const hoist = readDorm.length > 0 && readDorm.every(d => d.hoist);
  const roofKind: RowRoofStoreyKind = kindF!.value === 'none' && (dormersF!.value ?? 0) > 0 ? 'mansard' : kindF!.value;
  const material = F('roofMaterial')[0] ?? 'slate';
  const rs: RowRoofStorey = { kind: roofKind, ...(roofKind === 'mansard' ? { material } : {}), dormersPerFront: dormersF!.value ?? 0, ...(dkF && (dormersF!.value ?? 0) > 0 ? { dormerKind: dkF.value } : {}), ...(hoist ? { hoist: true } : {}) };
  const rsSource = [kindF!, dormersF!].sort((a, b) => ROW_SOURCE_RANK[a.source] - ROW_SOURCE_RANK[b.source])[0].source;
  out.roofStorey = field(rs, rsSource, `kind: ${kindF!.source} (${kindF!.ref}); dormers: ${dormersF!.source}${dkF ? `, kind ${dkF.source}` : ''}${hoist ? '; hoist from the reading' : ''}`, kindF!.votes ? { votes: kindF!.votes.map(v => ({ value: { ...rs, kind: v.value }, n: v.n })) } : {});
  // Cornice line: the series' measured tops (median); else the row's measured line; else 3DBAG (minus a roof storey).
  const measured = F('corniceTopM');
  const rowMeasured = all.map(e => e.face?.corniceTopM).filter((v): v is number => v !== undefined);
  if (measured.length) out.corniceTopM = field(r2(median(measured)), 'face-intent', `${faceRef} continuity.measuredEaves (strip rows)`, { samples: measured });
  else if (rowMeasured.length) {
    out.corniceTopM = field(r2(median(rowMeasured)), 'face-intent', `${faceRef}: the row line (median of the row's measured cornice tops; this series has none)`, { samples: rowMeasured });
    flags.push({ kind: 'no-reading', field: 'corniceTopM', fronts: ids, detail: 'no measured cornice in the series: the row line is drawn' });
  } else if (ev.some(e => e.member.eaves3dbag)) {
    const h = ev.map(e => e.member.eaves3dbag).filter((v): v is number => !!v);
    out.corniceTopM = field(r2(median(h)), h.length >= 2 ? 'series-consensus' : 'single-read', '3DBAG eaves median (the decorated feature\'s wall top); no measured cornice', { samples: h });
    flags.push({ kind: 'no-reading', field: 'corniceTopM', fronts: ids, detail: `no measured cornice line: ${out.corniceTopM.ref}` });
  } else {
    const h = ev.map(e => e.member.height3dbag).filter((v): v is number => !!v);
    if (h.length) {
      const less = rs.kind !== 'none' ? ROOF_STOREY_M : 0;
      out.corniceTopM = field(r2(median(h) - less), h.length >= 2 ? 'series-consensus' : 'single-read', `3DBAG wall height median${less ? ` minus a ${ROOF_STOREY_M} m roof storey (3DBAG reads the ${rs.kind})` : ''}; no measured cornice`, { samples: h });
      flags.push({ kind: 'no-reading', field: 'corniceTopM', fronts: ids, detail: `no measured cornice line: ${out.corniceTopM.ref}` });
    } else out.corniceTopM = field(null, 'period-default', 'no measurement: the renderer takes the lid at the storeys');
  }
  const bandReads = ev.filter(e => e.read).map(e => e.read!.bands ?? []);
  const shared = bandReads.length >= 2 ? bandReads[0].filter(b => bandReads.every(r => r.includes(b))) : [];
  out.extras = shared.length ? field([...ROW_EXTRAS_DEFAULT, ...shared], 'series-consensus', `rowFront.ts ROW_FRONT_EXTRAS + bands read on every front (${readRef})`)
    : field([...ROW_EXTRAS_DEFAULT], 'period-default', 'rowFront.ts ROW_FRONT_EXTRAS');
  if (!out.storeys) out.storeys = field(4, 'period-default', 'period default');
  if (!out.bays) out.bays = field(3, 'period-default', 'period default');
  if (!out.heads) out.heads = field(PERIOD.heads!, 'period-default', 'period default');
  return out as RowDesign;
}
function eraFamily(year: number | null): JudgedFamily { return year !== null && year < 1860 ? 'red-brown-brick' : 'brown-brick'; }
export const familyTone = (f: JudgedFamily) => JUDGED_PALETTE[f];

/** The wall of the nearest read fronts either side of index `i` (one each side). When they differ, the nearer one wins;
 *  at equal distance, the one built closer to this front's year (Herengracht 82, 1905: its 1905 neighbour 80, not the
 *  1615 house 84), then the left one. The material comes with the family (a painted neighbour gives painted brick). */
function nearestWall(evs: readonly Ev[], i: number): { material: RowWallMaterial; family: JudgedFamily; from: string[] } | null {
  const walled = evs.map((e, j) => ({ e, j, w: e.read?.wall as RowWall | undefined })).filter(x => x.w && x.j !== i);
  const left = walled.filter(x => x.j < i).pop(), right = walled.find(x => x.j > i);
  const pick = [left, right].filter((x): x is NonNullable<typeof x> => !!x);
  if (!pick.length) return null;
  let w = pick[0];
  if (left && right && left.w!.family !== right.w!.family) {
    const dl = i - left.j, dr = right.j - i, y = evs[i].member.built;
    const age = (x: typeof left) => (y == null || x.e.member.built == null ? 0 : Math.abs(x.e.member.built - y));
    w = dl !== dr ? (dl < dr ? left : right) : age(right) < age(left) ? right : left;
  }
  return { material: w.w!.material, family: w.w!.family as JudgedFamily, from: pick.map(x => x.e.member.pandId) };
}
