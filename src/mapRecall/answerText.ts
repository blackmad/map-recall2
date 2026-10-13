/**
 * Display helpers for the Map Recall answer card (src/components/AnswerDetails.tsx and
 * WikipediaCard.tsx). Pure text: the data stays as published, the card reads as English.
 *
 * Review 2026-10-13: the folded card printed whole name origins (Prinsengracht: eight lines),
 * register prose started without a subject ("Painter and draughtsman (1864-1925)…" for Jan
 * Vethstraat), and a canal's history was headed as the neighbourhood's own.
 */

// Words a period follows without ending the sentence ("St. Nicholas", "ca. 1600", "lit. 'canal belt'").
const ABBREVIATIONS = new Set(['st', 'sts', 'ca', 'c', 'lit', 'mr', 'mrs', 'ms', 'dr', 'prof', 'no', 'nr', 'vs', 'cf', 'approx', 'jr', 'sr', 'mt', 'ft', 'e.g', 'i.e', 'fl', 'b', 'd', 'gen', 'col', 'capt', 'rev', 'sint',
  'th', 'chr', 'joh', 'jac', 'wm', 'ir', 'ds', 'jhr', 'mgr', 'fr', 'gebr', 'wed', 'pres', 'mej', 'mevr', 'hzn', 'czn', 'azn', 'jzn']);

/**
 * The first sentence of `text`. Does not break after an abbreviation ("St.", "ca.", "c.", "lit.")
 * or an initial ("A.J. Ernststraat", "J.P. Coen"), nor inside parentheses.
 */
export function firstSentence(text: string): string {
  const trimmed = text.trim();
  let depth = 0;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '(' || ch === '[') depth++;
    else if ((ch === ')' || ch === ']') && depth > 0) depth--;
    if (depth > 0 || (ch !== '.' && ch !== '!' && ch !== '?')) continue;
    // Closing quotes and brackets belong to the sentence they end.
    let end = i + 1;
    while (end < trimmed.length && /['’"”)\]]/.test(trimmed[end])) end++;
    if (end >= trimmed.length) return trimmed;
    if (!/\s/.test(trimmed[end])) continue;
    const next = trimmed.slice(end).trimStart();
    // A sentence starts with a capital, a digit or an opening quote.
    if (!/^[\p{Lu}\d'‘"“(]/u.test(next)) continue;
    if (ch === '.') {
      const word = /([\p{L}.]+)$/u.exec(trimmed.slice(0, i))?.[1] ?? '';
      const bare = word.toLowerCase();
      // Dutch patronymics are shortened with a period: "Maarten Jansz. Koster".
      if (ABBREVIATIONS.has(bare) || /^\p{Lu}\p{Ll}+sz$/u.test(word)) continue;
      // An initial: one capital letter ("Jan P. Heije"), or a run of them ("A.J").
      if (/^(\p{Lu}\.)*\p{Lu}$/u.test(word)) continue;
    }
    return trimmed.slice(0, end).trim();
  }
  return trimmed;
}

// Longest first: "dwarsstraat" before "straat", "burgwal" before "wal".
const GENERIC_SUFFIXES = [
  'dwarsstraat', 'voorstraat', 'achterstraat', 'zijstraat', 'achterburgwal', 'voorburgwal', 'burgwal', 'plantsoen', 'straatje', 'wetering', 'kwartier',
  'straat', 'gracht', 'singel', 'steeg', 'markt', 'buurt', 'plein', 'kanaal', 'haven', 'sloot', 'dreef', 'eiland',
  'kade', 'laan', 'park', 'brug', 'dijk', 'pad', 'hof', 'weg', 'wijk', 'baan', 'sluis', 'gang', 'kering',
].sort((a, b) => b.length - a.length);

/** "Jan Vethstraat" → "Jan Veth"; "Mozes en Aäronstraat" → "Mozes en Aäron"; undefined when there is no generic part. */
export function nameStem(name: string): string | undefined {
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  const suffix = GENERIC_SUFFIXES.find((candidate) => lower.endsWith(candidate) && lower.length > candidate.length);
  if (!suffix) return undefined;
  const stem = trimmed.slice(0, trimmed.length - suffix.length).replace(/[\s-]+$/, '');
  return stem.length >= 3 ? stem : undefined;
}

// Openings that already say what the text is about ("After the princely title…").
const CONNECTIVES = [
  'named after', 'so called', 'short for', 'in honour of', 'in honor of', 'after', 'named', 'called', 'refers', 'from',
  'the', 'a', 'an', 'its', 'this', 'these', 'dutch', 'means', 'meaning', 'literally', 'derived', 'probably', 'possibly',
  'originally', 'formerly', 'former', 'name', 'names', 'both', 'unknown', 'unclear', 'origin', 'reference', 'it',
  'before', 'previously', 'once', 'according', 'by', 'in', 'on', 'at', 'as', 'when', 'because', 'since', 'until', 'there', 'here', 'for', 'with', 'during', 'along', 'where',
];
// "Eerste", "Korte", "Oude": which of several streets, not who or what it is named after.
const QUALIFIERS = /^(eerste|tweede|derde|vierde|vijfde|korte|lange|oude|nieuwe|kleine|grote|binnen|buiten|hoge|lage|noordelijke|zuidelijke|oostelijke|westelijke|west|oost|noord|zuid)\s+/i;
const NOT_A_SUBJECT = new Set(['nieuw', 'nieuwe', 'oud', 'oude', 'kort', 'lang', 'breed', 'smal', 'hoog', 'laag', 'achter', 'voor', 'dwars', 'binnen', 'buiten', 'middel', 'zijl']);

/** Who or what a name is after: "Jan Vethstraat" → "Jan Veth", "Korte Geuzenstraat" → "Geuzen". */
export function nameSubject(name: string): string | undefined {
  let stem = nameStem(name);
  if (!stem) return undefined;
  while (QUALIFIERS.test(stem)) stem = stem.replace(QUALIFIERS, '');
  return stem.length >= 3 && !NOT_A_SUBJECT.has(stem.toLowerCase()) ? stem : undefined;
}
const flat = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Register prose that starts with its subject's description ("Painter and draughtsman
 * (1864-1925)…") gets the subject named first: "Jan Veth: Painter and draughtsman…". Text that
 * opens with a connective ("After…", "Named after…") or already names the subject is unchanged.
 */
export function withNamedSubject(name: string | undefined, text: string): string {
  if (!name) return text;
  const stem = nameSubject(name);
  if (!stem) return text;
  const opening = flat(text.trim());
  if (CONNECTIVES.some((word) => opening === word || new RegExp(`^${word}[\\s,:;'’]`).test(opening))) return text;
  if (!/^\p{L}/u.test(text.trim())) return text;
  // "Benno Stokvis" for "Benno Jules Stokvis (1901-1977)…": the surname is enough.
  const sentence = flat(firstSentence(text));
  // "Oostenburger" for "Oostenburg was the easternmost…": so is its root.
  const surname = flat(stem).split(/[\s.]+/).filter((word) => word.length >= 3).pop()?.replace(/[^a-z]/g, '');
  const root = surname && surname.length >= 6 ? surname.replace(/(er|se|sche|s)$/, '') : surname;
  if (sentence.includes(flat(stem)) || (root && new RegExp(`(^|[^a-z])${root}`).test(sentence))) return text;
  return `${stem}: ${text.trim()}`;
}

/** Strip what an IPA removal leaves behind: "(, lit. 'canal belt')" → "(lit. 'canal belt')", and empty "()". */
export function tidyLede(text: string): string {
  return text
    .replace(/\(\s*[,;]\s*/g, '(')
    .replace(/\s*\(\s*\)/g, '')
    .replace(/\s+([,.;])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** "<Name> (<kind>)", as `history.borrowedFrom` in neighborhood-history.json. */
const BORROWED_KINDS = ['waterway', 'street', 'park', 'bridge', 'square', 'landmark'] as const;
const BORROWED_PREFIX = new RegExp(`^([^:]{2,40}) \\((${BORROWED_KINDS.join('|')}) here\\): `);

/**
 * A history or lede taken from a canal, street, bridge or landmark in the area: the older data marks it with a
 * "Schinkel (waterway here): " prefix; newer data strips that and sets `borrowedFrom`.
 * Returns the text without the prefix and "Schinkel (waterway)".
 */
export function splitBorrowedHistory(text: string, borrowedFrom?: string): { text: string; borrowedFrom?: string } {
  const match = BORROWED_PREFIX.exec(text);
  if (match) return { text: text.slice(match[0].length), borrowedFrom: borrowedFrom || `${match[1]} (${match[2]})` };
  return { text, borrowedFrom: borrowedFrom || undefined };
}

/** "Orgelpark (landmark)" → { name: "Orgelpark", kind: "landmark" }. */
function parseBorrowed(borrowedFrom: string): { name: string; kind?: string; article: string } {
  const match = /^(.*?)\s*\((\w+)\)\s*$/.exec(borrowedFrom.trim());
  const name = (match?.[1] ?? borrowedFrom).trim();
  return { name, kind: match?.[2]?.toLowerCase(), article: /^(de|het|the)\s/i.test(name) ? '' : 'the ' };
}

/**
 * A lede about a landmark or street in the area rather than the area itself (`description.borrowedFrom`):
 * "Orgelpark (landmark)" → "About the Orgelpark, which is here".
 */
export function ledeHeading(borrowedFrom?: string): string | undefined {
  if (!borrowedFrom) return undefined;
  const { name, kind, article } = parseBorrowed(borrowedFrom);
  if (kind === 'street') return `About ${name}, which runs through here`;
  if (kind === 'waterway') return `About ${article}${name}, which runs through here`;
  if (kind === 'square' || kind === 'park') return `About ${name}, which is here`;
  return `About ${article}${name}, which is here`;
}

/** "Schinkel (waterway)" → "History of the Schinkel, which runs through here". */
export function historyHeading(borrowedFrom?: string): string {
  if (!borrowedFrom) return 'History';
  const { name, kind, article } = parseBorrowed(borrowedFrom);
  switch (kind) {
    case 'waterway': return `History of ${article}${name}, which runs through here`;
    case 'street': return `History of ${name}, which runs through here`;
    case 'bridge': return `History of ${article}${name}, a bridge here`;
    case 'square': return `History of ${name}, a square here`;
    case 'park': return `History of ${name}, a park here`;
    case 'landmark': return `History of ${article}${name}, which is here`;
    default: return `History of ${name}, nearby`;
  }
}

// Orientation POI categories and landmark types (public/data/extracts/amsterdam/orientation-pois.json,
// landmarks.json) that teach where you are, and those that are only commerce.
const PREFERRED_PLACE_KINDS = new Set(['landmark', 'museum', 'library', 'university', 'cinema', 'music venue', 'theatre', 'park',
  'square', 'station', 'school', 'church', 'market', 'culture', 'worship', 'education', 'civic', 'leisure']);
const COMMERCIAL_PLACE_KINDS = new Set(['shop', 'retail', 'food', 'bike', 'cafe', 'restaurant', 'bar']);

/** 0: a place worth naming, 1: neutral (hotels, clinics), 2: a shop, café or bike shop. */
export function placeKindTier(kind: string): 0 | 1 | 2 {
  if (PREFERRED_PLACE_KINDS.has(kind)) return 0;
  return COMMERCIAL_PLACE_KINDS.has(kind) ? 2 : 1;
}
