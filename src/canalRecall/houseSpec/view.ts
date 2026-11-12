/**
 * The runtime view of a resolved HouseSpec (house line §1 "The generic path reads it"): only what the generic streamed
 * path reads, each key with its winning source. Build time only (scripts/house-specs/build-house-specs.ts writes it as
 * the extract's `v`; house:preview --spec builds it for an override); the runtime half is decorate.ts.
 *
 * Lane H11 (#361) added the design fields the generic path can express without a GLB:
 *   storeys             fronts/0/storeys (lane H9): the drawn storey count; groundM (H11) storeyHeights[0] (specStoreyFit)
 *   wallFamily, stoop   H9's reader wall family and K-stoep's stoop (#360)
 *   look                window surround, frame tone, head and proportion: which bay-look preset (bayLook.ts bayStyleForTraits)
 *   shop / shopHex      fronts/0/shopfront (or facts.pui): a shop ground storey or a quiet one, and the shop paint
 * A key no source stated, or only a type default stated, stays absent, so a view without them is the view before H11.
 */
import { SWATCHES } from '../buildingRecipe/intent.ts';
import type { HouseSpecView, SpecLook } from './decorate.ts';
import { fieldSources } from './resolve.ts';
import { frontBays, type HouseSpec } from './spec.ts';

const hex = (v: unknown) => (typeof v === 'string' ? (/^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : SWATCHES[v]?.toLowerCase()) : undefined);
const luma = (h: string) => { const n = parseInt(h.slice(1), 16); return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };

/** The roof planner draws a monument gable as the whole roof's crown: only full-width gabled crowns reach it. */
const PLANNER_GABLES = new Set(['step', 'neck', 'raised-neck', 'bell', 'spout', 'point']);
export function plannerCrown(spec: HouseSpec): boolean {
  const f = spec.design.fronts?.[0];
  const at = f?.crownAt as { from?: number; to?: number } | undefined;
  const full = !f?.crownBays && (!at || ((at.from ?? 0) <= 0.05 && (at.to ?? 1) >= 0.95));
  return !!f?.gable && PLANNER_GABLES.has(f.gable) && full && spec.design.roof?.form !== 'flat';
}

/** Window surrounds that read as white trim around the opening (bay presets with `paleAccents`). `sill` and `none` do not. */
export const PALE_SURROUNDS: ReadonlySet<string> = new Set(['stone-lintel', 'full-frame', 'keystone', 'eared-keystone']);
/** A frame colour below this luma reads as a dark frame (bay presets with `frameTone: 'dark'`); white/cream frames are well above. */
export const DARK_FRAME_LUMA = 0.35;

/**
 * The bay-look traits a front states (null = not stated, the buurt profile or the hash decides). `src` is the weakest
 * winning source among the fields used, so a type default anywhere keeps the whole look out.
 */
export function specLook(spec: HouseSpec, src: Record<string, string>): { look: SpecLook; src: string } | null {
  const f = spec.design.fronts?.[0] as Record<string, unknown> | undefined, palette = spec.design.palette as Record<string, unknown> | undefined;
  if (!f && !palette) return null;
  const used: string[] = [];
  const take = (key: string, path: string) => { const s = src[path]; if (!s || s === 'default') return undefined; used.push(s); return f?.[key]; };
  const look: SpecLook = {};
  const surround = take('windowSurround', 'fronts/0/windowSurround') as string | undefined;
  const speklagen = take('speklagen', 'fronts/0/speklagen');
  if (surround !== undefined) look.pale = PALE_SURROUNDS.has(surround) || !!speklagen;
  else if (speklagen) look.pale = true;
  const frameSrc = src['palette/frame'], frame = frameSrc && frameSrc !== 'default' ? hex(palette?.frame) : undefined;
  if (frame) { look.dark = luma(frame) < DARK_FRAME_LUMA; used.push(frameSrc!); }
  const head = take('windowHead', 'fronts/0/windowHead') as { kind?: string; storeys?: number[] } | undefined;
  const windows = take('windows', 'fronts/0/windows') as string | undefined;
  // A head on some storeys only counts when it covers most of the front's upper storeys.
  const storeys = Number(f?.storeys) || 0;
  if (head?.kind) look.arch = head.kind !== 'flat' && (!head.storeys || !storeys || head.storeys.length * 2 >= Math.max(1, storeys - 1));
  else if (windows === 'arched') look.arch = true;
  else if (windows) look.arch = false; // a stated window kind with no head: the recipe compiler draws a flat head
  if (take('windowProportion', 'fronts/0/windowProportion') === 'tall') look.tall = true;
  if (look.pale === undefined && look.dark === undefined && look.arch === undefined && look.tall === undefined) return null;
  const order = ['default', 'osm', '3dbag', 'ahn', 'pdok-ortho', 'vision-judge', 'bag', 'monument-text', 'streetlevel-measured', 'reviewed', 'author'];
  return { look, src: used.sort((a, b) => order.indexOf(a) - order.indexOf(b))[0] };
}

/** Sources that read the street front itself: their silence about a shopfront means a quiet ground storey. */
const PHOTO_SOURCES: ReadonlySet<string> = new Set(['vision-judge', 'streetlevel-measured', 'reviewed', 'author']);

/** The runtime view of a resolved spec (the extract's `v`). */
export function specView(spec: HouseSpec): HouseSpecView {
  const src = fieldSources(spec), front = spec.design.fronts?.[0];
  const v: HouseSpecView = { src: {} };
  // The roof planner (roofMesh planRoof) draws a monument gable as the whole roof's crown: a canal house's gabled or
  // cornice-fronted pitched roof. A street-measured cornice/flat front (a flat-roofed 1890s block), a partial crown
  // (crownAt/crownBays over some bays) or a flat roof form is not that, so only full-width gabled crowns reach it; the
  // register's own gable words (monument-text) pass as before. The full front stays in the record's design (`d`).
  if (front?.gable && (src['fronts/0/gable'] === 'monument-text' || plannerCrown(spec))) { v.gable = front.gable; v.src.gable = src['fronts/0/gable']; }
  // A flat crown stated by a street source or an author (lane H9) clears a register gable (decorate.ts withHouseSpecCrown).
  else if (front?.gable === 'flat' && ['streetlevel-measured', 'reviewed', 'author'].includes(src['fronts/0/gable'] ?? '')) { v.gable = 'flat'; v.src.gable = src['fronts/0/gable']; }
  if (spec.facts?.facadeYear) { v.year = spec.facts.facadeYear; v.src.year = src['facts/facadeYear']; }
  if (spec.design.palette?.wallMaterial) { v.wallMaterial = spec.design.palette.wallMaterial; v.src.wallMaterial = src['palette/wallMaterial']; }
  const wall = hex(spec.design.palette?.brick);
  if (wall) { v.wallHex = wall; v.src.wallHex = src['palette/brick']; }
  if (spec.facts?.wallFamily) { v.wallFamily = spec.facts.wallFamily; v.src.wallFamily = src['facts/wallFamily']; }
  // A bay count no source measured (an auto-placed type's default, adapters.ts fromBlockFace) stays in the record but
  // does not reach the generic path: its own cell count is as good a guess, and a measured source can outrank it.
  const bays = frontBays(front), baysSrc = src[front?.axisGrid ? 'fronts/0/axisGrid' : 'fronts/0/bays'];
  if (bays && baysSrc !== 'default') { v.bays = bays; v.src.bays = baysSrc; }
  // Storeys (lane H9; full street storeys, the ground once, spec.ts STOREYS_DEFINITION): the drawn storey count follows
  // the spec. H11: the ground storey's height beside it, when a source other than a type default states it.
  if (Number.isInteger(front?.storeys) && front!.storeys! >= 2) {
    v.storeys = front!.storeys; v.src.storeys = src['fronts/0/storeys'];
    const heights = front?.storeyHeights as number[] | undefined, ground = Array.isArray(heights) ? Number(heights[0]) : NaN;
    if (Number.isFinite(ground) && ground >= 2 && ground <= 7 && src['fronts/0/storeyHeights'] !== 'default') v.groundM = +ground.toFixed(2);
  }
  // A stoop (K-stoep #360): presence from the basement (register `stoep`, Jev, a hand read), the measured fields when stated.
  if (front?.basement === 'stoop' || front?.basement === 'stoop-and-windows') {
    v.stoop = (front.stoop ?? {}) as HouseSpecView['stoop']; v.src.stoop = src['fronts/0/stoop'] ?? src['fronts/0/basement'];
  }
  const look = specLook(spec, src);
  if (look) { v.look = look.look; v.src.look = look.src; }
  // A shop ground storey: a stated shopfront, else the judge's pui. No shopfront on a front a photo source described in
  // full (storeys and windows stated) is a quiet ground storey.
  const shop = (front as Record<string, unknown> | undefined)?.shopfront as Record<string, unknown> | undefined, shopSrc = src['fronts/0/shopfront'];
  if (shop && shopSrc !== 'default') {
    v.shop = true; v.src.shop = shopSrc;
    const paint = hex(shop.colour);
    if (paint) v.shopHex = paint;
  } else if (spec.facts?.pui && src['facts/pui'] !== 'default') {
    v.shop = spec.facts.pui === 'shop'; v.src.shop = src['facts/pui'];
  } else if (!shop && v.storeys && PHOTO_SOURCES.has(v.src.storeys ?? '') && front?.windows && PHOTO_SOURCES.has(src['fronts/0/windows'] ?? '')) {
    v.shop = false; v.src.shop = src['fronts/0/windows'];
  }
  return v;
}
