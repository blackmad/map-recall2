/**
 * Rendering spike (branch explore/rendering-stack): buildings as three.js
 * meshes with per-wall texture coordinates, so windows and doors line up with
 * each building. `?mode=repeat` reproduces today's fixed-size repeat for a
 * side-by-side. Not wired into the game.
 *
 * Interactive: drag to orbit, wheel to zoom, shift-drag to pan; buttons switch
 * look and mode. A self-contained preview can pre-seed `window.__SPIKE_EMBED`
 * ({ features, brickUrl }) instead of fetching tiles.
 */
import * as THREE from 'three';
import { tilesCovering } from './slippyTiles.js';
import { planWall, hashSeed, TARGET_BAY_M, TARGET_STOREY_M } from './wallBays.js';
import {
  archetypeFor, bayTextures, buildingStyle, paletteFor,
  type BayKind, type BayVariant, type Look, variantKey,
} from './bayTextures.js';

type Feature = { properties: Record<string, unknown>; geometry: { type: string; coordinates: any } };
type Embed = { features: Feature[]; brickUrl: string; lat: number; lng: number };
const embed: Embed | undefined = (window as any).__SPIKE_EMBED;
const q = new URLSearchParams(location.search);
const num = (key: string, fallback: number) => q.get(key) !== null && Number.isFinite(Number(q.get(key))) ? Number(q.get(key)) : fallback;
const lat0 = embed?.lat ?? num('lat', 52.3742), lng0 = embed?.lng ?? num('lng', 4.8817), radius = num('radius', 160);
let look: Look = q.get('look') === 'photo' ? 'photo' : 'cartoon';
let mode: 'aligned' | 'repeat' = q.get('mode') === 'repeat' ? 'repeat' : 'aligned';
const kx = 111_320 * Math.cos(lat0 * Math.PI / 180), ky = 110_540;
const local = ([lng, lat]: number[]): [number, number] => [(lng - lng0) * kx, (lat - lat0) * ky]; // x east, y north

const ROOFS: Record<Look, string[]> = {
  cartoon: ['#b5574a', '#7f93a3', '#6b7785', '#a8786a', '#8a6f9c'],
  storybook: ['#b5574a', '#7f93a3', '#6b7785', '#a8786a'],
  photo: ['#8d5a48', '#7c8080', '#9a8f80', '#6e6a68'],
};

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
  image.src = embed?.brickUrl ?? '/canal-drive/materials/ambientcg/Bricks057/colour.jpg';
  await image.decode();
  return image;
}

type Bucket = { positions: number[]; uvs: number[]; wall: number[]; accent: number[]; colours: number[]; index: number[] };
const emptyBucket = (): Bucket => ({ positions: [], uvs: [], wall: [], accent: [], colours: [], index: [] });

function quad(b: Bucket, a: any, c: any, y0: number, y1: number, u0: number, u1: number, v0: number, v1: number, wall: any, accent: any): void {
  const base = b.positions.length / 3;
  b.positions.push(a.x, y0, a.z, c.x, y0, c.z, c.x, y1, c.z, a.x, y1, a.z);
  b.uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
  for (let i = 0; i < 4; i++) { b.wall.push(wall.r, wall.g, wall.b); b.accent.push(accent.r, accent.g, accent.b); }
  b.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function wallMaterial(map: any, mask: any): any {
  const material = new THREE.MeshLambertMaterial({ map, side: THREE.DoubleSide });
  material.onBeforeCompile = (shader: any) => {
    shader.uniforms.tintMask = { value: mask };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aWall;\nattribute vec3 aAccent;\nvarying vec3 vWall;\nvarying vec3 vAccent;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWall = aWall; vAccent = aAccent;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D tintMask;\nvarying vec3 vWall;\nvarying vec3 vAccent;')
      .replace('#include <map_fragment>', '#include <map_fragment>\nvec4 tm = texture2D(tintMask, vMapUv);\ndiffuseColor.rgb *= mix(vec3(1.0), vWall, tm.r);\ndiffuseColor.rgb *= mix(vec3(1.0), vAccent, tm.g);');
  };
  return material;
}

type World = { group: any; stats: Record<string, number> };

function buildWorld(features: Feature[], brick: HTMLImageElement, renderer: any): World {
  const group = new THREE.Group();
  const buckets = new Map<string, { variant: BayVariant; bucket: Bucket }>();
  const roofs: Bucket = emptyBucket();
  const doors: Array<{ x: number; z: number; nx: number; nz: number }> = [];
  const archetypeCount: Record<string, number> = { canal: 0, school: 0, modern: 0 };
  const bucketFor = (variant: BayVariant): Bucket => {
    const key = variantKey(variant, look);
    let entry = buckets.get(key);
    if (!entry) { entry = { variant, bucket: emptyBucket() }; buckets.set(key, entry); }
    return entry.bucket;
  };

  let count = 0;
  for (const feature of features) {
    const ring0 = feature.geometry.type === 'Polygon' ? feature.geometry.coordinates[0] : feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates[0][0] : null;
    if (!ring0) continue;
    const [cx, cy] = local(ring0[0]);
    if (Math.hypot(cx, cy) > radius) continue;
    const p = feature.properties, id = String(p.id ?? Math.random());
    const height = Number(p.height), minHeight = Number(p.minHeight) || 0;
    if (!Number.isFinite(height) || height - minHeight < 2) continue;
    count++;
    const year = Number.isFinite(Number(p.constructionYear)) && p.constructionYear != null ? Number(p.constructionYear) : null;
    const archetype = archetypeFor(id, year, height);
    archetypeCount[archetype]++;
    const style = buildingStyle(id, archetype);
    const palette = paletteFor(id, archetype, look);
    const wallColour = new THREE.Color(palette.wall), accentColour = new THREE.Color(palette.accent);
    const roofColour = new THREE.Color(ROOFS[look][hashSeed(id + 'r') % ROOFS[look].length]);
    const attic = (hashSeed(id + ':attic') & 1) === 1;
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    const variantOf = (kind: BayKind): BayVariant => ({ archetype, kind, windows: style.windows, shape: style.shape, shutters: style.shutters, paintedFrames: style.paintedFrames });

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
        const plan = planWall(length, height, minHeight, `${id}:${i}`);
        if (mode === 'repeat' || plan.plain) {
          // Today's behaviour: the texture repeats at its natural size and is cut wherever the wall ends.
          quad(bucketFor(variantOf(plan.plain ? 'plain' : 'upper')), a, c, minHeight, height, 0, length / TARGET_BAY_M, 0, (height - minHeight) / TARGET_STOREY_M, wallColour, accentColour);
          continue;
        }
        const lerp = (t: number) => new THREE.Vector3().lerpVectors(a, c, t);
        for (let bay = 0; bay < plan.bays; bay++) {
          const from = lerp(bay / plan.bays), to = lerp((bay + 1) / plan.bays);
          const door = plan.doorBays.includes(bay);
          const kind: BayKind = door ? 'groundDoor' : style.shop ? 'groundShop' : 'ground';
          quad(bucketFor(variantOf(kind)), from, to, minHeight, minHeight + plan.groundHeightM, 0, 1, 0, 1, wallColour, accentColour);
          if (door && minHeight === 0) {
            // Outward normal of a counter-clockwise ring is (dy, +dx) in x/z.
            const mid = lerp((bay + 0.25) / plan.bays);
            doors.push({ x: mid.x, z: mid.z, nx: (by - ay) / length, nz: (bx - ax) / length });
          }
          for (let s = 0; s < plan.storeys; s++) {
            const rich = archetype === 'canal' && plan.storeys >= 3;
            const upper: BayKind = rich && s === 0 ? 'upperTall' : rich && attic && s === plan.storeys - 1 ? 'attic' : 'upper';
            const y0 = minHeight + plan.groundHeightM + s * plan.storeyHeightM;
            quad(bucketFor(variantOf(upper)), from, to, y0, y0 + plan.storeyHeightM, 0, 1, 0, 1, wallColour, accentColour);
          }
        }
      }
      const tris = THREE.ShapeUtils.triangulateShape(ring.map(([x, y]) => new THREE.Vector2(x, y)), []);
      const base = roofs.positions.length / 3;
      for (const [x, y] of ring) { roofs.positions.push(x, height, -y); roofs.uvs.push(0, 0); roofs.colours.push(roofColour.r, roofColour.g, roofColour.b); }
      for (const t of tris) roofs.index.push(base + t[0], base + t[2], base + t[1]);
    }
  }

  const geometry = (b: Bucket) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uvs, 2));
    if (b.wall.length) { g.setAttribute('aWall', new THREE.Float32BufferAttribute(b.wall, 3)); g.setAttribute('aAccent', new THREE.Float32BufferAttribute(b.accent, 3)); }
    if (b.colours.length) g.setAttribute('color', new THREE.Float32BufferAttribute(b.colours, 3));
    g.setIndex(b.index); g.computeVertexNormals();
    return g;
  };
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  const prepare = (canvas: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = anisotropy; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  };
  for (const { variant, bucket } of buckets.values()) {
    const { colour, mask } = bayTextures(variant, brick, look);
    group.add(new THREE.Mesh(geometry(bucket), wallMaterial(prepare(colour, true), prepare(mask, false))));
  }
  group.add(new THREE.Mesh(geometry(roofs), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  (window as any).__spikeDoors = doors;
  return { group, stats: { buildings: count, meshes: buckets.size + 1, doors: doors.length, ...archetypeCount } };
}

async function main(): Promise<void> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.style.margin = '0';
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight('#ffffff', '#e6dccb', 2.2);
  const sun = new THREE.DirectionalLight('#fff4e0', 1.6); sun.position.set(-80, 120, 60);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#f6efe0' }));
  ground.position.y = -0.05;
  scene.add(hemi, sun, ground);

  let features: Feature[];
  if (embed) features = embed.features;
  else {
    const dLat = radius / ky, dLng = radius / kx;
    const tiles = tilesCovering({ west: lng0 - dLng, east: lng0 + dLng, south: lat0 - dLat, north: lat0 + dLat }, 14, 0);
    features = (await Promise.all(tiles.map(t => loadTile(t.z, t.x, t.y)))).flat();
  }
  const brick = await loadBrick();

  const camera = new THREE.PerspectiveCamera(num('fov', 42), innerWidth / innerHeight, 1, 5000);
  const view = { yaw: num('yaw', 20), pitch: num('pitch', 28), dist: num('dist', 70), tx: num('tx', 0), ty: num('ty', 6), tz: num('tz', 0) };
  let door: any = null;
  const place = () => {
    if (door) { camera.position.set(door.x + door.nx * num('back', 9), 2.2, door.z + door.nz * num('back', 9)); camera.lookAt(door.x, 3.2, door.z); return; }
    const yaw = view.yaw * Math.PI / 180, pitch = view.pitch * Math.PI / 180;
    camera.position.set(view.tx + Math.sin(yaw) * Math.cos(pitch) * view.dist, view.ty + Math.sin(pitch) * view.dist, view.tz + Math.cos(yaw) * Math.cos(pitch) * view.dist);
    camera.lookAt(view.tx, view.ty, view.tz);
  };

  let world: World | null = null;
  const stats = document.createElement('div');
  const rebuild = () => {
    if (world) { scene.remove(world.group); world.group.traverse((o: any) => { o.geometry?.dispose(); }); }
    scene.background = new THREE.Color(look === 'cartoon' ? '#bfe3f5' : '#d9e6ee');
    ground.material.color.set(look === 'cartoon' ? '#f6efe0' : '#efeadf');
    hemi.intensity = look === 'cartoon' ? 2.2 : 1.5;
    world = buildWorld(features, brick, renderer);
    scene.add(world.group);
    const doorIndex = q.get('door');
    door = doorIndex !== null && (window as any).__spikeDoors.length ? (window as any).__spikeDoors[Math.min((window as any).__spikeDoors.length - 1, Number(doorIndex))] : null;
    stats.textContent = `${world.stats.buildings} buildings · ${world.stats.meshes} meshes · canal ${world.stats.canal} / school ${world.stats.school} / modern ${world.stats.modern}`;
    place(); renderer.render(scene, camera);
    (window as any).__spike = { ready: true, mode, look, doors: world.stats.doors, ...world.stats };
  };
  rebuild();

  if (q.get('ui') !== '0') {
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;left:12px;top:12px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;font:13px system-ui,sans-serif;max-width:calc(100vw - 24px)';
    const button = (label: string, on: () => void) => { const b = document.createElement('button'); b.textContent = label; b.style.cssText = 'padding:7px 12px;border-radius:8px;border:1px solid #0003;background:#fffe;color:#1f2328;cursor:pointer;font:inherit'; b.onclick = on; bar.appendChild(b); return b; };
    const refresh = () => { lookButton.textContent = `Look: ${look}`; modeButton.textContent = `Windows: ${mode === 'aligned' ? 'fitted to walls' : 'repeating (today)'}`; };
    const lookButton = button('', () => { look = look === 'cartoon' ? 'photo' : 'cartoon'; refresh(); rebuild(); });
    const modeButton = button('', () => { mode = mode === 'aligned' ? 'repeat' : 'aligned'; refresh(); rebuild(); });
    button('Street level', () => { Object.assign(view, { yaw: -75, pitch: 4, dist: 34, ty: 5, tx: 0, tz: 0 }); door = null; place(); renderer.render(scene, camera); });
    button('Overview', () => { Object.assign(view, { yaw: 20, pitch: 28, dist: 70, ty: 6, tx: 0, tz: 0 }); door = null; place(); renderer.render(scene, camera); });
    button('Zoom +', () => { door = null; view.dist = Math.max(8, view.dist * 0.75); place(); renderer.render(scene, camera); });
    button('Zoom \u2212', () => { door = null; view.dist = Math.min(400, view.dist / 0.75); place(); renderer.render(scene, camera); });
    stats.style.cssText = 'padding:6px 10px;border-radius:8px;background:#fffe;color:#1f2328;font-size:12px'; bar.appendChild(stats);
    const hint = document.createElement('div');
    hint.textContent = 'Drag to orbit \u00b7 scroll or Zoom to move closer \u00b7 shift-drag to pan';
    hint.style.cssText = 'padding:6px 10px;border-radius:8px;background:#fffe;color:#1f2328;font-size:12px'; bar.appendChild(hint);
    refresh();
    document.body.appendChild(bar);
  }

  // Orbit: drag to rotate, shift-drag to pan, wheel to zoom.
  let drag: { x: number; y: number; pan: boolean } | null = null;
  const canvas = renderer.domElement as HTMLCanvasElement;
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, pan: e.shiftKey || e.button === 2 }; door = null; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if (drag.pan) {
      const yaw = view.yaw * Math.PI / 180, s = view.dist * 0.0015;
      view.tx -= (Math.cos(yaw) * dx) * s; view.tz += (Math.sin(yaw) * dx) * s;
      view.tx -= (Math.sin(yaw) * dy) * s; view.tz -= (Math.cos(yaw) * dy) * s;
    } else { view.yaw -= dx * 0.3; view.pitch = Math.max(1, Math.min(85, view.pitch + dy * 0.25)); }
    place(); renderer.render(scene, camera);
  });
  canvas.addEventListener('wheel', e => { e.preventDefault(); door = null; view.dist = Math.max(8, Math.min(400, view.dist * Math.exp(e.deltaY * 0.001))); place(); renderer.render(scene, camera); }, { passive: false });
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); place(); renderer.render(scene, camera); });
}
main().catch(error => { (window as any).__spike = { ready: false, error: String(error) }; console.error(error); });
