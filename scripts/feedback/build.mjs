import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
const feedbackBuild = { builtAt: new Date().toISOString(), sha: execFileSync('git', ['rev-parse','HEAD'], {encoding:'utf8'}).trim(), workspaceDirty: !!execFileSync('git', ['status','--porcelain'], {encoding:'utf8'}).trim() };
// The small entry is a classic script for legacy inline galleries. Firebase is an
// independently loaded ES module, fetched only when the feedback form is used.
await build({ entryPoints: ['src/canalRecall/feedback/browser.ts'], bundle: true, format: 'iife', outfile: 'public/canal-drive/js/feedback/browser.js', minify: true, define: {__FEEDBACK_BUILD__: JSON.stringify(feedbackBuild)},
  plugins: [{ name: 'lazy-cloud', setup(b) { b.onResolve({ filter: /^\.\/cloud$/ }, () => ({ path: './cloud.js', external: true })); } }] });
await build({ entryPoints: ['src/canalRecall/feedback/cloud.ts'], bundle: true, format: 'esm', target: 'es2022', outfile: 'public/canal-drive/js/feedback/cloud.js', minify: true });
