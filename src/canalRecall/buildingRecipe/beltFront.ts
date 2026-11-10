/**
 * Canal-belt front details (Grachtengordel-Zuid, Keizersgracht 608-616A, strip 2023-03-27; docs/reports/gg-zuid-strip-verdict-20261110.md):
 *  - `windowFrames`: the thick white-painted window frames of the belt (`frame` m, inside the opening, instead of the
 *    0.07 m default) and, on the top `eared.upper` storeys, an eared surround: a flat painted band round the jambs and
 *    head with "ears" where the head runs past the jambs and drops down them (the Lodewijk XIV/XV window dressing);
 *  - `basementDoor`: a street-level entrance in the stone base (souterrain) on bay `basementDoor`, under an all-window
 *    bel-etage (616A, 614: no stoop door), in place of that bay's basement light;
 *    Its cream surround is the door frame drawn 0.14 m wide;
 *  - `doorSurround`: a painted door surround on the main door: two pilasters `pilaster` m wide either side of the door
 *    and its fanlight, carrying a `cap` m entablature slab (610, 608);
 *  - `stoopRails`: iron rails `rail` m high on both sides of the stoop flight.
 * All of them are opt-in; a front without them is byte-identical.
 *
 * Measured at 40 px/m on the Keizersgracht 596-648 strip: frames 0.10-0.14 m; eared surrounds on the top two storeys
 * of 616A, the band 0.12 m, ears 0.12 m past the jambs and 0.2 m down them; 616A's base door 1.1 m wide, 0.15-2.85 m
 * over the street in the left bay; 610's door surround pilasters 0.22 m, cap 0.3 m; stoop rails about 0.9 m.
 */
import type {CanalhouseDressing, CanalhouseOpening} from '../canalhouseRecipes.ts';

export interface WindowFramesIntent {
  /** Frame width (m) of every storey window (0.04..0.18). */
  frame: number;
  /** An eared surround on the top `upper` storeys: `band` m (default 0.12), ears `ear` m past the jambs (0.12) and `drop` m down them (0.2). */
  eared?: {upper: number; band?: number; ear?: number; drop?: number};
}
export interface DoorSurroundIntent { pilaster: number; cap: number }

export const BELT_FRONT = {
  minFrameM: 0.04, maxFrameM: 0.18, bandM: 0.12, earM: 0.12, dropM: 0.2, depthM: 0.05, maxBandM: 0.3,
  baseDoorW: [0.9, 1.3] as const, baseDoorBottomM: 0.15, baseDoorFrameM: 0.14, baseDoorHeadroomM: 0.3, maxBaseDoorM: 2.8,
  pilasterDepthM: 0.1, capDepthM: 0.12, jointM: 0.03, minRailM: 0.6, maxRailM: 1.3, railWidthM: 0.04,
} as const;

type FrontLike = {windowFrames?: unknown; basementDoor?: unknown; doorSurround?: unknown; stoopRails?: unknown; atticWindowWidth?: unknown;
  storeys: number; bays: number | number[]; doorBay: number | null; basement: string; souterrain?: boolean; gable?: string};

const num = (v: unknown, lo: number, hi: number) => typeof v === 'number' && v >= lo && v <= hi;

export function beltFrontProblems(f: FrontLike, at: string): string[] {
  const p: string[] = [];
  if (f.windowFrames !== undefined) {
    const w = f.windowFrames as Record<string, unknown>;
    if (!w || typeof w !== 'object' || Array.isArray(w) || Object.keys(w).some(k => !['frame', 'eared'].includes(k))) p.push(`${at}.windowFrames: {frame, eared?}`);
    else {
      if (!num(w.frame, BELT_FRONT.minFrameM, BELT_FRONT.maxFrameM)) p.push(`${at}.windowFrames.frame: ${BELT_FRONT.minFrameM}..${BELT_FRONT.maxFrameM} m`);
      const e = w.eared as Record<string, unknown> | undefined;
      if (e !== undefined) {
        if (!e || typeof e !== 'object' || Object.keys(e).some(k => !['upper', 'band', 'ear', 'drop'].includes(k))) p.push(`${at}.windowFrames.eared: {upper, band?, ear?, drop?}`);
        else {
          if (!(Number.isInteger(e.upper) && (e.upper as number) >= 1 && (e.upper as number) <= f.storeys)) p.push(`${at}.windowFrames.eared.upper: an integer 1..${f.storeys} (storeys from the top)`);
          for (const k of ['band', 'ear', 'drop'] as const) if (e[k] !== undefined && !num(e[k], 0.04, BELT_FRONT.maxBandM)) p.push(`${at}.windowFrames.eared.${k}: 0.04..${BELT_FRONT.maxBandM} m`);
        }
      }
    }
  }
  if (f.basementDoor !== undefined) {
    const n = Array.isArray(f.bays) ? f.bays[0] : f.bays;
    if (!(Number.isInteger(f.basementDoor) && (f.basementDoor as number) >= 0 && (f.basementDoor as number) < n)) p.push(`${at}.basementDoor: a ground bay 0..${n - 1}`);
    if (f.basement !== 'windows' || f.souterrain !== true) p.push(`${at}.basementDoor: needs a souterrain with basement "windows" (no stoop)`);
    if (f.doorBay !== null) p.push(`${at}.basementDoor: the bel-etage has no door (doorBay null)`);
  }
  if (f.doorSurround !== undefined) {
    const d = f.doorSurround as Record<string, unknown>;
    if (!d || typeof d !== 'object' || Object.keys(d).some(k => !['pilaster', 'cap'].includes(k)) || !num(d.pilaster, 0.08, 0.5) || !num(d.cap, 0.1, 0.8)) p.push(`${at}.doorSurround: {pilaster 0.08..0.5, cap 0.1..0.8} m`);
    if (f.doorBay === null && f.basementDoor === undefined) p.push(`${at}.doorSurround: needs a door (doorBay or basementDoor)`);
  }
  if (f.stoopRails !== undefined) {
    const r = f.stoopRails as Record<string, unknown>;
    if (!r || typeof r !== 'object' || Object.keys(r).some(k => k !== 'rail') || !num(r.rail, BELT_FRONT.minRailM, BELT_FRONT.maxRailM)) p.push(`${at}.stoopRails: {rail ${BELT_FRONT.minRailM}..${BELT_FRONT.maxRailM}} m`);
    if (f.basement !== 'stoop' && f.basement !== 'stoop-and-windows') p.push(`${at}.stoopRails: needs a stoop`);
  }
  if (f.atticWindowWidth !== undefined && !num(f.atticWindowWidth, 0.4, 2.2)) p.push(`${at}.atticWindowWidth: 0.4..2.2 m`);
  return p;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** The 0-based storeys (ground = 0) whose windows carry the eared surround: the top `upper` of `storeys`. */
export function earedStoreys(w: WindowFramesIntent, storeys: number): number[] {
  return w.eared ? Array.from({length: Math.min(w.eared.upper, storeys)}, (_, k) => storeys - 1 - k).reverse() : [];
}

/** Eared surround of one window (facade x): two jamb bands, a head band running `ear` past them, an ear dropping on each end. */
export function earedFrame(o: Pick<CanalhouseOpening, 'leftM' | 'bottomM' | 'widthM' | 'heightM'>, id: string, width: number, e: NonNullable<WindowFramesIntent['eared']>): Extract<CanalhouseDressing, {kind: 'slab'}>[] {
  const band = e.band ?? BELT_FRONT.bandM, ear = e.ear ?? BELT_FRONT.earM, drop = e.drop ?? BELT_FRONT.dropM, d = BELT_FRONT.depthM;
  const top = o.bottomM + o.heightM, l = o.leftM - band, r = o.leftM + o.widthM + band;
  const clip = (x0: number, x1: number) => [Math.max(0.01, x0), Math.min(width - 0.01, x1)] as const;
  const out: Extract<CanalhouseDressing, {kind: 'slab'}>[] = [];
  const slab = (sid: string, x0: number, x1: number, y0: number, y1: number) => {
    const [a, b] = clip(x0, x1);
    if (b - a > 0.02 && y1 - y0 > 0.02) out.push({id: `${sid}-${id}`, kind: 'slab', leftM: r3(a), bottomM: r3(y0), widthM: r3(b - a), heightM: r3(y1 - y0), depthM: d, surface: 'trim'});
  };
  slab('eared-head', l - ear, r + ear, top, top + band);
  slab('eared-jamb-l', l, o.leftM, o.bottomM, top);
  slab('eared-jamb-r', o.leftM + o.widthM, r, o.bottomM, top);
  slab('eared-ear-l', l - ear, l, Math.max(o.bottomM, top - drop), top);
  slab('eared-ear-r', r, r + ear, Math.max(o.bottomM, top - drop), top);
  return out;
}

/** The street-level door in the base (`basementDoor`) on the bay centred at `centre`, `pitch` wide, in a base `base` m tall. */
export function basementDoorOpening(centre: number, pitch: number, base: number): CanalhouseOpening {
  const [lo, hi] = BELT_FRONT.baseDoorW, w = r3(Math.min(hi, Math.max(lo, pitch * 0.55)));
  const h = r3(Math.min(BELT_FRONT.maxBaseDoorM, base - BELT_FRONT.baseDoorHeadroomM - BELT_FRONT.baseDoorBottomM));
  // The cream surround is the door frame drawn wide (inside the opening): a dressing on the stone base is coplanar with it (glb audit zfight).
  return {id: 'basement-door', kind: 'door', leftM: r3(centre - w / 2), bottomM: BELT_FRONT.baseDoorBottomM, widthM: w, heightM: h, trimWidthM: BELT_FRONT.baseDoorFrameM, verticalBars: [], paneSurface: 'door', frameSurface: 'trim', barSurface: 'trim'};
}

/** Pilasters and a cap round the door (and its fanlight): facade x, painted (`trim`). */
export function doorSurroundSlabs(door: Pick<CanalhouseOpening, 'leftM' | 'bottomM' | 'widthM' | 'heightM'>, headM: number, width: number, s: DoorSurroundIntent): Extract<CanalhouseDressing, {kind: 'slab'}>[] {
  // A gap of BELT_FRONT.jointM beside the door frame: flush, the pilaster's side and the frame's outer side are coplanar (glb audit zfight).
  const g = BELT_FRONT.jointM, l = Math.max(0.01, door.leftM - g - s.pilaster), r = Math.min(width - 0.01, door.leftM + door.widthM + g + s.pilaster), out: Extract<CanalhouseDressing, {kind: 'slab'}>[] = [];
  if (door.leftM - g - l > 0.04) out.push({id: 'door-pilaster-l', kind: 'slab', leftM: r3(l), bottomM: r3(door.bottomM), widthM: r3(door.leftM - g - l), heightM: r3(headM - door.bottomM), depthM: BELT_FRONT.pilasterDepthM, surface: 'trim'});
  if (r - door.leftM - door.widthM - g > 0.04) out.push({id: 'door-pilaster-r', kind: 'slab', leftM: r3(door.leftM + door.widthM + g), bottomM: r3(door.bottomM), widthM: r3(r - door.leftM - door.widthM - g), heightM: r3(headM - door.bottomM), depthM: BELT_FRONT.pilasterDepthM, surface: 'trim'});
  const cl = Math.max(0.01, l - 0.06), cr = Math.min(width - 0.01, r + 0.06);
  out.push({id: 'door-cap', kind: 'slab', leftM: r3(cl), bottomM: r3(headM), widthM: r3(cr - cl), heightM: r3(s.cap), depthM: BELT_FRONT.capDepthM, surface: 'trim'});
  return out;
}
