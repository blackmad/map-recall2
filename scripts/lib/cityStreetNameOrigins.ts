/**
 * Street-name origins from a city register other than Amsterdam's BAG API.
 *
 * Amsterdam's pipeline (`fetch-street-name-origins.ts` and friends) is built
 * around the municipal BAG `beschrijvingNaam` field and a long list of repairs
 * to Apple's translator. Other registers differ in shape, so this module keeps
 * the decisions that are the same for any of them, testable without network
 * or a translator:
 *
 *  - which Dutch text is kept (the opening sentences that explain the name;
 *    council-decision bookkeeping is dropped),
 *  - which kind a register name is, for the game's street/water/bridge join,
 *  - which record explains an extract name when a name is reused across the
 *    municipality (Rotterdam has 209 names with two different texts, mostly
 *    the same street name in an annexed village): the one whose register
 *    point lies near the extract's own street, or none at all.
 */
import { createHash } from 'node:crypto';
import { trimToSentence } from './translation.ts';
import { nameKey } from './streetNameOrigins.ts';

export { nameKey };

/** One register record as staged: a name, its Dutch text and provenance. */
export interface RegisterRecord {
  /** The register's own identifier for the record. */
  id: string;
  name: string;
  /** The full Dutch text as published, whitespace-normalised. */
  nlFull: string;
  /** Where a reader can check this record. */
  sourceUrl: string;
  /** WGS84 point of the record, when the register has one. */
  lat?: number;
  lon?: number;
}

/** One name's origin as staged for translation and review. */
export interface StagedCityOrigin {
  name: string;
  kind: 'street' | 'water' | 'bridge';
  /** Register record id(s) the text came from. */
  recordId: string;
  sourceUrl: string;
  /** The Dutch that is translated: the opening sentences of the text. */
  nl: string;
  /** English, once translated. */
  en?: string;
  /** Which translator made `en`, e.g. 'ollama:qwen3.5:9b'. */
  enSource?: string;
  /** Why a translation was refused, when it was. */
  refused?: string;
}

/** Longest Dutch text sent to the translator; the card shows two to four lines. */
export const MAX_ORIGIN_NL_CHARS = 600;

/**
 * Sentences that record the naming decision rather than explain the name:
 * "Bij besluit B. 10 februari 1950 …", "Raadsbesluit d.d. …". They are
 * register bookkeeping and read as noise on a card.
 */
const DECISION_SENTENCE = /^(?:bij\s+(?:raads|collegee?)?besluit|bij\s+b\.\s*en\s*w\.?|raadsbesluit|besluit\s+(?:b\.|van|d\.d\.)|vastgesteld\s+(?:bij|op)\b)/i;

/** Split on sentence ends, conservatively (not after common Dutch abbreviations). */
export function dutchSentences(text: string): string[] {
  return text.replace(/\s+/g, ' ').trim()
    // No break after an initial ("Th. J. Stieltjes", "A.B.") or a common
    // abbreviation ("o.a.", "ca.", "Mr.", "St.", "n. Chr.").
    .split(/(?<!(?:^|[\s(.])[A-Za-z]\.)(?<!(?:^|[\s(])(?:Th|Chr|Ph|Joh|Wm|St|ca|o\.a|bijv|resp|nr|Mr|Dr|Jhr|jhr|mr|dr|prof|Prof|ir|ing|drs|plm|d\.w\.z|z\.g|i\.p\.v|e\.d|enz|Chr|ong|gem|geb|overl)\.)(?<=[.!?])\s+(?=[A-Z0-9"“'(])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/** The Dutch worth translating: decision bookkeeping dropped, cut at a sentence. */
export function originDutch(full: string, maxChars = MAX_ORIGIN_NL_CHARS): string {
  const kept = dutchSentences(full).filter((sentence) => !DECISION_SENTENCE.test(sentence));
  return trimToSentence(kept.join(' '), maxChars);
}

/** A register name that is a bridge or viaduct (the game's bridge partition). */
export function registerKind(name: string): 'street' | 'bridge' {
  return /(?:brug|bruggen|viaduct|aquaduct)$/i.test(name.trim()) ? 'bridge' : 'street';
}

/** Metres between two WGS84 points (equirectangular; fine at city scale). */
export function metresBetween(a: [number, number], b: [number, number]): number {
  const toRad = Math.PI / 180;
  const x = (b[1] - a[1]) * toRad * Math.cos(((a[0] + b[0]) / 2) * toRad);
  const y = (b[0] - a[0]) * toRad;
  return Math.hypot(x, y) * 6371000;
}

/** How near a register point must be to an extract street to vouch for it. */
export const NEAR_METRES = 1500;

/**
 * The record that explains `name`, or null.
 *
 * One distinct text: that one. Several (the name is reused somewhere else in
 * the municipality): the texts with a register point within NEAR_METRES of
 * one of the extract's own segments for this name; if exactly one text is
 * left it wins, otherwise nothing does — no card beats the wrong person.
 */
export function recordFor(
  records: readonly RegisterRecord[],
  centers: ReadonlyArray<[number, number]>,
): { record: RegisterRecord; reason: 'unique' | 'nearest' } | { record: null; reason: 'ambiguous' | 'none' } {
  const withText = records.filter((record) => record.nlFull);
  if (!withText.length) return { record: null, reason: 'none' };
  const texts = new Set(withText.map((record) => record.nlFull));
  if (texts.size === 1) return { record: withText[0], reason: 'unique' };
  const near = withText.filter((record) => record.lat != null && record.lon != null
    && centers.some((center) => metresBetween(center, [record.lat!, record.lon!]) <= NEAR_METRES));
  const nearTexts = new Set(near.map((record) => record.nlFull));
  if (nearTexts.size === 1) return { record: near[0], reason: 'nearest' };
  return { record: null, reason: 'ambiguous' };
}

/** Short stable key for a Dutch text, for the committed translation cache. */
export function dutchHash(nl: string): string {
  return createHash('sha1').update(nl).digest('hex').slice(0, 12);
}

/**
 * Repairs for what the local model reliably gets wrong in these registers,
 * found in the Rotterdam spot-check. `gedempt` is a canal filled in, not
 * "embanked" or "dammed" — the same mistake the Amsterdam pass guards against.
 */
const REPAIRS: ReadonlyArray<[RegExp, RegExp, string]> = [
  [/gedempt|demping|dempen/i, /\b(?:embanked|muted|silenced|suppressed|dampened)\b/g, 'filled in'],
  [/gedempt|demping|dempen/i, /\b(partially|entirely|completely) dammed\b/g, '$1 filled in'],
];

export function repairCityOriginTranslation(nl: string, en: string): string {
  let out = en;
  for (const [trigger, wrong, right] of REPAIRS) if (trigger.test(nl)) out = out.replace(wrong, right);
  return out;
}

/** Group records by matching key. */
export function indexRecords(records: readonly RegisterRecord[]): Map<string, RegisterRecord[]> {
  const index = new Map<string, RegisterRecord[]>();
  for (const record of records) {
    const key = nameKey(record.name);
    (index.get(key) ?? index.set(key, []).get(key)!).push(record);
  }
  return index;
}
