/** Does the measured boresight re-center a crop that was made with the
 * uncorrected world-aligned model?
 *
 * Re-rectifies the case30 crop from the raw panorama twice — baseline and with
 * the measured per-pano boresight — and reports the horizontal shift of the
 * facade's vertical-edge centre of mass. Writes a side-by-side JPEG.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { AMSTERDAM_WORLD_ALIGNED, rectifyFacade, type CameraPose } from '../../src/canalRecall/facade/rectify.ts';
import { cameraModelForPano } from '../../src/canalRecall/facade/panoCamera.ts';
import { edgeMaps, type GrayImage } from '../../src/canalRecall/facade/edgeSupport.ts';

const PACKET = 'public/canal-drive/data/case30-glazed-balcony-door-preview.json';
const panoId = 'TMX7316010203-003006_pano_0003_000165';
const RAW = `.cache/city-appearance/shared-panoramas/${panoId}.jpg`;

const packet = JSON.parse(await fs.readFile(PACKET, 'utf8'));
const source = packet.provenance.source;
const plane = source.samplingPlane;
const pose = source.pose as CameraPose;

const decoded = await sharp(RAW).raw().toBuffer({ resolveWithObject: true });
const image = { width: decoded.info.width, height: decoded.info.height, data: new Uint8Array(decoded.data) };
const crop = (camera: any) => rectifyFacade(image, pose, plane, { camera, pixelsPerMetre: 45, maxPixels: 1_400_000 });

const baseline = crop(AMSTERDAM_WORLD_ALIGNED);
const corrected = crop(cameraModelForPano(panoId));

/** Column-wise vertical-edge energy centre of mass, in output pixels. */
function centering(image: { width: number; height: number; data: Uint8ClampedArray }): number {
  const gray: GrayImage = { width: image.width, height: image.height, data: new Uint8Array(image.width * image.height) };
  for (let i = 0; i < gray.data.length; i++) {
    const o = i * 4;
    gray.data[i] = Math.round(0.299 * image.data[o] + 0.587 * image.data[o + 1] + 0.114 * image.data[o + 2]);
  }
  const maps = edgeMaps(gray);
  let weighted = 0, total = 0;
  for (let x = 0; x < image.width; x++) {
    let column = 0;
    for (let y = 0; y < image.height; y++) column += maps.gx[y * image.width + x];
    weighted += column * x; total += column;
  }
  return total ? weighted / total : image.width / 2;
}

const baselineCentre = centering(baseline);
const correctedCentre = centering(corrected);

const side = async (rect: any, out: string) => sharp(Buffer.from(rect.data), { raw: { width: rect.width, height: rect.height, channels: 4 } }).jpeg({ quality: 90 }).toFile(out);
await side(baseline, '/tmp/case30-baseline.jpg');
await side(corrected, '/tmp/case30-corrected.jpg');
await sharp({ create: { width: baseline.width + corrected.width + 12, height: Math.max(baseline.height, corrected.height), channels: 3, background: { r: 240, g: 238, b: 230 } } })
  .composite([
    { input: '/tmp/case30-baseline.jpg', left: 0, top: 0 },
    { input: '/tmp/case30-corrected.jpg', left: baseline.width + 12, top: 0 },
  ])
  .jpeg({ quality: 90 })
  .toFile('/tmp/case30-boresight-compare.jpg');

console.log(JSON.stringify({
  panoId,
  crop: { width: baseline.width, height: baseline.height },
  edgeCentreBaselinePx: Number(baselineCentre.toFixed(1)),
  edgeCentreCorrectedPx: Number(correctedCentre.toFixed(1)),
  shiftPx: Number((correctedCentre - baselineCentre).toFixed(1)),
  cropCentrePx: baseline.width / 2,
  comparison: '/tmp/case30-boresight-compare.jpg',
}, null, 2));
