// The per-face loop of scripts/look/build-chunk-wall-exposure.ts, made robust (2026-11-22).
//
// Why: the archived strip for `bellamyplein-18-38-r1` (map-recall2-source-data models/<id>/files/strip.jpg) is an
// older 1101 px crop while the face's strip.json spans run to 2203 px, so measureStripPalette was handed columns past
// the image and threw "RangeError: Invalid typed array length". One bad face stopped every face from being measured,
// and integrators ran the build with `--archive=/nonexistent` to get past it.
//
// Two guards:
//  - pickStripImage skips a candidate image whose size differs from strip.json `width` x `height` (the spans are in
//    that image's pixels; a different-size image measures the wrong walls even when it does not crash);
//  - rebuildExposure measures each face in its own try/catch: a face that throws keeps the entry it was published
//    with (or none) and is logged, and the others are measured as usual.

export type ExposureEntry = {readonly white: readonly [number, number, number] | null; readonly stripOverDrawn: number | null};
export type ImageSize = {width: number; height: number};

/**
 * The first candidate that exists and has the strip's own size. `sizeOf` returns undefined for a missing file.
 * `rejected` names candidates that exist but have another size, for the log.
 */
export async function pickStripImage(candidates: readonly (string | undefined)[], expected: ImageSize, sizeOf: (file: string) => Promise<ImageSize | undefined>): Promise<{file?: string; rejected: string[]}> {
  const rejected: string[] = [];
  for (const file of candidates) {
    if (!file) continue;
    const size = await sizeOf(file);
    if (!size) continue;
    if (size.width === expected.width && size.height === expected.height) return {file, rejected};
    rejected.push(`${file} is ${size.width}x${size.height}, strip.json says ${expected.width}x${expected.height}`);
  }
  return {rejected};
}

/**
 * Measure every chunk. `measure` returns the chunk's entry (undefined = no entry: fallback gain) and its log row, or
 * `{keep: true}` to keep the published entry (strip image missing). A throw keeps the published entry too and is
 * listed in `failed`.
 */
export async function rebuildExposure<E = ExposureEntry>(
  names: readonly string[],
  measure: (name: string) => Promise<{entry?: E; keep?: boolean; row: string}>,
  published: Readonly<Record<string, E>>,
): Promise<{entries: Record<string, E>; rows: string[]; failed: string[]}> {
  const entries: Record<string, E> = {}, rows: string[] = [], failed: string[] = [];
  for (const name of names) {
    let result: {entry?: E; keep?: boolean; row: string};
    try { result = await measure(name); } catch (e) {
      failed.push(name);
      const kept = published[name];
      if (kept) entries[name] = kept;
      rows.push(`${name}: measure failed (${e instanceof Error ? e.message : String(e)}); ${kept ? 'kept the published entry' : 'no published entry: fallback gain'}`);
      continue;
    }
    if (result.keep) { const kept = published[name]; if (kept) entries[name] = kept; rows.push(`${result.row}; ${kept ? 'kept the published entry' : 'fallback gain'}`); continue; }
    if (result.entry) entries[name] = result.entry;
    rows.push(result.row);
  }
  return {entries, rows, failed};
}
