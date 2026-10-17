/**
 * Reviewer crown pins for auto-placement (buurt generator; Indische Buurt 2026-10-17).
 *
 * The strip skyline (stripSkyline.ts) reads a crown's rise and width over the eaves, so it tells a gable from a dormer
 * from nothing. It cannot tell two flat crowns apart: Niasstraat 3-13's deep eaves overhang and Molukkenstraat 7-29's
 * plain parapet both read "no crown over the eaves". A reviewer who has looked at the strip pins the crown variant per
 * face (every placed pand of the type) or per pand, with the reason, in `scripts/block-face/buurten/<buurt>-review-crowns.json`.
 * A pin naming a crown the placed type does not have is reported, never applied. Pure.
 */
import type {Decision} from './autoPlace.ts';
import type {HouseTypeIntent} from './houseType.ts';

export interface CrownPin {
  /** A face id (the whole face before run splitting) or a BAG pand id; exactly one. */
  face?: string;
  pandId?: string;
  /** The type the pin is for: a pand placed with another type is left alone. */
  type: string;
  crown: string;
  /** What on the strip shows it. */
  reason: string;
}

/** Problems with a pins file. */
export function crownPinProblems(pins: CrownPin[], types: Pick<HouseTypeIntent, 'id' | 'crowns'>[]): string[] {
  const p: string[] = [];
  pins.forEach((pin, k) => {
    const at = `crown pin ${k}`;
    if (!!pin.face === !!pin.pandId) p.push(`${at}: give exactly one of face or pandId`);
    if (!pin.reason) p.push(`${at}: reason required (what on the strip shows the crown)`);
    const t = types.find(x => x.id === pin.type);
    if (!t) p.push(`${at}: unknown type ${pin.type}`);
    else if (!t.crowns[pin.crown]) p.push(`${at}: type ${pin.type} has no crown "${pin.crown}" (has ${Object.keys(t.crowns).join(', ')})`);
  });
  return p;
}

/**
 * Apply the pins to one face's decisions (in place). A pand pin wins over a face pin. Returns the pands changed; the
 * note on each placement names the pin's reason. A pin equal to the type's first crown removes `crown` from the
 * placement (the default), so pinned and unpinned placements of the default stay byte-identical.
 */
export function applyCrownPins(faceId: string, decisions: Decision[], pins: CrownPin[], types: Pick<HouseTypeIntent, 'id' | 'crowns'>[]): string[] {
  const changed: string[] = [];
  for (const d of decisions) {
    if (d.kind !== 'placed' || !d.house.type) continue;
    const pin = pins.find(x => x.pandId === d.pandId && x.type === d.typeId) ?? pins.find(x => x.face === faceId && x.type === d.typeId);
    const t = types.find(x => x.id === d.typeId);
    if (!pin || !t?.crowns[pin.crown]) continue;
    const first = Object.keys(t.crowns)[0];
    if (pin.crown === first) delete d.house.type.crown; else d.house.type.crown = pin.crown;
    d.notes = [...d.notes.filter(n => !/^crown /.test(n)), `crown ${pin.crown}: reviewer pin (${pin.reason})`];
    changed.push(d.pandId);
  }
  return changed;
}
