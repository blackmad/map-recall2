// BAG addresses on building cards (lane C2, #368).
//
// `pand-addresses-v1` is cut from PDOK's open BAG (verblijfsobject hoofdadres, keyed by pand) into the same z14 tiles as
// `building-facts`. A pand's address is a few `[street, numbers]` groups; the card shows them as "Anthony Fokkerweg 55–65".
// The street part is the one thing a quiz may be asking for, so `addressText` withholds it by rule (see `streetShown`).

/** One street a pand stands on and the compact house-number text for it ("55–65", "12A–12C", "2, 4"). */
export type PandAddressPart = [street: string, numbers: string];
export type PandAddress = PandAddressPart[];

export interface PandAddressTile {
  version: 1;
  /** Keyed like the building-facts tiles: `NL.IMBAG.Pand.` shortened to `P`. */
  pands: Record<string, PandAddress>;
}

export const PAND_ADDRESS_VERSION = 'pand-addresses-v1';
/** More streets than this on one pand are a block, not a door: the rest is dropped. */
export const MAX_ADDRESS_STREETS = 3;

export interface HouseNumber { n: number; letter?: string | null }

const numberText = (h: HouseNumber) => `${h.n}${(h.letter || '').toUpperCase()}`;
const byNumber = (a: HouseNumber, b: HouseNumber) => a.n - b.n || (a.letter || '').localeCompare(b.letter || '');

/** The house numbers of one street on one pand as a short text: a lone number, two numbers listed, three or more as the span. */
export function compactNumbers(numbers: readonly HouseNumber[]): string {
  const unique = new Map<string, HouseNumber>();
  for (const h of numbers) if (Number.isInteger(h.n) && h.n > 0) unique.set(numberText(h), h);
  const sorted = [...unique.values()].sort(byNumber);
  if (!sorted.length) return '';
  if (sorted.length === 1) return numberText(sorted[0]);
  if (sorted.length === 2) return sorted.map(numberText).join(', ');
  return `${numberText(sorted[0])}–${numberText(sorted[sorted.length - 1])}`;
}

export interface AddressRow { street: string; n: number; letter?: string | null }

/** Group a pand's verblijfsobject addresses by street: most numbers first, at most `MAX_ADDRESS_STREETS`, ties by name. */
export function pandAddressOf(rows: readonly AddressRow[]): PandAddress {
  const streets = new Map<string, HouseNumber[]>();
  for (const row of rows) {
    const street = (row.street || '').trim();
    if (!street || !(row.n > 0)) continue;
    const list = streets.get(street) ?? [];
    list.push({ n: row.n, letter: row.letter });
    streets.set(street, list);
  }
  return [...streets.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'nl'))
    .slice(0, MAX_ADDRESS_STREETS)
    .map(([street, list]): PandAddressPart => [street, compactNumbers(list)])
    .filter(part => part[1]);
}

/** What the game knows about questions, for deciding whether a street may be said. */
export interface QuizState {
  freeRide?: boolean;
  quizPromptName?: string | null;
  quizCandidateName?: string | null;
  _silentPass?: unknown;
}

const norm = (name: string | null | undefined) => (name || '').normalize('NFC').toLocaleLowerCase('nl').trim();

/** The names the game is hiding right now (the same three the label overlay withholds). */
export function hiddenQuestionNames(game: QuizState | null | undefined): string[] {
  return [game?.quizPromptName, game?.quizCandidateName, (game?._silentPass as { name?: string | null } | null | undefined)?.name].map(norm).filter(Boolean);
}

/**
 * May a card say streets now? Free Ride is exploration: always. In a quiz mode no street is said while any question is
 * open (a prompt, a candidate being approached, a silent pass in progress), because the street under question is
 * whichever the rider is on; between questions streets are shown, and a street equal to a hidden name never is.
 */
export function streetShown(game: QuizState | null | undefined, street = ''): boolean {
  if (!game || game.freeRide) return true;
  const hidden = hiddenQuestionNames(game);
  if (hidden.length) return false;
  return !street || !hidden.includes(norm(street));
}

/** Streets a card names before "+n more": the phone's driving corridor stays clear. */
export const CARD_ADDRESS_STREETS = 2;

/**
 * The address a card says, "Herengracht 12" or "A 1 / B 2 +1 more", or '' when the building has none or a street is
 * withheld. Withheld means omitted, not announced: a notice that an address is coming reads as a hint.
 */
export function addressText(address: PandAddress | null | undefined, game?: QuizState | null): string {
  if (!address?.length) return '';
  if (address.some(([street]) => !streetShown(game, street))) return '';
  const shown = address.slice(0, CARD_ADDRESS_STREETS).map(([street, numbers]) => `${street} ${numbers}`).join(' / ');
  return address.length > CARD_ADDRESS_STREETS ? `${shown} +${address.length - CARD_ADDRESS_STREETS} more` : shown;
}

/** Remove a mapped place's " at <street number>" from a card text while streets are withheld. */
export function withoutStreetClause(text: string, address: string | null | undefined): string {
  return address ? text.split(` at ${address}`).join('') : text;
}
