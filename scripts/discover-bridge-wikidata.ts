/**
 * Give untagged bridges their Wikidata item and Wikipedia article, so the
 * existing encyclopedia passes (`enrich-amsterdam-wikipedia-extracts.ts`,
 * `translate-extracts-to-english.ts`) can fill their ledes the way they
 * filled the OSM-tagged 300.
 *
 * One SPARQL box query lists every Wikidata item around Amsterdam whose Dutch
 * label or alias names a bridge, lock or culvert; `src/canalRecall/bridgeWikidata.ts`
 * accepts a candidate only when it is within 60 m and named alike (or labelled
 * with the bridge's register number), and leaves ambiguous bridges out.
 *
 * Two steps, so the passes in between touch only the bridges being filled
 * (re-running them over the published 300 re-resolves disambiguations and
 * drops reviewed English):
 *
 *   discover   writes `<work>/bridges.json` with only the untagged bridges,
 *              tagged where a match was found, and a report beside it.
 *              `<work>` defaults to `<dir>/staging/bridge-cards/<city>/` so the
 *              city id the other passes read from the directory name resolves.
 *   --merge    copies the encyclopedia fields of the work file onto a copy of
 *              the published `bridges.json` by id, writing
 *              `<dir>/staging/bridge-cards/bridges.json`; every other bridge
 *              is left byte-identical, which the merge checks.
 *
 * Usage: npx tsx scripts/discover-bridge-wikidata.ts [--directory=…] [--work=…]
 *        npx tsx scripts/enrich-amsterdam-wikipedia-extracts.ts --directory=<work> --files=bridges.json
 *        npx tsx scripts/translate-extracts-to-english.ts --directory=<work> --translator=trn
 *        npx tsx scripts/discover-bridge-wikidata.ts --merge
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { cachedJsonFetch } from './lib/cached-json-fetch.ts';
import {
  MATCH_METRES, matchBridgeWikidata, wikipediaTag, type LatLon, type WikidataBridgeCandidate,
} from '../src/canalRecall/bridgeWikidata.ts';

const argument = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const directory = path.resolve(argument('directory') || 'public/data/extracts/amsterdam');
const work = path.resolve(argument('work') || path.join(directory, 'staging/bridge-cards', path.basename(directory)));

interface Bridge {
  id: string; name: string; center?: LatLon; path?: LatLon[]; paths?: LatLon[][];
  wikidata?: string; wikipedia?: string; askableBy?: string;
  [field: string]: unknown;
}
const bridges = JSON.parse(await readFile(path.join(directory, 'bridges.json'), 'utf8')) as Bridge[];

/** What the encyclopedia passes write onto a bridge. */
const CARD_FIELDS = [
  'wikidata', 'wikipedia', 'wikipediaUrl', 'wikipediaExtract', 'wikipediaExtractLang', 'wikipediaSourceText',
  'wikipediaImageUrl', 'wikipediaExtractSource', 'wikipediaExtractOriginal', 'wikipediaExtractOriginalLang',
];

if (process.argv.includes('--merge')) {
  const worked = new Map((JSON.parse(await readFile(path.join(work, 'bridges.json'), 'utf8')) as Bridge[])
    .map(bridge => [bridge.id, bridge]));
  let changed = 0, untouched = 0;
  const merged = bridges.map((bridge) => {
    const filled = worked.get(bridge.id);
    if (!filled) { untouched++; return bridge; }
    if (filled.name !== bridge.name) throw new Error(`${bridge.id} is ${bridge.name} published but ${filled.name} in the work file`);
    const next: Bridge = { ...bridge };
    for (const field of CARD_FIELDS) {
      if (filled[field] !== undefined && filled[field] !== '') next[field] = filled[field];
    }
    if (JSON.stringify(next) !== JSON.stringify(bridge)) changed++;
    return next;
  });
  const out = path.join(directory, 'staging/bridge-cards/bridges.json');
  await writeFile(out, JSON.stringify(merged));
  // The untouched bridges must serialise exactly as published.
  const before = new Map(bridges.map(bridge => [bridge.id, JSON.stringify(bridge)]));
  const drift = merged.filter(bridge => !worked.has(bridge.id) && before.get(bridge.id) !== JSON.stringify(bridge));
  if (drift.length) throw new Error(`${drift.length} bridges outside the work file changed`);
  // The manifest's bridges partition records the file's size and how many
  // bridges are Wikidata/Wikipedia-linked (as build-amsterdam-extract.ts counts).
  const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
  if (manifest.partitions?.bridges) {
    manifest.partitions.bridges.bytes = Buffer.byteLength(JSON.stringify(merged));
    manifest.partitions.bridges.linkedCount = merged.filter(bridge => bridge.wikidata || bridge.wikipedia).length;
    await writeFile(path.join(directory, 'staging/bridge-cards/manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  }
  process.stdout.write(`merged ${worked.size} worked bridges (${changed} changed); ${untouched} untouched and identical\n`
    + `→ ${path.relative(process.cwd(), out)}\n`);
  process.exit(0);
}

const register = JSON.parse(await readFile(path.join(directory, 'bridge-register.json'), 'utf8').catch(() => '{"bridges":{}}')) as {
  bridges: Record<string, { nr?: number }>;
};

// Amsterdam municipality's bounding box, with a margin for Weesp and the
// western docks.
const QUERY = `SELECT ?item ?coord ?nl (GROUP_CONCAT(DISTINCT ?alias; SEPARATOR="|") AS ?aliases) ?nlwiki ?enwiki WHERE {
  SERVICE wikibase:box {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:cornerSouthWest "Point(4.72 52.27)"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerNorthEast "Point(5.10 52.44)"^^geo:wktLiteral .
  }
  ?item rdfs:label ?nl . FILTER(LANG(?nl) = "nl")
  OPTIONAL { ?item skos:altLabel ?alias . FILTER(LANG(?alias) = "nl") }
  FILTER(REGEX(LCASE(?nl), "(brug|sluis|duiker)") || REGEX(LCASE(STR(?alias)), "(brug|sluis|duiker)"))
  OPTIONAL { ?nlwikiPage schema:about ?item ; schema:isPartOf <https://nl.wikipedia.org/> ; schema:name ?nlwiki . }
  OPTIONAL { ?enwikiPage schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?enwiki . }
} GROUP BY ?item ?coord ?nl ?nlwiki ?enwiki`;

const url = new URL('https://query.wikidata.org/sparql');
url.search = new URLSearchParams({ query: QUERY, format: 'json' }).toString();
const data = await cachedJsonFetch<{ results: { bindings: Array<Record<string, { value: string }>> } }>(url, {
  cacheDirectory: '.cache/wikimedia',
  headers: {
    Accept: 'application/sparql-results+json',
    'User-Agent': 'map-recall2 bridge cards (https://github.com/blackmad/map-recall2)',
  },
  maxAgeMs: 7 * 24 * 60 * 60 * 1000,
});

const byQid = new Map<string, WikidataBridgeCandidate>();
for (const row of data.results.bindings) {
  const qid = row.item.value.replace(/^.*\//, '');
  const point = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(row.coord.value);
  if (!point) continue;
  const names = [row.nl.value, ...(row.aliases?.value ? row.aliases.value.split('|') : [])];
  const existing = byQid.get(qid);
  // An item with two coordinates comes back twice; either point will do.
  if (existing) { existing.names = [...new Set([...existing.names, ...names])]; continue; }
  byQid.set(qid, {
    qid, coord: [Number(point[2]), Number(point[1])], names,
    nlwiki: row.nlwiki?.value, enwiki: row.enwiki?.value,
  });
}
const candidates = [...byQid.values()];

// A Q-id already on another bridge is that bridge's: a second bridge matching
// it is a neighbouring deck of the same structure or a mismatch.
const taken = new Set(bridges.map(bridge => bridge.wikidata).filter(Boolean));
const untagged = bridges.filter(bridge => !bridge.wikidata && !bridge.wikipedia);
const report: Array<{ id: string; name: string; qid?: string; wikipedia?: string; via?: string; metres?: number; reason?: string }> = [];
for (const bridge of untagged) {
  const match = matchBridgeWikidata({ ...bridge, registerNr: register.bridges[bridge.name]?.nr }, candidates);
  if (!match) { report.push({ id: bridge.id, name: bridge.name, reason: `no unambiguous item within ${MATCH_METRES} m` }); continue; }
  if (taken.has(match.qid)) { report.push({ id: bridge.id, name: bridge.name, qid: match.qid, reason: 'item already on another bridge' }); continue; }
  taken.add(match.qid);
  bridge.wikidata = match.qid;
  const tag = wikipediaTag(match);
  if (tag) bridge.wikipedia = tag;
  report.push({ id: bridge.id, name: bridge.name, qid: match.qid, wikipedia: tag, via: match.via, metres: Math.round(match.metres) });
}

await mkdir(work, { recursive: true });
await writeFile(path.join(work, 'bridges.json'), JSON.stringify(untagged));
await writeFile(path.join(work, 'bridge-wikidata-report.json'), `${JSON.stringify({
  candidates: candidates.length, matched: report.filter(row => row.qid && !row.reason).length, rows: report,
}, null, 1)}\n`);
const matched = report.filter(row => row.qid && !row.reason);
process.stdout.write(`${candidates.length} Wikidata bridge items in the box; ${report.length} untagged bridges, `
  + `${matched.length} matched (${matched.filter(row => row.via === 'name').length} by name, `
  + `${matched.filter(row => row.via === 'number').length} by register number), `
  + `${matched.filter(row => row.wikipedia).length} with an article\n`
  + `→ ${path.relative(process.cwd(), path.join(work, 'bridges.json'))}\n`);
for (const row of report) process.stdout.write(`  ${row.qid && !row.reason ? '+' : '-'} ${row.name}${row.qid ? ` ${row.qid}` : ''}${row.wikipedia ? ` ${row.wikipedia}` : ''}${row.via ? ` (${row.via}, ${row.metres} m)` : ''}${row.reason ? ` — ${row.reason}` : ''}\n`);
