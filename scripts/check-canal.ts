/**
 * The pre-integration gate (`npm run check:canal`).
 *
 * This replaced a single 104-step `&&` chain in package.json. That stopped at
 * the first failure without saying what else was broken, ran everything one
 * at a time, and could not be read or edited. Now:
 *
 *   1. lint, then the builds, in order and fail-fast: checks read the bundles
 *      the builds write, so a failed build makes every later result a lie;
 *   2. every check, in parallel (`--jobs`, default half the cores), continuing
 *      past failures;
 *   3. the production Storybook build;
 *
 * and a summary at the end with each failure's output. Exit code is non-zero
 * if anything failed.
 *
 * Usage: npm run check:canal [-- --jobs=4] [-- --only=road] [-- --skip=check:facade-rebuild]
 *                            [-- --no-storybook]
 */
import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';

/** Generated bundles and published CSS. Order is kept from the old chain. */
const BUILDS = [
  'build:facade-registration-browser',
  'publish:enamel-css',
  'build:canal-orientation-pois',
  'build:canal-road-graph',
  'build:canal-ferry',
  'build:canal-road-projection',
  'build:canal-road-surface',
  'build:canal-ui',
  'build:canal-building-tiles',
  'build:canal-cards',
  'build:canal-answer-path',
  'build:canal-route-selection',
  'build:canal-boat-corridor',
  'build:canal-city-overview',
  'build:canal-photoreal-gate',
  'build:canal-preferences',
  'build:canal-transit',
  'build:canal-overlay',
  'build:canal-game-landmarks',
  'build:canal-game-recall',
  'build:canal-game-presentation',
  'build:canal-buildings',
  // Game bundles the old chain never rebuilt, so a stale one could pass the
  // gate (the signature-landmark bundle did, 2026-09-30).
  'build:canal-car',
  'build:canal-three',
  'build:canal-3d',
  'build:canal-study-roofs',
  'build:canal-study-facades',
  'build:canal-study-trees',
  'build:canal-study-public-realm',
  'build:canal-neighborhoods',
  'build:canal-bridges',
  'build:canal-recall-store',
];

/** Typed checks and named geographic regressions. Independent of each other. */
const CHECKS = [
  'check:facade-rebuild',
  'check:enamel-css',
  'test:orientation-pois',
  'test:cycle-tracks',
  'test:own-pois',
  'test:building-facts',
  'test:building-recipes',
  'test:canalhouse-recipes',
  'test:bridge-register',
  'test:photoreal-gate',
  'test:canal-preferences',
  'test:transit-extract',
  'test:transit-routing',
  'test:canal-cities',
  'test:canal-overlay',
  'test:landmark-data',
  'test:landmark-notice',
  'test:drive-by-trigger',
  'test:postcard-pacing',
  'test:landmark-buildings',
  'test:landmark-fronts',
  'test:houseboats',
  'test:facade-extras',
  'test:shopfronts',
  'test:new-build-gaps',
  'test:poi-renames',
  'test:roof-shapes',
  'test:teaching-surface',
  'test:recall-rules',
  'test:boat-navigability',
  'test:city-overview',
  'test:route-selection',
  'test:start-heading',
  'test:route-ribbon',
  'test:play-delight',
  'test:canal-game-structure',
  'test:canal-car',
  'test:canal-buildings',
  'test:canal-streets',
  'test:neighborhoods',
  'test:map-recall-trivia',
  'test:postcard-images',
  'test:locate-hints',
  'test:generic-facades',
  'test:bridge-crossings',
  'test:bridge-distractors',
  'test:bridge-railways',
  'test:building-tile-source',
  'test:slippy-tiles',
  'test:building-ladder',
  'test:building-composition',
  'test:pyramidal-roof',
  'test:building-paint-inherit',
  'test:rd-coordinates',
  'test:srs',
  'test:road-graph',
  'test:ferry',
  'test:route-mastery',
  'test:road-projection',
  'test:bike-access',
  'test:cycle-track',
  'test:road-surface',
  'test:road-name-heading',
  'test:bottom-hud',
  'test:mobile-hud',
  'test:notice-cards',
  'test:large-letter-postcard',
  'test:large-letter-craft',
  'test:translation',
  'test:street-name-origins',
  'test:municipality',
  'test:canal-answer-path',
  'test:reachability',
  'test:facade-coordinates',
  'test:facade-boundary',
  'test:facade-record',
  'test:facade-calibration',
  'test:facade-openings',
  'test:facade-rooflines',
  'test:facade-appearance',
  'test:facade-build-record',
  'test:facade-heritage-text',
  'test:compass',
  'test:intro-flight',
  'test:trackpad-twist',
  'test:recall-clear',
  'test:recall-practice',
  'test:recall-forget',
  'test:canal-clear-all',
  'test:facts',
  'test:map-recall-facts',
  'check:extract-english',
  'check:encyclopedia-disambiguation',
  'test:street-wikipedia',
  'test:osm-buildings',
  'test:building-colors',
  'test:facade-grammar',
  'test:facade-target',
  'test:facade-point-cloud',
  'test:point-cloud-geometry',
  'test:facade-mesh-compiler',
  'test:rgb-city-demo',
  'test:wall-colour-publication',
  'test:lod1-semantic-tags',
];

const argument = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const jobs = Math.max(1, Number(argument('jobs') || Math.ceil(availableParallelism() / 2)));
const only = argument('only');
const skip = new Set((argument('skip') || '').split(',').filter(Boolean));
const selected = (name: string) => !skip.has(name) && (!only || name.includes(only));

interface Result { name: string; ok: boolean; seconds: number; output: string }

function runScript(name: string): Promise<Result> {
  const started = performance.now();
  return new Promise(resolve => {
    const child = spawn('npm', ['run', '--silent', name], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, FORCE_COLOR: '0' } });
    const chunks: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.on('close', code => resolve({
      name, ok: code === 0, seconds: (performance.now() - started) / 1000, output: Buffer.concat(chunks).toString('utf8'),
    }));
  });
}

const results: Result[] = [];
const report = (result: Result) => {
  results.push(result);
  process.stdout.write(`${result.ok ? '  ✓' : '  ✗'} ${result.name} ${result.seconds.toFixed(1)}s\n`);
};

async function phase(title: string, names: string[], parallel: number, failFast: boolean): Promise<boolean> {
  const queue = names.filter(selected);
  if (!queue.length) return true;
  process.stdout.write(`${title} (${queue.length}${parallel > 1 ? `, ${parallel} at a time` : ''})\n`);
  let failed = false, next = 0;
  await Promise.all(Array.from({ length: Math.min(parallel, queue.length) }, async () => {
    while (next < queue.length && !(failFast && failed)) {
      const result = await runScript(queue[next++]);
      report(result);
      if (!result.ok) failed = true;
    }
  }));
  return !failed;
}

/** Committed bundles a fresh build changed: a source edited without its
 *  bundle, or the reverse. A warning, not a failure, since work in progress
 *  is expected to be uncommitted. */
function changedBundles(): Promise<string[]> {
  return new Promise(resolve => {
    const child = spawn('git', ['diff', '--name-only', '--', 'public/canal-drive/js'], { stdio: ['ignore', 'pipe', 'ignore'] });
    const chunks: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.on('close', () => resolve(Buffer.concat(chunks).toString('utf8').split('\n').filter(line => /bundle|recall-store\//.test(line))));
  });
}

const started = performance.now();
const bundlesBefore = new Set(await changedBundles());
const built = await phase('Builds', ['lint', ...BUILDS], 1, true);
const rebuilt = (await changedBundles()).filter(file => !bundlesBefore.has(file));
if (rebuilt.length) {
  process.stdout.write(`\n⚠ The builds changed committed bundles; commit them with their sources:\n${rebuilt.map(file => `    ${file}`).join('\n')}\n\n`);
}
if (built) {
  await phase('Checks', CHECKS, jobs, false);
  if (!process.argv.includes('--no-storybook')) await phase('Storybook', ['build-storybook'], 1, true);
} else {
  process.stdout.write('A build failed; checks skipped, since they would read stale bundles.\n');
}

const failures = results.filter(result => !result.ok);
for (const failure of failures) {
  const tail = failure.output.trim().split('\n').slice(-40).join('\n');
  process.stdout.write(`\n──── ${failure.name} ────\n${tail}\n`);
}
const minutes = ((performance.now() - started) / 60000).toFixed(1);
process.stdout.write(`\n${results.length - failures.length} passed, ${failures.length} failed in ${minutes} min`
  + `${failures.length ? `: ${failures.map(failure => failure.name).join(', ')}` : ''}\n`);
process.exit(failures.length ? 1 : 0);
