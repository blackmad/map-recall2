/**
 * Shared house-type library: one `HouseTypeIntent` per file under `scripts/block-face/types/<district>/<id>.json`.
 * A block face's `types` list may name a library type by its id (a string) instead of inlining it; the loader below
 * resolves the id. The file is the same shape as an inline type plus `district` (its folder) and, optionally,
 * `schemaLimits` (what the schema cannot express about this type). Node-only (reads the filesystem).
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import type {HouseTypeIntent} from './houseType.ts';

/** A house type as stored in the library: an inline type plus where it lives and what the schema cannot say. */
export interface LibraryHouseType extends HouseTypeIntent {
  district: string;
  schemaLimits?: string[];
}

/** Resolves a library type id; undefined when there is no such type. */
export type TypeLoader = (id: string) => HouseTypeIntent | undefined;

export const TYPE_LIBRARY_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../scripts/block-face/types');

/** A loader over a library directory (`<dir>/<district>/<id>.json`). Throws if a file's id/district disagree with its path. */
export function fileTypeLoader(dir: string = TYPE_LIBRARY_DIR): TypeLoader {
  const cache = new Map<string, HouseTypeIntent | undefined>();
  return id => {
    if (cache.has(id)) return cache.get(id);
    let found: HouseTypeIntent | undefined;
    if (/^[a-z0-9-]+$/.test(id) && fs.existsSync(dir)) {
      const hits = fs.readdirSync(dir).filter(d => fs.existsSync(path.join(dir, d, `${id}.json`)));
      if (hits.length > 1) throw Error(`house type ${id} exists in several districts: ${hits.join(', ')}`);
      if (hits.length) {
        const t = JSON.parse(fs.readFileSync(path.join(dir, hits[0], `${id}.json`), 'utf8')) as LibraryHouseType;
        if (t.id !== id) throw Error(`library type ${hits[0]}/${id}.json has id "${t.id}"`);
        if (t.district !== hits[0]) throw Error(`library type ${id}: district "${t.district}" must equal its folder "${hits[0]}"`);
        found = t;
      }
    }
    cache.set(id, found);
    return found;
  };
}

export const defaultTypeLoader: TypeLoader = fileTypeLoader();

/** A map-backed loader (tests, in-memory libraries). */
export const mapTypeLoader = (types: HouseTypeIntent[]): TypeLoader => { const m = new Map(types.map(t => [t.id, t])); return id => m.get(id); };

/**
 * Resolve a face's `types` (inline objects and library ids) to inline types, in the face's order. Problems (unknown id,
 * duplicate id across inline and library entries) are returned, not thrown, so validation reports them with the rest.
 */
export function resolveTypeList(list: readonly (HouseTypeIntent | string)[] | undefined, load: TypeLoader = defaultTypeLoader): {types: HouseTypeIntent[]; problems: string[]} {
  const types: HouseTypeIntent[] = [], problems: string[] = [], seen = new Set<string>();
  for (const entry of list ?? []) {
    let t: HouseTypeIntent | undefined = entry as HouseTypeIntent;
    if (typeof entry === 'string') {
      try { t = load(entry); } catch (e) { problems.push((e as Error).message); continue; }
      if (!t) { problems.push(`types: library type "${entry}" not found (scripts/block-face/types/<district>/${entry}.json)`); continue; }
    }
    if (seen.has(t?.id)) problems.push(`types: duplicate type id ${t?.id}`);
    seen.add(t?.id);
    types.push(t);
  }
  return {types, problems};
}
