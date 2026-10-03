/**
 * "Local knowledge" facts for neighbourhood cards: the one thing a resident
 * would tell you about an area (Buitenveldert is the city's modern Jewish
 * quarter; the Spaarndammerbuurt is the showpiece of the Amsterdam School).
 *
 * The description/history/name-origin pipeline reads an article's lede, its
 * History section and its naming sentences. Facts like these sit elsewhere:
 * in sections about culture, facilities, schools, shops or residents, or are
 * visible only as a cluster of places inside the outline (several synagogues
 * and Jewish schools). This module turns whole articles and the places inside
 * an outline into scored, sourced candidates; a reviewer (a Claude session or
 * a person) then picks and words one per area, citing candidate ids.
 *
 * Pure functions only; fetching lives in `scripts/mine-area-facts.ts`.
 */

export interface ArticleSource { lang: 'en' | 'nl'; title: string; url: string; text: string }

export interface SentenceCandidate {
  id: string;
  kind: 'sentence';
  lang: 'en' | 'nl';
  section: string;
  text: string;
  sourceUrl: string;
  score: number;
  signals: string[];
}

export interface PlaceCluster {
  id: string;
  kind: 'places';
  /** What the places are, e.g. "synagogue" (see `classifyOsm`). */
  category: string;
  names: string[];
  items: string[];
  score: number;
}

export type AreaCandidate = SentenceCandidate | PlaceCluster;

/**
 * Text the cards do not carry, matching the review rules already applied to
 * Utrecht/Rotterdam (HISTORY 2026-10-02): resident statistics, crime and
 * policing, and municipal planning boilerplate. A community described through
 * its institutions (synagogues, schools, markets) is allowed; percentages and
 * counts of residents by origin or religion are not.
 */
const EXCLUDE: Array<[string, RegExp]> = [
  ['statistics', /\d+(?:[.,]\d+)?\s*(?:%|procent|percent)|\b(?:inwoners|residents|inhabitants|population|bevolking(?:sdichtheid)?|huishoudens|households)\b.*\d|\bBBGA\b|\bCBS\b/i],
  ['origin-statistics', /\b(?:allochto|migratieachtergrond|migration background|ten minste (?:een|één) ouder|at least one parent|niet-westers|non-western|ethnic(?:ity)?|etniciteit)\w*/i],
  ['crime', /\b(?:criminal|crime|criminaliteit|overlast|drug(?:s|shandel)?|politie|police|ontvoer|kidnap|moord|murder|probleemwijk|aandachtswijk|krachtwijk|vogelaarwijk|achterstandswijk|deprived|veiligheid)\w*/i],
  ['planning', /\b(?:bestemmingsplan|stadsdeelraad|gemeenteraad|council decided|zoning)\b/i],
];

/** Signals that a sentence says something distinctive about the place. */
const SIGNALS: Array<[string, RegExp, number]> = [
  ['known-for', /\b(?:known (?:for|as)|famous|renowned|considered|nicknamed|bijnaam|bekend (?:om|als|staat)|staat bekend|beroemd|geldt als|wordt beschouwd)\b/i, 3],
  ['superlative', /\b(?:only|first|oldest|largest|biggest|longest|last|unique|enige|eerste|oudste|grootste|langste|laatste|uniek)\b/i, 2],
  ['community', /\b(?:community|communities|quarter|gemeenschap|wijk van de|centre of|centrum (?:van|voor)|home to|hart van)\b/i, 2],
  ['institution', /\b(?:synago\w*|mosque|moskee|church|kerk|temple|tempel|market|markt|school|museum|theat(?:er|re)|brewery|brouwerij|factory|fabriek|studio|club|festival|stadium|stadion)\b/i, 1.5],
  ['culture', /\b(?:artists?|kunstenaars?|writers?|schrijvers?|musicians?|muzikanten|film(?:ed)?|song|lied|novel|roman|painted|schilderde|cabaret|carnival)\b/i, 1.5],
  ['architecture', /\b(?:Amsterdam School|Amsterdamse School|architect\w*|Berlage|De Klerk|Kramer|garden village|tuindorp|tuinstad|concrete|beton)\b/i, 1.5],
  ['people', /\b(?:was born|born and raised|grew up|geboren|groeide op|woonde(?:n)? (?:hier|vroeger|in))\b/i, 2],
  ['dated', /\b(?:1[0-9]{3}|20[0-2][0-9])\b/, 0.5],
];

/** Headings whose prose is boilerplate for a card (lists, references, transport tables). */
const SKIP_HEADINGS = /^(?:see also|zie ook|references|referenties|bronnen|noten|notes|external links|externe links|literature|literatuur|gallery|galerij|straten|streets|openbaar vervoer|public transport|transport|verkeer|bevolking|demographics|demografie|population|politiek|politics|bestuur)\b/;

export function splitSections(text: string): Array<{ heading: string; body: string }> {
  const parts = text.split(/\n(={2,})\s*(.+?)\s*\1\n/);
  const out = [{ heading: 'lede', body: parts[0] }];
  for (let i = 1; i + 1 < parts.length; i += 3) out.push({ heading: (parts[i + 1] || '').trim().toLowerCase(), body: parts[i + 2] || '' });
  return out.filter(s => s.body.trim());
}

export function excludedBy(sentence: string): string | null {
  for (const [label, pattern] of EXCLUDE) if (pattern.test(sentence)) return label;
  return null;
}

export function scoreSentence(sentence: string, heading: string, areaName: string): { score: number; signals: string[] } {
  const signals: string[] = [];
  let score = 0;
  for (const [label, pattern, weight] of SIGNALS) if (pattern.test(sentence)) { signals.push(label); score += weight; }
  if (sentence.toLowerCase().includes(areaName.toLowerCase().split(/[\s/-]/)[0])) { signals.push('names-area'); score += 0.5; }
  // Administrative ledes ("X is a neighbourhood in borough Y") are what the card already says.
  if (/\b(?:is (?:a|an) (?:neighbo(?:u)?rhood|district|quarter)|is een (?:buurt|wijk)|maakt deel uit|part of the borough|stadsdeel)\b/i.test(sentence) && !signals.includes('known-for')) score -= 2;
  if (heading === 'lede') score += 0.5;
  if (sentence.length < 50 || sentence.length > 400) score -= 1;
  return { score, signals };
}

/** Every eligible sentence of every article, scored, best first. `sentencesOf` splits (and tidies) a section body. */
export function sentenceCandidates(articles: readonly ArticleSource[], areaName: string, sentencesOf: (text: string) => string[], prefix = 's'): SentenceCandidate[] {
  const out: SentenceCandidate[] = [];
  const seen = new Set<string>();
  for (const article of articles) {
    for (const { heading, body } of splitSections(article.text)) {
      if (SKIP_HEADINGS.test(heading)) continue;
      for (const raw of sentencesOf(body)) {
        const text = raw.trim();
        if (seen.has(text) || excludedBy(text)) continue;
        seen.add(text);
        const { score, signals } = scoreSentence(text, heading, areaName);
        if (score < 1.5) continue;
        out.push({ id: '', kind: 'sentence', lang: article.lang, section: heading, text, sourceUrl: article.url, score, signals });
      }
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out.map((c, i) => ({ ...c, id: `${prefix}${i + 1}` }));
}

export interface PlaceItem { qid: string; label: string; classLabel: string; lat: number; lng: number }

/**
 * What an OpenStreetMap feature is, in words a card can use, or null when it
 * is not the kind of place whose clustering says anything about an area.
 * Cuisine clusters are kept ("Japanese restaurants"): they are often what a
 * local means by an area's character, and they describe places, not people.
 */
export function classifyOsm(tags: Record<string, string>): string | null {
  const religion = tags.religion;
  if (tags.amenity === 'place_of_worship') {
    if (religion === 'jewish') return 'synagogue';
    if (religion === 'muslim') return 'mosque';
    if (religion === 'christian') return 'church';
    if (religion === 'hindu') return 'Hindu temple';
    if (religion === 'buddhist') return 'Buddhist temple';
    if (religion === 'sikh') return 'gurdwara';
    return 'place of worship';
  }
  if (['school', 'kindergarten', 'college'].includes(tags.amenity ?? '') && religion === 'jewish') return 'Jewish school';
  if (['school', 'kindergarten', 'college'].includes(tags.amenity ?? '') && religion === 'muslim') return 'Islamic school';
  if (/^(?:yes|only)$/.test(tags['diet:kosher'] ?? '') || /\b(?:kosher|jewish)\b/.test(tags.cuisine ?? '')) return 'kosher shop or restaurant';
  if (tags.amenity === 'marketplace') return 'market';
  if (tags.craft === 'brewery' || tags.craft === 'distillery') return 'brewery or distillery';
  if (tags.man_made === 'windmill') return 'windmill';
  if (tags.tourism === 'museum') return 'museum';
  if (tags.amenity === 'theatre') return 'theatre';
  if (tags.amenity === 'studio') return 'studio';
  if (tags.leisure === 'garden' && tags.garden_type === 'community') return 'community garden';
  if (tags.amenity === 'restaurant' && tags.cuisine) {
    const cuisine = tags.cuisine.split(/[;,]/)[0].trim();
    if (!/^(?:regional|international|dutch|european|pizza|burger|italian|french|sandwich|fast_food|coffee_shop|steak_house|seafood|fish|grill|vegetarian|vegan|breakfast)$/.test(cuisine)) return `${cuisine.replace(/_/g, ' ')} restaurant`;
  }
  return null;
}

/**
 * Places inside an outline grouped by what they are. A class scores by how
 * many there are and by how unusual it is citywide: three synagogues in one
 * suburb say more than three schools.
 */
export function placeClusters(inside: readonly PlaceItem[], citywideCount: ReadonlyMap<string, number>, prefix = 'p'): PlaceCluster[] {
  const byClass = new Map<string, PlaceItem[]>();
  for (const item of inside) byClass.set(item.classLabel, [...(byClass.get(item.classLabel) ?? []), item]);
  const out: PlaceCluster[] = [];
  for (const [category, items] of byClass) {
    const total = citywideCount.get(category) ?? items.length;
    // Share of the city's instances that fall inside this area, weighted by count.
    const share = items.length / Math.max(total, 1);
    const score = Math.log2(1 + items.length) * (0.5 + 4 * share);
    const names = [...new Set(items.map(i => i.label).filter(Boolean))];
    out.push({ id: '', kind: 'places', category, names: names.slice(0, 8), items: items.map(i => i.qid), score: Math.round(score * 100) / 100 });
  }
  out.sort((a, b) => b.score - a.score);
  return out.map((c, i) => ({ ...c, id: `${prefix}${i + 1}` }));
}
