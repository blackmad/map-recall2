/**
 * The buurt panel's catalogue (coverage-v1/contents.json): what a block-face type library,
 * block face, building-type design, placed model or landmark kit is, with links and thumbnails.
 * Pure; scripts/coverage/contents.ts does the IO and verifies every link and thumbnail on disk.
 */

/** A link from coverage.html to another page of the app, relative to public/canal-drive/ (or an absolute repo URL). */
export type Link = { label: string; href: string };
export type Thumb = { src: string; label: string };
export type Swatch = { name: string; colors: [role: string, color: string][] };

export type TypeItem = {
  district: string;
  description: string;
  /** BAG build years of the evidence pands, [min, max]; null when none is known. */
  era: [number, number] | null;
  swatches: Swatch[];
  kitKeys: string[];
  /** Evidence pands (16-digit BAG id), the buurt each lies in, and a shipped photo crop when one exists. */
  exemplars: { pand: string; buurt: string | null; face?: string; thumb?: Thumb }[];
  faces: string[];
};
export type FaceStatus = 'installed' | 'held' | 'staged' | 'authored' | 'discovery';
export type FaceItem = {
  street: string; title: string;
  status: FaceStatus;
  note: string; pands: number; chunk?: string;
  links: Link[]; thumbs: Thumb[];
};
export type DesignItem = { family: string; label: string; variant: string; storeys: number | null; roof: string; instances: number; links: Link[]; preview?: string };
export type ModelItem = { name: string; tier: string; links: Link[]; thumb?: Thumb };
export type KitItem = { hand: boolean; links: Link[] };
export type SurveyItem = { links: Link[] };
export type ContentItems = {
  types: Record<string, TypeItem>;
  faces: Record<string, FaceItem>;
  designs: Record<string, DesignItem>;
  models: Record<string, ModelItem>;
  kits: Record<string, KitItem>;
  surveys: Record<string, SurveyItem>;
};

/** Body keys that are measurements, not kit components. */
const MEASURES = new Set([
  'storeys', 'bays', 'bayWidths', 'storeyHeights', 'windowHeights', 'headLines', 'windowShare', 'bandLines', 'bandHeights',
  'bandTransomAt', 'axisGrid', 'storeyBayWidths', 'bandStoreys', 'bandPiers', 'courseStoreys',
]);
const word = (v: unknown): string | null => typeof v === 'string' && v.length <= 40 ? v : null;

type TypeLike = { body?: Record<string, unknown>; crowns?: Record<string, Record<string, unknown> | undefined>; grounds?: Record<string, unknown>; roof?: Record<string, unknown> };

/**
 * The kit components a house type uses, as `key` or `key:value`: body enums (windows, cornice, windowHead, ...),
 * object components by their style (`balconies:slab-hood`) or presence (`lisenes`), crown gables and cornices,
 * ground variants and the roof material. Sorted, deduplicated.
 */
export function typeKitKeys(type: TypeLike): string[] {
  const keys = new Set<string>();
  for (const [k, v] of Object.entries(type.body ?? {})) {
    if (MEASURES.has(k) || v === false || v === null || v === undefined) continue;
    const w = word(v);
    if (w) { if (w !== 'none') keys.add(`${k}:${w}`); continue; }
    const obj = v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null;
    const style = obj ? word(obj.style ?? obj.kind) : null;
    keys.add(style ? `${k}:${style}` : k);
  }
  for (const crown of Object.values(type.crowns ?? {})) {
    if (!crown) continue;
    const g = word(crown.gable), c = word(crown.cornice);
    if (g) keys.add(`gable:${g}`);
    if (c && c !== 'none') keys.add(`cornice:${c}`);
    if (crown.tower) keys.add('tower');
    if (crown.dormer || crown.dormers) keys.add('dormer');
  }
  for (const g of Object.keys(type.grounds ?? {})) keys.add(`ground:${g}`);
  const roof = word(type.roof?.material);
  if (roof) keys.add(`roof:${roof}`);
  return [...keys].sort();
}

const COLOR = /^(#[0-9a-f]{3}(?:[0-9a-f]{3})?|black|white)$/i;
/** Measured palettes as swatches: each palette's colour-valued roles, in file order. */
export function paletteSwatches(palettes: Record<string, Record<string, unknown> | undefined> | undefined): Swatch[] {
  return Object.entries(palettes ?? {}).map(([name, roles]) => ({
    name,
    colors: Object.entries(roles ?? {}).filter(([, v]) => typeof v === 'string' && COLOR.test(v)).map(([r, v]) => [r, String(v).toLowerCase()] as [string, string]),
  })).filter(s => s.colors.length);
}

/** `nw-portiek-brick-pitched__brick-cream__5__gable__long__solid` → family, variant, storeys, roof. */
export function parseDesignUnit(unit: string): { family: string; variant: string; storeys: number | null; roof: string } {
  const [family = unit, variant = '', storeys = '', roof = ''] = unit.split('__');
  return { family, variant, storeys: /^\d+$/.test(storeys) ? Number(storeys) : null, roof };
}

/** First clause of a building-type label: `Nieuw-West type 1: four-storey ... (14.4 x 10.5 m ...)` → `four-storey ...`. */
export function shortLabel(label: string): string {
  const afterColon = label.includes(': ') ? label.slice(label.indexOf(': ') + 2) : label;
  const cut = afterColon.replace(/\s*\([^)]*\)\s*$/, '');
  return cut.length > 140 ? `${cut.slice(0, 137).trimEnd()}…` : cut;
}

/** Year range of a list of BAG years (implausible values ignored). */
export function eraOf(years: readonly (number | undefined)[]): [number, number] | null {
  const ok = years.filter((y): y is number => !!y && y > 1000 && y < 2100);
  return ok.length ? [Math.min(...ok), Math.max(...ok)] : null;
}
