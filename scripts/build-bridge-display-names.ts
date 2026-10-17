/**
 * Find the bridges OSM spells differently from the official registers, and
 * write the reviewed table `scripts/data/bridge-display-names.json`
 * (`src/canalRecall/bridgeDisplayNames.ts` has the rule).
 *
 * Official spellings come from, best first:
 *   bag       the BAG openbare-ruimte register (`staging/street-name-origins.json`,
 *             fetched by `fetch-street-name-origins.ts`): the one bridge record
 *             of that spelling in the city. BAG is where the municipality
 *             records a name it gives, so it wins;
 *   register  the municipal bridge register (`scripts/data/amsterdam-bridge-register.json`,
 *             civiele constructies): a named structure within 60 m of the deck.
 * `REJECTED` holds the reviewed cases where the register's text is an
 * artefact (a dropped diacritic or space), not a spelling to teach.
 *
 * The table is committed so `stage-bridge-data.ts` needs neither source.
 *
 *   npx tsx scripts/build-bridge-display-names.ts [--directory=…] [--origins=<staging/street-name-origins.json>]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { metresBetween, type LatLon } from '../src/canalRecall/bridgeWikidata';
import { officialBridgeSpelling } from '../src/canalRecall/bridgeDisplayNames';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argument = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const directory = resolve(root, argument('directory') || 'public/data/extracts/amsterdam');
const originsPath = resolve(root, argument('origins') || resolve(directory, 'staging/street-name-origins.json'));
const outPath = resolve(root, 'scripts/data/bridge-display-names.json');
const NEAR_METRES = 60;

interface Bridge { id: string; name: string; center?: LatLon; path?: LatLon[]; paths?: LatLon[][] }
const bridges = JSON.parse(readFileSync(resolve(directory, 'bridges.json'), 'utf8')) as Bridge[];
type RegisterRow = [string, string, string, string, number, string, string, Array<[number, number]>];
const register = JSON.parse(readFileSync(resolve(root, 'scripts/data/amsterdam-bridge-register.json'), 'utf8')) as {
  source: string; fetched: string; bridges: RegisterRow[];
};
const bagBridges = existsSync(originsPath)
  ? (JSON.parse(readFileSync(originsPath, 'utf8')) as { origins: Array<{ name: string; kind: string; bagId: string }> })
    .origins.filter(origin => origin.kind === 'bridge')
  : [];
if (!bagBridges.length) process.stdout.write(`No BAG origins at ${originsPath}; register spellings only.\n`);

/** Reviewed 2026-10-17: official text that would teach a worse spelling. */
const REJECTED: Record<string, string> = {
  'Frans Hendriksz Oetgensbrug': 'BAG and register both read "Hendriksz.Oetgensbrug", the space after the patronymic dropped',
  'Drs. P-brug': 'register only, "Drs.P-brug": the pen name is "Drs. P"',
  'Maria Skłodowska-Curiebrug': 'register only, "Sklodowska": the register drops the ł',
  'West-Indische Huisbrug': 'register only, "West-Indische huisbrug": a lower-case slip',
  'Odebrug': 'BAG says "Ode-brug", the register "ODEbrug": the two disagree',
};

const pointsOf = (bridge: Bridge): LatLon[] => [
  ...(bridge.center ? [bridge.center] : []), ...(bridge.paths ?? (bridge.path ? [bridge.path] : [])).flat(),
];

export interface DisplayNameRow {
  id: string;
  name: string;
  displayName: string;
  source: 'register' | 'bag';
  /** Register number (BRU0123) or BAG openbare-ruimte id. */
  ref: string;
  url: string;
  metres?: number;
}
const rows: DisplayNameRow[] = [];
const ambiguous: string[] = [];
for (const bridge of bridges) {
  if (REJECTED[bridge.name]) continue;
  const fromBag = officialBridgeSpelling(bridge.name, bagBridges.map(origin => origin.name));
  if (fromBag) {
    const records = bagBridges.filter(origin => origin.name === fromBag);
    if (records.length !== 1) { ambiguous.push(`${bridge.name} → ${fromBag} (${records.length} BAG records)`); continue; }
    rows.push({
      id: bridge.id, name: bridge.name, displayName: fromBag, source: 'bag', ref: records[0].bagId,
      url: `https://api.data.amsterdam.nl/v1/bag/openbareruimtes/${records[0].bagId}/`,
    });
    continue;
  }
  const points = pointsOf(bridge);
  const near = register.bridges
    .filter(row => row[1])
    .map(row => ({
      nr: row[0], name: row[1].trim(),
      metres: Math.min(...row[7].flatMap(([lng, lat]) => points.map(point => metresBetween([lat, lng], point)))),
    }))
    .filter(row => row.metres <= NEAR_METRES);
  const fromRegister = officialBridgeSpelling(bridge.name, near.map(row => row.name));
  if (fromRegister) {
    const row = near.filter(candidate => candidate.name === fromRegister).sort((a, b) => a.metres - b.metres)[0];
    rows.push({
      id: bridge.id, name: bridge.name, displayName: fromRegister, source: 'register', ref: row.nr,
      url: `https://api.data.amsterdam.nl/v1/civieleconstructies/brug/?brugnummer=${row.nr.replace(/^BRU0*/, '')}`,
      metres: Math.round(row.metres),
    });
  }
}
rows.sort((a, b) => a.name.localeCompare(b.name, 'nl'));
writeFileSync(outPath, `${JSON.stringify({
  note: 'OSM bridge name → official register/BAG spelling. Generated by scripts/build-bridge-display-names.ts; review before staging.',
  sources: { register: `${register.source}, fetched ${register.fetched}`, bag: 'BAG openbare ruimte (api.data.amsterdam.nl/v1/bag/openbareruimtes/)' },
  rows,
  rejected: REJECTED,
}, null, 1)}\n`);
process.stdout.write(`${rows.length} bridges shown under an official spelling (${rows.filter(row => row.source === 'register').length} register, `
  + `${rows.filter(row => row.source === 'bag').length} BAG) → ${outPath.replace(`${root}/`, '')}\n`);
for (const row of rows) process.stdout.write(`  ${row.name} → ${row.displayName} (${row.source} ${row.ref}${row.metres != null ? `, ${row.metres} m` : ''})\n`);
for (const [name, why] of Object.entries(REJECTED)) process.stdout.write(`  kept OSM's ${name}: ${why}\n`);
for (const line of ambiguous) process.stdout.write(`  ambiguous: ${line}\n`);
