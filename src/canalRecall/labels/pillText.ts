// The text a place pill shows (user 2026-11-08, issue #259: "Hortus Botanicus greenho", "Canal Ring Area of Amster"
// were cut at a fixed width with no ellipsis). A pill widens to the whole name up to PILL_MAX_CHARS characters or
// PILL_MAX_PX CSS pixels, whichever binds first; a longer name ends with "…" after its last whole word that fits.
// Never a cut mid-word, unless the first word alone is longer than the cap.

export const PILL_MAX_CHARS = 36;
export const PILL_MAX_PX = 420;
export const ELLIPSIS = '…';

export interface PillFit { maxChars?: number; maxPx?: number; measure?: (text: string) => number }

/** The pill's text for `name`: the whole name when it fits, else whole words and "…". */
export function fitPillText(name: string, opts: PillFit = {}): string {
  const maxChars = opts.maxChars ?? PILL_MAX_CHARS;
  const maxPx = opts.maxPx ?? PILL_MAX_PX;
  const fits = (s: string) => s.length <= maxChars && (!opts.measure || opts.measure(s) <= maxPx);
  const text = name.trim().replace(/\s+/g, ' ');
  if (fits(text)) return text;
  const words = text.split(' ');
  let best = '';
  for (let i = 1; i <= words.length; i++) {
    const head = words.slice(0, i).join(' ').replace(/[\s,;:–—-]+$/, '');
    if (!fits(head + ELLIPSIS)) break;
    best = head;
  }
  if (best) return best + ELLIPSIS;
  // One word longer than the cap: the only case cut inside a word.
  let cut = text.slice(0, Math.max(1, maxChars - 1));
  while (cut.length > 1 && !fits(cut + ELLIPSIS)) cut = cut.slice(0, -1);
  return cut + ELLIPSIS;
}
