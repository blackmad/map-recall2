// Collect the scripts the ride actually loads, and their source maps, into one
// upload root for Sentry (`canal-recall`).
//
//   node scripts/sentry/collect-canal-bundles.mjs [--source=dist/canal-drive] [--out=.tmp/sentry-canal-recall]
//
// Only `index.html`'s scripts (plus the lazily loaded monitoring bundle) are
// collected, and relative imports are followed so split ESM chunks come along.
// The gallery and evaluation pages never initialise monitoring, so a source map
// for them would only add upload weight to every deploy.
//
// A script without a sibling `.map` is left out: the hand-written ride scripts
// (game.js, camera.js, …) ship readable source, and injecting debug IDs into
// them would change served bytes for no symbolication gain. A minified build
// output without a map is an error instead.
//
// Run it against the built site (dist/canal-drive), not public/: the deploy
// uploads these files and then copies the debug-id-injected scripts back over
// dist/, so the served JavaScript must be the same bytes Sentry holds.
//
// Exits non-zero when a build output the ride loads has no sibling `.map`: that
// means its esbuild invocation lost `--sourcemap=external`, and its frames would
// arrive minified with nothing to symbolicate them.
import { cp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');
const option = (name, fallback) =>
  process.argv.find(argument => argument.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;

const source = path.resolve(root, option('source', 'dist/canal-drive'));
const out = path.resolve(root, option('out', '.tmp/sentry-canal-recall'));

const exists = target => stat(target).then(() => true, () => false);

// Build outputs are minified and need a map; the hand-written ride scripts
// (game.js, camera.js, …) ship readable source, so a map would add nothing.
const isBuildOutput = relative =>
  relative.endsWith('.bundle.js') || /^js\/(feedback|recall-store)\//.test(relative);

const indexHtml = await readFile(path.join(source, 'index.html'), 'utf8');
const queue = [
  ...[...indexHtml.matchAll(/<script[^>]*\ssrc="(js\/[^"?]+\.js)(?:\?[^"]*)?"/g)].map(match => match[1]),
  // Injected by the inline snippet at the top of <head> once a DSN exists.
  'js/monitoring.bundle.js',
];

const collected = new Set();
while (queue.length > 0) {
  const relative = queue.pop();
  if (collected.has(relative)) continue;
  collected.add(relative);

  const file = path.join(source, relative);
  if (!(await exists(file))) throw new Error(`${relative} is referenced but missing under ${source}`);
  const code = await readFile(file, 'utf8');
  for (const match of code.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["'](\.[^"']+)["']/g)) {
    const imported = path.relative(source, path.resolve(path.dirname(file), match[1]));
    if (imported.startsWith('..')) throw new Error(`${relative} imports outside the site: ${match[1]}`);
    if (imported.endsWith('.js') && !collected.has(imported)) queue.push(imported);
  }
}

const missingMaps = [];
const skipped = [];
let maps = 0;
let bytes = 0;
await rm(out, { recursive: true, force: true });
for (const relative of [...collected].sort()) {
  const from = path.join(source, relative);
  const to = path.join(out, relative);
  const map = `${from}.map`;
  if (!(await exists(map))) {
    // A minified build output without a map must not reach the upload: its
    // frames would arrive with nothing to symbolicate them.
    if (isBuildOutput(relative)) missingMaps.push(relative);
    else skipped.push(relative);
    continue;
  }
  await mkdir(path.dirname(to), { recursive: true });
  await cp(from, to);
  await cp(map, `${to}.map`);
  maps += 1;
  bytes += (await stat(from)).size;
}

if (missingMaps.length > 0) {
  await rm(out, { recursive: true, force: true });
  throw new Error(
    `No source map for build output${missingMaps.length === 1 ? '' : 's'} the ride loads:\n  ${missingMaps.join('\n  ')}\n` +
      'Add `--sourcemap=external` (CLI) or `sourcemap: \'external\'` (esbuild API) to its build step.',
  );
}

console.log(
  `Collected ${maps} ride scripts with source maps (${(bytes / 1e6).toFixed(1)} MB of JavaScript, ${skipped.length} readable checked-in scripts without one) into ${path.relative(root, out)}`,
);
