/**
 * Resolve `commons.wikimedia.org/wiki/Special:FilePath/...` URLs to direct
 * `upload.wikimedia.org` thumbnail URLs.
 *
 * The Special:FilePath form 302-redirects to upload.wikimedia.org. Only the
 * redirect *target* sends `Access-Control-Allow-Origin`, so a browser loading
 * one into an `<img crossOrigin="anonymous">` — which the postcard renderer
 * needs, because it draws the image into a canvas — fails CORS on the first
 * hop and never follows the redirect. Storing the resolved target avoids the
 * redirect entirely, matching how landmarks.json already stores its images.
 */
const API = 'https://commons.wikimedia.org/w/api.php';

/** File title ("File:Foo bar.jpg") from a Special:FilePath URL, or null. */
export function commonsFileTitle(url: string): string | null {
  const match = /\/wiki\/Special:FilePath\/([^?#]+)/.exec(url);
  if (!match) return null;
  return 'File:' + decodeURIComponent(match[1]).replace(/_/g, ' ');
}

const chunk = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

/** Map of file title -> thumbnail URL. Missing files are simply absent. */
export async function resolveCommonsThumbnails(titles: string[], width = 400): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  for (const batch of chunk([...new Set(titles)], 40)) {
    const params = new URLSearchParams({
      action: 'query', format: 'json', prop: 'imageinfo',
      iiprop: 'url', iiurlwidth: String(width), titles: batch.join('|'),
    });
    const response = await fetch(`${API}?${params}`, {
      headers: { 'User-Agent': 'map-recall2 neighborhood enrichment (https://github.com/blackmad/map-recall2)' },
    });
    if (!response.ok) throw new Error(`Commons API ${response.status}`);
    const data = await response.json() as {
      query?: {
        normalized?: { from: string; to: string }[];
        pages?: Record<string, { title: string; imageinfo?: { thumburl?: string; url?: string }[] }>;
      };
    };
    // The API normalises titles (underscores, capitalisation); map back so
    // callers can look up by the title they asked for.
    const denormalise = new Map((data.query?.normalized || []).map(n => [n.to, n.from]));
    for (const page of Object.values(data.query?.pages || {})) {
      const url = page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url;
      if (!url) continue;
      resolved.set(page.title, url);
      const original = denormalise.get(page.title);
      if (original) resolved.set(original, url);
    }
    await new Promise(r => setTimeout(r, 200)); // be polite to the API
  }
  return resolved;
}
