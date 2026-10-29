// One three.js frame inside MapLibre: one WebGLRenderer, one scene graph, one
// light rig and one sun shadow map for every three.js layer the game draws.
// Phase 1 of docs/archive/research/own-renderer-spike-20261009.md.
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
import { mapLibreSky } from '../look/sunny.js';
import { LayerRegistry, type FramePass } from './layerRegistry.js';
import { plainBounds, type LngLatBounds } from './residency.js';
import { chooseTileDraws } from './tiledGeometry.js';
import { coverPauseFlag, MapCoverWatch, RESUME_DEFERRED_COMPILE_MS, RESUME_WARMUP_HOLD_MS } from './mapCover.js';
import { PRECOMPILE_STEP_MS } from './compileBudget.js';

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

/**
 * Tiled meshes draw whole when the tiles on screen hold at least this share of their triangles (chooseTileDraws). A
 * desktop is bound by draw calls on the CPU, so a mesh mostly on screen draws in one call; a touch device is bound by
 * the GPU, so it always draws only the tiles on screen (> 1). `?tileWhole=0..2` (or `window.__canalRecallTileWhole`)
 * overrides it.
 */
export const DESKTOP_TILE_WHOLE_SHARE = 0.6;
function tileWholeShareFlag(): number {
  const g = globalThis as { __canalRecallTileWhole?: number | string; matchMedia?: (query: string) => { matches: boolean }; location?: { search?: string } };
  const asked = Number(g.__canalRecallTileWhole ?? (g.location?.search ? new URLSearchParams(g.location.search).get('tileWhole') : NaN));
  if (Number.isFinite(asked) && asked >= 0 && asked <= 2) return asked;
  return g.matchMedia?.('(pointer: coarse)')?.matches ? 2 : DESKTOP_TILE_WHOLE_SHARE;
}

export interface FrameParticipant {
  /** The object drawn. Its local space is mapped to Mercator by `mercatorFromLocal`. */
  root: any;
  /** Local → Mercator, column-major. Omit (or return null) when the root's local space *is* Mercator. */
  mercatorFromLocal?(ctx: FrameContext): Mat4 | null | undefined;
  /** Per-frame update; return false to skip this participant this pass. */
  beforeRender?(ctx: FrameContext): boolean | void;
  /** Changes whenever something that casts changes without adding/removing root children (e.g. suppressed walls). */
  revision?(): number | string;
  /** Overlay only: drawn first with this override, then normally (the vehicle x-ray). */
  xrayMaterial?(): any | null;
  /** Called once the renderer exists (immediately if it already does). */
  onAttach?(frame: SharedFrame): void;
  /**
   * After a WebGL context loss and restore the frame has a new renderer (`frame.renderer`) and nothing is on the
   * GPU. three re-uploads whatever still has its CPU copy; a participant that freed CPU copies after upload (ground
   * cells on phones, the facade chunks and textures) rebuilds them here. `onAttach` is not called again.
   */
  onContextRestored?(frame: SharedFrame): void;
}

export type SharedFrameOptions = {
  shadows?: boolean;
  shadowMapSize?: number;
  light?: LightRigOptions;
  /** MapLibre layer the main pass goes beneath (resolved when the layer is added). */
  beforeId?: () => string | undefined;
  /** Minimum map zoom for shadows; below it the box would be too coarse to read. */
  shadowMinZoom?: number;
  /**
   * Shadow strength by map zoom, 0..1 (the overview → city blend, overviewTransition/blend.ts): replaces the hard
   * `shadowMinZoom` step; the shadow is drawn while it is above 0 and its intensity scales with it.
   */
  shadowRamp?: (zoom: number) => number;
  /** Shadow box step while following the view, metres (default 16). */
  shadowSnapM?: number;
  /** Redraw the shadow map at least this often, frames (default 120), for changes no signature catches. */
  shadowRefreshFrames?: number;
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
  /** Tiled meshes' whole-draw share (tileWholeShareFlag) and the last main pass's choice. */
  private readonly tileWholeShare = tileWholeShareFlag();
  private tileScratch: { frustum: any; sphere: any; m: any } | null = null;
  tileDraws = { tiled: 0, whole: 0 };
  readonly stats = { main: { ms: 0, calls: 0, triangles: 0, frames: 0 }, overlay: { ms: 0, calls: 0, triangles: 0, frames: 0 }, shadowCasters: 0 };
  private readonly options: SharedFrameOptions;
  private readonly worldFromMercatorM: any;
  private readonly tmp: any;
  private anchor: Vec3 | null = null;
  private anchorUnits = 0;
  private viewport = [0, 0];
  private keepOverlayOnTop: (() => void) | null = null;
  private removedLayers = 0;
  /** A context was lost: the next renderer `onAdd` creates is a restore (participants' `onContextRestored`). */
  private restorePending = false;
  /** Context losses and restores seen (diagnostics, the lose/restore spec). */
  readonly contextEvents = { lost: 0, restored: 0 };
  private shadowsOn = true;
  /** Shadow-map reuse: the box and caster signature it was drawn for, and its age in frames. */
  private shadowKey = '';
  private shadowAge = 0;
  /** Frames whose main pass redrew the shadow map (diagnostics / perf). */
  shadowRedraws = 0;
  /** MapLibre's depth range when the shadow map was last drawn (diagnostics; the map itself is drawn at [0, 1]). */
  shadowDepthRange: [number, number] | null = null;
  /**
   * An opaque card (the guest briefing) hides the whole map: no pass draws and no participant runs, so nothing is
   * drawn or warmed up behind it (#109, Sentry CANAL-RECALL-7/-J/-N). Measured from the layout (mapCover.ts).
   * Touch devices only by default (a desktop draws behind cards as before); `?coverPause=1|0` forces it.
   */
  private coverWatch: MapCoverWatch | null = null;
  /** Passes skipped behind a card (diagnostics). */
  coverSkipped = 0;
  get coverPaused(): boolean { return !!this.coverWatch?.covered; }
  private readonly deferredCompiles: any[] = [];
  /** When the map last showed again after a cover; warm-ups wait a little longer than the first draw's own compiles. */
  private resumedAt = -Infinity;
  private lastDeferredCompile = -Infinity;
  /**
   * May a participant run its shader warm-up now? Not behind a card, nor in the first RESUME_WARMUP_HOLD_MS after it
   * goes: the first draw links its own programs then (trees, shadows, ~6 in 40 ms on the phone profile), and the
   * ground's spread warm-up on top made 10 links in 100 ms at Start. Always true without a cover watch (desktop).
   */
  warmupDue(now = performance.now()): boolean { return !this.coverPaused && now - this.resumedAt >= RESUME_WARMUP_HOLD_MS; }

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
    // MapLibre rebuilds its style after a context loss (`setStyle` from a serialised copy) and drops custom layers
    // ("cannot be restored after WebGL context loss"): until 2026-10-24 the 3D layer stayed blank until a reload.
    this.map.on?.('webglcontextlost', () => this.contextLost());
    this.map.on?.('webglcontextrestored', () => this.contextRestored());
  }

  private contextLost(): void {
    this.contextEvents.lost++;
    const old = this.renderer;
    this.renderer = null;
    this.restorePending = true;
    this.removedLayers = 0;
    this.shadowKey = '';
    // Its GL objects are gone with the context; dispose drops its canvas listeners and caches.
    try { old?.dispose(); } catch (_) { /* lost context */ }
  }

  private contextRestored(): void {
    this.contextEvents.restored++;
    // The restored style loads asynchronously; the layers go back once it has.
    const reattach = () => this.attach();
    if (this.map.isStyleLoaded?.()) reattach();
    else if (this.map.once) this.map.once('style.load', reattach);
    else this.map.on?.('style.load', reattach);
  }

  /** The renderer exists: attach new participants, or after a restore let every participant rebuild. */
  private rendererReady(): void {
    const restored = this.restorePending;
    this.restorePending = false;
    for (const entry of this.registry.all()) {
      if (!entry.participant.attached) { this.attachParticipant(entry.participant); continue; }
      if (!restored) continue;
      try { entry.participant.participant.onContextRestored?.(this); }
      catch (error) { console.warn(`Shared frame participant ${entry.id} failed to restore`, error); }
    }
    this.map.triggerRepaint?.();
  }

  /** Add both passes to the map. The overlay is kept last, like the vehicles were. */
  attach(): void {
    if (!this.coverWatch && typeof document !== 'undefined' && typeof this.map.getCanvas === 'function' && coverPauseFlag()) {
      const canvas = this.map.getCanvas();
      if (canvas?.getBoundingClientRect) this.coverWatch = new MapCoverWatch(canvas, covered => { if (!covered) { this.resumedAt = performance.now(); this.map.triggerRepaint?.(); } });
    }
    const before = this.options.beforeId?.();
    if (!this.map.getLayer(SHARED_FRAME_MAIN_ID)) this.map.addLayer(this.mainLayer, before && this.map.getLayer(before) ? before : undefined);
    if (!this.map.getLayer(SHARED_FRAME_OVERLAY_ID)) this.map.addLayer(this.overlayLayer);
    // The sunny look's measured sky above the horizon (look/sunny.ts SKY); without it MapLibre shows the basemap's
    // background there, the land colour, which read as a pale cream sky.
    const sky = mapLibreSky();
    if (sky && typeof this.map.setSky === 'function') { try { this.map.setSky(sky); } catch (_) { /* style not ready */ } }
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

  /**
   * Compile an object's programs against the shared lights, off the critical frame. Behind a covering card (touch)
   * the compile waits, and runs one object per warm-up step once the map shows (the vehicles' four, #109).
   */
  compile(object: any): void {
    if (!this.renderer) return;
    if (this.coverPaused) { if (!this.deferredCompiles.includes(object)) this.deferredCompiles.push(object); return; }
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
          fullDepthRangeForShadowMap(this.renderer, gl, range => { this.shadowDepthRange = range; });
          this.rendererReady();
        }
        this.removedLayers = Math.max(0, this.removedLayers - 1);
      },
      onRemove: (_map: any, gl?: WebGL2RenderingContext) => {
        // A lost context's style.destroy() removes the layers too: contextLost/contextRestored handle that.
        if (gl?.isContextLost?.() || this.restorePending) return;
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

  /** Cheap fingerprint of what casts: which roots draw, their direct children and visibility, participant revisions. */
  private casterSignature(drawn: Handle[]): string {
    let sig = '';
    for (const handle of drawn) {
      let sum = 0;
      for (const child of handle.participant.root.children) sum += child.visible ? child.id : child.id * 3;
      sig += `${handle.wrapper.id}:${handle.participant.root.children.length}:${sum}:${handle.participant.revision?.() ?? ''};`;
    }
    return sig;
  }

  /** Force the shadow map to be redrawn next frame. */
  invalidateShadows(): void { this.shadowKey = ''; this.map.triggerRepaint?.(); }

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

  /**
   * Triangles each participant drew in the last frame, frustum-culled like three (shadow passes not included).
   * Diagnostics for GPU load on phones and iPads (Sentry CANAL-RECALL-7); walks the scene, so call it on demand.
   */
  private readonly lastDrawn: Partial<Record<FramePass, string[]>> = {};

  drawStats(): Record<string, { meshes: number; triangles: number }> {
    const THREE = this.THREE;
    const frustum = new THREE.Frustum().setFromProjectionMatrix(this.camera.projectionMatrix);
    const sphere = new THREE.Sphere();
    const out: Record<string, { meshes: number; triangles: number }> = {};
    const drawn = new Set(Object.values(this.lastDrawn).flat());
    for (const entry of this.registry.all()) {
      if (!drawn.has(entry.id)) continue;
      const stats = { meshes: 0, triangles: 0 };
      entry.participant.participant.root.traverseVisible((object: any) => {
        if (!object.isMesh || !object.geometry) return;
        // A tiled owner (tiledGeometry.ts drawAsTiles) sits on a layer the camera skips; its tiles are counted instead.
        if (!object.layers.test(this.camera.layers)) return;
        const geometry = object.geometry;
        if (object.frustumCulled && !object.isInstancedMesh) {
          if (!geometry.boundingSphere) geometry.computeBoundingSphere();
          if (!frustum.intersectsSphere(sphere.copy(geometry.boundingSphere).applyMatrix4(object.matrixWorld))) return;
        }
        const vertices = Math.min(geometry.index ? geometry.index.count : geometry.attributes.position?.count ?? 0, geometry.drawRange.count);
        stats.meshes++;
        stats.triangles += Math.floor(vertices / 3) * (object.isInstancedMesh ? object.count : 1);
      });
      out[entry.id] = stats;
    }
    return out;
  }

  private renderPass(pass: FramePass, gl: WebGL2RenderingContext, args: any): void {
    const renderer = this.renderer;
    if (!renderer) return;
    // A lost context answers createShader with null and three throws from
    // every frame (Sentry CANAL-RECALL-5, Safari/Mac); MapLibre restores it.
    if (gl.isContextLost?.()) return;
    if (this.coverWatch?.check(performance.now())) {
      this.coverSkipped++;
      this.lastDrawn[pass] = [];
      const s = this.stats[pass];
      s.ms = 0; s.calls = 0; s.triangles = 0;
      return;
    }
    if (pass === 'main' && this.deferredCompiles.length) {
      // One deferred compile per warm-up step, after the first draw's own compiles.
      const now = performance.now();
      if (now - this.resumedAt >= RESUME_DEFERRED_COMPILE_MS && now - this.lastDeferredCompile >= PRECOMPILE_STEP_MS) { this.lastDeferredCompile = now; this.compile(this.deferredCompiles.shift()); }
      if (this.deferredCompiles.length) this.map.triggerRepaint?.();
    }
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
    const drawnIds: string[] = [];
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
      drawnIds.push(entry.id);
    }
    this.lastDrawn[pass] = drawnIds;
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
      // Tiled meshes (tiledGeometry.ts): whole or through their culled tiles, per mesh, from what is on screen.
      const t = chooseTileDraws(this.THREE, this.camera.projectionMatrix, this.tileWholeShare, this.tileScratch ??= { frustum: new this.THREE.Frustum(), sphere: new this.THREE.Sphere(), m: new this.THREE.Matrix4() });
      this.tileDraws = t;
      // castShadow stays constant (toggling it recompiles every lit program);
      // below the shadow zoom, or when switched off, the map is not redrawn and
      // its contribution is zeroed instead.
      const ramp = this.options.shadowRamp ? Math.max(0, Math.min(1, this.options.shadowRamp(ctx.zoom))) : ctx.zoom >= (this.options.shadowMinZoom ?? 15) ? 1 : 0;
      const shadows = this.rig.options.shadows && this.shadowsOn && ramp > 0;
      this.rig.sun.shadow.intensity = shadows ? this.rig.options.shadowIntensity * ramp : 0;
      let redraw = false;
      if (shadows) {
        const c = this.map.getCenter();
        const focus = this.absOf(mercatorOfLngLat(c.lng, c.lat, 0));
        const fit = this.rig.follow(focus, ctx.zoom, abs => worldOfMercator(fm, this.mercatorOfAbs(abs)), this.options.shadowSnapM ?? 16);
        // The scene is static and the box moves in coarse steps, so the map is
        // redrawn only when the box, the casters or the age say so. Between
        // redraws only the shadow matrix follows the moving (eye-relative) world.
        const key = `${fit.targetAbs.map(v => v.toFixed(3)).join(',')}|${fit.right}|${this.casterSignature(drawn)}`;
        redraw = key !== this.shadowKey || ++this.shadowAge >= (this.options.shadowRefreshFrames ?? 120);
        if (redraw) { this.shadowKey = key; this.shadowAge = 0; this.shadowRedraws++; }
        else {
          this.rig.sun.updateMatrixWorld();
          this.rig.sun.shadow.updateMatrices(this.rig.sun);
        }
      } else this.shadowKey = '';
      renderer.shadowMap.needsUpdate = redraw;
      if (!renderLosingContext(renderer, this.scene, this.camera, gl)) return;
    } else {
      renderer.shadowMap.needsUpdate = false;
      for (const handle of drawn) {
        const xray = handle.participant.xrayMaterial?.();
        if (!xray) continue;
        for (const other of drawn) other.wrapper.visible = other === handle;
        this.scene.overrideMaterial = xray;
        try { if (!renderLosingContext(renderer, this.scene, this.camera, gl)) return; }
        finally { this.scene.overrideMaterial = null; }
      }
      for (const handle of drawn) handle.wrapper.visible = true;
      if (!renderLosingContext(renderer, this.scene, this.camera, gl)) return;
    }
    const s = this.stats[pass];
    s.ms = performance.now() - t0; s.calls = renderer.info.render.calls; s.triangles = renderer.info.render.triangles; s.frames++;
  }
}

/**
 * A context can die between `isContextLost()` and the shader compile inside
 * `render`: `createShader` then answers null and three's `shaderSource(null)`
 * throws a TypeError from the animation frame (Sentry CANAL-RECALL-5, Safari
 * on Mac, the same second as its CANAL-RECALL-7 context loss). That frame is
 * dropped quietly; `webglcontextlost` follows and contextLost() takes over.
 * Any error from a live context still throws. Returns whether it drew.
 */
export function renderLosingContext(renderer: { render(scene: any, camera: any): void }, scene: any, camera: any, gl: WebGL2RenderingContext): boolean {
  try {
    renderer.render(scene, camera);
    return true;
  } catch (error) {
    if (gl.isContextLost?.() || LOST_SHADER_ERROR.test(String((error as Error)?.message ?? error))) return false;
    throw error;
  }
}

/** A null shader handed to `shaderSource`/`compileShader`/`attachShader`, as WebKit, Chromium and Gecko word it. */
export const LOST_SHADER_ERROR = /\b(?:shaderSource|compileShader|attachShader)\b/;

/**
 * Draw the sun's shadow map at the full depth range.
 *
 * MapLibre renders a 3D custom layer with `gl.depthRange(0, k)`, where
 * k = 1 − (style layers + 2) · 2 / 2¹⁶ (its `depthRangeFor3D`, so 3D layers sit
 * under the 2D sublayers). The range is GL state, not framebuffer state, so
 * three's shadow pass inherited it: every depth written into the shadow map
 * was scaled by k, while the receivers compare against the unscaled
 * light-space depth. With ~300 style layers k ≈ 0.991, so a surface at light
 * depth z read an occluder (1 − k)·z closer to the sun than itself: metres in
 * a 600 m deep box. Every sun-facing surface beyond the first few metres of
 * the box shadowed itself (Royal Palace 95 % of its sun-side pixels, the
 * Nassaukade block 64 %), and no bias short of metres hid it, while a CPU ray
 * cast toward the sun found nothing in the way (docs/LOOK.md §Light).
 * The main pass keeps MapLibre's range: its depths must compare with
 * MapLibre's own extrusions.
 */
export function fullDepthRangeForShadowMap(renderer: any, gl: WebGL2RenderingContext, seen?: (range: [number, number]) => void): void {
  const shadowMap = renderer.shadowMap;
  if (!shadowMap || shadowMap.__fullDepthRange) return;
  const render = shadowMap.render;
  shadowMap.render = function (this: any, ...args: unknown[]) {
    if (!this.enabled || (!this.autoUpdate && !this.needsUpdate)) return render.apply(this, args);
    const range = gl.getParameter(gl.DEPTH_RANGE) as Float32Array;
    const lo = range[0], hi = range[1];
    seen?.([lo, hi]);
    // `renderer.shadowMap.fullDepthRange = false` restores the old behaviour (diagnostics, before/after shots).
    if ((lo === 0 && hi === 1) || this.fullDepthRange === false) return render.apply(this, args);
    gl.depthRange(0, 1);
    try { return render.apply(this, args); }
    finally { gl.depthRange(lo, hi); }
  };
  shadowMap.__fullDepthRange = true;
}
