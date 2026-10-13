/**
 * Render check for the coplanar-overlap metric (geometryAudit.ts `auditZFight`): does WebGL actually draw the rear face of a
 * flagged patch through its front face when the model is seen from the air, with the game's projection?
 *
 * For each model the top patches are tinted: the face nearer the camera green, the one behind it red, everything else grey
 * (unlit vertex colours, so pixel classes are exact). Pass 1 draws only the green faces and keeps their pixels as a mask; pass 2
 * draws the whole model, and `bleed` is the share of mask pixels that come out red: 0 when the depth buffer separates the two
 * faces, up to ~0.5 for a true coplanar tie. The projection is MapLibre's (fov 36.87 degrees, near = camera distance / 75),
 * at two aerial distances, 450 m (map zoom ~17) and 900 m (~16), plus a driving view 900 m out with a 2 m near plane. `--calibrate` measures bleed against gap for a synthetic strip,
 * aerial and from a pitched driving camera whose near plane is 2 m. A plain render of the GLB with its own materials is saved
 * beside each tinted one (ShotRenderer).
 *
 *   node --import tsx scripts/landmarks/zfight-validate.ts --ids=centraal-station,rai-amsterdam [--clear=artis-library,...] [--out=artifacts/zfight-audit/validation]
 *   node --import tsx scripts/landmarks/zfight-validate.ts --from-report=artifacts/zfight-audit/before/report.json --top=5 --clear-count=5
 */
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {chromium} from '@playwright/test';
import {auditZFight, type ZFightPatch} from '../../src/canalRecall/landmarks/geometryAudit';
import type {MaterialSoup} from '../../src/canalRecall/landmarks/facadeCompare';
import {loadMaterialSoup} from './material-soup';
import {ShotRenderer, type V3} from './geometry-audit-shots';
import {listModels} from './zfight-survey';

const ROOT = path.resolve(import.meta.dirname, '../..');
const threeDir = path.resolve(path.dirname(createRequire(import.meta.url).resolve('three')), '..');
const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const W = 1200, H = 800, FOV = 36.87;

const HTML = `<html><body style="margin:0;background:#000"><script type="importmap">{"imports":{"three":"http://local/build/three.module.js"}}</script>
<script type="module">
import * as T from 'three';
const r=new T.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});r.setSize(${W},${H});r.setPixelRatio(1);document.body.appendChild(r.domElement);
const s=new T.Scene();s.background=new T.Color(0x203040);
let meshes=[];
const dec=b=>new Float32Array(Uint8Array.from(atob(b),c=>c.charCodeAt(0)).buffer);
window.setModel=(parts)=>{for(const m of meshes)s.remove(m);meshes=[];
  for(const p of parts){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(dec(p.pos),3));g.setAttribute('color',new T.BufferAttribute(dec(p.col),3));
    const m=new T.Mesh(g,new T.MeshBasicMaterial({vertexColors:true,side:p.double?T.DoubleSide:T.FrontSide}));m.userData.front=p.front;meshes.push(m);s.add(m);}
};
window.render=(cam)=>{
  const c=new T.PerspectiveCamera(${FOV},${W}/${H},cam.near,cam.far);c.position.set(...cam.eye);c.lookAt(...cam.target);c.updateProjectionMatrix();
  const px=new Uint8Array(${W}*${H}*4),gl=r.getContext();
  for(const m of meshes)m.visible=m.userData.front;r.render(s,c);gl.readPixels(0,0,${W},${H},gl.RGBA,gl.UNSIGNED_BYTE,px);
  const mask=new Uint8Array(${W}*${H});for(let i=0;i<mask.length;i++)mask[i]=px[i*4+1]>200&&px[i*4]<60?1:0;
  for(const m of meshes)m.visible=true;r.render(s,c);gl.readPixels(0,0,${W},${H},gl.RGBA,gl.UNSIGNED_BYTE,px);
  let inMask=0,red=0,green=0,redAll=0,greenAll=0;
  for(let i=0;i<mask.length;i++){const R=px[i*4],G=px[i*4+1],B=px[i*4+2],isR=R>200&&G<60&&B<60,isG=G>200&&R<60&&B<60;if(isR)redAll++;if(isG)greenAll++;if(!mask[i])continue;inMask++;if(isR)red++;if(isG)green++;}
  return {inMask,red,green,redAll,greenAll,url:r.domElement.toDataURL('image/png')};
};
document.title='ready';
</script></body></html>`;

type Shot = {eye: V3; target: V3; near: number; far: number};
const b64 = (a: number[]) => Buffer.from(new Float32Array(a).buffer).toString('base64');

function triCentroidOffset(s: MaterialSoup, t: number, n: V3): number {
  let o = 0;
  for (let k = 0; k < 3; k++) { const v = s.indices[t * 3 + k]; o += (n[0] * s.positions[v * 3] + n[1] * s.positions[v * 3 + 1] + n[2] * s.positions[v * 3 + 2]) / 3; }
  return o;
}

/** Vertex-coloured parts for one camera: per tinted patch the face toward the camera green, the one behind it red. */
function partsFor(s: MaterialSoup, patches: ZFightPatch[], eye: V3) {
  const role = new Int8Array(s.indices.length / 3); // 0 grey, 1 rear (red), 2 front (green)
  for (const p of patches) {
    const n = p.normal, toEye = n[0] * (eye[0] - p.centre[0]) + n[1] * (eye[1] - p.centre[1]) + n[2] * (eye[2] - p.centre[2]);
    // Seen from the side the normal points to unless the camera is behind the plane (a double-sided underside seen from above).
    const sign = toEye >= 0 ? 1 : -1;
    const mean = (ts: number[]) => ts.reduce((t, x) => t + triCentroidOffset(s, x, n), 0) / Math.max(1, ts.length);
    const aFront = sign * mean(p.trisA) >= sign * mean(p.trisB);
    for (const t of p.trisA) role[t] = aFront ? 2 : role[t] === 2 ? 2 : 1;
    for (const t of p.trisB) role[t] = aFront ? (role[t] === 2 ? 2 : 1) : 2;
  }
  const buckets = new Map<string, {pos: number[]; col: number[]; double: boolean; front: boolean}>();
  for (let t = 0; t < role.length; t++) {
    const double = !!s.materials[s.triMaterial[t]]?.doubleSided, key = `${double}|${role[t]}`;
    let b = buckets.get(key); if (!b) { b = {pos: [], col: [], double, front: role[t] === 2}; buckets.set(key, b); }
    const P = [0, 1, 2].map(k => { const v = s.indices[t * 3 + k]; return [s.positions[v * 3], s.positions[v * 3 + 1], s.positions[v * 3 + 2]]; });
    const u = P[1].map((x, k) => x - P[0][k]), w = P[2].map((x, k) => x - P[0][k]);
    const nn = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], l = Math.hypot(...nn) || 1;
    const shade = 0.35 + 0.35 * Math.abs((nn[0] * -0.4 + nn[1] * 0.8 + nn[2] * 0.45) / l);
    const c = role[t] === 1 ? [1, 0, 0] : role[t] === 2 ? [0, 1, 0] : [shade, shade, shade];
    for (const p of P) { b.pos.push(...p); b.col.push(...c); }
  }
  return [...buckets.values()].map(b => ({pos: b64(b.pos), col: b64(b.col), double: b.double, front: b.front}));
}

/** Aerial cameras at two distances, looking at the worst patch from its facing side (walls) or from the south-east (roofs). */
function cameras(p: ZFightPatch): {label: string; shot: Shot}[] {
  const horiz = Math.hypot(p.normal[0], p.normal[2]);
  const az = p.orientation === 'wall' && horiz > 0.3 ? Math.atan2(p.normal[0], p.normal[2]) + 0.35 : Math.PI * 0.2;
  const el = (40 * Math.PI) / 180;
  const at = (d: number, e: number): V3 => [p.centre[0] + d * Math.cos(e) * Math.sin(az), p.centre[1] + d * Math.sin(e), p.centre[2] + d * Math.cos(e) * Math.cos(az)];
  // Aerial: the model is the map centre (near = distance / 75). Driving: a pitched camera whose map centre is ~150 m ahead
  // (near 2 m) sees the model 900 m away, 8 degrees over the horizon.
  return [
    ...[450, 900, 1800].map(d => ({label: `air-${d}m`, shot: {eye: at(d, el), target: p.centre, near: d / 75, far: d * 6}})),
    {label: 'drive-900m', shot: {eye: at(900, (8 * Math.PI) / 180), target: p.centre, near: 2, far: 5400}},
  ];
}

export interface ValidationRow {id: string; expect: 'flagged' | 'clear'; total: number; patches: number; shots: {label: string; bleed: number; inMask: number; red: number; tinted: string; plain: string}[]}

async function main(): Promise<void> {
  const out = path.resolve(ROOT, arg('out') ?? 'artifacts/zfight-audit/validation');
  fs.mkdirSync(out, {recursive: true});
  const all = new Map(listModels('all').map(m => [m.id, m]));
  let flagged = arg('ids')?.split(',') ?? [], clear = arg('clear')?.split(',') ?? [];
  const reportFile = arg('from-report');
  if (reportFile) {
    const rows = (JSON.parse(fs.readFileSync(reportFile, 'utf8')).models as {id: string; total: number; triangles: number; error?: string}[]).filter(r => !r.error);
    flagged = rows.sort((a, b) => b.total - a.total).slice(0, Number(arg('top') ?? 5)).map(r => r.id);
    clear = rows.filter(r => r.total === 0 && r.triangles > 3000).sort((a, b) => b.triangles - a.triangles).slice(0, Number(arg('clear-count') ?? 5)).map(r => r.id);
  }
  const browser = await chromium.launch({args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']});
  const page = await browser.newPage({viewport: {width: W, height: H}});
  page.on('pageerror', e => console.log('pageerror', e.message));
  await page.route('http://local/**', route => route.fulfill({body: fs.readFileSync(path.join(threeDir, new URL(route.request().url()).pathname.replace(/^\//, ''))), contentType: 'text/javascript'}));
  await page.setContent(HTML);
  await page.waitForFunction(() => document.title === 'ready', null, {timeout: 60000});
  if (process.argv.includes('--calibrate')) {
    // Depth-precision calibration: a 10 x 40 m strip floating `gap` over a 60 x 60 m roof 20 m up, seen from the air at three
    // distances with MapLibre's near plane. Prints the bleed per (gap, distance).
    const quad = (x0: number, z0: number, x1: number, z1: number, y: number) => [x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z1, x1, y, z0, x0, y, z0];
    const table: Record<string, Record<string, number>> = {};
    for (const gap of (process.argv.find(a => a.startsWith("--gaps="))?.slice(7).split(",").map(Number) ?? [0, 0.002, 0.005, 0.01, 0.02, 0.03, 0.05, 0.08, 0.12])) {
      const roof = quad(-30, -30, 30, 30, 20), strip = quad(-5, -20, 5, 20, 20 + gap);
      const parts = [{pos: b64(roof), col: b64(roof.map((_, i) => (i % 3 === 0 ? 1 : 0))), double: false, front: false}, {pos: b64(strip), col: b64(strip.map((_, i) => (i % 3 === 1 ? 1 : 0))), double: false, front: true}];
      await page.evaluate(p => (window as unknown as {setModel: (p: unknown) => void}).setModel(p), parts);
      // Aerial: the model is the map centre (near = d / 75). Driving: a pitched camera whose map centre is ~150 m ahead
      // (near 2 m) sees the model far beyond it, low over the horizon (8 degrees).
      for (const [mode, d, near, elDeg] of [['aerial', 450, 6, 40], ['aerial', 900, 12, 40], ['aerial', 1800, 24, 40], ['driving', 450, 2, 8], ['driving', 900, 2, 8], ['driving', 1800, 2, 8], ['driving', 2700, 2, 5]] as const) {
        const el = (elDeg * Math.PI) / 180, az = Math.PI * 0.2;
        const shot: Shot = {eye: [d * Math.cos(el) * Math.sin(az), 20 + d * Math.sin(el), d * Math.cos(el) * Math.cos(az)], target: [0, 20, 0], near, far: Math.max(d * 6, 5000)};
        const r = await page.evaluate(c => (window as unknown as {render: (c: unknown) => {inMask: number; red: number}}).render(c), shot);
        (table[`${gap * 100} cm`] ??= {})[`${mode} ${d} m`] = r.inMask ? +(r.red / r.inMask).toFixed(4) : -1;
      }
    }
    console.table(table);
    fs.writeFileSync(path.join(out, 'calibration.json'), JSON.stringify(table, null, 1));
    await browser.close();
    return;
  }
  const plain = new ShotRenderer();
  const rows: ValidationRow[] = [];
  for (const [ids, expect] of [[flagged, 'flagged'], [clear, 'clear']] as const) for (const id of ids) {
    const m = all.get(id);
    if (!m) { console.log(`${id}: no model`); continue; }
    const s = await loadMaterialSoup(m.file), z = auditZFight(s);
    const tinted = z.patches.slice(0, 12);
    // A cleared model has no patch to aim at: look at its bounding-box centre from the south-east.
    const aim: ZFightPatch = tinted[0] ?? (() => {
      const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < s.positions.length; i++) { mn[i % 3] = Math.min(mn[i % 3], s.positions[i]); mx[i % 3] = Math.max(mx[i % 3], s.positions[i]); }
      return {centre: mn.map((v, k) => (v + mx[k]) / 2), normal: [0, 1, 0], orientation: 'roof'} as unknown as ZFightPatch;
    })();
    const row: ValidationRow = {id, expect, total: +(z.area + z.tightArea).toFixed(2), patches: z.patches.length, shots: []};
    for (const {label, shot} of cameras(aim)) {
      await page.evaluate(parts => (window as unknown as {setModel: (p: unknown) => void}).setModel(parts), partsFor(s, tinted, shot.eye));
      const r = await page.evaluate(c => (window as unknown as {render: (c: unknown) => {inMask: number; red: number; green: number; url: string}}).render(c), shot);
      const tintedFile = path.join(out, `${id}-${label}-tinted.png`), plainFile = path.join(out, `${id}-${label}-plain.png`);
      fs.writeFileSync(tintedFile, Buffer.from(r.url.replace(/^data:image\/png;base64,/, ''), 'base64'));
      await plain.shoot(m.file, {eye: shot.eye, target: shot.target, fov: FOV, near: shot.near, far: shot.far, width: W, height: H, out: plainFile});
      const bleed = r.inMask ? +(r.red / r.inMask).toFixed(4) : 0;
      row.shots.push({label, bleed, inMask: r.inMask, red: r.red, tinted: path.relative(ROOT, tintedFile), plain: path.relative(ROOT, plainFile)});
      console.log(`${id} (${expect}, ${row.total} m2) ${label}: bleed ${(bleed * 100).toFixed(2)}% of ${r.inMask} front-face pixels`);
    }
    rows.push(row);
  }
  await plain.close();
  await browser.close();
  fs.writeFileSync(path.join(out, 'validation.json'), JSON.stringify(rows, null, 1));
}

if (process.argv[1]?.endsWith('zfight-validate.ts')) await main();
