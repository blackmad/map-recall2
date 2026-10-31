// Names of extract places that the label spoiler screen must see.
/**
 * The other names of an extract place: the Dutch Wikipedia title behind an
 * English display name ("New Market" is nl:Nieuwmarkt), without the
 * disambiguator. Spoiler screening needs them: asking "Nieuwmarkt" while the
 * square is labelled "New Market" gives the answer away.
 */
export function placeAliases(item: { name?: string; wikipedia?: string }): string[] {
  const m = /^nl:(.+)$/.exec(item.wikipedia || '');
  const nl = m ? m[1].replace(/\s*\([^)]*\)\s*$/, '').trim() : '';
  return nl && nl !== item.name ? [nl] : [];
}
