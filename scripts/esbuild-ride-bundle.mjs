// Builds one of the ride's IIFE bundles with the manual-model catalogue shared
// rather than inlined (src/canalRecall/landmarks/manualModelsShared.ts).
//
//   node scripts/esbuild-ride-bundle.mjs <entry> <outfile> [--minify] [--global-name=Name]
//
// Same output as `esbuild <entry> --bundle --format=iife …` except that
// `landmarks/manualModels.ts` resolves to the shim that reads the copy
// signature-placement.bundle.js already put on `CanalRecallSignatureLandmarks`.
// Only for bundles index.html loads after signature-placement.bundle.js.
import { build } from 'esbuild';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const manualModels = path.join(root, 'src/canalRecall/landmarks/manualModels.ts');
const shim = path.join(root, 'src/canalRecall/landmarks/manualModelsShared.ts');

const [entry, outfile, ...flags] = process.argv.slice(2);
if (!entry || !outfile) {
  console.error('usage: node scripts/esbuild-ride-bundle.mjs <entry> <outfile> [--minify] [--global-name=Name]');
  process.exit(2);
}
const globalName = flags.find(flag => flag.startsWith('--global-name='))?.slice('--global-name='.length);

let swapped = 0;
const sharedManualModels = {
  name: 'shared-manual-models',
  setup(b) {
    b.onResolve({ filter: /(^|\/)manualModels(\.ts)?$/ }, args => {
      const resolved = path.resolve(args.resolveDir, args.path.endsWith('.ts') ? args.path : `${args.path}.ts`);
      if (resolved !== manualModels) return undefined;
      swapped += 1;
      return { path: shim };
    });
  },
};

const result = await build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  format: 'iife',
  minify: flags.includes('--minify'),
  // External maps (no sourceMappingURL comment) for the deploy-time Sentry
  // upload; the workflow deletes them before the site is assembled.
  sourcemap: 'external',
  globalName,
  plugins: [sharedManualModels],
  logLevel: 'info',
  metafile: true,
});
const inputs = Object.keys(result.metafile.inputs);
if (inputs.some(input => input.endsWith('manualCatalogue.json'))) {
  console.error(`${outfile}: manualCatalogue.json is still inlined; some import bypassed manualModels.ts`);
  process.exit(1);
}
console.log(`${path.relative(root, outfile)}: manual-model catalogue shared (${swapped} import${swapped === 1 ? '' : 's'} swapped)`);
