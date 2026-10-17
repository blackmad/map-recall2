/**
 * Statue rebuild (2026-10-17): every figure of a kit statue reconstructed by the best route its licensed photos allow, put back into
 * the kit model in place of the kit figure, and a review sheet photo | kit | new from four sides.
 *
 *   node --import tsx scripts/sculptures/rebuild.ts --id=lieverdje [--figure=boy] [--steps=fetch,prep,recon,mesh,compose,strip]
 *
 * Config: `scripts/sculptures/rebuild-20261017.json`, `statues.<id>`:
 *   kit            kit GLB id under public/canal-drive/models/ (its plinth/pier/architecture is kept)
 *   sculptor       {name, born, died}; `publicDomain` is computed (died before 1956 = more than 70 years)
 *   figures[]      {name, route: "trellis"|"triposr", views: [{title, box?: [x0,y0,x1,y1] at the 1600 px download, keepTop?, model?}],
 *                   cut: {min: [x,y,z], max: [x,y,z]} (kit frame) and cutMaterials (default ["bronze"]): the kit triangles this figure
 *                   replaces; the figure stands at the base centre of what was cut, scaled to its height (or `height`, `base`),
 *                   facing `facing` (compass deg); material "bronze"|"stone"; front/up: the generator frame's front and up axes}
 * Routes: trellis = TRELLIS.2-4B multidiffusion on the MLX port (scripts/sculptures/multiview/run_trellis2.py, about 7 min and 27 GB,
 *         one at a time: a lock in /tmp and a free-memory check), triposr = TripoSR on views[0] (about 20 s).
 * Output (gitignored): artifacts/sculpture-reconstruction/<id>/rebuild/{<id>.glb, source.json, sheet.png, <figure>/...}; the sheet goes
 * to docs/images/sculptures/<id>-rebuild.jpg. Strips render through the shared browser queue (/tmp/canal-pw.sh) when it exists.
 * Installs nothing.
 */
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dequantize} from '@gltf-transform/functions';
import {MeshoptDecoder} from 'meshoptimizer';
import {admitLicence} from '../../src/canalRecall/sculptures/licences.js';
import {boxOf, cutTriangles, type Box, type V3} from '../../src/canalRecall/sculptures/kitParts.js';
import {composeDoc, kitTriangles, plainTriangles} from './kit-compose.js';

const argv = process.argv.slice(2);
const arg = (k: string, d = '') => argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const id = arg('id');
if (!id) throw new Error('--id required');
const cfgAll = JSON.parse(fs.readFileSync('scripts/sculptures/rebuild-20261017.json', 'utf8'));
const cfg = cfgAll.statues[id];
if (!cfg?.figures?.length) throw new Error(`no figures for ${id}`);
const steps = new Set(arg('steps', 'fetch,prep,recon,mesh,compose,strip').split(','));
const onlyFig = arg('figure');
const tools = (process.env.SCULPTURE_TOOLS ?? path.join(os.homedir(), 'Code/map-recall2-sculpt'));
const root = process.cwd();
const base = path.join('artifacts/sculpture-reconstruction', id);
const out = path.join(base, 'rebuild');
fs.mkdirSync(out, {recursive: true});
const sourcePath = path.join(out, 'source.json');
const source: any = fs.existsSync(sourcePath) ? JSON.parse(fs.readFileSync(sourcePath, 'utf8')) : {id, figures: {}};
// artifacts/ is gitignored: the provenance record (photos, authors, licences, sculptor, routes, timings) is mirrored into the repo
const trackedSource = path.join('scripts/sculptures/rebuild-sources', `${id}.json`);
const save = () => {
  fs.writeFileSync(sourcePath, JSON.stringify(source, null, 1));
  fs.mkdirSync(path.dirname(trackedSource), {recursive: true});
  fs.writeFileSync(trackedSource, JSON.stringify(source, null, 1) + '\n');
};
const run = (bin: string, a: string[], opts: {cwd?: string; env?: NodeJS.ProcessEnv} = {}) => {
  const r = spawnSync(bin, a, {encoding: 'utf8', cwd: opts.cwd, env: {...process.env, ...opts.env}, maxBuffer: 1 << 28});
  if (r.status !== 0) throw new Error(`${path.basename(bin)} ${a.slice(0, 3).join(' ')} failed (${r.status}): ${(r.stderr || r.stdout).slice(-2500)}`);
  return r.stdout;
};
const lastJson = (s: string) => JSON.parse(s.trim().split('\n').filter(l => l.startsWith('{')).pop()!);
const py = (venv: string) => path.join(tools, venv, 'bin/python');
const UA = {'User-Agent': 'map-recall-sculpture-research/1.0 (open-data prototype)'};
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function get(url: string): Promise<Response> {
  for (let i = 0; ; i++) {
    const res = await fetch(url, {headers: UA});
    if (res.ok) return res;
    if (i > 10) throw new Error(`${res.status} ${url}`);
    await sleep(Math.max(Number(res.headers.get('retry-after') ?? 0) * 1000 + 500, 5000 * (i + 1)));
  }
}
const clean = (s: unknown) => String(s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const timed = <R>(rec: Record<string, number>, k: string, f: () => R): R => { const t = Date.now(); const r = f(); rec[k] = Math.round((Date.now() - t) / 100) / 10; return r; };

// Sculptor and public-domain status (EU: 70 years after the sculptor's death, counted from 1 January of the following year).
if (cfg.sculptor) {
  const died = cfg.sculptor.died;
  source.sculptor = {...cfg.sculptor, publicDomain: typeof died === 'number' ? died + 70 < new Date().getFullYear() : false};
}
source.kit = `public/canal-drive/models/${cfg.kit}.glb`;
if (cfg.verdict) source.verdict = cfg.verdict; // the reviewer's one line from the comparison sheet: better / no better / worse than the kit

// 1. Photos: each view downloaded once at 1600 px into download/ (its own directory), with author and licence.
source.photos ??= {};
const photoFile = (title: string) => source.photos[title]?.file as string;
if (steps.has('fetch')) {
  const dl = path.join(base, 'download');
  fs.mkdirSync(dl, {recursive: true});
  for (const f of cfg.figures) for (const v of f.views) {
    if (source.photos[v.title]?.author && fs.existsSync(source.photos[v.title].file)) continue;
    const q = new URLSearchParams({action: 'query', titles: v.title, prop: 'imageinfo', iiprop: 'url|extmetadata|sha1|size|user', iiurlwidth: '1600', format: 'json'});
    const d: any = await (await get(`https://commons.wikimedia.org/w/api.php?${q}`)).json();
    const page: any = Object.values(d.query.pages)[0];
    if (!page.imageinfo) throw new Error(`no such Commons file: ${v.title}`);
    const ii = page.imageinfo[0], m = ii.extmetadata;
    const licence = clean(m.LicenseShortName?.value), verdict = admitLicence(licence);
    if (!verdict.admitted) throw new Error(`${v.title} refused: ${verdict.reason}`);
    const file = path.join(dl, `${String(ii.sha1).slice(0, 10)}.jpg`);
    if (!fs.existsSync(file)) fs.writeFileSync(file, Buffer.from(await (await get(ii.thumburl || ii.url)).arrayBuffer()));
    source.photos[v.title] = {title: page.title, pageUrl: ii.descriptionurl, author: clean(m.Artist?.value) || (ii.user ? `${ii.user} (uploader; no Artist field)` : ''), licence, licenceUrl: m.LicenseUrl?.value ?? null,
      date: clean(m.DateTimeOriginal?.value), originalSize: [ii.width, ii.height], sha1: ii.sha1, downloadUrl: ii.thumburl || ii.url, file};
    save();
    await sleep(1500);
  }
}

// grid: every view side by side with a 100 px grid in download pixels, for setting the crop boxes by eye.
if (steps.has('grid')) {
  for (const f of cfg.figures) {
    const files = f.views.map((v: any) => photoFile(v.title));
    run(py('venv-o3d'), ['-I', 'scripts/sculptures/view_grid.py', path.join(out, `grid-${f.name}.jpg`), ...files]);
    console.log('grid', path.join(out, `grid-${f.name}.jpg`));
  }
}

const freeGb = () => {
  const s = run('vm_stat', []);
  const page = Number(/page size of (\d+)/.exec(s)![1]);
  const n = (k: string) => Number(new RegExp(`${k}:\\s+(\\d+)`).exec(s)?.[1] ?? 0);
  return (n('Pages free') + n('Pages inactive') + n('Pages speculative') + n('Pages purgeable')) * page / 2 ** 30;
};

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder});
const kitDoc = await io.read(source.kit);
await kitDoc.transform(dequantize());
const kit = kitTriangles(kitDoc);

for (const f of cfg.figures) {
  if (onlyFig && f.name !== onlyFig) continue;
  const fdir = path.join(out, f.name);
  fs.mkdirSync(fdir, {recursive: true});
  const rec = (source.figures[f.name] ??= {});
  rec.route = f.route === 'trellis' ? `TRELLIS.2-4B multidiffusion, ${f.views.length} photos (trellis2-apple MLX port)` : 'TripoSR, one photo';
  rec.views = f.views.map((v: any) => ({title: v.title, box: v.box ?? null, keepTop: v.keepTop ?? null}));
  rec.timingsS ??= {};
  const T = rec.timingsS;
  const rawPly = path.join(fdir, f.route === 'trellis' ? 'trellis/raw.ply' : 'triposr/raw.ply');

  // 2. Cut-outs (TRELLIS: RGBA squares from prep_inputs.py; TripoSR cuts its own photo).
  if (steps.has('prep') && f.route === 'trellis') {
    const spec = {views: f.views.map((v: any, i: number) => ({name: `v${i}`, src: path.resolve(photoFile(v.title)), box: v.box, keepTop: v.keepTop, model: v.model ?? 'isnet-general-use', upscale: v.upscale}))};
    fs.writeFileSync(path.join(fdir, 'inputs.json'), JSON.stringify(spec, null, 1));
    timed(T, 'prep', () => run(py('venv-triposr'), ['-I', 'scripts/sculptures/multiview/prep_inputs.py', path.join(fdir, 'inputs.json'), path.join(fdir, 'mv-inputs')]));
  }
  // 3. Reconstruction.
  if (steps.has('recon')) {
    if (f.route === 'trellis') {
      const lock = '/tmp/statue-trellis.lock';
      for (;;) {
        try { fs.mkdirSync(lock); fs.writeFileSync(path.join(lock, 'pid'), String(process.pid)); break; } catch {
          const pid = Number(fs.readFileSync(path.join(lock, 'pid'), 'utf8') || 0);
          try { process.kill(pid, 0); } catch { fs.rmSync(lock, {recursive: true, force: true}); continue; }
          console.error('waiting for another TRELLIS run'); await sleep(30000);
        }
      }
      try {
        for (let g = freeGb(); g < Number(arg('min-free-gb', '18')); g = freeGb()) { console.error(`only ${g.toFixed(1)} GB free, waiting`); await sleep(60000); }
        rec.freeGbAtStart = +freeGb().toFixed(1);
        const imgs = f.views.map((_: unknown, i: number) => path.resolve(fdir, 'mv-inputs', `v${i}-rgba.png`));
        const mv = path.join(tools, 'mv');
        const r = timed(T, 'trellisWall', () => run(path.join(mv, 'trellis2-apple/venv/bin/python'), ['-I', path.join(root, 'scripts/sculptures/multiview/run_trellis2.py'),
          path.resolve(fdir, 'trellis'), ...imgs, `--dino=${path.join(mv, 'weights/dinov3-vitl16-hf')}`, '--mode=multidiffusion', '--backend=mlx', ...(f.seed ? [`--seed=${f.seed}`] : [])],
        {cwd: path.join(mv, 'trellis2-apple/src'), env: {HF_HOME: path.join(mv, 'weights/hf'), HF_HUB_OFFLINE: '1'}}));
        rec.trellis = lastJson(r);
      } finally { fs.rmSync(lock, {recursive: true, force: true}); }
    } else {
      const v = f.views[0];
      const r = timed(T, 'triposrWall', () => run(py('venv-triposr'), ['-I', 'scripts/sculptures/run_triposr.py', `--src=${path.join(tools, 'triposr-src')}`,
        `--image=${path.resolve(photoFile(v.title))}`, `--out=${path.join(fdir, 'triposr')}`, `--rembg=${v.model ?? 'isnet-general-use'}`, ...(v.box ? [`--box=${v.box.join(',')}`] : [])]));
      rec.triposr = lastJson(r);
    }
    save();
  }
  // 4. Decimate, scale to the replaced kit figure, face.
  const cutIdx = cutTriangles(kit, [f.cut as Box], f.cutMaterials ?? ['bronze']);
  const cutBox = boxOf(kit, cutIdx);
  const height = f.height ?? (cutBox ? cutBox.max[1] - cutBox.min[1] : undefined);
  if (!height) throw new Error(`${f.name}: nothing cut and no height`);
  const at: V3 = f.base ?? [(cutBox!.min[0] + cutBox!.max[0]) / 2, cutBox!.min[1], (cutBox!.min[2] + cutBox!.max[2]) / 2];
  rec.placement = {cutKitTriangles: cutIdx.size, heightM: +height.toFixed(3), baseM: at.map(v => +v.toFixed(3)), facingDeg: f.facing};
  const plain = path.join(fdir, 'figure.glb');
  if (steps.has('mesh')) {
    const trellis = f.route === 'trellis';
    let front = f.front ?? (trellis ? '-y' : '+x');
    if (trellis) { // the first photo's view comes out on -y in every run checked by eye (5 of 5); orient_front.py is recorded as a cross-check
      // only, because silhouettes cannot tell front from back (it picked +y twice where -y was right)
      rec.orient = lastJson(run(path.join(tools, 'mv/trellis2-apple/venv/bin/python'), ['-I', 'scripts/sculptures/multiview/orient_front.py', rawPly, path.join(fdir, 'mv-inputs/v0-rgba.png')]));
    }
    rec.front = front;
    const d = timed(T, 'decimate', () => run(py('venv-o3d'), ['-I', 'scripts/sculptures/decimate_scale_glb.py', rawPly, plain, `--height=${height}`, `--facing=${f.facing}`,
      `--tris=${f.tris ?? 6000}`, '--no-colors', `--front=${front}`, `--up=${f.up ?? 'z'}`, ...(trellis ? [`--remesh=${f.remesh ?? 192}`] : [])]));
    rec.mesh = lastJson(d);
    save();
  }
  rec.cutMask = cutIdx.size;
}

// 5. Compose: kit minus every figure's cut, plus every figure at its base.
const glb = path.join(out, `${id}.glb`);
if (steps.has('compose')) {
  const drop = new Set<number>();
  const figs: {tris: V3[][]; material: 'bronze' | 'stone'}[] = [];
  for (const f of cfg.figures) {
    const plain = path.join(out, f.name, 'figure.glb');
    if (!fs.existsSync(plain)) { console.error(`skip ${f.name}: no figure.glb`); continue; }
    const idx = cutTriangles(kit, [f.cut as Box], f.cutMaterials ?? ['bronze']);
    idx.forEach(i => drop.add(i));
    const at = source.figures[f.name].placement.baseM as V3;
    figs.push({tris: plainTriangles(await io.read(plain), at), material: f.material ?? 'bronze'});
  }
  const {doc, triangles, kitTriangles: kept} = composeDoc(id, kit, i => !drop.has(i), figs);
  await new NodeIO().write(glb, doc);
  source.result = {glb, triangles, keptKitTriangles: kept, figureTriangles: triangles - kept, droppedKitTriangles: drop.size};
  source.generated = new Date().toISOString();
  save();
  console.log(JSON.stringify(source.result));
}

// 6. Review sheet: photos row, kit four sides, rebuild four sides (gallery-card size, same camera distance).
if (steps.has('strip')) {
  const sdir = path.join(out, 'strips');
  fs.mkdirSync(sdir, {recursive: true});
  // `stripCrop` ({min, max}, kit frame) renders only that part of both models (a figure high on a large monument); the camera
  // distance defaults to 2.1 x the rendered height (at least 4 m), the same for both rows.
  const crop = cfg.stripCrop as Box | undefined;
  const cropped = async (g: string, name: string) => {
    if (!crop) return g;
    const d = await io.read(g); await d.transform(dequantize());
    // dropped to y = 0: landmark-strip aims at 0.35 x the model height above the ground
    const tris = kitTriangles(d).map(t => ({...t, ...Object.fromEntries((['a', 'b', 'c'] as const).map(k => [k, [t[k][0], t[k][1] - crop.min[1], t[k][2]]]))}));
    const lifted = (i: number, k: number) => (tris[i].a[k] + tris[i].b[k] + tris[i].c[k]) / 3 + (k === 1 ? crop.min[1] : 0);
    const {doc} = composeDoc(name, tris, i => [0, 1, 2].every(k => { const c = lifted(i, k); return c >= crop.min[k] && c <= crop.max[k]; }), []);
    const p = path.join(sdir, `${name}-crop.glb`);
    await new NodeIO().write(p, doc);
    return p;
  };
  const kitH = crop ? crop.max[1] - crop.min[1] : Math.max(...kit.flatMap(t => [t.a[1], t.b[1], t.c[1]]));
  const dist = arg('dist', String(cfg.stripDist ?? Math.max(4, +(kitH * 2.1).toFixed(1))));
  const queue = fs.existsSync('/tmp/canal-pw.sh') ? ['bash', '/tmp/canal-pw.sh'] : [];
  const strip = (g: string, dir: string, title: string) => {
    const cmd = [...queue, 'node', '--import', 'tsx', 'scripts/landmarks/landmark-strip.ts', `--id=${id}`, `--glb=${g}`, `--out=${dir}`, `--title=${title}`, `--dist=${dist}`];
    run(cmd[0], cmd.slice(1));
    return path.join(dir, 'strip-four-sides.png');
  };
  const titles = cfg.figures.flatMap((f: any) => f.views.map((v: any) => v.title));
  const photos = [...new Set(titles)].slice(0, 6).map(t => photoFile(t as string));
  const part = crop ? ' (figure part only)' : '';
  const kitStrip = strip(await cropped(source.kit, 'kit'), path.join(sdir, 'kit'), `${id}: kit model, in the game today${part}`);
  const routes = [...new Set(cfg.figures.map((f: any) => f.route === 'trellis' ? `TRELLIS.2 ${f.views.length} photos` : 'TripoSR 1 photo'))].join(' + ');
  const newStrip = strip(await cropped(glb, 'rebuild'), path.join(sdir, 'rebuild'), `${id}: rebuild (${routes}), ${source.result?.triangles ?? '?'} tris${part}`);
  const credit = [...new Set(titles)].map(t => `${source.photos[t as string].author.slice(0, 40)} ${source.photos[t as string].licence}`);
  const png = path.join(out, 'sheet.png');
  run(py('venv-o3d'), ['-I', 'scripts/sculptures/stack_strips.py', png, `photo:${id}: photos used (${[...new Set(credit)].join('; ')})|${photos.join('|')}`, kitStrip, newStrip]);
  const jpg = `docs/images/sculptures/${id}-rebuild.jpg`;
  run('magick', [png, '-resize', '1600x', '-strip', '-quality', '72', jpg]);
  source.sheet = jpg;
  save();
  console.log('sheet', jpg);
}

save();
