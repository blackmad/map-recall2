/**
 * Decisions of the unattended block-face batch installer (scripts/block-face/batch.ts): which pands a face may claim
 * when installed chunks already own some of them, which strip dates to fall back to, and the install verdict from the
 * compile gates, the GLB audit, the per-pand likeness and the face's stripOverDrawn. No human or agent edits: a face
 * that fails any check stays generic and its reasons are logged.
 */
import {STRIP_LIKENESS} from './stripLikeness.ts';
import {drawnWallLuma, type DrawnWallPalette} from '../look/drawnWall.ts';
import {hexToRgb, hslToRgb, rgbToHex, rgbToHsl} from '../look/palette.ts';

export const BATCH_GATES = {
  /** lin(strip wall) / lin(drawn wall), face median (look/chunkWallExposure.ts); outside this the walls draw at the wrong tone. */
  stripOverDrawn: [0.8, 1.25] as const,
  /** Per-pand edge NCC floor (blockFace/stripLikeness.ts): under it the model is wrong for its photo. */
  minNcc: STRIP_LIKENESS.minNcc,
  /** Share of a face's pands that must carry their own photo evidence (the rest abstain: foliage, grey, vans). */
  minEvidenceShare: 0.5,
  /** A face of fewer pands is not a row. */
  minPands: 2,
} as const;

const bare = (id: string) => id.replace(/^NL\.IMBAG\.Pand\./, '');

/** Pands of `members` that an installed chunk other than `own` already suppresses: pandId -> chunk id. */
export function coveredElsewhere(members: readonly string[], chunks: readonly {id: string; suppress: readonly string[]}[], own: ReadonlySet<string>): Map<string, string> {
  const by = new Map<string, string>();
  for (const c of chunks) if (!own.has(c.id)) for (const s of c.suppress) by.set(bare(s), c.id);
  return new Map(members.filter(m => by.has(m)).map(m => [m, by.get(m)!]));
}

/**
 * Corner pands an installed face already owns are never taken: installing a chunk replaces every chunk that shares a
 * suppressed pand (compile.ts installFace), which would drop that chunk's other pands (#98: Kinkerstraat 49-63's corner
 * 133467 belongs to face-bilder-133467-159649; installing it would have dropped 153782 and 159649). The installed face
 * keeps the corner and this face is trimmed to the run between them. A shared pand inside the face (not at an end) would
 * split it; that face is not installed.
 */
export function trimShared(members: readonly string[], shared: ReadonlySet<string>): {keep: string[]; dropped: string[]} | {error: string} {
  let a = 0, b = members.length;
  while (a < b && shared.has(members[a])) a++;
  while (b > a && shared.has(members[b - 1])) b--;
  const keep = members.slice(a, b);
  const inner = keep.filter(m => shared.has(m));
  if (inner.length) return {error: `shared pand inside the face (${inner.map(m => m.slice(-6)).join(', ')})`};
  if (keep.length < BATCH_GATES.minPands) return {error: `${keep.length} pand(s) left after the shared corners`};
  return {keep, dropped: [...members.slice(0, a), ...members.slice(b)]};
}

/** Fallback strip dates: full coverage first, leaf-off (Nov-Apr) first, newest first; never the current or a tried date. */
export function restripDates(candidatesByDate: Readonly<Record<string, number>>, members: number, current: string, tried: readonly string[] = [], max = 3): string[] {
  const leafOff = (d: string) => { const m = Number(d.slice(5, 7)); return m <= 4 || m >= 11; };
  return Object.entries(candidatesByDate)
    .filter(([d, n]) => d !== current && !tried.includes(d) && n >= Math.max(1, Math.ceil(members * 0.8)))
    .sort(([a, na], [b, nb]) => nb - na || Number(leafOff(b)) - Number(leafOff(a)) || b.localeCompare(a))
    .slice(0, max).map(([d]) => d);
}

export interface VerdictInput {
  strip: {bad: boolean; reasons: readonly string[]};
  compile: {error?: string; gatesFailed: readonly string[]; auditPassed: boolean};
  likeness: readonly {pandId: string; ncc: number | null}[];
  stripOverDrawn: number | null;
  brickPands: number;
  /** The strip evidence gate over the finished run (evidence-gate.ts runEvidence, #120): authored intents bypass the
   * auto-place hold, so the batch asks again before install. Absent (not measured) = no change. */
  evidence?: {pass: boolean; reasons: readonly string[]} | null;
}

/** Install only when everything passes; otherwise the stable reason codes (the report groups by the part before ':'). */
export function installVerdict(v: VerdictInput): {install: boolean; reasons: string[]} {
  const reasons: string[] = [];
  if (v.strip.bad) reasons.push(`strip-quality: ${v.strip.reasons.join(', ') || 'bad'}`);
  if (v.compile.error) reasons.push(`compile-error: ${v.compile.error.slice(0, 120)}`);
  else {
    if (v.compile.gatesFailed.length) reasons.push(`compile-gates: ${v.compile.gatesFailed.slice(0, 4).join('; ')}`);
    if (!v.compile.auditPassed) reasons.push('glb-audit: failed (see report.json audit)');
    const low = v.likeness.filter(l => l.ncc !== null && l.ncc < BATCH_GATES.minNcc);
    if (low.length) reasons.push(`likeness: ${low.length} pand(s) under NCC ${BATCH_GATES.minNcc} (${low.map(l => `${l.pandId.slice(-6)} ${l.ncc}`).join(', ')})`);
    const evidence = v.likeness.filter(l => l.ncc !== null).length;
    if (!v.likeness.length || evidence / v.likeness.length < BATCH_GATES.minEvidenceShare) reasons.push(`likeness-no-evidence: ${evidence}/${v.likeness.length} pands scored`);
    if (v.evidence && !v.evidence.pass) reasons.push(`no-front: ${v.evidence.reasons.slice(0, 3).join('; ')}`);
    const [lo, hi] = BATCH_GATES.stripOverDrawn;
    if (v.brickPands > 0) {
      if (v.stripOverDrawn === null) reasons.push('strip-over-drawn: unmeasured');
      else if (v.stripOverDrawn < lo) reasons.push(`strip-over-drawn-low: ${v.stripOverDrawn} < ${lo} (walls drawn lighter than the photo)`);
      else if (v.stripOverDrawn > hi) reasons.push(`strip-over-drawn-high: ${v.stripOverDrawn} > ${hi} (walls drawn darker than the photo)`);
    }
  }
  return {install: reasons.length === 0, reasons};
}

/** A deterministic sample of `share` of the items (at least one when any): the spot-review contact sheet. */
export function sampleShare<T>(items: readonly T[], share = 0.1, seed = 7): T[] {
  if (!items.length) return [];
  let s = seed >>> 0;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
  const idx = items.map((_, i) => ({i, k: rand()})).sort((a, b) => a.k - b.k).slice(0, Math.max(1, Math.round(items.length * share))).map(x => x.i).sort((a, b) => a - b);
  return idx.map(i => items[i]);
}

/**
 * Front-level palette overrides (`type.overrides.palette`) build a 3 cm brick facing that lies 1 cm off shop doors and
 * cornice soffits, which the GLB audit fails as coplanar overlap (#98 moved them by hand on Kinkerstraat 1-29, 31-49 and
 * 49-63; the batch's first Kinkerstraat run found the same door/brick z-fight on 65-87, 173-225, 265-313 and 363-371).
 * Moved to the house palette (`type.paletteOverrides`), the colour is the same and there is no facing. Module-level
 * palettes are left alone (per-module colour has no house-level equivalent). Returns the houses changed.
 */
export function facingsToHousePalette(intent: {houses: {pandId: string; type?: {overrides?: Record<string, unknown> & {palette?: Record<string, unknown>}; paletteOverrides?: Record<string, unknown>}}[]}): string[] {
  const changed: string[] = [];
  for (const h of intent.houses) {
    const t = h.type, p = t?.overrides?.palette;
    if (!t || !p || typeof p !== 'object') continue;
    t.paletteOverrides = {...(t.paletteOverrides ?? {}), ...p};
    delete t.overrides!.palette;
    if (!Object.keys(t.overrides!).length) delete t.overrides;
    changed.push(h.pandId);
  }
  return changed;
}

/**
 * Pands whose build year some library type admits (autoPlace.ts scoreType's year veto, `yearSlack` included). A face
 * with fewer than two such pands cannot place a run, so the batch logs it without re-taking its strip (Helmersbuurt
 * Oost: Overtoom, Huygensstraat and Nassaukade fronts outside the 1893-1912 library cost a panorama fetch each).
 */
export function libraryYearMatches(years: readonly (number | null)[], types: readonly {match?: {years: readonly [number, number]; yearSlack?: number}}[], defaultSlack = 2): number {
  return years.filter(y => y !== null && types.some(t => t.match && y >= t.match.years[0] - (t.match.yearSlack ?? defaultSlack) && y <= t.match.years[1] + (t.match.yearSlack ?? defaultSlack))).length;
}

/**
 * The brick whose head-on drawn wall (look/drawnWall.ts drawnWallLuma: city tint x brick cell mean) has the luma of the
 * strip's wall, keeping the hue and saturation of `hueFrom` (the photo-fitted brick, fit-wall-palette.ts): stripOverDrawn
 * = lin(strip wall) / lin(drawn wall) = 1 by construction. The review-render fit alone overshot on De Pijp rows
 * (Frans Halsstraat 42-66 0.66 -> 1.35, Gerard Doustraat 128-174 0.74 -> 1.30: the render's light is not the drawn
 * luma). `reached` is false when the city tint's lightness clamp cannot draw the wall that light or dark (pale buff
 * fronts, Albert Cuypstraat 153-179 at 2.1).
 */
export function brickForDrawnLuma(hueFrom: string, targetLuma: number, base: Omit<DrawnWallPalette, 'brick'> = {}): {brick: string; luma: number; reached: boolean} {
  const [h, s] = rgbToHsl(hexToRgb(hueFrom));
  const at = (l: number) => { const brick = rgbToHex(hslToRgb([h, s, l])); return {brick, luma: drawnWallLuma({...base, brick})}; };
  let lo = 0.02, hi = 0.98;
  for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (at(mid).luma < targetLuma) lo = mid; else hi = mid; }
  const best = at((lo + hi) / 2);
  return {...best, luma: +best.luma.toFixed(2), reached: Math.abs(best.luma - targetLuma) <= Math.max(1, targetLuma * 0.03)};
}

/**
 * The faces a batch run takes (#157 fix 1). With `--buurt` the run used to iterate every uncovered proposal of the buurt
 * and ignore `--faces`; in Transvaalbuurt round 4 it re-auto-placed and installed kruger-32-40, a face another lane owned.
 * `requested` (`--faces=` or its alias `--only=`) now restricts the buurt run to those faces, in the buurt's order; a
 * requested id that is not one of the buurt's candidate faces is returned in `missing` so the caller can refuse to start.
 */
export function selectBatchFaces<F extends {id: string}>(candidates: readonly F[], requested: readonly string[] | null): {faces: F[]; missing: string[]} {
  if (!requested) return {faces: [...candidates], missing: []};
  const want = new Set(requested);
  return {faces: candidates.filter(f => want.has(f.id)), missing: [...want].filter(id => !candidates.some(f => f.id === id))};
}

/**
 * The batch's auto-place command line for one face (#157 fix 2): the buurt, the library, the face, and the switches a
 * buurt run must carry through: `--photo-decides` (round 2 left it off and the 1911 low/tall-ground twins flipped) and
 * `--replace=<run>` (auto-place keeps every run with an installed chunk unless it is named here).
 */
export function autoPlaceArgs(o: {buurt: string; district: string; face: string; photoDecides: boolean; replace?: readonly string[]}): string[] {
  const replace = (o.replace ?? []).filter(r => r === o.face || r.startsWith(`${o.face}-`));
  return ['--import', 'tsx', 'scripts/block-face/auto-place.ts', `--buurt=${o.buurt}`, `--district=${o.district}`, `--only=${o.face}`,
    ...(o.photoDecides ? ['--photo-decides'] : []), ...(replace.length ? [`--replace=${replace.join(',')}`] : [])];
}

/**
 * The batch's per-pand wall refit measures the wall from tree-free columns only (#157 fix 3). On Danie Theronstraat
 * (2020-04-29 strips) the refit read the street trees and hedges in front of 13A, 16A, 23A and 28 as wall and drew them
 * near-black and olive (#0e0d09, #1f1e15); lane #155 installed one measured brick per row instead.
 *   leafColumnShare: a column of the wall box with more leaf pixels (measureFacade.ts isLeaf) than this is foliage;
 *   minCleanShare / minCleanM: a pand with fewer clean columns than this share of its box, or this width, is not
 *     measured on its own: it takes the row median of the clean pands' walls (with a note).
 */
export const WALL_REFIT = {leafColumnShare: 0.08, minCleanShare: 0.4, minCleanM: 1.2} as const;

export interface PixelBox { x0: number; x1: number; y0: number; y1: number }

/** Per column of `box` (x0..x1): true where the column is foliage (leaf share of its non-placeholder pixels over the limit). */
export function foliageColumns(rgb: Uint8Array, width: number, box: PixelBox, isLeaf: (r: number, g: number, b: number) => boolean, share: number = WALL_REFIT.leafColumnShare): boolean[] {
  const out: boolean[] = [];
  for (let x = box.x0; x < box.x1; x++) {
    let n = 0, leaf = 0;
    for (let y = box.y0; y < box.y1; y++) {
      const i = (y * width + x) * 3, r = rgb[i], g = rgb[i + 1], b = rgb[i + 2];
      if (Math.abs(r - 128) <= 2 && Math.abs(g - 128) <= 2 && Math.abs(b - 128) <= 2) continue; // strip placeholder
      n++; if (isLeaf(r, g, b)) leaf++;
    }
    out.push(n > 0 && leaf / n > share);
  }
  return out;
}

/** A copy of `rgb` with the given columns of `box` set to `fill` (the strip placeholder grey or the render background). */
export function maskColumns(rgb: Uint8Array, width: number, height: number, box: PixelBox, masked: readonly boolean[], fill: readonly [number, number, number]): Uint8Array {
  const out = Uint8Array.from(rgb);
  for (let k = 0; k < masked.length; k++) {
    if (!masked[k]) continue;
    const x = box.x0 + k;
    for (let y = 0; y < height; y++) out.set(fill, (y * width + x) * 3);
  }
  return out;
}

/** Whether a pand keeps its own wall reading: enough clean columns left after the foliage columns are dropped. */
export function cleanWallVerdict(masked: readonly boolean[], pixelsPerMetre: number): {own: boolean; cleanColumns: number; share: number} {
  const clean = masked.filter(m => !m).length, share = masked.length ? clean / masked.length : 0;
  return {own: share >= WALL_REFIT.minCleanShare && clean >= WALL_REFIT.minCleanM * pixelsPerMetre, cleanColumns: clean, share: +share.toFixed(2)};
}

/** Channel-wise median of the clean pands' wall colours (null when no pand is clean). */
export function rowMedianRgb(colours: readonly (readonly [number, number, number])[]): [number, number, number] | null {
  if (!colours.length) return null;
  const m = (c: number) => { const s = colours.map(x => x[c]).sort((a, b) => a - b); return s[s.length >> 1]; };
  return [m(0), m(1), m(2)];
}
