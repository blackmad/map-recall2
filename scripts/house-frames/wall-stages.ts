/**
 * Wall-colour error per stage (lane W1, 2026-11-12). For every pand of a house:frames run, the wall colour at each
 * stage of the generic path, in OKLab, against the photo half of the same pose:
 *
 *   photo    house:frames wallLab on photo.jpg (the panorama cut, 30-70 % lightness band of the wall)
 *   reading  the spec extract's photo reading (houseSpec.wallHex), spec pands only
 *   source   what the period path draws without a reading: the measured wall pool (look/measuredWallPool.ts, `pool`), the
 *            buurt profile's era wall (`profile`), or the period list's hash pick (`period`)
 *   decorated  decorate.ts specRecipe.wallHex (spec pands) or the source (period pands)
 *   mesher   meshBuildingFor(...).wallHex, the vertex tint before jitter
 *   pixel    house:frames wallLab on game.png
 *
 * Stages reported (dL, dC, dh, dE as OKLab):
 *   reading vs photo, decorated vs reading, mesher vs decorated, pixel vs mesher, and the end to end pixel vs photo.
 * A pand drawn by an installed model (chunk, ordinary, landmark) is class `model`: its pixel has no Node-side stage.
 *
 *   node --import tsx scripts/house-frames/wall-stages.ts <framesDir> [--keys a,b,...] [--json out.json] [--md out.md]
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { PreviewSession } from '../house-preview/preview.ts';
import { asPolygons, meshBuildingFor } from '../../src/canalRecall/threeBuildingFeatures.ts';
import { bayLookFor } from '../../src/canalRecall/bayLook.ts';
import { buurtProfileAt } from '../../src/canalRecall/buurtProfiles/data.ts';
import { measuredPoolWall } from '../../src/canalRecall/look/measuredWallPool.ts';
import { hashSeed } from '../../src/canalRecall/wallBays.ts';
import { frameFor } from './pose.ts';
import { rgbOklab, wallLab, type WallLab } from './analyse.ts';
import type { Rgb8 } from './photo.ts';

const argv = process.argv.slice(2);
const arg = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const dir = path.resolve(argv[0]);
const keys = arg('keys')?.split(',').filter(Boolean);

export type Lab3 = { L: number; a: number; b: number; C: number; h: number; hex: string };
export const hexLab = (hex: string): Lab3 => {
  const n = parseInt(hex.slice(1), 16), [L, a, b] = rgbOklab((n >> 16) & 255, (n >> 8) & 255, n & 255);
  return { L: +L.toFixed(3), a, b, C: +Math.hypot(a, b).toFixed(3), h: +(((Math.atan2(b, a) * 180) / Math.PI + 360) % 360).toFixed(0), hex };
};
const fromWall = (w: WallLab | null): Lab3 | null => {
  if (!w) return null;
  const r = (w.h * Math.PI) / 180;
  return { L: w.L, a: w.C * Math.cos(r), b: w.C * Math.sin(r), C: w.C, h: w.h, hex: w.hex };
};
export const delta = (p: Lab3 | null, q: Lab3 | null) => {
  if (!p || !q) return null;
  let dh = p.h - q.h; if (dh > 180) dh -= 360; if (dh < -180) dh += 360;
  return { dL: +(p.L - q.L).toFixed(3), dC: +(p.C - q.C).toFixed(3), dh: Math.round(dh), dE: +Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b).toFixed(3) };
};

async function readRgb(file: string, w?: number, h?: number): Promise<Rgb8> {
  let s = sharp(file).removeAlpha();
  if (w && h) s = s.resize(w, h, { fit: 'fill' });
  const { data, info } = await s.raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data) };
}

const prepared: any[] = JSON.parse(fs.readFileSync(path.join(dir, 'prepared.json'), 'utf8')).prepared;
const session = new PreviewSession('photo');
const rows: any[] = [];
for (const prep of prepared) {
  if (keys && !keys.includes(prep.key)) continue;
  const kdir = path.join(dir, prep.key);
  if (!fs.existsSync(path.join(kdir, 'game.png'))) continue;
  const frame = frameFor(prep.pose);
  const photo = await readRgb(path.join(kdir, 'photo.jpg')), game = await readRgb(path.join(kdir, 'game.png'), prep.pose.width, prep.pose.height);
  const ph = fromWall(wallLab(photo, frame, prep.pose, prep.wall)), px = fromWall(wallLab(game, frame, prep.pose, prep.wall));
  const g = fs.existsSync(path.join(kdir, 'game.json')) ? JSON.parse(fs.readFileSync(path.join(kdir, 'game.json'), 'utf8')) : {};
  const model = String(prep.route ?? '').startsWith('installed') ;
  let at: number[] | null = null, reading: string | null = null, decorated: string | null = null, source: string | null = null, sourceKind = '', mesher: string | null = null, held = false, archetype = '', year: number | null = null, material: string | null = null, finish: string | null = null, specSrc: string | null = null;
  try {
    const tile = session.tileOf(prep.pandId), trows = await session.rows(tile);
    const row = trows.find((r: any) => String(r.raw.properties?.id ?? '').endsWith(prep.pandId));
    if (row) {
      const p = row.styled.properties as Record<string, any>, raw = row.raw.properties as Record<string, any>;
      reading = raw.houseSpec?.wallHex ?? p.houseSpec?.wallHex ?? null;
      specSrc = p.houseSpec?.src?.wallHex ?? null;
      material = p.houseSpec?.wallMaterial ?? null; finish = p.registerFinish ?? null;
      decorated = p.specRecipe?.wallHex ?? null; held = !!p.specRecipe?.heldBrick;
      year = p.constructionYear == null || !Number.isFinite(Number(p.constructionYear)) ? null : Number(p.constructionYear);
      const ring = asPolygons(row.styled.geometry)[0]?.[0] ?? [];
      at = ring.length ? [ring.reduce((s, q) => s + q[0], 0) / ring.length, ring.reduce((s, q) => s + q[1], 0) / ring.length] : null;
      const first = ring[0];
      const profile = first ? buurtProfileAt(first[0], first[1]) : null;
      const bay = bayLookFor(String(p.id), year, Number(p.height) || 10, 'photo', 'quiet', undefined, undefined, profile, undefined, undefined, first ? [first[0], first[1]] : undefined);
      archetype = bay.archetype; source = bay.wallHex;
      const pool = first ? measuredPoolWall(first[0], first[1], bay.archetype, hashSeed(String(p.id)) >>> 7) : null;
      sourceKind = pool && pool === bay.wallHex ? 'pool' : bay.profileWall ? 'profile' : 'period';
      const b = meshBuildingFor(row.styled as any, 'photo');
      mesher = b?.wallHex ?? null;
    }
  } catch (e) { sourceKind = `error ${(e as Error).message.slice(0, 60)}`; }
  const cls = model ? 'model' : decorated ? 'spec' : held ? 'held' : sourceKind || 'unknown';
  const L = { photo: ph, pixel: px, reading: reading ? hexLab(reading) : null, source: source ? hexLab(source) : null, decorated: decorated ? hexLab(decorated) : source ? hexLab(source) : null, mesher: mesher ? hexLab(mesher) : null };
  rows.push({
    key: prep.key, pandId: prep.pandId, street: prep.street, at, route: prep.route, cls, archetype, year, material, finish, specSrc, sourceKind,
    hex: { photo: ph?.hex ?? null, reading, source, decorated, mesher, pixel: px?.hex ?? null }, drawn: g.drawn ?? null,
    lab: L,
    stage: {
      readingVsPhoto: delta(L.reading, ph), sourceVsPhoto: delta(L.source, ph), decoratedVsReading: delta(L.decorated, L.reading),
      mesherVsDecorated: delta(L.mesher, L.decorated), pixelVsMesher: model ? null : delta(px, L.mesher), pixelVsPhoto: delta(px, ph),
    },
  });
}

const stat = (xs: number[]) => xs.length ? { n: xs.length, mean: +(xs.reduce((s, v) => s + v, 0) / xs.length).toFixed(3), median: +[...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)].toFixed(3) } : { n: 0, mean: NaN, median: NaN };
const STAGES = ['readingVsPhoto', 'sourceVsPhoto', 'decoratedVsReading', 'mesherVsDecorated', 'pixelVsMesher', 'pixelVsPhoto'] as const;
const classes = [...new Set(rows.map(r => r.cls))];
const table: any = {};
for (const c of ['all', ...classes]) {
  const rs = rows.filter(r => c === 'all' || r.cls === c);
  table[c] = Object.fromEntries(STAGES.map(s => {
    const ds = rs.map(r => r.stage[s]).filter(Boolean);
    return [s, { n: ds.length, dL: stat(ds.map((d: any) => d.dL)).mean, dC: stat(ds.map((d: any) => d.dC)).mean, dh: stat(ds.map((d: any) => d.dh)).median, dE: stat(ds.map((d: any) => d.dE)).mean, absdL: stat(ds.map((d: any) => Math.abs(d.dL))).mean }];
  }));
}
const out = { dir, n: rows.length, table, rows };
if (arg('json')) fs.writeFileSync(arg('json')!, JSON.stringify(out, null, 1));
const md = [`| class | stage | n | dL mean | |dL| mean | dC mean | dh median | dE mean |`, `|---|---|---|---|---|---|---|---|`];
for (const [c, t] of Object.entries(table) as [string, any][]) for (const s of STAGES) { const v = t[s]; if (v.n) md.push(`| ${c} | ${s} | ${v.n} | ${v.dL} | ${v.absdL} | ${v.dC} | ${v.dh} | ${v.dE} |`); }
if (arg('md')) fs.writeFileSync(arg('md')!, md.join('\n') + '\n');
console.log(md.join('\n'));
