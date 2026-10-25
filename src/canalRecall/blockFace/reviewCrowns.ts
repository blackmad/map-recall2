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

/**
 * Reviewer type pins (`<buurt>-review-types.json`): the types a face may be placed with, with the reason. For a row the
 * facts and the photo's edges cannot settle: Molukkenstraat 35-53 and Gorontalostraat 25-45 share year, eaves and
 * width, and on the 2019 Molukkenstraat strip (shop fronts, trees) the white-attic type scored a higher edge NCC on four
 * houses that the photo shows are stair-pair fronts. A face without a pin keeps the whole library.
 */
export interface TypePin {
  face: string;
  types: string[];
  reason: string;
  /**
   * The pands (full BAG ids) of the face the pin restricts; absent = every pand of the face. For mixed rows whose
   * neighbours differ by a storey the facts cannot read (Eerste Helmersstraat 209-229: PDOK eaves read the mansard top,
   * the skyline is lost in the trees). A face may carry several pand pins, but one pand only one.
   */
  pands?: string[];
}

export function typePinProblems(pins: TypePin[], types: Pick<HouseTypeIntent, 'id'>[]): string[] {
  const p: string[] = [];
  pins.forEach((pin, k) => {
    const at = `type pin ${k}`;
    if (!pin.face) p.push(`${at}: face required`);
    if (!pin.reason) p.push(`${at}: reason required (what on the strip shows the type)`);
    if (!pin.types?.length) p.push(`${at}: at least one type`);
    for (const id of pin.types ?? []) if (!types.some(t => t.id === id)) p.push(`${at}: unknown type ${id}`);
    if (pin.pands !== undefined && (!Array.isArray(pin.pands) || !pin.pands.length || pin.pands.some(id => !/^\d{16}$/.test(id)))) p.push(`${at}: pands are 16-digit BAG pand ids`);
    const clash = pins.findIndex(x => x.face === pin.face && (!x.pands || !pin.pands || x.pands.some(id => pin.pands!.includes(id))));
    if (clash !== k) p.push(`${at}: face ${pin.face} pinned twice${pin.pands ? ' for one pand' : ''}`);
  });
  return p;
}

/** The library for one face: the pinned types (library order), or the whole library when the face has no pin. */
export function typesForFace<T extends Pick<HouseTypeIntent, 'id'>>(faceId: string, types: T[], pins: TypePin[]): T[] {
  const pin = pins.find(x => x.face === faceId && !x.pands);
  return pin ? types.filter(t => pin.types.includes(t.id)) : types;
}

/** The library for one pand of a face: a pand pin's types (library order), else the face's library. */
export function typesForPand<T extends Pick<HouseTypeIntent, 'id'>>(faceId: string, pandId: string, types: T[], pins: TypePin[]): T[] {
  const pin = pins.find(x => x.face === faceId && x.pands?.includes(pandId));
  return pin ? types.filter(t => pin.types.includes(t.id)) : typesForFace(faceId, types, pins);
}

/**
 * Reviewer mirror pins (`mirrors` in `<buurt>-review-types.json`): whether a placed pand is drawn mirrored, with the
 * reason. For mirrored-pair rows whose door reading the shop fronts defeat: Molukkenstraat 35-53's stair-light pairs
 * straddle every other party wall, but the strip read the shop door as the house door on five of ten fronts. A pinned
 * side counts as known, so --photo-decides does not flip it back.
 */
export interface MirrorPin {
  pandId: string;
  type: string;
  mirror: boolean;
  reason: string;
}

export function mirrorPinProblems(pins: MirrorPin[], types: Pick<HouseTypeIntent, 'id'>[]): string[] {
  const p: string[] = [];
  pins.forEach((pin, k) => {
    const at = `mirror pin ${k}`;
    if (!pin.pandId) p.push(`${at}: pandId required`);
    if (typeof pin.mirror !== 'boolean') p.push(`${at}: mirror must be true or false`);
    if (!pin.reason) p.push(`${at}: reason required (what on the strip shows the side)`);
    if (!types.some(t => t.id === pin.type)) p.push(`${at}: unknown type ${pin.type}`);
    if (pins.findIndex(x => x.pandId === pin.pandId) !== k) p.push(`${at}: pand ${pin.pandId} pinned twice`);
  });
  return p;
}

/** Apply mirror pins to placed pands of the pinned type (in place); returns the pands pinned. */
export function applyMirrorPins(decisions: Decision[], pins: MirrorPin[]): string[] {
  const changed: string[] = [];
  for (const d of decisions) {
    if (d.kind !== 'placed' || !d.house.type) continue;
    const pin = pins.find(x => x.pandId === d.pandId && x.type === d.typeId);
    if (!pin) continue;
    if (pin.mirror) d.house.type.mirror = true; else delete d.house.type.mirror;
    d.notes = [...d.notes.filter(n => !/^door /.test(n)), `door reviewer pin: ${pin.mirror ? 'mirrored' : 'as drawn'} (${pin.reason})`];
    changed.push(d.pandId);
  }
  return changed;
}
