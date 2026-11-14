/**
 * The realLook levers (lane default-look-realism, 2026-11-14, `?realLook=`, env REAL_LOOK; default off).
 *
 * David, 2026-11-14: "are we going to make the default look less cartoony to work better with the new canal house work?"
 * The measured houses (HouseSpecs, the W1/W2 wall pool, row fronts) now draw near photo colours, and the generic default
 * around them still draws authored display priors. Each lever replaces one authored prior with a measured one, for the
 * photo look only (the default); Cartoon, Storybook and `?look=legacy` are never touched, and a reviewed wall, a spec's
 * stated colour or a recipe always wins over anything here (each lever only replaces the unmeasured fallback).
 *
 *  - `walls`: an unmeasured pre-1945 pand with fewer than six measured neighbours inside the pool's 600 m used to take its
 *    buurt profile's swatch (median OKLab chroma 0.050, 10 % of draws L > 0.85) or the period deciles. It now takes the
 *    W2 variety draw over its nearest measured walls out to 3 km (measuredWallPool.ts measuredPoolDrawWide; the pool's
 *    1,051 readings have chroma median 0.030, L p90 0.59), painted draws on the smooth cells as W2 does.
 *  - `doors`: the photo look's door/accent swatches are drawn in the measured shares of the 1,574 door colours the
 *    published HouseSpecs carry (REAL_DOOR_SWATCHES).
 *  - `trees`: crowns lose the display boost (+8° hue, +10 % saturation over the photo-sampled species priors), take a seeded
 *    ±6 % lightness and ±4° hue per tree, and are smooth-shaded (same triangles).
 *
 * `?realLook=1` (or `all`) turns every lever on; `?realLook=walls,doors` a subset; `0` or absent: off, byte-identical.
 * REAL_LOOK in Node and the building worker's forwarded query read the same way (workerPool.ts withWorkerFlags).
 */
export const REAL_LOOK_LEVERS = ['walls', 'doors', 'trees'] as const;
export type RealLookLever = (typeof REAL_LOOK_LEVERS)[number];
/** The levers on when nothing is asked: none (the integrator flips these after the row sheets). */
export const REAL_LOOK_DEFAULT: readonly RealLookLever[] = [];

/** Parse a `?realLook=` value (or REAL_LOOK); undefined/empty keeps the default. */
export function realLookLevers(value?: string | null): ReadonlySet<RealLookLever> {
  if (value === undefined || value === null || value === '') return new Set(REAL_LOOK_DEFAULT);
  const v = value.trim().toLowerCase();
  if (v === '0' || v === 'off' || v === 'false' || v === 'none') return new Set();
  if (v === '1' || v === 'on' || v === 'true' || v === 'all') return new Set(REAL_LOOK_LEVERS);
  return new Set(v.split(/[,+ ]/).filter((x): x is RealLookLever => (REAL_LOOK_LEVERS as readonly string[]).includes(x)));
}

let cached: ReadonlySet<RealLookLever> | undefined;
/** The levers the runtime sees: `?realLook=` on the page (or the pool worker's URL), `__canalRecallRealLook`, else REAL_LOOK. Read once. */
export function realLookOn(lever: RealLookLever): boolean {
  if (!cached) {
    const g = globalThis as { __canalRecallRealLook?: string; location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
    let q: string | null = null;
    try { q = typeof URLSearchParams === 'function' ? new URLSearchParams(g.location?.search ?? '').get('realLook') : null; } catch { q = null; }
    cached = realLookLevers(q ?? g.__canalRecallRealLook ?? g.process?.env?.REAL_LOOK ?? null);
  }
  return cached.has(lever);
}
/** Tests only: forget the cached levers. */
export const resetRealLook = () => { cached = undefined; };

/**
 * Door colours in their measured shares: the 1,574 `palette.door` readings of the published HouseSpecs (house-specs
 * extract, 2026-11-14) binned by OKLab, each bin's medoid, 40 slots in proportion: black 58.7 %, brown 7.8 %, oxblood
 * 7.4 %, wood 6.9 %, green 6.7 %, dark grey 6.5 %, navy 3.2 %, yellow 1.9 % (white, 0.8 %, has no slot). The photo
 * look's authored accents (PHOTO_DARK_ACCENTS) were seven dark swatches in equal shares: navy and oxblood each 14 %.
 */
const DOOR_BINS: readonly (readonly [hex: string, slots: number])[] = [
  ['#252525', 9], ['#1f1f1f', 7], ['#2a2a2a', 7], ['#4a2420', 3], ['#8c2a26', 3], ['#86482a', 3], ['#26392e', 3], ['#2f3433', 3], ['#1f2b45', 1], ['#d4b04a', 1],
];
export const REAL_DOOR_SWATCHES: readonly string[] = DOOR_BINS.flatMap(([hex, n]) => Array.from({ length: n }, () => hex));
/** A pand's door (accent) colour from the measured shares, by its id hash. */
export const realDoorSwatch = (seed: number): string => REAL_DOOR_SWATCHES[(seed >>> 0) % REAL_DOOR_SWATCHES.length];

const hexRgb = (hex: string) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (c: number[]) => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
function hash01(id: unknown, salt: number): number {
  let n = 2166136261 ^ salt;
  for (const c of String(id ?? '')) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  n = Math.imul(n ^ (n >>> 15), 2246822507); n = Math.imul(n ^ (n >>> 13), 3266489909);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
/** Per-tree spread of the trees lever: lightness ×(1 ± TREE_SPREAD.light), hue ± TREE_SPREAD.hueDeg. */
export const TREE_SPREAD = { light: 0.06, hueDeg: 4 } as const;
/**
 * The trees lever's crown colour: the species prior as sampled (no display boost), with a seeded lightness and hue
 * spread per tree so a row reads as separate trees. Pure; `id` is the tree's inventory id.
 */
export function realFoliageHex(prior: string, id: unknown): string {
  const [r, g, b] = hexRgb(prior);
  const k = 1 + (hash01(id, 17) * 2 - 1) * TREE_SPREAD.light;
  // A small hue turn: rotate the colour about the grey axis k = (1,1,1)/sqrt 3 (Rodrigues; the centred vector is normal to k).
  const t = (hash01(id, 29) * 2 - 1) * TREE_SPREAD.hueDeg * Math.PI / 180, m = (r + g + b) / 3;
  const cos = Math.cos(t), sin = Math.sin(t), s3 = Math.sqrt(1 / 3);
  const rot = (v: number[]) => { const [x, y, z] = v.map(c => c - m);
    return [x * cos + s3 * (z - y) * sin, y * cos + s3 * (x - z) * sin, z * cos + s3 * (y - x) * sin].map(c => (c + m) * k); };
  return toHex(rot([r, g, b]));
}
