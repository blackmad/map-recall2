// @ts-expect-error Installed runtime has no separate Three declarations.
import * as THREE from 'three';
// @ts-expect-error Installed runtime has no separate Three declarations.
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// @ts-expect-error Installed runtime has no separate Three declarations.
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

export interface FacadeWall {
  group: string;
  surfaceId: string;
  buildingId: string;
  width: number;
  height: number;
  coverage: number;
  rooflineShape: string;
  rooflineRange: number;
  storeys: number;
  bays: number;
  openings: number;
  gableRise: number;
  normal?: number[];
}

export interface PointCloudFacadesViewerOptions {
  canvas: HTMLCanvasElement;
  dataBase: string;
  tileId?: string;
  onStatus?: (status: string) => void;
  onSelect?: (wall: FacadeWall | null) => void;
}

export interface FacadeTile {
  id: string;
  label: string;
  points: number;
  demoPoints?: number;
  scannedWalls: number;
  shapedRooflines: number;
  openings: number;
  gables: number;
}

export interface FacadeIndex {
  totals: { tiles: number; measuredWalls: number; vertices: number; faces: number };
  tiles: FacadeTile[];
}

export interface PointCloudFacadesViewer {
  index: FacadeIndex;
  tileId: string;
  setTile: (id: string) => Promise<void>;
  setPointCloudVisible: (visible: boolean) => void;
  setMeshVisible: (visible: boolean) => void;
  frameSelected: () => void;
  dispose: () => void;
}

const fetchText = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return response.text();
};

/** A quiet dusk gradient so roofs and gables read against the sky. */
const skyTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;
  const context = canvas.getContext('2d')!;
  const gradient = context.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, '#0a1420');
  gradient.addColorStop(0.55, '#16283a');
  gradient.addColorStop(1, '#3b4a58');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 2, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

/** Decode `PCF1`: uint32 count, Float32 xyz, Uint8 rgb. */
const decodePoints = (buffer: ArrayBuffer) => {
  const view = new DataView(buffer);
  const count = view.getUint32(4, true);
  const positions = new Float32Array(count * 3);
  const colours = new Uint8Array(count * 3);
  let offset = 8;
  for (let index = 0; index < count * 3; index += 1) {
    positions[index] = view.getFloat32(offset, true);
    offset += 4;
  }
  for (let index = 0; index < count * 3; index += 1) {
    colours[index] = view.getUint8(offset);
    offset += 1;
  }
  return { count, positions, colours };
};

/**
 * Render the published point-cloud façade extract, one 50 x 50 m tile at a
 * time: the measured façades and 3DBAG roofs (with the cloud's own colours) and
 * the downsampled source point cloud they were measured from. Data is Z-up
 * (NAP); the scene is rotated to Three's Y-up and framed on the tile.
 */
export async function initPointCloudFacadesViewer(options: PointCloudFacadesViewerOptions): Promise<PointCloudFacadesViewer> {
  const status = options.onStatus ?? (() => {});
  status('loading index…');
  const index = JSON.parse(await fetchText(`${options.dataBase}/index.json`)) as FacadeIndex;
  const tileId = options.tileId ?? index.tiles[0]?.id;
  if (!tileId) throw new Error('the extract has no tiles');

  const renderer = new THREE.WebGLRenderer({ canvas: options.canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0x1b2430, 260, 900);

  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x4a4232, 1.5));
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.DirectionalLight(0xfff2dd, 2.4);
  key.position.set(-1, 1.5, 1.2);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x9fc0ff, 0.8);
  fill.position.set(1.4, 0.3, -0.9);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 8000);
  const controls = new OrbitControls(camera, options.canvas);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.495;

  let container: THREE.Group | null = null;
  let pointCloud: THREE.Points | null = null;
  let meshGroup: THREE.Group | null = null;
  let wallsByGroup = new Map<string, FacadeWall>();
  let groupMeshes = new Map<string, Array<{ material?: { emissive?: { setHex: (hex: number) => void } } }>>();
  let selectedGroup: string | null = null;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  const highlight = (group: string | null) => {
    selectedGroup = group;
    for (const [name, meshes] of groupMeshes) {
      for (const mesh of meshes) mesh.material?.emissive?.setHex(name === group ? 0x4a6a92 : 0x000000);
    }
  };

  /** Frame the selected wall from the street, along its own outward normal. */
  const frameGroup = (group: string | null) => {
    if (!group) return;
    const meshes = groupMeshes.get(group);
    if (!meshes?.length) return;
    const box = new THREE.Box3();
    for (const mesh of meshes) box.expandByObject(mesh as never);
    if (box.isEmpty()) return;
    const centre = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const wall = wallsByGroup.get(group);
    const n = wall?.normal ?? [0, 0, 1];
    // RD (x, y, z) -> Three (x, z, -y); the wall's outward normal points at the camera.
    const outward = new THREE.Vector3(n[0], n[2], -n[1]).normalize();
    const distance = Math.max(size.x, size.y, size.z) * 3.2 + 10;
    camera.position.copy(centre).addScaledVector(outward, distance).add(new THREE.Vector3(0, size.y * 0.8, 0));
    controls.target.copy(centre);
    controls.update();
    (globalThis as { __facadeDebug?: unknown }).__facadeDebug = {
      group, centre: centre.toArray(), size: size.toArray(), outward: outward.toArray(),
      camera: camera.position.toArray(), target: controls.target.toArray(), distance,
      meshes: meshes.length,
      visibleMeshes: (() => { let count = 0; (meshGroup as unknown as { traverse: (fn: (o: { isMesh?: boolean; visible?: boolean }) => void) => void })?.traverse((o) => { if (o.isMesh && o.visible) count += 1; }); return count; })(),
      triangles: renderer.info.render.triangles,
    };
  };

  const onClick = (event: MouseEvent) => {
    if (!options.onSelect || !meshGroup) return;
    const rect = options.canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(meshGroup.children, true);
    if (!hits.length) { highlight(null); options.onSelect(null); return; }
    const object = hits[0].object as { name?: string; parent?: { name?: string } | null };
    const raw = object.name || object.parent?.name || '';
    const group = raw.replace(/__openings$/, '');
    highlight(group);
    options.onSelect(wallsByGroup.get(group) ?? null);
  };
  options.canvas.addEventListener('click', onClick);

  const clear = () => {
    if (!container) return;
    scene.remove(container);
    container = null;
    pointCloud = null;
    meshGroup = null;
    groupMeshes = new Map();
    selectedGroup = null;
  };

  const loadTile = async (id: string) => {
    status(`loading ${id}…`);
    const [coloursText, objText, pointsBuffer, manifestText] = await Promise.all([
      fetchText(`${options.dataBase}/${id}/scene-colours.json`),
      fetchText(`${options.dataBase}/${id}/scene.obj`),
      fetch(`${options.dataBase}/${id}/points.bin`).then((response) => response.arrayBuffer()),
      fetchText(`${options.dataBase}/${id}/manifest.json`),
    ]);
    const colours = JSON.parse(coloursText) as Record<string, string>;
    const tileManifest = JSON.parse(manifestText) as { walls?: FacadeWall[] };
    wallsByGroup = new Map((tileManifest.walls ?? []).map((wall) => [wall.group, wall]));
    clear();

    const decoded = decodePoints(pointsBuffer);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(decoded.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(decoded.colours, 3, true));
    geometry.computeBoundingBox();
    const box = geometry.boundingBox as { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } };
    const center = new THREE.Vector3((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, (box.min.z + box.max.z) / 2);
    const size = new THREE.Vector3(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);

    // One RD-space container: the tile's up axis (NAP z) becomes Three's Y.
    // The rotation maps (x, y, z) -> (x, z, -y), so the world offset that brings
    // the tile centre to the origin is the negative of the rotated centre.
    const root = new THREE.Group();
    root.rotation.x = -Math.PI / 2;
    root.position.set(-center.x, -center.z, center.y);
    scene.add(root);
    container = root;

    const points = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.22, vertexColors: true, sizeAttenuation: true }));
    root.add(points);
    pointCloud = points;

    const group = new OBJLoader().parse(objText);
    groupMeshes = new Map();
    group.traverse((object: { isMesh?: boolean; name?: string; parent?: { name?: string } | null; material?: unknown }) => {
      if (!object.isMesh) return;
      const raw = object.name || object.parent?.name || '';
      const name = raw.replace(/__openings$/, '');
      const hex = colours[raw] ?? colours[name] ?? '#d7d0c7';
      object.material = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.92, metalness: 0.0, side: THREE.DoubleSide });
      const list = groupMeshes.get(name) ?? [];
      list.push(object as never);
      groupMeshes.set(name, list);
    });
    root.add(group);
    meshGroup = group;

    const span = Math.max(size.x, size.y);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(span * 3, span * 3), new THREE.MeshStandardMaterial({ color: 0x141a22, roughness: 1 }));
    ground.position.set(center.x, center.y, box.min.z);
    root.add(ground);

    camera.position.set(span * 0.6, span * 0.6, span * 0.85);
    controls.target.set(0, 0, 0);
    controls.minDistance = span * 0.15;
    controls.maxDistance = span * 4;
    controls.update();
    status(`${id} · ${index.tiles.find((tile) => tile.id === id)?.scannedWalls ?? '?'} measured walls · ${decoded.count.toLocaleString()} source points`);
  };

  const resize = () => {
    const width = options.canvas.clientWidth || 900;
    const height = options.canvas.clientHeight || 700;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  let running = true;
  const tick = () => {
    if (!running) return;
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };
  tick();

  await loadTile(tileId);

  return {
    index,
    tileId,
    setTile: async (id: string) => { await loadTile(id); },
    setPointCloudVisible: (visible: boolean) => { if (pointCloud) pointCloud.visible = visible; },
    setMeshVisible: (visible: boolean) => { if (meshGroup) meshGroup.visible = visible; },
    frameSelected: () => frameGroup(selectedGroup),
    dispose: () => {
      running = false;
      window.removeEventListener('resize', resize);
      controls.dispose();
      renderer.dispose();
    },
  };
}
