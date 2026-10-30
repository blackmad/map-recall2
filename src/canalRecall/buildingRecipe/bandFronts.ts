/**
 * Band fronts (GitHub #126): what `measure.ts` proposes for a wall whose photo shows horizontal bands that the bay grid
 * folds into punched windows. Triage (#119) holds these on the `band` gap: the photo's per-storey opening sequences
 * (rowOpenings.ts) have a ribbon (an opening >= ROW_OPENINGS.ribbonM) where the kit draws a punched row, which is the
 * likeness judge's `rowMismatch`. The bay grid still finds a pitch in them (mullions, balcony dividers, the piers
 * between shop windows), so the front class reads `punched` or `columns` and the system stays `brick-bay-grid`.
 *
 * Rules, each from the photo's own rows (`photoRowBands`, the triage measurement) and only on trusted evidence:
 * - ribbon front: at least RIBBON_FRONT.minStoreys upper window storeys judged and a ribbon on at least
 *   RIBBON_FRONT.share of them (balcony bands with glazing behind, ribbon glazing between floor slabs): the system
 *   `ribbon-windows`, on a group whose system is a grid (`brick-bay-grid`);
 * - ribbon storeys over punched windows: otherwise, the storeys whose ribbon lies over a punched row of another storey
 *   of the same photo (rowOpenings `ribbonAgainstPunched`): `glazedStoreys` (a glazed mezzanine, a shopfront strip's
 *   upper half, a gallery storey);
 * - balcony bands: a ribbon front whose crop also shows light bands on the floor lines of two or more storeys
 *   (lightBands.ts at 'floor': the pale slab edges and parapets of Burgemeester Hogguerstraat's 12-storey slab): a
 *   `balconyBands` slab with a solid parapet on those storeys, in the measured light trim colour, instead of flat
 *   stone bands at the same lines (a slab edge is not a stone course).
 * Pure: no I/O.
 */
import {ROW_OPENINGS, punchedUnder, type RowOpeningSummary} from './rowOpenings.ts';
import {LIKENESS} from './likeness.ts';
import type {LightBand} from './lightBands.ts';
import type {BalconyBandsIntent, BalconyBandSpan} from '../blockBuilding/balconyBands.ts';

/** The photo's band evidence per wall: the upper window storeys judged, and each storey's widest ribbon (if any) with the storey whose punched row lies under it. */
export interface RowBands {judged: number[]; ribbons: {storey: number; ribbonM: number; against: number | null}[]}

export const RIBBON_FRONT = {minStoreys: 2, share: 0.6, minFloorBands: 2} as const;
/** A ribbon storey is proposed as `glazedStoreys` only where the photo glazes that storey at least this much: the glazed row
 *  draws ~0.7-0.77 of the storey, and a ribbon read off a balcony slab's shadow line over punched windows (Mary van der
 *  Sluisstraat 247342 walls[1], 0.21) would overshoot the photo's glazing by 0.5. */
export const GLAZED_STOREY_MIN = 0.5;

/** The band evidence of one photo's opening sequences (storey 0, the ground band, is left to the plinth rule). */
export function photoRowBands(s: RowOpeningSummary): RowBands {
  const uppers = s.rows.filter(r => r.storey >= 1), ribbons: RowBands['ribbons'] = [];
  for (const r of uppers) {
    const wide = r.openings.filter(o => o.w >= ROW_OPENINGS.ribbonM).sort((a, b) => b.w - a.w);
    if (!wide.length) continue;
    const other = uppers.find(x => x.storey !== r.storey && wide.some(o => punchedUnder(o, x)));
    ribbons.push({storey: r.storey, ribbonM: +wide[0].w.toFixed(2), against: other ? other.storey : null});
  }
  return {judged: uppers.map(r => r.storey), ribbons};
}

export interface BandFrontInput {
  rowBands: RowBands | null | undefined;
  /** the group's system before this rule (measure.ts after the front-class proposal) */
  system: string;
  /** storeys of the fitted wall (the measurement's storey count); proposals stay on 1..storeys-1 */
  storeys: number;
  usable: number; foliage: number; washedOut: number;
  lightBands?: readonly LightBand[] | null;
  /** the measured light trim colour (measureFacade `trim`), for balcony slabs */
  trim?: string | null;
  /** the photo's glazing per storey (measureFacade `storeyGlazing`, index = storey) */
  storeyGlazing?: readonly (number | null)[];
  /** storeys another field already claims (blank, loggia, plinth, grouped, shaped, balcony storeys) */
  taken?: readonly number[];
}
export interface BandFrontProposal {
  kind: 'ribbon-front' | 'ribbon-storeys' | null;
  system?: 'ribbon-windows';
  glazedStoreys?: number[];
  balconyBands?: BalconyBandsIntent;
  why: string[];
}

export function bandFrontProposal(m: BandFrontInput): BandFrontProposal {
  const why: string[] = [], rb = m.rowBands;
  if (!rb || !rb.ribbons.length) return {kind: null, why: ['no ribbon storey in the photo rows']};
  if (m.usable < LIKENESS.minUsable) why.push(`usable ${Math.round(m.usable * 100)} % < ${LIKENESS.minUsable * 100} %`);
  if (m.foliage > LIKENESS.maxFoliage) why.push(`foliage ${Math.round(m.foliage * 100)} % > ${LIKENESS.maxFoliage * 100} %`);
  if (m.washedOut > LIKENESS.maxWashedOut) why.push(`washed out ${Math.round(m.washedOut * 100)} % > ${LIKENESS.maxWashedOut * 100} %`);
  if (why.length) return {kind: null, why};
  const inRange = (s: number) => s >= 1 && s <= m.storeys - 1 && !(m.taken ?? []).includes(s);
  const judged = rb.judged.filter(s => s >= 1), ribbonStoreys = rb.ribbons.map(r => r.storey);
  if (judged.length >= RIBBON_FRONT.minStoreys && ribbonStoreys.length >= RIBBON_FRONT.share * judged.length) {
    if (m.system !== 'brick-bay-grid') return {kind: null, why: [`ribbon front (${ribbonStoreys.length} of ${judged.length} storeys) on ${m.system}: kept`]};
    const out: BandFrontProposal = {kind: 'ribbon-front', system: 'ribbon-windows', why: [`ribbon front: ribbons on storeys ${ribbonStoreys.join(',')} of ${judged.length} judged (${rb.ribbons.map(r => `${r.ribbonM} m`).join(', ')})`]};
    const floor = [...new Set((m.lightBands ?? []).filter(b => b.at === 'floor').map(b => b.storey))].filter(inRange).sort((a, b) => a - b);
    if (floor.length >= RIBBON_FRONT.minFloorBands) {
      out.balconyBands = {storeys: floor, kind: 'solid', ...(m.trim ? {colour: m.trim} : {})};
      out.why.push(`balcony bands: light slab edges on the floor lines of storeys ${floor.join(',')}${m.trim ? ` in ${m.trim}` : ''}`);
    }
    return out;
  }
  const glazed = (s: number) => (m.storeyGlazing?.[s] ?? 0) >= GLAZED_STOREY_MIN;
  const over = rb.ribbons.filter(r => r.against !== null).map(r => r.storey).filter(inRange), thin = over.filter(s => !glazed(s));
  if (thin.length) why.push(`ribbon storeys ${thin.join(',')} glazed under ${GLAZED_STOREY_MIN * 100} % in the photo (${thin.map(s => Math.round((m.storeyGlazing?.[s] ?? 0) * 100)).join('/')} %): not a glazed storey`);
  if (!over.some(glazed)) return {kind: null, why: [...why, `no glazed ribbon storey over a punched row within 1..${m.storeys - 1}`]};
  return {kind: 'ribbon-storeys', glazedStoreys: over.filter(glazed), why: [`ribbon storeys ${over.filter(glazed).join(',')} over punched rows (${rb.ribbons.filter(r => over.includes(r.storey) && glazed(r.storey)).map(r => `${r.ribbonM} m over storey ${r.against}`).join(', ')})`, ...why]};
}

/** Part-width balcony spans: a storey whose runs cover at least `fullShare` of the wall is not a part-width storey (a full
 *  light band is the `lightBands` rule's), and at least `minStoreys` part-width storeys are needed. */
export const BALCONY_SPANS = {fullShare: 0.85, minStoreys: 2, snap: 0.25, minBays: 2} as const;

export interface BalconySpansInput {
  /** the light runs along the floor lines as fractions of the main panel's width (lightBands `lightRuns`, measured) */
  runs: readonly {storey: number; from: number; to: number}[] | null | undefined;
  /** the group's bays per storey (after this run's proposal) */
  bays: number | null | undefined;
  storeys: number; usable: number; foliage: number; washedOut: number;
  taken?: readonly number[];
}

/**
 * Staggered or part-width balcony bands (GitHub #127) from the photo's light runs on the floor lines: per storey the
 * bay ranges the runs cover on the main panel's bay grid (a run's ends snap to the nearest bay edge, a range at least one
 * bay; a range under BALCONY_SPANS.minBays bays is dropped), as `balconyBands.spans` with glass parapets; only on trusted evidence, on 1..storeys-1, off the storeys another
 * field claims, and when at least BALCONY_SPANS.minStoreys storeys have part-width runs.
 */
export function balconySpansProposal(m: BalconySpansInput): {balconyBands: BalconyBandsIntent | null; why: string[]} {
  const why: string[] = [];
  if (!m.runs?.length || !m.bays || m.bays < 2) return {balconyBands: null, why: ['no light run on a floor line (or no bay grid)']};
  if (m.usable < LIKENESS.minUsable || m.foliage > LIKENESS.maxFoliage || m.washedOut > LIKENESS.maxWashedOut) return {balconyBands: null, why: ['evidence under the likeness gate']};
  const B = m.bays, spans: BalconyBandSpan[] = [];
  const storeys = [...new Set(m.runs.map(r => r.storey))].filter(s => s >= 1 && s <= m.storeys - 1 && !(m.taken ?? []).includes(s)).sort((a, b) => a - b);
  for (const s of storeys) {
    const rs = m.runs.filter(r => r.storey === s), cover = rs.reduce((t, r) => t + Math.max(0, Math.min(1, r.to) - Math.max(0, r.from)), 0);
    if (cover >= BALCONY_SPANS.fullShare) { why.push(`storey ${s}: light across ${Math.round(cover * 100)} % of the wall, not part-width`); continue; }
    const ranges: [number, number][] = [];
    for (const r of rs) {
      const b0 = Math.max(0, Math.floor(Math.max(0, r.from) * B + BALCONY_SPANS.snap)), b1 = Math.min(B - 1, Math.ceil(Math.min(1, r.to) * B - BALCONY_SPANS.snap) - 1);
      if (b1 - b0 + 1 < BALCONY_SPANS.minBays) continue;   // a balcony spans two bays or more; a lone light bay is a frame or a panel
      const last = ranges[ranges.length - 1];
      if (last && b0 <= last[1] + 1) last[1] = Math.max(last[1], b1); else ranges.push([b0, b1]);
    }
    if (ranges.length) spans.push({storey: s, bays: ranges});
  }
  if (spans.length < BALCONY_SPANS.minStoreys) return {balconyBands: null, why: [...why, `${spans.length} part-width storey(s) < ${BALCONY_SPANS.minStoreys}`]};
  return {balconyBands: {storeys: [], spans, kind: 'glass'}, why: [`balcony spans on storeys ${spans.map(x => `${x.storey} (bays ${x.bays.map(b => b.join('-')).join(', ')})`).join('; ')} from light parapet runs on the floor lines`, ...why]};
}
