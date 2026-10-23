// Source hashes for build-manual-landmarks.ts: a model is skipped when its recorded hash, its GLB and its
// modelAssetVersions.json fingerprint all still match. A hash is the toolchain (shared builder code and the
// driver) plus the model's spec and the files named after it. Shared builder modules that name a model in
// quotes count as that model's inputs too. Anything the rules miss rebuilds more than needed, never less.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

export interface SourceHashes {
  toolchain: string;
  models: Record<string, string>;
}

export const LANDMARK_DIR = 'scripts/landmarks';
export const INSTALLED_DIR = 'scripts/sculptures/installed';
// Shared code the driver imports from outside scripts/landmarks; a change to any of it rebuilds every model.
export const SHARED_SOURCE_DIRS = ['src/canalRecall/landmarks', 'src/canalRecall/look', 'src/canalRecall/sculptures', 'src/canalRecall/buildingRecipe'];
// Models built from code inside build-manual-landmarks.ts, or with no reliable source identity: always rebuilt.
export const ALWAYS_REBUILD = (id: string) => id === 'centraal-station' || id === 'muziekgebouw-bimhuis' || id.startsWith('olvg-');

const digest = (chunks: string[]) => {
  const h = createHash('sha256');
  for (const chunk of chunks) h.update(chunk).update('\0');
  return h.digest('hex');
};
const isSource = (name: string) => name.endsWith('.ts') && !name.endsWith('.test.ts');
const listDir = (root: string, rel: string) => (fs.existsSync(path.join(root, rel)) ? fs.readdirSync(path.join(root, rel)).sort() : []);
const read = (root: string, rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');

/** A file is owned by a model when named `<id>-…` or `<id>.ts`. An owned file that shared build code imports becomes toolchain. */
const ownedBy = (name: string, id: string) => name.startsWith(`${id}-`) || name === `${id}.ts`;

export function computeSourceHashes(root: string, specs: Array<{id: string}>): SourceHashes {
  const landmarkNames = listDir(root, LANDMARK_DIR);
  const sourceNames = landmarkNames.filter(isSource);
  const ids = specs.map(spec => spec.id);
  // The build closure: scripts/landmarks modules the driver reaches through relative imports. Tools that merely import a builder are not part of a build.
  const DRIVER = 'build-manual-landmarks.ts';
  const importsOf = (name: string) => [...read(root, `${LANDMARK_DIR}/${name}`).matchAll(/from '\.\/([^']+)'/g)].map(match => `${match[1]}.ts`).filter(target => sourceNames.includes(target));
  const closure = new Set<string>([DRIVER]);
  const queue = [DRIVER];
  while (queue.length) {
    for (const target of importsOf(queue.pop()!)) if (!closure.has(target)) {
      closure.add(target);
      queue.push(target);
    }
  }
  // Quoted model ids mentioned inside each builder module.
  const mentions = new Map<string, Set<string>>();
  const idSet = new Set(ids);
  for (const name of closure) {
    for (const match of read(root, `${LANDMARK_DIR}/${name}`).matchAll(/['"]([a-z0-9][a-z0-9-]*)['"]/g)) {
      if (!idSet.has(match[1])) continue;
      const set = mentions.get(match[1]) ?? new Set<string>();
      set.add(name);
      mentions.set(match[1], set);
    }
  }
  // A model-named module that a build module imports from outside that model is shared code too (e.g. a kit named after one landmark).
  // The driver's own dispatch to each builder is per-model, so it does not count.
  const importedShared = new Set<string>();
  for (const importer of closure) {
    if (importer === DRIVER) continue;
    for (const target of importsOf(importer)) if (ids.some(id => ownedBy(target, id) && !ownedBy(importer, id))) importedShared.add(target);
  }
  const sharedNames = sourceNames.filter(name => importedShared.has(name) || (closure.has(name) && !ids.some(id => ownedBy(name, id))));
  const toolchainFiles = [
    ...sharedNames.map(name => `${LANDMARK_DIR}/${name}`),
    ...SHARED_SOURCE_DIRS.flatMap(dir => listDir(root, dir).filter(isSource).map(name => `${dir}/${name}`)),
  ].sort();
  const toolchain = digest(toolchainFiles.flatMap(file => [file, read(root, file)]));

  const models: Record<string, string> = {};
  for (const spec of specs) {
    const id = spec.id;
    const files = new Set<string>();
    for (const name of sourceNames) if (name.startsWith(id) || mentions.get(id)?.has(name)) files.add(`${LANDMARK_DIR}/${name}`);
    for (const name of landmarkNames) if (name.startsWith(`${id}-`) && name.endsWith('.json')) files.add(`${LANDMARK_DIR}/${name}`);
    for (const name of listDir(root, INSTALLED_DIR)) if (name.startsWith(`${id}.`)) files.add(`${INSTALLED_DIR}/${name}`);
    models[id] = digest([toolchain, JSON.stringify(spec), ...[...files].sort().flatMap(file => [file, read(root, file)])]);
  }
  return {toolchain, models};
}
