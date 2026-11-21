/**
 * Statue parts for an install without a kit model (2026-11-21, first used for Belle on the Oudekerksplein): split a route B
 * mesh at the plinth top into a bronze and a stone figure GLB, and add the thin bronze parts a single-photo cut-out loses.
 *
 *   node --import tsx scripts/sculptures/statue-parts.ts --in=<plain.glb> --out=<dir> --split=<m>
 *        [--frame=<width>,<bottom>,<top>,<bar>,<back>] [--facing=<deg>] [--plan]
 *
 *   --in        decimate_scale_glb.py output (landmark frame: x east, y up, z south; base on y = 0; centred in plan; faced)
 *   --split     plinth top in metres: triangles whose centroid is below it go to stone.glb, the rest to bronze.glb
 *   --frame     a rectangular bronze door frame (two posts and a lintel of square bar) seen face-on from the statue's front:
 *               outer width, post bottom and frame top (metres above the base), bar size, and how far behind the plan centre
 *               the frame stands along the facing direction; written as frame.glb. rembg drops bars a few pixels wide, so the
 *               frame is measured on the photo and drawn, not reconstructed.
 *   --facing    compass bearing of the statue's front (the same value given to decimate_scale_glb.py)
 *   --shear=<k> undo the forward lean a photo taken from above gives TripoSR: front -= k * height. Measure k on the plinth, which is
 *               a vertical prism (the drift of its front/back centre per metre in the --plan bands)
 *   --pedestal=<w>,<d>  replace the reconstructed plinth (often skewed and too deep) by a w x d box up to --split, in stone; the
 *               bronze part is then centred on it, using the plan centre of its lowest 0.15 m
 *   --base-scale=<k>,<y0>,<y1>  shrink the bronze base in plan (see the code comment); needs --pedestal
 *   --plaque=<w>,<h>,<y>  a plaque w x h centred y above the base, 6 mm proud of the --pedestal front face; written as plaque.glb
 *   --stone-tint=#rrggbb  plinth colour in review.glb only (installs take the material from the install record)
 *   --frame-back is measured from the box centre when --pedestal is given
 *   --plan      print the plan extent of the mesh in front/side coordinates in 0.1 m height bands (to measure the plinth and
 *               where the figure stands)
 * Every output GLB is colourless (materials come from the install record, as for installed-figures.ts). Prints a JSON summary.
 */
import fs from 'node:fs';
import path from 'node:path';
import {Document, NodeIO} from '@gltf-transform/core';
import {composeDoc} from './kit-compose.js';

const arg = (k: string, d = '') => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const input = arg('in'), out = arg('out'), split = Number(arg('split'));
if (!input || !out || !Number.isFinite(split)) throw new Error('usage: statue-parts.ts --in=<glb> --out=<dir> --split=<m> [--frame=w,bottom,top,bar,back] [--facing=deg]');
const facing = Number(arg('facing', '0')) * Math.PI / 180;
// Front and side unit vectors in the x-east / z-south plane, as decimate_scale_glb.py builds them.
const F: [number, number] = [Math.sin(facing), -Math.cos(facing)];
const Sd: [number, number] = [F[1], -F[0]];

type V3 = [number, number, number];
const io = new NodeIO();
const doc = await io.read(input);
const tris: V3[][] = [];
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue;
  for (const p of mesh.listPrimitives()) {
    const pos = p.getAttribute('POSITION')!, idx = p.getIndices();
    const n = idx ? idx.getCount() : pos.getCount();
    const v = (i: number) => pos.getElement(idx ? idx.getScalar(i) : i, [0, 0, 0]) as V3;
    for (let t = 0; t + 2 < n; t += 3) tris.push([v(t), v(t + 1), v(t + 2)]);
  }
}

const write = async (name: string, list: V3[][], weld = true) => {
  const d = new Document();
  const buf = d.createBuffer();
  // Welded and indexed, so installed-figures.ts' computeVertexNormals shades the reconstructed surface smoothly; drawn boxes
  // are written unwelded (weld = false) so their faces stay flat.
  const key = new Map<string, number>(), verts: number[] = [], index: number[] = [];
  for (const t of list) for (const p of t) {
    const k = weld ? p.map(c => c.toFixed(5)).join(',') : String(index.length);
    let i = key.get(k);
    if (i === undefined) { i = verts.length / 3; key.set(k, i); verts.push(...p); }
    index.push(i);
  }
  const prim = d.createPrimitive().setAttribute('POSITION', d.createAccessor().setType('VEC3').setArray(new Float32Array(verts)).setBuffer(buf))
    .setIndices(d.createAccessor().setType('SCALAR').setArray(new Uint32Array(index)).setBuffer(buf));
  d.createScene().addChild(d.createNode(name).setMesh(d.createMesh(name).addPrimitive(prim)));
  fs.mkdirSync(out, {recursive: true});
  const file = path.join(out, `${name}.glb`);
  await new NodeIO().write(file, d);
  return {file, triangles: list.length};
};

const result: Record<string, unknown> = {};
if (process.argv.includes('--plan')) {
  const bands: Record<string, number[]> = {};
  for (const t of tris) for (const p of t) {
    const k = (Math.floor(p[1] * 10) / 10).toFixed(1), f = p[0] * F[0] + p[2] * F[1], s = p[0] * Sd[0] + p[2] * Sd[1];
    const b = (bands[k] ??= [Infinity, -Infinity, Infinity, -Infinity]);
    b[0] = Math.min(b[0], f); b[1] = Math.max(b[1], f); b[2] = Math.min(b[2], s); b[3] = Math.max(b[3], s);
  }
  result.planByBand = Object.fromEntries(Object.entries(bands).sort((a, b) => +a[0] - +b[0]).map(([k, b]) => [k, {front: [+b[0].toFixed(3), +b[1].toFixed(3)], side: [+b[2].toFixed(3), +b[3].toFixed(3)]}]));
}
const shear = Number(arg('shear', '0'));
const toLocal = (p: V3) => [p[0] * F[0] + p[2] * F[1], p[1], p[0] * Sd[0] + p[2] * Sd[1]];
const toWorld = (f: number, y: number, s: number): V3 => [f * F[0] + s * Sd[0], y, f * F[1] + s * Sd[1]];
if (shear) for (const t of tris) for (let i = 0; i < 3; i++) { const [f, y, s] = toLocal(t[i]); t[i] = toWorld(f - shear * y, y, s); }
let low: V3[][] = [], high: V3[][] = [];
for (const t of tris) ((t[0][1] + t[1][1] + t[2][1]) / 3 < split ? low : high).push(t);
// A box in (front, up, side) local coordinates, turned to the facing: 12 triangles.
const box = (f0: number, f1: number, y0: number, y1: number, s0: number, s1: number): V3[][] => {
  const c = [toWorld(f0, y0, s0), toWorld(f1, y0, s0), toWorld(f1, y0, s1), toWorld(f0, y0, s1), toWorld(f0, y1, s0), toWorld(f1, y1, s0), toWorld(f1, y1, s1), toWorld(f0, y1, s1)];
  const q = (a: number, b: number, cc: number, d: number): V3[][] => [[c[a], c[b], c[cc]], [c[a], c[cc], c[d]]];
  const centre = toWorld((f0 + f1) / 2, (y0 + y1) / 2, (s0 + s1) / 2);
  // the (front, up, side) basis is left-handed in world terms, so wind each face outward by its normal rather than by corner order
  return [...q(0, 3, 2, 1), ...q(4, 5, 6, 7), ...q(0, 1, 5, 4), ...q(1, 2, 6, 5), ...q(2, 3, 7, 6), ...q(3, 0, 4, 7)].map(([a, b, cc]) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [cc[0] - a[0], cc[1] - a[1], cc[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const out = (a[0] + b[0] + cc[0]) / 3 - centre[0], outY = (a[1] + b[1] + cc[1]) / 3 - centre[1], outZ = (a[2] + b[2] + cc[2]) / 3 - centre[2];
    return n[0] * out + n[1] * outY + n[2] * outZ >= 0 ? [a, b, cc] : [a, cc, b];
  });
};
const pedArg = arg('pedestal');
if (pedArg) {
  const [w, d] = pedArg.split(',').map(Number);
  low = box(-d / 2, d / 2, 0, split, -w / 2, w / 2);
  const base = high.flat().filter(p => p[1] < split + 0.15).map(toLocal);
  const mid = (k: number) => (Math.min(...base.map(p => p[k])) + Math.max(...base.map(p => p[k]))) / 2;
  const [df, ds] = [mid(0), mid(2)];
  high = high.map(t => t.map(p => { const [f, y, s] = toLocal(p); return toWorld(f - df, y, s - ds); }));
  result.pedestal = {widthM: w, depthM: d, heightM: split, bronzeShiftM: [+(-df).toFixed(3), +(-ds).toFixed(3)]};
  // --base-scale=<k>,<y0>,<y1>: the cut-out merges a bronze base with the plinth top below it, so the base comes out as wide as
  // the plinth; shrink it in plan by k up to y0, easing back to 1 at y1 (the figure's feet), about the plinth centre.
  const bs = arg('base-scale');
  if (bs) {
    const [k, y0, y1] = bs.split(',').map(Number);
    const at = (y: number) => y <= y0 ? k : y >= y1 ? 1 : k + (1 - k) * (y - y0) / (y1 - y0);
    high = high.map(t => t.map(p => { const g = at(p[1]); return [p[0] * g, p[1], p[2] * g] as V3; }));
    result.baseScale = {k, y0, y1};
  }
}
if (shear || pedArg) {
  const bands: Record<string, number[]> = {};
  for (const p of high.flat()) {
    const [f, y, s] = toLocal(p), k = (Math.floor(y * 10) / 10).toFixed(1);
    const b = (bands[k] ??= [Infinity, -Infinity, Infinity, -Infinity]);
    b[0] = Math.min(b[0], f); b[1] = Math.max(b[1], f); b[2] = Math.min(b[2], s); b[3] = Math.max(b[3], s);
  }
  result.bronzePlan = Object.fromEntries(Object.entries(bands).sort((a, b) => +a[0] - +b[0]).map(([k, b]) => [k, {front: [+b[0].toFixed(3), +b[1].toFixed(3)], side: [+b[2].toFixed(3), +b[3].toFixed(3)]}]));
}
result.stone = await write('stone', low, !pedArg);
result.bronze = await write('bronze', high);

const frameArg = arg('frame');
if (frameArg) {
  const [w, bottom, top, bar, back] = frameArg.split(',').map(Number);
  const f0 = -back - bar / 2, f1 = -back + bar / 2, half = w / 2;
  const frame = [
    ...box(f0, f1, bottom, top - bar, -half, -half + bar),
    ...box(f0, f1, bottom, top - bar, half - bar, half),
    ...box(f0, f1, top - bar, top, -half, half),
  ];
  result.frame = {...(await write('frame', frame, false)), widthM: w, bottomM: bottom, topM: top, barM: bar, backM: back};
  high.push(...frame);
}
const plaqueArg = arg('plaque');
if (plaqueArg && pedArg) {
  const [w, h, y] = plaqueArg.split(',').map(Number), d = Number(pedArg.split(',')[1]);
  const plaque = box(d / 2, d / 2 + 0.006, y - h / 2, y + h / 2, -w / 2, w / 2);
  result.plaque = {...(await write('plaque', plaque, false)), widthM: w, heightM: h, centreM: y};
  high.push(...plaque);
}
// Review GLB: every part in the kit statues' default bronze/stone material slots (no photo colour), for landmark-strip.ts.
const {doc: review, triangles} = composeDoc(path.basename(out), [], () => false, [{tris: low, material: 'stone'}, {tris: high, material: 'bronze'}]);
// --stone-tint=#rrggbb: the plinth's real colour in the review render (the kit fallback stone is pale limestone)
const stoneTint = arg('stone-tint');
if (stoneTint) for (const m of review.getRoot().listMaterials()) if (m.getName() === 'stone') {
  const rgb = [1, 3, 5].map(i => (parseInt(stoneTint.slice(i, i + 2), 16) / 255) ** 2.2);
  m.setBaseColorFactor([rgb[0], rgb[1], rgb[2], 1]).setExtras({...m.getExtras(), tint: stoneTint});
}
const reviewFile = path.join(out, 'review.glb');
await new NodeIO().write(reviewFile, review);
result.review = {file: reviewFile, triangles};
console.log(JSON.stringify(result));
