/**
 * The parts of the English-translation pass that decide something, separated
 * from the parts that shell out or write files, so they can be tested without
 * a translator installed.
 *
 * The translators we prefer — `translate` (scriptingosx/translate-cli) and
 * `trn` (hotchpotch/trn) — are both thin wrappers over Apple's on-device
 * Translation framework. They take text and a language pair and nothing else:
 * no system prompt, no length instruction, no "keep proper nouns as they are".
 * Everything the LLM routes asked for in a prompt has to be enforced here
 * instead, after the fact.
 */

/** Translators available to the pass, in the order they are auto-detected. */
export const CLI_TRANSLATORS = ['translate', 'trn'] as const;
export type CliTranslator = typeof CLI_TRANSLATORS[number];

/** The card cuts the body to two or four lines; the panel shows the rest. A
 *  lede longer than this is not more information, it is a scroll. */
export const MAX_EXTRACT_CHARS = 360;

/**
 * The argv a CLI translator needs. Both tools read the text on stdin and write
 * the translation to stdout, which is what lets one adapter drive either.
 *
 * `trn --quality high` routes through Apple Intelligence rather than the fast
 * on-device model. These are encyclopedia ledes about real places, produced
 * once and then committed, so the slower and better setting is the right one.
 */
export function translatorArgs(
  tool: CliTranslator,
  sourceLanguage: string,
): string[] {
  const pair = ['--from', sourceLanguage, '--to', 'en'];
  return tool === 'trn' ? [...pair, '--quality', 'high'] : pair;
}

/**
 * What came back on stdout, reduced to the one line of prose we asked for.
 *
 * Apple's translator sometimes returns the text wrapped in the quotes it was
 * given, and `trn` preserves the source's line structure, which for a lede
 * pasted from Wikipedia can include hard wraps.
 */
export function cleanTranslatorOutput(raw: string): string {
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  const unquoted = /^"(.*)"$/s.exec(collapsed) ?? /^'(.*)'$/s.exec(collapsed);
  return (unquoted ? unquoted[1] : collapsed).trim();
}

/**
 * Words whose trailing period is not the end of a sentence. Both languages are
 * present because a translated lede keeps the source's names and the pass also
 * reads Dutch originals: "genoemd naar St. Antonius" must not be cut at "St."
 * A single letter is covered separately, for initials like "J. Smit".
 */
const ABBREVIATIONS = new Set([
  'st', 'sint', 'ste', 'mr', 'mrs', 'ms', 'dr', 'prof', 'ir', 'ing', 'drs',
  'jr', 'sr', 'nr', 'no', 'vs', 'ca', 'ong', 'bijv', 'nl', 'oa', 'dwz', 'zgn',
  'etc', 'incl', 'excl', 'eeuw', 'eeuwse',
]);

/** True when the period at `index` really closes a sentence. */
function isSentenceEnd(text: string, index: number): boolean {
  if (text[index] !== '.') return true; // '!' and '?' are never abbreviations
  const before = /([\p{L}]+)$/u.exec(text.slice(0, index));
  if (!before) return true;
  const word = before[1];
  if (word.length === 1) return false; // an initial: "J. Smit"
  return !ABBREVIATIONS.has(word.toLocaleLowerCase());
}

/**
 * Cut to the last sentence that fits. A lede cut mid-clause reads as a
 * rendering bug rather than as an abridgement, so a cut that cannot find a
 * sentence boundary falls back to a word boundary with an ellipsis.
 */
export function trimToSentence(text: string, maxChars: number = MAX_EXTRACT_CHARS): string {
  const clean = text.trim();
  if (clean.length <= maxChars) return clean;

  const window = clean.slice(0, maxChars);
  // A boundary is terminal punctuation followed by a space, so a decimal point
  // inside a sentence does not read as an ending. The final character counts
  // too, for a sentence that ends exactly at the cap.
  let boundary = -1;
  for (const match of window.matchAll(/[.!?](?=\s|$)/g)) {
    if (isSentenceEnd(window, match.index)) boundary = match.index + 1;
  }
  // A boundary in the first third would throw away most of what fits; a word
  // cut keeps more of the lede and is honest about being one.
  if (boundary > maxChars / 3) return window.slice(0, boundary).trim();

  const space = window.lastIndexOf(' ');
  return `${(space > 0 ? window.slice(0, space) : window).trim()}…`;
}

/**
 * Proper nouns that the source had and the translation lost.
 *
 * This is the check that matters for this game: the player is learning that
 * the bridge is called the Blauwbrug. A translator that helpfully renders it
 * "Blue Bridge" has produced fluent English that teaches the wrong name, and
 * that is worse than leaving the Dutch lede in place. Callers should refuse
 * such a translation rather than write it.
 *
 * Only multi-character tokens starting with a capital are considered, and only
 * ones the source actually contained — a name absent from the Dutch lede
 * cannot have been dropped from its translation.
 */
export function droppedProperNames(
  source: string,
  translated: string,
  names: string[],
): string[] {
  // Whole-word, not substring: "Kerk" appears inside "Oudekerksplein", so a
  // substring test would report a translated "Kerk" → "Church" as preserved.
  const contains = (haystack: string, name: string) => {
    const pattern = new RegExp(
      `(?<![\\p{L}\\p{N}])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`,
      'iu');
    return pattern.test(haystack);
  };
  const inSource = (name: string) => contains(source, name);
  const inTranslation = (name: string) => contains(translated, name);
  const candidates = new Set<string>();
  for (const name of names) {
    for (const token of name.split(/[\s-]+/)) {
      // Dutch ledes are full of lowercase function words inside names
      // ("Kerk van de Heilige Familie"); those are not what identifies a place.
      if (token.length > 3 && token[0] === token[0].toLocaleUpperCase()) candidates.add(token);
    }
    if (name.length > 3) candidates.add(name);
  }
  return [...candidates].filter((name) => inSource(name) && !inTranslation(name)).sort();
}
