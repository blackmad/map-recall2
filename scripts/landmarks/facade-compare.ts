/**
 * Structured facade comparison gate: photo inventory vs GLB.
 *
 *   node --import tsx scripts/landmarks/facade-compare.ts --id=<id>
 *     [--glb=public/canal-drive/models/<id>.glb] [--spec=scripts/landmarks/<id>-elevations.json]
 *     [--out=artifacts/landmark-lanes/<id>/elevations]
 *   node --import tsx scripts/landmarks/facade-compare.ts --id=<id> --probe   # list bearings with lots of facing wall
 *
 * Writes, per facade, `<out>/<facade>.png`: the reference photo (if given) beside an orthographic
 * elevation of the model with every detected opening boxed and each row numbered. Exit 1 when any
 * declared count (openings per row, window axes, symmetry, gable peaks) disagrees.
 *
 * The spec must be counted from the photo, not from the model (see docs/landmark-building-recipe.md
 * §7, "Structured facade comparison"). Logic lives in src/canalRecall/landmarks/facadeCompare.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {compare, measureFacade, normalForBearing, type ElevationsFile, type MaterialSoup} from '../../src/canalRecall/landmarks/facadeCompare';
import {loadMaterialSoup} from './material-soup';

const ROOT = path.resolve(import.meta.dirname, '../..');
const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const id = arg('id');
if (!id) { console.error('--id=<model id> required'); process.exit(2); }
const glb = arg('glb') ?? path.join(ROOT, `public/canal-drive/models/${id}.glb`);
const specPath = arg('spec') ?? path.join(ROOT, `scripts/landmarks/${id}-elevations.json`);
const outDir = arg('out') ?? path.join(ROOT, `artifacts/landmark-lanes/${id}/elevations`);


/** Facing wall area per 5° bearing bucket, to help pick facade bearings. */
function probe(soup: MaterialSoup) {
  const P = soup.positions, I = soup.indices, bins = new Float64Array(72);
  for (let k = 0; k * 3 + 2 < I.length; k++) {
    const a = I[k * 3] * 3, b = I[k * 3 + 1] * 3, c = I[k * 3 + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const wx = P[c] - P[a], wy = P[c + 1] - P[a + 1], wz = P[c + 2] - P[a + 2];
    const qx = uy * wz - uz * wy, qy = uz * wx - ux * wz, qz = ux * wy - uy * wx;
    const l = Math.hypot(qx, qy, qz);
    if (l < 1e-9 || Math.abs(qy / l) > 0.3) continue;
    const bearing = (Math.atan2(qx, -qz) * 180 / Math.PI + 360) % 360;
    bins[Math.floor(bearing / 5) % 72] += l / 2;
  }
  const list = [...bins].map((a, i) => ({bearing: i * 5 + 2.5, area: a})).filter(b => b.area > 5).sort((p, q) => q.area - p.area).slice(0, 8);
  for (const b of list) console.log(`bearing ${b.bearing.toFixed(1).padStart(5)}°  facing area ${b.area.toFixed(0)} m²`);
}

async function elevationPng(m: ReturnType<typeof measureFacade>, file: string, photo?: string) {
  const {data, width: W, height: H, cell} = m.image;
  const rgb = Buffer.from(data);
  const totalH = H * cell;
  const box = (t0: number, t1: number, y0: number, y1: number, col: [number, number, number]) => {
    const x0 = Math.round(t0 / cell), x1 = Math.round(t1 / cell) - 1, r0 = Math.round((totalH - y1) / cell), r1 = Math.round((totalH - y0) / cell) - 1;
    const put = (x: number, y: number) => { if (x >= 0 && y >= 0 && x < W && y < H) rgb.set(col, (y * W + x) * 3); };
    for (let x = x0; x <= x1; x++) { put(x, r0); put(x, r1); }
    for (let y = r0; y <= r1; y++) { put(x0, y); put(x1, y); }
  };
  for (const o of m.openings) box(o.t0, o.t1, o.y0, o.y1, [230, 30, 30]);
  const scale = 640 / Math.max(H, 1), mw = Math.max(1, Math.round(W * scale)), mh = 640;
  let model = await sharp(rgb, {raw: {width: W, height: H, channels: 3}}).resize({width: mw, height: mh, kernel: 'nearest'}).png().toBuffer();
  const lw = Math.max(mw, 360);
  const label = Buffer.from(`<svg width="${lw}" height="44"><rect width="100%" height="44" fill="#222"/><text x="6" y="17" font-family="Helvetica" font-size="14" fill="#fff">MODEL ${m.name}</text><text x="6" y="37" font-family="Helvetica" font-size="13" fill="#fc6">rows ${m.rows.join(',')} · axes ${m.columns} · sym ${m.symmetry} · gables ${m.gables}</text></svg>`);
  model = await sharp({create: {width: lw, height: mh + 44, channels: 3, background: '#fff'}}).composite([{input: label, top: 0, left: 0}, {input: model, top: 44, left: 0}]).png().toBuffer();
  const tiles = [model];
  if (photo && fs.existsSync(path.resolve(ROOT, photo))) tiles.unshift(await sharp(path.resolve(ROOT, photo)).resize({height: mh + 44}).png().toBuffer());
  const metas = await Promise.all(tiles.map(t => sharp(t).metadata()));
  const h = Math.max(...metas.map(x => x.height!)), w = metas.reduce((a, x) => a + x.width! + 8, 0);
  let x = 0;
  await sharp({create: {width: w, height: h, channels: 3, background: '#fff'}})
    .composite(tiles.map((t, i) => { const c = {input: t, top: 0, left: x}; x += metas[i].width! + 8; return c; }))
    .png().toFile(file);
}

const soup = await loadMaterialSoup(glb);
if (process.argv.includes('--probe')) { probe(soup); process.exit(0); }
if (!fs.existsSync(specPath)) { console.error(`no photo inventory at ${specPath}; write one from the reference photo first`); process.exit(2); }
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8')) as ElevationsFile;
fs.mkdirSync(outDir, {recursive: true});
let failed = 0;
const report: unknown[] = [];
for (const f of spec.facades) {
  const m = measureFacade(soup, f);
  const checks = compare(f, m);
  const slug = f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const png = path.join(outDir, `${slug}.png`);
  await elevationPng(m, png, f.photo);
  const n = normalForBearing(f.bearing);
  console.log(`\n${f.name} (bearing ${f.bearing}°, n=[${n.map(v => v.toFixed(2))}]) width ${m.width.toFixed(1)} m → ${path.relative(ROOT, png)}`);
  for (const c of checks) {
    if (!c.pass) failed++;
    console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.what.padEnd(30)} photo ${c.expected.padEnd(22)} model ${c.measured}`);
  }
  report.push({facade: f.name, checks, measured: {rows: m.rows, rowHeights: m.rowHeights, columns: m.columns, symmetry: m.symmetry, gables: m.gables, width: m.width}});
}
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({id, spec: path.relative(ROOT, specPath), countedBy: spec.countedBy, failed, report}, null, 1));
console.log(failed ? `\n${failed} facade check(s) FAIL` : '\nall facade checks pass');
process.exit(failed ? 1 : 0);
