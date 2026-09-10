/** Actual Three.js renderer adapter for CityAppearanceStreamer. The workspace
 * provides Three's runtime but does not install its separate declaration package.
 * Buffer creation is independent of WebGL and covered by geometry tests.
 */
// @ts-expect-error Three runtime is installed without @types/three.
import * as THREE from 'three';
// @ts-expect-error Shared browser JS has no separate declaration file.
import { wallObservationIntervals, clipWallTriangles } from '../../public/canal-drive/da-costa-block/wall-intervals.js';
import type { AppearanceTile, AppearanceLod } from './cityAppearanceTiles.js';
import type { AppearanceTileResource } from './cityAppearanceStreamer.js';
import { contextualFacadePatches, facadeRecipeRecords, facadeRecipePatches, FACADE_PATCH_COLOURS } from './cityAppearanceFacadeRecipes.js';
import { CONTEXTUAL_BUILDING_COLOURS, contextualBuildingPalette } from './cityAppearancePalette.js';

type Point = [number, number, number];
type Surface = { type: string; rings: Point[][] };
export type BlockAppearanceGeometry = {
  frame: { originRD: { x: number; y: number }; axes: string; heightDatum: string };
  building: {
    id: string; surfaces: Surface[]; height?: number; groundNAP?: number; year?: number;
    footprint: { type: 'Polygon'; coordinates: [number, number][][] } | { type: 'MultiPolygon'; coordinates: [number, number][][][] };
  };
};
type Owner = AppearanceTile<BlockAppearanceGeometry, any>['owners'][number];
export type AppearanceTriangleIdentity = { buildingId: string; geometryRevision: string; sourceSurfaceIndex: number | null; observationId: string | null; approximateMassing: boolean; featureId?: string; featureKind?: string; styleSource?: string };
export type ThreeAppearanceOptions = {
  /** Caller-owned scene/group; disposing a tile never disposes this parent. */
  parent: { add(object: any): unknown; remove(object: any): unknown };
  targetOriginRD: { x: number; y: number };
  /** Render y = NAP - targetOffsetNAP; default is absolute NAP metres. */
  targetOffsetNAP?: number;
  experimentalWallColours?: boolean;
  /** Synthetic opening rhythm only on source-supported public wall intervals. */
  proceduralFacades?: boolean;
  /** Still requires source-bound human placement plus deployed-fabric evidence. */
  reviewedAwnings?: boolean;
  /** Evidence-coverage overlay only; colours indicate audit status, not facade paint. */
  auditCoverage?: boolean;
  /** Stable construction-era palette for visual legibility; never source evidence. */
  contextualPalette?: boolean;
  /** Large-area scenes may retain tree shadows while buildings receive light only. */
  castShadows?: boolean;
  /** Close-LOD exterior-window rhythm; display prior without observation IDs. */
  contextualFacades?: boolean;
};
export type ThreeAppearanceResource = AppearanceTileResource & {
  group: any;
  flush(): void;
  /** Runtime-only review cue; never alters source geometry or provenance. */
  setSelected(id: string | null): void;
  pick(mesh: any, faceIndex: number): AppearanceTriangleIdentity | null;
  readonly stats: { triangles: number; meshes: number; buildings: number; windows: number; doors: number; storefronts: number; storefrontPatches: number; awnings: number; disposed: boolean };
};
const PALETTE = { wall: '#c4c1b5', ...CONTEXTUAL_BUILDING_COLOURS, brown: '#876650', red: '#945c48', buff: '#bba681', grey: '#96938a', white: '#d8d4c3', black: '#57544e', auditedUsable: '#638774', auditedPartial: '#bd875b', ...FACADE_PATCH_COLOURS };
type Palette = keyof typeof PALETTE;
type Patch = { triangles: number[]; colour: Palette; identity: AppearanceTriangleIdentity };

/** Earcut on the dominant projection, with each triangle's source winding
 * restored. Triangulating holes first is essential before interval clipping. */
export function triangulateAppearanceSurface(rings: Point[][]): number[] {
  const clean = rings.map(ring => {
    if (!ring.every(point => point.length === 3 && point.every(Number.isFinite))) throw new Error('Invalid source surface coordinate');
    return ring.length > 2 && ring[0].every((value, i) => Math.abs(value - ring[ring.length - 1][i]) < 1e-8) ? ring.slice(0, -1) : ring.slice();
  });
  if (!clean[0] || clean[0].length < 3) return [];
  if (clean.slice(1).some(ring => ring.length < 3)) throw new Error('Degenerate source hole');
  const outer = clean[0], normal = new THREE.Vector3();
  for (let i = 0; i < outer.length; i++) {
    const p = outer[i], q = outer[(i + 1) % outer.length];
    normal.x += (p[1] - q[1]) * (p[2] + q[2]);
    normal.y += (p[2] - q[2]) * (p[0] + q[0]);
    normal.z += (p[0] - q[0]) * (p[1] + q[1]);
  }
  if (normal.lengthSq() < 1e-16) return [];
  const components = [Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z)];
  const drop = components.indexOf(Math.max(...components));
  const project = (point: Point) => new THREE.Vector2(...point.filter((_, axis) => axis !== drop));
  const flat = clean.flat();
  const indices: number[][] = THREE.ShapeUtils.triangulateShape(clean[0].map(project), clean.slice(1).map(ring => ring.map(project)));
  return indices.flatMap(triangle => {
    const [p, q, r] = triangle.map(index => new THREE.Vector3(...flat[index]));
    const aligned = q.sub(p).cross(r.sub(p)).dot(normal) >= 0 ? triangle : [triangle[0], triangle[2], triangle[1]];
    return aligned.flatMap(index => flat[index]);
  });
}

function massingSurfaces(owner: Owner): Surface[] {
  const building = owner.geometry.building;
  const ys = building.surfaces.flatMap(surface => surface.rings.flatMap(ring => ring.map(point => point[1])));
  const base = ys.length ? Math.min(...ys) : (building.groundNAP ?? .65) - .65;
  const top = ys.length ? Math.max(...ys) : base + (building.height ?? 5);
  const polygons = building.footprint.type === 'Polygon' ? [building.footprint.coordinates] : building.footprint.coordinates;
  const surfaces: Surface[] = [];
  for (const polygon of polygons) {
    // Normalize only generated proxy rings, never canonical source geometry:
    // exterior clockwise in x/z gives upward roof/outward wall normals.
    const rings = polygon.map((ring, index) => {
      const twiceArea = ring.slice(0, -1).reduce((sum, p, i) => sum + p[0] * ring[i + 1][1] - ring[i + 1][0] * p[1], 0);
      return (index === 0 ? twiceArea > 0 : twiceArea < 0) ? [...ring].reverse() : ring;
    });
    surfaces.push({ type: 'roof', rings: rings.map(ring => ring.map(([x, z]) => [x, top, z])) });
    for (const ring of rings) for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i], b = ring[i + 1];
      surfaces.push({ type: 'wall', rings: [[[a[0], base, a[1]], [b[0], base, b[1]], [b[0], top, b[1]], [a[0], top, a[1]]]] });
    }
  }
  return surfaces;
}

function transform(triangles: number[], owner: Owner, options: ThreeAppearanceOptions): number[] {
  const origin = owner.geometry.frame.originRD, target = options.targetOriginRD;
  const offsetY = .65 - (options.targetOffsetNAP ?? 0);
  return triangles.map((value, index) => index % 3 === 0 ? value + origin.x - target.x : index % 3 === 1 ? value + offsetY : value + target.y - origin.y);
}

/** Source-bound but still explicitly experimental. Upstream eligibility remains
 * authoritative; suppressed/unknown colour fields are never filled from guesses. */
function boundRecords(owners: Owner[]): any[] {
  return owners.flatMap(owner => owner.observations.filter(observation => observation.buildingId === owner.id
    && observation.geometryRevision === owner.geometryRevision && observation.evidenceKey
    && observation.payload?.evidenceKey === observation.evidenceKey
    && observation.payload?.renderBuildingId === owner.id
    && observation.payload?.effectiveProposal?.wholeUsable === 'yes'
    && observation.payload?.visualReview?.fieldEligibility?.wallColour !== false).map(observation => observation.payload));
}
function auditedRecords(owners: Owner[]): any[] {
  return owners.flatMap(owner=>owner.observations.filter(observation=>observation.buildingId===owner.id
    && observation.geometryRevision===owner.geometryRevision&&observation.evidenceKey
    && observation.payload?.evidenceKey===observation.evidenceKey&&observation.payload?.renderBuildingId===owner.id
    && ['usable','partial'].includes(observation.payload?.agentSourceAudit?.disposition)).map(observation=>observation.payload));
}
function contextualColour(owner:Owner,type:string):Palette{
  const palette=contextualBuildingPalette(owner.id,owner.geometry.building.year);return(type==='roof'?palette.roofKey:palette.wallKey)as Palette;
}

export function createCityAppearanceThreeAdapter(options: ThreeAppearanceOptions): (owners: Owner[]) => ThreeAppearanceResource {
  if (![options.targetOriginRD.x, options.targetOriginRD.y, options.targetOffsetNAP ?? 0].every(Number.isFinite)) throw new Error('Invalid target RD/NAP origin');
  return owners => {
    const ids = new Set<string>();
    for (const owner of owners) {
      const frame = owner.geometry?.frame;
      if (ids.has(owner.id) || owner.geometry?.building?.id !== owner.id || !frame || frame.axes !== 'x=east,y=up,z=south'
        || frame.heightDatum !== 'legacy-block-NAP-minus-0.65m' || ![frame.originRD.x, frame.originRD.y].every(Number.isFinite)) throw new Error(`Unsupported or duplicate source frame: ${owner.id}`);
      ids.add(owner.id);
    }
    const group = new THREE.Group(); group.name = 'city-appearance-owned-tile';
    group.userData.buildingIds = [...ids]; group.userData.experimentalWallColours = options.experimentalWallColours === true;
    group.userData.proceduralFacades = options.proceduralFacades === true;
    group.userData.facadeStyleSource = 'Window rhythm and glazing are procedural display priors, not measured openings or inferred tenant boundaries.';
    const materials = new Map<Palette, any>();
    const lods = new Map(owners.map(owner => [owner.id, 'facade' as AppearanceLod]));
    const prepared = new Map<string, Record<AppearanceLod, Patch[]>>();
    const selectionSurfaces = new Map<string, number[]>();
    const records = options.experimentalWallColours ? boundRecords(owners) : options.auditCoverage ? auditedRecords(owners) : [];
    const recipeRecords = options.proceduralFacades ? facadeRecipeRecords(owners) : [];
    let disposed = false, pending = false;
    const identity = (owner: Owner, index: number | null, approximateMassing = false, observationId: string | null = null): AppearanceTriangleIdentity => ({
      buildingId: owner.id, geometryRevision: owner.geometryRevision, sourceSurfaceIndex: index, observationId, approximateMassing,
    });
    for (const owner of owners) {
      const approximate = !owner.geometry.building.surfaces.length;
      const surfaces = approximate ? massingSurfaces(owner) : owner.geometry.building.surfaces;
      const facade: Patch[] = [], detail: Patch[] = [];
      surfaces.forEach((surface, index) => {
        const triangles = triangulateAppearanceSurface(surface.rings);
        const colour = options.contextualPalette?contextualColour(owner,surface.type):surface.type === 'roof' ? 'roof' : 'wall';
        const patch: Patch = { triangles: transform(triangles, owner, options), colour, identity: identity(owner, approximate ? null : index, approximate) };
        facade.push(patch);
        const partition = !approximate && surface.type === 'wall' && (options.experimentalWallColours||options.auditCoverage) ? wallObservationIntervals(surface, index, owner.id, records) : null;
        if (!partition?.axis) { detail.push(patch); return; }
        for (const interval of partition.intervals) {
          const label = interval.observation?.effectiveProposal?.wallColour,audit=interval.observation?.agentSourceAudit?.disposition;
          const observed = options.auditCoverage&&audit==='usable'?'auditedUsable':options.auditCoverage&&audit==='partial'?'auditedPartial':['brown', 'red', 'buff', 'grey', 'white', 'black'].includes(label) ? label as Palette : null;
          detail.push({
            triangles: transform(clipWallTriangles(triangles, partition.axis, interval.startM, interval.endM), owner, options),
            colour: observed ?? colour,
            identity: identity(owner, index, false, observed ? interval.observation.id : null),
          });
        }
      });
      // Material evidence remains visible at neighbourhood/facade distance;
      // only generated opening geometry is restricted to close detail LOD.
      const facadeAppearance = options.experimentalWallColours||options.auditCoverage ? detail.slice() : facade;
      selectionSurfaces.set(owner.id, facade.flatMap(patch => patch.triangles));
      if ((options.proceduralFacades || options.contextualFacades) && !approximate) surfaces.forEach((surface, index) => {
        const supported = options.proceduralFacades ? facadeRecipePatches(owner, surface, index, recipeRecords, owners, options.reviewedAwnings === true) : [];
        const recipes = supported.length || !options.contextualFacades ? supported : contextualFacadePatches(owner, surface, index, owners);
        for (const recipe of recipes) {
          detail.push({ triangles: transform(recipe.triangles, owner, options), colour: recipe.colour,
            identity: { ...identity(owner, index, false, recipe.observationId), featureId: recipe.featureId, featureKind: recipe.featureKind, styleSource: recipe.styleSource } });
        }
      });
      const massing: Patch[] = massingSurfaces(owner).map(surface => ({ triangles: transform(triangulateAppearanceSurface(surface.rings), owner, options), colour: options.contextualPalette?contextualColour(owner,surface.type):surface.type === 'roof' ? 'roof' : 'wall', identity: identity(owner, null, true) }));
      prepared.set(owner.id, { facade: facadeAppearance, detail, massing });
    }
    const selectionMaterial = new THREE.MeshBasicMaterial({ color: '#f2c14e', transparent: true, opacity: .24, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
    let selectedId: string | null = null, selectionMesh: any = null;
    function syncSelection() {
      if (selectionMesh) { group.remove(selectionMesh); selectionMesh.geometry.dispose(); selectionMesh = null; }
      const positions = selectedId ? selectionSurfaces.get(selectedId) : null;
      if (!positions?.length || disposed) return;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      selectionMesh = new THREE.Mesh(geometry, selectionMaterial);
      selectionMesh.name = 'city-appearance-selection'; selectionMesh.renderOrder = 6;
      selectionMesh.userData.runtimeSelection = true;
      selectionMesh.raycast = () => {};
      group.add(selectionMesh);
    }
    function flush() {
      pending = false;
      if (disposed) return;
      const batches = new Map<Palette, { positions: number[]; identities: AppearanceTriangleIdentity[] }>();
      for (const owner of owners) for (const patch of prepared.get(owner.id)![lods.get(owner.id)!]) {
        if (!patch.triangles.length) continue;
        const batch = batches.get(patch.colour) ?? { positions: [], identities: [] };
        for (const value of patch.triangles) batch.positions.push(value);
        for (let i = 0; i < patch.triangles.length / 9; i++) batch.identities.push(patch.identity);
        batches.set(patch.colour, batch);
      }
      // Build replacements before retiring the previous frame's buffers.
      const meshes: any[] = [];
      for (const [colour, batch] of batches) {
        if (!materials.has(colour)) materials.set(colour, new THREE.MeshStandardMaterial({ color: PALETTE[colour], roughness: .9, side: THREE.DoubleSide }));
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(batch.positions, 3));
        geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        const mesh = new THREE.Mesh(geometry, materials.get(colour));
        mesh.name = `city-appearance-${colour}`; mesh.userData.triangleIdentities = batch.identities;
        mesh.castShadow = options.castShadows !== false; mesh.receiveShadow = false;
        meshes.push(mesh);
      }
      for (const mesh of [...group.children]) if (mesh !== selectionMesh) { group.remove(mesh); mesh.geometry.dispose(); }
      for (const mesh of meshes) group.add(mesh);
      syncSelection();
    }
    const resource: ThreeAppearanceResource = {
      group, flush,
      setSelected(id) {
        if (disposed) return;
        if (id !== null && !ids.has(id)) { selectedId = null; syncSelection(); return; }
        if (selectedId === id) return;
        selectedId = id; syncSelection();
      },
      setLod(id, lod) {
        if (disposed) return;
        if (!ids.has(id) || !['massing', 'facade', 'detail'].includes(lod)) throw new Error(`Unknown building or LOD: ${id}`);
        if (lods.get(id) === lod) return;
        lods.set(id, lod);
        if (!pending) { pending = true; queueMicrotask(() => { if (pending) flush(); }); }
      },
      pick(mesh, faceIndex) {
        if (disposed || !group.children.includes(mesh) || !Number.isInteger(faceIndex) || faceIndex < 0) return null;
        return mesh.userData.triangleIdentities?.[faceIndex] ?? null;
      },
      get stats() {
        const features = new Map<string, string>();
        const shopFrontages = new Set<string>();
        for (const mesh of group.children) for (const item of (mesh.userData.triangleIdentities ?? []) as AppearanceTriangleIdentity[]) {
          if (item.featureId && item.featureKind) features.set(item.featureId, item.featureKind);
          if (item.featureKind === 'shopfront-prior' && item.observationId) shopFrontages.add(item.observationId);
        }
        const count = (kind: string) => [...features.values()].filter(value => value === kind).length;
        const renderMeshes=group.children.filter((mesh:any)=>!mesh.userData.runtimeSelection);
        return { buildings: ids.size, meshes: renderMeshes.length, triangles: renderMeshes.reduce((sum: number, mesh: any) => sum + mesh.geometry.getAttribute('position').count / 3, 0), windows: count('window-prior')+count('contextual-window-prior'),doors:count('contextual-door-prior'), storefronts: shopFrontages.size, storefrontPatches: count('shopfront-prior'), awnings: count('reviewed-awning-prior'), disposed };
      },
      dispose() {
        if (disposed) return;
        disposed = true; options.parent.remove(group);
        for (const mesh of [...group.children]) { group.remove(mesh); mesh.geometry.dispose(); }
        for (const material of materials.values()) material.dispose();
        selectionMesh=null; selectionMaterial.dispose(); materials.clear(); prepared.clear(); selectionSurfaces.clear(); lods.clear();
      },
    };
    flush(); options.parent.add(group);
    return resource;
  };
}
