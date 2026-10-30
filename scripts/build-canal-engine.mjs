// The engine bundle (window.CanalRecallEngine), built against the page's one
// three.js copy like scripts/build-3d-bundles.mjs. `--outdir=<dir>` builds
// elsewhere (lanes test without touching public/canal-drive/js).
import { build } from 'esbuild';
import { resolve } from 'node:path';

const shim = resolve('public/canal-drive/js/three-global-shim.cjs');
const outArg = process.argv.find(a => a.startsWith('--outdir='));
const outdir = outArg ? outArg.slice('--outdir='.length) : 'public/canal-drive/js';
await build({
  entryPoints: ['src/canalRecall/engine/browser.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'CanalRecallEngine',
  outfile: `${outdir}/engine.bundle.js`,
  sourcemap: 'external',
  minify: true,
  plugins: [{ name: 'share-three', setup(b) { b.onResolve({ filter: /^three$/ }, () => ({ path: shim })); } }],
});
console.log(`built ${outdir}/engine.bundle.js`);
