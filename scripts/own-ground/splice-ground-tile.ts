// Splice a local ground-height rebuild into the published tiles, only around named staleRelief.ts rings.
//
//   npx tsx scripts/own-ground/build-ground-height.ts --tiles 121_489 --predictor planar --out artifacts/own-ground/staging/<x>
//   npx tsx scripts/own-ground/splice-ground-tile.ts --staged artifacts/own-ground/staging/<x> --tiles 121_489 \
//       --rings ndsm-oost-buiksloterham-kop-works [--grow 20] [--blend 12] [--out artifacts/own-ground/staging/<x>-spliced]
//   # review, then copy <out>/tiles/<tile>.bin into public/data/extracts/amsterdam/ground-height-v1/tiles/
//
// A fresh `--tiles` rebuild also picks up every unrelated drift since the tile was published (newer water polygons,
// re-served AHN squares): on 121_489 (2026-10-28) a third of the cells outside the NDSM ring moved 5-50 cm, a few by
// up to 2.9 m. A ring fix should move only the ground it is about, so the spliced tile takes the staged heights within
// `grow` metres of the rings, the published heights beyond `grow + blend`, and a linear blend between (no seam).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { decodeTile, encodeTile, type GroundIndex } from '../../src/canalRecall/ownGround/heightField.ts';
import { STALE_RELIEF } from '../../src/canalRecall/ownGround/staleRelief.ts';

const args = process.argv.slice(2);
const opt = (k: string, d = '') => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const PUBLISHED = opt('published', 'public/data/extracts/amsterdam/ground-height-v1');
const STAGED = opt('staged');
const OUT = opt('out', `${STAGED}-spliced`);
const GROW = Number(opt('grow', '20')), BLEND = Number(opt('blend', '12'));
if (!STAGED || !opt('tiles') || !opt('rings')) throw new Error('--staged, --tiles and --rings are required');
const rings = opt('rings').split(',').map(id => {
  const r = STALE_RELIEF.find(s => s.id === id);
  if (!r) throw new Error(`no staleRelief ring ${id}`);
  return r.rd;
});
const index = JSON.parse(readFileSync(join(PUBLISHED, 'index.json'), 'utf8')) as GroundIndex;
const n = index.samples, step = index.stepM, size = index.tileSizeM;

function inside(x: number, y: number, ring: readonly [number, number][]): boolean {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) yes = !yes;
  }
  return yes;
}
function distance(x: number, y: number, ring: readonly [number, number][]): number {
  if (inside(x, y, ring)) return 0;
  let d = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = ring[i], [bx, by] = ring[(i + 1) % ring.length], dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    d = Math.min(d, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return d;
}

mkdirSync(join(OUT, 'tiles'), { recursive: true });
for (const key of opt('tiles').split(',')) {
  const [tx, ty] = key.split('_').map(Number);
  const entry = index.tiles.find(t => t[0] === tx && t[1] === ty);
  if (!entry || (entry[3] ?? step) !== step) throw new Error(`${key}: not a published ${step} m tile`);
  const read = (dir: string) => decodeTile(new Uint8Array(gunzipSync(readFileSync(join(dir, 'tiles', `${key}.bin`)))), n, index.predictor ?? 'dx');
  const pub = read(PUBLISHED), stg = read(STAGED), out = new Float32Array(n * n);
  let staged = 0, blended = 0, maxMove = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i, x = tx * size + i * step, y = ty * size + j * step;
    const d = Math.min(...rings.map(r => distance(x, y, r)));
    const w = d <= GROW ? 1 : d >= GROW + BLEND ? 0 : 1 - (d - GROW) / BLEND;
    const a = pub[k], b = stg[k];
    out[k] = w === 0 || b !== b ? a : a !== a ? b : a * (1 - w) + b * w;
    if (w === 1) staged++; else if (w > 0) blended++;
    if (out[k] === out[k] && a === a) maxMove = Math.max(maxMove, Math.abs(out[k] - a));
  }
  writeFileSync(join(OUT, 'tiles', `${key}.bin`), gzipSync(encodeTile(out, n, index.predictor ?? 'dx'), { level: 9 }));
  console.log(JSON.stringify({ tile: key, stagedCells: staged, blendedCells: blended, untouched: n * n - staged - blended, maxMoveM: +maxMove.toFixed(2) }));
}
