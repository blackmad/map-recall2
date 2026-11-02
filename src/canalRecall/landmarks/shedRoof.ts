/**
 * North-light shed (saw-tooth) roof for landmark builders: a row of teeth over a flat roof, each an opaque slope rising
 * towards the glazing side over `ridgeAt` of the pitch, a glazed face falling to the next tooth, and a gable triangle
 * at both ends. Added for the Gerrit Rietveld Academie's workshop wing (lane #205, 2026-11-02: ten teeth on the wing
 * and two groups of six on the transverse block, 2.1 m pitch on the PDOK orthophoto); the city roof generator has a
 * procedural saw-tooth (roofMesh.ts), the landmark kit had none.
 *
 * Pure geometry in a local frame: `u` runs along the ridges, `v` across them towards the glazing (the side the
 * light comes from, north in Amsterdam), `y` up. Every triangle carries its outward direction so the caller can wind it
 * after mapping the frame onto its plan (the mapping may be a reflection).
 */
export type LocalPoint = [number, number, number];   // [u, v, y]

export interface ShedRoofSpec {
  /** Ridge extent along u. */
  u0: number; u1: number;
  /** v of the first tooth's low edge (the side away from the glazing). */
  v0: number;
  count: number;
  /** Tooth depth across the ridges (v). */
  pitch: number;
  /** Roof level the teeth stand on. */
  y: number;
  /** Ridge height above `y`. */
  rise: number;
  /** Ridge position as a fraction of the pitch from the tooth's low edge (default 0.67: a steep glazed face). */
  ridgeAt?: number;
}

export type ShedPart = 'slope' | 'glazing' | 'gable';
export interface ShedTriangle {part: ShedPart; points: [LocalPoint, LocalPoint, LocalPoint]; out: LocalPoint}

export function shedRoof(s: ShedRoofSpec): ShedTriangle[] {
  if (!(s.u1 > s.u0) || !(s.pitch > 0) || !(s.rise > 0) || s.count < 1) throw new Error('shedRoof: u1 > u0, pitch > 0, rise > 0, count >= 1');
  const r = s.ridgeAt ?? 0.67;
  if (!(r > 0 && r < 1)) throw new Error('shedRoof: ridgeAt in (0, 1)');
  const out: ShedTriangle[] = [];
  const yt = s.y + s.rise;
  for (let k = 0; k < s.count; k++) {
    const vs = s.v0 + k * s.pitch, vh = vs + s.pitch * r, ve = vs + s.pitch;
    // the slope faces up and away from the glazing; the glazing up and towards it
    const slopeOut: LocalPoint = [0, -s.rise, s.pitch * r], glazeOut: LocalPoint = [0, s.rise, s.pitch * (1 - r)];
    out.push({part: 'slope', points: [[s.u0, vs, s.y], [s.u1, vs, s.y], [s.u1, vh, yt]], out: slopeOut});
    out.push({part: 'slope', points: [[s.u0, vs, s.y], [s.u1, vh, yt], [s.u0, vh, yt]], out: slopeOut});
    out.push({part: 'glazing', points: [[s.u0, vh, yt], [s.u1, vh, yt], [s.u1, ve, s.y]], out: glazeOut});
    out.push({part: 'glazing', points: [[s.u0, vh, yt], [s.u1, ve, s.y], [s.u0, ve, s.y]], out: glazeOut});
    for (const [u, du] of [[s.u0, -1], [s.u1, 1]] as const) out.push({part: 'gable', points: [[u, vs, s.y], [u, vh, yt], [u, ve, s.y]], out: [du, 0, 0]});
  }
  return out;
}
