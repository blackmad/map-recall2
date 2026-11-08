/**
 * Lane R5-E (#265): what the flat-roof surface (roofs/flatRoofSurface.ts: parapet lip, roof boxes, measured furniture
 * in the walls chunk) costs per chunk, `?flatRoofSurface` on against off, on the game's styled features (world
 * pipeline gameChain), per z14 tile: the detail (walls) chunk, the detail extras chunk (furniture moves out of it),
 * the coarse chunk as the baked shell builds it (shellRoofs) and the touch shell. Budget (brief): ≤ +8 % triangles a
 * coarse chunk, ≤ +4 % a detail chunk.
 *   node --import tsx scripts/roofs/flat-roof-cost.ts [--tiles=8415/5384,...] [--look=photo]
 * Default tiles: the U1 pose's ring (Nieuwmarkt), the S1/S3 tile and the world A/B spots' tiles.
 */
import '../world/useBrowserMath.js';
import { gameChain, loadTile } from '../world/pipeline.js';
import { AB_SPOTS, SWAP_SPOTS } from '../world/abSpots.js';
import { buildFeatureChunk, type BuildingLook } from '../../src/canalRecall/threeBuildingFeatures.js';

const args = process.argv.slice(2);
const value = (name: string) => args.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const tileOf = (lng: number, lat: number, z = 14) => {
  const n = 2 ** z, rad = lat * Math.PI / 180;
  return `${Math.floor(((lng + 180) / 360) * n)}/${Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n)}`;
};
const ring = (t: string) => { const [x, y] = t.split('/').map(Number); const out: string[] = []; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) out.push(`${x + dx}/${y + dy}`); return out; };
const tiles = value('tiles')?.split(',') ?? [...new Set([...ring(tileOf(4.9010, 52.3708)), tileOf(SWAP_SPOTS[0].camera[0], SWAP_SPOTS[0].camera[1]), ...AB_SPOTS.map(s => tileOf(s.at[0], s.at[1]))])];
const look = (value('look') ?? 'photo') as BuildingLook;
const g = globalThis as { location?: { search: string } };
const withFlag = <T>(search: string, fn: () => T): T => { g.location = { search }; try { return fn(); } finally { delete g.location; } };

async function main() {
  const chain = gameChain();
  const tris = (c: { indices: ArrayLike<number> }) => c.indices.length / 3;
  const pct = (a: number, b: number) => `${b >= a ? '+' : ''}${(100 * (b - a) / Math.max(1, a)).toFixed(2)} %`;
  const modes = ['walls', 'extras', 'coarse', 'shell'] as const;
  const total = Object.fromEntries(modes.map(m => [m, [0, 0]])) as Record<typeof modes[number], [number, number]>;
  const admitted: Record<string, number> = {};
  const worst = Object.fromEntries(modes.map(m => [m, -Infinity])) as Record<typeof modes[number], number>;
  console.log('| tile | buildings | detail walls off → on | Δ | detail extras off → on | coarse (baked) off → on | Δ | touch shell Δ |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const tile of tiles) {
    const features = (await loadTile(tile, chain)).map(r => r.styled) as any[];
    if (!features.length) continue;
    const row: Record<string, [number, number]> = {};
    for (const mode of modes) {
      const build = () => buildFeatureChunk(features, look, mode, undefined, [], [], [], new Map(), mode === 'coarse' || mode === 'shell' ? { shellRoofs: true } : {});
      const off = tris(withFlag('?flatRoofTone=0&flatRoofSurface=0', build)), on = tris(withFlag('', build));
      row[mode] = [off, on]; total[mode][0] += off; total[mode][1] += on;
      const kinds = withFlag('', build).kinds ?? {};
      for (const [k, n] of Object.entries(kinds)) if (k.startsWith('flat-')) admitted[`${mode} ${k}`] = (admitted[`${mode} ${k}`] ?? 0) + n;
      worst[mode] = Math.max(worst[mode], (on - off) / Math.max(1, off));
    }
    console.log(`| ${tile} | ${features.length} | ${row.walls[0]} → ${row.walls[1]} | ${pct(...row.walls)} | ${row.extras[0]} → ${row.extras[1]} | ${row.coarse[0]} → ${row.coarse[1]} | ${pct(...row.coarse)} | ${pct(...row.shell)} |`);
  }
  console.log(`| all | | ${total.walls[0]} → ${total.walls[1]} | ${pct(...total.walls)} | ${total.extras[0]} → ${total.extras[1]} | ${total.coarse[0]} → ${total.coarse[1]} | ${pct(...total.coarse)} | ${pct(...total.shell)} |`);
  console.log('buildings admitted / dropped by the chunk budget:', JSON.stringify(admitted));
  console.log(`worst tile: detail walls ${(100 * worst.walls).toFixed(2)} %, detail walls+extras see table, coarse ${(100 * worst.coarse).toFixed(2)} %, shell ${(100 * worst.shell).toFixed(2)} %`);
}
main().catch(e => { console.error(e); process.exit(1); });
