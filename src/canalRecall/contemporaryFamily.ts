/**
 * The contemporary family (lane newbuild-kit-20261110; user feedback 1c694c0d "houthavens houses look AWFUL").
 *
 * Every dated post-1945 generic pand in the illustrated looks (storybook, cartoon) drew a hash pick of the modern
 * archetype palette: white, pale grey, cream, blue-grey or peach render under a balanced or wide grid of windows
 * (census: 80 % of the 2000+ generic pands at L* >= 80 in storybook, 0.2 % dark). The photo look had the #117
 * vocabulary, but it never measured the new-build districts. The panoramas of 94 pands built 2005 on in Houthaven,
 * IJburg, Zeeburgereiland, Overhoeks and the Sluisbuurt (scripts/newbuild/sample-panos.ts, contact sheet in the lane
 * report) show:
 *   - brick nearly everywhere: orange-red and dark purple-brown in the Houthavens, grey, anthracite and brown in
 *     IJburg and on Zeeburgereiland, a fifth white or pale render;
 *   - window shape by area, counted on the sheet: wide windows in pale frames in the Houthavens (33 of 37 fronts,
 *     2 tall), tall windows to the floor in dark frames in IJburg (18 of 28), a mix on Zeeburgereiland (8 tall of 26);
 *   - set-back top storeys on 2 of the 16 described 2005+ models in the explorer index, more on taller blocks.
 *
 * `?newbuildFamily=1` (or `globalThis.__canalRecallNewbuildFamily = true`) turns it on for housing built from
 * CONTEMPORARY_FROM_YEAR, in every textured look: the nearest area's measured walls, the area's window shape (the
 * existing wide brick presets or the new tall French-balcony preset, `BAY_STYLES.modern[9]`), and a set-back top
 * storey (contemporarySetback) on blocks of five storeys and more. Off, nothing changes: the tall preset is not even
 * in the texture array (bayLook.ts), so the layer table and the baked shells stay byte-identical.
 */
import WALLS from './contemporary-walls.json';
import { unitDraw } from './buurtProfiles/profiles.js';

export function newbuildFamilyEnabled(): boolean {
  const g = globalThis as { __canalRecallNewbuildFamily?: boolean; location?: { search?: string } };
  if (typeof g.__canalRecallNewbuildFamily === 'boolean') return g.__canalRecallNewbuildFamily;
  try { return new URLSearchParams(g.location?.search ?? '').get('newbuildFamily') === '1'; } catch { return false; }
}

export const CONTEMPORARY_FROM_YEAR = 2005;
/** Index of the tall French-balcony preset in BAY_STYLES.modern, present only with the flag on. */
export const TALL_PRESET_INDEX = 9;
/** Areas with fewer measured fronts than this borrow the pooled walls of all areas. */
const MIN_AREA_SAMPLES = 8;
/** Beyond this distance (km) from every area centre the pooled walls stand. */
const AREA_REACH_KM = 2.5;

/** Window shape per area, counted on the contact sheet: tall share, and the pale-frame share of the wide fronts. */
export const AREA_WINDOWS: Readonly<Record<string, { tall: number; paleFrames: number }>> = {
  Houthaven: { tall: 0.06, paleFrames: 0.9 },
  IJburg: { tall: 0.64, paleFrames: 0.45 },
  Zeeburgereiland: { tall: 0.31, paleFrames: 0.3 },
};
const POOLED_WINDOWS = { tall: 0.4, paleFrames: 0.5 };

type AreaWalls = { centre: [number, number]; walls: string[] };
const AREAS = (WALLS as unknown as { areas: Record<string, AreaWalls> }).areas;
const POOLED = Object.values(AREAS).flatMap(a => a.walls);

/** The nearest measured area of a point, or null beyond AREA_REACH_KM. */
export function contemporaryAreaAt(lng: number, lat: number): string | null {
  let best: string | null = null, bestKm = AREA_REACH_KM;
  for (const [name, a] of Object.entries(AREAS)) {
    const km = Math.hypot((lng - a.centre[0]) * 67.9, (lat - a.centre[1]) * 111.2);
    if (km < bestKm) { bestKm = km; best = name; }
  }
  return best;
}

export type ContemporaryStyle = 'brick' | 'brickDark' | 'smoothDark' | 'tall';
export type ContemporaryLook = { area: string | null; style: ContemporaryStyle; styleIndex: number; wall: string; painted: boolean; setback: boolean };

/** Bay style index per contemporary style (BAY_STYLES.modern: 0 brick pale frames, 1 brick dark frames, 3 smooth dark). */
const STYLE_INDEX: Record<ContemporaryStyle, number> = { brick: 0, brickDark: 1, smoothDark: 3, tall: TALL_PRESET_INDEX };
/** Storeys from which a block may step its top storey back, and the share that does. */
export const SETBACK_MIN_HEIGHT_M = 14;
export const SETBACK_SHARE = 0.35;

/**
 * The contemporary look of a dated housing pand, or null (flag off, before CONTEMPORARY_FROM_YEAR, not housing).
 * Deterministic per id.
 */
export function contemporaryLookFor(f: { id: string; year: number | null; heightM: number; use: string; at?: readonly [number, number] }): ContemporaryLook | null {
  if (!newbuildFamilyEnabled() || f.year === null || f.year < CONTEMPORARY_FROM_YEAR || f.use !== 'housing') return null;
  const area = f.at ? contemporaryAreaAt(f.at[0], f.at[1]) : null;
  const own = area && AREAS[area].walls.length >= MIN_AREA_SAMPLES ? AREAS[area].walls : POOLED;
  const code = own[Math.floor(unitDraw(f.id, 'contemporary-wall') * own.length)];
  const painted = code[0] === 'p', wall = `#${code.slice(1)}`;
  const windows = (area && AREA_WINDOWS[area]) || POOLED_WINDOWS;
  const style: ContemporaryStyle = painted ? 'smoothDark'
    : unitDraw(f.id, 'contemporary-tall') < windows.tall ? 'tall'
      : unitDraw(f.id, 'contemporary-frames') < windows.paleFrames ? 'brick' : 'brickDark';
  const setback = f.heightM >= SETBACK_MIN_HEIGHT_M && unitDraw(f.id, 'contemporary-setback') < SETBACK_SHARE;
  return { area, style, styleIndex: STYLE_INDEX[style], wall, painted, setback };
}

/** Set-back top storey: how far the top storey stands in from the walls, its height and its cladding. */
export const SETBACK_INSET_M = 1.8;
export const SETBACK_STOREY_M = 3.1;
/** Dark anthracite panel cladding of the set-back storeys on the sheet (Houthavenkade 26, Revaleiland 437). */
export const SETBACK_CLADDING_HEX = '#4b4d50';

type Pt = [number, number];
const KX = 111_320 * Math.cos(52.37 * Math.PI / 180), KY = 110_540;
const ringArea = (r: readonly Pt[]) => r.reduce((s, a, i) => { const b = r[(i + 1) % r.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0) / 2;
const inside = (x: number, y: number, r: readonly Pt[]) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > y) !== (r[j][1] > y) && x < (r[j][0] - r[i][0]) * (y - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; return c; };

/**
 * A lng/lat outer ring moved `insetM` inwards (mitred edge offsets), or null when the inset would not be a clean
 * smaller copy: a vertex outside the original, a flipped winding, an area under a third of the original, or a mitre
 * longer than three insets (a sharp corner). Holes are not inset; a courtyard block keeps its outer ring only.
 */
export function insetRing(ring: readonly number[][], insetM: number): number[][] | null {
  const lng0 = ring[0][0], lat0 = ring[0][1];
  let pts: Pt[] = ring.map(([lng, lat]) => [(lng - lng0) * KX, (lat - lat0) * KY]);
  if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts = pts.slice(0, -1);
  // Drop near-duplicate vertices and straight-through ones.
  pts = pts.filter((p, i) => { const q = pts[(i + pts.length - 1) % pts.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.05; });
  if (pts.length < 3) return null;
  const area = ringArea(pts), sign = area > 0 ? 1 : -1, n = pts.length;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i + n - 1) % n], b = pts[i], c = pts[(i + 1) % n];
    const e1 = [b[0] - a[0], b[1] - a[1]], e2 = [c[0] - b[0], c[1] - b[1]];
    const l1 = Math.hypot(e1[0], e1[1]), l2 = Math.hypot(e2[0], e2[1]);
    // Inward normals (left of the edge for a counter-clockwise ring).
    const n1 = [-e1[1] / l1 * sign, e1[0] / l1 * sign], n2 = [-e2[1] / l2 * sign, e2[0] / l2 * sign];
    const bis = [n1[0] + n2[0], n1[1] + n2[1]], bl = Math.hypot(bis[0], bis[1]);
    if (bl < 1e-6) return null;
    const cos = (bis[0] * n1[0] + bis[1] * n1[1]) / bl;
    const len = insetM / Math.max(cos, 1e-6);
    if (len > insetM * 3) return null;
    out.push([b[0] + bis[0] / bl * len, b[1] + bis[1] / bl * len]);
  }
  const insetArea = ringArea(out);
  if (Math.sign(insetArea) !== sign || Math.abs(insetArea) < Math.abs(area) / 3) return null;
  if (!out.every(p => inside(p[0], p[1], pts))) return null;
  const back = out.map(([x, y]) => [lng0 + x / KX, lat0 + y / KY]);
  back.push([...back[0]]);
  return back;
}
