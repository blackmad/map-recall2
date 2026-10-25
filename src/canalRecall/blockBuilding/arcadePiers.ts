/**
 * Free-standing arcade piers on their own pitch (intent `arcadePiers`): square piers standing proud of a glazed storey
 * band under a beam, spaced independently of the window bays above. Stadsloket Zuidoost (2019 and 2025 panoramas):
 * 8 white square piers about 5.5 m apart under a white beam, in front of a double-height glazed arcade, where the
 * windows above run on a 2.4 m sub-bay; the arcade `ground` (one pier per window bay) and the plinth (piers in the
 * wall colour between its bays) cannot put them there.
 *
 * Measures are fractions (the intent contract has no metric fields): the pier width of the pier pitch, how far it
 * stands proud of its width, the beam of the band's top storey. Geometry: each pier is a box from just in front of the
 * window glass (`PIER_BACK_M`, inside the wall's reveal, so no gap shows where it crosses an opening) out to its depth
 * (at least 15 cm), the full height of the band; the beam spans the band's width at its top (drawn when 10 cm or more), set back 5 cm from the pier faces, its ends inside the outer piers and the pier tops inside it, so no two faces are coplanar.
 */
import type {PanelCtx} from './compose.ts';

/** Intent (`walls[i].arcadePiers`). */
export interface ArcadePiersIntent {
  /** contiguous storeys the band spans (0 = ground) */
  storeys: number[];
  /** piers, evenly spaced end to end over the span (2..40) */
  count: number;
  /** [first, last] bay of the span on the main panel (default: the whole panel) */
  bays?: [number, number];
  /** pier width as a fraction of the pier pitch (default 0.16) */
  w?: number;
  /** how far the pier face stands in front of the wall face, as a fraction of the pier width (default 0.6) */
  proud?: number;
  /** beam height at the top of the band as a fraction of its top storey, 0 = no beam (default 0.12) */
  beam?: number;
}

/** Fitted (LargeGroupFit `arcadePiers`): storey range, span and the intent's fractions, drawn in `slot`. */
export interface ArcadePiersFit { from: number; to: number; count: number; bays?: [number, number]; w: number; proud: number; beam: number; slot: string }

export const ARCADE_PIERS = {w: 0.16, proud: 0.6, beam: 0.12} as const;
/** The pier backs: 2 cm in front of the window glass (the large tier's 0.18 m reveal), inside the wall solid elsewhere. */
export const PIER_BACK_M = -0.16;

export function arcadePiersProblems(ap: unknown, at: string, baysPerStorey: number | undefined): string[] {
  const out: string[] = [];
  if (!ap || typeof ap !== 'object' || Array.isArray(ap)) return [`${at}: object {storeys, count, bays, w, proud, beam}`];
  const a = ap as Record<string, unknown>;
  for (const k of Object.keys(a)) if (!['storeys', 'count', 'bays', 'w', 'proud', 'beam'].includes(k)) out.push(`${at}.${k}: unknown field (storeys, count, bays, w, proud, beam)`);
  const st = a.storeys;
  if (!Array.isArray(st) || !st.length || st.some(s => !Number.isInteger(s) || s < 0 || s > 39)) out.push(`${at}.storeys: list of storeys (0 = ground)`);
  else if (st.some((s, i) => i > 0 && s !== st[i - 1] + 1)) out.push(`${at}.storeys: contiguous and ascending`);
  if (!Number.isInteger(a.count) || (a.count as number) < 2 || (a.count as number) > 40) out.push(`${at}.count: integer 2..40`);
  if (a.bays !== undefined) {
    const b = a.bays;
    if (!Array.isArray(b) || b.length !== 2 || !b.every(x => Number.isInteger(x) && x >= 0) || b[1] < b[0]) out.push(`${at}.bays: [first, last] bay`);
    else if (baysPerStorey === undefined) out.push(`${at}.bays needs baysPerStorey`);
    else if (b[1] >= baysPerStorey) out.push(`${at}.bays: last bay under baysPerStorey ${baysPerStorey}`);
  }
  const num = (v: unknown, k: string, lo: number, hi: number) => { if (v !== undefined && !(typeof v === 'number' && v >= lo && v <= hi)) out.push(`${at}.${k}: number ${lo}..${hi}`); };
  num(a.w, 'w', 0.03, 0.5); num(a.proud, 'proud', 0.2, 1.5); num(a.beam, 'beam', 0, 0.4);
  return out;
}

export function fitArcadePiers(ap: ArcadePiersIntent, slot: string): ArcadePiersFit {
  return {from: ap.storeys[0], to: ap.storeys[ap.storeys.length - 1], count: ap.count, ...(ap.bays ? {bays: [ap.bays[0], ap.bays[1]] as [number, number]} : {}),
    w: ap.w ?? ARCADE_PIERS.w, proud: ap.proud ?? ARCADE_PIERS.proud, beam: ap.beam ?? ARCADE_PIERS.beam, slot};
}

/** Pier centres (u, panel metres) evenly from end to end of [a, b], the outer piers flush with the span's ends. */
export function pierCentres(a: number, b: number, count: number, w: number): number[] {
  if (b - a < w * count) return [];
  return Array.from({length: count}, (_, k) => a + w / 2 + (k * (b - a - w)) / (count - 1));
}

/**
 * Draws the piers and beam on the main panel: the band from storey line `from` to the line over `to` (clipped to the
 * panel and `topM`), across the panel or the `bays` span of its even `bays`-way division. Returns the piers drawn.
 */
export function drawArcadePiers(c: PanelCtx, levels: number[], ap: ArcadePiersFit, bays: number, topM: number): number {
  const p = c.p, v0 = Math.max(p.vMin, levels[ap.from] ?? p.vMin), v1 = Math.min(topM, levels[ap.to + 1] ?? topM);
  if (v1 - v0 < 2) return 0;
  const W = p.uMax - p.uMin, a = ap.bays ? p.uMin + (ap.bays[0] * W) / bays : p.uMin, b = ap.bays ? p.uMin + ((ap.bays[1] + 1) * W) / bays : p.uMax;
  const wM = (ap.w * (b - a)) / (ap.count - 1 + ap.w), depthM = Math.max(0.15, ap.proud * wM), us = pierCentres(a, b, ap.count, wM);
  if (!us.length) return 0;
  const topH = v1 - Math.max(v0, levels[ap.to] ?? v0), beamM = ap.beam * topH;
  const part = c.part(), beam = beamM >= 0.1 && v1 - beamM - v0 > 2 ? beamM : 0;
  // piers stop 2 cm under the beam's top, inside it; the beam is 5 cm shallower than the piers
  for (const u of us) c.box(ap.slot, u - wM / 2, u + wM / 2, v0, beam ? v1 - 0.02 : v1, PIER_BACK_M, depthM, part);
  // the beam's ends 2 cm inside the outer piers
  if (beam) c.box(ap.slot, a + 0.02, b - 0.02, v1 - beam, v1, PIER_BACK_M, depthM - 0.05, part);
  return us.length;
}
