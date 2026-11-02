/**
 * Lettering that follows a curved fascia: one placement per glyph on a circle, each glyph standing on its own tangent
 * plane, spaced along the arc by its advance, the run centred on a bearing.
 *
 * Why a component: the kit's `letters()` (scripts/landmarks/nearbar-kit.ts) lays a run of glyphs on one flat wall frame,
 * so a name on a round canopy was a straight chord that floats off the fascia at its ends or sinks into it in the middle.
 * The SARPHATI PLAZA letters on the curved entrance canopy of the Rhijnspoorplein tower (Gemeente Amsterdam panoramas
 * TMX7316010203-002825_pano_0003_001362, recording_2025-06-19_03-28-47_03191) bend with the canopy; any drum, rotunda or
 * curved shop fascia carries its name the same way.
 *
 * Pure plan geometry in (x, z), no three.js. Angles are measured in the plan from +x towards +z (atan2(z, x)); the circle
 * centre is `centre`, the glyphs' back faces stand at `radius`. Seen from outside the circle, with the reader facing the
 * centre, the text runs left to right; for an outward-facing run that is clockwise in (x, z) seen from +y (decreasing
 * angle when z points south and x east, i.e. the usual native frame).
 */
export type XZ = [number, number];

export interface ArcLetteringOptions {
  /** Plan centre of the curved face. */
  centre: XZ;
  /** Radius of the face the glyph backs touch, metres (> 0). */
  radius: number;
  /** Plan angle (atan2(z - cz, x - cx), radians) of the middle of the run. */
  centreAngle: number;
  /** Advance per glyph along the face, metres (the 5x7 kit glyphs advance 6 px). */
  advance: number;
}

export interface GlyphPlacement {
  char: string;
  /** Plan angle of the glyph centre. */
  angle: number;
  /** Plan point on the face at the glyph centre. */
  at: XZ;
  /** Unit outward normal (away from the centre). */
  n: XZ;
  /** Unit tangent pointing the way the text reads (the reader's right when facing the face from outside). */
  tangent: XZ;
}

/** Glyph placements for `text` on the arc; spaces take an advance but are returned too (callers skip blank glyphs). */
export function arcGlyphPlacements(text: string, o: ArcLetteringOptions): GlyphPlacement[] {
  if (!(o.radius > 0)) throw Error('arcGlyphPlacements: radius must be > 0');
  const chars = [...text];
  const step = o.advance / o.radius;
  // Reading left to right from outside means moving towards decreasing angle (see header); the run is centred on centreAngle.
  const first = o.centreAngle + step * (chars.length - 1) / 2;
  return chars.map((char, i) => {
    const angle = first - i * step;
    const n: XZ = [Math.cos(angle), Math.sin(angle)];
    return {char, angle, at: [o.centre[0] + n[0] * o.radius, o.centre[1] + n[1] * o.radius], n, tangent: [n[1], -n[0]]};
  });
}
