// Fields an extract partition carries for the build pipeline but no runtime
// reads, kept beside the shipped file instead of inside it.
//
// `bridges.json` is waited on at ride start. 470 KB of its 1,055 KB was text
// only the enrich/translate passes use: `wikipediaSourceText` (the 2,400-char
// intro the card never shows; its 360-char cut is `wikipediaExtract`) and
// `wikipediaExtractOriginal` (the Dutch lede a translation was made from,
// which the translate pass hashes against `scripts/english-translations.json`).
// The pipeline reads a partition merged with its sidecar and writes it split,
// so the passes see exactly what they saw before and the shipped file never
// regains the fields.

/** Partition file → fields that live in the sidecar. Checked 2026-10-17 by
 *  grep over src/ and public/canal-drive/: nothing reads these from bridges. */
export const SIDECAR_FIELDS: Readonly<Record<string, readonly string[]>> = {
  'bridges.json': [
    'wikipediaSourceText',
    'wikipediaExtractOriginal',
    'wikipediaExtractOriginalLang',
    // Prominence inputs: the generator folds them into prominenceScore.
    'encyclopediaScore',
    'wikidataSitelinks',
    'wikipediaPageviews60d',
  ],
};

export type SidecarRecord = Record<string, unknown>;
/** Feature id → its sidecar fields. */
export type Sidecar = Record<string, SidecarRecord>;

interface Identified { id?: string; [field: string]: unknown }

export function sidecarFieldsFor(file: string): readonly string[] {
  return SIDECAR_FIELDS[file] ?? [];
}

/** The shipped features (sidecar fields removed, key order kept) and the
 *  removed fields by id. A feature without an id keeps its fields: there is
 *  nothing to join them back on. */
export function splitSidecar<T extends Identified>(file: string, features: readonly T[]): { shipped: T[]; sidecar: Sidecar } {
  const fields = sidecarFieldsFor(file);
  const sidecar: Sidecar = {};
  if (!fields.length) return { shipped: [...features], sidecar };
  const shipped = features.map((feature) => {
    if (!feature.id) return feature;
    const record: SidecarRecord = {};
    const kept = {} as T;
    for (const [key, value] of Object.entries(feature)) {
      if (fields.includes(key)) { if (value !== undefined) record[key] = value; } else (kept as Record<string, unknown>)[key] = value;
    }
    if (Object.keys(record).length) sidecar[feature.id] = record;
    return kept;
  });
  return { shipped, sidecar };
}

/** Features with their sidecar fields restored. A field already on the
 *  feature wins (an unsplit file is read as it is). */
export function mergeSidecar<T extends Identified>(features: readonly T[], sidecar: Sidecar | null | undefined): T[] {
  if (!sidecar) return [...features];
  return features.map((feature) => {
    const record = feature.id ? sidecar[feature.id] : undefined;
    if (!record) return feature;
    const merged = { ...feature } as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) if (merged[key] === undefined) merged[key] = value;
    return merged as T;
  });
}

/** `previous` updated with what was just written: the written ids are
 *  replaced wholesale (a field a pass deleted goes), other ids are kept, so a
 *  pass over a subset (a staging work file) does not drop the rest. */
export function updateSidecar(previous: Sidecar, written: readonly Identified[], next: Sidecar): Sidecar {
  const result: Sidecar = { ...previous };
  for (const feature of written) if (feature.id) delete result[feature.id];
  for (const [id, record] of Object.entries(next)) result[id] = record;
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}
