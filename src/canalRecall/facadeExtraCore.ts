// Core of the facade extras: the wall frame and context types, the deterministic hash, and the
// triangle sink every component draws into. Split out of facadeExtras.ts so the component
// families (facadeExtras.ts, facadeOrnaments.ts) can share it without importing each other.

import type { ArchitecturalRecipe } from './streetAppearance.js';
import type { FacadeStyle } from './genericFacades.js';
import type { WallLayout } from './facadeLayout.js';
import type { Openings } from './facadeOpenings.js';

export type V3 = [number, number, number];
export type FlatTri = { p: V3[]; hex: string; n: V3; texture?: 'glass-block'; uv?: [number, number][] };
/** Wall frame: origin at the wall's start (ground of this building), x along, y outward. */
export type WallFrame = { x0: number; y0: number; ux: number; uy: number; nx: number; ny: number; len: number };
export type ExtraContext = {
  recipe?: ArchitecturalRecipe;
  runStart?: boolean; runEnd?: boolean;
  /** One eligible facet owns a defining balcony stack for its continuous wall run. */
  assemblyOwner?: boolean;
  /** One owner emits all eligible facets of a continuous shop canopy, atomically. */
  canopyOwner?: boolean;
  /** The renderer installed a complete cut ground frontage; generic dressing is incompatible. */
  groundFrontageActive?: boolean;
  canopyFrames?: readonly WallFrame[];
  id: string; style: FacadeStyle; wallKey: string; f: WallFrame; base: number; top: number;
  layout: WallLayout; wallHex: string; accentHex: string; roofKind?: string; groundLevel: boolean;
  /**
   * The building's period when it differs from the layout style: the bay looks lay every pre-1915
   * house out as `canal`, but a known 19th-century house should still get 19th-century stucco.
   * Absent: the layout style.
   */
  period?: FacadeStyle;
  /** This wall faces a street (the mesh's door-wall test). Absent: it does when it has a door. */
  streetSide?: boolean;
  /** Where this building's painted windows and door sit in a bay (facadeOpenings.ts). Absent: guessed from id and style. */
  openings?: Openings;
  /** The ground floor is a shopfront: no ground-floor window dressing. */
  shopfront?: boolean;
};
export type RoofContext = { id: string; style: FacadeStyle; rect: { cx: number; cy: number; ux: number; uy: number; len: number; wid: number }; z: number; wallHex: string };

export function hash01(text: string): number {
  let h = 2166136261;
  for (const c of text) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

/** Triangles a closed box adds (five faces; six with a bottom). */
export const BOX_TRIS = 10;

/**
 * Collects flat-coloured geometry as triangles within a triangle budget. A box is five faces
 * (back omitted, bottom optional), a strip is a thin proud plate drawn as its front and top only.
 * `begin`/`commit` make a component atomic: if any part of it does not fit, none of it is kept,
 * so a cornice never stops halfway along a wall.
 */
export class ExtraSink {
  readonly tris: FlatTri[] = [];
  /** Primitives (boxes, strips, slopes) accepted so far. */
  boxes = 0;
  private mark: { tris: number; boxes: number; failed: boolean } | null = null;
  /** `budget`: triangles. */
  constructor(public budget: number) {}
  private fits(n: number): boolean {
    if (this.tris.length + n <= this.budget) return true;
    if (this.mark) this.mark.failed = true;
    return false;
  }
  /** Triangles still free. */
  room(): number { return Math.max(0, this.budget - this.tris.length); }
  /** Start an all-or-nothing group. */
  begin() { this.mark = { tris: this.tris.length, boxes: this.boxes, failed: false }; }
  /** End the group: keep it if every part fitted, else drop all of it. Returns whether it was kept. */
  commit(): boolean {
    const m = this.mark; this.mark = null;
    if (!m || !m.failed) return true;
    this.tris.length = m.tris; this.boxes = m.boxes;
    return false;
  }
  /**
   * A box in a wall frame: x along [a0, a1], y outward [o0, o1], z up [z0, z1]. The back face is
   * omitted (it is against the wall) unless `back`: a parapet standing above the roof needs it.
   */
  box(f: WallFrame, a0: number, a1: number, o0: number, o1: number, z0: number, z1: number, hex: string, bottom = false, back = false): boolean {
    if (this.mark?.failed || !this.fits(10 + (bottom ? 2 : 0) + (back ? 2 : 0))) return false;
    this.boxes++;
    const P = (a: number, o: number, z: number): V3 => [f.x0 + f.ux * a + f.nx * o, f.y0 + f.uy * a + f.ny * o, z];
    const N = (a: number, o: number, z: number): V3 => [f.ux * a + f.nx * o, f.uy * a + f.ny * o, z];
    this.face([P(a0, o1, z0), P(a1, o1, z0), P(a1, o1, z1), P(a0, o1, z1)], N(0, 1, 0), hex);
    this.face([P(a0, o0, z0), P(a0, o1, z0), P(a0, o1, z1), P(a0, o0, z1)], N(-1, 0, 0), hex);
    this.face([P(a1, o0, z0), P(a1, o1, z0), P(a1, o1, z1), P(a1, o0, z1)], N(1, 0, 0), hex);
    this.face([P(a0, o0, z1), P(a1, o0, z1), P(a1, o1, z1), P(a0, o1, z1)], [0, 0, 1], hex);
    if (bottom) this.face([P(a0, o0, z0), P(a1, o0, z0), P(a1, o1, z0), P(a0, o1, z0)], [0, 0, -1], hex);
    if (back) this.face([P(a0, o0, z0), P(a1, o0, z0), P(a1, o0, z1), P(a0, o0, z1)], N(0, -1, 0), hex);
    return true;
  }
  /**
   * A thin proud plate (a frame, a glazing bar, a band a few centimetres out): its front and top
   * only, four triangles. Its sides would be slivers a few pixels wide at street distance. The top
   * runs back `depth` from the front (default: to the wall, a solid ledge); a railing standing
   * free of the wall passes its own thickness.
   */
  strip(f: WallFrame, a0: number, a1: number, out: number, z0: number, z1: number, hex: string, depth = out): boolean {
    if (this.mark?.failed || !this.fits(4)) return false;
    this.boxes++;
    const P = (a: number, o: number, z: number): V3 => [f.x0 + f.ux * a + f.nx * o, f.y0 + f.uy * a + f.ny * o, z];
    this.face([P(a0, out, z0), P(a1, out, z0), P(a1, out, z1), P(a0, out, z1)], [f.nx, f.ny, 0], hex);
    const back = Math.max(0, out - depth);
    this.face([P(a0, back, z1), P(a1, back, z1), P(a1, out, z1), P(a0, out, z1)], [0, 0, 1], hex);
    return true;
  }
  /** A flat wall ornament with a shaped outline, such as an open triangular pediment. */
  wallQuad(f: WallFrame, points: readonly [number, number][], out: number, hex: string): boolean {
    if (points.length !== 4 || this.mark?.failed || !this.fits(2)) return false;
    this.boxes++;
    this.face(points.map(([a, z]) => [f.x0 + f.ux * a + f.nx * out, f.y0 + f.uy * a + f.ny * out, z]), [f.nx, f.ny, 0], hex);
    return true;
  }
  /** Repeating fixed-colour painted glass cells, still charged to the wall triangle budget. */
  glassBlockQuad(f: WallFrame, points: readonly [number, number][], out: number, cellM: number, startM: number, bottomM: number): boolean {
    const first=this.tris.length;
    if(!this.wallQuad(f,points,out,'#ffffff'))return false;
    for(const tri of this.tris.slice(first)){
      tri.texture='glass-block';
      tri.uv=tri.p.map(([x,y,z])=>[((x-f.x0)*f.ux+(y-f.y0)*f.uy+startM)/cellM,(z-bottomM)/cellM]);
    }
    return true;
  }
  /** A sloped quad (a hood or a canopy): from (a0..a1, o0, zWall) at the wall to (o1, zOut) outside. */
  slope(f: WallFrame, a0: number, a1: number, o0: number, o1: number, zWall: number, zOut: number, hex: string): boolean {
    if (this.mark?.failed || !this.fits(2)) return false;
    this.boxes++;
    const P = (a: number, o: number, z: number): V3 => [f.x0 + f.ux * a + f.nx * o, f.y0 + f.uy * a + f.ny * o, z];
    const n: V3 = [f.nx * (zWall - zOut), f.ny * (zWall - zOut), o1 - o0];
    this.face([P(a0, o0, zWall), P(a1, o0, zWall), P(a1, o1, zOut), P(a0, o1, zOut)], n, hex);
    return true;
  }
  /** Extrude a convex outward/up cross-section along a wall, including both end caps. */
  wallProfile(f: WallFrame, profile: readonly (readonly [number, number])[], hex: string, join: {startSkew?:number;endSkew?:number;startCap?:boolean;endCap?:boolean} = {}): boolean {
    const count=profile.length;
    const caps=Number(join.startCap!==false)+Number(join.endCap!==false);
    if(count<3||this.mark?.failed||!this.fits(2*count+caps*(count-2)))return false;
    this.boxes++;
    const p=(a:number,o:number,z:number):V3=>{const along=a+o*(a===0?(join.startSkew??0):(join.endSkew??0));return [f.x0+f.ux*along+f.nx*o,f.y0+f.uy*along+f.ny*o,z];};
    // Positive signed area means outward normals are right of each profile edge.
    const sign=profile.reduce((sum,[o,z],i)=>{const next=profile[(i+1)%count];return sum+o*next[1]-next[0]*z;},0)>=0?1:-1;
    for(let i=0;i<count;i++){
      const [o,z]=profile[i], [q,w]=profile[(i+1)%count];
      this.face([p(0,o,z),p(f.len,o,z),p(f.len,q,w),p(0,q,w)],[f.nx*(w-z)*sign,f.ny*(w-z)*sign,(o-q)*sign],hex);
    }
    for(const [a,direction] of [[0,-1],[f.len,1]])for(let i=1;i<count-1;i++){
      if(a===0&&join.startCap===false||a!==0&&join.endCap===false)continue;
      const points=[profile[0],profile[i],profile[i+1]].map(([o,z])=>p(a,o,z));
      const skew=a===0?(join.startSkew??0):(join.endSkew??0);
      const n:V3=[(f.ux-skew*f.nx)*direction,(f.uy-skew*f.ny)*direction,0];
      this.face(points,n,hex);
    }
    return true;
  }
  private face(q: V3[], n: V3, hex: string) {
    const [A, B, C, D] = q;
    const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const c = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const flip = c[0] * n[0] + c[1] * n[1] + c[2] * n[2] < 0, l = Math.hypot(...n) || 1, nn: V3 = [n[0] / l, n[1] / l, n[2] / l];
    this.tris.push({ p: flip ? [A, C, B] : [A, B, C], hex, n: nn });
    if(D)this.tris.push({ p: flip ? [A, D, C] : [A, C, D], hex, n: nn });
  }
}

/** A component's probability: one number, or one per style (a style left out never gets it). */
export type Chance = number | Partial<Record<FacadeStyle, number>>;
export type WallComponent = {
  id: string; styles: readonly FacadeStyle[]; p: Chance; build: (c: ExtraContext, s: ExtraSink, r: number) => void;
  /** One roll per building, so every wall of a house agrees (a cornice, shutters, a band course). */
  wide?: boolean;
  /** All or nothing: dropped whole when it does not fit the budget. */
  atomic?: boolean;
  /** At most one component of a group per wall (one crowning cornice, one door surround). */
  group?: string;
  /** Only on a wall that faces a street. */
  street?: boolean;
  /** How far above the wall top it may reach, metres (vases on a cornice, a corner tower). Default 0.6. */
  rise?: number;
};
export type RoofComponent = { id: string; styles: readonly FacadeStyle[]; p: number; build: (c: RoofContext, s: ExtraSink, r: number) => void };

export const chanceFor = (p: Chance, style: FacadeStyle): number => typeof p === 'number' ? p : p[style] ?? 0;
