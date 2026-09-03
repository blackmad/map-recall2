/** On-demand Wikipedia resolution for streets missing from the curated extract.
 *
 *  The Amsterdam extract only ships encyclopedia blurbs for a prominence-capped
 *  subset of streets that already carry OSM `wikipedia` / `wikidata` tags.
 *  Plenty of driveable streets have a Dutch street article (and a person they
 *  are named after) without those tags — Nicolaas Beetsstraat is the example
 *  that turned this up. This module looks the article up by title, then prefers
 *  an English "named after" person summary so the English game can say who
 *  they were rather than only "a street in Oud-West".
 */

export const STREET_SUFFIX_PATTERN =
  /^(.*?)(straat|gracht|kade|plein|weg|laan|steeg|pad|plantsoen|brug)$/i;

/** Titles to try on Wikipedia for a street in a given city. */
export function streetArticleTitleCandidates(name: string, city = 'Amsterdam'): string[] {
  const trimmed = name.trim();
  if (!trimmed) return [];
  return [`${trimmed} (${city})`, trimmed];
}

/**
 * Person-shaped stem from a commemorative street name.
 * "Nicolaas Beetsstraat" → "Nicolaas Beets"; "Kinkerstraat" → null (one token).
 */
export function personNameFromStreet(name: string): string | null {
  const match = name.trim().match(STREET_SUFFIX_PATTERN);
  if (!match) return null;
  const stem = match[1].trim().replace(/[-–—]\s*$/, '').trim();
  if (!stem || stem.split(/\s+/).length < 2) return null;
  return stem;
}

/** Dutch street infobox field: `| genoemdnaar = [[Nicolaas Beets]]`. */
export function parseDutchNamedAfter(wikitext: string): string | null {
  const match = wikitext.match(
    /genoemdnaar\s*=\s*\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/i,
  );
  const name = match?.[1]?.trim();
  return name || null;
}

/** A street lede that only locates the road, with no naming or history. */
export function isThinStreetExtract(extract: string): boolean {
  const text = extract.trim();
  if (!text) return true;
  return /^(de\s+)?[\w\s'-]+\s+is een (straat|gracht|laan|weg|kade|plein)\b/i.test(text)
    || /^[\w\s'-]+\s+is a (street|canal|avenue|road|square)\b/i.test(text);
}

export function composeNamedAfterBlurb(personName: string, personExtract: string): string {
  const extract = personExtract.trim();
  if (!extract) return `Named after ${personName}.`;
  if (extract.toLowerCase().startsWith(personName.toLowerCase())) {
    return `Named after ${personName}. ${extract}`;
  }
  return `Named after ${personName}. ${extract}`;
}

export interface ResolvedStreetWikipedia {
  name: string;
  wikidata?: string;
  wikipedia?: string;
  wikipediaUrl: string;
  wikipediaExtract: string;
  wikipediaExtractLang: 'en' | 'nl';
}

type JsonFetcher = (url: string) => Promise<unknown>;

interface WikiSummary {
  title?: string;
  extract?: string;
  lang?: string;
  wikibase_item?: string;
  content_urls?: { desktop?: { page?: string } };
}

async function fetchSummary(
  fetchJson: JsonFetcher,
  lang: 'en' | 'nl',
  title: string,
): Promise<WikiSummary | null> {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  try {
    const data = await fetchJson(url) as WikiSummary & { type?: string; title?: string };
    if (!data || data.type === 'https://mediawiki.org/api/rest_v1/errors/not_found') return null;
    if (!data.extract && !data.content_urls?.desktop?.page) return null;
    return data;
  } catch {
    return null;
  }
}

async function fetchWikitext(
  fetchJson: JsonFetcher,
  lang: 'en' | 'nl',
  title: string,
): Promise<string> {
  const url = new URL(`https://${lang}.wikipedia.org/w/api.php`);
  url.search = new URLSearchParams({
    action: 'parse',
    page: title,
    prop: 'wikitext',
    format: 'json',
    origin: '*',
    redirects: '1',
  }).toString();
  try {
    const data = await fetchJson(url.toString()) as {
      parse?: { wikitext?: { ['*']?: string } };
    };
    return data.parse?.wikitext?.['*'] || '';
  } catch {
    return '';
  }
}

/**
 * Resolve a driveable street that is missing from `streets.json` /
 * `street-knowledge.json` into a card-ready encyclopedia entry.
 */
export async function resolveStreetWikipedia(
  name: string,
  fetchJson: JsonFetcher,
  city = 'Amsterdam',
): Promise<ResolvedStreetWikipedia | null> {
  let streetSummary: WikiSummary | null = null;
  let streetLang: 'en' | 'nl' = 'nl';
  let streetTitle = '';

  for (const title of streetArticleTitleCandidates(name, city)) {
    const english = await fetchSummary(fetchJson, 'en', title);
    if (english?.extract) {
      streetSummary = english;
      streetLang = 'en';
      streetTitle = english.title || title;
      break;
    }
    const dutch = await fetchSummary(fetchJson, 'nl', title);
    if (dutch?.extract || dutch?.content_urls?.desktop?.page) {
      streetSummary = dutch;
      streetLang = 'nl';
      streetTitle = dutch.title || title;
      break;
    }
  }
  if (!streetSummary) return null;

  const wikipediaUrl = streetSummary.content_urls?.desktop?.page
    || `https://${streetLang}.wikipedia.org/wiki/${encodeURIComponent(streetTitle.replace(/ /g, '_'))}`;
  const wikidata = streetSummary.wikibase_item;
  const streetExtract = (streetSummary.extract || '').trim();

  let personName = personNameFromStreet(name);
  if (streetLang === 'nl' && streetTitle) {
    const wikitext = await fetchWikitext(fetchJson, 'nl', streetTitle);
    personName = parseDutchNamedAfter(wikitext) || personName;
  }

  let personExtract = '';
  if (personName) {
    const person = await fetchSummary(fetchJson, 'en', personName);
    personExtract = (person?.extract || '').trim();
  }

  if (personName && personExtract && (isThinStreetExtract(streetExtract) || streetLang === 'nl')) {
    return {
      name,
      wikidata,
      wikipedia: `${streetLang}:${streetTitle}`,
      wikipediaUrl,
      wikipediaExtract: composeNamedAfterBlurb(personName, personExtract),
      wikipediaExtractLang: 'en',
    };
  }

  if (!streetExtract && !(personName && personExtract)) return null;

  if (personName && personExtract && streetExtract && streetLang === 'en') {
    return {
      name,
      wikidata,
      wikipedia: `en:${streetTitle}`,
      wikipediaUrl,
      wikipediaExtract: `${streetExtract} Named after ${personName}. ${personExtract}`,
      wikipediaExtractLang: 'en',
    };
  }

  return {
    name,
    wikidata,
    wikipedia: `${streetLang}:${streetTitle}`,
    wikipediaUrl,
    wikipediaExtract: streetExtract || composeNamedAfterBlurb(personName || name, personExtract),
    wikipediaExtractLang: streetLang,
  };
}
