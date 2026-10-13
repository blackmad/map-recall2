// Sculptures in the shared three.js frame (`?sculptures=1`).
//
// Each entry of public/canal-drive/sculptures/manifest.json is a statue with
// a near-LOD reconstruction of the figure and a plain mesh plinth. The
// reconstruction is either a photo impostor (impostor.ts: real photos from
// several sides on a camera-facing quad) or a Gaussian splat (splatMesh.ts),
// whichever the photo set supports (docs/sculptures.md). Within `nearM` of
// the eye the reconstruction is drawn and the hand-built landmark model is
// hidden; beyond, the hand model is the far LOD and the reconstruction costs
// nothing (no update, no draw call). Picking keeps going through the landmark
// layer: its hand model is still raycast while hidden, so a click on the
// statue returns the landmark id exactly as before.
//
// THREE is injected (the page's one copy). Nothing here touches MapLibre.

import { mercatorOfLngLat, mercatorUnitsPerMetre, worldOfMercator, type Mat4 } from '../rendererShared/frameMath.js';
import type { FrameContext, FrameParticipant } from '../rendererShared/sharedFrame.js';
import { createImpostorObject, type ImpostorMeta } from './impostor.js';
import { SculptureLod, type SculptureLevel } from './lod.js';
import { decodeSplats } from './splatFormat.js';
import { createSplatObject, eyeOf } from './splatMesh.js';

export type SculptureReconstruction =
  | { kind: 'impostor'; atlasUrl: string; metaUrl: string; band?: number; brightness?: number }
  | { kind: 'splat'; url: string };

export type SculptureSpec = {
  id: string;
  name: string;
  /** Extract landmark id (what picking returns). */
  landmarkId: string;
  /** Signature-landmark model id of the hand-built far LOD. */
  handModelId: string;
  /** [lng, lat] of the statue's ground anchor. */
  anchor: [number, number];
  /** Compass heading the figure faces (degrees clockwise from north). */
  facingDeg: number;
  /** Near LOD. URLs are relative to the manifest. Local frame: metres, x east, y north, z up, origin at the anchor on the ground. */
  reconstruction: SculptureReconstruction;
  plinth: { widthM: number; depthM: number; heightM: number; color: string };
  nearM?: number;
  hysteresisM?: number;
  attribution?: string;
};

export type SculptureManifest = { version: number; sculptures: SculptureSpec[] };

/** Column-major local (ENU metres about the anchor, z up) → Web Mercator. */
export function sculptureMercatorFromLocal(anchor: [number, number]): number[] {
  const [mx, my, mz] = mercatorOfLngLat(anchor[0], anchor[1], 0);
  const u = mercatorUnitsPerMetre(my);
  return [u, 0, 0, 0, 0, -u, 0, 0, 0, 0, u, 0, mx, my, mz, 1];
}

/** Eye–anchor distance in metres for a frame (eye in Mercator). */
export function eyeDistanceM(frame: { eye: [number, number, number]; unitsPerMetre: number }, anchor: [number, number]): number {
  const w = worldOfMercator(frame, mercatorOfLngLat(anchor[0], anchor[1], 0));
  return Math.hypot(w[0], w[1], w[2]);
}

export type HandModelHost = {
  /** Hide the hand-built model for this landmark model id this frame. Called after the landmark pass decided visibility. */
  setHandModelHidden?(handModelId: string, hidden: boolean): void;
};

/** What the near level needs per frame. */
type NearObject = { mesh: any; update(clipFromLocal: ArrayLike<number>, viewport: [number, number], eyeLocal: ArrayLike<number>): void; dispose(): void };

type Entry = {
  spec: SculptureSpec;
  root: any;
  near: NearObject | null;
  lod: SculptureLod;
  mercatorFromLocal: number[];
  loading: Promise<void> | null;
  failed: boolean;
  /** Last camera azimuth about the statue (impostor only; diagnostics). */
  azimuthDeg: number | null;
};

export type SculpturesOptions = {
  baseUrl: string;
  host?: HandModelHost;
  /** Texture loader (tests inject one); defaults to THREE.TextureLoader. */
  loadTexture?: (url: string) => Promise<any>;
};

export class Sculptures {
  readonly root: any;
  readonly entries: Entry[] = [];
  /** Diagnostics for the perf harness and tests. */
  readonly stats = { near: 0, updateMs: 0, loads: 0 };
  private readonly THREE: any;
  private readonly options: SculpturesOptions;
  private readonly tmp: any;
  private readonly tmp2: any;
  private readonly eye = new Float64Array(3);
  private unregister: (() => void) | null = null;
  private frame: any = null;
  enabled = true;

  constructor(THREE: any, manifest: SculptureManifest, options: SculpturesOptions) {
    this.THREE = THREE;
    this.options = options;
    this.root = new THREE.Group();
    this.root.name = 'sculptures';
    this.tmp = new THREE.Matrix4();
    this.tmp2 = new THREE.Matrix4();
    for (const spec of manifest.sculptures) {
      const root = new THREE.Group();
      root.name = `sculpture/${spec.id}`;
      root.matrixAutoUpdate = false;
      const m = sculptureMercatorFromLocal(spec.anchor);
      root.matrix.fromArray(m);
      root.visible = false;
      root.add(this.makePlinth(spec));
      this.root.add(root);
      this.entries.push({ spec, root, near: null, lod: new SculptureLod({ nearM: spec.nearM, hysteresisM: spec.hysteresisM }), mercatorFromLocal: m, loading: null, failed: false, azimuthDeg: null });
    }
  }

  private makePlinth(spec: SculptureSpec): any {
    const THREE = this.THREE;
    const { widthM, depthM, heightM, color } = spec.plinth;
    // Width along the figure's shoulders, depth along its facing.
    const geometry = new THREE.BoxGeometry(widthM, depthM, heightM);
    geometry.translate(0, 0, heightM / 2);
    const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.95, metalness: 0 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'sculpture-plinth';
    mesh.rotation.z = -spec.facingDeg * Math.PI / 180;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.landmarkId = spec.landmarkId;
    return mesh;
  }

  /** The participant to register in the shared frame. Order after the landmarks (20) so hiding the hand model wins. */
  participant(): FrameParticipant {
    return { root: this.root, beforeRender: ctx => this.beforeRender(ctx) };
  }

  attach(frame: any, order = 25): void {
    this.frame = frame;
    this.unregister = frame.register('sculptures', this.participant(), { order });
  }

  detach(): void {
    this.unregister?.();
    this.unregister = null;
  }

  /** Per-frame: choose levels, load on first approach, update the near objects. Returns whether anything draws. */
  beforeRender(ctx: FrameContext): boolean {
    if (ctx.pass !== 'main') return false;
    let any = false;
    this.stats.near = 0;
    const t0 = performance.now();
    for (const entry of this.entries) {
      const level: SculptureLevel = this.enabled && !entry.failed ? entry.lod.update(eyeDistanceM(ctx.frame, entry.spec.anchor)) : 'far';
      const ready = level === 'near' && !!entry.near;
      if (level === 'near' && !entry.near && !entry.loading && !entry.failed) entry.loading = this.load(entry);
      // Until the reconstruction has arrived the hand model stays: never an empty plinth.
      if (ready) this.options.host?.setHandModelHidden?.(entry.spec.handModelId, true);
      entry.root.visible = ready;
      if (!ready) continue;
      any = true;
      this.stats.near++;
      // clip ← local = clipFromWorld · worldFromMercator · mercatorFromLocal
      this.tmp.copy(ctx.clipFromWorld).multiply(ctx.worldFromMercator).multiply(this.tmp2.fromArray(entry.mercatorFromLocal));
      eyeOf(this.tmp.elements, this.eye);
      entry.near!.update(this.tmp.elements, this.viewport(), this.eye);
    }
    this.stats.updateMs = performance.now() - t0;
    return any;
  }

  private viewport(): [number, number] {
    const gl = this.frame?.renderer?.getContext?.();
    return gl ? [gl.drawingBufferWidth, gl.drawingBufferHeight] : [1, 1];
  }

  private async load(entry: Entry): Promise<void> {
    const THREE = this.THREE, rec = entry.spec.reconstruction;
    const url = (u: string) => new URL(u, this.options.baseUrl).href;
    try {
      let near: NearObject;
      if (rec.kind === 'impostor') {
        const [meta, texture] = await Promise.all([
          fetch(url(rec.metaUrl)).then(r => { if (!r.ok) throw new Error(`${r.status} ${rec.metaUrl}`); return r.json() as Promise<ImpostorMeta>; }),
          (this.options.loadTexture ?? (u => new THREE.TextureLoader().loadAsync(u)))(url(rec.atlasUrl)),
        ]);
        const imp = createImpostorObject(THREE, meta, texture, { facingDeg: entry.spec.facingDeg, baseZ: entry.spec.plinth.heightM, band: rec.band, brightness: rec.brightness });
        near = { mesh: imp.mesh, update: (_c, _v, eye) => { entry.azimuthDeg = imp.update(eye); }, dispose: () => imp.dispose() };
      } else {
        const res = await fetch(url(rec.url));
        if (!res.ok) throw new Error(`${res.status} ${rec.url}`);
        const splat = createSplatObject(THREE, decodeSplats(await res.arrayBuffer()));
        near = { mesh: splat.mesh, update: (clip, viewport) => { splat.update(clip, viewport); }, dispose: () => splat.dispose() };
      }
      near.mesh.userData.landmarkId = entry.spec.landmarkId;
      entry.near = near;
      entry.root.add(near.mesh);
      this.stats.loads++;
      this.frame?.compile?.(entry.root);
      this.frame?.map?.triggerRepaint?.();
    } catch (error) {
      entry.failed = true;
      console.warn(`Sculpture ${entry.spec.id}: reconstruction unavailable, the hand model stays.`, error);
    } finally {
      entry.loading = null;
    }
  }

  /** Landmark id of a sculpture drawn at its near level under a clip-space point (tests / fallback picking): the plinth plus the figure's bounding cylinder. */
  pick(ndcX: number, ndcY: number, clipFromWorld: Mat4, worldFromMercator: Mat4): string | null {
    const THREE = this.THREE;
    const inv = new THREE.Matrix4().fromArray(Array.from(clipFromWorld)).invert();
    const near = new THREE.Vector3(ndcX, ndcY, -1).applyMatrix4(inv), far = new THREE.Vector3(ndcX, ndcY, 1).applyMatrix4(inv);
    const ray = new THREE.Ray(near, far.sub(near).normalize());
    for (const entry of this.entries) {
      if (!entry.root.visible || !entry.near) continue;
      const m = new THREE.Matrix4().fromArray(Array.from(worldFromMercator)).multiply(new THREE.Matrix4().fromArray(entry.mercatorFromLocal));
      // Local bounds: the plinth's footprint circle and the figure's bounding sphere, as an upright box.
      const geometry = entry.near.mesh.geometry;
      if (!geometry.boundingSphere) geometry.computeBoundingSphere();
      const sphere = geometry.boundingSphere, p = entry.spec.plinth;
      const r = Math.max(Math.hypot(p.widthM, p.depthM) / 2, Math.hypot(sphere.center.x, sphere.center.y) + sphere.radius);
      const top = Math.max(p.heightM, entry.near.mesh.position.z + sphere.center.z + sphere.radius);
      const box = new THREE.Box3(new THREE.Vector3(-r, -r, 0), new THREE.Vector3(r, r, top));
      if (ray.intersectsBox(box.applyMatrix4(m))) return entry.spec.landmarkId;
    }
    return null;
  }

  dispose(): void {
    this.detach();
    for (const entry of this.entries) entry.near?.dispose();
  }
}

/** Load the manifest and register the sculptures in a shared frame. */
export async function mountSculptures(THREE: any, frame: any, options: { manifestUrl: string; host?: HandModelHost }): Promise<Sculptures> {
  const res = await fetch(options.manifestUrl);
  if (!res.ok) throw new Error(`${res.status} ${options.manifestUrl}`);
  const manifest = (await res.json()) as SculptureManifest;
  const sculptures = new Sculptures(THREE, manifest, { baseUrl: new URL(options.manifestUrl, globalThis.location?.href).href, host: options.host });
  sculptures.attach(frame);
  return sculptures;
}

/**
 * Host adapter for the game's SignatureLandmarks layer: hides a hand model by
 * setting its holder invisible after the landmark participant set it visible
 * this frame (it does so every frame, so nothing has to be given back).
 * Raycasting ignores visibility, so the hidden model still answers picking.
 */
export function landmarkHost(landmarks: any): HandModelHost {
  return {
    setHandModelHidden(handModelId, hidden) {
      if (!hidden) return;
      for (const entry of landmarks?._entries ?? []) if (entry.spec?.id === handModelId && entry.holder) entry.holder.visible = false;
    },
  };
}
