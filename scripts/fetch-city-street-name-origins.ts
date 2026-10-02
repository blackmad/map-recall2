/**
 * Stage a city's official street-name explanations for translation and review.
 *
 *   npx tsx scripts/fetch-city-street-name-origins.ts --city=rotterdam
 *
 * Writes `<extract>/staging/street-name-origins.json`: one Dutch origin per
 * name the game can ask (streets-routing, streets, water, bridges), with the
 * register record it came from and a per-entry source URL. English is added by
 * `translate-city-street-name-origins.ts`; nothing reaches the game until
 * `publish-city-street-name-origins.ts` writes the extract file.
 *
 * Registers (researched 2026-10-01):
 *
 *  rotterdam  Gemeente Rotterdam, "Openbare Straatnamen en toelichtingen"
 *             (ArcGIS item 987517c0485642f5b28f42f0ce30a7a1), the public
 *             version of the street-name database behind the Stadsarchief's
 *             street-name map and the QR codes on Rotterdam's name signs.
 *             9,234 records, field `Beschrijving`. The item states no licence;
 *             the same Stadsarchief Rotterdam street-naming database is
 *             catalogued as CC0 1.0 on data.overheid.nl
 *             ("straatnamen-van-rotterdam"), whose CSV link is dead.
 *
 *  utrecht, den-haag  No open register of street-name explanations found:
 *             Utrecht's explanations are in a copyrighted book (Het Utrechts
 *             straatnamenboek, 2023) and Den Haag publishes none on its data
 *             platform. Not fetched rather than scraped.
 *
 * A re-fetch keeps every translation whose Dutch is unchanged.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  dutchHash, indexRecords, nameKey, originDutch, recordFor, registerKind,
  type RegisterRecord, type StagedCityOrigin,
} from './lib/cityStreetNameOrigins.ts';

interface RegisterSource {
  url: string;
  field: string;
  licence: string;
  fetch(): Promise<RegisterRecord[]>;
}

const ROTTERDAM_LAYER = 'https://services.arcgis.com/zP1tGdLpGvt2qNJ6/arcgis/rest/services/Straatnamen_dataset_openbaar/FeatureServer/0';

const SOURCES: Record<string, RegisterSource> = {
  rotterdam: {
    url: ROTTERDAM_LAYER,
    field: 'Beschrijving',
    licence: 'No licence stated on the ArcGIS item (Gemeente Rotterdam, "Openbare Straatnamen en toelichtingen", '
      + 'https://www.arcgis.com/home/item.html?id=987517c0485642f5b28f42f0ce30a7a1); the same Stadsarchief Rotterdam '
      + 'street-naming database is catalogued as CC0 1.0 at https://data.overheid.nl/dataset/straatnamen-van-rotterdam',
    async fetch() {
      const records: RegisterRecord[] = [];
      for (let offset = 0; ; offset += 2000) {
        const url = new URL(`${ROTTERDAM_LAYER}/query`);
        url.search = new URLSearchParams({
          where: '1=1', outFields: 'ObjectId,Straatnaam,Beschrijving', returnGeometry: 'true', outSR: '4326',
          resultOffset: String(offset), resultRecordCount: '2000', orderByFields: 'ObjectId', f: 'json',
        }).toString();
        const response = await fetch(url, { headers: { 'User-Agent': 'MapRecallStreetNames/1.0 (https://github.com/blackmad/map-recall2)' } });
        if (!response.ok) throw new Error(`Rotterdam register ${response.status}`);
        const page = await response.json() as { features: Array<{ attributes: Record<string, string | number | null>; geometry?: { x: number; y: number } }>; exceededTransferLimit?: boolean };
        for (const feature of page.features) {
          const { ObjectId, Straatnaam, Beschrijving } = feature.attributes;
          if (!Straatnaam) continue;
          records.push({
            id: String(ObjectId),
            name: String(Straatnaam).trim(),
            nlFull: String(Beschrijving ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim(),
            sourceUrl: `${ROTTERDAM_LAYER}/${ObjectId}`,
            ...(feature.geometry ? { lat: feature.geometry.y, lon: feature.geometry.x } : {}),
          });
        }
        if (!page.exceededTransferLimit && page.features.length < 2000) break;
      }
      return records;
    },
  },
};

const cityArg = process.argv.find((arg) => arg.startsWith('--city='))?.slice('--city='.length) ?? '';
const source = SOURCES[cityArg];
if (!source) {
  process.stdout.write(`No open street-name register is configured for "${cityArg}". Known: ${Object.keys(SOURCES).join(', ')}.\n`);
  process.exit(cityArg === 'utrecht' || cityArg === 'den-haag' ? 0 : 1);
}
const directory = path.resolve(`public/data/extracts/${cityArg}`);
const stagingFile = path.join(directory, 'staging/street-name-origins.json');

export interface StagedCityOrigins {
  version: 1;
  source: { url: string; field: string; retrievedAt: string; licence: string };
  origins: StagedCityOrigin[];
  /** Names the register explains twice with no nearby point to choose by. */
  ambiguous: string[];
}

const records = await source.fetch();
const index = indexRecords(records);

type Feature = { name?: string; center?: [number, number] };
const partition = async (file: string) => {
  const data = JSON.parse(await readFile(path.join(directory, file), 'utf8')) as Feature[];
  const centers = new Map<string, Array<[number, number]>>();
  for (const feature of data) {
    if (!feature.name) continue;
    const list = centers.get(feature.name) ?? centers.set(feature.name, []).get(feature.name)!;
    if (feature.center) list.push(feature.center);
  }
  return centers;
};

const previous: StagedCityOrigins | null = JSON.parse(await readFile(stagingFile, 'utf8').catch(() => 'null'));
const kept = new Map((previous?.origins ?? []).filter((origin) => origin.en || origin.refused)
  .map((origin) => [`${origin.name}\u0000${origin.nl}`, origin]));
// The committed cache (written by publish-city-street-name-origins.ts) keeps
// translations across a fresh checkout, where staging/ does not exist.
const cached = new Map((JSON.parse(await readFile(path.resolve(`scripts/data/street-name-origin-translations.${cityArg}.json`), 'utf8').catch(() => '[]')) as
  Array<{ name: string; hash: string; en: string; enSource: string }>).map((entry) => [`${entry.name}\u0000${entry.hash}`, entry]));

const origins = new Map<string, StagedCityOrigin>();
const ambiguous = new Set<string>();
const report: string[] = [];
for (const [file, kind] of [['streets-routing.json', 'street'], ['streets.json', 'street'], ['water.json', 'water'], ['bridges.json', 'bridge']] as const) {
  const centers = await partition(file);
  let explained = 0;
  for (const [name, points] of centers) {
    const candidates = (index.get(nameKey(name)) ?? [])
      // A bridge is explained only by a bridge record; a street or water
      // name by any record (a quay and its harbour share one text).
      .filter((record) => kind !== 'bridge' || registerKind(record.name) === 'bridge');
    const choice = recordFor(candidates, points);
    if (!choice.record) { if (choice.reason === 'ambiguous') ambiguous.add(name); continue; }
    const nl = originDutch(choice.record.nlFull);
    if (!nl) continue;
    explained++;
    const key = `${kind}\u0000${name}`;
    if (origins.has(key)) continue;
    const staged: StagedCityOrigin = { name, kind, recordId: choice.record.id, sourceUrl: choice.record.sourceUrl, nl };
    const old = kept.get(`${name}\u0000${nl}`) ?? cached.get(`${name}\u0000${dutchHash(nl)}`);
    if (old?.en) { staged.en = old.en; staged.enSource = old.enSource; }
    else if (old && 'refused' in old && old.refused) staged.refused = old.refused;
    origins.set(key, staged);
  }
  report.push(`  ${file}: ${explained} of ${centers.size} names explained (${((explained / Math.max(1, centers.size)) * 100).toFixed(1)}%)`);
}

const staged: StagedCityOrigins = {
  version: 1,
  source: { url: source.url, field: source.field, retrievedAt: new Date().toISOString(), licence: source.licence },
  origins: [...origins.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name, 'nl')),
  ambiguous: [...ambiguous].sort(),
};
await mkdir(path.dirname(stagingFile), { recursive: true });
await writeFile(stagingFile, `${JSON.stringify(staged, null, 1)}\n`);
process.stdout.write(`${records.length} register records → ${staged.origins.length} staged origins`
  + ` (${staged.origins.filter((origin) => origin.en).length} already translated), ${ambiguous.size} ambiguous names withheld\n`
  + `  → ${path.relative(process.cwd(), stagingFile)}\n${report.join('\n')}\n`);
