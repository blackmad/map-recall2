/**
 * Content stats for the landing page ("500+ buildings modelled, 75+ neighbourhoods to collect…").
 *
 * Every figure is counted from the data the ride and the quiz actually ship, with the same
 * selection rules they use where one exists (the stamp pool is `collectiblePool`, the building
 * models are the game's draw list, the neighbourhood postcards are the quiz's area kinds), so the
 * landing page cannot drift into hand-typed claims.
 *
 * Writes:
 *   - public/canal-drive/data/content-stats.json: exact counts, a note on what each one counts,
 *     the rounded display figure, and the source files.
 *   - public/canal-drive/landing.html: the stats strip between the `content-stats:start/end`
 *     markers, inlined so the page shows the numbers without JavaScript or a fetch.
 *
 * Idempotent: no timestamps, stable ordering; a second run changes nothing.
 *
 *   node --import tsx scripts/landing/content-stats.ts           # write both
 *   node --import tsx scripts/landing/content-stats.ts --check   # exit 1 if either is stale
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MANUAL_LANDMARKS } from '../../src/canalRecall/landmarks/manualModels';
import { ORDINARY_BUILDINGS } from '../../src/canalRecall/landmarks/ordinaryModels';
import { mergeManualPoiFeatures } from '../../src/canalRecall/game/manualPoiCatalog';
import { collectiblePool, type CollectibleFeature } from '../../src/canalRecall/collection/poiCollection';
import { isBridgeWayName } from '../../src/canalRecall/game/bridgeStreetName';
import type { LandmarkFeature } from '../../src/canalRecall/game/extracts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EXTRACT = 'public/data/extracts/amsterdam';
const OUT_JSON = 'public/canal-drive/data/content-stats.json';
const LANDING = 'public/canal-drive/landing.html';
const START = '<!-- content-stats:start -->';
const END = '<!-- content-stats:end -->';

const readJson = <T>(rel: string): T => JSON.parse(readFileSync(path.join(ROOT, rel), 'utf8')) as T;

export interface Stat {
  /** Exact count. */
  count: number;
  /** What the number counts, in one sentence. */
  note: string;
  /** Files it was counted from. */
  sources: string[];
}

/**
 * Friendly display figure: exact under 100, otherwise rounded DOWN to two significant
 * figures with a plus ("518" → "510+", "5,429" → "5,400+", "348,763" → "340,000+").
 */
export function friendly(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return '0';
  if (count < 100) return count.toLocaleString('en-GB');
  const step = 10 ** (Math.floor(Math.log10(count)) - 1);
  const floored = Math.floor(count / step) * step;
  return `${floored.toLocaleString('en-GB')}${floored < count ? '+' : ''}`;
}

/** Ways the bike quiz never names: motorways, trunk roads and bus lanes are not rideable. */
const UNRIDEABLE = new Set(['motorway', 'motorway_link', 'trunk', 'trunk_link', 'busway']);
/** Area kinds the quiz asks and postcards collect (src/dataSources/featureProvider.ts). */
const POSTCARD_KINDS = new Set(['neighborhood', 'neighbourhood', 'quarter']);

export function countStats(): Record<string, Stat> {
  // Buildings. The game's draw list is landmarks/browser.ts GAME_BUILDING_MODELS = manual + ordinary.
  const bespoke = [...MANUAL_LANDMARKS, ...ORDINARY_BUILDINGS];
  const bespokeIds = new Set(bespoke.map(m => m.id));
  const landmarkModels = MANUAL_LANDMARKS.filter(m => (m.buildingCategory ?? 'landmark') === 'landmark').length;
  const instances = readJson<{ pand: string; unit: string }[]>('public/canal-drive/building-types/instances.json');
  const tiles = readJson<{ features: number }>(`${EXTRACT}/building-tiles/index-z14.json`);

  // Destinations: the stamp pool, built exactly as the ride builds it (game-route.js → setPool).
  const landmarks = readJson<LandmarkFeature[]>(`${EXTRACT}/landmarks.json`);
  const pool = collectiblePool(mergeManualPoiFeatures(landmarks, 'amsterdam') as unknown as CollectibleFeature[]);

  // Facts.
  const facts = readJson<{ features: { facts?: unknown[] }[] }>(`${EXTRACT}/facts.json`);
  const triviaFacts = facts.features.reduce((n, f) => n + (f.facts?.length ?? 0), 0);
  const origins = readJson<{ origins: { en?: string }[] }>(`${EXTRACT}/street-name-origins.json`).origins.filter(o => o.en).length;
  const stories = readJson<{ entries: { topFacts?: unknown[] }[] }>(`${EXTRACT}/neighborhood-stories.json`).entries
    .reduce((n, e) => n + (e.topFacts?.length ?? 0), 0);
  const poiDescriptions = readJson<{ description?: string }[]>('src/canalRecall/game/manual-poi-data.json').filter(p => p.description).length;
  const bridgeRegister = Object.keys(readJson<{ bridges: Record<string, unknown> }>(`${EXTRACT}/bridge-register.json`).bridges).length;

  // Names to learn.
  const routing = readJson<{ name?: string; highway?: string }[]>(`${EXTRACT}/streets-routing.json`);
  const streetNames = new Set(routing.filter(w => w.name && !UNRIDEABLE.has(w.highway ?? '') && !isBridgeWayName(w.name)).map(w => w.name!.trim()));
  const waterNames = new Set(readJson<{ name: string }[]>(`${EXTRACT}/water.json`).map(w => w.name.trim()));
  const bridgeNames = new Set(readJson<{ name: string }[]>(`${EXTRACT}/bridges.json`).map(b => b.name.trim()));
  const areas = readJson<{ name: string; kind?: string; geometry?: unknown }[]>(`${EXTRACT}/boundaries.json`)
    .filter(a => POSTCARD_KINDS.has(a.kind ?? '') && a.geometry);
  const tours = readJson<{ tours: unknown[] }>(`${EXTRACT}/tours.json`).tours.length;
  const animals = readJson<{ animals: { name: string }[] }>('public/canal-drive/models/artis-animals/index.json').animals;

  return {
    buildingsModelled: {
      count: bespokeIds.size,
      note: `Buildings with their own individually modelled 3D model in the ride: ${landmarkModels} landmark models plus ${bespokeIds.size - landmarkModels} individually modelled ordinary buildings and blocks (the game's draw list, manual + ordinary catalogues).`,
      sources: ['src/canalRecall/landmarks/manualCatalogue.json', 'public/canal-drive/ordinary-buildings-data/catalogue.json'],
    },
    landmarkModels: {
      count: landmarkModels,
      note: 'Of the individually modelled buildings, the ones in the landmark category (museums, churches, stations, monuments…).',
      sources: ['src/canalRecall/landmarks/manualCatalogue.json'],
    },
    kitBuildings: {
      count: instances.length,
      note: `Buildings drawn from a reusable building-type kit (${new Set(instances.map(i => i.unit)).size} kit designs placed on their real footprints, mostly Nieuw-West).`,
      sources: ['public/canal-drive/building-types/instances.json'],
    },
    buildings3d: {
      count: tiles.features,
      note: 'Every building in the 3D city: BAG footprints with 3DBAG heights, including the modelled ones.',
      sources: [`${EXTRACT}/building-tiles/index-z14.json`],
    },
    placesToVisit: {
      count: pool.length,
      note: 'Destinations you can ride to and collect a stamp at: the ride\'s stamp pool (teachable landmarks within 4 km of the centre plus the individually modelled POIs, deduplicated).',
      sources: [`${EXTRACT}/landmarks.json`, 'src/canalRecall/game/manual-poi-data.json'],
    },
    factsToDiscover: {
      count: triviaFacts + origins + stories + poiDescriptions,
      note: `Cards and facts the ride and quiz can show: ${triviaFacts} trivia facts, ${origins} street/canal/bridge name origins, ${stories} neighbourhood story facts and ${poiDescriptions} landmark descriptions.`,
      sources: [`${EXTRACT}/facts.json`, `${EXTRACT}/street-name-origins.json`, `${EXTRACT}/neighborhood-stories.json`, 'src/canalRecall/game/manual-poi-data.json'],
    },
    triviaFacts: { count: triviaFacts, note: 'Trivia facts on streets, canals, bridges, squares, parks and landmarks.', sources: [`${EXTRACT}/facts.json`] },
    nameOrigins: { count: origins, note: 'Official explanations of where a street, canal or bridge name comes from (BAG beschrijvingNaam, in English).', sources: [`${EXTRACT}/street-name-origins.json`] },
    bridgeRegister: { count: bridgeRegister, note: 'Bridges with a municipal register entry (number, material, movable or fixed).', sources: [`${EXTRACT}/bridge-register.json`] },
    streetsAndCanals: {
      count: streetNames.size + waterNames.size,
      note: `Names you can be asked: ${streetNames.size} streets on rideable ways (bridge decks are counted under named bridges) and ${waterNames.size} canals and waters.`,
      sources: [`${EXTRACT}/streets-routing.json`, `${EXTRACT}/water.json`],
    },
    namedBridges: { count: bridgeNames.size, note: 'Named bridges the "which bridge are you on?" question can ask.', sources: [`${EXTRACT}/bridges.json`] },
    neighbourhoods: {
      count: new Set(areas.map(a => a.name)).size,
      note: 'Neighbourhoods with a postcard to collect (recall one on two different days, once by pinning it on the map).',
      sources: [`${EXTRACT}/boundaries.json`],
    },
    tours: { count: tours, note: 'Themed tours with a tour stamp for finishing.', sources: [`${EXTRACT}/tours.json`] },
    zooAnimals: {
      count: animals.length,
      note: 'ARTIS zoo animals placed in the ride, one miniature per species at its enclosure.',
      sources: ['public/canal-drive/models/artis-animals/index.json'],
    },
  };
}

/** The strip on the landing page: key, label. Order is the display order. */
export const STRIP: readonly (readonly [string, string])[] = [
  ['buildingsModelled', 'buildings modelled by hand'],
  ['placesToVisit', 'places to ride to'],
  ['factsToDiscover', 'facts to discover'],
  ['streetsAndCanals', 'streets and canals to name'],
  ['neighbourhoods', 'neighbourhoods to collect'],
  ['zooAnimals', 'animals in the zoo'],
];

export function stripHtml(stats: Record<string, Stat>): string {
  const items = STRIP.map(([key, label]) => {
    const { count } = stats[key];
    const shown = friendly(count);
    const plus = shown.endsWith('+');
    const value = Number(shown.replace(/[^0-9]/g, ''));
    return `        <li data-stat="${key}"><strong class="stat-n" data-count="${value}"${plus ? ' data-plus' : ''}>${shown}</strong><span>${label}</span></li>`;
  });
  return [
    START,
    '      <!-- Generated by scripts/landing/content-stats.ts from the shipped data; exact counts in data/content-stats.json. -->',
    '      <ul class="stats-grid">',
    ...items,
    '      </ul>',
    `      ${END}`,
  ].join('\n');
}

function main(): void {
  const check = process.argv.includes('--check');
  const stats = countStats();
  const json = `${JSON.stringify({
    version: 1,
    city: 'amsterdam',
    generator: 'scripts/landing/content-stats.ts',
    display: Object.fromEntries(Object.entries(stats).map(([k, s]) => [k, friendly(s.count)])),
    stats,
  }, null, 2)}\n`;

  const landing = readFileSync(path.join(ROOT, LANDING), 'utf8');
  const a = landing.indexOf(START);
  const b = landing.indexOf(END);
  if (a < 0 || b < a) throw new Error(`${LANDING}: missing ${START} … ${END} markers`);
  const html = landing.slice(0, a) + stripHtml(stats) + landing.slice(b + END.length);

  const outJson = path.join(ROOT, OUT_JSON);
  const stale = [
    ...(!existsSync(outJson) || readFileSync(outJson, 'utf8') !== json ? [OUT_JSON] : []),
    ...(html !== landing ? [LANDING] : []),
  ];
  for (const [key, s] of Object.entries(stats)) console.log(`${key.padEnd(18)} ${String(s.count).padStart(7)}  ${friendly(s.count).padStart(9)}`);
  if (check) {
    if (stale.length) { console.error(`content stats are stale: ${stale.join(', ')}; run the generator`); process.exit(1); }
    console.log('content stats up to date');
    return;
  }
  mkdirSync(path.dirname(outJson), { recursive: true });
  if (stale.includes(OUT_JSON)) writeFileSync(outJson, json);
  if (stale.includes(LANDING)) writeFileSync(path.join(ROOT, LANDING), html);
  console.log(stale.length ? `wrote ${stale.join(', ')}` : 'unchanged');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
