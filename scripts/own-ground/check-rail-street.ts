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
import { buildCell, layersAt, type BuiltCell, type CellInput } from '../../src/canalRecall/ownGround/groundCell.ts';
import { readExtract } from './probe-rails.ts';
import { scanCell } from './probe-rails-class.ts';

export interface RailStreetSpot { id: string; item: string; label: string; at: [number, number]; radiusM: number; /** Pin: tear metres after the fix at most / before the fix at least (set from the measured run). */ maxAfterM: number; minBeforeM: number; /** Level crossing at grade (lane rails-uncover): the bed's top at most this far over the land under its centreline, track samples within BED_RADIUS_M of `at`, shipped build. */ bedOverM?: number; /** A road deck over the track (lane rails-uncover): at least this many 1 m track samples within radiusM with a deck top 3 m or more over the ballast, shipped build. */ deckOverTrack?: number; /** Deck spans over streets (railSpans.ts, lane rails-classb) whose street crossing lies within radiusM, in the shipped build: exactly this many. */ spans?: number; /** Points (lng, lat) where the rail bed must be the top surface in the shipped build (lane rails-uncover: a hole between two beds showed what lies under them). */ ballastAt?: [number, number][] }
export const RAIL_STREET_SPOTS: readonly RailStreetSpot[] = [
  // UNFIXED, and not class b (lane rails-classb 2026-11-10): the tram terminus on the Carrascoplein busway it is embedded
  // in, passing under the Teleportboulevard cycle bridge; the station podium east of it stands at +2.2, and the bed's
  // floor rule (railTracks.ts: never under the land across its top) lifts the bed to +1.2..1.5 over a busway at +0.2 at
  // 4.83919,52.3876. No street passes under the bed, so no deck span applies; zero spans pinned.
  { id: 'sloterdijk-rail-bridge', item: '#10 minor surface issues in rail bridge', label: 'Sloterdijk station tram terminus on the Carrascoplein, under the Teleportboulevard bridge: the bed lifted 1.0-1.5 m over its own busway by the podium beside it at 4.8392,52.3876 (UNFIXED)', at: [4.8389, 52.389], radiusM: 150, maxAfterM: 46, minBeforeM: 46, spans: 0 },
  // Lane rails-classb decked both trams of the Arlandabrug's west approach over the footway at 4.84508,52.3861 (the
  // footway 1.25-1.59 m under the floor); lane rails-uncover: no headroom for a rider (SPAN_HEADROOM_M 3.6 m), zero spans,
  // the bed ramps down to the footway's level crossing (docs/reports/rails-feedback-20261110.md has the ortho verdict).
  { id: 'arlandabrug-tram', item: '#12 road and rail looks very broken', label: 'Arlandabrug: the tram and rail crossing the road; the west approach decked over the footway under it', at: [4.8445, 52.3861], radiusM: 150, maxAfterM: 0, minBeforeM: 40, spans: 0 },
  // UNFIXED, and not class b (lane rails-classb): a tram at grade whose bed stands its normal 0.3-0.4 m over the klinker
  // and cycle strips beside it (no street under it; the streets crossing it lie within 0.1 m of the floor).
  { id: 'kimpoweg-rails', item: '#13 weird uncovering effect on rails', label: 'Kimpoweg by the Brettenpad: tram runs at 4.8392,52.3860-52.3866 (UNFIXED: the beige ramp is class c; the tram bed stands 0.3-0.4 m over the paving beside it, class a)', at: [4.8402, 52.3854], radiusM: 150, maxAfterM: 84, minBeforeM: 84, spans: 0 },
  { id: 'radarweg-underpass', item: '#16 this all looks very broken height / rails', label: 'Radarweg and the rail trench west of Sloterdijk', at: [4.836, 52.3893], radiusM: 150, maxAfterM: 0, minBeforeM: 0 },
  // Lane rails-classb: the Piet Kranenbergpad passing under the Schiphol line at the Ringweg-Zuid, 1.5 m under the floor
  // on both sides (an untagged underpass): one deck span; the bed no longer walls the path in.
  // Lane rails-uncover (user report on build 93440cb27, "worse": torn ground under the 73 m span): the span was false.
  // The PDOK orthophoto shows the single siding along the Schinkel at the path's level, the path beside it, both passing
  // under the A10 viaduct; the bed's 1.5 m was the profile's grade from the ring line's embankment (+6.4 m) 110 m
  // south. Now: no span (SPAN_HEADROOM_M 3.6 m), a level crossing where the path crosses the siding, the bed ramping
  // down to it at the rail grade (railTracks crossing ramps): within 12 m its top at most 0.75 m over the land under its
  // centreline (an ordinary at-grade bed: topLift 0.32 over the highest land across its top; measured 0.68).
  { id: 'zuid-path-underpass', item: 'rails class b (lane rails-classb); Kranenbergpad report 2026-11-10', label: 'Piet Kranenbergpad crossing the Schinkel siding north of the Ringweg-Zuid at 4.85323,52.33879: a level crossing at the path\'s grade, no deck', at: [4.85323, 52.33879], radiusM: 40, maxAfterM: 0, minBeforeM: 0, bedOverM: 0.75, spans: 0 },
  // Lane rails-uncover, feedback bd03c59a (build ef73a292c, "this all looks very broken height / rails"): the Radarweg
  // bridge (OSM 489140283, 306838421, 444752996, 1494002849) over the rail trench drew no deck, the street running
  // down the trench walls to the tracks. A dry way deck over the track (railDecks), the tracks on the trench floor under it.
  // Lane rails-uncover (feedback 3ddc4cbf "minor surface issues in rail bridge", build ef73a292c): on the Hemboog viaduct
  // by the Sloterdijkerweg a bridge track and a track off the bridges (4-6 m apart, beds level within 0.2 m) kept
  // separate beds (the yard merge was same-deck only), and the V between them showed the bridge deck's pale top as a
  // wedge on the ballast at 4.85011-4.85015,52.38901. railTracks.ts sideGap crossDeck: they share one bed where their
  // levels agree within RAIL_MERGE.levelM.
  { id: 'hemboog-viaduct-bed', item: '3ddc4cbf minor surface issues in rail bridge', label: 'Hemboog viaduct by the Sloterdijkerweg: one ballast bed across a bridge track and the level track beside it (no pale deck wedge between them)', at: [4.85012, 52.38901], radiusM: 10, maxAfterM: 1000, minBeforeM: 0, ballastAt: [[4.85012, 52.389008], [4.850112, 52.389009], [4.850134, 52.389013], [4.850149, 52.389013]] },
  { id: 'radarweg-rail-bridge', item: 'bd03c59a this all looks very broken height / rails', label: 'Radarweg bridge over the Sloterdijk west rail trench at 4.83627,52.3891: a road deck over the tracks at -0.8, the street at +5', at: [4.83627, 52.3891], radiusM: 25, maxAfterM: 1000, minBeforeM: 0, deckOverTrack: 20 },
  // Lane rails-classb, the false positive the first rule made: the tram on the Frans de Wollantstraat (embedded_rails)
  // by the Piet Heinkade, whose bed the profile lifts 1.9 m over its own street at 4.93214,52.37178. A deck over its own
  // street would be wrong: zero spans. Its tear (222 m before the on-street rule, 242 m after) is that lift: a ratchet
  // (UNFIXED, the profile's, see docs/reports/rails-classb-20261110.md).
  // Lane rails-uncover: the crossing ramps (railTracks.ts CROSSING_RAMP_MAX_M) move 4 m of this embedded tram's 0.2 m tear
  // (242 -> 246; railRamps: false measures 242). The ratchet takes the 4 m; the Kranenbergpad level crossing needs the ramps.
  { id: 'frans-de-wollant-tram', item: 'rails class b (lane rails-classb)', label: 'Frans de Wollantstraat tram (embedded in the street) by the Piet Heinkade: no deck span over its own street', at: [4.93214, 52.37178], radiusM: 40, maxAfterM: 246, minBeforeM: 222, spans: 0 },
  { id: 'radarweg-junction', item: '#18 whats with the lines on the road?', label: 'Radarweg / Basisweg / Kastrupstraat junction (seams: probe-road-seams.ts)', at: [4.8366, 52.3908], radiusM: 150, maxAfterM: 0, minBeforeM: 0 },
];

/** Metres of track in a `crossing` run that tears (> 0.2 m over/under the carriageway), summed over the spot's cells. */
export async function tearMetres(store: GroundStore, spot: RailStreetSpot): Promise<number> { return (await measureSpot(store, spot)).metres; }

/** Tear metres and the deck spans (railSpans.ts) whose street crossing lies within the spot's radius. */
export const BED_RADIUS_M = 12;
/**
 * Each store's cells, loaded and built once (lane rail-street-speed 2026-11-14): the Sloterdijk spots share their cells,
 * and a built cell does not depend on what its store prepared before it (GroundStore `deterministic`), so a rebuild
 * for the next spot or a `ballastAt` point only repeated the work. The checks only read the built cell.
 */
const cellCache = new WeakMap<GroundStore, Map<string, { input: Promise<CellInput>; built?: BuiltCell }>>();
function cachedCell(store: GroundStore, key: string): { input: Promise<CellInput>; built?: BuiltCell } {
  let cells = cellCache.get(store);
  if (!cells) cellCache.set(store, cells = new Map());
  let hit = cells.get(key);
  if (!hit) cells.set(key, hit = { input: store.cellInput(key, 0) });
  return hit;
}
async function cellBuilt(store: GroundStore, key: string): Promise<{ input: CellInput; built: BuiltCell }> {
  const hit = cachedCell(store, key), input = await hit.input;
  return { input, built: hit.built ??= buildCell(input) };
}
export async function measureSpot(store: GroundStore, spot: RailStreetSpot): Promise<{ metres: number; spans: number; bedOver: number; deckOver: number; ballastMiss: number }> {
  const [x, y] = toLocal(...spot.at), keys = new Set<string>();
  for (let dx = -spot.radiusM; dx <= spot.radiusM; dx += 50) for (let dy = -spot.radiusM; dy <= spot.radiusM; dy += 50) keys.add(store.cellAt(x + dx, y + dy));
  for (const k of [...keys]) if (!store.covers(k)) keys.delete(k);
  let metres = 0, spans = 0, bedOver = -Infinity, deckOver = 0;
  for (const k of keys) {
    if (!store.covers(k)) continue;
    const input = await cachedCell(store, k).input;
    if (!input.rails?.length) continue;
    const { built } = await cellBuilt(store, k);
    spans += (built.stats.rails?.spanList ?? []).filter(sp => Math.hypot(sp.at[0] - x, sp.at[1] - y) <= spot.radiusM).length;
    // Track samples every metre: the bed's top over the land (bedOverM), a road deck 3 m over the ballast (deckOverTrack).
    if (spot.bedOverM !== undefined || spot.deckOverTrack !== undefined) for (const w of input.rails) for (let i = 0; i + 1 < w.points.length; i++) {
      const [ax, ay] = w.points[i], [bx, by] = w.points[i + 1], len = Math.hypot(bx - ax, by - ay);
      for (let t = 0; t < len; t += 1) {
        const px = ax + (bx - ax) * t / len, py = ay + (by - ay) * t / len, d = Math.hypot(px - x, py - y), c = store.cellAt(px, py);
        if (c !== k || d > Math.max(spot.radiusM, BED_RADIUS_M)) continue;
        const hits = layersAt(built, px, py).hits, bed = Math.max(...hits.filter(h => h.layer === 'ballast').map(h => h.z)), land = Math.max(...hits.filter(h => h.layer === 'land').map(h => h.z));
        if (d <= BED_RADIUS_M && Number.isFinite(bed) && Number.isFinite(land)) bedOver = Math.max(bedOver, bed - land);
        if (d <= spot.radiusM && Number.isFinite(bed) && hits.some(h => h.layer === 'deckTop' && h.z - bed >= 3)) deckOver++;
      }
    }
    for (const f of scanCell(built, input.rails as never, input.cuts ?? [])) {
      if (f.cls !== 'crossing' || Math.abs(f.value) <= 0.2 || Math.hypot(f.at[0] - x, f.at[1] - y) > spot.radiusM) continue;
      metres += 2 * Number(f.detail.split(' ')[0]);
    }
  }
  let ballastMiss = 0;
  for (const at of spot.ballastAt ?? []) {
    const [px, py] = toLocal(...at), top = layersAt((await cellBuilt(store, store.cellAt(px, py))).built, px, py).top;
    if (top !== 'ballast' && top !== 'track') ballastMiss++;
  }
  return { metres, spans, bedOver: +bedOver.toFixed(2), deckOver, ballastMiss };
}

async function main(): Promise<void> {
  const print = process.argv.includes('--print');
  const before = new GroundStore(readExtract, { roads: true, railOnStreet: false, railSpans: false, railDecks: false, railRamps: false }), after = new GroundStore(readExtract, { roads: true, crossings: true }); // the crossing register on (crossings.ts, lane G3): every pin holds with it, kimpoweg-rails' 0 spans included (round 2)
  await Promise.all([before.init(), after.init()]);
  const only = process.argv.find(a => a.startsWith('--only='))?.slice(7).split(',');
  let failed = 0;
  for (const s of RAIL_STREET_SPOTS) {
    if (only && !only.includes(s.id)) continue;
    const b = await measureSpot(before, s), a = await measureSpot(after, s);
    const ok = print || (a.metres <= s.maxAfterM && b.metres >= s.minBeforeM && (s.spans === undefined || a.spans === s.spans) && (s.bedOverM === undefined || a.bedOver <= s.bedOverM) && (s.deckOverTrack === undefined || a.deckOver >= s.deckOverTrack) && a.ballastMiss === 0);
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${s.id}: tear metres before ${b.metres} after ${a.metres} (pin: after <= ${s.maxAfterM}, before >= ${s.minBeforeM}); deck spans ${a.spans}${s.spans === undefined ? '' : ` (pin: ${s.spans})`}${s.bedOverM === undefined ? '' : `; bed over land ${a.bedOver} m, before ${b.bedOver} m (pin <= ${s.bedOverM})`}${s.deckOverTrack === undefined ? '' : `; deck over track ${a.deckOver} m before ${b.deckOver} (pin >= ${s.deckOverTrack})`}${s.ballastAt ? `; bed holes ${a.ballastMiss} of ${s.ballastAt.length} points, before ${b.ballastMiss} (pin 0)` : ''}  ${s.item}`);
  }
  if (failed) process.exit(1);
}
if (process.argv[1]?.endsWith('check-rail-street.ts')) main().catch(e => { console.error(e); process.exit(1); });
