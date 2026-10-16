/**
 * Pands whose drawing an installed model, kit, building type or recipe tile
 * already owns, so a tower-podium split must leave them as one feature.
 *
 * Every hide path in the runtime (covers.json, `suppressOsmIds`, kit hide
 * sets, building-type suppression, recipe-tile covers) matches the feature's
 * exact `id`. The tower feature of a split carries its own id
 * (`towerFeatureId`) with the pand in `pand`, and none of those paths read
 * `pand` yet, so a model hiding the pand would leave its tower standing. Until
 * the sinks resolve `pand`, a pand any of these sources names is not split.
 * Membership is a plain text search for the 16-digit id, so over-matching only
 * keeps a pand on its old height.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

export const TOWER_OWNER_SOURCES = [
  path.join('public', 'canal-drive', 'models'),
  path.join('public', 'canal-drive', 'building-types'),
  path.join('public', 'canal-drive', 'recipe-tiles'),
  path.join('src', 'canalRecall', 'landmarkKits.ts'),
];

function* files(entry: string): Generator<string> {
  if (!existsSync(entry)) return;
  if (statSync(entry).isFile()) { yield entry; return; }
  for (const name of readdirSync(entry)) yield* files(path.join(entry, name));
}

/** The subset of `pandIds` (full `NL.IMBAG.Pand.…` ids) named anywhere in the owner sources, with the file that names each. */
export function modelOwnedPands(pandIds: Iterable<string>, sources = TOWER_OWNER_SOURCES): Map<string, string> {
  const wanted = new Map([...pandIds].map(id => [id.slice(-16), id]));
  const owned = new Map<string, string>();
  for (const source of sources) for (const file of files(source)) {
    if (!/\.(json|ts|js|json\.gz)$/.test(file)) continue;
    let bytes = readFileSync(file);
    if (file.endsWith('.gz')) bytes = gunzipSync(bytes);
    const text = bytes.toString('utf8');
    for (const [short, id] of wanted) if (!owned.has(id) && text.includes(short)) owned.set(id, file);
  }
  return owned;
}
