// Build the sculptures browser bundle (`?sculptures=1`):
//   node scripts/sculptures/build-bundle.mjs
// → public/canal-drive/sculptures/sculptures.bundle.js, global CanalRecallSculptures.
// The modules take THREE as an argument, so nothing of three is bundled.
// Kept out of package.json (lane rule); the integrator can add
// "build:canal-sculptures": "node scripts/sculptures/build-bundle.mjs".
import { build } from 'esbuild';

await build({
  entryPoints: ['src/canalRecall/sculptures/browser.ts'],
  outfile: 'public/canal-drive/sculptures/sculptures.bundle.js',
  bundle: true,
  format: 'iife',
  globalName: 'CanalRecallSculptures',
  minify: true,
  target: 'es2020',
  logLevel: 'info',
});
