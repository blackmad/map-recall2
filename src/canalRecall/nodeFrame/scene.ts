/**
 * One world frame in Node (lane node-world-frames): the scene the own engine draws for a camera, assembled from the
 * game's own data and builders, rasterised by worldRaster.ts. Layers, nearest tier first:
 *
 *   detail   world-v1 cells' buildings in the detail block (detailRing.ts, z16, 4 tiles led 110 m along the view),
 *            meshed by buildFeatureChunk ('walls' + 'extras', the street segments and appearance profiles), lifted onto
 *            the own ground (frontBase, wall feet draped);
 *   shells   world-v1/shells cells within SHELL_RADIUS_M (bakedCellArrays, exact), the detail block's buildings hidden;
 *   ground   the own ground (ground.ts);
 *   models   every installed GLB within MODEL_RADIUS_M (models.ts); their HIDE ids hidden in the detail tier;
 *   sky      the clear colour (look/sunny.ts SKY.zenith); fog: the depth fade and draw limit (fog.ts).
 * The sun's shadow map covers the box the game fits about the view centre (shadow.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import type { CameraFrame } from '../ownMap/mapCamera.ts';
import { loadAtlas } from './atlas.ts';
import { chunkMaterial, type ChunkLook } from './chunkMaterial.ts';
import { riderPose as surfaceRiderPose } from '../ownGround/surface.ts';
import { geoFrame, chunkToWorld, transformPositions, worldOfLngLat, type GeoFrame } from './frame.ts';
import { fogFor, type FogSetup } from './fog.ts';
import { groundDraws, groundLook, loadGround } from './ground.ts';
import { sceneLight } from './light.ts';
import { furnitureDraws, furnitureInstances, furnitureOn } from './furniture.ts';
import { gameModels, glbBounds, loadGlbFile, LOD1_M, modelDraws, modelFile, modelMatrix, type ModelSpec } from './models.ts';
import { shadowMap } from './shadow.ts';
import type { SurfaceEnv } from './surfaceMaterial.ts';
import { rasteriseWorld, type WorldDraw, type WorldImage } from './worldRaster.ts';

export const SHELL_RADIUS_M = 1500;
export const MODEL_RADIUS_M = 900;
export const DETAIL_RADIUS_M = 700;

/** Process-wide caches for batches: cell readers per extract, decoded shell cells (oldest dropped past the cap). */
const READERS = new Map<string, unknown>();
const SHELLS = new Map<string, unknown>();
const SHELL_CACHE_CELLS = 48;

export type NodeView = {
  /** The camera's ground point (the frame's origin). */
  lngLat: [number, number];
  /** mapCamera.ts CameraFrame in metres about lngLat (eye, axes, focal in CSS px). */
  frame: CameraFrame;
  /** CSS px and device pixel ratio. */
  width: number; height: number; dpr: number;
  /** The map's view centre and zoom (shadow box, depth fade). */
  center: [number, number]; zoom: number;
  aerial?: boolean;
  /** Draw only rows [top, top + height) (CSS px) of the width x height frame: house:frames' clipped likeness window
   *  (rule10Frames.ts cutWindow: the tall frame's top `window.height` rows). */
  window?: { top: number; height: number };
  /** URL-style flags (the light rig's `?look=` etc.). */
  search?: string;
};

export type NodeFrameOptions = { root: string; cacheDir: string; log?: (s: string) => void; shadows?: boolean; models?: boolean; ground?: boolean; shells?: boolean; furniture?: boolean };

export type NodeFrameResult = {
  image: WorldImage; timings: Record<string, number>; counts: Record<string, number>;
  /** What is drawn at an output pixel: the draw's name (detail, shell/<cell>, model/<id>, type/<pand>, ground…) or null for sky. */
  probe(x: number, y: number): string | null;
};

const ms = (t: number) => Math.round(performance.now() - t);

function ringOf(geometry: { type: string; coordinates: unknown }): [number, number][] {
  const c = geometry.coordinates as number[][][] | number[][][][];
  return (geometry.type === 'Polygon' ? (c as number[][][])[0] : (c as number[][][][])[0][0]) as [number, number][];
}

/** z16 tile of a lng/lat. */
const tileOf = (lng: number, lat: number, z = 16) => {
  const n = 2 ** z, x = Math.floor((lng + 180) / 360 * n), r = lat * Math.PI / 180;
  return `${x}/${Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n)}`;
};

export async function renderNodeFrame(view: NodeView, opts: NodeFrameOptions): Promise<NodeFrameResult> {
  const T: Record<string, number> = {}, N: Record<string, number> = {};
  const log = opts.log ?? (() => {});
  const { root } = opts;
  const t0 = performance.now(), cpu0 = process.cpuUsage().user + process.cpuUsage().system;
  let t = t0;
  const { atlas } = await loadAtlas(root, opts.cacheDir, 'photo', 256); T.atlas = ms(t);
  const { WorldCellReader } = await import('../world/worldCells.ts');
  const { rawFeature, styledFeature } = await import('../world/cellFormat.ts');
  const { cellOf } = await import('../world/cellGrid.ts');
  const { buildFeatureChunk, ORIGIN } = await import('../threeBuildingFeatures.ts');
  const { litFacadeWallGain } = await import('../look/sunny.ts');
  const { LOOK_VARIANTS } = await import('../look/palette.ts');
  const { cityLitLevel } = await import('../look/cityLook.ts');
  const { facadeTierUniform } = await import('../roofTier.ts');
  const { detailBlock } = await import('../detailRing.ts');
  const { frontBase } = await import('../ownGround/placement.ts');
  const { liftRanges } = await import('../engine/bakedCoarse.ts');
  const { toLocal } = await import('../ownGround/groundStore.ts');
  const { shellOrigin } = await import('../world/shellMesh.ts');

  const gf: GeoFrame = geoFrame(view.lngLat);
  const fr = view.frame, dpr = view.dpr, W = view.width * dpr, H = (view.window?.height ?? view.height) * dpr, focal = fr.focal * dpr;
  const eye = [fr.eye[0], fr.eye[1], fr.eye[2]], fwd2 = (() => { const l = Math.hypot(fr.forward[0], fr.forward[1]); return l > 1e-6 ? [fr.forward[0] / l, fr.forward[1] / l] as [number, number] : null; })();
  const toWorld = chunkToWorld(gf, ORIGIN);
  // Ground-local (ORIGIN metres) ↔ world: the composed affine and its inverse (for the water cut's mask lookups).
  const A = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]].map(([x, y, z]) => { const o = new Float64Array(3); toWorld(x, y, z, o, 0); return o; });
  const ax = [A[1][0] - A[0][0], A[1][1] - A[0][1]], ay = [A[2][0] - A[0][0], A[2][1] - A[0][1]], det = ax[0] * ay[1] - ay[0] * ax[1];
  // lx = (ay1 dx - ay0 dy) / det, ly = (ax0 dy - ax1 dx) / det with dx = wx - A0x, dy = wy - A0y.
  const worldToLocal = [ay[1] / det, -ay[0] / det, (-A[0][0] * ay[1] + A[0][1] * ay[0]) / det, -ax[1] / det, ax[0] / det, (A[0][0] * ax[1] - A[0][1] * ax[0]) / det];
  const [cxl, cyl] = toLocal(view.lngLat[0], view.lngLat[1]);
  const ahead = (wx: number, wy: number, margin: number) => !fwd2 || view.aerial || ((wx - eye[0]) * fwd2[0] + (wy - eye[1]) * fwd2[1]) > -margin;
  // Inside the horizontal view wedge (half-angle from the frame's aspect and focal), widened by `margin` metres.
  const halfTan = (view.width / 2) / fr.focal;
  const inView = (wx: number, wy: number, margin: number) => {
    if (!fwd2 || view.aerial) return true;
    const dx = wx - eye[0], dy = wy - eye[1], along = dx * fwd2[0] + dy * fwd2[1], side = Math.abs(dx * fwd2[1] - dy * fwd2[0]);
    return along > -margin && side < Math.max(0, along) * halfTan + margin;
  };

  // ---- ground ---------------------------------------------------------------------------------------------------
  t = performance.now();
  // A ground cell is wanted when any of a 5 x 5 grid of its points is in the view wedge (40 m margin).
  const seen = (rect: readonly number[]) => {
    const p = new Float64Array(3);
    for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) { toWorld(rect[0] + (rect[2] - rect[0]) * i / 4, rect[1] + (rect[3] - rect[1]) * j / 4, 0, p, 0); if (inView(p[0], p[1], 40)) return true; }
    return false;
  };
  const ground = await loadGround(root, opts.cacheDir, [cxl, cyl], view.aerial ? null : fwd2, { log, seen });
  T.ground = ms(t); N.groundCells = ground.cells.length; N.groundBuilt = ground.ms.built;
  const height = ground.store.surface.ground.bind(ground.store.surface);
  const relief = (x: number, y: number) => (ground.store.hasRelief(x, y) ? height(x, y) : NaN);
  // The game's camera stands on the rider's surface (ownWorldView riderSurfaceM: gameGround.ts riderPose over
  // surface.height, kerbs and decks included, not the bare ground), so the eye rises with the surface under the pose;
  // the aerial camera keeps elevation 0 (detached).
  const riderGround = view.aerial || !fwd2 ? 0 : surfaceRiderPose(ground.store.surface.height.bind(ground.store.surface), cxl, cyl, fwd2, 1.2).z;
  N.riderGroundM = Number.isFinite(riderGround) ? Math.round(riderGround * 100) / 100 : 0;
  if (Number.isFinite(riderGround)) eye[2] += riderGround;
  const baseOf = (ring: [number, number][]): number | null => {
    const local = ring.map(p => toLocal(p[0], p[1]));
    if (!ground.store.reliefCovered(local[0][0], local[0][1])) return null;
    if (!local.every(p => ground.store.hasRelief(p[0], p[1]))) return null;
    return frontBase(local, height).base;
  };

  // ---- world cells ------------------------------------------------------------------------------------------------
  t = performance.now();
  const fetcher = (async (url: string) => { try { return new Response(fs.readFileSync(url)); } catch { return new Response(null, { status: 404 }); } }) as unknown as typeof fetch;
  const extract = path.join(root, 'public/data/extracts/amsterdam');
  // One reader per extract for the process: a batch of frames (node-frame.ts with several poses) reuses its cells.
  let reader = READERS.get(extract) as InstanceType<typeof WorldCellReader> | undefined;
  if (!reader) READERS.set(extract, reader = new WorldCellReader(extract, fetcher, 64));
  const [ci, cj] = cellOf(view.lngLat[0], view.lngLat[1]);
  const span = Math.ceil(SHELL_RADIUS_M / 1000) + 1;
  const near: { key: string; d: number }[] = [];
  const { cellBounds } = await import('../world/cellGrid.ts') as unknown as { cellBounds: (i: number, j: number) => [number, number, number, number] };
  for (let di = -span; di <= span; di++) for (let dj = -span; dj <= span; dj++) {
    const i = ci + di, j = cj + dj, [w, s, e, n] = cellBounds(i, j);
    const corners = [[w, s], [e, s], [w, n], [e, n]].map(([lng, lat]) => worldOfLngLat(gf, lng, lat));
    const cx = Math.max(Math.min(...corners.map(c => c[0])), Math.min(0, Math.max(...corners.map(c => c[0])))), cy = Math.max(Math.min(...corners.map(c => c[1])), Math.min(0, Math.max(...corners.map(c => c[1]))));
    const d = Math.hypot(cx, cy);
    if (d > SHELL_RADIUS_M) continue;
    if (d > 60 && !corners.some(c => ahead(c[0], c[1], 0.2 * Math.hypot(c[0], c[1])))) continue;
    near.push({ key: `${i}_${j}`, d });
  }
  const cells = new Map<string, Awaited<ReturnType<typeof reader.cell>>>();
  for (const c of near) { try { cells.set(c.key, await reader.cell(c.key)); } catch { /* no cell */ } }
  const hidden = new Set<string>();
  for (const c of cells.values()) for (const h of c.hide) hidden.add(h.id);
  // Building-type instances in view: their pands go from the detail tier and the shells (suppressOsmIds).
  const { typeInstanceMatrices } = await import('./models.ts');
  const typeFile = path.join(root, 'public/canal-drive/building-types/instances.json');
  const pointBase = (a: [number, number]) => {
    const [lx, ly] = toLocal(a[0], a[1]);
    if (!ground.store.reliefCovered(lx, ly)) return 0;
    let b = Infinity;
    for (const ox of [-3, 0, 3]) for (const oy of [-3, 0, 3]) { const h = relief(lx + ox, ly + oy); if (Number.isFinite(h)) b = Math.min(b, h); }
    return Number.isFinite(b) ? b : 0;
  };
  const types = opts.models !== false && fs.existsSync(typeFile) ? typeInstanceMatrices(gf, JSON.parse(fs.readFileSync(typeFile, 'utf8')), pointBase, (wx, wy) => Math.hypot(wx - eye[0], wy - eye[1]) < (view.aerial ? 1500 : 700) && inView(wx, wy, 40)) : [];
  for (const ti of types) for (const h of ti.hides) hidden.add(h);
  // Installed models suppress their pands at load (the landmark layer's setHidden), not only through the cells' HIDE
  // table: a model installed after the world compile (universiteitstheater at Nieuwe Doelenstraat) is in no HIDE yet.
  const models = opts.models !== false ? await gameModels(root, view.lngLat, MODEL_RADIUS_M) : { specs: [] as ModelSpec[], held: [] as string[] };
  for (const spec of models.specs as ModelSpec[]) {
    const anchor = (spec.surveyed?.anchor ?? (spec as any).instance?.anchor ?? spec.footprint?.centre) as [number, number] | undefined;
    if (!anchor || !spec.suppressOsmIds?.length) continue;
    const [wx, wy] = worldOfLngLat(gf, anchor[0], anchor[1]);
    if (Math.hypot(wx - eye[0], wy - eye[1]) > (view.aerial ? 2000 : MODEL_RADIUS_M)) continue;
    for (const id of spec.suppressOsmIds) hidden.add(String(id));
  }
  T.cells = ms(t); N.cells = cells.size; N.hidden = hidden.size; N.typeInstances = types.length;

  // ---- detail block -----------------------------------------------------------------------------------------------
  t = performance.now();
  const block = detailBlock(view.lngLat, fwd2, 16, null);
  const keys = new Set(block.keys);
  const detail: any[] = [], detailIds = new Set<string>(), kitParts: any[] = [];
  // Landmark kits and measured fronts (landmarkKits.ts, landmarkFrontData.ts): the browser's KIT_KEY chunk, built from
  // whichever of their parts are resident (threeBuildingsBrowser.ts buildKits); the parts a kit replaces draw nowhere else.
  const { KIT_PART_IDS, KIT_HIDE_IDS } = await import('../landmarkKits.ts');
  const { FRONT_PART_IDS } = await import('../landmarkFrontData.ts');
  const kitHide = new Set(KIT_HIDE_IDS);
  for (const c of cells.values()) for (const b of c.buildings) {
    if (hidden.has(b.id)) continue;
    if (KIT_PART_IDS.has(b.id) || FRONT_PART_IDS.has(b.id)) {
      const r = ringOf(b.geometry as never);
      if (view.aerial || r.some(p => { const w = worldOfLngLat(gf, p[0], p[1]); return inView(w[0], w[1], 60); })) kitParts.push(styledFeature(b, rawFeature(b)));
    }
    if (kitHide.has(b.id)) continue;
    const ring = ringOf(b.geometry as never);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of ring) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    if (!keys.has(tileOf((x0 + x1) / 2, (y0 + y1) / 2))) continue;
    // Behind the camera (beyond the shadow reach): the shell tier stands in, unseen, and nothing here meshes it.
    if (!view.aerial && !ring.some(p => { const w = worldOfLngLat(gf, p[0], p[1]); return inView(w[0], w[1], 60); })) continue;
    detail.push(styledFeature(b, rawFeature(b))); detailIds.add(b.id);
  }
  const { streets, profiles } = await streetInputs(root, view.lngLat, ORIGIN);
  const chunks = detail.length ? [buildFeatureChunk(detail, 'photo' as never, 'walls', streets, profiles), buildFeatureChunk(detail, 'photo' as never, 'extras', streets, profiles)] : [];
  if (kitParts.length) {
    const { buildSpecialKits } = await import('../buildingSpecialChunks.ts');
    const { BAY_LAYER_COUNT, FATIH_MASONRY_LAYER, bayLayer } = await import('../bayLook.ts');
    // threeBuildingsBrowser.ts kitLayers('photo'): the bay cells, plain canal wall, flat and sloped roof layers after them.
    chunks.push(buildSpecialKits(kitParts, 'photo' as never, { plain: bayLayer('canal', 0, 'plain'), flat: BAY_LAYER_COUNT + 3, slope: BAY_LAYER_COUNT + 1, fatihMasonry: FATIH_MASONRY_LAYER } as never) as never);
  }
  N.kitParts = kitParts.length;
  const byId = new Map([...detail, ...kitParts].map(f => [String(f.properties.id), f]));
  for (const ch of chunks) {
    const ranges = new Map(ch.ranges.filter(r => r.id).map(r => [String(r.id), { start: r.start, count: r.count }]));
    liftRanges(ch.positions, ranges, [...ranges.keys()], new Map(), id => { const f = byId.get(id); return f ? baseOf(ringOf(f.geometry)) : null; }, Infinity, () => 0, 1, relief);
  }
  T.detail = ms(t); N.detail = detail.length;

  // ---- look -------------------------------------------------------------------------------------------------------
  const light = sceneLight(view.search ?? '');
  const fog: FogSetup = fogFor(view);
  const env: SurfaceEnv = { light, eye, focal, fog: fog.full };
  const look: ChunkLook = { atlas, light, wallGain: litFacadeWallGain(LOOK_VARIANTS.photo.litWallGain) * cityLitLevel(), cellTier: facadeTierUniform(dpr), focal, fog: fog.full };
  const draws: WorldDraw[] = [], casters: WorldDraw[] = [];
  /** Detail draws' vertex ranges per building (the probe names the building under a pixel). */
  const idRanges = new Map<WorldDraw, { id: string; start: number; count: number }[]>();
  for (const ch of chunks) {
    const pos = transformPositions(ch.positions, toWorld);
    const d: WorldDraw = { positions: pos, indices: ch.indices, material: chunkMaterial(look, ch, pos), cull: 'back', name: 'detail' };
    draws.push(d); casters.push(d);
    idRanges.set(d, ch.ranges.filter(r => r.id).map(r => ({ id: String(r.id), start: r.start, count: r.count })));
  }

  // ---- shells -----------------------------------------------------------------------------------------------------
  t = performance.now();
  if (opts.shells !== false) {
    for (const c of near) {
      // Decoded shells are kept for the process (a batch of frames near each other decodes each cell once); the
      // positions are copied before the frame moves and lifts them.
      const shellKey = `${extract}|${c.key}`;
      let sh = SHELLS.get(shellKey) as Awaited<ReturnType<typeof reader.shell>> | null | undefined;
      if (sh === undefined) {
        try { sh = await reader.shell(c.key, path.join(extract, 'world-v1'), undefined, true, false); } catch { sh = null; }
        SHELLS.set(shellKey, sh);
        if (SHELLS.size > SHELL_CACHE_CELLS) SHELLS.delete(SHELLS.keys().next().value as string);
      }
      if (!sh) continue;
      const [ox, oy] = shellOrigin(...(c.key.split('_').map(Number) as [number, number]));
      const P = new Float32Array(sh.positions as Float32Array);
      for (let k = 0; k < P.length; k += 3) { P[k] += ox; P[k + 1] += oy; }
      // Buildings outside the view wedge (beyond the shadow reach) are dropped before the lift.
      const drop = new Uint8Array(P.length / 3);
      const tw = new Float64Array(3);
      const ranges = new Map<string, { start: number; count: number }>();
      for (const r of sh.ranges) {
        let seen = false;
        for (let v = r.start; v < r.start + r.count && !seen; v += Math.max(1, r.count >> 3)) { toWorld(P[v * 3], P[v * 3 + 1], 0, tw, 0); seen = inView(tw[0], tw[1], 80); }
        if (!seen || (r.id && (detailIds.has(r.id) || hidden.has(r.id)))) { drop.fill(1, r.start, r.start + r.count); continue; }
        if (r.id) ranges.set(r.id, { start: r.start, count: r.count });
      }
      const cell = cells.get(c.key);
      const ringById = new Map(cell ? cell.buildings.map(b => [b.id, b.geometry]) : []);
      if (c.d <= SHELL_RADIUS_M) liftRanges(P, ranges, [...ranges.keys()], new Map(), id => { const g = ringById.get(id); return g ? baseOf(ringOf(g as never)) : null; }, Infinity, () => 0, 1, relief);
      const I = sh.indices;
      const pos = transformPositions(P, toWorld);
      const arrays = { uvs: sh.uvs, layers: sh.layers, tints: sh.tints, accents: sh.accents, accentSize: sh.accentSize };
      const d: WorldDraw = { positions: pos, indices: I as Uint32Array, material: chunkMaterial(look, arrays, pos), cull: 'back', keep: tri => !drop[I[tri * 3]], name: `shell/${c.key}` };
      draws.push(d); casters.push(d);
      N.shellTris = (N.shellTris ?? 0) + sh.triangles;
    }
  }
  T.shells = ms(t);

  // ---- ground draws -------------------------------------------------------------------------------------------
  t = performance.now();
  if (opts.ground !== false) {
    const gl = await groundLook(view.search ?? '');
    const gd = groundDraws(ground, gl, p => transformPositions(p, toWorld), env, worldToLocal);
    for (const d of gd) { draws.push(d); if (/\/(deckBody|hedge|furniture)$/.test(d.name ?? '')) casters.push(d); }
    N.groundDraws = gd.length;
  }
  T.groundLook = ms(t);

  // ---- street furniture (street-furniture-source.js: lamps, containers, hoops, abris, columns round the rider) ------
  t = performance.now();
  if (opts.furniture !== false && !view.aerial && furnitureOn(view.search ?? '')) {
    // gameGround.ts surfaceBase: the riding surface, never below the relief; 0 off the relief survey.
    const surfaceBase = (lng: number, lat: number): number | undefined => {
      const [x, y] = toLocal(lng, lat);
      if (!ground.store.reliefCovered(x, y)) return 0;
      if (!ground.store.hasRelief(x, y)) return undefined;
      return Math.max(ground.store.surface.ground(x, y), ground.store.surface.height(x, y));
    };
    const fd = furnitureDraws(furnitureInstances(root, view.lngLat), env, view.lngLat,
      (lng, lat) => { const w = worldOfLngLat(gf, lng, lat); return [w[0], w[1]]; }, surfaceBase, (wx, wy) => inView(wx, wy, 10));
    draws.push(...fd.draws);
    N.furniture = fd.count;
  }
  T.furniture = ms(t);

  // ---- models -------------------------------------------------------------------------------------------------
  t = performance.now();
  if (opts.models !== false) {
    const { placementFor } = await import('../landmarks/signaturePlacement.ts');
    const { specs } = models;
    const envL: SurfaceEnv = { ...env, fog: fog.limitOnly };
    let placed = 0;
    for (const spec of specs as ModelSpec[]) {
      const anchor = (spec.surveyed?.anchor ?? (spec as any).instance?.anchor ?? spec.footprint?.centre) as [number, number] | undefined;
      if (!anchor) continue;
      const [wx, wy] = worldOfLngLat(gf, anchor[0], anchor[1]);
      const d = Math.hypot(wx - eye[0], wy - eye[1]);
      if (d > (view.aerial ? 2000 : MODEL_RADIUS_M) || (d > 80 && !ahead(wx, wy, 0.3 * d + 60))) continue;
      let file = modelFile(root, spec.modelUrl);
      const lod1 = file.replace(/\.glb$/, '.lod1.glb');
      if (d > LOD1_M && fs.existsSync(lod1)) file = lod1;
      if (!fs.existsSync(file)) continue;
      let glb;
      try { glb = await loadGlbFile(file); } catch (e) { log(`model ${spec.id}: ${(e as Error).message}`); continue; }
      const b = glbBounds(glb);
      let placement;
      try { placement = placementFor(spec as never, { min: b.min, max: b.max }) as any; } catch (e) { log(`model ${spec.id}: no placement (${(e as Error).message})`); continue; }
      const recentre: [number, number, number] = spec.surveyed ? [0, -b.min[1], 0] : [-(b.min[0] + b.max[0]) / 2, -b.min[1], -(b.min[2] + b.max[2]) / 2];
      // pointBase: the lowest relief within 3 m of the anchor (0 off the relief).
      const base = pointBase(placement.anchor);
      const M = modelMatrix(gf, placement, recentre, base);
      for (const dr of modelDraws(glb, M, envL, `model/${spec.id}`, { atlas, year: typeof (spec as any).bagYear === 'number' ? (spec as any).bagYear : null, exposure: (spec as any).wallExposure ?? null })) { draws.push(dr); if (!dr.blend) casters.push(dr); }
      placed++;
    }
    N.models = placed;
    for (const ti of types) {
      const file = path.join(root, 'public/canal-drive/building-types', `${ti.inst.unit}.glb`);
      if (!fs.existsSync(file)) continue;
      const glb = await loadGlbFile(file);
      for (const dr of modelDraws(glb, ti.M, envL, `type/${ti.inst.pand}`, { atlas })) { draws.push(dr); if (!dr.blend) casters.push(dr); }
    }
  }
  T.models = ms(t);

  // ---- shadow + raster ------------------------------------------------------------------------------------------
  t = performance.now();
  if (opts.shadows !== false && light.shadowIntensity > 0) {
    const [fx, fy] = worldOfLngLat(gf, view.center[0], view.center[1]);
    const sm = shadowMap(casters, light.toSun, [fx, fy, 0], view.zoom);
    look.shadow = sm.lookup; env.shadow = sm.lookup;
    N.shadowTris = sm.triangles;
  }
  T.shadow = ms(t);
  t = performance.now();
  const sky = fog.sky;
  const image = rasteriseWorld(draws, { eye, right: fr.right, up: fr.up, forward: fr.forward, focal, width: W, height: H, cx: W / 2, cy: (view.height / 2 - (view.window?.top ?? 0)) * dpr, glNear: Math.max(0.05, fr.distance / 120) }, { background: (_x, _y, _d, o) => { o[0] = sky[0]; o[1] = sky[1]; o[2] = sky[2]; } });
  T.raster = ms(t); T.total = ms(t0); T.cpu = Math.round((process.cpuUsage().user + process.cpuUsage().system - cpu0) / 1000);
  N.triangles = image.stats.triangles; N.drawn = image.stats.drawn; T.visibility = Math.round(image.stats.visibilityMs); T.resolve = Math.round(image.stats.resolveMs); T.blend = Math.round(image.stats.blendMs);
  const probe = (x: number, y: number) => {
    const id = image.ids[Math.round(y) * image.width + Math.round(x)];
    if (id < 0) return null;
    const [di, tri] = image.locate(id), d = draws[di];
    if (!d) return '?';
    const v = d.indices[tri * 3], hit = idRanges.get(d)?.find(r => v >= r.start && v < r.start + r.count);
    // The triangle's world corners (x, y, z in metres from the frame origin; z above the eye's ground datum).
    const P = d.positions, corner = (k: number) => { const i = d.indices[tri * 3 + k]; return `${P[i * 3].toFixed(2)},${P[i * 3 + 1].toFixed(2)},${P[i * 3 + 2].toFixed(2)}`; };
    return `${hit ? `${d.name}/${hit.id}` : d.name ?? '?'} [${corner(0)} | ${corner(1)} | ${corner(2)}] eye z ${eye[2].toFixed(2)}`;
  };
  return { image, timings: T, counts: N, probe };
}

/** The chunk builder's street inputs: routing ways (roads-v2) and the street appearance catalogue, near the view. */
export async function streetInputs(root: string, at: [number, number], origin: { lng: number; lat: number }): Promise<{ streets: Float32Array; profiles: any[] }> {
  const { loadRoadExtract } = await import('../routing/roadExtract.ts');
  const { streetSegments, FRONT_HIGHWAYS } = await import('../streetFronts.ts');
  const { validateStreetAppearanceCatalog } = await import('../streetAppearance.ts');
  const cache = streetInputs as unknown as { roads?: any };
  cache.roads ??= await loadRoadExtract(new Uint8Array(fs.readFileSync(path.join(root, 'public/data/extracts/amsterdam/roads-v2/streets-routing.bin.gz'))));
  const box = 0.02;
  const ways: { highway?: string; points: [number, number][] }[] = [];
  for (const f of cache.roads.features as any[]) {
    // The routing extract stores [lat, lng] (roadExtract.ts); the street fronts take [lng, lat] like setStreets' nodes.
    const pts = ((f.path ?? f.paths?.[0] ?? []) as [number, number][]).map(([lat, lng]) => [lng, lat] as [number, number]);
    if (!pts.length || !FRONT_HIGHWAYS.has(f.highway)) continue;
    if (!pts.some(p => Math.abs(p[0] - at[0]) < box && Math.abs(p[1] - at[1]) < box * 0.6)) continue;
    ways.push({ highway: f.highway, points: pts });
  }
  const catalog = validateStreetAppearanceCatalog(JSON.parse(fs.readFileSync(path.join(root, 'public/data/street-appearance/profiles.json'), 'utf8')));
  const fronts = catalog.streetFrontPaths?.length ? streetSegments(catalog.streetFrontPaths as never, origin) : new Float32Array();
  const segs = streetSegments(ways, origin);
  const all = new Float32Array(segs.length + fronts.length); all.set(segs); all.set(fronts, segs.length);
  return { streets: all, profiles: JSON.parse(JSON.stringify(catalog.profiles)) };
}
