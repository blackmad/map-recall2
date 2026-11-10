/**
 * The Node side of scripts/building-recipes/render.ts `renderModels` (lane H12, docs/house-line.md §8): the same
 * models, views and look in, PNG buffers out, through load.ts + look.ts + raster.ts. No browser, no lock, no globals.
 *
 * What it cannot draw, and so leaves to the browser (render.ts `--browser`): the city look (`{city: true}`, the
 * `?cityLook=1` atlas shader; render.ts falls back to Chromium for it by itself), the standard material's specular,
 * anisotropic filtering, cast shadows.
 */
import fs from 'node:fs';
import sharp from 'sharp';
import { loadGlb, type GlbScene } from './load.ts';
import { buildScene, RecipeCells, SHEET_RIG, SHEET_GROUND, SHEET_BACKGROUND, GAME_RIG, GAME_GROUND, galleryRig, GALLERY_BACKGROUND, hexBytes, type GlbLook } from './look.ts';
import { rasteriseScene, type RasterCamera, type RasterImage, type RasterLight } from './raster.ts';

export type NodeRenderModel = { file: string; position?: number[]; rotationY?: number; scale?: number[] };
/** render.ts RenderView. */
export type NodeRenderView = RasterCamera & { background?: string; noGround?: boolean };
export type NodeRenderOptions = {
  look?: GlbLook;
  supersample?: number;
  /** Override the look's rig (e.g. galleryRig(theta) per orbit view). */
  light?: RasterLight | ((view: NodeRenderView) => RasterLight);
  /** Replace the look's ground plane (null: none). */
  ground?: { y: number; half: number; color: string; lambert?: boolean } | null;
  /** Every material double-sided (default: the look's rule, look.ts buildScene). */
  forceDoubleSided?: boolean;
  /** Background hex when a view names none (default: the look's). */
  background?: string;
  /** Called per view with the raster timing. */
  onView?: (view: NodeRenderView, image: RasterImage) => void;
};

const glbCache = new Map<string, { mtimeMs: number; size: number; glb: Promise<GlbScene> }>();
/** A GLB file, parsed once per process (keyed by path, mtime and size). */
export function glbFile(file: string): Promise<GlbScene> {
  const st = fs.statSync(file), hit = glbCache.get(file);
  if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return hit.glb;
  const glb = loadGlb(new Uint8Array(fs.readFileSync(file)));
  glbCache.set(file, { mtimeMs: st.mtimeMs, size: st.size, glb });
  return glb;
}

let cells: Promise<RecipeCells> | null = null;
const recipeCells = () => (cells ??= RecipeCells.create());

/** Raw RGBA of each view (row 0 at the top). */
export async function rasteriseModels(models: NodeRenderModel[], views: NodeRenderView[], options: NodeRenderOptions = {}): Promise<RasterImage[]> {
  const look = options.look ?? 'recipe';
  const placed = await Promise.all(models.map(async m => ({ glb: await glbFile(m.file), position: m.position, rotationY: m.rotationY, scale: m.scale })));
  const ground = options.ground !== undefined ? options.ground : look === 'game' ? GAME_GROUND : look === 'gallery' ? null : SHEET_GROUND;
  const c = look === 'recipe' ? await recipeCells() : null, fd = options.forceDoubleSided;
  const withGround = ground ? buildScene(placed, { look, cells: c, ground, forceDoubleSided: fd }) : null;
  const without = views.some(v => v.noGround) || !ground ? buildScene(placed, { look, cells: c, ground: null, forceDoubleSided: fd }) : null;
  const out: RasterImage[] = [];
  for (const v of views) {
    const rig = typeof options.light === 'function' ? options.light(v) : options.light ?? (look === 'game' ? GAME_RIG : look === 'gallery' ? galleryRig() : SHEET_RIG);
    const bgHex = v.background ?? options.background ?? (look === 'gallery' ? GALLERY_BACKGROUND : SHEET_BACKGROUND);
    const img = rasteriseScene(!v.noGround && withGround ? withGround : without!, v, { supersample: options.supersample ?? 2, background: hexBytes(bgHex), light: rig });
    options.onView?.(v, img);
    out.push(img);
  }
  return out;
}

export const pngOf = (img: { width: number; height: number; rgba: Uint8ClampedArray | Uint8Array }) =>
  sharp(Buffer.from(img.rgba.buffer, img.rgba.byteOffset, img.rgba.byteLength), { raw: { width: img.width, height: img.height, channels: 4 } }).removeAlpha().png().toBuffer();

/** PNG of each view: render.ts `renderModels` without a browser. */
export async function renderModelsNode(models: NodeRenderModel[], views: NodeRenderView[], options: NodeRenderOptions = {}): Promise<Buffer[]> {
  const images = await rasteriseModels(models, views, options);
  return Promise.all(images.map(pngOf));
}
