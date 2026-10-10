/**
 * Parametric block generator: type spec + footprint rectangle + roof facts +
 * cladding variant -> triangle mesh in the block's local frame.
 *
 * Local frame (metres, ground at y = 0): x along the long side, z across, the
 * FRONT facade at +z, centre of the rectangle at the origin. A facade frame is
 * (u along the facade seen from outside left-to-right, v up, d outward).
 */
import {MeshBuilder, type MaterialKey, type V3} from './mesh.ts';
import {FACADE_IDS, type Bay, type Element, type FacadeId, type Levels, type Palette, type TypeSpec} from './spec.ts';

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
  facades: Record<FacadeId, FacadeCount>;
}

class Frame {
  constructor(readonly o: [number, number], readonly t: [number, number], readonly n: [number, number]) {}
  p(u: number, v: number, d: number): V3 { return [this.o[0] + this.t[0] * u + this.n[0] * d, v, this.o[1] + this.t[1] * u + this.n[1] * d]; }
}

const IDENTITY = new Frame([0, 0], [1, 0], [0, 1]);

interface BoxSkip { back?: boolean; bottom?: boolean; top?: boolean }

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
  return {
    frame: {slot: 'frame', tint: p.frame} as MaterialKey,
    glass: {slot: 'glass', tint: p.glass} as MaterialKey,
    door: {slot: 'door', tint: p.door} as MaterialKey,
    accent: {slot: 'stone', tint: p.accent} as MaterialKey,
    rail: {slot: 'door', tint: p.rail} as MaterialKey,
    dark: {slot: 'door', tint: p.dark} as MaterialKey,
    column: {slot: 'stucco', tint: p.column} as MaterialKey,
    joint: {slot: 'door', tint: p.joint} as MaterialKey,
    wall: p.wall as MaterialKey,
    plinth: (p.plinth ?? p.wall) as MaterialKey,
    roof: p.roof as MaterialKey,
  };
}
type Keys = ReturnType<typeof keys>;

interface Ctx { mb: MeshBuilder; k: Keys; storeys: number; sh: number; variant: string; groundMode: 'solid' | 'pilotis'; recess: number }

function windowUnit(c: Ctx, f: Frame, u: number, v0: number, w: number, h: number, lights: number, d0 = 0): void {
  const {mb, k} = c;
  // Low-poly window: frame and glass are two stacked plates (the frame shows as the 6 cm border), no side faces.
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

function doorUnit(c: Ctx, f: Frame, u: number, w: number, h: number, steps: number, d0 = 0): void {
  const {mb, k} = c, rise = 0.17, lift = steps * rise;
  box(mb, k.accent, f, u - w / 2 - 0.14, u + w / 2 + 0.14, 0, lift + h + 0.12, d0, d0 + 0.07);
  plate(mb, k.door, f, u - w / 2, u + w / 2, lift, lift + h, d0 + 0.075);
  plate(mb, k.glass, f, u - w / 2 + 0.14, u + w / 2 - 0.14, lift + h * 0.42, lift + h - 0.14, d0 + 0.08);
  for (let i = 0; i < steps; i++) box(mb, k.accent, f, u - w / 2 - 0.35, u + w / 2 + 0.35, 0, (steps - i) * rise, d0 + 0.07, d0 + 0.07 + 0.3 * (i + 1));
}

function storageDoor(c: Ctx, f: Frame, u: number, w: number, h: number, d0 = 0): void {
  const {mb, k} = c;
  box(mb, k.accent, f, u - w / 2 - 0.08, u + w / 2 + 0.08, 0, h + 0.08, d0, d0 + 0.05);
  plate(mb, k.door, f, u - w / 2, u + w / 2, 0, h, d0 + 0.055);
}

function variantOk(e: Element, variant: string): boolean {
  return (!e.variants || e.variants.includes(variant)) && !(e.exceptVariants && e.exceptVariants.includes(variant));
}

interface Placed { u0: number; u1: number; bay: Bay }

export function layoutBays(bays: Bay[], length: number): Placed[] {
  const total = bays.reduce((s, b) => s + b.w, 0);
  let u = 0;
  return bays.map(bay => { const w = bay.w / total * length; const p = {u0: u, u1: u + w, bay}; u += w; return p; });
}

function placeFacade(c: Ctx, f: Frame, length: number, id: FacadeId, bays: Bay[], onGround: (bay: Bay, uc: number) => number): FacadeCount {
  const count: FacadeCount = {bays: bays.length, openingsPerUpperStorey: 0, groundDoors: 0, balconiesPerUpperStorey: 0};
  for (const {u0, u1, bay} of layoutBays(bays, length)) {
    const uc = (u0 + u1) / 2;
    for (const e of bay.elements) {
      if (!variantOk(e, c.variant)) continue;
      if (e.groundModes && !e.groundModes.includes(c.groundMode)) continue;
      const u = (e.ref === 'left' ? u0 + (e.u ?? 0) : e.ref === 'right' ? u1 - (e.u ?? 0) : uc + (e.u ?? 0));
      for (const kLevel of levelsOf(e.levels, c.storeys)) {
        const floor = kLevel * c.sh, d0 = kLevel === 0 ? onGround(bay, uc) : 0;
        const w = e.w ?? 1, h = e.h ?? 1;
        switch (e.kind) {
          case 'window': case 'ribbon':
            windowUnit(c, f, u, floor + (e.sill ?? 0.9), w, h, e.lights ?? 1, d0);
            if (kLevel === 1) count.openingsPerUpperStorey++;
            break;
          case 'balcony':
            balconyUnit(c, f, u, floor, w, e.depth ?? 1.2, e.railing ?? 'bars');
            if (kLevel === 1) count.balconiesPerUpperStorey++;
            break;
          case 'door': doorUnit(c, f, u, w, h, e.steps ?? 0, d0); if (kLevel === 0) count.groundDoors++; break;
          case 'storageDoor': storageDoor(c, f, u, w, h, d0); if (kLevel === 0) count.groundDoors++; break;
          case 'vents': {
            const n = e.count ?? 3;
            for (let i = 0; i < n; i++) plate(c.mb, c.k.dark, f, u + (i - (n - 1) / 2) * 0.42 - 0.15, u + (i - (n - 1) / 2) * 0.42 + 0.15, floor + (e.sill ?? 1.6), floor + (e.sill ?? 1.6) + 0.14, d0 + 0.02);
            break;
          }
          case 'panel': {
            const key = (c.k as unknown as Record<string, MaterialKey>)[e.colour ?? 'frame'];
            box(c.mb, key, f, u - w / 2, u + w / 2, floor + (e.sill ?? 0), floor + (e.sill ?? 0) + h, d0, d0 + (e.depth ?? 0.08));
            break;
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

function roofSolid(c: Ctx, p: {form: 'gable' | 'hip' | 'flat'; ridge: 'long' | 'short'; L: number; W: number; eaves: number; ridgeH: number; eavesOv: number; vergeOv: number; flatThickness: number}): void {
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
      const tri = [to(sAt, -b, y0), to(sAt, b, y0), to(sAt, 0, p.ridgeH)];
      quadAway(mb, k.wall, inside, tri[0], tri[1], tri[2], tri[2]);
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

export function generate(spec: TypeSpec, params: GenerateParams): {mesh: MeshBuilder; report: GenerateReport} {
  const variant = params.variant ?? spec.defaultVariant, v = spec.variants[variant];
  if (!v) throw new Error(`unknown variant ${variant} for ${spec.id}`);
  const L = params.lengthM, W = params.widthM, storeys = params.storeys ?? spec.storeys;
  if (L < W) throw new Error('lengthM must be the long side (front is a long side)');
  const roofForm = params.roofForm ?? spec.roof.form, ridge = params.ridge ?? spec.roof.ridge;
  const groundMode = params.groundMode ?? spec.ground.mode;
  const pitched = roofForm !== 'flat';
  const flatT = 0.22, wallTop = pitched ? params.eavesM : params.eavesM - flatT;
  const sh = params.eavesM / storeys;
  const mb = new MeshBuilder(), k = keys(v.palette), ctx: Ctx = {mb, k, storeys, sh, variant, groundMode, recess: spec.ground.recessM ?? 0};
  const pilotis = groundMode === 'pilotis', rec = pilotis ? spec.ground.recessM ?? 1.5 : 0;
  ctx.recess = rec;

  // Facade frames: front +z, back -z, right +x, left -x (viewer outside, left to right).
  const frames: Record<FacadeId, {f: Frame; len: number}> = {
    front: {f: new Frame([-L / 2, W / 2], [1, 0], [0, 1]), len: L},
    back: {f: new Frame([L / 2, -W / 2], [-1, 0], [0, -1]), len: L},
    right: {f: new Frame([L / 2, W / 2], [0, -1], [1, 0]), len: W},
    left: {f: new Frame([-L / 2, -W / 2], [0, 1], [-1, 0]), len: W},
  };

  // Wall volumes.
  const slabBelow = 0.5; // pilotis: white slab edge under the first floor
  const lowTop = pilotis ? sh - slabBelow : sh;
  if (pilotis) {
    const core = spec.facades.front.bays.length ? layoutBays(spec.facades.front.bays, L).filter(p => p.bay.core) : [];
    box(mb, k.column, IDENTITY, -L / 2, L / 2, sh - slabBelow, sh, -W / 2, W / 2, {back: false, bottom: false, top: true});
    box(mb, k.wall, IDENTITY, -L / 2, L / 2, sh, wallTop, -W / 2, W / 2, {back: false, bottom: true});
    // recessed ground wall, full length
    box(mb, {slot: 'door', tint: v.palette.door}, IDENTITY, -L / 2, L / 2, 0, lowTop, -W / 2 + rec, W / 2 - rec, {back: false, bottom: true, top: true});
    for (const p of core) box(mb, k.plinth, IDENTITY, -L / 2 + p.u0, -L / 2 + p.u1, 0, lowTop, -W / 2, W / 2, {back: false, bottom: true, top: true});
    // columns along both long facades, outside the core, plus the four corners
    const pitch = spec.ground.columnPitchM ?? 3.4, cw = spec.ground.columnM ?? 0.42;
    const inCore = (x: number) => core.some(p => x > -L / 2 + p.u0 - cw && x < -L / 2 + p.u1 + cw);
    const n = Math.max(1, Math.round(L / pitch));
    for (let i = 0; i <= n; i++) {
      const x = -L / 2 + L * i / n, xc = Math.min(L / 2 - cw / 2, Math.max(-L / 2 + cw / 2, x));
      if (inCore(xc)) continue;
      for (const z of [W / 2 - cw / 2, -W / 2 + cw / 2]) box(mb, k.column, IDENTITY, xc - cw / 2, xc + cw / 2, 0, lowTop, z - cw / 2, z + cw / 2, {back: false, bottom: true, top: true});
    }
  } else {
    if (v.palette.plinth) {
      box(mb, k.plinth, IDENTITY, -L / 2, L / 2, 0, sh, -W / 2, W / 2, {back: false, bottom: true, top: true});
      box(mb, k.wall, IDENTITY, -L / 2, L / 2, sh, wallTop, -W / 2, W / 2, {back: false, bottom: true});
    } else box(mb, k.wall, IDENTITY, -L / 2, L / 2, 0, wallTop, -W / 2, W / 2, {back: false, bottom: true});
  }

  const coreX = layoutBays(spec.facades.front.bays, L).filter(p => p.bay.core).map(p => [-L / 2 + p.u0, -L / 2 + p.u1] as const);
  const onGround = (id: FacadeId) => (bay: Bay, uc: number) => {
    if (!pilotis || (id !== 'front' && id !== 'back')) return 0;
    const x = id === 'front' ? -L / 2 + uc : L / 2 - uc;
    return coreX.some(([a, b]) => x >= a - 0.01 && x <= b + 0.01) ? 0 : -rec;
  };
  const facades = {} as Record<FacadeId, FacadeCount>;
  for (const id of FACADE_IDS) {
    const {f, len} = frames[id], fs = spec.facades[id];
    facades[id] = placeFacade(ctx, f, len, id, fs.bays, onGround(id));
    if (v.joints && fs.joints) joints(ctx, f, len, sh, wallTop, fs.joints.panelW, fs.joints.panelH);
    for (const band of fs.bands ?? []) {
      const y = band.floor * sh;
      box(mb, {slot: 'stucco', tint: v.palette.column}, f, -0.0, len, y - band.below, y + band.above, 0, 0.05);
    }
  }
  // pilotis: slab fascia is the white column box above; the soffit shows from below.

  const ridgeH = params.ridgeM ?? params.eavesM + Math.tan(spec.roof.pitchDeg * Math.PI / 180) * ((ridge === 'long' ? W : L) / 2);
  roofSolid(ctx, {form: roofForm, ridge, L, W, eaves: params.eavesM, ridgeH, eavesOv: spec.roof.eavesOverhangM, vergeOv: spec.roof.vergeOverhangM, flatThickness: flatT});
  return {mesh: mb, report: {triangles: mb.triangles, storeys, storeyHeightM: sh, wallTopM: wallTop, ridgeM: pitched ? ridgeH : null, variant, roofForm, ridge, groundMode, facades}};
}
