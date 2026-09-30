// What the city's bridge register says about a named bridge.
//
// Amsterdam numbers its bridges (the number is painted on many of them:
// Magere Brug is 242, Blauwbrug 236), and its asset register
// (`civieleconstructies`) records each one's type, material, and, for fixed
// bridges, a construction year and the traffic it carries. After a bridge is
// named, its card can say that even when no name origin exists: the register
// covers 1,837 bridges against 203 bridge origins.

/** One register row as `scripts/data/amsterdam-bridge-register.json` stores it:
 *  [number, name, type, material, year (0 unknown), modality, street, ring]. */
export type BridgeRegisterRow = [
  number: string, name: string, type: string, material: string,
  year: number, modality: string, street: string, ring: Array<[number, number]>,
];

/** A bridge's register entry as the extract publishes it. */
export interface BridgeRegisterFact {
  /** The painted bridge number (242), when the object number carries one. */
  nr?: number;
  movable: boolean;
  /** English material, e.g. "steel". */
  material?: string;
  /** Construction year per the register. */
  year?: number;
  /** English traffic it carries, e.g. "cyclists". */
  carries?: string;
}

export interface BridgeRegisterFile {
  version: 1;
  source: string;
  /** Keyed by the bridge's name as `bridges.json` spells it. */
  bridges: Record<string, BridgeRegisterFact>;
}

const MATERIALS: Record<string, string> = {
  Staal: 'steel', 'Gewapend beton': 'reinforced concrete', Hout: 'wooden', Beton: 'concrete',
  Metselwerk: 'brick', Composiet: 'composite', Kunststof: 'plastic',
};

const CARRIES: Record<string, string> = {
  'Licht wegverkeer': 'road traffic', Voetganger: 'pedestrians', Fiets: 'cyclists',
  Metro: 'the metro', Tram: 'trams', Trein: 'trains',
};

/** `BRU0242` → 242. Other prefixes (viaducts, `VIA…`) have no painted number. */
export function bridgeNumber(objectNumber: string): number | undefined {
  const match = /^BRU0*(\d+)$/.exec(objectNumber.trim());
  return match ? Number(match[1]) : undefined;
}

/** A register row, reduced to what a card says. Years outside the plausible
 *  range (a placeholder, or a typo) are dropped rather than taught. */
export function registerFact(row: BridgeRegisterRow, now = new Date().getFullYear()): BridgeRegisterFact {
  const [number, , type, material, year, modality] = row;
  const fact: BridgeRegisterFact = { movable: /^beweegba/i.test(type) };
  const nr = bridgeNumber(number);
  if (nr != null) fact.nr = nr;
  if (MATERIALS[material]) fact.material = MATERIALS[material];
  if (Number.isInteger(year) && year >= 1400 && year <= now + 1) fact.year = year;
  if (CARRIES[modality]) fact.carries = CARRIES[modality];
  return fact;
}

/**
 * One sentence for the card: "Bridge 236, a steel bridge for road traffic,
 * dated 1884 in the city's bridge register." The year is attributed, since
 * the register sometimes dates the current deck, not the first bridge here.
 */
export function describeRegisteredBridge(fact: BridgeRegisterFact): string {
  const kind = [fact.movable ? 'movable' : '', fact.material].filter(Boolean).join(' ');
  const noun = `${kind ? `${/^[aeiou]/i.test(kind) ? 'an' : 'a'} ${kind} ` : 'a '}bridge`;
  const carries = fact.carries ? ` for ${fact.carries}` : '';
  const dated = fact.year ? `, dated ${fact.year} in the city's bridge register` : '';
  const lead = fact.nr != null ? `Bridge ${fact.nr}: ${noun}` : capitalise(noun);
  if (!kind && !carries && !dated && fact.nr == null) return '';
  return `${lead}${carries}${dated}.`;
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const normaliseName = (name: string) => name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

/** A spelling key: `ij` and `y` are one letter in older Dutch spelling
 *  (Ryckerbrug, Rijckerbrug), and the bridge/lock suffix is dropped. */
const spellingKey = (name: string) => normaliseName(name).replace(/ij/g, 'y').replace(/(brug|sluis)$/, '');

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

/**
 * The same bridge under two spellings: OSM "Gustav Leonhardtbrug", register
 * "Gustav Leonardbrug"; "Bullebaksluis" and "Bullebakssluis". At most two
 * edits, on names of six letters or more. Neighbouring bridges in one
 * district are named from one theme and differ by more than that
 * (Goudvinkbrug and Goudhaanbrug are four edits apart).
 */
export function sameBridgeName(a: string, b: string): boolean {
  const x = spellingKey(a), y = spellingKey(b);
  if (x === y) return true;
  return Math.min(x.length, y.length) >= 6 && editDistance(x, y) <= 2;
}

/**
 * Which register bridge a named game bridge is. `candidates` are the register
 * rows whose outline the bridge's mapped ways touch. One named like the bridge
 * wins; otherwise a single candidate is taken; several unnamed candidates (a
 * long road such as IJburglaan crossing five bridges) are ambiguous, and
 * saying the wrong bridge's year would teach something false.
 */
/**
 * OSM names that the register spells differently, each checked against a
 * source. The register uses the official name, and OSM often keeps the popular
 * or older one. Only a candidate outline whose register name matches the
 * alias is accepted, so an alias never overrides geometry.
 */
export const REGISTER_ALIASES: Readonly<Record<string, string>> = {
  // nl.wikipedia "Pythonbrug": officially Hoge brug, bridge 1998.
  'Python Bridge': 'Hoge brug',
  // nl.wikipedia "Brug 348": Zeilbrug and Zeilstraatbrug, over the Schinkel.
  Zeilbrug: 'Zeilstraatbrug',
  // nl.wikipedia "Willem Breukerbrug": bridge 2326 was called Zouthavenbrug
  // until the Willem Breukerbrug name was made official in January 2024.
  Zouthavenbrug: 'Willem Breukerbrug',
};

export function chooseRegisterBridge(name: string, candidates: readonly BridgeRegisterRow[]): BridgeRegisterRow | null {
  const alias = REGISTER_ALIASES[name.trim()];
  if (alias) {
    const matched = candidates.filter(row => row[1] && sameBridgeName(row[1], alias));
    if (matched.length === 1) return matched[0];
  }
  // OSM names some bridges only by their painted number ("Brug 68").
  const numbered = /^brug\s+(\d+)$/i.exec(name.trim());
  if (numbered) return candidates.find(row => bridgeNumber(row[0]) === Number(numbered[1])) ?? null;
  const named = candidates.filter(row => row[1] && sameBridgeName(row[1], name));
  if (named.length === 1) return named[0];
  if (named.length > 1) return null;
  const distinct = [...new Map(candidates.map(row => [row[0], row])).values()];
  if (distinct.length !== 1) return null;
  // A register name that differs is another bridge the way only brushes.
  return distinct[0][1] && !sameBridgeName(distinct[0][1], name) ? null : distinct[0];
}
