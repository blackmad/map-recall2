/**
 * Detect Wikipedia disambiguation / list pages, and pick a city-qualified
 * follow target when one is unambiguous enough for the card.
 *
 * Title discovery and bare sitelinks often land on "Foo can refer to…" pages.
 * Teaching those as place encyclopedia is worse than an empty card — but when
 * the list includes `Name (Utrecht)` for a Utrecht feature, following that
 * link is the right encyclopedia, not silence.
 */

const DISAMBIGUATION_PATTERNS: RegExp[] = [
  /\bdisambiguation\b/i,
  /\b(can|may|might)\s+(also\s+)?refer to\b/i,
  /\bis a surname\b/i,
  /\bkan verwijzen naar\b/i,
  /\bdoorverwijspagina\b/i,
  /\bverwijzing\s+naar\b/i,
  /^wikimedia disambiguation page\.?$/i,
];

/** True when an extract is a disambiguation or surname list, not a place lede. */
export function isDisambiguationExtract(text: string | null | undefined): boolean {
  const trimmed = (text || '').trim();
  if (!trimmed) return false;
  return DISAMBIGUATION_PATTERNS.some(pattern => pattern.test(trimmed));
}

/** MediaWiki REST summary `type` for a disambiguation page. */
export function isDisambiguationSummaryType(type: string | null | undefined): boolean {
  return type === 'disambiguation';
}

const CITY_ALIASES: Record<string, readonly string[]> = {
  Amsterdam: ['Amsterdam'],
  Utrecht: ['Utrecht'],
  Rotterdam: ['Rotterdam'],
  'Den Haag': ['Den Haag', 'The Hague', "'s-Gravenhage", 's-Gravenhage', 'Haag'],
};

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Spellings of a city that appear in Wikipedia parentheticals. */
export function cityDisambiguationAliases(city: string): readonly string[] {
  const trimmed = city.trim();
  if (!trimmed) return [];
  return CITY_ALIASES[trimmed] || [trimmed];
}

/**
 * Link targets from a disambiguation wikitext page.
 * `[[Nieuwegracht (Utrecht)]]` and `[[Oudeschans (Amsterdam)|Oudeschans]]`
 * both yield the article title, not the display text.
 */
export function extractWikiLinkTitles(wikitext: string): string[] {
  const titles: string[] = [];
  const seen = new Set<string>();
  for (const match of wikitext.matchAll(/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)) {
    const title = match[1]?.trim();
    if (!title || title.startsWith('File:') || title.startsWith('Bestand:')) continue;
    const key = fold(title);
    if (seen.has(key)) continue;
    seen.add(key);
    titles.push(title);
  }
  return titles;
}

/**
 * Choose the best city-qualified target from a disambiguation link list.
 * Returns null when nothing scores confidently — silence beats a wrong city.
 */
export function pickDisambiguationTarget(
  featureName: string,
  city: string,
  linkTitles: readonly string[],
): string | null {
  const name = featureName.trim();
  if (!name || linkTitles.length === 0) return null;
  const nameFold = fold(name);
  const aliases = cityDisambiguationAliases(city).map(fold);
  if (aliases.length === 0) return null;

  let best: { title: string; score: number } | null = null;
  for (const title of linkTitles) {
    const titleFold = fold(title);
    // The disambiguation page linking to itself (or the bare feature name).
    if (titleFold === nameFold) continue;

    let score = 0;
    const paren = title.match(/\(([^)]+)\)\s*$/);
    const qualifier = paren ? fold(paren[1]) : '';
    const stem = paren ? fold(title.slice(0, paren.index).trim()) : titleFold;
    const stemMatches = stem === nameFold
      || stem.startsWith(`${nameFold} `)
      || nameFold.startsWith(stem);

    for (const alias of aliases) {
      if (titleFold === fold(`${name} (${alias})`)) score = Math.max(score, 100);
      if (qualifier === alias && stemMatches) score = Math.max(score, 90);
      if (qualifier === alias && stem.includes(nameFold)) score = Math.max(score, 70);
      if (!paren && titleFold.includes(alias) && stemMatches) score = Math.max(score, 50);
    }

    // Geographic dab pages often say "Foo (river in Utrecht)" without a clean
    // `Name (City)` form — require the feature stem plus a city alias.
    if (score === 0 && stemMatches && aliases.some(alias => titleFold.includes(alias))) {
      score = 45;
    }

    if (score < 45) continue;
    if (!best || score > best.score) best = { title, score };
  }
  return best?.title ?? null;
}
