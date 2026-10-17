/**
 * Reviewer door pins for auto-placement (buurt generator; Spaarndammerbuurt 2026-10-17).
 *
 * A type drawn with its door on one side (`match.mirrorForDoor`) is mirrored when the strip reads the door on the other
 * side. Where the door detector reads nothing (Polanenstraat 240: the door behind a hedge) the pand stays as drawn
 * unless a same-type neighbour pairs it. A reviewer who has looked at the strip pins the door side per pand, with the
 * reason, in `scripts/block-face/buurten/<buurt>-review-doors.json`. A pin for a type without `mirrorForDoor` is
 * reported, never applied. A pinned pand is no longer "door unread", so pairing leaves it alone. Pure.
 */
import type {Decision} from './autoPlace.ts';

export interface DoorPin {
  pandId: string;
  /** The type the pin is for: a pand placed with another type is left alone. */
  type: string;
  /** The door's side on the strip, as seen. */
  side: 'left' | 'right';
  /** What on the strip shows it. */
  reason: string;
}

interface DoorType { id: string; match?: {mirrorForDoor?: 'left' | 'right'} }

/** Problems with a pins file. */
export function doorPinProblems(pins: DoorPin[], types: DoorType[]): string[] {
  const p: string[] = [];
  pins.forEach((pin, k) => {
    const at = `door pin ${k}`;
    if (!/^\d{16}$/.test(pin.pandId ?? '')) p.push(`${at}: pandId must be a 16-digit BAG pand id`);
    if (pin.side !== 'left' && pin.side !== 'right') p.push(`${at}: side must be "left" or "right"`);
    if (!pin.reason) p.push(`${at}: reason required (what on the strip shows the door)`);
    const t = types.find(x => x.id === pin.type);
    if (!t) p.push(`${at}: unknown type ${pin.type}`);
    else if (!t.match?.mirrorForDoor) p.push(`${at}: type ${pin.type} has no match.mirrorForDoor (it is not mirrored for its door)`);
  });
  return p;
}

/** Apply the pins to one face's decisions (in place); returns the pands changed. Run before `fillPairs`. */
export function applyDoorPins(decisions: Decision[], pins: DoorPin[], types: DoorType[]): string[] {
  const changed: string[] = [];
  for (const d of decisions) {
    if (d.kind !== 'placed' || !d.house.type) continue;
    const pin = pins.find(x => x.pandId === d.pandId && x.type === d.typeId), drawn = types.find(x => x.id === d.typeId)?.match?.mirrorForDoor;
    if (!pin || !drawn) continue;
    if (pin.side !== drawn) d.house.type.mirror = true; else delete d.house.type.mirror;
    d.notes = [...d.notes.filter(n => !/^door /.test(n)), `door ${pin.side}${d.house.type.mirror ? ': mirrored' : ''}: reviewer pin (${pin.reason})`];
    changed.push(d.pandId);
  }
  return changed;
}
