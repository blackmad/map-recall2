// Album captions that wrap at a seam rather than truncate (#283). Kept apart
// from stampAlbum.ts so the landing bundle does not pull in the postcard fitter.

import { splitNameForTwoLines } from './largeLetterPostcard.ts';

/** Words this long get a soft hyphen at their Dutch seam. */
const CAPTION_BREAK_MIN = 11;

/**
 * The album caption with a soft hyphen at each long word's Dutch seam
 * (largeLetterPostcard.ts splitNameForTwoLines, the postcard's own seam:
 * compound tails such as BUURT, then a Dutch syllable boundary), so "Grachtengordel" wraps "Grachten-/gordel" instead of
 * being cut to "Grachtengor…" (#283).
 */
export function stampCaption(name: string): string {
  return name.split(' ').map(word => {
    if (word.length < CAPTION_BREAK_MIN || /[-/]/.test(word)) return word;
    const at = splitNameForTwoLines(word)[0].replace(/-$/, '').length;
    return at > 2 && at < word.length - 2 ? `${word.slice(0, at)}\u00ad${word.slice(at)}` : word;
  }).join(' ');
}
