// Depth-aware swap probe (lane E4, #217): what the rider sees change on buildings that are already there.
//
// The older detectors count arrivals (scripts/pop-in.mjs near installs) or diff whole frames against camera motion;
// neither says how big a swap was on screen or how close. This probe logs every swap the streaming layers make (shell
// → detail, detail rebuilds, extras, detail → shell, ground lifts, landmark arrivals and LODs, tree rebuilds) per
// object (building id, model, tree instance), with the object's distance from the rider and its visible on-screen
// area at the moment of the swap:
//
//  - right after the shared frame's main pass, the scene is drawn once more into an offscreen target at `scale` of the
//    CSS size (depth from everything that draws; arriving chunks drawn solid, not dithered);
//  - each swap's geometry is drawn over that depth (LEQUAL, a small polygon offset so it wins against its own pixels)
//    with an id material: the object's index comes from a vertex-id texture (a building's vertex range in a merged
//    chunk), an instance-id texture (tree instances) or one id for the whole draw (a model), encoded in RGB;
//  - the pixels are read back and counted per id: visible area in CSS px² (occluded parts do not count).
//
// The pure parts (encoding, range hashes, the summary table and the gate) are unit-tested (swapProbe.test.ts); the
// browser parts take THREE and the frame injected. scripts/swap-probe.mjs bundles this module into the page, installs
// the hooks (installSwapHooks) on a seeded ride and prints the table.

/** Swap kinds that put geometry where nothing of that layer drew: reported, never gated (not "detail switching"). */
export const ARRIVAL_KINDS: ReadonlySet<string> = new Set(['shell-arrive']);
/** The gate (#217): no swapped object at least this big on screen ... */
export const GATE_MIN_AREA_PX = 400;
/** ... within this distance of the rider. */
export const GATE_NEAR_M = 120;
/** Histogram edges: metres from the rider, and on-screen CSS px². */
export const DISTANCE_EDGES_M = [0, 30, 60, 120, 200, 400, Infinity] as const;
export const AREA_EDGES_PX = [1, 100, 400, 2_000, 10_000, 50_000, Infinity] as const;

export type SwapObject = { id: string; distM: number | null; areaPx: number };
export type SwapRecord = { t: number; kind: string; key: string; objects: SwapObject[] };

/** Object index (1-based, 0 = none) to the RGB the id material writes, and back. */
export function encodePid(pid: number): [number, number, number] { return [pid & 255, (pid >> 8) & 255, (pid >> 16) & 255]; }
export function decodePid(r: number, g: number, b: number): number { return r | (g << 8) | (b << 16); }

/** Count pixels per object index in RGBA bytes (alpha 0 = nothing drawn). */
export function countPids(rgba: Uint8Array, out: Map<number, number> = new Map()): Map<number, number> {
  for (let i = 0; i < rgba.length; i += 4) {
    if (!rgba[i + 3]) continue;
    const pid = decodePid(rgba[i], rgba[i + 1], rgba[i + 2]);
    if (pid) out.set(pid, (out.get(pid) ?? 0) + 1);
  }
  return out;
}

/** The bucket of `value` in ascending `edges` ([e0, e1) ... ); -1 below the first. */
export function bucketOf(value: number, edges: readonly number[]): number {
  for (let i = edges.length - 2; i >= 0; i--) if (value >= edges[i]) return i;
  return -1;
}
export function bucketLabels(edges: readonly number[], unit: string): string[] {
  return edges.slice(0, -1).map((e, i) => Number.isFinite(edges[i + 1]) ? `${e}–${edges[i + 1]} ${unit}` : `≥${e} ${unit}`);
}

/**
 * A hash of one building's vertex range across a chunk's arrays (positions to the centimetre, every other attribute
 * exact), so a rebuilt chunk names the buildings that changed and not the ones rebuilt identically.
 */
export function rangeHash(arrays: readonly (ArrayLike<number> | null | undefined)[], itemSizes: readonly number[], start: number, count: number, positionIndex = 0): number {
  let h = 0x811c9dc5 ^ count;
  for (let a = 0; a < arrays.length; a++) {
    const array = arrays[a];
    if (!array) continue;
    const size = itemSizes[a], from = start * size, to = (start + count) * size, cm = a === positionIndex;
    for (let i = from; i < to && i < array.length; i++) {
      const v = cm ? Math.round(array[i] * 100) : Math.round(array[i] * 1000);
      h = Math.imul(h ^ (v & 0xffff), 0x01000193) >>> 0;
      h = Math.imul(h ^ ((v >>> 16) & 0xffff), 0x01000193) >>> 0;
    }
  }
  return h >>> 0;
}

/** Ids whose hash changed, appeared or (with `removed`) left between two hash maps. */
export function changedIds(before: ReadonlyMap<string, number> | undefined, after: ReadonlyMap<string, number>, removed = false): string[] {
  const out: string[] = [];
  for (const [id, h] of after) if (before?.get(id) !== h) out.push(id);
  if (removed && before) for (const id of before.keys()) if (!after.has(id)) out.push(id);
  return out;
}

/** Metres from `at` (lng, lat) to the nearest point of a lng/lat box [w, s, e, n]. */
export function boxDistanceM(box: readonly [number, number, number, number], at: readonly [number, number]): number {
  const k = 111_320 * Math.cos(at[1] * Math.PI / 180);
  const dx = Math.max(box[0] - at[0], 0, at[0] - box[2]) * k, dy = Math.max(box[1] - at[1], 0, at[1] - box[3]) * 110_540;
  return Math.hypot(dx, dy);
}

/** The lng/lat box of a GeoJSON-ish geometry's coordinates, or null. */
export function lngLatBox(geometry: { coordinates?: unknown } | null | undefined): [number, number, number, number] | null {
  const b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  const walk = (c: unknown): void => {
    if (!Array.isArray(c)) return;
    if (typeof c[0] === 'number') { const x = c[0], y = c[1] as number; if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y; return; }
    for (const q of c) walk(q);
  };
  walk(geometry?.coordinates);
  return b[0] <= b[2] ? b : null;
}

export type KindRow = { events: number; objects: number; onScreen: number; gate: number; areaPx: number; nearestM: number | null; maxAreaPx: number };
export type SwapSummary = {
  gate: { minAreaPx: number; nearM: number; failures: number };
  byKind: Record<string, KindRow>;
  /** Objects on screen (area > 0), per distance bucket, per kind. */
  distance: { labels: string[]; byKind: Record<string, number[]> };
  /** Objects on screen per area bucket, all distances and within the gate distance. */
  area: { labels: string[]; all: number[]; near: number[] };
  top: (SwapObject & { t: number; kind: string; key: string })[];
};

/** The table #217 asks for: swaps by kind, distance and area histograms, the largest objects, and the gate count. */
export function summariseSwaps(records: readonly SwapRecord[], options: { minAreaPx?: number; nearM?: number; top?: number } = {}): SwapSummary {
  const minAreaPx = options.minAreaPx ?? GATE_MIN_AREA_PX, nearM = options.nearM ?? GATE_NEAR_M;
  const byKind: Record<string, KindRow> = {}, distance: Record<string, number[]> = {};
  const areaAll = new Array(AREA_EDGES_PX.length - 1).fill(0), areaNear = new Array(AREA_EDGES_PX.length - 1).fill(0);
  const top: SwapSummary['top'] = [];
  let failures = 0;
  for (const r of records) {
    const row = byKind[r.kind] ??= { events: 0, objects: 0, onScreen: 0, gate: 0, areaPx: 0, nearestM: null, maxAreaPx: 0 };
    const dist = distance[r.kind] ??= new Array(DISTANCE_EDGES_M.length - 1).fill(0);
    row.events++;
    for (const o of r.objects) {
      row.objects++;
      if (!(o.areaPx > 0)) continue;
      row.onScreen++;
      row.areaPx += o.areaPx;
      row.maxAreaPx = Math.max(row.maxAreaPx, o.areaPx);
      if (o.distM != null && (row.nearestM == null || o.distM < row.nearestM)) row.nearestM = o.distM;
      const db = o.distM == null ? -1 : bucketOf(o.distM, DISTANCE_EDGES_M);
      if (db >= 0) dist[db]++;
      const ab = bucketOf(o.areaPx, AREA_EDGES_PX);
      if (ab >= 0) { areaAll[ab]++; if (o.distM != null && o.distM <= nearM) areaNear[ab]++; }
      if (!ARRIVAL_KINDS.has(r.kind) && o.areaPx >= minAreaPx && o.distM != null && o.distM <= nearM) { row.gate++; failures++; }
      top.push({ ...o, t: r.t, kind: r.kind, key: r.key });
    }
  }
  for (const row of Object.values(byKind)) { row.areaPx = Math.round(row.areaPx); row.maxAreaPx = Math.round(row.maxAreaPx); if (row.nearestM != null) row.nearestM = Math.round(row.nearestM); }
  top.sort((a, b) => b.areaPx - a.areaPx);
  return {
    gate: { minAreaPx, nearM, failures },
    byKind: Object.fromEntries(Object.entries(byKind).sort((a, b) => b[1].areaPx - a[1].areaPx)),
    distance: { labels: bucketLabels(DISTANCE_EDGES_M, 'm'), byKind: distance },
    area: { labels: bucketLabels(AREA_EDGES_PX, 'px²'), all: areaAll, near: areaNear },
    top: top.slice(0, options.top ?? 10),
  };
}

/** The summary as Markdown tables (the #217 comment). */
export function swapSummaryMarkdown(s: SwapSummary, title: string): string {
  const lines = [`#### ${title}`, '', `Gate: swapped objects ≥ ${s.gate.minAreaPx} px² within ${s.gate.nearM} m: **${s.gate.failures}**`, '',
    '| kind | events | objects | on screen | gate fails | Σ area px² | max px² | nearest m |', '|---|--:|--:|--:|--:|--:|--:|--:|'];
  for (const [k, r] of Object.entries(s.byKind)) lines.push(`| ${k} | ${r.events} | ${r.objects} | ${r.onScreen} | ${r.gate} | ${r.areaPx} | ${r.maxAreaPx} | ${r.nearestM ?? '–'} |`);
  lines.push('', `| on-screen objects by distance | ${s.distance.labels.join(' | ')} |`, `|---|${s.distance.labels.map(() => '--:').join('|')}|`);
  for (const [k, row] of Object.entries(s.distance.byKind)) lines.push(`| ${k} | ${row.join(' | ')} |`);
  lines.push('', `| on-screen objects by area | ${s.area.labels.join(' | ')} |`, `|---|${s.area.labels.map(() => '--:').join('|')}|`,
    `| all distances | ${s.area.all.join(' | ')} |`, `| within ${s.gate.nearM} m | ${s.area.near.join(' | ')} |`);
  lines.push('', '| # | t s | kind | key | object | m | px² |', '|--:|--:|---|---|---|--:|--:|');
  s.top.forEach((o, i) => lines.push(`| ${i + 1} | ${(o.t / 1000).toFixed(1)} | ${o.kind} | ${o.key} | ${o.id} | ${o.distM == null ? '–' : Math.round(o.distM)} | ${Math.round(o.areaPx)} |`));
  return lines.join('\n');
}

// ----------------------------------------------------------------------------------------------- browser: the probe

/** One draw of a swap: a geometry at a world matrix, with its object ids by vertex, by instance or whole. */
export type ProbeDraw = {
  geometry: any;
  /** World matrix at measure time (the frame's world is eye-relative: read it then, not at the swap). */
  matrix: () => any;
  pids: { by: 'vertex'; data: Float32Array } | { by: 'instance'; data: Float32Array; matrices: Float32Array; count: number } | { by: 'whole'; pid: number };
};
export type ProbeEvent = { t: number; kind: string; key: string; objects: { id: string; distM: number | null }[]; draws: ProbeDraw[]; done?: () => void };
export type ProbeFrame = { THREE: any; scene: any; camera: any; renderer: any };

const PID_W = 2048;

/** A vertex-id texture: `pid` for each vertex in `ranges`, 0 elsewhere (vertexCount long). */
export function vertexPids(vertexCount: number, ranges: readonly { start: number; count: number; pid: number }[]): Float32Array {
  const data = new Float32Array(vertexCount);
  for (const r of ranges) data.fill(r.pid, r.start, Math.min(vertexCount, r.start + r.count));
  return data;
}

export class SwapProbe {
  readonly records: SwapRecord[] = [];
  private queue: ProbeEvent[] = [];
  private target: any = null;
  private buffer: Uint8Array | null = null;
  private readonly materials = new Map<string, any>();
  /** Called around the depth pass: return a function that undoes what it changed (arriving chunks drawn solid). */
  beforeDepth: (() => () => void) | null = null;
  measureMs = 0;
  measured = 0;
  on = true;
  readonly t0 = performance.now();

  constructor(private readonly frame: ProbeFrame, private readonly scale = 0.5) {}

  push(event: ProbeEvent): void { if (this.on && event.objects.length && event.draws.length) this.queue.push(event); else event.done?.(); }
  get pending(): number { return this.queue.length; }

  /** Measure every queued swap against the frame just drawn. Call right after the shared frame's main pass. */
  afterMain(): void {
    if (!this.queue.length) return;
    const t = performance.now();
    const { THREE, scene, camera, renderer } = this.frame;
    const events = this.queue.splice(0);
    const canvas = renderer.domElement as HTMLCanvasElement;
    const w = Math.max(1, Math.round((canvas.clientWidth || canvas.width) * this.scale)), h = Math.max(1, Math.round((canvas.clientHeight || canvas.height) * this.scale));
    if (!this.target || this.target.width !== w || this.target.height !== h) {
      this.target?.dispose();
      this.target = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true, stencilBuffer: false });
      this.buffer = new Uint8Array(w * h * 4);
    }
    const previousTarget = renderer.getRenderTarget(), autoClear = renderer.autoClear, shadowAuto = renderer.shadowMap.autoUpdate, shadowNeeds = renderer.shadowMap.needsUpdate;
    const clearColour = new THREE.Color(); renderer.getClearColor(clearColour); const clearAlpha = renderer.getClearAlpha();
    const background = scene.background;
    renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = false;
    renderer.autoClear = false;
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(this.target);
    try {
      renderer.clear(true, true, true);
      scene.background = null;
      const undo = this.beforeDepth?.();
      try { renderer.render(scene, camera); } finally { undo?.(); scene.background = background; }
      for (const event of events) {
        try { this.records.push(this.measure(event, w, h)); }
        catch (error) { console.warn('[swap-probe] measure failed', event.kind, event.key, error); }
        finally { event.done?.(); }
      }
    } finally {
      renderer.setRenderTarget(previousTarget);
      renderer.setClearColor(clearColour, clearAlpha);
      renderer.autoClear = autoClear;
      renderer.shadowMap.autoUpdate = shadowAuto; renderer.shadowMap.needsUpdate = shadowNeeds;
      renderer.resetState?.();
    }
    this.measured += events.length;
    this.measureMs += performance.now() - t;
  }

  private measure(event: ProbeEvent, w: number, h: number): SwapRecord {
    const { THREE, camera, renderer } = this.frame;
    renderer.clear(true, false, false);
    const probeScene = new THREE.Scene();
    probeScene.matrixWorldAutoUpdate = false;
    const disposables: any[] = [];
    for (const draw of event.draws) {
      const mode = draw.pids.by === 'vertex' ? 1 : draw.pids.by === 'instance' ? 2 : 0;
      const material = this.material(mode).clone();
      material.onBeforeCompile = this.material(mode).onBeforeCompile;
      material.customProgramCacheKey = this.material(mode).customProgramCacheKey;
      const uniforms = { pidTex: { value: null as any }, pidW: { value: PID_W }, wholePid: { value: 0 } };
      material.userData.uniforms = uniforms;
      let mesh: any;
      if (draw.pids.by === 'whole') { uniforms.wholePid.value = draw.pids.pid; mesh = new THREE.Mesh(draw.geometry, material); }
      else {
        const data = draw.pids.data, rows = Math.max(1, Math.ceil(data.length / PID_W)), padded = new Float32Array(rows * PID_W);
        padded.set(data);
        const texture = new THREE.DataTexture(padded, PID_W, rows, THREE.RedFormat, THREE.FloatType);
        texture.minFilter = texture.magFilter = THREE.NearestFilter;
        texture.needsUpdate = true;
        uniforms.pidTex.value = texture;
        disposables.push(texture);
        if (draw.pids.by === 'instance') {
          mesh = new THREE.InstancedMesh(draw.geometry, material, draw.pids.count);
          mesh.instanceMatrix.array.set(draw.pids.matrices.subarray(0, draw.pids.count * 16));
          mesh.instanceMatrix.needsUpdate = true;
          disposables.push({ dispose: () => mesh.dispose?.() });
        } else mesh = new THREE.Mesh(draw.geometry, material);
      }
      const range = draw.geometry.drawRange;
      if (range) { range.start = 0; range.count = Infinity; }
      mesh.name = 'swap-probe';
      mesh.matrixAutoUpdate = false;
      mesh.matrixWorldAutoUpdate = false;
      mesh.matrixWorld.copy(draw.matrix());
      mesh.frustumCulled = false;
      probeScene.add(mesh);
      disposables.push(material);
    }
    renderer.render(probeScene, camera);
    const buffer = this.buffer!;
    renderer.readRenderTargetPixels(this.target, 0, 0, w, h, buffer);
    for (const d of disposables) d.dispose?.();
    const counts = countPids(buffer), k = 1 / (this.scale * this.scale);
    return { t: event.t - this.t0, kind: event.kind, key: event.key, objects: event.objects.map((o, i) => ({ id: o.id, distM: o.distM == null ? null : +o.distM.toFixed(1), areaPx: Math.round((counts.get(i + 1) ?? 0) * k) })) };
  }

  /** The id material for a draw mode (0 whole, 1 vertex ids, 2 instance ids); clones share its program. */
  private material(mode: number): any {
    const key = String(mode);
    let m = this.materials.get(key);
    if (m) return m;
    const THREE = this.frame.THREE;
    m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, depthTest: true, depthWrite: false, depthFunc: THREE.LessEqualDepth, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4, toneMapped: false, fog: false });
    m.onBeforeCompile = function (this: any, shader: any) {
      const u = this.userData?.uniforms;
      if (u) Object.assign(shader.uniforms, u);
      shader.vertexShader = `#define PID_MODE ${mode}\nuniform highp sampler2D pidTex;\nuniform int pidW;\nuniform float wholePid;\nflat varying float vPid;\n` + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
#if PID_MODE == 1
  vPid = texelFetch(pidTex, ivec2(gl_VertexID % pidW, gl_VertexID / pidW), 0).r;
#elif PID_MODE == 2
  vPid = texelFetch(pidTex, ivec2(gl_InstanceID % pidW, gl_InstanceID / pidW), 0).r;
#else
  vPid = wholePid;
#endif`);
      shader.fragmentShader = 'flat varying float vPid;\n' + shader.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
  if (vPid < 0.5) discard;
  gl_FragColor = vec4(mod(vPid, 256.0) / 255.0, mod(floor(vPid / 256.0), 256.0) / 255.0, floor(vPid / 65536.0) / 255.0, 1.0);`);
    };
    m.customProgramCacheKey = () => `swap-probe-${mode}`;
    this.materials.set(key, m);
    return m;
  }
}

// ------------------------------------------------------------------------------------- browser: hooks on the layers

/**
 * Hook the own engine's streaming layers (vectorMap = `canalRecallGame.vectorMap` under `?engine=own`) so every swap
 * lands in `probe`. `rider()` is the rider's lng/lat. Returns what was hooked.
 */
export function installSwapHooks(vm: any, probe: SwapProbe, rider: () => [number, number] | null): Record<string, boolean> {
  const tb = vm._threeBuildings, sl = vm._signatureLandmarks, trees = vm._inventoryTrees, sf = vm._sharedFrame;
  const hooked: Record<string, boolean> = {};
  const now = () => performance.now();
  const wrap = (obj: any, name: string, pre: ((ctx: any, ...a: any[]) => void) | null, post: (ctx: any, ...a: any[]) => void): boolean => {
    if (!obj || typeof obj[name] !== 'function') return false;
    const original = obj[name];
    obj[name] = function (this: any, ...a: any[]) {
      const ctx: any = {};
      try { pre?.call(this, ctx, ...a); } catch (error) { console.warn('[swap-probe] pre', name, error); }
      const r = original.apply(this, a);
      try { post.call(this, ctx, ...a); } catch (error) { console.warn('[swap-probe] post', name, error); }
      return r;
    };
    return true;
  };

  // The probe runs right after the main pass, while the main participants are drawn and their matrices current.
  hooked.frame = wrap(sf, 'renderPass', null, function (_ctx: any, pass: string) { if (pass === 'main') probe.afterMain(); });
  // Arriving chunks dissolve in (screen-door): the depth pass draws them solid so the swap's own pixels count.
  probe.beforeDepth = () => {
    const fading: Map<string, { mesh: any; source: any; clone: any }> | undefined = tb?.fading;
    if (!fading?.size) return () => {};
    const back: [any, any][] = [];
    for (const f of fading.values()) if (f.mesh.material === f.clone) { f.mesh.material = f.source; back.push([f.mesh, f.clone]); }
    return () => { for (const [mesh, clone] of back) mesh.material = clone; };
  };

  // --- buildings (threeBuildingsBrowser.ts): per building id, from the chunk's vertex ranges.
  const hashes = new WeakMap<any, Map<string, number>>();
  const lastHashes = new Map<string, Map<string, number>>();
  const distOf = (feature: any): number | null => { const at = rider(), box = lngLatBox(feature?.geometry); return at && box ? boxDistanceM(box, at) : null; };
  const featuresById = (source: any[]): Map<string, any> => { const m = new Map<string, any>(); for (const f of source ?? []) { const id = String(f?.properties?.id ?? f?.id ?? ''); if (id) m.set(id, f); } return m; };
  /** Draws of a building mesh for these ids: the owner geometry, or its culled tiles (phone: the owner's index is freed). */
  const buildingDraws = (mesh: any, ranges: Map<string, { start: number; count: number }>, ids: readonly string[], parent?: any): ProbeDraw[] => {
    const vertexCount = mesh.geometry.getAttribute('position').count;
    const data = vertexPids(vertexCount, ids.map((id, i) => ({ ...(ranges.get(id) ?? { start: 0, count: 0 }), pid: i + 1 })));
    const matrix = () => parent ? new mesh.matrixWorld.constructor().multiplyMatrices(parent.matrixWorld, mesh.matrix) : mesh.matrixWorld;
    const tiles: any[] = mesh.userData?.tiles ?? [];
    if (tiles.length) return tiles.map(t => ({ geometry: t.geometry, matrix, pids: { by: 'vertex' as const, data } }));
    return [{ geometry: mesh.geometry, matrix, pids: { by: 'vertex', data } }];
  };
  const kindOf = (key: string, arriving: boolean): string => key.startsWith('coarse:') ? (arriving ? 'shell-arrive' : 'shell-rebuild')
    : key.startsWith('extras:') ? (arriving ? 'extras-arrive' : 'extras-rebuild')
    : key.startsWith('near:') ? (arriving ? 'shell→detail' : 'detail-rebuild')
    : key.startsWith('boats:') ? (arriving ? 'boats-arrive' : 'boats-rebuild') : (arriving ? 'kits-arrive' : 'kits-rebuild');
  hooked.buildingsInstall = wrap(tb, 'install', function (this: any, ctx: any, key: string) { ctx.before = this.chunks.get(key)?.mesh ?? null; }, function (this: any, ctx: any, key: string, source: any[], chunk: any) {
    const entry = this.chunks.get(key), mesh = entry?.mesh;
    if (!mesh || mesh === ctx.before) return;
    const arrays = [chunk.positions, chunk.uvs, chunk.layers, chunk.tints, chunk.accents], sizes = [3, 2, 1, 4, 4];
    const next = new Map<string, number>();
    for (const r of chunk.ranges ?? []) next.set(String(r.id), rangeHash(arrays, sizes, r.start, r.count));
    const before = lastHashes.get(key);
    hashes.set(mesh, next); lastHashes.set(key, next);
    const arriving = !ctx.before;
    const ids = arriving ? [...next.keys()] : changedIds(before, next);
    if (!ids.length) return;
    const byId = featuresById(source);
    probe.push({ t: now(), kind: kindOf(key, arriving), key, objects: ids.map(id => ({ id, distM: distOf(byId.get(id)) })), draws: buildingDraws(mesh, entry.ranges, ids) });
  });
  // A chunk leaving (a detail tile the block left, extras with it): what disappears is measured before it goes; its
  // geometry is kept until then. The coarse shells it covered show again in the same step (detail → shell).
  hooked.buildingsDrop = wrap(tb, 'dropChunk', function (this: any, ctx: any, key: string) {
    const held = this.chunks.get(key);
    if (!held?.mesh || !(key.startsWith('near:') || key.startsWith('extras:'))) return;
    // A rebuild drops then installs the same key: that is logged by install, not here.
    if (ctx.rebuild = this.__swapProbeInstalling === key) return;
    const mesh = held.mesh, ids = [...held.ranges.keys()] as string[], byId = featuresById(held.source), parent = mesh.parent;
    const disposals: any[] = [mesh.geometry, ...((mesh.userData?.tiles ?? []).map((t: any) => t.geometry))];
    const deferred = disposals.map(g => { const d = g.dispose; g.dispose = () => {}; return () => { g.dispose = d; d.call(g); }; });
    const event: ProbeEvent = { t: now(), kind: key.startsWith('near:') ? 'detail→shell' : 'extras-leave', key, objects: ids.map(id => ({ id, distM: distOf(byId.get(id)) })), draws: buildingDraws(mesh, held.ranges, ids, parent), done: () => { for (const d of deferred) d(); } };
    ctx.event = event;
    lastHashes.delete(key);
  }, function (_ctx: any) { if (_ctx.event) probe.push(_ctx.event); });
  // install() drops the old mesh of a rebuilt key first: mark it so dropChunk does not log a leave.
  const install = tb?.install;
  if (install) tb.install = function (this: any, key: string, ...rest: any[]) { this.__swapProbeInstalling = key; try { return install.call(this, key, ...rest); } finally { this.__swapProbeInstalling = null; } };
  // Ground lift: buildings that move up or down after they drew (their relief arrived later).
  hooked.groundLift = wrap(tb, 'refreshGroundBases', function (this: any, ctx: any) {
    ctx.before = new Map<string, Map<string, number>>();
    for (const [key, e] of this.chunks) if (e.lift?.pending?.size) ctx.before.set(key, new Map(e.lift.applied));
  }, function (this: any, ctx: any) {
    for (const [key, applied] of ctx.before as Map<string, Map<string, number>>) {
      const e = this.chunks.get(key);
      if (!e?.mesh || !e.lift) continue;
      const moved = [...e.lift.applied].filter(([id, z]) => Math.abs(z - (applied.get(id) ?? 0)) > 0.05).map(([id]) => String(id));
      if (!moved.length) continue;
      const byId = featuresById(e.source);
      probe.push({ t: now(), kind: 'ground-lift', key, objects: moved.map(id => ({ id, distM: distOf(byId.get(id)) })), draws: buildingDraws(e.mesh, e.ranges, moved) });
    }
  });

  // --- landmark and street-chunk models (signature-landmarks-source.js): one object per model.
  const anchorDist = (spec: any): number | null => { const a = spec?.surveyed?.anchor || spec?.footprint?.centre, at = rider(); return a && at ? boxDistanceM([a[0], a[1], a[0], a[1]], at) : null; };
  const modelDraws = (root: any): ProbeDraw[] => {
    const out: ProbeDraw[] = [];
    root?.traverse?.((o: any) => { if ((o.isMesh || o.isInstancedMesh) && o.geometry && !o.isSkinnedMesh) out.push({ geometry: o.geometry, matrix: () => o.matrixWorld, pids: { by: 'whole', pid: 1 } }); });
    return out;
  };
  hooked.landmarkArrive = wrap(sl, '_add', null, function (this: any, _ctx: any, spec: any, imported: any, _map: any, _url: any, level: any) {
    const street = spec?.buildingCategory === 'street-survey' || spec?.assetKind === 'ordinary-building';
    probe.push({ t: now(), kind: street ? 'model-arrive' : 'landmark-arrive', key: `${spec?.id}:${level ?? 'full'}`, objects: [{ id: String(spec?.id), distM: anchorDist(spec) }], draws: modelDraws(imported) });
  });
  hooked.landmarkLod = wrap(sl, '_swapLevel', null, function (_ctx: any, entry: any, incoming: any, level: any) {
    probe.push({ t: now(), kind: 'landmark-lod', key: `${entry?.spec?.id}:${level}`, objects: [{ id: String(entry?.spec?.id), distM: anchorDist(entry?.spec) }], draws: modelDraws(incoming) });
  });

  // --- trees (inventory-trees-source.js): instances that are new or moved after a rebuild, per instance.
  const instanceKeys = (m: any, matrices: Float32Array, n: number): string[] => { const out: string[] = []; const g = m.geometry?.uuid ?? ''; for (let j = 0; j < n; j++) out.push(`${g}|${matrices[j * 16 + 12].toFixed(1)}|${matrices[j * 16 + 13].toFixed(1)}|${matrices[j * 16 + 14].toFixed(1)}|${matrices[j * 16].toFixed(2)}`); return out; };
  const matricesOf = (layer: any, m: any): Float32Array => { const cull = (layer.culls ?? []).find((c: any) => c.mesh === m); return (cull?.matrices as Float32Array | undefined) ?? m.instanceMatrix.array; };
  hooked.trees = wrap(trees, 'rebuild', function (this: any, ctx: any) {
    ctx.before = new Set<string>();
    for (const m of this.meshes ?? []) { const all = matricesOf(this, m); for (const k of instanceKeys(m, all, all.length / 16 | 0)) ctx.before.add(k); }
  }, function (this: any, ctx: any) {
    const at = rider();
    // Rider in the trees' local frame (metres east, north from the layer origin).
    let rx: number | null = null, ry: number | null = null;
    if (at && this.maplibregl?.MercatorCoordinate && this.origin && this.scale) { const p = this.maplibregl.MercatorCoordinate.fromLngLat(at, 0); rx = (p.x - this.origin.x) / this.scale; ry = -(p.y - this.origin.y) / this.scale; }
    const objects: { id: string; distM: number | null }[] = [], draws: ProbeDraw[] = [];
    for (const m of this.meshes ?? []) {
      const all = matricesOf(this, m), n = all.length / 16 | 0;
      const keys = instanceKeys(m, all, n), fresh: number[] = [];
      keys.forEach((k, j) => { if (!ctx.before.has(k)) fresh.push(j); });
      if (!fresh.length) continue;
      const matrices = new Float32Array(fresh.length * 16), data = new Float32Array(fresh.length);
      fresh.forEach((j, i) => { matrices.set(all.subarray(j * 16, j * 16 + 16), i * 16); data[i] = objects.length + i + 1; });
      for (const j of fresh) objects.push({ id: `tree@${all[j * 16 + 12].toFixed(0)},${all[j * 16 + 13].toFixed(0)}`, distM: rx == null ? null : Math.hypot(all[j * 16 + 12] - rx, all[j * 16 + 13] - (ry as number)) });
      draws.push({ geometry: m.geometry, matrix: () => m.matrixWorld, pids: { by: 'instance', data, matrices, count: fresh.length } });
    }
    if (objects.length) probe.push({ t: now(), kind: 'trees', key: `trees:${this.meshes?.length ?? 0}`, objects, draws });
  });
  return hooked;
}
