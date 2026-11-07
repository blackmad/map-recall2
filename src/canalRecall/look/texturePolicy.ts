// One texture policy (engine look plan #222, lane R1-B #224): every texture the own engine creates for the city asks
// this function for its size and filtering, so a tier or pointer type changes them all in one place.
//
// "Windows and trim look fuzzy" (user, Da Costakade, build 69d4c65, Mac, DPR 2): the facade cells were 256 px per
// bay-storey while the bay drawings they come from are 520 x 310 px (bayTextures.ts BAY_PX / STOREY_PX), so half the
// drawn detail was thrown away on the way into the array, and the ground canvases filtered at anisotropy 4 at the
// chase camera's grazing angle (rails and kerbs smeared along the view).
//
// Desktop `high` tier: HIGH_CELL_PX facade cells (pinned 256 at integration; `?cellPx=` up to 512 for A/B), anisotropy
// min(gpuMax, 16) on the slot array and ground canvases and HIGH_FACADE_ANISOTROPY (4, lane R3-E #240) on the facade arrays. `mid`, `low`, touch and any page without a tier (the legacy
// MapLibre layer, galleries) keep exactly the values they had: 256 px (128 on touch) cells at 16 (4 on touch), ground 4.
// `?texturePolicy=0` (or `window.__canalRecallTexturePolicy = false`) restores those values everywhere, byte for byte.
//
// Two numbers follow the cell size so nothing else moves: the facade tier's rates are texels per pixel
// (roofTier.ts facadeTierUniform), so a 512 px cell scales them by `tierScale` = cellPx / 256 (windows flatten at the
// same screen size as before), and the mean-colour sample must still read the last mip: roofTier.ts samples it at
// CELL_MEAN_LOD 12, which GL clamps to the array's last level (8 at 256 px as the literal 8.0 did, 9 at 512 px).

export type TextureTier = 'low' | 'mid' | 'high';
export type TextureKind = 'facadeCells' | 'slotCells' | 'ground';

export interface TexturePolicyInput {
  /** The engine's quality tier (renderGovernor.ts chooseTier, `__canalPerf.tier`); null/undefined: no tier (legacy). */
  tier?: TextureTier | null;
  /** A coarse pointer (phones, tablets). */
  coarse: boolean;
  /** renderer.capabilities.getMaxAnisotropy(). */
  gpuMaxAnisotropy: number;
  /** `?texturePolicy=0` turns the policy off: every texture as before. */
  enabled: boolean;
  /** `?cellPx=384` (desktop high only, A/B of the memory cost): another cell side in 257..512. */
  cellPx?: number | null;
  /** `?texAniso=16` (desktop high only): the facade arrays' anisotropy instead of HIGH_FACADE_ANISOTROPY. */
  facadeAnisotropy?: number | null;
}

export interface TextureParams {
  /** Side of a facade / slot cell, px (ground canvases keep their own sizes). */
  cellPx: number;
  anisotropy: number;
  minFilter: 'LinearMipmapLinear';
  magFilter: 'Linear';
  generateMipmaps: true;
  /** Multiplier on the facade tier's texel rates (cellPx / 256; 1 without the policy). */
  tierScale: number;
}

/** The cell side every tier but desktop `high` uses (facadeCells.ts CELL_PX). */
export const BASE_CELL_PX = 256;
/**
 * Desktop `high`: the default cell side. Pinned to 256 at integration (2026-11-06, #224): at the
 * same pose 512 px cells measured no sharpness gain at S2 (lapVar 757 vs 736) for +260 MB of GPU
 * texture (86.7 -> 346.7 MB). `?cellPx=288..512` still raises it for an A/B (MAX_CELL_PX).
 */
export const HIGH_CELL_PX = 256;
/** The largest side `?cellPx=` may ask for on desktop high (A/B only). */
export const MAX_CELL_PX = 512;
export const HIGH_ANISOTROPY = 16;
/**
 * Desktop `high`: the facade colour and tint-mask arrays' sampler anisotropy (lane R3-E #240). The user's S3 shimmer
 * (the 1962 slab on Weesperstraat, `s3-slab-user`) is the window texture on a wall seen edge-on: 16x anisotropic
 * filtering draws it from mip 2.5-3.5 (measured with level-coloured mips) with a one-pixel box along the wall, over
 * windows 1-2 px wide and 4-8 px apart. Capping the filter at 4x reads it a level coarser along the wall: aliasPx with
 * the analytic windows (the desktop look) 39,321 -> 30,049 (-24 %), while the Da Costakade quay houses (S2, frontal,
 * anisotropy under 4:1) keep their sharpness (lapVar -0.4 / -0.4 / -1.0 % at user / chase / near). 2x reached the
 * gate at the slab (21,616) but cost S2 -9 to -11 %. Touch already ran at 4. `?texAniso=16` restores the old value.
 */
export const HIGH_FACADE_ANISOTROPY = 4;
/** What the ground canvases always used (gameGround.ts canvasTexture). */
export const LEGACY_GROUND_ANISOTROPY = 4;
/** What the city look's own slot-only array used without an option (look/cityLook.ts createCityLook). */
export const LEGACY_SLOT_ANISOTROPY = 4;

const base = { minFilter: 'LinearMipmapLinear', magFilter: 'Linear', generateMipmaps: true } as const;

/** The values every texture had before the policy (`?texturePolicy=0`, and every tier but desktop high). */
export function legacyTextureParams(kind: TextureKind, input: Pick<TexturePolicyInput, 'coarse' | 'gpuMaxAnisotropy'>): TextureParams {
  const cellPx = input.coarse ? BASE_CELL_PX / 2 : BASE_CELL_PX;
  const anisotropy = kind === 'facadeCells' ? Math.min(input.gpuMaxAnisotropy, input.coarse ? 4 : 16)
    : kind === 'slotCells' ? LEGACY_SLOT_ANISOTROPY : LEGACY_GROUND_ANISOTROPY;
  return { ...base, cellPx, anisotropy, tierScale: 1 };
}

/** The policy: desktop `high` gets HIGH_CELL_PX cells (or `?cellPx=`), HIGH_FACADE_ANISOTROPY on the facade arrays (or `?texAniso=`) and 16x on the rest; everything else is `legacyTextureParams`. */
export function texturePolicy(kind: TextureKind, input: TexturePolicyInput): TextureParams {
  if (!input.enabled || input.coarse || input.tier !== 'high') return legacyTextureParams(kind, input);
  const gpu = Number.isFinite(input.gpuMaxAnisotropy) && input.gpuMaxAnisotropy >= 1 ? input.gpuMaxAnisotropy : 1;
  const asked = Number(input.cellPx);
  const cellPx = Number.isInteger(asked) && asked > BASE_CELL_PX && asked <= MAX_CELL_PX && asked % 32 === 0 ? asked : HIGH_CELL_PX;
  const askedAniso = Number(input.facadeAnisotropy);
  const want = kind === 'facadeCells' ? (Number.isFinite(askedAniso) && askedAniso >= 1 ? Math.min(askedAniso, HIGH_ANISOTROPY) : HIGH_FACADE_ANISOTROPY) : HIGH_ANISOTROPY;
  return { ...base, cellPx, anisotropy: Math.min(gpu, want), tierScale: cellPx / BASE_CELL_PX };
}

/** `?texAniso=16` (or `window.__canalRecallTexAniso`): the desktop-high facade arrays' anisotropy; null: HIGH_FACADE_ANISOTROPY. */
export function pageTexAniso(): number | null {
  try {
    const g = globalThis as { __canalRecallTexAniso?: number | string; location?: { search?: string } };
    const n = Number(g.__canalRecallTexAniso ?? (typeof URLSearchParams === 'function' ? new URLSearchParams(g.location?.search ?? '').get('texAniso') : null) ?? NaN);
    return Number.isFinite(n) && n >= 1 ? n : null;
  } catch { return null; }
}

/** `?texturePolicy=0` / `window.__canalRecallTexturePolicy = false`: off. On by default. */
export function texturePolicyFlag(): boolean {
  try {
    const g = globalThis as { __canalRecallTexturePolicy?: boolean | string; location?: { search?: string } };
    const asked = g.__canalRecallTexturePolicy ?? (typeof URLSearchParams === 'function' ? new URLSearchParams(g.location?.search ?? '').get('texturePolicy') : null);
    return !(asked === false || asked === '0' || asked === 'false' || asked === 'off');
  } catch { return true; }
}

/** `?cellPx=` (or `window.__canalRecallCellPx`): the desktop-high cell side for a memory A/B; null: HIGH_CELL_PX. */
export function pageCellPx(): number | null {
  try {
    const g = globalThis as { __canalRecallCellPx?: number | string; location?: { search?: string } };
    const n = Number(g.__canalRecallCellPx ?? (typeof URLSearchParams === 'function' ? new URLSearchParams(g.location?.search ?? '').get('cellPx') : null) ?? NaN);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch { return null; }
}

/** The page's tier as the own engine published it (`__canalPerf.tier`), null when none (legacy layer, galleries). */
export function pageTextureTier(): TextureTier | null {
  const tier = (globalThis as { __canalPerf?: { tier?: unknown } }).__canalPerf?.tier;
  return tier === 'low' || tier === 'mid' || tier === 'high' ? tier : null;
}

export function pageCoarsePointer(): boolean {
  return !!(globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia?.('(pointer: coarse)').matches;
}

/** The policy for this page: its tier, pointer and flag, and the renderer's anisotropy ceiling. */
export function pageTextureParams(kind: TextureKind, gpuMaxAnisotropy: number): TextureParams {
  return texturePolicy(kind, { tier: pageTextureTier(), coarse: pageCoarsePointer(), gpuMaxAnisotropy, enabled: texturePolicyFlag(), cellPx: pageCellPx(), facadeAnisotropy: pageTexAniso() });
}

/** Bytes a mipmapped 2D array texture holds on the GPU (full chain), for the texture budget rows. */
export function arrayTextureBytes(side: number, layers: number, bytesPerTexel: number): number {
  let total = 0;
  for (let s = side; s >= 1; s = Math.floor(s / 2)) { total += s * s; if (s === 1) break; }
  return total * layers * bytesPerTexel;
}
