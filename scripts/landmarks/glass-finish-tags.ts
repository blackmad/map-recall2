/**
 * Reflective glass per landmark and palette name (lane glass-reflect-20261116, prototype behind `?glassReflect=1`).
 *
 * `build-manual-landmarks.ts` writes `glassFinish: 'reflective'` into the material's glTF extras; nothing else changes,
 * so a model without an entry here exports byte-identical, and with the flag off a tagged model draws exactly as its
 * slot tag says (look/cityLook.ts `slotForMaterial`). With the flag on, a tagged material draws as glass reflecting the
 * game's sky (look/glassReflect.ts), whatever its fallback slot.
 *
 * Tag only glass whose photos show the sky or the street mirrored in it: coated curtain walls, not punched windows.
 */
import {GLASS_FINISH_EXTRA, type GlassFinish} from '../../src/canalRecall/look/glassReflect';

export type GlassFinishTag = {readonly finish: GlassFinish; readonly why: string};

export const GLASS_FINISH_TAGS: Readonly<Record<string, Readonly<Record<string, GlassFinishTag>>>> = {
  'room-mate-aitana': {
    glass: {finish: 'reflective', why: 'pale coated curtain wall mirroring the sky (w01-183 #687d9c); flat glass read as opaque cladding in the blind review, so its slot tag falls back to a pale panel'},
  },
  'ing-house': {
    glass: {finish: 'reflective', why: 'the ING House ("the shoe", 2002): a fully glazed reflective double skin on legs that mirrors the sky and the A10'},
  },
};

export const glassFinishTagFor = (id: string, materialName: string): GlassFinishTag | undefined => GLASS_FINISH_TAGS[id]?.[materialName];

/** The extras with the finish added; without a tag the same object comes back (the export is unchanged). */
export function glassFinishExtras<B extends Record<string, unknown>>(base: B, tag: GlassFinishTag | undefined): B | (B & {glassFinish: GlassFinish}) {
  return tag ? {...base, [GLASS_FINISH_EXTRA]: tag.finish} as B & {glassFinish: GlassFinish} : base;
}
