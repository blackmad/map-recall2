/**
 * Colour rules for reading a wall colour (and its glazing) off one rectified panorama crop, for the generic school kit
 * (scripts/landmarks/build-public-facts.ts -> publicBuildingFacts.ts -> publicBuildings.ts). Pure: no I/O.
 *
 * Why (kit colour round 2, GitHub #34, 2026-10-24): after #29 measured each school's own crops, the walls still read
 * olive-brown where the photo shows red-brown or yellow brick (kits-fix sheet rows 3, 10, 23, 24, 27, 32, 34), one
 * school took the colour of a mural (row 35), and schools with no usable crop took a period pick that was orange
 * (row 1) or buff (row 39) beside dark brick photos. Measured on the crops (pixel boxes on row 32's brick piers and the
 * trees in front of them): the brick reads Lab hue ~72, C* ~21; the trees in shade and early autumn hue 85-97 at
 * L* ~30. The olive came from those leaves joining the wall cluster (`pixelKind` only drops leaves green over red),
 * not from a camera cast: the crops' own light trims are near neutral (b* +4..+8). So, per crop:
 *  1. `cropNormaliser`: the white balance from the crop's light trim, the likeness code's own rule
 *     (buildingRecipe/measureFacade.ts `lightTrimNormalisation`, on the same 10 cm cells), applied before anything is
 *     measured;
 *  2. `isOliveShade`: dark yellow-green pixels (shaded and autumn leaves, hedges) are masked like sky and leaves;
 *  3. `masonryFamily`: the wall cluster must sit in a brick, buff-brick or render/concrete family, or the crop is
 *     dropped (a mural, painted cladding, a hedge read as wall) and the school falls back to its period palette;
 *  4. `glazingProfile`: row by row along the wall, whether the windows run as a ribbon (a band of rows that is almost
 *     all opening) and whether a pale band runs under the eaves (the white top band of the 1920s-30s and 1960s
 *     schools, rows 23, 37, 38).
 */
import { lightTrimNormalisation, rgbToLab, type Rgb } from '../buildingRecipe/measureFacade.ts';

/** Lab lightness, chroma and hue (degrees 0..360) of an sRGB colour. */
export function lch(rgb: readonly number[]): { L: number; C: number; h: number } {
  const [L, a, b] = rgbToLab([rgb[0], rgb[1], rgb[2]]);
  return { L, C: Math.hypot(a, b), h: (Math.atan2(b, a) * 180 / Math.PI + 360) % 360 };
}

/**
 * Dark yellow-green: shaded leaves, autumn leaves and hedges (row 32's trees: (74,68,37) h 97, (85,78,53) h 95). Brick
 * in the panoramas stays under hue ~85 (row 32's piers h 72, row 3's yellow brick h 68, a shaded yellow brick h 80),
 * concrete and render under C* 8, so a pixel past hue 88 with colour in it and below L* 60 is not masonry. Pale cream
 * render (h ~90, L* 86) is kept by the lightness bound.
 */
export const OLIVE = { minHue: 88, maxHue: 200, minChroma: 8, maxL: 60 } as const;
export function isOliveShade(r: number, g: number, b: number): boolean {
  const c = lch([r, g, b]);
  return c.L < OLIVE.maxL && c.C > OLIVE.minChroma && c.h > OLIVE.minHue && c.h < OLIVE.maxHue;
}

/**
 * A crop whose measured band is mostly leaves shows the tree, not the wall: what the leaf mask lets through is the wall
 * in the canopy's shade (GitHub #41: Generic church NL.IMBAG.Pand.0363100012098124's only crop read very dark khaki
 * #393730 beside a grey and brick photo). More than this share of the band's pixels masked as leaves (look/brickTone.ts
 * pixelKind 'leaf' or isOliveShade; sky and burnt-out pixels do not count) and the crop is dropped; a pand with no
 * other crop falls back to its period palette.
 */
export const MAX_LEAF_PIXEL_SHARE = 0.6;
export function leafDominated(leafPixels: number, bandPixels: number): boolean {
  return bandPixels > 0 && leafPixels / bandPixels > MAX_LEAF_PIXEL_SHARE;
}

/**
 * The masonry family a measured (normalised) wall colour can belong to, or null when it fits none: brick (red to
 * brown, hue 15-85), buff/yellow brick (hue 55-92, lighter), render and concrete (near-neutral, or pale cream).
 * Ranges from the reviewed schools' photos as the panoramas render them (red brick h 40-75, dark brown brick C* 6,
 * yellow brick h 68 C* 26, white render C* < 6) and the city palette's own bricks (#b05a40 h 43 C* 45). Outside them:
 * a saturated light colour (the row 35 mural, #f7c386: L* 82, C* 39), anything green, blue or pink with colour in it
 * (painted cladding, glass, a hedge), and dark olive (shaded leaves).
 */
export type MasonryFamily = 'brick' | 'buff' | 'render';
export function masonryFamily(rgb: readonly number[]): MasonryFamily | null {
  const { L, C, h } = lch(rgb);
  if (C < 8) return 'render'; // white, grey and dark-grey render, concrete, painted brick
  if (L >= 70 && C < 18 && h >= 50 && h <= 105) return 'render'; // cream render and pale stone
  if (h >= 15 && h <= 85 && L >= 12 && L < 66 && C <= 48 && C <= 0.9 * L + 8) return 'brick';
  if (h >= 55 && h <= 92 && L >= 40 && L < 82 && C <= 32 && !(h > 85 && L < 50)) return 'buff';
  return null;
}

/** One crop's white balance (measureFacade's light-trim rule over 10 cm cells of the given rows; leaf and sky cells left out). */
export type CropNormaliser = { ref: Rgb | null; gain: number; wb: [number, number, number]; apply: (rgb: readonly number[]) => Rgb };
export function cropNormaliser(data: ArrayLike<number>, width: number, height: number, channels: number, ppm: number, rows: [number, number] = [0, height]): CropNormaliser {
  const cellPx = Math.max(1, Math.round(ppm * 0.1)), lab: Rgb[] = [], rgb: Rgb[] = [];
  for (let y0 = rows[0]; y0 + cellPx <= rows[1]; y0 += cellPx) for (let x0 = 0; x0 + cellPx <= width; x0 += cellPx) {
    let r = 0, g = 0, b = 0, n = 0, leaf = 0, sky = 0;
    for (let y = y0; y < y0 + cellPx; y++) for (let x = x0; x < x0 + cellPx; x++) {
      const i = (y * width + x) * channels, R = data[i], G = data[i + 1], B = data[i + 2];
      r += R; g += G; b += B; n++;
      if (G > R + 3 && G > B + 3) leaf++;
      if (B > R + 6 && B >= G && B > 120) sky++;
    }
    if (leaf > n * 0.35 || sky > n * 0.5) continue;
    const c: Rgb = [r / n, g / n, b / n];
    rgb.push(c); lab.push(rgbToLab(c));
  }
  const { ref, gain, wb } = rgb.length >= 30 ? lightTrimNormalisation(lab, rgb) : { ref: null, gain: 1, wb: [1, 1, 1] as [number, number, number] };
  // White balance only: the gain is reported, not applied. The school wall is stored as the panorama reads it and
  // publicBuildings.ts lifts it into the city's display range (cityWallTint), which sets the lightness; a burnt-out
  // trim (255) would otherwise darken every sunlit crop by 0.84.
  return { ref, gain, wb, apply: c => [0, 1, 2].map(i => Math.max(0, Math.min(255, c[i] * wb[i]))) as Rgb };
}

/** Wall cells further than this (CIE76) from the measured wall are something else: glass, frames, bands. */
export const NOT_WALL_DE = 18;
/**
 * A ribbon: a band of rows at least `minM` tall, from `fromM` up, in which `open` of the readable width is not wall and
 * under `pale` of it is pale (a row of punched windows keeps its piers: 30-60 % wall; a white band is pale, not open).
 */
export const RIBBON = { minM: 0.6, fromM: 0.8, open: 0.65, pale: 0.5 } as const;
/** A white top band: rows within `searchM` under the eaves, at least `minM` tall, this share pale (L* >= 70, C* < 14). */
export const TOP_BAND = { searchM: 2.5, minM: 0.3, pale: 0.55, minL: 70, maxC: 14 } as const;
/**
 * Window rows (GitHub #36, kit review round 3: windowless cinema and church shells, schools drawn without the white
 * frames the photos show): a band of rows at least `minM` tall in which `open` of the readable width is not wall and
 * under `pale` is pale holds windows, punched or ribbon. Pale pixels inside those rows are the window frames when they
 * average `framePale` of the readable width; their median colour is the frame colour.
 */
export const WINDOW_ROWS = { minM: 0.6, open: 0.25, pale: 0.5, framePale: 0.06 } as const;
/**
 * A frame pixel is near-neutral and clearly lighter than the wall: L* at least `minL` and `dL` over the wall's. Relative,
 * not TOP_BAND's absolute L* 70, because most crops are dim (shaded fronts, no light trim to balance on): the reviewed
 * white-framed schools (rows 337, 344, 345) read their frames at L* 50-65.
 */
export const FRAME_LIGHT = { minL: 48, dL: 20, maxC: 14, liftTo: 235 } as const;

export type GlazingProfile = {
  /** Rows (0.1 m) with enough readable width. */
  rowsRead: number;
  /** Ribbon bands found, metres above the crop's ground. */
  ribbons: [number, number][];
  /** The pale band under the eaves, metres above ground, or null. */
  topBand: [number, number] | null;
  /** The band's median colour (normalised), when there is one. */
  topBandHex: string | null;
  /** Bands of window rows (WINDOW_ROWS), metres above ground: punched or ribbon; none on a blank wall. */
  windowBands?: [number, number][];
  /** The window frames' median colour (normalised) inside those bands, when pale frames show; else null. */
  frameHex?: string | null;
  /** The mean light (FRAME_LIGHT) share of the window rows: the frame evidence frameHex is judged on. */
  framePale?: number;
};

/**
 * Row profile of one crop: per 0.1 m row between `fromM` and the eaves, the share of the readable width (not leaf, sky
 * or olive shade) that is not wall (further than NOT_WALL_DE from `wall`), and of that how much is glass (darker than
 * the wall or cool) and how much pale. Rows are metres above the crop's ground (the crop's bottom edge); `topM` is the
 * crop's height in metres. `norm` maps a raw pixel to the normalised colour `wall` was measured in.
 */
export function glazingProfile(a: { data: ArrayLike<number>; width: number; height: number; channels: number; ppm: number; topM: number; eavesM: number; wall: readonly number[]; norm: (c: readonly number[]) => Rgb; fromM?: number }): GlazingProfile {
  const { data, width, channels, ppm, topM, eavesM, norm } = a, wallLab = rgbToLab([a.wall[0], a.wall[1], a.wall[2]]);
  const rowOf = (m: number) => Math.round((topM - m) * ppm), step = Math.max(1, Math.round(ppm * 0.1)), xStep = Math.max(1, Math.round(ppm * 0.05));
  const from = a.fromM ?? 1, top = Math.min(eavesM, topM - 0.1);
  type Row = { z: number; open: number; glass: number; pale: number; paleRgb: Rgb | null; light: number; lightRgb: Rgb | null };
  const rows: Row[] = [];
  for (let z = from; z + 0.1 <= top + 1e-6; z += 0.1) {
    const y1 = rowOf(z), y0 = Math.max(0, y1 - step);
    let read = 0, total = 0, notWall = 0, glass = 0, pale = 0, light = 0; const paleSum = [0, 0, 0], lightSum = [0, 0, 0];
    for (let x = 0; x < width; x += xStep) {
      total++;
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = y0; y < y1; y++) { const i = (y * width + x) * channels; r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
      if (!n) continue;
      const raw: Rgb = [r / n, g / n, b / n];
      if ((raw[1] > raw[0] + 3 && raw[1] > raw[2] + 3) || isOliveShade(raw[0], raw[1], raw[2])) continue; // leaves
      const c = norm(raw), L = rgbToLab(c), C = Math.hypot(L[1], L[2]);
      read++;
      if (Math.hypot(L[0] - wallLab[0], L[1] - wallLab[1], L[2] - wallLab[2]) < NOT_WALL_DE) continue;
      notWall++;
      if (L[0] >= Math.max(FRAME_LIGHT.minL, wallLab[0] + FRAME_LIGHT.dL) && C < FRAME_LIGHT.maxC) { light++; lightSum[0] += c[0]; lightSum[1] += c[1]; lightSum[2] += c[2]; }
      if (L[0] >= TOP_BAND.minL && C < TOP_BAND.maxC) { pale++; paleSum[0] += c[0]; paleSum[1] += c[1]; paleSum[2] += c[2]; }
      else if (L[0] < wallLab[0] || L[2] < -4) glass++;
    }
    if (read < total * 0.3 || read < 8) continue;
    rows.push({ z: Math.round(z * 10) / 10, open: notWall / read, glass: glass / read, pale: pale / read, paleRgb: pale ? paleSum.map(v => v / pale) as Rgb : null, light: light / read, lightRgb: light ? lightSum.map(v => v / light) as Rgb : null });
  }
  // Runs of passing rows; one failing or unread 0.1 m row inside a band (a transom, a lamp post) does not break it.
  const runs = (ok: (r: Row) => boolean, minM: number): Row[][] => {
    const out: Row[][] = [], span = (run: Row[]) => (run.length ? run[run.length - 1].z + 0.1 - run[0].z : 0);
    let cur: Row[] = [];
    for (const r of rows) {
      if (!ok(r)) continue;
      if (cur.length && r.z - cur[cur.length - 1].z > 0.25) { if (span(cur) >= minM - 1e-6) out.push(cur); cur = []; }
      cur.push(r);
    }
    if (span(cur) >= minM - 1e-6) out.push(cur);
    return out;
  };
  const ribbons = runs(r => r.z >= RIBBON.fromM && r.open >= RIBBON.open && r.pale < RIBBON.pale, RIBBON.minM).map(run => [run[0].z, +(run[run.length - 1].z + 0.1).toFixed(1)] as [number, number]);
  const bands = runs(r => r.z >= eavesM - TOP_BAND.searchM && r.pale >= TOP_BAND.pale, TOP_BAND.minM);
  const band = bands.length ? bands[bands.length - 1] : null;
  let topBandHex: string | null = null;
  if (band) {
    const cs = band.map(r => r.paleRgb!).filter(Boolean), med = (i: number) => cs.map(c => c[i]).sort((p, q) => p - q)[cs.length >> 1];
    topBandHex = '#' + [0, 1, 2].map(i => Math.round(med(i)).toString(16).padStart(2, '0')).join('');
  }
  // Window rows under any top band; pale pixels in them are frames.
  const bandFrom = band ? band[0].z - 1e-6 : Infinity;
  const winRuns = runs(r => r.z < bandFrom && r.open >= WINDOW_ROWS.open && r.pale < WINDOW_ROWS.pale, WINDOW_ROWS.minM);
  const winRows = winRuns.flat();
  let frameHex: string | null = null;
  const framePale = winRows.length ? winRows.reduce((s, r) => s + r.light, 0) / winRows.length : 0;
  if (winRows.length && framePale >= WINDOW_ROWS.framePale) {
    // The frames' median hue, lifted to a painted white's brightness (a dim crop reads white frames grey).
    const cs = winRows.filter(r => r.lightRgb).map(r => r.lightRgb!), med = (i: number) => cs.map(c => c[i]).sort((p, q) => p - q)[cs.length >> 1];
    const m = [med(0), med(1), med(2)], k = FRAME_LIGHT.liftTo / Math.max(1, ...m);
    frameHex = '#' + m.map(v => Math.round(Math.min(255, v * k)).toString(16).padStart(2, '0')).join('');
  }
  return {
    rowsRead: rows.length, ribbons, topBand: band ? [band[0].z, +(band[band.length - 1].z + 0.1).toFixed(1)] : null, topBandHex,
    windowBands: winRuns.map(run => [run[0].z, +(run[run.length - 1].z + 0.1).toFixed(1)] as [number, number]), frameHex, framePale: Math.round(framePale * 1000) / 1000,
  };
}
