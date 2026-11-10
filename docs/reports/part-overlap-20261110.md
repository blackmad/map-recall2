# Part overlap at IJdok (feedback fc427560), 2026-11-10

Lane `lane/part-overlap-20261110`. Brief: the triage (a387b8657) put "there's some texture fighting here" at the IJdok
passage (52.38415, 4.89501) down to interpenetrating OSM `building:part` prisms, and asked for a clip of the lower part.

## 1. Cause: not interpenetration

I rendered the user's pose: their `context.player` x/y/angle, chase camera, zoom 1.5, storybook look. The frame
matches their shot. It shows two dark-blue boxes on the right facade, a maroon vertical strip and a wood-brown pillar.
Then I left features out of the served tile (`PART_DROP_IDS`, live tile path), one candidate set at a time:

- Leaving out `w1088847352`, `w1088847353` and `w1088847358` removes both blue boxes and the maroon strip
  (`02-ijdok-isolation-without-352-353-358.png`).
- The pairs the triage named do not overlap in volume. `1088847356` (0–24 m) sits under `350` (39–46 m) and `351`
  (24–39 m); it does not cross them. The pairs that do cross (`1088833542` 0–17 m with `546`/`547` 0–28 m and
  `548` 11–35 m) are on the north-west block and are not in the user's frame.

What the three features are (OSM tags from the cached pbf, sizes measured on the tile):

| id | tags | footprint | heights |
|---|---|---|---|
| w1088847352 | `building:part=yes`, `building:material=glass` | 6.6 × 0.85–1.5 m oriel on the 356/351 stack | 23.5–27 m |
| w1088847353 | `building:part=yes`, `building:material=glass` | 6.1 × 1.2 m bridge between 355 and 356 | 14.5–18 m |
| w1088847358 | `building:part=yes`, no colour | 4.8 × 0.46 m fin in the notch under 351 | 8–24 m |

The two glass parts get `#5a81a0` from `materialColors.glass` (scripts/lib/building-colors.ts). The mesh draws them as
opaque, windowless blue boxes lying on the window grid. The 2025 panorama (`03-ijdok-panorama-…jpg`) shows they are
real: a glazed bridge between the Openbaar Ministerie and the Gerechtshof. The fin has no colour of its own, so the
storybook palette gives it its own wall hue, which here is maroon. Seen edge-on, it is a stripe on a white facade.

Interpenetration cannot show through the way the triage described. A wall inside another closed prism is hidden by
the depth test. Same-facing walls within 0.5 m of each other are already cut by the mesh builder
(`sharedWallCuts`, `NEAR_COPLANAR_M = 0.5` in coplanarSurfaces.ts). That is why the near-coplanar audit finds only
22 m² on this tile. I also framed the city's biggest interpenetrating BAG pair
(`interpenetration-NL.IMBAG.Pand.0363100012117498-before.png`, 3,062 m² overlap, Staatsliedenbuurt). It draws clean.
**I did not implement a clip:** it would change no pixels, and it would reshape the footprints and roofs of 746
buildings.

## 2. Census (`scripts/audit-part-overlaps.ts`, building-tiles after dropNestedDuplicates, 350,352 features)

**Interpenetrating ground pairs.**
- Rule: both parts have base ≤ 0.5 m, the plan overlap is ≥ 5 m² and ≥ 5 % of the smaller part, and the tops differ by
  ≥ 0.5 m.
- Result: **746 pairs, 140,194 m²** of overlap. **Centrum: 125 pairs, 10,004 m²** (17 % of pairs, 7 % of area).
- I sampled the lower part's walls every 0.5 m:
  - 10.4 km lie inside the taller footprint, more than 0.3 m from its walls. These are hidden.
  - 8.2 km lie within 0.3 m of the taller part's walls. Those that face the same way are cut by `sharedWallCuts`;
    those that face the other way are party walls.

Top 10 by overlap:

| lower | taller | tops (m) | overlap m² | where |
|---|---|---|---|---|
| w806904235 | w548207840 | 20 / 24 | 5,663 | 4.89041, 52.34008 (Zuidas) |
| w199414695 | w548207841 | 11 / 20 | 4,669 | 4.88904, 52.34035 |
| passage:w277270888:0 | w1239504124 | 3 / 9 | 3,525 | 4.88967, 52.33970 |
| NL.IMBAG.Pand.0363100012117498 | …243844 | 11.1 / 16.3 | 3,062 | 4.87178, 52.37706 (Staatsliedenbuurt) |
| NL.IMBAG.Pand.0394100000225498 | …225497 | 3.2 / 18.8 | 2,571 | 4.75412, 52.27710 |
| w1086981554 | w724612930 | 22 / 25 | 2,348 | 4.95638, 52.29496 |
| NL.IMBAG.Pand.0363100012249709 | w880746894 | 73.2 / 74.8 | 2,219 | 4.93352, 52.40159 |
| passage:w277270888:0 | w1239504127 | 3 / 9 | 1,955 | 4.88967, 52.33970 |
| NL.IMBAG.Pand.0363100012160484 | w57856884 | 8.3 / 15.9 | 1,924 | 4.95810, 52.35485 |
| w446897773 | passage:r7490104:0 | 18 / 44 | 1,917 | 4.75542, 52.30700 |

**Slender parts (the actual cause).**
- Rule: mean thickness 2A/P ≤ 1 m, and the part stands within 0.6 m of a larger host that is at least as tall.
- Result: **4,617** such parts (86 in Centrum, 515 floating). Of these, 4,187 have no colour and 18 are `#5a81a0`
  (glass or "blue"). Many are pieces the pipeline cut itself (`passage:`, `tower:`).
- The rule below drops **191** of them (Centrum: 4, with IJdok's fin among them), about 9,000 m² of wall.

## 3. Fix: slender rule in `dropNestedDuplicates` (src/canalRecall/buildingNesting.ts)

A feature is dropped when all of these hold:

- Its id is a source footprint: an OSM way or relation, or a BAG pand. Pipeline pieces with a `:` in the id are
  excluded.
- It has no `colour`.
- Its mean thickness is ≤ 1 m.
- It stands against a host that is more than twice its area and whose height range covers its own within 0.5 m.
- Every vertex is ≤ 1.5 m outside the host, and at least one vertex touches the host (≤ 0.6 m).
- No second building at the same height touches it. An infill between two houses is kept, so no slot opens in a row.

`options.slender: false` turns the rule off for audits.

**Where it runs.** It runs inside `dropNestedDuplicates`, which both paths already call: the live tile path
(`buildingTilesBrowser` fetchTile) and `world:compile` (`scripts/world/pipeline.ts` loadTile). The tiles stay
untouched and the two paths stay identical. `buildingNesting.ts` is already in pipeline.ts `CODE`, so the compile's
freshness hash flags the change. I chose this over a publish-time tile edit for three reasons: it keeps the tiles as
OSM/BAG said, it needs no re-run after a tile rebuild, and `cut-building-passages` and the bag-tiles mirror do not
have to learn about it.

**Byte-identical elsewhere.**
- A tile with no slender candidates returns the same features, the same objects in the same order (pinned in the
  test).
- `world:verify` against the published world-v1 on the three pin tiles: the only differences are the dropped ids
  (`onlyWorld` 1 / 3 / 26). There are 0 raw differences, 0 styled differences and no order change.

**Not fixed: the blue glass boxes.** They are real glazing that the mapper tagged. The kit cannot draw a glazed oriel
or skybridge: it draws an opaque `#5a81a0` slab with no windows. The right fix is a glass treatment for slender
coloured or glass parts (window cells or a glazing tone) in the presentation lane, not dropping them. 18
city-wide parts of this kind sit against a host. The tile keeps `colour` but loses `building:material`, so that lane
would also need the material carried into the tiles.

## 4. Pins (src/canalRecall/buildingNesting.test.ts, 6 tests)

The test has synthetic cases (fin dropped; glass part, fin taller than its host, pipeline piece, 2 m bay and infill
kept; byte-identity) and three named sites. Each named site pins the exact list of dropped ids on the published
tile.

- **IJdok** 8414/5383: drops only `w1088847358`. The glass parts 352/353 and the interpenetrating 542/546/547 stay.
- **NDSM/Buiksloterham** 8414/5382 (4.89275, 52.40212): drops `w1038324511`, `w1193318910` and `w1193318911`. The
  last two are 0–42 m fins on the east front.
- **Overhoeks** 8415/5383 (4.90284, 52.38416): 26 drops, including the 0–23 m fins `w1207525451`/`452`, the
  `building:part=roof` lips `w1202249617`… and 1 m BAG sheds.

## 5. Frames

The frames are in `map-recall2-screenshots-a1/buildings/2026-11-10-part-overlap/`. All before/after pairs use the live
tile path with the storybook look; the after frames use a scratch `building-tiles.bundle.js`.

- `pair-ijdok-user.jpg`: the maroon strip is gone and the notch shows the host's white windowed wall. The two blue
  glass boxes remain (see §3). **Partial fix of the user's shot.**
- `pair-noord-w1193318911.jpg`: the dark 42 m slab on the yellow block's east edge is gone, and the facade's windows
  run to the corner. **Better.**
- `pair-overhoeks-w1207525451.jpg`: no visible change from this pose; the fins are out of frame. **Neutral.**
- `interpenetration-…117498-before.png`: the largest interpenetrating BAG pair renders clean, which supports §1.
- Also in the folder: the user's shot, the default-world frame, the isolation frame, the panorama crop and
  `census.json`.

## 6. For the integrator

- Rebuild `npm run build:canal-building-tiles`; it is the only bundle that contains `buildingNesting`.
- Run `npm run world:compile` (the global hash changes, so every cell is recompiled; the cells change only where
  the 191 features are dropped), then `world:verify`.
- No tile, covers or extract rebuild is needed.
- Add the script `"test:building-nesting": "node --import tsx --test src/canalRecall/buildingNesting.test.ts"` and put
  it in `check:canal`.
- Frames spec for reruns: `tests/e2e/part-overlap-frames.spec.ts` (`PART_FRAMES`, `PART_QUERY`, `PART_DROP_IDS`,
  `BUNDLES_DIR`).
- Census: `node --import tsx scripts/audit-part-overlaps.ts --out=<file>`.
- Feedback fc427560: the maroon strip is fixed. The blue boxes are real glass parts drawn as opaque slabs; that is a
  presentation follow-up (glass treatment), and the note should stay in-progress until it is done or the user accepts.
