/**
 * Reviewed-strip acceptance: a narrow override of the batch strip-quality gate.
 *
 * The gate (stripQuality.ts) reads the light, not the facade: a winter or low-sun strip reads "cold cast", "blown" or
 * "cyan cast" although a reviewer looking at the strip beside the photo finds the fronts perfectly usable (Vogelbuurt-
 * Noord, 2026-11-10: 14 pands Opus accepted by eye). A reviewed-verdict file may name an exact face + strip date as
 * accepted by eye; for that strip only, the colour-cast reasons are waived. Nothing else is: darkness, "no usable
 * span", the geometry gates, the likeness gate and the stripOverDrawn floors/ceilings still apply. A different date of
 * the same face (a restrip) is never covered.
 */
export interface ReviewedStrip {face: string; date: string; by: string; note?: string}
export interface ReviewedStrips {accepted: ReviewedStrip[]}

/** The strip-quality reasons (stripQuality.ts `reasons`) a reviewer's eye may overrule: light and colour cast only. */
export const WAIVABLE_STRIP_REASONS: readonly string[] = ['blown', 'cold cast rb', 'cyan cast gm'];

/** The record accepting this exact face and strip date, if any. */
export function acceptedByEye(doc: ReviewedStrips | null | undefined, face: string, date: string): ReviewedStrip | null {
  return doc?.accepted?.find(a => a.face === face && a.date === date) ?? null;
}

/** The strip verdict after the override: unchanged unless every reason is waivable and the exact strip is accepted. */
export function applyReviewedStrip(
  strip: {bad: boolean; reasons: readonly string[]},
  doc: ReviewedStrips | null | undefined, face: string, date: string,
): {bad: boolean; reasons: string[]; waived: string[]} {
  const reasons = [...strip.reasons];
  if (!strip.bad || !acceptedByEye(doc, face, date)) return {bad: strip.bad, reasons, waived: []};
  if (!reasons.length || reasons.some(r => !WAIVABLE_STRIP_REASONS.includes(r))) return {bad: strip.bad, reasons, waived: []};
  return {bad: false, reasons: [], waived: reasons};
}
