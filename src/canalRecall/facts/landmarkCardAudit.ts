// What a landmark card actually says, and whether it is worth saying.
//
// User report 2026-10-16: arriving at Huis Bartolotti, the card read only
// "Het Huis Bartolotti (also Het Bonte Huis) is a canal house at Herengracht
// 170-172 in Amsterdam." Two separate defects: the card was a bare
// definition (what / where, with no date, person or event), and it was
// half-Dutch, because the translator held the place name out of translation
// and the Dutch article in front of it ("Het") stayed behind.
//
// This module is the deterministic half of the fix: it reproduces the text a
// card shows (`splitDetail` over `funFact || wikipediaExtract`, exactly as
// `buildLandmarks` does) and flags the two failure kinds, so the audit script
// can count them over every landmark and the curated overrides in
// `landmark-card-overrides.json` can be checked against the same rules.

import { splitDetail } from '../game/landmarkData';

export type CardIssue =
  /** Nothing to show at all. */
  | 'empty'
  /** Only "X is a <type> at/in <place>" — no date, person or event. */
  | 'definitional'
  /** A Dutch article or function word left in the English text. */
  | 'dutch'
  /** The extract is still the untranslated Dutch lede. */
  | 'untranslated';

export interface CardAuditInput {
  id: string;
  name: string;
  funFact?: string;
  wikipediaExtract?: string;
  wikipediaExtractLang?: string;
  /** `translated` when the extract is a machine translation of a Dutch lede. */
  wikipediaExtractSource?: string;
}

export interface CardAudit {
  id: string;
  name: string;
  /** The text the collapsed/arrival card body shows (`longDetail`). */
  text: string;
  issues: CardIssue[];
  /** The Dutch tokens that tripped `dutch`, for the report. */
  dutchTokens: string[];
}

/** The body a landmark card shows: `longDetail`, falling back to `detail`. */
export function cardBodyText(feature: Pick<CardAuditInput, 'funFact' | 'wikipediaExtract'>): string {
  const { detail, longDetail } = splitDetail(feature.funFact || feature.wikipediaExtract || '');
  return (longDetail || detail).trim();
}

// ---- Definitional sentences ----

/** A four-digit year, a decade or a century: "1617", "1920s", "17th century". */
const DATE = /\b(1[0-9]{3}|20[0-2][0-9])s?\b|\b\d{1,2}(st|nd|rd|th)[- ]century\b|\bcentur(y|ies)\b|\bmedieval\b|\bGolden Age\b/i;

/** Verbs that turn a definition into a story: something happened to it. */
const EVENT = new RegExp(String.raw`\b(` + [
  'built', 'rebuilt', 'designed', 'founded', 'opened', 'reopened', 'closed', 'named', 'renamed',
  'commissioned', 'destroyed', 'burn(ed|t)', 'demolished', 'restored', 'converted', 'completed',
  'established', 'erected', 'unveiled', 'lived', 'died', 'born', 'painted', 'housed', 'moved',
  'replaced', 'started', 'began', 'dug', 'filled in', 'inherited', 'hid', 'hidden', 'bombed',
  'occupied', 'squatted', 'sold', 'bought', 'donated', 'stood', 'served', 'used to', 'formerly',
  'originally', 'once', 'nicknamed', 'known as', 'famous', 'oldest', 'largest', 'tallest',
  'first', 'only', 'last', 'remains', 'survived', 'collapsed', 'sank', 'leaned', 'tilts',
  'murdered', 'killed', 'deported', 'liberat(ed|ion)', 'war', 'commemorat(es|ing|ed)', 'clandestine',
  // A causal clause is a reason, which is already more than a definition.
  'because', 'so', 'which is why', 'although', 'despite', 'until',
].join('|') + String.raw`)\b`, 'i');

/** "by Hendrick de Keyser", "for Willem van den Heuvel", "diarist Anne
 *  Frank": a person attached by a preposition or a role noun. */
const PERSON = new RegExp([
  // A role noun or "by"/"for" and then a name: "by Michel de Klerk", "diarist Anne Frank".
  String.raw`\b(by|for|after|architect|diarist|painter|writer|poet|trumpeter|composer|sculptor|artist|merchant|mayor)\s+(?:[A-Z][\p{L}'’.-]+\s+){0,3}(?:(?:van|de|der|den|ter|te|von|du|la|le)\s+){0,3}[A-Z][\p{L}'’-]+`,
  // "of/to" and then a first name plus surname: "the works of Vincent van Gogh".
  String.raw`\b(of|to)\s+(?:[A-Z][\p{L}'’.-]+\s+)(?:(?:van|de|der|den|ter|te|von|du|la|le)\s+){0,3}[A-Z][\p{L}'’-]+`,
].join('|'), 'u');

/** "X is a/an/the ... in/at/on ..." — a sentence that only says what and where. */
const DEFINITION = /\b(is|was|are|were)\s+(a|an|the|one of|located|situated)\b/i;

function sentencesOf(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map(sentence => sentence.trim()).filter(Boolean);
}

/** True when every sentence is a definition and nothing anchors it in time,
 *  in a person, or in an event. The feature's own name is removed before the
 *  person check, so "Huis Bartolotti" is not mistaken for a namesake. */
export function isDefinitionalOnly(text: string, name = ''): boolean {
  const sentences = sentencesOf(text);
  if (!sentences.length) return false;
  if (!sentences.every(sentence => DEFINITION.test(sentence))) return false;
  const stripped = name ? text.split(name).join(' ') : text;
  if (DATE.test(stripped) || EVENT.test(stripped)) return false;
  // A person is only a signal outside the "X is a Y in Z" frame itself;
  // "a canal house at Herengracht 170" has no person in it.
  const afterVerb = stripped.replace(/^.*?\b(is|was|are|were)\b/i, '');
  return !PERSON.test(afterVerb.replace(/\b(in|at|on|near)\s+[A-Z][^,.;]*/g, ''));
}

// ---- Untranslated Dutch ----

/** Dutch words that are not English words and do not occur inside English
 *  prose as loanwords. Lowercase only: a capitalised "Huis" is a name. The
 *  tussenvoegsels (van, de, der, den, ter, te) are deliberately absent — they
 *  belong to people's names ("Hendrick de Keyser"). */
const DUTCH_WORDS = new Set([
  'het', 'een', 'ook', 'wordt', 'werd', 'zijn', 'niet', 'gebouwd', 'bevindt', 'gelegen',
  'waar', 'deze', 'heeft', 'hebben', 'tussen', 'bij', 'uit', 'naar', 'voor',
  'aan', 'eeuw', 'jaar', 'gemeente', 'gracht', 'straat', 'brug', 'kerk', 'huis', 'gebouw',
  'genoemd', 'vernoemd', 'tegenover', 'achter', 'onder', 'boven', 'nog', 'als', 'maar',
  'omdat', 'dus', 'echter', 'sinds', 'stadsdeel',
]);
// Not listed although Dutch: "door", "met", "tot", "na", "om", "wel" are also
// English words ("a side door", "officials met").

/** A Dutch article left in front of the feature's own name: the signature of
 *  a translator that was handed "Het [NAME] is een grachtenhuis" with the name
 *  held out, translated the rest, and kept the article ("Het Huis Bartolotti").
 *  Only machine-translated text can carry this; an English article that
 *  writes "Het Ketelhuis" is using the venue's real name. */
const DUTCH_ARTICLES = ['Het', 'De', 'Een', "'t"];

/** Parenthetical glosses and quotations are allowed to be Dutch: "(Dutch: het
 *  Koninklijk Concertgebouw)", "nicknamed "het grijze monument"". */
function withoutGlosses(text: string): string {
  return text
    .replace(/\([^)]*\b(Dutch|pronounced|pronunciation|English|also|formerly|full name)\b[^)]*\)/gi, ' ')
    .replace(/"[^"]*"|“[^”]*”|‘[^’]*’|\('[^']*'\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ');
}

/**
 * Untranslated Dutch left in English card text. Lowercase Dutch function words
 * count, except inside a proper name — a word that follows a capitalised word
 * ("Huis aan de Drie Grachten", "Muziekgebouw aan 't IJ") — and inside glosses
 * and quotations. `translated` adds the leftover-article check above.
 */
export function dutchTokens(text: string, name = '', translated = false): string[] {
  const found: string[] = [];
  if (translated && name) {
    const bare = name.replace(/^(Het|De|'t)\s+/, '');
    for (const article of DUTCH_ARTICLES) {
      if (text.includes(`${article} ${bare}`) && !name.startsWith(`${article} `)) found.push(article);
    }
  }
  const stripped = withoutGlosses(name ? text.split(name).join(' Name ') : text);
  const words = [...stripped.matchAll(/[\p{L}']+/gu)].map(match => match[0]);
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word !== word.toLowerCase() || !DUTCH_WORDS.has(word)) continue;
    const previous = words[i - 1] || '';
    if (/^\p{Lu}/u.test(previous) && i > 0) continue; // inside a name
    found.push(word);
  }
  return [...new Set(found)];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---- The audit ----

export function auditCard(feature: CardAuditInput): CardAudit {
  const text = cardBodyText(feature);
  const issues: CardIssue[] = [];
  if (!text) issues.push('empty');
  // A curated `funFact` is English by construction; the language tag only
  // describes the encyclopedia extract underneath it.
  if (!feature.funFact && feature.wikipediaExtractLang && feature.wikipediaExtractLang !== 'en') {
    issues.push('untranslated');
  }
  if (text && isDefinitionalOnly(text, feature.name)) issues.push('definitional');
  const translated = !feature.funFact && feature.wikipediaExtractSource === 'translated';
  const tokens = text ? dutchTokens(text, feature.name, translated) : [];
  if (tokens.length) issues.push('dutch');
  return { id: feature.id, name: feature.name, text, issues, dutchTokens: tokens };
}

// ---- Curated overrides ----

/** One curated card text, with the provenance a translation pass needs to
 *  resume: the exact original sentences it rests on, their language, where
 *  they came from, and the text it replaced. */
export interface CardOverride {
  id: string;
  name: string;
  /** English card text, one or two sentences, at most 280 characters. */
  text: string;
  sourceUrl: string;
  /** Article title as `facts:articles` caches it, so the quote can be re-checked. */
  articleTitle: string;
  sourceLanguage: 'en' | 'nl';
  /** Exact passages from the article that support `text`, in the original
   *  language, separated by ` | `. */
  sourceQuote: string;
  license: string;
  retrievedAt: string;
  /** Who wrote or translated `text`. */
  translator: string;
  /** The card text this replaces, for the diff and for a later pass. */
  replaces: string;
}

export interface OverrideProblem {
  id: string;
  problem: string;
}

/** Longest card body `splitDetail` keeps whole (`longDetail`). */
export const CARD_TEXT_MAX = 280;
/** Longest first sentence that survives as the collapsed `detail` and as a
 *  fact opening (`openingSentence` caps at 160) without an ellipsis. */
export const CARD_FIRST_SENTENCE_MAX = 150;

/** An override must itself pass the audit, fit the card, and carry a source. */
export function validateOverride(override: CardOverride): OverrideProblem[] {
  const problems: string[] = [];
  const text = override.text.trim();
  if (!text) problems.push('empty text');
  if (text.length > CARD_TEXT_MAX) problems.push(`text is ${text.length} chars (max ${CARD_TEXT_MAX})`);
  const first = sentencesOf(text)[0] || '';
  if (first.length > CARD_FIRST_SENTENCE_MAX) problems.push(`first sentence is ${first.length} chars (max ${CARD_FIRST_SENTENCE_MAX})`);
  if (cardBodyText({ funFact: text }) !== text) problems.push('card would not show the whole text');
  if (!/^https:\/\/(en|nl)\.wikipedia\.org\/wiki\//.test(override.sourceUrl)) problems.push('sourceUrl is not a Wikipedia article');
  if (!override.sourceQuote.trim()) problems.push('no sourceQuote');
  if (!override.license) problems.push('no license');
  const audit = auditCard({ id: override.id, name: override.name, funFact: text });
  for (const issue of audit.issues) problems.push(`override fails audit: ${issue}${issue === 'dutch' ? ` (${audit.dutchTokens.join(', ')})` : ''}`);
  return problems.map(problem => ({ id: override.id, problem }));
}

export interface OverrideApplication<T> {
  features: T[];
  applied: string[];
  missing: string[];
}

/** Put each override into its feature's `funFact` — the slot `buildLandmarks`
 *  already prefers over the encyclopedia extract — leaving the extract and
 *  its original-language text untouched underneath. Idempotent. */
export function applyOverrides<T extends CardAuditInput & { sourceUrl?: string }>(
  features: readonly T[],
  overrides: readonly CardOverride[],
): OverrideApplication<T> {
  const byId = new Map(overrides.map(override => [override.id, override]));
  const applied: string[] = [];
  const next = features.map(feature => {
    const override = byId.get(feature.id);
    if (!override) return feature;
    applied.push(feature.id);
    return { ...feature, funFact: override.text, funFactSourceUrl: override.sourceUrl };
  });
  const seen = new Set(applied);
  return { features: next, applied, missing: overrides.map(o => o.id).filter(id => !seen.has(id)) };
}

/** The opening a fact card shows ahead of its trivia: the override's first
 *  sentence, so a drive-by card no longer leads with the bare definition. */
export function overrideOpening(override: CardOverride): string {
  return sentencesOf(override.text.trim())[0] || '';
}
