// A De Wallen window front (lane R, round 16): the ground storey of a red-light house as a row of glazed doors in a
// pale timber frame, each with a transom light, a dark kick panel, a curtain behind the glass and a red tube on the head.
//
// One ground-floor kit part for two consumers, drawn through a two-call sink (`FrontPanelSink`, metres in the wall's
// frame: `a` along it left to right as seen, `o` out from the wall, `z` up from the pavement):
//   - the buurt kit (buurtGenerator/kit/roofKit.ts `windowFronts`), whose sink has no lit faces (the tube is a flat red);
//   - the retail lane's template front (retailFront.ts, `redLight`): its Builder already has `panel` and `box` with a
//     `lit` flag, so `drawRedLightFront(builder, ...)` is a drop-in for its `redGlow` content.
//
// Measured on open panoramas (Gemeente Amsterdam Panoramabeelden, CC BY 4.0) of two staged redLight pands
// (data/retail-ground/shop-templates.json): 0363100012177991 (3.49 m, three doors) and 0363100012178276 (four doors),
// rectified at 60 px/m by scripts/pand-reference/run.ts. Over the pavement: a kick panel to 0.55 m, curtain glass to
// 2.15 m, a transom bar at 2.2 m (0.8 of the frame), the transom light to 2.65 m, the head at 2.7 m, and the red tube
// over it at 2.8-2.9 m, one run over the whole frame (177991) or one per door (178276). Doors 1.1-1.2 m on centres,
// posts about 0.13 m. The frame reads cream in shade (#655c46 measured, a pale paint), the kick panel near black, the
// curtains a deep red; 178276 has its curtains gathered to one side over a dark room.

/** The sink a part draws into: a flat panel parallel to the wall, and a box standing out from it. */
export interface FrontPanelSink {
  panel(a0: number, a1: number, o: number, z0: number, z1: number, hex: string, lit?: boolean): void;
  box(a0: number, a1: number, o0: number, o1: number, z0: number, z1: number, hex: string, lit?: boolean): void;
}

/** What a stated window front may say; every field absent takes the measured default (RED_LIGHT_LOOK). */
export interface RedLightFront {
  /** Doors across the span; absent, as many as fit at `doorM`. */
  doors?: number;
  /** The frame's paint. */
  frameHex?: string;
  /** The curtain's colour. */
  curtainHex?: string;
  /** The tube: one run over the frame, or one per door. */
  tube?: 'run' | 'doors';
  /** Curtains drawn across the glass, or gathered to one side over a dark room. */
  curtains?: 'drawn' | 'gathered';
  /** The frame's head over the pavement (m). */
  headM?: number;
}

export const RED_LIGHT_LOOK = {
  doorM: 1.15, headM: 2.7, transomShare: 0.8, kickM: 0.55, postM: 0.13, barM: 0.08, frameOutM: 0.06,
  tubeM: 0.07, tubeGapM: 0.1, tubeOutM: 0.08, tubeInsetM: 0.06,
  frameHex: '#d9d1b8', kickHex: '#1d1a17', curtainHex: '#7a1e22', foldHex: '#5a1218', roomHex: '#1a0e10', transomHex: '#3a1a1c',
  tubeHex: '#ff2a3a',
  /** A gathered curtain covers this share of its door. */
  gatheredShare: 0.3,
} as const;

export type RedLightFrontOf = (v: unknown) => RedLightFront | null;
const HEX = /^#[0-9a-f]{6}$/i;
/** A stated window front from untrusted JSON: unknown fields dropped, absent ones left absent (byte-identical). */
export const redLightFrontOf: RedLightFrontOf = v => {
  if (!v || typeof v !== 'object') return null;
  const x = v as Record<string, unknown>, out: RedLightFront = {};
  if (Number.isInteger(x.doors) && (x.doors as number) >= 1 && (x.doors as number) <= 12) out.doors = x.doors as number;
  if (typeof x.frameHex === 'string' && HEX.test(x.frameHex)) out.frameHex = x.frameHex;
  if (typeof x.curtainHex === 'string' && HEX.test(x.curtainHex)) out.curtainHex = x.curtainHex;
  if (x.tube === 'run' || x.tube === 'doors') out.tube = x.tube;
  if (x.curtains === 'drawn' || x.curtains === 'gathered') out.curtains = x.curtains;
  if (Number(x.headM) >= 2 && Number(x.headM) <= 4) out.headM = Number(x.headM);
  return out;
};

/** The doors' spans over [a0, a1]: `n` doors between posts, posts at both ends. */
export function redLightDoors(a0: number, a1: number, f: RedLightFront = {}): Array<[number, number]> {
  const L = RED_LIGHT_LOOK, w = a1 - a0;
  if (!(w > L.postM * 2 + 0.4)) return [];
  const n = f.doors ?? Math.max(1, Math.round((w - L.postM) / L.doorM)), cell = (w - L.postM) / n;
  return Array.from({ length: n }, (_, k) => [+(a0 + L.postM + k * cell).toFixed(4), +(a0 + (k + 1) * cell).toFixed(4)] as [number, number]);
}

/**
 * The window front over [a0, a1] of the wall, from the pavement `z0`, standing at `o` (the face it covers: the wall or
 * the kit's plate). The frame stands proud by frameOutM; the glass, curtain and kick panel lie at `o`.
 */
export function drawRedLightFront(b: FrontPanelSink, a0: number, a1: number, z0: number, o: number, f: RedLightFront = {}): void {
  const L = RED_LIGHT_LOOK, doors = redLightDoors(a0, a1, f);
  if (!doors.length) return;
  const head = z0 + (f.headM ?? L.headM), bar = z0 + (head - z0) * L.transomShare, kick = z0 + L.kickM;
  const frame = f.frameHex ?? L.frameHex, curtain = f.curtainHex ?? L.curtainHex, gathered = f.curtains === 'gathered';
  const of = o + L.frameOutM;
  // Behind the frame: kick panels, the glass with its curtain, the transom lights.
  doors.forEach(([d0, d1], k) => {
    b.panel(d0, d1, o, z0, kick, L.kickHex);
    if (gathered) {
      b.panel(d0, d1, o, kick, bar, L.roomHex);
      // Alternate sides door by door, as the photo's row.
      const cw = (d1 - d0) * L.gatheredShare, left = k % 2 === 0;
      curtainPanel(b, left ? d0 : d1 - cw, left ? d0 + cw : d1, o + 0.006, kick, bar, curtain);
    } else curtainPanel(b, d0, d1, o + 0.006, kick, bar, curtain);
    b.panel(d0, d1, o, bar, head, L.transomHex);
  });
  // The frame: posts between and at both ends, the transom bar, the head, the sill.
  b.box(a0, a0 + L.postM, o, of, z0, head + L.barM, frame);
  for (const [, d1] of doors) b.box(d1, d1 + L.postM, o, of, z0, head + L.barM, frame);
  const end = doors[doors.length - 1][1] + L.postM;
  b.box(a0, end, o, of, bar - L.barM / 2, bar + L.barM / 2, frame);
  b.box(a0, end, o, of, head, head + L.barM, frame);
  b.box(a0, end, o, of + 0.02, z0, z0 + 0.06, frame);
  // The tube on the head: one run, or one per door.
  const tz0 = head + L.barM + L.tubeGapM, tz1 = tz0 + L.tubeM, to = o + L.tubeOutM;
  if (f.tube === 'doors') for (const [d0, d1] of doors) b.box(d0 + L.tubeInsetM, d1 - L.tubeInsetM, o, to, tz0, tz1, L.tubeHex, true);
  else b.box(a0 + L.tubeInsetM, end - L.tubeInsetM, o, to, tz0, tz1, L.tubeHex, true);
}

/** A curtain: its colour with darker folds every 0.16 m (the photo's pleats). */
function curtainPanel(b: FrontPanelSink, c0: number, c1: number, o: number, z0: number, z1: number, hex: string): void {
  b.panel(c0, c1, o, z0, z1, hex);
  for (let a = c0 + 0.1; a < c1 - 0.06; a += 0.16) b.panel(a, a + 0.04, o + 0.003, z0, z1, RED_LIGHT_LOOK.foldHex);
}
