/**
 * Parametric block generator: type spec + footprint rectangle + roof facts +
 * cladding variant -> triangle mesh in the block's local frame.
 *
 * Local frame (metres, ground at y = 0): x along the long side, z across, the
 * FRONT facade at +z, centre of the rectangle at the origin. A facade frame is
 * (u along the facade seen from outside left-to-right, v up, d outward).
 */
import {MeshBuilder, type MaterialKey, type V3} from './mesh.ts';
import {trimKey} from './whiteTrim.ts';
import {FACADE_IDS, type Annex, type Bay, type ChimneySpec, type DormerSpec, type Element, type FacadeId, type Height, type Levels, type Palette, type PaletteKey, type TypeSpec} from './spec.ts';

export interface GenerateParams {
  lengthM: number;
  widthM: number;
  /** Wall top: eaves line when pitched, roof surface when flat; metres above ground. */
  eavesM: number;
  /** Ridge height above ground when pitched. */
  ridgeM?: number;
  storeys?: number;
  variant?: string;
  roofForm?: 'gable' | 'hip' | 'flat';
  ridge?: 'long' | 'short';
  groundMode?: 'solid' | 'pilotis';
  /** Terraced houses: which side walls stand free (an end house has one, a detached/semi house two). Party walls get no openings. Default: both free. */
  freeSides?: {left: boolean; right: boolean};
  /** Mirror the front and back facades left-to-right (houses built in mirrored pairs). */
  mirror?: boolean;
  /**
   * Back (-z) eaves of an eaves-front gable when it differs from the front's `eavesM` (a catslide over a rear lean-to, or a front slope
   * swept down to the ground storey): both slopes keep one pitch through the measured ridge, which then stands off the centre line.
   */
  backEavesM?: number;
}

export interface FacadeCount { bays: number; openingsPerUpperStorey: number; groundDoors: number; balconiesPerUpperStorey: number }

export interface GenerateReport {
  triangles: number;
  storeys: number;
  storeyHeightM: number;
  wallTopM: number;
  ridgeM: number | null;
  variant: string;
  roofForm: 'gable' | 'hip' | 'flat';
  ridge: 'long' | 'short';
  groundMode: 'solid' | 'pilotis';
  /** 'mid' | 'endL' | 'endR' | 'free' when the params carry freeSides AND a side facade has openings (otherwise end and mid houses are the same mesh), else undefined. */
  sides?: 'mid' | 'endL' | 'endR' | 'free';
  mirrored?: boolean;
  /** Annex volumes drawn (only when the type has annexes). */
  annexes?: number;
  facades: Record<FacadeId, FacadeCount>;
}

class Frame {
  constructor(readonly o: [number, number], readonly t: [number, number], readonly n: [number, number]) {}
  p(u: number, v: number, d: number): V3 { return [this.o[0] + this.t[0] * u + this.n[0] * d, v, this.o[1] + this.t[1] * u + this.n[1] * d]; }
}

const IDENTITY = new Frame([0, 0], [1, 0], [0, 1]);

interface BoxSkip { back?: boolean; bottom?: boolean; top?: boolean; /** both u-end faces (the gables of a wall volume clad separately) */ ends?: boolean }

/** Axis-aligned box in frame coordinates; faces wound outward. `back` is the d0 face, `bottom` the v0 face. */
function box(mb: MeshBuilder, key: MaterialKey, f: Frame, u0: number, u1: number, v0: number, v1: number, d0: number, d1: number, skip: BoxSkip = {back: true}): void {
  if (u1 - u0 < 1e-6 || v1 - v0 < 1e-6 || d1 - d0 < 1e-6) return;
  const lo = [u0, v0, d0], hi = [u1, v1, d1];
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3, k = (i + 2) % 3;
    for (const sign of [1, -1]) {
      if (i === 2 && sign === -1 && skip.back) continue;
      if (i === 1 && sign === -1 && skip.bottom) continue;
      if (i === 1 && sign === 1 && skip.top) continue;
      if (i === 0 && skip.ends) continue;
      const c = (a: number, b: number): V3 => {
        const x = [0, 0, 0]; x[i] = sign === 1 ? hi[i] : lo[i]; x[j] = a ? hi[j] : lo[j]; x[k] = b ? hi[k] : lo[k];
        return f.p(x[0], x[1], x[2]);
      };
      const p = [c(0, 0), c(1, 0), c(1, 1), c(0, 1)];
      if (sign === 1) mb.quad(key, p[0], p[1], p[2], p[3]); else mb.quad(key, p[0], p[3], p[2], p[1]);
    }
  }
}

/** Front-facing rectangle in the facade plane at depth d (normal +d). */
function plate(mb: MeshBuilder, key: MaterialKey, f: Frame, u0: number, u1: number, v0: number, v1: number, d: number): void {
  if (u1 - u0 < 1e-6 || v1 - v0 < 1e-6) return;
  mb.quad(key, f.p(u0, v0, d), f.p(u1, v0, d), f.p(u1, v1, d), f.p(u0, v1, d));
}

/** Quad wound so its normal points away from `inside`. */
function quadAway(mb: MeshBuilder, key: MaterialKey, inside: V3, a: V3, b: V3, c: V3, d: V3): void {
  const n = [(b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])];
  const m: V3 = [(a[0] + b[0] + c[0] + d[0]) / 4 - inside[0], (a[1] + b[1] + c[1] + d[1]) / 4 - inside[1], (a[2] + b[2] + c[2] + d[2]) / 4 - inside[2]];
  if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] >= 0) mb.quad(key, a, b, c, d); else mb.quad(key, a, d, c, b);
}

const levelsOf = (levels: Levels, storeys: number): number[] => {
  if (Array.isArray(levels)) return levels.filter(k => k >= 0 && k < storeys);
  if (levels === 'ground') return [0];
  if (levels === 'upper') return Array.from({length: storeys - 1}, (_, i) => i + 1);
  return Array.from({length: storeys}, (_, i) => i);
};

function keys(p: Palette) {
  // #78: painted white trim (frames, surrounds, sills, fascias, bands, white doors and railings) is the measured trim white
  // (whiteTrim.ts); every other colour keeps the slot it always had.
  return {
    frame: trimKey('frame', p.frame, {slot: 'frame', tint: p.frame}),
    glass: {slot: 'glass', tint: p.glass} as MaterialKey,
    door: trimKey('door', p.door, {slot: 'door', tint: p.door}),
    accent: trimKey('accent', p.accent, {slot: 'stone', tint: p.accent}),
    rail: trimKey('rail', p.rail, {slot: 'door', tint: p.rail}),
    dark: {slot: 'door', tint: p.dark} as MaterialKey,
    column: trimKey('column', p.column, {slot: 'stucco', tint: p.column}),
    joint: {slot: 'door', tint: p.joint} as MaterialKey,
    wall: p.wall as MaterialKey,
    plinth: (p.plinth ?? p.wall) as MaterialKey,
    roof: p.roof as MaterialKey,
    gable: (p.gable ?? p.wall) as MaterialKey,
  };
}
type Keys = ReturnType<typeof keys>;

interface Ctx { mb: MeshBuilder; k: Keys; storeys: number; sh: number; variant: string; groundMode: 'solid' | 'pilotis'; recess: number; inset: {front: number; back: number}; key: (name: string) => MaterialKey }

/** Window joinery beyond the default 6 cm border (Element `frameM`, `transomM`): absent, the window is drawn exactly as before. */
interface Joinery { frameM?: number; transomM?: number; sash?: MaterialKey; sashM?: number; round?: boolean }

function windowUnit(c: Ctx, f: Frame, u: number, v0: number, w: number, h: number, lights: number, d0 = 0, frameKey?: MaterialKey, strips = false, withSill = true, joinery?: Joinery): void {
  const {mb} = c, k = frameKey ? {...c.k, frame: frameKey} : c.k;
  if (strips) {
    // Curtain walls and big glazing: the glass 4 cm proud of the wall, the frame as four border strips and the mullions 4.5 cm in
    // front of it. No plate lies over another closer than 4 cm, so long bands do not z-fight at distance (the stacked-plate frame does).
    const fw = 0.06, df = d0 + 0.085;
    plate(mb, k.glass, f, u - w / 2, u + w / 2, v0, v0 + h, d0 + 0.04);
    plate(mb, k.frame, f, u - w / 2 - fw, u + w / 2 + fw, v0 + h, v0 + h + fw, df);
    plate(mb, k.frame, f, u - w / 2 - fw, u + w / 2 + fw, v0 - fw, v0, df);
    plate(mb, k.frame, f, u - w / 2 - fw, u - w / 2, v0, v0 + h, df);
    plate(mb, k.frame, f, u + w / 2, u + w / 2 + fw, v0, v0 + h, df);
    for (let i = 1; i < lights; i++) plate(mb, k.frame, f, u - w / 2 + w * i / lights - 0.025, u - w / 2 + w * i / lights + 0.025, v0, v0 + h, df);
    if (withSill && v0 > 0.4) box(mb, k.accent, f, u - w / 2 - 0.15, u + w / 2 + 0.15, v0 - 0.11, v0 - 0.05, d0, d0 + 0.12, {back: true, bottom: true});
    return;
  }
  // Low-poly window: frame and glass are two stacked plates (the frame shows as the 6 cm border), no side faces.
  if (joinery && (joinery.frameM !== undefined || joinery.transomM !== undefined)) {
    // Chunky joinery (#75, 1950s timber windows): the frame border is `frameM` wide inside the opening (the opening keeps its measured
    // size), the mullions are as wide as half the border, and a transom bar `transomM` below the head splits off the top lights.
    const fm = joinery.frameM ?? 0.06, bar = Math.max(0.05, fm * 0.6);
    plate(mb, k.frame, f, u - w / 2, u + w / 2, v0, v0 + h, d0 + 0.04);
    if (joinery.round) {
      // #80 porthole: a 16-sided pane centred in the square frame (the frame plate shows round its corners).
      const r = Math.min(w, h) / 2 - fm, vc = v0 + h / 2, n = 16, at = (i: number) => f.p(u + r * Math.cos(2 * Math.PI * i / n), vc + r * Math.sin(2 * Math.PI * i / n), d0 + 0.05);
      for (let i = 0; i < n; i++) mb.tri(k.glass, f.p(u, vc, d0 + 0.05), at(i), at(i + 1));
    } else {
      // #80 sash: a ring of another colour inside the frame; the bars are sash, the glass sits inside the ring.
      const s = joinery.sash ? joinery.sashM ?? 0.05 : 0, barKey = joinery.sash ?? k.frame;
      if (joinery.sash) plate(mb, joinery.sash, f, u - w / 2 + fm, u + w / 2 - fm, v0 + fm, v0 + h - fm, d0 + 0.045);
      plate(mb, k.glass, f, u - w / 2 + fm + s, u + w / 2 - fm - s, v0 + fm + s, v0 + h - fm - s, d0 + 0.05);
      for (let i = 1; i < lights; i++) plate(mb, barKey, f, u - w / 2 + w * i / lights - bar / 2, u - w / 2 + w * i / lights + bar / 2, v0 + fm, v0 + h - fm, d0 + 0.055);
      if (joinery.transomM !== undefined && joinery.transomM > fm && joinery.transomM < h - fm) plate(mb, barKey, f, u - w / 2 + fm, u + w / 2 - fm, v0 + h - joinery.transomM - bar / 2, v0 + h - joinery.transomM + bar / 2, d0 + 0.055);
    }
    if (v0 > 0.4) box(mb, k.accent, f, u - w / 2 - 0.15, u + w / 2 + 0.15, v0 - 0.11, v0 - 0.05, d0, d0 + 0.12, {back: true, bottom: true});
    return;
  }
  plate(mb, k.frame, f, u - w / 2 - 0.06, u + w / 2 + 0.06, v0 - 0.06, v0 + h + 0.06, d0 + 0.04);
  plate(mb, k.glass, f, u - w / 2, u + w / 2, v0, v0 + h, d0 + 0.05);
  for (let i = 1; i < lights; i++) plate(mb, k.frame, f, u - w / 2 + w * i / lights - 0.025, u - w / 2 + w * i / lights + 0.025, v0, v0 + h, d0 + 0.055);
  if (v0 > 0.4) box(mb, k.accent, f, u - w / 2 - 0.15, u + w / 2 + 0.15, v0 - 0.11, v0 - 0.05, d0, d0 + 0.12, {back: true, bottom: true});
}

function balconyUnit(c: Ctx, f: Frame, u: number, floorV: number, w: number, depth: number, railing: 'bars' | 'slats' | 'solid'): void {
  const {mb, k} = c, h = 1.0;
  box(mb, k.accent, f, u - w / 2, u + w / 2, floorV - 0.16, floorV, 0, depth, {back: true});
  box(mb, k.dark, f, u - w / 2, u + w / 2, floorV - 0.16, floorV - 0.02, depth, depth + 0.03, {back: true, bottom: false});
  const x0 = u - w / 2 + 0.02, x1 = u + w / 2 - 0.02, dz = depth - 0.03;
  if (railing === 'solid') {
    box(mb, k.rail, f, x0, x1, floorV, floorV + h, dz - 0.04, dz);
    box(mb, k.rail, f, x0, x0 + 0.04, floorV, floorV + h, 0, dz - 0.04);
    box(mb, k.rail, f, x1 - 0.04, x1, floorV, floorV + h, 0, dz - 0.04);
    return;
  }
  // top rails (front + two returns), posts at the front corners
  box(mb, k.rail, f, x0, x1, floorV + h - 0.05, floorV + h, dz - 0.05, dz, {back: true, bottom: true});
  box(mb, k.rail, f, x0, x0 + 0.04, floorV + h - 0.05, floorV + h, 0, dz - 0.05, {back: true, bottom: true});
  box(mb, k.rail, f, x1 - 0.04, x1, floorV + h - 0.05, floorV + h, 0, dz - 0.05, {back: true, bottom: true});
  const pitch = railing === 'slats' ? 0.2 : 0.26, bar = railing === 'slats' ? 0.07 : 0.025;
  const n = Math.max(2, Math.round((x1 - x0) / pitch));
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * i / n;
    plate(mb, k.rail, f, x - bar / 2, x + bar / 2, floorV + 0.04, floorV + h - 0.05, dz);
  }
  // return bars (facing outwards on each side)
  const m = Math.max(1, Math.round(dz / 0.45));
  for (let i = 1; i < m; i++) {
    const d = dz * i / m;
    for (const sgn of [-1, 1]) {
      const xs = sgn < 0 ? x0 : x1, p0 = f.p(xs, floorV + 0.04, d - bar / 2), p1 = f.p(xs, floorV + 0.04, d + bar / 2), p2 = f.p(xs, floorV + h - 0.05, d + bar / 2), p3 = f.p(xs, floorV + h - 0.05, d - bar / 2);
      const inside = f.p(0.5 * (x0 + x1), floorV + h / 2, d);
      quadAway(mb, k.rail, inside, p0, p1, p2, p3);
    }
  }
}

/** Gallery (access deck) or continuous balcony band over [u0, u1]: slab to `depth`, parapet or infill panel under a top rail, optional fins (cross walls) up to the next slab. */
function galleryUnit(c: Ctx, f: Frame, u0: number, u1: number, floorV: number, depth: number, h: number, railing: 'solid' | 'panel', parapet: MaterialKey, fins: number): void {
  const {mb, k} = c, slabT = 0.25;
  box(mb, k.accent, f, u0, u1, floorV - slabT, floorV, 0, depth, {back: true});
  if (railing === 'solid') box(mb, parapet, f, u0, u1, floorV, floorV + h, depth - 0.14, depth, {back: false, bottom: true});
  else {
    plate(mb, parapet, f, u0, u1, floorV, floorV + h - 0.06, depth - 0.03);
    box(mb, k.column, f, u0, u1, floorV + h - 0.06, floorV + h, depth - 0.07, depth, {back: false, bottom: false});
  }
  for (let i = 0; i < fins; i++) {
    const u = fins === 1 ? (u0 + u1) / 2 : u0 + 0.1 + (u1 - u0 - 0.2) * i / (fins - 1);
    box(mb, k.column, f, u - 0.1, u + 0.1, floorV, floorV + c.sh - slabT, 0, depth - (railing === 'solid' ? 0.14 : 0.07), {back: true, bottom: true, top: true});
  }
}

function doorUnit(c: Ctx, f: Frame, u: number, w: number, h: number, steps: number, d0 = 0, v0 = 0, strips = false): void {
  const {mb, k} = c, rise = 0.17, lift = v0 + steps * rise;
  if (strips) {
    // the leaf 4 cm proud of the wall, glass panel and surround (jambs and head as strips) 4.5 cm in front of it: no stacked plates
    const df = d0 + 0.085;
    plate(mb, k.door, f, u - w / 2, u + w / 2, lift, lift + h, d0 + 0.04);
    plate(mb, k.glass, f, u - w / 2 + 0.14, u + w / 2 - 0.14, lift + h * 0.42, lift + h - 0.14, df);
    plate(mb, k.accent, f, u - w / 2 - 0.14, u - w / 2, v0, lift + h, df);
    plate(mb, k.accent, f, u + w / 2, u + w / 2 + 0.14, v0, lift + h, df);
    plate(mb, k.accent, f, u - w / 2 - 0.14, u + w / 2 + 0.14, lift + h, lift + h + 0.12, df);
    for (let i = 0; i < steps; i++) box(mb, k.accent, f, u - w / 2 - 0.35, u + w / 2 + 0.35, 0, (steps - i) * rise, d0 + 0.07, d0 + 0.07 + 0.3 * (i + 1));
    return;
  }
  box(mb, k.accent, f, u - w / 2 - 0.14, u + w / 2 + 0.14, v0, lift + h + 0.12, d0, d0 + 0.07);
  plate(mb, k.door, f, u - w / 2, u + w / 2, lift, lift + h, d0 + 0.075);
  plate(mb, k.glass, f, u - w / 2 + 0.14, u + w / 2 - 0.14, lift + h * 0.42, lift + h - 0.14, d0 + 0.08);
  for (let i = 0; i < steps; i++) box(mb, k.accent, f, u - w / 2 - 0.35, u + w / 2 + 0.35, 0, (steps - i) * rise, d0 + 0.07, d0 + 0.07 + 0.3 * (i + 1));
}

function storageDoor(c: Ctx, f: Frame, u: number, w: number, h: number, d0 = 0): void {
  const {mb, k} = c;
  box(mb, k.accent, f, u - w / 2 - 0.08, u + w / 2 + 0.08, 0, h + 0.08, d0, d0 + 0.05);
  plate(mb, k.door, f, u - w / 2, u + w / 2, 0, h, d0 + 0.055);
}

/**
 * #80 arched panel: a front plate whose top `rise` metres are a pointed parabolic arch (Amsterdam School portals), fanned from the
 * centre of its springing line and clipped to the bay [b0, b1], so a portal on a party line draws half in each pand.
 */
function archPanel(c: Ctx, f: Frame, u: number, w: number, v0: number, h: number, rise: number, d: number, key: MaterialKey, b0: number, b1: number): void {
  const cl = (x: number) => Math.min(b1, Math.max(b0, x)), vs = v0 + h - rise, n = 8;
  const x0 = cl(u - w / 2), x1 = cl(u + w / 2);
  if (x1 - x0 < 1e-3) return;
  plate(c.mb, key, f, x0, x1, v0, vs, d);
  const pt = (i: number): [number, number] => { const t = -1 + 2 * i / n; return [u + t * w / 2, vs + rise * (1 - t * t)]; };
  for (let i = 0; i < n; i++) {
    const [ua, va] = pt(i), [ub, vb] = pt(i + 1);
    const pa: [number, number] = [cl(ua), va], pb: [number, number] = [cl(ub), vb], pc: [number, number] = [cl(u), vs];
    if (Math.abs((pa[0] - pc[0]) * (pb[1] - pc[1]) - (pb[0] - pc[0]) * (pa[1] - pc[1])) < 1e-6) continue;
    c.mb.tri(key, f.p(pc[0], pc[1], d), f.p(pb[0], pb[1], d), f.p(pa[0], pa[1], d));
  }
}

/** Door hood: a thin slab `depth` out from the wall, topped (gable/arch) by a hood of rise `rise` whose ridge runs out from the wall. */
function canopyUnit(c: Ctx, f: Frame, u: number, w: number, v: number, depth: number, rise: number, shape: 'flat' | 'gable' | 'arch', key: MaterialKey, d0 = 0): void {
  const {mb} = c, slab = shape === 'flat' ? rise : 0.06, dOut = d0 + depth;
  box(mb, key, f, u - w / 2, u + w / 2, v, v + slab, d0, dOut, {back: true});
  if (shape === 'flat') return;
  // Profile across the hood (u, v) from left eave to right eave; extruded from the wall (d0) to the front (dOut).
  const n = shape === 'gable' ? 2 : 6, top = v + slab, prof: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    if (shape === 'gable') prof.push([u - w / 2 + w * i / n, top + (i === 1 ? rise : 0)]);
    else { const a = Math.PI * (1 - i / n); prof.push([u + Math.cos(a) * w / 2, top + Math.sin(a) * rise]); }
  }
  const inside = f.p(u, top - 0.01, (d0 + dOut) / 2);
  for (let i = 0; i < n; i++) quadAway(mb, key, inside, f.p(prof[i][0], prof[i][1], d0), f.p(prof[i + 1][0], prof[i + 1][1], d0), f.p(prof[i + 1][0], prof[i + 1][1], dOut), f.p(prof[i][0], prof[i][1], dOut));
  // front face (normal +d): a fan from the slab top centre
  for (let i = 0; i < n; i++) mb.tri(key, f.p(u, top, dOut), f.p(prof[i][0], prof[i][1], dOut), f.p(prof[i + 1][0], prof[i + 1][1], dOut));
}

/** Horizontal brick stripes over [vFrom, vTo], 1 cm proud of the wall, cut around the opening rectangles (u0, u1, v0, v1) they would cross. */
function stripesUnit(c: Ctx, f: Frame, len: number, vFrom: number, vTo: number, s: {pitchM: number; heightM: number; offsetM?: number; depthM?: number}, key: MaterialKey, openings: number[][]): void {
  const d = s.depthM ?? 0.01;
  for (let y = vFrom + (s.offsetM ?? 0); y < vTo - 0.02; y += s.pitchM) {
    const y1 = Math.min(vTo, y + s.heightM);
    const cuts = openings.filter(o => o[2] < y1 && o[3] > y).map(o => [Math.max(0, o[0]), Math.min(len, o[1])]).sort((p, q) => p[0] - q[0]);
    let u = 0;
    for (const [a, z] of [...cuts, [len, len]]) {
      if (a - u > 0.05) plate(c.mb, key, f, u, a, y, y1, d);
      u = Math.max(u, z);
    }
  }
}

/** Vertical battens over [vFrom, vTo] along the facade, skipping the opening rectangles (u0, u1, v0, v1) they would cross. */
function boardsUnit(c: Ctx, f: Frame, len: number, vFrom: number, vTo: number, b: {pitchM: number; widthM: number; depthM?: number}, key: MaterialKey, openings: number[][]): void {
  const n = Math.max(1, Math.round(len / b.pitchM)), pitch = len / n, d = b.depthM ?? 0.05;
  for (let i = 0; i < n; i++) {
    const x0 = (i + 0.5) * pitch - b.widthM / 2, x1 = x0 + b.widthM;
    const cuts = openings.filter(o => o[0] < x1 && o[1] > x0 && o[2] < vTo && o[3] > vFrom).map(o => [Math.max(vFrom, o[2]), Math.min(vTo, o[3])]).sort((p, q) => p[0] - q[0]);
    let v = vFrom;
    for (const [a, z] of [...cuts, [vTo, vTo]]) {
      if (a - v > 0.05) box(c.mb, key, f, x0, x1, v, a, 0, d, {back: true, bottom: true, top: true});
      v = Math.max(v, z);
    }
  }
}

function variantOk(e: Element, variant: string): boolean {
  return (!e.variants || e.variants.includes(variant)) && !(e.exceptVariants && e.exceptVariants.includes(variant));
}

interface Placed { u0: number; u1: number; bay: Bay }

/**
 * The bays of a facade seen in a mirror: order reversed, centre offsets negated, edge references swapped. An edge-referenced offset
 * (`ref` left/right) is a distance inward from that edge, so it keeps its value under the swapped reference.
 */
export function mirrorBays(bays: Bay[]): Bay[] {
  return [...bays].reverse().map(b => ({...b, elements: b.elements.map(e => (e.ref === 'left' ? {...e, ref: 'right' as const} : e.ref === 'right' ? {...e, ref: 'left' as const} : {...e, ...(e.u !== undefined ? {u: -e.u} : {})}))}));
}

export function layoutBays(bays: Bay[], length: number): Placed[] {
  const total = bays.reduce((s, b) => s + b.w, 0);
  let u = 0;
  return bays.map(bay => { const w = bay.w / total * length; const p = {u0: u, u1: u + w, bay}; u += w; return p; });
}

function placeFacade(c: Ctx, f: Frame, length: number, id: FacadeId, bays: Bay[], onGround: (bay: Bay, uc: number) => number, openings: number[][] = []): FacadeCount {
  const count: FacadeCount = {bays: bays.length, openingsPerUpperStorey: 0, groundDoors: 0, balconiesPerUpperStorey: 0};
  for (const {u0, u1, bay} of layoutBays(bays, length)) {
    const uc = (u0 + u1) / 2;
    for (const e of bay.elements) {
      if (!variantOk(e, c.variant)) continue;
      if (e.groundModes && !e.groundModes.includes(c.groundMode)) continue;
      const n = e.repeat ?? 1, slotW = (u1 - u0) / n;
      for (let r = 0; r < n; r++) {
      const u = n > 1 ? u0 + (r + 0.5) * slotW + (e.u ?? 0) : (e.ref === 'left' ? u0 + (e.u ?? 0) : e.ref === 'right' ? u1 - (e.u ?? 0) : uc + (e.u ?? 0));
      for (const kLevel of levelsOf(e.levels, c.storeys)) {
        const floor = kLevel * c.sh, d0 = kLevel === 0 ? onGround(bay, uc) : 0;
        const w = e.span || e.kind === 'gallery' ? slotW - 2 * (e.inset ?? 0) : e.w ?? 1, h = e.h ?? 1;
        switch (e.kind) {
          case 'window': case 'ribbon':
            windowUnit(c, f, u, floor + (e.sill ?? 0.9), w, h, e.lights ?? 1, d0, e.colour ? c.key(e.colour) : undefined, e.frameStyle === 'strips', true, e.frameM !== undefined || e.transomM !== undefined ? {frameM: e.frameM, transomM: e.transomM, ...(e.sash ? {sash: c.key(e.sash), sashM: e.sashM} : {}), ...(e.round ? {round: true} : {})} : undefined);
            openings.push([u - w / 2 - 0.06, u + w / 2 + 0.06, floor + (e.sill ?? 0.9) - 0.11, floor + (e.sill ?? 0.9) + h + 0.06]);
            if (kLevel === 1) count.openingsPerUpperStorey++;
            break;
          case 'gallery':
            galleryUnit(c, f, u - w / 2, u + w / 2, floor, e.depth ?? c.inset[id === 'back' ? 'back' : 'front'], e.h ?? 1.0, e.railing === 'panel' ? 'panel' : 'solid', c.key(e.colour ?? 'column'), e.fins ?? 0);
            break;
          case 'balcony':
            balconyUnit(c, f, u, floor, w, e.depth ?? 1.2, e.railing === 'panel' ? 'solid' : e.railing ?? 'bars');
            if (kLevel === 1) count.balconiesPerUpperStorey++;
            break;
          case 'door': doorUnit(c, f, u, w, h, e.steps ?? 0, d0, floor + (e.sill ?? 0), e.frameStyle === 'strips'); openings.push([u - w / 2 - 0.14, u + w / 2 + 0.14, floor + (e.sill ?? 0), floor + (e.sill ?? 0) + (e.steps ?? 0) * 0.17 + h + 0.12]); if (kLevel === 0) count.groundDoors++; break;
          case 'canopy': {
            const v = floor + (e.sill ?? 2.25), shape = e.canopy ?? 'flat';
            canopyUnit(c, f, u, w, v, e.depth ?? 0.6, h, shape, c.key(e.colour ?? 'accent'), d0);
            openings.push([u - w / 2, u + w / 2, v, v + (shape === 'flat' ? h : 0.06 + h)]);
            break;
          }
          case 'storageDoor': storageDoor(c, f, u, w, h, d0); if (kLevel === 0) count.groundDoors++; break;
          case 'vents': {
            const n = e.count ?? 3;
            for (let i = 0; i < n; i++) plate(c.mb, c.k.dark, f, u + (i - (n - 1) / 2) * 0.42 - 0.15, u + (i - (n - 1) / 2) * 0.42 + 0.15, floor + (e.sill ?? 1.6), floor + (e.sill ?? 1.6) + 0.14, d0 + 0.02);
            break;
          }
          case 'panel': {
            const key = (c.k as unknown as Record<string, MaterialKey>)[e.colour ?? 'frame'];
            if (e.archM !== undefined) archPanel(c, f, u, w, floor + (e.sill ?? 0), h, e.archM, d0 + (e.depth ?? 0.08), key, u0, u1);
            else box(c.mb, key, f, u - w / 2, u + w / 2, floor + (e.sill ?? 0), floor + (e.sill ?? 0) + h, d0, d0 + (e.depth ?? 0.08));
            break;
          }
        }
      }
      }
    }
  }
  void id;
  return count;
}

/** Concrete panel joints on the upper wall of one facade: horizontal runs and one vertical joint per panel column and row. */
function joints(c: Ctx, f: Frame, length: number, vFrom: number, vTo: number, panelW: number, panelH: number): void {
  const {mb, k} = c;
  const cols = Math.max(1, Math.round(length / panelW)), pw = length / cols;
  for (let v = vFrom + panelH; v < vTo - 0.2; v += panelH) plate(mb, k.joint, f, 0, length, v - 0.008, v + 0.008, 0.004);
  for (let v = vFrom; v < vTo - 0.3; v += panelH) for (let i = 1; i < cols; i++) plate(mb, k.joint, f, i * pw - 0.008, i * pw + 0.008, v, Math.min(v + panelH, vTo), 0.004);
}

/** One pitch through a front eaves `ef` (at +hw), a back eaves `eb` (at -hw) and the ridge height: slope tan and the ridge's offset t. */
export function asymSlope(hw: number, ef: number, eb: number, ridgeH: number): {tan: number; tRidge: number} {
  const tan = Math.max(0.05, (2 * ridgeH - ef - eb) / (2 * hw));
  return {tan, tRidge: Math.max(-hw, Math.min(hw, hw - (ridgeH - ef) / tan))};
}

/** Eaves-front gable (ridge along x) whose front and back eaves differ: both roof planes, soffit and the two four-cornered gable ends above `lower`. */
function asymGable(c: Ctx, p: {L: number; W: number; ef: number; eb: number; ridgeH: number; eavesOv: number; vergeOv: number; gableKey: MaterialKey}): void {
  const {mb, k} = c, hw = p.W / 2, {tan, tRidge} = asymSlope(hw, p.ef, p.eb, p.ridgeH), ov = p.eavesOv, a = p.L / 2 + p.vergeOv, b = hw + ov;
  const yf = p.ef - ov * tan, yb = p.eb - ov * tan, lower = Math.min(p.ef, p.eb);
  const inside: V3 = [0, (lower + p.ridgeH) / 2, 0];
  const apex: V3[] = [[-a, p.ridgeH, tRidge], [a, p.ridgeH, tRidge]];
  const fr: V3[] = [[-a, yf, b], [a, yf, b]], bk: V3[] = [[-a, yb, -b], [a, yb, -b]];
  // each plane faces away from a point on the ridge line at its own mid height; the soffit faces down
  quadAway(mb, k.roof, [0, (yf + p.ridgeH) / 2, tRidge], fr[0], fr[1], apex[1], apex[0]);
  quadAway(mb, k.roof, [0, (yb + p.ridgeH) / 2, tRidge], bk[0], bk[1], apex[1], apex[0]);
  quadAway(mb, k.roof, [0, p.ridgeH, 0], bk[0], bk[1], fr[1], fr[0]); // soffit
  for (const x of [-p.L / 2, p.L / 2]) {
    // the gable end above the wall box (which stops at `lower`): four corners, the lower eaves corner, the other side's two, the ridge
    const ring: V3[] = p.eb <= p.ef
      ? [[x, lower, -hw], [x, lower, hw], [x, p.ef, hw], [x, p.ridgeH, tRidge]]
      : [[x, lower, -hw], [x, lower, hw], [x, p.ridgeH, tRidge], [x, p.eb, -hw]];
    quadAway(mb, p.gableKey, inside, ring[0], ring[1], ring[2], ring[3]);
  }
}

function roofSolid(c: Ctx, p: {form: 'gable' | 'hip' | 'flat'; ridge: 'long' | 'short'; L: number; W: number; eaves: number; ridgeH: number; eavesOv: number; vergeOv: number; flatThickness: number; hipEnds?: {lo: boolean; hi: boolean}}): void {
  const {mb, k} = c;
  if (p.form === 'flat') {
    const ov = p.eavesOv, t = p.flatThickness;
    box(mb, k.roof, IDENTITY, -p.L / 2 - ov, p.L / 2 + ov, p.eaves - t, p.eaves, -p.W / 2 - ov, p.W / 2 + ov, {back: false, bottom: false});
    return;
  }
  // Map (s along the ridge, t across, y) to local x/z.
  const long = p.ridge === 'long';
  const S = long ? p.L : p.W, T = long ? p.W : p.L, hw = T / 2, rise = Math.max(0.1, p.ridgeH - p.eaves), tan = rise / hw;
  const to = (s: number, t: number, y: number): V3 => long ? [s, y, t] : [t, y, s];
  const ov = p.eavesOv, y0 = p.eaves - ov * tan, a = S / 2 + p.vergeOv, b = hw + ov;
  const inside = to(0, 0, (y0 + p.ridgeH) / 2);
  if (p.form === 'gable') {
    const apex = [to(-a, 0, p.ridgeH), to(a, 0, p.ridgeH)];
    const bl = [to(-a, -b, y0), to(a, -b, y0)], br = [to(-a, b, y0), to(a, b, y0)];
    quadAway(mb, k.roof, inside, bl[0], bl[1], apex[1], apex[0]);
    quadAway(mb, k.roof, inside, br[0], br[1], apex[1], apex[0]);
    quadAway(mb, k.roof, inside, bl[0], bl[1], br[1], br[0]); // soffit
    // gable ends in the wall material
    for (const [sIdx, sAt] of [[0, -a], [1, a]] as const) {
      void sIdx;
      // from the wall top (eaves line) up to the ridge: starting at the overhang's y0 / width b would lie in the side wall's plane (coplanar overlap, z-fighting)
      const tri = [to(sAt, -hw, p.eaves), to(sAt, hw, p.eaves), to(sAt, 0, p.ridgeH)];
      quadAway(mb, k.wall, inside, tri[0], tri[1], tri[2], tri[2]);
    }
  } else if (p.hipEnds) {
    // Terraced row end (spec.roof.hipFreeEnds, #77): hipped only at the free end(s), a gable against the neighbour, so a hipped
    // row-end house meets its neighbour's ridge instead of notching the row. Hip run = half the depth (equal pitch).
    const sLo = p.hipEnds.lo ? -S / 2 - ov : -a, sHi = p.hipEnds.hi ? S / 2 + ov : a;
    const rLo = p.hipEnds.lo ? Math.min(-S / 2 + hw, sHi) : -a, rHi = p.hipEnds.hi ? Math.max(S / 2 - hw, rLo) : a;
    const r0 = to(rLo, 0, p.ridgeH), r1 = to(rHi, 0, p.ridgeH);
    const A = to(sLo, -b, y0), B = to(sHi, -b, y0), C = to(sHi, b, y0), D = to(sLo, b, y0);
    quadAway(mb, k.roof, inside, A, B, r1, r0);
    quadAway(mb, k.roof, inside, D, C, r1, r0);
    quadAway(mb, k.roof, inside, A, B, C, D);
    for (const [hipped, sAt, edge, corner0, corner1, r] of [[p.hipEnds.lo, -S / 2, -a, A, D, r0], [p.hipEnds.hi, S / 2, a, B, C, r1]] as const) {
      if (hipped) quadAway(mb, k.roof, inside, corner0, corner1, r, r);
      else { const tri = [to(edge, -hw, p.eaves), to(edge, hw, p.eaves), to(edge, 0, p.ridgeH)]; quadAway(mb, k.wall, inside, tri[0], tri[1], tri[2], tri[2]); void sAt; }
    }
  } else {
    const rl = Math.max(0, S / 2 - hw); // hip ridge half-length (45 degree hips, equal pitch)
    const r0 = to(-rl, 0, p.ridgeH), r1 = to(rl, 0, p.ridgeH);
    const A = to(-a, -b, y0), B = to(a, -b, y0), C = to(a, b, y0), D = to(-a, b, y0);
    quadAway(mb, k.roof, inside, A, B, r1, r0);
    quadAway(mb, k.roof, inside, D, C, r1, r0);
    quadAway(mb, k.roof, inside, A, D, r0, r0);
    quadAway(mb, k.roof, inside, B, C, r1, r1);
    quadAway(mb, k.roof, inside, A, B, C, D);
  }
}

/** Height of the front slope (+z side) of a long-ridge gable at depth z (0 at the ridge), and the downslope step per metre of z. */
function frontSlope(L: number, W: number, eaves: number, ridgeH: number, eavesOv: number, backEaves?: number) {
  const hw = W / 2;
  if (backEaves !== undefined) {
    const {tan, tRidge} = asymSlope(hw, eaves, backEaves, ridgeH);
    return {tan, y: (z: number) => ridgeH - tan * (z - tRidge), zEave: hw + eavesOv, y0: eaves - eavesOv * tan, zRidge: tRidge};
  }
  const rise = Math.max(0.1, ridgeH - eaves), tan = rise / hw, y0 = eaves - eavesOv * tan;
  return {tan, y: (z: number) => ridgeH - tan * z, zEave: hw + eavesOv, y0, zRidge: 0};
}

/** Roof windows on the front slope of an eaves-front gable. */
function roofFeatures(c: Ctx, spec: TypeSpec, L: number, W: number, eaves: number, ridgeH: number, mirror: boolean, backEaves?: number): void {
  const {mb, k} = c, v = spec.variants[c.variant], r = {...spec.roof, rooflights: v.rooflights ?? spec.roof.rooflights}, sl = frontSlope(L, W, eaves, ridgeH, r.eavesOverhangM, backEaves), n = Math.hypot(1, sl.tan);
  // z of a slope position 0 (eaves) .. 1 (ridge); the ridge line stands at z = sl.zRidge (0 unless the gable is asymmetric)
  const alongZ = backEaves === undefined ? (a: number) => (1 - a) * (W / 2 + r.eavesOverhangM) : (a: number) => sl.zRidge + (1 - a) * (W / 2 + r.eavesOverhangM - sl.zRidge);
  for (const uf of r.rooflights?.u ?? []) {
    const u = -L / 2 + (mirror ? 1 - uf : uf) * L, z0 = alongZ(r.rooflights!.along), w = r.rooflights!.w, hz = r.rooflights!.h / n; // slope length h spans hz in z
    const off = 0.03; // metres above the plane along its normal (normal = (0, 1, tan) / n)
    const P = (x: number, z: number, e: number): V3 => [x, sl.y(z) + e * (1 / n), z + e * (sl.tan / n)];
    for (const [pad, key, e] of [[0.07, k.frame, off], [0, k.glass, off + 0.012]] as const) {
      mb.quad(key, P(u - w / 2 - pad, z0 + hz / 2 + pad / n, e), P(u + w / 2 + pad, z0 + hz / 2 + pad / n, e), P(u + w / 2 + pad, z0 - hz / 2 - pad / n, e), P(u - w / 2 - pad, z0 - hz / 2 - pad / n, e));
    }
  }
  for (const d of spec.roof.dormers ?? []) {
    if ((d.variants && !d.variants.includes(c.variant)) || d.exceptVariants?.includes(c.variant)) continue;
    dormerUnit(c, d, L, W, sl, ridgeH, mirror);
  }
}

/** Triangle wound so its normal points away from `inside`. */
function triAway(mb: MeshBuilder, key: MaterialKey, inside: V3, a: V3, b: V3, c: V3): void {
  const n = [(b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])];
  const m = [(a[0] + b[0] + c[0]) / 3 - inside[0], (a[1] + b[1] + c[1]) / 3 - inside[1], (a[2] + b[2] + c[2]) / 3 - inside[2]];
  if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] >= 0) mb.tri(key, a, b, c); else mb.tri(key, a, c, b);
}

/**
 * A flat-roofed dormer on the front slope `sl`: the front face stands `setBackM` behind the wall line from the roof plane up `h`, the
 * cheeks run back to where the plane reaches the dormer roof. A dormer flush with the frontage end (a half dormer completed by the
 * mirrored neighbour's) gets no roof overhang there and its glazing runs on to the edge; the cheek stays (hidden inside the pair's
 * dormer, closing it at a row end), so the unit does not depend on which sides are party walls.
 */
function dormerUnit(c: Ctx, d: DormerSpec, L: number, W: number, sl: ReturnType<typeof frontSlope>, ridgeH: number, mirror: boolean): void {
  const {mb} = c, cheek = c.key(d.cheek ?? 'column'), frameKey = c.key(d.frame ?? 'frame');
  let uc = d.ref === 'left' ? d.u : d.ref === 'right' ? L - d.u : L / 2 + d.u;
  if (mirror) uc = L - uc;
  const x0 = Math.max(-L / 2, -L / 2 + uc - d.w / 2), x1 = Math.min(L / 2, -L / 2 + uc + d.w / 2);
  if (x1 - x0 < 0.3) return;
  const zf = W / 2 - d.setBackM, yb = sl.y(zf), yt = Math.min(yb + d.h, ridgeH - 0.15), roofT = 0.12;
  if (yt - yb < 0.3) return;
  const zBack = sl.zRidge + (ridgeH - yt - roofT) / sl.tan;
  const wallL = x0 <= -L / 2 + 1e-6, wallR = x1 >= L / 2 - 1e-6, ov = d.overhangM ?? 0.12;
  const inside: V3 = [(x0 + x1) / 2, (yb + yt) / 2, (zf + zBack) / 2];
  quadAway(mb, cheek, inside, [x0, yb, zf], [x1, yb, zf], [x1, yt, zf], [x0, yt, zf]);
  triAway(mb, cheek, inside, [x0, yb, zf], [x0, yt, zf], [x0, yt, zBack]);
  triAway(mb, cheek, inside, [x1, yb, zf], [x1, yt, zf], [x1, yt, zBack]);
  box(mb, cheek, IDENTITY, x0 - (wallL ? 0 : ov), x1 + (wallR ? 0 : ov), yt, yt + roofT, zBack, zf + ov, {back: true});
  // glazing: frame plate, glass, mullions (as a low-poly window), inset from the cheeks
  const m = d.marginM ?? 0.12, me = d.marginEndM ?? m / 2, gx0 = x0 + (wallL ? me : m), gx1 = x1 - (wallR ? me : m), gy0 = yb + 0.12, gy1 = yt - 0.1, f = new Frame([0, zf], [1, 0], [0, 1]);
  if (gx1 - gx0 > 0.2 && gy1 - gy0 > 0.2) {
    plate(mb, frameKey, f, gx0, gx1, gy0, gy1, 0.01);
    plate(mb, c.k.glass, f, gx0 + 0.06, gx1 - 0.06, gy0 + 0.06, gy1 - 0.06, 0.02);
    for (let i = 1; i < d.lights; i++) { const x = gx0 + (gx1 - gx0) * i / d.lights; plate(mb, frameKey, f, x - 0.03, x + 0.03, gy0, gy1, 0.025); }
  }
  if (d.apronM) {
    const za = Math.min(zf + d.apronM, W / 2), lift = 0.03;
    mb.quad(c.k.rail, [x0, sl.y(za) + lift, za], [x1, sl.y(za) + lift, za], [x1, yb + lift, zf], [x0, yb + lift, zf]);
  }
}

/**
 * Half of a pair's front-facing gable: a mono-pitch roof rising across the frontage from the eaves at the free side (-x, or +x
 * mirrored) to the ridge on the shared party wall, the front/back gable triangles in the gable material (battens optional) and
 * the party-wall face above the eaves.
 */
function pairGableRoof(c: Ctx, spec: TypeSpec, frames: Record<FacadeId, {f: Frame; len: number}>, L: number, W: number, eaves: number, ridgeH: number, mirror: boolean, gableKey: MaterialKey): void {
  // eavesOverhangM over the low side (0 where the low eaves of two pairs meet in a valley gutter, the usual case)
  const {mb, k} = c, s = mirror ? -1 : 1, tan = Math.max(0.05, (ridgeH - eaves) / L), ov = spec.roof.eavesOverhangM, vz = W / 2 + spec.roof.vergeOverhangM;
  const h = (x: number) => eaves + (s * x + L / 2) * tan, xl = -s * (L / 2 + ov), xh = s * L / 2;
  const low = h(xl), inside: V3 = [0, eaves - 1, 0], above: V3 = [0, ridgeH + 5, 0];
  quadAway(mb, k.roof, inside, [xl, low, -vz], [xl, low, vz], [xh, ridgeH, vz], [xh, ridgeH, -vz]);
  quadAway(mb, k.roof, above, [xl, low - 0.01, -vz], [xl, low - 0.01, vz], [xh, ridgeH - 0.01, vz], [xh, ridgeH - 0.01, -vz]); // soffit
  for (const z of [-W / 2, W / 2]) triAway(mb, gableKey, [0, (eaves + ridgeH) / 2, 0], [-xh, eaves, z], [xh, eaves, z], [xh, ridgeH, z]);
  quadAway(mb, k.wall, [0, (eaves + ridgeH) / 2, 0], [xh, eaves, -W / 2], [xh, eaves, W / 2], [xh, ridgeH, W / 2], [xh, ridgeH, -W / 2]);
  const b = spec.roof.pairGable?.boards;
  if (!b) return;
  const key = c.key(b.palette), n = Math.max(1, Math.round(L / b.pitchM)), pitch = L / n;
  for (const id of ['front', 'back'] as const) {
    const {f} = frames[id];
    for (let i = 0; i < n; i++) {
      const u0 = (i + 0.5) * pitch - b.widthM / 2, u1 = u0 + b.widthM;
      const xa = id === 'front' ? -L / 2 + u0 : L / 2 - u0, xb = id === 'front' ? -L / 2 + u1 : L / 2 - u1;
      const top = Math.min(h(xa), h(xb)) - 0.04;
      if (top - eaves > 0.1) box(mb, key, f, u0, u1, eaves, top, 0, b.depthM ?? 0.04, {back: true, bottom: true, top: true});
    }
  }
}

/**
 * Chimney stacks on the ridge line (z = zRidge) of a long-ridge gable or hip: each shaft starts below the roof surface at its lower
 * (front or back) face so it never floats, rises `h` above the ridge, and carries an optional oversailing cap course.
 */
function chimneysUnit(c: Ctx, list: ChimneySpec[], L: number, eaves: number, ridgeH: number, tan: number, zRidge: number, mirror: boolean): void {
  const {mb} = c;
  for (const ch of list) {
    if ((ch.variants && !ch.variants.includes(c.variant)) || ch.exceptVariants?.includes(c.variant)) continue;
    let uc = ch.ref === 'left' ? ch.u : ch.ref === 'right' ? L - ch.u : L / 2 + ch.u;
    if (mirror) uc = L - uc;
    const x = -L / 2 + uc, z = zRidge + (ch.offsetM ?? 0), top = ridgeH + ch.h, cap = ch.capM ?? 0;
    // lowest roof point under the shaft footprint (the plane falls `tan` per metre away from the ridge line), 5 cm into the roof
    const y0 = Math.max(eaves, ridgeH - tan * (Math.abs(z - zRidge) + ch.d / 2) - 0.05);
    box(mb, c.key(ch.palette ?? 'wall'), IDENTITY, x - ch.w / 2, x + ch.w / 2, y0, top - cap, z - ch.d / 2, z + ch.d / 2, {back: false, bottom: true, top: cap > 0});
    if (cap > 0) box(mb, c.key(ch.cap ?? 'accent'), IDENTITY, x - ch.w / 2 - 0.05, x + ch.w / 2 + 0.05, top - cap, top, z - ch.d / 2 - 0.05, z + ch.d / 2 + 0.05, {back: false, bottom: false});
  }
}

export function heightOf(h: Height, sh: number, eavesM: number): number {
  if (typeof h === 'number') return h;
  if ('storey' in h) return h.storey * sh + (h.plus ?? 0);
  return eavesM + h.eaves;
}

/**
 * Segmental bay: the outer face is the arc through (u0, d0), ((u0 + u1) / 2, d1), (u1, d0), drawn as `segments` facets from v0 to the
 * fascia; a cap course (fascia) on the same facets 3 cm proud, a flat top fanned from the chord centre, and per-facet glazing (faces 'out').
 */
function segmentBay(c: Ctx, f: Frame, a: Annex, u0: number, u1: number, v0: number, v1: number): void {
  const {mb, k} = c, [d0, d1] = a.d, n = Math.max(2, Math.round(a.segments ?? 5)), mat = c.key(a.material ?? 'plinth');
  const half = (u1 - u0) / 2, sag = d1 - d0, R = (half * half + sag * sag) / (2 * sag), cu = (u0 + u1) / 2, cd = d1 - R, ang = Math.asin(Math.min(1, half / R));
  const pt = (i: number, grow = 0): [number, number] => { const t = -ang + 2 * ang * i / n; return [cu + (R + grow) * Math.sin(t), cd + (R + grow) * Math.cos(t)]; };
  const fasciaH = a.fascia?.h ?? 0, top = v1 - fasciaH, inside = f.p(cu, (v0 + v1) / 2, d0 - 0.01);
  const quad = (key: MaterialKey, p: [number, number], q: [number, number], y0: number, y1: number) => quadAway(mb, key, inside, f.p(p[0], y0, p[1]), f.p(q[0], y0, q[1]), f.p(q[0], y1, q[1]), f.p(p[0], y1, p[1]));
  for (let i = 0; i < n; i++) quad(mat, pt(i), pt(i + 1), v0, top);
  const capKey = a.fascia ? c.key(a.fascia.colour ?? 'column') : mat;
  if (fasciaH > 0) for (let i = 0; i < n; i++) quad(capKey, pt(i, 0.03), pt(i + 1, 0.03), top, v1);
  const grow = fasciaH > 0 ? 0.03 : 0, chord = f.p(cu, v1, d0);
  for (let i = 0; i < n; i++) { const p = pt(i, grow), q = pt(i + 1, grow); triAway(mb, capKey, [chord[0], v1 - 1, chord[2]], chord, f.p(p[0], v1, p[1]), f.p(q[0], v1, q[1])); }
  for (const g of a.glaze === undefined ? [] : Array.isArray(a.glaze) ? a.glaze : [a.glaze]) {
    if (!g.faces.includes('out')) continue;
    const frameKey = c.key(g.frame ?? 'frame'), m = g.marginM ?? 0.06, h = Math.min(g.h, top - v0 - g.sill - 0.05);
    if (h <= 0.1) continue;
    for (let i = 0; i < n; i++) {
      const p = pt(i), q = pt(i + 1), len = Math.hypot(q[0] - p[0], q[1] - p[1]), w = len - 2 * m;
      if (w <= 0.2) continue;
      // facet frame: u along the facet (p -> q), d outward (away from the arc centre)
      const t: [number, number] = [(q[0] - p[0]) / len, (q[1] - p[1]) / len], o = f.p(p[0], 0, p[1]);
      const ff = new Frame([o[0], o[2]], [f.t[0] * t[0] + f.n[0] * t[1], f.t[1] * t[0] + f.n[1] * t[1]], [-f.t[0] * t[1] + f.n[0] * t[0], -f.t[1] * t[1] + f.n[1] * t[0]]);
      windowUnit(c, ff, len / 2, v0 + g.sill, w, h, Math.max(1, Math.round(w / g.lightM)), 0, frameKey, true, false);
    }
  }
  void k;
}

/** One annex volume in the frame of its rectangle edge (u along the edge, d outward). */
function annexUnit(c: Ctx, f: Frame, a: Annex, [u0, u1]: [number, number], v0: number, v1: number): void {
  const {mb, k} = c, [d0, d1] = a.d, mat = c.key(a.material ?? 'plinth');
  const fasciaH = a.fascia?.h ?? 0, fascia = a.fascia ? c.key(a.fascia.colour ?? 'column') : null;
  if (a.kind === 'openStair') {
    const screen = c.key(a.screen ?? 'rail');
    const capBottom = v1 - Math.max(0.3, fasciaH);
    for (let s = Math.ceil(v0 / c.sh - 1e-6); s * c.sh < v1 - 0.5; s++) {
      const fl = s * c.sh;
      if (s > 0) box(mb, k.accent, f, u0, u1, fl - 0.25, fl, d0, d1, {back: true});
      // screen on the outer face and the free end, one storey high (or `screenH`), never into the cap
      const sh2 = Math.min(a.screenH ?? c.sh - 0.25, c.sh - 0.25, capBottom - fl);
      if (sh2 < 0.05) continue;
      plate(mb, screen, f, u0, u1, fl, fl + sh2, d1);
      const end = new Frame(f.p(u0, 0, d1).filter((_, i) => i !== 1) as [number, number], [-f.n[0], -f.n[1]], [-f.t[0], -f.t[1]]);
      plate(mb, screen, end, 0, d1 - d0, fl, fl + sh2, 0);
    }
    box(mb, fascia ?? k.accent, f, u0, u1, v1 - Math.max(0.3, fasciaH), v1, d0, d1, {back: true});
    return;
  }
  if (a.plan === 'segment') { segmentBay(c, f, a, u0, u1, v0, v1); return; }
  // A door row recesses the outer face by 12 cm between brick piers (the doors stand 4 cm proud of the recess), a lintel above them.
  const recess = a.doors ? 0.12 : 0;
  box(mb, mat, f, u0, u1, v0, v1 - fasciaH, d0, d1 - recess, {back: d0 >= -1e-6, bottom: v0 < 1e-6, top: fasciaH > 0});
  if (fascia) {
    // the fascia is a 0.4 m deep edge (a parapet lip); behind it the annex roof is in the roof material, 5 cm under the lip's top
    const lip = Math.max(d0, d1 - 0.4);
    box(mb, fascia, f, u0 - 0.03, u1 + 0.03, v1 - fasciaH, v1, lip, d1 + 0.04, {back: lip > d0 + 1e-6 ? false : d0 >= -1e-6, bottom: false});
    if (lip > d0 + 1e-6) box(mb, k.roof, f, u0, u1, v1 - fasciaH, v1 - 0.05, d0, lip, {back: d0 >= -1e-6, bottom: true});
  }
  const out = new Frame(f.p(u0, 0, d1).filter((_, i) => i !== 1) as [number, number], f.t, f.n);
  if (a.doors) {
    const dr = a.doors, m = dr.marginM ?? 0, n = Math.max(1, Math.floor((u1 - u0 - 2 * m) / dr.pitchM)), start = (u1 - u0 - n * dr.pitchM) / 2, top = v1 - fasciaH;
    const edges = [0, ...Array.from({length: n}, (_, i) => [start + (i + 0.5) * dr.pitchM - dr.w / 2, start + (i + 0.5) * dr.pitchM + dr.w / 2]).flat(), u1 - u0];
    for (let i = 0; i < edges.length; i += 2) box(mb, mat, out, edges[i], edges[i + 1], v0, top, -recess, 0, {back: true, bottom: v0 < 1e-6, top: fasciaH > 0});
    for (let i = 1; i < edges.length - 1; i += 2) {
      box(mb, mat, out, edges[i], edges[i + 1], v0 + dr.h, top, -recess, 0, {back: true, bottom: false, top: fasciaH > 0});
      plate(mb, c.key(dr.colour ?? 'door'), out, edges[i], edges[i + 1], v0, v0 + dr.h, -recess + 0.04);
    }
  }
  for (const g of a.glaze === undefined ? [] : Array.isArray(a.glaze) ? a.glaze : [a.glaze]) {
    const frameKey = c.key(g.frame ?? 'frame'), m = g.marginM ?? 0.15;
    const faces: {fr: Frame; len: number}[] = [];
    for (const face of g.faces) {
      if (face === 'out') faces.push({fr: out, len: u1 - u0});
      else if (face === 'left') faces.push({fr: new Frame(f.p(u0, 0, d1).filter((_, i) => i !== 1) as [number, number], [-f.n[0], -f.n[1]], [-f.t[0], -f.t[1]]), len: d1 - Math.max(d0, 0)});
      else faces.push({fr: new Frame(f.p(u1, 0, Math.max(d0, 0)).filter((_, i) => i !== 1) as [number, number], [f.n[0], f.n[1]], [f.t[0], f.t[1]]), len: d1 - Math.max(d0, 0)});
    }
    for (const {fr, len} of faces) {
      const w = len - 2 * m;
      if (w > 0.3) windowUnit(c, fr, len / 2, v0 + g.sill, w, Math.min(g.h, v1 - fasciaH - v0 - g.sill - 0.05), Math.max(1, Math.round(w / g.lightM)), 0, frameKey, true, false);
    }
  }
}

export function generate(spec: TypeSpec, params: GenerateParams): {mesh: MeshBuilder; report: GenerateReport} {
  const variant = params.variant ?? spec.defaultVariant, v = spec.variants[variant];
  if (!v) throw new Error(`unknown variant ${variant} for ${spec.id}`);
  const L = params.lengthM, W = params.widthM, storeys = params.storeys ?? spec.storeys;
  if (L < W && !spec.frontOnShort) throw new Error('lengthM must be the long side (front is a long side)');
  // a pair gable is one pitched form whatever 3DBAG calls the single plane (its ridge runs front to back: 'short' on the terraced frame)
  const pairGable = !!spec.roof.pairGable && (params.roofForm ?? spec.roof.form) !== 'flat';
  const roofForm = pairGable ? 'gable' : params.roofForm ?? spec.roof.form, ridge = pairGable ? 'short' : params.ridge ?? spec.roof.ridge;
  const groundMode = params.groundMode ?? spec.ground.mode;
  const pitched = roofForm !== 'flat';
  // asymmetric eaves-front gable: the wall box stops at the lower eaves; the higher facade and the gable ends carry on above it
  const asym = pitched && roofForm === 'gable' && ridge === 'long' && params.backEavesM != null && Math.abs(params.backEavesM - params.eavesM) > 1e-6;
  const backEaves = asym ? params.backEavesM! : params.eavesM;
  const flatT = 0.22, wallTop = asym ? Math.min(params.eavesM, backEaves) : pitched ? params.eavesM : params.eavesM - flatT;
  const sh = params.eavesM / storeys;
  const mb = new MeshBuilder(), k = keys(v.palette), inset = spec.insetM ?? {front: 0, back: 0};
  const key = (name: string): MaterialKey => { const m = (k as unknown as Record<string, MaterialKey>)[name]; if (!m) throw new Error(`${spec.id}: unknown palette key ${name}`); return m; };
  const ctx: Ctx = {mb, k, storeys, sh, variant, groundMode, recess: spec.ground.recessM ?? 0, inset, key};
  // Wall lines: the footprint rectangle's long edges unless the rectangle includes galleries/balconies (insetM).
  const zf = W / 2 - inset.front, zb = -W / 2 + inset.back, gabled = !!v.palette.gable && !pairGable; // a pair gable's `gable` palette is its front/back triangles, not the side walls
  const pilotis = groundMode === 'pilotis', rec = pilotis ? spec.ground.recessM ?? 1.5 : 0;
  ctx.recess = rec;

  // Facade frames: front +z, back -z, right +x, left -x (viewer outside, left to right).
  const frames: Record<FacadeId, {f: Frame; len: number}> = {
    front: {f: new Frame([-L / 2, zf], [1, 0], [0, 1]), len: L},
    back: {f: new Frame([L / 2, zb], [-1, 0], [0, -1]), len: L},
    right: {f: new Frame([L / 2, zf], [0, -1], [1, 0]), len: zf - zb},
    left: {f: new Frame([-L / 2, zb], [0, 1], [-1, 0]), len: zf - zb},
  };

  // Wall volumes.
  const slabBelow = 0.5; // pilotis: white slab edge under the first floor
  // #80: a plinth of several storeys (ground.plinthStoreys); one storey (sh) when absent.
  const plinthTop = spec.ground.plinthStoreys ? Math.min(spec.ground.plinthStoreys, storeys - 1) * sh : sh;
  const lowTop = pilotis ? sh - slabBelow : sh;
  if (pilotis) {
    const core = spec.facades.front.bays.length ? layoutBays(spec.facades.front.bays, L).filter(p => p.bay.core) : [];
    box(mb, k.column, IDENTITY, -L / 2, L / 2, sh - slabBelow, sh, zb, zf, {back: false, bottom: false, top: true});
    box(mb, k.wall, IDENTITY, -L / 2, L / 2, sh, wallTop, zb, zf, {back: false, bottom: true, ends: gabled});
    // recessed ground wall, full length
    box(mb, k.door, IDENTITY, -L / 2, L / 2, 0, lowTop, zb + rec, zf - rec, {back: false, bottom: true, top: true});
    for (const p of core) box(mb, k.plinth, IDENTITY, -L / 2 + p.u0, -L / 2 + p.u1, 0, lowTop, zb, zf, {back: false, bottom: true, top: true});
    // columns along both long facades, outside the core, plus the four corners
    const pitch = spec.ground.columnPitchM ?? 3.4, cw = spec.ground.columnM ?? 0.42;
    const inCore = (x: number) => core.some(p => x > -L / 2 + p.u0 - cw && x < -L / 2 + p.u1 + cw);
    const n = Math.max(1, Math.round(L / pitch));
    for (let i = 0; i <= n; i++) {
      const x = -L / 2 + L * i / n, xc = Math.min(L / 2 - cw / 2, Math.max(-L / 2 + cw / 2, x));
      if (inCore(xc)) continue;
      for (const z of [zf - cw / 2, zb + cw / 2]) box(mb, k.column, IDENTITY, xc - cw / 2, xc + cw / 2, 0, lowTop, z - cw / 2, z + cw / 2, {back: false, bottom: true, top: true});
    }
  } else {
    if (v.palette.plinth && !spec.ground.plinthM) {
      box(mb, k.plinth, IDENTITY, -L / 2, L / 2, 0, plinthTop, zb, zf, {back: false, bottom: true, top: true});
      box(mb, k.wall, IDENTITY, -L / 2, L / 2, plinthTop, wallTop, zb, zf, {back: false, bottom: true, ends: gabled});
    } else box(mb, k.wall, IDENTITY, -L / 2, L / 2, 0, wallTop, zb, zf, {back: false, bottom: true, ends: gabled});
  }
  // Gable walls in their own material (the wall box above leaves its ends open), from the top of a plinth/pilotis storey.
  if (gabled) for (const id of ['left', 'right'] as const) plate(mb, k.gable, frames[id].f, 0, frames[id].len, pilotis ? sh : v.palette.plinth && !spec.ground.plinthM ? plinthTop : 0, wallTop, 0);
  // Columns at the rectangle edge under the cantilevered decks (inset types).
  for (const id of spec.ground.columns?.facades ?? []) {
    const cs = spec.ground.columns!, {f, len} = frames[id], n = Math.max(1, Math.round(len / cs.pitchM)), dOut = inset[id];
    for (let i = 0; i <= n; i++) {
      const u = Math.min(len - cs.sizeM / 2, Math.max(cs.sizeM / 2, len * i / n));
      box(mb, k.column, f, u - cs.sizeM / 2, u + cs.sizeM / 2, 0, cs.toM ?? sh, dOut - cs.sizeM, dOut, {back: false, bottom: true, top: true});
    }
  }

  const coreX = layoutBays(spec.facades.front.bays, L).filter(p => p.bay.core).map(p => [-L / 2 + p.u0, -L / 2 + p.u1] as const);
  const onGround = (id: FacadeId) => (bay: Bay, uc: number) => {
    if (!pilotis || (id !== 'front' && id !== 'back')) return 0;
    const x = id === 'front' ? -L / 2 + uc : L / 2 - uc;
    return coreX.some(([a, b]) => x >= a - 0.01 && x <= b + 0.01) ? 0 : -rec;
  };
  const facades = {} as Record<FacadeId, FacadeCount>;
  const free = params.freeSides ?? {left: true, right: true};
  for (const id of FACADE_IDS) {
    if ((id === 'left' && !free.left) || (id === 'right' && !free.right)) { facades[id] = {bays: 0, openingsPerUpperStorey: 0, groundDoors: 0, balconiesPerUpperStorey: 0}; continue; }
    const {f, len} = frames[id], fs = spec.facades[id];
    const bays = params.mirror && (id === 'front' || id === 'back') ? mirrorBays(fs.bays) : fs.bays;
    const openings: number[][] = [];
    // asymmetric gable: a back raised above the front eaves gets taller storeys; front/back boards run up to their own eaves
    const fSh = asym && id === 'back' && backEaves > params.eavesM ? backEaves / storeys : sh;
    const fTop = asym && id === 'front' ? params.eavesM : asym && id === 'back' ? backEaves : wallTop;
    if (fSh !== sh) ctx.sh = fSh;
    facades[id] = placeFacade(ctx, f, len, id, bays, onGround(id), openings);
    ctx.sh = sh;
    for (const b of fs.boards ?? []) for (const lv of levelsOf(b.levels, storeys)) boardsUnit(ctx, f, len, lv * fSh, lv === storeys - 1 ? fTop : (lv + 1) * fSh, b, key(b.palette), openings);
    for (const st of fs.stripes ?? []) for (const lv of levelsOf(st.levels, storeys)) stripesUnit(ctx, f, len, lv * fSh, lv === storeys - 1 ? fTop : (lv + 1) * fSh, st, key(st.palette), openings);
    if (v.palette.plinth && spec.ground.plinthM && !pilotis) box(mb, k.plinth, f, 0, len, 0, spec.ground.plinthM, 0, 0.025, {back: true, bottom: true});
    if (v.joints && fs.joints) joints(ctx, f, len, sh, wallTop, fs.joints.panelW, fs.joints.panelH);
    for (const band of fs.bands ?? []) for (const lv of band.levels ? levelsOf(band.levels, storeys) : [band.floor]) {
      const y = lv * sh;
      box(mb, key(band.palette ?? 'column'), f, -0.0, len, y - band.below, y + band.above, 0, 0.05);
    }
  }
  // pilotis: slab fascia is the white column box above; the soffit shows from below.

  // hipFreeEnds (#77): 3DBAG's hip on a terraced house is the row end's: hip the free end(s) only; a mid-row house gets a gable.
  const hipEnds = spec.roof.hipFreeEnds && roofForm === 'hip' && ridge === 'long' && params.freeSides && !asym && !pairGable ? {lo: params.freeSides.left, hi: params.freeSides.right} : undefined;
  // a short-ridge 'hip' on such a row is the row end's front-facing gable house (3DBAG reads its steep gable as a hip): a gable.
  const drawnForm = (hipEnds && !hipEnds.lo && !hipEnds.hi) || (spec.roof.hipFreeEnds && roofForm === 'hip' && ridge === 'short') ? 'gable' : roofForm;
  const ridgeH = params.ridgeM ?? params.eavesM + Math.tan(spec.roof.pitchDeg * Math.PI / 180) * (pairGable ? L : (ridge === 'long' ? W : L) / 2);
  if (asym) {
    const hi = params.eavesM > backEaves ? frames.front : frames.back;
    plate(mb, k.wall, hi.f, 0, hi.len, wallTop, Math.max(params.eavesM, backEaves), 0);
    asymGable(ctx, {L, W, ef: params.eavesM, eb: backEaves, ridgeH, eavesOv: spec.roof.eavesOverhangM, vergeOv: spec.roof.vergeOverhangM, gableKey: gabled ? k.gable : k.wall});
  } else if (pairGable) pairGableRoof(ctx, spec, frames, L, W, params.eavesM, ridgeH, !!params.mirror, k.gable);
  else if (hipEnds || drawnForm !== roofForm) roofSolid(ctx, {form: drawnForm, ridge, L, W, eaves: params.eavesM, ridgeH, eavesOv: spec.roof.eavesOverhangM, vergeOv: spec.roof.vergeOverhangM, flatThickness: flatT, ...(drawnForm === 'hip' ? {hipEnds} : {})});
  else roofSolid(ctx, {form: roofForm, ridge, L, W, eaves: params.eavesM, ridgeH, eavesOv: spec.roof.eavesOverhangM, vergeOv: spec.roof.vergeOverhangM, flatThickness: flatT});
  if (spec.roof.chimneys?.length && pitched && !pairGable && ridge === 'long') {
    const hw = W / 2, sl = asym ? asymSlope(hw, params.eavesM, backEaves, ridgeH) : {tan: Math.max(0.1, ridgeH - params.eavesM) / hw, tRidge: 0};
    chimneysUnit(ctx, spec.roof.chimneys, L, Math.min(params.eavesM, backEaves), ridgeH, sl.tan, sl.tRidge, !!params.mirror);
  }
  if (pitched && roofForm === 'gable' && ridge === 'long' && (v.rooflights || spec.roof.rooflights || spec.roof.dormers?.length)) roofFeatures(ctx, spec, L, W, params.eavesM, ridgeH, !!params.mirror, asym ? backEaves : undefined);
  // Annexes stand on the rectangle edges (not the inset wall lines).
  const edges: Record<FacadeId, {f: Frame; len: number}> = {
    front: {f: new Frame([-L / 2, W / 2], [1, 0], [0, 1]), len: L},
    back: {f: new Frame([L / 2, -W / 2], [-1, 0], [0, -1]), len: L},
    right: {f: new Frame([L / 2, W / 2], [0, -1], [1, 0]), len: W},
    left: {f: new Frame([-L / 2, -W / 2], [0, 1], [-1, 0]), len: W},
  };
  let annexCount = 0;
  for (const a of spec.annexes ?? []) {
    if ((a.variants && !a.variants.includes(variant)) || a.exceptVariants?.includes(variant)) continue;
    const {f, len} = edges[a.facade], mirrorU = params.mirror && (a.facade === 'front' || a.facade === 'back');
    const u: [number, number] = mirrorU ? [len - a.u[1], len - a.u[0]] : a.u;
    annexUnit(ctx, f, a, u, heightOf(a.from ?? 0, sh, params.eavesM), heightOf(a.to, sh, params.eavesM));
    annexCount++;
  }
  return {mesh: mb, report: {...(annexCount ? {annexes: annexCount} : {}), triangles: mb.triangles, storeys, storeyHeightM: sh, wallTopM: wallTop, ridgeM: pitched ? ridgeH : null, variant, roofForm: drawnForm, ridge, groundMode, mirrored: params.mirror ? true : undefined, sides: params.freeSides && (hipEnds || (['left', 'right'] as const).some(id => spec.facades[id].bays.some(b => b.elements.length))) ? (free.left && free.right ? 'free' : free.left ? 'endL' : free.right ? 'endR' : 'mid') : undefined, facades}};
}
