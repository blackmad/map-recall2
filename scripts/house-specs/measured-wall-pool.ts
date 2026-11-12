// The measured wall pool (lane W1, 2026-11-12): every spec'd pand whose photo reading draws (decorate.ts specRecipe.wallHex,
// the drawn colour a measured pand gets), with its centroid and archetype, for the unmeasured pands around it
// (look/measuredWallPool.ts) and the period palette's per-archetype quantiles (`--period`).
//   node --import tsx scripts/house-specs/measured-wall-pool.ts [--out=staging/measured-wall-pool] [--publish]
//     -> <out>/measured-wall-pool.json (the runtime table), <out>/report.json (counts, per-archetype quantiles)
//     --publish copies the table to src/canalRecall/look/measured-wall-pool.json (then rebuild the bundles and world-v1).
// Sources: the house-spec extract's photo readings (streetlevel-measured panoramas, Gemeente Amsterdam CC BY 4.0) on the
// game chain with the photo look; a held reading (the pale-warm guard) and a post-1945 pand do not enter. A pand an installed
// model hides enters: its reading is of the real front, and its neighbours are what the pool serves.
import '../world/useBrowserMath.js';
import fs from 'node:fs';
import path from 'node:path';
import { EXTRACT, ROOT, gameChain, loadTile, readJson } from '../world/pipeline.ts';
import { asPolygons } from '../../src/canalRecall/threeBuildingFeatures.ts';
import { archetypeFor } from '../../src/canalRecall/bayTextures.ts';
import { rgbToOklab, POOL_ARCHETYPES, type PoolArchetype } from '../../src/canalRecall/look/measuredWallPool.ts';

const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1];
const OUT = path.resolve(arg('out') ?? 'staging/measured-wall-pool');
process.env.HOUSE_SPECS = '1';
const chain = gameChain();
const base = path.join(EXTRACT, 'house-specs', '14'), tiles: string[] = [];
for (const x of fs.readdirSync(base)) for (const y of fs.readdirSync(path.join(base, x))) tiles.push(`${x}/${y.replace('.json.gz', '')}`);
const covers = readJson(path.join(ROOT, 'public/canal-drive/models/covers.json'));
const hidden = new Set<string>([...Object.values<any>(covers.models).flatMap(m => m.p ?? []), ...covers.buildingTypes].map(String));
const points: [number, number, string, number][] = [];
const skipped = { held: 0, hidden: 0, noDecorated: 0, modern: 0 }; // hidden: counted, not skipped
for (const tile of tiles.sort()) {
  for (const r of await loadTile(tile, chain)) {
    const view = r.raw.properties.houseSpec as { wallHex?: string } | undefined, p = r.styled.properties as Record<string, any>;
    if (!view?.wallHex) continue;
    // A pand an installed model hides still has a reading of its real front: it enters the pool (counted).
    if (hidden.has(String(p.id).slice(-16))) skipped.hidden++;
    if (p.specRecipe?.heldBrick) { skipped.held++; continue; }
    const wall = p.specRecipe?.wallHex;
    if (typeof wall !== 'string') { skipped.noDecorated++; continue; }
    const year = p.constructionYear == null || !Number.isFinite(Number(p.constructionYear)) ? null : Number(p.constructionYear);
    const arch = archetypeFor(String(p.id), year, Number(p.height) || 10) as PoolArchetype | 'modern';
    if (arch === 'modern') { skipped.modern++; continue; }
    const ring = asPolygons(r.styled.geometry)[0]?.[0] ?? [];
    if (!ring.length) continue;
    const lng = ring.reduce((s, q) => s + q[0], 0) / ring.length, lat = ring.reduce((s, q) => s + q[1], 0) / ring.length;
    points.push([Math.round(lng * 1e5), Math.round(lat * 1e5), wall.toLowerCase(), POOL_ARCHETYPES.indexOf(arch)]);
  }
}
points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
// Per archetype: the drawn walls' OKLab L quantiles and the hex nearest each decile (the period palette's candidates).
const perArch = Object.fromEntries(POOL_ARCHETYPES.map((a, i) => {
  const ws = points.filter(q => q[3] === i).map(q => ({ hex: q[2], lab: rgbToOklab(q[2]) })).sort((x, y) => x.lab[0] - y.lab[0]);
  const at = (f: number) => ws[Math.min(ws.length - 1, Math.floor(f * ws.length))];
  return [a, { n: ws.length, deciles: ws.length ? [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95].map(f => at(f).hex) : [], L: ws.length ? [0.1, 0.5, 0.9].map(f => +at(f).lab[0].toFixed(3)) : [] }];
}));
fs.mkdirSync(OUT, { recursive: true });
const table = { v: 1, source: 'house-specs streetlevel-measured readings, drawn via decorate.ts specWallColour (lane W1, 2026-11-12)', archetypes: POOL_ARCHETYPES, points };
fs.writeFileSync(path.join(OUT, 'measured-wall-pool.json'), JSON.stringify(table));
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ n: points.length, skipped, perArch }, null, 1));
console.log(JSON.stringify({ n: points.length, skipped, perArch }));
if (process.argv.includes('--publish')) {
  fs.copyFileSync(path.join(OUT, 'measured-wall-pool.json'), path.join(ROOT, 'src/canalRecall/look/measured-wall-pool.json'));
  console.log('published src/canalRecall/look/measured-wall-pool.json');
}
