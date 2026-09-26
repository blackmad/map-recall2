/** An explicitly provisional real-owner geometry candidate for case 24.
 * Source pixels are intersected with the selected LoD2.2 wall plane. This is
 * a camera/plane hypothesis, not a registered or surveyed reconstruction.
 */
import { createHash } from 'node:crypto';

type P = [number, number, number];
type Surface = { type: string; rings: P[][] };
type Owner = { id: string; geometryRevision: string; geometry: { frame: { originRD: { x: number; y: number }; heightDatum: string }; building: { id: string; surfaces: Surface[] } } };
type V = { x: number; y: number; z: number };
type Comparison = { source: { buildingId: string; cropSha256: string; pose: V; samplingPlane: { start: { x: number; y: number }; end: { x: number; y: number }; baseZ: number; topZ: number }; dimensions: { width: number; height: number }; localToNAPOffsetM: number }; metric: { geometryRevision: string; wall: { surfaceIndex: number }; roofs: { surfaceIndex: number }[] }; observedGableOutlinePx: { x: number; y: number }[]; registration: { accepted: boolean } };
type SourceWindowEvidence = { width: number; height: number; cropSha256: string; captureDate: string; features: any[] };
const CANDIDATE_ALGORITHM = 'case24-building-gable/v6-topology-joined-roof';
const GABLE_WINDOW_TOP_Y_ESTIMATE_PX = 149;
const GABLE_WINDOW_DIVIDER_Y_ESTIMATE_PX = 158.84;

const dot2 = (a: V, b: V) => a.x * b.x + a.y * b.y;
const subtract = (a: V, b: V): V => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const mix = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function solve(values: number[][], answers: number[]): number[] {
  const rows = values.map((row, index) => [...row, answers[index]]);
  for (let column = 0; column < values.length; column++) {
    let pivot = column;
    for (let row = column + 1; row < rows.length; row++) if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    if (Math.abs(rows[pivot][column]) < 1e-10) throw Error('Source projection is singular');
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const scale = rows[column][column];
    for (let index = column; index <= values.length; index++) rows[column][index] /= scale;
    for (let row = 0; row < rows.length; row++) if (row !== column) {
      const factor = rows[row][column];
      for (let index = column; index <= values.length; index++) rows[row][index] -= factor * rows[column][index];
    }
  }
  return rows.map(row => row.at(-1)!);
}

function sourceToWallHomography(wall: P[], comparison: Comparison, owner: Owner): number[] {
  const width = comparison.source.dimensions.width, height = comparison.source.dimensions.height;
  const wallBase = Math.min(...wall.map(point => point[1]));
  const wallLength = Math.hypot(wall[3][0] - wall[0][0], wall[3][2] - wall[0][2]);
  const pairs = [[0, 0], [width, 0], [width, height], [0, height]].map(([x, y]) => {
    const point = sourcePixelOnWall(x, y, wall, comparison, owner);
    return { x, y, t: sourceXOnWall(point, wall) * wallLength, z: point[1] - wallBase };
  });
  const rows: number[][] = [], answers: number[] = [];
  for (const p of pairs) {
    rows.push([p.x, p.y, 1, 0, 0, 0, -p.t * p.x, -p.t * p.y]); answers.push(p.t);
    rows.push([0, 0, 0, p.x, p.y, 1, -p.z * p.x, -p.z * p.y]); answers.push(p.z);
  }
  return [...solve(rows, answers), 1];
}

function attachExperimentalWindows(candidate: Owner, baseline: Owner, wall: P[], wallIndex: number, comparison: Comparison, evidence: SourceWindowEvidence) {
  if (evidence.cropSha256 !== comparison.source.cropSha256 || evidence.width !== comparison.source.dimensions.width || evidence.height !== comparison.source.dimensions.height) throw Error('Source-window evidence mismatch');
  const selectedIds = new Set(['full:door-1', 'full:door-2', 'full:review:shop-display', 'full:material-2']);
  const windows = evidence.features.filter(feature => feature.disposition === 'agent-inspected'
    && ((feature.kind === 'window' && feature.row > 0) || feature.id === 'full:review:crown-vent' || selectedIds.has(feature.id))).map(feature => structuredClone(feature));
  if (windows.length !== 12 || selectedIds.size !== windows.filter(feature => selectedIds.has(feature.id)).length
    || windows.some(feature => !Array.isArray(feature.bounds) || feature.bounds.length !== 4)) throw Error('Reviewed source facade evidence unavailable');
  const gableWindow = windows.find(feature => feature.id === 'full:window-1');
  if (!gableWindow || gableWindow.head !== 'rectangular' || gableWindow.transom !== .24 || gableWindow.mullionScope !== 'below-transom') throw Error('Gable-window evidence changed');
  const [, originalTop, , originalBottom] = gableWindow.bounds;
  if (originalTop !== 143 || originalBottom !== 209) throw Error('Gable-window vertical bounds changed');
  // The blurry pinned crop places the pale outer head at approximately y=149,
  // while the existing divider remains at y=158.84. These are visual estimates,
  // not validated annotations. Preserve x extents, sill, and absolute divider.
  gableWindow.bounds[1] = GABLE_WINDOW_TOP_Y_ESTIMATE_PX;
  gableWindow.transom = (GABLE_WINDOW_DIVIDER_Y_ESTIMATE_PX - GABLE_WINDOW_TOP_Y_ESTIMATE_PX) / (originalBottom - GABLE_WINDOW_TOP_Y_ESTIMATE_PX);
  // The narrow region below the pale outer head has a dark appearance; model
  // that appearance without claiming its physical material.
  gableWindow.opaqueHeadAboveTransom = true;
  const original: any = (baseline as any).observations?.find((entry: any) => entry.payload?.wall?.index === wallIndex);
  if (!original) throw Error('Selected wall observation unavailable');
  const observation = structuredClone(original);
  observation.geometryRevision = candidate.geometryRevision;
  observation.payload.geometryRevision = candidate.geometryRevision;
  observation.payload.renderSurfaceIndices = [wallIndex];
  // This candidate owns reviewed full-crop openings, including both entrances
  // and the display. Do not let inherited machine routing add another shop.
  observation.payload.effectiveProposal = { ...observation.payload.effectiveProposal, groundUsable: 'unknown', shopfront: 'unknown' };
  const imageToWall = sourceToWallHomography(wall, comparison, baseline);
  observation.payload.facadeDescription = {
    version: 1,
    extractionVersion: 'case24-source-facade-candidate/v4-doors-and-display',
    buildingId: candidate.id,
    geometryRevision: candidate.geometryRevision,
    evidenceKey: observation.payload.evidenceKey,
    frontage: [observation.payload.localStart, observation.payload.localEnd],
    surfaceIndices: [wallIndex],
    sources: { full: {
      cropSha256: evidence.cropSha256,
      captureDate: evidence.captureDate,
      imageDimensions: { width: evidence.width, height: evidence.height },
      openingsComplete: false,
      features: windows,
      registration: {
        // Sentinel for unknown metric accuracy. The preview compiler replaces
        // this with its own conservative fitting tolerance; neither is a
        // measured registration uncertainty.
        status: 'ambiguous', uncertaintyM: 999, imageToWall, surfaceIndex: wallIndex,
        sourceDatum: 'NAP', canonicalDatum: 'surface-base', pixelConvention: 'pixel-edge',
        preview: { kind: 'native-crop-plane', cropSha256: evidence.cropSha256, imageDimensions: { width: evidence.width, height: evidence.height }, imageToWall,
          note: 'Experimental ray-plane projection for the isolated case-24 city candidate; it is not a registered observation.' },
      },
    } },
  };
  (candidate as any).observations = [observation];
  return windows.map(feature => feature.id);
}

function sourcePixelOnWall(x: number, y: number, wall: P[], comparison: Comparison, owner: Owner): P {
  const { pose, samplingPlane: plane, dimensions, localToNAPOffsetM: offset } = comparison.source;
  const target: V = {
    x: plane.start.x + x / dimensions.width * (plane.end.x - plane.start.x),
    y: plane.start.y + x / dimensions.width * (plane.end.y - plane.start.y),
    z: plane.topZ - y / dimensions.height * (plane.topZ - plane.baseZ),
  };
  const origin = owner.geometry.frame.originRD;
  const world = (p: P): V => ({ x: origin.x + p[0], y: origin.y - p[2], z: p[1] + offset });
  const a = world(wall[0]), b = world(wall[3]);
  const tangent = subtract(b, a), normal = { x: -tangent.y, y: tangent.x, z: 0 };
  const ray = subtract(target, pose), denominator = dot2(ray, normal);
  if (Math.abs(denominator) < 1e-8) throw Error('Crop ray is parallel to selected wall');
  const lambda = dot2(subtract(a, pose), normal) / denominator;
  if (!(lambda > 0)) throw Error('Selected wall is behind the source camera');
  const hit = { x: pose.x + ray.x * lambda, y: pose.y + ray.y * lambda, z: pose.z + ray.z * lambda };
  return [hit.x - origin.x, hit.z - offset, origin.y - hit.y];
}

function sourceXOnWall(point: P, wall: P[]): number {
  const left = wall[0], right = wall[3], direction = subtract({ x: right[0], y: right[2], z: 0 }, { x: left[0], y: left[2], z: 0 });
  const length2 = dot2(direction, direction);
  const t = dot2({ x: point[0] - left[0], y: point[2] - left[2], z: 0 }, direction) / length2;
  return t;
}

function fitRoofPlane(roof: P[]) {
  const normal = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], answers = [0, 0, 0];
  for (const [x, y, z] of roof) {
    const row = [x, z, 1];
    for (let i = 0; i < 3; i++) {
      answers[i] += row[i] * y;
      for (let j = 0; j < 3; j++) normal[i][j] += row[i] * row[j];
    }
  }
  const [a, b, c] = solve(normal, answers);
  const residualM = Math.max(...roof.map(([x, y, z]) => Math.abs(y - (a * x + b * z + c))));
  if (residualM > .02) throw Error(`Attached LoD2.2 roof is not planar enough to join (${residualM}m)`);
  return { height: (x: number, z: number) => a * x + b * z + c, residualM };
}

function clipRoofBehindDepth(roof: P[], origin: P, direction: { x: number; z: number }, depth: number): P[] {
  const signedDepth = (point: P) => (point[0] - origin[0]) * direction.x + (point[2] - origin[2]) * direction.z - depth;
  const result: P[] = [];
  for (let i = 0; i < roof.length; i++) {
    const a = roof[i], b = roof[(i + 1) % roof.length];
    const da = signedDepth(a), db = signedDepth(b), aInside = da >= -1e-8, bInside = db >= -1e-8;
    if (aInside) result.push(structuredClone(a));
    if (aInside !== bInside) result.push(mix(a, b, da / (da - db)));
  }
  if (result.length < 3) throw Error('Assumed cap depth removes the attached LoD2.2 roof');
  return result;
}

/** Returns an isolated candidate. The original owner is never modified.
 * The source-derived front outline joins the retained LoD2.2 roof at an
 * explicitly assumed depth. This makes a coherent preview mesh; it does not
 * turn the source projection or roof depth into a registered observation.
 */
export function buildBuildingGableCandidate(owner: Owner, comparison: Comparison, options: { assumedCapDepthM?: number; sourceWindowEvidence?: SourceWindowEvidence } = {}) {
  if (owner.id !== '0363100012155539' || owner.geometry.building.id !== owner.id || comparison.source.buildingId !== owner.id || comparison.metric.geometryRevision !== owner.geometryRevision) throw Error('Owner or geometry revision mismatch');
  if (comparison.registration.accepted !== false || comparison.source.cropSha256 !== 'd41fbad9b2cab955a11725296c74f17d65e9e36907763f86eaf1396467186ebb') throw Error('Unexpected source or registration status');
  if (owner.geometry.frame.heightDatum !== 'legacy-block-NAP-minus-0.65m') throw Error('Unsupported height datum');
  const depth = options.assumedCapDepthM ?? 2;
  if (!(depth > 0 && depth <= 4)) throw Error('Cap depth must be an explicit conservative local assumption');
  const wallIndex = comparison.metric.wall.surfaceIndex;
  const roofIndex = comparison.metric.roofs.find(x => x.surfaceIndex === 9)?.surfaceIndex;
  if (roofIndex === undefined) throw Error('Attached roof surface missing');
  const surfaces = owner.geometry.building.surfaces;
  const wall = surfaces[wallIndex]?.rings[0], roof = surfaces[roofIndex]?.rings[0];
  if (surfaces[wallIndex]?.type !== 'wall' || wall?.length !== 4 || surfaces[roofIndex]?.type !== 'roof' || !roof || roof.length < 4) throw Error('Selected LoD2.2 topology changed');
  const wallKey = hash(wall), roofKey = hash(roof);
  const expectedWall = comparison.metric.wall as any;
  if (expectedWall.localVertices && hash(expectedWall.localVertices) !== wallKey) throw Error('Selected wall vertices changed');
  const expectedRoof = comparison.metric.roofs.find(x => x.surfaceIndex === roofIndex) as any;
  if (expectedRoof?.localVertices && hash(expectedRoof.localVertices) !== roofKey) throw Error('Selected roof vertices changed');
  const source = comparison.observedGableOutlinePx;
  if (source.length < 4 || source.some((p, i) => !Number.isFinite(p.x) || !Number.isFinite(p.y) || (i && p.x < source[i - 1].x))) throw Error('Invalid ordered source outline');
  const leftPx = 4.0614744614072, rightPx = 208.9276621529886;
  const outlineY = (x: number) => {
    const i = source.findIndex((p, j) => j > 0 && p.x >= x);
    if (i < 1) throw Error('Source outline does not cover wall');
    const a = source[i - 1], b = source[i];
    return a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x);
  };
  const clipped = [{ x: leftPx, y: outlineY(leftPx) }, ...source.filter(p => p.x > leftPx && p.x < rightPx), { x: rightPx, y: outlineY(rightPx) }];
  const top = clipped.map(p => sourcePixelOnWall(p.x, p.y, wall, comparison, owner));
  if (top.some((p, i) => Math.abs(sourceXOnWall(p, wall) - (clipped[i].x - leftPx) / (rightPx - leftPx)) > .06)) throw Error('Projected source outline is not bound to selected wall');
  const baseLeft = wall[1], baseRight = wall[2];
  const gableWall: Surface = { type: 'wall', rings: [[baseLeft, baseRight, ...top.slice().reverse()]] };
  const midpoint = mix(top[0], top[top.length - 1], .5);
  const rear = roof.slice(0, -2).reduce((p, q) => [p[0] + q[0], 0, p[2] + q[2]] as P, [0, 0, 0] as P).map((v, i) => v / (roof.length - 2)) as P;
  const toRear = { x: rear[0] - midpoint[0], z: rear[2] - midpoint[2] };
  const frontage = { x: wall[3][0] - wall[0][0], z: wall[3][2] - wall[0][2] };
  const frontageLength = Math.hypot(frontage.x, frontage.z);
  let inward = { x: -frontage.z / frontageLength, z: frontage.x / frontageLength };
  if (inward.x * toRear.x + inward.z * toRear.z < 0) inward = { x: -inward.x, z: -inward.z };
  if (!(inward.x * toRear.x + inward.z * toRear.z > depth)) throw Error('Attached roof does not establish an inward direction');
  const roofPlane = fitRoofPlane(roof);
  const retainedRoofRing = clipRoofBehindDepth(roof, midpoint, inward, depth);
  let cutPoints = retainedRoofRing.filter(point => Math.abs((point[0] - midpoint[0]) * inward.x + (point[2] - midpoint[2]) * inward.z - depth) < 1e-6);
  if (cutPoints.length !== 2) throw Error('Attached LoD2.2 roof does not expose one unambiguous join edge');
  const wallLeft = wall[0], distance2 = (a: P, b: P) => (a[0] - b[0]) ** 2 + (a[2] - b[2]) ** 2;
  if (distance2(cutPoints[1], wallLeft) < distance2(cutPoints[0], wallLeft)) cutPoints = [cutPoints[1], cutPoints[0]];
  const joined = (p: P): P => {
    const t = sourceXOnWall(p, wall);
    return mix(cutPoints[0], cutPoints[1], t);
  };
  const crown = top.reduce((best, p) => p[1] > best[1] ? p : best, top[0]);
  const crownIndex = top.indexOf(crown);
  if (crownIndex < 2 || crownIndex > top.length - 3) throw Error('No central gable crown');
  const cap: Surface[] = [];
  for (let i = 0; i < top.length - 1; i++) {
    const a = top[i], b = top[i + 1];
    cap.push({ type: 'roof', rings: [[a, b, joined(b), joined(a)]] });
  }
  const retainedRoof: Surface = { type: 'roof', rings: [retainedRoofRing] };
  const candidate = structuredClone(owner);
  // Preserve every original surface index for renderer picking and bound
  // feature recipes. Additional cap facets live after the baseline surfaces.
  const leftSideIndex = surfaces.findIndex((surface, index) => index !== wallIndex && surface.type === 'wall' && surface.rings[0].some(point => point.every((value, axis) => Math.abs(value - wall[0][axis]) < 1e-6)));
  const rightSideIndex = surfaces.findIndex((surface, index) => index !== wallIndex && surface.type === 'wall' && surface.rings[0].some(point => point.every((value, axis) => Math.abs(value - wall[3][axis]) < 1e-6)));
  if (leftSideIndex < 0 || rightSideIndex < 0 || leftSideIndex === rightSideIndex) throw Error('Adjacent side walls unavailable');
  const joinedSide = (surface: Surface, oldPoint: P, newPoint: P): Surface => ({ ...structuredClone(surface), rings: surface.rings.map(ring => {
    const oldIndex = ring.findIndex(point => point.every((value, axis) => Math.abs(value - oldPoint[axis]) < 1e-6));
    if (oldIndex < 0) return structuredClone(ring);
    const result = ring.map(point => structuredClone(point));
    result[oldIndex] = newPoint;
    // Both side rings run from the front top toward the rear top across their
    // closing edge. Insert the exact roof-join point into that edge so the
    // lowered source eave does not create a long, open triangular wedge.
    const join = joined(newPoint);
    if (oldIndex === 0) result.push(join); else result.splice(oldIndex + 1, 0, join);
    return result;
  }) });
  candidate.geometry.building.surfaces = surfaces.map((surface, index) => index === wallIndex ? gableWall : index === roofIndex ? retainedRoof
    : index === leftSideIndex ? joinedSide(surface, wall[0], top[0]) : index === rightSideIndex ? joinedSide(surface, wall[3], top.at(-1)!) : structuredClone(surface)).concat(cap);
  const sideKeys = [leftSideIndex, rightSideIndex].map(index => hash(surfaces[index]));
  const windowEvidenceKey = options.sourceWindowEvidence ? hash(options.sourceWindowEvidence) : null;
  candidate.geometryRevision = `candidate:${owner.geometryRevision}:${hash({ algorithm: CANDIDATE_ALGORITHM, wallKey, roofKey, sideKeys, clipped, depth, windowEvidenceKey }).slice(0, 16)}`;
  const projectedWindowFeatureIds = options.sourceWindowEvidence ? attachExperimentalWindows(candidate, owner, wall, wallIndex, comparison, options.sourceWindowEvidence) : [];
  return { owner: candidate, provenance: {
    status: 'approximate-city-preview', registered: false, sourceCropSha256: comparison.source.cropSha256,
    baselineGeometryRevision: owner.geometryRevision, candidateGeometryRevision: candidate.geometryRevision,
    replacedSourceSurfaceIndices: [wallIndex], clippedSourceSurfaceIndices: [leftSideIndex, rightSideIndex, roofIndex], assumedCapDepthM: depth,
    roofCompletion: { status: 'topology-derived-preview', registered: false, retainedRoofSurfaceIndex: roofIndex, appendedFacetCount: cap.length,
      basis: 'source-derived front outline joined at assumed depth to the clipped boundary of the original LoD2.2 roof', originalRoofPlaneMaxResidualM: roofPlane.residualM },
    candidateAlgorithm: CANDIDATE_ALGORITHM,
    sourceWindowCandidate: { enabled: projectedWindowFeatureIds.length > 0, registrationStatus: 'ambiguous', reportedUncertaintyM: 'unknown (999 sentinel)', previewCompilerToleranceM: .15,
      previewCompilerToleranceMeaning: 'conservative feature-fitting threshold, not measured registration accuracy', surfaceIndex: wallIndex, featureIds: projectedWindowFeatureIds,
      componentCorrection: options.sourceWindowEvidence ? {
        featureId: 'full:window-1', scope: 'top bound and dark head infill only; x extents, sill, absolute divider, lower glazing, and all other features preserved',
        sourceRationale: 'The blurry pinned source places the pale outer head near y=149 and the internal divider near y=158.84. These are visual estimates, not validated annotations, and the image does not establish the dark region’s physical material.',
        sourcePixelEstimates: { topY: GABLE_WINDOW_TOP_Y_ESTIMATE_PX, dividerY: GABLE_WINDOW_DIVIDER_Y_ESTIMATE_PX, uncertainty: 'blurred source; approximate visual placement' },
      } : null },
    unresolved: ['camera and vertical datum unverified', 'cap depth remains assumed because no independent cached depth view was found', 'roof join is topology-derived and not source registered'],
  } };
}
