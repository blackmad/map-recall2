// Run from the repo root: node --import tsx scripts/landmarks/calibrate-wall-family.ts [unresolved|controls].
// The paint/metal thresholds in src/canalRecall/buildingRecipe/wallFamily.ts came from this run over 116 unresolved
// triage crops and 45 brick controls (#146, 2026-10-31).
// Calibration (#146): wallFamilyEvidence on the unresolved street-wall crops of the triage report, plus controls.
import fs from 'node:fs'; import path from 'node:path'; import sharp from 'sharp';
import {measureFacade} from '../../src/canalRecall/buildingRecipe/measureFacade.ts';
import {wallFamilyEvidence, proposeWallFamily} from '../../src/canalRecall/buildingRecipe/wallFamily.ts';
const A = '/Users/blackmad/Code/map-recall2-worktrees/source-archive/pand-reference-walls', S = '/Users/blackmad/Code/map-recall2-source-data/pand-reference-walls';
const rep = JSON.parse(fs.readFileSync('docs/reports/landmark-triage-20261030.json', 'utf8'));
const which = process.argv[2] ?? 'unresolved';
const jobs: {pand: string; wall: string; crop: string; heightM: number; label: string}[] = [];
for (const r of rep.rows) for (const w of r.walls ?? []) {
  if (!w.judgeable || !w.crop) continue;
  const control = ['0363100012066028', '0363100012094874'].includes(r.pand);
  if (which === 'unresolved' && w.basis === 'unresolved' && (r.gaps ?? []).includes('painted-or-clad')) jobs.push({pand: r.pand, wall: w.wall, crop: w.crop, heightM: r.heightM ?? 10, label: control ? 'CONTROL' : 'poc'});
  if (which === 'controls' && (control || w.basis === 'courses') && jobs.length < 40) jobs.push({pand: r.pand, wall: w.wall, crop: w.crop, heightM: r.heightM ?? 10, label: control ? 'CONTROL' : w.basis});
}
if (which === 'controls') for (const [pand, crop, h] of [['0363100012066028', 'w04-268', 12], ['0363100012094874', 'w04-90', 15], ['0363100012094874', 'w08-90', 15], ['0363100012094874', 'w04-90L', 15], ['0363100012066028', 'w01-358', 12]] as const) jobs.unshift({pand, wall: crop.slice(0, 3), crop, heightM: h, label: 'CONTROL-dark-brick'});
const out: any[] = [];
for (const j of jobs) {
  const dir = fs.existsSync(path.join(A, j.pand, `${j.crop}.jpg`)) ? path.join(A, j.pand) : path.join(S, j.pand);
  const wj = JSON.parse(fs.readFileSync(path.join(dir, 'walls.json'), 'utf8')); const row = (wj.walls ?? wj.crops ?? []).find((x: any) => x.tag === j.crop) ?? {};
  const jpg = path.join(dir, `${j.crop}.jpg`); if (!fs.existsSync(jpg)) { console.log('missing', jpg); continue; }
  const {data, info} = await sharp(jpg).removeAlpha().raw().toBuffer({resolveWithObject: true});
  const mf = path.join(dir, `${j.crop}.mask.png`); const valid = fs.existsSync(mf) ? new Uint8Array(await sharp(mf).extractChannel(0).raw().toBuffer()) : undefined;
  const widthM = Number(row.wallWidthM ?? row.lengthM); if (!(widthM > 0)) { console.log('no width', j.crop); continue; }
  const ppm = info.width / widthM, topM = info.height / ppm, top = Math.min(Math.max(j.heightM, 4), topM), n = Math.max(1, Math.round(top / 3.2));
  const lines = Array.from({length: n + 1}, (_, i) => +(i * top / n).toFixed(2));
  const image = {width: info.width, height: info.height, rgb: new Uint8Array(data), valid, ppm, topM}, box = {u0: 0, u1: info.width / ppm, v0: 0, v1: top};
  const m = measureFacade({image, box, lines});
  const e = wallFamilyEvidence(image, box, m.cell, [...(m.wallSample ?? [])]);
  const p = proposeWallFamily(m.material, m.wall.hex, e);
  const o = {label: j.label, pand: j.pand, wall: j.wall, crop: j.crop, basis: m.material?.basis, cv: m.material?.texture?.cv?.toFixed(3), wall_hex: m.wall.hex, cells: e.cells, cellCv: e.cellCv, rib: e.rib, proposal: p.proposal?.kind ?? null};
  out.push(o); console.log(JSON.stringify(o));
}
fs.writeFileSync(`staging/painted-clad/calibrate-${which}.json`, JSON.stringify(out, null, 1));
