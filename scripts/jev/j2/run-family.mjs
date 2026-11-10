/**
 * J2: run one fixture over one set.
 *   zsh -lic 'node scripts/jev/j2/run-family.mjs --fixture=colour --run=r1 [--limit=n] [--conc=4]'
 * fixture = fixtures/<name>.json: {family, set: "A"|"B"|"AB"|"J1"|"pairs", fixedImages: {part: "swatch:#rrggbb" | path}, questions, note, crop?: "crown"}
 * Writes <cache>/runs/<family>/<run>/<id>.json (request without bytes/headers + response). Key from env only; 401/403 stops; no retries.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {CACHE, arg, askJev, pool, prepImage} from './lib.mjs';

const name = arg('fixture'), RUN = arg('run', 'r1'), LIMIT = +arg('limit', '1e9'), CONC = +arg('conc', '4');
const fx = JSON.parse(await fs.readFile(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const sets = JSON.parse(await fs.readFile(path.join(CACHE, 'sets.json'), 'utf8'));
const J1 = '/Users/blackmad/Code/map-recall2/.cache/jev-facades';

async function items() {
  if (fx.set === 'J1') { const s = JSON.parse(await fs.readFile(path.join(J1, 'set.json'), 'utf8')); return s.map(c => ({id: c.pandId, file: path.join(J1, c.crop.file)})); }
  if (fx.set === 'triples') return JSON.parse(await fs.readFile(path.join(CACHE, 'triples.json'), 'utf8')).map(t => ({id: t.id, images: t.files}));
  if (fx.set === 'pairs') return JSON.parse(await fs.readFile(path.join(CACHE, 'pairs.json'), 'utf8')).map(p => ({id: p.id, file: p.a, file2: p.b}));
  const ids = fx.set.split('').flatMap(k => sets[k]);
  return ids.map(p => ({id: p, file: path.join(CACHE, 'img', `${p}.jpg`)}));
}
const fixed = {};
for (const [part, v] of Object.entries(fx.fixedImages ?? {})) {
  if (v.startsWith('swatch:')) {
    const out = path.join(CACHE, 'swatches', `${v.slice(8)}.jpg`);
    await fs.mkdir(path.dirname(out), {recursive: true});
    await sharp({create: {width: 300, height: 300, channels: 3, background: v.slice(7)}}).jpeg({quality: 95}).toFile(out);
    fixed[part] = out;
  } else fixed[part] = path.resolve(v);
}
const outDir = path.join(CACHE, 'runs', fx.family, RUN);
await fs.mkdir(outDir, {recursive: true});
let list = (await items()).slice(0, LIMIT), done = 0;
if (fx.cropTop) { // crown-only crops of the top share of each crop, re-prepared to Jev's size rules
  for (const it of list) {
    const m = await sharp(it.file).metadata(), out = path.join(CACHE, 'crown', `${it.id}.jpg`);
    const buf = await sharp(it.file).extract({left: 0, top: 0, width: m.width, height: Math.round(m.height * fx.cropTop)}).toBuffer();
    await fs.mkdir(path.dirname(out), {recursive: true}); await fs.writeFile(out + '.raw.jpg', buf);
    const r = await prepImage(out + '.raw.jpg', out);
    if (r) it.file = out; else it.skip = true;
  }
  list = list.filter(x => !x.skip);
}
await pool(list, CONC, async it => {
  const images = it.images ? {...it.images, ...fixed} : {facade: it.file, ...fixed};
  if (it.file2) images.facade2 = it.file2;
  const r = await askJev({images, questions: fx.questions, note: fx.note, family: `${fx.family}`});
  await fs.writeFile(path.join(outDir, `${it.id}.json`), JSON.stringify({id: it.id, run: RUN, status: r.status, latencyMs: r.latencyMs, tokens: r.tokens, request: r.request, response: r.body}, null, 1));
  done++;
  if (r.status !== 200) console.log(it.id, r.status, JSON.stringify(r.body).slice(0, 200));
});
const {readLedger} = await import('./lib.mjs');
const l = await readLedger();
console.log(`${fx.family}/${RUN}: ${done} calls; family spend $${l.families[fx.family]?.usd}; total $${l.total}`);
