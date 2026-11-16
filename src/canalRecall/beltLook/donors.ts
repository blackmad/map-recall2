/**
 * Belt look (lane D, 2026-11-15; David: "go for buurt looks + kits rather than trying to get every house perfect"): the
 * canal belt's look is the belt's own read houses. An undescribed belt pand takes the D1 read of the most similar read
 * house (its donor): same canal first, then build year, front width, eaves and roof form. Picking a whole read rather than
 * each field from a distribution keeps a front coherent (a neck gable keeps its attic light and its narrow bays; a wide
 * cornice house keeps its door surround and its stoop) and leaves the belt's mix of crowns, windows, walls and stoops
 * exactly as read: the look's distributions are the donors'.
 *
 * Deterministic per pand: the donor is one of the `DONOR_K` nearest, chosen by a hash of the pand id, never a dice roll
 * at draw time. Pure: no fs, no DOM.
 */
import type { DescriberAnswer } from '../houseSpec/describer.ts';

/** The four canals; any other street of the belt is a cross street. */
export const BELT_CANALS = ['Herengracht', 'Keizersgracht', 'Prinsengracht', 'Singel'] as const;
export type BeltSegment = (typeof BELT_CANALS)[number] | 'cross';
export const segmentOf = (street: string, canals: readonly string[] = BELT_CANALS): BeltSegment => canals.includes(street) ? street as BeltSegment : 'cross';

/** A read belt house: its read, its cut's wall sample, and what the donor match weighs. */
export interface BeltDonor {
  pandId: string;
  street: string;
  year: number | null;
  /** The cut's wall width (m): the front the read describes. */
  widthM: number;
  /** The cut's wall height (m above the street). */
  heightM: number;
  answer: DescriberAnswer;
  /** The cut's measured wall colour (cuts.json w1 / wallHex): the row solve judges the brick family from it. */
  sample?: string;
  /** The district look the donor's read belongs to (LookDistrict.id); absent in the belt look's own pool. */
  district?: string;
}
/** What the match knows of an undescribed pand. */
export interface BeltTarget {
  pandId: string;
  street: string;
  year: number | null;
  widthM: number;
  eavesM: number | null;
  ridgeM: number | null;
  /** 3DBAG roof type (bag tiles `roof`: 1 flat, 2 several flats, 3 slanted). */
  roofCode: number | null;
  /** The crown a published source states for the pand (the monument register's gable, house-specs `fronts[0].gable`):
   *  the donor must carry that crown family, and a stated gable kind is drawn as stated. */
  statedCrown?: string;
  /** The pand has a shop ground storey (the extract's shopfronts.json): a shop donor is preferred and the fitted read's
   *  ground is a shopfront (held-out round 2: dwelling doors drawn on Leidsestraat's and Reguliersbreestraat's shops). */
  shop?: boolean;
  /** The register's facade finish (monument-facts `finish`): a plastered or stone front is drawn pale stucco or stone. */
  finish?: 'plaster' | 'stone' | 'brick' | 'ornamentalBrick' | 'painted';
  /** The register's storey count (monument-facts `storeys`): the fitted read's storeys. */
  storeys?: number;
  /** The register names a stoop (monument-facts elements). */
  stoop?: boolean;
  /** 3DBAG's representative height (bag tiles `height`): a cornice front stands at it (held-out round 3: Huidenstraat and
   *  Hartenstraat 169174 drawn at the eaves, 7-12 m against 13-17 m). */
  heightM?: number | null;
  /** A published source states a roof storey (house-specs `roofStorey` mansard or attic, or the register's dormer or
   *  attic element). Absent: a donor's mansard and dormers are not drawn (held-out round 4: invented slate mansards with
   *  dormers over flat cornice fronts on the losing streets). */
  roofStorey?: boolean;
  /** The register's building type is a warehouse (monument-facts `type` pakhuis): a warehouse donor is preferred, its storeys
   *  at a warehouse's low floor pitch, and the front draws its loading doors and hoist (held-out round 5: Molenpad's
   *  pakhuis drawn as a red-brick house of three tall storeys). */
  warehouse?: boolean;
  /** The register's named front elements (monument-facts `elements` keys: claws, festoons, oeilDeBoeuf, hoistBeam, ...). */
  elements?: readonly string[];
  /** The district look drawing the pand (LookDistrict.id); a donor of another district costs `foreignDonor`. */
  district?: string;
}

/** Crown families a stated crown admits among donor reads (held-out A/B 2026-11-15: gables drawn over the register's
 *  cornices lost 5 of 7 streets). */
export const CROWN_FAMILY: Record<string, readonly string[]> = {
  cornice: ['cornice', 'mansard', 'pitched-eaves'], flat: ['flat', 'cornice'],
  neck: ['neck', 'raised-neck', 'shouldered'], 'raised-neck': ['raised-neck', 'neck'], shouldered: ['shouldered', 'neck'],
  bell: ['bell'], point: ['point'], step: ['step'], spout: ['spout'],
};
const admits = (stated: string, crown: string) => (CROWN_FAMILY[stated] ?? [stated]).includes(crown);

/** D1 crowns that stand a gable over the line. */
export const GABLED_CROWNS = new Set(['neck', 'raised-neck', 'shouldered', 'bell', 'point', 'step', 'spout']);
/** A pand can carry a street gable only over a pitched roof at least this tall (3DBAG ridge - eaves, m): a flat-topped
 *  pand never takes a gabled donor. */
export const GABLE_MIN_RISE_M = 2;
/** The nearest donors one pand chooses among. */
export const DONOR_K = 4;
/** The match weights: one unit is a street segment apart, 50 years, 2 m of width or 3 m of eaves. */
/** A donor's storey pitch (cut wall height / read storeys) is held to this band: a cut whose wall takes in a mansard or roof
 *  storey (Langestraat's donor 169011: 2 storeys in 12.9 m) would otherwise halve a pand's storeys (held-out sheet 1). */
// Round 7: the band follows the belt's measured cornice fronts (cut wall height / read storeys over 401 reads: p10 3.39,
// median 4.10, p75 4.65 m); at 3.8 a 17.8 m Keizersgracht front (571488) drew 5 storeys where the photo shows 4. The
// max stays under the p75 so a 10.8 m front held to a mansard donor's tall cut keeps its 3 storeys.
export const PITCH_M = { min: 3.2, max: 4.3 } as const;
export const DONOR_WEIGHTS = { segment: 1.5, sameStreet: -0.3, yearPer: 50, widthPer: 2, eavesPer: 3, gableOnFlat: 4, shopMismatch: 1.5, finishMismatch: 1, warehouseMismatch: 3 } as const;
/**
 * A district look (centrum-looks lane, 2026-11-15): the belt look's donor method over another district, with that district's
 * own segments (its canals), storey pitch band (measured on its own reads) and a cost for a donor read from another
 * district. BELT_LOOK is the belt's own: every default argument below is it, so the belt output is unchanged.
 */
export interface LookDistrict {
  /** Row id prefix and the donor/target district tag ('belt'). */
  id: string;
  /** Streets that are their own donor segment; any other street is a cross street. */
  canals: readonly string[];
  /** The storey pitch band a donor's read is fitted at (m). */
  pitchM: { readonly min: number; readonly max: number };
  /** Added to donorDistance for a donor tagged with another district (0: no cost). */
  foreignDonor: number;
  /** Centrum round 6: a gable over a photo storey count stands its foot at this pitch (m), measured per district (the p25 of
   *  AHN cornice tops over photo storeys); unset (the belt) keeps PHOTO_FOOT_PITCH_M under the AHN apex. */
  gableFootPitchM?: number;
  /** roofSignals.ts: no gable (stated or a donor's) on a measured flat top. */
  flatTopNoGable?: boolean;
  /** roofSignals.ts: a cornice front whose AHN band climbs a roof slope stands at the band's p50. */
  slopedBand?: boolean;
  /** Centrum round 6: the measured roof storey needs the photo to read a roof in view (BeltStated.photoRoof). */
  roofStoreyNeedsPhoto?: boolean;
  /** roofSignals.ts: a roof storey (one dormer) over a cornice front whose 3DBAG ridge stands 2 m over the front top. */
  measuredRoofStorey?: boolean;
}
/** The belt sets flatTopNoGable (round 9: 0 belt fronts change today, a guard for Keizersgracht 171508's kind). It leaves
 *  measuredRoofStorey off: it would add a roof storey to 160 belt cornice fronts, and an opus read of 15 of their cuts saw
 *  a dormer on 5, a bare slope on 2 and nothing over the cornice on 8 (a ridge behind a belt cornice is not a dormer). */
export const BELT_LOOK: LookDistrict = { id: 'belt', canals: BELT_CANALS, pitchM: PITCH_M, foreignDonor: 0, flatTopNoGable: true };
/** A warehouse's floor pitch (m): pakhuis floors are low (2.4-3.0 m in the belt's read warehouses), so the eaves hold more storeys. */
export const WAREHOUSE_PITCH_M = 2.7;
/** Gap sentences naming a house's own ornament, which a donor does not lend: balconies, porches, aedicules, rustication,
 *  bay windows, oriels, sculpture. */
export const DONOR_ONE_OFF = /balcon|porch|aedicule|rustic|oriel|bay window|sculpt|statue|relief|cartouche|coat of arms/i;
/** A read that describes a warehouse front: its ground read as one, or its notes naming a pakhuis or loading doors. */
export function warehouseRead(a: DescriberAnswer): boolean {
  if (a.ground === 'warehouse') return true;
  const text = [a.notes ?? '', ...(a.gaps ?? []).map(g => g.what)].join(' ');
  return /\b(pakhuis|warehouse front|a warehouse|loading doors?)\b/i.test(text) && !/next door|beside it|neighbou?r/i.test(text);
}
/**
 * No roof storey stated (by the register or a read of the roof itself): a mansard crown, a mansard or attic roof part and
 * dormers leave the read, and a cornice front gets a flat lid behind (held-out rounds 4-5: slate mansards with dormers
 * over flat cornice fronts). `keepRoof` keeps a read's own attic (its roof part seen as one). A read mansard is not kept:
 * on a blind sample of 40 belt cuts (round 7) one read mansard in five was a mansard, the other four dormers in a pitched
 * roof, while read dormers held in 19 of 20 and register dormers showed from the street in 13 of 19.
 */
export function stripRoofStorey(a: DescriberAnswer, keepRoof = false): DescriberAnswer {
  const ar = a as { crown?: string; storeyParts?: { roof?: string }; dormers?: unknown; gaps?: Array<{ component?: string; what: string }> };
  if (keepRoof && ar.storeyParts?.roof === 'attic' && ar.crown !== 'mansard') return a;
  if (ar.crown === 'mansard') ar.crown = 'cornice';
  if (ar.storeyParts && (ar.storeyParts.roof === 'mansard' || ar.storeyParts.roof === 'attic' || ar.storeyParts.roof === 'dormers')) ar.storeyParts.roof = 'none';
  if (ar.dormers && typeof ar.dormers === 'object') ar.dormers = { kind: 'none', count: 0 };
  if (ar.gaps) ar.gaps = ar.gaps.filter(g => !/dormer|mansard/i.test(g.what));
  return a;
}

/**
 * A stated roof storey over a read mansard: the mansard reads as dormers in a pitched roof (round 7 sample: four read
 * mansards in five were dormers; Prinsengracht 177416's slate mansard), keeping the read's dormer count.
 */
export function mansardAsDormers(a: DescriberAnswer): DescriberAnswer {
  const ar = a as { crown?: string; storeyParts?: { roof?: string }; dormers?: { count?: number; kind?: string } };
  if (ar.crown !== 'mansard' && ar.storeyParts?.roof !== 'mansard') return a;
  if (ar.crown === 'mansard') ar.crown = 'cornice';
  if (ar.storeyParts) ar.storeyParts.roof = 'dormers';
  ar.dormers = { kind: ar.dormers?.kind && ar.dormers.kind !== 'none' ? ar.dormers.kind : 'plain', count: Math.max(1, ar.dormers?.count ?? 0) };
  return a;
}

/** A usable donor read: readable, one front, its crown and storeys seen. */
export function usableDonor(a: DescriberAnswer | null | undefined): a is DescriberAnswer {
  return !!a && a.readable !== false && (a as { extent?: string }).extent !== 'multi' && !!a.crown && a.crown !== 'not-visible'
    && typeof a.storeys === 'number' && a.storeys > 0 && typeof a.bays === 'number' && a.bays > 0;
}

export const gableable = (t: Pick<BeltTarget, 'eavesM' | 'ridgeM' | 'roofCode'>): boolean =>
  t.eavesM !== null && t.ridgeM !== null && t.ridgeM - t.eavesM >= GABLE_MIN_RISE_M && t.roofCode !== 1 && t.roofCode !== 2;

/**
 * The front's top over the street (m) from 3DBAG: the base tiles' `eaves` is the roof's lowest edge, often a rear or dormer
 * eave well under a street front's cornice (held-out round 2, 2026-11-15: Leidsestraat drawn at 7-9 m against 13-14 m in
 * the photo). Without a ridge (no nok within 0.5 m of the roof top) or with a ridge under the representative height (the
 * ridge belongs to a lower part), a front whose eaves sit under 0.75 of the height stands at the height; a pitched roof
 * more than 5 m over its eaves (a mansard or a rear eave) stands at the ridge, capped by the height; else the eaves.
 */
export function frontTopM(eaves: number | null, height: number | null | undefined, ridge: number | null): number | null {
  const h = height ?? null;
  if (eaves === null) return h;
  const r = ridge !== null && h !== null && h > ridge + 0.5 ? null : ridge;
  if (r !== null) return r - eaves > FRONT_TOP.mansardM ? +Math.min(h ?? r, r).toFixed(2) : eaves;
  return h !== null && eaves < FRONT_TOP.eavesShare * h ? h : eaves;
}
export const FRONT_TOP = { eavesShare: 0.75, mansardM: 5 } as const;

/** The match distance of a donor to a pand (lower is closer). */
export function donorDistance(t: BeltTarget, d: BeltDonor, look: LookDistrict = BELT_LOOK): number {
  const w = DONOR_WEIGHTS;
  let s = segmentOf(t.street, look.canals) === segmentOf(d.street, look.canals) ? 0 : w.segment;
  if (look.foreignDonor && t.district !== undefined && d.district !== undefined && t.district !== d.district) s += look.foreignDonor;
  if (t.street === d.street) s += w.sameStreet;
  s += t.year !== null && d.year !== null ? Math.abs(t.year - d.year) / w.yearPer : 1;
  s += Math.abs(t.widthM - d.widthM) / w.widthPer;
  if (t.eavesM !== null) s += Math.abs(t.eavesM - d.heightM) / w.eavesPer;
  if (GABLED_CROWNS.has(String(d.answer.crown)) && !gableable(t)) s += w.gableOnFlat;
  if (t.shop && d.answer.ground !== 'shopfront') s += w.shopMismatch;
  // No shop on record: a shop donor is the worse match (round 4: generic shopfronts where the photo has stoops and doors).
  if (!t.shop && d.answer.ground === 'shopfront') s += w.shopMismatch;
  if (t.finish === 'plaster' && d.answer.finish !== 'stucco') s += w.finishMismatch;
  if (t.finish === 'stone' && d.answer.finish !== 'stone' && d.answer.finish !== 'stucco') s += w.finishMismatch;
  if (!!t.warehouse !== warehouseRead(d.answer)) s += w.warehouseMismatch;
  return s;
}

/** FNV-1a of a string: the per-pand choice among the nearest donors. */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

/** The pand's donor: one of the `DONOR_K` nearest (ties broken by pand id), picked by the pand id's hash. */
export function donorFor(t: BeltTarget, donors: readonly BeltDonor[], look: LookDistrict = BELT_LOOK): { donor: BeltDonor; distance: number; rank: number; of: number } | null {
  // A flat-topped pand never takes a gabled donor (while any other is left): the gable would stand on no roof.
  // A stated crown picks the donors of its family (else any gabled donor for a stated gable). Unstated, the pand takes a
  // cornice: only a photo read or the register says gable (held-out rounds 1-3: gables over flat fronts the register is
  // silent on were the judges' commonest crown fault).
  const st = t.statedCrown;
  let pool: readonly BeltDonor[] = st ? donors.filter(d => admits(st, String(d.answer.crown))) : [];
  if (st && !pool.length && GABLED_CROWNS.has(st)) pool = donors.filter(d => GABLED_CROWNS.has(String(d.answer.crown)));
  if (!pool.length) pool = donors.filter(d => !GABLED_CROWNS.has(String(d.answer.crown)));
  const near = (pool.length ? pool : donors).filter(d => d.pandId !== t.pandId).map(d => ({ d, s: donorDistance(t, d, look) }))
    .sort((a, b) => a.s - b.s || (a.d.pandId < b.d.pandId ? -1 : 1)).slice(0, DONOR_K);
  if (!near.length) return null;
  const rank = hash32(t.pandId) % near.length;
  return { donor: near[rank].d, distance: +near[rank].s.toFixed(3), rank, of: near.length };
}

/** A souterrain's share of a storey pitch in the drawn wall (rowSeries: SOUTERRAIN_FACTOR, basement windows 0.35). */
export const SOUTERRAIN_SHARE: Readonly<Record<string, number>> = { souterrain: 0.58, 'stoop-and-windows': 0.58, windows: 0.35 };
/**
 * A donor-filled front's bays from its width: the belt's own reads by width (1859 fronts, round 8: under 4.5 m two bays
 * in 63 %, 4.5-8 m three in 71-93 %, wider about one per 2.6 m), not the donor's axis, which drew 4.9-5.1 m fronts at
 * two bays (Amstel 182460, 182461) and 6.5-8 m fronts at four in 36 % against 3 % read.
 */
export function beltBays(widthM: number): number {
  return widthM < 4.5 ? 2 : widthM < 8 ? 3 : Math.max(3, Math.round(widthM / 2.6));
}
/**
 * The donor's read fitted to the pand: its storeys to the pand's eaves at the donor's own storey pitch (held to PITCH_M), its bays to the
 * pand's width at the donor's own axis, the door kept inside the ground bays. Everything else is the donor's as read.
 */
export function fittedRead(t: BeltTarget, d: BeltDonor, look: LookDistrict = BELT_LOOK): DescriberAnswer {
  const a = structuredClone(d.answer) as DescriberAnswer & { columns?: number[]; storeyParts?: { full?: number }; groundBays?: number; doorIndex?: number };
  const pitch = t.warehouse ? WAREHOUSE_PITCH_M : Math.min(look.pitchM.max, Math.max(look.pitchM.min, d.heightM / (d.answer.storeys as number)));
  if (t.storeys && t.storeys > 0) { if (t.storeys !== a.storeys) { a.storeys = t.storeys; if (a.storeyParts) a.storeyParts.full = t.storeys; delete a.columns; } }
  else if (t.eavesM !== null) {
    // A souterrain takes its cell of the wall first (the row draws it SOUTERRAIN_FACTOR of the pitch, basement windows
    // BASEMENT_WINDOWS_FACTOR; round 7: Prinsengracht 175987, an almshouse front of two storeys over a souterrain, drawn
    // three over one at 11.5 m).
    const sub = SOUTERRAIN_SHARE[String((a as { basement?: string }).basement)] ?? 0;
    const n = Math.max(1, Math.round(t.eavesM / pitch - sub));
    if (n !== a.storeys) { a.storeys = n; if (a.storeyParts) a.storeyParts.full = n; delete a.columns; }
  }
  const axis = d.widthM / (d.answer.bays as number);
  if (axis > 0.8) {
    const b = beltBays(t.widthM);
    if (b !== a.bays) {
      const wasAll = a.groundBays === a.bays;
      a.bays = b; delete a.columns;
      if (wasAll || (typeof a.groundBays === 'number' && a.groundBays > b)) a.groundBays = b;
      if (typeof a.doorIndex === 'number' && typeof a.groundBays === 'number') a.doorIndex = Math.min(a.doorIndex, a.groundBays - 1);
    }
  }
  if (t.statedCrown && GABLED_CROWNS.has(t.statedCrown)) (a as { crown: string }).crown = t.statedCrown;
  // The register's finish: plaster a pale stucco front, stone a pale stone one; a stated brick front is never stucco.
  const ax = a as { finish?: string; pale?: boolean; basement?: string };
  if (t.finish === 'plaster') { ax.finish = 'stucco'; ax.pale = true; }
  else if (t.finish === 'stone') { ax.finish = 'stone'; ax.pale = true; }
  else if ((t.finish === 'brick' || t.finish === 'ornamentalBrick') && (ax.finish === 'stucco' || ax.finish === 'painted-brick')) { ax.finish = 'brick'; delete ax.pale; }
  // A stated painted front (the register, or the photo finish reader) over a brick donor is painted brick.
  else if (t.finish === 'painted' && ax.finish === 'brick') ax.finish = 'painted-brick';
  // The register silent or brick: a donor's paint or stucco is not this house's. The wall is brick, judged from the
  // neighbours (round 4: pale, cream and tan fronts drawn where the photo is dark or red-brown brick; David's colour by
  // judgement, plausible from the neighbours). Only the register (or the pand's own read) paints a front.
  else if (t.finish !== 'painted' && (ax.finish === 'stucco' || ax.finish === 'painted-brick' || ax.finish === 'stone')) { ax.finish = 'brick'; delete ax.pale; }
  // No roof storey stated: the donor's mansard and dormers stay with the donor (a cornice front gets a flat lid behind).
  if (!t.roofStorey) stripRoofStorey(a);
  // A donor's one-off white dressing stays with the donor (held-out rounds 5-6: heavy block surrounds, bands, balconies and
  // porches drawn where the photos show plain fronts): 89 % of the belt's reads show plain windows, and the nearest-donor
  // pick multiplied each rare dressing over many pands. Own reads and the register still draw them.
  const ad = a as { windowSurround?: string; bands?: string; gaps?: Array<{ component?: string; what: string }> };
  // A donor's full frame (drawn as stone lintels) goes too (round 9: Reguliersgracht 178585 drew white surrounds the photo does
  // not show; judges named heavy white in four rounds). Only a sill travels.
  if (ad.windowSurround && ad.windowSurround !== 'none' && ad.windowSurround !== 'not-visible' && ad.windowSurround !== 'sill') ad.windowSurround = 'none';
  if (ad.bands && ad.bands !== 'none' && ad.bands !== 'not-visible') ad.bands = 'none';
  if (ad.gaps) ad.gaps = ad.gaps.filter(g => !DONOR_ONE_OFF.test(g.what));
  // A warehouse: its ground is the warehouse's (no house door and stoop), unless a shop is on record.
  if (!t.warehouse && a.ground === 'warehouse') (a as { ground: string }).ground = 'dwelling';
  if (t.warehouse && !t.shop) { (a as { ground: string }).ground = 'warehouse'; if (ax.basement === 'stoop' || ax.basement === 'stoop-and-windows') ax.basement = 'none'; }
  // No shop on record: the donor's shopfront becomes a house ground storey with its door.
  if (!t.shop && a.ground === 'shopfront') (a as { ground: string }).ground = 'dwelling';
  if (t.stoop && !t.shop && ax.basement !== 'stoop' && ax.basement !== 'stoop-and-windows') ax.basement = 'stoop';
  if (t.shop && a.ground !== 'shopfront') {
    (a as { ground: string }).ground = 'shopfront';
    if (a.basement === 'stoop' || a.basement === 'stoop-and-windows') (a as { basement: string }).basement = 'none';
  }
  a.pandId = t.pandId;
  return a;
}
