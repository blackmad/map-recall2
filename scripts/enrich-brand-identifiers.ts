import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { cachedJsonFetch } from './lib/cached-json-fetch.ts';

interface Chain {
  name: string;
  brandWikidata?: string;
  count: number;
  icon?: string;
  iconUrl?: string;
}

interface Poi {
  brandWikidata?: string;
  icon?: string;
  iconUrl?: string;
}

interface Claim {
  rank?: 'preferred' | 'normal' | 'deprecated';
  mainsnak?: { datavalue?: { value?: unknown } };
}

interface Entity {
  labels?: Record<string, { value?: string }>;
  descriptions?: Record<string, { value?: string }>;
  claims?: Record<string, Claim[]>;
}

interface BrandIdentifier {
  name: string;
  wikidata: string;
  description?: string;
  officialWebsite?: string;
  logo?: {
    id: string;
    file: string;
    imageUrl: string;
    source: string;
  };
}

const argument = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const directory = path.resolve(argument('directory') || 'public/data/extracts/amsterdam');
const manifestFile = path.join(directory, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestFile, 'utf8')) as { majorChains?: Chain[]; brandIdentifiers?: unknown };
const chains = manifest.majorChains || [];
const qids = [...new Set(chains.flatMap((chain) => chain.brandWikidata ? [chain.brandWikidata] : []))];
const headers = { 'User-Agent': 'MapRecallBrandIdentifiers/1.0 (https://github.com/blackmad/map-recall2)' };
const chunks = <T>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
const fetchJson = <T = any>(url: URL) => cachedJsonFetch<T>(url, {
  cacheDirectory: '.cache/wikimedia', headers, pauseMs: 250,
});

const entities: Record<string, Entity> = {};
for (const batch of chunks(qids, 50)) {
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.search = new URLSearchParams({
    action: 'wbgetentities', format: 'json', ids: batch.join('|'),
    props: 'labels|descriptions|claims', languages: 'en|nl', languagefallback: '1',
  }).toString();
  Object.assign(entities, (await fetchJson<{ entities?: Record<string, Entity> }>(url)).entities || {});
}

const claimValue = (entity: Entity, property: string): unknown => {
  const claims = (entity.claims?.[property] || []).filter((claim) => claim.rank !== 'deprecated');
  const claim = claims.find((candidate) => candidate.rank === 'preferred') || claims[0];
  return claim?.mainsnak?.datavalue?.value;
};
const logoFiles = [...new Set(qids.flatMap((qid) => {
  const value = claimValue(entities[qid] || {}, 'P154');
  return typeof value === 'string' ? [value] : [];
}))];
const logoUrls = new Map<string, string>();
for (const batch of chunks(logoFiles, 20)) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.search = new URLSearchParams({
    action: 'query', format: 'json', redirects: '1', prop: 'imageinfo', iiprop: 'url', iiurlwidth: '256',
    titles: batch.map((file) => `File:${file}`).join('|'),
  }).toString();
  const data = await fetchJson<{ query?: { pages?: Record<string, { title?: string; imageinfo?: Array<{ thumburl?: string; url?: string }> }> } }>(url);
  for (const page of Object.values(data.query?.pages || {})) {
    const file = page.title?.replace(/^File:/, '');
    const imageUrl = page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url;
    if (file && imageUrl) logoUrls.set(file, imageUrl);
  }
}

const identifiers: BrandIdentifier[] = chains.flatMap((chain) => {
  if (!chain.brandWikidata) return [];
  const entity = entities[chain.brandWikidata] || {};
  const logoFile = claimValue(entity, 'P154');
  const imageUrl = typeof logoFile === 'string' ? logoUrls.get(logoFile) : undefined;
  const logoId = `brand-${chain.brandWikidata.toLowerCase()}`;
  return [{
    name: chain.name,
    wikidata: chain.brandWikidata,
    description: entity.descriptions?.en?.value || entity.descriptions?.nl?.value,
    officialWebsite: typeof claimValue(entity, 'P856') === 'string' ? claimValue(entity, 'P856') as string : undefined,
    logo: logoFile && imageUrl ? {
      id: logoId, file: logoFile as string, imageUrl,
      source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(logoFile as string)}`,
    } : undefined,
  }];
});
const byQid = new Map(identifiers.map((identifier) => [identifier.wikidata, identifier]));
for (const chain of chains) {
  const logo = chain.brandWikidata ? byQid.get(chain.brandWikidata)?.logo : undefined;
  if (!logo) continue;
  chain.icon = logo.id;
  chain.iconUrl = logo.imageUrl;
}
const poisFile = path.join(directory, 'branded-pois.json');
const pois = JSON.parse(await readFile(poisFile, 'utf8')) as Poi[];
for (const poi of pois) {
  const logo = poi.brandWikidata ? byQid.get(poi.brandWikidata)?.logo : undefined;
  if (!logo) continue;
  poi.icon = logo.id;
  poi.iconUrl = logo.imageUrl;
}
await writeFile(path.join(directory, 'brand-identifiers.json'), `${JSON.stringify(identifiers, null, 2)}\n`);
await writeFile(poisFile, JSON.stringify(pois));
manifest.brandIdentifiers = {
  file: 'brand-identifiers.json', count: identifiers.length,
  logoCount: identifiers.filter((identifier) => identifier.logo).length,
};
await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`Resolved ${identifiers.length} brand identities and ${identifiers.filter((identifier) => identifier.logo).length} logos\n`);
