/**
 * Browser half of kit-sheets.ts: draws one landmark kit at gallery-card size from one azimuth and returns a PNG.
 * Same geometry path as the game (bag-tiles, the BAG-keyed base tiles), and the kit viewer (kitGeometry + buildKitChunk), with grey context prisms from the
 * building tiles around the kit. Bundled by kit-sheets.ts with esbuild (global `KitSheets`); not imported by the game.
 */
import * as THREE from 'three';
import { KITS, decorateKitRoof, kitGeometry, kitIds, type PartInput } from '../../src/canalRecall/landmarkKits.js';
import { buildKitChunk, wallTopHeightM } from '../../src/canalRecall/threeBuildingMesh.js';

export type RenderRequest = { kit: string; centre: [number, number]; azDeg: number; elDeg?: number; w: number; h: number };
export type RenderResult = { png: string; parts: number; tris: number; top: number; contextBuildings: number };

const TILE_Z = 14;
const cache = new Map<string, Promise<any[]>>();
const tileOf = (lng: number, lat: number): [number, number] => {
  const n = 2 ** TILE_Z, r = lat * Math.PI / 180;
  return [Math.floor(((lng + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)];
};

function loadTile(x: number, y: number): Promise<any[]> {
  const key = `${x}/${y}`;
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      const response = await fetch(`/data/extracts/amsterdam/bag-tiles/${TILE_Z}/${x}/${y}.geojson.gz`);
      if (!response.ok) return [];
      const bytes = new Uint8Array(await response.arrayBuffer());
      const text = bytes[0] === 0x1f && bytes[1] === 0x8b
        ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
        : new TextDecoder().decode(bytes);
      return JSON.parse(text).features ?? [];
    })();
    cache.set(key, p);
  }
  return p;
}

let renderer: THREE.WebGLRenderer | null = null;
let canvasSize = '';

export async function renderKit(req: RenderRequest): Promise<RenderResult> {
  const kit = KITS.find(k => k.name === req.kit);
  if (!kit) throw new Error(`no kit ${req.kit}`);
  const [clng, clat] = req.centre;
  const kx = 111_320 * Math.cos(clat * Math.PI / 180), ky = 110_540;
  const local = (ring: number[][]) => ring.map(([lng, lat]) => [(lng - clng) * kx, (lat - clat) * ky] as [number, number]);
  const [tx, ty] = tileOf(clng, clat);
  const features = (await Promise.all([-1, 0, 1].flatMap(dx => [-1, 0, 1].map(dy => loadTile(tx + dx, ty + dy))))).flat();

  // The kit's own parts: every id the kit names (tiers, stacks, roofs, halls, forms, hides), so generic kits draw from their pand.
  const mine = new Set(kitIds(kit));
  const parts = new Map<string, PartInput>();
  const context: { pts: [number, number][]; h: number; min: number }[] = [];
  const ringPoints: [number, number][] = [];
  for (const f of features) {
    const g = f.geometry; if (!g) continue;
    const ring = g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0]?.[0];
    if (!ring?.length) continue;
    const id = String(f.properties.id), pts = local(ring);
    if (mine.has(id)) { parts.set(id, { id, ring: pts, minHeightM: Number(f.properties.minHeight) || 0, heightM: Number(f.properties.height) }); ringPoints.push(...pts); }
    else if (Math.hypot(pts[0][0], pts[0][1]) < 70) context.push({ pts: pts as [number, number][], h: Number(f.properties.height) || 8, min: Number(f.properties.minHeight) || 0 });
  }
  // Frame the kit: centre on its own parts, distance from its height and its footprint radius.
  let cx = 0, cz = 0, top = 0, rad = 0;
  if (ringPoints.length) {
    for (const [x, y] of ringPoints) { cx += x; cz -= y; }
    cx /= ringPoints.length; cz /= ringPoints.length;
    for (const [x, y] of ringPoints) rad = Math.max(rad, Math.hypot(x - cx, -y - cz));
  }
  for (const p of parts.values()) top = Math.max(top, p.heightM);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e9e4d4');
  scene.add(new THREE.HemisphereLight(0xffffff, 0x998f80, 1.6));
  const sun = new THREE.DirectionalLight(0xfff2dd, 1.8); sun.position.set(-40, 80, 60); scene.add(sun);

  let tris = 0;
  if (parts.size) {
    const chunk = buildKitChunk(kitGeometry(kit, parts), { plain: 0, flat: 0, slope: 0 });
    tris = chunk.vertexCount / 3;
    const geometry = new THREE.BufferGeometry();
    const pos = new Float32Array(chunk.vertexCount * 3), col = new Float32Array(chunk.vertexCount * 3);
    for (let i = 0; i < chunk.vertexCount; i++) {
      pos[i * 3] = chunk.positions[i * 3]; pos[i * 3 + 1] = chunk.positions[i * 3 + 2]; pos[i * 3 + 2] = -chunk.positions[i * 3 + 1];
      const s = chunk.tints[i * 4 + 3] / 255;
      for (let c = 0; c < 3; c++) col[i * 3 + c] = (chunk.tints[i * 4 + c] / 255) * s;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
    scene.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  }
  // Context: grey prisms around the kit, drawn to their own height (the kit's hosts are drawn by the kit).
  for (const c of context) {
    const shape = new THREE.Shape(c.pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(1, c.h - c.min), bevelEnabled: false });
    g.rotateX(-Math.PI / 2); g.translate(0, c.min, 0);
    scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: "#b9b2a4", side: THREE.DoubleSide })));
  }
  // Hosts: in the game the plain building layer draws the pand under a kit (roof hosts to the eaves, the rest to full height);
  // here they are drawn in the kit wall colour so a generic kit reads as the building it sits on.
  // Wall tops as the game puts them (decorateKitRoof, then wallTopHeightM): a roof or hall host stops at its kit eaves.
  const towerIds = new Set([...kit.tiers.map(t => t.id), ...kit.stacks.map(s => s.onId)]);
  for (const id of [...parts.keys()].filter(id => !towerIds.has(id))) {
    const part = parts.get(id); if (!part) continue;
    const wallTop = wallTopHeightM(decorateKitRoof({ type: 'Feature', properties: { id, height: part.heightM, minHeight: part.minHeightM }, geometry: null }).properties);
    const shape = new THREE.Shape(part.ring.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.5, wallTop - part.minHeightM), bevelEnabled: false });
    g.rotateX(-Math.PI / 2); g.translate(0, part.minHeightM, 0);
    scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: kit.wall?.hex ?? "#9a5240", side: THREE.DoubleSide })));
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#ddd7c6' }));
  ground.position.y = -0.05; scene.add(ground);

  const size = `${req.w}x${req.h}`;
  if (!renderer || canvasSize !== size) {
    renderer?.dispose();
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1); renderer.setSize(req.w, req.h, false);
    canvasSize = size;
  }
  const camera = new THREE.PerspectiveCamera(35, req.w / req.h, 1, 2000);
  const dist = Math.max(60, top * 1.7, rad * 2.4);
  const focusY = top * 0.45, a = req.azDeg * Math.PI / 180, e = (req.elDeg ?? 18) * Math.PI / 180;
  camera.position.set(cx + Math.sin(a) * Math.cos(e) * dist, focusY + Math.sin(e) * dist, cz - Math.cos(a) * Math.cos(e) * dist);
  camera.lookAt(cx, focusY, cz);
  renderer.render(scene, camera);
  const png = renderer.domElement.toDataURL('image/png');
  scene.traverse(o => { const m = o as THREE.Mesh; m.geometry?.dispose(); });
  return { png, parts: parts.size, tris, top: Math.round(top * 10) / 10, contextBuildings: context.length };
}

(globalThis as any).KitSheets = { renderKit };
