# Ride review: the Jordaan and the Plantage / Entrepotdok on own ground (2026-10-14)

Two neighbourhoods nobody had ridden on own ground since it became the default. Reviewed the way the user
reviewed the Singelgracht: by riding, then looking at every frame at gallery size (640 px) and again at full
size (1280 × 800) wherever something looked off.

## Method

- `scripts/ride-review-shots.mjs <spec> <outDir>` (port 4525): one seeded ride (`Math.random` pinned, chase view,
  1280 × 800, own ground default, shared frame), then the pose held at a frame every 60 m along each leg, a frame at
  every turn over 25°, a frame 35 m before every routed bridge within 45 m of the leg (looking at it), and named
  landmark frames. Quiz cards stay visible (the HUD check). `DRIVE_S=45` then rides freely with ArrowUp held and
  the quiz left open; `EVAL_JS` leaves a probe on `window.__probe` in `frames.json`; `BUNDLES_DIR` serves old
  bundles for before frames. Specs in `scripts/ride-review/`.
- **Jordaan, bike**: Noordermarkt → Prinsengracht west quay to the Westerkerk (13 frames + 7 bridges), the
  Bloemgracht north quay (8 + 4), the Egelantiersgracht (9 + 4), five landmark frames (Noorderkerk, Westerkerk
  from across and from the north, Westermarkt), and a 45 s free ride with a quiz open.
- **Plantage, boat**: Amstel → Nieuwe Herengracht → Entrepotdok to the Kadijken (32 frames incl. bridges).
  **Bike**: Plantage Middenlaan from the Hortus past the Hollandsche Schouwburg and Artis, Plantage Kerklaan to the
  Entrepotdok (20 + 4 landmark frames).
- `scripts/ride-review/contact.mjs` builds the labelled sheets; `scripts/live-play-compare.mjs` the before/after
  pairs.
- Frame paths in the tables are under `artifacts/ride-review/` (not committed; `PORT=4525 node
  scripts/ride-review-shots.mjs scripts/ride-review/<spec>.json artifacts/ride-review/<dir>` regenerates them:
  `jordaan`, `jordaan-bloem`, `jordaan-trees` from `jordaan.json` with `ONLY`, `jordaan-drive`, `plantage-boat`,
  `plantage-bike`, and the fix specs). The sheets and the before/after pairs are committed.

Capture caveats, checked and not filed: the trees missing on the Noordermarkt and the Westermarkt in the last five
Jordaan frames came from the dev server dying under the run (tile fetches failed); a fresh session that rides away
and back (`trees-return.json`) keeps every tree tile (297 → 385 → 513 → 423 → 338 drawn, nothing pending). The first
Bloemgracht frames stood the bike on the water because the routing extract's Bloemgracht is a two-node chord; the
leg was re-ridden on the OSM way's own nine nodes (`jordaan-bloemgracht.json`).

## Jordaan (bike)

| # | Place (lng, lat, bearing) | What is wrong | Likely cause | Severity | Frame |
|---|---|---|---|---|---|
| J1 | 4.88299, 52.37456, 170 (Prinsengracht by the Westerkerk) | With the Westertoren card open the whole Westerkerk turns orange, walls included; its roofs stay slate | landmark model highlight: the roof-wash pass was given up = +y, which in the shared frame's east/north/up world is north, so north/south walls were washed (hlUp in glTF space [-0.06, 0, -1]) | teaches something false | `jordaan/17-bridge-NieuweWercksbrug.png` — **fixed (fix 2)** |
| J2 | same | After fix 2 the Westerkerk roofs still take the orange small-target wash at 0.42–0.66 alpha while the church fills ~15 % of the frame | highlight marker: the boost is measured on the focus footprint (the Westertoren polygon, share under 2 %), not on the highlighted model | ugly | `fix2-after/03-p19.png` |
| J3 | 4.88437, 52.37641, 182 (Prinsengracht at the Leliegracht) | Riding toward the Westerkerk, its 85 m tower is not in the frame until ~100 m off; the frame's top edge reaches ~120 m of ground ahead | camera: the chase pitch looks down too steeply to show tall landmarks ahead (the model is drawn) | ugly (the best orientation cue in the Jordaan is withheld) | `jordaan/15-bridge-Leliesluis.png`, `jordaan/09-prinsengracht.png` |
| J4 | 4.88513, 52.37724, 209 (Prinsengracht, block toward the Keizersgracht) | Canal-belt and Jordaan block interiors (private gardens) draw as bare sand paving, so every block reads as a public square | own-ground cell: no OSM area there, the `land` colour is the default; nothing knows a block interior is garden | teaches something false | `jordaan/06-prinsengracht.png`, `jordaan/07-prinsengracht.png` |
| J5 | 4.88050, 52.37470, 250 (Bloemgracht) | Most houses at 30–60 m are boxes with flat grey roofs; the Bloemgracht's gables and pitched roofs are missing | streamed tier: 3DBAG massing without recipe faces/roof shapes for these pands (recipe tiles off) | teaches something false | `jordaan-bloem/03-bloemgracht.png` |
| J6 | 4.88292, 52.37433, 191 (Nieuwe-Wercksbrug BRU0063, Raadhuisstraat) | Flat grey slabs lie over the four corners past the abutments, across the quay pavements and the cycle-lane ends | measured deck top: BRU0063 is 17.2 m wide and its deck span [20.2, 53.9] runs ~4–10 m past the water [24.3, 44.3], so the deck-top fill (#8e8a84) covers the land approaches wider than the street bands | ugly | `jordaan/12-prinsengracht.png` |
| J7 | 4.88690, 52.37970, 0 (Noordermarkt) | Small green slabs and a thin white frame float on the square east of the Noorderkerk | OSM playground/pitch areas and furniture drawn as raised green plates | minor | `jordaan-trees/46-noordermarkt-square.png` |
| J8 | 4.88464, 52.37671, 264 (Pansemertbrug BRU0124, Egelantiersgracht mouth) | From above, the Prinsengracht quay seems to run straight over the Egelantiersgracht mouth: the canal looks closed | measured steel deck 8.4 m wide flush with the quay; the water polygon does run under it (probed: every station over the water span is inside the polygon); the fascia is invisible from the chase camera | minor | `jordaan/32-egelantiers.png` |

Checked and cleared: Noorderkerk (Greek-cross model, right), Westerkerk present and recognisable, Homomonument
present; Prinsengracht/Bloemgracht/Egelantiersgracht arch bridges with lamps and railings meeting their quays;
houseboats sit in their berths (none under the quay); klinker quays and the Raadhuisstraat paint (give-way teeth,
cycle-lane blocks); no trees over the water. HUD: during the free ride a "Which street are you on now?" prompt for
the Prinsengracht stayed open for 45 s; the street is drawn blue on the map but its name appears nowhere on screen
(HUD, cards, map labels) — `jordaan-drive/drive-05.png`.

## Plantage / Entrepotdok (boat and bike)

| # | Place (lng, lat, bearing) | What is wrong | Likely cause | Severity | Frame |
|---|---|---|---|---|---|
| P1 | 4.91378, 52.36862, 120 (Nijlpaardenbrug BRU1907, Entrepotdok) | The bridge is a 10 m leaf floating mid-canal with water between it and both quays; the Kerklaan cycleway stops at each quay edge | bridge kit: the register footprint of a "Beweegbare brug" is the leaf alone, while the OSM bridge way runs 36 m quay to quay; the street mask cut the cycleway everywhere but the leaf | teaches something false | `plantage-boat/20-entrepotdok.png`, `plantage-bike/19-kerklaan.png` — **fixed (fix 1)** |
| P2 | 4.91687, 52.36757, 119 (Entrepotdok, Artis side) | Artis reads as a sand plaza with a few trees and ponds | own-ground cell: the city fetch queried no `tourism=zoo`, so the zoo fell through to the bare `land` colour | teaches something false | `plantage-boat/24-entrepotdok.png`, `plantage-bike/10-middenlaan.png` — **fixed (fix 3)** |
| P3 | 4.91224, 52.36915, 119 (Entrepotdok north quay) | The Entrepotdok warehouses (84 units with gables, hoist beams and pitched roofs) are long dark boxes with flat khaki roofs; dark triangular stubs stand loose behind the roofline | streamed tier massing without recipe faces; the stubs look like gable pieces of a recipe that does not match the massing | teaches something false | `plantage-boat/18-entrepotdok.png`, `plantage-bike/19-kerklaan.png` |
| P4 | 4.90206, 52.36593, 73 (Walter Süskindbrug BRU0237, Amstel / Nieuwe Herengracht) | The white double bascule reads as a thin white wire cube over a narrow grey deck | bridge kit bascule on an unmeasured footprint: portal posts and beam only, no leaf fascia or balance beams visible at this scale | ugly | `plantage-boat/01-nieuweherengracht.png` |
| P5 | 4.91265, 52.36700, 215 (Plantage Kerklaan, Artis main gate) | The Artis gate (the pillars with the eagles and "ARTIS") is not there; the card for Artis opens over an ordinary street | landmark model missing | minor | `plantage-bike/22-artis-gate.png` |
| P6 | 4.91202, 52.36631, 113 (Hollandsche Schouwburg) | Nothing marks the Hollandsche Schouwburg: its white facade is an ordinary terrace front while its card is open | landmark model missing (recipe or GLB) | minor | `plantage-bike/07-middenlaan.png` |
| P7 | 4.91434, 52.36553, 120 (Plantage Middenlaan, south side) | Large dark-brown masses with flat brown roofs and windowless upper volumes across from Artis | streamed tier: 3DBAG massing, facade cells only on the lower volume; dark material | ugly | `plantage-bike/10-middenlaan.png` |
| P8 | 4.91310, 52.36810, 34 (Plantage Kerklaan at the Entrepotdok) | A pale facade ripples like a curtain along its whole length | streamed tier facade draped on a densely noded curved footprint (to confirm against the photo: the building may be curved, not rippled) | minor | `plantage-bike/19-kerklaan.png` |
| P9 | 4.91400, 52.36820, 34 (Mahatma Gandhiplantsoen, OSM w1210813975) | The small lawn stands on a dark-green box ~1 m high, a plinth rather than a hedge-edged lawn | parks-v1 hedge drawn round the whole lawn as a solid box | minor | `plantage-bike/19-kerklaan.png` |

Checked and cleared: Hortus Drie-klimatenkas and palm house present and glazed; Artis planetarium (round, white
dome) and aquarium present; Wertheimpark and Hortus paths; the grey striped rectangle inside Artis is the real
parking lot (`amenity=parking` with parking aisles); Nieuwe Herengracht bascule portals over their leaves; quay
walls and houseboats along the Entrepotdok and the Nieuwe Herengracht; HUD shows no street names.

## The three fixes

### Fix 1 — movable leaves get their fixed spans (P1)

`decks.ts movableApproaches(ring, ways)`: every OSM bridge way that meets a movable footprint (a vertex in it or
a segment crossing its outline) is projected on the footprint's crossing axis; where it reaches past the leaf, a
rectangle as wide as the leaf continues it to the way's end (at most `APPROACH_MAX_M` = 30 m a side, 5 cm overlap).
`GroundStore.cellInput` adds those spans as flat (non-movable) decks of the cell and to the deck rings that the
street mask exempts, so the kit draws deck, fascia and railings and the cycleway band crosses with it; the portal
stays on the leaf. Option `approaches: false` switches it off.

- Unit test (`test:own-ground`): a 10 × 4 m leaf with a quay-to-quay way gets two spans to the way's ends; a way
  ending on the leaf or missing it adds nothing; the cap holds.
- Named regression (`check:own-ground-cells`): **BRU1907 Nijlpaardenbrug**, OSM way 31485502 — at 0.2/0.3/0.7/0.8 of
  the way a deck top and an uncut cycle band (`deck+band` ×4); without the approaches none (`-` ×4).
- Frames: `docs/images/ride-review-20261014/fix1-nijlpaardenbrug-boat.jpg`, `fix1-nijlpaardenbrug-bike.jpg`.

### Fix 2 — the landmark roof wash reads the frame's up (J1)

The landmark layer passed up = +y to the highlight passes in every frame. That is right for both legacy layers
(a per-model scene in glTF space; the batched scene's `anchorWorldFromMercator` sends altitude to +y) and wrong in
the shared frame, whose world is east/north/up metres. `LANDMARK_WORLD_UP` (`look/highlight.ts`) names both;
`signature-landmarks-source.js` picks by frame. Measured in the page at the Westerkerk: hlUp [-0.056, 0, -0.998]
before, [0, 1, 0] after.

- Test (`test:look`): the shared chain (Mercator→ENU root, the landmark holder's translate·scale·rotZ·rotX(π/2),
  a glTF mesh at the Westerkerk's own scale 43.5) gives glTF +y as up; with +y passed instead, up is horizontal.
- Frames: `docs/images/ride-review-20261014/fix2-westerkerk-highlight.jpg`.

### Fix 3 — zoos are green, and green fills hide the land (P2)

`areaKind` maps `tourism=zoo` to `park` and `fetch-osm-ground.ts` queries it; `scripts/own-ground/add-zoo-areas.ts`
(osmium from the cached Amsterdam extract, the allotments' pattern, dry run then `--write`) added 16 zoo polygons
(Artis and 15 petting farms, 19.8 ha) to 15 published cells. The green then showed the next flaw: an OSM fill
drapes at 8 m between vertices on the 5 m land grid's surface, so in hollows the land poked through (14 % of
Artis, 54 % of its west third, which lies in the next cell). `groundCell` now drops land quads wholly inside a
park-class area of the cell or its neighbours (nine probes per quad; never where a BGT park surface replaced the
fill). The parks frames (Wertheimpark, Hortus) are unchanged.

- Named regression (`check:own-ground-cells`): **a8733446 Artis** — 72 probes inside the outline: 3 % bare land
  (2 % own cell, 8 % neighbour); with the area dropped 53 %.
- Frames: `docs/images/ride-review-20261014/fix3-artis-entrepotdok.jpg`, `fix3-artis-middenlaan.jpg`.

## Contact sheets

- `docs/images/ride-review-20261014/jordaan-contact.jpg` (16 frames, 380 KB)
- `docs/images/ride-review-20261014/plantage-contact.jpg` (16 frames, 322 KB)

## Verification

`npm run lint`; `npm run test:own-ground` 71/71; `npm run test:canal-elevation` 11/11; `npm run test:look` 59/59
(one of them new); `npm run check:own-ground-cells` 0 FAIL including BRU1907 and a8733446. Bundles rebuilt with their
sources: `own-ground-worker`, `own-ground-game` (fix 1), `signature-landmarks` (fix 2), `own-ground-worker` (fix 3).
