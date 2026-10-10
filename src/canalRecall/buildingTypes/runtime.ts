/**
 * Building types at runtime (`?buildingTypes=1`, default off): one shared unit mesh per design, drawn with
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
  return [...new Set(instances.map(i => pandOsmId(i.pand)))].sort();
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
export function partitionByDistance(points: readonly {x: number; z: number}[], at: {x: number; z: number}, nearM: number, cullM: number, previous?: Partition, hysteresisM = 20): Partition {
  const wasNear = new Set(previous?.near), wasFar = new Set(previous?.far);
  const near: number[] = [], far: number[] = [];
  points.forEach((p, i) => {
    const d = Math.hypot(p.x - at.x, p.z - at.z);
    const nearLimit = wasNear.has(i) ? nearM + hysteresisM : nearM - (wasFar.has(i) ? hysteresisM : 0);
    const cullLimit = wasNear.has(i) || wasFar.has(i) ? cullM + hysteresisM : cullM;
    if (d <= nearLimit) near.push(i); else if (d <= cullLimit) far.push(i);
  });
  return {near, far, culled: points.length - near.length - far.length};
}

export const NEAR_METRES = 140;
export const CULL_METRES = 700;

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
  for (const [unit, indices] of byUnit) {
    const scene = await deps.loadUnit(unit);
    scene.updateMatrixWorld(true);
    let nominal: Nominal | undefined;
    scene.traverse((o: any) => { if (o.userData?.nominal) nominal = o.userData.nominal; });
    const meshes: any[] = [];
    scene.traverse((o: any) => { if (o.isMesh) meshes.push(o); });
    for (const m of meshes) {
      const mesh = new THREE.InstancedMesh(m.geometry, instancedMaterial(THREE, m.material, materialCache), indices.length);
      mesh.name = `${unit}/near/${m.name}`;
      mesh.userData.layer = 'near';
      layers.push({mesh, indices, local: m.matrixWorld.clone(), far: false, triangles: (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3});
      group.add(mesh);
    }
    if (nominal) {
      // Far LOD from the unit's nominal size: two meshes (walls, roof) in the unit's own wall and roof materials.
      const pick = (slots: Set<string>) => meshes.filter(m => slots.has(m.material?.userData?.materialSlot)).sort((a, b) => b.geometry.attributes.position.count - a.geometry.attributes.position.count)[0];
      const wall = pick(WALL_SLOTS), roofMesh = pick(ROOF_SLOTS), raw = farMassing(nominal);
      for (const [part, source, data] of [['walls', wall, raw.walls], ['roof', roofMesh, raw.roof]] as const) {
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
    // The unit scene itself is never drawn; its geometries and materials live on in the instanced meshes.
  }

  let partition: Partition | undefined, lastAt: {x: number; z: number} | null = null;
  const tmp = new THREE.Matrix4();
  let counts = {near: 0, far: 0, culled: 0};
  const apply = (p: Partition) => {
    partition = p;
    const nearSet = new Set(p.near), farSet = new Set(p.far);
    let drawn = 0;
    for (const layer of layers) {
      const wanted = layer.indices.map((global, k) => ({global, k})).filter(({global}) => (layer.far ? farSet : nearSet).has(global));
      wanted.forEach(({global}, slot) => { tmp.multiplyMatrices(matrices[global], layer.local); layer.mesh.setMatrixAt(slot, tmp); });
      layer.mesh.userData.slotToGlobal = wanted.map(w => w.global);
      layer.mesh.count = wanted.length;
      layer.mesh.instanceMatrix.needsUpdate = true;
      layer.mesh.visible = wanted.length > 0;
      if (wanted.length) { layer.mesh.computeBoundingSphere(); layer.mesh.computeBoundingBox(); drawn++; }
    }
    counts = {near: p.near.length, far: p.far.length, culled: p.culled};
    void drawn;
  };
  const update = (force = false) => {
    const c = deps.getCentre();
    if (!c) return;
    const [east, south] = offsetMetres(origin, [c.lng, c.lat]), at = {x: east, z: south};
    if (!force && lastAt && Math.hypot(at.x - lastAt.x, at.z - lastAt.z) < 10) return;
    lastAt = at;
    apply(partitionByDistance(points, at, nearM, cullM, partition));
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
      for (const l of layers) l.mesh.dispose?.();
      for (const g of geometries) g.dispose();
    },
  };
}
