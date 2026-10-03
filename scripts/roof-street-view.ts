// Browser entry for scripts/roof-street-shots.ts: deterministic rows of houses
// with the real roof planner and builder, in flat part colours, for looking at
// roof shapes without streaming the city. `?scene=<name>` picks a row.
import * as THREE from 'three';
import { planBuildingRoof, roofTrianglesForOutline, type RoofPlan } from '../src/canalRecall/roofMesh.ts';

type V2 = [number, number];
const ORIGIN = { lng: 4.9, lat: 52.37 }, KX = 111_320 * Math.cos(ORIGIN.lat * Math.PI / 180), KY = 110_540;
const dims = { bayM: 5, storeyM: 3.1, cellM: 1.2 };
const WALLS = ['#9b4a36', '#8a4b3a', '#7a3f33', '#b7a58a', '#a65a40', '#6f3b30'];
const TILE = ['#b5543a', '#a8482f', '#c0603f', '#9c4a35'], SLATE = ['#4b525c', '#3f464f', '#5a6068'];

type House = { id: string; style: string; ring: V2[]; h: number; tag?: string };
function row(style: string, n: number, w: number, d: number, h: number, x0 = 0, y0 = 0, seed = style, tag?: string): House[] {
  const out: House[] = [];
  let x = x0;
  for (let i = 0; i < n; i++) {
    const ww = w * (0.85 + ((i * 37) % 10) / 30), hh = h + ((i * 53) % 7) * 0.6;
    out.push({ id: `${seed}${i}`, style, ring: [[x, y0], [x + ww, y0], [x + ww, y0 + d], [x, y0 + d], [x, y0]], h: hh, tag });
    x += ww;
  }
  return out;
}
const SCENES: Record<string, () => House[]> = {
  canal: () => [...row('canal', 9, 6.2, 15, 15, 0, 0, 'cA'), ...row('canal', 9, 6.2, 15, 14, 0, 30, 'cB')],
  c19: () => [...row('c19', 10, 6.4, 14, 16, 0, 0, 'k', 'quadruple_saltbox'), ...row('c19', 10, 6.4, 14, 16, 0, 30, 'm')],
  mixed: () => [
    { id: 'L1', style: 'c19', ring: [[0, 0], [18, 0], [18, 7], [7, 7], [7, 16], [0, 16], [0, 0]], h: 16 },
    { id: 'turret3', style: 'c19', ring: [[24, 0], [42, 0], [42, 11], [39, 14], [24, 14], [24, 0]], h: 17 },
    { id: 'school1', style: 'school', ring: [[48, 0], [70, 0], [70, 12], [48, 12], [48, 0]], h: 15 },
    { id: 'saw1', style: 'postwar', ring: [[0, 26], [24, 26], [24, 48], [0, 48], [0, 26]], h: 9 },
    { id: 'villa2', style: 'c19', ring: [[30, 26], [41, 26], [41, 38], [30, 38], [30, 26]], h: 11 },
    { id: 'mod1', style: 'modern', ring: [[48, 26], [74, 26], [74, 40], [60, 40], [60, 48], [48, 48], [48, 26]], h: 20 },
  ],
};

const scene = new THREE.Scene(); scene.background = new THREE.Color('#dfe6ea');
scene.add(new THREE.HemisphereLight(0xffffff, 0x8f8a80, 1.6));
const sun = new THREE.DirectionalLight(0xfff2dd, 1.9); sun.position.set(-30, 60, 40); scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: '#cfc8b8' })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
const name = new URLSearchParams(location.search).get('scene') ?? 'canal';
const houses = (SCENES[name] ?? SCENES.canal)();
const pos: number[] = [], col: number[] = [];
const hex = (h: string) => new THREE.Color(h);
const push = (p: number[][], c: THREE.Color) => { for (const q of p) { pos.push(q[0], q[2], -q[1]); col.push(c.r, c.g, c.b); } };
const kinds: string[] = [];
houses.forEach((b, i) => {
  const lngLat = b.ring.map(([x, y]) => [ORIGIN.lng + x / KX, ORIGIN.lat + y / KY]);
  const wall = hex(WALLS[i % WALLS.length]);
  const local = b.ring.map(([x, y]) => [x - b.ring[0][0], y - b.ring[0][1]] as V2);
  const plan: RoofPlan | null = planBuildingRoof(b.id, b.style, b.h, 0, local, b.tag);
  kinds.push(`${b.id}:${plan ? plan.kind + (plan.kind === 'gable' ? '/' + plan.gable : '') + (plan.turret ? '+turret' : '') : 'flat'}`);
  const eaves = plan ? b.h - plan.riseM : b.h;
  // Walls and (when kept) the lid at the eaves.
  const pts = b.ring.slice(0, -1);
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k], c = pts[(k + 1) % pts.length];
    push([[a[0], a[1], 0], [c[0], c[1], 0], [c[0], c[1], eaves], [a[0], a[1], 0], [c[0], c[1], eaves], [a[0], a[1], eaves]], wall);
  }
  if (!plan || plan.keepLid) {
    const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ShapeGeometry(shape); g.rotateX(-Math.PI / 2); g.translate(0, eaves + 0.01, 0);
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: '#8f8a83', side: THREE.DoubleSide })); scene.add(m);
  }
  if (!plan) return;
  const tris = roofTrianglesForOutline(lngLat, ORIGIN, plan, eaves, dims, KX);
  const roofHex = hex((plan.material === 'tile' ? TILE : SLATE)[Math.floor(plan.tone * 3)]);
  for (const t of tris) {
    const c = t.hex ? hex(t.hex) : t.part === 'trim' || t.part === 'decal' ? hex('#ffffff') : t.part === 'plate' ? wall : t.part === 'dormerFace' ? hex('#3b4650') : roofHex;
    // Mesh frame x = east (metres from ORIGIN): back to this scene's metres.
    push(t.p.map(q => [q[0], q[1], q[2]]), c);
  }
});
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
scene.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.FrontSide })));
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setSize(1400, 820); document.body.append(renderer.domElement);
const xs = houses.flatMap(h => h.ring.map(p => p[0])), ys = houses.flatMap(h => h.ring.map(p => p[1]));
const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2, span = Math.max(Math.max(...xs) - Math.min(...xs), 40);
const view = new URLSearchParams(location.search).get('view') ?? 'front';
const cam = new THREE.PerspectiveCamera(32, 1400 / 820, 1, 1000);
if (view === 'front') cam.position.set(cx - span * 0.15, span * 0.42, -(Math.min(...ys) - span * 0.95)); else cam.position.set(cx + span * 0.6, span * 0.7, -(cy - span * 0.8));
cam.lookAt(cx, 8, -cy);
renderer.render(scene, cam);
(window as any).__kinds = kinds;
(window as any).__done = true;
