/**
 * Author's view of a `kind: large` house: every block-kit wall panel (coplanar, edge-connected 3DBAG LoD2.2 wall
 * surfaces) with its outward bearing, width, height and the surface indices an intent's `walls[].wallSurfaces` lists,
 * plus a labelled plan (artifacts/building-recipes/<id>/walls-plan.png). Needs facts from `facts.ts --large`.
 *
 *   node --import tsx scripts/building-recipes/walls.ts --house=<id> [--min-width=2] [--detail] [--repair] [--footprint=bag]
 *
 * With an intent that sets `shellRepair` / `footprint` (or the flags, before the intent exists) the table is of the
 * repaired shell (shellRepair.ts): repair patches are surfaces from 90000 up.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {largeSurfaceSet, largeShellFacts, bearingOfNormal, panelEaves} from '../../src/canalRecall/buildingRecipe/fitLarge.ts';
import {strictMergeClasses} from '../../src/canalRecall/buildingRecipe/shellRepair.ts';
import type {LargeBuildingIntent} from '../../src/canalRecall/buildingRecipe/intent.ts';
import {buildHost} from '../../src/canalRecall/blockBuilding/panels.ts';
import {MeshBuilder} from '../../src/canalRecall/blockBuilding/mesh.ts';
import type {BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const id = arg('house'), minWidth = Number(arg('min-width', '1.5'));
if (!id) throw Error('Use --house=<id>');
const rawFacts: BuildingFacts = JSON.parse(await fs.readFile(path.join('scripts/building-recipes/houses', id, 'facts.json'), 'utf8'));
const intent: Partial<LargeBuildingIntent> = await fs.readFile(path.join('scripts/building-recipes/houses', id, 'intent.json'), 'utf8').then(JSON.parse, () => ({}));
const footprint = (arg('footprint') || intent.footprint) as LargeBuildingIntent['footprint'];
const repair = process.argv.includes('--repair') || !!intent.shellRepair;
const {facts, shell} = largeShellFacts({shellRepair: repair, footprint} as LargeBuildingIntent, rawFacts);
if (shell) console.log(`shell repair: open ${shell.openBeforeM} -> ${shell.openAfterM} m (caps ${shell.patches.cap}, strips ${shell.patches.strip}, seams ${shell.patches.seam}); IoU ${shell.iouBefore} -> ${shell.iouAfter}`);
const {set} = largeSurfaceSet(facts);
// shellRepair: panels as the fit builds them (only truly coplanar walls merge), ignoring wall groups
const strict = repair ? strictMergeClasses(set.walls) : null;
const {panels} = buildHost(set, new MeshBuilder(), 'roof', 'wall', {deferWalls: true, ...(strict ? {mergeKey: (wi: number) => strict[wi]} : {})});
const compass = (b: number) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(b / 45) % 8];
const ranges = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), out: string[] = []; for (let i = 0; i < s.length;) { let j = i; while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++; out.push(j > i ? `${s[i]}-${s[j]}` : `${s[i]}`); i = j + 1; } return out.join(','); };
const rows = panels.filter(p => p.uMax - p.uMin >= minWidth).sort((a, b) => (b.uMax - b.uMin) * b.vMax - (a.uMax - a.uMin) * a.vMax);
console.log(`${id}: ${set.walls.length} wall surfaces in ${panels.length} panels (${rows.length} at least ${minWidth} m wide); built ${facts.heights.builtYear}, roof max ${facts.heights.roofMaxM.toFixed(1)} m`);
console.log('panel  bearing  width  eaves   top  ground  party  surfaces');
for (const p of rows) {
  const surfaces = p.walls.map(wi => set.walls[wi].surface!);
  console.log(`${String(p.index).padStart(5)}  ${String(Math.round(bearingOfNormal(p.n))).padStart(4)} ${compass(bearingOfNormal(p.n)).padEnd(2)} ${(p.uMax - p.uMin).toFixed(1).padStart(5)}  ${panelEaves(p).toFixed(1).padStart(5)} ${p.vMax.toFixed(1).padStart(5)}  ${p.vMin.toFixed(1).padStart(6)}  ${p.partyH ? p.partyH.toFixed(1).padStart(5) : '    -'}  [${surfaces.sort((a, b) => a - b).join(', ')}]  (${ranges(surfaces)})`);
  // --detail: each surface's span along the panel (m from its left end, viewer outside) and height, to split a
  // panel between wall groups (coplanar surfaces of different groups become separate panels at compile time).
  if (process.argv.includes('--detail') && p.members!.length > 1) for (const m of p.members!) {
    const us = m.poly.outer.map(q => q[0] - p.uMin), vs = m.poly.outer.map(q => q[1]);
    console.log(`         surface ${String(set.walls[m.wall].surface).padStart(3)}: ${Math.min(...us).toFixed(1)}..${Math.max(...us).toFixed(1)} m, height ${Math.min(...vs).toFixed(1)}..${Math.max(...vs).toFixed(1)} m`);
  }
}
// Plan: footprint, each listed panel as a coloured base line with its index, outward tick, north up (local Z is south).
const pts = set.ground.flatMap(g => g.rings.flat());
const xs = pts.map(p => p[0]), zs = pts.map(p => p[2]), pad = 6;
const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad, minZ = Math.min(...zs) - pad, maxZ = Math.max(...zs) + pad;
const scale = Math.min(1400 / (maxX - minX), 1400 / (maxZ - minZ)), W = Math.round((maxX - minX) * scale), H = Math.round((maxZ - minZ) * scale);
const X = (x: number) => ((x - minX) * scale).toFixed(1), Z = (z: number) => ((z - minZ) * scale).toFixed(1);
const svg: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H + 40}"><rect width="100%" height="100%" fill="#fff"/>`];
for (const g of set.ground) for (const r of g.rings) svg.push(`<polygon points="${r.map(p => `${X(p[0])},${Z(p[2])}`).join(' ')}" fill="#eee" stroke="#999" stroke-width="1"/>`);
rows.forEach((p, k) => {
  const a = [p.o[0] + p.r[0] * p.uMin, p.o[2] + p.r[2] * p.uMin], b = [p.o[0] + p.r[0] * p.uMax, p.o[2] + p.r[2] * p.uMax], hue = Math.round(bearingOfNormal(p.n));
  const m = [(a[0] + b[0]) / 2 + p.n[0] * 1.6, (a[1] + b[1]) / 2 + p.n[2] * 1.6];
  svg.push(`<line x1="${X(a[0])}" y1="${Z(a[1])}" x2="${X(b[0])}" y2="${Z(b[1])}" stroke="hsl(${hue},70%,45%)" stroke-width="${k < 40 ? 4 : 2}"/>`);
  svg.push(`<text x="${X(m[0])}" y="${Z(m[1])}" font-family="Helvetica" font-size="${Math.max(11, Math.min(18, scale * 1.2)).toFixed(0)}" text-anchor="middle" fill="hsl(${hue},70%,30%)">${p.index}</text>`);
});
svg.push(`<text x="10" y="${H + 28}" font-family="Helvetica" font-size="18">${id}: panel index at each wall (outward side), north up; colour = facing bearing</text></svg>`);
const out = path.join('artifacts/building-recipes', id);
await fs.mkdir(out, {recursive: true});
await sharp(Buffer.from(svg.join(''))).png().toFile(path.join(out, 'walls-plan.png'));
console.log(`plan: ${path.join(out, 'walls-plan.png')}`);
