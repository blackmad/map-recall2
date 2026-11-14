// D1 wall colour (lane d1-wall-colour, 2026-11-14): W1 `wallLab` (OKLab, 30-70 % trimmed, 3-12 m band) of every pand's BAG
// wall in the rule-10 likeness frames of several house:frames runs of the same lists, per pand and per row (mean over the
// row's pands that read in the photo). Walls come from the D1 cuts (cuts.json `wall`), rows from row-groups.json.
//
//   node --import tsx scripts/house-specs/wall-sample/row-lab.ts --belt <belt dir> --runs today=<dir>,staged=<dir>[,...] \
//        [--rows key1,key2] [--groups g.json[,g2.json]] [--cuts c.json[,c2.json]] [--out rows-lab.json]
// (--groups / --cuts default to <belt>/row-groups.json and <belt>/cuts/cuts.json)
// <dir> holds <side>/<key>/likeness.png (and likeness-photo.jpg in the first run). Prints one line per row.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { wallLab } from '../../house-frames/analyse.ts';
import { frameFor } from '../../house-frames/pose.ts';
import { sceneRef } from './captures.ts';

type Lab = { L: number; C: number; h: number; hex: string; n: number } | null;
const load = async (f: string) => { const { data, info } = await sharp(f).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) }; };

export async function rowLab(belt: string, runs: Array<[string, string]>, only?: Set<string>, groupFiles?: string[], cutFiles?: string[]) {
  const groups = Object.assign({}, ...(groupFiles ?? [path.join(belt, 'row-groups.json')]).map(f => JSON.parse(fs.readFileSync(f, 'utf8')))) as Record<string, Array<{ key: string; pands: Array<{ pandId: string; number: number; staged: boolean }> }>>;
  const cuts = new Map<string, any>((cutFiles ?? [path.join(belt, 'cuts/cuts.json')]).flatMap(f => JSON.parse(fs.readFileSync(f, 'utf8')).rows.map((r: any) => [r.pandId, r] as [string, any])));
  const out: Record<string, any> = {};
  for (const [side, rows] of Object.entries(groups)) for (const row of rows) {
    if (only && !only.has(row.key)) continue;
    const first = path.join(runs[0][1], side, row.key), poseFile = path.join(first, 'pose.json');
    if (!fs.existsSync(poseFile)) continue;
    const lp = JSON.parse(fs.readFileSync(poseFile, 'utf8')).rule10?.likeness?.lp?.pose;
    if (!lp) continue;
    const imgs: Array<[string, string]> = [['photo', path.join(first, 'likeness-photo.jpg')], ...runs.map(([n, d]) => [n, path.join(d, side, row.key, 'likeness.png')] as [string, string])];
    const per: Record<string, Record<string, Lab>> = {};
    let photoScene: [number, number, number] | null = null;
    for (const [name, file] of imgs) {
      if (!fs.existsSync(file)) continue;
      const img = await load(file), pose = { ...lp, width: img.width, height: img.height }, frame = frameFor(pose);
      if (name === 'photo') photoScene = sceneRef(img);
      for (const p of row.pands) {
        const w = cuts.get(p.pandId)?.wall;
        if (!w) continue;
        (per[p.pandId] ??= {})[name] = wallLab(img, frame, pose, { a: w.a, b: w.b, heightM: w.heightM });
      }
    }
    const names = imgs.map(([n]) => n), ok = Object.values(per).filter(v => v.photo && names.every(n => v[n]));
    const mean = (n: string, k: 'L' | 'C') => ok.length ? +(ok.reduce((s, v) => s + v[n]![k], 0) / ok.length).toFixed(3) : null;
    out[row.key] = { side, n: ok.length, photoScene, mean: Object.fromEntries(names.map(n => [n, { L: mean(n, 'L'), C: mean(n, 'C') }])), per };
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2), opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const runs = opt('runs')!.split(',').map(s => s.split('=') as [string, string]);
  const only = opt('rows') ? new Set(opt('rows')!.split(',')) : undefined;
  const list = (n: string) => opt(n)?.split(',').filter(Boolean);
  const res = await rowLab(path.resolve(opt('belt') ?? '.'), runs, only, list('groups'), list('cuts'));
  if (opt('out')) fs.writeFileSync(opt('out')!, `${JSON.stringify(res, null, 1)}\n`);
  for (const [k, r] of Object.entries<any>(res)) console.log(`${k.padEnd(22)} n ${r.n}  ${Object.entries<any>(r.mean).map(([n, m]) => `${n} L ${m.L} C ${m.C}`).join(' | ')}`);
}
