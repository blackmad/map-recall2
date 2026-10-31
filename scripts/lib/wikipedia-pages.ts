/**
 * Intro extracts, page URLs, thumbnails and the interwiki link to English for
 * a batch of Wikipedia titles on one language edition, through the cached
 * JSON fetch (`.cache/wikimedia`). Shared by the building- and street-article
 * builders so both read articles the same way.
 */
import { cachedJsonFetch } from './cached-json-fetch.ts';
import { isDisambiguationExtract } from '../../src/canalRecall/game/encyclopediaDisambiguation.ts';

export interface WikipediaPage {
  title: string;
  extract?: string;
  url?: string;
  image?: string;
  /** Title of the English article this page links to, when it is not itself English. */
  englishTitle?: string;
}

const headers = { 'User-Agent': 'map-recall2 encyclopedia articles (https://github.com/blackmad/map-recall2)' };
const chunks = <T>(list: T[], size: number) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

/** Keyed by the page's own title and by every alias (normalised or redirected) that led to it. */
export async function fetchWikipediaPages(language: string, titles: string[], options: { offline?: boolean; extractChars?: number } = {}): Promise<Map<string, WikipediaPage>> {
  const details = new Map<string, WikipediaPage>();
  for (const batch of chunks([...new Set(titles.filter(Boolean))], 20)) {
    const url = new URL(`https://${language}.wikipedia.org/w/api.php`);
    url.search = new URLSearchParams({
      action: 'query', format: 'json', redirects: '1', titles: batch.join('|'),
      prop: 'extracts|info|pageimages|pageprops|langlinks', inprop: 'url', lllang: 'en', lllimit: '20',
      exintro: '1', explaintext: '1', exchars: String(options.extractChars ?? 2400), exlimit: '20', piprop: 'thumbnail', pithumbsize: '640', ppprop: 'disambiguation',
    }).toString();
    let data: any;
    try {
      data = await cachedJsonFetch(url, { cacheDirectory: '.cache/wikimedia', headers, attempts: options.offline ? 1 : 4, pauseMs: 200, maxAgeMs: options.offline ? Infinity : undefined });
    } catch (error) {
      process.stdout.write(`  ${language}: batch failed (${(error as Error).message})\n`);
      continue;
    }
    const aliases = new Map<string, string>();
    for (const item of [...(data.query?.normalized || []), ...(data.query?.redirects || [])] as { from: string; to: string }[]) aliases.set(item.from, item.to);
    for (const page of Object.values(data.query?.pages || {}) as any[]) {
      if (!page.title || page.missing !== undefined) continue;
      if (page.pageprops && 'disambiguation' in page.pageprops) continue;
      if (isDisambiguationExtract(page.extract)) continue;
      const detail: WikipediaPage = { title: page.title, extract: page.extract, url: page.fullurl, image: page.thumbnail?.source, englishTitle: page.langlinks?.find((l: any) => l.lang === 'en')?.['*'] };
      details.set(page.title, detail);
      for (const from of aliases.keys()) {
        let resolved = from;
        for (let hop = 0; hop < 3 && aliases.has(resolved); hop++) resolved = aliases.get(resolved)!;
        if (resolved === page.title) details.set(from, detail);
      }
    }
  }
  return details;
}

export const pageTitle = (page: string) => page.slice(page.indexOf(':') + 1);
export const pageLanguage = (page: string) => page.slice(0, page.indexOf(':'));
