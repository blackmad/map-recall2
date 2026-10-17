/**
 * Horizontal brick stripes (Amsterdam School, Spaarndammerbuurt 1922-25): zones of the front where courses of a second
 * brick alternate with the wall brick at a fixed pitch. Hembrugstraat 2-32 lays its whole ground storey in dark/light
 * stripes (0.12 m of dark brick every 0.3 m); Hembrugstraat 100-232 stripes only the portiek bay over the entrance.
 *
 * `FrontIntent.brickStripes`: a list of zones, each `{rise: [foot, limit], pitch, stripe, span?: [from, to]}` (metres over
 * the street, metres between stripe feet, metres of stripe; `span` = shares of the front from the viewer's left, default
 * the whole front; intents carry no left/top/width keys). Each stripe is a 2 cm facing in the palette's band brick (`surface: accent`) that the library cuts
 * around the openings, like the lintel stripes of `bands: lintel`. Needs `palette.band`. Absent = byte-identical.
 */
import type {CanalhouseFacadeBlock} from '../canalhouseRecipes.ts';

export interface BrickStripeZone {
  /** [foot of the lowest stripe, the height no stripe passes], metres over the front's ground (0..30). */
  rise: [number, number];
  /** Metres from one stripe's foot to the next (0.1..1.5). */
  pitch: number;
  /** Stripe height in metres (0.04 .. pitch - 0.03). */
  stripe: number;
  /** Shares of the front from the viewer's left where the zone starts and ends (0..1, from < to). Default [0, 1]. */
  span?: [number, number];
}

/** Facing depth of a stripe: proud of the 3 cm per-front facing and of a painted storey's 4 cm, never coplanar. */
export const BRICK_STRIPE_DEPTH_M = 0.045;
const KEYS = ['rise', 'pitch', 'stripe', 'span'];
const num = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** Problems with `brickStripes` on one front (`band`: the front's or the house's band brick colour). */
export function brickStripeProblems(zones: unknown, band: string | undefined, repeated: boolean, at: string): string[] {
  if (!Array.isArray(zones) || !zones.length || zones.length > 6) return [`${at}.brickStripes: a list of 1-6 zones {rise, pitch, stripe, span?}`];
  const p: string[] = [];
  if (!band) p.push(`${at}.brickStripes: needs palette.band (the stripe brick)`);
  zones.forEach((z: any, i) => {
    const a = `${at}.brickStripes[${i}]`;
    if (!z || typeof z !== 'object' || Object.keys(z).some(k => !KEYS.includes(k))) { p.push(`${a}: {rise, pitch, stripe, span?}`); return; }
    const pitchOk = num(z.pitch, 0.1, 1.5);
    if (!pitchOk) p.push(`${a}.pitch: 0.1..1.5 m`);
    else if (!num(z.stripe, 0.04, z.pitch - 0.03)) p.push(`${a}.stripe: 0.04 m .. pitch - 0.03 m`);
    if (!Array.isArray(z.rise) || z.rise.length !== 2 || !num(z.rise[0], 0, 30) || !num(z.rise[1], z.rise[0] + (pitchOk ? z.pitch : 0), 30)) p.push(`${a}.rise: [foot, limit] in metres, at least one pitch apart, at most 30 m`);
    if (z.span !== undefined && (!Array.isArray(z.span) || z.span.length !== 2 || !num(z.span[0], 0, 1) || !num(z.span[1], 0, 1) || z.span[1] - z.span[0] < 0.03)) p.push(`${a}.span: [from, to] shares of the front, from < to`);
    if (repeated && z.span !== undefined) p.push(`${a}.span: not on a repeated front (the zone would land on one module)`);
  });
  return p;
}

/** The viewer-left share span of a zone after a left-right mirror. */
export const mirrorStripeZone = (z: BrickStripeZone): BrickStripeZone => ({...z, ...(z.span ? {span: [+(1 - z.span[1]).toFixed(4), +(1 - z.span[0]).toFixed(4)] as [number, number]} : {})});

/**
 * The stripes as facade blocks (facade x: `flipX(viewerLeftM, widthM)` maps a viewer-left span onto the facade).
 * A stripe whose top would pass `top` is dropped.
 */
export function brickStripeBlocks(zones: readonly BrickStripeZone[], width: number, flipX: (x: number, w: number) => number): CanalhouseFacadeBlock[] {
  const round = (v: number) => Math.round(v * 1000) / 1000, full = Math.floor(width * 1000) / 1000, out: CanalhouseFacadeBlock[] = [];
  zones.forEach((z, i) => {
    const l = Math.max(0, (z.span?.[0] ?? 0) * width), r = Math.min(full, (z.span?.[1] ?? 1) * width), w = Math.floor((r - l) * 1000) / 1000;
    for (let k = 0, y = z.rise[0]; y + z.stripe <= z.rise[1] + 1e-9; k++, y = z.rise[0] + k * z.pitch)
      out.push({id: `stripe-z${i}-${k}`, leftM: round(flipX(l, w)), bottomM: round(y), widthM: w, heightM: round(z.stripe), depthM: BRICK_STRIPE_DEPTH_M, surface: 'accent'});
  });
  return out;
}
