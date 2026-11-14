// Street markets in the ride (lane markets-20261114): the Albert Cuypmarkt and the Ten Katemarkt as rows of stalls.
// Kit: src/canalRecall/markets/stallKit.ts; placer: src/canalRecall/markets/placer.ts; data:
// <extract>/markets/market-lines.json (the integrator copies scripts/data/markets/market-lines.json there;
// scripts/markets/build-lines.ts measures it). Registers one object with the shared frame like
// street-furniture-source.js: one InstancedMesh per kit part (frame, plain roof, striped roof, six goods kinds, van) for
// every market within MARKET_RADIUS_M of the rider, one shared vertex-colour material whose magenta faces take the
// instance colour, per-instance frustum culling (rendererShared/instanceCull.ts).
//
// Flag: `?markets=1` draws them (default off until reviewed: MARKETS_DEFAULT); `?markets=0` is the kill switch and wins
// over the default. Off, nothing is constructed or fetched, so the ride is byte-identical.
//
// Day and time: the game has no clock or weekday (the light rig is a fixed afternoon), so the stalls always stand when
// the flag is on. placer.ts marketOpenAt() reads the register's hours if a time of day ever arrives.
import { InstanceCull } from '../rendererShared/instanceCull';
import { placeAll, type MarketInstance, type MarketLinesFile } from '../markets/placer';
import { MARKET_MODELS, MARKET_PART_IDS, type MarketPartId } from '../markets/stallKit';

const W = () => globalThis as any;
/** Flip to true to show the markets by default; `?markets=0` still turns them off. */
export const MARKETS_DEFAULT = false;
export function marketsFlag(search: string = W().location?.search ?? ''): boolean {
  const v = new URLSearchParams(search).get('markets');
  if (v === '0') return false;
  if (v === '1') return true;
  return MARKETS_DEFAULT;
}
const ORIGIN: [number, number] = [4.9, 52.37];
/** Markets draw from this zoom, within this distance of the rider (from the market's nearest stall). */
export const MARKET_MIN_ZOOM = 15.5;
export const MARKET_RADIUS_M = 600;
/** Same lift as street furniture over the relief (models.ts RIDE_BASE_LIFT_M): the pavement planes sit ~0.14 m up. */
export const MARKET_BASE_LIFT_M = 0.15;
/** Minimum interval between ground re-bases of a built market (ms). */
export const REBASE_MS = 1000;

/** Instances grouped by kit part: one instanced draw each. */
export function groupByPart(instances: readonly MarketInstance[]): Map<MarketPartId, MarketInstance[]> {
  const out = new Map<MarketPartId, MarketInstance[]>();
  for (const i of instances) (out.get(i.part) ?? out.set(i.part, []).get(i.part)!).push(i);
  return out;
}

export class MarketLayer {
  private scene: any; private transform: any; private unregister: (() => void) | null = null;
  private groundBase: ((p: [number, number]) => number | null | undefined) | null = null;
  private instances: MarketInstance[] = []; private markets: { id: string; lng: number; lat: number; r: number }[] = [];
  private meshes: any[] = []; private culls: InstanceCull[] = []; private geometries = new Map<MarketPartId, any>(); private material: any = null;
  private suspended = false; private builtFor = ''; private origin: any; private scale = 1;
  private readonly clipFromLocal: any; private readonly frustum: any;
  readonly debug = { draws: 0, instances: 0, triangles: 0, stalls: 0, markets: [] as string[], buildMs: 0 };
  constructor(private readonly cameraMap: any, private readonly mercator: any, private readonly opts: { sharedFrame?: any; rider?: () => [number, number] | null } = {}) {
    const { THREE } = W().CanalRecallThree;
    this.scene = new THREE.Group(); this.scene.name = 'markets';
    this.origin = mercator.MercatorCoordinate.fromLngLat(ORIGIN, 0); this.scale = this.origin.meterInMercatorCoordinateUnits();
    this.transform = new THREE.Matrix4().makeTranslation(this.origin.x, this.origin.y, this.origin.z).scale(new THREE.Vector3(this.scale, -this.scale, this.scale));
    this.clipFromLocal = new THREE.Matrix4(); this.frustum = new THREE.Frustum();
    this.unregister = opts.sharedFrame?.register('markets', {
      root: this.scene, mercatorFromLocal: () => this.transform.elements,
      beforeRender: (ctx: any) => {
        const on = !this.suspended && ctx.zoom >= MARKET_MIN_ZOOM && this.meshes.length > 0;
        if (!on) { this.debug.draws = 0; this.debug.triangles = 0; return false; }
        this.clipFromLocal.multiplyMatrices(ctx.clipFromWorld, ctx.worldFromMercator).multiply(this.transform);
        let draws = 0, triangles = 0;
        for (const c of this.culls) { c.update(this.clipFromLocal, this.frustum); const n = c.mesh.count; c.mesh.visible = n > 0; if (n > 0) { draws++; triangles += n * c.mesh.geometry.userData.triangles; } }
        this.debug.draws = draws; this.debug.triangles = triangles;
        return true;
      },
    }, { order: 33 }) ?? null;
  }
  async load(extractPath: string): Promise<void> {
    if (!extractPath.endsWith('/amsterdam')) return;
    try {
      const r = await fetch(new URL(`${extractPath}/markets/market-lines.json`, W().location.href));
      if (!r.ok) return;
      const file = await r.json() as MarketLinesFile;
      if (file.version !== 1 || !Array.isArray(file.markets)) throw Error('Invalid market lines');
      this.instances = placeAll(file).instances;
      this.markets = file.markets.map(m => {
        const pts = m.sides.flatMap(s => s.kerb), lng = pts.reduce((a, p) => a + p[0], 0) / pts.length, lat = pts.reduce((a, p) => a + p[1], 0) / pts.length;
        const r = Math.max(...pts.map(p => Math.hypot((p[0] - lng) * 111320 * Math.cos(lat * Math.PI / 180), (p[1] - lat) * 110540)));
        return { id: m.id, lng, lat, r };
      });
      this.update();
    } catch (error) { console.warn('Markets unavailable.', error); }
  }
  setGroundBase(fn: ((p: [number, number]) => number | null | undefined) | null): void { this.groundBase = fn; this.rebase = true; this.update(); }
  /** New relief or decks: re-base on the next update, at most once every REBASE_MS (ground revisions come in bursts). */
  refreshGroundBases(): void { this.rebase = true; }
  private rebase = false; private builtAt = -Infinity;
  setSuspended(v: boolean): void { this.suspended = !!v; if (!v) this.update(); }
  remove(): void { this.unregister?.(); this.unregister = null; this.clear(); for (const g of this.geometries.values()) g.dispose(); this.geometries.clear(); this.material?.dispose(); this.material = null; }
  /** Per frame or on move: (re)build when the set of markets near the rider changes. */
  update(): void {
    if (this.suspended || !this.instances.length) return;
    const c = this.opts.rider?.() ?? (() => { const v = this.cameraMap.getCenter?.(); return v ? [v.lng, v.lat] as [number, number] : null; })();
    const near = c ? this.markets.filter(m => Math.hypot((m.lng - c[0]) * 111320 * Math.cos(m.lat * Math.PI / 180), (m.lat - c[1]) * 110540) <= m.r + MARKET_RADIUS_M) : [];
    const key = near.map(m => m.id).join(','), now = performance.now();
    if (key === this.builtFor && !(this.rebase && key && now - this.builtAt >= REBASE_MS)) return;
    this.builtFor = key; this.rebase = false; this.builtAt = now; this.build(new Set(key ? key.split(',') : []));
  }
  private clear(): void { for (const m of this.meshes) { this.scene.remove(m); m.dispose?.(); } this.meshes = []; this.culls = []; }
  private materialOf(THREE: any): any {
    if (this.material) return this.material;
    // As street-furniture-source.js furnitureMaterial: vertex colours, magenta faces take the instance colour, pulled
    // ahead of the ground layers' polygon offsets.
    const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, metalness: 0, flatShading: true, vertexColors: true, side: THREE.FrontSide, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -12 });
    m.onBeforeCompile = (shader: any) => { shader.vertexShader = shader.vertexShader.replace('#include <color_vertex>',
      '#include <color_vertex>\n#ifdef USE_INSTANCING_COLOR\n float mkSlot = step(0.98, color.r) * step(color.g, 0.02) * step(0.98, color.b);\n vColor.rgb = mix(color.rgb, instanceColor.rgb, mkSlot);\n#endif'); };
    m.customProgramCacheKey = () => 'canal-markets';
    return (this.material = m);
  }
  private geometryOf(THREE: any, id: MarketPartId): any {
    let g = this.geometries.get(id);
    if (g) return g;
    const mesh = MARKET_MODELS[id]();
    g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(mesh.colours, 3));
    g.computeVertexNormals(); g.computeBoundingSphere(); g.userData.triangles = mesh.triangles;
    this.geometries.set(id, g);
    return g;
  }
  private build(ids: Set<string>): void {
    const t0 = performance.now(), { THREE } = W().CanalRecallThree;
    this.clear();
    const marketOf = (stall: string) => stall.slice(0, stall.indexOf('/'));
    const groups = groupByPart(this.instances.filter(i => ids.has(marketOf(i.stall))));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), z = new THREE.Vector3(0, 0, 1), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), white = new THREE.Color(1, 1, 1), col = new THREE.Color();
    let instances = 0;
    for (const id of MARKET_PART_IDS) {
      const items = groups.get(id); if (!items?.length) continue;
      const mesh = new THREE.InstancedMesh(this.geometryOf(THREE, id), this.materialOf(THREE), items.length);
      mesh.name = `markets/${id}`;
      items.forEach((v, j) => {
        const p = this.mercator.MercatorCoordinate.fromLngLat([v.lng, v.lat], 0);
        const z0 = this.groundBase ? (this.groundBase([v.lng, v.lat]) ?? 0) + MARKET_BASE_LIFT_M : 0;
        pos.set((p.x - this.origin.x) / this.scale, -(p.y - this.origin.y) / this.scale, z0);
        m4.compose(pos, q.setFromAxisAngle(z, v.yaw), one); mesh.setMatrixAt(j, m4);
        mesh.setColorAt(j, v.colour ? col.set(v.colour) : white);
      });
      mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = !!this.opts.sharedFrame;
      this.scene.add(mesh); this.meshes.push(mesh);
      if (this.opts.sharedFrame) this.culls.push(new InstanceCull(THREE, mesh, { castShadow: false }));
      instances += items.length;
    }
    this.debug.instances = instances; this.debug.stalls = this.meshes.length ? (groups.get('stall-frame')?.length ?? 0) : 0;
    this.debug.markets = [...ids]; this.debug.buildMs = +(performance.now() - t0).toFixed(2);
    this.cameraMap.triggerRepaint?.();
  }
}

if (typeof window !== 'undefined') W().CanalRecallMarketsDebug = () => W().__canalMarkets?.debug ?? null;
