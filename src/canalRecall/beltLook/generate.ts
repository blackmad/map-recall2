/**
 * Belt look generator (lane D, 2026-11-15): every undescribed canal-belt pand as a house-rows front. The street-side rows
 * and their front lines are the buurt generator's (`buurtGenerator/rows.ts`: party-wall rows on one front street, from BAG
 * footprints and OSM names; a lone pand between described ones is a one-member row); each member takes its own D1 read when the belt tranche read it, else its donor's read fitted
 * to it (`donors.ts`); the row is then solved by lane D's row solve as any belt row is (series, the belt gable rises and
 * dress, the 3DBAG ridge, canal windows), so the belt kit (BELT_GABLE outlines, lane R's stone and stoops) draws them; a
 * 1700s neck or bell series then takes the period's gable stone (carved claws, dark hood, neck carving: `stone.ts`), an
 * 1800s cornice series a painted timber cornice (`cornice.ts`). A member's year is the register's facade year when stated.
 *
 * Provenance: a field the solve takes from a donor's read is not a read of this house. Every such field is relabelled
 * `period-default` with a ref naming the belt look and the donor, so the spec emit and `check:rows` never mistake it for a
 * reading. A pand's own read keeps its sources. Described pands (published specs and records, models, building types, the
 * lane D rows) never enter a row: they only break one, and their records stay on top. Pure: no fs, no DOM.
 */
import type { DescriberAnswer } from '../houseSpec/describer.ts';
import { solveRow, type MemberInput, type RowInput } from '../houseSpec/row/solve.ts';
import type { RowDesign, RowField, RowRecord } from '../houseSpec/row/types.ts';
import { districtRows, type GenPand, type GenRow, type GenStreet } from '../buurtGenerator/rows.ts';
import { BELT_LOOK, donorDistance, donorFor, fittedRead, frontTopM, gableable, GABLED_CROWNS, mansardAsDormers, SOUTERRAIN_SHARE, stripRoofStorey, type BeltDonor, type BeltTarget, type LookDistrict } from './donors.ts';
import { MANSARD_RISE } from '../houseLine/rowFront.ts';
import type { RowGable, RowRoofStorey } from '../houseSpec/row/types.ts';
import { hexToOklab } from '../houseSpec/wallColour.ts';
import { measuredFlatTop, roofStoreyOverCornice, slopedBandTop } from './roofSignals.ts';
import { dressBeltStone } from './stone.ts';
import { dressBeltCornice } from './cornice.ts';
import { brickFromSample, JUDGED_PALETTE, lchOf, variedTone, type JudgedFamily } from '../houseSpec/judgedColour.ts';
import type { RowFrontRecord } from '../houseLine/rowFront.ts';
import type { AhnFront } from './ahnFront.ts';

export interface BeltRead { answer: DescriberAnswer; sample?: string; ref: string }
/** What a published source states for a pand (the monument register via house-specs): its crown and facade year. */
export interface BeltStated { crown?: string; year?: number; shop?: boolean; finish?: BeltTarget['finish']; storeys?: number; stoop?: boolean; roofStorey?: boolean; warehouse?: boolean; elements?: string[]; /** A published house spec states a mansard (not the register's dakkapel). */ mansard?: boolean;
  /** A published house spec's measured wall colour (palette.brick). */ specHex?: string;
  /** The pand's cut wall sample (lane W1 on the pinned capture), from any cut, readable or not. */ photo?: BeltPhoto;
  /** The photo crown reader's (round 10): a tall cornice (bracketed or heavy) read on the cut, and its full storeys. */
  tallCornice?: string; photoStoreys?: number; photoSouterrain?: boolean;
  /** Centrum round 6: the photo reads a roof in view over the wall (a mansard or pitched eaves). */
  photoRoof?: boolean;
  /** Centrum round 7: the photo reads the roof storey's slope as red pantile (Marnixplein 168300-174907). */
  roofMaterial?: 'tile';
  /** Centrum round 7: the photo's upper-window dressing, in the describer's windowSurround words (stone-lintel, keystone, block-dressings, none). */
  photoDress?: string;
  /** The photo colour reader's (round 11): the wall's colour family read on the cut, set only where the register is silent. */
  photoColour?: PhotoColour }
/**
 * The photo crown reader (round 10: Singel 168333, Amstel 165494 and Prinsengracht 173558-173557, neck gables drawn as
 * flat cornices; Prinsengracht 173559 two storeys under its neck): opus on the same leaf-off cut as the finish read, the
 * describer's crown, cornice and storey-count rules (prompt v4.3). Each part is used only at PHOTO_CROWN_MIN: a gabled crown
 * states the crown where the register is silent; a tall cornice (bracketed, heavy, attic frieze) stands at the band's top (tallCorniceTop);
 * the storey count, where the register is silent, when it gives the wall a plausible pitch (PHOTO_STOREY_PITCH_M).
 */
export interface PhotoCrown { crown: string; cornice: string; full: number | null; souterrain: boolean | null; cc: number; sc: number }
export const PHOTO_CROWN_MIN = 0.7;
/**
 * Two crown reads of one front on different capture dates (round 11: a second capture for every read under
 * PHOTO_CROWN_MIN or not visible, and for the held-out gables Singel 177194 and Keizersgracht 180133, both re-read as
 * gables). Each part takes the confident read; two confident reads that disagree (gabled against not, or a different
 * storey count) leave that part unstated (its confidence dropped under PHOTO_CROWN_MIN).
 */
export function mergeCrownReads(a: PhotoCrown, b: PhotoCrown): PhotoCrown & { conflict?: string[] } {
  const ok = (r: PhotoCrown) => r.cc >= PHOTO_CROWN_MIN && r.crown !== 'not-visible';
  const out: PhotoCrown & { conflict?: string[] } = { ...a }, conflict: string[] = [];
  if (ok(a) && ok(b) && GABLED_CROWNS.has(a.crown) !== GABLED_CROWNS.has(b.crown)) { conflict.push('crown'); out.cc = 0.5; }
  else if (ok(b) && (!ok(a) || b.cc > a.cc)) Object.assign(out, { crown: b.crown, cornice: b.cornice, cc: b.cc });
  const sok = (r: PhotoCrown) => r.sc >= PHOTO_CROWN_MIN && Number.isInteger(r.full);
  if (sok(a) && sok(b) && a.full !== b.full) { conflict.push('storeys'); out.sc = 0.5; }
  else if (sok(b) && (!sok(a) || b.sc > a.sc)) Object.assign(out, { full: b.full, souterrain: b.souterrain, sc: b.sc });
  return conflict.length ? { ...out, conflict } : out;
}
/** A tall cornice: on brackets, deep, or over an attic frieze (calibration: 5 of 6 confident photo reads agree with D1). */
export const TALL_CORNICES: ReadonlySet<string> = new Set(['bracketed', 'heavy', 'attic-frieze']);
export function photoCrown(p: PhotoCrown | undefined): { crown?: string; tallCornice?: string; storeys?: number; souterrain?: boolean } {
  if (!p) return {};
  const out: { crown?: string; tallCornice?: string; storeys?: number; souterrain?: boolean } = {};
  if (p.cc >= PHOTO_CROWN_MIN && GABLED_CROWNS.has(p.crown)) out.crown = p.crown;
  if (p.cc >= PHOTO_CROWN_MIN && (p.crown === 'cornice' || p.crown === 'mansard') && TALL_CORNICES.has(p.cornice)) out.tallCornice = p.cornice;
  if (p.sc >= PHOTO_CROWN_MIN && Number.isInteger(p.full) && (p.full as number) >= 1) { out.storeys = p.full as number; if (p.souterrain !== null) out.souterrain = p.souterrain; }
  return out;
}
/** A gable's least rise over its foot (m) where a look lifts the foot to the photo's storeys (Centrum round 6). */
export const GABLE_RISE_FLOOR_M: Readonly<Record<string, number>> = { neck: 3.5, 'raised-neck': 3.5, bell: 3.5, step: 3.5, point: 3, spout: 3, shouldered: 3 };
/** The storey pitch (m) a gable's foot is lifted to over a photo storey count (an old canal house's storeys, 2.8-3.2 m). */
export const PHOTO_FOOT_PITCH_M = 2.8;
/** The storey pitch (m) a photo storey count must give the wall (its souterrain a SOUTERRAIN_SHARE cell) to be used. */
export const PHOTO_STOREY_PITCH_M = { min: 2.4, max: 5 } as const;
export function plausiblePhotoStoreys(n: number | undefined, souterrain: boolean | undefined, wallM: number | null): number | undefined {
  if (!n || wallM === null) return undefined;
  const pitch = wallM / (n + (souterrain ? SOUTERRAIN_SHARE.souterrain : 0));
  return pitch >= PHOTO_STOREY_PITCH_M.min && pitch <= PHOTO_STOREY_PITCH_M.max ? n : undefined;
}
/**
 * The register states a roof storey only with a dakkapel (dormer). An attiek is a raised parapet over the cornice, not a roof
 * storey (round 9: Keizersgracht 177468, register stoep + attiek, drew a hipped roof with dormers over a flat white cornice).
 */
export function registerRoofStorey(elements: readonly string[]): boolean {
  return elements.includes('dormer');
}
/** A cut's wall sample: hex, OKLab lightness, chroma, hue (deg) and the sampled pixel count. */
export interface BeltPhoto { hex: string; L: number; C: number; h: number; n: number }
/** A photo wall sample strong enough to colour a front: enough wall pixels, and neither foliage (green hue with chroma) nor a
 *  washed-out or shadowed patch (lightness band). Round 8: Keizersgracht 176392, an unreadable cut (no storeys seen) whose
 *  wall sample #4a423b is the dark brick of the photo, was drawn #6f5543 from the neighbours. */
export const PHOTO_SAMPLE = { minN: 200, foliageHue: [95, 170] as const, foliageC: 0.025, minL: 0.2, maxL: 0.8 } as const;
/**
 * The photo finish reader (round 9, item 3: Singel 167687's stucco drawn as brick): a cut's wall finish read from the
 * photo (opus on the cut, or a unanimous Node colour/texture neighbour vote for plain brick), with a confidence. It
 * states the finish only where the register is silent and the read is confident; stucco a pale plastered front, paint a
 * painted brick one. Calibration on 60 labelled belt cuts (20 per finish): opus 56/60, stucco 20/20 with no false stucco;
 * haiku 25/60 (not used); the Node vote 74 % overall; a unanimous brick vote 77 of 87 (the only Node read kept).
 */
export interface PhotoFinish { finish: 'stucco' | 'paint' | 'brick' | 'unclear'; confidence: number; reader: string }
export const PHOTO_FINISH_MIN = 0.7;
export function photoFinish(p: PhotoFinish | undefined): BeltTarget['finish'] | undefined {
  if (!p || p.confidence < PHOTO_FINISH_MIN) return undefined;
  return p.finish === 'stucco' ? 'plaster' : p.finish === 'paint' ? 'painted' : p.finish === 'brick' ? 'brick' : undefined;
}
export function strongPhoto(p: BeltPhoto | undefined): p is BeltPhoto {
  if (!p || !(p.n >= PHOTO_SAMPLE.minN) || !(p.L >= PHOTO_SAMPLE.minL && p.L <= PHOTO_SAMPLE.maxL)) return false;
  return !(p.C >= PHOTO_SAMPLE.foliageC && p.h >= PHOTO_SAMPLE.foliageHue[0] && p.h <= PHOTO_SAMPLE.foliageHue[1]);
}
/** OKLab distance over which a spec's wall colour and a strong photo sample disagree (flagged, not overridden). */
export const SPEC_PHOTO_FLAG = 0.1;
export function specPhotoDisagree(sd: BeltStated | undefined): { specHex: string; photoHex: string; dE: number } | null {
  if (!sd?.specHex || !strongPhoto(sd.photo)) return null;
  const a = hexToOklab(sd.specHex), b = hexToOklab(sd.photo.hex), dE = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  return dE > SPEC_PHOTO_FLAG ? { specHex: sd.specHex, photoHex: sd.photo.hex, dE: +dE.toFixed(3) } : null;
}
export interface BeltGenResult {
  rows: RowRecord[];
  /** Per drawn pand, where its design came from. */
  provenance: Record<string, { own: true; ref: string } | { donor: string; distance: number; rank: number; of: number }>;
  skipped: Array<{ id: string; reason: 'described' | 'no-front' | 'single' | 'minor' | 'no-donor' }>;
  /** Round 12: runs of adjacent stucco or stone members drawn as one front (paleBlockWalls). */
  paleBlocks?: string[][];
  fronts: Record<string, { street: string; a: readonly [number, number]; b: readonly [number, number]; lengthM: number }>;
}

/** The donor's measured wall when it is a brick colour to lend: a plain brick front, its sample not a buff brick. */
export function brickDonorSample(d: Pick<BeltDonor, 'answer' | 'sample'>): string | undefined {
  const a = d.answer as { finish?: string; pale?: boolean };
  if (!d.sample || a.finish !== 'brick' || a.pale) return undefined;
  return brickFromSample(lchOf(d.sample)) === 'buff-brick' ? undefined : d.sample;
}

/**
 * The measured brick of the pand's nearest brick donor (donorDistance; a plain brick front with a non-buff sample), for a
 * brick front whose own donor lends no brick colour (its donor painted, stucco or pale). Without it the read's brick was
 * judged with no sample and took the era default, red-brown before the ring: 468 of the 469 red-brown belt fronts of
 * round 6 (held-out round 6: Prinsengracht 168601 and 182462 drawn red where the photos are brown and grey-purple).
 */
export function nearestBrickSample(t: BeltTarget, donors: readonly BeltDonor[], look: LookDistrict = BELT_LOOK): { sample: string; from: string } | null {
  let best: { sample: string; from: string; s: number } | null = null;
  for (const d of donors) {
    if (d.pandId === t.pandId) continue;
    const sample = brickDonorSample(d);
    if (!sample) continue;
    const s = donorDistance(t, d, look);
    if (!best || s < best.s || (s === best.s && d.pandId < best.from)) best = { sample, from: d.pandId, s };
  }
  return best && { sample: best.sample, from: best.from };
}
const pandNumber = (id: string) => id.replace(/^NL\.IMBAG\.Pand\./, '');
/**
 * A front's wall top over the street: a gabled front stands at the front top (its gable rises to the ridge); a cornice
 * front at 3DBAG's representative height, or, under a roof storey (stated, or its own read's mansard), that height less
 * the kit's mansard rise, never under the eaves (held-out round 5: Molenpad 174768, a cornice front with a register dormer,
 * stood at 14.1 m with a mansard on top against about 10 m in the photo).
 */
export function corniceLine(read: { crown?: unknown; storeyParts?: { roof?: unknown } }, t: Pick<BeltTarget, 'heightM' | 'roofStorey'>, eaves: number | null, rawEaves: number | null = eaves): number | null {
  if (GABLED_CROWNS.has(String(read.crown)) || t.heightM == null || eaves === null) return eaves;
  const roof = t.roofStorey || read.crown === 'mansard' || read.storeyParts?.roof === 'mansard' || read.storeyParts?.roof === 'attic' || read.storeyParts?.roof === 'dormers';
  // Under a roof storey the front top (frontTopM, which lifts a low 3DBAG eave to the height) is the height less the
  // mansard, never under 3DBAG's own eaves.
  if (roof) return +Math.max(rawEaves ?? eaves, Math.min(eaves, t.heightM - MANSARD_RISE.period)).toFixed(2);
  return t.heightM > eaves ? +t.heightM.toFixed(2) : eaves;
}
/**
 * Centrum round 7 (Goudsbloemstraat 172466-172514: four storeys under a roof storey drawn at the band's 14.8 m, the photo's
 * cornice about 12.5): under a roof storey (the register's or the photo's) the AHN band's top is the roof storey's, so a
 * look with a measured pitch caps a cornice wall at the photo's storeys at that pitch, never under the band p50.
 */
export function underRoofStoreyTop(top: number | null, look: Pick<LookDistrict, 'gableFootPitchM'>, t: Pick<BeltTarget, 'roofStorey'>, sd: BeltStated | undefined, af: AhnFront | undefined): number | null {
  if (top === null || !look.gableFootPitchM || !sd?.photoStoreys || !(t.roofStorey || sd.photoRoof) || sd.tallCornice) return top;
  return +Math.max(af?.p50 ?? 0, Math.min(top, (sd.photoStoreys + (sd.photoSouterrain ? SOUTERRAIN_SHARE.souterrain : 0)) * look.gableFootPitchM)).toFixed(2);
}
/** A register-stated roof storey over a donor read with none: one plain dormer in a roof storey (the register's dakkapel). */
export function statedDormer(a: DescriberAnswer): DescriberAnswer {
  const ar = a as { storeyParts?: { roof?: string }; dormers?: unknown; crown?: string };
  if (GABLED_CROWNS.has(String(ar.crown)) || (ar.dormers && typeof ar.dormers === 'object' && (ar.dormers as { count?: number }).count)) return a;
  if (ar.storeyParts?.roof === 'mansard' || ar.storeyParts?.roof === 'attic') return a;
  ar.dormers = { count: 1, kind: 'plain' };
  if (ar.storeyParts) ar.storeyParts.roof = 'dormers';
  return a;
}
export const BELT_LOOK_REF = 'belt look (lane D 2026-11-15, src/canalRecall/beltLook)';

/** How far an AHN front height may stand outside the pand's 3DBAG roof (m): under its eaves, over its ridge (or height). */
export const AHN_BOUNDS = { underEavesM: 1.5, overRidgeM: 0.5, gableMinRiseM: 2 } as const;
/** The AHN front's wall top for a cornice front (its band p90), when it stands within the pand's 3DBAG roof; else null. */
export function ahnCorniceTop(a: AhnFront | undefined, pand: { eavesM: number | null; heightM?: number | null; ridgeM: number | null }): number | null {
  if (!a) return null;
  const lo = Math.min(pand.eavesM ?? Infinity, pand.heightM ?? Infinity) - AHN_BOUNDS.underEavesM, hi = Math.max(pand.ridgeM ?? -Infinity, pand.heightM ?? -Infinity) + AHN_BOUNDS.overRidgeM;
  return Number.isFinite(lo) && Number.isFinite(hi) && a.p90 >= lo && a.p90 <= hi && a.p90 >= 3 ? a.p90 : null;
}
/**
 * A tall cornice's top from AHN (TALL_CORNICES): the band's max (round 10: Keizersgracht 172210, an attic frieze under a
 * consoled cornice whose top AHN measures at 19.19 m, drawn at the band's p90 18.01 m). The cornice projects over the street in a strip a metre
 * deep, too few band cells to reach the p90; a max more than TALL_CORNICE_MAX_OVER_P90_M over the p90 is a chimney or a
 * roof behind, not the cornice. A plain or frieze cornice keeps the p90.
 */
export const TALL_CORNICE_MAX_OVER_P90_M = 1.5;
export function tallCorniceTop(a: AhnFront | undefined, pand: { eavesM: number | null; heightM?: number | null; ridgeM: number | null }): number | null {
  // The p90 within the pand's roof (ahnCorniceTop); the max may stand over 3DBAG's height, which is a roof percentile and
  // under a flat roof's projecting cornice (172210: height 18.13 m, no ridge).
  return !a || ahnCorniceTop(a, pand) === null || a.max - a.p90 > TALL_CORNICE_MAX_OVER_P90_M ? null : a.max;
}
/** A gabled front's apex from AHN (the band's max), capped by the 3DBAG ridge and at least the minimum rise over the foot. */
export function ahnGableApex(a: AhnFront | undefined, foot: number | null, ridge: number | null): number | null {
  if (!a || foot === null) return ridge;
  const apex = Math.max(foot + AHN_BOUNDS.gableMinRiseM, ridge !== null ? Math.min(ridge, a.max) : a.max);
  return +apex.toFixed(2);
}

/** A generator row as a row-solve input: own reads where read, donors' fitted reads elsewhere. `ahn`: measured AHN street
 *  fronts per pand (ahnFront.ts): a cornice front stands at its band's p90, a gable's apex at its band's top (held-out
 *  round 5 judges' photo heights matched AHN where 3DBAG's eaves and height did not). */
export function beltRowInput(row: GenRow, reads: ReadonlyMap<string, BeltRead>, donors: readonly BeltDonor[], at: string, prov: BeltGenResult['provenance'], stated: ReadonlyMap<string, BeltStated> = new Map(), ahn: ReadonlyMap<string, AhnFront> = new Map(), look: LookDistrict = BELT_LOOK, blocks?: string[][]): RowInput | null {
  const members: MemberInput[] = [];
  // Round 12 (Keizersgracht 169442: a stone and stucco block drawn as brick with gables): adjacent members whose finish is
  // read stucco or stone are one front; none takes a donor's gable.
  const runs = paleRuns(row.members.map(m => { const pid = pandNumber(m.pand.id); return paleEvidence(stated.get(pid), reads.get(pid)?.answer); }));
  const inBlock = new Set(runs.flatMap(r => r.map(i => pandNumber(row.members[i].pand.id))));
  for (const r of runs) blocks?.push(r.map(i => pandNumber(row.members[i].pand.id)));
  for (const m of row.members) {
    // The front's top (frontTopM: 3DBAG's eaves is often a rear eave under the street cornice).
    const pid = pandNumber(m.pand.id), eaves = frontTopM(m.pand.eavesM, m.pand.heightM, m.pand.ridgeM), ridge0 = m.pand.ridgeM;
    const af = ahn.get(pid), sloped = look.slopedBand ? slopedBandTop(m.pand, af) : null, ahnTop = sloped ?? ahnCorniceTop(af, m.pand);
    // A tall cornice (its own read's, or the photo crown reader's) stands at the band's top (tallCorniceTop).
    const tallTop = sloped ?? tallCorniceTop(af, m.pand) ?? ahnTop;
    // roofSignals.ts: a gable never stands on a measured flat top (a register gable there describes a front that is gone).
    const flatTop = !!look.flatTopNoGable && measuredFlatTop(m.pand, af);
    const sd0 = stated.get(pid), sd: BeltStated | undefined = flatTop && sd0?.crown && GABLED_CROWNS.has(sd0.crown) ? { ...sd0, crown: undefined } : sd0;
    const t: BeltTarget = { pandId: pid, street: row.street, year: sd?.year ?? m.pand.year, widthM: m.front.lengthM, eavesM: eaves, ridgeM: ridge0, roofCode: m.pand.roofCode ?? null, heightM: m.pand.heightM ?? null,
      ...(sd?.crown ? { statedCrown: sd.crown } : {}), ...(sd?.shop ? { shop: true } : {}), ...(sd?.finish ? { finish: sd.finish } : {}), ...(sd?.storeys ? { storeys: sd.storeys } : {}), ...(sd?.stoop ? { stoop: true } : {}), ...(sd?.roofStorey ? { roofStorey: true } : {}), ...(sd?.warehouse ? { warehouse: true } : {}), ...(sd?.elements?.length ? { elements: sd.elements } : {}), ...(look !== BELT_LOOK ? { district: look.id } : {}) };
    const own = reads.get(pid);
    let read: DescriberAnswer, sample: string | undefined, readRef: string, photoStoreys: number | undefined;
    // A pand's own read keeps an attic it saw; dormers read over a cornice are not a mansard front unless the register
    // states one (held-out round 5: Keizersgracht 176027-176028 and 165044 drew whole slate mansards from one dormer
    // each), and a read mansard stands as dormers (round 7 sample: one read mansard in five was one).
    if (own) {
      read = t.roofStorey ? mansardAsDormers(structuredClone(own.answer)) : stripRoofStorey(structuredClone(own.answer), true); sample = own.sample; readRef = own.ref; prov[pid] = { own: true, ref: own.ref };
      // Round 12: a stated plaster or stone finish stands where the pand's own read could not see the wall (Keizersgracht
      // 172271, register plaster, read not-visible, drawn purple-brown brick from its neighbours).
      const rf = read as { finish?: string; pale?: boolean };
      if ((t.finish === 'plaster' || t.finish === 'stone') && (!rf.finish || rf.finish === 'not-visible')) { rf.finish = t.finish === 'plaster' ? 'stucco' : 'stone'; rf.pale = true; }
      // Round 12 (Keizersgracht 176021, a neck over four storeys read as three and drawn 2 m low): under a look's gable foot
      // pitch, an own gable takes the photo crown reader's storey count (the AHN band's p50 giving it a plausible pitch).
      if (look.gableFootPitchM && GABLED_CROWNS.has(String(read.crown)) && sd?.photoStoreys) {
        const ps = plausiblePhotoStoreys(sd.photoStoreys, sd.photoSouterrain, af ? af.p50 : eaves);
        if (ps) { photoStoreys = ps; (read as { storeys?: number | string }).storeys = ps; }
      }
    }
    else {
      const d = donorFor(t, flatTop || inBlock.has(pid) ? donors.filter(x => !GABLED_CROWNS.has(String(x.answer.crown))) : donors, look);
      if (!d) return null;
      // A cornice front stands at 3DBAG's representative height (its storeys fitted to it); a gable's foot stays at the
      // front top, the gable rising to the ridge.
      const dGabled = GABLED_CROWNS.has(String(t.statedCrown ?? d.donor.answer.crown));
      let corniceTop = !dGabled && eaves !== null ? ((sd?.tallCornice ? tallTop : ahnTop) ?? (t.heightM != null ? corniceLine({ crown: 'cornice' }, t, eaves, m.pand.eavesM) : null)) : null;
      // Centrum round 7 (Goudsbloemstraat 172466-172514: four storeys under a roof storey drawn at the band's 14.8 m, the
      // photo's cornice about 12.5): under a roof storey (the register's or the photo's) the AHN band's top is the roof
      // storey's, so a look with a measured pitch caps the wall at the photo's storeys at that pitch, never under the band p50.
      corniceTop = underRoofStoreyTop(corniceTop, look, t, sd, af);
      // The photo's storey count where the register is silent, when it gives the wall (a gable's foot, else the cornice
      // top) a plausible pitch.
      // A gable's wall may stand up to its AHN apex less the minimum rise (3DBAG's eave is often a rear one: round 10,
      // Singel 177196, a bell over four storeys whose 3DBAG eave is 8.7 m under an AHN apex of 13.43 m).
      const gWall = dGabled && af && eaves !== null ? Math.max(eaves, ahnGableApex(af, m.pand.eavesM ?? eaves, ridge0)! - AHN_BOUNDS.gableMinRiseM) : eaves;
      const ps = t.storeys ? undefined : plausiblePhotoStoreys(sd?.photoStoreys, sd?.photoSouterrain, dGabled ? gWall : corniceTop);
      photoStoreys = ps;
      read = fittedRead({ ...t, ...(corniceTop !== null ? { eavesM: corniceTop } : {}), ...(ps ? { storeys: ps } : {}) }, d.donor, look);
      if (sd?.tallCornice && !GABLED_CROWNS.has(String(read.crown))) (read as { cornice?: string }).cornice = sd.tallCornice;
      // Centrum round 7 (Nicolaas Witsenkade 179373-179376, Kromme Waal: white window dressings missing): the photo's
      // read dressing stands over the donor's (describer windowSurround vocabulary).
      if (sd?.photoDress) (read as { windowSurround?: string }).windowSurround = sd.photoDress;
      // Centrum round 6 (Kloveniersburgwal 177790, Marnixstraat 168522: a slate roof storey from 3DBAG's ridge alone over
      // fronts the photo shows flat-corniced): a look with roofStoreyNeedsPhoto draws the measured roof storey only where
      // the photo reads a roof in view (photoRoof); the register's dormer (t.roofStorey) still stands.
      if (t.roofStorey || (look.measuredRoofStorey && !GABLED_CROWNS.has(String(read.crown)) && roofStoreyOverCornice(m.pand, corniceTop) && (!look.roofStoreyNeedsPhoto || !!sd?.photoRoof))) read = statedDormer(read);
      readRef = `${BELT_LOOK_REF}: donor ${d.donor.pandId}`;
      // A stated plaster or stone front is judged pale from its finish, not the donor's brick sample.
      // A donor's sample is a brick colour only when the donor is a brick front and the sample is not a buff (tan) brick;
      // otherwise the solve takes the neighbours' family (round 4: tan and pale fronts over dark brick rows).
      // A published spec's measured wall colour stands (a strong photo read that disagrees is flagged by the script); else
      // the pand's own cut sample when strong (round 8: an unreadable cut still shows the wall); else the donor's brick.
      // A plastered or stone front with a strong cut sample takes the photo's own colour (round 9: Singel 167687's grey
      // stucco); without one it is judged pale.
      sample = t.finish === 'plaster' || t.finish === 'stone' ? (strongPhoto(sd?.photo) ? sd!.photo!.hex : undefined) : sd?.specHex ?? (strongPhoto(sd?.photo) ? sd!.photo!.hex : brickDonorSample(d.donor));
      if (!sample && (read as { finish?: string }).finish === 'brick') sample = nearestBrickSample(t, donors, look)?.sample;
      prov[pid] = { donor: d.donor.pandId, distance: d.distance, rank: d.rank, of: d.of };
    }
    const gabled = GABLED_CROWNS.has(String(read.crown));
    const tall = !gabled && TALL_CORNICES.has(String((read as { cornice?: string }).cornice)) && (own ? true : !!sd?.tallCornice);
    const top0 = !gabled && (tall ? tallTop : ahnTop) !== null ? (tall ? tallTop : ahnTop) : corniceLine(read, t, eaves, m.pand.eavesM);
    const top = gabled || tall ? top0 : underRoofStoreyTop(top0, look, t, sd, af);
    // A gable's apex: the AHN front's top under the 3DBAG ridge (the ridge often belongs to the roof behind the front).
    // The minimum rise counts from 3DBAG's own eaves, not the front top lifted to the height (round 6: Keizersgracht 178869
    // and 178868, AHN front tops 15.05 and 15.5 m, drawn 16.3 m as front top 14.3 + 2).
    let ridge = gabled && af ? ahnGableApex(af, m.pand.eavesM ?? top, ridge0) : ridge0;
    // A gable over a photo storey count stands its foot at the storeys (PHOTO_FOOT_PITCH_M each), under the apex less the
    // minimum rise; apexOnFront then trims the rise to the apex.
    let foot = gabled && photoStoreys && ridge !== null && top !== null
      ? +Math.max(top, Math.min(ridge - AHN_BOUNDS.gableMinRiseM, photoStoreys * PHOTO_FOOT_PITCH_M)).toFixed(2) : top;
    // A look with a measured gable foot pitch (Centrum round 6: De Weteringschans Prinsengracht 179167, a neck over four
    // storeys drawn 14.6 m where the photo shows about 18; AHN's 0.5 m cells and 3DBAG's ridge both miss a thin neck): the
    // foot stands at the photo's storeys at that pitch, and the apex at least the crown's rise over it.
    if (look.gableFootPitchM && gabled && photoStoreys && ridge !== null && top !== null) {
      // Round 12: a souterrain under the storeys stands its share of a storey (gableFootPitch measures it so).
      // The floor is the AHN band's p50 (else 3DBAG's own eave) under `top`: a gable's frontTopM is lifted to 3DBAG's
      // height, near the apex (round 12: Keizersgracht 176021 floored at 13.01 m lifted its apex to 16.51, the photo ~15.5).
      // Centrum round 7: a look may count the souterrain otherwise (gableFootSouterrainShare; Prinsengracht 179167 and
      // Boomstraat 172663, necks over four storeys and a souterrain, stood at 16.7 / 15.8 m with 0.58, the photos ~14.5 / ~14).
      foot = +Math.max(Math.min(top, af ? af.p50 : m.pand.eavesM ?? top), (photoStoreys + (sd?.photoSouterrain ? look.gableFootSouterrainShare ?? SOUTERRAIN_SHARE.souterrain : 0)) * look.gableFootPitchM).toFixed(2);
      ridge = +Math.max(ridge, foot + (GABLE_RISE_FLOOR_M[String(read.crown)] ?? AHN_BOUNDS.gableMinRiseM)).toFixed(2);
    }
    members.push({ pandId: pid, label: `${row.street} (${pid.slice(-6)})`, numbers: [], built: t.year, widthM: +m.front.lengthM.toFixed(2),
      eaves3dbag: foot, height3dbag: foot, ...(ridge !== null && (gableable(t) || (gabled && af)) ? { ridge3dbag: +ridge.toFixed(2) } : {}),
      read, readRef, ...(sample ? { wallSample: sample } : {}) });
  }
  return { id: `${look.id}-${row.id}`, canalWindows: true, street: row.street, side: 'mixed', members, inputs: [BELT_LOOK_REF, 'public/data/extracts/amsterdam/bag-tiles/14', 'public/data/extracts/amsterdam/streets-routing.json'], solvedAt: at };
}

/** A field the solve drew from a donor (its ref cites a donor-filled member) becomes `period-default` under the belt look. */
export function relabelDonorFields(row: RowRecord, donorFilled: ReadonlySet<string>): RowRecord {
  const cites = (ref: string | undefined) => !!ref && [...donorFilled].some(id => ref.includes(id));
  const fix = (f: RowField<unknown> | undefined, onlyDonors: boolean) => {
    if (!f || f.source === 'reviewed' || f.source === 'period-default') return;
    if (onlyDonors || cites(f.ref)) { f.source = 'period-default'; f.ref = `${BELT_LOOK_REF}: ${f.ref ?? ''}`; }
  };
  for (const s of row.series) {
    const only = s.fronts.every(id => donorFilled.has(id.split('#')[0]));
    for (const v of Object.values(s.design as unknown as Record<string, RowField<unknown> | undefined>)) fix(v, only);
  }
  for (const f of row.fronts) {
    const only = donorFilled.has(f.pandId);
    for (const v of Object.values((f.overrides ?? {}) as Partial<Record<keyof RowDesign, RowField<unknown>>>)) fix(v, only);
    for (const v of Object.values(f.ground ?? {})) if (v && typeof v === 'object' && 'source' in (v as object)) fix(v as RowField<unknown>, only);
  }
  return row;
}

/**
 * The belt: rows from the undescribed pands, each solved as a belt row. `reads` are the belt tranche's own reads (pand ->
 * read); `donors` the usable reads the look draws from.
 */
export function generateBelt(pands: readonly GenPand[], streets: readonly GenStreet[], described: ReadonlySet<string>, reads: ReadonlyMap<string, BeltRead>, donors: readonly BeltDonor[], at: string, stated: ReadonlyMap<string, BeltStated> = new Map(), ahn: ReadonlyMap<string, AhnFront> = new Map(), look: LookDistrict = BELT_LOOK): BeltGenResult {
  const skipped: BeltGenResult['skipped'] = [], provenance: BeltGenResult['provenance'] = {}, fronts: BeltGenResult['fronts'] = {}, paleBlocks: string[][] = [];
  const free = pands.filter(p => { const d = described.has(pandNumber(p.id)); if (d) skipped.push({ id: pandNumber(p.id), reason: 'described' }); return !d; });
  const res = districtRows(free, streets, { singles: true });
  for (const u of res.unplaced) skipped.push({ id: pandNumber(u.id), reason: u.reason });
  const rows: RowRecord[] = [];
  for (const r of res.rows) {
    const input = beltRowInput(r, reads, donors, at, provenance, stated, ahn, look, paleBlocks);
    if (!input) { for (const m of r.members) skipped.push({ id: pandNumber(m.pand.id), reason: 'no-donor' }); continue; }
    const donorFilled = new Set(input.members.filter(m => 'donor' in provenance[m.pandId]).map(m => m.pandId));
    const elements = new Map(input.members.map(m => [m.pandId, stated.get(m.pandId)?.elements ?? []]));
    const dressed = dressBeltCornice(dressBeltStone(relabelDonorFields(solveRow(input), donorFilled), BELT_LOOK_REF, elements), BELT_LOOK_REF, elements);
    rows.push(pitchedDormers(warehouseFronts(apexOnFront(measuredGables(dressed, input, donorFilled), input, ahn), stated), stated));
    for (const m of r.members) fronts[pandNumber(m.pand.id)] = { street: m.front.street, a: m.front.aLngLat, b: m.front.bLngLat, lengthM: +m.front.lengthM.toFixed(2) };
  }
  return { rows, provenance, skipped, fronts, paleBlocks };
}

/** A donor-filled gable's measured rise: the 3DBAG ridge less the front top, held to this band (m). */
export const MEASURED_GABLE_RISE = { min: 2, max: 7 } as const;
/**
 * A donor-filled gabled front with a 3DBAG ridge and front top whose gap is a gable's (MEASURED_GABLE_RISE): its gable rises
 * from the measured front top to the ridge instead of the family's rise hung from the ridge (held-out round 5:
 * Driekoningenstraat 167637, a register point gable over 13.7 m eaves, drawn with its foot at 12.1 m). A read or reviewed
 * rise stays.
 */
export function measuredGables(row: RowRecord, input: RowInput, donorFilled: ReadonlySet<string>): RowRecord {
  for (const f of row.fronts) {
    if (f.sub || !donorFilled.has(f.pandId)) continue;
    const s = row.series.find(x => x.id === f.seriesId), m = input.members.find(x => x.pandId === f.pandId);
    const fo = f.overrides as { gable?: RowField<RowGable>; corniceTopM?: RowField<number | null>; crown?: RowField<string> };
    const g = fo.gable ?? s?.design.gable;
    if (!s || !m || !g?.value || g.source === 'reviewed' || !GABLED_CROWNS.has(String(fo.crown?.value ?? s.design.crown.value))) continue;
    if (!/no gable read/.test(g.ref ?? '')) continue;
    const foot = m.eaves3dbag, ridge = m.ridge3dbag;
    if (foot == null || ridge == null) continue;
    const rise = +(ridge - foot).toFixed(2);
    if (rise < MEASURED_GABLE_RISE.min || rise > MEASURED_GABLE_RISE.max) continue;
    fo.gable = { value: { ...g.value, riseM: rise }, source: 'period-default', ref: `${g.ref ?? ''}; ${BELT_LOOK_REF}: rise measured, 3DBAG ridge ${ridge} m less the front top ${foot} m` };
    fo.corniceTopM = { value: foot, source: 'period-default', ref: `${BELT_LOOK_REF}: the gable's foot at the measured front top (3DBAG), its apex on the ridge ${ridge} m` };
    f.topM = +(foot - (f.groundOffsetM ?? 0)).toFixed(2);
  }
  return row;
}

/** The warehouse parts a series draws: the loading doors stacked up the middle axis with their shutters, and the hoist. */
export const WAREHOUSE_EXTRAS = ['warehouse-shutters', 'hoist-beam'] as const;
/**
 * Warehouses as their own type (the register's pakhuis): a warehouse pand's front draws the loading-door axis and the hoist
 * beam; a pand whose register names a hoist beam draws the beam. Per front (a series may hold a warehouse beside a house of
 * the same outline); a reviewed extras list stays.
 */
/**
 * A belt roof storey is dormers in a dark pitched roof behind the cornice, not a slate mansard, unless a member's house spec
 * states a mansard or a reviewer set it (round 7 sample of 40 belt cuts: register dakkapels showed as dormers in a pitched
 * roof in 13 of 19, a mansard in none; read mansards held in 1 of 5; Prinsengracht 177416, Singel 167969).
 */
export function pitchedDormers(row: RowRecord, stated: ReadonlyMap<string, BeltStated>): RowRecord {
  const pitch = (f: RowField<RowRoofStorey> | undefined, ids: readonly string[]) => {
    if (!f || f.source === 'reviewed' || f.value.kind !== 'mansard' || ids.some(id => stated.get(id)?.mansard)) return;
    f.value = { ...f.value, pitched: true, material: ids.some(id => stated.get(id)?.roofMaterial === 'tile') ? 'tile' : 'slate' };
    f.ref = `${f.ref}; ${BELT_LOOK_REF}: dormers in a dark pitched roof, no mansard stated (a red tile hip read loud on the sheet, Prinsengracht 177410)`;
  };
  for (const s of row.series) pitch(s.design.roofStorey, row.fronts.filter(f => f.seriesId === s.id).map(f => f.pandId));
  for (const f of row.fronts) pitch((f.overrides as { roofStorey?: RowField<RowRoofStorey> }).roofStorey, [f.pandId]);
  return row;
}

export function warehouseFronts(row: RowRecord, stated: ReadonlyMap<string, BeltStated>): RowRecord {
  for (const f of row.fronts) {
    const sd = stated.get(f.pandId), s = row.series.find(x => x.id === f.seriesId);
    const add = [...(sd?.warehouse ? WAREHOUSE_EXTRAS : []), ...(sd?.elements?.includes('hoistBeam') ? ['hoist-beam'] : [])];
    const fo = f.overrides as { extras?: RowField<string[]> };
    const base = fo.extras ?? s?.design.extras;
    if (!add.length || base?.source === 'reviewed') continue;
    const cur = base?.value ?? [], more = [...new Set(add)].filter(x => !cur.includes(x));
    if (!more.length) continue;
    fo.extras = { value: [...cur, ...more], source: 'period-default', ref: `${base?.ref ?? ''}; ${BELT_LOOK_REF}: ${more.join(', ')} from the monument register (${sd?.warehouse ? 'pakhuis' : 'hoist beam'})` };
  }
  return row;
}

/**
 * Every unreviewed gabled front with an AHN front measurement stands with its apex on the measured front top (the member's
 * ridge3dbag, AHN-capped in beltRowInput): the foot is the apex less the gable's rise, the rise trimmed (never under the
 * 2 m minimum) where the front is lower than foot + rise. The solve moves a foot onto its ridge only within 4 m and only
 * for a whole series (round 6: 67 belt gables 2-4.5 m over their AHN front, Keizersgracht 178947 a neck 4.2 m over a
 * front that tops out at 11.4 m).
 */
export function apexOnFront(row: RowRecord, input: RowInput, ahn: ReadonlyMap<string, AhnFront>): RowRecord {
  for (const f of row.fronts) {
    if (f.sub || !ahn.has(f.pandId)) continue;
    const s = row.series.find(x => x.id === f.seriesId), m = input.members.find(x => x.pandId === f.pandId);
    const fo = f.overrides as { gable?: RowField<RowGable>; corniceTopM?: RowField<number | null>; crown?: RowField<string> };
    const g = fo.gable ?? s?.design.gable, line = fo.corniceTopM ?? s?.design.corniceTopM;
    if (!s || !m || !g?.value || g.source === 'reviewed' || line?.source === 'reviewed' || !GABLED_CROWNS.has(String(fo.crown?.value ?? s.design.crown.value))) continue;
    const apex = m.ridge3dbag, foot = line?.value, rise = g.value.riseM;
    if (apex == null || foot == null || !(rise > 0) || Math.abs(foot + rise - apex) < 0.3) continue;
    const r = +Math.max(AHN_BOUNDS.gableMinRiseM, Math.min(rise, apex - (input.members.find(x => x.pandId === f.pandId)?.eaves3dbag ?? foot))).toFixed(2);
    const r2 = Math.min(r, rise), newFoot = +(apex - r2).toFixed(2);
    if (r2 !== rise) fo.gable = { value: { ...g.value, riseM: r2 }, source: g.source, ref: `${g.ref ?? ''}; ${BELT_LOOK_REF}: rise trimmed to the AHN front (${apex} m)` };
    fo.corniceTopM = { value: newFoot, source: 'period-default', ref: `${BELT_LOOK_REF}: the gable's apex on the AHN front top ${apex} m, its foot the apex less the ${r2} m rise` };
    f.topM = +(newFoot - (f.groundOffsetM ?? 0)).toFixed(2);
  }
  return row;
}

/**
 * The photo colour reader (round 11; the Centrum lane's reader, scripts/centrum-looks/photo-reads.ts and
 * photo-reader-prompt.md, opus on each front's cut): the wall's colour family as a person in the street would name it.
 * The cut's absolute sample reads winter shade as near-black and sun glare as buff (held-out round 10: Keizersgracht
 * 167979, red-brown brick drawn buff #b39c75 from its washed-out sample #917861). A confident read (PHOTO_COLOUR_MIN)
 * where the register states no finish and no published spec states a colour draws the front in its family's tone.
 */
export const PHOTO_COLOUR_MIN = 0.7;
/** A photo crown read of a roof in view (mansard or pitched eaves) at this confidence is a photoRoof (round 12; Centrum round 6's PHOTO_ROOF_MIN). */
export const PHOTO_ROOF_MIN = 0.6;
export interface PhotoColour { finish: string; family: string; confidence: number }
/** The reader's families onto the judged palette (scripts/centrum-looks/generate.ts PHOTO_FAMILY). */
export const PHOTO_COLOUR_FAMILY: Readonly<Record<string, JudgedFamily>> = {
  'dark-grey-brick': 'dark-grey-brick', 'purple-brown-brick': 'purple-brown-brick', 'brown-brick': 'brown-brick', 'red-brown-brick': 'red-brown-brick',
  'orange-red-brick': 'orange-red-brick', 'buff-brick': 'buff-brick', 'white-paint': 'painted-white', 'cream-paint': 'cream-render',
  'pale-grey': 'pale-grey-stucco', 'dark-paint': 'painted-black',
};
const BRICK_FAMILIES = new Set<JudgedFamily>(['dark-grey-brick', 'purple-brown-brick', 'brown-brick', 'red-brown-brick', 'orange-red-brick', 'buff-brick']);
/** A confident photo colour read's wall, or undefined (unclear, other-paint, low confidence, or a spec colour stands). */
export function photoColourWall(sd: BeltStated | undefined): { family: JudgedFamily; finish: 'brick' | 'stucco' | 'painted-brick' } | undefined {
  const c = sd?.photoColour;
  if (!c || sd!.specHex || !(c.confidence >= PHOTO_COLOUR_MIN)) return undefined;
  const family = PHOTO_COLOUR_FAMILY[c.family];
  if (!family) return undefined;
  return { family, finish: BRICK_FAMILIES.has(family) ? 'brick' : c.finish === 'stucco' ? 'stucco' : 'painted-brick' };
}
/** Each record with a confident photo colour read takes its family's tone (variedTone); returns a tally of what changed. */
export function photoColourWalls(records: RowFrontRecord[], stated: ReadonlyMap<string, BeltStated>): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const r of records) {
    const pid = String(r.pandId).replace(/^NL\.IMBAG\.Pand\./, ''), w = photoColourWall(stated.get(pid));
    if (!w || !r.wall) continue;
    const before = /judged ([a-z-]+)/.exec(r.sources?.wall ?? '')?.[1];
    const key = before === w.family ? 'same family' : `${before ?? '?'} -> ${w.family}`;
    tally[key] = (tally[key] ?? 0) + 1;
    r.wall = { ...r.wall, hex: variedTone(w.family, pid), finish: w.finish };
    r.sources = { ...r.sources, wall: `judged ${w.family} (photo colour read ${stated.get(pid)!.photoColour!.confidence}: ${JUDGED_PALETTE[w.family].label}; ${BELT_LOOK_REF})` };
  }
  return tally;
}

/**
 * Round 12 (held-out round 11's loss, Keizersgracht 169442: a grey stone and stucco block drawn as red and brown brick
 * with donor gables): a member's finish is pale when the register or the photo finish reader states plaster or stone, its
 * own read saw stucco or stone, or a confident photo colour read (PHOTO_COLOUR_MIN) names stucco or pale grey. A stated
 * brick or painted finish is not pale, whatever the colour read.
 */
export function paleEvidence(sd: BeltStated | undefined, own?: DescriberAnswer): boolean {
  if (sd?.finish === 'plaster' || sd?.finish === 'stone') return true;
  if (sd?.finish) return false;
  const f = (own as { finish?: string } | undefined)?.finish;
  if (f === 'stucco' || f === 'stone') return true;
  if (f === 'brick' || f === 'painted-brick') return false;
  const c = sd?.photoColour;
  return !!c && c.confidence >= PHOTO_COLOUR_MIN && (c.finish === 'stucco' || c.family === 'pale-grey');
}
/** The least run of adjacent pale members drawn as one front. */
export const PALE_BLOCK_MIN = 2;
/** Runs (member indexes) of at least PALE_BLOCK_MIN adjacent pale members. */
export function paleRuns(pale: readonly boolean[]): number[][] {
  const out: number[][] = [];
  let cur: number[] = [];
  for (let i = 0; i <= pale.length; i++) {
    if (i < pale.length && pale[i]) { cur.push(i); continue; }
    if (cur.length >= PALE_BLOCK_MIN) out.push(cur);
    cur = [];
  }
  return out;
}
/**
 * A pale block's members share one wall: the first member whose wall came from a photo read (a colour read or the cut's
 * sample), else the block's first member that is drawn stucco or stone. Returns the number of fronts whose wall changed.
 */
export function paleBlockWalls(records: RowFrontRecord[], blocks: readonly (readonly string[])[]): number {
  const byPid = new Map(records.map(r => [String(r.pandId).replace(/^NL\.IMBAG\.Pand\./, ''), r]));
  let changed = 0;
  for (const b of blocks) {
    const rs = b.map(p => byPid.get(p)).filter((r): r is RowFrontRecord => !!r?.wall);
    if (rs.length < PALE_BLOCK_MIN) continue;
    const pale = (r: RowFrontRecord) => r.wall!.finish === 'stucco' || r.wall!.finish === 'stone';
    const lead = rs.find(r => pale(r) && /photo/.test(r.sources?.wall ?? '')) ?? rs.find(pale);
    if (!lead) continue;
    for (const r of rs) {
      if (r === lead) continue;
      if (r.wall!.hex !== lead.wall!.hex || r.wall!.finish !== lead.wall!.finish) changed++;
      r.wall = { ...r.wall!, hex: lead.wall!.hex, finish: lead.wall!.finish };
      r.sources = { ...r.sources, wall: `${lead.sources?.wall ?? 'judged'}; one front with ${b.join(', ')} (pale block, round 12)` };
    }
  }
  return changed;
}
