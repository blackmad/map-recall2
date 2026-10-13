/**
 * Material slot inference for landmark GLBs (docs/plans/digital-twin-direction-20261013.md
 * §2 "Look", §7 GLB cleanup goal 2).
 *
 * The shared atlas (look/cityLook.ts) dresses any material that carries a
 * `materialSlot` + `tint` extra. Recipe GLBs and building types write them;
 * the ~310 hand-built landmark GLBs do not (0 of 310 on 2026-10-13), so a
 * landmark wall and the generic extrusion beside it never sampled the same
 * brick under the same sun.
 *
 * The landmark builders name materials after a small palette (`brick`,
 * `stone`, `slate`, `glass`, `white`, `dark`, `frame`, `gold`, …; see the
 * survey in the lane report), so the name almost always says what the surface
 * is. This module turns a material's name and base colour into a slot and a
 * tint, and says how sure it is:
 *
 *  - `name`: the name is a material word (brick, slate, glass, …);
 *  - `colour-word`: the name is a colour word (`white`, `dark`, `red`) whose
 *    material is a judgement call (white stucco or white trim? red brick or
 *    red tile?) — listed as ambiguous in the dry-run report;
 *  - `colour`: no usable name, classified from the colour alone — ambiguous.
 *
 * Pure (no three.js, no I/O): shared by the one-time GLB script
 * (`scripts/landmarks/infer-material-slots.ts`), the builder default in
 * `scripts/landmarks/build-manual-landmarks.ts` and the runtime fallback
 * under `?cityLook=1` (so the shared look does not wait for the GLB rewrite).
 */
import { hexToRgb, rgbToHsl, MATERIAL_SLOTS, type MaterialSlot } from './palette.ts';

export type SlotConfidence = 'name' | 'colour-word' | 'colour';

export type SlotInference = {
  slot: MaterialSlot;
  /** Authored colour (#rrggbb, sRGB) the slot is tinted with; cityTint maps it into the city range at runtime. */
  tint: string;
  confidence: SlotConfidence;
  /** Why: the rule that fired (for the dry-run report). */
  rule: string;
};

/** Marks extras that were inferred (script or builder default), not authored by a recipe pipeline. */
export const INFERRED_SLOT_SOURCE = 'inferred';

type Rule = { test: RegExp; slot: MaterialSlot | ((hex: string) => MaterialSlot); confidence: SlotConfidence; rule: string };

const isGrey = (hex: string) => rgbToHsl(hexToRgb(hex))[1] < 0.2;
/** Brick-coloured: a red/orange/brown hue with some saturation, not too pale. */
const isBrickHue = (hex: string) => {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  return (h < 45 || h > 340) && s >= 0.15 && l < 0.7;
};
const roofFromColour = (hex: string): MaterialSlot => (isGrey(hex) ? 'slate' : 'roofTile');
const wallFromColour = (hex: string): MaterialSlot => (isBrickHue(hex) ? 'brick' : 'stucco');

// Order matters: the first match wins. `glassrail` is glass, `greyframe` a frame, `greybrick` brick.
const RULES: Rule[] = [
  { test: /glass|glaz|window|vitr|ruit|pane/, slot: 'glass', confidence: 'name', rule: 'glazing name' },
  { test: /decal|sign|mural|logo|letter|clock|dial/, slot: 'paint', confidence: 'name', rule: 'signage / decal' },
  { test: /door|deur|gate/, slot: 'door', confidence: 'name', rule: 'door name' },
  { test: /frame|kozijn|louvre|louver|blind|shutter|rail|mullion|sash/, slot: 'frame', confidence: 'name', rule: 'joinery name' },
  { test: /brick|baksteen|klinker|terracotta/, slot: 'brick', confidence: 'name', rule: 'brick name' },
  { test: /slate|leien|lei$/, slot: 'slate', confidence: 'name', rule: 'slate name' },
  { test: /bitumen|asphalt|tar$|felt|flatroof|flat-roof|gravel/, slot: 'bitumen', confidence: 'name', rule: 'flat roof name' },
  { test: /roof|tile|pantile|dakpan|dak/, slot: roofFromColour, confidence: 'name', rule: 'roof name, grey → slate, else pantile' },
  { test: /sandstone|stone|steen|column|marble|granite|limestone|plinth/, slot: 'stone', confidence: 'name', rule: 'stone name' },
  { test: /stucco|render|plaster|pleister|concrete|beton|slab/, slot: 'stucco', confidence: 'name', rule: 'render / concrete name' },
  { test: /gold|gilt|bronze|copper|brass|zinc|metal|steel|iron|lead|alu/, slot: 'paint', confidence: 'name', rule: 'metal name (flat colour)' },
  { test: /wall|facade|gevel/, slot: wallFromColour, confidence: 'name', rule: 'wall name, brick hue → brick, else stucco' },
  { test: /ochre|yellow|buff/, slot: wallFromColour, confidence: 'colour-word', rule: 'ochre: yellow brick (brick hue) or render' },
  { test: /pink|rose/, slot: 'stucco', confidence: 'colour-word', rule: 'pink: painted render' },
  { test: /moss|grass|green|blue|orange|purple|paint|teal/, slot: 'paint', confidence: 'colour-word', rule: 'coloured paint word' },
  { test: /white|cream|ivory/, slot: 'stucco', confidence: 'colour-word', rule: 'white: stucco (could be white trim)' },
  { test: /dark|black|charcoal|anthracite/, slot: 'frame', confidence: 'colour-word', rule: 'dark: painted joinery / ironwork (could be a dark wall)' },
  { test: /red/, slot: wallFromColour, confidence: 'colour-word', rule: 'red: brick hue → brick (could be red tile or paint)' },
  { test: /grey|gray/, slot: 'stucco', confidence: 'colour-word', rule: 'grey: render (could be concrete or zinc)' },
];

/** Normalise a material name: lower case, decal colour codes and trailing numbering removed. */
export function materialWord(name: string | undefined | null): string {
  return String(name ?? '').toLowerCase().replace(/[-_.\s]*\d+$/, '').trim();
}

/** Classify by colour alone (no usable name). */
export function slotFromColour(hex: string): { slot: MaterialSlot; rule: string } {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  if (l < 0.22) return { slot: 'frame', rule: 'very dark: joinery / ironwork' };
  if (s >= 0.15 && (h < 45 || h > 340) && l < 0.62) return { slot: 'brick', rule: 'brick hue' };
  if (s < 0.2 && l >= 0.6) return { slot: 'stucco', rule: 'pale neutral: render' };
  if (s < 0.2 && l >= 0.22 && h > 180 && h < 260) return { slot: 'slate', rule: 'blue-grey: slate' };
  if (s < 0.25) return { slot: 'stone', rule: 'neutral mid-tone: stone' };
  return { slot: 'paint', rule: 'saturated colour: paint' };
}

/** A material's slot and tint from its name and sRGB base colour. */
export function inferMaterialSlot(name: string | undefined | null, hex: string): SlotInference {
  const tint = hex.toLowerCase();
  const word = materialWord(name);
  for (const r of RULES) {
    if (!r.test.test(word)) continue;
    return { slot: typeof r.slot === 'function' ? r.slot(tint) : r.slot, tint, confidence: r.confidence, rule: r.rule };
  }
  const c = slotFromColour(tint);
  return { slot: c.slot, tint, confidence: 'colour', rule: `no material word in "${word || 'unnamed'}"; ${c.rule}` };
}

/** glTF extras for a builder-default or inferred slot (recipe pipelines write `{materialSlot, tint}` without a source). */
export function inferredSlotExtras(name: string | undefined | null, hex: string): { materialSlot: MaterialSlot; tint: string; materialSlotSource: string } {
  const { slot, tint } = inferMaterialSlot(name, hex);
  return { materialSlot: slot, tint, materialSlotSource: INFERRED_SLOT_SOURCE };
}

/** Linear 0..1 RGB (glTF baseColorFactor, three.js Color) → sRGB #rrggbb. */
export function linearToSrgbHex(r: number, g: number, b: number): string {
  const enc = (c: number) => {
    const v = Math.max(0, Math.min(1, c));
    const s = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return Math.round(s * 255).toString(16).padStart(2, '0');
  };
  return '#' + enc(r) + enc(g) + enc(b);
}

/** The material is named for white (the `white` colour-word rule): white render or white trim, never grained stucco. */
export const isWhiteWord = (name: string | undefined | null): boolean => /white|cream|ivory/.test(materialWord(name));

/** Whether a value is a slot the look understands. */
export const isMaterialSlot = (v: unknown): v is MaterialSlot => typeof v === 'string' && (MATERIAL_SLOTS as readonly string[]).includes(v);
