/**
 * Layouts for the crown of a Gothic-revival tower: the crocketed needle spire, the openwork lantern (a ring of posts
 * standing round a dark core, with a base ring, a top ring and an optional cap) and the openwork gallery parapet
 * (balusters along a polygon under a rail).
 *
 * Why: the entrance towers of the Hoofdpostkantoor / Magna Plaza (C.H. Peters, 1895-99) end in two open stages and a
 * crocketed needle (panoramas 2025-06-16, recording_2025-06-16_06-42-40_02393, pitched view). The kit had pinnacles (a box
 * and a four-sided cone), a lathe pear and plain cones, so the towers read as squat slate onions. Peters' other post
 * offices, the Rijksmuseum and Centraal Station (Cuypers), and the neo-Gothic churches carry the same parts.
 *
 * Pure layout, no three.js: the builder adapter is scripts/landmarks/gothic-tower-kit.ts. Coordinates are model-native
 * metres about the tower axis: x east, z south, y up. A polygon of `sides` corners has its corners (arrises) at angles
 * `yaw + k * 2 pi / sides`, measured as (sin a, cos a), the convention of three's CylinderGeometry after rotateY(yaw), so a
 * frustum drawn with the same yaw and sides has its arrises exactly where these layouts put crockets and posts.
 * Nothing changes for models that do not call these functions.
 */
export type V3 = [number, number, number];

/** Circumradius of a regular polygon from its apothem. */
export function circumradius(apothem: number, sides: number): number {
  if (!(sides >= 3)) throw Error('circumradius: at least 3 sides');
  return apothem / Math.cos(Math.PI / sides);
}

/** Angle of corner k of a `sides`-gon turned by `yaw`. */
export function cornerAngle(k: number, sides: number, yaw: number): number {
  return yaw + k * 2 * Math.PI / sides;
}

export interface SpireOptions {
  /** Foot and tip of the spire shaft (the finial sits on top of the tip). */
  y0: number; y1: number;
  /** Apothem at the foot. The shaft tapers to a point. */
  apothem: number;
  sides?: number;
  yaw?: number;
  /** Crockets along every arris: vertical pitch (m) and leaf size (m). Omit for a plain needle. */
  crockets?: {pitch: number; size: number};
  /** Finial rod on the tip (height, m) with an optional ball (radius, m). */
  finial?: {height: number; ball?: number};
}

export interface Crocket {
  /** Position of the leaf's root on the arris. */
  at: V3;
  /** Outward direction of the arris (unit, horizontal). */
  out: [number, number];
  size: number;
}

export interface SpireLayout {
  shaft: {y0: number; y1: number; radius: number; sides: number; yaw: number};
  crockets: Crocket[];
  finial?: {y0: number; y1: number; ball?: number};
}

/**
 * Crocketed spire: a `sides`-sided needle from y0 to y1 with crockets on every arris every `pitch` metres, starting one
 * pitch above the foot and stopping one leaf short of the tip (the leaf must still have shaft behind it).
 */
export function crocketedSpireLayout(o: SpireOptions): SpireLayout {
  const sides = Math.round(o.sides ?? 8), yaw = o.yaw ?? 0;
  if (!(o.y1 > o.y0)) throw Error('crocketedSpireLayout: y1 must be above y0');
  if (!(o.apothem > 0)) throw Error('crocketedSpireLayout: apothem must be positive');
  const R = circumradius(o.apothem, sides), H = o.y1 - o.y0;
  const crockets: Crocket[] = [];
  if (o.crockets) {
    const {pitch, size} = o.crockets;
    if (!(pitch > 0 && size > 0)) throw Error('crocketedSpireLayout: crocket pitch and size must be positive');
    for (let y = o.y0 + pitch; y <= o.y1 - Math.max(size, pitch * 0.5) + 1e-9; y += pitch) {
      const r = R * (1 - (y - o.y0) / H);
      for (let k = 0; k < sides; k++) {
        const a = cornerAngle(k, sides, yaw), out: [number, number] = [Math.sin(a), Math.cos(a)];
        crockets.push({at: [out[0] * r, y, out[1] * r], out, size});
      }
    }
  }
  const finial = o.finial ? {y0: o.y1 - 0.05, y1: o.y1 + o.finial.height, ball: o.finial.ball} : undefined;
  return {shaft: {y0: o.y0, y1: o.y1, radius: R, sides, yaw}, crockets, finial};
}

export interface LanternOptions {
  /** Bottom of the base ring and top of the top ring. */
  y0: number; y1: number;
  /** Apothem of the stage (outer face of the posts). */
  apothem: number;
  sides?: number;
  yaw?: number;
  /** Corner post width (m), and the heights of the base and top rings. */
  post: number;
  base: number;
  top: number;
  /** Apothem of the dark core standing inside the posts (reads as the open interior); 0 for none. */
  core?: number;
  /** Mid-height posts on every face as well as the corner posts (paired openings per face). */
  midPosts?: boolean;
  /** Cap over the top ring: a dome (lathe) or a cone, its height, or none. */
  cap?: {kind: 'dome' | 'cone'; height: number};
}

export interface LanternPost {at: [number, number]; yaw: number; w: number; y0: number; y1: number}

export interface LanternLayout {
  base: {y0: number; y1: number; radius: number};
  top: {y0: number; y1: number; radius: number};
  posts: LanternPost[];
  core?: {y0: number; y1: number; radius: number};
  cap?: {kind: 'dome' | 'cone'; y0: number; y1: number; radius: number};
  sides: number; yaw: number;
}

/**
 * Openwork lantern: base and top rings (polygon slabs) with posts between them at every corner (and mid-face when asked);
 * the posts' outer faces lie on the stage apothem, so the openings between them are the voids. A core of smaller apothem
 * stands inside, from the base ring to the top ring, and must leave the posts clear.
 */
export function openworkLanternLayout(o: LanternOptions): LanternLayout {
  const sides = Math.round(o.sides ?? 8), yaw = o.yaw ?? 0, R = circumradius(o.apothem, sides);
  const yb = o.y0 + o.base, yt = o.y1 - o.top;
  if (!(yt > yb)) throw Error('openworkLanternLayout: rings leave no open height');
  if (!(o.post > 0 && o.post < 2 * R * Math.sin(Math.PI / sides))) throw Error('openworkLanternLayout: post wider than a face');
  const posts: LanternPost[] = [];
  // a corner post's centre sits post/2 in from the corner along the bisector, scaled to the circumradius
  const rc = R - o.post / 2 / Math.cos(Math.PI / sides);
  for (let k = 0; k < sides; k++) {
    const a = cornerAngle(k, sides, yaw);
    posts.push({at: [Math.sin(a) * rc, Math.cos(a) * rc], yaw: a, w: o.post, y0: yb, y1: yt});
    if (o.midPosts) {
      const m = a + Math.PI / sides, rm = o.apothem - o.post / 2;
      posts.push({at: [Math.sin(m) * rm, Math.cos(m) * rm], yaw: m, w: o.post * 0.8, y0: yb, y1: yt});
    }
  }
  const core = o.core ? {y0: yb - 0.01, y1: yt + 0.01, radius: circumradius(o.core, sides)} : undefined;
  if (core && core.radius >= rc - o.post * 0.6) throw Error('openworkLanternLayout: core touches the posts');
  const cap = o.cap ? {kind: o.cap.kind, y0: o.y1, y1: o.y1 + o.cap.height, radius: R} : undefined;
  return {base: {y0: o.y0, y1: yb, radius: R + 0.06}, top: {y0: yt, y1: o.y1, radius: R + 0.08}, posts, core, cap, sides, yaw};
}

export interface ParapetOptions {
  /** Closed polygon of the gallery edge (x, z), and the parapet foot and top. */
  ring: [number, number][];
  y0: number; y1: number;
  /** Baluster pitch and width (m); rail depth. */
  pitch: number; baluster: number;
  rail?: number;
}

export interface ParapetLayout {
  balusters: {at: [number, number]; yaw: number}[];
  rails: {a: [number, number]; b: [number, number]}[];
  y0: number; y1: number; rail: number; baluster: number;
}

/**
 * Openwork gallery parapet along a closed polygon: one rail per side from corner to corner and balusters every `pitch`
 * metres along each side, half a pitch in from its corners (a corner carries a pinnacle or a post, not a baluster).
 */
export function openworkParapetLayout(o: ParapetOptions): ParapetLayout {
  if (o.ring.length < 3) throw Error('openworkParapetLayout: a ring of at least 3 corners');
  if (!(o.y1 > o.y0) || !(o.pitch > o.baluster)) throw Error('openworkParapetLayout: bad height or pitch');
  const rail = o.rail ?? Math.min(0.2, (o.y1 - o.y0) * 0.25);
  const balusters: ParapetLayout['balusters'] = [], rails: ParapetLayout['rails'] = [];
  for (let i = 0; i < o.ring.length; i++) {
    const a = o.ring[i], b = o.ring[(i + 1) % o.ring.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1e-6) continue;
    rails.push({a, b});
    const n = Math.max(0, Math.floor((L - o.pitch) / o.pitch + 1e-9) + 1), start = (L - (n - 1) * o.pitch) / 2, yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    for (let k = 0; k < n; k++) { const s = (start + k * o.pitch) / L; balusters.push({at: [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s], yaw}); }
  }
  return {balusters, rails, y0: o.y0, y1: o.y1, rail, baluster: o.baluster};
}

/** Regular polygon ring (x, z) of the given apothem about a centre, corners at `cornerAngle`. */
export function polygonRing(centre: [number, number], apothem: number, sides: number, yaw = 0): [number, number][] {
  const R = circumradius(apothem, sides);
  return Array.from({length: sides}, (_, k) => { const a = cornerAngle(k, sides, yaw); return [centre[0] + Math.sin(a) * R, centre[1] + Math.cos(a) * R] as [number, number]; });
}
