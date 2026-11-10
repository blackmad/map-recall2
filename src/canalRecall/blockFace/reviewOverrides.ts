/**
 * Reviewer override pins for auto-placement (Grachtengordel-Zuid, 2026-11-10;
 * docs/reports/gg-zuid-strip-verdict-20261110.md): what a strip review measured on one pand that the type's defaults
 * do not say, written into the placement the house intent already supports:
 *  - `overrides`: body fields such as storeyWindows (Keizersgracht 616A's six-over-six upper sashes) or headLines
 *    (610's heads 0.6 m higher);
 *  - `ground`: a named ground variant of the type (616A and 614: the street-level door in the base, no stoop);
 *  - `roof`: the house's roof over the type's (616A, 614, 610: `form: "flat"`, sky directly over the frieze cornice where
 *    the type's recipe roof drew red tile; 3DBAG stands under the cornice at the facade, so a roof pin cannot re-pitch it).
 * Pins live in `scripts/block-face/buurten/<buurt>-review-overrides.json` as `{"pins": [{pandId, type, overrides?, ground?, reason}]}`.
 * Only a pand placed with the pinned type changes. The house intent validation checks the values. No pins = byte-identical. Pure.
 */
import type {Decision} from './autoPlace.ts';
import type {BodyOverrides, HousePlacement} from './houseType.ts';

export interface OverridePin {
  pandId: string;
  type: string;
  overrides?: BodyOverrides;
  ground?: string;
  roof?: HousePlacement['roof'];
  reason: string;
}

export function overridePinProblems(pins: OverridePin[], types: {id: string; grounds?: Record<string, unknown>}[]): string[] {
  const p: string[] = [];
  pins.forEach((pin, k) => {
    const at = `override pin ${k}`;
    if (!/^\d{16}$/.test(pin.pandId ?? '')) p.push(`${at}: pandId must be a 16-digit BAG pand id`);
    const t = types.find(x => x.id === pin.type);
    if (!t) p.push(`${at}: type ${pin.type} is not in the library`);
    if (pin.overrides === undefined && pin.ground === undefined && pin.roof === undefined) p.push(`${at}: one of overrides, ground, roof`);
    if (pin.roof !== undefined && (!pin.roof || typeof pin.roof !== 'object' || Array.isArray(pin.roof) || !Object.keys(pin.roof).length)) p.push(`${at}: roof must be a non-empty object of placement roof fields`);
    if (pin.overrides !== undefined && (!pin.overrides || typeof pin.overrides !== 'object' || Array.isArray(pin.overrides) || !Object.keys(pin.overrides).length)) p.push(`${at}: overrides must be a non-empty object of body fields`);
    if (pin.ground !== undefined && t && !(t.grounds && pin.ground in t.grounds)) p.push(`${at}: ground ${pin.ground} is not a ground variant of ${pin.type}`);
    if (!pin.reason) p.push(`${at}: reason required (what on the strip shows it)`);
    if (pins.findIndex(x => x.pandId === pin.pandId && x.type === pin.type) !== k) p.push(`${at}: pand ${pin.pandId} pinned twice for ${pin.type}`);
  });
  return p;
}

/** Applies the pins to the placed decisions; returns the pand ids changed. */
export function applyOverridePins(decisions: Decision[], pins: OverridePin[]): string[] {
  const changed: string[] = [];
  for (const d of decisions) {
    if (d.kind !== 'placed' || !d.house.type) continue;
    const pin = pins.find(x => x.pandId === d.pandId && x.type === d.typeId);
    if (!pin) continue;
    if (pin.overrides) d.house.type.overrides = {...d.house.type.overrides, ...pin.overrides};
    if (pin.ground) d.house.type.ground = pin.ground;
    if (pin.roof) d.house.type.roof = {...d.house.type.roof, ...pin.roof};
    d.notes = [...d.notes, `overrides pinned: ${pin.reason}`];
    changed.push(d.pandId);
  }
  return changed;
}
