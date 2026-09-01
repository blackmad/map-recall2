// Splitting a Wikipedia article into the parts worth mining for a fact.
//
// The existing enrichment stores `wikipediaSourceText`: the article *intro*,
// capped at about 1,200 characters. That is the driest paragraph on the page —
// it exists to define the subject, so almost every one of them reduces to "X
// is a bridge over the Y in Amsterdam", which is exactly what the card already
// says. The interesting material ("named after the toll house that stood
// here", "collapsed in 1901 under a herd of cattle") lives further down, under
// == Etymology ==, == History ==, == In popular culture ==.
//
// So the fact generator reads whole articles instead, and this module decides
// which of their sections are worth a prompt. It is pure text work with no
// network in it, which is why it is here and testable rather than inside the
// fetch script.

/** One `== Heading ==` section of a plaintext MediaWiki extract. */
export interface ArticleSection {
  /** The heading text, or `''` for the untitled lede above the first heading. */
  title: string;
  /** Heading depth: 0 for the lede, 1 for `==`, 2 for `===`, and so on. */
  depth: number;
  /** The section's own prose, excluding its subsections' headings. */
  text: string;
}

/**
 * Sections that never contain a fact a player could learn: citation
 * apparatus, navigation, and image dumps. Matched case-insensitively against
 * the whole heading, so "See also" is dropped and "Seealso Bridge" is not.
 */
const APPARATUS_HEADINGS = new Set([
  'references', 'reference', 'notes', 'notes and references', 'footnotes',
  'citations', 'sources', 'bibliography', 'further reading', 'external links',
  'see also', 'gallery', 'literature', 'publications', 'works cited',
]);

/**
 * Sections whose prose is a table or list of names rendered as running text.
 * They read as facts to a language model and as noise to a player: a list of
 * every tram line calling at a stop is not something to learn from a card.
 */
const LIST_HEADINGS = new Set([
  'transport', 'transportation', 'public transport', 'access', 'getting there',
  'awards', 'honours', 'honors', 'statistics', 'demographics', 'climate',
  'population', 'subdivisions', 'neighbourhoods', 'neighborhoods',
]);

/**
 * Headings whose content is where the memorable material actually is, highest
 * first. This is a preference, not a filter: an article with none of these
 * still gets its ordinary prose mined, just ranked below an article that has
 * an == Etymology == section to draw on.
 */
const PREFERRED_HEADINGS: readonly (readonly [RegExp, number])[] = [
  [/^(etymology|name|naming|toponym)/i, 5],
  [/(popular culture|fiction|film|literature and)/i, 5],
  [/^(trivia|anecdote|folklore|legend)/i, 5],
  [/^(history|origins?|early|founding|background)/i, 4],
  [/(incident|disaster|fire|flood|collapse|war|occupation|siege)/i, 4],
  [/^(construction|design|architecture|renovation|restoration)/i, 3],
  [/(notable|residents|inhabitants|people)/i, 3],
  [/^(description|layout|location|setting)/i, 2],
];

/** The lede is worth mining, but it is the paragraph the card already shows,
 *  so it ranks below any section that might say something new. */
const LEDE_INTEREST = 2;
const DEFAULT_INTEREST = 1;

/**
 * How likely this heading is to contain something a player would enjoy
 * knowing. `0` means "do not prompt at all"; higher is better material.
 */
export function sectionInterest(title: string): number {
  const normalised = title.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalised) return LEDE_INTEREST;
  if (APPARATUS_HEADINGS.has(normalised)) return 0;
  if (LIST_HEADINGS.has(normalised)) return 0;
  for (const [pattern, interest] of PREFERRED_HEADINGS) {
    if (pattern.test(normalised)) return interest;
  }
  return DEFAULT_INTEREST;
}

/** Matches a MediaWiki plaintext heading line: `== History ==`, `=== 1900s ===`. */
const HEADING = /^(={2,6})\s*(.*?)\s*\1$/;

/**
 * Split `explaintext` article output into sections. MediaWiki renders headings
 * as `== Title ==` lines in plaintext mode, which is the only structure the
 * plain extract retains — there is no other marker to key on.
 */
export function splitArticleSections(article: string): ArticleSection[] {
  const sections: ArticleSection[] = [];
  let current: ArticleSection = { title: '', depth: 0, text: '' };
  const lines: string[] = [];
  const flush = () => {
    current.text = lines.join('\n').trim();
    if (current.text || current.title) sections.push(current);
    lines.length = 0;
  };
  for (const line of (article || '').split('\n')) {
    const heading = HEADING.exec(line.trim());
    if (!heading) { lines.push(line); continue; }
    flush();
    current = { title: heading[2], depth: heading[1].length - 1, text: '' };
  }
  flush();
  return sections;
}

export interface SourcePassage {
  /** The heading this text came from, for provenance on every generated fact. */
  section: string;
  text: string;
  interest: number;
}

/** Below this a section is a stub caption or a one-line cross-reference, and a
 *  model asked to find three facts in it will invent them. */
const MINIMUM_PASSAGE_CHARS = 200;

/**
 * Choose what to feed the model, best material first.
 *
 * Sections are kept whole rather than concatenated into one blob: a fact
 * generated from == Etymology == can then say so, and two facts drawn from
 * different sections are far less likely to be the same fact twice. Long
 * sections are truncated at a sentence end, because a passage cut mid-clause
 * is exactly the input that produces a confidently wrong completion.
 */
export function selectSourcePassages(
  sections: readonly ArticleSection[],
  options: { maxPassages?: number; maxChars?: number } = {},
): SourcePassage[] {
  const maxPassages = options.maxPassages ?? 6;
  const maxChars = options.maxChars ?? 2400;
  return sections
    .map((section) => ({
      section: section.title,
      text: truncateAtSentence(section.text, maxChars),
      interest: sectionInterest(section.title),
    }))
    .filter((passage) => passage.interest > 0 && passage.text.length >= MINIMUM_PASSAGE_CHARS)
    // Stable sort by interest keeps article order within a tier, so History
    // still comes before a later == Incidents == of the same rank.
    .map((passage, index) => ({ passage, index }))
    .sort((a, b) => b.passage.interest - a.passage.interest || a.index - b.index)
    .slice(0, maxPassages)
    .map((entry) => entry.passage);
}

/** Cut to at most `maxChars`, ending on a sentence boundary when one is
 *  reasonably close to the limit rather than mid-clause. */
export function truncateAtSentence(text: string, maxChars: number): string {
  const trimmed = (text || '').trim();
  if (trimmed.length <= maxChars) return trimmed;
  const window = trimmed.slice(0, maxChars);
  const lastEnd = Math.max(window.lastIndexOf('. '), window.lastIndexOf('.\n'));
  return (lastEnd > maxChars * 0.5 ? window.slice(0, lastEnd + 1) : window).trim();
}
