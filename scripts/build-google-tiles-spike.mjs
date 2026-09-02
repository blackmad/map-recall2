/**
 * Bundle the Google Photorealistic Tiles spike.
 *
 * Kept out of `npm run build` on purpose: the spike is an evaluation harness,
 * not shipped surface, and it carries its own private copy of three rather than
 * sharing the game's `three.bundle.js` global.
 */
import { build } from 'esbuild';

await build({
  entryPoints: ['public/canal-drive/js/google-tiles-spike-source.js'],
  outfile: 'public/canal-drive/js/google-tiles-spike.bundle.js',
  bundle: true,
  // ESM, not IIFE: three's DRACOLoader resolves its decoder paths at module
  // top level with `new URL(..., import.meta.url)`. esbuild stubs import.meta
  // out of an IIFE, so that throws "Invalid URL" before any of our code runs.
  format: 'esm',
  minify: true,
  logLevel: 'warning',
});
const { size } = await import('node:fs').then((fs) => fs.statSync('public/canal-drive/js/google-tiles-spike.bundle.js'));
console.log(`google-tiles-spike.bundle.js ${(size / 1024).toFixed(0)} KB`);
