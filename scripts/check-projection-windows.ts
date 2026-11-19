/**
 * Projecting masses never cut a window (feedback d99e51, 18a9d3, e058c8, 1a223c; verify report 2026-11-19 §3).
 *
 *   node --import tsx scripts/check-projection-windows.ts            # the named tiles; exit 1 on a cut window
 *   node --import tsx scripts/check-projection-windows.ts --tiles=8412/5384,8413/5384 [--look=photo] [--verbose]
 *
 * Builds the extras chunk of every generic building on the tiles (the runtime's own chain: scripts/world/pipeline.ts
 * loadTile, then buildFeatureChunk) and listens to projectionWindowFit.ts's probe for every projecting mass the generic
 * facade dice place (the `oriel` ornament, the `bay-window` extra). Gated:
 *   cut     a drawn mass covering part of a window on the storeys it stands in front of (must be 0)
 *   pin     Postjesweg 0363100012104321 (d99e51): its oriel was placed over half of two windows; it must now be moved,
 *           narrowed or dropped, never kept where it cuts
 * Reported: how many masses kept their place (byte-identical), moved, narrowed or were dropped.
 */
import assert from 'node:assert/strict';
import { gameChain, loadTile } from './world/pipeline.ts';
import { buildFeatureChunk, type BuildingLook } from '../src/canalRecall/threeBuildingFeatures.ts';
import { partyWallProbe } from '../src/canalRecall/partyWallStoreys.ts';
import { cutWindows, projectionProbe, type ProjectionProbeRow } from '../src/canalRecall/projectionWindowFit.ts';

const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
// Postjesweg (d99e51), Jacob van Lennepkade (e058c8, 1a223c), Slotervaart / Stadionbuurt (18a9d3), Bellamyplein (47d096).
const TILES = (arg('tiles') ?? '8412/5384,8413/5384,8411/5384').split(',');
const look = (arg('look') ?? 'storybook') as BuildingLook;
const PIN = 'NL.IMBAG.Pand.0363100012104321';

const rows: ProjectionProbeRow[] = [];
projectionProbe.sink = r => rows.push(r);
const chain = gameChain();
const strips = new Map<string, number>();
for (const tile of TILES) {
  const features = (await loadTile(tile, chain)).map(r => r.styled);
  // One building per chunk, as the near ring builds them: the dice draw per building and wall.
  for (const f of features) buildFeatureChunk([f], look, 'extras');
  // Walls with their neighbours (the party-wall cuts need both sides): window rows cut part-way by a lower neighbour.
  const before = partyWallProbe.strips;
  buildFeatureChunk(features, look, 'walls');
  strips.set(tile, partyWallProbe.strips - before);
  console.log(`  ${tile}: ${features.length} buildings, ${partyWallProbe.strips - before} part window rows over a lower neighbour drawn as plain wall`);
}
projectionProbe.sink = undefined;

const cut = rows.filter(r => r.fit && cutWindows(r.fit.x - r.halfW * r.fit.scale, r.fit.x + r.halfW * r.fit.scale, r.windows).length);
const was = rows.filter(r => cutWindows(r.wantedX - r.halfW, r.wantedX + r.halfW, r.windows).length);
const how = { kept: 0, moved: 0, narrowed: 0, dropped: 0 };
for (const r of rows) how[r.fit ? r.fit.how : 'dropped']++;
console.log(`projection-windows (${look}, ${TILES.join(' ')}): ${rows.length} masses; ${was.length} would cut a window at their dice place; kept ${how.kept}, moved ${how.moved}, narrowed ${how.narrowed}, dropped ${how.dropped}; cutting now ${cut.length}`);
if (process.argv.includes('--verbose')) for (const r of was) console.log(`  ${r.id} ${r.kind} at ${r.wantedX.toFixed(2)} of ${r.len.toFixed(2)} -> ${r.fit ? `${r.fit.how} ${r.fit.x.toFixed(2)} x${r.fit.scale.toFixed(2)}` : 'dropped'}`);
assert.equal(cut.length, 0, `masses still cutting windows: ${cut.slice(0, 5).map(r => `${r.id} ${r.kind}`).join(', ')}`);
const pin = rows.filter(r => r.id === PIN && r.kind === 'oriel' && cutWindows(r.wantedX - r.halfW, r.wantedX + r.halfW, r.windows).length);
assert.ok(pin.length, `${PIN}: no dice oriel cuts its windows at its dice place any more (the d99e51 pin needs a new witness)`);
assert.ok(pin.every(r => !r.fit || r.fit.how !== 'kept'), `${PIN}: oriel kept over a cut window`);
// 18a9d3 (Slotervaart rows of mixed heights): the tile's party walls over lower neighbours lose their part window rows.
if (strips.has('8411/5384')) assert.ok(strips.get('8411/5384')! > 0, '8411/5384 (18a9d3): no part window row over a lower neighbour was turned plain');
console.log(`pin ${PIN} (d99e51): oriel ${pin.map(r => r.fit ? `${r.fit.how} to ${r.fit.x.toFixed(2)} m x${r.fit.scale.toFixed(2)}` : 'dropped').join(', ')}`);
