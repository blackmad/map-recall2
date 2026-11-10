/**
 * Openings and wall-stability gate over the hand-labelled fronts (lane H2d, docs/house-line.md "Openings and a stable
 * wall"). Fixtures: src/canalRecall/buildingRecipe/fixtures/wall-trim (cases.json crops, openings-labels.json hand
 * openings). For each front it prints the measured glazing against the hand glazing and the wall colour under a
 * +-10 cm jitter of the measuring box.
 *
 *   node --import tsx scripts/house-preview/openings-gate.ts [--no-opening-split | --opening-split=groups,core,solidBody,clusterWall] [--out=<file.json>]
 *
 * Without a flag every part of the opening split is on (`OPENING_SPLIT_ALL`), which is the reading the gate judges; the
 * measureFacade default is narrower (`OPENING_SPLIT_DEFAULT`).
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {measureFacade, openingSplitFromArgs, type OpeningSplit} from '../../src/canalRecall/buildingRecipe/measureFacade.ts';
import {blurRgb} from '../../src/canalRecall/houseSpec/previewVerdict.ts';
import {handGlazing, jitterBoxes, hslLightness, type OpeningsLabel} from '../../src/canalRecall/buildingRecipe/handLabels.ts';

export const GATE = {glazingTol: 0.1, wallSpread: 0.02, darkMaxL: 0.3} as const;
const DIR = path.join(path.dirname(new URL(import.meta.url).pathname), '../../src/canalRecall/buildingRecipe/fixtures/wall-trim');
export const FIXTURES: {name: string; file: string; ppm: number; topM: number; box: {u0: number; u1: number; v0: number; v1: number}; lines: number[]}[] = JSON.parse(fs.readFileSync(path.join(DIR, 'cases.json'), 'utf8'));
export const LABELS: Record<string, OpeningsLabel> = JSON.parse(fs.readFileSync(path.join(DIR, 'openings-labels.json'), 'utf8'));

export async function measureCase(c: (typeof FIXTURES)[number], opts: {openingSplit?: boolean | Partial<OpeningSplit>} = {}, box = c.box) {
  const {data, info} = await sharp(path.join(DIR, c.file)).removeAlpha().raw().toBuffer({resolveWithObject: true});
  const rgb = blurRgb(new Uint8Array(data), info.width, info.height, 1.5);
  return measureFacade({image: {width: info.width, height: info.height, rgb, ppm: c.ppm, topM: c.topM}, box, lines: c.lines, ...(opts.openingSplit === undefined ? {} : {openingSplit: opts.openingSplit})});
}

export async function runGate(opts: {openingSplit?: boolean | Partial<OpeningSplit>} = {}) {
  const rows = [];
  for (const c of FIXTURES) {
    const label = LABELS[c.name], m = await measureCase(c, opts), hand = handGlazing(label, c.box);
    const boxes = jitterBoxes(c.box), reads = [];
    for (const b of boxes) { const j = b === c.box ? m : await measureCase(c, opts, b); reads.push({hex: j.wall.hex, l: hslLightness(j.wall.hex), glazing: j.glazing}); }
    const ls = reads.map(r => r.l), gs = reads.map(r => r.glazing);
    rows.push({name: c.name, wall: m.wall.hex, wallL: +hslLightness(m.wall.hex).toFixed(3), dark: hslLightness(m.wall.hex) <= GATE.darkMaxL || /dark/.test(c.name), glazing: m.glazing, hand: +hand.toFixed(3),
      err: +(m.glazing - hand).toFixed(3), glazingOk: Math.abs(m.glazing - hand) <= GATE.glazingTol,
      jitterBoxes: boxes.length, wallLSpread: +(Math.max(...ls) - Math.min(...ls)).toFixed(3), wallHexes: [...new Set(reads.map(r => r.hex))], glazingSpread: +(Math.max(...gs) - Math.min(...gs)).toFixed(3)});
  }
  return rows;
}

async function main() {
  const rows = await runGate({openingSplit: true, ...openingSplitFromArgs(process.argv)});
  const out = process.argv.find(a => a.startsWith('--out='))?.slice(6);
  if (out) fs.writeFileSync(out, JSON.stringify(rows, null, 1));
  console.log('front'.padEnd(26), 'wall'.padEnd(8), 'glazing hand  err   ok  | wall L spread  (jitter hexes)');
  for (const r of rows) console.log(r.name.padEnd(26), r.wall.padEnd(8), String(r.glazing).padEnd(7), String(r.hand).padEnd(5), String(r.err).padEnd(6), (r.glazingOk ? 'ok' : 'MISS').padEnd(4), '|', String(r.wallLSpread).padEnd(6), r.wallHexes.length > 1 ? r.wallHexes.join(' ') : '');
  const ok = rows.filter(r => r.glazingOk).length;
  console.log(`glazing within +-${GATE.glazingTol}: ${ok}/${rows.length}; dark fronts ok ${rows.filter(r => r.dark && r.glazingOk).length}/${rows.filter(r => r.dark).length}; wall L spread max ${Math.max(...rows.map(r => r.wallLSpread))} (gate ${GATE.wallSpread}), fronts over: ${rows.filter(r => r.wallLSpread > GATE.wallSpread).map(r => r.name).join(', ') || 'none'}`);
}
if (process.argv[1]?.endsWith('openings-gate.ts')) main();
