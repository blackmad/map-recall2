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

/** How to run a CLI translator: its argv, and the text to write on stdin if
 *  it is not already carried in the argv. */
export interface TranslatorInvocation {
  args: string[];
  /** Text to write to stdin, or null when the tool takes it as an argument. */
  stdin: string | null;
}

/**
 * How to hand one lede to one translator.
 *
 * `trn --quality high` routes through Apple Intelligence rather than the fast
 * on-device model. These are encyclopedia ledes about real places, produced
 * once and then committed, so the slower and better setting is the right one.
 *
 * The two tools want the text delivered differently, and this is measured, not
 * assumed. `trn` 0.2.0 decides whether it has stdin at startup, before a pipe
 * opened by `child_process` has anything in it, and exits 1 with
 * "missing text: provide stdin or a positional text argument" — so under Node
 * it only ever works with the text as an argument. `translate` reads stdin
 * normally, and stdin is the safer channel when it is available, so it keeps it.
 *
 * Passing the text as an argument is safe against quoting — `execFile` takes an
 * argv array and never involves a shell — but not against option parsing: a
 * lede starting with a dash is read as a flag, and `trn` 0.2.0 does not
 * understand a `--` end-of-options separator. A single leading space is enough
 * to stop the parse, and Apple's translator ignores it.
 */
export function translatorInvocation(
  tool: CliTranslator,
  sourceLanguage: string,
  text: string,
): TranslatorInvocation {
  const pair = ['--from', sourceLanguage, '--to', 'en'];
  if (tool !== 'trn') return { args: pair, stdin: text };
  return { args: [...pair, '--quality', 'high', text.startsWith('-') ? ` ${text}` : text], stdin: null };
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

/**
 * Invented capitalised tokens used to hold a place's name through a
 * translation.
 *
 * They have to look like proper nouns, because the translator uses the shape
 * of a word to parse the sentence around it: a token that does not read as a
 * name degrades the rest of the sentence. Measured with `trn --quality high`,
 * where a name-shaped placeholder came back byte-identical and correctly cased
 * in every position tried — subject, possessive, after a preposition — while a
 * noun-shaped one ("Qplaats") pulled "ophaalbrug" from "lift bridge" to
 * "pick-up bridge" in the same sentence.
 *
 * They also have to be absent from Dutch and English, or protection would
 * capture real words. Nothing here is a word in either language.
 */
const NAME_PLACEHOLDERS = [
  'Zarvix', 'Qivron', 'Trelvo', 'Ondrek', 'Yspara', 'Duvarn', 'Feltrix', 'Malbeth',
] as const;

/** A whole-word matcher for `name`, Unicode-aware on both sides. */
function wholeWord(name: string, flags: string): RegExp {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, flags);
}

/** A source text with its place names held out of the translator's reach. */
export interface ProtectedSource {
  /** The source with every protected name replaced by a placeholder. */
  text: string;
  /** The names actually substituted, longest first. Empty means nothing was
   *  found to protect, and the translation is exactly as exposed as before. */
  protectedNames: string[];
  /** Put the real names back into a translation of `text`. */
  restore(translated: string): string;
}

/**
 * Hold a feature's own name out of the translation, then put it back.
 *
 * `droppedProperNames` refuses a translation that renamed the place, which is
 * the right default and fires on every name built from a Dutch common noun —
 * Aluminiumbrug, Oude Lutherse Kerk, Beltbrug. Refusing them costs the lede:
 * the feature falls back to a Wikidata one-liner that names no canal, no
 * street and no year. The fix is not to weaken the guard but to make it
 * unnecessary, by substituting a placeholder for the name before translating
 * and restoring it after. The guard still runs afterwards, on the restored
 * text, as the check that this worked.
 *
 * Only case-sensitive whole-word occurrences are protected, and that is
 * deliberate on both counts. Whole-word, because "brug" inside
 * "Aluminiumbrug" is not a separate name. Case-sensitive, because a Dutch lede
 * spells the place's name with its capital and uses the bare common noun
 * afterwards — "De Oude Lutherse Kerk … de kerk werd gebouwd" — and protecting
 * that second, lowercase "kerk" would leave "Kerk was built" in the English.
 * Restoring the capitalised occurrence is enough to satisfy the guard for
 * every token of the name.
 *
 * A name that never appears in its own lede protects nothing and is left to
 * the guard, which is the honest outcome: there was no name in the source to
 * keep.
 */
export function protectNames(source: string, names: string[]): ProtectedSource {
  const candidates: string[] = [];
  for (const name of names) {
    if (name.length > 3 && wholeWord(name, 'u').test(source)) {
      candidates.push(name);
      continue;
    }
    // The whole name is not in the lede — "Kerk van de Heilige Familie" written
    // as "de Heilige Familie". Fall back to the significant parts, which are
    // the same tokens the guard judges.
    for (const token of name.split(/[\s-]+/)) {
      if (token.length > 3 && token[0] === token[0].toLocaleUpperCase()
        && wholeWord(token, 'u').test(source)) candidates.push(token);
    }
  }

  // Longest first, so a name is substituted before a token nested inside it.
  const ordered = [...new Set(candidates)].sort((a, b) => b.length - a.length);
  const substitutions: { placeholder: string; name: string }[] = [];
  let text = source;
  for (const name of ordered) {
    const placeholder = NAME_PLACEHOLDERS
      .filter((token) => !source.includes(token))
      .at(substitutions.length);
    if (!placeholder) break; // More names than placeholders: protect what we can.
    const next = text.replace(wholeWord(name, 'gu'), placeholder);
    if (next === text) continue; // Already consumed by a longer name.
    text = next;
    substitutions.push({ placeholder, name });
  }

  return {
    text,
    protectedNames: substitutions.map((entry) => entry.name),
    // Case-insensitive on the way back: the translator is free to lowercase a
    // placeholder it read as a common noun, and the name still belongs there.
    restore: (translated: string) => substitutions.reduce(
      (result, entry) => result.replace(wholeWord(entry.placeholder, 'giu'), entry.name),
      translated),
  };
}
