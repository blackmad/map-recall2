/**
 * Street-name origins from Amsterdam's own register.
 *
 * Every public space in the municipal BAG API (`openbareruimtes`) carries
 * `beschrijvingNaam`: the city's explanation of its name. It covers who a
 * person was ("Verzetsstrijder (1906-1943) …"), what a word means ("De
 * munteenheid van Italië."), which place or event is meant ("Den Briel werd in
 * 1572 …") and when a canal was filled. Measured 2026-09-29: 5,349 of 5,671
 * streets, 247 of 251 waters, 890 of 924 bridges.
 *
 * These are the decisions of the import (which records count, how names are
 * matched to the OSM extract, how the Dutch is cleaned), kept apart from the
 * fetch and the translator so they are tested without either.
 */

/** A current public-space record as the BAG API returns it (the fields used). */
export interface BagOpenbareRuimte {
  identificatie: string;
  naam: string;
  typeOmschrijving: string;
  beschrijvingNaam?: string | null;
  eindGeldigheid?: string | null;
  ligtInWoonplaatsId?: string | null;
}

export type OriginKind = 'street' | 'water' | 'bridge' | 'area';

/** One explained name, as staged for review and translation. */
export interface NameOrigin {
  bagId: string;
  name: string;
  kind: OriginKind;
  woonplaatsId: string | null;
  /** The municipality's Dutch explanation, whitespace-normalised. */
  nl: string;
  /** English, once translated; absent until then. */
  en?: string;
  /** How `en` was made, e.g. 'trn-high'. */
  enSource?: string;
}

/** The woonplaats of Amsterdam proper. Weesp (merged 2022) and Driemond carry
 *  their own ids and can repeat a name the city also uses. */
export const AMSTERDAM_WOONPLAATS_ID = '3594';

const KINDS: Record<string, OriginKind> = {
  Weg: 'street',
  Water: 'water',
  Kunstwerk: 'bridge',
  'Landschappelijk gebied': 'area',
};

export function originKind(typeOmschrijving: string): OriginKind | null {
  return KINDS[typeOmschrijving] ?? null;
}

/** Collapse whitespace and trim; the register has double spaces and trailing blanks. */
export function cleanDescription(text: string | null | undefined): string {
  return (text || '').replace(/\s+/g, ' ').trim();
}

/**
 * The key a BAG name and an OSM name are matched on. Case, curly apostrophes
 * ('s-Gravendijkdreef is written both ways), dashes and spacing differ between
 * the two; nothing else is forgiven, because a looser match would attach one
 * street's history to another.
 */
export function nameKey(name: string): string {
  return name
    .normalize('NFC')
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[‐-―]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('nl');
}

/** Current, explained records of a known kind, one per BAG id. */
export function originsFromRecords(records: readonly BagOpenbareRuimte[]): NameOrigin[] {
  const byId = new Map<string, NameOrigin>();
  for (const record of records) {
    if (record.eindGeldigheid) continue;
    const kind = originKind(record.typeOmschrijving);
    const nl = cleanDescription(record.beschrijvingNaam);
    if (!kind || !nl || !record.naam) continue;
    byId.set(record.identificatie, {
      bagId: record.identificatie,
      name: record.naam.trim(),
      kind,
      woonplaatsId: record.ligtInWoonplaatsId ?? null,
      nl,
    });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'nl') || a.bagId.localeCompare(b.bagId));
}

/** Which kinds may explain an extract feature of this kind, best first. A
 *  street named after a canal it replaced ("Rozengracht") is registered as a
 *  Weg; a bridge or lock the routing network carries as a named way ("Hein de
 *  Haanbrug", "Oranjesluizen") is registered as a Kunstwerk. */
const COMPATIBLE: Record<string, readonly OriginKind[]> = {
  street: ['street', 'area', 'bridge'],
  water: ['water', 'street', 'bridge'],
  bridge: ['bridge'],
};

/**
 * The origin for an extract feature, or null. Prefers the same kind, then
 * Amsterdam proper over Weesp, and refuses a name that two different
 * explanations still share after that: better no card than the wrong person.
 */
/**
 * A card cannot follow "See Boomgaardlaan.", so a trailing cross-reference
 * goes, and so does register index noise glued to the end of a text
 * ("Blancplein, Mont See Mont."). An origin that is nothing but a
 * reference comes back as `{ see }` for the caller to resolve.
 */
export function withoutCrossReference(en: string): { text: string; see?: string } {
  const text = en.trim()
    // Index noise: "Name, Prefix See Prefix." / "Name, Prefix Zie Prefix."
    .replace(/\s+[A-Z][\p{L}'-]*,\s+[A-Z][\p{L}'-]*\s+(?:See|Zie)\s+[A-Z][\p{L}'-]*\.?$/u, '')
    .trim();
  const only = /^(?:See|Zie)\s+(?:further\s+|also\s+)?(.+?)\.?$/i.exec(text);
  if (only) return { text: '', see: only[1].trim() };
  const stripped = text
    .replace(/(^|\.\s+)(?:See|Zie)\s+(?:there|aldaar)\.?(?=\s|$)/gi, '$1')
    .replace(/(^|\.\s+)(?:See|Zie)\s+(?:further\s+|also\s+)?[A-Z][^.]*\.(?=\s+\S)/g, '$1')
    .replace(/\s+(?:See|Zie)\s+(?:further\s+|also\s+)?[^.]+\.?$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { text: stripped || text };
}

export function refersToItself(origin: Pick<NameOrigin, 'name' | 'nl'>): boolean {
  const name = origin.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\bzie\\s+(?:verder\\s+)?${name}\\b`, 'i').test(origin.nl);
}

export function originFor(
  index: ReadonlyMap<string, readonly NameOrigin[]>,
  name: string,
  featureKind: 'street' | 'water' | 'bridge',
): NameOrigin | null {
  // A record that sends the reader to its own name ("zie Oudezijds
  // Voorburgwal" on the Oudezijds Voorburgwal) is another street's text
  // filed under this one: the register's street record for the Oudezijds
  // Voorburgwal is a copy of the Nieuwezijds one.
  const candidates = (index.get(nameKey(name)) ?? [])
    .filter(origin => COMPATIBLE[featureKind].includes(origin.kind) && !refersToItself(origin));
  if (!candidates.length) return null;
  const ranked = [...candidates].sort((a, b) =>
    COMPATIBLE[featureKind].indexOf(a.kind) - COMPATIBLE[featureKind].indexOf(b.kind)
    || Number(b.woonplaatsId === AMSTERDAM_WOONPLAATS_ID) - Number(a.woonplaatsId === AMSTERDAM_WOONPLAATS_ID));
  const best = ranked[0];
  const rivals = ranked.filter(origin => origin.kind === best.kind && origin.woonplaatsId === best.woonplaatsId);
  if (new Set(rivals.map(origin => origin.nl)).size > 1) return null;
  return best;
}

export function indexOrigins(origins: readonly NameOrigin[]): Map<string, NameOrigin[]> {
  const index = new Map<string, NameOrigin[]>();
  for (const origin of origins) {
    const key = nameKey(origin.name);
    (index.get(key) ?? index.set(key, []).get(key)!).push(origin);
  }
  return index;
}

/**
 * Repair what the on-device translator reliably gets wrong in this register
 * (measured on the 2026-09-29 run of 5,203 texts):
 * - `gedempt` (a canal filled in) came out as "muted", "silenced" or
 *   "suppressed" in 10 of 55 texts: "The Rozengracht was suppressed in 1895";
 * - a bare year after `voor` read as a clock time: "even voor 1600" became
 *   "just before 4:00 p.m.";
 * - council-decision references (`Rb. 26-1-1922`) are register shorthand, and
 *   an unfinished one trails some texts as junk ("Oud-Zuid Rb. 26-1-1922 15: m 9").
 */
/** Dutch that really does mean what a "filled in" mistranslation says. */
const FILLED_IN_GUARDS: Record<string, RegExp> = {
  straightened: /recht/i, canalized: /kanalis/i, flooding: /overstro|inundat|onder water/i,
  flattened: /geslecht|afgegraven|gesloopt/i, flattening: /geslecht|afgegraven|gesloopt/i, dammed: /afgedamd|afdamm/i,
  demoted: /gedegradeerd/i, demotion: /degrad/i,
};

/** [Dutch trigger, literal translation, meaning]. From reading the
 *  published texts: a lijnbaan is a ropewalk, not a "line track". */
const ORIGIN_GLOSSARY: ReadonlyArray<[RegExp, RegExp, string]> = [
  [/touwslager/i, /\brope warehouses\b/g, 'rope-making works'],
  [/touwslager/i, /\brope warehouse\b/g, 'rope-making works'],
  [/lijnban/i, /\bline tracks\b/g, 'ropewalks'],
  [/lijnban/i, /\bline track\b/g, 'ropewalk'],
  [/stadsuitleg/i, /\bcity layout\b/g, 'city expansion'],
  [/zangzaad/i, /\bsinging seed\b/g, 'birdseed'],
  [/regenten/i, /\bregency families\b/g, 'regent families'],
  [/schepen van de stad/i, /\bcaptain of the city\b/g, 'alderman (schepen) of the city'],
  [/burgemeester van/i, /\bBurgemeester van\b/g, 'Mayor of'],
  [/voor de stadsuitleg/i, /\bFor the city (?:tour|layout|expansion)\b/g, 'Before the city expansion'],
  [/stadsuitleg/i, /\bcity tour\b/g, 'city expansion'],
  // A uitleg of the city is an expansion, not an explanation (Herengracht:
  // "the part beyond the Leidsegracht belongs to the expansion of 1658").
  [/\buitleg (?:van|in) 1\d{3}|(?:eerste|tweede|derde|vierde|deze) uitleg/i, /\bexplanation\b/g, 'expansion'],
  [/overwelv|overkluis/i, /\bfilling in and filling in\b/g, 'filling in and vaulting over'],
  [/kloveniers werd genoemd/i, /a part of the artillery that was called crossbowmen, after the firearm used by the men, a field snake/,
    'a company of the civic guard called the kloveniers, after the firearm its men carried, the klover or culverin'],
  [/schutters- en regentenstukken/i, /\bsoldier and regent portraits\b/g, "civic guard and regents' group portraits"],
  [/schuttersstuk/i, /\b(?:hunting scenes|gunfight scenes|shooting pieces)\b/g, 'civic guard portraits'],
  [/kuiperij/i, /\bbrewery\b/g, 'cooperage'],
  [/dijkgraaf/i, /\bdam engineer\b/gi, 'dike reeve'],
  [/dijk- of waterschap/i, /\bdam or water board\b/g, 'dike or water board'],
  [/schout-bij-nacht/i, /\b(?:night commander|lieutenant-governor)\b/g, 'rear admiral'],
  [/stadhouderschap/i, /\bgovernorship\b/g, 'stadtholdership'],
  [/volkstuinder/i, /\bVegetable Growers\b/g, 'Allotment Gardeners'],
  [/steigers/i, /\bscaffolding\b/g, 'jetties'],
  // Herengracht: the Heren Regeerders were the city's ruling regents, and
  // the aside contrasts being governed with being ruled.
  [/regentenstuk/i, /\bregency portraits\b/g, "regents' group portraits"],
  [/eerste kamer/i, /\bHouse of Lords\b/g, 'Senate (Eerste Kamer)'],
  [/koninkrijkszaken/i, /\broyal affairs\b/g, 'Kingdom relations'],
  [/schutterij/i, /\bshooting club\b/g, 'civic guard'],
  [/geweren of kloveren/i, /\brifles or crossbows\b/g, 'firearms (klovers, or arquebuses)'],
  [/slaperdijk/i, /\bsleeping wall\b/g, 'sleeper dike (a reserve dike behind the front line)'],
  [/lijnbaan/i, /\bLinebaan/g, 'Lijnbaan'],
  [/voorburgwal/i, /\bForeburgwal\b/g, 'Voorburgwal'],
  [/waalse kerk/i, /\bOld Wall Church\b/g, 'Oude Waalse Kerk (the old Walloon Church)'],
  [/deel uitmaakte van deze burgwal/i, /\bpart of this city wall\b/g, 'part of this canal'],
  [/heren regeerders/i, /\bLords Regulators\b/g, 'ruling lords (Heren Regeerders)'],
  [/niet bestuurd, maar geregeerd/i, /\(The city was not previously governed, but ruled\)/, '(in those days the city was not governed but ruled)'],
  // Outright mistranslations that taught something false: a plum is not a
  // pear, sparrows are not finches' parents, and a pheasant is no chicken.
  [/pruimenboom/i, /\bpear tree\b/g, 'plum tree'],
  // Amsterdam annexed Nieuwer-Amstel, Watergraafsmeer and Sloten and took
  // their streets over; "van de gemeente X overgenomen" is taken over *from*
  // X, not by it (Vondelkerkstraat, Jacob Obrechtstraat).
  [/van de gemeente .{0,40}overgenomen/i, /\btaken over by the municipality of\b/g, 'taken over from the municipality of'],
  // English names for Dutch history: the Anglo-Dutch Wars, the Battle of the
  // Downs (Duins, 1639), the Geuzen, Zeeland's admirals, and a wethouder.
  [/engelse oorlog/i, /\b(First|Second|Third|Fourth) English War\b/g, '$1 Anglo-Dutch War'],
  [/duins/i, /\b[Bb]attle of Duins\b/g, 'Battle of the Downs'],
  [/duins/i, /\bat Duins\b/g, 'at the Downs (Duins)'],
  [/geuzen/i, /\bconquered by the Gueux on the Spaniards\b/g, 'taken from the Spanish by the Geuzen'],
  [/geuzen/i, /\bGueux\b/g, 'Geuzen'],
  [/zeeuws/i, /\bZeelandish\b/g, 'Zeeland'],
  [/wethouder/i, /\bWethouder for\b/g, 'Alderman for'],
  // More that taught something false: a pont is a ferry, the watergeuzen
  // were the Sea Beggars, gelei is jelly, Grotius escaped in a book chest,
  // and the Wetering flowed into the Spui, not out of it.
  [/-pont\b/i, /\b(\w+) bridge was therefore renamed\b/g, '$1 ferry was therefore renamed'],
  [/watergeuzen/i, /\bwater gunners\b/g, 'Sea Beggars (watergeuzen)'],
  [/geleihulsel/i, /\byellowish sheath\b/g, 'a jelly sheath'],
  [/schiere monniken/i, /\bgray or semi-monks\b/g, 'grey (schiere) monks'],
  [/boekenkist/i, /\bthrough a bookcase\b/g, 'in a book chest'],
  [/hulppersoneel/i, /\baid workers\b/g, 'domestic staff'],
  [/in het Spui uitmondde/i, /\bflowed out of the Spui from the outside\b/g, 'flowed into the Spui from outside the city'],
  [/\bborgen\b/i, /\bGroninger castles \(castles\)/g, 'Groningen castles (borgen)'],
  [/natuur-? ?en scheikundige/i, /\bnatural and chemist\b/g, 'physicist and chemist'],
  [/zeevaart-, wis- en sterrenkundige/i, /\bMaritime, scientific and astronomical\b/g, 'Navigation expert, mathematician and astronomer'],
  [/letterkundige/i, /\bLiterary(?= \(|,| and)/g, 'Man of letters'],
  [/werelddeel/i, /\bworld region\b/g, 'continent'],
  [/zangvogel/i, /\b[Ss]inging bird\b/g, 'songbird'],
  // Grammar the translator gets wrong before a vowel.
  [/./, /\ba (?=(?:inn|embankment|alderman|island|estate|old|important|admiral|officer|engineer|author|actor|actress|architect|artist|area|order|eighteenth|eleventh|inland|English|Amsterdam)\b)/g, 'an '],
  [/tot de vinken behorende/i, /\bbelonging to the sparrows\b/g, 'belonging to the finches'],
  [/^de hoender\.?$/i, /^The chicken\.?$/, 'The fowl.'],
];

/** Classes an origin may name alone ("The shrub."), as the card says them. */
const GENERIC_CLASSES = new Set([
  'shrub', 'deciduous tree', 'tree', 'singing bird', 'bird', 'water bird', 'meadow bird', 'bird of prey',
  'bird family', 'fruit', 'citrus fruit', 'plant', 'flower', 'climbing shrub', 'climbing plant',
  'ornamental shrub', 'ornamental plant', 'plant family', 'freshwater fish', 'constellation', 'fowl',
  'gardening tool', 'tool', 'ship part', 'south european ornamental tree',
]);

/** The word a street is named after: "Tweede Egelantiersdwarsstraat" → "egelantier". */
export function nameStem(name: string): string {
  const base = name.replace(/^(Eerste|Tweede|Derde|Vierde|Korte|Lange|Nieuwe|Oude|Kleine|Grote)\s+/, '').split(/\s+/).pop() ?? '';
  const stem = base.toLowerCase()
    .replace(/(dwarsstraat|straatje|straat|gracht|weg|laan|plein|kade|pad|hof|brug|steeg|dijk|park|plantsoen|singel|dreef)$/, '');
  return stem.length > 4 ? stem.replace(/s$/, '') : stem;
}

/**
 * An origin that only names the class — "De heester." for the
 * Egelantiersgracht — says nothing unless the rider knows what an egelantier
 * is. With the stem's meaning from a reviewed glossary it teaches the name:
 * "Named after the eglantine (sweet briar), a shrub." Anything that is not a
 * bare class, or a stem the glossary lacks, is left alone.
 */
export function nameGenericOrigin(name: string, en: string, stems: Readonly<Record<string, string>>): string {
  const match = /^(?:The|Named after the)\s+([a-z ]+?)\.?$/i.exec(en.trim());
  const thistle = /^thistle species\.?$/i.test(en.trim());
  const word = stems[nameStem(name)] ?? stems[`${nameStem(name)}s`];
  if (!word || (!thistle && !(match && GENERIC_CLASSES.has(match[1].toLowerCase())))) return en;
  if (thistle) return `Named after the ${word}, a thistle.`;
  // One gull is not a family: the family names the kind of thing it is.
  // The class keeps its own casing: "South European ornamental tree".
  const kind = match![1].replace(/ family$/, '');
  return `Named after the ${word}, ${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind}.`;
}

export function repairOriginTranslation(nl: string, en: string): string {
  let text = en;
  // An unfinished register note after the last full sentence: drop it.
  // A reference is `Rb.`, perhaps the former municipality that decided
  // (Nieuwer-Amstel, Sloten, Watergraafsmeer), and a date.
  const reference = String.raw`Rb\.?\s*(?:of\s+)?(?:([A-Za-z][\w'-]*(?:[ -][A-Za-z][\w'-]*)?)\s+)?\d{1,2}-\d{1,2}-(\d{4})`;
  // "Unfinished" = nothing after the date ends in a sentence stop.
  const note = new RegExp(reference).exec(text);
  if (note && !/[.!?]["')]?$/.test(text.slice(note.index + note[0].length).trim())) {
    const before = text.slice(0, note.index);
    const stop = Math.max(before.lastIndexOf('. '), before.lastIndexOf('! '), before.lastIndexOf('? '));
    if (stop >= 0) text = before.slice(0, stop + 1);
  }
  const decided = (council: string | undefined, year: string) =>
    council ? `council decision of ${council}, ${year}` : `council decision, ${year}`;
  text = text
    .replace(new RegExp(String.raw`\(\s*${reference}\s*\)`, 'g'), (_, council, year) => `(${decided(council, year)})`)
    .replace(new RegExp(String.raw`\b(by|at|with|in)\s+${reference}`, 'gi'),
      (_, preposition: string, _council, year) => `${preposition[0] === preposition[0].toUpperCase() ? 'By' : 'by'} council decision in ${year}`)
    .replace(new RegExp(reference, 'g'), (_, council, year) => decided(council, year));
  if (/gedempt|dempen|demping/i.test(nl)) {
    // Filling in a canal (dempen) comes out as muting, damping, demoting,
    // flattening, straightening, even flooding: the opposite. A rendering is
    // kept where the Dutch has its own word for it (recht, overstroming…).
    const guarded = (word: string) => !FILLED_IN_GUARDS[word.toLowerCase()]?.test(nl);
    const keepCase = (found: string, replacement: string) =>
      found[0] === found[0].toUpperCase() ? replacement[0].toUpperCase() + replacement.slice(1) : replacement;
    text = text
      .replace(/\b(muted|silenced|suppressed|dampened|damped|muffled|dammed|demoted|flattened|straightened|canalized)\b/gi,
        found => guarded(found) ? keepCase(found, 'filled in') : found)
      .replace(/\b(dampening|damping|damming|demotion|flattening|flooding|muting)\b/gi,
        found => guarded(found) ? keepCase(found, 'filling in') : found);
  }
  // Trade and planning words the translator takes literally. Each applies
  // only where the Dutch says the word, so an English "layout" elsewhere stays.
  // A schans is an earthen rampart; a bastion is a bolwerk. Only where the
  // Dutch never says bolwerk (Oudeschans: "A bastion is an earthen wall").
  if (/schans/i.test(nl) && !/bolwerk|bastion/i.test(nl)) {
    text = text.replace(/\bbastions\b/g, 'ramparts').replace(/\bbastion\b/g, 'rampart').replace(/\bBastion\b/g, 'Rampart');
  }
  for (const [dutch, wrong, right] of ORIGIN_GLOSSARY) {
    if (dutch.test(nl)) text = text.replace(wrong, right);
  }
  if (!/\d{1,2}[:.]\d{2}\s*uur|\d{1,2}:\d{2}/.test(nl)) {
    const missingYears = [...new Set(nl.match(/\b1[0-9]{3}\b/g) ?? [])].filter(year => !text.includes(year));
    if (missingYears.length === 1) {
      text = text.replace(/\b\d{1,2}:\d{2}\s*[ap]\.m\./, missingYears[0]);
    }
  }
  return text.replace(/\s{2,}/g, ' ').trim();
}
