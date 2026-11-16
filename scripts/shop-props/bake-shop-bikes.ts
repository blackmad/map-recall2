/**
 * Bake the shop-props bike and rack (lane shop-bikes-20261116; David 2026-11-16: "can you not find an existing low poly
 * bike model to use? heck, we've also got our bike model"). Reads the player's omafiets (public/canal-drive/
 * omafiets-runtime.glb, 18,188 tris) and the street-furniture bike rack (40 tris), simplifies each omafiets part with
 * meshoptimizer to a stated budget, rebuilds the tyres and rims as thin rings (simplification wrecks a torus), and writes
 * them as triangles in the shop-props kit's local frame (x along the bike, front wheel at +x; y across; z up; origin on
 * the ground under the bike's middle) to src/canalRecall/shopProps/bikeMeshes.generated.ts. No runtime GLB load.
 *
 *   node --import tsx scripts/shop-props/bake-shop-bikes.ts [--out=src/canalRecall/shopProps/bikeMeshes.generated.ts]
 */
import fs from 'node:fs';
import { NodeIO, type Node as GNode } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';

const OUT = process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? 'src/canalRecall/shopProps/bikeMeshes.generated.ts';
type Group = 'frame' | 'dark' | 'saddle' | 'tyre' | 'chrome';
/** Each omafiets part's colour group. Tyres and rims are rebuilt as rings, mudguards as arcs, and the stem as a post. */
const GROUP: Record<string, Group> = {
  Frame: 'frame', Fork: 'frame', RearFender: 'dark', FrontFender: 'dark', RearRack: 'dark', FrontRack: 'dark', ChainCase: 'dark',
  LenkerBars: 'dark', Seat: 'saddle', Headlamp: 'chrome', Crank: 'dark', Kickstand: 'dark', BabySeat: 'dark',
  FrontTire: 'tyre', RearTire: 'tyre', FrontRim: 'chrome', RearRim: 'chrome',
};
/** Two LODs: `shop` stands on the pavement; `window` is pressed into the 2 cm relief behind the glass (retailFront.ts
 *  insideRelief), seen through tinted glass, so it keeps the outline only. Targets are triangles before the street-side
 *  cull; a part not listed is dropped (the baby seat, the front rack, the crank and the kickstand). */
type Lod = { targets: Record<string, number>; sides: number; rims: boolean; stem: boolean };
const LODS: Record<'shop' | 'window', Lod> = {
  shop: { targets: { Frame: 80, Fork: 12, RearRack: 16, ChainCase: 8, LenkerBars: 24, Seat: 10, Headlamp: 4 }, sides: 12, rims: true, stem: true },
  window: { targets: { Frame: 36, Fork: 6, RearRack: 8, ChainCase: 4, LenkerBars: 10, Seat: 6 }, sides: 10, rims: false, stem: false },
};

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
await MeshoptDecoder.ready; await MeshoptSimplifier.ready;

type V = [number, number, number];
/** glTF (x forward, y up, z across, chain case on +z) to the kit with the drive side (chain case) towards the street,
 *  +y: x = -x (the front wheel at -x), y = z, z = y; a proper rotation. */
const toKit = (p: V): V => [-p[0], p[2], p[1]];
/** The bike stands side-on to the street, which looks at its +y side: faces turned away (normal y below this) are culled. */
const CULL_NY = -0.2;
const normalOf = (t: V[]): V => {
  const u = [t[1][0] - t[0][0], t[1][1] - t[0][1], t[1][2] - t[0][2]], w = [t[2][0] - t[0][0], t[2][1] - t[0][1], t[2][2] - t[0][2]];
  const c: V = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], l = Math.hypot(...c) || 1;
  return [c[0] / l, c[1] / l, c[2] / l];
};
const mul = (m: ArrayLike<number>, p: V): V => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];

/** A node's triangles in world space (kit frame), welded. */
function nodeMesh(n: GNode): { pos: Float32Array; idx: Uint32Array } | null {
  const mesh = n.getMesh(); if (!mesh) return null;
  const m = n.getWorldMatrix(), verts: V[] = [], idx: number[] = [], key = new Map<string, number>();
  for (const prim of mesh.listPrimitives()) {
    const pa = prim.getAttribute('POSITION')!, ia = prim.getIndices(), count = ia ? ia.getCount() : pa.getCount();
    for (let i = 0; i < count; i++) {
      const vi = ia ? ia.getScalar(i) : i, p = toKit(mul(m, pa.getElement(vi, []) as V));
      const k = p.map(v => Math.round(v * 2000)).join();
      let j = key.get(k); if (j === undefined) { j = verts.length; verts.push(p); key.set(k, j); }
      idx.push(j);
    }
  }
  return { pos: new Float32Array(verts.flat()), idx: new Uint32Array(idx) };
}

/** Simplify to about `target` triangles (meshoptimizer's edge-collapse simplifier, error unbounded). */
function simplify(mesh: { pos: Float32Array; idx: Uint32Array }, target: number): Uint32Array {
  return MeshoptSimplifier.simplify(mesh.idx, mesh.pos, 3, Math.min(mesh.idx.length, target * 3), 1, [])[0];
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
async function bakeOmafiets(lod: Lod): Promise<{ groups: Record<Group, number[]>; report: string[] }> {
  const doc = await io.read('public/canal-drive/omafiets-runtime.glb');
  const groups: Record<Group, number[]> = { frame: [], dark: [], saddle: [], tyre: [], chrome: [] }, report: string[] = [];
  const all: V[] = [], parts: Array<{ group: Group; tris: V[][] }> = [];
  let wheels: Array<{ c: V; r: number; rim: number }> = [];
  const fenders: V[][] = [];
  for (const n of doc.getRoot().listNodes()) {
    const group = GROUP[n.getName()], target = lod.targets[n.getName()] ?? 0, mesh = nodeMesh(n);
    if (!mesh) continue;
    if (!group) throw new Error(`unmapped omafiets part ${n.getName()}`);
    for (let i = 0; i < mesh.pos.length; i += 3) all.push([mesh.pos[i], mesh.pos[i + 1], mesh.pos[i + 2]]);
    if (/Tire|Rim/.test(n.getName())) {
      const xs: number[] = [], zs: number[] = [], ys: number[] = [];
      for (let i = 0; i < mesh.pos.length; i += 3) { xs.push(mesh.pos[i]); ys.push(mesh.pos[i + 1]); zs.push(mesh.pos[i + 2]); }
      const c: V = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
      const r = (Math.max(...xs) - Math.min(...xs)) / 2, w = wheels.find(q => Math.hypot(q.c[0] - c[0], q.c[2] - c[2]) < 0.05);
      if (/Tire/.test(n.getName())) { if (w) w.r = r; else wheels.push({ c, r, rim: 0 }); }
      else if (w) w.rim = r; else wheels.push({ c, r: 0, rim: r });
      report.push(`${n.getName()}: ${mesh.idx.length / 3} -> ring`);
      continue;
    }
    if (/Fender/.test(n.getName())) {
      const vs: V[] = []; for (let i = 0; i < mesh.pos.length; i += 3) vs.push([mesh.pos[i], mesh.pos[i + 1], mesh.pos[i + 2]]);
      fenders.push(vs); report.push(`${n.getName()}: ${mesh.idx.length / 3} -> arc`);
      continue;
    }
    if (!target) { report.push(`${n.getName()}: ${mesh.idx.length / 3} -> dropped`); continue; }
    const out = simplify(mesh, target), tris: V[][] = [];
    for (let i = 0; i < out.length; i += 3) tris.push([0, 1, 2].map(k => { const j = out[i + k] * 3; return [mesh.pos[j], mesh.pos[j + 1], mesh.pos[j + 2]] as V; }));
    const kept = tris.filter(t => normalOf(t)[1] >= CULL_NY);
    parts.push({ group, tris: kept });
    report.push(`${n.getName()}: ${mesh.idx.length / 3} -> ${tris.length} -> ${kept.length} street-side`);
  }
  // Origin: the ground under the middle of the bike (tyre bottoms at z 0).
  const xs = all.map(p => p[0]), zs = all.map(p => p[2]), ox = (Math.min(...xs) + Math.max(...xs)) / 2, oz = Math.min(...zs);
  const flat = (g: Group, t: V[]) => put(g, normalOf(t)[1] < 0 ? [t[0], t[2], t[1]] : t);
  const put = (g: Group, t: V[]) => groups[g].push(...t.flatMap(p => [r3(p[0] - ox), r3(p[1]), r3(p[2] - oz)]));
  for (const p of parts) for (const t of p.tris) put(p.group, t);
  // Tyres and rims as flat rings in the bike's plane (y 0): a tyre band 4.5 cm deep and the chrome rim just inside it.
  wheels = wheels.sort((a, b) => a.c[0] - b.c[0]);
  for (const w of wheels) {
    const ring = (r0: number, r1: number, g: Group) => {
      for (let k = 0; k < lod.sides; k++) {
        const a0 = (k / lod.sides) * Math.PI * 2, a1 = ((k + 1) / lod.sides) * Math.PI * 2, P = (a: number, r: number): V => [w.c[0] + r * Math.cos(a), w.c[1], w.c[2] + r * Math.sin(a)];
        flat(g, [P(a0, r0), P(a1, r0), P(a1, r1)]); flat(g, [P(a0, r0), P(a1, r1), P(a0, r1)]);
      }
    };
    ring(w.r - 0.045, w.r, 'tyre'); if (lod.rims) ring(w.rim - 0.022, w.r - 0.045, 'chrome');
    report.push(`wheel at x ${r3(w.c[0] - ox)}: tyre r ${r3(w.r)}${lod.rims ? `, rim r ${r3(w.rim)}` : ''}, ${lod.sides} sides`);
  }
  // Mudguards (thin shells the simplifier deletes) as arcs over their wheel, at the source's angular extent.
  const arc = (c: V, r0: number, r1: number, t0: number, t1: number, g: Group) => {
    const n = Math.max(2, Math.ceil((t1 - t0) / (Math.PI * 2 / lod.sides)));
    for (let k = 0; k < n; k++) {
      const a0 = t0 + (t1 - t0) * k / n, a1 = t0 + (t1 - t0) * (k + 1) / n, P = (a: number, r: number): V => [c[0] + r * Math.cos(a), c[1], c[2] + r * Math.sin(a)];
      flat(g, [P(a0, r0), P(a1, r0), P(a1, r1)]); flat(g, [P(a0, r0), P(a1, r1), P(a0, r1)]);
    }
    return n * 2;
  };
  for (const vs of fenders) {
    const mx = vs.reduce((t, p) => t + p[0], 0) / vs.length, w = wheels.slice().sort((a, b) => Math.abs(a.c[0] - mx) - Math.abs(b.c[0] - mx))[0];
    const ang = vs.map(p => { let a = Math.atan2(p[2] - w.c[2], p[0] - w.c[0]); if (a < -Math.PI / 2) a += Math.PI * 2; return a; });
    const t0 = Math.min(...ang), t1 = Math.max(...ang);
    report.push(`mudguard over x ${r3(w.c[0] - ox)}: ${Math.round(t0 * 180 / Math.PI)}..${Math.round(t1 * 180 / Math.PI)} deg, ${arc(w.c, w.r + 0.012, w.r + 0.05, t0, t1, 'dark')} tris`);
  }
  // The stem (lost in the bars' simplification): a three-sided chrome post from the head tube's top up to the bars.
  if (!lod.stem) return { groups, report };
  const pivot = doc.getRoot().listNodes().find(n => n.getName() === 'Lenker')!.getWorldTranslation(), sp = toKit(pivot as V), h = 0.2, q = 0.018;
  const ring3 = (z: number): V[] => [0, 1, 2].map(k => [sp[0] + q * Math.cos(k * 2.0944), sp[1] + q * Math.sin(k * 2.0944), z] as V);
  const lo = ring3(sp[2] - 0.04), hi = ring3(sp[2] + h);
  let stem = 0;
  for (let k = 0; k < 3; k++) {
    const k1 = (k + 1) % 3, a: V[] = [lo[k], lo[k1], hi[k1]], b: V[] = [lo[k], hi[k1], hi[k]];
    // Wound outward from the post's axis; only the faces the street sees.
    const out = normalOf(a), mid = [(lo[k][0] + lo[k1][0]) / 2 - sp[0], (lo[k][1] + lo[k1][1]) / 2 - sp[1]];
    const s0 = out[0] * mid[0] + out[1] * mid[1] < 0, A = s0 ? [a[0], a[2], a[1]] : a, B = s0 ? [b[0], b[2], b[1]] : b;
    if (normalOf(A)[1] >= CULL_NY) { put('chrome', A); put('chrome', B); stem += 2; }
  }
  report.push(`stem: ${stem} tris`);
  return { groups, report };
}

async function bakeRack(): Promise<{ tris: number[]; report: string }> {
  const doc = await io.read('public/canal-drive/models/street-furniture/bike-rack.glb');
  const tris: number[] = [];
  let all = 0;
  for (const n of doc.getRoot().listNodes()) {
    const mesh = nodeMesh(n); if (!mesh) continue;
    // Turned so the hoop runs along x (along the wall), its +y face to the street; faces turned away are culled.
    const at = (j: number): V => [mesh.pos[j * 3 + 1], -mesh.pos[j * 3], mesh.pos[j * 3 + 2]];
    for (let i = 0; i < mesh.idx.length; i += 3, all++) {
      const t = [at(mesh.idx[i]), at(mesh.idx[i + 1]), at(mesh.idx[i + 2])];
      if (normalOf(t)[1] >= CULL_NY) tris.push(...t.flatMap(p => p.map(r3)));
    }
  }
  return { tris, report: `bike-rack: ${all} -> ${tris.length / 9} street-side tris` };
}

const shop = await bakeOmafiets(LODS.shop), win = await bakeOmafiets(LODS.window), rack = await bakeRack();
const count = (a: number[]) => a.length / 9, tot = (b: typeof shop) => Object.values(b.groups).reduce((t, g) => t + count(g), 0);
const fmt = (a: number[]) => `[${a.join(',')}]`, groupsOf = (b: typeof shop) => (Object.keys(b.groups) as Group[]).map(g => `  ${g}: ${fmt(b.groups[g])},`).join('\n');
fs.writeFileSync(OUT, `// GENERATED by scripts/shop-props/bake-shop-bikes.ts from public/canal-drive/omafiets-runtime.glb and
// public/canal-drive/models/street-furniture/bike-rack.glb; do not edit. Triangles as flat xyz triples (9 numbers each)
// in the shop-props kit frame: x along the bike (front wheel -x), y across (+y the drive side, towards the street), z up,
// origin on the ground mid-bike; faces turned away from +y culled.
// shop: ${shop.report.join('; ')}.
// window: ${win.report.join('; ')}.
// ${rack.report}.

/** The omafiets for the pavement by colour group (${tot(shop)} tris): frame (recoloured per bike), dark (mudguards,
 *  carrier, chain case, bars), saddle, tyre, chrome (rims, stem, lamp). */
export const OMAFIETS_LOW = {
${groupsOf(shop)}
} as const;
export const OMAFIETS_LOW_TRIS = ${tot(shop)};

/** The omafiets behind the glass (${tot(win)} tris): the outline only, no rims or stem. */
export const OMAFIETS_WINDOW = {
${groupsOf(win)}
} as const;
export const OMAFIETS_WINDOW_TRIS = ${tot(win)};

/** The street-furniture bike rack (an inverted U), the hoop along x, +y towards the street, z up. */
export const BIKE_RACK = ${fmt(rack.tris)};
export const BIKE_RACK_TRIS = ${rack.tris.length / 9};
`);
for (const [k, b] of [['shop', shop], ['window', win]] as const) console.log(`omafiets ${k}: ${tot(b)} tris (${(Object.keys(b.groups) as Group[]).map(g => `${g} ${count(b.groups[g])}`).join(', ')})\n  ${b.report.join('\n  ')}`);
console.log(`${rack.report} -> ${OUT}`);
