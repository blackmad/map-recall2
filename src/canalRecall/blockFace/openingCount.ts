/**
 * Openings per storey for the block-face review, comparing like with like.
 *
 * The old counter clustered every glazed opening of a pand by height and compared the clusters with the photo's
 * hand-counted rows. That mixes up three different things: the ground band (a pui or arcade whose bays carry a
 * transom light, a shop with a mezzanine transom, a door fanlight, a basement under a raised ground storey), the
 * upper storeys, and the gable/dormer windows above the eaves. On Oudezijds Achterburgwal 45 the arcade transoms
 * became a second "row", on 47/49 a door fanlight was the whole ground row, and on 53-55 two fronts with
 * different storey heights split one storey into two rows.
 *
 * Model side (exact): each front's storey bands come from the compiled storey heights (report.json). The ground band
 * runs up to the top of the ground storey (plus a basement and a shop mezzanine storey); every upper storey is its
 * own band; openings above the last storey are attic rows (gable windows, dormers), clustered by height. Within a
 * band, openings stacked over one another (window + transom, door + fanlight) are ONE bay: a band counts columns.
 * Fronts of one pand add up storey by storey from the bottom, attic rows from the bottom of the attic.
 *
 * Photo side: `photoRows` (bottom→top). The leading `photoGroundRows` entries are the ground band (default 1, or 2
 * when the second row is a lone transom/mezzanine row). The rest are compared row by row with the model's upper
 * storeys followed by its attic rows. The ground band is compared as a bay count: photo counts glazed openings
 * there, and authors differ on whether an unglazed door or a closed roller shutter counts, so the photo's ground
 * total must lie between the model's glazed-bay count and its all-bay count (glass, doors, shutters).
 */
import type {Check, Opening} from '../landmarks/facadeCompare.ts';

/** One front of a pand: its span along the facade (same metres as `Opening.t0/t1`) and storey bands. */
export interface FrontBands {
  id: string;
  t0: number;
  t1: number;
  /** Storey heights bottom→top as compiled (a basement first when the front has one). */
  storeyHeightsM: number[];
  /** How many of the first storeys form the ground band (basement + ground + a shop mezzanine storey). */
  groundStoreys: number;
}

export interface BandCounts {
  /** Ground-band bays with glass (window, glazed door, transom or fanlight over a door). */
  groundGlazed: number;
  /** Ground-band bays of any opening (glass, door, roller shutter). */
  groundAll: number;
  /** Glazed bays per upper storey, bottom→top (fronts summed storey by storey). */
  upper: number[];
  /** Glazed openings per attic row (gable windows, dormers) bottom→top (fronts summed row by row). */
  attic: number[];
  /** Ground-band top per front (metres above the street), for the sheet. */
  groundTopM: number[];
}

const centreT = (o: Opening) => (o.t0 + o.t1) / 2, centreY = (o: Opening) => (o.y0 + o.y1) / 2;

/** Bays: openings whose horizontal extents overlap (a transom over its door, a fanlight over a window) are one column. */
export function columns(openings: Opening[], overlapM = 0.1) {
  const s = [...openings].sort((a, b) => a.t0 - b.t0);
  let n = 0, end = -Infinity;
  for (const o of s) {
    if (o.t0 < end - overlapM) end = Math.max(end, o.t1);
    else { n++; end = o.t1; }
  }
  return n;
}

/** Count one front's openings by band. `glazed` and `all` are the same facade measured with glass only / glass + door surfaces. */
export function countFront(glazed: Opening[], all: Opening[], f: FrontBands) {
  const inFront = (o: Opening) => centreT(o) >= f.t0 && centreT(o) < f.t1;
  const g = glazed.filter(inFront), a = all.filter(inFront);
  const tops: number[] = [];
  let y = 0;
  for (const h of f.storeyHeightsM) tops.push(y += h);
  const groundTop = tops[Math.max(0, Math.min(f.groundStoreys, tops.length) - 1)] ?? 0;
  const eaves = tops[tops.length - 1] ?? 0;
  const ground = (o: Opening) => centreY(o) < groundTop;
  const upper: number[] = [];
  for (let k = f.groundStoreys; k < tops.length; k++) {
    const lo = tops[k - 1] ?? 0, hi = tops[k];
    upper.push(columns(g.filter(o => centreY(o) >= lo && centreY(o) < hi)));
  }
  // Attic: rows by height (gap 0.9 m between opening centres), each row counted as columns.
  const above = g.filter(o => centreY(o) >= eaves).sort((p, q) => centreY(p) - centreY(q));
  const attic: number[] = [];
  let row: Opening[] = [];
  for (const o of above) {
    if (row.length && centreY(o) - centreY(row[row.length - 1]) > 0.9) { attic.push(columns(row)); row = []; }
    row.push(o);
  }
  if (row.length) attic.push(columns(row));
  return {groundGlazed: columns(g.filter(ground)), groundAll: columns(a.filter(ground)), upper, attic, groundTopM: +groundTop.toFixed(2)};
}

const sumByIndex = (lists: number[][]) => Array.from({length: Math.max(0, ...lists.map(l => l.length))}, (_, i) => lists.reduce((s, l) => s + (l[i] ?? 0), 0));

/** Count a pand (one or more fronts side by side). */
export function countBands(glazed: Opening[], all: Opening[], fronts: FrontBands[]): BandCounts {
  const per = fronts.map(f => countFront(glazed, all, f));
  return {
    groundGlazed: per.reduce((s, p) => s + p.groundGlazed, 0),
    groundAll: per.reduce((s, p) => s + p.groundAll, 0),
    upper: sumByIndex(per.map(p => p.upper)),
    attic: sumByIndex(per.map(p => p.attic)),
    groundTopM: per.map(p => p.groundTopM),
  };
}

/** Split the photo's rows into the ground band and the rows above it. */
export function photoBands(rows: number[], groundRows?: number) {
  let g = groundRows ?? 1;
  if (groundRows === undefined && rows.length >= 3 && rows[1] < rows[0] && rows[1] < rows[2]) g = 2;
  g = Math.max(1, Math.min(g, rows.length));
  return {ground: rows.slice(0, g), above: rows.slice(g)};
}

/** Ground storeys of a front from its intent: a basement, the ground storey, and the upper half of a double-height shop. */
export function groundStoreysOf(front: {basement?: string; shopfront?: {storeys?: number} | null}) {
  return (front.basement && front.basement !== 'none' ? 1 : 0) + (front.shopfront?.storeys === 2 ? 2 : 1);
}

export function compareBands(name: string, photoRows: number[], m: BandCounts, opts: {groundRows?: number; tolerance?: number} = {}): Check[] {
  const p = photoBands(photoRows, opts.groundRows);
  const groundPhoto = p.ground.reduce((s, n) => s + n, 0);
  const tol = (n: number) => opts.tolerance ?? (n >= 12 ? 1 : 0);
  const modelAbove = [...m.upper, ...m.attic];
  const aboveOk = p.above.length === modelAbove.length && p.above.every((n, i) => Math.abs(n - modelAbove[i]) <= tol(n));
  const groundOk = groundPhoto >= m.groundGlazed - tol(groundPhoto) && groundPhoto <= m.groundAll + tol(groundPhoto);
  const range = m.groundGlazed === m.groundAll ? `${m.groundAll}` : `${m.groundGlazed}-${m.groundAll}`;
  return [
    {facade: name, what: 'ground bays', expected: `${groundPhoto}${p.ground.length > 1 ? ` (${p.ground.join('+')})` : ''}`, measured: `${range} below ${m.groundTopM.join('/')} m`, pass: groundOk},
    {facade: name, what: 'rows above ground', expected: p.above.join(','), measured: `${m.upper.join(',')}${m.attic.length ? ' + attic ' + m.attic.join(',') : ''}`, pass: aboveOk},
  ];
}
