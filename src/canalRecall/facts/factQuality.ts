// Whether a sentence a local model wrote is allowed onto a card.
//
// A 4-billion-parameter model asked for "three interesting facts" reliably
// produces some of each of these, and every one of them is worse than showing
// nothing:
//
//   - the lede back again ("The Blauwbrug is a bridge in Amsterdam"), which
//     costs the player a card and teaches nothing;
//   - a dangling reference ("It was rebuilt in 1883"), which is unreadable on
//     a card that appears alone beside a canal;
//   - a year that is not in the source, which is the failure mode that makes a
//     learning game teach something false;
//   - "as of 2023, it is currently being renovated", which is true today, in a
//     JSON file that ships for years.
//
// So generation is deliberately cheap and permissive, and this gate is where
// the judgement lives. It rejects with a reason rather than a boolean, because
// the rejection counts are the only feedback the prompt ever gets — a run that
// throws away 60% of its output as `restates-the-lede` is a prompt problem,
// and a run that throws away 60% as `ungrounded-number` is a model problem.

export type RejectionReason =
  | 'too-short'
  | 'too-long'
  | 'not-one-sentence'
  | 'dangling-reference'
  | 'does-not-name-subject'
  | 'restates-the-lede'
  | 'temporally-fragile'
  | 'talks-about-the-source'
  | 'markup'
  | 'ungrounded-number'
  | 'duplicate';

export type FactVerdict =
  | { ok: true; text: string }
  | { ok: false; reason: RejectionReason };

/** A card holds about two lines; below this a "fact" is a fragment. */
const MIN_CHARS = 45;
const MAX_CHARS = 200;

/** Openings that refer to something the card does not show. A fact appears on
 *  its own, next to a canal, with no preceding sentence to resolve "it". */
const DANGLING_OPENING = /^(it|its|it's|this|that|these|those|they|their|he|she|his|her|the (building|bridge|street|park|square|church|museum|structure|site|area|place))\b/i;

/** True today, wrong in a file that ships for years. */
const TEMPORALLY_FRAGILE = /\b(currently|at present|nowadays|as of \d{4}|in recent years|recently|today the|today it|is (being|to be|due to be|set to be|expected to be|scheduled to be) \w+|is (planned|proposed|expected|scheduled|due|under construction)|are (planned|proposed|expected|scheduled)|will (open|be built|be completed|be replaced|reopen))\b/i;

/** The model describing its own input instead of the place. */
const META_LANGUAGE = /\b(the (source|text|passage|article|extract|document)|according to the (text|source|passage|article)|the provided|mentioned above|this (text|passage|article))\b/i;

/** Anything that would render as literal punctuation on a canvas card. */
const MARKUP = /(^\s*[-*•\d]+[.)]\s)|[*_#`]{1,}|\[\d+\]|<[^>]+>|\|\||\n/;

/**
 * A sentence that only asserts the feature's category and city. This is what
 * the card's own lede already says, so spending a rotation slot on it is a
 * loss even though the sentence is perfectly true.
 */
const CATEGORY_WORDS = 'bridge|street|canal|park|square|church|museum|building|monument|neighbourhood|neighborhood|district|area|tower|gate|house|hotel|theatre|theater|station|market|island|quay|harbour|harbor|cemetery|garden|school|university|synagogue|mosque|windmill|lock|sluice|library|hall|palace|mill|club|stadium|arena|prison|hospital|brewery|factory|chapel|gallery|zoo|dock|street|lane|road|avenue|tunnel|fountain|statue';
const LEDE_RESTATEMENT = new RegExp(
  `^\\s*(the\\s+)?[^.]{2,60}?\\s+(is|was)\\s+(a|an|the)\\s+(\\w+[- ]){0,3}(${CATEGORY_WORDS})\\b[^.]{0,40}\\b(in|of|on|near|at|situated at|located at)\\s+(the\\s+)?[A-Z0-9][^.]{0,40}\\.?\\s*$`,
  'i',
);

/**
 * A sentence whose entire content is where the thing is. "…is located in
 * Amsterdam's Old Centre district, very close to the main railway station" is
 * the lede restatement in its other common form, and the card is already
 * anchored to a point on a map the player is looking at.
 */
const LOCATION_ONLY = /^\s*(the\s+)?[^.]{2,60}?\s+(is|was|stands|sits|lies)\s+(located|situated|found|positioned)?\s*(in|at|on|near|next to|beside|along)\b[^.]{0,90}\.?\s*$/i;

/**
 * The evaluative clause a model tacks onto a finished sentence: "…, a striking
 * architectural feature", "…, marking a significant milestone in its history".
 * It carries no information, it is the tell that the sentence was generated,
 * and it eats the character budget a card actually has.
 *
 * These are trimmed rather than rejected. The clause is always a trailing
 * comma phrase, so removing it leaves a grammatical sentence, and the fact in
 * front of it is usually worth keeping. Deliberately narrow: ", which he never
 * used" is informative and must survive.
 */
const FILLER_CLAUSE = new RegExp(
  '\\s*,\\s+(?:'
  + '(?:marking|showcasing|highlighting|demonstrating|reflecting|contributing|offering|underscoring'
  + '|emphasi[sz]ing|solidifying|cementing|symboli[sz]ing|illustrating|making it|cementing its)\\b[^,]*'
  + '|(?:a|an|the)\\s+(?:\\w+\\s+){0,2}'
  + '(?:striking|significant|notable|remarkable|hidden|unique|key|major|important|impressive|beloved|popular)'
  + '\\s+(?:\\w+\\s+){0,2}'
  + '(?:feature|milestone|achievement|aspect|element|landmark|detail|addition|space|example|part|symbol|sight)'
  + '[^,]*'
  + ')\\s*\\.?\\s*$',
  'i',
);

/** Drop a trailing evaluative clause, restoring the full stop. */
export function trimFillerClause(text: string): string {
  const trimmed = text.replace(FILLER_CLAUSE, '');
  if (trimmed === text) return text;
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** Sentence enders, ignoring the abbreviations that are not sentence ends.
 *  The single-letter case is for initials: "Andrew S. Tanenbaum" was being
 *  counted as two sentences and rejected as a paragraph. */
const ABBREVIATIONS = /(\b(mr|mrs|ms|dr|prof|st|jr|sr|no|vs|etc|e\.g|i\.e|ca|approx)|(^|\s)\p{Lu})\.$/iu;

/** Counts sentence-final punctuation, so a "fact" that is really a paragraph
 *  is rejected rather than truncated into a half-claim. */
export function countSentences(text: string): number {
  let count = 0;
  for (const part of text.split(/(?<=[.!?])(?=\s|$)/)) {
    const piece = part.trim();
    if (!piece) continue;
    if (ABBREVIATIONS.test(piece)) continue;
    if (/[.!?]$/.test(piece)) count++;
  }
  return count || (text.trim() ? 1 : 0);
}

/** Lowercase alphanumeric words, for name matching and duplicate detection. */
export function words(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
}

/** Words too common to prove a fact is about the right subject. Without this,
 *  "Amsterdam" in the name matches every fact about the city. */
const WEAK_NAME_WORDS = new Set([
  'de', 'het', 'een', 'the', 'a', 'an', 'van', 'der', 'den', 'ter', 'te', 'in',
  'op', 'aan', 'en', 'and', 'of', 'amsterdam', 'utrecht', 'nederland',
  'netherlands', 'holland', 'nieuwe', 'oude', 'new', 'old', 'noord', 'zuid',
  'oost', 'west', 'north', 'south', 'east',
]);

/**
 * Does the sentence say what it is about? Dutch compounds make this cheap:
 * "Magere Brug" contributes "magere", and a fact that never says "magere" is
 * either about something else or is a dangling reference that slipped past the
 * opening check. Falls back to accepting when the name is nothing but weak
 * words, since "Het Nieuwe Westen" cannot prove itself this way.
 */
export function namesSubject(text: string, name: string, aliases: readonly string[] = []): boolean {
  const haystack = text.toLowerCase();
  // Any one spelling is enough. OSM and Wikipedia disagree constantly about
  // Dutch orthography — OSM's "Amsterdamschebrug" is nl.wikipedia's
  // "Amsterdamsebrug" — and a fact that used the article's spelling was being
  // rejected for naming the wrong subject when it had named the right one.
  return [name, ...aliases].some((candidate) => {
    const distinctive = words(candidate).filter((word) => word.length > 2 && !WEAK_NAME_WORDS.has(word));
    if (!distinctive.length) return true;
    // Substring rather than word match: Dutch inflects and compounds names
    // ("Amstel" inside "Amstelsluizen"), and a fact using the compound is
    // still plainly about the subject.
    return distinctive.some((word) => haystack.includes(word));
  });
}

/**
 * Every year and large number in the fact must appear in the passage it was
 * generated from.
 *
 * This is the single most valuable check in the file. A local model asked for
 * an interesting fact will happily supply a plausible year, and a plausible
 * year is indistinguishable from a real one on a card — the player has no way
 * to tell, which is exactly the failure the board's P0 rule is about. Numbers
 * are also the cheapest thing to verify: they either occur in the source or
 * they do not.
 *
 * Only runs of three or more digits are checked. Small numbers ("three
 * arches", "17th") are usually restatements of spelled-out source text and
 * would reject far more true facts than false ones.
 */
/**
 * Digit-group separators, removed only where they actually separate digits.
 *
 * A source writes "1,200 lights" and a fact writes "1200"; they are the same
 * number and must compare equal. Stripping those characters everywhere is the
 * obvious way to do it and is wrong: it also removes the ordinary spaces that
 * `\\b` needs, after which "built in 1691." no longer contains a word-bounded
 * 1691 and every century check fails.
 */
export function normaliseDigitGroups(text: string): string {
  return (text || '').replace(/(\d)[.,\u2009\u202f\u00a0 ](?=\d{3}(\D|$))/g, '$1');
}

export function ungroundedNumbers(text: string, source: string, name = ''): string[] {
  // The name counts as source. "OT301 was originally the Dutch film academy"
  // was rejected for the 301 in the building's own name.
  const haystack = normaliseDigitGroups(`${source} ${name}`);
  const ungrounded: string[] = [];
  for (const match of normaliseDigitGroups(text).matchAll(/\d{3,}/g)) {
    if (!haystack.includes(match[0])) ungrounded.push(match[0]);
  }
  // "the 17th century" is a claim about a range, so accept it when the source
  // states that century either by name or by containing a year inside it.
  for (const match of text.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)[- ]century\b/gi)) {
    const century = Number(match[1]);
    const named = new RegExp(`\\b${century}(st|nd|rd|th)[- ]century\\b`, 'i').test(source);
    const years = [...haystack.matchAll(/\b(\d{4})\b/g)]
      .some((year) => Math.floor((Number(year[1]) - 1) / 100) + 1 === century);
    if (!named && !years) ungrounded.push(`${century}th century`);
  }
  return ungrounded;
}

export interface QualityOptions {
  /** The feature's display name, so a fact can be checked for naming it. */
  name: string;
  /**
   * What the fact claims to be about. Only `naming` is gated on containing the
   * name — see `judgeFact`. Omitted, nothing is gated on it.
   */
  kind?: string;
  /** Other spellings that count as naming the subject — chiefly the title of
   *  the article the fact was drawn from, which often differs from the OSM
   *  name by an inflection. */
  aliases?: readonly string[];
  /** The passage the fact was generated from, for the grounding check. */
  source: string;
  /** Facts already accepted for this feature, to reject near-duplicates. */
  accepted?: readonly string[];
}

/** Word overlap, ignoring order. Two sentences about the same date and person
 *  score high here even when the model rephrased one of them. */
export function similarity(a: string, b: string): number {
  const left = new Set(words(a));
  const right = new Set(words(b));
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared++;
  return shared / Math.min(left.size, right.size);
}

/** Above this two facts say the same thing in different words, and showing
 *  both wastes a rotation the player would have learned something from. */
const DUPLICATE_SIMILARITY = 0.7;

/** Trim the wrappers models put around a sentence without changing its claim. */
export function tidyFact(text: string): string {
  return trimFillerClause((text || '')
    .replace(/\s+/g, ' ')
    .replace(/^\s*["'“‘]|["'”’]\s*$/g, '')
    .trim());
}

/**
 * Decide whether one generated sentence may be shown, and say why not when it
 * may not. Ordered cheapest-first so the rejection reason reported is the most
 * basic thing wrong with the sentence.
 */
export function judgeFact(raw: string, options: QualityOptions): FactVerdict {
  const text = tidyFact(raw);
  if (MARKUP.test(text)) return { ok: false, reason: 'markup' };
  if (text.length < MIN_CHARS) return { ok: false, reason: 'too-short' };
  if (text.length > MAX_CHARS) return { ok: false, reason: 'too-long' };
  if (countSentences(text) !== 1) return { ok: false, reason: 'not-one-sentence' };
  if (META_LANGUAGE.test(text)) return { ok: false, reason: 'talks-about-the-source' };
  if (TEMPORALLY_FRAGILE.test(text)) return { ok: false, reason: 'temporally-fragile' };
  if (DANGLING_OPENING.test(text)) return { ok: false, reason: 'dangling-reference' };
  // Whether a fact must contain the feature's name depends on what kind of
  // fact it is, because the card shows that name as its heading.
  //
  // Requiring it everywhere threw away 18% of an otherwise good run — "The
  // inaugural concert on 11 April 1888 featured 120 musicians and 500 singers"
  // reads perfectly under a card titled Concertgebouw, and rejecting it bought
  // nothing. But a *naming* fact that does not contain the name has almost
  // always translated it away, which is item 11c's rule: "The Lean Bridge is
  // named for its narrowness" teaches the wrong name for the Magere Brug. So
  // the guard is kept exactly where the failure lives.
  if (options.kind === 'naming' && !namesSubject(text, options.name, options.aliases)) {
    return { ok: false, reason: 'does-not-name-subject' };
  }
  if (LEDE_RESTATEMENT.test(text) || LOCATION_ONLY.test(text)) {
    return { ok: false, reason: 'restates-the-lede' };
  }
  if (ungroundedNumbers(text, options.source, options.name).length) {
    return { ok: false, reason: 'ungrounded-number' };
  }
  for (const existing of options.accepted || []) {
    if (similarity(text, existing) >= DUPLICATE_SIMILARITY) return { ok: false, reason: 'duplicate' };
  }
  return { ok: true, text };
}
