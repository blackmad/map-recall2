/** Add an opt-in generated roof silhouette repair to a head-on 3DBAG scene. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {buildRoofRepair, skylineFromRgba, type Mesh, type Plane, type Point3, type Crop} from './headOnRoofRepair';

type Row = {id: string; meshes: Mesh[]; originRD: Point3; camera: {position: Point3}; source: {contextPlane: Plane; sourceCropBounds: Crop}; roofRepair?: unknown};
type Scene = {version: number; rows: Row[]; [key: string]: unknown};

const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const args = process.argv.slice(2);
const option = (name: string, fallback: string) => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
if (args.some(arg => !/^--(scene|inputs|setback)=/.test(arg))) throw Error('Supported flags: --scene=<scene.json> --inputs=<input manifest> --setback=<metres>');
const scenePath = path.resolve(option('scene', 'public/data/facade-review-galleries/head-on-3d-v1/scene.json'));
const inputPath = path.resolve(option('inputs', '.cache/facade-assessment/banana-head-on-v1/inputs/manifest.json'));
const setbackM = Number(option('setback', '2'));
if (!(setbackM >= 0.5 && setbackM <= 4)) throw Error('Setback must be 0.5–4 m');
const inputBytes = await fs.readFile(inputPath);
const manifest = JSON.parse(inputBytes.toString()) as {inputs: Record<string, {width: number; height: number; panoramaBinding: {sourceSize: [number, number]}}>};
const scene = JSON.parse(await fs.readFile(scenePath, 'utf8')) as Scene;
if (scene.version !== 1 || scene.rows.length !== 3) throw Error('Expected three-row head-on scene');
for (const row of scene.rows) {
  const input = manifest.inputs[row.id];
  if (!input) throw Error(`Missing ${row.id} input binding`);
  const generatedPath = path.join(path.dirname(scenePath), `${row.id}-generated.png`);
  const imageBytes = await fs.readFile(generatedPath);
  const raster = await sharp(imageBytes).removeAlpha().raw().toBuffer({resolveWithObject: true});
  const skylineY = skylineFromRgba(raster.data, raster.info.width, raster.info.height, raster.info.channels);
  const repair = buildRoofRepair({meshes: row.meshes, plane: row.source.contextPlane, crop: row.source.sourceCropBounds,
    contextSize: input.panoramaBinding.sourceSize, originRD: row.originRD, cameraPosition: row.camera.position,
    imageWidth: raster.info.width, imageHeight: raster.info.height, skylineY, setbackM});
  row.roofRepair = {version: 1, status: 'provisional-generated-silhouette', originalMeshesRetained: true,
    generatedImageSha256: sha(imageBytes), inputManifestSha256: sha(inputBytes), sourceImageSize: [input.width, input.height],
    generatedImageSize: [raster.info.width, raster.info.height], skylineY, ...repair};
  console.log(`${row.id}: skyline ${skylineY.length} samples, BAG roof joins ${repair.stats.roofJoinSamples}, fallback ${repair.stats.roofFallbackSamples}, repaired meshes ${repair.meshes.length}`);
}
const tempPath = `${scenePath}.repair-tmp`;
await fs.writeFile(tempPath, JSON.stringify(scene));
await fs.rename(tempPath, scenePath);
console.log(scenePath);
