// Standalone viewer for landmark kits: loads the real OSM parts, builds the kit
// geometry with the same code the game uses, and draws it (flat colours) with grey
// context buildings. `?kit=Westerkerk&az=30&el=18&d=1.0`. For shaping geometry.
import { KITS, kitGeometry, type PartInput } from './landmarkKits.js';
import { buildKitChunk } from './threeBuildingMesh.js';

const CENTRES: Record<string, [number, number]> = {
  Westerkerk: [4.88361, 52.37439], Zuiderkerk: [4.89955, 52.37020], Montelbaanstoren: [4.90557, 52.37205], Noorderkerk: [4.88619, 52.37956], 'Royal Palace': [4.89182, 52.37326],
};
const q = new URLSearchParams(location.search);
const kitName = q.get('kit') ?? 'Westerkerk', az = Number(q.get('az') ?? 30), el = Number(q.get('el') ?? 18), zoom = Number(q.get('d') ?? 1);
const [clng, clat] = CENTRES[kitName];
const kx = 111_320 * Math.cos(clat * Math.PI / 180), ky = 110_540;
const tileOf = (lng: number, lat: number) => { const n = 2 ** 14, r = lat * Math.PI / 180; return [Math.floor(((lng + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)]; };

async function loadTile(x: number, y: number): Promise<any[]> {
  const response = await fetch(`/data/extracts/amsterdam/building-tiles/14/${x}/${y}.geojson.gz`);
  if (!response.ok) return [];
  const bytes = new Uint8Array(await response.arrayBuffer());
  const text = bytes[0] === 0x1f && bytes[1] === 0x8b ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text() : new TextDecoder().decode(bytes);
  return JSON.parse(text).features ?? [];
}

(async () => {
  const THREE = (window as any).CanalRecallThree.THREE;
  const [tx, ty] = tileOf(clng, clat);
  const features = (await Promise.all([-1, 0, 1].flatMap(dx => [-1, 0, 1].map(dy => loadTile(tx + dx, ty + dy))))).flat();
  const local = (ring: number[][]) => ring.map(([lng, lat]) => [(lng - clng) * kx, (lat - clat) * ky] as [number, number]);
  const kit = KITS.find(k => k.name === kitName)!;
  const mine = new Set([...kit.tiers.map(t => t.id), ...kit.stacks.map(s => s.onId), ...kit.roofs.map(r => r.id)]);
  const parts = new Map<string, PartInput>(), context: any[] = [];
  for (const f of features) {
    const g = f.geometry, ring = g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0], id = String(f.properties.id);
    const pts = local(ring);
    if (mine.has(id)) parts.set(id, { id, ring: pts, minHeightM: Number(f.properties.minHeight) || 0, heightM: Number(f.properties.height) });
    else if (Math.hypot(pts[0][0], pts[0][1]) < 70) context.push({ pts, h: Number(f.properties.height) || 8, min: Number(f.properties.minHeight) || 0 });
  }
  const chunk = buildKitChunk(kitGeometry(kit, parts), { plain: 0, flat: 0, slope: 0 });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e9e4d4');
  scene.add(new THREE.HemisphereLight(0xffffff, 0x998f80, 1.6));
  const sun = new THREE.DirectionalLight(0xfff2dd, 1.8); sun.position.set(-40, 80, 60); scene.add(sun);
  // Kit: y up, x east, z south in three; our chunk is x east, y north, z up.
  const geometry = new THREE.BufferGeometry();
  const pos = new Float32Array(chunk.vertexCount * 3), col = new Float32Array(chunk.vertexCount * 3);
  for (let i = 0; i < chunk.vertexCount; i++) {
    pos[i * 3] = chunk.positions[i * 3]; pos[i * 3 + 1] = chunk.positions[i * 3 + 2]; pos[i * 3 + 2] = -chunk.positions[i * 3 + 1];
    const s = chunk.tints[i * 4 + 3] / 255; for (let c = 0; c < 3; c++) col[i * 3 + c] = (chunk.tints[i * 4 + c] / 255) * s;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  scene.add(mesh);
  // Context: simple grey prisms; the kit's own hosts are omitted (they are drawn by the kit).
  for (const c of context) {
    const shape = new THREE.Shape(c.pts.map(([x, y]: [number, number]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(1, c.h - c.min), bevelEnabled: false });
    g.rotateX(-Math.PI / 2); g.translate(0, c.min, 0);
    scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: '#b9b2a4' })));
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#ddd7c6' }));
  ground.position.y = -0.05; scene.add(ground);
  let top = 0; for (const p of parts.values()) top = Math.max(top, p.heightM);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(innerWidth, innerHeight); document.body.style.margin = '0'; document.body.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 1, 2000);
  const [cx, cz] = [...parts.values()].reduce((a, p) => [a[0] + p.ring[0][0] / parts.size, a[1] - p.ring[0][1] / parts.size], [0, 0]);
  const dist = (Number(q.get('r') ?? 0) || Math.max(60, top * 1.7)) / zoom, a = az * Math.PI / 180, e = el * Math.PI / 180;
  const focusY = Number(q.get('y') ?? top * 0.45);
  camera.position.set(cx + Math.sin(a) * Math.cos(e) * dist, focusY + Math.sin(e) * dist, cz - Math.cos(a) * Math.cos(e) * dist);
  camera.lookAt(cx, focusY, cz);
  renderer.render(scene, camera);
  (window as any).__kitInfo = { parts: parts.size, tris: chunk.vertexCount / 3, top };
  document.title = 'ready';
})();
