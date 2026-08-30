import { copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const sourceDirectory = path.resolve(process.argv[2]);
const targetDirectory = path.resolve(process.argv[3]);
const sourceManifest = JSON.parse(await readFile(path.join(sourceDirectory, 'manifest.json'), 'utf8'));
const targetManifestFile = path.join(targetDirectory, 'manifest.json');
const targetManifest = JSON.parse(await readFile(targetManifestFile, 'utf8'));
await copyFile(path.join(sourceDirectory, 'branded-pois.json'), path.join(targetDirectory, 'branded-pois.json'));
targetManifest.brandedPois = sourceManifest.brandedPois;
targetManifest.majorChains = sourceManifest.majorChains;
await writeFile(targetManifestFile, JSON.stringify(targetManifest, null, 2));
process.stdout.write(`Merged ${sourceManifest.brandedPois.count} branded POIs into ${targetDirectory}\n`);
