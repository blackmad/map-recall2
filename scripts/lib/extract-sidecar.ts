/**
 * Read and write extract partitions together with their build-only sidecar
 * (`src/canalRecall/extractSidecar.ts` says which fields and why).
 *
 * Sidecars live outside the served tree, at
 * `scripts/data/extract-sidecars/<city>/<file>`, keyed by feature id.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mergeSidecar, sidecarFieldsFor, splitSidecar, updateSidecar, type Sidecar,
} from '../../src/canalRecall/extractSidecar.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function sidecarPath(cityId: string, file: string): string {
  return path.join(root, 'scripts/data/extract-sidecars', cityId, file);
}

export function loadSidecar(cityId: string, file: string): Sidecar {
  const at = sidecarPath(cityId, file);
  return existsSync(at) ? JSON.parse(readFileSync(at, 'utf8')) as Sidecar : {};
}

/** The city a partition directory belongs to: `public/data/extracts/<city>`
 *  and the staging work directories `…/staging/<step>/<city>` both end in it. */
export const cityOfDirectory = (directory: string) => path.basename(path.resolve(directory));

/** A partition as the pipeline sees it: shipped fields plus the sidecar. */
export function readPartition<T extends { id?: string }>(directory: string, file: string, cityId = cityOfDirectory(directory)): T[] {
  const features = JSON.parse(readFileSync(path.join(directory, file), 'utf8')) as T[];
  return sidecarFieldsFor(file).length ? mergeSidecar(features, loadSidecar(cityId, file)) : features;
}

/** The shipped JSON for `features`, after moving their sidecar fields into the
 *  city's sidecar file. Returns the serialised partition so callers keep their
 *  own write (dry runs, staging paths). */
export function shipPartition<T extends { id?: string }>(file: string, features: readonly T[], cityId: string): string {
  const { shipped, sidecar } = splitSidecar(file, features);
  if (sidecarFieldsFor(file).length) {
    const at = sidecarPath(cityId, file);
    mkdirSync(path.dirname(at), { recursive: true });
    writeFileSync(at, `${JSON.stringify(updateSidecar(loadSidecar(cityId, file), features, sidecar))}\n`);
  }
  return JSON.stringify(shipped);
}

/** `shipPartition` and write it to `<directory>/<file>`. */
export function writePartition<T extends { id?: string }>(directory: string, file: string, features: readonly T[], cityId = cityOfDirectory(directory)): void {
  writeFileSync(path.join(directory, file), shipPartition(file, features, cityId));
}
