// One spelling per place (#284). The landmark extract names some places
// differently from the daily ride's destinations ("The National Maritime
// Museum" against "National Maritime Museum", "Nemo" against "NEMO Science
// Museum"), and the replica VOC ship is called just "Amsterdam", which reads
// as the city on a checklist. `buildLandmarks` passes every landmark name
// through `landmarkDisplayName`, so the checklist, the plaque, the postcard,
// the markers and the landmark card all read one name.

/** A landmark named only by a city's name gets its full name here (by Wikidata id). */
const BY_WIKIDATA: Readonly<Record<string, string>> = {
  // nl:Amsterdam (schip, 1990), the replica East Indiaman moored at the museum.
  Q478353: 'VOC ship Amsterdam',
};

/** Extract spelling → the curated destination's spelling (cities.ts). */
export const BY_NAME: Readonly<Record<string, string>> = {
  'The National Maritime Museum': 'National Maritime Museum',
  Nemo: 'NEMO Science Museum',
  "H'ART Museum": 'H’ART Museum',
};

/** City names a place must never be called by on its own. */
export const BARE_CITY_NAMES: ReadonlySet<string> = new Set([
  'Amsterdam', 'Rotterdam', 'Utrecht', 'Den Haag', 'The Hague', 'Weesp', 'Haarlem',
]);

/** The one spelling every surface shows for a landmark. */
export function landmarkDisplayName(feature: { name: string; wikidata?: string | null }): string {
  const byId = feature.wikidata ? BY_WIKIDATA[feature.wikidata] : undefined;
  if (byId) return byId;
  return BY_NAME[feature.name] ?? feature.name;
}

/** The extract's features with every name, and every distractor naming
 *  another feature, in its one spelling. Applied once where the game loads
 *  the extract, so the map labels, the spoiler screen, the question choices
 *  and the cards all compare the same strings. */
export function withDisplayNames<T extends { name: string; wikidata?: string | null; distractors?: string[] }>(features: readonly T[]): T[] {
  const renamed = new Map<string, string>();
  for (const feature of features) {
    const shown = landmarkDisplayName(feature);
    if (shown !== feature.name) renamed.set(feature.name, shown);
  }
  if (!renamed.size) return [...features];
  return features.map(feature => {
    const name = landmarkDisplayName(feature);
    const distractors = feature.distractors?.some(d => renamed.has(d) || d in BY_NAME)
      ? feature.distractors.map(d => renamed.get(d) ?? BY_NAME[d] ?? d) : feature.distractors;
    return name === feature.name && distractors === feature.distractors ? feature : { ...feature, name, distractors };
  });
}
