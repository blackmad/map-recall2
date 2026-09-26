/** Build raw-panorama target-wall overlays beside rectified development strips. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { buildElevations } from '../../src/canalRecall/facade/elevations.ts';
import { worldToEquirectangularPixel, type CameraPose } from '../../src/canalRecall/facade/rectify.ts';
import { GEOID_SEPARATION_M } from '../../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';

const arg = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const input = path.resolve(arg('input') ?? 'public/canal-drive/facade-photo-review/local/city-variety-07');
const output = path.resolve(arg('out') ?? '.cache/facade-rebuild/reports/registration-context-variety-01');
const raw = path.resolve(arg('raw') ?? '.cache/facade-rebuild/raw/v1');
const panoramaCache = path.resolve('.cache/facade-rebuild/panorama-test-strips/panoramas');
const sha = (bytes: Uint8Array | Buffer) => createHash('sha256').update(bytes).digest('hex');
const escapeHtml = (value: unknown) => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

const [manifestBytes, registryBytes, massingBytes, panoramaMetadataBytes, generatorBytes] = await Promise.all([
  readFile(path.join(input, 'manifest.json')),
  readFile(path.join(raw, 'amsterdam-grachtengordel-west-registry.json')),
  readFile(path.join(raw, 'amsterdam-grachtengordel-west-massing.json')),
  readFile(path.join(raw, 'amsterdam-grachtengordel-west-panoramas.json')),
  readFile(fileURLToPath(import.meta.url)),
]);
const manifest = JSON.parse(manifestBytes.toString());
const registry = new Map(JSON.parse(registryBytes.toString()).data.map((entry: any) => [entry.buildingId, entry]));
const masses = new Map(JSON.parse(massingBytes.toString()).data.map((entry: any) => [entry.buildingId, entry]));
const panoramas = new Map(JSON.parse(panoramaMetadataBytes.toString()).data.map((entry: any) => [entry.panoramaId, entry]));
await mkdir(path.dirname(output), { recursive: true });
await mkdir(output); // Immutable diagnostic run.

type Pixel = [number, number];
const line = (data: Uint8ClampedArray, width: number, height: number, a: Pixel, b: Pixel, colour: number[], thickness: number) => {
  const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
  for (let step = 0; step <= steps; step++) {
    const x = Math.round(a[0] + (b[0] - a[0]) * step / steps), y = Math.round(a[1] + (b[1] - a[1]) * step / steps);
    for (let dx = -thickness; dx <= thickness; dx++) for (let dy = -thickness; dy <= thickness; dy++) {
      const px = x + dx, py = y + dy;
      if (px < 0 || py < 0 || px >= width || py >= height) continue;
      const offset = (py * width + px) * 4;
      data[offset] = colour[0]; data[offset + 1] = colour[1]; data[offset + 2] = colour[2]; data[offset + 3] = 255;
    }
  }
};

const records = [];
for (const strip of manifest.strips) {
  const registered: any = registry.get(strip.pandId), mass: any = masses.get(strip.pandId), view: any = panoramas.get(strip.panoramaId);
  if (!registered || !mass || !view) throw new Error(`${strip.pandId}: missing registry, massing or panorama metadata`);
  const ring = registered.footprintLngLat.map((point: [number, number]) => RD_NEW.fromLngLat(point));
  const wall = buildElevations(ring, { pandId: strip.pandId }).find(value => value.elevationId === strip.elevationId);
  if (!wall) throw new Error(`${strip.pandId}: selected elevation no longer exists`);
  const panoramaBytes = await readFile(path.join(panoramaCache, `${strip.panoramaId}.jpg`));
  if (sha(panoramaBytes) !== strip.panoramaSha256) throw new Error(`${strip.pandId}: panorama bytes changed`);
  const decoded = jpeg.decode(panoramaBytes, { useTArray: true, formatAsRGBA: true });
  const pose: CameraPose = { x: RD_NEW.fromLngLat(view.lngLat).x, y: RD_NEW.fromLngLat(view.lngLat).y,
    z: view.cameraHeight - GEOID_SEPARATION_M, headingDeg: view.headingDeg, pitchDeg: view.pitchDeg, rollDeg: view.rollDeg };
  const project = (point: { x: number; y: number }, z: number) => worldToEquirectangularPixel({ ...point, z }, pose, decoded, 'centre');
  const baseZ = strip.cropBaseNapM, topZ = strip.cropTopNapM;
  const quad = [project(wall.start, baseZ), project(wall.end, baseZ), project(wall.end, topZ), project(wall.start, topZ)];
  const anchor = quad[0][0];
  const unwrap = (u: number) => {
    let value = u;
    while (value - anchor > decoded.width / 2) value -= decoded.width;
    while (value - anchor < -decoded.width / 2) value += decoded.width;
    return value;
  };
  const targetLines: Array<{ a: Pixel; b: Pixel; colour: number[]; thickness: number; role: string }> = [];
  for (let index = 0; index < ring.length; index++) {
    const next = (index + 1) % ring.length;
    targetLines.push({ a: project(ring[index], mass.groundLevel), b: project(ring[next], mass.groundLevel), colour: [55, 150, 255], thickness: 1, role: 'footprint-ground' });
    targetLines.push({ a: project(ring[index], mass.ridgeHeight), b: project(ring[next], mass.ridgeHeight), colour: [195, 90, 255], thickness: 1, role: 'footprint-ridge' });
  }
  for (let index = 0; index < 4; index++) targetLines.push({ a: quad[index] as Pixel, b: quad[(index + 1) % 4] as Pixel, colour: [25, 245, 120], thickness: 2, role: 'sampled-wall-extent' });
  targetLines.push({ a: project(wall.start, mass.eavesHeight), b: project(wall.end, mass.eavesHeight), colour: [255, 195, 45], thickness: 2, role: '3dbag-eaves-candidate' });
  const points = targetLines.flatMap(item => [item.a, item.b]).map(([u, v]) => [unwrap(u), v] as Pixel);
  const wallWidth = Math.max(...quad.map(point => unwrap(point[0]))) - Math.min(...quad.map(point => unwrap(point[0])));
  const wallHeight = Math.max(...quad.map(point => point[1])) - Math.min(...quad.map(point => point[1]));
  const padX = Math.max(180, wallWidth * .75), padY = Math.max(100, wallHeight * .3);
  const x0 = Math.floor(Math.min(...points.map(point => point[0])) - padX), x1 = Math.ceil(Math.max(...points.map(point => point[0])) + padX);
  const y0 = Math.max(0, Math.floor(Math.min(...points.map(point => point[1])) - padY));
  const y1 = Math.min(decoded.height, Math.ceil(Math.max(...points.map(point => point[1])) + padY));
  const sourceWidth = x1 - x0, sourceHeight = y1 - y0;
  if (sourceWidth < 32 || sourceHeight < 32 || sourceWidth > decoded.width * .8) throw new Error(`${strip.pandId}: invalid context crop`);
  const scale = Math.min(1, 1400 / sourceWidth), width = Math.max(1, Math.round(sourceWidth * scale)), height = Math.max(1, Math.round(sourceHeight * scale));
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sx = ((Math.floor(x0 + x / scale) % decoded.width) + decoded.width) % decoded.width;
    const sy = Math.max(0, Math.min(decoded.height - 1, Math.floor(y0 + y / scale)));
    const source = (sy * decoded.width + sx) * 4, destination = (y * width + x) * 4;
    pixels[destination] = decoded.data[source]; pixels[destination + 1] = decoded.data[source + 1];
    pixels[destination + 2] = decoded.data[source + 2]; pixels[destination + 3] = 255;
  }
  const local = ([u, v]: Pixel): Pixel => [(unwrap(u) - x0) * scale, (v - y0) * scale];
  for (const item of targetLines) line(pixels, width, height, local(item.a), local(item.b), item.colour, item.thickness);
  const encoded = jpeg.encode({ width, height, data: Buffer.from(pixels) }, 92).data;
  const contextFile = `${path.parse(strip.file).name}.context.jpg`, stripFile = `${path.parse(strip.file).name}.rectified.jpg`;
  const stripBytes = await readFile(path.join(input, strip.file));
  if (sha(stripBytes) !== strip.sourceSha256) throw new Error(`${strip.pandId}: rectified strip bytes changed`);
  await Promise.all([writeFile(path.join(output, contextFile), encoded), writeFile(path.join(output, stripFile), stripBytes)]);
  records.push({ pandId: strip.pandId, address: strip.address, panoramaId: strip.panoramaId, elevationId: strip.elevationId,
    contextFile, contextSha256: sha(encoded), rectifiedFile: stripFile, rectifiedSha256: sha(stripBytes),
    sourceQuadPx: quad.map(point => point.map(value => Number(value.toFixed(3)))), contextCropPx: [x0, y0, x1, y1],
    cameraPose: pose, wall: { start: wall.start, end: wall.end, widthM: wall.lengthM, facingDeg: wall.facingDeg },
    vertical: { cropBaseNapM: baseZ, groundNapM: mass.groundLevel, eavesCandidateNapM: mass.eavesHeight, ridgeNapM: mass.ridgeHeight, cropTopNapM: topZ },
    disposition: 'review-required' });
  console.log(`${records.length}/${manifest.strips.length} ${strip.address}: ${width}×${height}`);
}

const cards = records.map(record => `<article><h2>${escapeHtml(record.address)}</h2><div class="images"><figure><img src="${escapeHtml(record.contextFile)}"><figcaption>Raw panorama context: sampled wall extent <b class="green">green</b>, BAG footprint at ground <b class="blue">blue</b>, ridge plane <b class="magenta">magenta</b>, eaves candidate <b class="yellow">yellow</b>.</figcaption></figure><figure><img src="${escapeHtml(record.rectifiedFile)}"><figcaption>Rectified strip generated from the green wall plane. A plausible strip does not establish that the selected wall belongs to the intended visible façade.</figcaption></figure></div><p>${escapeHtml(record.pandId)} · ${escapeHtml(record.panoramaId)} · wall ${record.wall.widthM.toFixed(2)} m · review required</p></article>`).join('');
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Panorama registration context</title><style>body{font:14px system-ui;margin:24px;background:#eeeae2;color:#26342f}header,article{max-width:1500px;margin:0 auto 22px;background:white;padding:16px;border:1px solid #cdd3ce}h1,h2{margin-top:0}.images{display:grid;grid-template-columns:2fr 1fr;gap:16px;align-items:start}figure{margin:0}img{display:block;max-width:100%;max-height:720px;margin:auto}figcaption,p{color:#52615b}.green{color:#00a957}.blue{color:#267ada}.magenta{color:#a735dd}.yellow{color:#b47700}@media(max-width:800px){.images{grid-template-columns:1fr}}</style><header><h1>Raw panorama → selected wall → rectified strip</h1><p>Diagnostic overlays only. Review the target wall and neighbour order in the panorama before measuring the rectified pixels.</p></header>${cards}</html>`;
await writeFile(path.join(output, 'index.html'), html);
await writeFile(path.join(output, 'report.json'), JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(),
  generator: 'scripts/facade-rebuild/build-panorama-registration-context.ts', generatorSha256: sha(generatorBytes),
  inputs: { sourceRun: input, sourceManifestSha256: sha(manifestBytes), registrySha256: sha(registryBytes), massingSha256: sha(massingBytes), panoramaMetadataSha256: sha(panoramaMetadataBytes) },
  records, acceptance: 'None. Panorama target-wall context for visual identity and registration review.' }, null, 2) + '\n');
console.log(output);
