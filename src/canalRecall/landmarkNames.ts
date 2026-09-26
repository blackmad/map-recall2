// Landmark display names, cleaned at extract time rather than in the HUD.
//
// OSM `name` is mostly right, but a few landmarks arrive lowercase ("foam",
// "waterdraagster") or as a half-translated mix ("Dam Square Victims 7 mei
// 1945"), and the game then teaches that spelling (UI review 2026-09-26).
// The fix keeps the local, Dutch name — that is what the street signs say —
// and only repairs its form. The original stays on the feature as `osmName`.

export interface LandmarkNameInput {
  name: string;
  /** "nl:Monument voor Damslachtoffers 7 mei 1945" */
  wikipedia?: string;
}

export interface LandmarkRename {
  from: string;
  to: string;
  reason: 'lowercase' | 'mixed-language';
}

const ENGLISH_MARKERS = new Set([
  'square', 'victims', 'church', 'bridge', 'street', 'memorial', 'house',
  'tower', 'gate', 'palace', 'statue', 'the', 'of', 'and',
]);
const DUTCH_MARKERS = new Set([
  'januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus',
  'september', 'oktober', 'november', 'december', 'van', 'het', 'voor', 'en',
  'kerk', 'straat', 'gracht', 'plein', 'brug', 'huis', 'toren', 'poort',
]);

function words(name: string): string[] {
  return name.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/** Both an English and a Dutch marker word: someone translated half of it. */
export function isMixedLanguageName(name: string): boolean {
  const list = words(name);
  return list.some((word) => ENGLISH_MARKERS.has(word)) && list.some((word) => DUTCH_MARKERS.has(word));
}

/** "waterdraagster" → "Waterdraagster". Only for names with no capital at all,
 *  so "Het Scheepvaarthuis" or "de Gooyer" are left as their owners wrote them. */
export function capitaliseLowercaseName(name: string): string {
  if (name !== name.toLowerCase() || !/\p{Ll}/u.test(name)) return name;
  // A leading mark (".zip") is a stylised brand; leave it.
  if (!/^\p{Ll}/u.test(name)) return name;
  return name[0].toUpperCase() + name.slice(1);
}

function dutchWikipediaTitle(wikipedia: string | undefined): string | null {
  if (!wikipedia || !wikipedia.startsWith('nl:')) return null;
  const title = wikipedia.slice(3).replace(/_/g, ' ').replace(/\s*\([^)]*\)\s*$/, '').trim();
  return title || null;
}

/** The rename a landmark needs, or null when its name is fine. A mixed name
 *  takes its Dutch Wikipedia title; without one it is left for review. */
export function landmarkRename(feature: LandmarkNameInput): LandmarkRename | null {
  const name = (feature.name || '').trim();
  if (!name) return null;
  if (isMixedLanguageName(name)) {
    const title = dutchWikipediaTitle(feature.wikipedia);
    if (title && title !== name && !isMixedLanguageName(title)) return { from: name, to: title, reason: 'mixed-language' };
  }
  const capitalised = capitaliseLowercaseName(name);
  if (capitalised !== name) return { from: name, to: capitalised, reason: 'lowercase' };
  return null;
}
