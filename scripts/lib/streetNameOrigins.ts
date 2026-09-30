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
  // More renderings of lijnbaan (a ropewalk): lineways, line railways,
  // neighbouring railway lines, a canal line.
  [/lijnban/i, /\b(?:lineways|line railways|railway lines)\b/g, 'ropewalks'],
  [/lijnbaan liet bouwen/i, /\bshipyard and canal line\b/g, 'shipyard and ropewalk'],
  [/lakenramen/i, /\bThe linen windows, which were moved here, were drawn into the city during the enlargements of the city in the sixteenth century when\b/g,
    'The lakenramen (tenter frames for stretching cloth) were moved here during the sixteenth-century enlargements, when'],
  [/lakenramen/i, /\blinen windows\b/g, 'lakenramen (tenter frames for stretching cloth)'],
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
  // Rooien van de straten is laying them out, not demolishing them; a tuiger
  // rigs ships; the schout was the sheriff; Wereldbeker is the
  // Intercontinental Cup, which Ajax won, not the World Cup.
  [/rooien van de straten/i, /\bThe demolition of the streets and buildings began\b/g, 'Laying out the streets and building began'],
  [/openbaar verkeer onttrokken/i, /\bremoved from public transport\b/g, 'closed to public traffic'],
  [/op- en aftuigt/i, /\bhoists and lowers ships\b/g, 'rigs and unrigs ships'],
  [/schout van amsterdam/i, /\bthe alderman of Amsterdam\b/g, 'the schout (sheriff) of Amsterdam'],
  [/wereldbeker/i, /\bwinner World Cup\b/g, 'winner Intercontinental Cup (Wereldbeker)'],
  [/advocaat en procureur/i, /\blawyer and prosecutor\b/g, 'lawyer and solicitor (procureur)'],
  [/noordse bos/i, /\bNorth Sea Forest\b/g, 'Noordse Bos'],
  [/rode is een oude benaming/i, /\bRed is an old term\b/g, 'Rode is an old term'],
  [/werkwoord rooien/i, /\bthe still existing verb rake\b/g, 'the still existing verb rooien (to grub up)'],
  [/papiaments/i, /\bPapiaments\b/g, 'Papiamento'],
  // Indisch is of the Dutch East Indies, though Indische muziek and Indische
  // talen can be Indian: each fix names its own phrase.
  [/west-indische compagnie/i, /\bWest Indian Company\b/g, 'West India Company'],
  [/indisch recht/i, /\bIndian law\b/g, 'the law of the Dutch East Indies'],
  [/indische spoorwegen/i, /\bthe Indian railways\b/g, 'the railways of the Dutch East Indies'],
  [/indische verhalen/i, /\bIndian stories\b/g, 'stories of the Dutch East Indies'],
  [/indische partij/i, /\bIndian Party\b/g, 'Indische Partij (Indies Party)'],
  [/raadpensionaris/i, /\b[Cc]ouncil pensionary\b/g, 'Grand Pensionary'],
  [/is de boezem van een polder/i, /\bA canal is the bosom of a polder\b/g, 'A ring canal (ringvaart) is the storage basin (boezem) of a polder'],
  [/turfschepen|turfschuit/i, /\bturf (ships|boats|barges)\b/g, 'peat $1'],
  [/^de hof, gesticht/i, /^The court, founded\b/, 'The court (hof), founded'],
  [/schermbloem/i, /\bscreen ?flower family\b/gi, 'umbellifer (carrot) family'],
  [/rietlanden/i, /\breedlands\b/g, 'reed beds'],
  // Jhr. is jonkheer, a title of the untitled nobility, not "Mr."; a
  // griffier is a clerk; a thesaurier was the city's treasurer.
  [/^Jhr\.\s/, /^Mr\. /, 'Jonkheer '],
  [/^Griffier van/, /^Treasurer of\b/, 'Clerk (griffier) of'],
  [/thesaurier/i, /\bThesaurus of\b/g, 'Treasurer of'],
  [/jaren 1860-'61/, /\bin the 1860s-'61\b/g, 'in 1860–61'],
  [/\(Rb\. [\d-]+ en [\d-]+\)/, /\(council decision, (\d{4}) and \d{1,2}-\d{1,2}-(\d{4})\)/g, '(council decisions, $1 and $2)'],
  // An error in the register itself: Vancouver lived 1757–1798.
  [/George Vancouver \(1758-1790\)/, /George Vancouver \(1758-1790\)/g, 'George Vancouver (1757-1798)'],
  // Water-board offices: a hoofdingeland sits on a polder board, and a
  // hoogheemraadschap is a regional water authority. An overtoom hauled boats
  // over a dam; it was no quay.
  [/hoofdingeland/i, /\bthe head country of\b/g, 'a board member (hoofdingeland) of'],
  [/hoogheemraadschap/i, /\bthe High Authority for Waters\b/g, 'the regional water authority (hoogheemraadschap)'],
  [/^Hoogheemraadschap in/, /^High Council in\b/, 'Regional water authority (hoogheemraadschap) in'],
  [/de overtoom was/i, /\bThe quay was\b/g, 'The overtoom (a slipway for hauling boats over a dam) was'],
  [/vijfsprong/i, /\ba five-branching canal system\b/g, 'a five-way junction of canals'],
  [/buitenlandredacteur/i, /\bforeign correspondent\b/g, 'foreign editor'],
  // Verongelukken is dying in an accident; the source does not say a car.
  [/verongelukte/i, /\bwas killed in a car accident\b/g, 'died in an accident'],
  // Zakelijk in a style is objective (Nieuwe Zakelijkheid), a vonder is a
  // plank footbridge, boerengeneraals were Boer generals, a buiten in
  // Voorburg is a country house there, and verbasterd is corrupted.
  [/expressief zakelijk realisme/i, /\bExpressive Business Realism\b/g, 'Expressive Objective Realism (Expressief Zakelijk Realisme)'],
  [/krachtigste vrouw in de nederlandse schilderkunst/i, /\bthe most powerful woman in Dutch painting\b/g, 'the most forceful woman in Dutch painting'],
  [/vonder is een/i, /\bA viaduct is a narrow wooden connection\b/g, 'A vonder is a narrow wooden footbridge'],
  [/uitloper van de rivier/i, /\bthe outcrop of the\b/g, 'the branch of the'],
  [/boerengeneraal/i, /\b[Ff]armer (generals?)\b/g, 'Boer $1'],
  [/bij zijn leven vernoemd/i, /\bHe was still named after him during his lifetime\b/g, 'The street was named after him in his lifetime'],
  [/zijn buiten in/i, /\bhis house outside\b/g, 'his country house in'],
  [/verbasterde/i, /\bSimplified spelling\b/g, 'Corrupted spelling'],
  [/volkssport/i, /\bsailing as a folk sport\b/g, 'sailing as a sport for everyone'],
  // A zoutkeet is a salt shed, a zwaardwalvis the killer whale, fonteinkruid
  // pondweed; and the translator renamed Betondorp.
  [/zoutketen/i, /\bthe salt chain\b/g, 'the zoutketen (salt sheds)'],
  [/zwaardwalvis/i, /\bAlso known as swordfish\b/g, 'Also known as the killer whale (zwaardwalvis)'],
  [/betondorp/i, /\bBetonstad\b/g, 'Betondorp'],
  [/fonteinkruid/i, /\bfountain herb\b/gi, 'pondweed (fonteinkruid)'],
  [/eleaten/i, /\bthe main of the school of the Eleates\b/g, 'the foremost of the Eleatic school'],
  [/stoombootdienst op Amsterdam/i, /\bsteamboat service on Amsterdam\b/g, 'steamboat service to Amsterdam'],
  // "Kasteel onder Mill" lies near (in the jurisdiction of) Mill, not under
  // it; only after a place word, so "vice-admiral under De Ruyter" stays.
  [/\bonder [A-Z]/, /\b((?:[Cc]astle|[Hh]ouse|[Ff]arm(?:house)?|[Mm]anor(?: house)?|[Ee]state|reserve|[Mm]ill|[Hh]omestead|[Hh]amlet(?: of [A-Z][\w ]+?)?|[Ll]ocated|[Ss]ituated|lying|seat|ruin|[Cc]ourt|[Vv]illa|[Vv]illage|[Nn]eighbou?rhood|[Bb]ridge over the [\w ]+?|[Rr]idderhofstad|[Bb]uitenplaats|on the Vecht|[Mm]eadow along the [\w ]+?|Bos),?) under (?=[A-Z])/g, '$1 near '],
  // An alderman is not a member of parliament; a street that came over under
  // a name was not renamed to it; illegaal geworden is outlawed; a wiegbrug
  // rocks, it does not swing; an achtste finale is the round of 16.
  [/namens de pvda wethouder/i, /\ba member of parliament for the PVDA as a councillor for\b/g, 'alderman for the PvdA, responsible for'],
  [/overgekomen/, /\bThe street has been renamed (\w+) from the former municipality of ([\w-]+)/g, 'The street came over from the former municipality of $2 under the name $1'],
  [/vloeistaal/i, /\bmolten metal\b/g, 'mild (Bessemer) steel'],
  [/illegaal geworden/i, /\billegally established\b/g, 'outlawed'],
  [/fractievoorzitter/i, /\bfaction (?:chairman|leader)\b/g, 'parliamentary leader'],
  [/fractie/i, /\bleader of the (\w+) faction\b/g, 'parliamentary leader of the $1'],
  [/wiegbrug is/i, /\bA swing bridge is a roller bascule bridge\b/g, 'A wiegbrug (rocking bridge) is a rolling bascule bridge'],
  [/achtste finale/i, /\bthe eighth final\b/g, 'the round of 16'],
  [/nederlandse antillen/i, /\bDutch Antilles\b/g, 'Netherlands Antilles'],
  [/diaconessen/i, /\bSisters' Institution\b/g, "Deaconesses' Institution"],
  [/diaconessen/i, /\bSisters Institution\b/g, "Deaconesses' Institution"],
  [/de diaconessen/i, /\bThe Sisters\b/g, 'The deaconesses'],
  [/westelijke tuinsteden/i, /\bwestern garden towns\b/g, 'Western Garden Cities (westelijke tuinsteden)'],
  [/brede school/i, /\ba large school\b/g, 'a community school (brede school)'],
  [/de uitweg/i, /\bThe Exit\b/g, 'The Uitweg'],
  [/door de annexatie van sloten in amsterdam te liggen/i, /\bcame to be located due to the annexation of Sloten in Amsterdam\b/g, 'came within Amsterdam with the annexation of Sloten'],
  [/weer tot water werd gegraven/i, /\bwhich was dredged back into the water after repeated dryings for the purpose of sand mining\b/g, 'which, after being drained more than once, was dug out again into a lake for sand extraction'],
  // Gedempt is filled in, not renamed or drowned; a rechter verdediger plays
  // right back; Europa Cup Landskampioenen is the European Cup; a klap is a
  // drawbridge leaf.
  [/Amstelgrachtje, gedempt in 1866/, /\brenamed in 1866\b/g, 'filled in in 1866'],
  [/voor de demping/i, /\) for filling in\./g, ') before it was filled in.'],
  [/gedempte/i, /\b[Dd]rowned\b/g, 'filled-in'],
  [/oude looierssloot/i, /\bOld Tanneries Canal\b/g, 'Oude Looierssloot'],
  [/nieuwe looierssloot/i, /\bNieuwe Tanneries Canal\b/g, 'Nieuwe Looierssloot'],
  [/rechter verdediger/i, /\blawyer and defender\b/g, 'right back'],
  [/^(?![\s\S]*Bekerwinnaars)[\s\S]*Europa ?Cup (?:voor )?Landskampioenen/, /\bEuropean Cup Winners' Cup\b/g, 'European Cup'],
  [/ophaalbrug met 1 klap/i, /\ba 1-fold lifting bridge\b/g, 'a single-leaf drawbridge'],
  [/'magere brug'/i, /'Magere bridge'/g, "'Magere brug' (skinny bridge)"],
  [/jaren 1940-45/, /\bin the 1940s-45s\b/g, 'from 1940 to 1945'],
  [/verdwenen tevens/i, /\bThis widening also disappeared\b/g, 'This widening also did away with'],
  [/om het plan met deze straat vier kerken te verbinden/i, /\bwas named so to connect the plan with this street to four churches\b/g,
    'was so named for the plan to link four churches with this street'],
  [/tweede kamer/i, /\bSecond Chamber(?: of Representatives)?\b/g, 'House of Representatives (Tweede Kamer)'],
  [/derde looiersdwarsstraat/i, /\bThird (?:Looiersdwarsstraat|Tanneriesdwarsstraat|Tanner Cross Street)\b/g, 'Derde Looiersdwarsstraat'],
  [/oude looierssloot/i, /\bOld Tann\w+ (?:Canal|Ditch)\b/g, 'Oude Looierssloot'],
  [/tekenmachine/i, /\bTypewriter controlled by a computer\b/g, 'Drawing machine controlled by a computer'],
  [/de stad danzig/i, /\bThe city of Gdańsk \(now Gdansk\)/g, 'The city of Danzig (now Gdańsk)'],
  [/het wassende water/i, /'The flowing water'/g, "'Het wassende water' (The Rising Water)"],
  [/verhoogde halsgevel/i, /\bthe raised gable\b/g, 'the raised neck gable'],
  [/oost-indië/i, /\bto East India\b/g, 'to the East Indies'],
  [/verbonden edelen/i, /\bthe allied nobles\b/g, 'the Confederated Nobles (verbonden edelen)'],
  // Errors in the register itself. Bergen-Belsen and Buchenwald were
  // concentration camps, not extermination camps (Sobibor and Treblinka were); the Trippenhuis was Justus Vingboons's design.
  [/vernietigingskamp bergen[- ]belsen/i, /\bBergen-Belsen extermination camp\b/g, 'Bergen-Belsen concentration camp'],
  [/vernietigingskamp buchenwald/i, /\bextermination camp Buchenwald\b/g, 'concentration camp Buchenwald'],
  [/hij bouwde onder meer het trippenhuis/i, /\bHe built, among other things, the Trippenhuis and many beautiful canal houses\b/g,
    'He built many fine canal houses (the Trippenhuis, often credited to him, was designed by his brother Justus)'],
  // The vroedschap was the city council; the translator heard vroedvrouw (midwife).
  [/vroedschapsresolutie/i, /\b[Aa] maternity resolution\b/g, 'a resolution of the city council (vroedschap)'],
  // Opposites and near-misses: pretentieloos is unpretentious; a trilhaardier
  // is a ciliate; a verspieder a spy; a loopfiets the pedal-less draisine
  // that Lallement put pedals on; a grietman a Frisian magistrate.
  [/pretentieloze/i, /\bthe pretentious\b/g, 'the unpretentious'],
  [/trilhaardier/i, /\btrilobite\b/g, 'ciliate (trilhaardier)'],
  [/verspieder/i, /\bLiterally: wastrel, also known as lookout\b/g, 'Literally: spy (verspieder), or gun sight (vizier)'],
  [/loopfiets/i, /\ba passing tricycle\b/g, 'a passing draisine (a running machine without pedals)'],
  [/grietman/i, /\bgreaveman\b/g, 'grietman (district magistrate)'],
  [/kaasachtige vruchtvorm/i, /\bthe somewhat cheesy fruit shape\b/g, 'its fruit, shaped somewhat like a small round cheese'],
  [/kinderwagenbouwer/i, /\ba stroller builder\b/g, 'a maker of prams'],
  [/uithangt/i, /\bwhere Swanenburg hangs out\b/g, 'where the sign of Swanenburg hangs'],
  [/havenkom/i, /\bharbor bowls\b/g, 'harbour basins'],
  // The register writes atoomtemperatuur; the Dulong–Petit law is about the
  // heat capacity per atom (atoomwarmte).
  [/atoomtemperatuur/i, /\bthe atomic temperature is the same\b/g, 'the heat capacity per atom is about the same'],
  // Flax was hackled (combed), not bleached; Heer Halewijn murdered women; a
  // schuttersvaandrig carried the civic guard's standard; a kaatsbaan is a
  // court for kaatsen; the author H.J. Schimmel is no mould.
  [/gehekeld/i, /\bthe flax was bleached\b/g, 'the flax was hackled (combed out)'],
  [/vrouwenmoordenaar/i, /\ba female murderer who is herself murdered\b/g, 'a murderer of women who is himself killed'],
  [/schuttersvaandrig/i, /\bas a sharpshooter\b/g, 'as an ensign (standard-bearer) of the civic guard'],
  [/kaatsbaan/i, /\bis a billiards hall\b/g, 'is a kaatsbaan (a court for the ball game kaatsen)'],
  [/kaatsbaan/i, /\bThis billiards hall\b/g, 'This court'],
  [/h\.j\. schimmel/i, /\bH\.J\. mould\b/g, 'H.J. Schimmel'],
  [/\boneven\b/i, /\bthe uneven side\b/g, 'the odd-numbered side'],
  [/illegaliteit/i, /\bthe illegality\b/g, 'the resistance (illegaliteit)'],
  [/op hoop van zegen/i, /'In the hope of blessing'/g, "'Op hoop van zegen' (The Good Hope)"],
  [/kleurstift/i, /\bA colored pencil\b/g, 'A coloured crayon (pastel stick)'],
  [/salversan/i, /\bsalversan\b/g, 'Salvarsan'],
  [/./, /\bthe handicaps section\b/g, 'the handicap section'],
  // Shipyard and mill trades, plants, and people, rendered word by word.
  [/guts \(steekbeitel/i, /\bSomeone who sticks out with a gut \(wedge with hollow beak\)/g, 'Someone who gouges out, with a gouge (a chisel with a hollow blade)'],
  [/iemand die ponst/i, /\bsomeone who blows holes, presses holes\b/g, 'someone who punches, pressing holes'],
  [/omloop rond een hoge molen/i, /\bA stelling is a loop supported by supports around a high mill\. From this loop the mill is watered\b/g,
    'A stelling is a gallery on struts around a tall mill. From this gallery the cap is turned into the wind'],
  [/anjerfamilie/i, /\bthe daisy family\b/g, 'the pink (carnation) family'],
  [/liet zich in de lucht vliegen/i, /\bwas flown into the air\b/g, 'blew up his ship'],
  [/engelandvaarder/i, /\bresistance fighter and Englishman\b/g, 'resistance fighter and Engelandvaarder (he escaped occupied Holland to England)'],
  [/agent-telegrafist/i, /\bsecret agent-telegramist\b/g, 'secret agent and wireless operator'],
  [/waagdragersgilden/i, /\bdaring carriers' guilds\b/g, "guilds of weigh-house porters (waagdragers)"],
  [/valreepstrap/i, /\bThe opening in the obstacle of a ship, where the safety belt strap is attached\. Originally, it is the name of a rope ladder \(belt = rope\)/g,
    "The opening in a ship's bulwark where the gangway ladder (valreepstrap) is fixed. Originally, it is the name of a rope ladder (reep = rope)"],
  [/kort voor lijnzaadolie/i, /\bLinseed oil, shortly before linseed oil,/g, 'Lijnolie, short for lijnzaadolie (linseed oil),'],
  [/stampers/i, /\bthe stampers\b/g, 'the pistils'],
  [/razende bol/i, /\bFurious Ball\b/g, 'Razende Bol'],
  [/groene spechten/i, /\bGroene woodpeckers\b/g, 'Green woodpeckers'],
  [/maagdenpalm/i, /\b(pink|small) maiden palm\b/g, '$1 periwinkle'],
  [/halfheester/i, /\bHalfheester, a balmaceous herb\b/g, 'Subshrub (halfheester), an aromatic herb'],
  [/slange?nbrandspuit/i, /\bsnake fire hose\b/g, 'fire engine with a hose (slangbrandspuit)'],
  [/overhoeks/i, /\bThe term 'overhead'/g, "The term 'overhoeks'"],
  // Laken is woollen cloth, not linen or bedsheets; a raam here is a tenter
  // frame. A breeuwer caulked seams, he did not brew.
  [/laken/i, /\blinen industry\b/g, 'cloth (laken) industry'],
  [/lakenververs/i, /\bThe linen merchants\b/g, 'The cloth dyers'],
  [/geverfde laken/i, /\bthe painted linen\b/g, 'the dyed cloth'],
  [/lakenramen/i, /\bthese windows\b/g, 'these frames'],
  [/laken/i, /\blinen dyeing houses\b/g, 'cloth-dyeing houses'],
  [/lakenwevers/i, /\bthe sheets of the sheet weavers\b/g, 'the cloth of the cloth weavers (lakenwevers)'],
  [/breeuwer/i, /\bA brewer sealed\b/g, 'A caulker (breeuwer) sealed'],
  [/breeuwer/i, /\bmany brewers lived\b/g, 'many caulkers lived'],
  [/splitsen en lassen van kabels/i, /\bsplitting and welding cables\b/g, 'splicing and joining cables'],
  [/aan de klinker aangeeft/i, /\band indicates the rivet for sounding\b/g, 'and hands them to the riveter'],
  [/slechthamer/i, /\bwith a sledgehammer\b/g, 'with a flatter (slechthamer, a flat-faced hammer)'],
  [/stuikdrukken/i, /\bsuccessive punch presses\b/g, 'successive upsetting blows'],
  // Species: a gierzwaluw is a swift, a goudvink a bullfinch (the putter is
  // the goldfinch), a tuimelaar a bottlenose dolphin, a lepelaar a spoonbill,
  // an eidereend an eider; brem and klaver are in the pea family.
  [/gierzwaluw/i, /\b([Ss])wallow(s?)\b/g, '$1wift$2'],
  [/goudvink/i, /\bGoldfinch(es)?\b/g, 'Bullfinch$1'],
  [/goudvink/i, /\bgoldfinch(es)?\b/g, 'bullfinch$1'],
  [/distelvink/i, /\bthistle finch\b/g, 'goldfinch (distelvink)'],
  [/tuimelaar/i, /\bspinner dolphin\b/g, 'bottlenose dolphin'],
  [/lepelaars/i, /\bseabirds and storks\b/g, 'seabirds and spoonbills'],
  [/eidereend/i, /\bspoonbill, mallard and oystercatcher\b/g, 'spoonbill, eider and oystercatcher'],
  [/aangeslibde/i, /\bMarshes are located offshore, eroded pieces of land\b/g, 'Schorren are silted-up stretches of land outside the dikes'],
  [/enige kreken/i, /\bare the only ponds\b/g, 'are some creeks'],
  [/vlinderbloem/i, /\bthe daisy family\b/g, 'the pea family (vlinderbloemfamilie)'],
  [/^Heester, behorende tot de vlinderbloem/, /^Heather\b/, 'Shrub'],
  [/ter grootte van een mees/i, /\bthe size of a sparrow\b/g, 'the size of a tit'],
  [/noordelijke ijszee/i, /\bin the North Sea\b/g, 'in the Arctic Ocean'],
  [/strandpluvier/i, /\bbeach plover\b/g, 'Kentish plover'],
  [/zilverplevier/i, /\b([Ss])ilver plover\b/g, '$1rey plover'],
  [/traankokerijen/i, /\bdistillation plants\b/g, 'try-works for boiling whale oil (traankokerijen)'],
  [/met bun/i, /\bFisherman's vessel with bun\b/g, "Fishing vessel with a fish well (bun)"],
  [/keker als kikker/i, /\bkeker has come to sound like frog\. A chickpea is therefore actually a 'pea'/g,
    "keker came to sound like kikker (frog). A kikkererwt (chickpea) is thus really a 'keker pea'"],
  [/gematigde luchtstreken/i, /\btemperate air masses\b/g, 'temperate zones'],
  // The register describes the beluga sturgeon (Caspian, 1,400 kg, a century
  // old) under the white whale's name; the street is among the whale streets.
  [/ook wel witte dolfijn kan tien tot twaalf meter/i, /^Also known as the white dolphin, it can grow up to ten to twelve meters long, weigh up to 1400 kilograms and live for at least one hundred years\. Lives in the Caspian and Black Seas\./,
    'The beluga or white whale, a small toothed whale about four to five metres long that lives in Arctic and sub-Arctic seas.'],
  // Plant families and plants read as a group (2026-09-30).
  [/anjerfamilie/i, /\bthe rose family\b/g, 'the pink (carnation) family'],
  [/schermbloemenfamilie/i, /\bthe aster family\b/g, 'the carrot (umbellifer) family'],
  [/sterbladigenfamilie/i, /\bthe asteraceae family\b/g, 'the bedstraw family'],
  [/kleefeigenschap/i, /\bits hairy characteristic\b/g, 'its stickiness'],
  [/ook klaproos genoemd/i, /\bis also called buttercup\b/g, 'Also called klaproos (corn poppy)'],
  [/helmkruidfamilie/i, /\bthe mint family\b/g, 'the figwort family'],
  [/kruisbloemigen/i, /\bfamily of the cruciferous vegetables\b/g, 'of the cabbage family (crucifers)'],
  [/vossenbes/i, /\bred currant\b/g, 'lingonberry (cowberry)'],
  [/vossenbes/i, /\bThe foxberry\b/g, 'The lingonberry'],
  [/schrale grond/i, /\bin dry soil\b/g, 'in poor soil'],
  // Source error: zilverschoon (silverweed, Potentilla anserina) is in the rose
  // family, not the buttercup family.
  [/^Het plantje, behorende tot de ranonkelfamilie\.?\s*$/, /^The plant, belonging to the ranunculus family\.$/, 'Silverweed, a small plant of the rose family.'],
  [/een- of tweejarige/i, /\ba one- or two-year plant\b/g, 'an annual or biennial plant'],
  [/monnikskap/i, /\b([Mm])onk cap\b/g, '$1onkshood'],
  [/kaasjeskruid/i, /\bThe also found in the Netherlands great cheese herb\b/g, 'The common mallow, also found in the Netherlands,'],
  [/kaasjeskruid/i, /\bcheese herb\b/g, 'mallow (kaasjeskruid)'],
  [/rosmarijn of rozemarijn/i, /^Rosemary or Rosemary\b/, 'Rosmarijn or rozemarijn (rosemary)'],
  [/^Vaste, inheemse plant/, /^Permanent\b/, 'Perennial'],
  [/^Kruidenmengsel/, /^Herb mixture\b/, 'Spice mixture'],
  [/verbasterden het woord/i, /\bsimplified the word\b/g, 'corrupted the word'],
  [/^Plaats waar gewassen/, /\bvegetables are grown\b/g, 'crops are grown'],
  [/^Naar de daartegenover liggende Hortus/, /^To the opposite Hortus Botanicus\./, 'Named after the Hortus Botanicus opposite.'],
  [/ander woord voor 'boomgaard'/i, /'tree garden'/g, "'orchard'"],
  [/christoffelkruid|^In Zuid-Limburg voorkomende sierplant/i, /^In South Limburg, ornamental plant\b/, 'Ornamental plant found in South Limburg,'],
  // The Kadijk: a kadijk is a quay dike, and the Laagte/Hoogte Kadijk and
  // Tussen Kadijken are street names, not "the Lowness of the Canal".
  [/zomerkade of kadijk/i, /\bsummer dike or canal\b/g, 'summer dike or kadijk (quay dike)'],
  [/Laagte en de Hoogte van de Kadijk/, /\bthe (?:Lowness|Laagte) and (?:the )?(?:Height|Hoogte) (?:of the|van de) (?:Canal|Kadijk)\b/g, 'the Laagte and the Hoogte of the Kadijk'],
  [/De Tussen Kadijken heette/, /\bThe Between (?:Canals|Dikes)\b/g, 'The Tussen Kadijken'],
  // A boom closed a harbour opening; the boomklok rang when it opened.
  [/boomklok/i, /\bthe city of the IJ was separated by\b/g, 'the city was separated from the IJ by'],
  [/boomklok/i, /\bso-called 'trees'/g, "so-called 'bomen' (booms)"],
  [/boomklok/i, /\bthe 'trees'/g, 'the booms'],
  [/boomklok/i, /\bthe tree bell\b/g, 'the boom bell (boomklok)'],
  [/een hogeboom is/i, /\bA high tree is a high-altitude footbridge, in principle consisting of only one tree or beam\b/g,
    'A hogeboom is a raised footbridge, at its simplest a single log or beam'],
  [/vandaar voorzetsel krom/i, /\bCrossing of the Recht Boomsloot, hence preposition curved\b/g, 'Side canal of the Recht Boomsloot, hence Krom (crooked)'],
  [/bullebak was een/i, /\bThe bull's head was\b/g, 'The bullebak (bogeyman) was'],
  [/gouw \(Waterlandse naam/i, /\bThe county \(Waterland name\b/g, 'The gouw (Waterland name'],
  [/ophaalbrug over de Scheisloot/i, /\bas a loading bridge\b/g, 'as a lift bridge'],
  [/ontvening/i, /\bfor the draining of\b/g, 'for digging the peat out of'],
  [/ook de tocht achter/i, /\bthe route behind\b/g, 'the drainage channel (tocht) behind'],
  // People: trades, titles, and what they made.
  [/luthers predikant/i, /\bLuther's pastor\b/g, 'Lutheran minister'],
  [/werd van socialist anarchist/i, /\bBecame a socialist anarchist\b/g, 'Went from socialist to anarchist'],
  [/elektriseermachine/i, /\belectroplating machine\b/g, 'electrostatic generator'],
  [/melkslijter/i, /\bmilk slicer\b/g, 'milk seller'],
  [/onderwijzer, later leraar/i, /\bteacher, later teacher\b/g, 'primary-school teacher, later a secondary-school teacher'],
  [/verzorgde veel verkade/i, /\bManaged many Verkade albums\b/g, 'Illustrated many Verkade albums'],
  [/knokploegen/i, /\bnational strike groups\b/g, 'national armed resistance squads (knokploegen)'],
  [/overval op het huis van bewaring/i, /\ba failed robbery of the Prison House\b/g, 'a failed raid on the remand prison'],
  [/graveur en tekenaar/i, /\bengraver and painter\b/g, 'engraver and draughtsman'],
  [/schilderes/i, /\bPainteress\b/g, 'Painter'],
  [/natuuronderzoeker\. Amsterdams/i, /\bnatural researcher\b/g, 'naturalist'],
  [/houtkoper/i, /\bwood buyer\b/g, 'timber merchant'],
  [/toevoeging 'Korte'/i, /\baddition 'Short'/g, "addition 'Korte' (short)"],
  [/Carl Linné of Linnaeus/, /\bCarl Linnaeus or Linnaeus\b/g, 'Carl Linné or Linnaeus'],
  [/Rb\. van 19-11-1879 als Plantage Prinsenlaan/, /\bwas renamed Plantage Prinsenlaan by Rb\./g, 'was named Plantage Prinsenlaan.'],
  [/vijf jaar durfde/i, /\bFive years ago,/g, 'Five years later,'],
  [/staan dus voor de strijd/i, /\bare therefore facing the struggle for freedom\b/g, 'therefore stand for the struggle for freedom'],
  [/oude Joodse proletariaat/, /\bstrong woman\. and there\b/g, 'strong woman, and there'],
  [/oude Joodse proletariaat/, /\bShe was born in 1887 and died in 1982\.$/,
    'She was born in 1887 and died in 1982. She came from the old Jewish working class, a hard-working woman and a true Amsterdammer.'],
  [/uitspanning/i, /\bthe extension\b/g, 'the roadside inn'],
  [/uitspanning/i, /\ban extension\b/g, 'a roadside inn'],
  [/vastenavond/i, /\bon a Good Friday\b/g, 'at Shrovetide (Vastenavond)'],
  [/kapelstegen/i, /\bChapel Stops\b/g, 'Kapelstegen (chapel alleys)'],
  [/waar de stegen op toelopen/i, /\bwhere the steps lead up from\b/g, 'towards which the alleys run from'],
  [/huidenhandel/i, /\bfur trade\b/g, 'hide trade'],
  [/aanliggende houtvemen/i, /\bwood pits\b/g, 'timber yards (houtvemen)'],
  [/aangevoerde specerijen/i, /\bthe spices mentioned\b/g, 'the imported spices'],
  [/door de landengte/i, /\bby the Isthmus\b/g, 'through the Isthmus'],
  [/ijsclubterrein/i, /\ban ice club field\b/g, "a skating club's ice rink"],
  [/drooggemalen meertje/i, /\ba dry-milled pond\b/g, 'a small lake pumped dry'],
  [/een postje is/i, /\bA post is\b/g, 'A postje is'],
  [/^Herenhuis/, /^Men's house\b/, 'Country house (herenhuis)'],
  [/door oeverafslag/i, /\bonly later became an island due to a river bend\b/g, 'only later became an island as its shore washed away'],
  [/door oeverafslag/i, /\bwas only later made into an island by a breakwater\b/g, 'only later became an island as its shore washed away'],
  // "Naar de …" opens an origin: named after it, not "To the …". Runs after
  // the rules above that match a whole "To the …" opening.
  [/^Naar /, /^To (?=the |an? |[A-Z'])/, 'Named after '],
  // Grammar the translator gets wrong before a vowel.
  [/./, /\ba (?=(?:inn|embankment|alderman|island|estate|old|important|admiral|officer|engineer|author|actor|actress|architect|artist|area|order|eighteenth|eleventh|inland|English|Amsterdam)\b)/g, 'an '],
  [/tot de vinken behorende/i, /\bbelonging to the sparrows\b/g, 'belonging to the finches'],
  [/^de hoender\.?$/i, /^The chicken\.?$/, 'The fowl.'],
];

/** Classes an origin may name alone ("The shrub."), as the card says them. */
const GENERIC_CLASSES = new Set([
  // 'songbird' is the glossary's repair of the translator's 'singing bird',
  // and the repair runs first.
  'shrub', 'deciduous tree', 'tree', 'singing bird', 'songbird', 'bird', 'water bird', 'meadow bird', 'bird of prey',
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

const DUTCH_ORDINALS: Readonly<Record<string, string>> = { First: 'Eerste', Second: 'Tweede', Third: 'Derde', Fourth: 'Vierde', Short: 'Korte', Long: 'Lange' };
const STREET_WORD = /^(?:[A-Z][\w-]*?(?:straat|dwarsstraat|plantsoen|gracht|laan|kade|weg|dwarsweg|steeg|pad)|Wetering Plantsoen)$/;

/** "First and Second Weteringplantsoen" are street names, which keep their
 *  Dutch ordinals: "Eerste and Tweede Weteringplantsoen". A run of ordinals
 *  is converted only when a Dutch street word follows it. */
export function dutchOrdinalStreetNames(text: string): string {
  return text.replace(/\b((?:First|Second|Third|Fourth|Short|Long)(?:(?:, | and )(?:First|Second|Third|Fourth))*) ([A-Z][\w-]*(?: Plantsoen)?)\b/g,
    (whole, run: string, street: string) => STREET_WORD.test(street)
      ? `${run.replace(/First|Second|Third|Fourth|Short|Long/g, word => DUTCH_ORDINALS[word])} ${street.replace('Wetering Plantsoen', 'Weteringplantsoen')}`
      : whole);
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
  if (/\b(?:Eerste|Tweede|Derde|Vierde|Korte|Lange)\b/.test(nl)) text = dutchOrdinalStreetNames(text);
  if (!/\d{1,2}[:.]\d{2}\s*uur|\d{1,2}:\d{2}/.test(nl)) {
    const missingYears = [...new Set(nl.match(/\b1[0-9]{3}\b/g) ?? [])].filter(year => !text.includes(year));
    if (missingYears.length === 1) {
      text = text.replace(/\b\d{1,2}:\d{2}\s*(?:[ap]\.m\.|[AP]M\b)/, missingYears[0]);
    }
  }
  return text.replace(/\s{2,}/g, ' ').trim();
}
