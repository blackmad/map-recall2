/**
 * Fetch JSON through the durable scrape store: return the stored body when this
 * exact URL was fetched before, otherwise fetch it (Wikimedia token on Wikimedia
 * hosts only), store it, and return it.
 */
import { readScrape, writeScrape } from './scrapeStore';

const userAgent = 'MapQuestExtractBuilder/1.0 (https://github.com/blackmad/map-recall2)';
const isWikimedia = (url: URL) => /(^|\.)(wikipedia|wikidata|wikimedia)\.org$/.test(url.hostname);

export async function cachedJson<T = unknown>(input: string | URL, init: { method?: string; body?: string; contentType?: string } = {}): Promise<T> {
  const url = new URL(input);
  // POST bodies (Overpass queries) are part of the key.
  const key = init.body ? new URL(`${url}#body=${encodeURIComponent(init.body)}`) : url;
  const stored = await readScrape<T>(key);
  if (stored) return stored.body;
  const headers: Record<string, string> = { 'User-Agent': userAgent };
  if (process.env.WIKIMEDIA_TOKEN && isWikimedia(url)) headers.Authorization = `Bearer ${process.env.WIKIMEDIA_TOKEN}`;
  if (init.contentType) headers['Content-Type'] = init.contentType;
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, { method: init.method ?? 'GET', body: init.body, headers });
    if (response.ok) {
      const body = (await response.json()) as T;
      await writeScrape(key, body);
      return body;
    }
    if (attempt >= 3 || ![429, 502, 503, 504].includes(response.status)) throw new Error(`${response.status} ${url}`);
    await new Promise(resolve => setTimeout(resolve, 2000 * 2 ** attempt));
  }
}
