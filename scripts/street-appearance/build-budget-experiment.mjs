/** Freeze a review-only budget candidate without changing production source or bundles. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
const output = process.argv.find(a => a.startsWith('--output='))?.slice(9);
if (!output) throw Error('Required --output=artifact-directory');
await fs.mkdir(output, { recursive: true });
const plugin = {
  name: 'review-only-facade-budget',
  setup(builder) {
    builder.onLoad({ filter: /\/facadeExtras\.ts$/ }, async ({ path: filename }) => {
      const source = await fs.readFile(filename, 'utf8');
      const before = '{ wall: 180, sideWall: 30, building: 230, streetReserve: 160 }';
      if (!source.includes(before)) throw Error('Budget source changed; review experiment again');
      return { contents: source.replace(before, '{ wall: 360, sideWall: 30, building: 460, streetReserve: 320 }'), loader: 'ts', resolveDir: path.dirname(filename) };
    });
  },
};
for (const [entry, filename, globalName] of [
  ['threeBuildingsBrowser.ts', 'three-buildings.bundle.js', 'CanalRecallThreeBuildings'],
  ['threeBuildingsWorker.ts', 'three-buildings-worker.bundle.js', undefined],
]) await build({ entryPoints: [`src/canalRecall/${entry}`], outfile: path.join(output, filename), bundle: true, format: 'iife', globalName, minify: true, plugins: [plugin] });
await fs.writeFile(path.join(output, 'experiment.json'), JSON.stringify({ purpose: 'Review only; no production budget change', baseline: { wall: 180, building: 230 }, candidate: { wall: 360, building: 460 }, unchanged: ['side wall cap', 'rider detail tile ownership', 'coarse geometry'], cautions: ['Extra budget can admit unsourced optional ornaments; visual review is required.', 'Measure full-scene GPU and actual extra geometry, not only total walls.'] }, null, 2));
