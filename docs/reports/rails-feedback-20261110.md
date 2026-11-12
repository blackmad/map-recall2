# Rails feedback 2026-11-10 (lane rails-uncover)

Three feedback notes from build ef73a292c, plus the coordinator's Piet Kranenbergpad report on build 93440cb27.
Branch `lane/rails-uncover-20261110`. Frames are in `map-recall2-screenshots-a1/roads/2026-11-10-rails-feedback/`
(not committed): `<device>-<pose>-<step>-{before,after}.jpg`, with PDOK orthophotos (Actueel_orthoHR) in `ortho/`.
Frames come from `scripts/own-ground/rail-feedback-shots.mjs`, in chase view with the rider frozen at the note's pose.
"before" is the committed bundles; "after" is this branch's ground bundles, served through `--bundles`.

## 0664edc9 "weird uncovering effect on rails" (Kimpoweg, 4.841442,52.386195)

**Cause.** A tram bed lies 0.3 m over a gravel reservation and paving.
- The ground layers draw with polygonOffset factor −3. The ballast and track had none.
- The factor term scales with the triangle's depth slope, and at a riding tilt that slope grows with distance.
- Far away, the gravel and paving won the depth test over the bed. The tracks were hidden behind a saw-toothed edge that moved with the rider: it "uncovered" the rails as they rode up.

**Diagnosis.** Turning off polygonOffset on gravel, paving, land and square removed the cover entirely.

**Fix.** `gameGround.ts RAIL_OFFSET { ballast: 3, track: 3 }` (switch it off with `?railOffset=0`). The bed's layers take the same offset as the ground they lie on, so the bed's real 0.3 m lift decides the order. `groundCell DRAW_RANK` and the CPU hit ranks were updated to match.

**Frames.** `desktop-uncover-{0..5}-*` is a forward sequence in 15 m steps; `seq-before.jpg` and `seq-after.jpg` are montages of it; phone frames are steps 0–2.
- Before: the cover edge advances with the rider.
- After: the tracks are visible all the way to the crossings in every step.

**Pin.** This is a render-order defect, so the CPU stores cannot see it. The frames are the evidence. `kimpoweg-rails` in check-rail-street keeps its UNFIXED class-a/c ratchet, which covers the bed height, not the draw order.

## 3ddc4cbf "minor surface issues in rail bridge" (Hemboog viaduct by the Sloterdijkerweg, 4.850116,52.388745)

**Cause.** At 4.85011–4.85015, 52.38901 a bridge track and a track off the bridges run 4–6 m apart. Their beds are level within 0.2 m (ballast 2.85 m against 2.77 m).
- The yard-bed merge (`sideGap`, issue #145) only joins tracks on the same deck: both on a bridge, or both off.
- These two tracks therefore kept separate beds.
- The V between the beds showed the bridge deck body (deckBody at +2.54) as a pale wedge on the ballast.

**Diagnosis.**
- `?railStripes=0` did not change it.
- Turning the slab's deck top to the ballast tone in the first commit did not remove it either.
- Probing with `layersAt` found the hole: no ballast there, with the deckBody on top.

**Fix.** `railTracks.ts sideGap` takes an optional `crossDeck(way, s)` predicate.
- `railMeshes` passes it whenever the profile levels exist (not in the legacy build).
- A track on the other deck counts as a yard neighbour where the two levels differ by at most `RAIL_MERGE.levelM` (0.5 m).
- Without the predicate the behaviour is the same as before.

**Frames.** `desktop-bridge-0-{before,after}`, `phone-bridge-0-*`. The wedge is gone, and the rails are crisper from RAIL_OFFSET.

**Pins.**
- check-rail-street `hemboog-viaduct-bed`: four `ballastAt` points must have ballast or track on top. 0 holes now.
- Unit test `cross-deck yard bed` in railTracks.test.ts: level tracks share one bed, a 2 m height difference keeps two beds, and with no profile the decks stay separate.

## bd03c59a "this all looks very broken height / rails" (Radarweg, 4.836204,52.388638)

**Cause.** The Radarweg crosses the Sloterdijk west rail trench on OSM bridge ways 489140283, 306838421, 444752996 and 1494002849.
- Dry way decks (`dryWayDecks`) are off city-wide, so those ways had no deck.
- The road was draped down into the trench, and torn ground stood over the tracks at −0.8 m.

**Fix.**
- `groundStore railDecks` (default on; switch it off with `?railDecks=0`): with dryWayDecks off, step 3 still runs for bridge ways that cross a non-bridge rail track at 20° or more (`wayDecks crossesTrack`). Each such deck runs on over the end holes, ground lying more than 0.3 m under the deck chord (`runOverEndHoles`).
- `groundCell railLand`: tracks under a dry deck, or under a deck more than 2.5 m over the land, keep the ground level instead of riding the deck.

**Result.** The deck stands at about +5.0 m and the tracks stay at −0.8 m under it. The end dips are reduced to 0.4–0.5 m.

**Frames.** `desktop-radarweg-0-{before,after}`, `phone-radarweg-0-*`. The road is continuous over the trench. A few grey shards remain at the south end of the deck (the abutment meeting the trench side). That area is ground and portal code, which is outside this lane.

**Pin.** check-rail-street `radarweg-rail-bridge`: at least 20 one-metre track samples within 25 m that have a road deck 3 m or more over the ballast.

**City census.** 47 dry decks now stand over rails (list in the lane's scratchpad `rail-decks.json`). They include:
- the Sloterdijk station footways 282727041, 444753000, 1074736508 and 386997420;
- pieces of the Ringweg-West and the Ringweg-Zuid;
- the Johan van Hasseltweg, the Klimopbrug, the Hederabrug and the Ringweg-Oost.

These were sampled by store numbers only and still need a visual pass.

## Piet Kranenbergpad (4.85323,52.33879): the false deck span

**Cause.** The rail way here is a single siding along the Schinkel, at the path's level (PDOK ortho `ortho/kranenberg.jpg`).
- The profile's grade from the ring line's embankment (+6.4 m at 52.3378, 110 m south) lifted the bed 1–2 m over the path.
- lane rails-classb's span rule (1.0 m clearance) then decked it with a 65–73 m span. The ground under that span tore.

**Fix (rail code only).**
- `railSpans.ts SPAN_HEADROOM_M = 3.6`: a span needs room for a rider under it. The 6th parameter of `underpassSpans` is the headroom. The candidate loop's shape is unchanged, for G3.
- `railTracks.ts` crossing ramps: next to a level crossing the bed comes down at RAIL_GRADE, at most `CROSSING_RAMP_MAX_M` (60 m) each side, instead of one 6 m V piece.

**Frames.** `{desktop,phone}-kranenberg-0-{before,after}`.
- Before: a raised bed, and red cycle-path shards torn around the span.
- After: the bed is level with the path at the crossing (ballast −0.79 m, land −0.85 m). The A10 deck stands over both as in the ortho.

**Pin.** check-rail-street `zuid-path-underpass`: `spans: 0`, and `bedOverM: 0.75` (within 12 m the bed is at most 0.75 m over the land under its centreline, an ordinary at-grade bed). Measured: 0.68 m now, 2.11 m before.

**Side effect.** The ramps move 4 m of the Frans de Wollantstraat embedded tram's 0.2 m tear (242 to 246 m; with `railRamps: false` it measures 242). The `frans-de-wollant-tram` ratchet now takes 246.

**Ring-rail decks (~52.343, 4.851).** `{desktop,phone}-ring-0-*` (Stadiongracht) are unchanged before and after. No span triggered there; the siding and the path cross the inlet on their own low bridges.

### Every candidate span under the old rule, and the 3.6 m rule

This census covers every world cell (`underpassSpans` at headroom 1.0, i.e. lane rails-classb's rule).

| Location | Street | Clearance under floor | Old length | 3.6 m rule | Ortho verdict |
|---|---|---|---|---|---|
| 4.85323,52.33879 | Piet Kranenbergpad | 1.51 m | 65.2 m | removed | Level crossing beside the Schinkel; no underpass |
| 4.84508,52.38615 | Arlandabrug west approach footway (tram) | 1.59 m | 33.9 m | removed | Tram crosses the footway at grade east of the A10 (`ortho/arlanda.jpg`) |
| 4.84508,52.38611 | same footway, second tram track | 1.25 m | 29.0 m | removed | as above |

No candidate is kept. `arlandabrug-tram` now pins `spans: 0`. A genuine class-b underpass (a street at least 3.6 m under the bed) is so far drawn by the OSM bridge tags themselves.

## Flags (A/B)

- `?railSpans=0`: no deck spans.
- `?railDecks=0`: no dry decks over the rails.
- `?railOffset=0`: the old ballast and track offset.

All three are read on the page and passed through the worker's init into the GroundStore.

## Rebuild (integrator)

- Bundles: `node scripts/build-3d-bundles.mjs --only=own-ground-game,own-ground-worker`.
- Baked world cells: every cell with rails. railDecks, the crossing ramps, the headroom rule and the cross-deck yard bed all change the rail meshes and the decks over tracks, at least in cells -4_1, -5_1, -5_2, -4_2 and -4_-4. A full `world:compile` of the rail cells is the safe call.
- Afterwards, rebuild covers if the baked cells feed them.
