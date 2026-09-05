/**
 * Detect Wikipedia disambiguation / list pages that must never become cards.
 *
 * Title discovery and bare sitelinks often land on "Foo can refer to…" pages.
 * Teaching those as place encyclopedia is worse than an empty card.
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
