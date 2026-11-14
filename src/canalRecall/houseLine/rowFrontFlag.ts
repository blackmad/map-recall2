// The house-rows flag on its own, for modules that must not pull the renderer in (landmarks/ordinaryChunks.ts: a
// chunk's ROW_FRONT variant). Three modes: `all` (`?rowFront=1`, ROW_FRONT=1: every record, published or staged),
// `off` (`?rowFront=0`, ROW_FRONT=0) and, with neither, `published` (only the rows in publishedRows.ts; `off` when
// none is published).
import { PUBLISHED_ROWS } from './publishedRows.js';

export const ROW_FRONT_DEFAULT = false;
export type RowFrontMode = 'off' | 'published' | 'all';
type Published = { readonly rows: readonly string[]; readonly chunks: readonly string[] };

export function rowFrontMode(search?: string | null, env?: string | null, published: Published = PUBLISHED_ROWS): RowFrontMode {
  const q = search ? /[?&]rowFront=([01])\b/.exec(search)?.[1] : undefined;
  const v = q ?? (env === '0' || env === '1' ? env : undefined);
  if (v === '1') return 'all';
  if (v === '0') return 'off';
  if (ROW_FRONT_DEFAULT) return 'all';
  return published.rows.length ? 'published' : 'off';
}
/** Any row draws (the decorator runs, the records load). */
export function rowFrontEnabled(search?: string | null, env?: string | null): boolean {
  return rowFrontMode(search, env) !== 'off';
}
/** The mode as this page or process states it. */
export function rowFrontModeNow(): RowFrontMode {
  const g = globalThis as { location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  return rowFrontMode(g.location?.search ?? null, g.process?.env?.ROW_FRONT ?? null);
}
/** The row a record's series belongs to (`kinkerstraat-86-110/s3` -> `kinkerstraat-86-110`), or null. */
export const rowOfSeries = (seriesId: string | undefined | null): string | null => seriesId ? seriesId.split('/')[0] : null;
/** Whether a record of this row draws in `mode`. */
export function rowDraws(rowId: string | null, mode: RowFrontMode, published: Published = PUBLISHED_ROWS): boolean {
  return mode === 'all' || (mode === 'published' && rowId !== null && published.rows.includes(rowId));
}
/** Whether a street chunk loads its ROW_FRONT variant (the walls a row draws left out) in `mode`. */
export function chunkVariantOn(chunkId: string, mode: RowFrontMode = rowFrontModeNow(), published: Published = PUBLISHED_ROWS): boolean {
  return mode === 'all' || (mode === 'published' && published.chunks.includes(chunkId));
}
