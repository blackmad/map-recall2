import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { cachedJsonFetch } from './lib/cached-json-fetch.ts';

interface Entity {
  labels?: Record<string, { value?: string }>;
  descriptions?: Record<string, { value?: string }>;
  claims?: Record<string, Claim[]>;
}
interface Claim {
  rank?: 'preferred' | 'normal' | 'deprecated';
  mainsnak?: { datavalue?: { value?: any } };
  qualifiers?: Record<string, Array<{ datavalue?: { value?: any } }>>;
}

const argument = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const directory = path.resolve(argument('directory') || 'public/data/extracts/amsterdam');
const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8')) as { cityId: string; source?: string };
const cityName = argument('name') || manifest.source?.match(/BBBike (.+) extract/)?.[1] || manifest.cityId;
const knownQids: Record<string, string> = { amsterdam: 'Q727', utrecht: 'Q803' };
const headers = { 'User-Agent': 'MapRecallCityProfile/1.0 (https://github.com/blackmad/map-recall2)' };
const fetchJson = <T = any>(url: URL) => cachedJsonFetch<T>(url, {
  cacheDirectory: '.cache/wikimedia', headers, pauseMs: 250,
});

async function findCityQid(): Promise<string> {
  const explicit = argument('qid') || knownQids[manifest.cityId];
  if (explicit) return explicit;
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.search = new URLSearchParams({ action: 'wbsearchentities', format: 'json', language: 'en', type: 'item', limit: '1', search: cityName }).toString();
  const data = await fetchJson<{ search?: Array<{ id?: string }> }>(url);
  const qid = data.search?.[0]?.id;
  if (!qid) throw new Error(`No Wikidata item found for ${cityName}`);
  return qid;
}

async function entities(ids: string[]): Promise<Record<string, Entity>> {
  if (!ids.length) return {};
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.search = new URLSearchParams({
    action: 'wbgetentities', format: 'json', ids: ids.join('|'), props: 'labels|descriptions|claims', languages: 'en|nl', languagefallback: '1',
  }).toString();
  return (await fetchJson<{ entities?: Record<string, Entity> }>(url)).entities || {};
}

const preferredClaim = (entity: Entity, property: string): Claim | undefined => {
  const claims = (entity.claims?.[property] || []).filter((claim) => claim.rank !== 'deprecated');
  return claims.find((claim) => claim.rank === 'preferred')
    || claims.find((claim) => !claim.qualifiers?.P582)
    || claims[0];
};
const claimValue = (entity: Entity, property: string) => preferredClaim(entity, property)?.mainsnak?.datavalue?.value;
const entityId = (value: any): string | undefined => value?.id;
const commonsFilename = (entity: Entity, property: string): string | undefined => claimValue(entity, property);

async function commonsUrls(files: string[]): Promise<Record<string, string>> {
  if (!files.length) return {};
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.search = new URLSearchParams({
    action: 'query', format: 'json', prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '800',
    titles: files.map((file) => `File:${file}`).join('|'),
  }).toString();
  const data = await fetchJson<{ query?: { pages?: Record<string, { title?: string; imageinfo?: Array<{ thumburl?: string; url?: string }> }> } }>(url);
  return Object.fromEntries(Object.values(data.query?.pages || {}).flatMap((page) => {
    const file = page.title?.replace(/^File:/, '');
    const image = page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url;
    return file && image ? [[file, image]] : [];
  }));
}

const qid = await findCityQid();
const city = (await entities([qid]))[qid];
if (!city) throw new Error(`Wikidata item ${qid} was not returned`);
const mayorQid = entityId(claimValue(city, 'P6'));
const colorQids = (city.claims?.P462 || []).flatMap((claim) => {
  const id = entityId(claim.mainsnak?.datavalue?.value);
  return id ? [id] : [];
});
const related = await entities([...(mayorQid ? [mayorQid] : []), ...colorQids]);
const mayor = mayorQid ? related[mayorQid] : undefined;
const flagFile = commonsFilename(city, 'P41');
const armsFile = commonsFilename(city, 'P94');
const mayorFile = mayor ? commonsFilename(mayor, 'P18') : undefined;
const imageUrls = await commonsUrls([flagFile, armsFile, mayorFile].filter((file): file is string => Boolean(file)));
const label = (entity: Entity | undefined) => entity?.labels?.en?.value || entity?.labels?.nl?.value;
const population = claimValue(city, 'P1082');
const populationDate = preferredClaim(city, 'P1082')?.qualifiers?.P585?.[0]?.datavalue?.value;
const inception = claimValue(city, 'P571');

const profile = {
  cityId: manifest.cityId,
  wikidata: qid,
  name: label(city) || cityName,
  description: city.descriptions?.en?.value || city.descriptions?.nl?.value,
  colors: colorQids.map((id) => ({ wikidata: id, name: label(related[id]) })).filter((color) => color.name),
  population: typeof population?.amount === 'string' ? Number(population.amount) : undefined,
  populationAsOf: populationDate?.time,
  inception: inception?.time,
  officialWebsite: claimValue(city, 'P856'),
  flag: flagFile ? { file: flagFile, imageUrl: imageUrls[flagFile], source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(flagFile)}` } : undefined,
  coatOfArms: armsFile ? { file: armsFile, imageUrl: imageUrls[armsFile], source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(armsFile)}` } : undefined,
  headOfGovernment: mayor ? {
    wikidata: mayorQid, name: label(mayor),
    description: mayor.descriptions?.en?.value || mayor.descriptions?.nl?.value,
    image: mayorFile ? { file: mayorFile, imageUrl: imageUrls[mayorFile], source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(mayorFile)}` } : undefined,
  } : undefined,
};
await writeFile(path.join(directory, 'city-profile.json'), `${JSON.stringify(profile, null, 2)}\n`);
const manifestFile = path.join(directory, 'manifest.json');
const updatedManifest = JSON.parse(await readFile(manifestFile, 'utf8'));
updatedManifest.cityProfile = { file: 'city-profile.json', wikidata: qid };
await writeFile(manifestFile, `${JSON.stringify(updatedManifest, null, 2)}\n`);
process.stdout.write(`Wrote ${profile.name} city profile (${qid}) to ${directory}\n`);
