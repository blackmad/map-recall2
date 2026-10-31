/**
 * Build the 3D browser bundles against one shared copy of three.js.
 *
 * Measured on close-out of TODO item 9: `three.bundle.js` ~783 KB is the only
 * Three copy; `player-vehicles.bundle.js` ~5 KB and
 * `detailed-buildings.bundle.js` ~136 KB both resolve `three` through the
 * `CanalRecallThree` shim. (Older notes still mention 698/606 KB private
 * copies — those were the pre-shim sizes.)
 *
 * This needs esbuild's JS API rather than the CLI: `--alias:three=…` matches by
 * prefix, so it also rewrote `three/addons/utils/BufferGeometryUtils.js` — which
 * 3d-tiles-renderer imports — into a path that does not exist. The plugin below
 * redirects the bare `three` specifier *exactly*, and lets every subpath resolve
 * normally so the addons still bundle.
 */
import { build } from 'esbuild';
import { resolve, basename } from 'node:path';

const shim = resolve('public/canal-drive/js/three-global-shim.cjs');
const shareThree = {
  name: 'share-three',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^three$/ }, () => ({ path: shim }));
  },
};

const targets = [
  {
    entry: 'public/canal-drive/js/inventory-trees-source.js',
    out: 'public/canal-drive/js/inventory-trees.bundle.js',
    globalName: 'CanalRecallInventoryTrees',
  },
  {
    entry: 'public/canal-drive/js/facade-recipe-source.js',
    out: 'public/canal-drive/js/facade-recipe.bundle.js',
    globalName: 'CanalRecallRecipe',
  },
  {
    entry: 'public/canal-drive/js/detailed-buildings-source.js',
    out: 'public/canal-drive/js/detailed-buildings.bundle.js',
    globalName: 'CanalRecallDetailed3D',
  },
  {
    entry: 'public/canal-drive/js/player-vehicles-source.js',
    out: 'public/canal-drive/js/player-vehicles.bundle.js',
    globalName: 'CanalRecallVehicles',
  },
  {
    entry: 'public/canal-drive/js/signature-landmarks-source.js',
    out: 'public/canal-drive/js/signature-landmarks.bundle.js',
    globalName: 'CanalRecallSignature3D',
  },
  {
    // Own ground in the riding view (`?ownGround=1`); vector-map.js loads it on
    // demand. THREE is injected by the shared frame, so no shim is involved.
    entry: 'src/canalRecall/ownGround/gameBrowser.ts',
    out: 'public/canal-drive/js/own-ground-game.bundle.js',
    globalName: 'CanalRecallOwnGround',
  },
  {
    // Its cell builder, in a worker (DOM-free modules only).
    entry: 'src/canalRecall/ownGround/groundWorker.ts',
    out: 'public/canal-drive/js/own-ground-worker.bundle.js',
  },
  {
    // The own map page's footprint builder (no-maplibre.html, ownMap/main.ts), in a worker (DOM-free).
    entry: 'src/canalRecall/ownMap/footprintWorker.ts',
    out: 'public/canal-drive/js/own-map-footprints.worker.js',
  },
  {
    entry: 'public/canal-drive/js/pyramidal-roofs-source.js',
    out: 'public/canal-drive/js/pyramidal-roofs.bundle.js',
    globalName: 'CanalRecallPyramidalRoofs',
  },
];

const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7).split(',');
// --outdir=<dir>: write the bundles there instead of public/canal-drive/js (A/B of a source change
// through LOOK_BUNDLES_DIR / BUNDLES_DIR without touching the committed bundles).
const outdir = process.argv.find(arg => arg.startsWith('--outdir='))?.slice(9);
const selected = only ? targets.filter(target => only.includes(basename(target.out, '.bundle.js'))) : targets;
if (only && (new Set(only).size !== only.length || selected.length !== only.length)) throw new Error('Unknown or duplicate 3D bundle target');
for (const target of selected) {
  if (outdir) target.out = resolve(outdir, basename(target.out));
  await build({
    entryPoints: [target.entry],
    outfile: target.out,
    bundle: true,
    format: target.format || 'iife',
    ...(target.globalName ? { globalName: target.globalName } : {}),
    minify: true,
    // External maps (no sourceMappingURL comment) for the deploy-time Sentry
    // upload; the workflow deletes them before the site is assembled.
    sourcemap: 'external',
    plugins: [shareThree],
    logLevel: 'warning',
  });
  const { size } = await import('node:fs').then((fs) => fs.statSync(target.out));
  console.log(`${target.out.split('/').pop().padEnd(32)} ${(size / 1024).toFixed(0)} KB`);
}
