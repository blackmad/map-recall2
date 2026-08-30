/**
 * Resolve every mapped bridge into its physical crossings and name the water
 * under each one.
 *
 * Both inputs are already cached extracts, so this is a pure local derivation —
 * no Overpass round trip. It writes to a staging path and reports coverage plus
 * a diff against whatever is published; `--publish` promotes it.
 *
 *   npx tsx scripts/build-bridge-crossings.ts
 *   npx tsx scripts/build-bridge-crossings.ts --publish
 *   npx tsx scripts/build-bridge-crossings.ts --directory=public/data/extracts/utrecht
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BridgeCrossing, BridgeCrossingIndex, BridgeSource, WaterSource, findBridgeCrossings,
} from '../src/canalRecall/bridgeCrossings';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directoryArgument = process.argv.find((argument) => argument.startsWith('--directory='));
const extractDir = resolve(root, directoryArgument?.slice('--directory='.length) || 'public/data/extracts/amsterdam');
const publishedPath = resolve(extractDir, 'bridge-crossings.json');
const stagingPath = resolve(extractDir, 'staging/bridge-crossings.json');

/** 43 of 300 bridges are "Brug 117" — an asset register number the game drops. */
const GENERIC_BRIDGE_NAME = /^(brug|bridge)\s*\d+$/i;

const bridges = JSON.parse(readFileSync(resolve(extractDir, 'bridges.json'), 'utf8')) as BridgeSource[];
const waters = JSON.parse(readFileSync(resolve(extractDir, 'water.json'), 'utf8')) as WaterSource[];

const index: BridgeCrossingIndex = { version: 1, generatedAt: new Date().toISOString(), bridges: {} };
let totalCrossings = 0;
let withWater = 0;
const multiCrossing: Array<{ name: string; crossings: BridgeCrossing[] }> = [];

for (const bridge of bridges) {
  if (!bridge.name || GENERIC_BRIDGE_NAME.test(bridge.name)) continue;
  const crossings = findBridgeCrossings(bridge, waters);
  if (crossings.length === 0) continue;
  index.bridges[bridge.id] = crossings;
  totalCrossings += crossings.length;
  withWater += crossings.filter((crossing) => crossing.waterway).length;
  if (crossings.length > 1) multiCrossing.push({ name: bridge.name, crossings });
}

const named = Object.keys(index.bridges).length;
console.log(`Bridges resolved:        ${named} of ${bridges.length} (generic register numbers skipped)`);
console.log(`Crossings:               ${totalCrossings} (${(totalCrossings / named).toFixed(2)} per bridge)`);
console.log(`Waterway identified:     ${withWater} (${(100 * withWater / totalCrossings).toFixed(1)}%)`);
console.log(`Bridges with >1 crossing: ${multiCrossing.length}`);
for (const entry of multiCrossing.sort((a, b) => b.crossings.length - a.crossings.length).slice(0, 8)) {
  const waterways = [...new Set(entry.crossings.map((crossing) => crossing.waterway || '—'))];
  console.log(`  ${entry.crossings.length.toString().padStart(3)} × ${entry.name} — ${waterways.slice(0, 5).join(', ')}`);
}

if (existsSync(publishedPath)) {
  const previous = JSON.parse(readFileSync(publishedPath, 'utf8')) as BridgeCrossingIndex;
  const before = Object.values(previous.bridges).reduce((sum, list) => sum + list.length, 0);
  const changed = Object.keys(index.bridges).filter((id) =>
    JSON.stringify(previous.bridges[id]) !== JSON.stringify(index.bridges[id]));
  console.log(`Diff vs published:       ${before} → ${totalCrossings} crossings, ${changed.length} bridges changed`);
} else {
  console.log('Diff vs published:       nothing published yet');
}

const target = process.argv.includes('--publish') ? publishedPath : stagingPath;
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(index)}\n`);
console.log(`Wrote ${target.replace(`${root}/`, '')}`);
if (target === stagingPath) console.log('Review, then re-run with --publish.');
