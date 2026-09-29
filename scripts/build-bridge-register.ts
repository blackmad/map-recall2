/**
 * Join the game's named bridges (`bridges.json`) to the city's bridge register
 * (`scripts/data/amsterdam-bridge-register.json`, from
 * `fetch:amsterdam-bridge-register`) and write `bridge-register.json`: number,
 * type, material, year and traffic per bridge name, for the card after a
 * bridge is named.
 *
 * A game bridge's mapped ways are matched to register outlines they lie in or
 * pass within `TOUCH_METRES` of; `chooseRegisterBridge` settles which one it
 * is, or leaves an ambiguous bridge out.
 *
 * Writes to `staging/` and reports coverage; `--publish` writes the extract.
 *
 * Usage: npm run build:bridge-register [-- --publish]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  chooseRegisterBridge, describeRegisteredBridge, registerFact,
  type BridgeRegisterFact, type BridgeRegisterFile, type BridgeRegisterRow,
} from '../src/canalRecall/bridgeRegister.ts';
import { metresToRing, pointInRing } from './lib/landmarkBuildings.ts';

/** A way this close to an outline is on that bridge: register outlines trace
 *  the deck, OSM ways its centreline, and the two are drawn independently. */
export const TOUCH_METRES = 3;

const directory = path.resolve('public/data/extracts/amsterdam');
const publish = process.argv.includes('--publish');
const register = JSON.parse(await readFile(path.resolve('scripts/data/amsterdam-bridge-register.json'), 'utf8')) as {
  source: string; bridges: BridgeRegisterRow[];
};
const bridges = JSON.parse(await readFile(path.join(directory, 'bridges.json'), 'utf8')) as Array<{
  name: string; paths?: Array<Array<[number, number]>>; path?: Array<[number, number]>;
}>;

/** Points every ~2 m along a way: a way often has no vertex on the deck at
 *  all, only one at each abutment. */
function alongWay(way: Array<[number, number]>): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  for (let i = 0; i < way.length; i++) {
    points.push(way[i]);
    if (i + 1 === way.length) break;
    const [lat0, lng0] = way[i], [lat1, lng1] = way[i + 1];
    const metres = Math.hypot((lat1 - lat0) * 110_540, (lng1 - lng0) * 111_320 * Math.cos(lat0 * Math.PI / 180));
    const steps = Math.floor(metres / 2);
    for (let step = 1; step < steps; step++) {
      const t = step / steps;
      points.push([lat0 + (lat1 - lat0) * t, lng0 + (lng1 - lng0) * t]);
    }
  }
  return points;
}

// A coarse grid over outline bounding boxes (~110 m cells).
const CELL = 0.001;
const grid = new Map<string, BridgeRegisterRow[]>();
for (const row of register.bridges) {
  const lngs = row[7].map(point => point[0]), lats = row[7].map(point => point[1]);
  for (let x = Math.floor(Math.min(...lngs) / CELL); x <= Math.floor(Math.max(...lngs) / CELL); x++) {
    for (let y = Math.floor(Math.min(...lats) / CELL); y <= Math.floor(Math.max(...lats) / CELL); y++) {
      const key = `${x}:${y}`;
      grid.set(key, [...(grid.get(key) ?? []), row]);
    }
  }
}

const facts: Record<string, BridgeRegisterFact> = {};
let ambiguous = 0, unmatched = 0;
const samples: string[] = [];
for (const bridge of bridges) {
  const ways = bridge.paths?.length ? bridge.paths : bridge.path ? [bridge.path] : [];
  const touched = new Map<string, BridgeRegisterRow>();
  for (const way of ways) {
    for (const [lat, lng] of alongWay(way)) {
      for (const row of grid.get(`${Math.floor(lng / CELL)}:${Math.floor(lat / CELL)}`) ?? []) {
        if (touched.has(row[0])) continue;
        if (pointInRing(lng, lat, row[7]) || metresToRing(lng, lat, row[7]) <= TOUCH_METRES) touched.set(row[0], row);
      }
    }
  }
  if (!touched.size) { unmatched++; continue; }
  const chosen = chooseRegisterBridge(bridge.name, [...touched.values()]);
  if (!chosen) { ambiguous++; continue; }
  const fact = registerFact(chosen);
  if (!describeRegisteredBridge(fact)) continue;
  facts[bridge.name] = fact;
  if (samples.length < 8) samples.push(`  ${bridge.name}: ${describeRegisteredBridge(fact)}`);
}

const file: BridgeRegisterFile = { version: 1, source: register.source, bridges: facts };
const out = publish ? path.join(directory, 'bridge-register.json') : path.join(directory, 'staging/bridge-register.json');
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(file)}\n`);
const named = new Set(bridges.map(bridge => bridge.name)).size;
process.stdout.write(`${Object.keys(facts).length}/${named} bridges described (${ambiguous} ambiguous, ${unmatched} touch no register outline)\n`
  + `${samples.join('\n')}\n→ ${path.relative(process.cwd(), out)}\n`);
