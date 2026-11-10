// Named rail/street regressions (lane rails-class 2026-11-10; feedback 2026-11-09, desktop Free Ride, Westpoort and
// Sloterdijk, build 6a901ba). Builds the cells around each spot twice (the centreline-crossing level-crossing test
// only = `railOnStreet: false`, and the shipped rule) and counts the metres of track whose bed stands more than
// TEAR_M over (or under) a carriageway surface (probe-rails-class.ts `crossing` class, asphalt / klinker / cycle).
//
//   npx tsx scripts/own-ground/check-rail-street.ts          (exit 1 when a pin fails)
//   npx tsx scripts/own-ground/check-rail-street.ts --print  (numbers only)
//
// Each pin: after <= maxAfterM and the pin is live (before >= minBeforeM) so a change that stops the test from seeing the
// defect fails instead of passing vacuously. Pins marked UNFIXED record today's numbers (a ratchet, not an acceptance):
// lower them when the class b / c / d work lands. The spots' poses are inferred from the HUD street names (the feedback
// records carry no pose).
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell } from '../../src/canalRecall/ownGround/groundCell.ts';
import { readExtract } from './probe-rails.ts';
import { scanCell } from './probe-rails-class.ts';

export interface RailStreetSpot { id: string; item: string; label: string; at: [number, number]; radiusM: number; /** Pin: tear metres after the fix at most / before the fix at least (set from the measured run). */ maxAfterM: number; minBeforeM: number }
export const RAIL_STREET_SPOTS: readonly RailStreetSpot[] = [
  { id: 'sloterdijk-rail-bridge', item: '#10 minor surface issues in rail bridge', label: 'Sloterdijkerweg rail viaduct; the tram climbing over the road dip at 4.8392,52.3877 (UNFIXED: class b, road 1.7 m under a non-bridge tram)', at: [4.8389, 52.389], radiusM: 150, maxAfterM: 46, minBeforeM: 46 },
  { id: 'arlandabrug-tram', item: '#12 road and rail looks very broken', label: 'Arlandabrug: the tram and rail crossing the road', at: [4.8445, 52.3861], radiusM: 150, maxAfterM: 0, minBeforeM: 40 },
  { id: 'kimpoweg-rails', item: '#13 weird uncovering effect on rails', label: 'Kimpoweg by the Brettenpad: tram runs at 4.8392,52.3860-52.3866 (UNFIXED: the beige ramp is class c; the tram bed stands 0.3-0.4 m over the asphalt there)', at: [4.8402, 52.3854], radiusM: 150, maxAfterM: 84, minBeforeM: 84 },
  { id: 'radarweg-underpass', item: '#16 this all looks very broken height / rails', label: 'Radarweg and the rail trench west of Sloterdijk', at: [4.836, 52.3893], radiusM: 150, maxAfterM: 0, minBeforeM: 0 },
  { id: 'radarweg-junction', item: '#18 whats with the lines on the road?', label: 'Radarweg / Basisweg / Kastrupstraat junction (seams: probe-road-seams.ts)', at: [4.8366, 52.3908], radiusM: 150, maxAfterM: 0, minBeforeM: 0 },
];

/** Metres of track in a `crossing` run that tears (> 0.2 m over/under the carriageway), summed over the spot's cells. */
export async function tearMetres(store: GroundStore, spot: RailStreetSpot): Promise<number> {
  const [x, y] = toLocal(...spot.at), keys = new Set<string>();
  for (let dx = -spot.radiusM; dx <= spot.radiusM; dx += 50) for (let dy = -spot.radiusM; dy <= spot.radiusM; dy += 50) keys.add(store.cellAt(x + dx, y + dy));
  let metres = 0;
  for (const k of keys) {
    if (!store.covers(k)) continue;
    const input = await store.cellInput(k, 0);
    if (!input.rails?.length) continue;
    for (const f of scanCell(buildCell(input), input.rails as never, input.cuts ?? [])) {
      if (f.cls !== 'crossing' || Math.abs(f.value) <= 0.2 || Math.hypot(f.at[0] - x, f.at[1] - y) > spot.radiusM) continue;
      metres += 2 * Number(f.detail.split(' ')[0]);
    }
  }
  return metres;
}

async function main(): Promise<void> {
  const print = process.argv.includes('--print');
  const before = new GroundStore(readExtract, { roads: true, railOnStreet: false }), after = new GroundStore(readExtract, { roads: true });
  await Promise.all([before.init(), after.init()]);
  let failed = 0;
  for (const s of RAIL_STREET_SPOTS) {
    const b = await tearMetres(before, s), a = await tearMetres(after, s);
    const ok = print || (a <= s.maxAfterM && b >= s.minBeforeM);
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${s.id}: tear metres before ${b} after ${a} (pin: after <= ${s.maxAfterM}, before >= ${s.minBeforeM})  ${s.item}`);
  }
  if (failed) process.exit(1);
}
if (process.argv[1]?.endsWith('check-rail-street.ts')) main().catch(e => { console.error(e); process.exit(1); });
