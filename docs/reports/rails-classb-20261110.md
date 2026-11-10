# Rails class b, 2026-11-10 (lane rails-classb)

Follow-up to `docs/reports/rails-class-20261110.md` (feedback G: #10 Sloterdijkerweg, #13 Kimpoweg, #16 Radarweg).
The brief: a non-bridge tram or rail bed over a street at least 1 m lower is an untagged viaduct approach ("99 runs
city-wide"); promote those to deck spans so the street passes under.

## Headline

The premise mostly does not hold. Only **3 places city-wide** are untagged viaducts over a street, and these are now deck
spans totalling 140 m. **None of the brief's three feedback spots is class b.** The probe's 50 "height" runs (374 m)
have other causes, listed below. None of them is a street under an approach, and the span rule correctly leaves all
of them alone.

## What changed

`src/canalRecall/ownGround/railSpans.ts` (pure, typed, tested in `railSpans.test.ts`, run by `test:own-ground` through
`railTracks.test.ts`). It is wired in `groundCell.ts` (input `railSpans`, default on; `GroundStore` option `railSpans: false`
gives the before build) and `railTracks.ts` `railMeshes` (`spans`, `spanUnder`).

- **Trigger.** A street centreline crosses a track that is off the bridges. The street is at grade, at an angle of
  at least 20 degrees. Measured along the street just outside the deck's footprint, the median of 5 samples on each
  side lies at least `SPAN_CLEAR_M` = 1.0 m under the bed's floor (the railProfile level), on both sides. The street
  must not climb towards the track on either side (`ROAD_CLIMB_M` 0.3 m; this rejects a path up a dike to a level
  crossing). The median makes the rule robust to single AHN spikes.
- **Skipped.** Streets tagged `embedded_rails`. Streets the track runs along: the track stays inside the street's strip
  more than 6 m longer than a crossing at that angle would take. Crossings in a tunnel cut's box (the measured trench).
  Bridge ways.
- **Extent, with hysteresis.** The span covers the street's strip plus 1.5 m. It then runs on while the land across
  the bed stays at least `SPAN_LAND_M` = 0.5 m under the floor, up to 40 m on each side. So it starts at 1.0 m and
  continues at 0.5 m. Spans within 6 m of each other merge.
- **Drawing.** Inside a span, the span's ends are stations of their own. The stations are a deck: the slab is 1.1 m deep
  and no longer a slab reaching into the ground, and the at-grade crossing rule no longer flattens the bed onto the
  street. railBridge piers, railings and the edge beam are drawn on the land beneath. The `under` test leaves the
  promoted track out of "tracks at grade". Outside the spans nothing changes. With no spans, the arrays are identical
  (unit-pinned `deepEqual`). Cells without a span are byte-identical, because the code paths are gated on a non-empty
  span map.

## Counts, whole city (139 rail cells, LOD 0, `probe-rails-class.ts`)

| | before (main) | after |
|---|---|---|
| class a crossing runs > 0.2 m | 309 runs, 12,838 m | 309 runs, 12,838 m (identical) |
| class b (probe "height", road under bed > 0.6 m) | 50 runs, 374 m | 50 runs, 374 m |
| of which road ≥ 1 m under | 35 runs, 274 m | 35 runs, 274 m |
| class c ramp bins | 2,021 (121,157 m²) | 2,021 (121,157 m²) |
| deck spans (railSpans.ts) | 0 | 3 spans, 140 m |

The spans:

| where | street | clearance under floor | span |
|---|---|---|---|
| 4.85323,52.33879 | Piet Kranenbergpad (cycle/foot) under the Schiphol line, Ringweg-Zuid | 1.51 m | 73 m |
| 4.84508,52.38615 | footway under the Arlandabrug's west tram approach, north track | 1.59 m | 36 m |
| 4.84508,52.38611 | same footway, south track | 1.25 m | 31 m |

**Before**, each of these had the at-grade crossing rule pull the bed down onto the path: a V-shaped dip 1.3-1.6 m deep
in an otherwise level approach, with the raised slab's sides walling the path in. **After**, the track runs straight
across on a deck with a railing. See the frames below.

The probe's span count is the honest number. The probe's own class b metric does not move, because the 50 "height"
runs are not these spans. The first version of the rule also decked the Frans de Wollantstraat tram over its own street
(4.93214,52.37178, clearance 1.89 m). That is now excluded and pinned (zero spans).

## The probe's class b runs are something else

These were sampled with the production build (`dbg` scratch script: OSM ways plus every layer's height at the run's start).

| run | what is there | real cause |
|---|---|---|
| 4.83919,52.3876 tram −1.77 (Sloterdijk, #10) | the tram terminus on the Carrascoplein busway it is embedded in (`embedded_rails=tram`), under the Teleportboulevard cycle bridge; the station podium east of it is at +2.2 | railTracks' floor rule (never under the land across the bed's top) lifts the bed to +1.2..1.5 over a busway at +0.2, because the podium's land lies under its east edge. No street passes under. |
| 4.8393,52.38615 / 4.83918,52.38657 (Kimpoweg, #13) | tram at grade; the crossing streets lie within 0.1 m of the floor | the bed stands its normal 0.3-0.4 m over the klinker and cycle strips beside it: class a / c, not b |
| Radarweg (#16) | no rail run within 150 m flags class a or b | its defects are class c (the 342 m² rail-trench ramp) and d |
| 4.96096,52.3485 (Watergraafsmeer, 12 runs) | rail at grade over the Watergraafsmeer motorway tunnel (`tunnel=yes`) | the road surfaces of the tunnel's approach are drawn at the relief under the track: a tunnel/road-surface issue |
| 4.84933,52.40147 (4 runs) | rail passing under the A10 Ringweg-West viaducts | the bed is lifted 1.4 m over the land under a road bridge |
| 4.84287,52.35782 | the Lelylaan tram where its bridge way ends on the Cornelis Lelylaan viaduct | a bridge way's end level against a viaduct road |
| 4.89834,52.37939 | Centraal over the Cuyperspassage (`tunnel=yes`) | a tunnel's surface under a station track |
| 4.98307,52.31261 | metro over the Gaasperdammertunnel | the same as Watergraafsmeer |
| 4.93312,52.37239 / 4.93214,52.37178 (Piet Heinkade) | trams embedded in the Czaar Peterstraat / Frans de Wollantstraat by the rail bridge | the profile lifts the tram 0.7-1.9 m over its own street |

So the open classes are:

- (1) tracks lifted over their own embedded street by the floor rule or the profile (Sloterdijk, Piet Heinkade);
- (2) road surfaces of tunnels drawn at the relief under a track (Watergraafsmeer, Gaasperdammer, Cuyperspassage);
- (3) tracks under road bridges lifted over the land (Ringweg-West).

None of these is a deck span. Class (1) is the one the user saw at Sloterdijk. The next fix there: on a street tagged
`embedded_rails`, the bed's floor takes the street's own surface (what the onStreet test already flattens). It should not
take the land across the bed's top edges, and the profile should not lift an embedded tram over its street.

## Pins (`scripts/own-ground/check-rail-street.ts`)

The pins gained a `spans` count, which must match exactly in the shipped build. The before store now also turns
spans off. A new `--only=id,id` option is added.

| id | tear m before / after | spans |
|---|---|---|
| sloterdijk-rail-bridge | 46 / 46 (ratchet kept; relabelled: class (1) above, not b) | 0 |
| arlandabrug-tram | 50 / 0 | 2 (new) |
| kimpoweg-rails | 84 / 84 (ratchet kept; relabelled: class a/c) | 0 |
| radarweg-underpass, radarweg-junction | 0 / 0 | – |
| **zuid-path-underpass** (new) | 0 / 0 | 1 |
| **frans-de-wollant-tram** (new) | 222 / 242 (a ratchet: the profile lift; the class a on-street rule added 20 m here) | 0 |

The Sloterdijk and Kimpoweg ratchets were not lowered, because nothing in this lane touches them (see above).

## Frames

All frames are in `/Users/blackmad/Code/map-recall2-screenshots-a1/roads/2026-11-10-rails-classb/` (not committed). The
browser ride frames are `?engine=own&ride=free`, with the rider frozen in chase view, max zoom and tilt 72, desktop
1280×800 and iPhone 13. "Before" is the committed bundles. "After" is `own-ground-game` / `own-ground-worker` built
from this branch, served through a route (`BUNDLES_DIR`). The CPU renders (`rail-view.ts`, 30 m, 4 m up) are
`cpu-{arl,zuid}-{before,after}.png`.

- **zuid-path-span: better.** Before, the Schiphol line kinks down into the cycle path in a V (desktop and phone).
  After, it crosses straight on a railed deck. The CPU render shows the same.
- **arlanda-footway-span: better, but small in the frame.** The rider pose lands about 100 m short, so the approach is
  mid-distance. Before, it dips at the footway; after, it is a level railed deck. In the CPU render (cpu-arl-*) the dip
  is clear before and gone after; the land fill hump still shows under the deck's west half.
- **sloterdijk-carrascoplein, kimpoweg, radarweg: unchanged** (byte-identical cells, no span). Before and after are the
  same, so these are the user's spots as they stand. Sloterdijk shows the tram bed as a raised wide strip beside the busway.
- **frans-de-wollant: unchanged** (the false span is excluded).
- The phone "after" frames for radarweg, arlanda, zuid and frans-de-wollant first came back with the ground not yet
  resident (fallback map, under a machine load of 16-24). They were re-shot with a 40 s settle and all loaded. A LOD 0/1
  node build of the span cells (-4_1, -4_-4) and their neighbours raises no error. On the phone at zuid, the deck reads
  as a straight railed slab over the red path. Its dark fascia sits low over the path (see the caveat).

**Verdict.** The three spans read as decks where they used to read as a dip into the path. They are an improvement,
but they do not address the user's three spots.

Caveat: the clearance at these spans is the profile's (1.25-1.6 m floor over the path), so the soffit sits only
0.2-0.5 m over the path. In reality, the path dips deeper under the deck, but AHN fills the hole under it from the
rim. The deck reads correctly from a distance, but a rider passing under would clip it. Lowering the street inside
a span (a `capViaductFloor`-style field edit, railViaducts.ts) is the follow-up, if these paths matter.

## Checks

- `npm run lint`: pass.
- `npm run test:own-ground`: 315 tests, 314 pass, 1 skipped, 0 fail.
- `check:rail-street`: all 7 pins pass.
- `test:land-mask`, `check:bridge-gaps`, `test:reachability`: pass (run on the branch merged with origin/main).

## Integrator

- Rebuild the `own-ground-worker` and `own-ground-game` bundles (`node scripts/build-3d-bundles.mjs --only=own-ground-game,own-ground-worker`).
- Run `world:compile` for the baked cells. The cells holding the three spans (-4_1 and -4_-4, LOD 0 and 1) change, and so may their
  neighbours if a span's pieces reach across a seam. A cell with no span on its tracks is byte-identical.
- Covers are not needed (no models).
