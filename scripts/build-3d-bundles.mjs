/**
 * Build the 3D browser bundles against one shared copy of three.js.
 *
 * `detailed-buildings.bundle.js` (698 KB) and `player-vehicles.bundle.js`
 * (606 KB) each carried a complete private copy of three, so every player
 * downloaded and parsed it twice. `three.bundle.js` is now the only copy.
 *
 * This needs esbuild's JS API rather than the CLI: `--alias:three=…` matches by
 * prefix, so it also rewrote `three/addons/utils/BufferGeometryUtils.js` — which
 * 3d-tiles-renderer imports — into a path that does not exist. The plugin below
 * redirects the bare `three` specifier *exactly*, and lets every subpath resolve
 * normally so the addons still bundle.
 */
import { build } from 'esbuild';
import { resolve } from 'node:path';

const shim = resolve('public/canal-drive/js/three-global-shim.cjs');
const shareThree = {
  name: 'share-three',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^three$/ }, () => ({ path: shim }));
  },
};

const targets = [
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
    // ESM, and so no globalName: three's DRACOLoader resolves its decoder paths
    // at module top level via `new URL(..., import.meta.url)`, which esbuild
    // stubs out of an IIFE and throws "Invalid URL" before any code runs. The
    // module publishes its own global on the way out instead.
    entry: 'public/canal-drive/js/google-tiles-source.js',
    out: 'public/canal-drive/js/google-tiles.bundle.js',
    format: 'esm',
  },
];

for (const target of targets) {
  await build({
    entryPoints: [target.entry],
    outfile: target.out,
    bundle: true,
    format: target.format || 'iife',
    ...(target.globalName ? { globalName: target.globalName } : {}),
    minify: true,
    plugins: [shareThree],
    logLevel: 'warning',
  });
  const { size } = await import('node:fs').then((fs) => fs.statSync(target.out));
  console.log(`${target.out.split('/').pop().padEnd(32)} ${(size / 1024).toFixed(0)} KB`);
}
