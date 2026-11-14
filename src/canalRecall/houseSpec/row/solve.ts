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
  type RowDesignKey, type RowDormerKind, type RowField, type RowFieldSource, type RowFlag, type RowFront, type RowGround, type RowHeadDressing,
  type RowHeadShape, type RowHeads, type RowMember, type RowRecord, type RowRoofStorey, type RowRoofStoreyKind, type RowSeries, type RowWall,
  type RowWallMaterial, type RowWindowKind,
} from './types.ts';

/** rowFront.ts ROW_FRONT_EXTRAS (kept as a copy so this module does not pull the mesher; row.test.ts pins the two equal). */
export const ROW_EXTRAS_DEFAULT: readonly string[] = ['window-sills', 'white-window-frames', 'door-surround', 'wall-anchors', 'plinth', 'downpipe'];
/** A storey standing behind the cornice when the only height is 3DBAG's (which reads the mansard): its height (m). */
export const ROOF_STOREY_M = 3.0;
const HELD_READ = /scaffold|netting|steiger/i;
/** A reader's `bands` -> the wall extras that draw them (lane R's names): read and drawn, not dropped. */
export const BAND_EXTRAS: Readonly<Record<string, string[]>> = {
  storey: ['floor-cornices'], lintel: ['string-courses'], both: ['floor-cornices', 'string-courses'], courses: ['string-courses'], speklagen: ['speklagen'],
};

// --- inputs -------------------------------------------------------------------------------------------------------------

/** What a face intent states for one house front (a module of a two-module pand is its own entry). */
export interface FaceFront {
  type?: string;
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
}

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
    if (field === 'heads') return (v as RowHeads).dressing;
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
  if (d && d !== NV && typeof d === 'object') {
    return { count: d.kind === 'none' ? 0 : d.count, ...(d.kind !== 'none' ? { kind: d.kind as RowDormerKind } : {}), from: 'dormers' };
  }
  for (const g of a.gaps ?? []) {
    const m = /\b(one|two|three|four|an?|\d)\s+(?:[\w-]+\s+){0,3}?dormers?\b/i.exec(g.what);
    if (!m) continue;
    const count = WORD_N[m[1].toLowerCase()] ?? Number(m[1]);
    const kind: RowDormerKind = /pediment/i.test(g.what) ? 'pediment' : /gable/i.test(g.what) ? 'gabled' : 'plain';
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
export function readHeads(a: DescriberAnswer): RowHeads | undefined {
  const up = (a.heads ?? []).slice(1);
  const arched = up.map((h, i) => (h === 'relieving' || h === 'segmental') ? i + 1 : 0).filter(Boolean);
  if (arched.length && arched.length < up.filter(h => h !== NV).length) return { shape: 'segmental', dressing: 'segmental-tympanum', storeys: arched };
  const shapes = up.filter(h => h !== NV);
  const shape = (mode(shapes.map(h => h === 'relieving' ? 'segmental' : h)) ?? 'flat') as string;
  const dressing = a.windowSurround && a.windowSurround !== NV ? DRESSING_OF[a.windowSurround] : undefined;
  if (!dressing) return undefined;
  const roundTop = shapes.length > 1 && shapes[shapes.length - 1] === 'round' && shape !== 'round';
  return { shape: (['flat', 'segmental', 'round', 'relieving'].includes(shape) ? shape : 'flat') as RowHeadShape, dressing, ...(roundTop ? { storeys: shapes.map((_, i) => i + 1).slice(0, -1) } : {}) };
}
export interface ReadValues { [k: string]: unknown }
/** The class and metre values one reading states, in the row vocabulary (undefined = not stated). */
export function readValues(a: DescriberAnswer, year: number | null): Partial<Record<RowDesignKey, unknown>> & { dormers?: ReturnType<typeof readDormers>; roofKind?: RowRoofStoreyKind; bands?: string[] } {
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
    const j = judgeFront({ pandId: a.pandId, readable: a.readable, finish: a.finish, pale: (a as { pale?: boolean }).pale ?? null, notes: a.notes ?? null, year });
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
const PERIOD: { [K in RowDesignKey]?: RowDesign[K]['value'] } = {
  crown: 'cornice', cornice: 'simple', windows: 'tall-upper', whiteFrames: true, sills: true,
  heads: { shape: 'flat', dressing: 'none' },
};

// --- the solve ------------------------------------------------------------------------------------------------------------

interface Ev { front: RowFront; face?: FaceFront; read?: ReturnType<typeof readValues>; readRef?: string; member: MemberInput; frontsOfPand: number }

export function splitCount(m: MemberInput, rowBays: number | null, rowWidth: number | null): { n: number; why?: string } {
  if ((m.face?.length ?? 0) >= 2) return { n: m.face!.length, why: 'face intent modules' };
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
    members.push({ pandId: m.pandId, label: m.label, numbers: m.numbers, built: m.built, widthM: m.widthM, fronts: ids });
    const readVals = m.read && !held ? readValues(m.read, m.built) : undefined;
    if (held) {
      flags.push({ kind: 'scaffold', fronts: ids, detail: `reading not used: ${held}` });
      readNotDrawn.push({ front: m.pandId, field: 'reading', value: m.readRef ?? m.read!.image?.ref, reason: `held: ${held}; the front takes its series` });
    }
    ids.forEach((id, i) => {
      const face = m.face?.[i];
      const label = n === 1 ? m.label : `${input.street} ${nums[i] ?? `${m.numbers.join('–')} (${i + 1}/${n})`}`;
      const front: RowFront = {
        id, pandId: m.pandId, label, numbers: n === 1 ? m.numbers : nums[i] !== undefined ? [nums[i]] : m.numbers,
        ...(n > 1 ? { sub: { index: i, of: n, a0: r2(i / n), a1: r2((i + 1) / n) } } : {}),
        widthM: m.widthM === null ? null : r2(m.widthM / n), seriesId: '', ground: face?.ground ?? groundOfRead(m.read && !held ? m.read : null),
        overrides: {}, groundOffsetM: m.groundOffsetM ?? null, topM: null, ...(held ? { readHeld: held } : {}),
      };
      fronts.push(front);
      evs.push({ front, face, read: readVals, readRef: m.readRef, member: m, frontsOfPand: n });
    });
    if (m.read && !held) for (const r of notDrawnOfRead(m.read)) readNotDrawn.push({ front: m.pandId, ...r });
    for (const f of m.face ?? []) {
      if (f.sampledHex) readNotDrawn.push({ front: m.pandId, field: 'measuredPalette.brick', value: f.sampledHex, reason: 'a sampled hex is never drawn: the wall is the series judged family' });
      for (const l of f.limits ?? []) readNotDrawn.push({ front: m.pandId, field: 'face schemaLimit', value: l, reason: 'kit cannot say it (face intent)' });
    }
  }
  dedupeNotDrawn(readNotDrawn);

  // Series partition.
  const sig = (e: Ev): string | null => {
    if (e.face) {
      const f = e.face;
      if (!f.heads && !f.type) return null;
      return JSON.stringify([f.type, f.heads?.dressing ?? null, f.heads?.storeys ?? null, f.dormers ?? null, f.crown ?? null]);
    }
    if (!e.read) return null;
    const r = e.read;
    const cornice = r.cornice === undefined ? null : (COMPAT.cornice.find(g => g.includes(String(r.cornice)))?.[0] ?? r.cornice);
    return JSON.stringify([r.crown ?? null, cornice, r.roofKind ?? null, r.storeys ?? null, e.frontsOfPand > 1 ? Math.round((r.bays as number) / e.frontsOfPand) : r.bays ?? null]);
  };
  // A face front that states the type but no head joins its neighbour (rule 2: unstated takes the series value).
  const keys = evs.map(e => e.face && !e.face.heads && evs.some(o => o !== e && o.face?.heads) ? null : sig(e));
  for (let i = 0; i < keys.length; i++) if (keys[i] === null) {
    const left = keys.slice(0, i).reverse().find(k => k !== null), right = keys.slice(i + 1).find(k => k !== null);
    keys[i] = left ?? right ?? 'none';
  }
  const seriesKeys: string[] = [];
  for (const k of keys) if (!seriesKeys.includes(k!)) seriesKeys.push(k!);
  const series: RowSeries[] = seriesKeys.map((k, si) => {
    const id = `${input.id}/s${si + 1}`;
    const ev = evs.filter((_, i) => keys[i] === k);
    ev.forEach(e => { e.front.seriesId = id; });
    const design = solveSeries(id, ev, input, flags, evs);
    const type = ev.find(e => e.face?.type)?.face?.type;
    const runs = runsOf(evs.map((_, i) => keys[i] === k));
    return { id, label: `${type ?? 'read series'}${design.heads.value.dressing !== 'none' ? `, ${design.heads.value.dressing} heads` : ''}${design.roofStorey.value.dormersPerFront ? `, ${design.roofStorey.value.dormersPerFront} ${design.roofStorey.value.dormerKind ?? ''} dormer` : ''}${runs > 1 ? ` (${runs} runs)` : ''}`,
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
      if (k === 'wall' ? compatible('wallFamily', read, drawnCmp) && (read as RowWall).material === (drawnCmp as RowWall).material : k === 'heads' ? sameHeads(read as RowHeads, drawnCmp as RowHeads) : JSON.stringify(read) === JSON.stringify(drawnCmp)) continue;
      const cf = k === 'roofKind' ? 'roofStorey' : k === 'dormers' ? 'dormers' : compatField(k);
      const same = typeof read !== 'number' && compatible(cf, read, drawnCmp);
      overruled.push({ front: e.front.id, field: k, read, drawn: drawnCmp, by: s.design[key].source,
        why: same ? `compatible class (${classKey(cf, read)} ~ ${classKey(cf, drawnCmp)}): the series' word is drawn` : `series ${s.id} (${s.design[key].ref})` });
    }
    // Per-house reads drawn on the front: its own bands (as extras) and a hoist in its dormer.
    const ownBands = (e.read?.bands ?? []).filter(b => !s.design.extras.value.includes(b));
    if (ownBands.length) e.front.overrides.extras = { value: [...s.design.extras.value, ...ownBands], source: 'single-read', ref: `${e.member.pandId} reading: bands ${e.member.read?.bands}` };
    const rsv = s.design.roofStorey.value;
    if (e.read?.dormers?.hoist && !rsv.hoist && rsv.dormersPerFront > 0)
      e.front.overrides.roofStorey = { value: { ...rsv, hoist: true }, source: 'single-read', ref: `${e.member.pandId} reading: ${e.read.dormers.from}` };
    if (e.face) {
      // A face statement for this house that differs from the series (a head variant inside a type) is drawn on the front.
      const fh = e.face.heads;
      if (fh && !sameHeads(fh, s.design.heads.value)) e.front.overrides.heads = { value: fh, source: 'face-intent', ref: `${input.faceRef ?? input.face} houses[${e.member.pandId}]` };
    }
    const top = s.design.corniceTopM.value;
    e.front.topM = top === null ? null : r2(top - (e.front.groundOffsetM ?? 0));
  }
  if (fronts.some(f => f.groundOffsetM === null || f.groundOffsetM === undefined))
    flags.push({ kind: 'no-reading', field: 'groundOffsetM', fronts: fronts.filter(f => f.groundOffsetM == null).map(f => f.id), detail: 'no street ground: topM is the series line above the pand ground (offset 0 assumed)' });

  return { v: ROW_RECORD_VERSION, id: input.id, street: input.street, side: input.side, ...(input.face ? { face: input.face } : {}), members, fronts, series, flags, readNotDrawn, overruled, inputs: input.inputs, solvedAt: input.solvedAt };
}

const sameHeads = (a: RowHeads, b: RowHeads) => a.dressing === b.dressing && a.shape === b.shape && JSON.stringify(a.storeys ?? null) === JSON.stringify(b.storeys ?? null);
const runsOf = (mask: boolean[]) => mask.reduce((n, v, i) => n + (v && !mask[i - 1] ? 1 : 0), 0);
export function heldReason(a: DescriberAnswer): string | null {
  const text = [a.notes ?? '', ...(a.gaps ?? []).map(g => g.what)].join(' ');
  const m = HELD_READ.exec(text);
  return m ? `the reading mentions ${m[0].toLowerCase()}: "${(a.notes ?? text).slice(0, 140)}"` : null;
}
function groundOfRead(a: DescriberAnswer | null): RowGround {
  if (!a) return { use: 'other' };
  const use: RowGround['use'] = a.ground === 'shopfront' ? 'shop' : a.ground === 'dwelling' ? 'dwelling' : a.ground === 'warehouse' ? 'warehouse' : 'other';
  const doorSide = a.doorBay === 'left' || a.doorBay === 'right' || a.doorBay === 'several' || a.doorBay === 'none' ? a.doorBay : a.doorBay === 'centre' || a.doorBay === 'off-centre' ? 'centre' as const : undefined;
  const basement = a.basement === 'stoop-and-windows' ? 'stoop-and-windows' as const : a.basement === 'none' ? 'none' as const : a.souterrain ? 'souterrain' as const : undefined;
  return { use, ...(doorSide ? { doorSide } : {}), ...(basement ? { basement } : {}) };
}
/** Fields a reading states that the row design has no place for (programme rule 3). */
function notDrawnOfRead(a: DescriberAnswer): Array<Omit<ReadNotDrawn, 'front'>> {
  const out: Array<Omit<ReadNotDrawn, 'front'>> = [];
  if (Array.isArray(a.balconies) && a.balconies.length) out.push({ field: 'balconies', value: a.balconies, reason: 'not on the row allow-list: a balcony needs a reviewed statement (ROW_FRONT_EXTRAS)' });
  if (Array.isArray(a.bayWindow) && a.bayWindow.length) out.push({ field: 'bayWindow', value: a.bayWindow, reason: 'not on the row allow-list (the oriel dice drew the Kinkerstraat centre strip)' });
  if (a.bands && a.bands !== NV && a.bands !== 'none' && !BAND_EXTRAS[a.bands]) out.push({ field: 'bands', value: a.bands, reason: 'the row design has no band field; the head dressing carries the white course' });
  if (a.cornice === 'frieze' || a.cornice === 'attic-frieze') out.push({ field: 'cornice', value: a.cornice, reason: 'drawn as the series cornice; the frieze panels are not drawn' });
  if (a.doorSurround === true) out.push({ field: 'doorSurround', value: true, reason: 'door-surround is on the allow-list; its shape is not described' });
  for (const g of a.gaps ?? []) out.push({ field: `gap:${g.component}`, value: g.what, reason: 'kit gap (the kit cannot say it)' });
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
  const wall = classField('wall', faceWall, R('wall') as RowWall[], faceRef, readRef, flags, ids,
    { material: 'brick', family: eraFamily(ev[0]?.member.built ?? null), hex: '' } as RowWall, 'period default: era brick');
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
