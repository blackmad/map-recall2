/**
 * Dark walls on the model path (lane WC follow-up, flag `?modelWallFloor=1`, MODEL_WALL_FLOOR=1, default off).
 *
 * The same spec wall colour draws lighter on a per-house model than on the generic path when it is dark. The model's brick
 * slot (no `tintSource: measured`) goes through cityLook.ts cityLookTint: L' = 0.12 + 0.9 L clamped to the city brick
 * range 0.3-0.6 (HSL), the grey branch likewise. The generic path draws the same hex through houseSpec/wallColour.ts
 * specWallDisplay (no lift below OKLab 0.30, a 0.34 floor). Over the 267 live ordinary models with a brick slot
 * (scripts/look/model-wall-table.ts): spec OKLab L < 0.35, generic tint 0.350 vs model 0.412; 0.35-0.42, 0.422 vs 0.464;
 * 0.42-0.5 and pale walls match. On BA's held-24 frames 173483 (#312d2c) drew pixel L 0.295 generic, 0.441 model.
 *
 * The fix: a brick or accent slot that is not measured draws no lighter than the generic path would draw the same hex
 * (its OKLab L capped at specWallDisplay's, hue and chroma of the city tint kept). A wall the generic path draws as light
 * or lighter is untouched, so mid and pale walls are byte-identical; off, every tint is.
 */
import { hexToOklab, oklabToHex, specWallDisplay, specWallSource } from '../houseSpec/wallColour.ts';

export const MODEL_WALL_FLOOR_DEFAULT_ON = false;
export function modelWallFloorEnabled(search?: string | null, env?: string | null): boolean {
  const v = (search ? /[?&]modelWallFloor=([01])\b/.exec(search)?.[1] : undefined) ?? env ?? undefined;
  return v === '1' ? true : v === '0' ? false : MODEL_WALL_FLOOR_DEFAULT_ON;
}
let cached: boolean | undefined;
export function modelWallFloorOn(): boolean {
  if (cached !== undefined) return cached;
  const g = globalThis as { location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  return (cached = modelWallFloorEnabled(g.location?.search ?? null, g.process?.env?.MODEL_WALL_FLOOR ?? null));
}
export const resetModelWallFloor = () => { cached = undefined; };

/** The city tint of an unmeasured brick slot, no lighter than the generic path's drawn colour for the same authored hex. */
export function modelWallTint(cityTintHex: string, authoredHex: string): string {
  // The generic route's decoration of the same brick hex (decorate.ts specWallColour: the trim-misread family rule, then the lift).
  const src = specWallSource(authoredHex, { brick: true });
  const generic = hexToOklab(specWallDisplay(src.hex, { fromPixel: src.fromPixel }))[0], [L, a, b] = hexToOklab(cityTintHex);
  if (L <= generic + 1e-4) return cityTintHex;
  return oklabToHex([generic, a * generic / L, b * generic / L]);
}
