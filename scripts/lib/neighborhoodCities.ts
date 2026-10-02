/**
 * Per-city settings for the neighbourhood enrichers
 * (`enrich-amsterdam-neighborhoods.ts`, `fetch-neighborhood-history.ts`).
 *
 * Amsterdam's values reproduce what those scripts did before they took a
 * `--city` argument, so its output stays byte-identical. The other cities
 * differ in three measured ways:
 *
 *  - Their Wikidata neighbourhoods hang under a district, not the
 *    municipality, so the SPARQL walks P131 transitively (`transitive`).
 *    Rotterdam's neighbourhoods point at the municipality (Q2680952), not
 *    the city item (Q34370), so both are listed.
 *  - Den Haag's stadsdelen are typed "quarter" (Q2983893).
 *  - A Dutch-only lede is never shipped unreviewed (`dutchExtractFallback:
 *    false`): the reviewed English description from
 *    `neighborhood-history.json` stands in for it instead.
 */
export interface NeighborhoodCity {
  id: string;
  /** Name used in Wikipedia searches and "<name> (<city>)" titles. */
  name: string;
  /** Extract directory, relative to the repository root. */
  directory: string;
  /** Wikidata items the neighbourhoods sit in (P131). */
  municipalityQids: string[];
  /** Walk P131 through districts (P131/P131*) instead of one hop. */
  transitive: boolean;
  /** Wikidata P31 classes counted as neighbourhoods. */
  types: string[];
  /** Words in an article's opening that show it is about this city. */
  aboutPattern: RegExp;
  /** Disambiguation suffixes Dutch Wikipedia uses: "Centrum (Rotterdam)". */
  titleQualifiers: string[];
  /** OSM name → Wikidata labels to try. */
  aliases: Record<string, readonly string[]>;
  /** Prefixes Wikidata labels add to district names ("Amsterdam-Noord"). */
  labelPrefixes: string[];
  /** Also match the Dutch Wikidata label (English ones can differ). */
  indexDutchLabels: boolean;
  /** Strip a trailing "(City)" from Wikidata labels before matching. */
  stripLabelQualifier: boolean;
  /** Keep a Dutch Wikipedia lede in neighborhoods-enriched.json. */
  dutchExtractFallback: boolean;
  /** Review file for fetch-neighborhood-history.ts. */
  reviewPath: string;
}

const AMSTERDAM_TYPES = ['Q123705', 'Q253019', 'Q1529997', 'Q3257686', 'Q15715406', 'Q15079751'];
// Den Haag's stadsdelen and some Rotterdam/Utrecht wijken are "quarter".
const DUTCH_CITY_TYPES = [...AMSTERDAM_TYPES, 'Q2983893'];

export const NEIGHBORHOOD_CITIES: Record<string, NeighborhoodCity> = {
  amsterdam: {
    id: 'amsterdam',
    name: 'Amsterdam',
    directory: 'public/data/extracts/amsterdam',
    municipalityQids: ['Q9899'],
    transitive: false,
    types: AMSTERDAM_TYPES,
    aboutPattern: /Amsterdam/,
    titleQualifiers: ['Amsterdam'],
    aliases: {
      // Borough is labelled Amsterdam-Centrum (Q478282); OSM boundary is Centrum.
      Centrum: ['Amsterdam-Centrum', 'Amsterdam Centrum'],
      Noord: ['Amsterdam-Noord', 'Amsterdam Noord'],
      Oost: ['Amsterdam-Oost', 'Amsterdam Oost'],
      West: ['Amsterdam-West', 'Amsterdam West'],
      Zuid: ['Amsterdam-Zuid', 'Amsterdam Zuid'],
      'Nieuw-West': ['Amsterdam Nieuw-West', 'Amsterdam-Nieuw-West'],
      Zuidoost: ['Amsterdam-Zuidoost', 'Amsterdam Zuidoost'],
    },
    labelPrefixes: ['Amsterdam'],
    indexDutchLabels: false,
    stripLabelQualifier: false,
    dutchExtractFallback: true,
    reviewPath: 'scripts/data/neighborhood-history-review.json',
  },
  utrecht: {
    id: 'utrecht',
    name: 'Utrecht',
    directory: 'public/data/extracts/utrecht',
    municipalityQids: ['Q803'],
    transitive: true,
    // Binnenstad is typed "city centre" (Q1468524).
    types: [...DUTCH_CITY_TYPES, 'Q1468524'],
    aboutPattern: /Utrecht/,
    titleQualifiers: ['Utrecht', 'Utrecht-stad'],
    aliases: {
      'De Uithof - Utrecht Science Park': ['Utrecht Science Park', 'De Uithof'],
      'Vleuten - De Meern': ['Vleuten-De Meern'],
      Binnenstad: ['Binnenstad (Utrecht)'],
    },
    labelPrefixes: ['Utrecht'],
    indexDutchLabels: true,
    stripLabelQualifier: true,
    dutchExtractFallback: false,
    reviewPath: 'scripts/data/neighborhood-history-review.utrecht.json',
  },
  rotterdam: {
    id: 'rotterdam',
    name: 'Rotterdam',
    directory: 'public/data/extracts/rotterdam',
    municipalityQids: ['Q2680952', 'Q34370'],
    transitive: true,
    types: DUTCH_CITY_TYPES,
    aboutPattern: /Rotterdam/,
    titleQualifiers: ['Rotterdam'],
    aliases: {
      Centrum: ['Rotterdam Centrum', 'Rotterdam-Centrum'],
      Noord: ['Rotterdam-Noord', 'Rotterdam Noord'],
      Carnisse: ['Carnisserbuurt'],
    },
    labelPrefixes: ['Rotterdam'],
    indexDutchLabels: true,
    stripLabelQualifier: true,
    dutchExtractFallback: false,
    reviewPath: 'scripts/data/neighborhood-history-review.rotterdam.json',
  },
  'den-haag': {
    id: 'den-haag',
    name: 'Den Haag',
    directory: 'public/data/extracts/den-haag',
    municipalityQids: ['Q36600'],
    transitive: true,
    // The eight stadsdelen are "district of The Hague" (Q86681780).
    types: [...DUTCH_CITY_TYPES, 'Q86681780'],
    aboutPattern: /Den Haag|'s-Gravenhage|The Hague|Haagse?\b/,
    titleQualifiers: ['Den Haag', "'s-Gravenhage"],
    aliases: {
      Centrum: ['Centrum (Den Haag)', 'Den Haag Centrum'],
    },
    labelPrefixes: ['Den Haag'],
    indexDutchLabels: true,
    stripLabelQualifier: true,
    dutchExtractFallback: false,
    reviewPath: 'scripts/data/neighborhood-history-review.den-haag.json',
  },
};

/** The city named by `--city=<id>` (default Amsterdam). */
export function neighborhoodCityFromArgs(argv: readonly string[] = process.argv): NeighborhoodCity {
  const flag = argv.find((arg) => arg.startsWith('--city='));
  const index = argv.indexOf('--city');
  const id = flag ? flag.slice('--city='.length) : index >= 0 ? argv[index + 1] : 'amsterdam';
  const city = NEIGHBORHOOD_CITIES[id];
  if (!city) throw new Error(`Unknown --city ${id}; expected one of ${Object.keys(NEIGHBORHOOD_CITIES).join(', ')}`);
  return city;
}
