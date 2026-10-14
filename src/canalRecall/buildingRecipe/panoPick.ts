/**
 * Panorama choice for `all-walls.ts` beyond "the straightest view wins" (De Hallen lane, 2026-10-14):
 *
 * - a date filter: `--date=` keeps only panoramas whose capture timestamp starts with one of the given prefixes
 *   (`2019`, `2022-05`, `2020-02-07`), `--exclude-date=` drops them, `--exclude-pano=` drops panorama ids. The
 *   Kinkerstraat survey found the halls' fronts washed out on 2024-12-11; this is how another capture day is asked for.
 * - segments: `--segment=<m>` cuts a wall longer than that into equal pieces, each with its own panorama, so a 130 m
 *   hall side is a mosaic of straight views instead of one crop from a camera 5 m off one end (cropToPanel
 *   `panelCoverage` already picks the best piece per metre).
 * - merging: a run with `--suffix=` writes its crops under `<tag><suffix>` and keeps the other rows of walls.json, so
 *   a second capture date sits beside the first instead of replacing it.
 */

export interface PanoFilter { dates?: string[]; excludeDates?: string[]; excludePanos?: string[] }

const list = (v: string | undefined) => (v ?? '').split(',').map(s => s.trim()).filter(Boolean);

/** Parse `--date=`, `--exclude-date=`, `--exclude-pano=` (comma lists) from an argv. Empty lists are left out. */
export function parsePanoFilter(argv: readonly string[]): PanoFilter {
  const arg = (n: string) => argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
  const out: PanoFilter = {};
  const dates = list(arg('date')), excludeDates = list(arg('exclude-date')), excludePanos = list(arg('exclude-pano'));
  for (const d of [...dates, ...excludeDates]) if (!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(d)) throw new Error(`date prefix must be YYYY, YYYY-MM or YYYY-MM-DD: ${d}`);
  if (dates.length) out.dates = dates;
  if (excludeDates.length) out.excludeDates = excludeDates;
  if (excludePanos.length) out.excludePanos = excludePanos;
  return out;
}

/** True when the filter has no condition (all-walls then behaves exactly as before). */
export const isEmptyFilter = (f: PanoFilter) => !f.dates?.length && !f.excludeDates?.length && !f.excludePanos?.length;

/** Keep the ranked candidates the filter allows, in their order. */
export function filterPanos<T extends {panoId: string; timestamp: string}>(ranked: readonly T[], f: PanoFilter): T[] {
  return ranked.filter(p => {
    const day = String(p.timestamp);
    if (f.dates?.length && !f.dates.some(d => day.startsWith(d))) return false;
    if (f.excludeDates?.some(d => day.startsWith(d))) return false;
    if (f.excludePanos?.includes(p.panoId)) return false;
    return true;
  });
}

interface Pt { x: number; y: number }
export interface WallLike { a: Pt; b: Pt; len: number; mid: Pt; nx: number; ny: number }

/**
 * Cut a wall into ceil(len / segM) equal pieces along a -> b (same normal and other fields); a wall no longer than
 * segM, or segM <= 0, comes back alone. Each piece gets `segment: {index, of}`.
 */
export function segmentWall<W extends WallLike>(w: W, segM: number): (W & {segment?: {index: number; of: number}})[] {
  if (!(segM > 0) || w.len <= segM) return [w];
  const n = Math.ceil(w.len / segM), dx = (w.b.x - w.a.x) / n, dy = (w.b.y - w.a.y) / n;
  return Array.from({length: n}, (_, i) => {
    const a = {x: w.a.x + dx * i, y: w.a.y + dy * i}, b = {x: w.a.x + dx * (i + 1), y: w.a.y + dy * (i + 1)};
    return {...w, a, b, len: w.len / n, mid: {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2}, segment: {index: i, of: n}};
  });
}

/** Tag of a segment: `w03-67` for a whole wall, `w03-67s2` for its second piece (1-based), then the run's suffix. */
export const segmentTag = (tag: string, seg: {index: number; of: number} | undefined, suffix = '') => `${tag}${seg ? `s${seg.index + 1}` : ''}${suffix}`;

const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * walls.json rows after a merging run: earlier rows whose tag this run wrote are replaced, and so is every earlier crop
 * of a wall this run re-cut with the same suffix (`w01-67`, `w01-67L`, `w01-67s3`, `w01-67s3L` for `rerun` `w01-67`), so a
 * second segmentation leaves no stale pieces; other rows are kept. Tag order.
 */
export function mergeWallRows<R extends {tag: string}>(existing: readonly R[], fresh: readonly R[], rerun: readonly string[] = [], suffix = ''): R[] {
  const tags = new Set(fresh.map(r => r.tag));
  const stale = rerun.map(w => new RegExp(`^${escape(w)}(s\\d+)?${escape(suffix)}L?$`));
  return [...existing.filter(r => !tags.has(r.tag) && !stale.some(re => re.test(r.tag))), ...fresh].sort((p, q) => p.tag < q.tag ? -1 : p.tag > q.tag ? 1 : 0);
}
