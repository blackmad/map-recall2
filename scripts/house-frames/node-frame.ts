/**
 * house:frames without a browser (lane node-world-frames, 2026-11-15): the rule-10 likeness frame (and any camera in
 * a pose.json) rendered in Node from the game's own data and builders (src/canalRecall/nodeFrame/scene.ts), written
 * beside the browser's files with the same pair layout (photo cut | game).
 *
 *   node --import tsx scripts/house-frames/node-frame.ts <frame dir | pose.json>... [--out <dir>] [--dpr 2]
 *        [--no-shadows] [--no-models] [--no-ground] [--no-shells] [--frame likeness|game]
 *   node --import tsx scripts/house-frames/node-frame.ts --aerial <lng>,<lat>,<zoom>,<pitch>,<bearing>[,<w>,<h>] --out <dir>
 *        [--name <name>] [--dpr 1]   (an ingame-capture.ts view: jumpTo({center, zoom, pitch, bearing}), 1280 x 800)
 *
 * A frame dir is a house:frames output folder (<key>/pose.json, likeness-photo.jpg). Writes <out>/<key>/
 * likeness.node.png, likeness.node.json (timings, counts) and pair.node.jpg. --out defaults to the frame dir itself.
 * The first frame near a place builds its ground cells (cached in .cache/node-frame/ground); later ones read them.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { installCanvasShims } from '../../src/canalRecall/nodeFrame/shims.ts';

const root = process.cwd();
installCanvasShims(root);
const { renderNodeFrame } = await import('../../src/canalRecall/nodeFrame/scene.ts');
const { frameFor, fpsFor } = await import('./pose.ts');

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string, d: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const inputs = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && /^--(out|dpr|frame|aerial|name)$/.test(args[i - 1])));
if (args.includes('--aerial')) {
  const { cameraFrame } = await import('../../src/canalRecall/ownMap/mapCamera.ts');
  const { isAerialView } = await import('../../src/canalRecall/rendererShared/aerialView.ts');
  const [lng, lat, zoom, pitch, bearing, w = 1280, h = 800] = opt('aerial', '').split(',').map(Number);
  const dprA = Number(opt('dpr', '1')), name = opt('name', `aerial-${lng.toFixed(4)}-${lat.toFixed(4)}-${bearing}`);
  const frame = cameraFrame({ center: [0, 0], zoom, pitch, bearing, elevation: 0 }, { width: w, height: h }, lat);
  const out = path.join(opt('out', 'artifacts/node-frames'), name);
  fs.mkdirSync(out, { recursive: true });
  const t0 = performance.now();
  const r = await renderNodeFrame({ lngLat: [lng, lat], frame, width: w, height: h, dpr: dprA, center: [lng, lat], zoom, aerial: isAerialView(zoom, pitch, lat) }, {
    root, cacheDir: path.join(root, '.cache/node-frame'), log: s => console.log(`  ${s}`),
    shadows: !flag('no-shadows'), models: !flag('no-models'), ground: !flag('no-ground'), shells: !flag('no-shells'),
  });
  const png = path.join(out, 'aerial.node.png');
  await sharp(Buffer.from(r.image.rgba.buffer), { raw: { width: r.image.width, height: r.image.height, channels: 4 } }).png().toFile(png);
  fs.writeFileSync(path.join(out, 'aerial.node.json'), JSON.stringify({ name, renderer: 'node', camera: { lng, lat, zoom, pitch, bearing, w, h, dpr: dprA }, timings: r.timings, counts: r.counts, totalMs: Math.round(performance.now() - t0) }, null, 1));
  console.log(`${name}: ${Math.round(performance.now() - t0)} ms`, JSON.stringify(r.timings), JSON.stringify(r.counts));
  process.exit(0);
}
if (!inputs.length) { console.error('usage: node-frame.ts <frame dir | pose.json>... [--out dir] [--dpr 2]'); process.exit(2); }
const dpr = Number(opt('dpr', '2')), outRoot = opt('out', '');

for (const input of inputs) {
  const poseFile = input.endsWith('.json') ? input : path.join(input, 'pose.json');
  const dir = path.dirname(poseFile), pj = JSON.parse(fs.readFileSync(poseFile, 'utf8'));
  const key = pj.key ?? path.basename(dir);
  const pose = opt('frame', 'likeness') === 'game' ? pj.pose : (pj.rule10?.likeness?.lp?.pose ?? pj.pose);
  const out = outRoot ? path.join(outRoot, key) : dir;
  fs.mkdirSync(out, { recursive: true });
  const fps = fpsFor(pose), frame = frameFor(pose);
  const t0 = performance.now();
  const r = await renderNodeFrame({ lngLat: pose.lngLat, frame, width: pose.width, height: pose.height, dpr, center: fps.center, zoom: fps.zoom }, {
    root, cacheDir: path.join(root, '.cache/node-frame'), log: s => console.log(`  ${s}`),
    shadows: !flag('no-shadows'), models: !flag('no-models'), ground: !flag('no-ground'), shells: !flag('no-shells'),
  });
  const { width, height, rgba } = r.image;
  const png = path.join(out, 'likeness.node.png');
  await sharp(Buffer.from(rgba.buffer), { raw: { width, height, channels: 4 } }).png().toFile(png);
  fs.writeFileSync(path.join(out, 'likeness.node.json'), JSON.stringify({ key, renderer: 'node', dpr, buffer: [width, height], pose, timings: r.timings, counts: r.counts, totalMs: Math.round(performance.now() - t0) }, null, 1));
  const photo = ['likeness-photo.jpg', 'photo.jpg'].map(f => path.join(dir, f)).find(f => fs.existsSync(f));
  if (photo) {
    const h = 900, a = await sharp(photo).resize({ height: h }).toBuffer({ resolveWithObject: true }), b = await sharp(png).resize({ height: h }).toBuffer({ resolveWithObject: true });
    await sharp({ create: { width: a.info.width + b.info.width + 8, height: h, channels: 3, background: '#ffffff' } })
      .composite([{ input: a.data, left: 0, top: 0 }, { input: b.data, left: a.info.width + 8, top: 0 }]).jpeg({ quality: 88 }).toFile(path.join(out, 'pair.node.jpg'));
  }
  console.log(`${key}: ${Math.round(performance.now() - t0)} ms`, JSON.stringify(r.timings), JSON.stringify(r.counts));
}
