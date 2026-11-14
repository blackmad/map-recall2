/**
 * How many installed GLB walls the wall rule (look/wallRule.ts, `?wallRule=1`) would redraw: every brick/accent slot
 * material whose tint is not tagged measured and is not a named guess, over the GLBs the game loads (lod files left out):
 * public/canal-drive/models/** (landmarks, kiosks, ordinary buildings and street chunks), building-types/ (repeated
 * types) and recipe-tiles/ (baked tiles: the rule reaches them at bake time through writeTile.ts gltfSlot). Counts only.
 *
 *   node --import tsx scripts/look/wall-rule-census.ts [--roots <dir,dir>] [--json <out>]
 */
import fs from 'node:fs';
import path from 'node:path';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {cityLookTint} from '../../src/canalRecall/look/cityLook.ts';
import {hexToOklab} from '../../src/canalRecall/houseSpec/wallColour.ts';
import {glbWallProvenance} from '../../src/canalRecall/look/wallRule.ts';

const argv = process.argv.slice(2), arg = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const PUB = path.resolve(import.meta.dirname, '../../public/canal-drive');
const roots = arg('roots')?.split(',') ?? ['models', 'building-types', 'recipe-tiles'].map(r => path.join(PUB, r));
const walk = (d: string): string[] => fs.existsSync(d) ? fs.readdirSync(d, {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.glb') && !/\.lod\d\.glb$/.test(e.name) ? [path.join(d, e.name)] : []) : [];
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder});
interface Tally {glbs: number; failed: number; wallMats: number; tagged: number; guessed: number; changed: number; models: Set<string>; darker: number; dLs: number[]}
const groups = new Map<string, Tally>();
for (const root of roots) for (const file of walk(root).sort()) {
  const rel = path.relative(PUB, file), group = rel.split(path.sep).slice(0, rel.startsWith('models' + path.sep) && rel.split(path.sep).length > 2 ? 2 : 1).join('/');
  const t = groups.get(group) ?? {glbs: 0, failed: 0, wallMats: 0, tagged: 0, guessed: 0, changed: 0, models: new Set(), darker: 0, dLs: []};
  groups.set(group, t); t.glbs++;
  let doc;
  try { doc = await io.read(file); } catch { t.failed++; continue; }
  for (const m of doc.getRoot().listMaterials()) {
    const ex = (m.getExtras() ?? {}) as {materialSlot?: string; tint?: string; tintSource?: string};
    if ((ex.materialSlot !== 'brick' && ex.materialSlot !== 'accent') || typeof ex.tint !== 'string') continue;
    t.wallMats++;
    if (ex.tintSource === 'measured') { t.tagged++; continue; }
    if (glbWallProvenance(ex.tint) === 'guessed') { t.guessed++; continue; }
    t.changed++; t.models.add(rel);
    // today's drawn tint against the tint itself: the lift the rule takes back
    const dL = hexToOklab(cityLookTint(ex.materialSlot as 'brick', ex.tint))[0] - hexToOklab(ex.tint)[0];
    t.dLs.push(dL); if (dL > 0.03) t.darker++;
  }
}
const all: Tally = {glbs: 0, failed: 0, wallMats: 0, tagged: 0, guessed: 0, changed: 0, models: new Set(), darker: 0, dLs: []};
for (const [g, t] of [...groups].sort()) {
  console.log(`${g.padEnd(32)} ${String(t.glbs).padStart(5)} GLBs  ${String(t.wallMats).padStart(5)} wall materials: ${t.tagged} measured, ${t.guessed} guesses kept, ${t.changed} redrawn in ${t.models.size} GLBs${t.failed ? ` (${t.failed} unreadable)` : ''}`);
  for (const k of ['glbs', 'failed', 'wallMats', 'tagged', 'guessed', 'changed', 'darker'] as const) all[k] += t[k];
  t.models.forEach(m => all.models.add(m)); all.dLs.push(...t.dLs);
}
all.dLs.sort((a, b) => a - b);
const q = (p: number) => all.dLs.length ? all.dLs[Math.min(all.dLs.length - 1, Math.floor(p * all.dLs.length))].toFixed(3) : '-';
console.log(`total: ${all.glbs} GLBs, ${all.wallMats} wall materials; ${all.changed} redrawn under the rule in ${all.models.size} GLBs (${all.tagged} already measured, ${all.guessed} named guesses kept)`);
console.log(`today's lift on the redrawn walls (OKLab L, cityLookTint - tint): median ${q(0.5)}, p10 ${q(0.1)}, p90 ${q(0.9)}; ${all.darker} of them draw more than 0.03 L darker under the rule`);
if (arg('json')) fs.writeFileSync(arg('json')!, JSON.stringify({groups: Object.fromEntries([...groups].map(([g, t]) => [g, {...t, models: [...t.models], dLs: undefined}]))}, null, 1) + '\n');
