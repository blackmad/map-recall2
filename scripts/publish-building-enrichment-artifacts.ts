/** Publish lightweight, reviewable enrichment outputs; large source caches remain ignored. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const cacheRoot = path.resolve('.cache/building-enrichment');
const outputRoot = path.resolve('public/data/building-enrichment/amsterdam');
await mkdir(outputRoot, { recursive: true });
const files = [
  ['summary.json', 'summary.json'],
  ['a10-boundary.geojson', 'a10-boundary.geojson'],
  ['panorama/machine-labels.json', 'machine-panorama-labels.json'],
] as const;
for (const [source, destination] of files) await writeFile(path.join(outputRoot, destination), await readFile(path.join(cacheRoot, source)));
const summary = JSON.parse(await readFile(path.join(cacheRoot, 'summary.json'), 'utf8')) as Record<string, unknown>;
await writeFile(path.join(outputRoot, 'manifest.json'), JSON.stringify({
  schemaVersion: 1,
  publishedAt: new Date().toISOString(),
  status: 'research-machine-proposals-not-production-evidence',
  priorityRegion: 'inside-a10',
  artifacts: files.map(([, destination]) => destination),
  sourceCache: '.cache/building-enrichment (not committed; regenerate with npm scripts)',
  counts: { buildings: summary.buildings, insideA10Buildings: summary.insideA10Buildings, observations: summary.observations, modelLabels: summary.modelLabels, humanLabels: summary.humanLabels },
}, null, 2));
process.stdout.write(`Published enrichment artifacts to ${path.relative(process.cwd(), outputRoot)}\n`);
