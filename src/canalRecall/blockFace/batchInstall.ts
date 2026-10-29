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
