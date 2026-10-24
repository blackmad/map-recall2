/**
 * One rectified panorama crop's wall colour (and glazing profile), the reading scripts/landmarks/build-public-facts.ts
 * makes for the school, cinema and worship kits, shared so other surveys (scripts/look/measure-period-walls.ts) read
 * walls the same way. Moved verbatim from build-public-facts.ts (2026-10-24); see that file's header for the why.
 *
 * Per crop: drop it when leafier than MAX_FOLIAGE; white-balance on the crop's light trim (cropNormaliser); mask sky,
 * leaves and olive shade; the largest coherent colour cluster (dominantWallColour) over the middle BAND; keep it when
 * reliable, a real share of the crop, in a masonry family, not cool or green cast; then the row glazing profile.
 */
import sharp from 'sharp';
import { pixelKind } from '../../src/canalRecall/look/brickTone.ts';
import { cropNormaliser, glassVisible, glazingProfile, isOliveShade, leafDominated, masonryFamily, type GlazingProfile } from '../../src/canalRecall/facade/cropWallColour.ts';
import { dominantWallColour } from '../../src/canalRecall/facade/dominantWallColour.ts';

/** A crop counts when its winning cluster holds this share of the usable (unmasked, not glass/trim) pixels. */
export const MIN_WALL_SHARE = 0.3;
/** Crops this leafy (all-walls' own foliage estimate) show the tree, not the building. */
export const MAX_FOLIAGE = 0.6;
/** Rows of the crop measured: the top is sky and roof edge, the bottom fences, bikes and cars. */
export const BAND: [number, number] = [0.12, 0.8];
/** The wall cluster's share of the whole measured band (masked pixels included). */
export const MIN_BAND_SHARE = 0.06;

export type CropReading = {
  file: string; tag: string; foliage: number | null; wallShare?: number; bandShare?: number; brick?: string; family?: string | null;
  norm?: { ref: number[] | null; gain: number; wb: number[] }; leafShare?: number; glazing?: GlazingProfile; glassVisible?: boolean; glazingOnly?: true; used: boolean; why?: string;
};
/** A walls.json row as all-walls.ts writes it (the fields the reading uses). */
export type WallRow = { tag: string; foliage?: number; ppm?: number; wallWidthM?: number; height?: number };

/**
 * Read one crop. `reading` is filled in place (as the kit facts report it); the wall's normalised RGB comes back when
 * the crop is used, else null.
 */
export async function readCropWall(file: string, w: WallRow, reading: CropReading): Promise<number[] | null> {
  if (reading.foliage !== null && reading.foliage > MAX_FOLIAGE) { reading.why = `foliage ${reading.foliage.toFixed(2)}`; return null; }
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels, ppm = typeof w.ppm === 'number' ? w.ppm : info.width / (w.wallWidthM ?? info.width / 50);
  const y0 = Math.floor(info.height * BAND[0]), y1 = Math.ceil(info.height * BAND[1]);
  // 1. Exposure and white balance from the crop's light trim (measureFacade's rule), applied before measuring.
  const norm = cropNormaliser(data, info.width, info.height, ch, ppm, [y0, y1]);
  reading.norm = { ref: norm.ref ? norm.ref.map(Math.round) : null, gain: +norm.gain.toFixed(3), wb: norm.wb.map(v => +v.toFixed(3)) };
  let leaf = 0;
  const width = info.width, height = y1 - y0, band = new Uint8Array(width * height * 3), mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    const o = (y0 * width + i) * ch, r = data[o], g = data[o + 1], b = data[o + 2], c = norm.apply([r, g, b]);
    band[i * 3] = c[0]; band[i * 3 + 1] = c[1]; band[i * 3 + 2] = c[2];
    // 2. pixelKind drops sky, leaves and burnt-out pixels; isOliveShade the shaded and autumn leaves it lets through.
    const kind = pixelKind(r, g, b);
    mask[i] = kind === 'candidate' && !isOliveShade(c[0], c[1], c[2]) ? 1 : 0;
    if (kind === 'leaf' || (kind === 'candidate' && !mask[i])) leaf++;
  }
  // Mostly leaves: the wall left is the wall in the canopy's shade (#41).
  reading.leafShare = Math.round(leaf / mask.length * 1000) / 1000;
  if (leafDominated(leaf, mask.length)) { reading.why = `mostly leaves ${reading.leafShare}`; return null; }
  const wall = dominantWallColour({ data: band, width, height, channels: 3 }, mask);
  if (!wall) { reading.why = 'no wall pixels'; return null; }
  reading.brick = wall.hex;
  reading.wallShare = Math.round(wall.fraction * 1000) / 1000;
  reading.family = masonryFamily(wall.rgb);
  if (!wall.reliable) { reading.why = `unreliable: ${wall.review.join('; ')}`; return null; }
  if (reading.wallShare < MIN_WALL_SHARE) { reading.why = `wall share ${reading.wallShare}`; return null; }
  // 3. Brick, buff brick, render or concrete, or not this building's wall: a mural (sheet row 35, #f7c386), painted
  // cladding, glass, a hedge read as wall (row 3's shaded brick under blue zinc, row 23's olive).
  // Round 4 (GitHub #43, rows 93, 94, 108): a crop whose wall colour is dropped for its family or cast (a mural, a
  // grey-lilac render, shaded brick) still shows where the windows are: its rows are read against that cluster for
  // glazing alone, never for colour.
  const eaves = typeof w.height === 'number' ? w.height : info.height / ppm;
  const glazingOnly = (why: string) => {
    reading.why = why;
    reading.glazing = glazingProfile({ data, width: info.width, height: info.height, channels: ch, ppm, topM: info.height / ppm, eavesM: eaves, wall: wall.rgb, norm: norm.apply });
    reading.glazingOnly = true; reading.glassVisible = glassVisible(wall.rgb);
    return null;
  };
  if (!reading.family) return glazingOnly(`no masonry family ${wall.hex}`);
  // Brick, concrete and render in daylight read warm or neutral; a cluster bluer than it is red is glass, a
  // shadowed recess or the panorama's cast (sheet rows 34 and 40: blue-grey on a brick and a pale-brick front).
  if (wall.rgb[2] > wall.rgb[0]) return glazingOnly(`cool cast ${wall.hex}`);
  // Green at or over red is a hedge or its shade, not masonry (sheet row 1: #393a34 olive on a red-brown front).
  if (wall.rgb[1] >= wall.rgb[0]) return glazingOnly(`green cast ${wall.hex}`);
  // The wall must be a real part of the crop, not a strip of shaded brick under blue cladding (row 3's w02).
  reading.bandShare = Math.round(wall.pixels / (width * height) * 1000) / 1000;
  if (reading.bandShare < MIN_BAND_SHARE) { reading.why = `band share ${reading.bandShare}`; return null; }
  // 4. Ribbon windows and a pale band under the eaves, read row by row against this wall colour.
  reading.glazing = glazingProfile({ data, width: info.width, height: info.height, channels: ch, ppm, topM: info.height / ppm, eavesM: eaves, wall: wall.rgb, norm: norm.apply });
  reading.used = true;
  reading.glassVisible = glassVisible(wall.rgb);
  return wall.rgb;
}
