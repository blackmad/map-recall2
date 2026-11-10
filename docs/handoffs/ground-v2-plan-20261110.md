# Ground that holds together, plus honest building cards (plan, 2026-11-10)

**Approved by the user 2026-11-10.** It supersedes `ground-underpass-shards-20261110.md` (G-shards, never spawned). User shots are `images/40.png`–`52.png` in session 88cbf34b; G0 copies them to the screenshots repo under `user-shots/2026-11-10-ground/`.

## Context

The user's shots on build 93440cb ("this still looks awful", "wtf", "I think this needs an actual plan"):

| Place | What the shot shows |
|---|---|
| Piet Kranenbergpad, under the ring and Schiphol rail decks | ground torn into shards; the cycle-path red smeared into wedges; worse than the previous build |
| Amstelveenseweg viaduct | better, but shards remain |
| Schinkel bank by Jachthavenweg | shards; a sand field with a cycle path dead-ending in it |
| Overschiestraat, Sportparklaan, Anthony Fokkerweg | a black tunnel-portal box standing on grass; curved wall stubs; crumpled cutting slopes |
| Vlaardingenlaan / Naaldwijkstraat (flat ground) | scraps of asphalt, pavement and grass poking through each other |
| Cornelis Lelylaan / Delflandlaan | the near ground is the far-distance texture, so it blurs when zoomed in |
| Anthony Fokkerweg 61 | one restaurant names a whole nine-storey slab ("Arepa Shop Amsterdam") |
| Free Ride building card | no address |

Outcome: the ground reads as one continuous, correct surface city-wide, measured by a detector instead of found by the user one spot at a time, and a card describes the building that was tapped, with its address.

**User rulings (2026-11-10):**
- Rebuild the ground as one surface: fix the worst causes now, then build one clipped partition per cell.
- Open ground stays on until the A/B decides. If it causes shards, it goes off by default until fixed.

## Diagnosis (three research passes on origin/main)

### How the ground is built

The ground is built at runtime per 1 km cell (`groundWorker.ts` → `ownGround/groundCell.ts buildCell`), not baked offline. The layers are:
- roads-v1 (BGT wegdeel);
- open-ground-v1 (new today; BGT terreindeel classified from aerial imagery);
- parks;
- courtyards;
- OSM areas;
- OSM street ribbons;
- a 5 m land grid.

What goes wrong in that process:
- **No layer is clipped against another.** Each layer is triangulated on its own with earcut, then refined:
  - `drapeBisect` (`parks.ts:286`) emits unshared vertices and tests only sag, not float;
  - `drapeAdaptive` (`roadSurfaces.ts:156`) has area gates of 8 m² on coarse tiles.
- **Stacking is by lift only.** Layers sit on 15–40 mm lifts plus `polygonOffset` ranks (`gameGround.ts:383`), with no clipping across extracts.
- **Open ground has its own snapping errors.** It is cut against OSM rings only, offline (`build-open-ground.ts:161`), then simplified ring by ring (0.15 m) and rounded to 0.1 m.
- **Heights are coarse.** They come from the AHN DTM averaged to 2 m, or 4 m on outer tiles. Zuid tile 118_484 is 4 m and 60 % measured. Gaps are filled with pull-push and smoothed. There is no talud or breakline geometry.

### Mechanisms

**Shards and poke-through:**
- **Unequal refinement.** Neighbours split to different depths, which leaves T-junction cracks; the land under them is culled.
- **Layer edges that don't meet.** Overlaps or gaps of 10–30 cm z-fight on slopes.
- **Green and open ground float** above paths at concave feet, because only sag is bounded.
- **Long strips on coarse tiles never split**, so their planes cut through the relief.

**Under decks:**
- **Saddles.** The DTM under every rail span and dry bridge is filled from the rim. Only Centraal is capped (`railViaducts.ts:68`).
- **Kranenbergpad's new span** (`railSpans.ts`, dde179c8b) has a soffit 0.2–0.5 m over the path, leaves the fill under it, and has no URL flag.
- **Dry way decks are off**, so the BGT polygons at h ≥ 1 are skipped and the bridge bands z-fight the path on the same saddle.

**Portals and cuttings:** these come from `ownGround/tunnels.ts`, from OSM `tunnel=*` plus a DTM scan. BGT tunnel and structure data is unused.
- Motor ramps skip the walled-both-sides test (`tunnels.ts:375`). An A10 strip beside the rail embankment, within 500 m of a motor tunnel, reads as a cut, and a path crossing it gets a dark mouth (`tunnels.ts:741-744`) with no tunnel there.
- Three overlapping slots at Overschiestraat (road, cycleway, footway; `tunnel=yes`, 6 m apart) each draw walls, lintels and a black floor.
- The slot floor is the lowest of four samples, so a ditch pulls it down.
- Mouths draw where the walls were dropped.
- `clipMeshAtCuts` skips triangles within 6 m of open sides (`tunnels.ts:1159`).
- Underpass roads (BGT h < 0) are dropped (`build-bgt-roads.ts:159`).

**Blurry near ground:** the far-distance texture is drawn at the rider. The suspects are quick first paint (d950f0eb0, LOD 1 first) not being replaced, or a stalled worker cell. This is unconfirmed.

**Cards:** `clickPoiInfo.ts card()` titles the building with the first mapped place inside its footprint, with no size or kind rule. There is no address source; no BAG address extract exists.

### Checks that exist

- **Ground checks:**
  - `scripts/own-ground/check-ground-cells.ts`;
  - `probe-junction-overlap.ts --pairs`, which covers road layers only;
  - `roadSlivers`, roads only;
  - `check:tunnels`, with 19 sites.
- **Pins:**
  - `zuid-path-underpass` passes despite the regression, because it checks track tear only;
  - `overschiestraat-underpass`;
  - `ringweg-zuid-7381715`.
- **Gaps:** nothing measures overlaps across extracts, cracks, float, poke-through, portal placement or near-ground coverage, and no e2e spec covers an underpass.

### Already owned elsewhere

a1's rails lane (`rails-uncover-20261110`) adds `?railSpans=0` and fixes the span headroom and span ends at Kranenbergpad. It stays off `groundSurface.ts` and open ground.

## Plan

The integrator (`integrator-lanes-85`) spawns the lanes; this session writes the briefs and judges the hand-backs. Every lane uses `/usr/bin/git`, its own worktree, a private `PW_PORT`, `/tmp/canal-pw.sh`, stops its server by PID, and keeps a doc section. Disk is at 12 GB, so spawn after the next sweep.

### G0 — Measure: a city-wide ground audit and A/B (sonnet code, opus read; today, Node-only)

`npm run ground:audit` runs `buildCell` in Node (no browser) for every cell, or with `--near <lng,lat>` for one place. Per cell it reports:

| Measure | Definition |
|---|---|
| sliver | aspect > 20 and area > 0.05 m² |
| poke-through | a lower-precedence layer above a higher one by > 5 mm, in m² |
| z-fight | layers from different extracts within ±5 mm |
| crack | uncovered area where land is culled |
| float | > 0.10 m above the DTM |
| near coverage | the cell has no near-tier mesh |

It also reports the portal and mouth count per cut, with or without a tunnel way.

- **Ranking:** cells weighted by ride priority (`ridePriority.ts`). Report the top 50 and the share per cause.
- **Named location set:** a new `src/canalRecall/ownGround/groundRegressions.ts`, holding the 8 places above at exact positions. The detector must rank all of them high, or the detector is wrong.
- **A/B on those places:** `?openGround=0`, `?railSpans=0` (once a1's flag lands), `?portalEnds=0`, `?portalClip=0`, `?dryWayDecks=1`. Ride frames are desktop plus phone, beside the orthophoto.
- **Open-ground ruling:** if open ground alone accounts for ≥ 20 % of the shard area at the named places, the integrator turns it off by default (one-line default plus a What's New note) until G2 lands.
- **Deliverables:** `docs/reports/ground-audit-20261110.md` and an `artifacts/ground-audit/` JSON. That JSON is G2's baseline.

### G1 — Targeted fixes now, in the current build (opus; after G0)

Fix by cause, each behind a flag, byte-identical where there is no defect, and confirmed by the G0 numbers:
1. **Caps under decks.** Generalise `capViaductFloor` to every rail span, every OSM bridge over land, and BGT overbruggingsdeel footprints: flatten the DTM under a deck to the street level measured at its two ends. This removes the saddles.
2. **Float bound** in `drapeBisect`, matching the sag test, plus a min-area gate that scales with the tile step rather than a fixed 8 m².
3. **Portal sanity in `tunnels.ts`:**
   - a dark mouth only where a tunnel way lies ahead and walls exist on both sides;
   - motor ramps need the walled test when another embankment is beside them;
   - parallel tunnel ways within 10 m merge into one slot;
   - the slot floor uses the median, not the minimum, of the samples;
   - no mouth on a strip whose walls were dropped.
4. **Underpass roads.** Keep BGT h < 0 road polygons where a slot or cut covers them, so the red and the asphalt run through.
5. **Pins.** Strengthen the Kranenbergpad pin to cover ground, not only track, and add an underpass e2e (ride through Overschiestraat). Every G0 named place gets a pin in `check-ground-cells.ts` or `check:tunnels`.

### G2 — Ground v2: one clipped partition per cell, baked offline (opus; design first, then build lanes)

The structural fix the user chose. Every cell becomes one planar partition: no overlaps, no gaps, shared vertices, one draped surface.

- **G2-design** (opus, a design doc for my review, about 2 h). It covers:
  - precedence: carriageway > cycle > footway/sidewalk > rail bed > parking > courtyard > park > open ground > OSM fill > land;
  - clipping in RD integer millimetres, with clipper2 or polygon-clipping (measure both);
  - snapping shared edges;
  - constrained Delaunay: check the installed deps for cdt2d or poly2tri. It needs Steiner points wherever the DTM departs > 5 cm from the plane, and breaklines at embankment tops and feet (DTM curvature), at deck edges and cut walls, and at kerb lines. A kerb becomes a vertical strip, not a lift.
  - one vertex buffer per cell with a per-triangle layer id;
  - the cell format and its size budget;
  - how decks and cuts become constraints, and how G1's caps carry over.
- **G2a, bake.** `npm run ground:bake` writes `ground-v2/<cell>.bin` (staged, hashed per cell, rebuilt per input tile like world-v1). Gate: on every named place and the top-50 cells, slivers, poke-through, z-fight and cracks read 0, and float stays ≤ 5 cm.
- **G2b, runtime.** `gameGround.ts` loads the baked cells, with one mesh and groups per layer so the existing look and materials apply unchanged. `?groundV2=1`. The worker build becomes a fallback only. Gates:
  - look parity on Storybook and the H10-style ride frames;
  - ground bytes per cell within +30 %;
  - desktop time-to-ride no worse, likely better because the worker build is gone (`CANAL_PW_TIMING=1`).
- **G2c, crossings.** Decks, cuts, slots and portals become partition constraints. Floor, walls and ground share edges, which removes `clipMeshAtCuts` and lids.
- **G2d, flip.** Default on after the user rides the named places. The old path stays behind `?groundV2=0` for one week.

### G4 — Near-ground coverage (sonnet; parallel with G1)

- Reproduce at Cornelis Lelylaan / Delflandlaan.
- Find why the far texture draws at the rider: a missing cell, a stalled worker, or first paint never replaced.
- Add a runtime check: when the far tier is drawn within 150 m of the rider for > 2 s, record a Sentry breadcrumb plus a dev overlay.
- Fix the cause, and let G0's coverage column confirm it city-wide.

### C1 — Cards describe the building tapped (sonnet; parallel)

- **Title rule in `clickPoiInfo.ts card()`.** A mapped place titles the building only when one of these holds:
  - its name matches the building;
  - it is a building-scale kind: mall, school, hotel, museum, church, station, library, theatre, hospital;
  - the building is small (footprint < 400 m² and ≤ 4 storeys) with one or two places.

  Otherwise the building card (`buildingFacts.ts describeBuilding`) leads with type, year and height, followed by "Inside: Arepa Shop Amsterdam (restaurant) + n more".
- **Pins:** the Anthony Fokkerweg slab and a mall; `check-click-poi-info.ts` cases.

### C2 — Addresses on building cards (sonnet; data plus card)

- **Data.** A new extract `pand-addresses-v1` (tiled like the building facts), from open BAG data (PDOK BAG, verblijfsobject → nummeraanduiding): pand id → street plus a compact number range ("Anthony Fokkerweg 55–65", "Herengracht 12 / Leliegracht 2"). Built to staging, coverage reported, then published.
- **Card.** It shows the address in Free Ride. In the quiz modes the street part is hidden while a question is open (product rule: never reveal the street under question) and shown after the answer.
- **Gates:** ≥ 95 % of pands with a verblijfsobject get an address; an e2e asserts that no question's street appears on a card before the answer.

### Order

1. **Today:** G0, C1, C2 and G4 start; G2-design starts in parallel.
2. **After G0's numbers:** the open-ground default is decided, then G1.
3. **After my design review:** G2a, G2b, G2c, then G2d.
4. **Elsewhere:** a1's rails lane continues on spans. T-shape (trees) runs independently.

## Verification

- **G0:** `ground:audit` ranks all 8 named places in the top 50. The A/B frames identify the share each layer contributes.
- **G1 and G2:**
  - audit totals drop: G1 ≥ 60 % of shard area city-wide; G2 to 0 slivers, poke-through, z-fight and cracks on the named and top-50 cells;
  - `world:verify` and `check-ground-cells.ts` pass, `check:tunnels` passes, and `check:canal` is green;
  - before/after ride frames at each named place (desktop plus phone) sit beside the orthophoto, judged on the look first (memory "road look over accuracy").
- **G2b:** time-to-ride on desktop (`CANAL_PW_TIMING=1`), plus ground bytes per cell.
- **G4:** the Sentry breadcrumb count drops to near zero after the fix, and the Cornelis Lelylaan frame is sharp.
- **C1 and C2:**
  - the Arepa slab card leads with the building;
  - addresses appear in Free Ride;
  - a quiz e2e shows no street leak;
  - coverage is reported in the extract.
- **User acceptance:** the user rides the named places once G1 lands, and again before the G2 flip.
