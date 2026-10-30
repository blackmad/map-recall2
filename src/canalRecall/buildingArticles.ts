/**
 * Wikipedia articles about ordinary buildings — the ones no landmark or POI
 * layer claims (Emerald Empire on KNSM-eiland, user report 2026-10-30).
 *
 * The landmark extract admits a building only through tourism/historic/civic
 * tags, so an apartment ring with a `wikipedia` tag, or a Wikidata item whose
 * coordinates fall inside a footprint, never reached a card. These records
 * ride beside the building-fact tiles (`building-articles/14/x/y.json.gz`,
 * keyed by the same short pand id) and the click card shows the lede with a
 * Wikipedia link. Kicker stays BUILDING: an article does not make a quiz
 * landmark.
 *
 * Built by `scripts/build-building-articles.ts`; audited by
 * `scripts/audit-wikipedia-building-articles.ts`.
 */

export const BUILDING_ARTICLE_VERSION = 1;
/** Longest lede a card shows; the builder clips at a sentence end before this. */
export const ARTICLE_EXTRACT_CHARS = 360;

/** One building's article as a tile stores it (short keys: ~1,300 of these ship). */
export interface BuildingArticle {
  /** Article title, the card's name ("Emerald Empire"). */
  t: string;
  /** Article URL. */
  u: string;
  /** Lede, at most ARTICLE_EXTRACT_CHARS; English unless `l` says otherwise. */
  e: string;
  /** Language of `e` when it is not English ("nl"): the card badges it. */
  l?: string;
  /** Thumbnail URL. */
  i?: string;
  /** Wikidata item. */
  q?: string;
}

export interface BuildingArticleTile {
  version: number;
  buildings: Record<string, BuildingArticle>;
}

/** Which z14 tiles have an article file, so the store never asks for the rest. */
export interface BuildingArticleIndex {
  version: number;
  tiles: string[];
}

/** Wikidata P31 class labels that mean "a building you can stand in front of". */
export const BUILDING_CLASS_RE = /build|house|church|office|warehouse|hotel|theat|school|museum|windmill|station|synagogue|mosque|chapel|monaster|hospital|palace|castle|gate|tower|hall|cinema|library|brewery|factory|mill|bank|shop|store|university|college|gable|villa|mansion|squat|prison|court|embassy|fort|bunker|barracks|distillery|residen|apartment|complex|hofje|almshouse|orphanage|pavilion|stadium|arena|concert|opera|depot|pumping|lighthouse|observatory|laboratory|headquarters|skyscraper|high-rise|dwelling|farm|inn|cafe|restaurant|pub|bar\b|club/i;
/** Classes whose coordinates land in a footprint without being about it:
 *  the street in front, the district around, the event once held there. */
export const EXCLUDED_CLASS_RE = /destroyed|former|demolished|event|discipline|organization|organisation|club$|team|company|business|festival|competition|street|neighbo|village|bridge|polder|canal|river|island|municipality|district|quarter|square|park\b|cemetery|road|railway line|metro line|tram line|route/i;

/** A Wikidata item is a building when any class says so and none says otherwise. */
export function isBuildingClass(classes: readonly string[]): boolean {
  const joined = classes.join('|');
  return BUILDING_CLASS_RE.test(joined) && !EXCLUDED_CLASS_RE.test(joined);
}

export interface ArticleCandidate {
  /** 'osm-tag': the footprint itself names the article; 'point': Wikidata coordinates inside it. */
  how: 'osm-tag' | 'point';
  sitelinks: number;
  hasEnglish: boolean;
}

/** When several articles claim one footprint (Hirschgebouw: the shop and the
 *  city gate), the mapper's own tag wins, then the better-known item. */
export function pickArticle<T extends ArticleCandidate>(candidates: readonly T[]): T | null {
  let best: T | null = null;
  for (const candidate of candidates) {
    if (!best || rank(candidate) > rank(best)) best = candidate;
  }
  return best;
}
const rank = (c: ArticleCandidate) => (c.how === 'osm-tag' ? 1000 : 0) + c.sitelinks * 2 + (c.hasEnglish ? 1 : 0);

/** Clip a lede at a sentence end within `max` characters; a lede with no
 *  sentence end that early is cut at a word with an ellipsis. */
export function clipExtract(text: string, max = ARTICLE_EXTRACT_CHARS): string {
  const clean = text.replace(/\s+/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim();
  if (clean.length <= max) return clean;
  const head = clean.slice(0, max + 1);
  let cut = -1;
  for (const m of head.matchAll(/[.!?]["”’)]?(?=\s)/g)) {
    const end = m.index! + m[0].length;
    // "St. Nicolaas" and "c. 1660" are not sentence ends.
    if (/\b(?:St|c|ca|nr|no|dr|ir|mr|prof|jr|sr)\.$/i.test(head.slice(0, end))) continue;
    cut = end;
  }
  if (cut >= Math.min(80, max / 3)) return head.slice(0, cut).trim();
  const words = head.slice(0, max - 1);
  return `${words.slice(0, words.lastIndexOf(' ')).trim()}…`;
}

/** A register line worth keeping under an article; the "nothing known" fallback is not. */
export function registerLineUnderArticle(factDetail: string): string {
  return /^This building has no /.test(factDetail) ? '' : factDetail;
}

/**
 * The card for a building that has an article: the article names it (unless
 * the name would spoil a question, then the register's title stays), the lede
 * is the body, the register line follows in the expanded panel.
 */
export function articleCard(
  article: BuildingArticle,
  facts: { name: string; detail: string },
  titleSpoils = false,
): { name: string; detail: string; longDetail: string; wikipediaUrl: string; imageUrl: string; extractLang: string; wikidata?: string } {
  const register = registerLineUnderArticle(facts.detail);
  return {
    name: titleSpoils ? facts.name : article.t,
    detail: article.e,
    longDetail: register ? `${article.e}\n\n${register}` : article.e,
    wikipediaUrl: article.u,
    imageUrl: article.i ?? '',
    extractLang: article.l ?? 'en',
    ...(article.q ? { wikidata: article.q } : {}),
  };
}

/** Parse an OSM `wikipedia=lang:Title` tag. */
export function parseWikipediaTag(tag: string | null | undefined): { lang: string; title: string } | null {
  if (!tag) return null;
  const m = /^([a-z]{2,3}):(.+)$/.exec(tag.trim());
  if (!m) return null;
  const title = m[2].replace(/_/g, ' ').trim();
  return title ? { lang: m[1], title } : null;
}
