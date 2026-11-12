/**
 * The per-pand facade record (F1, issue #380; design docs/plans/facade-f1-design-20261112.md §1).
 *
 * Why: today every wall vertex carries its look (atlas `layer`, tint, accent, repeat UVs) and a pand can only pick an
 * atlas row, so most of what the house line measures per pand (storey heights, bays per storey, window kind and head,
 * door bay, accents, cornice, ground kind) has nowhere to go. The record moves the look off the vertex into one
 * 64-byte row per pand (plus one per extra street front); the facade shader (`facadeShader.ts`) lays storeys and bays
 * out in wall metres and draws openings, brick, bands and accents from it.
 *
 * Layout: 4 rows x 16 bytes = 4 RGBA32UI texels, little-endian. Every field is pinned in `FACADE_FIELDS` (row, byte,
 * bit, width); `packFacadeRecord` / `unpackFacadeRecord` are table-driven, so the GLSL unpack (generated from the same
 * table) and the CPU twin cannot drift from the packer. Bump `FACADE_RECORD_VERSION` on any layout change: the
 * runtime falls back to the legacy path on a version it does not know.
 *
 * Provenance (`Src`, 2 bits): 0 default/prior (type family, buurt profile, 3DBAG), 1 inferred (row coherence, register
 * element list, a judge under 0.8, BAG), 2 register or hand fact (`monument-text`, `author`, `reviewed`), 3 measured on
 * a photo (`streetlevel-measured`, a judge at >= 0.8). The F3 ruling for accents: drawn from Src 2-3 only; with Src 0-1
 * the record carries the type-family prior and the bit says so.
 *
 * Pure, no DOM, no three.js: the world compiler, the building worker and `house:preview` all call it.
 */
import {
  ARCH_RING_COLOURS, ARCH_RING_STYLES, BASEMENTS, CORNICES, DIMINISHING_WINDOW_HEIGHTS, QUOINS, ROOF_MATERIALS,
  SHOP_ENTRANCES, SHOP_GLAZING, STALLRISERS, SWATCHES, TYMPANUM_FILLS, WINDOWS, WINDOW_HEADS, WINDOW_SURROUNDS,
} from '../buildingRecipe/intent.ts';
import { hash01 } from '../facadeExtraCore.ts';
import { FACADE_STYLES, type FacadeStyle } from '../genericFacades.ts';
import { STYLE_DIMS } from '../facadeCells.ts';

export const FACADE_RECORD_VERSION = 1;
export const FACADE_RECORD_BYTES = 64;
/** Records per row of the RGBA32UI texture (4 texels a record, 256 texels wide). */
export const FACADE_RECORDS_PER_ROW = 64;

// --- enums (index = the stored code) -----------------------------------------------------------------------------
export const FACADE_WALL_MATERIALS = ['brick', 'stucco', 'painted-brick', 'stone', 'concrete', 'glass', 'timber'] as const;
/** `GLASS_STOPS` gradient choices: default, the calm-lifted pale glass, dark, reflective (modern), shop display glass. */
export const FACADE_GLASS_TONES = ['default', 'calm-lifted', 'dark', 'reflective', 'shop'] as const;
export const FACADE_ROOF_MATERIALS = [...ROOF_MATERIALS, 'flat-bitumen', 'unknown'] as const;
export const FACADE_BANDS = ['none', 'storey', 'lintel', 'both', 'courses', 'speklagen', 'painted'] as const;
export const FACADE_BAND_LINES = ['sill', 'transom', 'head'] as const;
/** Row 3 ground kinds (F2 owns the semantics). `pui-glazed`: a fully glazed ground storey that is not a shop. */
export const FACADE_GROUND_KINDS = ['residential', 'shop', 'warehouse', 'arcade', 'wall', 'garage', 'pui-glazed'] as const;
/** `statedMask` bits (row 1 byte 14): 1 = the field came from Src >= 2. */
export const FACADE_STATED = ['storeys', 'bays', 'windows', 'head', 'door', 'heights', 'cornice', 'ground'] as const;
/** `doorBay` codes beyond a bay index. */
export const DOOR_BAY_NONE = 255, DOOR_BAY_AUTO = 254;
/** `baysUpper` 0: the shader fits bays to the wall with the style's window pitch (`FACADE_WINDOW_PITCH_M`). */
export const BAYS_FIT = 0;
/** Window axis pitch per style (m): STYLE_DIMS.bay over the generic cell's window axes (canal 2, c19 2, school 3, ...). */
export const FACADE_WINDOW_PITCH_M: Readonly<Record<FacadeStyle, number>> = { canal: 2.5, c19: 2.2, school: 1.6, postwar: 1.8, modern: 2.1, tower: 1.5 };

// --- the field table ---------------------------------------------------------------------------------------------
/** `rgb`: 3 bytes; `u16`: 2 bytes little-endian; `u8`: one byte; `bits`: `width` bits from `bit` inside one byte. */
export type FieldKind = 'rgb' | 'u16' | 'u8' | 'bits';
export interface FacadeField { name: string; kind: FieldKind; byte: number; bit?: number; width?: number }
const f = <N extends string, K extends FieldKind>(name: N, kind: K, byte: number, bit?: number, width?: number): FacadeField & { name: N; kind: K } => ({ name, kind, byte, ...(bit !== undefined ? { bit, width } : {}) });

/** Byte offsets inside the 64-byte record (row = byte >> 4). §1.2 of the design doc, with `style` in row 0 byte 7. */
export const FACADE_FIELDS = [
  // Row 0: pand
  f('wall', 'rgb', 0), f('wallMaterial', 'bits', 3, 0, 4), f('wallSrc', 'bits', 3, 4, 2), f('lifted', 'bits', 3, 6, 1),
  f('frame', 'rgb', 4), f('frameSrc', 'bits', 7, 0, 2), f('glassTone', 'bits', 7, 2, 3), f('style', 'bits', 7, 5, 3),
  f('wallHcm', 'u16', 8), f('plinthDm', 'u8', 10), f('seed', 'u8', 11),
  f('roof', 'rgb', 12), f('roofMaterial', 'bits', 15, 0, 4), f('roofSrc', 'bits', 15, 4, 2), f('lid', 'bits', 15, 6, 1),
  // Row 1: street front
  f('storeys', 'u8', 16), f('groundDm', 'u8', 17), f('upperDm', 'u8', 18), f('atticDm', 'u8', 19),
  f('baysGround', 'u8', 20), f('baysUpper', 'u8', 21), f('baysAttic', 'u8', 22), f('doorBay', 'u8', 23), f('windowKind', 'u8', 24),
  f('windowHead', 'bits', 25, 0, 3), f('archRing', 'bits', 25, 3, 2), f('keystone', 'bits', 25, 5, 1), f('tympanum', 'bits', 25, 6, 2),
  f('windowShare', 'u8', 26), f('windowHeightQ', 'u8', 27),
  f('cornice', 'bits', 28, 0, 3), f('corniceDepthDm', 'bits', 28, 3, 3), f('hoist', 'bits', 28, 6, 1), f('shutters', 'bits', 28, 7, 1),
  f('basement', 'bits', 29, 0, 2), f('souterrain', 'bits', 29, 2, 1), f('stoop', 'bits', 29, 3, 1), f('balconies', 'bits', 29, 4, 1),
  f('bayWindow', 'bits', 29, 5, 1), f('tallGround', 'bits', 29, 6, 1), f('dormers', 'bits', 29, 7, 1),
  f('statedMask', 'u8', 30), f('mirrored', 'bits', 31, 0, 1), f('shareQ', 'bits', 31, 1, 7),
  // Row 2: white-accent set
  f('accent', 'rgb', 32), f('bands', 'bits', 35, 0, 3), f('bandLines', 'bits', 35, 3, 3), f('sills', 'bits', 35, 6, 1), f('quoins', 'bits', 35, 7, 1),
  f('spekSpacing', 'u8', 36), f('spekCourses', 'u8', 37),
  f('surround', 'bits', 38, 0, 3), f('archRingColour', 'bits', 38, 3, 2), f('quoinsKind', 'bits', 38, 5, 2),
  f('bandSillCm', 'u8', 39), f('bandHeadCm', 'u8', 40), f('bandTransomAt', 'u8', 41), f('band', 'rgb', 42),
  f('bandsSrc', 'bits', 45, 0, 2), f('surroundSrc', 'bits', 45, 2, 2), f('keystoneSrc', 'bits', 45, 4, 2), f('quoinsSrc', 'bits', 45, 6, 2),
  f('windowRevealCm', 'u8', 46), f('doorRevealCm', 'u8', 47),
  // Row 3: ground band (F2 owns the semantics; F1 fills the generic defaults)
  f('groundKind', 'bits', 48, 0, 4), f('groundSrc', 'bits', 48, 4, 2), f('awning', 'bits', 48, 6, 1), f('stallriserOn', 'bits', 48, 7, 1),
  f('entrance', 'bits', 49, 0, 3), f('glazing', 'bits', 49, 3, 2), f('stallriser', 'bits', 49, 5, 2), f('fasciaOn', 'bits', 49, 7, 1),
  f('fascia', 'rgb', 50), f('shopPaint', 'rgb', 53), f('displayWindows', 'u8', 56), f('fasciaHeightDm', 'u8', 57), f('stallriserDm', 'u8', 58),
  f('shopStoreys2', 'bits', 59, 0, 1), f('souterrainUnderStoop', 'bits', 59, 1, 1), f('ribbonStorey1', 'bits', 59, 2, 1),
  f('door', 'rgb', 60),
] as const satisfies readonly FacadeField[];

type FieldName = (typeof FACADE_FIELDS)[number]['name'];
type RgbName = Extract<(typeof FACADE_FIELDS)[number], { kind: 'rgb' }>['name'];
/** The unpacked record: colours as [r, g, b] bytes, every other field its stored integer code. */
export type FacadeRecord = { [K in FieldName]: K extends RgbName ? [number, number, number] : number };

const FIELD_BY_NAME = new Map<string, FacadeField>(FACADE_FIELDS.map(x => [x.name, x]));
export const facadeField = (name: FieldName): FacadeField => FIELD_BY_NAME.get(name)!;

/** An all-zero record (every field at code 0; colours black). */
export function emptyFacadeRecord(): FacadeRecord {
  const r: Record<string, unknown> = {};
  for (const x of FACADE_FIELDS) r[x.name] = x.kind === 'rgb' ? [0, 0, 0] : 0;
  return r as FacadeRecord;
}

/** The 64 bytes of a record. Values are clamped to their field width (a stored code never spills into a neighbour). */
export function packFacadeRecord(rec: FacadeRecord, out: Uint8Array = new Uint8Array(FACADE_RECORD_BYTES), at = 0): Uint8Array {
  out.fill(0, at, at + FACADE_RECORD_BYTES);
  for (const x of FACADE_FIELDS) {
    const v = (rec as Record<string, unknown>)[x.name];
    const o = at + x.byte;
    if (x.kind === 'rgb') { const c = v as number[]; for (let i = 0; i < 3; i++) out[o + i] = clampInt(c[i], 0, 255); }
    else if (x.kind === 'u16') { const n = clampInt(v as number, 0, 65535); out[o] = n & 255; out[o + 1] = n >> 8; }
    else if (x.kind === 'u8') out[o] = clampInt(v as number, 0, 255);
    else { const w = x.width!, n = clampInt(v as number, 0, (1 << w) - 1); out[o] |= n << x.bit!; }
  }
  return out;
}

export function unpackFacadeRecord(bytes: Uint8Array, at = 0): FacadeRecord {
  const r: Record<string, unknown> = {};
  for (const x of FACADE_FIELDS) {
    const o = at + x.byte;
    r[x.name] = x.kind === 'rgb' ? [bytes[o], bytes[o + 1], bytes[o + 2]]
      : x.kind === 'u16' ? bytes[o] | (bytes[o + 1] << 8)
      : x.kind === 'u8' ? bytes[o]
      : (bytes[o] >> x.bit!) & ((1 << x.width!) - 1);
  }
  return r as FacadeRecord;
}

const clampInt = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(v) ? v : 0)));

// --- provenance ---------------------------------------------------------------------------------------------------
export type SrcClass = 0 | 1 | 2 | 3;
/** A spec source (houseSpec/spec.ts SpecSource) as the record's 2-bit provenance class; `conf` is the judge's p when known. */
export function srcClass(source: string | undefined, conf?: number): SrcClass {
  switch (source) {
    case 'streetlevel-measured': return 3;
    case 'vision-judge': return conf !== undefined && conf >= 0.8 ? 3 : 1;
    case 'monument-text': case 'author': case 'reviewed': return 2;
    case 'bag': case 'pdok-ortho': return 1;
    default: return 0; // default, osm, 3dbag, ahn, absent
  }
}

// --- inputs -------------------------------------------------------------------------------------------------------
/** One pand of the house-specs extract (`HouseSpecTileRecord` d/x/s), plus the judge's confidence per path when known. */
export interface FacadeSpecInput { d?: Record<string, unknown>; x?: Record<string, unknown>; s?: Record<string, string>; c?: Record<string, number> }
export interface SpecLookInput { pale?: boolean; dark?: boolean; arch?: boolean; tall?: boolean }

/** What the packer reads about a pand: the mesher's own building (post-chain colours, heights) and its resolved spec. */
/** The generic path's layout of a pand's street run (threeBuildingMesh layoutRun), the record's priors (S6b). */
export type FacadeGenericLayout = { storeys: number; groundM: number; storeyM: number; windows: number; doorWindow: number | null; variant: number; /** The bay look's window (photo look, bayLook.ts), when the pand draws one. */ bay?: GenericBayWindow };
/** The bay look's window, as the record says it (genericBayWindow). */
export type GenericBayWindow = { head: (typeof WINDOW_HEADS)[number]; surround: (typeof WINDOW_SURROUNDS)[number]; sills: boolean; kind: (typeof WINDOWS)[number] | null; dark: boolean; /** Window width over its pitch and height over its storey (facadeOpenings.ts bayVariantOpenings), when known. */ share?: number; height?: number };
/** The bay preset fields the record reads (bayTextures.ts BayVariant). */
export type BayWindowPreset = { archetype: string; shape: string; lintel?: string; sash?: string; paleAccents?: boolean; frameTone?: string; family?: string };
/**
 * The record's reading of a bay-look preset (bayTextures.ts windowAt): the head shape, a stone lintel and sill unless the
 * preset has none (punched and modern fronts never do), pale jamb blocks as a full stone frame, the sash's bars, dark frames.
 */
export function genericBayWindow(v: BayWindowPreset, upper?: { axes: readonly number[]; width: number; sill: number; head: number }): GenericBayWindow {
  const dressed = v.lintel !== 'none' && v.family !== 'punched' && v.archetype !== 'modern';
  // bayTextures.ts windowAt: 'transom' is one bar at 0.29 of the height over two lights, the Amsterdam T-window that the benchmark
  // photos label on 11 of round 1's 25 window-kind pairs; 'paired-transom' adds the mullion through the top-light (a cross).
  const kind = v.sash === 'transom' ? 't-window' : v.sash === 'paired-transom' ? 'cross-transom' : v.sash === 'plain' ? 'plain' : null;
  return { head: v.shape === 'segmental' ? 'segmental' : v.shape === 'arch' ? 'round' : 'flat', surround: !dressed ? 'none' : v.paleAccents ? 'full-frame' : 'stone-lintel', sills: dressed, kind, dark: v.frameTone === 'dark',
    ...(upper && upper.axes.length ? { share: Math.min(0.9, upper.width * upper.axes.length), height: Math.min(0.9, upper.head - upper.sill) } : {}) };
}
/** Window axes per generic cell (facadeCells.ts paintCell): the canal cell paints two sashes a bay, the others one. */
export const GENERIC_WINDOWS_PER_BAY: Partial<Record<FacadeStyle, number>> = { canal: 2 };
/**
 * The generic cell's window as a share of its window pitch and of its storey (facadeCells.ts paintCell: canal 1.1 x 2.05 m
 * on a 2.5 m axis and 3.1 m storey, c19 1.35 x 1.85 on 4.4 / 3.0, school 3.52 x 1.35 on 4.8 / 3.0), its head and stone.
 */
export const GENERIC_WINDOW_CELL: Partial<Record<FacadeStyle, { share: number; height: number; heads: readonly [string, string]; surround: readonly [string, string]; sills: boolean; band?: { hex: string; cm: number } }>> = {
  canal: { share: 0.44, height: 0.66, heads: ['flat', 'flat'], surround: ['stone-lintel', 'stone-lintel'], sills: true },
  c19: { share: 0.31, height: 0.62, heads: ['flat', 'segmental'], surround: ['stone-lintel', 'none'], sills: true, band: { hex: '#e2d9c2', cm: 16 } },
  school: { share: 0.73, height: 0.45, heads: ['flat', 'flat'], surround: ['none', 'none'], sills: false },
};

export interface FacadeRecordInput {
  id: string;
  /** S6b: the generic layout the legacy path draws for this pand; unstated record fields copy it. */
  generic?: FacadeGenericLayout;
  style: FacadeStyle;
  /** The wall colour after the whole chain (`facadeWallHex`): the colour the mesher tints the wall with. */
  wallHex: string;
  /** The H9 lift (houseSpec/wallColour.ts specWallDisplay) produced `wallHex`. */
  wallLifted?: boolean;
  /** palette/registerFinish wall material when the spec states none. */
  wallMaterial?: string;
  wallMaterialSrc?: SrcClass;
  /** The look's accent (`MeshBuilding.accentHex`): trim, frames of a pale look. */
  accentHex?: string;
  /** Shop paint (`MeshBuilding.groundHex`) and the shop flags. */
  groundHex?: string;
  shop?: boolean;
  roofHex?: string;
  roofMaterial?: string;
  lid?: boolean;
  /** Wall top and base above the ground (m): the building's height and min height. */
  heightM: number;
  minHeightM?: number;
  /** 3DBAG eaves (m above ground) when the tile carries it. */
  eavesM?: number;
  /** The window look the spec or the buurt profile states (SpecLook). */
  look?: SpecLookInput;
  /** The street-run length (m) of this front, when the caller knows it: the bay fit for a pand no source counts. */
  frontLengthM?: number;
  /** The front this record is for (fronts[i]); 0 by default. */
  front?: number;
  spec?: FacadeSpecInput;
}

/**
 * The record's wall colour: the mesher's wall tint, `MeshBuilding.wallHex` x the per-building tone jitter, so the
 * record follows whichever wall-colour chain is live (houseSpec/wallColour.ts -> wallHex -> brickLift when it lands:
 * every stage writes `wallHex` before the mesher reads it). One function, used by the packer and the parity test.
 */
export function facadeWallRGB(b: { id: string; wallHex: string }): [number, number, number] {
  const [r, g, bl] = hexRgb(b.wallHex) ?? [200, 190, 175];
  const jitter = 0.9 + hash01(`${b.id}:tone`) * 0.2;
  return [Math.min(255, r * jitter), Math.min(255, g * jitter), Math.min(255, bl * jitter)].map(Math.round) as [number, number, number];
}

const hexRgb = (v: unknown): [number, number, number] | null => {
  const s = typeof v === 'string' ? (/^#?[0-9a-f]{6}$/i.test(v) ? v : SWATCHES[v]) : undefined;
  if (!s) return null;
  const n = parseInt(s.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Window kind a style draws when no source states one (design doc §1.2 row 1 byte 8). */
export const STYLE_WINDOW: Readonly<Record<FacadeStyle, (typeof WINDOWS)[number]>> = { canal: 'sash-6-over-6', c19: 't-window', school: 'ladder', postwar: 'plain', modern: 'plain', tower: 'plain' };
const STYLE_CORNICE: Readonly<Record<FacadeStyle, (typeof CORNICES)[number]>> = { canal: 'simple', c19: 'simple', school: 'simple', postwar: 'none', modern: 'none', tower: 'none' };
/** Projection of each cornice kind (dm): `simple` is today's 0.26 m sloped strip. */
const CORNICE_DEPTH_DM: Readonly<Record<(typeof CORNICES)[number], number>> = { none: 0, simple: 3, bracketed: 4, heavy: 5, frieze: 4 };
const STALLRISER_DM: Readonly<Record<(typeof STALLRISERS)[number], number>> = { none: 0, low: 4, medium: 7, high: 10 };
export const FACADE_DEFAULTS = { windowShare: 0.58, windowHeight: 0.6, accent: '#f1ede2', door: '#35413d', bandSillCm: 14, bandHeadCm: 17, bandTransomAt: 0.78, spekSpacing: 7, spekCourses: 2, revealBrickCm: 11, revealStuccoCm: 4, doorRevealCm: 12, fasciaDm: 6, stallriserDm: 7 } as const;
/** Frame tones of the window looks (windowTable.ts windowOf): dark, painted white, the pale default. */
const FRAME_DARK = '#2c302f', FRAME_PALE = '#f1ede2';

const idx = <T extends readonly string[]>(list: T, v: unknown, fallback = 0): number => { const i = list.indexOf(v as T[number]); return i < 0 ? fallback : i; };
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };

/** The winning source of a field path, walking up to the nearest ancestor key (`fronts/0/x` -> `fronts/0` -> ``). */
function sourceOf(spec: FacadeSpecInput | undefined, path: string): { src: string | undefined; conf: number | undefined } {
  const s = spec?.s ?? {}, c = spec?.c ?? {};
  for (let p = path; ; p = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '') {
    if (p in s) return { src: s[p], conf: c[p] };
    if (p === '') return { src: undefined, conf: undefined };
  }
}

/**
 * The record of one front of a pand: every field from the resolved spec when a source states it, else the style
 * family's prior, each marked with its provenance class. Pure: the same input gives the same 64 bytes everywhere.
 */
export function facadeRecordFor(input: FacadeRecordInput): FacadeRecord {
  const r = emptyFacadeRecord();
  const fi = input.front ?? 0, d = (input.spec?.d ?? {}) as Record<string, any>, x = (input.spec?.x ?? {}) as Record<string, any>;
  const front = (Array.isArray(d.fronts) ? d.fronts[fi] : undefined) as Record<string, any> | undefined ?? {};
  const palette = (d.palette ?? {}) as Record<string, any>;
  const at = (k: string) => { const p = sourceOf(input.spec, `fronts/${fi}/${k}`); return front[k] !== undefined ? srcClass(p.src, p.conf) : 0; };
  const pal = (k: string) => { const p = sourceOf(input.spec, `palette/${k}`); return palette[k] !== undefined ? srcClass(p.src, p.conf) : 0; };
  const style = input.style, dims = STYLE_DIMS[style], seed = hash01(`${input.id}:facade`);
  const look = input.look ?? {};

  // Row 0: pand
  r.wall = facadeWallRGB(input);
  const material = palette.wallMaterial ?? input.wallMaterial;
  r.wallMaterial = idx(FACADE_WALL_MATERIALS, material);
  r.wallSrc = palette.wallMaterial !== undefined ? pal('wallMaterial') : input.wallMaterialSrc ?? 0;
  r.lifted = input.wallLifted ? 1 : 0;
  const frameHex = hexRgb(palette.frame);
  r.frame = frameHex ?? hexRgb(look.dark ? FRAME_DARK : look.pale ? FRAME_PALE : look.dark === undefined && input.generic?.bay?.dark ? FRAME_DARK : input.accentHex ?? FRAME_PALE)!;
  r.frameSrc = frameHex ? pal('frame') : 0;
  r.glassTone = palette.glassBlock ? 3 : look.dark ? 2 : 0;
  r.style = Math.max(0, FACADE_STYLES.indexOf(style));
  const base = input.minHeightM ?? 0;
  const statedEaves = num(front.eavesHeight), eavesSrc = at('eavesHeight');
  // §4.3 and the integrator's ruling 2: a measured eaves (Src 2-3) wins over 3DBAG's, which wins over the building top.
  const eaves = statedEaves !== undefined && eavesSrc >= 2 ? statedEaves : num(input.eavesM) ?? input.heightM;
  const wallH = Math.max(0.5, eaves - base);
  r.wallHcm = Math.round(wallH * 100);
  const plinth = front.plinth === 'full' ? 0.9 : front.plinth === 'low' ? 0.4 : front.souterrain || /windows/.test(String(front.basement ?? '')) ? 0.9 : 0;
  r.plinthDm = Math.round(plinth * 10);
  r.seed = Math.floor(seed * 256);
  r.roof = hexRgb(input.roofHex) ?? r.wall;
  const roofMat = (d.roof as Record<string, any> | undefined)?.material ?? input.roofMaterial;
  r.roofMaterial = idx(FACADE_ROOF_MATERIALS, roofMat ?? (input.lid ? 'flat-bitumen' : 'unknown'), FACADE_ROOF_MATERIALS.length - 1);
  { const p = sourceOf(input.spec, 'roof/material'); r.roofSrc = (d.roof as any)?.material !== undefined ? srcClass(p.src, p.conf) : 0; }
  r.lid = input.lid ? 1 : 0;

  // Row 1: street front. Storeys: stated, else the style's fit to the wall.
  const usable = Math.max(0.5, wallH - plinth);
  const heights = Array.isArray(front.storeyHeights) ? (front.storeyHeights as unknown[]).map(Number).filter(v => Number.isFinite(v) && v > 0) : [];
  let storeys = Number.isInteger(front.storeys) && front.storeys >= 1 ? front.storeys as number : 0;
  let ground: number, upper: number, attic = 0;
  if (heights.length >= 2 && (!storeys || heights.length === storeys)) {
    storeys = heights.length;
    const k = usable / heights.reduce((a, b) => a + b, 0);
    ground = heights[0] * k;
    const ups = heights.slice(1);
    const last = ups[ups.length - 1], mid = ups.length > 1 ? ups.slice(0, -1) : ups;
    upper = (mid.reduce((a, b) => a + b, 0) / mid.length) * k;
    if (ups.length > 1 && Math.abs(last - mid[mid.length - 1]) / mid[mid.length - 1] > 0.04) attic = last * k;
    if (!attic) upper = (usable - ground) / ups.length;
  } else if (input.generic && !storeys && !Array.isArray(front.storeyHeights)) {
    // S6b: unstated storeys copy the generic layout (its ground and storey pitch, scaled onto this wall).
    const g = input.generic;
    storeys = g.storeys + 1;
    const k = usable / Math.max(0.5, g.groundM + g.storeys * g.storeyM);
    ground = g.groundM * k; upper = g.storeys ? g.storeyM * k : 0;
    if (storeys === 1) ground = usable;
  } else {
    const groundStated = num(front.storeyHeights?.[0]);
    ground = Math.min(groundStated ?? dims.ground * (0.92 + hash01(`${input.id}:ground`) * 0.2), usable * (storeys === 1 ? 1 : 0.5));
    if (!storeys) storeys = usable <= ground + 0.5 ? 1 : 1 + Math.max(1, Math.round((usable - ground) / dims.storey));
    upper = storeys > 1 ? (usable - ground) / (storeys - 1) : 0;
    if (storeys === 1) ground = usable;
  }
  r.storeys = storeys;
  r.groundDm = Math.round(ground * 10);
  r.upperDm = Math.round(upper * 10);
  r.atticDm = Math.round(attic * 10);
  const baysList = Array.isArray(front.bays) ? (front.bays as unknown[]).map(Number) : null;
  const upperBays = Number.isInteger(front.axisGrid) ? front.axisGrid as number
    : baysList ? Math.max(0, ...(baysList.length > 1 ? baysList.slice(1) : baysList).filter(Number.isInteger))
    : Number.isInteger(front.bays) ? front.bays as number : 0;
  const pitch = FACADE_WINDOW_PITCH_M[style];
  r.baysUpper = upperBays > 0 ? upperBays : input.generic?.windows ? input.generic.windows : input.frontLengthM ? Math.max(1, Math.round(input.frontLengthM / pitch + (seed - 0.5) * 0.4)) : BAYS_FIT;
  const shopfront = front.shopfront as Record<string, any> | undefined;
  r.baysGround = baysList && baysList.length > 1 && Number.isInteger(baysList[0]) ? baysList[0] : r.baysUpper;
  r.baysAttic = Number.isInteger(front.atticWindows) ? front.atticWindows : 0;
  r.doorBay = front.doorBay === null ? DOOR_BAY_NONE : Number.isInteger(front.doorBay) ? front.doorBay : input.generic && upperBays <= 0 ? input.generic.doorWindow ?? DOOR_BAY_NONE : input.shop && r.baysUpper && r.baysUpper < 3 ? DOOR_BAY_NONE : DOOR_BAY_AUTO;
  r.windowKind = idx(WINDOWS, front.windows ?? input.generic?.bay?.kind ?? STYLE_WINDOW[style], WINDOWS.indexOf(STYLE_WINDOW[style]));
  const head = front.windowHead as Record<string, any> | undefined;
  const cell = GENERIC_WINDOW_CELL[style], variant = input.generic?.variant === 1 ? 1 : 0, bayW = input.generic?.bay;
  r.windowHead = idx(WINDOW_HEADS, head?.kind ?? (look.arch !== undefined ? (look.arch ? 'segmental' : 'flat') : bayW ? bayW.head : cell ? cell.heads[variant] : style === 'c19' ? 'segmental' : 'flat'));
  const ring = head?.archRing as Record<string, any> | undefined;
  r.archRing = idx(ARCH_RING_STYLES, ring?.style ?? (ring ? 'solid' : front.archRings && front.archRings !== 'none' ? 'solid' : 'none'));
  r.keystone = ring?.keystone || front.windowSurround === 'keystone' || front.windowSurround === 'eared-keystone' ? 1 : 0;
  r.tympanum = head?.tympanum ? 1 + idx(TYMPANUM_FILLS, head.tympanum) : 0;
  r.windowShare = Math.round((num(front.windowShare) ?? bayW?.share ?? cell?.share ?? FACADE_DEFAULTS.windowShare) * 255);
  const wh = front.windowHeights;
  const winH = Array.isArray(wh) ? median((wh as number[]).slice(wh.length > 1 ? 1 : 0).filter(v => Number.isFinite(v))) : wh === 'diminishing' ? DIMINISHING_WINDOW_HEIGHTS[1] : look.tall ? 0.7 : bayW?.height ?? cell?.height ?? FACADE_DEFAULTS.windowHeight;
  r.windowHeightQ = Math.round((Number.isFinite(winH) ? winH : FACADE_DEFAULTS.windowHeight) * 255);
  const cornice = (front.cornice ?? STYLE_CORNICE[style]) as (typeof CORNICES)[number];
  r.cornice = idx(CORNICES, cornice);
  r.corniceDepthDm = CORNICE_DEPTH_DM[cornice] ?? 0;
  r.hoist = front.hoist ? 1 : 0;
  r.shutters = front.shutters && front.shutters !== 'none' ? 1 : 0;
  r.basement = idx(BASEMENTS, front.basement ?? 'none');
  r.souterrain = front.souterrain ? 1 : 0;
  r.stoop = /stoop/.test(String(front.basement ?? '')) || front.stoop ? 1 : 0;
  r.balconies = front.balconies ? 1 : 0;
  r.bayWindow = front.bayWindows ? 1 : 0;
  r.tallGround = front.tallGround ? 1 : 0;
  r.dormers = num(front.dormers) ? 1 : 0;
  const stated = (k: string) => at(k) >= 2;
  r.statedMask = (stated('storeys') ? 1 : 0) | (stated('bays') || stated('axisGrid') ? 2 : 0) | (stated('windows') ? 4 : 0) | (stated('windowHead') ? 8 : 0)
    | (stated('doorBay') ? 16 : 0) | (stated('storeyHeights') || stated('windowHeights') ? 32 : 0) | (stated('cornice') ? 64 : 0)
    | (stated('shopfront') || stated('groundFront') ? 128 : 0);
  r.mirrored = 0;
  r.shareQ = Math.round((num(front.share) ?? 1) * 127);

  // Row 2: accents, drawn from Src 2-3; below that the style prior (none, or the look's pale trim) and the bit says so.
  const stone = hexRgb(palette.stone);
  r.accent = stone ?? hexRgb(input.accentHex) ?? hexRgb(FACADE_DEFAULTS.accent)!;
  const bandsSrc = at('bands'), bands = bandsSrc >= 2 ? front.bands : undefined;
  // S6b: unstated bands copy the procedural cell's (c19: a cream string course at every upper floor), marked prior; the bay looks paint none.
  const bandPrior = front.bands === undefined && !bayW && cell?.band ? cell.band : undefined;
  r.bands = idx(FACADE_BANDS, bands ?? (bandPrior ? 'storey' : 'none'));
  r.bandsSrc = bands ? bandsSrc : 0;
  const lines = Array.isArray(front.bandLines) ? front.bandLines as string[] : [];
  r.bandLines = lines.reduce((m, l) => m | (FACADE_BAND_LINES.indexOf(l as any) >= 0 ? 1 << FACADE_BAND_LINES.indexOf(l as any) : 0), 0);
  const surroundSrc = at('windowSurround'), surround = surroundSrc >= 2 ? front.windowSurround : undefined;
  r.sills = front.windowSills === 'consoles' || surround === 'sill' || (front.windowSurround === undefined && front.windowSills === undefined && (bayW ? bayW.sills : cell?.sills)) ? 1 : 0;
  const quoinsSrc = at('quoins'), quoins = quoinsSrc >= 2 ? front.quoins : undefined;
  r.quoins = quoins === 'stone' ? 1 : 0;
  r.quoinsKind = idx(QUOINS, quoins ?? 'none');
  r.quoinsSrc = quoins ? quoinsSrc : 0;
  const spek = front.speklagen as Record<string, any> | undefined;
  r.spekSpacing = spek ? num(spek.spacing) ?? FACADE_DEFAULTS.spekSpacing : bands === 'speklagen' ? FACADE_DEFAULTS.spekSpacing : 0;
  r.spekCourses = spek ? num(spek.courses) ?? FACADE_DEFAULTS.spekCourses : bands === 'speklagen' ? FACADE_DEFAULTS.spekCourses : 0;
  r.surround = idx(WINDOW_SURROUNDS, surround ?? (look.pale ? 'stone-lintel' : front.windowSurround === undefined && bayW ? bayW.surround : cell && front.windowSurround === undefined ? cell.surround[variant] : 'none'));
  r.surroundSrc = surround ? surroundSrc : look.pale ? 1 : 0;
  r.keystoneSrc = ring?.keystone ? at('windowHead') : surround === 'keystone' || surround === 'eared-keystone' ? surroundSrc : 0;
  r.archRingColour = idx(ARCH_RING_COLOURS, ring?.colour ?? (front.archRings === 'band' ? 'band' : 'stone'));
  const bh = front.bandHeights as Record<string, any> | undefined;
  r.bandSillCm = Math.round((num(bh?.sill) ?? (bandPrior ? bandPrior.cm / 100 : FACADE_DEFAULTS.bandSillCm / 100)) * 100);
  r.bandHeadCm = Math.round((num(bh?.head) ?? FACADE_DEFAULTS.bandHeadCm / 100) * 100);
  r.bandTransomAt = Math.round((num(front.bandTransomAt) ?? FACADE_DEFAULTS.bandTransomAt) * 255);
  const bandHex = hexRgb(palette.band);
  // Speklagen and storey bands are stone (the accent); Amsterdam School raised `courses` are the wall brick in shadow.
  r.band = bandHex ?? (bandPrior ? hexRgb(bandPrior.hex)! : null) ?? (bands === 'courses' ? r.wall.map(c => Math.round(c * 0.85)) as [number, number, number] : r.accent);
  const stucco = material === 'stucco';
  const reveal = front.doorReveal as Record<string, any> | undefined;
  r.windowRevealCm = stucco ? FACADE_DEFAULTS.revealStuccoCm : FACADE_DEFAULTS.revealBrickCm;
  r.doorRevealCm = reveal && num(reveal.deep) !== undefined ? Math.min(250, Math.round(reveal.deep * 100)) : FACADE_DEFAULTS.doorRevealCm;

  // Row 3: ground band. A stated shopfront, else the judge's pui, else the mesher's shop flag.
  const groundFront = front.groundFront as string | undefined;
  const pui = x.pui as string | undefined;
  const kind = shopfront ? 'shop' : groundFront === 'arcade' ? 'arcade' : groundFront === 'wall' ? 'wall' : groundFront === 'pui' ? 'pui-glazed'
    : pui === 'shop' ? 'shop' : pui === 'warehouse' ? 'warehouse' : pui === 'residential' ? 'residential' : input.shop ? 'shop' : 'residential';
  r.groundKind = idx(FACADE_GROUND_KINDS, kind);
  { const p = shopfront ? at('shopfront') : groundFront ? at('groundFront') : pui ? srcClass(sourceOf(input.spec, 'facts/pui').src) : 0; r.groundSrc = p; }
  r.awning = shopfront?.awning ? 1 : 0;
  const riser = (shopfront?.stallriser ?? (kind === 'shop' ? 'medium' : 'none')) as (typeof STALLRISERS)[number];
  r.stallriserOn = riser !== 'none' ? 1 : 0;
  r.entrance = idx(SHOP_ENTRANCES, shopfront?.entrance ?? (kind === 'shop' ? 'centre' : 'none'));
  r.glazing = idx(SHOP_GLAZING, shopfront?.glazing ?? 'single');
  r.stallriser = idx(STALLRISERS, riser);
  r.fasciaOn = shopfront ? (shopfront.fascia ? 1 : 0) : kind === 'shop' ? 1 : 0;
  const paint = hexRgb(shopfront?.colour) ?? hexRgb(input.groundHex) ?? r.wall;
  r.shopPaint = paint;
  r.fascia = hexRgb(shopfront?.fasciaColour) ?? paint;
  r.displayWindows = num(shopfront?.displayWindows) ?? r.baysGround;
  r.fasciaHeightDm = FACADE_DEFAULTS.fasciaDm;
  r.stallriserDm = STALLRISER_DM[riser] ?? FACADE_DEFAULTS.stallriserDm;
  r.shopStoreys2 = shopfront?.storeys === 2 ? 1 : 0;
  r.souterrainUnderStoop = front.souterrain && r.stoop ? 1 : 0;
  r.ribbonStorey1 = front.storeyRibbons && (front.storeyRibbons as Record<string, unknown>)['1'] ? 1 : 0;
  r.door = hexRgb(palette.door) ?? hexRgb(FACADE_DEFAULTS.door)!;
  return r;
}

/** Records for every street front of a pand: fronts[0] first (`rec = bid`), then each extra front (appended by the compiler). */
export function facadeRecordsFor(input: FacadeRecordInput): FacadeRecord[] {
  const fronts = Array.isArray((input.spec?.d as Record<string, unknown> | undefined)?.fronts) ? ((input.spec!.d as Record<string, unknown>).fronts as unknown[]).length : 1;
  return Array.from({ length: Math.max(1, Math.min(4, fronts)) }, (_, i) => facadeRecordFor({ ...input, front: i }));
}

/** The 64 bytes of one front: `packFacadeRecord(facadeRecordFor(input))`. */
export const packFacadeRecordFor = (input: FacadeRecordInput): Uint8Array => packFacadeRecord(facadeRecordFor(input));

// --- decoding helpers the shader twin and tests share ------------------------------------------------------------
/** Metres of the record's layout fields. */
export function facadeLayoutMetres(r: FacadeRecord): { wallH: number; plinth: number; ground: number; upper: number; attic: number; windowShare: number; windowHeight: number } {
  return { wallH: r.wallHcm / 100, plinth: r.plinthDm / 10, ground: r.groundDm / 10, upper: r.upperDm / 10, attic: r.atticDm / 10, windowShare: r.windowShare / 255, windowHeight: r.windowHeightQ / 255 };
}
