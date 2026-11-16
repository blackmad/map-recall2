// The merge (plan Phase 1): each field from the strongest source that states it (GF_SOURCE_RANK, then confidence; a
// field the source read at low confidence counts at half). A record exists only when some source gives openings: the
// plain default is today's template, so a pand nothing describes draws exactly as before. Piers follow the openings'
// source; when that source states none, they are the wall left between its openings, in the best stated material.
import { GF_DEFAULTS, GF_FIELDS, GF_SOURCE_RANK, drawProblems, piersBetween, type GfField, type GfReceipt, type GroundFloor, type GroundFloorDraw, type GroundFloorPart } from './types.js';

type Part = GroundFloorPart & { lowFields?: string[] };
const strength = (p: Part, f: GfField) => GF_SOURCE_RANK[p.source] * 10 + (p.lowFields?.includes(f) ? p.confidence / 2 : p.confidence);
const receipt = (p: Part, f: GfField): GfReceipt => ({ source: p.source, confidence: p.lowFields?.includes(f) ? p.confidence / 2 : p.confidence, ...(p.ref ? { ref: p.ref } : {}), ...(p.at !== undefined ? { at: p.at } : {}) });

export function mergeGroundFloor(pandId: string, parts: readonly (Part | null | undefined)[]): GroundFloor | null {
  const ps = parts.filter((p): p is Part => !!p);
  const best = (f: GfField) => ps.filter(p => p[f] !== undefined).sort((p, q) => strength(q, f) - strength(p, f))[0];
  const op = best('openings');
  if (!op?.openings?.length) return null;
  const receipts: Partial<Record<GfField, GfReceipt>> = { openings: receipt(op, 'openings') };
  const openings = [...op.openings].sort((p, q) => p.a0 - q.a0);
  let piers = op.piers;
  if (piers) receipts.piers = receipt(op, 'piers');
  else {
    const pp = best('piers'), m = pp?.piers?.[0];
    piers = piersBetween(openings, m?.material ?? 'brick', !!m?.rusticated);
    if (pp) receipts.piers = receipt(pp, 'piers');
  }
  const pick = <K extends 'plinth' | 'groundFinish' | 'fascia' | 'sign'>(f: K): GroundFloorDraw[K] => {
    const p = best(f);
    if (!p) return GF_DEFAULTS[f] as GroundFloorDraw[K];
    receipts[f] = receipt(p, f);
    return p[f] as GroundFloorDraw[K];
  };
  const gt = best('groundTopM');
  if (gt) receipts.groundTopM = receipt(gt, 'groundTopM');
  const out: GroundFloor = { pandId, openings, piers, plinth: pick('plinth'), groundFinish: pick('groundFinish'), fascia: pick('fascia'), sign: pick('sign'), ...(gt ? { groundTopM: gt.groundTopM } : {}), receipts };
  // A sign naming an opening the winning openings do not have points at the widest shop opening instead.
  if (out.sign.opening !== undefined && !(out.sign.opening < openings.length)) out.sign = { ...out.sign, opening: undefined };
  return drawProblems(out).length ? null : out;
}

/** The drawn part of a record (what the extract carries; receipts stay in the data file). */
export function drawOf(g: GroundFloor): GroundFloorDraw {
  const { openings, piers, plinth, groundFinish, fascia, sign, groundTopM } = g;
  return { openings, piers, plinth, groundFinish, fascia, sign, ...(groundTopM !== undefined ? { groundTopM } : {}) };
}

export { GF_FIELDS };
