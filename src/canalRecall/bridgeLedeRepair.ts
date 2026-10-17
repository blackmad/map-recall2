// Repairs for what the on-device translator reliably gets wrong in Dutch
// Wikipedia bridge ledes (measured on the 365 translated bridge ledes,
// 2026-10-17). Each rule is a mistranslation of a fixed Dutch term, and a rule
// that needs the Dutch to be sure checks it, so the English stays a faithful
// rendering: nothing is added.
//
//   bouwkundig kunstwerk   "structural work of art" (41 ledes)    → "structure"
//   vaste brug             "permanent bridge" (60)                 → "fixed bridge"
//   welfbrug               "welf/welfare/well-built bridge"        → "vaulted bridge"
//   ophaalbrug             "pick-up/collection bridge"             → "drawbridge"
//   duiker(brug)           "diving board/bridge/platform"          → "culvert (bridge)"
//   demping / gedempt      "dampen", "dredged", "dammed"           → "fill in", "filled in"
//   uitleg                 "explanation"                           → "extension" (of the city)
//   Amsterdam-Noord/Oost/Zuid  "Amsterdam-North/East/South"        → the district's name
//   …brug, …kanaal         "Rozenoord Bridge", "Zuider Amstel Canal" → the name as written
//
// The Dutch source of a lede was cut at a fixed length, and so was the
// translation: a last sentence without its full stop is dropped.

/** Dutch canal names the translator turned into English. */
const CANAL_NAMES: ReadonlyArray<[RegExp, string]> = [
  [/\bZuider[- ]Amstel Canal\b/g, 'Zuider Amstelkanaal'],
  [/\bNoorder Amstel Canal\b/g, 'Noorder Amstelkanaal'],
  [/\bNorth Holland Canal\b/g, 'Noord-Hollandsch Kanaal'],
  [/\bWestern Market Canal\b/g, 'Westelijk Marktkanaal'],
  [/\bDischarge Canal\b/g, 'Lozingskanaal'],
  [/\bAmstel Canal\b/g, 'Amstelkanaal'],
];

const DISTRICTS: ReadonlyArray<[RegExp, string]> = [
  [/\bAmsterdam-North\b/g, 'Amsterdam-Noord'],
  [/\bAmsterdam-East\b/g, 'Amsterdam-Oost'],
  [/\bAmsterdam-South\b/g, 'Amsterdam-Zuid'],
  [/\bAmsterdam-Center\b/g, 'Amsterdam-Centrum'],
];

/** Abbreviations a cut lede can end on ("… by Balthasar Florisz."). */
const TRAILING_ABBREVIATION = /(?:\b[A-Z][a-z]*s?z\.|\b(?:Mr|Dr|Ir|St|Prof|ca|c)\.)$/;

/** Words a full stop follows without ending the sentence: initials
 *  ("Th. K. van Lohuizenlaan", "J.J."), titles and patronymics ("Florisz.
 *  van Berckenrode"). */
const NOT_A_SENTENCE_END = /(?:^|[\s(])(?:[A-Z][a-z]?|[A-Z]\.[A-Z]|Mr|Dr|Ir|St|Prof|ca|nr|no|[A-Z][a-z]*s?z)\.$/;

/** Sentences of an English lede (a split before a capital or a quote, not
 *  after an initial or an abbreviation). */
export function ledeSentences(text: string): string[] {
  const pieces = text.trim().split(/(?<=[.!?])\s+(?=[A-Z"'“‘(0-9])/u).filter(Boolean);
  const sentences: string[] = [];
  for (const piece of pieces) {
    const previous = sentences[sentences.length - 1];
    if (previous !== undefined && NOT_A_SENTENCE_END.test(previous)) sentences[sentences.length - 1] = `${previous} ${piece}`;
    else sentences.push(piece);
  }
  return sentences;
}

/** The lede without a trailing sentence the length cut left unfinished. */
export function dropUnfinishedSentence(text: string): string {
  const sentences = ledeSentences(text);
  while (sentences.length > 1) {
    const last = sentences[sentences.length - 1].trim();
    const finished = /[.!?]["”’)]?$/.test(last) && !TRAILING_ABBREVIATION.test(last);
    if (finished) break;
    sentences.pop();
  }
  return sentences.join(' ');
}

/** "Rozenoord Bridge" → "Rozenoordbrug" where the Dutch writes it so. */
function restoreBridgeNames(en: string, nl: string): string {
  const folded = nl.toLocaleLowerCase();
  return en.replace(/\b((?:[A-Z][\p{L}'’.-]*\s){1,4})Bridge\b/gu, (match, words: string) => {
    // "The Rozenoord Bridge": try the longest run of words the Dutch has.
    const parts = words.trim().split(/\s+/);
    for (let start = 0; start < parts.length; start++) {
      const name = `${parts.slice(start).join(' ')}brug`;
      const at = folded.indexOf(name.toLocaleLowerCase());
      if (at >= 0) return `${parts.slice(0, start).map(part => `${part} `).join('')}${nl.slice(at, at + name.length)}`;
    }
    return match;
  });
}

/** `dropUnfinished: false` leaves the cut last sentence for a reviewer's own
 *  fix to complete or remove. */
export function repairBridgeLede(en: string, nl: string, { dropUnfinished = true } = {}): string {
  let text = en;
  const has = (pattern: RegExp) => pattern.test(nl);
  if (has(/kunstwerk/i)) {
    text = text
      .replace(/\b(a|an) (?:structural|constructional) and artistic work of art\b/gi, (_, article: string) => `${article[0] === 'A' ? 'A' : 'a'} structure and a work of art`)
      .replace(/\b(?:a|an) (?:structural |constructional |building |architectural )?(?:work of art|art ?work|artwork)\b/gi, (match) => `${match[0] === 'A' ? 'A' : 'a'} structure`)
      .replace(/\b(two|all its|other) works of art\b/gi, '$1 structures')
      .replace(/\bWork of Art (\d+)/g, 'structure $1');
  }
  if (has(/\bvaste\b/i)) text = text.replace(/\bpermanent (bridges?|concrete bridge|viaduct)\b/gi, 'fixed $1');
  if (has(/welfbrug/i)) text = text.replace(/\b(?:welf|welfare|well-built|vault) bridge\b/gi, 'vaulted bridge');
  if (has(/ophaalbrug/i)) text = text.replace(/\b(?:pick-?up|collection) bridge\b/gi, 'drawbridge');
  if (has(/duiker/i)) {
    text = text
      .replace(/\bdiving bridge\b/gi, 'culvert bridge')
      .replace(/\bdiving boards\b/gi, 'culverts')
      .replace(/\b(?:a )?diving (?:board|platform)\b/gi, (match) => (match.startsWith('a ') ? 'a culvert' : 'culvert'));
  }
  if (has(/demp/i)) {
    text = text
      .replace(/\bto dampen the\b/g, 'to fill in the')
      .replace(/\b(?:was|were) (?:dredged|dammed|dampened)\b/g, (match) => `${match.split(' ')[0]} filled in`);
  }
  if (has(/uitleg/i)) text = text.replace(/\b(Third|Fourth|third|fourth)( and (?:third|fourth))? [Ee]xplanations?\b/g, (_, first: string, second = '') => `${first[0].toUpperCase()}${first.slice(1)}${second.replace(/(third|fourth)/, (word: string) => word[0].toUpperCase() + word.slice(1))} Extension${second ? 's' : ''}`);
  if (has(/negen straatjes/i)) text = text.replace(/\bthe Nine Streets\b/g, 'the Negen Straatjes');
  for (const [pattern, name] of CANAL_NAMES) text = text.replace(pattern, name);
  for (const [pattern, name] of DISTRICTS) text = text.replace(pattern, name);
  text = text.replace(/\bIjburg/g, 'IJburg');
  text = restoreBridgeNames(text, nl);
  return dropUnfinished ? dropUnfinishedSentence(text) : text;
}
