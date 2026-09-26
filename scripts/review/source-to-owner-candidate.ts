/** Generic, preview-only projection of a source-bound facade correction onto an
 * existing city owner. Original surfaces and observations retain their indices.
 * A facade plane may be appended when the LoD owner splits one photographed
 * frontage across several small surfaces. Optional topology-bound joins are
 * explicitly inferred replacements; their originals remain in the baseline. */
import { createHash } from 'node:crypto';
import { simplifyContour } from '../../src/canalRecall/facade/silhouetteCompiler.ts';

type P = [number, number, number];
type Owner = any;
type TopologyVertex = { source: { x: number; y: number; normalOffsetM: number } } | { native: { surfaceIndex: number; ringIndex: number; vertexIndex: number } };
type SourceFeatureSet = { width: number; height: number; cropSha256: string; captureDate: string; features: any[];
  projection: { plane: { start: { x: number; y: number }; end: { x: number; y: number }; baseZ: number; topZ: number }; localToNAPOffsetM: number } };

export type SourceFacadeCandidateSpec = {
  id: string;
  buildingId: string;
  source: {
    cropSha256: string;
    dimensions: { width: number; height: number };
    captureDate: string;
    plane: { start: { x: number; y: number }; end: { x: number; y: number }; baseZ: number; topZ: number };
    localToNAPOffsetM: number;
  };
  facadeBoundsPx: { left: number; right: number; bottom: number };
  silhouetteTopPx: [number, number][];
  /** Optional opt-in simplification of the source silhouette (pixel tolerance). */
  silhouetteSimplification?: { tolerancePx: number };
  sources: Record<string, SourceFeatureSet>;
  observationId: string;
  extractionVersion: string;
  sourceNote: string;
  scopeNote?: string;
  placement?: { status: 'inferred'; reason: string };
  concaveMaterialPreview?: { sourceCropSha256: string; featureIds: string[] };
  sourceFeatureOverrides?: {
    source: string;
    sourceCropSha256: string;
    featureId: string;
    expectedFeatureSha256: string;
    set: Record<string, unknown>;
    remove?: string[];
    basis: string;
  }[];
  componentSurfaces?: {
    name: string;
    type: 'wall' | 'roof';
    role: string;
    colour: string;
    vertices: { x: number; y: number; normalOffsetM: number }[];
    basis: string;
  }[];
  componentAssemblies?: {
    name: string;
    type: 'balcony';
    boundsPx: [number, number, number, number];
    projectionM: number;
    slabThicknessPx: number;
    verticalRailCount: number;
    railWidthPx: number;
    railColour: string;
    slabColour: string;
    observedBasis: string;
    inferredDepthBasis: string;
  }[];
  nativeTopologyJoins?: {
    name: string;
    type: 'wall' | 'roof';
    role: string;
    colour: string;
    replaceSurfaceIndex: number;
    vertices?: TopologyVertex[];
    facets?: TopologyVertex[][];
    basis: string;
  }[];
  nativeTopologyBinding?: { geometryRevision: string; surfaceSha256: Record<string, string> };
};

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function assertFeatureSource(name: string, source: SourceFeatureSet) {
  if (!(source.width > 0 && source.height > 0) || !source.cropSha256 || !source.captureDate || !Array.isArray(source.features)) throw Error(`Invalid ${name} feature source`);
  const ids = new Set<string>();
  for (const feature of source.features) {
    if (!feature.id || ids.has(feature.id) || !Array.isArray(feature.bounds) || feature.bounds.length !== 4) throw Error(`Invalid ${name} feature set`);
    ids.add(feature.id);
  }
}

export function buildSourceFacadeOwnerCandidate(owner: Owner, spec: SourceFacadeCandidateSpec) {
  if (!owner?.id || owner.geometry?.building?.id !== owner.id || !owner.geometryRevision) throw Error('Invalid owner identity');
  if (spec.buildingId !== owner.id) throw Error('Correction building binding mismatch');
  if (spec.scopeNote !== undefined && !spec.scopeNote.trim()) throw Error('Invalid source correction scope note');
  if(spec.concaveMaterialPreview){
    if(spec.concaveMaterialPreview.sourceCropSha256!==spec.source.cropSha256||!spec.concaveMaterialPreview.featureIds.length)throw Error('Concave material preview binding mismatch');
    const ids=new Set(Object.values(spec.sources).flatMap(source=>source.features.filter(feature=>feature.kind==='material').map(feature=>feature.id)));
    if(spec.concaveMaterialPreview.featureIds.some(id=>!ids.has(id)))throw Error('Concave material preview feature mismatch');
  }
  if (owner.geometry?.frame?.heightDatum !== 'legacy-block-NAP-minus-0.65m') throw Error('Unsupported height datum');
  const { left, right, bottom } = spec.facadeBoundsPx;
  const { width, height } = spec.source.dimensions;
  if (!(left >= 0 && right <= width && right > left && bottom > 0 && bottom <= height)) throw Error('Invalid source facade bounds');
  if (!Array.isArray(spec.silhouetteTopPx) || spec.silhouetteTopPx.length < 2 || spec.silhouetteTopPx.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y) || x < left || x > right || y < 0 || y >= bottom)) throw Error('Invalid source silhouette');
  if (spec.silhouetteTopPx[0][0] !== left || spec.silhouetteTopPx.at(-1)![0] !== right) throw Error('Source silhouette must span the bounded facade');
  // Opt-in only: simplification never runs for existing cases, so their
  // verified output is byte-identical unless a caller asks for it.
  const silhouetteTopPx = spec.silhouetteSimplification
    ? simplifyContour(spec.silhouetteTopPx, { toleranceM: spec.silhouetteSimplification.tolerancePx })
    : spec.silhouetteTopPx;
  if (spec.source.cropSha256 !== spec.sources.full?.cropSha256 || width !== spec.sources.full?.width || height !== spec.sources.full?.height || spec.source.captureDate !== spec.sources.full?.captureDate) throw Error('Full source binding mismatch');
  for (const [name, source] of Object.entries(spec.sources)) assertFeatureSource(name, source);
  const effectiveSources = structuredClone(spec.sources);
  const overrideKeys = new Set<string>();
  const sourceFeatureOverrides = (spec.sourceFeatureOverrides ?? []).map(override => {
    const source = effectiveSources[override.source];
    const index = source?.features.findIndex((feature: any) => feature.id === override.featureId) ?? -1;
    const overrideKey = `${override.source}:${override.featureId}`;
    if (index < 0 || source.cropSha256 !== override.sourceCropSha256 || overrideKeys.has(overrideKey) || !override.basis?.trim() || !/^[a-f0-9]{64}$/.test(override.expectedFeatureSha256) || !override.set || Array.isArray(override.set)) throw Error('Invalid source feature override');
    overrideKeys.add(overrideKey);
    const before = structuredClone(source.features[index]);
    if (hash(before) !== override.expectedFeatureSha256) throw Error('Source feature override binding mismatch');
    if ((override.remove ?? []).some(key => !key || ['id', 'kind', 'bounds'].includes(key))) throw Error('Invalid source feature override removal');
    const after = { ...before, ...structuredClone(override.set) };
    for (const key of override.remove ?? []) delete after[key];
    if (after.id !== before.id || after.kind !== before.kind || JSON.stringify(after.bounds) !== JSON.stringify(before.bounds)) throw Error('Source feature override cannot move or reclassify an observation');
    if (JSON.stringify(after) === JSON.stringify(before)) throw Error('Source feature override must change the observation');
    source.features[index] = after;
    return { source: override.source, sourceCropSha256: override.sourceCropSha256, featureId: override.featureId, basis: override.basis, before, after };
  });
  const observationIndex = owner.observations?.findIndex((entry: any) => entry.id === spec.observationId);
  if (!(observationIndex >= 0)) throw Error('Bound owner observation unavailable');

  const origin = owner.geometry.frame.originRD;
  const local = (x: number, sourceY: number): P => {
    // The sampling plane spans the full source width. Bounds may select only a
    // frontage subset, but must never stretch that subset across the plane.
    const t = x / width;
    const rdX = spec.source.plane.start.x + t * (spec.source.plane.end.x - spec.source.plane.start.x);
    const rdY = spec.source.plane.start.y + t * (spec.source.plane.end.y - spec.source.plane.start.y);
    const napZ = spec.source.plane.topZ - sourceY / height * (spec.source.plane.topZ - spec.source.plane.baseZ);
    return [rdX - origin.x, napZ - spec.source.localToNAPOffsetM, origin.y - rdY];
  };
  const planeDx = spec.source.plane.end.x - spec.source.plane.start.x;
  const planeDz = spec.source.plane.start.y - spec.source.plane.end.y;
  const planeLength = Math.hypot(planeDx, planeDz);
  if (!(planeLength > 0)) throw Error('Invalid source plane');
  const cameraNormal: [number, number] = [-planeDz / planeLength, planeDx / planeLength];
  const componentPoint = ({ x, y, normalOffsetM }: { x: number; y: number; normalOffsetM: number }): P => {
    const point = local(x, y);
    return [point[0] + cameraNormal[0] * normalOffsetM, point[1], point[2] + cameraNormal[1] * normalOffsetM];
  };
  const assemblySurfaces = (spec.componentAssemblies ?? []).flatMap(component => {
    if (component.type !== 'balcony' || !component.name || !/^#[a-f0-9]{6}$/i.test(component.railColour) || !/^#[a-f0-9]{6}$/i.test(component.slabColour)) throw Error('Invalid source component assembly');
    const [xLeft, topY, xRight, bottomY] = component.boundsPx;
    if (![xLeft, topY, xRight, bottomY, component.projectionM, component.slabThicknessPx, component.verticalRailCount, component.railWidthPx].every(Number.isFinite) ||
      !(xLeft >= spec.facadeBoundsPx.left && xRight <= spec.facadeBoundsPx.right && xRight > xLeft && topY >= 0 && bottomY > topY && bottomY + component.slabThicknessPx <= bottom) ||
      !(component.projectionM > 0) || !(component.slabThicknessPx > 0) || !Number.isInteger(component.verticalRailCount) || !(component.verticalRailCount >= 2 && component.verticalRailCount <= 64) || !(component.railWidthPx > 0)) throw Error('Invalid source balcony assembly');
    const front = component.projectionM;
    const rectangle = (name: string, role: string, colour: string, x0: number, y0: number, x1: number, y1: number) => ({ name: `${component.name}-${name}`, type: 'wall' as const, role, colour,
      basis: component.observedBasis, vertices: [{ x: x0, y: y1, normalOffsetM: front }, { x: x1, y: y1, normalOffsetM: front }, { x: x1, y: y0, normalOffsetM: front }, { x: x0, y: y0, normalOffsetM: front }] });
    const railWidth = Math.min(component.railWidthPx, (xRight - xLeft) / (component.verticalRailCount * 2));
    const surfaces: NonNullable<SourceFacadeCandidateSpec['componentSurfaces']> = [
      rectangle('rail-top', 'balcony-rail-observed', component.railColour, xLeft, topY, xRight, topY + railWidth),
      rectangle('rail-bottom', 'balcony-rail-observed', component.railColour, xLeft, bottomY - railWidth, xRight, bottomY),
      rectangle('rail-mid', 'balcony-rail-observed', component.railColour, xLeft, topY + (bottomY - topY) * .55 - railWidth / 2, xRight, topY + (bottomY - topY) * .55 + railWidth / 2),
    ];
    for (let index = 0; index < component.verticalRailCount; index++) {
      const x = xLeft + railWidth / 2 + index / (component.verticalRailCount - 1) * (xRight - xLeft - railWidth);
      surfaces.push(rectangle(`rail-vertical-${index + 1}`, 'balcony-rail-observed', component.railColour, x - railWidth / 2, topY, x + railWidth / 2, bottomY));
    }
    surfaces.push({ name: `${component.name}-slab-top`, type: 'roof', role: 'balcony-slab-inferred-depth', colour: component.slabColour, basis: `${component.observedBasis} ${component.inferredDepthBasis}`,
      vertices: [{ x: xLeft, y: bottomY, normalOffsetM: 0 }, { x: xRight, y: bottomY, normalOffsetM: 0 }, { x: xRight, y: bottomY, normalOffsetM: front }, { x: xLeft, y: bottomY, normalOffsetM: front }] });
    surfaces.push(rectangle('slab-front', 'balcony-slab-observed-front', component.slabColour, xLeft, bottomY, xRight, bottomY + component.slabThicknessPx));
    return surfaces;
  });
  const componentSurfaces = [...(spec.componentSurfaces ?? []), ...assemblySurfaces];
  const top = silhouetteTopPx.map(([x, y]) => local(x, y));
  const wall = { type: 'wall', rings: [[local(left, bottom), local(right, bottom), ...top.slice().reverse()]] };
  const candidate = structuredClone(owner);
  if (spec.nativeTopologyJoins?.length) {
    if (spec.nativeTopologyBinding?.geometryRevision !== owner.geometryRevision) throw Error('Native topology geometry revision mismatch');
    const requiredIndices = new Set(spec.nativeTopologyJoins.flatMap(join => [join.replaceSurfaceIndex,
      ...(join.facets ?? (join.vertices ? [join.vertices] : [])).flatMap(facet => facet.flatMap(vertex => 'native' in vertex ? [vertex.native.surfaceIndex] : []))]));
    for (const index of requiredIndices) {
      if (!/^[a-f0-9]{64}$/.test(spec.nativeTopologyBinding.surfaceSha256?.[String(index)] ?? '')) throw Error('Missing native topology surface binding');
    }
    for (const [surfaceIndex, expected] of Object.entries(spec.nativeTopologyBinding.surfaceSha256)) {
      if (hash(owner.geometry.building.surfaces[Number(surfaceIndex)]) !== expected) throw Error('Native topology surface binding mismatch');
    }
  }
  const resolveTopologyVertex = (vertex: TopologyVertex): P => {
    if ('source' in vertex) {
      const { x, y, normalOffsetM } = vertex.source;
      if (![x, y, normalOffsetM].every(Number.isFinite) || x < left || x > right || y < 0 || y > bottom) throw Error('Invalid native topology join source vertex');
      return componentPoint(vertex.source);
    }
    const { surfaceIndex, ringIndex, vertexIndex } = vertex.native;
    if (![surfaceIndex, ringIndex, vertexIndex].every(Number.isInteger)) throw Error('Invalid native topology join reference');
    const point = owner.geometry.building.surfaces[surfaceIndex]?.rings?.[ringIndex]?.[vertexIndex];
    if (!Array.isArray(point) || point.length !== 3 || !point.every(Number.isFinite)) throw Error('Invalid native topology join reference');
    return [...point] as P;
  };
  const nativeTopologyJoins = (spec.nativeTopologyJoins ?? []).map(join => {
    const facetSpecs = join.facets ?? (join.vertices ? [join.vertices] : []);
    if (!join.name || !['wall', 'roof'].includes(join.type) || !join.role || !join.basis || !/^#[a-f0-9]{6}$/i.test(join.colour) || !Number.isInteger(join.replaceSurfaceIndex) || !facetSpecs.length || facetSpecs.some(facet => facet.length < 3) || (join.facets && join.vertices)) throw Error('Invalid native topology join');
    const replaced = owner.geometry.building.surfaces[join.replaceSurfaceIndex];
    if (replaced?.type !== join.type) throw Error('Native topology join replacement type mismatch');
    return { ...join, facets: facetSpecs.map(facet => facet.map(resolveTopologyVertex)), facetSpecs, replacedSurface: structuredClone(replaced) };
  });
  const replacementIndices = new Set<number>();
  const appendedTopologyFacetIndices: Record<string, number[]> = {};
  for (const join of nativeTopologyJoins) {
    if (replacementIndices.has(join.replaceSurfaceIndex)) throw Error('Duplicate native topology join replacement');
    replacementIndices.add(join.replaceSurfaceIndex);
    const surface = (facet: P[]) => ({ type: join.type, rings: [facet], previewAppearance: { role: join.role, colour: join.colour, sourceCropSha256: spec.source.cropSha256, disposition: 'inferred-preview' } });
    candidate.geometry.building.surfaces[join.replaceSurfaceIndex] = surface(join.facets[0]);
    appendedTopologyFacetIndices[join.name] = join.facets.slice(1).map(facet => { candidate.geometry.building.surfaces.push(surface(facet)); return candidate.geometry.building.surfaces.length - 1; });
  }
  const surfaceIndex = candidate.geometry.building.surfaces.length;
  candidate.geometry.building.surfaces.push(wall);
  const componentSurfaceIndices: Record<string, number> = {};
  for (const component of componentSurfaces) {
    if (!component.name || !component.role || !component.basis || !/^#[a-f0-9]{6}$/i.test(component.colour) || component.vertices.length < 3 || component.vertices.some(vertex => !Number.isFinite(vertex.x) || !Number.isFinite(vertex.y) || !Number.isFinite(vertex.normalOffsetM) || vertex.x < left || vertex.x > right || vertex.y < 0 || vertex.y > bottom)) throw Error('Invalid source component surface');
    if (componentSurfaceIndices[component.name] !== undefined) throw Error('Duplicate source component surface');
    componentSurfaceIndices[component.name] = candidate.geometry.building.surfaces.length;
    candidate.geometry.building.surfaces.push({ type: component.type, rings: [component.vertices.map(componentPoint)], previewAppearance: { role: component.role, colour: component.colour, sourceCropSha256: spec.source.cropSha256, disposition: 'inferred-preview' } });
  }
  candidate.geometryRevision = `candidate:${owner.geometryRevision}:${hash({ algorithm: 'source-facade-owner/v1', owner: owner.geometryRevision, spec }).slice(0, 16)}`;

  const observation = structuredClone(owner.observations[observationIndex]);
  observation.geometryRevision = candidate.geometryRevision;
  observation.payload.geometryRevision = candidate.geometryRevision;
  observation.payload.renderSurfaceIndices = [surfaceIndex];
  const wallStart = wall.rings[0][0], wallEnd = wall.rings[0][1];
  const wallLength = Math.hypot(wallEnd[0] - wallStart[0], wallEnd[2] - wallStart[2]);
  // Match wallAxis/facadeWallFrame exactly: it sorts the farthest pair by
  // local x then z. Source x may run in the opposite direction.
  const [axisStart, axisEnd] = [wallStart, wallEnd].sort((a, b) => a[0] - b[0] || a[2] - b[2]);
  const ux = (axisEnd[0] - axisStart[0]) / wallLength, uz = (axisEnd[2] - axisStart[2]) / wallLength;
  observation.payload.localStart = [wallStart[0], wallStart[2]];
  observation.payload.localEnd = [wallEnd[0], wallEnd[2]];
  observation.payload.mid = [(wallStart[0] + wallEnd[0]) / 2, (wallStart[2] + wallEnd[2]) / 2];
  observation.payload.wall = { ...observation.payload.wall, index: surfaceIndex, lengthM: wallLength };
  const sourceTransform = (source: SourceFeatureSet) => {
    const pointT = (point: { x: number; y: number }) => (point.x - origin.x - axisStart[0]) * ux + (origin.y - point.y - axisStart[2]) * uz;
    const startT = pointT(source.projection.plane.start), endT = pointT(source.projection.plane.end);
    const vertical = source.projection.plane.topZ - source.projection.plane.baseZ;
    return [(endT - startT) / source.width, 0, startT, 0, -vertical / source.height,
      source.projection.plane.topZ - source.projection.localToNAPOffsetM - wallStart[1], 0, 0, 1];
  };
  observation.payload.facadeDescription = {
    version: 1,
    extractionVersion: spec.extractionVersion,
    buildingId: candidate.id,
    geometryRevision: candidate.geometryRevision,
    evidenceKey: observation.payload.evidenceKey,
    frontage: [[wall.rings[0][0][0], wall.rings[0][0][2]], [wall.rings[0][1][0], wall.rings[0][1][2]]],
    surfaceIndices: [surfaceIndex],
    ...(spec.concaveMaterialPreview?{concaveMaterialPreview:structuredClone(spec.concaveMaterialPreview)}:{}),
    sources: Object.fromEntries(Object.entries(effectiveSources).map(([name, source]) => { const imageToWall = sourceTransform(source); return [name, {
      cropSha256: source.cropSha256,
      captureDate: source.captureDate,
      imageDimensions: { width: source.width, height: source.height },
      openingsComplete: false,
      features: structuredClone(source.features),
      registration: {
        status: 'ambiguous', uncertaintyM: 999, imageToWall, surfaceIndex,
        sourceDatum: 'NAP', canonicalDatum: 'surface-base', pixelConvention: 'pixel-edge',
        preview: { kind: 'native-crop-plane', cropSha256: source.cropSha256, imageDimensions: { width: source.width, height: source.height }, imageToWall,
          note: `${spec.sourceNote} Preview projection only; no registered observation is claimed.` },
      },
    }]; })),
  };
  candidate.observations[observationIndex] = observation;
  return {
    owner: candidate,
    provenance: {
      status: 'approximate-city-preview', registered: false,
      candidateAlgorithm: 'source-facade-owner/v1', correctionId: spec.id,
      sourceCropSha256: spec.source.cropSha256,
      baselineGeometryRevision: owner.geometryRevision, candidateGeometryRevision: candidate.geometryRevision,
      originalSurfaceCount: owner.geometry.building.surfaces.length, appendedFacadeSurfaceIndex: surfaceIndex,
      appendedComponentSurfaceIndices: componentSurfaceIndices,
      componentSurfaces: componentSurfaces.map(component => ({ name: component.name, role: component.role, colour: component.colour, basis: component.basis, inferredNormalOffsetsM: [...new Set(component.vertices.map(vertex => vertex.normalOffsetM))] })),
      componentAssemblies: (spec.componentAssemblies ?? []).map(component => ({ name: component.name, type: component.type, observedBoundsPx: component.boundsPx, observedBasis: component.observedBasis, projection: { status: 'inferred', depthM: component.projectionM, reason: component.inferredDepthBasis } })),
      nativeTopologyJoins: nativeTopologyJoins.map(join => ({ name: join.name, role: join.role, basis: join.basis, replaceSurfaceIndex: join.replaceSurfaceIndex, facetCount: join.facets.length, appendedFacetSurfaceIndices: appendedTopologyFacetIndices[join.name], replacedSurfaceSha256: hash(join.replacedSurface), nativeReferences: join.facetSpecs.flat().filter(vertex => 'native' in vertex).map(vertex => (vertex as { native: unknown }).native) })),
      preservedOriginalSurfaceIndices: true, preservedOriginalSurfacesInBaseline: true, candidateReplacedSurfaceIndices: [...replacementIndices], preservedObservationCount: candidate.observations.length,
      featureIdsBySource: Object.fromEntries(Object.entries(spec.sources).map(([name, source]) => [name, source.features.map(feature => feature.id)])),
      sourceFeatureOverrides,
      placement: spec.placement ?? { status: 'inferred', reason: 'The source sampling plane is reused for an approximate owner preview; metric placement is unverified.' },
      roofDepth: nativeTopologyJoins.length ? { status: 'topology-derived-preview', reason: 'The source front is joined only to exact retained native roof vertices; the hidden depth and folds remain inferred.' } : { status: 'abstained', reason: 'The single facade crop does not constrain a rear join or cap depth.' },
      unresolved: ['camera and vertical datum unverified', 'facade plane is source sampling evidence, not a measured registration', nativeTopologyJoins.length ? 'roof join is topology-derived and hidden roof depth remains unverified' : 'rear roof connection and depth intentionally omitted'],
    },
  };
}
