// Café and restaurant terraces in the ride (lane terraces-20261114): the furniture units scripts/terraces/build.ts laid
// inside each permitted terrace polygon (terraces/placement.ts), drawn round the rider. Default off: `?terraces=1`
// (terraces/extract.ts terracesFlag; `?terraces=0`, TERRACES=0, `globalThis.__canalRecallTerraces = false` force off).
// Off, cityExtras.ts never constructs this layer: nothing is fetched, registered or drawn.
//
// Data: <extract>/terraces-v1/index.json (one file, ~2,400 terraces). Units are bucketed on a 50 m grid once at load.
// Drawing: units within RADIUS_M of the rider (the own engine's camera subject, the view centre without one), one
// InstancedMesh per model and detail level sharing one vertex-colour material; near units (NEAR_M) take the full kit
// model, the rest its low twin; a screen-door dither fades units out from FADE_FROM_M to RADIUS_M (no transparency,
// no sorting). Rebuilt (coalesced, off the game frame) when the rider has moved REBUILD_M or the ground re-based.
// Stands on the own ground's riding surface like the street furniture: pavement units at RIDE_BASE_LIFT_M, units on a
// parking bay at the carriageway plane. Registered with the shared frame (order 33, after the furniture's 32).
import { RebuildCoalescer, extrasRebuildSync } from '../rendererShared/rebuildCoalescer';
import { InstanceCull } from '../rendererShared/instanceCull';
import { radiusCentre } from '../rendererShared/riderViewBox';
import { RIDE_BASE_LIFT_M } from '../streetFurniture/models';
import { TERRACES_EXTRACT, fromLocal, terracesFlag, toLocal, type TerracesExtract } from '../terraces/extract';
import { TERRACE_MODEL_IDS, terraceModel, type TerraceModelId } from '../terraces/kit';

const W = () => globalThis as any;
export const terraceLayerFlag = terracesFlag;
export const MIN_ZOOM = 16;
export const RADIUS_M = 150;
export const NEAR_M = 60;
export const FADE_FROM_M = 110;
export const REBUILD_M = 20;
export const BUCKET_M = 50;
/** Carriageway-level units (a terrace on a parking bay): roadSurfaces ROAD_LIFT.parking (LIFT.carriageway). */
export const PARKING_LIFT_M = 0.03;

/** One decoded unit: model index, lng/lat, yaw (radians, ccw from east), slot colour index (-1 none), level (0 pavement, 1 carriageway). */
export interface DecodedUnit { m: number; lng: number; lat: number; yaw: number; c: number; level: number }

/** Every unit of the extract with its absolute lng/lat (anchor + decimetre offset in the game's local frame). */
export function decodeUnits(ex: Pick<TerracesExtract, 'terraces' | 'models'>): DecodedUnit[] {
  const out: DecodedUnit[] = [];
  for (const t of ex.terraces) {
    const [ax, ay] = toLocal(t.lng, t.lat);
    for (const u of t.units) {
      const [lng, lat] = fromLocal(ax + u[1] / 10, ay + u[2] / 10);
      out.push({ m: u[0], lng, lat, yaw: u[3] * Math.PI / 180, c: u[4] ?? -1, level: u[5] ?? 0 });
    }
  }
  return out;
}

/** Units within `radiusM` of (x, y) (local metres), split near / far at `nearM`; `pos` holds each unit's local x, y. */
export function selectUnits(pos: Float64Array, buckets: Map<string, number[]>, x: number, y: number, radiusM = RADIUS_M, nearM = NEAR_M): { near: number[]; far: number[] } {
  const near: number[] = [], far: number[] = [], r2 = radiusM * radiusM, n2 = nearM * nearM;
  for (let bx = Math.floor((x - radiusM) / BUCKET_M); bx <= Math.floor((x + radiusM) / BUCKET_M); bx++)
    for (let by = Math.floor((y - radiusM) / BUCKET_M); by <= Math.floor((y + radiusM) / BUCKET_M); by++)
      for (const i of buckets.get(`${bx}_${by}`) ?? []) {
        const d2 = (pos[2 * i] - x) ** 2 + (pos[2 * i + 1] - y) ** 2;
        if (d2 <= n2) near.push(i); else if (d2 <= r2) far.push(i);
      }
  return { near, far };
}

/** The dither fade: 1 inside `from`, 0 at `to`, linear between. */
export const fadeAt = (d: number, from = FADE_FROM_M, to = RADIUS_M): number => Math.max(0, Math.min(1, (to - d) / (to - from)));

export function terraceMaterial(THREE: any, rider: { value: any }) {
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, metalness: 0, flatShading: true, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -12 });
  material.onBeforeCompile = (shader: any) => {
    shader.uniforms.uTerraceRider = rider;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform vec2 uTerraceRider;\nvarying float vTerraceFade;`)
      .replace('#include <color_vertex>', `#include <color_vertex>
#ifdef USE_INSTANCING_COLOR
 float tSlot = step(0.98, color.r) * step(color.g, 0.02) * step(0.98, color.b);
 vColor.rgb = mix(color.rgb, instanceColor.rgb, tSlot);
#endif
#ifdef USE_INSTANCING
 vTerraceFade = clamp((${RADIUS_M.toFixed(1)} - distance(instanceMatrix[3].xy, uTerraceRider)) / ${(RADIUS_M - FADE_FROM_M).toFixed(1)}, 0.0, 1.0);
#else
 vTerraceFade = 1.0;
#endif`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying float vTerraceFade;`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
 if (vTerraceFade < 0.999) { vec2 q = floor(gl_FragCoord.xy); float th = fract(52.9829189 * fract(dot(q, vec2(0.06711056, 0.00583715)))); if (th >= vTerraceFade) discard; }`);
  };
  material.customProgramCacheKey = () => 'canal-terraces';
  return material;
}

export class TerraceLayer {
  readonly debug = { ready: false, terraces: 0, units: 0, draws: 0, instances: 0, triangles: 0, near: 0, far: 0, rebuilds: 0, buildMs: 0, byModel: {} as Record<string, number> };
  private scene: any; private transform: any; private origin: any; private scale = 1;
  private unregister: (() => void) | null = null;
  private units: DecodedUnit[] = []; private pos = new Float64Array(0); private buckets = new Map<string, number[]>();
  private meshes: any[] = []; private culls: InstanceCull[] = []; private geometries = new Map<string, any>(); private material: any = null;
  private readonly riderUniform: { value: any };
  private builtAt: [number, number] | null = null; private suspended = false; private groundBase: ((p: [number, number]) => number | undefined) | null = null;
  private readonly rebuilds: RebuildCoalescer;
  private readonly clipFromLocal: any; private readonly frustum: any;
  constructor(private readonly cameraMap: any, private readonly mercator: any, private readonly opts: { sharedFrame?: any; camera?: any; rider?: () => [number, number] | null } = {}) {
    const { THREE } = W().CanalRecallThree;
    this.scene = new THREE.Group(); this.scene.name = 'terraces';
    this.origin = mercator.MercatorCoordinate.fromLngLat([4.9, 52.37], 0); this.scale = this.origin.meterInMercatorCoordinateUnits();
    this.transform = new THREE.Matrix4().makeTranslation(this.origin.x, this.origin.y, this.origin.z).scale(new THREE.Vector3(this.scale, -this.scale, this.scale));
    this.riderUniform = { value: new THREE.Vector2(0, 0) };
    this.clipFromLocal = new THREE.Matrix4(); this.frustum = new THREE.Frustum();
    this.rebuilds = new RebuildCoalescer(() => this.rebuild(), undefined, extrasRebuildSync());
    this.unregister = opts.sharedFrame?.register('terraces', {
      root: this.scene,
      mercatorFromLocal: () => this.transform.elements,
      beforeRender: (ctx: any) => {
        const on = this.debug.ready && !this.suspended && ctx.zoom >= MIN_ZOOM;
        if (!on) { this.debug.draws = 0; this.debug.triangles = 0; return false; }
        const c = this.centreLocal();
        if (c) {
          this.riderUniform.value.set(c[0], c[1]);
          if (!this.builtAt || Math.hypot(c[0] - this.builtAt[0], c[1] - this.builtAt[1]) > REBUILD_M) this.rebuilds.request();
        }
        if (!this.meshes.length) { this.debug.draws = 0; this.debug.triangles = 0; return false; }
        this.clipFromLocal.multiplyMatrices(ctx.clipFromWorld, ctx.worldFromMercator).multiply(this.transform);
        let draws = 0, triangles = 0;
        for (const cull of this.culls) { cull.update(this.clipFromLocal, this.frustum); const n = cull.mesh.count; cull.mesh.visible = n > 0; if (n > 0) { draws++; triangles += n * cull.mesh.geometry.userData.triangles; } }
        this.debug.draws = draws; this.debug.triangles = triangles;
        return draws > 0;
      },
    }, { order: 33 }) ?? null;
  }
  /** Local metres (mercator-metre frame of the transform) of a lng/lat. */
  private local(lng: number, lat: number): [number, number] {
    const p = this.mercator.MercatorCoordinate.fromLngLat([lng, lat], 0);
    return [(p.x - this.origin.x) / this.scale, -(p.y - this.origin.y) / this.scale];
  }
  private centreLocal(): [number, number] | null {
    const cam = this.opts.camera ?? this.cameraMap?.api;
    const view = cam?.center?.() ?? this.cameraMap?.getCenter?.();
    const c = radiusCentre(this.opts.rider?.() ?? null, view ? { lng: view.lng, lat: view.lat } : { lng: NaN, lat: NaN });
    return Number.isFinite(c[0]) && Number.isFinite(c[1]) ? this.local(c[0], c[1]) : null;
  }
  async load(extractPath: string): Promise<void> {
    if (!extractPath.endsWith('/amsterdam')) return;
    try {
      const res = await fetch(new URL(`${extractPath}/${TERRACES_EXTRACT}/index.json`, location.href));
      if (!res.ok) return;
      const ex = await res.json() as TerracesExtract;
      if (ex.version !== 1 || !Array.isArray(ex.terraces)) throw new Error('Invalid terraces extract');
      const ids = ex.models.map(m => (TERRACE_MODEL_IDS as readonly string[]).indexOf(m));
      this.units = decodeUnits(ex).filter(u => ids[u.m] >= 0).map(u => ({ ...u, m: ids[u.m] }));
      this.colours = ex.colours;
      this.pos = new Float64Array(this.units.length * 2); this.buckets.clear();
      this.units.forEach((u, i) => {
        const [x, y] = this.local(u.lng, u.lat); this.pos[2 * i] = x; this.pos[2 * i + 1] = y;
        const k = `${Math.floor(x / BUCKET_M)}_${Math.floor(y / BUCKET_M)}`; (this.buckets.get(k) ?? this.buckets.set(k, []).get(k)!).push(i);
      });
      this.debug.terraces = ex.terraces.length; this.debug.units = this.units.length; this.debug.ready = true;
      this.rebuilds.request(); this.cameraMap.triggerRepaint?.();
    } catch (error) { console.warn('Terraces unavailable.', error); }
  }
  private colours: string[] = [];
  setGroundBase(fn: ((p: [number, number]) => number | undefined) | null): void { this.groundBase = fn; this.refreshGroundBases(); }
  refreshGroundBases(): void { if (this.debug.ready) { this.builtAt = null; this.rebuilds.request(); } }
  setSuspended(v: boolean): void { this.suspended = !!v; if (!v) this.rebuilds.request(); }
  remove(): void { this.unregister?.(); this.unregister = null; this.rebuilds.cancel(); this.clear(); for (const g of this.geometries.values()) g.dispose(); this.geometries.clear(); this.material?.dispose(); this.material = null; }
  private clear(): void { for (const m of this.meshes) { this.scene.remove(m); m.dispose?.(); } this.meshes = []; this.culls = []; }
  private geometry(id: TerraceModelId, lo: boolean): any {
    const key = lo ? `${id}-lo` : id;
    let g = this.geometries.get(key);
    if (!g) {
      const { THREE } = W().CanalRecallThree, m = terraceModel(id, lo);
      g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3)); g.setAttribute('color', new THREE.BufferAttribute(m.colours, 3));
      g.computeVertexNormals(); g.computeBoundingSphere(); g.userData.triangles = m.triangles;
      this.geometries.set(key, g);
    }
    return g;
  }
  private rebuild(): void {
    if (!this.debug.ready || this.suspended) return;
    const t0 = performance.now();
    this.clear();
    const c = this.centreLocal();
    if (!c || (this.cameraMap.getZoom?.() ?? 20) < MIN_ZOOM) { this.builtAt = null; return; }
    this.builtAt = c;
    const { THREE } = W().CanalRecallThree;
    this.material ??= terraceMaterial(THREE, this.riderUniform);
    const { near, far } = selectUnits(this.pos, this.buckets, c[0], c[1]);
    const groups = new Map<string, { id: TerraceModelId; lo: boolean; items: number[] }>();
    for (const [list, lo] of [[near, false], [far, true]] as const) for (const i of list) {
      const id = TERRACE_MODEL_IDS[this.units[i].m], key = `${id}${lo ? '-lo' : ''}`;
      (groups.get(key) ?? groups.set(key, { id, lo, items: [] }).get(key)!).items.push(i);
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), z = new THREE.Vector3(0, 0, 1), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), white = new THREE.Color(1, 1, 1), col = new THREE.Color();
    const byModel: Record<string, number> = {};
    for (const [key, g] of groups) {
      const geometry = this.geometry(g.id, g.lo), mesh = new THREE.InstancedMesh(geometry, this.material, g.items.length);
      mesh.name = `terraces/${key}`;
      g.items.forEach((i, j) => {
        const u = this.units[i], base = this.groundBase ? (this.groundBase([u.lng, u.lat]) ?? 0) + (u.level ? PARKING_LIFT_M : RIDE_BASE_LIFT_M) : 0;
        pos.set(this.pos[2 * i], this.pos[2 * i + 1], base); q.setFromAxisAngle(z, u.yaw);
        m4.compose(pos, q, one); mesh.setMatrixAt(j, m4);
        mesh.setColorAt(j, u.c >= 0 && this.colours[u.c] ? col.set(this.colours[u.c]) : white);
      });
      mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = !!this.opts.sharedFrame;
      this.scene.add(mesh); this.meshes.push(mesh);
      if (this.opts.sharedFrame) this.culls.push(new InstanceCull(THREE, mesh, { castShadow: false }));
      byModel[key] = g.items.length;
    }
    Object.assign(this.debug, { instances: near.length + far.length, near: near.length, far: far.length, byModel, rebuilds: this.debug.rebuilds + 1, buildMs: +(performance.now() - t0).toFixed(2) });
    this.cameraMap.triggerRepaint?.();
  }
}
