// Named rail/street regressions (lane rails-class 2026-11-10; feedback 2026-11-09, desktop Free Ride, Westpoort and
// Sloterdijk, build 6a901ba). Builds the cells around each spot twice (the centreline-crossing level-crossing test
// only = `railOnStreet: false`, and the shipped rule) and counts the metres of track whose bed stands more than
// TEAR_M over (or under) a carriageway surface (probe-rails-class.ts `crossing` class, asphalt / klinker / cycle).
//
//   npx tsx scripts/own-ground/check-rail-street.ts          (exit 1 when a pin fails)
//   npx tsx scripts/own-ground/check-rail-street.ts --print  (numbers only)
//   npx tsx scripts/own-ground/check-rail-street.ts --only=id,id
//
// Each pin: after <= maxAfterM and the pin is live (before >= minBeforeM) so a change that stops the test from seeing the
// defect fails instead of passing vacuously. Pins marked UNFIXED record today's numbers (a ratchet, not an acceptance):
// lower them when the class b / c / d work lands. `spans` pins the deck spans over streets (railSpans.ts, lane
// rails-classb 2026-11-10): exactly that many triggers within the radius in the shipped build (the before store has
// neither the on-street test nor the spans). The spots' poses are inferred from the HUD street names (the feedback
// records carry no pose).
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell } from '../../src/canalRecall/ownGround/groundCell.ts';
import { readExtract } from './probe-rails.ts';
import { scanCell } from './probe-rails-class.ts';

export interface RailStreetSpot { id: string; item: string; label: string; at: [number, number]; radiusM: number; /** Pin: tear metres after the fix at most / before the fix at least (set from the measured run). */ maxAfterM: number; minBeforeM: number; /** Deck spans over streets (railSpans.ts, lane rails-classb) whose street crossing lies within radiusM, in the shipped build: exactly this many. */ spans?: number }
export const RAIL_STREET_SPOTS: readonly RailStreetSpot[] = [
  // UNFIXED, and not class b (lane rails-classb 2026-11-10): the tram terminus on the Carrascoplein busway it is embedded
  // in, passing under the Teleportboulevard cycle bridge; the station podium east of it stands at +2.2, and the bed's
  // floor rule (railTracks.ts: never under the land across its top) lifts the bed to +1.2..1.5 over a busway at +0.2 at
  // 4.83919,52.3876. No street passes under the bed, so no deck span applies; zero spans pinned.
  { id: 'sloterdijk-rail-bridge', item: '#10 minor surface issues in rail bridge', label: 'Sloterdijk station tram terminus on the Carrascoplein, under the Teleportboulevard bridge: the bed lifted 1.0-1.5 m over its own busway by the podium beside it at 4.8392,52.3876 (UNFIXED)', at: [4.8389, 52.389], radiusM: 150, maxAfterM: 46, minBeforeM: 46, spans: 0 },
  // Two deck spans (lane rails-classb): both trams of the Arlandabrug's west approach over the footway at 4.84508,52.3861
  // (the footway 1.25-1.59 m under the floor on both sides).
  { id: 'arlandabrug-tram', item: '#12 road and rail looks very broken', label: 'Arlandabrug: the tram and rail crossing the road; the west approach decked over the footway under it', at: [4.8445, 52.3861], radiusM: 150, maxAfterM: 0, minBeforeM: 40, spans: 2 },
  // UNFIXED, and not class b (lane rails-classb): a tram at grade whose bed stands its normal 0.3-0.4 m over the klinker
  // and cycle strips beside it (no street under it; the streets crossing it lie within 0.1 m of the floor).
  { id: 'kimpoweg-rails', item: '#13 weird uncovering effect on rails', label: 'Kimpoweg by the Brettenpad: tram runs at 4.8392,52.3860-52.3866 (UNFIXED: the beige ramp is class c; the tram bed stands 0.3-0.4 m over the paving beside it, class a)', at: [4.8402, 52.3854], radiusM: 150, maxAfterM: 84, minBeforeM: 84, spans: 0 },
  { id: 'radarweg-underpass', item: '#16 this all looks very broken height / rails', label: 'Radarweg and the rail trench west of Sloterdijk', at: [4.836, 52.3893], radiusM: 150, maxAfterM: 0, minBeforeM: 0 },
  // Lane rails-classb: the Piet Kranenbergpad passing under the Schiphol line at the Ringweg-Zuid, 1.5 m under the floor
  // on both sides (an untagged underpass): one deck span; the bed no longer walls the path in.
  { id: 'zuid-path-underpass', item: 'rails class b (lane rails-classb)', label: 'Piet Kranenbergpad under the Schiphol line by the Ringweg-Zuid at 4.85323,52.33879', at: [4.85323, 52.33879], radiusM: 40, maxAfterM: 0, minBeforeM: 0, spans: 1 },
  // Lane rails-classb, the false positive the first rule made: the tram on the Frans de Wollantstraat (embedded_rails)
  // by the Piet Heinkade, whose bed the profile lifts 1.9 m over its own street at 4.93214,52.37178. A deck over its own
  // street would be wrong: zero spans. Its tear (222 m before the on-street rule, 242 m after) is that lift: a ratchet
  // (UNFIXED, the profile's, see docs/reports/rails-classb-20261110.md).
  { id: 'frans-de-wollant-tram', item: 'rails class b (lane rails-classb)', label: 'Frans de Wollantstraat tram (embedded in the street) by the Piet Heinkade: no deck span over its own street', at: [4.93214, 52.37178], radiusM: 40, maxAfterM: 242, minBeforeM: 222, spans: 0 },
  { id: 'radarweg-junction', item: '#18 whats with the lines on the road?', label: 'Radarweg / Basisweg / Kastrupstraat junction (seams: probe-road-seams.ts)', at: [4.8366, 52.3908], radiusM: 150, maxAfterM: 0, minBeforeM: 0 },
];

/** Metres of track in a `crossing` run that tears (> 0.2 m over/under the carriageway), summed over the spot's cells. */
export async function tearMetres(store: GroundStore, spot: RailStreetSpot): Promise<number> { return (await measureSpot(store, spot)).metres; }

/** Tear metres and the deck spans (railSpans.ts) whose street crossing lies within the spot's radius. */
export async function measureSpot(store: GroundStore, spot: RailStreetSpot): Promise<{ metres: number; spans: number }> {
  const [x, y] = toLocal(...spot.at), keys = new Set<string>();
  for (let dx = -spot.radiusM; dx <= spot.radiusM; dx += 50) for (let dy = -spot.radiusM; dy <= spot.radiusM; dy += 50) keys.add(store.cellAt(x + dx, y + dy));
  let metres = 0, spans = 0;
  for (const k of keys) {
    if (!store.covers(k)) continue;
    const input = await store.cellInput(k, 0);
    if (!input.rails?.length) continue;
    const built = buildCell(input);
    spans += (built.stats.rails?.spanList ?? []).filter(sp => Math.hypot(sp.at[0] - x, sp.at[1] - y) <= spot.radiusM).length;
    for (const f of scanCell(built, input.rails as never, input.cuts ?? [])) {
      if (f.cls !== 'crossing' || Math.abs(f.value) <= 0.2 || Math.hypot(f.at[0] - x, f.at[1] - y) > spot.radiusM) continue;
      metres += 2 * Number(f.detail.split(' ')[0]);
    }
  }
  return { metres, spans };
}

async function main(): Promise<void> {
  const print = process.argv.includes('--print');
  const before = new GroundStore(readExtract, { roads: true, railOnStreet: false, railSpans: false }), after = new GroundStore(readExtract, { roads: true });
  await Promise.all([before.init(), after.init()]);
  const only = process.argv.find(a => a.startsWith('--only='))?.slice(7).split(',');
  let failed = 0;
  for (const s of RAIL_STREET_SPOTS) {
    if (only && !only.includes(s.id)) continue;
    const b = await measureSpot(before, s), a = await measureSpot(after, s);
    const ok = print || (a.metres <= s.maxAfterM && b.metres >= s.minBeforeM && (s.spans === undefined || a.spans === s.spans));
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${s.id}: tear metres before ${b.metres} after ${a.metres} (pin: after <= ${s.maxAfterM}, before >= ${s.minBeforeM}); deck spans ${a.spans}${s.spans === undefined ? '' : ` (pin: ${s.spans})`}  ${s.item}`);
  }
  if (failed) process.exit(1);
}
if (process.argv[1]?.endsWith('check-rail-street.ts')) main().catch(e => { console.error(e); process.exit(1); });
