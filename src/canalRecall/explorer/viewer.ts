/**
 * The explorer's GLB viewer: one WebGL renderer for the life of the page,
 * reused for every building; the model's geometry, materials and textures are
 * disposed when the panel closes or another building opens.
 *
 * Framing follows model-compare.html: centre the model, normalise its longest
 * side, same camera and lights for every building. three.js is passed in (from
 * window.CanalRecallThree) so this module adds no second copy of it.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ThreeRuntime { THREE: any; GLTFLoader: any; MeshoptDecoder?: any }

export interface OpenResult { triangles: number; heightMetres: number; meshes: number }

/** Orbit state: yaw/pitch in radians, distance in normalised model units. Pure, for tests. */
export interface Orbit { yaw: number; pitch: number; distance: number }
export const DEFAULT_ORBIT: Orbit = { yaw: -0.65, pitch: 0.42, distance: 2.1 };
export const clampOrbit = (o: Orbit): Orbit => ({
  yaw: o.yaw,
  pitch: Math.max(0.05, Math.min(1.35, o.pitch)),
  distance: Math.max(0.9, Math.min(5, o.distance)),
});
/** Camera position for an orbit around the origin, looking at `target` height. */
export const orbitPosition = (o: Orbit, targetY: number): [number, number, number] => [
  o.distance * Math.cos(o.pitch) * Math.sin(o.yaw),
  targetY + o.distance * Math.sin(o.pitch),
  o.distance * Math.cos(o.pitch) * Math.cos(o.yaw),
];

export class ModelViewer {
  readonly canvas: HTMLCanvasElement;
  private readonly three: ThreeRuntime;
  private readonly renderer: any;
  private readonly scene: any;
  private readonly camera: any;
  private readonly loader: any;
  private model: any = null;
  private orbit: Orbit = { ...DEFAULT_ORBIT };
  private targetY = 0.3;
  private spinning = true;
  private frame = 0;
  private token = 0;
  private readonly resizeObserver: ResizeObserver;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinch = 0;

  constructor(container: HTMLElement, three: ThreeRuntime) {
    this.three = three;
    const { THREE, GLTFLoader, MeshoptDecoder } = three;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if ('outputColorSpace' in this.renderer) this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'viewer-canvas';
    this.canvas.setAttribute('aria-label', 'Interactive 3D model. Drag to turn, scroll or pinch to zoom.');
    this.canvas.setAttribute('role', 'img');
    container.appendChild(this.canvas);

    this.scene = new THREE.Scene();
    // Daylight rig: warm sky over a paper ground, one sun that casts the shadow.
    this.scene.add(new THREE.HemisphereLight(0xfffaf0, 0x8c8272, 2.1));
    const sun = new THREE.DirectionalLight(0xffffff, 2.4);
    sun.position.set(1.6, 2.6, 1.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -1, right: 1, top: 1, bottom: -1, near: 0.1, far: 8 });
    sun.shadow.bias = -0.0005;
    sun.shadow.radius = 4;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xcfe0f0, 0.8);
    fill.position.set(-2, 1, -1.5);
    this.scene.add(fill);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(1.4, 48), new THREE.ShadowMaterial({ opacity: 0.18 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.01, 50);
    this.loader = new GLTFLoader();
    if (MeshoptDecoder) this.loader.setMeshoptDecoder(MeshoptDecoder);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.bindControls();
    this.resize();
  }

  /**
   * Loads a GLB, replacing (and disposing) the current one. Rejects if a newer open() superseded it.
   * `focus` (GLB-local box, e.g. a run of houses inside a street chunk) is centred and framed instead of the whole
   * model; the rest of the model stays drawn around it.
   */
  async open(url: string, opts: { focus?: { min: readonly number[]; max: readonly number[] } } = {}): Promise<OpenResult> {
    const token = ++this.token;
    this.clear();
    const gltf: any = await new Promise((resolve, reject) => this.loader.load(url, resolve, undefined, reject));
    if (token !== this.token) { disposeTree(gltf.scene); throw new Error('superseded'); }
    const { THREE } = this.three;
    const model = gltf.scene;
    const whole = new THREE.Box3().setFromObject(model);
    const box = opts.focus ? new THREE.Box3(new THREE.Vector3(...opts.focus.min), new THREE.Vector3(...opts.focus.max)) : whole;
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    // A focus run is framed on its front (width and height) with a margin, so the neighbouring houses show around it.
    const longest = (opts.focus ? Math.max(size.x, size.y) * 1.35 : Math.max(size.x, size.y, size.z)) || 1;
    const pivot = new THREE.Group();
    model.position.set(-centre.x, -box.min.y, -centre.z);
    pivot.add(model);
    pivot.scale.setScalar(1 / longest);
    let triangles = 0, meshes = 0;
    model.traverse((child: any) => {
      if (!child.isMesh) return;
      meshes += 1;
      child.castShadow = true;
      child.receiveShadow = true;
      const g = child.geometry;
      triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
    });
    this.model = pivot;
    this.scene.add(pivot);
    this.targetY = Math.min(0.45, (size.y / longest) * 0.45);
    this.orbit = { ...DEFAULT_ORBIT };
    this.spinning = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.start();
    return { triangles: Math.round(triangles), heightMetres: size.y, meshes };
  }

  /** Disposes the current model and stops drawing. The renderer (and its context) stays. */
  clear(): void {
    this.stop();
    if (this.model) {
      this.scene.remove(this.model);
      disposeTree(this.model);
      this.model = null;
    }
    this.renderer.renderLists?.dispose?.();
    this.renderer.clear();
  }

  private start(): void {
    if (this.frame) return;
    let last = performance.now();
    const tick = (now: number) => {
      this.frame = requestAnimationFrame(tick);
      if (this.spinning) this.orbit.yaw += Math.min(0.05, (now - last) / 1000) * 0.35;
      last = now;
      this.render();
    };
    this.frame = requestAnimationFrame(tick);
  }

  private stop(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private render(): void {
    const [x, y, z] = orbitPosition(this.orbit, this.targetY);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(0, this.targetY, 0);
    this.renderer.render(this.scene, this.camera);
  }

  private resize(): void {
    const parent = this.canvas.parentElement;
    const w = Math.max(1, parent?.clientWidth ?? 300), h = Math.max(1, parent?.clientHeight ?? 200);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    // Narrow panes pull back so tall towers still fit.
    this.camera.fov = w / h < 1 ? 40 : 32;
    this.camera.updateProjectionMatrix();
    if (this.model) this.render();
  }

  private bindControls(): void {
    const c = this.canvas;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', e => { this.spinning = false; c.setPointerCapture(e.pointerId); this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); this.pinch = 0; });
    c.addEventListener('pointermove', e => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinch) this.orbit = clampOrbit({ ...this.orbit, distance: this.orbit.distance * (this.pinch / d) });
        this.pinch = d;
        return;
      }
      this.orbit = clampOrbit({ ...this.orbit, yaw: this.orbit.yaw - (e.clientX - prev.x) * 0.01, pitch: this.orbit.pitch + (e.clientY - prev.y) * 0.008 });
    });
    const up = (e: PointerEvent) => { this.pointers.delete(e.pointerId); this.pinch = 0; };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', e => { e.preventDefault(); this.spinning = false; this.orbit = clampOrbit({ ...this.orbit, distance: this.orbit.distance * Math.exp(e.deltaY * 0.0015) }); }, { passive: false });
    c.tabIndex = 0;
    c.addEventListener('keydown', e => {
      const step: Record<string, Partial<Orbit>> = {
        ArrowLeft: { yaw: this.orbit.yaw + 0.15 }, ArrowRight: { yaw: this.orbit.yaw - 0.15 },
        ArrowUp: { pitch: this.orbit.pitch + 0.1 }, ArrowDown: { pitch: this.orbit.pitch - 0.1 },
        '+': { distance: this.orbit.distance * 0.9 }, '=': { distance: this.orbit.distance * 0.9 }, '-': { distance: this.orbit.distance * 1.1 },
      };
      if (!step[e.key]) return;
      e.preventDefault();
      this.spinning = false;
      this.orbit = clampOrbit({ ...this.orbit, ...step[e.key] });
    });
  }
}

/** Frees every geometry, material and texture under an object. */
export function disposeTree(root: any): void {
  root.traverse((child: any) => {
    child.geometry?.dispose?.();
    const materials = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
    for (const m of materials) {
      for (const value of Object.values(m)) if (value && typeof value === 'object' && (value as any).isTexture) (value as any).dispose();
      m.dispose?.();
    }
  });
}
