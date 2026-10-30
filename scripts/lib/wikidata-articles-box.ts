/**
 * Every Wikidata item inside the Amsterdam box that has coordinates and a
 * Dutch or English article, cached as CSV in the extract's staging folder.
 * Shared by the building-article audit and builder so both see one list.
 */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface WikidataArticleItem {
  q: string;
  label: string;
  classes: string[];
  lng: number;
  lat: number;
  /** Article URLs, empty when that language has none. */
  nl: string;
  en: string;
  sitelinks: number;
}

export const WIKIDATA_BOX_SPARQL = `SELECT ?item ?itemLabel ?classLabel ?coord ?nl ?en ?sitelinks WHERE {
  SERVICE wikibase:box { ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:cornerSouthWest "Point(4.73 52.28)"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerNorthEast "Point(5.08 52.43)"^^geo:wktLiteral . }
  ?item wikibase:sitelinks ?sitelinks .
  OPTIONAL { ?nl schema:about ?item ; schema:isPartOf <https://nl.wikipedia.org/> . }
  OPTIONAL { ?en schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
  FILTER(BOUND(?nl) || BOUND(?en))
  OPTIONAL { ?item wdt:P31 ?class . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,nl". }
}`;

export function parseCsvLine(line: string): string[] {
  const out: string[] = []; let cell = ''; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) { if (ch === '"') { if (line[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += ch; }
    else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cell); cell = ''; }
    else cell += ch;
  }
  out.push(cell); return out;
}

/** Article title from a Wikipedia URL ("Emerald Empire"). */
export const articleTitle = (url: string) => decodeURIComponent((url.split('/wiki/')[1] ?? '').replace(/_/g, ' ')).trim();

export async function loadWikidataArticlesBox(directory = path.resolve('public/data/extracts/amsterdam')): Promise<Map<string, WikidataArticleItem>> {
  const staging = path.join(directory, 'staging');
  const csvFile = path.join(staging, 'wikidata-articles-box.csv');
  await mkdir(staging, { recursive: true });
  if (!await stat(csvFile).catch(() => null)) {
    process.stdout.write('fetching the Wikidata box query (coordinates + nl/en article)…\n');
    const response = await fetch('https://query.wikidata.org/sparql', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'text/csv', 'user-agent': 'map-recall2 building articles (https://github.com/blackmad/map-recall2)' },
      body: new URLSearchParams({ query: WIKIDATA_BOX_SPARQL }),
    });
    if (!response.ok) throw new Error(`Wikidata query service answered ${response.status}`);
    await writeFile(csvFile, await response.text());
  }
  const items = new Map<string, WikidataArticleItem>();
  for (const line of (await readFile(csvFile, 'utf8')).trim().split('\n').slice(1)) {
    const [item, label, cls, coord, nl, en, sitelinks] = parseCsvLine(line);
    const point = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(coord); if (!point) continue;
    const q = item.split('/').pop()!;
    const entry = items.get(q) ?? { q, label, classes: [], lng: Number(point[1]), lat: Number(point[2]), nl, en, sitelinks: Number(sitelinks) };
    if (cls && !entry.classes.includes(cls)) entry.classes.push(cls);
    items.set(q, entry);
  }
  return items;
}
