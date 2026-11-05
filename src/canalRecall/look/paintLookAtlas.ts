// The facade texture atlas painter: every bay, roof, glass and (city look) material-slot cell of a look as the colour
// RGBA and tint-mask RG layers of the building texture arrays. Moved out of threeBuildingsBrowser.ts (#129 atlas
// extract) so its import closure is exactly what the pre-painted atlas (look/lookAtlas.ts,
// scripts/look-atlas/build-look-atlas.ts) depends on: the extract's source fingerprint hashes this file's closure.
import { CELL_LAYER_COUNT, CELL_PX, cellLayer, CELL_KINDS, CELL_VARIANTS, paintCell, paintFatihMasonryCell } from '../facadeCells.js';
import { paintRoofLayers } from '../roofCells.js';
import { BAY_ENTRIES, BAY_LAYER_COUNT, bayVariant } from '../bayLook.js';
import { paintGlassBlockCell } from '../glassBlockTexture.js';
import { bayTextures, releaseBayTextures, type Look } from '../bayTextures.js';
import { LOOK_VARIANTS, PHOTO_WALL_CELL_MEAN } from './palette.js';
import { FACADE_STYLES } from '../genericFacades.js';
import { PROCEDURAL_RECIPE_LAYER_OFFSET } from '../streetFacadeRendering.js';
import { SLOT_LAYER_COUNT, loadCityBrick, paintSlotLayers } from './cityLook.js';

export const ROOF_LAYER_COUNT = 4;

/** Painting time per main-thread slice while the facade textures build (first load: never more than a frame's share). */
export const TEXTURE_SLICE_MS = 6;
/**
 * The same after a WebGL context restore, when the city has no facades until the build ends: each yield waits a whole
 * frame, so at 6 ms the ~200 bay cells took ~32 s in headless Chromium (issue #20). Longer slices, still bounded.
 */
export const RESTORE_TEXTURE_SLICE_MS = 32;

/** Layer counts of a look's arrays: `layers` bay/roof/glass cells, then (city look) the slot layers from `slotBase`. */
export function lookAtlasLayers(look: 'procedural' | Look, slots: boolean): { layers: number; total: number } {
  const layers = (look === 'procedural' ? PROCEDURAL_RECIPE_LAYER_OFFSET + BAY_LAYER_COUNT : BAY_LAYER_COUNT + ROOF_LAYER_COUNT) + 1;
  return { layers, total: layers + (slots ? SLOT_LAYER_COUNT : 0) };
}

/** A look's painted arrays: `colour` RGBA and `mask` RG, `total` layers of `size`², rows bottom-up. */
export type LookAtlasArrays = { colour: Uint8Array; mask: Uint8Array; size: number; layers: number; total: number };

/**
 * The bay drawings are drawn crisp for a standalone page; seen as whole streets
 * at game scale they read as noise. Soften them where it costs nothing a player
 * learns from: wall texture is pulled toward its mean (brick reads as colour,
 * not speckle) and the darkest glass is lifted so windows stop being black
 * holes. Frames, doors and stone keep their contrast, so the facade rhythm stays.
 */
export function calmBayLayers(colour: Uint8Array, mask: Uint8Array, layers: number, look: Look, size = CELL_PX): void {
  const px = size * size;
  const { wallPull, glassLift, liftBrick } = LOOK_VARIANTS[look];
  for (let layer = 0; layer < layers; layer++) {
    // Mean wall colour of this layer (mask.r is the wall tint weight).
    let sum = [0, 0, 0], n = 0;
    for (let i = 0; i < px; i++) {
      if (mask[(layer * px + i) * 2] > 200) { for (let c = 0; c < 3; c++) sum[c] += colour[(layer * px + i) * 4 + c]; n++; }
    }
    const mean = n ? sum.map(v => v / n) : [200, 200, 200];
    // Brick photos are dark; the tint multiplies them again. Lift wall pixels so the layer's mean is ~0.88 and the tint colour is what you see.
    const meanLum = (mean[0] + mean[1] + mean[2]) / 3;
    const lift = liftBrick && meanLum > 0 ? Math.min(2.4, PHOTO_WALL_CELL_MEAN / meanLum) : 1;
    for (let i = 0; i < px; i++) {
      const at = (layer * px + i) * 4, wall = mask[(layer * px + i) * 2] / 255, accent = mask[(layer * px + i) * 2 + 1];
      if (wall > 0.5) {
        if (liftBrick) {
          // Brick is relief evidence, not a second colour prior. Multiplying a
          // red photograph by surveyed brown/charcoal tint made every street
          // orange. Keep luminance variation and let vertex tint own the hue.
          const lum = (colour[at] + colour[at + 1] + colour[at + 2]) / 3;
          const neutral = Math.min(255, (lum + (meanLum - lum) * wallPull * wall) * (1 + (lift - 1) * wall));
          for (let c = 0; c < 3; c++) colour[at + c] = colour[at + c] * (1 - wall) + neutral * wall;
        } else {
          for (let c = 0; c < 3; c++) colour[at + c] = Math.min(255, (colour[at + c] + (mean[c] - colour[at + c]) * wallPull * wall) * (1 + (lift - 1) * wall));
        }
      } else if (accent < 128) {
        const lum = (colour[at] + colour[at + 1] + colour[at + 2]) / 3;
        if (lum < 90) { const k = glassLift * (1 - lum / 90); for (let c = 0; c < 3; c++) colour[at + c] += (150 - colour[at + c]) * k; }
      }
    }
  }
}

/**
 * Paint a look's arrays on the main thread, in `sliceMs` slices. `slotLayers` paints the city look's material-slot
 * layers (look/cityLook.ts `paintSlotLayers`) after the bay cells (`?cityLook=1` in the shared frame); a caller may
 * pass them already painted instead (`true` paints them here). `sliceMs` may be a function, read at every yield (the
 * settle hold lengthens the slices while it waits). Byte for byte what buildLookTextures always uploaded.
 */
export async function paintLookArrays(look: 'procedural' | Look, size = CELL_PX, options: { slotLayers?: boolean | { colour: Uint8Array; mask: Uint8Array }; sliceMs?: number | (() => number) } = {}): Promise<LookAtlasArrays> {
  // 512 px: the desktop-high texture policy (look/texturePolicy.ts); the bay drawings are 520 x 310 px of their own.
  if (size !== CELL_PX && size !== CELL_PX / 2 && !(size > CELL_PX && size <= CELL_PX * 2)) throw new Error('Unsupported building texture size');
  const slotLayers = options.slotLayers === true ? paintSlotLayers(document, await loadCityBrick(document), size) : options.slotLayers || undefined;
  const { layers, total } = lookAtlasLayers(look, !!slotLayers);
  // Facade chunks store their layer as a byte; slot meshes carry their own (small) slot ordinal.
  if (layers > 256) throw new Error('Building texture array exceeds byte layer indices');
  const px = size * size, colour = new Uint8Array(px * 4 * total), mask = new Uint8Array(px * 2 * total);
  if (slotLayers) { colour.set(slotLayers.colour, px * 4 * layers); mask.set(slotLayers.mask, px * 2 * layers); }
  let batchStart = performance.now();
  const yieldBudget = async () => {
    const slice = typeof options.sliceMs === 'function' ? options.sliceMs() : options.sliceMs;
    if (performance.now() - batchStart < (slice ?? TEXTURE_SLICE_MS)) return;
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    batchStart = performance.now();
  };
  // Native procedural painters store wall tint in alpha. Downsample one cell at
  // a time so the mobile path never allocates a second full-size city atlas.
  const copyCell = (cell: Uint8ClampedArray, layer: number) => {
    if (size > CELL_PX) { upsampleCell(cell, layer); return; }
    const factor = CELL_PX / size;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let red = 0, green = 0, blue = 0, tint = 0;
      for (let dy = 0; dy < factor; dy++) for (let dx = 0; dx < factor; dx++) {
        const at = ((y * factor + dy) * CELL_PX + x * factor + dx) * 4;
        red += cell[at]; green += cell[at + 1]; blue += cell[at + 2]; tint += cell[at + 3];
      }
      const at = layer * px + y * size + x, count = factor * factor;
      colour[at * 4] = Math.round(red / count); colour[at * 4 + 1] = Math.round(green / count); colour[at * 4 + 2] = Math.round(blue / count);
      colour[at * 4 + 3] = 255; mask[at * 2] = Math.round(tint / count);
    }
  };
  // The 256 px painters (procedural cells, roofs, glass block, masonry) into a larger array: bilinear, wrapping (the
  // cells tile), so a 512 px array holds the same pictures; only the bay drawings gain real detail.
  const upsampleCell = (cell: Uint8ClampedArray, layer: number) => {
    const k = CELL_PX / size;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const sx = (x + 0.5) * k - 0.5, sy = (y + 0.5) * k - 0.5, x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
      const at = (xx: number, yy: number) => ((((yy % CELL_PX) + CELL_PX) % CELL_PX) * CELL_PX + (((xx % CELL_PX) + CELL_PX) % CELL_PX)) * 4;
      const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
      const lerp = (o: number) => (cell[a + o] * (1 - fx) + cell[b + o] * fx) * (1 - fy) + (cell[c + o] * (1 - fx) + cell[d + o] * fx) * fy;
      const out = layer * px + y * size + x;
      colour[out * 4] = Math.round(lerp(0)); colour[out * 4 + 1] = Math.round(lerp(1)); colour[out * 4 + 2] = Math.round(lerp(2));
      colour[out * 4 + 3] = 255; mask[out * 2] = Math.round(lerp(3));
    }
  };
  if (look === 'procedural') {
    for (const style of FACADE_STYLES) for (let variant = 0; variant < CELL_VARIANTS; variant++) for (const kind of CELL_KINDS) {
      copyCell(paintCell(style, kind, variant), cellLayer(style, kind, variant));
      await yieldBudget();
    }
  }
  const roofBase = look === 'procedural' ? CELL_LAYER_COUNT : BAY_LAYER_COUNT;
  copyCell(paintGlassBlockCell(),layers - 1);
  for (const [i, cell] of paintRoofLayers(LOOK_VARIANTS[look].cartoonRoofCells).entries()) { copyCell(cell, roofBase + i); await yieldBudget(); }
  let brick: CanvasImageSource = document.createElement('canvas');
  if (look === 'photo') {
    const image = new Image(); image.src = new URL('materials/ambientcg/Bricks057/colour.jpg', document.baseURI).href;
    try { await image.decode(); brick = image; } catch { /* neutral drawn brick */ }
  }
  const scratch = document.createElement('canvas'); scratch.width = scratch.height = size;
  const ctx = scratch.getContext('2d', { willReadFrequently: true })!;
  for (const entry of BAY_ENTRIES) {
    if (entry.originalMasonry) {
      copyCell(paintFatihMasonryCell(), look === 'procedural' ? PROCEDURAL_RECIPE_LAYER_OFFSET + entry.layer : entry.layer);
      await yieldBudget();
      continue;
    }
    const bayLook = look === 'procedural' ? 'photo' : look;
    const painted = bayTextures(bayVariant(entry), brick, bayLook);
    const layer = look === 'procedural' ? PROCEDURAL_RECIPE_LAYER_OFFSET + entry.layer : entry.layer;
    for (const [source, isMask] of [[painted.colour, false], [painted.mask, true]] as const) {
      ctx.clearRect(0, 0, size, size); ctx.drawImage(source, 0, 0, size, size);
      const pixels = ctx.getImageData(0, 0, size, size).data;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const from = ((size - 1 - y) * size + x) * 4, at = layer * px + y * size + x;
        if (isMask) { mask[at * 2] = pixels[from]; mask[at * 2 + 1] = pixels[from + 1]; }
        else { colour[at * 4] = pixels[from]; colour[at * 4 + 1] = pixels[from + 1]; colour[at * 4 + 2] = pixels[from + 2]; colour[at * 4 + 3] = 255; }
      }
    }
    if (look !== 'procedural') calmBayLayers(colour.subarray(layer * px * 4, (layer + 1) * px * 4), mask.subarray(layer * px * 2, (layer + 1) * px * 2), 1, bayLook, size);
    await yieldBudget();
  }
  // The canvases' pixels now live in `colour`/`mask`; the cache would keep them for the session.
  releaseBayTextures();
  return { colour, mask, size, layers, total };
}
