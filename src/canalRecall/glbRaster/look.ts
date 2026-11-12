/**
 * Dressing and light for the Node GLB rasteriser (lane H12, docs/house-line.md §8): the browser pages' looks, as data.
 *
 * Looks (what a GLB's materials become):
 *   recipe  scripts/building-recipes/render-page.ts's default: slot-tagged materials (materialSlot + tint extras, a uv
 *           attribute, not an inferred slot) become the recipe look's unlit cell shader, built by the game's own
 *           createRecipeLook (buildingRecipe/recipeLook.ts, `cityLook: false`) on a real three.js namespace and a
 *           @napi-rs/canvas document passed in (no globals): same cells, same tints, same uv scale. Every other
 *           material draws lit (the standard material's diffuse).
 *   flat    render.ts `--flat` (useFlatMaterials): every material lit, no cells.
 *   game    landmark-views.ts `light=game`: normaliseLandmarkMaterials (Lambert, the glass names' sky tint emissive).
 *   gallery landmark-views.ts `light=gallery`: the GLTFLoader standard materials.
 * Rigs (the lights each page adds), linear and multiplied by intensity: SHEET_RIG (render-page.ts), GAME_RIG and
 * galleryRig(theta) (landmark-views.ts). Both pages set every material DoubleSide or keep the GLB's; see `doubleSided`.
 */
import * as THREE from 'three';
import { createCanvas, loadImage, type Image } from '@napi-rs/canvas';
import fs from 'node:fs';
import { createRecipeLook, cityShade } from '../buildingRecipe/recipeLook.ts';
import { INFERRED_SLOT_SOURCE } from '../look/materialSlotInference.ts';
import { GLASS_NAME, GLASS_SKY_TINT } from '../landmarks/landmarkShading.ts';
import { makeTexture, srgbDecode, type RasterLight, type RasterMaterial, type RasterScene, type RasterTexture, type Vec3 } from './raster.ts';
import type { GlbScene } from './load.ts';

export type GlbLook = 'recipe' | 'flat' | 'game' | 'gallery';

const hexLinear = (hex: string | number, k = 1): Vec3 => {
  const n = typeof hex === 'number' ? hex : parseInt(hex.replace('#', ''), 16);
  return [srgbDecode(((n >> 16) & 255) / 255) * k, srgbDecode(((n >> 8) & 255) / 255) * k, srgbDecode((n & 255) / 255) * k];
};
const unit = (v: readonly number[]): Vec3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
export const hexBytes = (hex: string): Vec3 => { const n = parseInt(hex.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

/** A page's lights as a RasterLight: HemisphereLight(sky, ground, hemi) + DirectionalLight(sun, sunIntensity) at `sunAt` (toward the origin). */
export function rigOf(o: { sky: string | number; ground: string | number; hemi: number; sun: string | number; sunIntensity: number; sunAt: readonly number[] }): RasterLight {
  return { sunDir: unit(o.sunAt), sun: hexLinear(o.sun, o.sunIntensity), sky: hexLinear(o.sky, o.hemi), ground: hexLinear(o.ground, o.hemi) };
}

/** render-page.ts: HemisphereLight('#eef3f8', '#6b6458', 1.6), DirectionalLight('#fff4e2', 2.2) at (-30, 60, -40). */
export const SHEET_RIG: RasterLight = { sunDir: unit([-30, 60, -40]), sun: hexLinear('#fff4e2', 2.2), sky: hexLinear('#eef3f8', 1.6), ground: hexLinear('#6b6458', 1.6) };
/** render-page.ts ground: a 400 m plane at y = -0.02, MeshStandardMaterial #8d8b86; background #c9d6e0. */
export const SHEET_GROUND = { y: -0.02, half: 200, color: '#8d8b86' };
export const SHEET_BACKGROUND = '#c9d6e0';
/** landmark-views.ts game light: hemisphere 0xdfeaf2 / 0x6b7480 x 1.15, sun 0xfff6e8 x 2.2 at (-0.5, 1.6, 0.9), fill 0xc9dcea x 0.55 at (0.8, 0.4, -1.1). */
export const GAME_RIG: RasterLight = { sunDir: unit([-0.5, 1.6, 0.9]), sun: hexLinear(0xfff6e8, 2.2), sky: hexLinear(0xdfeaf2, 1.15), ground: hexLinear(0x6b7480, 1.15), fills: [{ dir: unit([0.8, 0.4, -1.1]), color: hexLinear(0xc9dcea, 0.55) }] };
export const GAME_GROUND = { y: -0.03, half: 2000, color: '#9a9c94' };
/** landmark-views.ts gallery light: hemisphere 0xffffff / 0x88806e x 2, sun 0xffefce x 2.2 following the orbit's theta. */
export function galleryRig(theta = 0.55): RasterLight {
  return { sunDir: unit([Math.sin(theta - 0.65) * 150, 200, Math.cos(theta - 0.65) * 150]), sun: hexLinear(0xffefce, 2.2), sky: hexLinear(0xffffff, 2), ground: hexLinear(0x88806e, 2) };
}
export const GALLERY_BACKGROUND = '#ebe7dd';

/** A model placed as render.ts RenderModel places it: scale, then rotation about +y, then translation. */
export type Placement = { position?: number[]; rotationY?: number; scale?: number[] };

/** The Bricks057 photo the recipe look's brick cell is painted from (render.ts `cityBrick`). */
export const BRICK_PHOTO = 'public/canal-drive/materials/ambientcg/Bricks057/colour.jpg';

type Cell = { texture: RasterTexture; tint: Vec3; uvScale: number };
/** The recipe look's cells, painted once per process by the game's createRecipeLook. */
export class RecipeCells {
  private look: ReturnType<typeof createRecipeLook> | null = null;
  private textures = new Map<unknown, RasterTexture>();
  constructor(private brick: Image | null) {}
  static async create(brickFile: string | null = BRICK_PHOTO): Promise<RecipeCells> {
    let brick: Image | null = null;
    if (brickFile && fs.existsSync(brickFile)) brick = await loadImage(fs.readFileSync(brickFile));
    return new RecipeCells(brick);
  }
  /** The cell a slot material becomes, or null when the recipe look leaves it alone. */
  cell(extras: Record<string, unknown>, hasUv: boolean, side: number): Cell | null {
    const slot = extras.materialSlot, tint = extras.tint;
    if (typeof slot !== 'string' || typeof tint !== 'string' || !hasUv) return null;
    if (extras.materialSlotSource === INFERRED_SLOT_SOURCE) return null;
    this.look ??= createRecipeLook(THREE, { document: { createElement: () => createCanvas(1, 1) } as unknown as Document, brick: this.brick as unknown as CanvasImageSource, anisotropy: 8, cityLook: false });
    const mesh: { isMesh: true; material: { side: number; userData: Record<string, unknown>; dispose(): void }; geometry: { getAttribute(n: string): unknown } } = {
      isMesh: true, material: { side, userData: { ...extras }, dispose() {} }, geometry: { getAttribute: (n: string) => (n === 'uv' ? {} : null) },
    };
    const changed = this.look.apply({ traverse: (cb: (o: unknown) => void) => cb(mesh) });
    if (!changed) return null;
    const sm = mesh.material as unknown as { uniforms: { map: { value: THREE.Texture }; tint: { value: THREE.Vector3 }; uvScale: { value: number } } };
    const map = sm.uniforms.map.value;
    let texture = this.textures.get(map);
    if (!texture) {
      const canvas = map.image as unknown as ReturnType<typeof createCanvas>;
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      texture = makeTexture(data, canvas.width, canvas.height, map.flipY, map.wrapS === THREE.ClampToEdgeWrapping);
      this.textures.set(map, texture);
    }
    const t = sm.uniforms.tint.value;
    return { texture, tint: [t.x, t.y, t.z], uvScale: sm.uniforms.uvScale.value };
  }
}

export type SceneModel = { glb: GlbScene } & Placement;
export type BuildOptions = {
  look: GlbLook;
  /** recipe look only. */
  cells?: RecipeCells | null;
  /** Every material double-sided (render-page.ts sets DoubleSide on all). Default true for recipe/flat, the GLB's flag for game/gallery. */
  forceDoubleSided?: boolean;
  /** A lit ground plane (half extent, height, sRGB hex), drawn as two triangles. */
  ground?: { y: number; half: number; color: string; lambert?: boolean } | null;
};

const textureCache = new WeakMap<object, RasterTexture>();

/** Flatten placed GLBs and a ground plane into one RasterScene in the sheet frame. */
export function buildScene(models: SceneModel[], options: BuildOptions): RasterScene {
  const pos: number[] = [], nrm: number[] = [], uv: number[] = [], shade: number[] = [], col: number[] = [], idx: number[] = [], triMat: number[] = [];
  const materials: RasterMaterial[] = [], matKey = new Map<string, number>();
  const doubleAll = options.forceDoubleSided ?? (options.look === 'recipe' || options.look === 'flat');
  let hasColors = false;
  const addMaterial = (key: string, make: () => RasterMaterial) => { let i = matKey.get(key); if (i === undefined) { i = materials.length; materials.push(make()); matKey.set(key, i); } return i; };
  models.forEach((model, mi) => {
    const s = model.scale ?? [1, 1, 1], ry = model.rotationY ?? 0, t = model.position ?? [0, 0, 0], c = Math.cos(ry), sn = Math.sin(ry);
    // Object3D: R_y(ry) * S, then translate. R_y: x' = c x + s z, z' = -s x + c z.
    const place = (x: number, y: number, z: number): [number, number, number] => { const X = x * s[0], Y = y * s[1], Z = z * s[2]; return [c * X + sn * Z + t[0], Y + t[1], -sn * X + c * Z + t[2]]; };
    const placeN = (x: number, y: number, z: number): [number, number, number] => { const X = x / s[0], Y = y / s[1], Z = z / s[2], l = Math.hypot(X, Y, Z) || 1; return [(c * X + sn * Z) / l, Y / l, (-sn * X + c * Z) / l]; };
    for (const prim of model.glb.primitives) {
      const m = model.glb.materials[prim.material];
      const side = doubleAll || m.doubleSided ? THREE.DoubleSide : THREE.FrontSide;
      const cell = options.look === 'recipe' && options.cells ? options.cells.cell(m.extras, !!prim.uvs, side) : null;
      let material: number;
      if (cell) material = addMaterial(`cell|${mi}|${prim.material}`, () => ({ kind: 'cell', color: cell.tint, texture: cell.texture, uvScale: cell.uvScale, doubleSided: side === THREE.DoubleSide }));
      else material = addMaterial(`glb|${mi}|${prim.material}`, () => {
        let tex: RasterTexture | null = null;
        if (m.baseColorTexture) { tex = textureCache.get(m.baseColorTexture) ?? null; if (!tex) { tex = makeTexture(m.baseColorTexture.rgba, m.baseColorTexture.width, m.baseColorTexture.height, false); textureCache.set(m.baseColorTexture, tex); } }
        const glass = options.look === 'game' && !m.unlit && GLASS_NAME.test(m.name);
        return {
          kind: m.unlit ? 'unlit' : 'lit', color: [m.baseColor[0], m.baseColor[1], m.baseColor[2]], texture: tex,
          // glTF textures are not flipped (GLTFLoader flipY = false): uv (0, 0) is the image's top-left, row 0 of the decoded image.
          emissive: glass ? [m.emissive[0] + GLASS_SKY_TINT.r, m.emissive[1] + GLASS_SKY_TINT.g, m.emissive[2] + GLASS_SKY_TINT.b] : m.emissive,
          // recipe/flat/gallery keep GLTFLoader's MeshStandardMaterial; the game look swaps it for a Lambert.
          ...(options.look !== 'game' && !m.unlit ? { standard: { roughness: m.roughness, metallic: m.metallic } } : {}),
          opacity: m.alphaMode === 'BLEND' ? m.baseColor[3] : 1, alphaMode: m.alphaMode, alphaCutoff: m.alphaCutoff, doubleSided: side === THREE.DoubleSide,
        };
      });
      const base = pos.length / 3, n = prim.positions.length / 3;
      const P = prim.positions, Nn = prim.normals, UV = prim.uvs;
      // Face normals where the primitive has none (three would draw it black; the GLB audit flags it).
      const faceN = Nn ? null : new Float32Array(n * 3);
      if (faceN) for (let k = 0; k + 2 < prim.indices.length; k += 3) {
        const a = prim.indices[k], b = prim.indices[k + 1], d = prim.indices[k + 2];
        const e1 = [P[b * 3] - P[a * 3], P[b * 3 + 1] - P[a * 3 + 1], P[b * 3 + 2] - P[a * 3 + 2]], e2 = [P[d * 3] - P[a * 3], P[d * 3 + 1] - P[a * 3 + 1], P[d * 3 + 2] - P[a * 3 + 2]];
        const fn = unit([e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]);
        for (const v of [a, b, d]) faceN.set(fn, v * 3);
      }
      const NN = Nn ?? faceN!;
      for (let v = 0; v < n; v++) {
        pos.push(...place(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]));
        const wn = placeN(NN[v * 3], NN[v * 3 + 1], NN[v * 3 + 2]);
        nrm.push(...wn);
        uv.push(UV ? UV[v * 2] : 0, UV ? UV[v * 2 + 1] : 0);
        // recipeLook VERTEX: n = enuFromWorld * world normal, SOUTH_Z_ENU: east = x, north = -z, up = y.
        shade.push(cell ? cityShade([wn[0], -wn[2], wn[1]]) : 1);
        if (prim.colors && !cell) { hasColors = true; col.push(prim.colors[v * 4], prim.colors[v * 4 + 1], prim.colors[v * 4 + 2]); } else col.push(1, 1, 1);
      }
      for (let k = 0; k + 2 < prim.indices.length; k += 3) { idx.push(base + prim.indices[k], base + prim.indices[k + 1], base + prim.indices[k + 2]); triMat.push(material); }
    }
  });
  if (options.ground) {
    const g = options.ground, base = pos.length / 3, h = g.half;
    pos.push(-h, g.y, -h, -h, g.y, h, h, g.y, h, h, g.y, -h);
    for (let k = 0; k < 4; k++) { nrm.push(0, 1, 0); uv.push(0, 0); shade.push(1); col.push(1, 1, 1); }
    const gm = materials.length;
    // render-page.ts: MeshStandardMaterial({roughness: 1}) (metalness 0); landmark-views.ts game floor: MeshLambertMaterial.
    materials.push({ kind: 'lit', color: hexLinear(g.color), doubleSided: false, ...(options.look === 'game' || g.lambert ? {} : { standard: { roughness: 1, metallic: 0 } }) });
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3); triMat.push(gm, gm);
  }
  return {
    positions: Float32Array.from(pos), normals: Float32Array.from(nrm), uvs: Float32Array.from(uv), shade: Float32Array.from(shade),
    ...(hasColors ? { colors: Float32Array.from(col) } : {}),
    indices: Uint32Array.from(idx), triMaterial: Uint16Array.from(triMat), materials,
  };
}
