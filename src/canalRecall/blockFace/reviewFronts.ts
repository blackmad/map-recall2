/**
 * Reviewer front pins for auto-placement (Dapperbuurt / Oosterparkbuurt strip verdict, 2026-11-10).
 *
 * A reviewer who has looked at a strip sheet pins, per pand and type, what the type cannot know: the street door's side
 * and arch, a shopfront's measured colours, a flat top-storey head. A pin carries
 *   `ground`    house-own ground fields, written as seen (never mirrored): `doorBay`, `doorArch`, `doorReveal`, `shopfront`.
 *               Over an auto-placed shop's ground the `shopfront` is merged field by field (the measured fascia colour, name
 *               and residential door stay unless the pin names them); over anything else the pin is the ground;
 *   `overrides` body fields for this pand (`null` removes a type field), as the placement's `overrides`.
 * A pin for a pand placed with another type is left alone. Pure; mirrors reviewPalettes.ts.
 */
import type {Decision} from './autoPlace.ts';
import {CROWN_KEYS, GROUND_KEYS} from './houseType.ts';

export interface FrontPin {
  pandId: string;
  type: string;
  ground?: Record<string, unknown>;
  overrides?: Record<string, unknown>;
  /** What on the strip shows it. */
  reason: string;
}

export function frontPinProblems(pins: FrontPin[], types: {id: string}[]): string[] {
  const p: string[] = [];
  pins.forEach((pin, k) => {
    const at = `front pin ${k}`;
    if (!/^\d{16}$/.test(pin.pandId ?? '')) p.push(`${at}: pandId must be a 16-digit BAG pand id`);
    if (!pin.reason) p.push(`${at}: reason required (what on the strip shows it)`);
    if (!types.some(t => t.id === pin.type)) p.push(`${at}: unknown type ${pin.type}`);
    if (!pin.ground && !pin.overrides) p.push(`${at}: ground or overrides required`);
    for (const key of Object.keys(pin.ground ?? {})) if (!(GROUND_KEYS as readonly string[]).includes(key)) p.push(`${at}: ground.${key} is not a ground field (${GROUND_KEYS.join(', ')})`);
    for (const key of Object.keys(pin.overrides ?? {})) if ((GROUND_KEYS as readonly string[]).includes(key) || (CROWN_KEYS as readonly string[]).includes(key)) p.push(`${at}: overrides.${key} is a ground/crown field`);
    if (pins.findIndex(x => x.pandId === pin.pandId) !== k) p.push(`${at}: pand ${pin.pandId} pinned twice`);
  });
  return p;
}

/** Apply the pins to one face's decisions (in place); returns the pands changed. Run after the door and palette pins. */
export function applyFrontPins(decisions: Decision[], pins: FrontPin[]): string[] {
  const changed: string[] = [];
  for (const d of decisions) {
    if (d.kind !== 'placed' || !d.house.type) continue;
    const pin = pins.find(x => x.pandId === d.pandId && x.type === d.typeId);
    if (!pin) continue;
    const t = d.house.type;
    if (pin.ground) {
      const base = t.ground && typeof t.ground === 'object' ? t.ground as Record<string, unknown> : {};
      const was = base.shopfront as {residentialDoor?: object} | undefined, now = pin.ground.shopfront as {residentialDoor?: object} | undefined;
      const shop = {...was, ...now, ...(was?.residentialDoor || now?.residentialDoor ? {residentialDoor: {...was?.residentialDoor, ...now?.residentialDoor}} : {})};
      t.ground = {...base, ...pin.ground, ...(pin.ground.shopfront !== undefined ? {shopfront: shop} : {})} as typeof t.ground;
    }
    if (pin.overrides) t.overrides = {...t.overrides, ...pin.overrides} as typeof t.overrides;
    d.notes = [...d.notes, `front pinned: ${pin.reason}`];
    changed.push(d.pandId);
  }
  return changed;
}
