/**
 * Plan layout of an open round belvedere (a rotunda of piers or columns standing on a ring, with a balustrade in every
 * opening): the pier angles, the openings between them and the balusters in each opening, evenly spaced along the arc.
 *
 * Why (landmarks r19-B, 2026-11-27, Prins Hendrikkade 33 / art'otel, BAG 0363100012170961, 1921): the corner of this
 * stone-and-yellow-brick office block carries a round open belvedere over the attic: eight square piers with arched
 * openings, a stone balustrade in each opening, an overhanging cornice ring, a low grey dome and a small lantern
 * (aimed panorama views b_20250109_1300_Track01_Sphere_00091 and TMX7316060226-000030_pano_0006_000132). roundTower.ts
 * gives frames on a circle, bay angles and a dome profile, but not a ring of solid piers with balusters between them:
 * builders laid those out with hand loops (the count drifting with the radius, balusters running into a pier). This is
 * that layout once, typed and tested. Pure plan geometry, no three.js; nothing changes for models that do not call it.
 *
 * Conventions: angles in radians, plan angle a = atan2(z - cz, x - cx) as in roundTower.ts; lengths in metres of arc
 * measured on the ring radius.
 */
export interface OpenRotundaOptions {
  /** Ring radius on which the piers and the balustrade stand (m). */
  radius: number;
  /** Number of piers (>= 3). */
  piers: number;
  /** Pier width along the arc (m). */
  pierWidth: number;
  /** Plan angle of the first pier (default 0). */
  startAngle?: number;
  /** Target centre-to-centre baluster spacing along the arc (m); the count per opening is the nearest that fits. */
  balusterPitch?: number;
}

export interface RotundaOpening {
  /** Plan angles of the opening's two pier faces and its middle. */
  a0: number;
  a1: number;
  mid: number;
  /** Clear arc length between the piers (m) and the straight chord across it (m). */
  arc: number;
  chord: number;
  /** Plan angles of the balusters in this opening, evenly spaced, half a spacing clear of each pier. */
  balusters: number[];
}

export interface RotundaLayout {
  pierAngles: number[];
  openings: RotundaOpening[];
}

export function openRotunda(o: OpenRotundaOptions): RotundaLayout {
  const {radius: R, piers: n, pierWidth: pw} = o;
  if (!(R > 0)) throw Error('openRotunda: radius must be > 0');
  if (!(Number.isInteger(n) && n >= 3)) throw Error('openRotunda: piers must be an integer >= 3');
  if (!(pw > 0)) throw Error('openRotunda: pierWidth must be > 0');
  const step = (2 * Math.PI) / n, half = pw / (2 * R);
  if (!(2 * half < step)) throw Error('openRotunda: piers fill the whole ring');
  const a0 = o.startAngle ?? 0;
  const pierAngles = Array.from({length: n}, (_, i) => a0 + i * step);
  const openings = pierAngles.map(p => {
    const lo = p + half, hi = p + step - half, arc = (hi - lo) * R;
    let balusters: number[] = [];
    if (o.balusterPitch !== undefined) {
      if (!(o.balusterPitch > 0)) throw Error('openRotunda: balusterPitch must be > 0');
      const k = Math.max(1, Math.round(arc / o.balusterPitch)), s = (hi - lo) / k;
      balusters = Array.from({length: k}, (_, j) => lo + s * (j + 0.5));
    }
    return {a0: lo, a1: hi, mid: (lo + hi) / 2, arc, chord: 2 * R * Math.sin((hi - lo) / 2), balusters};
  });
  return {pierAngles, openings};
}
