// One three.js frame inside MapLibre: one WebGLRenderer, one scene graph, one
// light rig and one sun shadow map for every three.js layer the game draws.
// Phase 1 of docs/research/own-renderer-spike-20261009.md.
//
// Before this, each layer (facades, landmarks — one THREE.Scene *per model* —
// trees, roofs, the zoo, four vehicles) was its own MapLibre custom layer with
// its own renderer, its own lights and its own `resetState()`; nothing could
// share a shadow map or a light, and coplanar ties between layers were decided
// by MapLibre layer order. Now those layers register a root object here and
// the frame draws them in two passes (see layerRegistry.ts):
//
//   main     — at the old facade slot, below the game's labels
//   overlay  — the player's vehicles, last, so their x-ray sees every depth
//
// The world is east/north/up metres about the camera eye (frameMath.ts).
// Each participant's root sits under a wrapper whose matrix maps that
// participant's own local space (whatever it used to bake into its camera) to
// the world, so legacy geometry needs no rewrite.
//
// THREE is injected: the page's one copy (window.CanalRecallThree).

import { frameMatrices, mercatorOfLngLat, mercatorUnitsPerMetre, worldOfMercator, type FrameMatrices, type Mat4, type Vec3 } from './frameMath.js';
import { createLightRig, type LightRig, type LightRigOptions } from './lightRig.js';
import { LayerRegistry, type FramePass } from './layerRegistry.js';
import { plainBounds, type LngLatBounds } from './residency.js';

export type FrameContext = {
  readonly pass: FramePass;
  readonly frame: FrameMatrices;
  /** three Matrix4: world ← Mercator. */
  readonly worldFromMercator: any;
  /** three Matrix4: clip ← world (also the shared camera's projection). Use for picking against matrixWorld. */
  readonly clipFromWorld: any;
  readonly zoom: number;
  /** View bounds, computed at most once per pass. */
  bounds(): LngLatBounds;
};

export interface FrameParticipant {
  /** The object drawn. Its local space is mapped to Mercator by `mercatorFromLocal`. */
  root: any;
  /** Local → Mercator, column-major. Omit (or return null) when the root's local space *is* Mercator. */
  mercatorFromLocal?(ctx: FrameContext): Mat4 | null | undefined;
  /** Per-frame update; return false to skip this participant this pass. */
  beforeRender?(ctx: FrameContext): boolean | void;
  /** Overlay only: drawn first with this override, then normally (the vehicle x-ray). */
  xrayMaterial?(): any | null;
  /** Called once the renderer exists (immediately if it already does). */
  onAttach?(frame: SharedFrame): void;
}

export type SharedFrameOptions = {
  shadows?: boolean;
  shadowMapSize?: number;
  light?: LightRigOptions;
  /** MapLibre layer the main pass goes beneath (resolved when the layer is added). */
  beforeId?: () => string | undefined;
  /** Minimum map zoom for shadows; below it the box would be too coarse to read. */
  shadowMinZoom?: number;
};

type Handle = { wrapper: any; participant: FrameParticipant; attached: boolean };

export const SHARED_FRAME_MAIN_ID = 'shared-frame-main';
export const SHARED_FRAME_OVERLAY_ID = 'shared-frame-overlay';

export class SharedFrame {
  readonly THREE: any;
  readonly map: any;
  readonly scene: any;
  readonly camera: any;
  readonly rig: LightRig;
  readonly registry = new LayerRegistry<Handle>();
  readonly mainLayer: any;
  readonly overlayLayer: any;
  renderer: any = null;
  lastFrame: FrameMatrices | null = null;
  /** Per-pass diagnostics for the perf harnesses. */
  readonly stats = { main: { ms: 0, calls: 0, triangles: 0, frames: 0 }, overlay: { ms: 0, calls: 0, triangles: 0, frames: 0 }, shadowCasters: 0 };
  private readonly options: SharedFrameOptions;
  private readonly worldFromMercatorM: any;
  private readonly tmp: any;
  private anchor: Vec3 | null = null;
  private anchorUnits = 0;
  private viewport = [0, 0];
  private keepOverlayOnTop: (() => void) | null = null;
  private removedLayers = 0;
  private shadowsOn = true;

  constructor(THREE: any, map: any, options: SharedFrameOptions = {}) {
    this.THREE = THREE;
    this.map = map;
    this.options = options;
    this.shadowsOn = options.shadows ?? true;
    this.scene = new THREE.Scene();
    this.scene.name = 'shared-frame';
    // The world matrices of every participant are refreshed by render(); the
    // camera's own matrices stay identity (the view lives in its projection).
    this.camera = new THREE.Camera();
    this.camera.matrixWorldAutoUpdate = false;
    this.rig = createLightRig(THREE, { ...options.light, shadows: options.shadows ?? true, shadowMapSize: options.shadowMapSize ?? options.light?.shadowMapSize });
    for (const object of this.rig.objects) this.scene.add(object);
    this.worldFromMercatorM = new THREE.Matrix4();
    this.tmp = new THREE.Matrix4();
    this.mainLayer = this.makeLayer(SHARED_FRAME_MAIN_ID, 'main');
    this.overlayLayer = this.makeLayer(SHARED_FRAME_OVERLAY_ID, 'overlay');
  }

  /** Add both passes to the map. The overlay is kept last, like the vehicles were. */
  attach(): void {
    const before = this.options.beforeId?.();
    if (!this.map.getLayer(SHARED_FRAME_MAIN_ID)) this.map.addLayer(this.mainLayer, before && this.map.getLayer(before) ? before : undefined);
    if (!this.map.getLayer(SHARED_FRAME_OVERLAY_ID)) this.map.addLayer(this.overlayLayer);
    if (!this.keepOverlayOnTop) {
      this.keepOverlayOnTop = () => {
        const order: string[] | undefined = this.map.getLayersOrder?.();
        if (!order || !this.map.getLayer(SHARED_FRAME_OVERLAY_ID)) return;
        if (order[order.length - 1] !== SHARED_FRAME_OVERLAY_ID) this.map.moveLayer(SHARED_FRAME_OVERLAY_ID);
      };
      this.map.on('styledata', this.keepOverlayOnTop);
    }
  }

  /** Register a participant. Returns an unregister function. */
  register(id: string, participant: FrameParticipant, options: { order?: number; pass?: FramePass } = {}): () => void {
    const THREE = this.THREE;
    const wrapper = new THREE.Group();
    wrapper.name = `shared-frame/${id}`;
    wrapper.matrixAutoUpdate = false;
    // Group order: three sorts opaque draws by it first, preserving the old layer order.
    wrapper.renderOrder = options.order ?? 0;
    wrapper.visible = false;
    wrapper.add(participant.root);
    const handle: Handle = { wrapper, participant, attached: false };
    this.registry.add(id, handle, options);
    this.scene.add(wrapper);
    if (this.renderer) this.attachParticipant(handle);
    this.map.triggerRepaint?.();
    return () => this.unregister(id);
  }

  unregister(id: string): void {
    const entry = this.registry.remove(id);
    if (!entry) return;
    entry.participant.wrapper.remove(entry.participant.participant.root);
    this.scene.remove(entry.participant.wrapper);
    this.map.triggerRepaint?.();
  }

  /** Compile an object's programs against the shared lights, off the critical frame. */
  compile(object: any): void {
    if (!this.renderer) return;
    try { this.renderer.compile(object, this.camera, this.scene); }
    catch (error) { console.warn('Shared frame: could not precompile', error); }
    this.renderer.resetState();
  }

  /** Set cast/receive on every mesh under `object`. */
  static setShadows(object: any, cast: boolean, receive: boolean): void {
    object.traverse((child: any) => {
      if (!child.isMesh) return;
      child.castShadow = cast;
      child.receiveShadow = receive;
      // Double-sided GLB materials would otherwise draw their light-facing
      // faces into the shadow map too. Measured on the surveyed Haparandaweg
      // models (2026-10-10): whole flat roofs fell into their own shadow and
      // only a ~30 m depth bias cleared it. Casting from the far faces is
      // three's default for single-sided materials and is right for the
      // closed shells our models are.
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
        if (material && material.side === 2 /* DoubleSide */ && material.shadowSide == null) material.shadowSide = 1 /* BackSide */;
      }
    });
  }

  /** Runtime toggle (console / tests): `canalRecallGame.vectorMap._sharedFrame.setShadows(false)`. */
  setShadows(on: boolean): void {
    this.shadowsOn = !!on;
    this.map.triggerRepaint?.();
  }

  private attachParticipant(handle: Handle): void {
    if (handle.attached) return;
    handle.attached = true;
    try { handle.participant.onAttach?.(this); }
    catch (error) { console.warn('Shared frame participant failed to attach', error); }
  }

  private makeLayer(id: string, pass: FramePass): any {
    return {
      id, type: 'custom', renderingMode: '3d',
      onAdd: (_map: any, gl: WebGL2RenderingContext) => {
        if (!this.renderer) {
          const THREE = this.THREE;
          this.renderer = new THREE.WebGLRenderer({ canvas: this.map.getCanvas(), context: gl, antialias: true });
          this.renderer.autoClear = false;
          this.renderer.setPixelRatio(1);
          this.renderer.shadowMap.enabled = true;
          this.renderer.shadowMap.type = THREE.PCFShadowMap;
          // The shadow map is rendered once per frame, in the main pass; the
          // overlay pass samples the same map.
          this.renderer.shadowMap.autoUpdate = false;
          for (const entry of this.registry.all()) this.attachParticipant(entry.participant);
        }
        this.removedLayers = Math.max(0, this.removedLayers - 1);
      },
      onRemove: () => {
        this.removedLayers++;
        if (this.removedLayers >= 2) {
          this.renderer?.dispose();
          this.renderer = null;
          for (const entry of this.registry.all()) entry.participant.attached = false;
        }
      },
      render: (gl: WebGL2RenderingContext, args: any) => this.renderPass(pass, gl, args),
    };
  }

  /** Absolute ENU metres (fixed anchor) of a Mercator point; the shadow snap frame. */
  private absOf(p: Vec3): Vec3 {
    if (!this.anchor) { this.anchor = [p[0], p[1], 0]; this.anchorUnits = mercatorUnitsPerMetre(p[1]); }
    const u = this.anchorUnits, a = this.anchor;
    return [(p[0] - a[0]) / u, -(p[1] - a[1]) / u, p[2] / u];
  }

  private mercatorOfAbs(abs: Vec3): Vec3 {
    const u = this.anchorUnits, a = this.anchor!;
    return [a[0] + abs[0] * u, a[1] - abs[1] * u, abs[2] * u];
  }

  private renderPass(pass: FramePass, gl: WebGL2RenderingContext, args: any): void {
    const renderer = this.renderer;
    if (!renderer) return;
    const main: Mat4 | undefined = args?.defaultProjectionData?.mainMatrix ?? args;
    if (!main || (main as any).length !== 16) return;
    const fm = frameMatrices(main);
    if (!fm) return;
    this.lastFrame = fm;
    this.camera.projectionMatrix.fromArray(fm.clipFromWorld);
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
    this.worldFromMercatorM.fromArray(fm.worldFromMercator);
    let bounds: LngLatBounds | null = null;
    const ctx: FrameContext = {
      pass, frame: fm, worldFromMercator: this.worldFromMercatorM, clipFromWorld: this.camera.projectionMatrix,
      zoom: this.map.getZoom(),
      bounds: () => (bounds ??= plainBounds(this.map.getBounds())),
    };
    const drawn: Handle[] = [];
    for (const entry of this.registry.all()) {
      const handle = entry.participant;
      if (entry.pass !== pass) { handle.wrapper.visible = false; continue; }
      let ok = false;
      try { ok = handle.participant.beforeRender?.(ctx) !== false; }
      catch (error) { console.warn(`Shared frame participant ${entry.id} failed`, error); }
      handle.wrapper.visible = ok;
      if (!ok) continue;
      const local = handle.participant.mercatorFromLocal?.(ctx);
      handle.wrapper.matrix.copy(this.worldFromMercatorM);
      if (local) handle.wrapper.matrix.multiply(this.tmp.fromArray(local));
      handle.wrapper.matrixWorldNeedsUpdate = true;
      drawn.push(handle);
    }
    if (!drawn.length) return;
    const t0 = performance.now();
    renderer.resetState();
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    if (w !== this.viewport[0] || h !== this.viewport[1]) {
      this.viewport = [w, h];
      renderer.setViewport(0, 0, w, h);
    }
    renderer.info.autoReset = false;
    renderer.info.reset();
    if (pass === 'main') {
      // castShadow stays constant (toggling it recompiles every lit program);
      // below the shadow zoom, or when switched off, the map is not redrawn and
      // its contribution is zeroed instead.
      const shadows = this.rig.options.shadows && this.shadowsOn && ctx.zoom >= (this.options.shadowMinZoom ?? 15);
      this.rig.sun.shadow.intensity = shadows ? 1 : 0;
      if (shadows) {
        const c = this.map.getCenter();
        const focus = this.absOf(mercatorOfLngLat(c.lng, c.lat, 0));
        this.rig.follow(focus, ctx.zoom, abs => worldOfMercator(fm, this.mercatorOfAbs(abs)));
      }
      renderer.shadowMap.needsUpdate = shadows;
      renderer.render(this.scene, this.camera);
    } else {
      renderer.shadowMap.needsUpdate = false;
      for (const handle of drawn) {
        const xray = handle.participant.xrayMaterial?.();
        if (!xray) continue;
        for (const other of drawn) other.wrapper.visible = other === handle;
        this.scene.overrideMaterial = xray;
        try { renderer.render(this.scene, this.camera); }
        finally { this.scene.overrideMaterial = null; }
      }
      for (const handle of drawn) handle.wrapper.visible = true;
      renderer.render(this.scene, this.camera);
    }
    const s = this.stats[pass];
    s.ms = performance.now() - t0; s.calls = renderer.info.render.calls; s.triangles = renderer.info.render.triangles; s.frames++;
  }
}
