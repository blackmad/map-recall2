// The ground floor as the building has it (lane ground-floor-20261116, plan prancy-dreaming-swing): the openings left to
// right with their head shapes, the piers between them, the plinth, the ground finish, the fascia and where the sign
// sits, each field with a receipt. A shop fills the building's openings (retailFront.ts inset mode) instead of a
// template glued over the whole ground storey. Pure data: runs in Node, the mesh worker and tests.

/** An opening's head: flat lintel, a shallow segmental arch, a semicircle (`round`), or a flattened three-centre arch. */
export const GF_HEADS = ['flat', 'segmental', 'round', 'basket'] as const;
export type GfHead = (typeof GF_HEADS)[number];
/** What fills an opening: a shop window (glass and goods, maybe its door), a street door, a plain window, a passage
 *  through the building (gate or arcade), or a blind recess. */
export const GF_OPENING_KINDS = ['shop', 'door', 'window', 'passage', 'blank'] as const;
export type GfOpeningKind = (typeof GF_OPENING_KINDS)[number];
export const GF_PIER_MATERIALS = ['stone', 'brick', 'stucco', 'timber', 'iron'] as const;
export type GfPierMaterial = (typeof GF_PIER_MATERIALS)[number];
export const GF_PLINTHS = ['none', 'stone-band', 'rusticated'] as const;
export type GfPlinthKind = (typeof GF_PLINTHS)[number];
/** The ground storey's own finish where it differs from the wall above: stone (ashlar or cladding), stucco, a painted
 *  timber pui, or the wall's brick. */
export const GF_FINISHES = ['brick', 'stone', 'stucco', 'painted-pui'] as const;
export type GfFinish = (typeof GF_FINISHES)[number];
/** Where the business's sign sits: letters straight on the wall or stone (no board), a board inside an opening, a full
 *  fascia board, a lightbox, or none. A blade (hanging sign) is a flag beside it. */
export const GF_SIGNS = ['wall-letters', 'board-in-opening', 'fascia', 'lightbox', 'none'] as const;
export type GfSignKind = (typeof GF_SIGNS)[number];

/** One opening: `a0`/`a1` are fractions of the front's width, left to right as seen from the street; `sillM`/`headM`
 *  metres above the pavement (`headM` the crown for an arch). */
export interface GfOpening { a0: number; a1: number; sillM: number; headM: number; head: GfHead; kind: GfOpeningKind }
/** A pier between openings (or at an end), as fractions of the front; `rusticated` = banded (channelled) stone. */
export interface GfPier { a0: number; a1: number; material: GfPierMaterial; rusticated?: boolean }
export interface GfPlinth { kind: GfPlinthKind; heightM: number }
export interface GfGroundFinish { material: GfFinish; hex?: string }
export interface GfFascia { kind: 'none' | 'band'; heightM?: number; inOpening?: boolean; hex?: string }
export interface GfSign { kind: GfSignKind; opening?: number; blade?: boolean }

/** The record's fields, each merged on its own (merge.ts) and carrying its own receipt. */
export const GF_FIELDS = ['openings', 'piers', 'plinth', 'groundFinish', 'fascia', 'sign', 'groundTopM'] as const;
export type GfField = (typeof GF_FIELDS)[number];

/** Sources, strongest first (plan Phase 1): hand specs, the recipe's groundFront, the ground-floor photo read, the
 *  describer's ground row, the monument register, and the plain default (today's template: no record). */
export const GF_SOURCES = ['hand', 'recipe', 'photo-read', 'describer', 'register', 'default'] as const;
export type GfSource = (typeof GF_SOURCES)[number];
export const GF_SOURCE_RANK: Readonly<Record<GfSource, number>> = { hand: 6, recipe: 5, 'photo-read': 4, describer: 3, register: 2, default: 1 };

export interface GfReceipt { source: GfSource; confidence: number; ref?: string; at?: string | null }

/** The drawn record: everything the renderer reads. */
export interface GroundFloorDraw {
  openings: GfOpening[];
  piers: GfPier[];
  plinth: GfPlinth;
  groundFinish: GfGroundFinish;
  fascia: GfFascia;
  sign: GfSign;
  /** The ground storey's top over the pavement (first-floor line), when a source states it. */
  groundTopM?: number;
}
/** The record per pand: the drawn fields plus a receipt for each field that a source stated. */
export interface GroundFloor extends GroundFloorDraw { pandId: string; receipts: Partial<Record<GfField, GfReceipt>> }

/** One source's partial description, before the merge. */
export interface GroundFloorPart {
  source: GfSource; confidence: number; ref?: string; at?: string | null;
  openings?: GfOpening[]; piers?: GfPier[]; plinth?: GfPlinth; groundFinish?: GfGroundFinish; fascia?: GfFascia; sign?: GfSign; groundTopM?: number;
}

/** Plain period defaults for a field no source states (a record exists only when some source gives openings). */
export const GF_DEFAULTS: Readonly<Omit<GroundFloorDraw, 'openings' | 'piers'>> = {
  plinth: { kind: 'none', heightM: 0 },
  groundFinish: { material: 'brick' },
  fascia: { kind: 'band', heightM: 0.6 },
  sign: { kind: 'fascia' },
};

const HEX = /^#[0-9a-f]{6}$/i;
export const isHex = (v: unknown): v is string => typeof v === 'string' && HEX.test(v);
const isIn = <T extends readonly string[]>(list: T, v: unknown): v is T[number] => typeof v === 'string' && (list as readonly string[]).includes(v);
const num = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** Problems with a list of openings (empty = valid): fractions in [0, 1], left to right, not overlapping; heights sane. */
export function openingProblems(list: unknown): string[] {
  if (!Array.isArray(list)) return ['openings: a list'];
  const p: string[] = [];
  let last = -1;
  list.forEach((o: any, i) => {
    if (!o || typeof o !== 'object') { p.push(`openings[${i}]: an object`); return; }
    if (!num(o.a0, 0, 1) || !num(o.a1, 0, 1) || o.a1 - o.a0 < 0.02) p.push(`openings[${i}]: a0 < a1 in [0, 1]`);
    else if (o.a0 < last - 1e-6) p.push(`openings[${i}]: overlaps or out of order`);
    else last = o.a1;
    if (!num(o.sillM, 0, 3) || !num(o.headM, 1.2, 9) || o.headM - o.sillM < 0.8) p.push(`openings[${i}]: sillM 0..3, headM 1.2..9, at least 0.8 m tall`);
    if (!isIn(GF_HEADS, o.head)) p.push(`openings[${i}].head: ${GF_HEADS.join('|')}`);
    if (!isIn(GF_OPENING_KINDS, o.kind)) p.push(`openings[${i}].kind: ${GF_OPENING_KINDS.join('|')}`);
  });
  return p;
}

/** Problems with a drawn record (empty = valid). */
export function drawProblems(d: any): string[] {
  if (!d || typeof d !== 'object') return ['a record is an object'];
  const p = openingProblems(d.openings);
  if (!Array.isArray(d.piers) || !d.piers.every((q: any) => q && num(q.a0, 0, 1) && num(q.a1, 0, 1) && q.a1 > q.a0 && isIn(GF_PIER_MATERIALS, q.material))) p.push('piers: [{a0, a1, material}]');
  if (!d.plinth || !isIn(GF_PLINTHS, d.plinth.kind) || !num(d.plinth.heightM, 0, 2)) p.push(`plinth: {kind: ${GF_PLINTHS.join('|')}, heightM 0..2}`);
  if (!d.groundFinish || !isIn(GF_FINISHES, d.groundFinish.material) || (d.groundFinish.hex !== undefined && !isHex(d.groundFinish.hex))) p.push(`groundFinish: {material: ${GF_FINISHES.join('|')}, hex?}`);
  if (!d.fascia || !(d.fascia.kind === 'none' || d.fascia.kind === 'band') || (d.fascia.hex !== undefined && !isHex(d.fascia.hex))) p.push('fascia: {kind: none|band, heightM?, inOpening?, hex?}');
  if (!d.sign || !isIn(GF_SIGNS, d.sign.kind)) p.push(`sign: {kind: ${GF_SIGNS.join('|')}, opening?, blade?}`);
  if (d.groundTopM !== undefined && !num(d.groundTopM, 2.2, 9)) p.push('groundTopM: 2.2..9');
  return p;
}

/** Piers as the solid wall between and beside the openings (the read gives openings; the piers are what is left). */
export function piersBetween(openings: readonly GfOpening[], material: GfPierMaterial, rusticated = false, minFrac = 0.01): GfPier[] {
  const out: GfPier[] = [];
  let at = 0;
  for (const o of [...openings].sort((p, q) => p.a0 - q.a0)) {
    if (o.a0 - at >= minFrac) out.push({ a0: at, a1: o.a0, material, ...(rusticated ? { rusticated } : {}) });
    at = Math.max(at, o.a1);
  }
  if (1 - at >= minFrac) out.push({ a0: at, a1: 1, material, ...(rusticated ? { rusticated } : {}) });
  return out;
}

/** An arch's rise for an opening `widthM` wide: a semicircle's half width, a segmental arch's 0.15, a basket's 0.3. */
export function archRiseM(head: GfHead, widthM: number): number {
  return head === 'round' ? widthM / 2 : head === 'segmental' ? widthM * 0.15 : head === 'basket' ? widthM * 0.3 : 0;
}
