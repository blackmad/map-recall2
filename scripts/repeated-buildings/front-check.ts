/**
 * Front check for the footprint groups of detect.ts (2026-11-15). The same footprint can carry different fronts, so a
 * footprint group is only a candidate: membership is decided on the front.
 *
 *   node --import tsx scripts/repeated-buildings/front-check.ts --report=artifacts/repeated-buildings/detect-v1.json \
 *     [--top=20] [--max-per-group=40] [--skip-fetch] [--out=artifacts/repeated-buildings/front-check]
 *
 * Per group (ranked as in the report), every copy on the ride ring (exposure > 0; up to --max-per-group, most-ridden
 * first) gets a pand-reference front (`scripts/pand-reference/run.ts`, one run per group, Amsterdam panoramas CC BY 4.0,
 * staged under staging/pand-reference/repeated/). Each rectified front is read by `frontMeasure.readFront` (wall colour,
 * window columns and rows, glazing share); copies join a front family when `sameFront` holds against the family's
 * first member (the most-ridden). Writes <out>/front-check.json (families per group, why copies split) and
 * <out>/<group>.jpg: a montage of the aimed thumbnails, one row per family, labelled, for an opus reviewer.
 */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
import {readFront, sameFront, type FrontRead} from '../../src/canalRecall/repeatedBuildings/frontMeasure.ts';

const arg = (n: string, d: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const report = JSON.parse(fs.readFileSync(arg('report', 'artifacts/repeated-buildings/detect-v1.json'), 'utf8'));
const TOP = Number(arg('top', '20')), MAX = Number(arg('max-per-group', '40')), OUT = arg('out', 'artifacts/repeated-buildings/front-check');
const only = arg('only', '').split(',').filter(Boolean);
const REF = 'staging/pand-reference/repeated', PPM = 50;
const skipFetch = process.argv.includes('--skip-fetch');
fs.mkdirSync(OUT, {recursive: true});

interface Copy { pand: string; exposure: number; street: string | null; status: string; read: FrontRead | null; family: number; why?: string }
const results: any[] = [];
const groups = (report.groups as any[]).filter(g => !only.length || only.includes(g.group)).slice(0, only.length ? undefined : TOP);
for (const g of groups) {
  const members = (g.members as any[]).filter(m => m.exposure > 0).slice(0, MAX);
  const ids = members.map(m => m.pand).filter(id => !fs.existsSync(path.join(REF, id, 'reference.json')));
  if (ids.length && !skipFetch) {
    try { execFileSync('node', ['--import', 'tsx', 'scripts/pand-reference/run.ts', `--name=rep-${g.group}`, `--ids=${ids.join(',')}`, `--out=${REF}`], {stdio: ['ignore', 'ignore', 'inherit'], timeout: 1_800_000}); }
    catch (e) { console.error(`${g.group}: pand-reference failed: ${(e as Error).message}`); }
  }
  const copies: Copy[] = [];
  for (const m of members) {
    const dir = path.join(REF, m.pand), refFile = path.join(dir, 'reference.json');
    const ref = fs.existsSync(refFile) ? JSON.parse(fs.readFileSync(refFile, 'utf8')) : null;
    let read: FrontRead | null = null;
    if (ref?.images?.front && fs.existsSync(path.join(dir, 'front.jpg'))) {
      const {data, info} = await sharp(path.join(dir, 'front.jpg')).removeAlpha().raw().toBuffer({resolveWithObject: true});
      read = readFront(data, info.width, info.height, info.channels, ref.primary?.pixelsPerMetre ?? PPM);
    }
    copies.push({pand: m.pand, exposure: m.exposure, street: m.street, status: ref?.status ?? 'no-reference', read, family: -1});
  }
  // families: leader clustering in exposure order; a copy without a usable read stays unassigned (-1)
  const leaders: Copy[] = [];
  for (const c of copies) {
    if (!c.read || c.status !== 'ok') { c.why = c.read ? c.status : 'no front'; continue; }
    const k = leaders.findIndex(l => sameFront(l.read!, c.read!).same);
    if (k >= 0) c.family = k; else { c.family = leaders.length; leaders.push(c); }
    if (k !== 0 && leaders.length > 1) c.why = sameFront(leaders[0].read!, c.read).why;
  }
  const famSizes = leaders.map((_, k) => copies.filter(c => c.family === k).length);
  const read = copies.filter(c => c.family >= 0).length;
  results.push({group: g.group, copies: g.copies, onRoute: (g.members as any[]).filter(m => m.exposure > 0).length, checked: members.length, read,
    families: leaders.map((l, k) => ({family: k, size: famSizes[k], leader: l.pand, wall: l.read!.wall.hex, bays: l.read!.bays, rows: l.read!.rows, glazing: l.read!.glazing})),
    largestFamilyShare: read ? +(Math.max(0, ...famSizes) / read).toFixed(2) : 0, copiesDetail: copies});
  // montage: one row per family (largest first), unassigned last
  const S = 240, C = 8, order = [...leaders.keys()].sort((a, b) => famSizes[b] - famSizes[a]);
  const rows: Copy[][] = [];
  for (const k of order) { const fam = copies.filter(c => c.family === k); for (let i = 0; i < fam.length; i += C) rows.push(fam.slice(i, i + C)); }
  const un = copies.filter(c => c.family < 0); for (let i = 0; i < un.length; i += C) rows.push(un.slice(i, i + C));
  const comps: sharp.OverlayOptions[] = [];
  for (let r = 0; r < rows.length; r++) for (let i = 0; i < rows[r].length; i++) {
    const c = rows[r][i], thumb = path.join(REF, c.pand, 'thumb.jpg');
    const img = fs.existsSync(thumb) ? await sharp(thumb).resize(S, S, {fit: 'cover'}).toBuffer() : await sharp({create: {width: S, height: S, channels: 3, background: '#333'}}).png().toBuffer();
    const label = `${c.family >= 0 ? 'F' + c.family : '--'} ${c.pand.slice(-6)} ${c.read ? `${c.read.bays}x${c.read.rows} ${c.read.wall.hex}` : c.status}`;
    comps.push({input: img, left: i * S, top: r * S}, {input: Buffer.from(`<svg width="${S}" height="20"><rect width="${S}" height="20" fill="#000" opacity=".75"/><text x="3" y="15" font-size="13" fill="#fff" font-family="sans-serif">${label}</text></svg>`), left: i * S, top: r * S});
  }
  if (rows.length) await sharp({create: {width: S * C, height: S * rows.length, channels: 3, background: '#111'}}).composite(comps).jpeg({quality: 78}).toFile(path.join(OUT, `${g.group}.jpg`));
  console.log(`${g.group}: ${members.length} checked, ${read} read, families ${famSizes.join('/')}`);
}
fs.writeFileSync(path.join(OUT, 'front-check.json'), JSON.stringify({generatedAt: new Date().toISOString(), groups: results}, null, 1));
console.log(`wrote ${OUT}/front-check.json`);
