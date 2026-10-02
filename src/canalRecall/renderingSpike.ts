/**
 * Rendering spike (branch explore/rendering-stack): buildings as three.js
 * meshes with per-wall texture coordinates, so windows and doors line up with
 * each building. `?mode=repeat` reproduces today's fixed-size repeat for a
 * side-by-side. Not wired into the game.
 */
// @ts-expect-error Installed runtime has no separate Three declarations.
import * as THREE from 'three';
import { tileFor, tilesCovering } from './slippyTiles.js';
import { planWall, hashSeed, TARGET_BAY_M, TARGET_STOREY_M } from './wallBays.js';
import { bayStyleFor, bayTexture, type BayKind, type Look } from './bayTextures.js';

type Feature = { properties: Record<string, unknown>; geometry: { type: string; coordinates: any } };
const q = new URLSearchParams(location.search);
const num = (key: string, fallback: number) => Number.isFinite(Number(q.get(key))) && q.get(key) !== null ? Number(q.get(key)) : fallback;
const lat0 = num('lat', 52.3742), lng0 = num('lng', 4.8817), radius = num('radius', 160);
const look: Look = q.get('look') === 'photo' ? 'photo' : 'cartoon';
const mode = q.get('mode') === 'repeat' ? 'repeat' : 'aligned';
const kx = 111_320 * Math.cos(lat0 * Math.PI / 180), ky = 110_540;
const local = ([lng, lat]: number[]): [number, number] => [(lng - lng0) * kx, (lat - lat0) * ky]; // x east, y north

const WALL_TINTS = ['#ffffff', '#f2d9c8', '#d9b9a4', '#e6c9b0', '#c9a38c', '#f0e4d2'];
const ROOF_TINTS = look === 'cartoon' ? ['#b5574a', '#7f93a3', '#6b7785', '#a8786a'] : ['#8d5a48', '#7c8080', '#9a8f80', '#6e6a68'];

async function loadTile(z: number, x: number, y: number): Promise<Feature[]> {
  const response = await fetch(`/data/extracts/amsterdam/building-tiles/${z}/${x}/${y}.geojson.gz`);
  if (!response.ok) return [];
  // Some servers (Vite dev) already send Content-Encoding: gzip, so the bytes may be plain JSON.
  const bytes = new Uint8Array(await response.arrayBuffer());
  const gzipped = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  const text = gzipped
    ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
    : new TextDecoder().decode(bytes);
  return (JSON.parse(text).features ?? []) as Feature[];
}

async function loadBrick(): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = '/canal-drive/materials/ambientcg/Bricks057/colour.jpg';
  await image.decode();
  return image;
}

type Bucket = { positions: number[]; uvs: number[]; colours: number[]; index: number[] };
const doors: Array<{ x: number; z: number; nx: number; nz: number; y: number }> = [];
const buckets = new Map<string, { kind: BayKind; seed: string; bucket: Bucket }>();
function bucketFor(kind: BayKind, seed: string): Bucket {
  const st = bayStyleFor(seed, look);
  const key = `${kind}|${st.wall}|${st.frame}|${st.door}|${st.shutters}|${st.arch}`;
  let entry = buckets.get(key);
  if (!entry) { entry = { kind, seed, bucket: { positions: [], uvs: [], colours: [], index: [] } }; buckets.set(key, entry); }
  return entry.bucket;
}

function quad(b: Bucket, a: THREE.Vector3, c: THREE.Vector3, y0: number, y1: number, u0: number, u1: number, v0: number, v1: number, tint: THREE.Color): void {
  const base = b.positions.length / 3;
  b.positions.push(a.x, y0, a.z, c.x, y0, c.z, c.x, y1, c.z, a.x, y1, a.z);
  b.uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
  for (let i = 0; i < 4; i++) b.colours.push(tint.r, tint.g, tint.b);
  b.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function addBuilding(feature: Feature, roofs: Bucket): void {
  const p = feature.properties, id = String(p.id ?? Math.random());
  const height = Number(p.height), minHeight = Number(p.minHeight) || 0;
  if (!Number.isFinite(height) || height - minHeight < 2) return;
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates]
    : feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates : [];
  const tint = new THREE.Color(look === 'cartoon' ? '#ffffff' : WALL_TINTS[hashSeed(id) % WALL_TINTS.length]);
  const roofTint = new THREE.Color(ROOF_TINTS[hashSeed(id + 'r') % ROOF_TINTS.length]);
  for (const polygon of polygons) {
    let ring: Array<[number, number]> = polygon[0].map(local);
    if (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring.pop();
    if (ring.length < 3) continue;
    let area = 0;
    for (let i = 0; i < ring.length; i++) { const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % ring.length]; area += x1 * y2 - x2 * y1; }
    if (area < 0) ring = ring.reverse(); // counter-clockwise: u runs left to right seen from outside
    for (let i = 0; i < ring.length; i++) {
      const [ax, ay] = ring[i], [bx, by] = ring[(i + 1) % ring.length];
      const length = Math.hypot(bx - ax, by - ay);
      if (length < 0.3) continue;
      const a = new THREE.Vector3(ax, 0, -ay), c = new THREE.Vector3(bx, 0, -by);
      const rise = height - minHeight;
      const plan = planWall(length, height, minHeight, `${id}:${i}`);
      const seed = id;
      if (mode === 'repeat' || plan.plain) {
        // Today's behaviour: the texture repeats at its natural size and is cut wherever the wall ends.
        const kind: BayKind = plan.plain ? 'plain' : 'upper';
        quad(bucketFor(kind, seed), a, c, minHeight, height, 0, length / TARGET_BAY_M, 0, rise / TARGET_STOREY_M, tint);
        continue;
      }
      const lerp = (t: number) => new THREE.Vector3().lerpVectors(a, c, t);
      for (let bay = 0; bay < plan.bays; bay++) {
        const from = lerp(bay / plan.bays), to = lerp((bay + 1) / plan.bays);
        const kind: BayKind = plan.doorBays.includes(bay) ? 'groundDoor' : 'groundWindow';
        quad(bucketFor(kind, seed), from, to, minHeight, minHeight + plan.groundHeightM, 0, 1, 0, 1, tint);
        if (kind === 'groundDoor' && minHeight === 0) {
          // Outward normal for a counter-clockwise ring is (dy, -dx) in plan, i.e. (dy, +dx) in x/z.
          const dx = (bx - ax) / length, dy = (by - ay) / length;
          const mid = lerp((bay + 0.25) / plan.bays);
          doors.push({ x: mid.x, z: mid.z, nx: dy, nz: dx, y: 1.2 });
        }
        if (plan.storeys > 0) quad(bucketFor('upper', seed), from, to, minHeight + plan.groundHeightM, height, 0, 1, 0, plan.storeys, tint);
      }
    }
    const shape = ring.map(([x, y]) => new THREE.Vector2(x, y));
    const tris = THREE.ShapeUtils.triangulateShape(shape, []);
    const base = roofs.positions.length / 3;
    for (const [x, y] of ring) { roofs.positions.push(x, height, -y); roofs.uvs.push(0, 0); roofs.colours.push(roofTint.r, roofTint.g, roofTint.b); }
    for (const t of tris) roofs.index.push(base + t[0], base + t[2], base + t[1]);
  }
}

async function main(): Promise<void> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.style.margin = '0';
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(look === 'cartoon' ? '#bfe3f5' : '#d9e6ee');
  scene.add(new THREE.HemisphereLight('#ffffff', '#e6dccb', look === 'cartoon' ? 2.2 : 1.5));
  const sun = new THREE.DirectionalLight('#fff4e0', 1.6); sun.position.set(-80, 120, 60); scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: look === 'cartoon' ? '#f6efe0' : '#efeadf' }));
  ground.position.y = -0.05; scene.add(ground);

  const dLat = radius / ky, dLng = radius / kx;
  const tiles = tilesCovering({ west: lng0 - dLng, east: lng0 + dLng, south: lat0 - dLat, north: lat0 + dLat }, 14, 0);
  const brick = await loadBrick();
  const all = (await Promise.all(tiles.map(t => loadTile(t.z, t.x, t.y)))).flat();
  const roofs: Bucket = { positions: [], uvs: [], colours: [], index: [] };
  let count = 0;
  for (const feature of all) {
    const ring = feature.geometry.type === 'Polygon' ? feature.geometry.coordinates[0] : feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates[0][0] : null;
    if (!ring) continue;
    const [x, y] = local(ring[0]);
    if (Math.hypot(x, y) > radius) continue;
    addBuilding(feature, roofs); count++;
  }

  const make = (b: Bucket, material: THREE.Material) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uvs, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(b.colours, 3));
    g.setIndex(b.index); g.computeVertexNormals();
    scene.add(new THREE.Mesh(g, material));
  };
  for (const { kind, seed, bucket } of buckets.values()) {
    const texture = new THREE.CanvasTexture(bayTexture(kind, bayStyleFor(seed, look), brick, look));
    texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy(); texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    make(bucket, new THREE.MeshLambertMaterial({ map: texture, vertexColors: true, side: THREE.DoubleSide }));
  }
  make(roofs, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));

  const camera = new THREE.PerspectiveCamera(num('fov', 42), innerWidth / innerHeight, 1, 5000);
  const yaw = num('yaw', 20) * Math.PI / 180, pitch = num('pitch', 28) * Math.PI / 180, dist = num('dist', 70);
  const tx = num('tx', 0), tz = num('tz', 0), ty = num('ty', 6);
  camera.position.set(tx + Math.sin(yaw) * Math.cos(pitch) * dist, ty + Math.sin(pitch) * dist, tz + Math.cos(yaw) * Math.cos(pitch) * dist);
  const doorIndex = q.get('door');
  if (doorIndex !== null && doors.length) {
    const d = doors[Math.min(doors.length - 1, Number(doorIndex))];
    const back = num('back', 9);
    camera.position.set(d.x + d.nx * back, 2.2, d.z + d.nz * back);
    camera.lookAt(d.x, 3.2, d.z);
  } else camera.lookAt(tx, ty, tz);
  renderer.render(scene, camera);
  (window as any).__spike = { ready: true, mode, look, buildings: count, meshes: buckets.size + 1, tiles: tiles.length, doors: doors.length };
}
main().catch(error => { (window as any).__spike = { ready: false, error: String(error) }; console.error(error); });
