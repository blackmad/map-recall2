/**
 * Route B in one command: one licensed Commons photo -> a tagged, scaled, faced 6k-triangle GLB and a review strip beside the kit model.
 *
 *   node --import tsx scripts/sculptures/reconstruct.ts --id=de-dokwerker
 *   node --import tsx scripts/sculptures/reconstruct.ts --id=my-statue --title="File:X.jpg" --kit=<kit glb id> --height=2.6 --facing=250
 *   node --import tsx scripts/sculptures/reconstruct.ts --id=my-statue --photo=<local.jpg> --page-url=<commons page> --author="A" --licence="CC BY 4.0" --height=2.6
 *
 * Inputs: `--id` (a key of batch1.json supplies defaults; flags override), the photo as `--title="File:..."` (fetched with its author and
 * licence from the Commons API, refused unless CC0 / PD / CC BY / CC BY-SA) or as `--photo` + `--page-url` + `--author` + `--licence`.
 *   --height=<m>        real height of what is in the cut-out; default the kit model's bounding-box height (or the batch1.json value)
 *   --facing=<deg>      compass bearing of the statue's front; default the batch1.json value
 *   --plinth-top=<m>    where the plinth ends; below it the stone slot is used (photo plinth), above it bronze
 *   --kit-plinth        the photo's plinth is wrong: cut out the figure only (use --box), scale it to height - plinth-top, lift it onto
 *                       the kit model's plinth triangles (kit triangles whose vertices are all below plinth-top within --plinth-radius=1.8 m)
 *   --box=x0,y0,x1,y1   crop of the downloaded photo before the cut-out (to isolate one figure of a group)
 *   --rembg=u2net|isnet-general-use   cut-out model (u2net default; IS-Net when u2net loses the plinth or thin parts)
 *   --material=bronze|stone           material of the figure (default bronze)
 *   --tris=6000  --dist=<m>  --out=artifacts/sculpture-reconstruction/<id>  --no-strip
 * Steps: download, cut-out (rembg), TripoSR on MPS, marching cubes (skimage), decimate, scale, face (python, two venvs outside the repo:
 * scripts/sculptures/setup-env.sh), then material tagging here (`materialSlot` + `tint` from the kit's bronze/stone, no photo colours baked),
 * and `landmark-strip.ts` for the kit and the result, stacked by compare_sheet.py.
 * Writes <out>/{routeB.glb, compare.png, source.json} plus work/ (cut-out, raw mesh, timings) and strips/. Installs nothing in the game.
 */
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Document, NodeIO, getBounds, type Material} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dequantize} from '@gltf-transform/functions';
import {MeshoptDecoder} from 'meshoptimizer';
import {admitLicence} from '../../src/canalRecall/sculptures/licences.js';

const argv = process.argv.slice(2);
const arg = (k: string, d = '') => argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const flag = (k: string) => argv.includes(`--${k}`);
const id = arg('id');
if (!id) throw new Error('--id=<statue id> required');
const batch = JSON.parse(fs.readFileSync('scripts/sculptures/batch1.json', 'utf8'));
const cfg = {...(batch.statues[id] ?? {})};
const num = (k: string, d?: number) => (arg(k) ? Number(arg(k)) : d);
const tools = (process.env.SCULPTURE_TOOLS ?? path.join(os.homedir(), 'Code/map-recall2-sculpt')).replace(/^~/, os.homedir());
const out = arg('out', `artifacts/sculpture-reconstruction/${id}`);
const work = path.join(out, 'work');
const T: Record<string, number> = {};
const clock = <R>(k: string, f: () => R): R => { const t = Date.now(); const r = f(); T[k] = Math.round((Date.now() - t) / 100) / 10; return r; };
const run = (bin: string, a: string[], env: NodeJS.ProcessEnv = {}) => {
  const r = spawnSync(bin, a, {encoding: 'utf8', env: {...process.env, ...env}, maxBuffer: 1 << 28});
  if (r.status !== 0) throw new Error(`${path.basename(bin)} ${a.slice(0, 3).join(' ')} failed (${r.status}): ${r.stderr.slice(-1500)}`);
  return r.stdout;
};
fs.mkdirSync(work, {recursive: true});
const UA = {'User-Agent': 'map-recall-sculpture-research/1.0 (open-data prototype)'};
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function get(url: string): Promise<Response> {
  for (let i = 0; ; i++) {
    const res = await fetch(url, {headers: UA});
    if (res.ok) return res;
    if (i > 6) throw new Error(`${res.status} ${url}`);
    await sleep(4000 * (i + 1));
  }
}
const strip = (s: unknown) => String(s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

// 1. The photo and its provenance.
let photo = arg('photo'), photoMeta: Record<string, unknown>;
if (photo) {
  photoMeta = {title: path.basename(photo), pageUrl: arg('page-url'), author: arg('author'), licence: arg('licence'), date: arg('date')};
  if (!photoMeta.pageUrl || !photoMeta.author || !photoMeta.licence) throw new Error('--photo needs --page-url, --author and --licence');
} else {
  const title = arg('title', cfg.title);
  if (!title) throw new Error('--title or --photo required');
  const q = new URLSearchParams({action: 'query', titles: title, prop: 'imageinfo', iiprop: 'url|extmetadata|sha1|size', iiurlwidth: String(batch.width ?? 2000), format: 'json'});
  const data: any = await (await get(`https://commons.wikimedia.org/w/api.php?${q}`)).json();
  const page: any = Object.values(data.query.pages)[0];
  if (!page.imageinfo) throw new Error(`no such Commons file: ${title}`);
  const info = page.imageinfo[0], meta = info.extmetadata;
  const licence = strip(meta.LicenseShortName?.value), verdict = admitLicence(licence);
  if (!verdict.admitted) throw new Error(`photo refused: ${verdict.reason}`);
  photoMeta = {title: page.title, pageUrl: info.descriptionurl, author: strip(meta.Artist?.value), licence, licenceUrl: meta.LicenseUrl?.value ?? null,
    date: strip(meta.DateTimeOriginal?.value), originalSize: [info.width, info.height], sha1Original: info.sha1, downloadUrl: info.thumburl || info.url};
  const dl = path.resolve(out, 'download'); // its own directory; python reads it with -I
  fs.mkdirSync(dl, {recursive: true});
  photo = path.join(dl, 'photo.jpg');
  if (!fs.existsSync(photo)) fs.writeFileSync(photo, Buffer.from(await (await get(photoMeta.downloadUrl as string)).arrayBuffer()));
}

// 2. Kit model: height, facing, materials, plinth.
const kitId = arg('kit', cfg.kit ?? id);
const kitGlb = `public/canal-drive/models/${kitId}.glb`;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder});
const kitDoc = fs.existsSync(kitGlb) ? await io.read(kitGlb) : null;
if (kitDoc) await kitDoc.transform(dequantize());
const kitBounds = kitDoc ? getBounds(kitDoc.getRoot().listScenes()[0]) : null;
const height = num('height', cfg.heightM ?? (kitBounds ? kitBounds.max[1] - kitBounds.min[1] : undefined));
if (!height) throw new Error('--height required (no kit model to measure)');
const facing = num('facing', cfg.facingDeg ?? 0)!;
const plinthTop = num('plinth-top', cfg.plinthTopM);
const kitPlinth = flag('kit-plinth');
if (kitPlinth && (!plinthTop || !kitDoc)) throw new Error('--kit-plinth needs --plinth-top and a kit model');
const rembg = arg('rembg', cfg.rembg ?? 'u2net');
const box = arg('box', cfg.box ?? '');
const tris = num('tris', 6000)!;

// 3. TripoSR (cut-out, network, marching cubes) and 4. decimate / scale / face.
const py = (venv: string) => path.join(tools, venv, 'bin/python');
const trip = JSON.parse(clock('triposrWall', () => run(py('venv-triposr'), ['-I', 'scripts/sculptures/run_triposr.py', `--src=${path.join(tools, 'triposr-src')}`,
  `--image=${path.resolve(photo)}`, `--out=${work}`, `--rembg=${rembg}`, ...(box ? [`--box=${box}`] : [])]).trim().split('\n').pop()!));
const figH = kitPlinth ? height - plinthTop! : height;
const dec = JSON.parse(clock('decimateWall', () => run(py('venv-o3d'), ['-I', 'scripts/sculptures/decimate_scale_glb.py', path.join(work, 'raw.ply'), path.join(work, 'plain.glb'),
  `--height=${figH}`, `--facing=${facing}`, `--tris=${tris}`, '--no-colors', ...(kitPlinth ? [`--lift=${plinthTop}`] : [])]).trim().split('\n').pop()!));

// 5. Material tagging (no photo colours): bronze/stone from the kit, else the kit-statue defaults; optional kit plinth.
const kitMat = (name: string): Material | undefined => kitDoc?.getRoot().listMaterials().find(m => m.getName() === name);
const fallback = {
  bronze: {color: [0.07, 0.05, 0.04, 1], extras: {materialSlot: 'paint', tint: '#4a4038', materialSlotSource: 'inferred'}},
  stone: {color: [0.58, 0.54, 0.42, 1], extras: {materialSlot: 'stone', tint: '#c9c2ae', materialSlotSource: 'inferred'}},
};
const doc = new Document();
const buffer = doc.createBuffer();
const mats = new Map<string, Material>();
const material = (name: 'bronze' | 'stone', src?: Material) => {
  const key = src ? `${name}:${src.getName()}` : name;
  if (!mats.has(key)) {
    const k = src ?? kitMat(name);
    const m = doc.createMaterial(name).setBaseColorFactor((k?.getBaseColorFactor() ?? fallback[name].color) as any).setRoughnessFactor(0.9).setMetallicFactor(0)
      .setExtras({...(k?.getExtras() ?? fallback[name].extras)});
    mats.set(key, m);
  }
  return mats.get(key)!;
};
const prims = new Map<Material, number[]>();
const push = (m: Material, a: number[], b: number[], c: number[]) => { if (!prims.has(m)) prims.set(m, []); prims.get(m)!.push(...a, ...b, ...c); };
const plain = await io.read(path.join(work, 'plain.glb'));
for (const mesh of plain.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
  const pos = p.getAttribute('POSITION')!, idx = p.getIndices()!;
  const v = (i: number) => pos.getElement(i, [0, 0, 0]) as number[];
  for (let t = 0; t < idx.getCount(); t += 3) {
    const a = v(idx.getScalar(t)), b = v(idx.getScalar(t + 1)), c = v(idx.getScalar(t + 2));
    const low = plinthTop !== undefined && !kitPlinth && (a[1] + b[1] + c[1]) / 3 < plinthTop;
    push(material(low || flag('stone') || arg('material') === 'stone' ? 'stone' : 'bronze'), a, b, c);
  }
}
let kitTris = 0;
if (kitPlinth && kitDoc) {
  const radius = num('plinth-radius', 1.8)!;
  for (const node of kitDoc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue;
    const mw = node.getWorldMatrix();
    for (const p of mesh.listPrimitives()) {
      const pos = p.getAttribute('POSITION')!, idx = p.getIndices();
      const n = idx ? idx.getCount() : pos.getCount();
      const v = (i: number) => { const q = pos.getElement(idx ? idx.getScalar(i) : i, [0, 0, 0]) as number[]; return [mw[0] * q[0] + mw[4] * q[1] + mw[8] * q[2] + mw[12], mw[1] * q[0] + mw[5] * q[1] + mw[9] * q[2] + mw[13], mw[2] * q[0] + mw[6] * q[1] + mw[10] * q[2] + mw[14]]; };
      const km = p.getMaterial();
      for (let t = 0; t < n; t += 3) {
        const a = v(t), b = v(t + 1), c = v(t + 2);
        if (Math.max(a[1], b[1], c[1]) > plinthTop! + 0.005) continue;
        if (Math.hypot((a[0] + b[0] + c[0]) / 3, (a[2] + b[2] + c[2]) / 3) > radius) continue;
        const stone = km && !/bronze/.test(km.getName());
        push(stone && km ? material('stone', km) : material('bronze'), a, b, c);
        kitTris++;
      }
    }
  }
}
const scene = doc.createScene();
const node = doc.createNode(id);
const mesh = doc.createMesh(id);
let total = 0;
for (const [m, arr] of prims) {
  const pos = doc.createAccessor().setType('VEC3').setArray(new Float32Array(arr)).setBuffer(buffer);
  mesh.addPrimitive(doc.createPrimitive().setAttribute('POSITION', pos).setMaterial(m));
  total += arr.length / 9;
}
scene.addChild(node.setMesh(mesh));
const glb = path.join(out, 'routeB.glb');
await io.write(glb, doc);
const b = getBounds(scene);
const sizeM = b.max.map((v, i) => +(v - b.min[i]).toFixed(2));

// 6. Strips: the kit model and route B at the same camera distance, stacked with the inputs.
let strips = '';
if (!flag('no-strip')) {
  const dist = String(num('dist', Math.max(5, height * 2.1)));
  const sdir = path.join(out, 'strips');
  const stripCmd = (g: string, dir: string, title: string) => run('node', ['--import', 'tsx', 'scripts/landmarks/landmark-strip.ts', `--id=${id}`, `--glb=${g}`, `--out=${dir}`, `--title=${title}`, `--dist=${dist}`]);
  if (kitDoc) clock('stripKit', () => stripCmd(kitGlb, path.join(sdir, 'kit'), `${id} kit model`));
  clock('stripB', () => stripCmd(glb, path.join(sdir, 'routeB'), `${id} route B (${rembg})`));
  const jpg = `docs/images/sculptures/${id}.jpg`;
  fs.mkdirSync(path.dirname(jpg), {recursive: true});
  run(py('venv-o3d'), ['-I', 'scripts/sculptures/compare_sheet.py', path.join(out, 'compare.png'), photo, path.join(work, 'cutout.png'), path.join(work, 'input.png'),
    path.join(sdir, kitDoc ? 'kit' : 'routeB', 'strip-four-sides.png'), path.join(sdir, 'routeB', 'strip-four-sides.png'), `--jpg=${jpg}`, `--title=${id}`]);
  strips = path.join(out, 'compare.png');
}

const wall = Math.round((trip.loadS + trip.cutoutS + trip.modelS + trip.meshS) * 10) / 10;
fs.writeFileSync(path.join(out, 'source.json'), JSON.stringify({
  id, route: 'B (TripoSR, single photo)', photo: photoMeta, kit: kitDoc ? kitGlb : null,
  settings: {rembg, box: box || null, heightM: height, figureHeightM: figH, facingDeg: facing, plinthTopM: plinthTop ?? null, kitPlinth, material: arg('material', 'bronze'), targetTriangles: tris},
  cutout: {model: rembg, file: path.join(work, 'cutout.png'), keptLargestComponent: true},
  timingsS: {...trip, ...T, networkTotalS: wall}, result: {triangles: total, kitPlinthTriangles: kitTris, sizeM, rawTriangles: dec.rawTriangles, watertightBeforeTagging: dec.watertight},
  materials: [...mats.values()].map(m => ({name: m.getName(), extras: m.getExtras()})), generated: new Date().toISOString(),
}, null, 1));
console.log(JSON.stringify({id, triangles: total, sizeM, seconds: wall, licence: photoMeta.licence, author: photoMeta.author, compare: strips}));
