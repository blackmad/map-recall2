/**
 * Clean-up for the English prose in `public/data/extracts/<city>/neighborhood-history.json`.
 *
 * Three problems from the 2026-10 review of the card text:
 *  1. resident and area statistics in ledes and histories ("The district had
 *     10,771 inhabitants as of 1 January 2005"). Sentences flagged by the
 *     project's policy in `areaFacts.ts` (`excludedBy`) are dropped, except the
 *     first sentence, which is always kept. Two narrowings apply on top of it:
 *     a bare year is not a statistic ("Residents financed the bridge in 1927"),
 *     and a percentage is a statistic only when it counts people ("paying up to
 *     20% of the cost" stays). Area measurements ("The total area is 96.71
 *     hectares") get a local rule because the shared policy does not flag them.
 *  2. stripped-pronunciation artefacts: "The Grachtengordel (, lit. 'canal
 *     belt')", empty "()" pairs and a space before a comma or full stop.
 *  3. borrowed histories: a landmark's history inside the area, written as
 *     "Schinkel (waterway here): A dam blocked the river in 1434...". The prefix
 *     is stripped and recorded as `history.borrowedFrom = "Schinkel (waterway)"`.
 *
 * Pure functions only; the file-level driver is `scripts/clean-neighborhood-text.ts`.
 */
import { excludedBy } from './areaFacts.ts';

export interface PlainText { en: string; [key: string]: unknown }
export type EntryTextField = 'description' | 'history' | 'nameOrigin' | 'localFact';
const TEXT_FIELDS: readonly EntryTextField[] = ['description', 'history', 'nameOrigin', 'localFact'];
const DROP_FIELDS: readonly EntryTextField[] = ['description', 'history'];

export interface EntryChange {
  /** Dotted field, e.g. "description.en" or "history.en". */
  field: string;
  before: string;
  after: string;
  reason: string;
  /** Kind of change, for summaries. */
  kind: 'artefact' | 'drop' | 'borrowed';
  /** One entry per dropped sentence: its reason (statistics, area, crime, planning, origin-statistics). */
  droppedReasons?: string[];
  borrowedFrom?: string;
}

const ABBREVIATIONS = new Set([
  'st', 'ca', 'c', 'lit', 'dr', 'mr', 'mrs', 'ms', 'prof', 'vs', 'no', 'nr', 'etc', 'approx',
  'jr', 'sr', 'mt', 'ir', 'mevr', 'ong', 'bv', 'incl', 'cf', 'fl', 'vol', 'pp', 'ed', 'eds', 'ch',
  'sec', 'ave', 'blvd', 'rd', 'approx', 'e.g', 'i.e', 'a.o', 'o.a', 'nl', 'approximately',
]);
const OPENING = /[\p{Lu}\p{N}“"‘'(]/u;
const CLOSING = new Set(['”', '"', '’', "'", ')']);

/** True when the full stop after `before` belongs to an abbreviation or an initial, not a sentence end. */
function endsWithAbbreviation(before: string): boolean {
  const m = /(?:^|[^A-Za-z])([A-Za-z]+(?:\.[A-Za-z]+)*)\.$/.exec(before);
  if (!m) return false;
  const token = m[1];
  if (token.length === 1) return true; // an initial: "J. Smith", "A.J."
  if (token.includes('.')) return true; // "e.g.", "A.J."
  return ABBREVIATIONS.has(token.toLowerCase());
}

/**
 * Sentences of a short English lede. Breaks only at . ! ? that are followed by
 * whitespace and a capital, digit or opening quote, outside parentheses and
 * double quotes, and not after an abbreviation ("St.", "ca.", "lit.", "e.g.")
 * or an initial ("A.J."). Closing quotes or brackets stay with their sentence.
 */
export function splitSentences(text: string): string[] {
  const cuts: Array<{ end: number; next: number }> = [];
  let depth = 0;
  let inQuote = false;
  let segStart = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(') depth++;
    else if (c === ')') depth = Math.max(0, depth - 1);
    else if (c === '"') inQuote = !inQuote;
    else if (c === '“') inQuote = true;
    else if (c === '”') inQuote = false;
    if (c !== '.' && c !== '!' && c !== '?') continue;
    if (depth > 0 || inQuote) continue;
    let j = i + 1;
    while (j < text.length && CLOSING.has(text[j])) j++;
    let k = j;
    while (k < text.length && /\s/.test(text[k])) k++;
    if (k === j) continue; // no whitespace ("3.5", "e.g.x") or the end of the text
    if (!OPENING.test(text[k])) continue;
    if (c === '.' && endsWithAbbreviation(text.slice(segStart, i + 1))) continue;
    cuts.push({ end: j, next: k });
    segStart = k;
  }
  const out: string[] = [];
  let from = 0;
  for (const cut of cuts) {
    out.push(text.slice(from, cut.end).trim());
    from = cut.next;
  }
  const tail = text.slice(from).trim();
  if (tail) out.push(tail);
  return out.filter(Boolean);
}

const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December|januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december';
const DATE_RE = new RegExp(`\\b\\d{1,2}\\s+(?:${MONTHS})\\s+\\d{4}\\b|\\b(?:${MONTHS})\\s+\\d{1,2},?\\s+\\d{4}\\b`, 'gi');
const YEAR_RE = /^(?:1[0-9]{3}|20[0-2][0-9])s?$/;
const POPULATION_RE = /\b(?:inhabitants?|residents?|population|inwoners?|bevolking(?:sdichtheid)?|households?|huishoudens?|people (?:live|lived|reside)|BBGA|CBS)\b/i;
const PERCENT_RE = /%|procent|percent/i;

/** Counts of people, not years: "10,771 inhabitants", "18 inhabitants in 1795", "20% of residents". */
function countsResidents(sentence: string): boolean {
  const text = sentence.replace(DATE_RE, ' ');
  const numbers = (text.match(/\d(?:[\d.,]*\d)?/g) ?? []).filter(n => !YEAR_RE.test(n));
  if (/\b(?:BBGA|CBS)\b/.test(text)) return numbers.length > 0;
  if (!POPULATION_RE.test(text)) return false;
  return numbers.length > 0 || PERCENT_RE.test(text);
}

/** Area and density measurements, which the shared statistics policy does not flag. */
const AREA_PATTERNS: RegExp[] = [
  /\b(?:total\s+)?(?:area|surface(?:\s+area)?|size)\b[^.;]*?\d[\d.,]*\s*(?:km²|km2|km\b|ha\b|hectares?\b|square\s+(?:kilomet(?:er|re)s?|metres?|meters?))/i, // "The total area is 96.71 hectares"
  /\bcovers?\b[^.;]*?\d[\d.,]*\s*(?:km²|km2|km\b|ha\b|hectares?\b|square\s+(?:kilomet(?:er|re)s?|metres?|meters?))/i, // "The site covers 20.6 hectares"
  /\b(?:is|At|measures?)\s+(?:a\s+|an\s+)?\d[\d.,]*(?:\s*|-)(?:km²|km2|-hectare|hectares?\b)/i, // "is a 31.7-hectare wijk", "At 4.27 km²"
  /\bof its\s+\d[\d.,]*\s*hectares?\b/i, // "Of its 86 hectares"
  /\b(?:polder|wijk|neighbourhood|neighborhood|district|borough|site|plot)\b[^.;]{0,40}?\babout\s+\d[\d.,]*\s*hectares?\b/i, // "The polder, about 85 hectares"
  /\bper\s+(?:square\s+)?(?:kilomet(?:er|re)|hectare|km²|km2)\b/i, // "8,500 homes per square kilometre"
];

/** Why a sentence is a statistic to drop, or null to keep it. */
export function statisticReason(sentence: string): string | null {
  const label = excludedBy(sentence);
  if (label && label !== 'statistics') return label;
  if (countsResidents(sentence)) return 'statistics';
  if (AREA_PATTERNS.some(pattern => pattern.test(sentence))) return 'area';
  return null;
}

/**
 * Typographic clean-up of a sentence whose pronunciation or parenthetical was
 * stripped at import: "(, lit." becomes "(lit.", empty "()" pairs go, double
 * spaces collapse and a space before a comma or full stop is removed.
 */
export function normalizeArtifacts(text: string): string {
  let out = text.replace(/\(\s*,\s*/g, '(');
  out = out.replace(/\(\s*\)/g, '');
  out = out.replace(/ {2,}/g, ' ');
  out = out.replace(/ +([,.])(?=\s|$)/g, '$1');
  return out.trim();
}

/**
 * Drops statistic sentences from a lede or history. The first sentence is
 * always kept. Each dropped sentence is reported as "<reason>: <sentence>"; the
 * text is left byte-identical when nothing is dropped.
 */
export function cleanDescription(text: string): { text: string; dropped: string[] } {
  const sentences = splitSentences(text);
  if (sentences.length <= 1) return { text, dropped: [] };
  const kept = [sentences[0]];
  const dropped: string[] = [];
  for (const sentence of sentences.slice(1)) {
    const reason = statisticReason(sentence);
    if (reason) dropped.push(`${reason}: ${sentence}`);
    else kept.push(sentence);
  }
  return dropped.length ? { text: kept.join(' '), dropped } : { text, dropped };
}

/** "Schinkel (waterway here): A dam blocked..." -> the dam sentence with borrowedFrom "Schinkel (waterway)". */
const BORROWED_RE = /^([^():]{1,120}?) \(([a-z][a-z-]*(?: [a-z][a-z-]*)?) here\): /;

export function extractBorrowedHistory(text: string): { text: string; borrowedFrom?: string } {
  const m = BORROWED_RE.exec(text);
  if (!m) return { text };
  return { text: text.slice(m[0].length), borrowedFrom: `${m[1].trim()} (${m[2]})` };
}

/** Cleans every English text of one neighbourhood entry. Returns a new entry; key order is kept. */
export function cleanEntry<T extends { name: string } & Partial<Record<EntryTextField, PlainText>>>(
  entry: T,
): { entry: T; changes: EntryChange[] } {
  const changes: EntryChange[] = [];
  const out: Record<string, unknown> = { ...entry };
  for (const field of TEXT_FIELDS) {
    const value = entry[field];
    if (!value || typeof value.en !== 'string') continue;
    const before = value.en;
    let en = before;
    let borrowedFrom: string | undefined;
    const normalised = normalizeArtifacts(en);
    if (normalised !== en) {
      changes.push({ field: `${field}.en`, before: en, after: normalised, reason: 'pronunciation artefact', kind: 'artefact' });
      en = normalised;
    }
    if (field === 'history') {
      const borrowed = extractBorrowedHistory(en);
      if (borrowed.borrowedFrom) {
        borrowedFrom = borrowed.borrowedFrom;
        changes.push({ field: 'history.en', before: en, after: borrowed.text, reason: `borrowed from ${borrowed.borrowedFrom}`, kind: 'borrowed', borrowedFrom });
        en = borrowed.text;
      }
    }
    if ((DROP_FIELDS as readonly string[]).includes(field)) {
      const cleaned = cleanDescription(en);
      if (cleaned.dropped.length) {
        const droppedReasons = cleaned.dropped.map(d => d.slice(0, d.indexOf(':')));
        changes.push({
          field: `${field}.en`, before: en, after: cleaned.text, kind: 'drop', droppedReasons,
          reason: `dropped ${droppedReasons.length} sentence(s): ${[...new Set(droppedReasons)].join(', ')}`,
        });
        en = cleaned.text;
      }
    }
    if (en !== before || borrowedFrom) {
      out[field] = { ...value, en, ...(borrowedFrom ? { borrowedFrom } : {}) };
    }
  }
  return { entry: out as T, changes };
}
