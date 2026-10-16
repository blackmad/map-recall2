// The sunny look: a sunny Amsterdam afternoon (the default since 2026-10-16; `?look=legacy` opts out). Pure.
//
// User 2026-10-16: the game "feels a little dark/dour". Measured (scripts/look/sunny-frames.ts on six live-play
// places, docs/images/look/sunny-20261016.jpg): the shared rig lit a wall facing the sun at 0.73 of its albedo
// in linear light (sun 2.15 x cos 40° plus half the hemisphere, / π) and a shade-side wall at 0.30, so walls drew
// at median luma 65-118; the "sky" above the horizon was the basemap's land colour (185,174,156),
// a pale cream; and the hemisphere fill was near white (#e3ebf6), so shade sides were grey, not sky-lit.
//
// This module is the one place the look's values live:
//  - `SUNNY_LIGHT_RIG`: a warmer key and a fill the colour of the measured clear sky, intensities scaled by
//    `SUNNY_EXPOSURE`, solved (not picked) so a measured wall facing the sun draws its measured colour;
//  - `SKY`: the clear sky of the municipal panoramas (scripts/look/measure-sky.ts: 300 clear views of 1,256),
//    for MapLibre's sky above the horizon;
//  - `sunlitMeasuredWall`: measured wall tints recorded under a crop's white are brought to a sunlit white;
//  - `sceneTokens`: the ground, water, park, facade and sky base tones as named tokens, read by the flat
//    overview basemap (ownGround/basemapPalette.ts) and the 3D ground alike.
// The renderer stays at NoToneMapping: exposure is folded into the light intensities, so unlit overlays (the route
// ribbon, the question street, the highlight) keep their exact colours.

import type { LightRigOptions } from '../rendererShared/lightRig.js';
import { FALLBACK_WALL_GAIN, SUNLIT_WHITE_LUMA, WALL_WHITE_POINTS } from './measuredWhitePoints.js';
import { GROUND_LOOK_DEFAULT, groundPalette, type GroundLook, type GroundPalette } from '../ownGround/groundLook.js';

export type SceneLook = 'sunny' | 'legacy';
export const SCENE_LOOKS: readonly SceneLook[] = ['sunny', 'legacy'];
/** The look the game ships with (2026-10-16, user "dark/dour"); `?look=legacy` gives the 2026-10-14 light. */
export const SCENE_LOOK_DEFAULT: SceneLook = 'sunny';

/** `?look=` or `window.__canalRecallLook`; anything else is SCENE_LOOK_DEFAULT. */
export function sceneLookFrom(search?: string): SceneLook {
  const g = globalThis as { __canalRecallLook?: string; location?: { search?: string } };
  const m = /[?&]look=([\w-]+)/.exec(search ?? g.location?.search ?? '');
  const v = m?.[1] ?? g.__canalRecallLook;
  return (SCENE_LOOKS as readonly string[]).includes(v ?? '') ? v as SceneLook : SCENE_LOOK_DEFAULT;
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

type RGB = [number, number, number];
export const srgbToLinear = (v: number) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
export const linearToSrgb = (c: number) => 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const hexRgb = (hex: string): RGB => { const n = parseInt(hex.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgbHex = (c: readonly number[]) => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const Y = (c: readonly number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const linY = (hex: string) => Y(hexRgb(hex).map(srgbToLinear));
const luma = (c: readonly number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

// ---------------------------------------------------------------------------
// Sky (measured)
// ---------------------------------------------------------------------------

/**
 * The clear sky over Amsterdam in the municipal panoramas (scripts/look/measure-sky.ts, 2026-10-16): sky pixels of the
 * 300 views whose top band is clear, median of the top tenth of the frame (158,195,237) and of the sky just above the
 * roofline (161,198,229). The panoramas look only ~30° up, so `zenith` is the upper sky, not the zenith.
 */
export const SKY = { zenith: '#9ec3ed', horizon: '#a1c6e5' } as const;

/** MapLibre's sky (map.setSky) for the sunny look: the measured gradient above the horizon, no fog on the ground. */
export function mapLibreSky(look: SceneLook = sceneLookFrom()): Record<string, string | number> | null {
  if (look !== 'sunny') return null;
  return { 'sky-color': SKY.zenith, 'horizon-color': SKY.horizon, 'fog-color': SKY.horizon, 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.5, 'fog-ground-blend': 1, 'atmosphere-blend': 0 };
}

// ---------------------------------------------------------------------------
// Light
// ---------------------------------------------------------------------------

/** Irradiance shares (linear luminance, three's Lambert: x 1/π) the rig gives a level surface and two walls. */
export function rigIrradiance(rig: Pick<Required<LightRigOptions>, 'sunColour' | 'sunIntensity' | 'skyColour' | 'groundColour' | 'skyIntensity' | 'sunElevationDeg'>) {
  const el = (rig.sunElevationDeg * Math.PI) / 180, sun = linY(rig.sunColour) * rig.sunIntensity / Math.PI;
  const sky = linY(rig.skyColour) * rig.skyIntensity / Math.PI, ground = linY(rig.groundColour) * rig.skyIntensity / Math.PI;
  // A vertical wall sees half the hemisphere's sky and half its ground (three's HemisphereLight at a horizontal normal).
  const hemiWall = (sky + ground) / 2;
  return { flat: sun * Math.sin(el) + sky, sunWall: sun * Math.cos(el) + hemiWall, shadeWall: hemiWall };
}

/** The 2026-10-14 rig (rendererShared/lightRig.ts before the sunny look), for the shade-to-sun balance. */
export const LEGACY_RIG_LIGHT = { sunColour: '#ffe9cc', sunIntensity: 2.15, skyColour: '#e3ebf6', groundColour: '#998a72', skyIntensity: 1.75, sunElevationDeg: 40 };

/**
 * Light on a wall facing away from the sun over light on a wall facing it (linear luminance), for every wall in the
 * sunny look: generic extrusions, street chunks, recipe houses, building types and landmarks share the one rig.
 * Was the legacy rig's 0.41 until 2026-10-16 (docs/one-material-20261016.md): a wall drawn at exactly its sunlit
 * photo colour then capped at ~0.67 sRGB of that colour on its shade side, and the shade sides of the canal rows,
 * which the default sun (215 deg) puts on most canal fronts facing north and east, read as a dark band. 0.55 lifts
 * a shade side to ~0.76 sRGB of its sunlit colour (+13 %) and keeps a clear sun/shade read (the sun side is still
 * 1.8x the shade side in linear light).
 */
export const SUNNY_SHADE_RATIO = 0.55;

/**
 * The sunny rig before exposure. The key is warmer (#ffe2bf, ~4,600 K, was #ffe9cc ~5,000 K). The hemisphere's ground
 * is the sunlit pavement of the orthophoto (172,164,151; docs/ground-tones-20261014.md). Its sky is the measured clear
 * sky (SKY.horizon) mixed toward white until the rig is white-balanced: level ground in sun receives neutral light
 * (red = blue), as the panorama and orthophoto colours the walls and ground were measured from are white-balanced.
 * So a sun-facing wall reads warm, a shade side cool, and on average a measured colour keeps its hue. (The pure
 * measured sky as fill turned level ground blue, r/b 0.92, and shade sides 0.70: every warm brick went grey.)
 * The sky intensity sets the shade-to-sun wall ratio, SUNNY_SHADE_RATIO.
 */
export function sunnyBase(sunColour = '#ffe2bf', groundColour = '#aca497', ratio = SUNNY_SHADE_RATIO) {
  const el = (40 * Math.PI) / 180;
  const build = (t: number) => {
    const skyColour = rgbHex(hexRgb(SKY.horizon).map(v => v + (255 - v) * t));
    const sun = linY(sunColour) * 2.15 / Math.PI * Math.cos(el), hemiPerUnit = (linY(skyColour) + linY(groundColour)) / 2 / Math.PI;
    // shade = ratio x (sun + shade)  ->  shade = ratio x sun / (1 - ratio)
    const skyIntensity = (ratio * sun) / (1 - ratio) / hemiPerUnit;
    return { sunColour, sunIntensity: 2.15, skyColour, groundColour, skyIntensity, sunElevationDeg: 40 };
  };
  const flatRB = (t: number) => { const r = build(t), s = hexRgb(r.sunColour).map(srgbToLinear), k = hexRgb(r.skyColour).map(srgbToLinear);
    const c = [0, 2].map(i => s[i] * r.sunIntensity * Math.sin(el) + k[i] * r.skyIntensity); return c[0] / c[1]; };
  let lo = 0, hi = 1;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (flatRB(m) < 1) lo = m; else hi = m; }
  return { ...build(hi), whiteMix: +hi.toFixed(3) };
}
const SUNNY_BASE = sunnyBase();

/**
 * Exposure of the sunny rig: the factor on every light so a measured wall facing the sun (cell x tint = its sunlit
 * measured colour: recipe houses, block faces and the streamed facades' `litWallGain`) draws that colour:
 * 1 / (sun-side wall irradiance). The legacy rig drew it at 0.73 (and a shade side at 0.30). Under `?cityLook=1` the
 * slot cells also take CITY_LIT_LEVEL (0.9 sRGB), which this does not undo.
 */
export const SUNNY_EXPOSURE = 1 / rigIrradiance(SUNNY_BASE).sunWall;

/** The sunny light rig's colours and intensities (exposure folded in); azimuth, elevation and shadows unchanged. */
export const SUNNY_LIGHT = {
  sunColour: SUNNY_BASE.sunColour,
  sunIntensity: +(SUNNY_BASE.sunIntensity * SUNNY_EXPOSURE).toFixed(4),
  skyColour: SUNNY_BASE.skyColour,
  groundColour: SUNNY_BASE.groundColour,
  skyIntensity: +(SUNNY_BASE.skyIntensity * SUNNY_EXPOSURE).toFixed(4),
} as const;

// ---------------------------------------------------------------------------
// Measured walls at sunlit exposure
// ---------------------------------------------------------------------------

/** Bounds of the wall gain (linear): a crop white far above or below the sunlit white is a bad reference, not a wall. */
export const WALL_GAIN_RANGE: readonly [number, number] = [0.85, 1.6];

/** A recorded white point: sRGB bytes, or a hex string (the `tintWhitePoint` glTF extra). */
export type WhitePoint = readonly number[] | string;
const whiteRgb = (white: WhitePoint): readonly number[] => (typeof white === 'string' ? hexRgb(white) : white);

/** Linear gain that brings a measured wall recorded under `white` (or under no recorded white) to a sunlit white. */
export function measuredWallGain(white: WhitePoint | null | undefined): number {
  const g = white ? srgbToLinear(SUNLIT_WHITE_LUMA) / srgbToLinear(luma(whiteRgb(white))) : FALLBACK_WALL_GAIN;
  return Math.max(WALL_GAIN_RANGE[0], Math.min(WALL_GAIN_RANGE[1], g));
}

/** A colour scaled by `k` in linear light; a channel past white scales the whole colour down so the hue holds. */
export function scaleLinear(hex: string, k: number): string {
  const lin = hexRgb(hex).map(v => srgbToLinear(v) * k), over = Math.max(1, ...lin);
  return rgbHex(lin.map(c => linearToSrgb(c / over)));
}

/**
 * A measured wall colour at sunlit exposure: the tint divided by the white point its crop recorded and multiplied by
 * the sunlit white (one linear scalar, so the measured hue and the relation between walls hold), from
 * WALL_WHITE_POINTS by hex; a wall with no recorded white takes FALLBACK_WALL_GAIN. A channel past white scales the
 * whole colour down so the hue holds. Painted stone and glass keep their own rules (look/palette.ts).
 */
export function sunlitMeasuredWall(hex: string, white: WhitePoint | null | undefined = WALL_WHITE_POINTS[hex.toLowerCase()]): string {
  return scaleLinear(hex, measuredWallGain(white));
}

/**
 * The authored hex a slot is tinted from under a look: a measured wall (`brick`/`accent` with `tintSource: measured`)
 * goes to its sunlit exposure in the sunny look; every other slot, and the legacy look, keep the hex. `white` is the
 * white the tint was recorded under when the material carries it (the `tintWhitePoint` glTF extra, written with
 * `palette.whitePoint`); without it the white is looked up by hex in WALL_WHITE_POINTS (per-house crops), else
 * FALLBACK_WALL_GAIN.
 */
export function sceneSlotHex(slot: string, hex: string, source: string | null | undefined, look: SceneLook = sceneLookFrom(), white?: WhitePoint | null): string {
  if (look !== 'sunny' || source !== 'measured' || (slot !== 'brick' && slot !== 'accent')) return hex;
  return white ? sunlitMeasuredWall(hex, white) : sunlitMeasuredWall(hex);
}

// ---------------------------------------------------------------------------
// Tokens: one set of base tones for the 3D ground, the flat overview and the transition between them
// ---------------------------------------------------------------------------

/** CSS colour strings (MapLibre paint values): `rgb(r,g,b)` for the ground tables' RGB tones, hex otherwise. */
export interface GroundTokens {
  /** Plain land (quays, wide pavements, the basemap background beyond the own ground). */
  land: string; pavement: string; road: string; cycle: string; klinker: string;
  water: string; park: string; wood: string; gravel: string; rail: string;
}
export interface SceneTokens extends GroundTokens {
  /** Median measured wall (WALL_WHITE_POINTS walls), at the look's exposure. */
  facade: string;
  /** The sky above the horizon and at it (the legacy look had no sky: the basemap land showed there). */
  sky: string; horizon: string;
}

const css = (c: readonly number[]) => `rgb(${c.join(',')})`;
const MEDIAN_MEASURED_WALL = (() => {
  const walls = Object.keys(WALL_WHITE_POINTS).map(hexRgb), med = (a: number[]) => a.slice().sort((p, q) => p - q)[a.length >> 1];
  return rgbHex([0, 1, 2].map(i => med(walls.map(w => w[i]))));
})();

/** The ground tones of a ground palette as tokens: what the flat overview basemap and the 3D ground share. */
export function groundTokens(palette: GroundPalette): GroundTokens {
  const { street, tones } = palette;
  return {
    land: css(tones.land.base), pavement: css(street.pavement.base), road: css(street.asphalt.base), cycle: css(street.cycle.base),
    klinker: css(street.klinker.base), water: tones.water, park: css(tones.park), wood: css(tones.wood), gravel: css(tones.gravel), rail: street.rail,
  };
}

/** The look's base tones: the ground look's ground (ownGround/groundLook.ts), the measured facade and the sky. */
export function sceneTokens(look: SceneLook = sceneLookFrom(), ground: GroundLook = GROUND_LOOK_DEFAULT): SceneTokens {
  const g = groundTokens(groundPalette(ground));
  return {
    ...g,
    facade: look === 'sunny' ? sunlitMeasuredWall(MEDIAN_MEASURED_WALL, null) : MEDIAN_MEASURED_WALL,
    sky: look === 'sunny' ? SKY.zenith : g.land,
    horizon: look === 'sunny' ? SKY.horizon : g.land,
  };
}

// ---------------------------------------------------------------------------
// The streamed facades' wall colour at the look's exposure
// ---------------------------------------------------------------------------

/**
 * The lit facades' wall gain (rendererShared/litFacadeMaterial.ts `wallGain`, an sRGB factor on wall-masked cell
 * texels that the shader linearises with pow 2.2). `litWallGain` makes cell x tint = the tint (look/palette.ts); the
 * sunny look then brings the tint to sunlit exposure like every other photo-read wall: a generic wall carries no
 * recorded white, so it takes FALLBACK_WALL_GAIN in linear light, which is what a chunk wall without a strip and a
 * measured recipe wall without a white take. So the same wall colour draws the same pixel on a generic extrusion, a
 * street chunk and a measured recipe house (docs/one-material-20261016.md). The legacy look keeps `litWallGain`.
 */
export function litFacadeWallGain(litWallGain: number, look: SceneLook = sceneLookFrom()): number {
  return look === 'sunny' ? litWallGain * FALLBACK_WALL_GAIN ** (1 / 2.2) : litWallGain;
}
