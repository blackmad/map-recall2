export type Point3 = readonly [number, number, number];

export interface RgbPoint {
  x: number;
  y: number;
  z: number;
  red: number;
  green: number;
  blue: number;
}

export interface FacadeWallPlane {
  buildingId: string;
  surfaceId: string;
  exterior: boolean;
  vertices: Point3[];
  normal: Point3;
  areaSquareMetres: number;
}

export interface RoofPlane {
  buildingId: string;
  surfaceId: string;
  vertices: Point3[];
  normal: Point3;
  areaSquareMetres: number;
  slopeDegrees: number | null;
  azimuthDegrees: number | null;
}

type SemanticSurface = { type?: string; on_footprint_edge?: boolean; b3_hellingshoek?: number; b3_azimut?: number };
type CityGeometry = {
  lod?: string | number;
  boundaries?: number[][][][];
  semantics?: { surfaces?: SemanticSurface[]; values?: number[][] };
};

type CityJsonFeature = {
  id?: string;
  CityObjects?: Record<string, { type?: string; geometry?: CityGeometry[] }>;
  vertices?: number[][];
};

type CityJsonResponse = {
  metadata?: { transform?: { scale?: number[]; translate?: number[] } };
  feature?: CityJsonFeature;
};

const subtract = (a: Point3, b: Point3): Point3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Point3, b: Point3): Point3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const magnitude = (value: Point3) => Math.hypot(...value);
const normalize = (value: Point3): Point3 => {
  const length = magnitude(value);
  return length ? [value[0] / length, value[1] / length, value[2] / length] : [0, 0, 0];
};

const polygonNormal = (vertices: readonly Point3[]): Point3 => {
  let x = 0; let y = 0; let z = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    x += (current[1] - next[1]) * (current[2] + next[2]);
    y += (current[2] - next[2]) * (current[0] + next[0]);
    z += (current[0] - next[0]) * (current[1] + next[1]);
  }
  return normalize([x, y, z]);
};

const polygonArea = (vertices: readonly Point3[], normal: Point3) => {
  let sum: Point3 = [0, 0, 0];
  for (let index = 0; index < vertices.length; index += 1) {
    const edge = cross(vertices[index], vertices[(index + 1) % vertices.length]);
    sum = [sum[0] + edge[0], sum[1] + edge[1], sum[2] + edge[2]];
  }
  return Math.abs(sum[0] * normal[0] + sum[1] * normal[1] + sum[2] * normal[2]) / 2;
};

/** Extract semantic exterior LoD2.2 walls from a single-building 3DBAG response. */
export function extractFacadeWallPlanes(response: CityJsonResponse): FacadeWallPlane[] {
  const feature = response.feature;
  const transform = response.metadata?.transform;
  if (!feature?.vertices || !feature.CityObjects || !transform?.scale || !transform.translate) return [];
  const vertices = feature.vertices.map((vertex): Point3 => [
    vertex[0] * transform.scale![0] + transform.translate![0],
    vertex[1] * transform.scale![1] + transform.translate![1],
    vertex[2] * transform.scale![2] + transform.translate![2],
  ]);
  const buildingId = (feature.id || Object.keys(feature.CityObjects).find((key) => feature.CityObjects![key].type === 'Building') || '').replace('NL.IMBAG.Pand.', 'bag:');
  const walls: FacadeWallPlane[] = [];
  for (const [objectId, object] of Object.entries(feature.CityObjects)) {
    for (const geometry of object.geometry || []) {
      if (String(geometry.lod) !== '2.2' || !geometry.boundaries || !geometry.semantics) continue;
      const shell = geometry.boundaries[0] || [];
      const values = geometry.semantics.values?.[0] || [];
      shell.forEach((surface, surfaceIndex) => {
        const semantic = geometry.semantics!.surfaces?.[values[surfaceIndex]];
        if (semantic?.type !== 'WallSurface' || semantic.on_footprint_edge === false) return;
        const ring = surface[0] || [];
        const polygon = ring.map((index) => vertices[index]).filter(Boolean);
        if (polygon.length < 3) return;
        const normal = polygonNormal(polygon);
        walls.push({
          buildingId,
          surfaceId: `${objectId}:lod22:wall:${surfaceIndex}`,
          exterior: true,
          vertices: polygon,
          normal,
          areaSquareMetres: polygonArea(polygon, normal),
        });
      });
    }
  }
  return walls;
}

/** Extract semantic LoD2.2 roof planes without collapsing them to a BAG footprint. */
export function extractRoofPlanes(response: CityJsonResponse): RoofPlane[] {
  const feature = response.feature;
  const transform = response.metadata?.transform;
  if (!feature?.vertices || !feature.CityObjects || !transform?.scale || !transform.translate) return [];
  const vertices = feature.vertices.map((vertex): Point3 => [
    vertex[0] * transform.scale![0] + transform.translate![0],
    vertex[1] * transform.scale![1] + transform.translate![1],
    vertex[2] * transform.scale![2] + transform.translate![2],
  ]);
  const buildingId = (feature.id || Object.keys(feature.CityObjects).find((key) => feature.CityObjects![key].type === 'Building') || '').replace('NL.IMBAG.Pand.', 'bag:');
  const roofs: RoofPlane[] = [];
  for (const [objectId, object] of Object.entries(feature.CityObjects)) {
    for (const geometry of object.geometry || []) {
      if (String(geometry.lod) !== '2.2' || !geometry.boundaries || !geometry.semantics) continue;
      const shell = geometry.boundaries[0] || [];
      const values = geometry.semantics.values?.[0] || [];
      shell.forEach((surface, surfaceIndex) => {
        const semantic = geometry.semantics!.surfaces?.[values[surfaceIndex]];
        if (semantic?.type !== 'RoofSurface') return;
        const polygon = (surface[0] || []).map((index) => vertices[index]).filter(Boolean);
        if (polygon.length < 3) return;
        const normal = polygonNormal(polygon);
        roofs.push({ buildingId, surfaceId: `${objectId}:lod22:roof:${surfaceIndex}`, vertices: polygon, normal, areaSquareMetres: polygonArea(polygon, normal), slopeDegrees: semantic.b3_hellingshoek ?? null, azimuthDegrees: semantic.b3_azimut ?? null });
      });
    }
  }
  return roofs;
}

const dominantAxis = (normal: Point3) => {
  const absolute = normal.map(Math.abs);
  return absolute[0] >= absolute[1] && absolute[0] >= absolute[2] ? 0 : absolute[1] >= absolute[2] ? 1 : 2;
};

const project2d = (point: Point3, drop: number): readonly [number, number] => drop === 0 ? [point[1], point[2]] : drop === 1 ? [point[0], point[2]] : [point[0], point[1]];

const insidePolygon = (point: readonly [number, number], polygon: readonly (readonly [number, number])[]) => {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [x1, y1] = polygon[index]; const [x2, y2] = polygon[previous];
    if ((y1 > point[1]) !== (y2 > point[1]) && point[0] < ((x2 - x1) * (point[1] - y1)) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
};

const median = (values: readonly number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const normalizeRgb = (value: number) => Math.max(0, Math.min(255, value > 255 ? value / 257 : value));
const luminance = (rgb: readonly number[]) => (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
const colourDistance = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export type FacadeColourResult = {
  status: 'accepted' | 'rejected';
  reason?: 'too-few-points' | 'sparse-coverage' | 'shadowed' | 'mixed-colours';
  sampleCount: number;
  coverage: number;
  rgb?: readonly [number, number, number];
  hex?: string;
  dispersion?: number;
  planeOffsetMetres?: number;
};

/** Robustly measure a wall colour, abstaining on sparse, shadowed or mixed evidence. */
export function measureSurfaceColour(
  wall: Pick<FacadeWallPlane, 'vertices' | 'normal'>,
  points: readonly RgbPoint[],
  options: { maximumPlaneDistance?: number; maximumOffsetSearch?: number; minimumPoints?: number; gridSize?: number } = {},
): FacadeColourResult {
  const maximumPlaneDistance = options.maximumPlaneDistance ?? 0.12;
  const minimumPoints = options.minimumPoints ?? 80;
  const gridSize = options.gridSize ?? 0.75;
  const origin = wall.vertices[0];
  const axis = dominantAxis(wall.normal);
  const polygon = wall.vertices.map((vertex) => project2d(vertex, axis));
  const candidates = points.map((point) => {
    const offset = subtract([point.x, point.y, point.z], origin);
    const distance = offset[0] * wall.normal[0] + offset[1] * wall.normal[1] + offset[2] * wall.normal[2];
    return { point, distance };
  }).filter(({ point, distance }) => insidePolygon(project2d([point.x, point.y, point.z], axis), polygon) && Math.abs(distance) <= (options.maximumOffsetSearch ?? maximumPlaneDistance));
  let planeOffsetMetres = 0;
  if (options.maximumOffsetSearch && candidates.length) {
    const binWidth = 0.05; const bins = new Map<number, number>();
    for (const candidate of candidates) { const bin = Math.round(candidate.distance / binWidth); bins.set(bin, (bins.get(bin) || 0) + 1); }
    const modalBin = [...bins].sort((a, b) => b[1] - a[1] || Math.abs(a[0]) - Math.abs(b[0]))[0]?.[0] || 0;
    planeOffsetMetres = modalBin * binWidth;
  }
  const selected = candidates.filter(({ distance }) => Math.abs(distance - planeOffsetMetres) <= maximumPlaneDistance)
    .map(({ point }) => ({ point, rgb: [normalizeRgb(point.red), normalizeRgb(point.green), normalizeRgb(point.blue)] as const }))
    .filter(({ rgb }) => luminance(rgb) > 0.025 && luminance(rgb) < 0.98);
  if (selected.length < minimumPoints) return { status: 'rejected', reason: 'too-few-points', sampleCount: selected.length, coverage: 0, planeOffsetMetres };
  const projected = wall.vertices.map((point) => project2d(point, axis));
  const minA = Math.min(...projected.map((point) => point[0])); const maxA = Math.max(...projected.map((point) => point[0]));
  const minB = Math.min(...projected.map((point) => point[1])); const maxB = Math.max(...projected.map((point) => point[1]));
  const cells = new Map<string, Array<readonly [number, number, number]>>();
  for (const { point, rgb } of selected) {
    const projectedPoint = project2d([point.x, point.y, point.z], axis);
    const key = `${Math.floor((projectedPoint[0] - minA) / gridSize)}:${Math.floor((projectedPoint[1] - minB) / gridSize)}`;
    const values = cells.get(key) || [];
    values.push(rgb);
    cells.set(key, values);
  }
  const possibleCells = Math.max(1, Math.ceil((maxA - minA) / gridSize) * Math.ceil((maxB - minB) / gridSize));
  const coverage = Math.min(1, cells.size / possibleCells);
  if (coverage < 0.18) return { status: 'rejected', reason: 'sparse-coverage', sampleCount: selected.length, coverage, planeOffsetMetres };
  // Equal-weight grid-cell medians prevent a dense window, sign or scan strip
  // from overwhelming the actual wall field merely because it has more points.
  const cellColours = [...cells.values()].map((values) => [median(values.map((value) => value[0])), median(values.map((value) => value[1])), median(values.map((value) => value[2]))] as const);
  const rgb = [median(cellColours.map((value) => value[0])), median(cellColours.map((value) => value[1])), median(cellColours.map((value) => value[2]))].map(Math.round) as [number, number, number];
  const wallLuminance = luminance(rgb);
  if (wallLuminance < 0.11) return { status: 'rejected', reason: 'shadowed', sampleCount: selected.length, coverage, rgb, planeOffsetMetres };
  const distances = cellColours.map((value) => colourDistance(value, rgb)).sort((a, b) => a - b);
  const dispersion = distances[Math.floor(distances.length * 0.8)];
  if (dispersion > 92) return { status: 'rejected', reason: 'mixed-colours', sampleCount: selected.length, coverage, rgb, dispersion, planeOffsetMetres };
  return { status: 'accepted', sampleCount: selected.length, coverage, rgb, hex: `#${rgb.map((value) => value.toString(16).padStart(2, '0')).join('')}`, dispersion, planeOffsetMetres };
}

/** Backwards-compatible façade-specific name. */
export const measureFacadeColour = measureSurfaceColour;
