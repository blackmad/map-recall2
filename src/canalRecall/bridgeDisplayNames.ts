// The spelling a bridge is shown under, apart from the name it is matched by.
//
// OSM spells some bridges loosely ("Katten brug", "Hilletjes Brug",
// "Zwanenburger fiets brug") where the municipal bridge register and the BAG
// openbare-ruimte register have one word (Kattenbrug, Hilletjesbrug). The game
// matches a bridge to the way under the wheels by the way's raw OSM name, and
// every derived file (crossings, register facts, name origins, recall history)
// is keyed on that raw name, so the name itself must not change. A bridge
// carries `displayName` instead: what the question, its choices, the feedback,
// the map label and the card show. A typed answer is right under either.
//
// Only a spelling is ever a display name: the official name must fold to the
// same letters as OSM's (case, spaces, punctuation, doubled letters, a leading
// "De"), and keep OSM's -brug/-sluis ending. A different name for the same
// structure (Kaassluis beside the register's Kaasmarktsluis) is not a spelling
// and is left alone here.

/** Letters only, doubled letters folded, a leading Dutch article dropped. Like
 *  `bridgeMatchKey`, but without folding -sluis into -brug: here the ending is
 *  part of the name being shown. */
export function bridgeLetterKey(name: string): string {
  return name.trim().replace(/^(de|het|'t)\s+/i, '').replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .toLocaleLowerCase().normalize('NFD').replace(/[^\p{L}]/gu, '').replace(/(\p{L})\1+/gu, '$1');
}

/**
 * The official spelling of `osmName` among `candidates` (register or BAG names
 * near the bridge), or null when OSM already spells it so, when no candidate
 * is the same name, or when two different spellings qualify.
 */
export function officialBridgeSpelling(osmName: string, candidates: Iterable<string>): string | null {
  const key = bridgeLetterKey(osmName);
  if (!key) return null;
  const matches = new Set<string>();
  for (const candidate of candidates) {
    const trimmed = (candidate || '').trim();
    if (trimmed && bridgeLetterKey(trimmed) === key) matches.add(trimmed);
  }
  if (matches.has(osmName.trim())) return null;
  return matches.size === 1 ? [...matches][0] : null;
}

/** Sanity check for a published display name, used by the stage script and
 *  the runtime index alike: a display name must be a spelling of the name. */
export function isBridgeSpelling(osmName: string, displayName: string): boolean {
  return !!displayName && displayName !== osmName && bridgeLetterKey(displayName) === bridgeLetterKey(osmName);
}

export interface DisplayNamedBridge {
  name?: string;
  displayName?: string;
}

/** Raw OSM name → shown spelling, for the bridges that have one. */
export type BridgeDisplayNames = ReadonlyMap<string, string>;

export function buildBridgeDisplayNames(bridges: readonly DisplayNamedBridge[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const bridge of bridges) {
    const name = bridge.name?.trim();
    const shown = bridge.displayName?.trim();
    if (name && shown && isBridgeSpelling(name, shown)) names.set(name, shown);
  }
  return names;
}

const indexes = new WeakMap<readonly DisplayNamedBridge[], Map<string, string>>();

/** `buildBridgeDisplayNames`, built once per bridge list (the game replaces
 *  the list on each extract load, which starts a new index). */
export function bridgeDisplayNamesOf(bridges: readonly DisplayNamedBridge[] | null | undefined): BridgeDisplayNames {
  if (!bridges) return new Map();
  let index = indexes.get(bridges);
  if (!index) indexes.set(bridges, index = buildBridgeDisplayNames(bridges));
  return index;
}

/** What to show for a name the game asks or reveals. Non-bridge names pass
 *  through unchanged. */
export function displayBridgeName(names: BridgeDisplayNames | null | undefined, name: string): string {
  return (names && names.get(name)) || name;
}

/** Every spelling a typed answer may use for `name`. */
export function acceptedBridgeAnswers(names: BridgeDisplayNames | null | undefined, name: string): string[] {
  const shown = names?.get(name);
  return shown ? [shown, name] : [name];
}
