/**
 * Publish the façade-model evaluation demo.
 *
 * Copies the gold crops and the lane predictions into a served, versioned
 * directory alongside the frozen gold set and the scores, so the comparison
 * page can render without touching .cache.
 *
 * Usage: npx tsx scripts/facade-eval/publish-eval-demo.ts [--version=v1]
 */
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const argument = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const version = argument('version') || 'v1';
const outDir = path.resolve(argument('out') || `public/data/facade-model-eval/${version}`);
const goldDir = path.resolve('review-data/facade-model-gold/v1');
const evalManifestDir = path.resolve(argument('crops') || '.cache/facade-eval/oudzuid-eval');

const predictions = [
  { id: 'rfdetr-R0', label: 'RF-DETR-seg-2XL (building-facade-segmentation-instance/4)', path: '.cache/facade-eval/rfdetr-oudzuid-R0.json' },
  { id: 'windet-R0', label: 'win_det_heatmaps (ResNet18, zju_facade)', path: '.cache/facade-eval/windet-oudzuid-R0.json' },
];

await mkdir(path.join(outDir, 'crops'), { recursive: true });
await mkdir(path.join(outDir, 'predictions'), { recursive: true });

// crops: copy the 60 gold-wall strips, keyed by group so the page can join
const imagesDir = path.join(evalManifestDir, 'images');
let crops = 0;
for (const file of await readdir(imagesDir)) {
  if (!file.endsWith('.jpg')) continue;
  await copyFile(path.join(imagesDir, file), path.join(outDir, 'crops', file));
  crops += 1;
}

await copyFile(path.join(goldDir, 'measured.json'), path.join(outDir, 'measured.json'));
await copyFile(path.join(goldDir, 'measured.sha256'), path.join(outDir, 'measured.sha256'));
try { await copyFile(path.join(goldDir, 'results.json'), path.join(outDir, 'results.json')); } catch { /* no results yet */ }

const published = [];
for (const prediction of predictions) {
  try {
    await copyFile(path.resolve(prediction.path), path.join(outDir, 'predictions', `${prediction.id}.json`));
    published.push({ id: prediction.id, label: prediction.label });
  } catch {
    process.stdout.write(`skipping ${prediction.id}: ${prediction.path} not found\n`);
  }
}

const measured = JSON.parse(await readFile(path.join(goldDir, 'measured.json'), 'utf8')) as { counts: { walls: number; openings: number } };
await writeFile(path.join(outDir, 'index.json'), `${JSON.stringify({
  version,
  generatedAt: new Date().toISOString(),
  note: 'Measured openings are point-cloud geometry. Model boxes are predictions. Green = measured, red = model window, amber = model other.',
  gold: { walls: measured.counts.walls, openings: measured.counts.openings, sha256: (await readFile(path.join(goldDir, 'measured.sha256'), 'utf8')).trim() },
  predictions: published,
}, null, 2)}\n`);

process.stdout.write(`published ${crops} crops, ${published.length} prediction sets to ${outDir}\n`);
