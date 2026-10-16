import {HIGHLIGHT_RECIPES, attachHighlightPasses, highlightMaterialFor, highlightStyle, withinDesaturation, type HighlightFocus} from '../look/highlight.ts';
import {getCityLook} from '../look/cityLook.ts';
/**
 * Building types at runtime (default on since 2026-10-16; `?buildingTypes=0` turns it off): one shared unit mesh per design, drawn with
 * THREE.InstancedMesh, placed from `public/canal-drive/building-types/instances.json`.
 *
 * Placement follows the landmark loader (`signature-landmarks-source.js` `_add`, surveyed placement): ONE area
 * frame whose origin is the area anchor and whose axes are glTF +X east, +Y up, +Z south (northOffsetDegrees 0).
 * Every instance matrix is `T(east, groundAltitude, south) * Ry(yaw) * S(scale)` in that frame, with east/south the
 * exact Mercator offset of the instance anchor from the area anchor (the same units the loader scales by), and the
 * front of the unit (+z) at compass bearing 180 + northOffsetDegrees. The area group is handed to the landmark source
 * as one spec (`sceneFactory`), so shared-frame/legacy drawing, own-ground, visibility and suppression need no new path.
 *
 * Pure helpers (placement, suppression ids, far massing, near/far partition) are separate from the three.js part,
 * which takes THREE and a unit loader as arguments (the landmark bundle owns the one three copy).
 */

import { BAKED_SHADE_GLSL } from '../rendererShared/lightRig.ts';

export interface RuntimeInstance {
  pand: string;
  unit: string;
  /** [lng, lat] of the unit origin (footprint rectangle centre). */
  anchor: [number, number];
  /** Loader convention: clockwise degrees, 0 = glTF +X east; the unit front (+z) faces bearing 180 + this. */
  northOffsetDegrees: number;
  scale: [number, number, number];
  variant: string;
  /** Lift in the game's frame (0: the basemap ground is flat, as for street chunks). */
  groundAltitudeMetres: number;
  /** Pilot area the instance belongs to (one landmark-source spec per area). */
  area?: string;
  /** Other BAG panden this instance's model covers (a split-off end bay or entrance of the same block): suppressed with it. */
  alsoSuppress?: string[];
}

export interface Nominal { L0: number; W0: number; E0: number; R0?: number }

const EARTH_CIRCUMFERENCE = 2 * Math.PI * 6378137;
/** Mercator 0..1 coordinates, the same as maplibregl.MercatorCoordinate.fromLngLat. */
export function mercator(lng: number, lat: number): [number, number] {
  return [(180 + lng) / 360, (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360];
}
/** Mercator units per metre at a latitude (MercatorCoordinate.meterInMercatorCoordinateUnits). */
export const metreUnits = (lat: number) => 1 / EARTH_CIRCUMFERENCE / Math.cos((lat * Math.PI) / 180);

/** East/south metres of `point` from `origin` in the loader's frame. */
export function offsetMetres(origin: [number, number], point: [number, number]): [number, number] {
  const [x0, y0] = mercator(origin[0], origin[1]), [x, y] = mercator(point[0], point[1]), u = metreUnits(origin[1]);
  return [(x - x0) / u, (y - y0) / u];
}

/** Centre of the instance bounding box: the area anchor. */
export function areaAnchor(instances: readonly RuntimeInstance[]): [number, number] {
  const lng = instances.map(i => i.anchor[0]), lat = instances.map(i => i.anchor[1]);
  return [(Math.min(...lng) + Math.max(...lng)) / 2, (Math.min(...lat) + Math.max(...lat)) / 2];
}

/** Rotation about +y (radians) taking the unit frame (front +z) to the world: front = (sin yaw, cos yaw) in east/south. */
export const yawOf = (northOffsetDegrees: number): number => Math.PI - ((180 + northOffsetDegrees) * Math.PI) / 180;

/** Column-major 4x4 of one instance in the area frame (T * Ry(yaw) * S). */
export function instanceMatrix(inst: RuntimeInstance, origin: [number, number]): number[] {
  const [east, south] = offsetMetres(origin, inst.anchor), yaw = yawOf(inst.northOffsetDegrees), c = Math.cos(yaw), s = Math.sin(yaw), [sx, sy, sz] = inst.scale;
  // Ry = [[c,0,s],[0,1,0],[-s,0,c]]; columns scaled by sx, sy, sz.
  return [c * sx, 0, -s * sx, 0, 0, sy, 0, 0, s * sz, 0, c * sz, 0, east, inst.groundAltitudeMetres, south, 1];
}

/** Instances by area (`area` field; one surveyed spec per area keeps visibility and suppression local). */
export function groupByArea<T extends {area?: string}>(instances: readonly T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const i of instances) out.set(i.area ?? 'default', [...(out.get(i.area ?? 'default') ?? []), i]);
  return out;
}
/** Metres from the area anchor to the farthest instance, plus a margin: the visibility radius of the area spec. */
export function areaRadiusMetres(instances: readonly RuntimeInstance[]): number {
  const origin = areaAnchor(instances);
  return Math.max(50, ...instances.map(i => Math.hypot(...offsetMetres(origin, i.anchor)))) + 30;
}

export const pandOsmId =(pand: string) => `NL.IMBAG.Pand.${pand}`;
/** BAG pand ids the instances replace: the OSM/BAG extrusion of each is suppressed (as street chunks' `suppress`). */
export function suppressionIds(instances: readonly RuntimeInstance[]): string[] {
  return [...new Set(instances.flatMap(i => [i.pand, ...(i.alsoSuppress ?? [])].map(pandOsmId)))].sort();
}

/** Far LOD geometry: wall box plus gable prism (ridge along x) or flat slab; metre UVs like the unit mesh. */
export interface RawMesh { positions: number[]; normals: number[]; uvs: number[]; index: number[] }
export function farMassing(n: Nominal): {walls: RawMesh; roof: RawMesh} {
  const hl = n.L0 / 2, hw = n.W0 / 2, e = n.E0;
  const walls: RawMesh = {positions: [], normals: [], uvs: [], index: []}, roof: RawMesh = {positions: [], normals: [], uvs: [], index: []};
  const quad = (m: RawMesh, a: number[], b: number[], c: number[], d: number[], normal: number[], uv: (p: number[]) => [number, number]) => {
    const base = m.positions.length / 3;
    for (const p of [a, b, c, d]) { m.positions.push(...p); m.normals.push(...normal); m.uvs.push(...uv(p)); }
    m.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const uvXY = (p: number[]): [number, number] => [p[0], p[1]], uvZY = (p: number[]): [number, number] => [p[2], p[1]], uvXZ = (p: number[]): [number, number] => [p[0], p[2]];
  // Walls (outward winding, counter-clockwise seen from outside).
  quad(walls, [-hl, 0, hw], [hl, 0, hw], [hl, e, hw], [-hl, e, hw], [0, 0, 1], uvXY);
  quad(walls, [hl, 0, -hw], [-hl, 0, -hw], [-hl, e, -hw], [hl, e, -hw], [0, 0, -1], uvXY);
  quad(walls, [hl, 0, hw], [hl, 0, -hw], [hl, e, -hw], [hl, e, hw], [1, 0, 0], uvZY);
  quad(walls, [-hl, 0, -hw], [-hl, 0, hw], [-hl, e, hw], [-hl, e, -hw], [-1, 0, 0], uvZY);
  const ridge = n.R0 !== undefined && n.R0 > e + 0.3 ? n.R0 : undefined;
  if (ridge === undefined) quad(roof, [-hl, e, hw], [hl, e, hw], [hl, e, -hw], [-hl, e, -hw], [0, 1, 0], uvXZ);
  else {
    const rise = ridge - e, len = Math.hypot(hw, rise), nz = rise / len, ny = hw / len;
    quad(roof, [-hl, e, hw], [hl, e, hw], [hl, ridge, 0], [-hl, ridge, 0], [0, ny, nz], uvXZ);
    quad(roof, [hl, e, -hw], [-hl, e, -hw], [-hl, ridge, 0], [hl, ridge, 0], [0, ny, -nz], uvXZ);
    const gable = (x: number, nx: number, flip: boolean) => {
      const base = walls.positions.length / 3, pts = flip ? [[x, e, -hw], [x, e, hw], [x, ridge, 0]] : [[x, e, hw], [x, e, -hw], [x, ridge, 0]];
      for (const p of pts) { walls.positions.push(...p); walls.normals.push(nx, 0, 0); walls.uvs.push(...uvZY(p)); }
      walls.index.push(base, base + 1, base + 2);
    };
    gable(hl, 1, false); gable(-hl, -1, true);
  }
  return {walls, roof};
}

export interface Partition { near: number[]; far: number[]; culled: number }
/**
 * Near/far/culled split of instance centres by distance from the camera, with hysteresis so an instance sitting on a
 * threshold does not flip every update. `previous` is the last result (indices into `points`).
 */
/** Near limit for a unit of nominal size: tall or long types (a 15-storey slab) keep their detail further out than a terrace house. */
export function nearMetresFor(n: Nominal | undefined, base = NEAR_METRES): number {
  return n ? Math.max(base, Math.round(3 * Math.max(n.L0, n.E0))) : base;
}
export function partitionByDistance(points: readonly {x: number; z: number}[], at: {x: number; z: number}, nearM: number | readonly number[], cullM: number, previous?: Partition, hysteresisM = 20): Partition {
  const wasNear = new Set(previous?.near), wasFar = new Set(previous?.far);
  const near: number[] = [], far: number[] = [];
  points.forEach((p, i) => {
    const d = Math.hypot(p.x - at.x, p.z - at.z);
    const nearI = typeof nearM === 'number' ? nearM : nearM[i];
    const nearLimit = wasNear.has(i) ? nearI + hysteresisM : nearI - (wasFar.has(i) ? hysteresisM : 0);
    const cullLimit = wasNear.has(i) || wasFar.has(i) ? cullM + hysteresisM : cullM;
    if (d <= nearLimit) near.push(i); else if (d <= cullLimit) far.push(i);
  });
  return {near, far, culled: points.length - near.length - far.length};
}

export const NEAR_METRES = 140;
export const CULL_METRES = 700;

// ---------------------------------------------------------------------------------------------------------------
// Merging a unit's per-material meshes into one draw (pure, so it is unit-tested without three.js)

/** One source mesh of a unit: raw attributes, the matrix baked into them, and the look it carried as a material. */
export interface MergePart {
  positions: ArrayLike<number>;
  normals: ArrayLike<number>;
  uvs: ArrayLike<number>;
  /** Triangle indices; absent = sequential vertices. */
  index?: ArrayLike<number> | null;
  /** Column-major 4x4 applied to positions (and its inverse-transpose to normals) at merge time. */
  matrix: ArrayLike<number>;
  /** Material `uvScale` uniform, baked into the UVs. */
  uvScale: number;
  /** Which sampler (index into the shared texture list) the part's material sampled. */
  texture: number;
  /** Material `tint` uniform. */
  tint: readonly [number, number, number];
}
export interface MergedMesh { positions: Float32Array; normals: Float32Array; uvs: Float32Array; textures: Float32Array; tints: Float32Array; index: Uint32Array }

/** Concatenate parts into one geometry: matrices baked in, UVs scaled, sampler index and tint as per-vertex attributes. */
export function mergeParts(parts: readonly MergePart[]): MergedMesh {
  const verts = parts.reduce((n, p) => n + p.positions.length / 3, 0), idx = parts.reduce((n, p) => n + (p.index ? p.index.length : p.positions.length / 3), 0);
  const out: MergedMesh = {positions: new Float32Array(verts * 3), normals: new Float32Array(verts * 3), uvs: new Float32Array(verts * 2), textures: new Float32Array(verts), tints: new Float32Array(verts * 3), index: new Uint32Array(idx)};
  let v = 0, ii = 0;
  for (const p of parts) {
    const m = p.matrix, n = p.positions.length / 3;
    // Normal matrix = cofactors of the upper 3x3 (inverse-transpose up to a positive scale), then normalised.
    const a = m[0], b = m[4], c = m[8], d = m[1], e = m[5], f = m[9], g = m[2], h = m[6], i = m[10];
    const cof = [e * i - f * h, f * g - d * i, d * h - e * g, c * h - b * i, a * i - c * g, b * g - a * h, b * f - c * e, c * d - a * f, a * e - b * d];
    const flip = a * cof[0] + b * cof[1] + c * cof[2] < 0;
    for (let k = 0; k < n; k++) {
      const x = p.positions[k * 3], y = p.positions[k * 3 + 1], z = p.positions[k * 3 + 2], o = (v + k) * 3;
      out.positions[o] = m[0] * x + m[4] * y + m[8] * z + m[12];
      out.positions[o + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
      out.positions[o + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
      const nx = p.normals[k * 3], ny = p.normals[k * 3 + 1], nz = p.normals[k * 3 + 2];
      const rx = cof[0] * nx + cof[1] * ny + cof[2] * nz, ry = cof[3] * nx + cof[4] * ny + cof[5] * nz, rz = cof[6] * nx + cof[7] * ny + cof[8] * nz;
      const len = (Math.hypot(rx, ry, rz) || 1) * (flip ? -1 : 1);
      out.normals[o] = rx / len; out.normals[o + 1] = ry / len; out.normals[o + 2] = rz / len;
      out.uvs[(v + k) * 2] = p.uvs[k * 2] * p.uvScale; out.uvs[(v + k) * 2 + 1] = p.uvs[k * 2 + 1] * p.uvScale;
      out.textures[v + k] = p.texture;
      out.tints[o] = p.tint[0]; out.tints[o + 1] = p.tint[1]; out.tints[o + 2] = p.tint[2];
    }
    const count = p.index ? p.index.length : n;
    for (let t = 0; t < count; t += 3) {
      const t0 = p.index ? p.index[t] : t, t1 = p.index ? p.index[t + 1] : t + 1, t2 = p.index ? p.index[t + 2] : t + 2;
      out.index[ii++] = v + t0; out.index[ii++] = v + (flip ? t2 : t1); out.index[ii++] = v + (flip ? t1 : t2);
    }
    v += n;
  }
  return out;
}

/**
 * Shader of the merged unit meshes: the recipe look (`recipeLook.ts` VERTEX/FRAGMENT) with the per-material uniforms
 * (`map`, `tint`, `uvScale`) turned into per-vertex attributes, so one draw covers every material of a unit.
 * `samplers` is the number of distinct recipe textures shared by all units.
 */
export function mergedShaders(samplers: number): {vertexShader: string; fragmentShader: string} {
  const n = Math.max(1, samplers);
  const pick = Array.from({length: n}, (_, i) => i === n - 1 ? `c = texture2D(t${i}, vUv).rgb;` : `if (vTex < ${i}.5) c = texture2D(t${i}, vUv).rgb; else`).join('\n  ');
  return {
    vertexShader: `
uniform mat3 enuFromWorld;
attribute float aTex;
attribute vec3 aTint;
varying vec2 vUv;
varying float vShade;
varying float vTex;
varying vec3 vTint;
void main() {
  vUv = uv;
  vTex = aTex;
  vTint = aTint;
  vec3 n = normalize(enuFromWorld * (mat3(modelMatrix * instanceMatrix) * normal));
${BAKED_SHADE_GLSL}
  vShade = shade;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `
${Array.from({length: n}, (_, i) => `uniform sampler2D t${i};`).join('\n')}
varying vec2 vUv;
varying float vShade;
varying float vTex;
varying vec3 vTint;
void main() {
  vec3 c;
  ${pick}
  c *= vTint;
#ifdef HL_DIM_ALL
  c = mix(c, vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), 0.4);
#endif
  gl_FragColor = vec4(c * vShade, 1.0);
}`,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// three.js part

export interface RuntimeDeps {
  THREE: any;
  /** Decoded and recipe-dressed unit scene for a unit name (meshes carry ShaderMaterials with the city look). */
  loadUnit: (unit: string) => Promise<any>;
  /** Current camera centre, to choose near/far/culled. */
  getCentre: () => {lng: number; lat: number} | null | undefined;
  nearMetres?: number;
  cullMetres?: number;
}

export interface BuildingTypesArea {
  /** Area anchor [lng, lat]: the surveyed origin for the landmark source. */
  anchor: [number, number];
  /** Contains every InstancedMesh; hand to the landmark source as the model scene. */
  group: any;
  suppress: string[];
  /** Radius (m) around the anchor that holds every instance. */
  radiusMetres: number;
  update(force?: boolean): void;
  /** Pand id under a raycast hit on one of the area's meshes (instance index -> pand). */
  pandForHit(object: any, instanceId: number | undefined): string | null;
  /**
   * The answer building(s) by BAG pand id (`NL.IMBAG.Pand.…` or bare): highlighted per the page's style
   * (look/highlight.ts), as a one-instance copy while its instance is collapsed; style c also dims the instances
   * within 60 m of `focus`. Returns how many instances are highlighted.
   */
  setHighlighted(ids: Iterable<string | number>, focus?: HighlightFocus | null): number;
  stats(): {instances: number; near: number; far: number; culled: number; units: number; drawCalls: number; nearTriangles: number; farTriangles: number};
  dispose(): void;
}

/**
 * Instanced material for a recipe-look ShaderMaterial: same shared uniforms (textures, tint, the page-wide
 * enuFromWorld), vertex shader taking the per-instance matrix. Other materials (standard) already support instancing.
 */
export function instancedMaterial(THREE: any, material: any, cache: Map<any, any>): any {
  if (!material?.isShaderMaterial) return material;
  let m = cache.get(material);
  if (!m) {
    const vertexShader = String(material.vertexShader)
      .replace('mat3(modelMatrix) * normal', 'mat3(modelMatrix * instanceMatrix) * normal')
      .replace('modelViewMatrix * vec4(position, 1.0)', 'modelViewMatrix * instanceMatrix * vec4(position, 1.0)');
    if (vertexShader === material.vertexShader) throw new Error('recipe look vertex shader changed: instancing patch no longer applies');
    m = new THREE.ShaderMaterial({uniforms: material.uniforms, vertexShader, fragmentShader: material.fragmentShader, side: material.side});
    m.name = `${material.name}/instanced`;
    m.userData = {...material.userData};
    cache.set(material, m);
  }
  return m;
}

const WALL_SLOTS = new Set(['brick', 'stucco', 'stone']), ROOF_SLOTS = new Set(['roofTile', 'slate', 'bitumen']);

export async function createBuildingTypes(deps: RuntimeDeps, instances: readonly RuntimeInstance[]): Promise<BuildingTypesArea> {
  const {THREE} = deps, nearM = deps.nearMetres ?? NEAR_METRES, cullM = deps.cullMetres ?? CULL_METRES;
  if (!instances.length) throw new Error('no building-type instances');
  const origin = areaAnchor(instances), group = new THREE.Group();
  group.name = 'building-types';
  const matrices = instances.map(i => new THREE.Matrix4().fromArray(instanceMatrix(i, origin)));
  const points = matrices.map(m => ({x: m.elements[12], z: m.elements[14]}));
  const radiusMetres = Math.max(50, ...points.map(p => Math.hypot(p.x, p.z))) + 30;
  const materialCache = new Map<any, any>();
  const byUnit = new Map<string, number[]>();
  instances.forEach((inst, i) => byUnit.set(inst.unit, [...(byUnit.get(inst.unit) ?? []), i]));

  interface Layer { mesh: any; indices: number[]; local: any; far: boolean; triangles: number }
  const layers: Layer[] = [];
  const geometries: any[] = [];
  // Pass 1: decode every unit and collect the recipe textures, so the merged shader declares exactly the samplers in use.
  interface Loaded { unit: string; indices: number[]; meshes: any[]; nominal?: Nominal }
  const loaded: Loaded[] = [];
  const nearByPoint: number[] = instances.map(() => nearM);
  const textures: any[] = [];
  const isRecipe = (m: any) => !!(m?.isShaderMaterial && m.uniforms?.map?.value && m.uniforms.tint?.value && m.uniforms.uvScale && m.uniforms.enuFromWorld);
  // `?cityLook=1`: the recipe look dressed the units with the city look (look/cityLook.ts): slot and tint are vertex
  // attributes and every unit shares one material per side, so units merge into one draw the same way.
  const isCity = (m: any) => !!m?.userData?.cityLook;
  const mergeable = (m: any) => isRecipe(m) || isCity(m);
  for (const [unit, indices] of byUnit) {
    const scene = await deps.loadUnit(unit);
    scene.updateMatrixWorld(true);
    let nominal: Nominal | undefined;
    scene.traverse((o: any) => { if (o.userData?.nominal) nominal = o.userData.nominal; });
    const meshes: any[] = [];
    scene.traverse((o: any) => { if (o.isMesh) meshes.push(o); });
    for (const m of meshes) if (isRecipe(m.material) && !textures.includes(m.material.uniforms.map.value)) textures.push(m.material.uniforms.map.value);
    loaded.push({unit, indices, meshes, nominal});
    if (deps.nearMetres === undefined) for (const i of indices) nearByPoint[i] = nearMetresFor(nominal, nearM);
  }
  // One shared material per side; every unit and the far massing draw through it (same textures, tint and fixed-light shade).
  const merged = new Map<number, any>();
  const mergedMaterial = (source: any) => {
    if (isCity(source)) return source;
    let m = merged.get(source.side);
    if (!m) {
      const uniforms: Record<string, any> = {enuFromWorld: source.uniforms.enuFromWorld};
      textures.forEach((t, i) => { uniforms[`t${i}`] = {value: t}; });
      m = new THREE.ShaderMaterial({uniforms, ...mergedShaders(textures.length), side: source.side});
      m.name = 'building-types/merged';
      m.userData = {recipeLookShared: true};
      merged.set(source.side, m);
    }
    return m;
  };
  const partOf = (m: any, data: {positions: ArrayLike<number>; normals: ArrayLike<number>; uvs: ArrayLike<number>; index?: ArrayLike<number> | null}, matrix: ArrayLike<number>): MergePart => {
    if (isCity(m.material)) {
      // City look: `texture` carries the slot ordinal (the `layer` attribute), UVs stay in metres (the shader scales per slot).
      const layer = m.geometry.getAttribute('layer'), tint = m.geometry.getAttribute('tint');
      return {...data, matrix, uvScale: 1, texture: layer.getX(0), tint: [tint.getX(0), tint.getY(0), tint.getZ(0)]};
    }
    const t = m.material.uniforms.tint.value;
    return {...data, matrix, uvScale: m.material.uniforms.uvScale.value, texture: textures.indexOf(m.material.uniforms.map.value), tint: [t.x, t.y, t.z]};
  };
  const geometryOf = (mm: MergedMesh, city = false) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(mm.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(mm.normals, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(mm.uvs, 2));
    g.setAttribute(city ? 'layer' : 'aTex', new THREE.BufferAttribute(mm.textures, 1));
    g.setAttribute(city ? 'tint' : 'aTint', new THREE.BufferAttribute(mm.tints, 3));
    g.setIndex(new THREE.BufferAttribute(mm.index, 1));
    geometries.push(g);
    return g;
  };
  // Through the accessor: GLB attributes may be interleaved or normalised, so `.array` is not the values.
  const readAttribute = (a: any, size: number): number[] => {
    const out: number[] = [];
    for (let i = 0; i < a.count; i++) { out.push(a.getX(i)); if (size > 1) out.push(a.getY(i)); if (size > 2) out.push(a.getZ(i)); }
    return out;
  };
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (const {unit, indices, meshes, nominal} of loaded) {
    const near = new Map<number, MergePart[]>(), far = new Map<number, MergePart[]>(), sources = new Map<number, any>();
    for (const m of meshes) {
      const geo = m.geometry;
      if (!mergeable(m.material)) {
        // Anything that is not a recipe-look material keeps its own instanced draw.
        const mesh = new THREE.InstancedMesh(geo, instancedMaterial(THREE, m.material, materialCache), indices.length);
        mesh.name = `${unit}/near/${m.name}`; mesh.userData.layer = 'near';
        layers.push({mesh, indices, local: m.matrixWorld.clone(), far: false, triangles: (geo.index?.count ?? geo.attributes.position.count) / 3});
        group.add(mesh);
        continue;
      }
      const side = m.material.side;
      sources.set(side, m.material);
      near.set(side, [...(near.get(side) ?? []), partOf(m, {positions: readAttribute(geo.attributes.position, 3), normals: readAttribute(geo.attributes.normal, 3), uvs: readAttribute(geo.attributes.uv, 2), index: geo.index?.array}, m.matrixWorld.elements)]);
    }
    if (nominal) {
      // Far LOD from the unit's nominal size: wall box + roof in the unit's own wall and roof materials, one draw.
      const slotOf = (m: any) => (isCity(m.material) ? m.userData?.citySlot?.slot : m.material?.userData?.materialSlot);
      const pick = (slots: Set<string>) => meshes.filter(m => mergeable(m.material) && slots.has(slotOf(m))).sort((a, b) => b.geometry.attributes.position.count - a.geometry.attributes.position.count)[0];
      const wall = pick(WALL_SLOTS), roofMesh = pick(ROOF_SLOTS), raw = farMassing(nominal);
      if (!wall) {
        // Not mergeable (the shared frame's lit recipe look is MeshLambertMaterial): the far box still draws, one
        // instanced mesh each for walls and roof in the unit's own wall/roof material, so a far instance is never a hole.
        const own = (slots: Set<string>) => meshes.filter(m => slots.has(m.material?.userData?.materialSlot)).sort((a, b) => b.geometry.attributes.position.count - a.geometry.attributes.position.count)[0];
        const ownWall = own(WALL_SLOTS), ownRoof = own(ROOF_SLOTS) ?? ownWall;
        for (const [source, data, part] of [[ownWall, raw.walls, 'walls'], [ownRoof, raw.roof, 'roof']] as const) {
          if (!source || !data.index.length) continue;
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
          g.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
          g.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
          g.setIndex(data.index);
          geometries.push(g);
          const mesh = new THREE.InstancedMesh(g, instancedMaterial(THREE, source.material, materialCache), indices.length);
          mesh.name = `${unit}/far/${part}`; mesh.userData.layer = 'far';
          layers.push({mesh, indices, local: new THREE.Matrix4(), far: true, triangles: data.index.length / 3});
          group.add(mesh);
        }
      }
      for (const [source, data] of [[wall, raw.walls], [roofMesh, raw.roof]] as const) {
        if (!source || !data.index.length) continue;
        const side = source.material.side;
        sources.set(side, source.material);
        far.set(side, [...(far.get(side) ?? []), partOf(source, {positions: data.positions, normals: data.normals, uvs: data.uvs, index: data.index}, identity)]);
      }
    }
    for (const [parts, isFar] of [[near, false], [far, true]] as const) {
      for (const [side, list] of parts) {
        const source = sources.get(side), mm = mergeParts(list), mesh = new THREE.InstancedMesh(geometryOf(mm, isCity(source)), mergedMaterial(source), indices.length);
        mesh.name = `${unit}/${isFar ? 'far' : 'near'}/merged-${side}`; mesh.userData.layer = isFar ? 'far' : 'near';
        layers.push({mesh, indices, local: new THREE.Matrix4(), far: isFar, triangles: mm.index.length / 3});
        group.add(mesh);
      }
    }
    // The unit scene itself is never drawn; its geometries and materials live on in the instanced meshes.
  }

  let partition: Partition | undefined, lastAt: {x: number; z: number} | null = null;
  const tmp = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  // Highlighted / dimmed instances: collapsed in their layers and drawn by a one-instance copy per layer.
  const special = new Map<number, 'highlight' | 'dim'>();
  let copies: {global: number; layer: Layer; mesh: any}[] = [];
  let counts = {near: 0, far: 0, culled: 0};
  const apply = (p: Partition) => {
    partition = p;
    const nearSet = new Set(p.near), farSet = new Set(p.far);
    let drawn = 0;
    for (const layer of layers) {
      const wanted = layer.indices.map((global, k) => ({global, k})).filter(({global}) => (layer.far ? farSet : nearSet).has(global));
      wanted.forEach(({global}, slot) => { tmp.multiplyMatrices(matrices[global], layer.local); layer.mesh.setMatrixAt(slot, special.has(global) ? zero : tmp); });
      layer.mesh.userData.slotToGlobal = wanted.map(w => w.global);
      layer.mesh.count = wanted.length;
      layer.mesh.instanceMatrix.needsUpdate = true;
      layer.mesh.visible = wanted.length > 0;
      if (wanted.length) { layer.mesh.computeBoundingSphere(); layer.mesh.computeBoundingBox(); drawn++; }
    }
    counts = {near: p.near.length, far: p.far.length, culled: p.culled};
    for (const c of copies) c.mesh.visible = (c.layer.far ? farSet : nearSet).has(c.global);
    void drawn;
  };
  const update = (force = false) => {
    const c = deps.getCentre();
    if (!c) return;
    const [east, south] = offsetMetres(origin, [c.lng, c.lat]), at = {x: east, z: south};
    if (!force && lastAt && Math.hypot(at.x - lastAt.x, at.z - lastAt.z) < 10) return;
    lastAt = at;
    apply(partitionByDistance(points, at, nearByPoint, cullM, partition));
  };
  // Start with everything far until the first camera position is known; then the first render refines it.
  apply({near: [], far: points.map((_, i) => i), culled: 0});
  update(true);
  // Re-partition from inside the draw: any instanced mesh's onBeforeRender runs once per frame the group is drawn.
  // (an empty, never-culled mesh: a real layer can be invisible when it has no near instances).
  const driver = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
  driver.name = 'building-types/driver'; driver.frustumCulled = false;
  driver.onBeforeRender = () => update();
  group.add(driver);

  return {
    anchor: origin, group, suppress: suppressionIds(instances), radiusMetres, update,
    setHighlighted(ids, focus) {
      const style = highlightStyle(), recipe = HIGHLIGHT_RECIPES[style];
      const want = new Set([...ids].map(id => String(id).replace(/^NL\.IMBAG\.Pand\./, '')));
      for (const c of copies) { group.remove(c.mesh); c.mesh.dispose?.(); }
      copies = [];
      special.clear();
      instances.forEach((inst, g) => {
        if (want.has(inst.pand)) special.set(g, 'highlight');
        else if (recipe.desaturate && focus && withinDesaturation(focus.lngLat, inst.anchor)) special.set(g, 'dim');
      });
      const city = getCityLook(THREE);
      for (const [global, state] of special) for (const layer of layers) {
        if (!layer.indices.includes(global)) continue;
        const base = layer.mesh.material;
        const material = state === 'highlight'
          ? (recipe.keepMaterials ? base : isCity(base) ? city.highlighted(base, true) : highlightMaterialFor(THREE, base, 'highlight', style))
          : isCity(base) ? city.dimmed(base, true) : highlightMaterialFor(THREE, base, 'dim', style);
        const mesh = new THREE.InstancedMesh(layer.mesh.geometry, material, 1);
        mesh.setMatrixAt(0, tmp.multiplyMatrices(matrices[global], layer.local));
        mesh.name = `${layer.mesh.name}/${state}`;
        mesh.userData.slotToGlobal = [global];
        mesh.computeBoundingSphere(); mesh.computeBoundingBox();
        if (state === 'highlight') attachHighlightPasses(THREE, mesh, {style, up: [0, 1, 0]}); // area frame: +y up
        group.add(mesh);
        copies.push({global, layer, mesh});
      }
      if (partition) apply(partition);
      return [...special.values()].filter(s => s === 'highlight').length;
    },
    pandForHit(object, instanceId) {
      const map = object?.userData?.slotToGlobal as number[] | undefined;
      return instanceId === undefined || !map ? null : instances[map[instanceId]]?.pand ?? null;
    },
    stats() {
      const drawCalls = layers.filter(l => l.mesh.visible && l.mesh.count > 0).length;
      let nearTriangles = 0, farTriangles = 0;
      for (const l of layers) if (l.mesh.visible) { if (l.far) farTriangles += l.triangles * l.mesh.count; else nearTriangles += l.triangles * l.mesh.count; }
      return {instances: instances.length, ...counts, units: byUnit.size, drawCalls, nearTriangles, farTriangles};
    },
    dispose() {
      for (const c of copies) c.mesh.dispose?.();
      for (const l of layers) l.mesh.dispose?.();
      for (const g of geometries) g.dispose();
      for (const m of merged.values()) m.dispose();
    },
  };
}
