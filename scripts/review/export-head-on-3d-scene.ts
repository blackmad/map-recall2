/** Export diagnostic Nano Banana strips on real 3DBAG LoD2.2 surfaces. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {ShapeUtils, Vector2} from 'three';

type Point3 = [number, number, number];
type Point2 = [number, number];
type Plane = {start: {x: number; y: number}; end: {x: number; y: number}; baseZ: number; topZ: number};
type Surface = {type?: string; on_footprint_edge?: boolean};
type Geometry = {lod?: string | number; boundaries?: number[][][][]; semantics?: {surfaces?: Surface[]; values?: number[][]}};
type Feature = {id: string; vertices: number[][]; CityObjects: Record<string, {geometry?: Geometry[]}>};
type Tile = {features: Feature[]; metadata: {transform: {scale: number[]; translate: number[]}}};
type Binding = {contextPath: string; contextSha256: string; evidenceManifestPath: string; evidenceManifestSha256: string; evidenceRecordId: string; panoramaPath: string; panoramaSha256: string; panoramaId: string; contextCropBounds: [number, number, number, number]; contextSize: [number, number]; cropPath: string; cropSha256: string; cropSize: [number, number]};
type Mesh = {id: string; buildingId: string; kind: 'wall' | 'roof' | 'ground'; positions: number[]; indices: number[]; uvs?: number[]; textured: boolean; sourceTileSha256: string};

const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const readJson = async <T>(file: string): Promise<T> => JSON.parse(await fs.readFile(file, 'utf8')) as T;
const absolute = (file: string, root: string) => path.isAbsolute(file) ? file : path.resolve(root, file);
const round = (value: number) => Number(value.toFixed(4));
const dot = (a: Point2, b: Point2) => a[0] * b[0] + a[1] * b[1];

function normal(vertices: Point3[]): Point3 {
  const n: Point3 = [0, 0, 0];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const size = Math.hypot(...n);
  return size ? [n[0] / size, n[1] / size, n[2] / size] : [0, 0, 0];
}

function project(point: Point3, axis: number): Vector2 {
  if (axis === 0) return new Vector2(point[1], point[2]);
  if (axis === 1) return new Vector2(point[0], point[2]);
  return new Vector2(point[0], point[1]);
}

function triangulate(rings: Point3[][]): {vertices: Point3[]; indices: number[]} | null {
  const outer = rings[0];
  if (!outer || outer.length < 3) return null;
  const n = normal(outer);
  const axis = Math.abs(n[0]) > Math.abs(n[1]) && Math.abs(n[0]) > Math.abs(n[2]) ? 0 : Math.abs(n[1]) > Math.abs(n[2]) ? 1 : 2;
  const contour = outer.map(point => project(point, axis));
  const holes = rings.slice(1).map(ring => ring.map(point => project(point, axis)));
  const vertices = rings.flat();
  const indices = ShapeUtils.triangulateShape(contour, holes).flat();
  return indices.length ? {vertices, indices} : null;
}

function planeCoordinates(point: Point3, plane: Plane): {u: number; distance: number} {
  const dx = plane.end.x - plane.start.x, dy = plane.end.y - plane.start.y;
  const length = Math.hypot(dx, dy);
  const offset: Point2 = [point[0] - plane.start.x, point[1] - plane.start.y];
  return {u: dot(offset, [dx, dy]) / (length * length), distance: (offset[0] * dy - offset[1] * dx) / length};
}

function decode(tile: Tile, feature: Feature): Point3[] {
  const {scale, translate} = tile.metadata.transform;
  return feature.vertices.map(vertex => [0, 1, 2].map(i => vertex[i] * scale[i] + translate[i]) as Point3);
}

function surfaces(feature: Feature, decoded: Point3[]): Array<{id: string; kind: Mesh['kind']; rings: Point3[][]; normal: Point3}> {
  const result: Array<{id: string; kind: Mesh['kind']; rings: Point3[][]; normal: Point3}> = [];
  for (const [objectId, object] of Object.entries(feature.CityObjects)) {
    for (const geometry of object.geometry ?? []) {
      if (String(geometry.lod) !== '2.2' || !geometry.boundaries || !geometry.semantics) continue;
      const shell = geometry.boundaries[0] ?? [];
      const values = geometry.semantics.values?.[0] ?? [];
      shell.forEach((surface, i) => {
        const semantic = geometry.semantics!.surfaces?.[values[i]];
        const kind = semantic?.type === 'WallSurface' ? 'wall' : semantic?.type === 'RoofSurface' ? 'roof' : semantic?.type === 'GroundSurface' ? 'ground' : null;
        if (!kind || (kind === 'wall' && semantic?.on_footprint_edge === false)) return;
        const rings = surface.map(ring => ring.map(index => decoded[index]).filter(Boolean)).filter(ring => ring.length >= 3);
        if (!rings.length) return;
        result.push({id: `${objectId}:lod22:${kind}:${i}`, kind, rings, normal: normal(rings[0])});
      });
    }
  }
  return result;
}

function frontWall(surface: ReturnType<typeof surfaces>[number], plane: Plane, cameraDirection: Point2): boolean {
  if (surface.kind !== 'wall') return false;
  const points = surface.rings.flat();
  const maxDistance = Math.max(...points.map(point => Math.abs(planeCoordinates(point, plane).distance)));
  return maxDistance <= 1.5 && dot([surface.normal[0], surface.normal[1]], cameraDirection) >= 0.75;
}

function meshFromSurface(surface: ReturnType<typeof surfaces>[number], buildingId: string, tileSha: string, origin: Point3, plane: Plane, crop: Binding['contextCropBounds'], size: Binding['contextSize'], textured: boolean): Mesh | null {
  const triangulated = triangulate(surface.rings);
  if (!triangulated) return null;
  const [x0, y0, x1, y1] = crop;
  const positions = triangulated.vertices.flatMap(point => [round(point[0] - origin[0]), round(point[2] - origin[2]), round(-(point[1] - origin[1]))]);
  const uvs = textured ? triangulated.vertices.flatMap(point => {
    const {u} = planeCoordinates(point, plane);
    const sourceX = u * size[0];
    const sourceY = (plane.topZ - point[2]) / (plane.topZ - plane.baseZ) * size[1];
    return [round((sourceX - x0) / (x1 - x0)), round(1 - (sourceY - y0) / (y1 - y0))];
  }) : undefined;
  return {id: surface.id, buildingId, kind: surface.kind, positions, indices: triangulated.indices, ...(uvs ? {uvs} : {}), textured, sourceTileSha256: tileSha};
}

async function main() {
  const args = process.argv.slice(2);
  const option = (name: string, fallback: string) => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
  if (args.some(arg => !/^--(source-root|out)=/.test(arg))) throw Error('Supported flags: --source-root=<repo> --out=<directory>');
  const sourceRoot = path.resolve(option('source-root', process.cwd()));
  const outRoot = path.resolve(option('out', path.join(sourceRoot, 'public/data/facade-review-galleries/head-on-3d-v1')));
  const inputDir = path.join(sourceRoot, '.cache/facade-assessment/banana-head-on-v1/inputs');
  const selection = await readJson<{sources: Record<string, Binding>}>(path.join(inputDir, 'selection-provenance.json'));
  const rows = [];
  for (const [job, binding] of Object.entries(selection.sources)) {
    const context = absolute(binding.contextPath, sourceRoot), evidence = absolute(binding.evidenceManifestPath, sourceRoot), panorama = absolute(binding.panoramaPath, sourceRoot);
    for (const [file, expected] of [[context, binding.contextSha256], [evidence, binding.evidenceManifestSha256], [panorama, binding.panoramaSha256], [path.join(inputDir, binding.cropPath), binding.cropSha256]] as const) {
      if (sha(await fs.readFile(file)) !== expected) throw Error(`${job}: source hash changed: ${file}`);
    }
    const evidenceData = await readJson<{records: Array<{id: string; buildingId: string; address?: string; images: {context: {plane: Plane; panoramaId: string; sha256: string}}}>}>(evidence);
    const record = evidenceData.records.find(row => row.id === binding.evidenceRecordId);
    if (!record || record.images.context.panoramaId !== binding.panoramaId || record.images.context.sha256 !== binding.contextSha256) throw Error(`${job}: evidence binding changed`);
    const plane = record.images.context.plane;
    const delta: Point2 = [plane.end.x - plane.start.x, plane.end.y - plane.start.y];
    const length = Math.hypot(...delta);
    const candidateNormal: Point2 = [delta[1] / length, -delta[0] / length];
    const pose = (record.images.context as unknown as {pose?: {x: number; y: number}}).pose;
    if (!pose) throw Error(`${job}: camera pose missing`);
    const mid: Point2 = [(plane.start.x + plane.end.x) / 2, (plane.start.y + plane.end.y) / 2];
    const towardCamera = dot(candidateNormal, [pose.x - mid[0], pose.y - mid[1]]) >= 0 ? candidateNormal : [-candidateNormal[0], -candidateNormal[1]] as Point2;
    const cropMid = (binding.contextCropBounds[0] + binding.contextCropBounds[2]) / (2 * binding.contextSize[0]);
    const origin: Point3 = [plane.start.x + cropMid * delta[0], plane.start.y + cropMid * delta[1], plane.baseZ];
    const tileArea = evidence.includes('/jordaan-sample-v1/') ? 'jordaan-sample-v1' : 'da-costabuurt-v1';
    const rawDir = path.join(sourceRoot, `.cache/city-appearance/areas/${tileArea}/raw`);
    const files = (await fs.readdir(rawDir)).filter(name => /^3dbag-\d+\.json$/.test(name)).sort();
    const cropStart = binding.contextCropBounds[0] / binding.contextSize[0], cropEnd = binding.contextCropBounds[2] / binding.contextSize[0];
    const meshes: Mesh[] = [];
    const buildingIds: string[] = [];
    const tileHashes: Record<string, string> = {};
    for (const file of files) {
      const tilePath = path.join(rawDir, file), bytes = await fs.readFile(tilePath), tile = JSON.parse(bytes.toString()) as Tile;
      for (const feature of tile.features) {
        const decoded = decode(tile, feature), all = surfaces(feature, decoded);
        const frontage = all.filter(surface => frontWall(surface, plane, towardCamera));
        const along = frontage.flatMap(surface => surface.rings.flat().map(point => planeCoordinates(point, plane).u));
        if (!along.length || Math.max(...along) <= cropStart || Math.min(...along) >= cropEnd) continue;
        const buildingId = feature.id.replace('NL.IMBAG.Pand.', '');
        buildingIds.push(buildingId);
        tileHashes[file] = sha(bytes);
        for (const surface of all) {
          // UVs remain unclamped; the viewer discards samples outside [0,1] to
          // show plain masonry beyond the photographed crop boundary.
          const textured = frontWall(surface, plane, towardCamera);
          const mesh = meshFromSurface(surface, buildingId, tileHashes[file], origin, plane, binding.contextCropBounds, binding.contextSize, textured);
          if (mesh) meshes.push(mesh);
        }
      }
    }
    if (!buildingIds.includes(record.buildingId) || meshes.filter(mesh => mesh.textured && mesh.buildingId === record.buildingId).length === 0) throw Error(`${job}: target frontage missing in 3DBAG`);
    const image = `${job}-source.jpg`, generatedImage = `${job}-generated.png`;
    await fs.mkdir(outRoot, {recursive: true});
    await fs.copyFile(path.join(inputDir, binding.cropPath), path.join(outRoot, image));
    await fs.copyFile(path.join(sourceRoot, `.cache/facade-assessment/banana-head-on-v1/${job}.png`), path.join(outRoot, generatedImage));
    const cropWidthM = (cropEnd - cropStart) * length;
    const target: Point3 = [0, round((plane.topZ - plane.baseZ) / 2), 0];
    const cameraDistance = Math.max(30, cropWidthM * 1.1);
    const camera: Point3 = [round(towardCamera[0] * cameraDistance), target[1] + 4, round(-towardCamera[1] * cameraDistance)];
    const cropCorners: Point3[] = [cropStart, cropEnd].flatMap(t => [plane.baseZ, plane.topZ].map(z => [
      plane.start.x + t * delta[0] - origin[0], z - origin[2], -(plane.start.y + t * delta[1] - origin[1]),
    ] as Point3));
    const focusBounds = {
      min: [0, 1, 2].map(axis => round(Math.min(...cropCorners.map(point => point[axis])))),
      max: [0, 1, 2].map(axis => round(Math.max(...cropCorners.map(point => point[axis])))),
    };
    rows.push({id: job, label: `${record.address ?? record.buildingId} (${binding.panoramaId})`, sourceImage: image, generatedImage,
      originRD: origin.map(round), coordinateSystem: 'local Three XYZ metres: east, NAP up, negative north; originRD is EPSG:7415 east,north,NAP',
      focusBounds, camera: {position: camera, target}, obliqueCamera: {position: [round(camera[0] + delta[0] * 0.55), camera[1] + 10, round(camera[2] - delta[1] * 0.55)], target},
      source: {targetBuildingId: record.buildingId, buildingIds: [...new Set(buildingIds)].sort(), panoramaId: binding.panoramaId, panoramaSha256: binding.panoramaSha256,
        contextSha256: binding.contextSha256, evidenceManifestSha256: binding.evidenceManifestSha256, sourceCropBounds: binding.contextCropBounds,
        contextPlane: plane, tileHashes, identityStatus: 'target evidence record and BAG ID matched; neighbor IDs selected by collinear frontal wall overlap, not photo-owner certified',
        textureRegistration: 'provisional orthographic projection from evidence context plane; output generated image is stylized and not measured photography'}, meshes});
    console.log(`${job}: ${buildingIds.length} BAG buildings, ${meshes.length} surfaces, ${meshes.filter(mesh => mesh.textured).length} front textured`);
  }
  const scene = {version: 1, kind: 'head-on-3dbag-diagnostic', policy: 'Read-only opt-in demo; generated image texture and photo registration are unaccepted. Real 3DBAG LoD2.2 surfaces; no extruded fallback boxes.', rows};
  await fs.writeFile(path.join(outRoot, 'scene.json'), JSON.stringify(scene));
  console.log(path.join(outRoot, 'scene.json'));
}

await main();
