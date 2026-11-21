/**
 * Belt review houses: what stages 2–4 review. Usually one per BAG pand; when David splits a pand's facade in stage 1
 * (`picks.json` `houses`, e.g. Herengracht 50–52 registered as one pand but built as two houses), each split house is its
 * own entry `<pandId>#<n>`, described, grouped, rendered and pinned on its own. Browser-safe: the page and the server
 * expand the face the same way.
 */
import type { DescriptionFile, FaceFile, FacePand, PicksFile } from './types.ts';

export const HOUSE_PATTERN = /^\d{16}(#[1-9]\d?)?$/;
export interface HouseSplit { fromM: number; toM: number; label?: string }
export interface HouseEntry extends FacePand {
  /** The BAG pand this house is in. */
  basePandId: string;
  /** 1-based part of a split pand; absent when the pand is one house. */
  part?: number;
  /** The house's span, metres from the BAG span start (split houses only). */
  spanM?: [number, number];
}
export type HouseFace = Omit<FaceFile, 'pands'> & { pands: HouseEntry[] };

export const basePand = (id: string) => id.split('#')[0];
/** "Herengracht 50–52" -> "Herengracht". */
export const streetOf = (address: string) => address.replace(/\s+\d.*$/, '');

/** Default labels for `n` split houses: the pand's house numbers in order when the counts match, else blanks. */
export function houseLabels(p: Pick<FacePand, 'numbers'>, n: number): Array<string | undefined> {
  const nums = p.numbers ?? [];
  return Array.from({ length: n }, (_, i) => nums.length === n ? String(nums[i]) : undefined);
}

/** The split houses of a pand from its pick, or null when it is one house. */
export function splitOf(picks: PicksFile, pandId: string): HouseSplit[] | null {
  const pk = picks.picks[pandId];
  return pk && pk.candidateId !== null && pk.houses && pk.houses.length >= 2 ? pk.houses : null;
}

export function expandFace(face: FaceFile, picks: PicksFile): HouseFace {
  const pands: HouseEntry[] = [];
  for (const p of face.pands) {
    const hs = splitOf(picks, p.pandId);
    if (!hs) { pands.push({ ...p, basePandId: p.pandId }); continue; }
    hs.forEach((hh, i) => pands.push({
      ...p, pandId: `${p.pandId}#${i + 1}`, basePandId: p.pandId, part: i + 1, spanM: [hh.fromM, hh.toM],
      address: hh.label ? `${streetOf(p.address)} ${hh.label}` : `${p.address} (${i + 1}/${hs.length})`,
      widthM: +(hh.toM - hh.fromM).toFixed(2), numbers: undefined, order: p.order,
    }));
  }
  pands.forEach((p, i) => { p.order = i; });
  return { ...face, pands };
}

/** The description with each split house starting from its pand's statements (same unit, same fields). */
export function expandDescription(desc: DescriptionFile | null, face: HouseFace): DescriptionFile | null {
  if (!desc) return null;
  const by = new Map(desc.pands.map(d => [d.pandId, d]));
  return { ...desc, pands: face.pands.flatMap(h => { const d = by.get(h.basePandId); return d ? [{ ...structuredClone(d), pandId: h.pandId, address: h.address }] : []; }) };
}

/** Split houses from the facade span and the dividers between them (metres from the BAG span start). */
export function housesFromDividers(spanM: [number, number], dividersM: number[], labels: Array<string | undefined>): HouseSplit[] {
  const cuts = [spanM[0], ...[...dividersM].sort((a, b) => a - b), spanM[1]];
  return cuts.slice(1).map((toM, i) => ({ fromM: +cuts[i].toFixed(2), toM: +toM.toFixed(2), ...(labels[i] ? { label: labels[i] } : {}) }));
}
export const dividersOf = (houses: HouseSplit[] | undefined) => (houses ?? []).slice(1).map(h => h.fromM);

/** Where a new divider may go: at least 1 m from the span ends and from every other divider. */
export function dividerFits(spanM: [number, number], dividersM: number[], atM: number): boolean {
  return atM - spanM[0] >= 1 && spanM[1] - atM >= 1 && dividersM.every(d => Math.abs(d - atM) >= 1);
}
