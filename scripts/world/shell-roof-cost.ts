/**
 * What shell roofs (threeBuildingFeatures.ts shellRoofPlan, lane R1-A #223) cost per coarse chunk: triangles,
 * vertices and bytes of each z14 tile's coarse (desktop) and touch-shell chunk, flat lids against low-poly planned
 * roofs, on the game's styled features (pipeline.ts gameChain). Budget: ≤ +25 % triangles per coarse chunk.
 *   node --import tsx scripts/world/shell-roof-cost.ts [--tiles=8415/5384,8414/5384] [--look=photo]
 * Default tiles: the S1/S3 spots' tile and its ring, and the world A/B spots' tiles.
 */
import './useBrowserMath.js';
import { gameChain, loadTile } from './pipeline.js';
import { AB_SPOTS, SWAP_SPOTS } from './abSpots.js';
import { buildFeatureChunk, type BuildingLook } from '../../src/canalRecall/threeBuildingFeatures.js';

const args = process.argv.slice(2);
const value = (name: string) => args.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const tileOf = (lng: number, lat: number, z = 14) => {
  const n = 2 ** z, rad = lat * Math.PI / 180;
  return `${Math.floor(((lng + 180) / 360) * n)}/${Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n)}`;
};
const ring = (t: string) => { const [x, y] = t.split('/').map(Number); const out: string[] = []; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) out.push(`${x + dx}/${y + dy}`); return out; };
const tiles = value('tiles')?.split(',') ?? [...new Set([...ring(tileOf(SWAP_SPOTS[0].camera[0], SWAP_SPOTS[0].camera[1])), ...AB_SPOTS.map(s => tileOf(s.at[0], s.at[1]))])];
const look = (value('look') ?? 'photo') as BuildingLook;

async function main() {
  const chain = gameChain();
  const rows: string[] = [];
  const total = { coarse: [0, 0], shell: [0, 0], roofed: 0, buildings: 0 };
  console.log(`| tile | buildings | roofed | coarse tris flat → roofs | Δ | touch-shell tris flat → roofs | Δ | coarse MB flat → roofs |`);
  console.log(`|---|---|---|---|---|---|---|---|`);
  for (const tile of tiles) {
    const features = (await loadTile(tile, chain)).map(r => r.styled);
    if (!features.length) continue;
    const tris = (c: { indices: Uint32Array }) => c.indices.length / 3;
    const mb = (c: { positions: Float32Array; uvs: Float32Array; layers: Uint8Array; tints: Uint8Array; accents: Uint8Array; indices: Uint32Array; vertexCount: number }) => (c.positions.byteLength + c.uvs.byteLength + c.layers.byteLength + c.tints.byteLength + c.accents.byteLength + c.indices.byteLength + c.vertexCount) / 1e6;
    const flat = buildFeatureChunk(features as any, look, 'coarse'), roofs = buildFeatureChunk(features as any, look, 'coarse', undefined, [], [], [], new Map(), { shellRoofs: true });
    const shellFlat = buildFeatureChunk(features as any, look, 'shell'), shellRoofs = buildFeatureChunk(features as any, look, 'shell', undefined, [], [], [], new Map(), { shellRoofs: true });
    const roofed = features.filter(f => f.properties.roofPlanned && !f.properties.kitRoof && !f.properties.gardenShed).length;
    total.coarse[0] += tris(flat); total.coarse[1] += tris(roofs); total.shell[0] += tris(shellFlat); total.shell[1] += tris(shellRoofs); total.roofed += roofed; total.buildings += features.length;
    const pct = (a: number, b: number) => `${b >= a ? '+' : ''}${(100 * (b - a) / Math.max(1, a)).toFixed(1)} %`;
    console.log(`| ${tile} | ${features.length} | ${roofed} | ${tris(flat)} → ${tris(roofs)} | ${pct(tris(flat), tris(roofs))} | ${tris(shellFlat)} → ${tris(shellRoofs)} | ${pct(tris(shellFlat), tris(shellRoofs))} | ${mb(flat).toFixed(2)} → ${mb(roofs).toFixed(2)} |`);
    rows.push(tile);
  }
  const pct = (a: number, b: number) => `${b >= a ? '+' : ''}${(100 * (b - a) / Math.max(1, a)).toFixed(1)} %`;
  console.log(`| all ${rows.length} | ${total.buildings} | ${total.roofed} | ${total.coarse[0]} → ${total.coarse[1]} | ${pct(total.coarse[0], total.coarse[1])} | ${total.shell[0]} → ${total.shell[1]} | ${pct(total.shell[0], total.shell[1])} | |`);
}
main().catch(e => { console.error(e); process.exit(1); });
