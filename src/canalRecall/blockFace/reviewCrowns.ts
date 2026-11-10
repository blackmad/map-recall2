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
import type {BodyOverrides, HouseTypeIntent} from './houseType.ts';

export interface CrownPin {
  /** A face id (the whole face before run splitting) or a BAG pand id; exactly one. */
  face?: string;
  pandId?: string;
  /** The type the pin is for: a pand placed with another type is left alone. */
  type: string;
  crown: string;
  /**
   * For a pair crown (`crowns.<name>.pair`: one crown straddling the party wall, Transvaalstraat 42-44): which half of
   * the pair this pand is. A pand pin only. The left half is drawn as the type, the right half mirrored, and the side
   * counts as known (--photo-decides does not flip it). Required with a pair crown, invalid without one.
   */
  pair?: 'left' | 'right';
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
    else if (!!(t.crowns[pin.crown] as {pair?: boolean}).pair !== (pin.pair !== undefined)) p.push(`${at}: ${pin.pair ? `crown ${pin.crown} is not a pair crown` : `crown ${pin.crown} straddles a party wall: give pair left or right`}`);
    if (pin.pair !== undefined && (!['left', 'right'].includes(pin.pair) || !pin.pandId)) p.push(`${at}: pair is left or right, on a pand pin`);
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
    // A pair crown: the half and its side are the pin's (the right half is the mirror of the left).
    if (pin.pair && (t.crowns[pin.crown] as {pair?: boolean}).pair) {
      d.house.type.pair = pin.pair;
      if (pin.pair === 'right') d.house.type.mirror = true; else delete d.house.type.mirror;
      d.notes = [...d.notes.filter(n => !/^door /.test(n)), `door reviewer pin: ${pin.pair} half of a pair crown, ${pin.pair === 'right' ? 'mirrored' : 'as drawn'}`];
    }
    changed.push(d.pandId);
  }
  return changed;
}

/**
 * A pair crown is drawn half on each pand: a half whose partner (the next pand for the left half, the previous for the
 * right) is not its placed other half is held, as the crown cannot be drawn on one pand (in place; returns the pands held).
 */
export function holdBrokenPairs(decisions: Decision[]): string[] {
  const held: string[] = [];
  const half = (d: Decision | undefined) => d?.kind === 'placed' ? d.house.type?.pair : undefined;
  decisions.forEach((d, k) => {
    const side = half(d);
    if (!side || d.kind !== 'placed') return;
    const mate = decisions[side === 'left' ? k + 1 : k - 1];
    if (half(mate) === (side === 'left' ? 'right' : 'left') && mate?.kind === 'placed' && mate.typeId === d.typeId) return;
    decisions[k] = {kind: 'held', pandId: d.pandId, address: d.house.address, stage: 'run', reason: `the ${side} half of a pair crown (${d.house.type!.crown}) without its other half placed beside it`};
    held.push(d.pandId);
  });
  return held;
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
  /**
   * `true` on a pand pin of ONE type: the reviewer read this pand's design off the strip, so the type is placed even when
   * its score (eaves pitch, skyline, columns) is under the threshold; its vetoes (year, frontage, material) still hold.
   * The canal belt's one-off fronts (Keizersgracht 242-258, 2021-01-22): canal trees defeat the skyline and a gable
   * house's 3DBAG eaves reads inside the gable, so the scored criteria hold every gable house the strip shows plainly.
   * Absent = the scored decision, unchanged.
   */
  accept?: true;
  /** Full storeys incl. ground the reviewer counted on the strip (a pand pin; replaces the count from the 3DBAG eaves). */
  storeys?: number;
  /**
   * `true` on a pand pin: the strip shows a house ground (door and windows), so the type's ground is drawn even where BAG
   * or OSM lists a trading use (Keizersgracht 256: `bijeenkomstfunctie` behind a residential canal-house ground).
   */
  houseGround?: true;
  /**
   * A pand pin: the type's ground variant the strip shows (a key of the type's `grounds`), drawn as named. Herengracht
   * 96 (2021-01-25 strip): the house door at street level, where the type's first ground is a souterrain and stoop.
   * Not with a trading use (the auto shopfront) unless `houseGround`. Absent = the auto-placed ground, unchanged.
   */
  ground?: string;
  /** A pand pin: the 0-based bay (as seen, after mirroring) holding the house door (Herengracht 96: the third of four). */
  doorBay?: number;
  /**
   * A pand pin: body fields this pand changes over its type (`HousePlacement.overrides`), measured on the strip.
   * Herengracht 96: a 1.4 m entablature where the type's (measured on 92-94) is 2.3 m. Validated with the house intent
   * at compile. Absent = the type's body, unchanged.
   */
  overrides?: BodyOverrides;
}

/** The pin of one pand (a pand pin), if any. */
export function pandTypePin(faceId: string, pandId: string, pins: TypePin[]): TypePin | undefined {
  return pins.find(x => x.face === faceId && x.pands?.includes(pandId));
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
    if (pin.accept !== undefined && (pin.accept !== true || !pin.pands || pin.types?.length !== 1)) p.push(`${at}: accept: true needs pands and exactly one type`);
    if (pin.houseGround !== undefined && (pin.houseGround !== true || !pin.pands)) p.push(`${at}: houseGround: true on a pand pin`);
    if (pin.storeys !== undefined && (!Number.isInteger(pin.storeys) || pin.storeys < 1 || pin.storeys > 8 || !pin.pands)) p.push(`${at}: storeys: an integer 1..8 on a pand pin`);
    if (pin.ground !== undefined && (typeof pin.ground !== 'string' || !pin.pands || pin.types?.length !== 1)) p.push(`${at}: ground: a ground name on a pand pin of one type`);
    else if (pin.ground !== undefined) { const t = types.find(x => x.id === pin.types![0]) as {grounds?: Record<string, unknown>} | undefined; if (t && !(t.grounds && pin.ground in t.grounds)) p.push(`${at}: ground ${pin.ground}: not a ground of ${pin.types![0]}`); }
    if (pin.overrides !== undefined && (!pin.overrides || typeof pin.overrides !== 'object' || Array.isArray(pin.overrides) || !Object.keys(pin.overrides).length || !pin.pands || pin.types?.length !== 1)) p.push(`${at}: overrides: body fields on a pand pin of one type`);
    if (pin.doorBay !== undefined && (!Number.isInteger(pin.doorBay) || pin.doorBay < 0 || pin.doorBay > 12 || !pin.pands)) p.push(`${at}: doorBay: a 0-based bay on a pand pin`);
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
