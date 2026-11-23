/**
 * Round corner tower parts: wall frames on a circle, bay angles across a tower's free arc, and the profile of a raised
 * (helmet) dome for a lathe, with an optional neck for a lantern.
 *
 * Why (landmarks r18-C, 2026-11-23, Koningsplein 1, Th.G. Schill and D.H. Haverkamp 1890-91 for the Verzekeringsbank
 * 'Kosmos'): the register describes "de op de hoek gesitueerde halfronde toren" with three windows per storey, a fourth
 * storey of stone with five round-headed windows between half-columns, and "de met shingles en zink beklede koepel"
 * crowned by an open lantern with an iron spire. Gemeente Amsterdam panoramas (b_20250109_1300_Track05_Sphere_00277,
 * recording_2025-06-19_03-28-47_01535) put the dome's springing at ~21 m and its crown at ~25.3 m on a 2.1 m drum: a
 * steep helmet, not a hemisphere. The kit's facade parts are authored on flat wall frames; the Hirschgebouw, American
 * Hotel and Sarphati Plaza builders each re-derived a frame on a circle, bay angles and a quarter-ellipse dome inline.
 * This module is that geometry once, typed and tested. Pure plan geometry, no three.js.
 *
 * Conventions: plan points (x, z) in native metres (x east, z south); a plan angle is atan2(z - cz, x - cx). Frames use
 * the nearbar-kit convention: `tangent` is the viewer's right facing the wall from outside, `n` points out.
 */
export type XZ = [number, number];
export type ArcFrame = {origin: XZ; tangent: XZ; n: XZ};

/** Wall frame touching the circle (centre, radius) at plan angle `a`, its normal pointing away from the centre. */
export function arcFrame(centre: XZ, radius: number, a: number): ArcFrame {
  if (!(radius > 0)) throw Error('arcFrame: radius must be > 0');
  const n: XZ = [Math.cos(a), Math.sin(a)];
  // viewer's right when facing the wall from outside (looking along -n) in x-east / z-south: rotate n by -90 deg in (x, z)
  return {origin: [centre[0] + n[0] * radius, centre[1] + n[1] * radius], tangent: [n[1], -n[0]], n};
}

/**
 * Plan angles of `count` bays centred on `centreAngle`, `pitch` metres of arc apart on a circle of `radius`, ordered left to
 * right as seen from outside (decreasing angle, as in arcLettering.ts). `count` 1 returns the centre angle alone.
 */
export function bayAngles(centreAngle: number, count: number, pitch: number, radius: number): number[] {
  if (!(count >= 1) || !Number.isInteger(count)) throw Error('bayAngles: count must be a positive integer');
  if (!(radius > 0) || !(pitch >= 0)) throw Error('bayAngles: radius > 0 and pitch >= 0 required');
  const step = pitch / radius;
  const first = centreAngle + step * (count - 1) / 2;
  return Array.from({length: count}, (_, i) => first - i * step);
}

export interface DomeProfileOptions {
  /** Radius at the springing (m). */
  radius: number;
  /** Height from the springing to the crown (m). */
  rise: number;
  /** Superellipse exponent of the side (2 = quarter ellipse; > 2 a fuller, steeper helmet; < 2 more conical). */
  exponent?: number;
  /** Profile points from springing to crown (>= 2). */
  steps?: number;
  /** Radius of the flat ring left at the crown for a lantern (m, default 0: closed). */
  neck?: number;
}

/**
 * Lathe profile [r, y] of a raised dome from the springing (r = radius, y = 0) to the crown (r = neck, y = rise at
 * neck 0), monotonic in both r (non-increasing) and y (non-decreasing). The side follows the superellipse
 * (r / radius)^e + (y / rise)^e = 1; a neck cuts it where r reaches the neck radius.
 */
export function domeProfile(o: DomeProfileOptions): [number, number][] {
  const e = o.exponent ?? 2, steps = o.steps ?? 8, neck = o.neck ?? 0;
  if (!(o.radius > 0 && o.rise > 0)) throw Error('domeProfile: positive radius and rise required');
  if (!(e > 0) || !(steps >= 2)) throw Error('domeProfile: exponent > 0 and steps >= 2 required');
  if (!(neck >= 0 && neck < o.radius)) throw Error('domeProfile: neck must be in [0, radius)');
  const yAt = (r: number) => o.rise * Math.pow(Math.max(0, 1 - Math.pow(r / o.radius, e)), 1 / e);
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI / 2;
    // superellipse parameterisation: r = R cos^(2/e), y = H sin^(2/e)
    const r = o.radius * Math.pow(Math.cos(a), 2 / e), y = o.rise * Math.pow(Math.sin(a), 2 / e);
    if (r <= neck) { out.push([neck, yAt(neck)]); break; }
    out.push([r, y]);
  }
  if (neck === 0) out[out.length - 1] = [0, o.rise];
  return out;
}
