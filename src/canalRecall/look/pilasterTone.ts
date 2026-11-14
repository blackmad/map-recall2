/**
 * `pilasterTone` (lane white-bars-20261114): an unstated corner pilaster takes the house's own wall colour.
 *
 * Why. David, 2026-11-14, Haarlemmerdijk 29 (0363100012167795) beside 31 (167794): "how do we fix the white bars on this
 * building (and presumably others?)". The bars are `corner-pilasters` (facadeOrnaments.ts): a dice ornament (canal 0.22,
 * c19 0.3) that stands a 0.42 m box at BOTH ends of every street front, from the first floor to the cornice, painted WHITE
 * (r < 0.6) or STONE. Nothing about the house asks for it: in the centre (lng 4.872-4.922, lat 52.357-52.386) 1,564 generic
 * houses draw it, every one from the dice (0 register-stated, 0 spec-stated), 1,496 of them on a wall darker than HSL
 * L 0.6, where a pale full-height strip at the party line reads as a gap or a white side wall. On a terrace each house's
 * end is a party line, so two neighbours rolling it draw a double bar.
 *
 * The fix keeps the geometry (same boxes, same triangles, so every other extra's budget and every other building is
 * byte-identical) and paints a dice pilaster in the wall's own colour, a touch darker (`PILASTER_SHADE`, the stepped
 * parapet's brick), as a brick lisene reads. A pilaster with evidence stays pale: the monument register's `pilasters`
 * (`registerForce`), a HouseSpec's stated part (`statedFirst`), or a street recipe that states pale accents.
 *
 * Pure, no DOM. `?pilasterTone=0` in the page, PILASTER_TONE=0 in Node: the old white/stone dice pilasters. Read once.
 */

export const PILASTER_SHADE = 0.9;
export const PILASTER_TONE_DEFAULT_ON = true;

export function pilasterToneEnabled(search?: string | null, env?: string | null): boolean {
  const q = search ? /[?&]pilasterTone=(\w+)/.exec(search)?.[1] : undefined, v = q ?? env;
  return v === '0' || v === 'off' || v === 'false' ? false : v === '1' || v === 'on' || v === 'true' ? true : PILASTER_TONE_DEFAULT_ON;
}
let cached: boolean | undefined;
/** The flag as the runtime sees it: the page's query in a browser (the mesh worker gets it via withWorkerFlags), PILASTER_TONE in Node. */
export function pilasterToneOn(): boolean {
  if (cached !== undefined) return cached;
  const g = globalThis as { location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  return (cached = pilasterToneEnabled(g.location?.search ?? null, g.process?.env?.PILASTER_TONE ?? null));
}
/** Tests only: forget the cached flag. */
export const resetPilasterToneFlag = () => { cached = undefined; };

/** What says a corner pilaster is there and pale (the wall context's fields; facadeExtraCore.ts ExtraContext). */
export interface PilasterEvidence {
  registerForce?: readonly string[];
  statedFirst?: readonly string[];
  recipe?: { paleAccents?: boolean } | null;
}
export const PILASTER_ID = 'corner-pilasters';
export function pilasterStated(c: PilasterEvidence): boolean {
  return !!(c.registerForce?.includes(PILASTER_ID) || c.statedFirst?.includes(PILASTER_ID) || c.recipe?.paleAccents === true);
}

/** `#rrggbb` scaled towards black by k (facadeOrnaments.ts shadeHex for k <= 1). */
function darker(hex: string, k: number): string {
  const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  if (!/^#[0-9a-fA-F]{6}$/.test(hex) || v.some(n => !Number.isFinite(n))) return hex;
  return '#' + v.map(n => Math.max(0, Math.min(255, Math.round(n * k))).toString(16).padStart(2, '0')).join('');
}

/**
 * The pilaster's colour: `pale` (the dice's WHITE or STONE) when the flag is off or the pilaster has evidence, else the
 * wall's own colour shaded by `PILASTER_SHADE`.
 */
export function pilasterHex(c: PilasterEvidence & { wallHex: string }, pale: string, on: boolean = pilasterToneOn()): string {
  if (!on || pilasterStated(c) || !c.wallHex) return pale;
  return darker(c.wallHex, PILASTER_SHADE);
}
