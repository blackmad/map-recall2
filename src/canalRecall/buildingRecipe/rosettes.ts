/**
 * Wall rosettes (roundels): a round stucco medallion in place of a window on a blind axis (lane H7 round 2, #354).
 *
 * Why: the Nassaukade face of the corner pand 0363100012116526 (Nassaukade 151-152 / De Clercqstraat) has a blind second
 * axis carrying a cream wreath roundel on each of its three upper storeys (2019-01-09 and 2021-03-24 panoramas); the kit
 * drew windows there. `front.rosettes` names the axes and storeys: their windows are taken out and each becomes a
 * medallion centred where the window's centre was: a stone ring (two half annuli) with the wall showing through its field,
 * and a stone boss, extruded ornaments 0.09 m proud that overlap nothing (round 3: stacked discs 2 cm apart failed the glb
 * audit's zfight-tight). Absent = no change, byte-identical.
 */
import type {CanalhouseOpening, CanalhouseOrnament, CanalhousePoint} from '../canalhouseRecipes.ts';

export interface RosetteIntent {
  /** Bay axes (viewer's left = 0) of the blind axis. */
  bays: number[];
  /** Storeys (1 = first floor) carrying a rosette instead of the window. */
  storeys: number[];
  /** Outer diameter, m (ROSETTE.diameter range; default ROSETTE.defaultDiameterM, clamped to the window's width + 0.2). */
  diameter?: number;
}

export const ROSETTE = {defaultDiameterM: 0.9, diameter: [0.4, 1.6] as const, fieldShare: 0.68, bossShare: 0.28, segments: 24,
  /** Ring and boss stand this far off the wall and overlap nothing (a disc a few cm in front of another z-fights at distance:
   *  glb audit zfight-tight), so the wall shows through the ring between them. */
  depthM: {ring: 0.09, boss: 0.09}} as const;

export interface RosetteDisc { id: string; cx: number; cy: number; d: number }

const WINDOW_ID = /^s(\d+)-b(\d+)[ab]?$/;

/** Take the rosettes' windows out of a front's openings (module metres); each window becomes one disc at its centre. */
export function rosettesInPlaceOfWindows(openings: readonly CanalhouseOpening[], rosettes: readonly RosetteIntent[]): {openings: CanalhouseOpening[]; discs: RosetteDisc[]; missing: string[]} {
  const want = new Map<string, number | undefined>();
  for (const r of rosettes) for (const b of r.bays) for (const s of r.storeys) want.set(`${s}-${b}`, r.diameter);
  const keep: CanalhouseOpening[] = [], hits = new Map<string, CanalhouseOpening[]>();
  for (const o of openings) {
    const m = o.kind === 'window' ? WINDOW_ID.exec(o.id) : null, key = m ? `${m[1]}-${m[2]}` : '';
    if (m && want.has(key)) hits.set(key, [...(hits.get(key) ?? []), o]); else keep.push(o);
  }
  const discs: RosetteDisc[] = [], missing: string[] = [];
  for (const [key, d] of want) {
    const os = hits.get(key);
    if (!os?.length) { missing.push(`storey ${key.split('-')[0]} axis ${key.split('-')[1]}: no window there`); continue; }
    const x0 = Math.min(...os.map(o => o.leftM)), x1 = Math.max(...os.map(o => o.leftM + o.widthM)), y0 = Math.min(...os.map(o => o.bottomM)), y1 = Math.max(...os.map(o => o.bottomM + o.heightM));
    const dia = Math.min(Math.max(d ?? ROSETTE.defaultDiameterM, ROSETTE.diameter[0]), ROSETTE.diameter[1], x1 - x0 + 0.2, y1 - y0);
    discs.push({id: `rosette-s${key.replace('-', '-b')}`, cx: +((x0 + x1) / 2).toFixed(4), cy: +((y0 + y1) / 2).toFixed(4), d: +dia.toFixed(3)});
  }
  return {openings: keep, discs, missing};
}

const point = (cx: number, cy: number, r: number, a: number): CanalhousePoint => [+(cx + r * Math.cos(a)).toFixed(4), +(cy + r * Math.sin(a)).toFixed(4)];
const circle = (cx: number, cy: number, r: number): CanalhousePoint[] => Array.from({length: ROSETTE.segments}, (_, k) => point(cx, cy, r, 2 * Math.PI * k / ROSETTE.segments));
/** Half an annulus from angle a0 to a0 + pi: the outer arc out, the inner arc back (a simple polygon, so it extrudes as one). */
const halfRing = (cx: number, cy: number, r: number, ri: number, a0: number): CanalhousePoint[] => {
  const n = ROSETTE.segments / 2, at = (k: number) => a0 + Math.PI * k / n;
  return [...Array.from({length: n + 1}, (_, k) => point(cx, cy, r, at(k))), ...Array.from({length: n + 1}, (_, k) => point(cx, cy, ri, at(n - k)))];
};

/** One rosette: a stone ring (two half annuli, the wall showing through the field) and a stone boss, in module metres. */
export function rosetteOrnaments(disc: RosetteDisc, idPrefix = ''): CanalhouseOrnament[] {
  const r = disc.d / 2, ri = r * ROSETTE.fieldShare;
  return [
    {id: `${idPrefix}${disc.id}-ring-a`, profile: halfRing(disc.cx, disc.cy, r, ri, 0), depthM: ROSETTE.depthM.ring, fill: 'stone'},
    {id: `${idPrefix}${disc.id}-ring-b`, profile: halfRing(disc.cx, disc.cy, r, ri, Math.PI), depthM: ROSETTE.depthM.ring, fill: 'stone'},
    {id: `${idPrefix}${disc.id}-boss`, profile: circle(disc.cx, disc.cy, r * ROSETTE.bossShare), depthM: ROSETTE.depthM.boss, fill: 'stone'},
  ];
}
