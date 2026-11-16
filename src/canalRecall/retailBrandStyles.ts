// Round 7 (lane retail-real, David 2026-11-16 "FEBO still bad"): each top chain's shopfront as measured on 2–3 of its
// own fronts in the newest data.amsterdam.nl panoramas (opus readers, artifacts/retail-real/r7/reader-prompt.md), with
// a source URL per brand. `brandLook` turns a measurement into template-look fields the kit can draw (letters on the
// wall with no board, a blade with its glyph, dark plate glass); `?retailBrand=1` applies it (retailFront.ts).
import { BRAND_STYLES_GEN } from './retailBrandStyles.gen.js';
import type { TemplateLook } from './retailTemplates.js';
import { retailBrandAll } from './retailPages.js';

export type BrandStyle = {
  /** band: a full-width board; wall: letters straight on the wall; panel: a small sign board; lightbox: a lit box. */
  mount: 'band' | 'wall' | 'panel' | 'lightbox';
  fascia: string | null;
  letterStyle: 'channel' | 'neon' | 'flat' | 'printed';
  letters: string;
  logoMark: string | null;
  blade: { box: string; glyph: string; ink: string; shape: 'square' | 'round' | 'tall' } | null;
  window: 'goods' | 'plate' | 'lit';
  windowFrame: string | null;
  notes: string;
  conf: number;
  /** How many of the read crops show the chain's front. */
  seenIn: number;
  /** The crops' panoramas (pano id, date). */
  panoramas: ReadonlyArray<{ pano: string; date: string }>;
  /** The brand's reference page (Wikidata item or its Commons logo file) and when it was fetched. */
  source: { url: string; fetched: string };
};

export const BRAND_STYLES: Readonly<Record<string, BrandStyle>> = BRAND_STYLES_GEN as Record<string, BrandStyle>;

/**
 * The brands whose measured style won its blind (round 7, `data/retail-ground/ab/blinds-r6-r7.json`): FEBO 2 of 2
 * (red letters on the wall, the blade's F, dark plate glass), HEMA (letters on the wall). Kruidvat, Dirk and
 * McDonald's lost (measured colours read less true than today's), Starbucks and Vomar tied, the rest were not posed:
 * they keep today's look unless `?retailBrand=all`.
 */
export const ACCEPTED_BRANDS: readonly string[] = ['febo', 'hema'];

/** Whether a chain's measured style draws by default (an accepted brand), or under `?retailBrand=all`. */
export function brandAccepted(key: string, all: boolean = retailBrandAll()): boolean {
  return all || ACCEPTED_BRANDS.includes(key);
}

/** A measurement acts only when the readers saw the chain on two fronts or more, at this confidence. */
export const BRAND_MIN_CONF = 0.5;

const HEX = /^#[0-9a-f]{6}$/i;

/** The template-look fields a chain's measured style sets; undefined when it is too thinly measured to act on. */
export function brandLook(key: string, styles: Readonly<Record<string, BrandStyle>> = BRAND_STYLES): Partial<TemplateLook> | undefined {
  const s = styles[key];
  if (!s || s.seenIn < 2 || s.conf < BRAND_MIN_CONF) return undefined;
  const out: Partial<TemplateLook> = {};
  if (HEX.test(s.letters)) out.letters = s.letters;
  if (s.mount === 'wall') out.mount = 'wall';
  else if (s.fascia && HEX.test(s.fascia)) out.fascia = s.fascia;
  if (s.blade && HEX.test(s.blade.box)) {
    out.blade = s.blade.box;
    // The blade's glyph: one letter the lettering cell carries (FEBO's F, McDonald's M); a mark or a word stays a plain box.
    if (/^[A-Z]$/.test(s.blade.glyph)) { out.bladeGlyph = s.blade.glyph; if (HEX.test(s.blade.ink)) out.bladeInk = s.blade.ink; }
  }
  if (s.window === 'plate') out.window = 'plate';
  if (s.windowFrame && HEX.test(s.windowFrame)) out.frame = s.windowFrame;
  return out;
}
