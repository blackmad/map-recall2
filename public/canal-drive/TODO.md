# Canal Recall — what is left

The work board. Everything finished lives in `HISTORY.md`; this file is only
things that are not done. Keep it current in the same change that moves an
item, not afterwards.

Ordered by one rule: **a learning game that teaches the wrong thing is broken
in a way that a plain-looking one is not.** So correctness of what the game
teaches outranks the depth of what it teaches, which outranks how it looks.
Within a tier, cheap-and-blocking comes before expensive-and-isolated.

Building / façade / 3D mesh work is owned by other agents — do not queue it
here. Their design notes stay in `BUILDING_*.md`, `FACADE_*.md`, `LOD.md`, and
`HISTORY.md`.

---

## Takeover board (2026-10-09) — active

Root `main` was cleaned on 2026-10-09 (see HISTORY). Live work, in order:

- **UvA Roeterseiland held**: builder simplified 37.2k → 21.9k tris but not
  installed — its spec says `do-not-suppress` (composite BAG parent not
  partitioned; bridge underside height estimated). Needs a suppression
  scope decision, then a check against the Tim Soar photos.
- **Landmark polish from contact sheets**: This is Holland sign is thin and
  its panels too regular; Luther Museum roof uniformly dark, frames should be
  pale; Frankendael roof should read as tile; Nieuwendammerkerk nave roof
  reads khaki not red tile; Posthoornkerk is 39k tris (cap 40k) — reduce.
- **Held landmarks (`status: "held"`, out of game/galleries/What's new)**:
  Torture Museum (attached now, but sign/shopfront only suggested), Pathé de
  Munt (rebuilt twice; awaiting the user's call on
  `artifacts/landmark-lanes/pathe-de-munt/contact.png`; audit: 40 open shell
  loops), Sint-Petrus-en-Pauluskerk (tower/gable wrong, dark), Maarten
  Lutherkerk (3DBAG tower the photo lacks), Oudemanhuispoort and Levend
  Paardenmuseum (bare massing), Koningskerk (curved grid hall missing),
  Compagnietheater (faint wing windows, too brown), Haparandaweg 65,
  650–706, 708–744, 788–868 (unreviewed/weak), mediamatic. Integrator views
  every contact sheet before un-holding; run `npm run audit:glb -- --id=<id>`
  and `scripts/check-landmark-attachment.ts`.
  Gerard Dou Synagogue: side/rear walls open (audit: 7/30 see-through rays).
- **Facade gate follow-ups (2026-10-10)**: Royal Palace, De Balie and the
  Concertgebouw entrance were reworked and installed. Still open: the Palace's
  N and S fronts are blank (audit blank-wall FAIL, 45 x 25 m each); De Balie's
  front is straight where the real one is bowed; Concertgebouw has 151 open
  loops and 24/42 see-through rays from its glass promenade. Aron Schuster
  synagogue installed after rework; its rounded corner is still squared.
- **Lanes cut off by the usage limit (2026-10-10)**, resume from their branches:
  audit see-through now back to FAIL on real gaps: adam-tower, de-gooyer,
  haarlemmermeerstation, hart-museum, huis-bartolotti, pulitzer-amsterdam
  (footprint-edge rays; check each against photos).
  American Hotel held (2026-10-10, after one rework): colour, SE axes and
  clock-tower cap are fixed; the roofline is still plain 3DBAG planes where
  the real hotel has its cluster of ornate gables, dormer towers and
  pinnacles. Leaf-off panorama frames: scripts/landmarks/panolist.mjs.
  Krasnapolsky held (2026-10-10): old Dam front matches; the modern wing and
  lower brick building need photo counts and the dark glass bays.
  Chassékerk held (2026-10-10): towers must be tall and slender, well above
  the gable (they are stubby belfries); SE wing is a flat box.
  Pakhuis de Zwijger held (2026-10-10): colour fixed (dark weathered brick,
  rust strips). Specs can now declare `throughPassages` (corridor + axis +
  evidence); its Piet Heinkade roadway is declared. Still FAILs see-through
  10/61: 4 oblique pier-edge rays inside the corridor (bearings 17–40° off
  axis) and 6 at the east pilotis, where the glazed ground floor sits ~7 m
  behind the pier line, beyond the 7 m reach. Needs a tested rule for a deep
  recess under a LOW soffit, not wider tolerances.
  De Nederlandsche Bank held (2026-10-10): the 1990 Abma round tower is
  demolished (Mecanoo renovation 2025); the 3DBAG link core on the tower's
  west face probably belonged to it and shows as a blank fin. Confirm with a
  2025 west-side photo, drop it, fix tower proportions, then blind-count.
  Bloemgrachtkerk (tower removed 2019, redevelopment) and Gemaal
  Mercatorstraat (tiny kiosk) skipped.
  World Trade Center Amsterdam held (2026-10-10): towers A–G are ONE BAG
  pand (0363100012096613, ~200 x 95 m); a recognizable model needs a photo
  of each tower face (Commons has only atrium/logo/tower H). Footprints and
  research are in scripts/landmarks/world-trade-center-amsterdam-*.json;
  needs a panorama pass per tower before modelling.
  Full audit with the new rules (2026-10-10, 259 models): 88 pass, 171 fail;
  vs the pre-change baseline 16 FAIL→PASS (two spot-checked visually: no
  holes) and 2 PASS→FAIL: concertgebouw (canopy restored to its real depth)
  and haparandaweg-902-950 (passes again since the deep-cornice rule).
  Elevation skeletons with photos exist for 25 landmarks
  (`scripts/landmarks/*-elevations.json`, photos in `artifacts/landmark-lanes/`);
  counts are not filled: Haiku blind counts were too noisy — use a stronger
  counter or rectified `pand-reference` crops. `check-manual-landmarks.ts`
  fails on main: eight Haparandaweg manifest entries have no `bytes`.
  Lane runs of `archive-model-sources.py` into the private repo are sometimes
  denied by the auto-mode classifier; refs for vrijburg, van-gendt-hallen and
  the 25 elevation photos are not archived yet.
- **GLB quality audit** (`npm run audit:glb`, `src/canalRecall/landmarks/glbQuality.ts`,
  2026-10-09): 184 of 236 installed models flag at least one FAIL (detached
  124, see-through 84, holes 61, far-outside 32). Detached-part detection is
  noisy (recessed glazing vs floating facade is geometry-ambiguous) — keep it
  a warning for installs and hard-fail holes/see-through/far-outside. Worst
  15: de-bijenkorf, oude-kerk, beta-boulders, fire-station-willem,
  mountain-network, centraal-station, rai-amsterdam, westerkerk, valley,
  lab111, vredeskerk, scheepvaarthuis, dominicuskerk, magna-plaza,
  madame-tussauds — review their contact images before fixing. Het Pakhuis
  (live) has rear-step wall gaps in its 3DBAG shell. Ordinary set not audited.
- **Intro/landmark streaming follow-ups (2026-10-09)**: the flight still runs
  ~4.0 s vs 3.5 s designed (MapLibre intermediate-zoom tiles + three chunk
  installs, ~0.47 s long tasks). 25–40 landmark models load during the spawn
  settle because the pitched chase view's bounds reach the horizon — cap
  `_nearby` by distance or make it pitch-aware. `setActiveLandmark(null)` fires
  ~every 100 ms while riding, each with a GeoJSON `setData` — find the caller.
  `scripts/check-building-look-transition.ts` fails on main
  (`chunks.get(first.key).mesh` undefined) and is not in check:canal.
- **Shared material textures (user, 2026-10-09)**: models are flat-shaded
  colour only, so brick and roofs read as plastic. Add one shared tiling set
  (brick bonds, roof tile, slate, stone, timber, glass) at 256–512 px with
  mipmaps; the building compiler/kits emit box-projected UVs; distant LOD
  keeps flat colour. Not per-building photo textures.
- **Canal house reuse (user, 2026-10-09)**: identical/near-identical houses
  should share one mesh (canonical recipe hash + dimension tolerance) and a
  `sameAs`+overrides recipe for neighbours; runtime instancing follows.
  Measured (massing only, `scripts/analysis/canal-belt-reuse.ts`, canal-belt
  core, ~10k houses): 13% have an adjoining near-twin (574 runs, longest 8),
  so shared meshes save ~8%; 67% share a coarse family signature, so the
  real win is drafting from the nearest done house, not GPU memory.
  Long 19th-century rows (Marnixstraat, user Street View 2026-10-09) repeat
  one module inside a single 30–60 m BAG parent, which that measure excludes:
  recipes need `repeat` along a frontage, compiled once and instanced. Build
  on the installed Marnixstraat pilot (`repeatedTerraceRoof.ts`).
- **Perf cycle**: landmark layer renders one `THREE.Scene` per model with a
  `getBounds()` per entry per frame, no frustum cull, no eviction
  (`signature-landmarks-source.js`). Re-baseline against
  `docs/performance/2026-10-06/` first.
- **Recipe pipeline next steps** (pipeline on main, see HISTORY 2026-10-09):
  runtime instancing in the ordinary layer from `instances.json`; install a
  first recipe street; components for stepped/neck crowns, brick banding,
  pilasters, ribbon windows, shutters; stoops on every repeated module;
  Haiku/Sonnet drafting from the pand-reference feed (all recipes so far were
  written by the lane agent); `kind: "large"` tier.
  Tiers (user, 2026-10-09; landmarks will reach ~1,000): base (every
  building: 3DBAG LoD2.2 + era facade grammar) → house recipe (row/canal
  houses, ≤15 min, ≤3k tris) → **large building** (schools, blocks,
  warehouses, offices, most landmarks: keep 3DBAG massing, recipe picks a
  facade system per wall plus entrance/signage/roof plant, ~20–30 min, ≤12k
  tris) → icon (~100 bespoke builders).
- **Continuous fan-out (user, 2026-10-09)**: landmark lanes pull from the
  `pending` ("Needs work") list on `landmark-queue.html`; integrator merges,
  reviews contact sheets, batch-deploys and relaunches. In flight: museums2,
  worship, civic lanes; pand-reference feed (ordinary); recipe pipeline.
  Next: triage the ~80 `review` items into building / splat / area, and a
  discovery pass (Arcam guide, monument register) to grow toward ~1,000.
  When buildings run out: notable businesses and restaurants (user).
- **Sculptures and statues → splats/impostors (user, 2026-10-09)**: De
  Dokwerker, Vondel-, Rembrandt- and Wilhelmina-monuments etc. are not boxes.
  38 are now `treatment: sculpture` in the backlog (filter "Sculpture (splat)"
  on `landmark-queue.html`; list in `build-poi-backlog.ts`), incl. Mama
  Baranka; De Dokwerker's hand-built model should be replaced first.
  Capture a multi-image Gaussian splat (or photogrammetry mesh) from Commons
  photos + panorama crops; render the splat only within ~50 m and a baked
  8–16-view impostor beyond. Start from `docs/landmark-splat-reference-pilot.md`.
- **Docs compaction**: ~135 markdown files across root, `docs/` and here.
- `scripts/check-cinema-facade-surfaces.ts` fails on main (32 front pane
  triangles, expects 24); not in `check:canal`.
- Street-appearance fingerprints (`public/data/street-appearance/*.json`)
  hash an older `signature-landmarks.json`; re-bake rather than hand-edit.
- `/private/tmp/canal-heren208-author40` holds an uncommitted Herengracht 208
  ordinary draft. 27 merged+clean worktrees were removed 2026-10-09 (disk hit
  100%); 87 remain (38 merged-but-dirty 24 GB, 49 unmerged 96 GB) — triage
  each before removing.
- **Perf findings (2026-10-09 baseline, `tests/e2e/ride-perf.spec.ts`,
  iphone 4x throttle):** steady ride holds 16.7 ms median, p99 33 ms. Landmark
  layer costs only 0.1–0.8 ms/frame even with 250 models resident. The game
  calls `jumpTo` every frame, so `moveend` fires every frame: ~4.5 ms/frame of
  handlers, led by inventory trees rebuilding (`inventory-trees-source.js`),
  then road labels (`road-network.js` `drawLabels`). Gate those on real view
  change.
- **Unmerged landmark lanes awaiting rework (2026-10-09)**: integrator
  viewed all 9 sheets; none installed. `landmark/historic-20261009c`
  (Bellevue, West India House, West Indian Warehouse, Compagnietheater,
  Rijksakademie, KIT) and `landmark/nightlife-20261009c` (Sea Palace,
  Club Panama, Toekomstmuziek) are 3DBAG shells + generic windows missing
  each building's signature (Bellevue lettering, pagoda upswept roofs,
  PANAMA sign, KIT tower stages). Closest to the bar: Club Panama,
  Compagnietheater, West India House. Koningskerk held for its grid hall.
- **Sculptures** (38 in the backlog's sculpture treatment): splats only where
  30–60 recent multi-angle colour photos exist (mask the statue; auto-find
  centre/ground; ~1 h per statue); otherwise impostors baked from a clean
  mesh, with nearest-tile switching (blending doubles the figure). Untested
  alternative: single-photo image-to-3D mesh generation, then decimate.
  The Dokwerker hand model has wrong arms and a hat disc — fix as far LOD.
  Needs a real-iPhone GPU check before any splat ships.
- **Destination memory follow-ups**: recent destinations are per device
  (localStorage) — sync them with the signed-in recall store; confirm the
  review-ride repeat with a real due backlog (only the filter is tested).
- **Renderer: give three.js the frame** (`docs/research/own-renderer-spike-20261009.md`,
  `renderer-spike.html`): spike shows lighting is the visible gap — shadows,
  sky, fog, tone mapping, sunken water — at ~2.6 ms CPU per throttled phone
  frame vs 7.1 ms for MapLibre's render. Phase 1 (days, reversible): merge
  the ~dozen three.js layers into one shared lit frame with shadows inside
  MapLibre. Phase 2–3 (4–6 weeks, flagged, after a real-iPhone GPU test):
  three.js owns ground, overlays, labels and camera; MapLibre only for
  minimap/overview, dropping the live OpenFreeMap dependency. Gaps: no road
  widths/sidewalks in our extracts (centrelines only), humped bridges render
  as grey slabs, no route line/labels/HUD in the spike.
- **Haparandaweg held/skipped**: 952-1002 rebuilt but held — grey
  neighbour building needs its light-grey framed grid, SE/NE faces plain;
  746-786 rebuilt, held for user review of its sheet; 870-900 NE side still
  dark glass, unverified. Review 65 (needs the terracotta upper volume),
  650–706 (paired casements, stone bands), 708–744, 788–868 (glass bays);
  retry 940–950 with another photo source; 582–648 after scaffolding. The
  street sheet framing was poor (bike drawn over a roof) — reshoot.
- **Audit see-through test is hull-limited**: cast rays fully through the
  bbox (or from outside the footprint) in `glbQuality.ts`; today concave
  footprints flag false holes. Madame Tussauds has small roof-junction gaps.
- **De Wallen next**: OZA 41–57 installed. Next — an Oudezijds Voorburgwal
  face with a hand-picked capture date (2021 panoramas rectify badly);
  lean from a non-rectified photo; adopt crownGroups/tower/split fronts on
  Bilderdijkstraat 102–106, 149–151, 88–90, 162443, 236022, 236189; reviewer
  row counts confuse mezzanines and arcade bays with storeys (177922/23/43/46).
- **Bilderdijkstraat faces**: even side 72–166 installed. Held: 113–115,
  131–133, 135–153 — need a way to override 3DBAG eaves >2.5 m from the photo
  cornice (dormer/tower read as eaves). Not yet faces: chunk-bilder-079721-x2,
  chunk-bilder-152363-x2, standalone 153622/153782/154127; 66–70 (pand
  167348); 155–167 and 169 are large-tier. Library gaps (several houses per
  pand, multiple gables per front, towers, triple gable windows) are on the
  historic-library lane. iPhone e2e street shots frame a single shop window —
  move the camera back.
- **Inferred rears**: the rear window grid is generic (2.5 m pitch); use rear
  photos (`pand-reference --prefer-bearing`) where they exist. Raw audit still
  reports party-wall "holes" on several faces (exempted by the compile).
- **Block faces next** (`docs/buildings-pipeline.md` "Block-face authoring";
  now the default unit for attached ordinary buildings): schema for per-bay
  widths and off-centre gables (081118, 156286, Utrechtse 76), a shopfront
  that must not cover a residential entrance bay (157650), two-storey
  shopfronts (Concerto), white stucco reads beige under the recipe look;
  facade-compare gable count is unreliable on chunk spans; small/faint signs
  (KROM, TUI); 087959 strip vs proposal disagree on the ground-floor panes.
  Re-author the rest of Bilderdijkstraat (24 pands on that face) as faces.
- **Street chunk fallback**: if a chunk GLB fails to load, its houses are
  already out of the model list and the OSM extrusion shows; restore the
  per-house specs on failure. Demo page stats table scrolls sideways on phone.
- **Review harness follow-ups**: `review-sheet.ts` needs ordinary-house
  support (no catalogue entry/anchor) before Bilderdijkstraat re-review; ground
  NAP offset not applied to the matched camera; record party-wall bearings per
  model so blank-wall warns become signal; triage the 34 ≥600 m² blank walls
  (Viñoly, The Rock, DeLaMar, Palace on the Dam first).
- **Re-review the 19 Bilderdijkstraat recipe houses** under the new
  acceptance checklist: bilder-156287 has 4 upper storeys and small 4-pane
  windows where the photo shows 3 storeys + gable, large 1-over-1 windows,
  middle-bay balconies, brick relieving arches and a 3-window gable. They
  were accepted on overall resemblance. Run facade-compare on each.
  Surround/awning evidence still open: Toko Persama (bilder-157154) awning
  ambiguous; quoins, full-frame and dutch awnings have no house yet.
- **Recipe houses next**: shop-sign lettering, patterned banding,
  per-house brick variation; fix `check-host-opening-availability` mock
  (needs `SharedAssetCache`); street chunks are piloted (opt-in `?streetChunks=1`, see HISTORY); next
  apply the shared ground line + eaves snap to the per-house path and re-run
  the fidelity gates on shifted facts.
- **Large-tier follow-ups** (`src/canalRecall/largeBuildingTier.ts`,
  ranked list via `npm run audit:large-tier`): untuned buildings show a
  uniform window grid; tune next Roeterseiland/LLC, VU, Benno Premselahuis,
  IJ-toren; roof shapes for tuned entries (Nyenrode's mansard); per-wall
  front vs blind walls; Nyenrode shows a Jumbo shopfront its panorama does
  not support — shopfront assignment can contradict photos.
- **Pand reference feed follow-ups** (`npm run pand-reference`, merged
  2026-10-09): street trees hide whole canal fronts in every year (Bloemgracht
  3/7 unusable) — add a third laterally offset panorama or the per-pixel median
  fusion from `build-pano-facade.ts`; washed-out/foliage thresholds (0.3) are
  untuned; `roofShape` is null outside `buildings-colored.geojson`; Beeldbank
  and monument-register facts are not yet joined in.
- **Drop MapLibre** — lives on its own long-lived branch
  `render/drop-maplibre-step1-20261010` (own worktree), merging main in;
  not merged to main until ready (user, 2026-10-10). (go; ~3–4 weeks after city-wide own ground;
  `docs/research/drop-maplibre-20261010.md` §6, prototype `no-maplibre.html`):
  overview/route preview/street labels from our own extracts match the game's
  MapLibre cameras within 1.1–3.2 px; iPhone 4× 5.8 ms frame CPU. Remaining:
  wire `ownMap` into the game behind a flag, ferry/transit/neighbourhood
  overlays, brand icons, roofline POI labels, answered-street lettering; rail,
  tram, footways, landuse, piers missing from extracts; Utrecht/Rotterdam/Den
  Haag need extracts; footprint tiles to a worker; the Leaflet map picker
  (`map-picker.js:243`) also loads live OSM tiles — replace it too.
- **Own ground in game behind `?ownGround=1`** (area `west`: canal belt,
  Jordaan, Oud-West, Westerpark): next — run the city-wide relief + OSM ground
  builds; draw partly covered edge cells (16 of 39 cells fully covered); BGT
  road widths (only 2,459 of 15,583 ways tag a width); per-building bases for
  street chunks; landmark kits in facade chunks, tram and ferry still at
  street level; polder water levels; stair-stepped water edges on phone (1 m
  mask); BRU0067 deck top shows deck grey; destination pin projects at z=0;
  labels still MapLibre symbol layers; measure GPU on a real iPhone; decide
  default-on. Cost: +1.7 ms map render per frame (iPhone 4×), vsync-bound.
- **Elevation follow-ups** (`?elevation=1`, `docs/elevation.md`): no AHN
  ground relief; one water level everywhere (polders, IJ shore get the same
  quay wall); route line hidden on humped decks and ramps paint over ~20 m of
  street; boats below street level not clipped at steep angles (boat mode not
  reviewed); relies on MapLibre private stencil fields; no settings toggle —
  decide default-on after a review drive.
- **Bridge register gaps**: `bridges.json` has 300 bridges; 611 named bridge
  ways (≈112 "brug"/"sluis", e.g. Noordsche Compagniebrug) get a street
  question instead of a bridge question.
- **P2: audit every installed GLB for holes** (open edges, missing faces,
  flipped normals) with a batch mesh check over `public/canal-drive/models/`;
  user has seen visible holes.

---

## P0 — Red, or actively teaching something false

*Anything that makes the game teach something false, or traps the rider,
belongs here before anything below it.*

**Bridges: one sweep artefact left; extend the sweep to non-bridge seams.**
After the union guard and the union-aware shoulder (see HISTORY, 2026-10-01),
the full sweep (`BRIDGE_SWEEP_ALL=1`) drives 3,006 crossings with 2,875
arrivals and 0 traps. Its only wedges (14 frames in 2 drives) are Burgemeester
Fockstraat (`routing_11260` F, `routing_13031` R). The sweep starts inside the
Menno ter Braakstraat cul-de-sac, which raw OSM joins to Burgemeester van
Tienhovengracht only by footway + steps (excluded on purpose). Next:
- Seams are not only at bridges: run the same "step toward any road is kept"
  probe across ordinary junctions where a path ends a few metres from a street.

Measured and dropped: a junction disc at every graph node (closed no extra
case, and the ~150k extra spans made the harness time out), and stopping the
heading ease from turning against the rider's steering (wedges rose to 71).
Snap skips remain: 482 `noSnap`, 70 `noRoute`, 1,276 `missesDeck`.

---

## P1 — The learning model itself

**Handoff 2026-10-02 — Map Recall neighbourhood cards, Utrecht and Rotterdam.** `WIKIMEDIA_TOKEN` now reaches wikipedia, wikidata and commons hosts (checked 18:56 UTC: each answers as user Whizziwig). Every response `fill-neighborhood-gaps.ts` fetches is kept in the durable scrape store (`scripts/lib/scrapeStore.ts`; `/mnt/project-files/scrape-store/` in cloud sessions), so reruns and new sessions ask Wikimedia only for what is missing.
- *Utrecht and Rotterdam text:* published 2026-10-02 (see HISTORY). Coverage now Utrecht description 111/135, history 105, name origin 24, photo 87; Rotterdam 106/128, 81, 39, 88. Still open: name origins are the thinnest field in both cities (no street-name register for them yet); 38 Dutch fields were rejected as junk and 73 geosearch photos rejected, so those areas wait for better sources; review both cities on `/?gallery=cards&city=X` before relying on them. Rerunning `online` costs nothing for answered requests (scrape store).
- *Photos:* `fetch-place-photos.ts` and `fetch-area-photos.ts` done for all four cities (2026-10-02). Postcards (2+ area photos) measured in the card gallery: Amsterdam and Den Haag every card, Utrecht all but Strijkviertel, Rotterdam missing 15 (Burgen, De Vaan, Het Zuiderhof, Hoeken, Hof van Eden, Horsten, Kampen, Landbouwbuurt, Molièrebuurt, Pascalkwartier, Smeetsland, Sportdorp, Steinen, Veld van Klanken, Voordes/Rodes): Commons has almost no geotagged photos there, so these need another source (e.g. a Commons category or Wikidata image) rather than a wider search. Area photos rebuild offline from the Commons DB (`--offline`, see HISTORY).
- *Review page:* `/?gallery=cards&city=X` on the Map Recall site (edumap-blackmad.web.app) lists every card with gap flags; use it to review each city before merging. Postcard needs two or more photos per area. (It crashed for every city but Amsterdam until 2026-10-02: it looked cities up in the game's `CITIES`.)
- *Open:* Houthaven islands' themes beyond Wiborg/Reval/Memel (image-quality plan not found); Amsterdam histories still missing for Westindische Buurt, IJselbuurt, Van Galenbuurt, Polder Meerzicht; Canal Recall difficulty is separate from the new Map Recall Easy/Medium/Hard (place clues are easy/medium only).

**Delight loop (thin slice shipped 2026-09-06).** Mission punchlines, finish
knowledge story, place-day streak, passport stamps, know-this-corner wink,
correct-only encyclopedia. Cold-open review is **disabled** (2026-09-07) until
a due name is on/near the route or shown (highlight/camera) — see HISTORY.
Still open: rival-route novelty bias, landmark scavenger stop-to-look,
transfer dares, Dutch plaque hard mode, shareable blank silhouette routes,
weather/time mood. Cold-open is superseded by review rides (see HISTORY,
2026-09-30).

**Local-knowledge facts beyond Amsterdam (data lane).** Amsterdam's 57
approved local facts are published (`localFact`, the card's lead line; see
HISTORY). Open: run `npm run mine:area-facts -- --city utrecht|rotterdam|den-haag`,
draft cited picks into `scripts/data/area-fact-review-<city>.json`, review,
`publish`; 32 Amsterdam areas still have none (14 without any article); nine
Amsterdam picks are boroughs/Gouden Bocht the quiz does not ask yet;
`sentencesOf` splits after initials ("A.J. Ernststraat").

**Neighbourhood trivia gaps (pipeline built 2026-10-02, data lane).**
`npm run fill:neighborhood-gaps -- audit|offline|online|publish` fills missing
description, history, name origin and photo for Amsterdam areas into
`staging/gap-fill/` (report in `report.md`), then `publish` adds reviewed ones.
Offline stages (alias siblings, street-name matches, street themes, text composed
from what lies inside the outline) ran in the cloud container; the online stage
(Wikidata, nl/en Wikipedia articles and mentions, Commons photos) needs
`NODE_USE_ENV_PROXY=1` there and is rate-limited by Wikimedia on shared IPs
(about 1 request per second; the script paces itself). Still to do: translation
pass for Dutch candidates (write English into
`scripts/data/neighborhood-gap-review.json`), review of low-confidence
candidates, the duplicate Nieuwmarkt/Lastage outline, and the same pipeline for
Utrecht, Rotterdam and Den Haag (they have boundaries only, no street-name
register or landmark extracts to compose from).

**Randstad trivia parity (in progress, data lane).** Utrecht, Rotterdam and
Den Haag have no name origins, neighbourhood photos/history, and (Rotterdam,
Den Haag) no street encyclopedia text. Same rules as Amsterdam: sourced only,
Dutch reviewed before it ships. Map Recall also still reads only the Amsterdam
extract; other cities fall back to live OSM.

**Municipal trees and park landscape (2026-10-03).** Amsterdam now streams
311,544 trees in 454 z15 tiles (5.35 MB compressed): 302,404 standing municipal
records and 9,140 deduplicated explicit OSM tree nodes.
Species/cultivar priors, height classes and explicit pruning records drive
varied crowns, conifers, trunks and branch forks. Positions are inventory
locations; crown width/shape remain approximations. The main landscape contains
10,771 mapped features across 51 park/site selections; Amsterdamse Bos adds an
optional, locally streamed 3,254-feature chunk. Sixteen crown forms include
recorded palms. The visible Trees setting honors its saved preference in all
four views; fresh desktop and mobile views show inventory trees by default. Review at `park-landscape.html`.
Open: real-device Safari/phone performance and more verified cultivar priors.
Other cities retain the OSM tree fallback.

**Facades experiment follow-ups (merged 2026-10-02).** Facades shimmer on steep walls in phone cockpit (no mipmaps; use a
coarser image set at high pitch). Tiles rebuild at each integer zoom crossing,
a hitch not yet measured. The ground floor repeats above 32 m except on
towers. Facades are Amsterdam-only, and walls take a period palette colour.
Check on a real device.

**Three.js facade layer (now a setting: Building look).** Open: measure geometry cost now that roofs, cornices and shops add vertices (and consider a distance cutoff for cornice and chimney geometry); roof coverage now uses the largest inscribed rectangle plus one wing (2026-10-02), so truly round or courtyard footprints still keep a lid or a parapet, and rows of narrow hipped/mansardHip houses read as separate roofs rather than one; roofs added 35-42% walls-chunk triangles (canal belt 492k to 665k), unmeasured on a phone; check Safari and a real phone (the user saw broken roofs in Safari photo mode, not reproduced in Chromium; ask whether Default look has roofs there); flat lids now come from the three.js mesh in a neutral grey or the mapped roof colour, not per look yet; buildings without a facade (no palette prior and no OSM colour, e.g. r3674348 by Bilderdijkpark) now draw as bare three.js walls but still deserve a generic facade; measure GPU frame time on a real phone now that the three layer draws every building (chunk builds are in a worker); the 32-layer bay set drops attic and tall-first-floor bays; measure on a real
phone (heap is now below the pattern layer in software GL; geometry still
42-63 MB: pack vertices, prune by distance); a shimmer metric that works (the
current one is noisy and shows no win);
look at the photo look; gables and roofs are still MapLibre's; decide whether
it replaces the pattern layer or stays opt-in. Two layout modules now exist
(`wallBays.ts`, `facadeLayout.ts`): keep one.

**Landmark kits: more landmarks, and a phone check.** Thirteen are done (see HISTORY), Carré and Fatih with windows (opt-in `windows` on halls), and seven museums and cinemas (`museumKits.ts`).

**Original landmark model queue (2026-10-03).** `landmark-backlog.json` tracks
the actual POI Destinations pool plus explicitly requested additions. Refresh
with `node --import tsx scripts/landmarks/build-poi-backlog.ts`; it applies the
same teachable-content gate, four-kilometre radius and prominence ordering as
the game. Browse/filter the queue at `landmark-queue.html`. Existing procedural kits and imported gallery references are marked
separately from original models. Arcam's architecture guide is the discovery
source for further notable buildings. The queue also distinguishes districts,
complexes and memorials; check the mapped site before choosing a building model.

Original models now cover Centraal, Muziekgebouw/Bimhuis, both OLVGs, Van Gogh,
Stedelijk, OBA Oosterdok, A’DAM Tower, Pontsteiger, REM, Paradiso, Melkweg,
Silodam, Embassy of the Free Mind/Huis met de Hoofden, The Movies, DeLaMar and
Magna Plaza, Felix Meritis, De Kleine Komedie, De Balie, Anne Frank House,
Rembrandt House, Moco Museum, Museum Van Loon, Amstelkerk, He Hua Temple,
Haarlemmerpoort, Museum Het Schip, Scheepvaarthuis, Rialto, Kriterion,
De Bijenkorf, Gashouder, Stadsschouwburg, Tuschinski, Pathé City, Oude Kerk and
Nieuwe Kerk, Buiksloterkerk, English Reformed Church, De Papegaai, De Hallen,
Huis Bartolotti, H’ART Museum, Amsterdam Museum, Jewish Museum, Portuguese
Synagogue, Hollandsche Schouwburg, National Holocaust Museum and Homomonument
plus ARTIS Micropia/Ledenlokalen, ARTIS entrance, Hortus greenhouses, Arcam,
Foam, Huis Marseille, Ons’ Lieve Heer op Solder, Brakke Grond, Frascati and
Boom Chicago, Agnietenkapel, LAB111, OCCII, Ketelhuis, Wereldmuseum Amsterdam,
Dutch Resistance Museum, Allard Pierson, Dominicuskerk, Vredeskerk, Badhuistheater,
Cinecenter, Studio/K / Timorplein school, ARTIS Groote Museum and ARTIS Library
plus Willet-Holthuysen, Amsterdam Pipe Museum, Athenaeum/Nieuwscentrum,
Scheltema, Haarlemmermeerstation, De Dokwerker, Begijnhofkapel, Houten Huys,
Huis De Pinto, Amsterdam Tulip Museum, OT301, Filmhuis Cavia and Orgelpark
plus Herepoort / Bergpoort, Huis aan de Drie Grachten, De Dolphijn, De Rode Hoed,
Theater Amsterdam, Vondelpark Open Air Theater, Vondelpark Muziektent and
Oost-Indisch Huis/Bushuis, Het Veem, Tobacco Theater, Plein Theater,
Hash Marihuana & Hemp Museum, Hemp Gallery and Madame Tussauds /
Peek & Cloppenburg, The Amsterdam Dungeon, Sint Jorishof, Waalse Kerk,
Schreierstoren and Huize Lydia (106 original assets). The live replacements retain measured footprint alignment and
hide generic building geometry only after the GLB has loaded. Review meshes at
`manual-landmarks.html`; inspect actual map placement before marking additions
complete. Next batches: further smaller museum, theatre
and church destinations from the refreshed POI queue. Exact building IDs preserve neighbors and courtyards
around narrow house museums and irregular complexes. Squares/intersections require a public-space treatment rather than
a generic building model.
Large cinemas and theatres now have the public-building category treatment;
Pathé City, Tuschinski, LAB111, OCCII and Ketelhuis also have original models.
Studio/K, Cinecenter and Badhuistheater now have individual models. Further smaller museums remain in the POI queue.
Further kit refinements: Munttoren, Rijksmuseum (towers, central arch), Beurs van
Berlage (clock tower), NEMO (green ship prow), Stopera, Hofkerk
(dome). Dominicuskerk and Vredeskerk now have original whole-church models.
Each remaining kit refinement needs its
OSM part ids first (look at the stacked parts near the landmark's coordinate; the
resolved ids in `landmark-buildings.json` are sometimes the wrong piece: Westerkerk's
is a 10 x 2 m fragment). Add a kit to `KITS`, view it with the kit viewer, then
shoot it in game. Open: kit geometry cost (about 100-700 triangles each) is not
measured on a phone; palace columns and tower openings are crude; church windows
are bare brick; the highlight for a kit landmark falls back to the plain yellow
prism.

**Places of worship: the rest (after 2026-10-04 original models).** English
Reformed Church, He Hua Temple and Amstelkerk now have original models reviewed
on the map. Taibah and Augustinuskerk still need a 3DBAG check. Dominicuskerk
and Vredeskerk now include their naves and actual tower silhouettes.


**Public buildings, next (after 2026-10-03, see HISTORY).** These are matched in staging but untreated: fire stations (19), police (23), hospitals (54) and civic offices (92). Red fire-station doors need a glass colour per window row in `KitWindows`. Big cinemas and theatres need a signage band, because plain brick boxes read as bare. The pitched-or-flat roof call on pre-1930 schools is a guess wherever the tile `roofShape` is missing.

**Gallery upkeep.** Rerun `npx tsx scripts/build-kit-locations.ts --publish` whenever a hand kit is added; the check fails on a missing location. `kit-viewer.html` and `landmarkKitsViewer.ts` are unused now and can be deleted. The playground could load a real street graph so doors on real buildings face the street.

**Street ensembles: one builder's terrace drawn as one (user 2026-10-03: "fix up the overall rhythm of major commercial streets like rozengracht, kinkerstraat, Jan Pieter Heijestraat").**
Study and prototype done (`src/canalRecall/streetEnsembles.ts`, `npx tsx scripts/check-street-ensembles.ts`; findings,
strips and photos in `/mnt/project-files/house-design/street-rhythm/`). Measured: terrace streets (Kinkerstraat, JP Heijestraat,
Javastraat, Ferdinand Bolstraat) have 55-80% of buildings in runs of 3+ (year within 2, height within 1.6 m); on those runs the
game draws one wall colour 0% of the time and one roof kind 0-8%, eave sd 0.6-1.3 m against 0.2-0.4 m in the data. Organic
streets (Rozengracht, Haarlemmerdijk, Utrechtsestraat) have no runs; their rhythm is the 4-6 m plot and a continuous shop band.
Next, in order:
- P1: offline extract `building-ensembles/14/x/y` (staging, coverage) plus a tile enricher next to `constructionYearEnricher`;
  run-shared wall colour, window style, roof decision (kind, material, rise) and eave. A shared seed alone fixes colour and
  windows but only half the roofs, because `planRoof` branches per footprint.
- P1: run-shared storey/ground scale (the per-building 0.93-1.09 / 0.92-1.12 jitter in `threeBuildingMesh.ts` breaks floor
  lines) and one shop-band height per face.
- P2: regime gating (terrace / mixed / organic: organic faces get only the shop band and whole-storey cornice steps); corner
  accents that are not "taller" (real corners are not); replace the radial 40 m shop infill in `build-shopfronts.ts`
  (overstates Kinkerstraat at 97%) with the face-aware band.
- P3: periodic accents every 2-4 houses in long runs, awnings, bike rows.
Pins: Kinkerstraat 1903 run (18 houses, 95 m) near 4.861654,52.364465; Javastraat 27-house run near 4.933378,52.36355;
Rozengracht organic face near 4.881577,52.373621; Haarlemmerdijk and Utrechtsestraat must stay ungrouped.

**Empty areas of the city (user report 2026-10-02, fix shipped, unconfirmed).**
Tile streamer retries, timeouts and the wider-view re-plan cover the likely causes (see HISTORY).
Confirm on the user's device that Jordaan/Rozengracht loads; if a tile is still
bare, log tile keys marked empty. Also unchecked on device: the facade zoom
hysteresis (0.3) and the 48-image set's build cost.

**Map Recall near-home follow-ups.** Home is only picked up when both apps share
an origin; add a way to set home inside Map Recall, and a map picture of the
ring. The ring can widen mid-game as reviews land.

**Per-wall facade renderer (spike merged 2026-10-02, not in the game).**
`rendering-spike.html` (see `RENDERING_STACK_OPTIONS.md`) renders buildings as
three.js meshes with whole bays and storeys per wall, varied layouts and
archetypes, and photo and cartoon looks. Next: mount it as a MapLibre custom
layer behind the labels; atlas the bay textures; gables from `gable.ts`;
highlighting for the answer reveal; measure frame time, hitch and shimmer on a
phone against the extrusion layer at Rozengracht, Da Costakade, Centraal and
Nassaukade. Decide by the numbers.

**Westeinde reverse ride leans on the guard.** It arrives, but the road guard
acted on 698 of 1,536 frames (the forward ride: 0 of 698). Find where (the
ride's hotspots, `KEYBOARD_RIDE_TRACE=1`) and whether the rider feels it.

**Map Recall: overlapping areas as rival answers.** The area list holds both
quarters and buurten, so Guess Name can offer Nieuwmarktbuurt and
Nieuwmarkt/Lastage together, though they cover the same streets. Choices
should skip an area that overlaps the answer by more than about half.

**Map Recall locate hints: data gaps.** Hints now name places
(`src/mapRecall/locateHints.ts`), ranked by Wikidata sitelinks. 96 linked
waters were never given sitelinks, among them Prinsengracht, Keizersgracht,
Singelgracht and Brouwersgracht, so they rank as obscure as Koningsbergengracht
(Narva-eiland's hint names that rather than Houthaven); Singel's link points at
Muntsluis. Fetch their sitelinks into the extract. Betondorp, Floradorp and
Molenwijkpark have only a district to name and fall back to bearings; Utrecht,
Rotterdam and Den Haag hints are unchecked.

**Map Recall follow-ups.** 14 OSM neighbourhoods have no article in either
language (Rijnbuurt, Scheldebuurt, Westindische Buurt, Van Galenbuurt, …);
a street-named one could borrow its street's register origin, labelled as such.
The city publishes ~480 official buurten / ~99 wijken with boundaries: a finer,
complete neighbourhood set than OSM's 85. Canal Recall shows a street card
only after a correct answer; showing it for streets ridden (paced like
landmark cards) is an open question for the user.

**16. Review and refine the published Randstad trivia.**
v11 is published (4,052 facts / 1,628 features). Trivia Lab’s **Human review**
view is the audit path: approve / reject / strike / note, then
`npm run facts:publish`. Still worth a pass: dates, quantities, Dutch
translations, and model-verifier disagreements. Corrections must keep exact
Wikipedia evidence.
Model audit, 2026-09-30: every number in all 4,052 published facts was
checked against its own source quote. Only 8 facts had a number the quote
lacks, and 7 are derived (14 December plus two days) or context (house
numbers). A proper-noun pass (names in a fact that are absent from its
quote) found one inverted fact. Two sentences are struck in the review files
with a "Model-flagged 2026-09-30" note; delete the `drop` entry to undo
either:
- Python Bridge: "Unlike the nearby Lage Brug, this structure lacks high
  elevation". The quote says that of the Lage Brug.
- Den Haag, 'Grenadiers en Jagers': "Seventh-grade students … May 10
  ceremony". Groep 7 is ages 10–11, and the quote has no 10 May.
- Vrijheidslaan: "named in 1946 after leaders". It was Stalinlaan in 1946.
- Marinehaven: "Unlike Zeebrugge…", unsupported. This feature is linked to
  the generic naval-harbour article, so its remaining sentences describe
  naval harbours in general, not Amsterdam's. It needs a human decision
  (reject the feature?).
- Same pattern, true of the concept but shown as if about one place:
  Schutsluis (en "Lock (water navigation)": Ptolemy's Nile locks),
  Afwateringstocht (nl "Hoofdwatergang") and Rotterdam's Spoorweghaven (nl
  "Spoorhaven"). Their openings define a class ("A rail port is…").
  Consider rejecting these, and have the generator refuse concept articles.
  Marinehaven's and Afwateringstocht's water cards (`water.json`
  wikipediaExtract) carry the same concept definition, which is generic
  rather than false.
The Amsterdam name list has been read through; Utrecht, Rotterdam and Den
Haag were skimmed. What remains is mostly first names filled in from the
article ("Dirk" Sterenberg). A human could skim that list (`npx tsx scripts/audit-fact-quotes.ts -- --names`).

**6. Due-aware “where next” routing.**
The thin slice shipped 2026-09-29 (see HISTORY). With Plan review on, a ride
runs between the landmarks whose line passes the most due names.
**Condition (user, 2026-10-01):** steering past due streets only makes sense
when the route line is shown. With the line off, the rider picks their own
way and never sees the planned detour, so due-aware planning should apply only
with the line on (or be reframed as a hint the rider can see). Still open:
- A due street off every landmark line is ridden as a via, or, when it
  cannot be ridden through, ends the ride as "the mystery street" (see
  HISTORY, 2026-09-30). Each ride takes one such name; the others wait for
  later rides. Of 20 sampled courts and paths off every line, 13 are now
  reviewed (10 as stops, 3 as vias). The other 7 are footpaths and courts
  the bike routing graph does not reach, so the ride ends at the nearest
  landmark instead. Reaching them would take footway access in the graph,
  walking the bike.

**Street-name origins: the licence, and a glossary pass.**
All 5,333 origins are published (see HISTORY, 2026-09-30).
- Water origins show when a waterway is learned by boat, or named at a
  bridge on a bike.
- The API states no licence for `beschrijvingNaam`. Confirm it with the
  municipality before a public release.
- `ORIGIN_GLOSSARY` no longer changes any published card: all origins are
  retranslated, and the one rule that still fired was fixed at source (see
  HISTORY). It matters only for `--trn`. Drop it together with the ~80
  glossary asserts in `check-street-name-origins.ts`, or keep it as the
  `--trn` fallback.
- Send `docs/amsterdam-street-name-register-errors.md` (167 register
  errors, BAG links) to the municipality once the licence question above is
  settled.

---

## P2 — Weight and reach

**New-build stand-ins in the building tiles.** 3,671 OSM footprints started
2015+ now fill holes the 3DBAG `v20250903` snapshot leaves (see HISTORY,
2026-10-03). They are tier 4 with estimated heights: 1,995 kiosk/shed-sized at
3.2 m, 369 from measured neighbours, 64 from OSM height or storeys, and 1,243
at a 9.5 m default because nothing nearby was measured. Next: rebuild
`build:lod1-city` on a newer 3DBAG so measured panden replace them
(`npm run fill:new-build-gaps` then finds 0), and rerun the fill after each OSM
refresh in between.

**Fix BR020's name in OSM.** The game shows Vinyl Rocks through the local
rename list (see HISTORY, 2026-10-03), but OSM node 12876814546 still says
"Br020". Once someone edits it upstream, the next POI build prints the entry
as unused; then delete it from `src/canalRecall/poiRenames.ts`.

**Municipal trivia beyond street names.** Monument status, architect, years
and function now reach clicked buildings (see HISTORY, 2026-09-30). Still open:
- the register's public descriptions (`redengevendeOmschrijvingPubliek`,
  1,891 texts, median 4.5k characters of architectural Dutch) need a
  shortening pass before translation;
- `amsterdam_canon` (49 windows; API `amsterdam_canon/canon_amsterdam_2025`)
  has only year, title, location and theme. The window text is on
  amsterdam.nl behind a bot check, so it is not scraped. These need another
  text source before they can be stops;
- bridge cards now carry the register (see HISTORY), including all 14
  bridges named "…sluis". The separate lock register (`sluizen`, 46) is not
  used; it would only add that a lock lies beneath. Two road names on multi-bridge ways, Jan van
  Galenstraat and Radioweg, could be resolved per crossing from
  `bridge-crossings.json`. The other six refusals are correct.

**Driving harness: the remaining misses (updated 2026-10-01).**
`tests/e2e/driving-harness.spec.ts`, with the trail back-out driver: desktop
111 of 120 arrive (2 lost, 7 timeouts); iPhone 104 (3 lost, 13 timeouts);
0 pinned, 0 wedges. The floor is raised to 80%. The timeouts are long routes
that the 200 s budget does not cover at the driver's 60/170 cruise. Replanning
when off the route, or when lost, was measured and lowered arrivals (98 and
109), so the driver replans only after backing out.

**Material demo e2e fails (seen 2026-09-30, still failing 2026-10-01).**
`wall-material-demo.spec.ts`: `material-demo.html` never reports ready and the
visual report finds no checked evidence. This is probably missing local demo
data. Both tests failed the same way before the Da Costa study was retired.
The study-route, appearance-colour, wall-colour and camera-stability specs
were deleted with the study (see HISTORY).

**Wall colour/material: finish Jordaan + Da Costabuurt evidence and local-model evaluation.**
The colour/texture focus supersedes new roof work for this appearance batch.
See `docs/plans/district-rectification-expansion.md` and
`docs/plans/district-rectification-gaps.md`. The complete eligible queue is 4,339
frontages / 3,472 owners; 683 exact-district owners need candidate recovery.
The resumable native-4000px worker is processing both districts. Local Qwen
completed the 100-source speed/label comparison; independent, diverse references
and obstruction abstention still need evaluation before trusting bulk proposals.
The resumable material worker now combines classifier receipts, native masks and
upper-wall photo measurements. Review these diagnostics before any publication. Finish source identity, photo colour
sampling and rendered colour/texture review separately. Existing 100-owner source
assessments and six broad-family renderer passes remain useful but are not an
accepted district appearance overlay. No default-game texture rollout yet.

**8e. Ground-floor colour band: three passes, and the statistic is wrong.**
*Opened 2026-09-26. See `FACADE_BANDS_REPORT.md` at the repo root.* 36 of 46
visible bases differ from the wall above, so one wall colour per building is
wrong for four buildings in five, and wrong exactly at eye level.

| pass | commit | differs found | same correct | obscured abstained | strict |
| --- | --- | --- | --- | --- | --- |
| one | `cd4634a` | 1/36 | 10/10 | 0/12 | 11/46 |
| two | `b823966` | 8/36 | 3/10 | 11/12 | 11/46 |
| three | not merged | 0/36 | 6/10 | 11/12 | 6/46 |

Pass two's real gain was occlusion abstention, 0/12 → 11/12, by reading the full
Vistas label map instead of a binary `building == 2` mask.

**Pass three is a measured negative and closes a direction.** Base-to-upper-wall
colour distance, normalised by within-wall variation, over the 46 labels:
`differs` median **2.12**, `same` median **2.17** — the distributions are the
same, and the best possible threshold takes 36/36 differing bases while keeping
0/10 matching ones. It detects "the base is not the wall above it", which is
true of 78% of buildings, not "the base is a different material". **Do not
re-run the raw-distance-to-wall test; it cannot separate the classes.**

Two traps now pinned in the regression corpus: on a mostly-painted facade the
"wall above" is partly the thing under test (Lauriergracht 74 is cream from 18 m
to 3 m), and a crop whose `baseZ` is 3 m starts *inside* the 2–6.5 m search
window, so a plinth at 5.5 m reads as a shopfront.

If it gets a pass four: a local change-point *within* the metric window, wall
reference chosen by coherence rather than a fixed height band, normalised by
local variation. Separately, the occluder class cannot distinguish a van *in
front of* a shopfront from a tree *beside* one — 4 of the 10 `same` abstentions
— and that needs a tighter per-frontage crop, not another threshold.

**8d. Sign text: use the vote for corroboration, not correction — and get the
reference set.**
*Opened 2026-09-25. Plan: `SIGN_PHOTOGRAPHY_PLAN.md` S1/S1c.* The owner reported
the OCR as terrible, with partial words from shadow and occlusion. Two
assumptions turned out to be wrong when measured, and the correction matters
more than the complaint:

- `run_vision_ocr.ts` **already defaults to the ground tier** (110 px/m over a
  4.9 m band). The tighter crop is not an improvement waiting to be made; it is
  what produces today's output, and the full tier is far worse — 11 of 45
  storefronts read against the ground tier's 33. The partial words happen at the
  higher resolution, so more pixels will not fix them.
- Preprocessing (`scripts/facade-eval/prep-ocr-crops.ts`, 3x Lanczos + CLAHE +
  sharpen) reaches 38 of 45 storefronts and 158 lines against 104, but the gain
  is mostly *more fragments*, not cleaner ones.

`src/canalRecall/facade/signConsensus.ts` votes across readings and is right on
the cases it was built for, recovering `CLAIM NU OP`, `EERLIJK ETEN.NL` and
`MAGAZINES GIFTS BOOKS` from readings where no single one was correct. Over the
full cached corpus, though, it changes 24 of 1,340 strings with several
regressions, **and `agreement` does not separate the good changes from the bad**
— two wrong strings score 1.00 while a correct one scores 0.79.

So: ship `support` / `views` / `years`, which are trustworthy now and are what
the persistence and invention filters consume. **Do not wire the rewritten text
to anything yet.**

*The reference set now exists* — `review-data/sign-gold/v1/transcriptions.json`,
four crops transcribed by looking at them, scored by
`scripts/facade-eval/score-sign-consensus.ts` — and it settles the question
against the vote: **9/10 names recovered and 5/10 exact, identical to the
do-nothing baseline.** The vote fixes `O TEM FA C` and breaks `ScooterCentre` in
the same run. Clustering by co-location as well as string cut inventions from
7/31 to 6/29 and moved neither recovery number. Do not tune this further without
a larger reference set; a tie is the answer, not an invitation.

**Next, in this order, because the reference set says where the loss is:**

1. **Match against OSM `name`.** Four of the ten names are on businesses OSM
   already names. Where the identity is known, the reader only has to confirm a
   sign is there and locate its rectangle — a fuzzy match against a one-element
   candidate list, which tolerates far more character error than free reading.
   Highest value remaining, and it needs no new imagery.
2. **View selection (plan §3).** On the Freddy Fryday frontage the fascia panel
   crops the leading F, so `REDDY FRYDAY` is a *correct* reading of what is
   visible; the name exists only on the hanging sign and the chip-cone. That is
   a choice-of-rectangle problem, not a text problem, and no amount of voting
   reaches it.
3. Leave the vote where it is, publishing `support`/`views`/`years` only.
   `LA BASTA` read as `DASTA` and `PASTA` — both wrong on the same letter — is
   the shape of what voting cannot fix: redundancy pays only where the errors
   are independent.

**8a. Extend reviewed appearance coverage.**
The source-bound wall-colour loop and autonomous review expansion are documented in HISTORY.
Remaining work:

- Resolve withheld or conflicting wall observations using better visible wall
  regions. Separate two-tone walls and trim instead of blending colours; do not
  invent a contrasting ground floor. Expand photo coverage beyond the 501 owners
  represented in the current review sample.
- Wire the 72 unique frontage signage reviews into source-bound game sign placement;
  the review page already loads them, but generic game signs do not consume this set.
- Collect stronger source profiles before enabling parametric gables. Lowering
  complete building masses to eaves leaves gaps without measured gable-end walls
  and complete roof coverage, including while detail tiles load.
- Expand coverage beyond the target district. Keep contextual colours explicitly
  procedural, with the existing coverage switch exposing only accepted walls.

**8c. Fill the openings the detectors cannot see.**
*Opened 2026-09-24.* The owner reviewed `facade/openingMerge.ts`'s union of the
detector lanes and found it good; its one real failure is **missing** openings,
where a van, tree or shadow hides windows. Detecting harder cannot fix this —
the evidence is not in the image. `facade/openingLattice.ts` (in progress,
branch `feat/facade-lattice`) infers them from the rhythm of what was found:
rows clustered first and trusted most, horizontal spacing estimated *within*
each row because Amsterdam bays are irregular and window heights shrink by
storey, ground floor excluded by default, and abstention rather than invention
when a row is too sparse or its spacing inconsistent. This supersedes the
framing in item 10 below: the union is the working part, and the gold set's
role is now to score imputation rather than to adjudicate the detectors.

**8b. Finish typing the game subsystems.**
Measured 2026-08-31: ~21,000 lines of TypeScript against ~6,100 lines of
hand-written JavaScript in `public/canal-drive/js/` (the other ~1,300 JS lines
there are esbuild output from `src/recall-store`, and every `*.bundle.js` is
generated from TypeScript).

The rule that has been working, and should decide what moves: **decisions in
TypeScript, painting and adapters in JavaScript.** `noticeCards.ts` +
`renderer.js`, `bottomHud.ts` + `hud.js`, `streetOverlayStyle.ts` +
`vector-map.js` are all this shape and all have tests on the half that decides.

`road-network.js` and `osm-loader.js` are both adapters now. Surface bands,
junction-aware road-name selection, same-name feature stitching, graph
construction and Dijkstra live in typed modules; so do the projection,
Douglas-Peucker simplification, network recentring, snapping, start/finish
selection and the slippy-tile grid (`osm/roadProjection.ts`, 6,542 real
Amsterdam paths asserted against the algorithm it replaced).

What is left in `osm-loader.js` is Overpass mirrors, failover and `Image`
loading — network I/O that can only be tested by going to the network.

**No un-migrated decision logic remains under this item.** Overlay preferences
(item 8c) are typed; what is left in `game-route.js` is the Game adapter.

Settled 2026-09-01: `track.js` was dead — `this.track` is only ever a
`RoadNetwork`, and the `Track` class was constructed nowhere — so it is gone.
`car.js` is **not** dead despite the same suspicion: `PlayerCar extends Car`,
so it is live base physics and stays. The `Track` interface in
`collaborators.ts` is structural and still describes `RoadNetwork`.

Explicitly staying JavaScript: `game.js` (the orchestrator, and the integration
hotspot CLAUDE.md reserves), `renderer.js`, `hud.js`, `vector-map.js`,
`map-picker.js`, the `*-source.js` 3D bundle entrypoints, and the small helpers
(`input`, `camera`, `utils`, `sound`, `particles`, `loading-screen`).

`game-route.js` is a thin adapter over the React overlay (item 8c): it is the
part a UI framework would delete rather than type, so translating it verbatim
would be work thrown away.
*The rule to keep: what the player is told is typed and tested; what paints it
is not. Do not translate a method verbatim if the decision inside it belongs in
the data half.*

**10. Build a low-poly Amsterdam that players recognise by real landmarks.**
Start with [the 13 September project review and delivery guide](../../CITY_RECONSTRUCTION_REVIEW.md).
It maps the current implementation, measured costs, local CV opportunities,
human review workflow and proposed unattended improvement loop. The detailed
identity/registration design remains in
[AMSTERDAM_FACADE_REBUILD_PLAN.md](../../AMSTERDAM_FACADE_REBUILD_PLAN.md).

Current audited state: active district release `c4bebc1f…` contains 7,395
source buildings. Its route processing covers 585/598 eligible frontages,
96.4% by eligible length, with 560 compatible wall bindings. The latest
`0f625ffc…` candidate has 1,000 valid ground analyses, 988 full analyses and
compiled source-derived features on 973 buildings; it remains staged with
zero accepted metric registrations. Counts describe different stages, not
measured reconstruction fidelity. See [the district runbook](DISTRICT_PIPELINE.md)
and [the thousand-building report](../../scripts/review/THOUSAND_BUILDING_REPORT.md).

Next work, in order (commands, agent lanes and verified artifacts are in
[RECONSTRUCTION_HANDOFF.md](../../RECONSTRUCTION_HANDOFF.md)):

*Façade-model evaluation: measured gold says "none"; the hand-labelled half is
the open step (2026-09-22).* The plan
([FACADE_MODEL_EVALUATION_PLAN.md](../../FACADE_MODEL_EVALUATION_PLAN.md)) fixes
an adoption rule up front (recall ≥ 0.80, precision ≥ 0.80, median centre
≤ 0.30 m). Against the **measured** gold set — 60 Oud-Zuid walls, 70 openings
from the point cloud, frozen at `review-data/facade-model-gold/v1/measured.json`
— **rfdetr** scores precision 2.4 % / recall 15.7 % / centre 0.298 m and
**windet** 7.7 % / 7.1 % / 0.319 m, so neither is adopted. The overlay on
`NL.IMBAG.Pand.0363100012161771` wall 23 shows the measured set is a **lower
bound** (13 measured vs ~20 visible windows; rfdetr finds the rest), so the
precision figure cannot decide on its own. Remaining: the **hand-labelled gold
set** (≈20 buildings, 5 each from apollobuurt, tuindorp-nieuwendam,
jordaan-sample, da-costa) and an R1 re-render run, then the §1 rule again.
Commands: `npx tsx scripts/facade-eval/build-gold-set.ts`,
`npx tsx scripts/facade-eval/build-eval-manifest.ts`,
`npx tsx scripts/facade-eval/score.ts --pred=… --lane=…`. Point-cloud
prerequisites T0–T4 have landed (`npm run test:point-cloud-geometry`,
`test:facade-mesh-compiler`, `test:point-cloud-spike`). The 100-building sweep
(plan task 9) stays parked until a model is adopted.

*Amended 2026-09-24 — read the verdict above as narrower than it sounds.* The
owner has reviewed the **union** of the lanes (`facade/openingMerge.ts`) on real
walls and calls it excellent; the per-lane precision figures above are scored
against a gold set this same item already admits is a lower bound, so a lane
finding a real window the MLS missed is counted as a false positive. The
practical failure is not precision but **missing** openings behind vans, trees
and shadows, which no detector can recover because the evidence is not in the
image. That gap is now item 8c (`facade/openingLattice.ts`). The hand-labelled
gold set is still wanted, but its job has changed: score **imputation** — did
the lattice put a window where one really is — rather than re-adjudicate the
detectors. The first lattice run recovered 0/12 missing measured facade openings; score its 11 facade-scope proposals against visually reviewed photos (retain model-review provenance);
confirming imputed boxes may be far cheaper than drawing every box by hand.

*The geometry channel is open: point cloud measures rooflines and gables
(2026-09-21).* 3DBAG carries no gable — **0 of 895** canal-belt buildings in
`c4bebc1f…` have a wall above their roof — so the photo-only path could only
infer one. The municipal puntenwolk (street-level MLS) now measures geometry
directly; photographs keep appearance. On the Museumkwartier demo tile
(`filtered_2397_9705`, 10.85 M points) **7 of 21 well-scanned street façades
have a shaped roofline** — the measured profile's peak stands ≥0.5 m above both
ends (a gable, step or dormer), not a plain slope — with windows, doors and
cornices recovered as recesses and protrusions in true metres; the Willemspark
tile (`filtered_2386_9702`) independently gives 5 of 39. Design:
[AMSTERDAM_FACADE_GEOMETRY_DESIGN.md](../../AMSTERDAM_FACADE_GEOMETRY_DESIGN.md).
Commands: `npm run spike:museumkwartier`, `npm run test:point-cloud-geometry`,
`npm run test:point-cloud-spike`, `npm run publish:point-cloud-facades`,
`npm run build:point-cloud-facades`. **Demo:**
`http://localhost:5195/canal-drive/pointcloud-facades.html` (interactive, tile
selector). **Next work is the ordered task list T0–T9 in
[AMSTERDAM_FACADE_GEOMETRY_DESIGN.md](../../AMSTERDAM_FACADE_GEOMETRY_DESIGN.md)**
(files, commands and done-when per task). P0: land the uncommitted spike after
fixing its missing `renderFacadeImage` import and the Willemspark check that
swallows assertion failures (T0); a hash-checked demo-tile fetch (T1); float64
positions — `fp64: false` quantises absolute RD Y to ~3.1 cm (T2); cached 3DBAG
responses so the regression runs offline (T3). P1: stop `rasteriseWall` clamping
a coplanar neighbour's returns into the edge columns (T4), abstain on
tile-clipped walls (T5), feed the measured roofline to `gable.ts` (T6), add a
point-cloud evidence source (T7). City scale still waits on the puntenwolk LAZ
host (`files.lidar.data.amsterdam.nl`, NXDOMAIN — chased with
`datateam.geo@amsterdam.nl`).

*BREADTH districts render and are eyed (2026-09-21, pass 20).*
`npm run render:district -- --area=<id>` renders a compiled district in headless
WebGL with **no publication or activation**
(`scripts/review/render-compiled-area.mjs`). All three new districts
(apollobuurt-v1, slotervaart-v1, tuindorp-nieuwendam-v1) are geometry-complete and
were rendered and personally inspected: their massing and rooflines are
recognisable (Oud-Zuid perimeter blocks + courtyards; Nieuw-West parallel
*strokenbouw* slabs; Noord low-rise garden-village rows), but every compiled index
carries `observations: 0`, so street-scale facades are featureless monoliths until
the district `evidence` stage is authorized (spend). The harness now grounds the
render at the median declared `groundNAP` and adds a `street-frontage` camera; the
older `street-eye-*` views are district-scale skylines, not street scale. Renders
and verdict: `.cache/reconstruction-loop-20260921/pass-20-report.md`.

*The street-frontage camera stands clear of the opposite block (2026-09-21, pass
22).* The pass-20 `street-frontage` picker scored walls by raw area and stood off
from the whole building bbox, so for parallel-slab districts it landed inside the
block across the street (a featureless wall filling the frame). The selection is
now a typed, tested module (`src/canalRecall/review/districtFrontage.ts`,
`districtFrontage.test.ts`) chosen in Node: it marches outward from the wall
midpoint along the wall normal until another compiled `building.footprint` blocks
the sightline, frames the wall (capped so a 190 m row reads as a street stretch)
and widens the field of view on narrow streets. `scripts/review/check-district-street-frontage.ts`
pins each district's named selection (Anthonie van Dijckstraat / Comeniusstraat /
Het Hoogt) and that the camera is outside every footprint. Rendered and looked:
slotervaart now shows a facade with sky and ground instead of an embedded wall;
tuindorp stands at 50 m instead of 90 m. The pass-22 session crashed before
committing, so pass 23 landed the module + unit test + check + renderer change
(commit `a7c2427`) and re-rendered/re-read all three districts. Residual
unchanged: all three districts are geometry-only, so facade identity still waits
on the evidence stage (spend); at street scale every view is a featureless
monolith and tuindorp's 190 m row fills the frame edge to edge.
Report: `.cache/reconstruction-loop-20260921/pass-23-report.md`.

0. **Start from the 25-case user review set**
   ([review-data/user-review-2026-09-21.json](../../review-data/user-review-2026-09-21.json);
   `npm run import:user-review`). Measured taxonomy from the owner's notes:
   missing inferred floor windows (case-12/13/16/17), missing storefront/business
   windows (case-02/11/29), missing doors (case-05/09/21), framing/centering/
   overlap (case-06/20/30), missing roof (case-19/27), roof shape too high or
   asymmetric (case-01/05), wrong colour/material (case-08/14), occlusion or bad
   source (case-03/18); 8 accepted. Fix the **systematic groups** first — inferred
   upper floors, then ground-floor assemblies (doors + shopfronts), then framing —
   and turn each into a named regression before calling it fixed.

   *Inferred upper floors are parked (2026-09-21, pass 1).* The proposed fix
   (round the contextual `floor(height/floorHeight)` up) does not hold: the four
   cases compile `observed-window`/`observed-door` patches, not contextual ones,
   and on the contextual path the extra round-up row fits 0/20 of their
   trapezoidal 3DBAG wall surfaces. Evidence and the unblocking options
   (observable-row reconciliation threaded from `FacadeDescription`, or better
   wall geometry) are in `.cache/reconstruction-loop-20260921/parked.json`.
   `scripts/check-contextual-floors.ts` is the named regression for the
   contextual rhythm and pins the measured behaviour.

   *case-12's missing whole row is delivered; the group is otherwise not a row
   miss (2026-09-21, pass 16).* Re-reading the four crops showed only case-12
   Rozengracht 160 genuinely misses a whole upper row (the extraction returned
   `full:window-2/3/4` but not the second row at y279-343 above the shopfront);
   case-13/16/17 each detect every visible upper row and their blank lower band
   is the occluded ground floor, a separate tier/crop issue. A generic gap rule
   was measured and rejected — case-08 (owner-accepted) and case-11 (a delivered
   storefront case) show a same-size anchor-to-ground gap. The row is
   reconciled per case: `src/canalRecall/facade/floorRowCorrections.ts` +
   `floor-row-corrections.json` apply the measured openings only when the gap is
   larger than one storey and they sit between the anchor row and the ground
   band, marked `inference: observed-row-rhythm`. `refresh-reviewed-floor-rows.ts`
   republished only case-12 (packet `924bece7…` → `cf5b0da4…`).
   `scripts/review/check-reviewed-floor-rows.ts` is the named regression (twelfth
   lane of `check-reviewed-cases.ts`). Residual: the detected first row
   `full:window-2/3/4` is narrower than the source row, so the rows are not
   column-aligned (pre-existing detection extent, untouched).

   *Framing/overlap measured (2026-09-21, pass 5).* The centering group's three
   cases are three different causes, not one crop-centring defect.
   `scripts/review/report-case-framing.ts` screens every crop; on the reviewed
   three it finds case-06's building run clipped at the crop's right edge (the
   fourth upper window bay ends exactly at the crop width, so the crop includes a
   slice of the next building), case-20 off-centre by 25 px and case-30 off-centre
   by 4 px. Geometry explains the rest: case-20's 6.05 m frontage
   is one frontage split across two collinear coplanar 3DBAG segments (#9 3.18 m
   + #8 2.87 m); the release already binds both ([8, 9]) and the preview compiles
   one observation per segment, so the crop is not compressed onto a single
   2.87 m wall. Its residual is a review-panel centred on the first segment plus a
   ~0.45 m ground/upper tier offset from the two independently-transformed crops.
   case-30's 4.43 m frontage is fragmented into three skewed pieces (#2 1.27 m,
   #4 2.11 m, #5 1.12 m; off-plane 0.01/0.46/0.70 m, angles 0.1/12.8/12.6°); only
   #4 clears the `surfaceMatches` overlap gate, so the release binds 2.11 m of a
   4.43 m frontage, and the preview's 0.18 m non-coplanarity guard abstains — the
   candidate renders as a blank monolith with zero observed patches. All three
   need a versioned regeneration (crop tightening; measured surface rebinding;
   shared ground/upper registration), not a one-pass edit.
   `scripts/review/check-reviewed-framing.ts` is the named regression: it pins the
   centring runs, the frontage/surface geometry and the release bindings.

   *case-30's blank candidate is recovered (2026-09-21, pass 12).* The centering
   group's worst case was not mis-centred, it was empty: its 4.43 m registered
   frontage is fragmented by 3DBAG into three skewed pieces, only #4 clears the
   overlap gate, and #4 is 0.71 m off the crop plane — past the compiler's 0.18 m
   guard — so the source abstained to a blank monolith. The registered frontage
   is exactly coplanar with the crop plane (0.0000 m), so
   `scripts/review/case-candidate.ts` now draws on it whenever every usable
   declared frame is non-coplanar, not only when no surface gives a frame.
   `scripts/review/refresh-reviewed-frontage.ts` republished only case-30
   (packet `4d57571…` → `dd1fd2e…`, idempotent). case-06 (crop clipped at the
   right edge) and case-20 (frontage split across two coplanar segments with a
   ~0.45 m ground/upper tier offset) remain the group's open residuals, both
   needing a versioned crop regeneration or shared registration.

   *Material frontage-coverage gaps are recovered (2026-09-21, pass 13).* The
   pass-12 rule switched only when *no* declared frame was coplanar, but a
   coplanar frame can still be shorter than the registered frontage. case-02
   De Clercqstraat 20/22 ("missing business window") bound one 5.10 m surface on
   an 8.09 m frontage, so `clipTrianglesToFace` removed the entrance and the
   right window column; case-13/19/22/29 had the same coplanar-but-short
   failure. `scripts/review/case-candidate.ts` now measures the union coverage
   of the declared frames along the crop-plane axis and draws on the registered
   frontage when the gap exceeds `max(1.5 m, 15% of the frontage)`. Below that a
   coplanar declared frame still wins (case-15 1.75 m, case-23 2.23 m, case-27
   2.38 m keep their declared surfaces); crop-margin rounding (case-01 0.14 m …
   case-05 0.93 m) is unaffected. `refresh-reviewed-frontage.ts` republished the
   five candidates (packet `dd1fd2e…` → `9258d89…`); case-02 now renders its
   full facade, and case-13/19/22/29 render their full frontages.
   `scripts/review/check-reviewed-frontage-coverage.ts` (tenth lane) pins the
   gaps, the switch set, fresh-compile reproduction and the sub-threshold cases.

   *Colour/material measured (2026-09-21, pass 4).* The group's two cases are
   two different defects, neither a sampler-tuning problem. case-14
   (Elandsgracht 19) declares its upper wall correctly (`brick`, `#8b4513`) but
   also carries a whole-facade `accent` (`#ffffff`, bounds = the whole crop);
   the compiler painted the accent over the wall, so the candidate rendered
   white. `observedAssemblyPatches` now skips a trim region
   (`accent`/`band`/`surround`/`plinth`) covering ≥60% of the crop, so the
   declared red brick stands while a real band still paints
   (`scripts/review/wall-colour-overpaint.test.ts`). case-08 (Rozengracht 251)
   declares `brick` with **no colour** and no trim, so it falls back to the
   neutral base `#d7d0c7`; a masked sampler measures `#594e48`
   (`src/canalRecall/facade/wallColourSample.ts`) but the field must come from
   the extraction. The sample is unreliable under shadow/occlusion (case-14's
   tree samples grey) and is a declared `needs-review` observation, never an
   accepted material. `scripts/review/check-reviewed-wall-colour.ts` pins both
   facts and writes `review-data/case-wall-colour.json`.

   *case-08's declared source colour is delivered into the study (2026-09-21,
   pass 10).* The review's "missing building color and white cornice" is now
   visible in the source-shape study: `wall-colour-corrections.json` declares
   case-08's whole-crop `upper-wall` brick `#594e48` (the masked-sample hex) and
   the thin top band (`accent`) as cream `#e8e8e8`, and
   `scripts/review/refresh-reviewed-wall-colour.ts` applies them to the packet's
   study only (packet `11305a4…` → `297054a…`). The stored extraction material
   is deliberately left colourless so the gap stays visible; the metric
   building-placement candidate and the live game render still fall back to the
   neutral base (a separate registry/release path). Named regression
   `scripts/review/check-reviewed-wall-colour-render.ts` (eighth lane of
   `check-reviewed-cases.ts`) pins the declared colours, the preserved
   extraction gap and idempotent re-application.

   *case-14's stored render is refreshed (2026-09-21, pass 7).* A full
   `build-facade-preview` rebuild is unsafe (some cases carry shape-study
   post-processing and delivered corrections outside that builder), so
   `scripts/review/refresh-reviewed-shape-study.ts` republished a targeted
   revision through `publishPreviewRevision`: case-14's full study now renders
   the declared red brick `#8b4513` with white accents instead of the white
   overpaint, and a prior/new packet diff shows `case-14.shapeStudy.full` is the
   only changed field. `scripts/review/check-reviewed-shape-study.ts` is the
   named regression and the refresh is idempotent. case-08's missing colour field
   is still open: the masked sampler measures `#594e48` but the extraction must
   supply it.

   *The reviewed-case regressions now have one command (2026-09-21, pass 8).*
   Every DEPTH lane is parked, so the six named checks were promoted into
   `scripts/review/check-reviewed-cases.ts`
   (`npx tsx scripts/review/check-reviewed-cases.ts`): contextual floors,
   retail ground assemblies, roof vertical, wall colour, framing and the case-14
   source-shape study, run in isolated child processes with a per-lane
   pass/fail summary and a non-zero exit on regression. No `package.json` entry
   — the branch's pre-existing `package.json` WIP must not be folded into a loop
   commit. BREADTH was re-checked and stays parked: the district acquisition job
   is done and apollobuurt/tuindorp geometry is complete, but the evidence stage
   fails on spend authorization and rendering still needs a forbidden release
   publish / `current.json` activation.
1. Prioritize roofs: human-review the existing dormer/gable corrections in
   cases 20 and 22, then the 22 other unreviewed outlines with source/roof geometry. Resolve
   case 26's source identity before attempting its roof. Turn concrete feedback
   into source-bound silhouette/component corrections and verify both viewers.
   Use [the roof handoff](../../scripts/review/ROOF_REVIEW_HANDOFF.md).
   The entrance-04 localization misses remain a following source-coordinate
   annotation task. Recover the two missing historical preview bindings and
   archive referenced evidence.

   *Roof vertical geometry is parked (2026-09-21, pass 3).* Measuring the four
   reviewed roofs found three distinct defects, none of them a one-pass fix.
   `selectCompatibleSourceRoof` mixes datums — it publishes `up - groundNAP`
   while `up` is the owner's scene-local axis (NAP − 0.65 m), so every published
   study-roof eave/ridge is 0.65 m too low and 674/7,395 selected buildings flip
   if corrected; that needs a versioned study-roof regeneration, not a silent
   edit, because `check-city-appearance-roofs.ts` pins the release counts.
   `case-01` Rozengracht 158 withholds its roof because the 3DBAG roof surface
   is near-flat (0.14 m relief); the source gable is absent from the source data,
   so only a silhouette correction can restore it. `case-05` Lauriergracht 67/69
   carries a source vertex 2.38 m above its own BAG ridge — the "roof too high
   into the sky" spike — and the live game massing uses raw 3DBAG surfaces, so
   the study-roof function is not the renderer to change. Evidence and the
   unblock options are in `.cache/reconstruction-loop-20260921/parked.json`;
   `scripts/review/check-reviewed-roof-vertical.ts` is the named regression that
   pins all three facts. Continue with the source-bound outline lane rather than
   the study-roof function.

   *case-27's missing roof is delivered; case-19 stays parked (2026-09-21,
   pass 9).* The "missing roof" group's one legible case is fixed. case-27
   De Clercqstraat 79 had no roof in its full source-shape study because the
   machine `upper-wall` box reached into the roof and no silhouette was applied.
   `roof-coverage-corrections.json` now carries a pixel-inspected case-27
   silhouette (left slope, ridge, both stacks, right edge at x=906), a dark
   roof field `#3f3f3d` and the two brick stacks, republished into the packet
   through the same coverage path `build-facade-preview` uses
   (`scripts/review/refresh-reviewed-roof-coverage.ts`, packet `1a969c0…` →
   `11305a4…`, idempotent). `scripts/review/check-reviewed-roof-coverage.ts` is
   the named regression (seventh lane of `check-reviewed-cases.ts`). Residuals:
   the full study's ground-floor shopfront is still missing (separate defect);
   case-19 Elandsgracht 69 has no defensible silhouette (foreground pole, two
   overhead wires and bare branches cross a low-resolution roof, and the left
   reading is ambiguous between its own roof and the neighbour's), so it is
   parked rather than annotated from a guess.

   *case-21's missing roof is delivered through the same source-bound lane
   (2026-09-21, pass 18).* The review's case-21 Lauriergracht 50 ("missing roof,
   missing ground floor window, first floor is all windows no door") showed a
   flat-topped brick rectangle in its full source-shape study while the source
   carries a **bell gable** with a cream crest and side scrolls.
   `roof-coverage-corrections.json` now declares a pixel-inspected 16-point bell
   outline plus three cream fields (pediment, left and right volutes);
   `refresh-reviewed-roof-coverage.ts` republished only case-21 (packet
   `ad09c342…` → `4181458d…`, idempotent). Deep diff: only case-21 changed, only
   `roofReview`/`shapeFeatures`/`shapeStudy`; the metric `building-placement`
   candidate is byte-identical. `check-reviewed-roof-coverage.ts` now pins both
   delivered cases. Residuals: the crop cuts the crest top and a cast shadow
   crosses the lower bell, so the outline is a **coarse** source-pixel
   approximation; the left-volute patch reads slightly detached at the step.
   case-21's ground-floor display glazing (portrait) and its metric roof/ground
   remain separately parked.

   *case-12's missing roof detail is delivered through the same lane (2026-09-21,
   pass 21).* The review's case-12 Rozengracht 160 ("mising roof detail, missing
   one whole floor of windows") is a **halsgevel** whose stored study drew flat
   brick to the crop top. `roof-coverage-corrections.json` now carries a
   measured left-neck outline (shoulders at y=160, flat crest top) and
   `refresh-reviewed-roof-coverage.ts` republished only case-12 (packet
   `9ddc545c…` → `7a261e5b…`, idempotent); deep diff: only case-12, only
   `roofReview` + `shapeStudy.full`, the pass-16 inferred row preserved and the
   metric candidate untouched. `check-reviewed-roof-coverage.ts` now pins three
   delivered cases. Residual: a foreground tree trunk covers the right neck, so
   the right outline is mirrored and the crest top is closed flat — a coarse
   approximation, not a measurement. Remaining roof reviews: case-05 (too high;
   parked on the raw-surface/vertical lane) and case-19 (no defensible source).

2. Extend the new reconstruction workbench and its existing notes service with
   region-level correction revisions and registration-tool links. Capture
   structured edits and preserve overrides.
3. Complete source → recipe → both-viewer delivery for 20–40 representative
   frontages on one route. Measure extraction in source pixels separately from
   3D placement; address roof/gable silhouette, balconies, entrance placement,
   temporal conflicts and the Moeders game sign-tile residency failure.
4. **Crop-top fix is small, not urgent.** `preflight:crops` (corrected metric)
   finds only 71/2,344 crops mostly sky (3%), 14 featureless, 3 blank. The crop
   top uses the BAG ridge height; using the matched 3DBAG eave (`wallTop.ts`)
   would reclaim ~71 crops. Worth doing as a versioned regeneration, but it is a
   minor lever, not the quarter-corpus one the first (buggy, top-band-only) metric
   claimed. Never overwrite the existing crops in place.
5. Treat **ground-level retail as its own lane**, not a footnote to residential
   openings. Extract shopfront assemblies — display window, entrance, fascia and
   awning — separately, with literal sign text and dated awning state, and
   measure storefront precision/recall on the frozen set. `storefrontAssembly.ts`,
   `retailCompiler.ts` and `retailPatches.ts` now group and compile them; the next
   step is to feed real `FacadeDescription` features through and render the patches.
   *Pass 2 (2026-09-21) fed the real reviewed ground features through.* The ground
   band's centre test was dropping tall ground openings, so case-02/05/11/29 now
   assemble storefronts with entrances and display glazing
   (`scripts/review/check-retail-ground-assembly.ts`). The lane is still not wired
   into the renderer. Remaining: case-21's portrait display glazing is excluded by
   the landscape-display rule.
   *case-05's full-study entrance is delivered (2026-09-21, pass 19).* The
   review's "no door" was the full source-shape study, whose 2023 extraction
   returned all three ground windows but no entrance. The dated full crop shows a
   central recessed entrance between the two ground-window banks (the clearer
   2025 ground crop confirms it); the leaf is ivy- and shadow-occluded, so only
   the measured recess position and the building's own ground-capture door colour
   are declared in `source-geometry-corrections.json`.
   `scripts/review/refresh-reviewed-source-geometry.ts` republished only case-05's
   `shapeFeatures.full` and `shapeStudy.full` (packet `4181458d…` → `9ddc545c…`,
   idempotent); named regression
   `scripts/review/check-reviewed-source-geometry.ts` (fourteenth lane of
   `check-reviewed-cases.ts`). The metric candidate and the ground-crop
   registration gate are unchanged; this is a source-space study delivery.
   *case-02's metric entrance is recovered (2026-09-21, pass 13).* The entrance
   and right window column were clipped by an **incomplete declared frame**
   (5.10 m surface on an 8.09 m frontage), not by the ground-crop gate; the
   coverage fix in the framing group above republished it and it now renders the
   full storefront (entrance + display glazing + awning).
   *case-09's blank candidate is recovered (2026-09-21, pass 11).* The review's
   "missing door" case was worse than reported: its metric candidate was a blank
   monolith because the release bound no wall surface and no 3DBAG wall at the
   frontage is a usable frame. `src/canalRecall/facade/registeredFrontage.ts` now
   builds a synthetic wall on the observation's own registered frontage (exactly
   coplanar with the crop plane) when no declared surface gives a frame;
   `scripts/review/refresh-reviewed-frontage.ts` republished only case-09's
   candidate (packet `297054a…` → `4d57571…`, idempotent). The recovered
   candidate renders the paired arched windows, gable window, ground band and the
   entrance + display glazing. Named regression
   `scripts/review/check-reviewed-frontage-fallback.ts` (ninth lane of
   `check-reviewed-cases.ts`); case-30 was recovered by the same fallback in pass
   12 (see the framing group above).
   *case-11's white upper windows are recoloured (2026-09-21, pass 14).* case-11
   De Clercqstraat 26's extraction declared `colour:"#ffffff"` for all twelve
   full-tier windows (the frame/curtain it sampled), so the compiler painted the
   glazing white and every upper window read as a blank pane. A near-white window
   colour (all channels ≥ 235) is now treated as undeclared and falls back to the
   neutral glass; door leaves are excluded (a white door is real). Only case-11
   and case-18 carry the gap. `scripts/review/refresh-reviewed-glazing.ts`
   republished only case-11's `patches` and `shapeStudy.full`
   (packet `9258d89…` → `168fc6d…`, idempotent), preserving the stored extraction
   gap; named regression `scripts/review/check-reviewed-glazing.ts` (eleventh
   lane). Residuals: case-18's packet artifacts are not refreshed, and the live
   game picks the guard up only when the pre-existing-WIP viewer bundle is
   rebuilt by the integrating agent.

   *case-18's stored render is refreshed too (2026-09-21, pass 15).* The
   occlusion group's case-18 (a heavily occluded building behind the station
   sign) declared `#ffffff` for both the glass and the frame of its four windows,
   so its stored render drew solid white arches. The glazing recolour is
   **partial** there: the glazing turns neutral glass while the white **frame**
   patches stay (a white frame is architecture; the source photograph shows dark
   glass in white frames). The refresh therefore grew a `--tier` filter and only
   `full` was recompiled — case-18's ground study carries a delivered
   raised-entrance correction that a plain `compileSourceShapePreview` does not
   reproduce (13 extra door patches plus an `omissions` note), so it is left
   byte-identical rather than silently dropped. Packet `168fc6d…` → `924bece7…`;
   deep diff: only case-18 changed, only `patches` and `shapeStudy.full`.
   `check-reviewed-glazing.ts` now asserts both delivered cases and the preserved
   ground correction. Residual: the building is still occluded (the review's
   "need to infer") — only a better-dated source can address that.

   *case-05's overlapping window frames are fixed in its source-shape study
   (2026-09-21, pass 17).* The review's "windows opverlapping too much" is
   measured: the extraction places the narrow window `b3` and the wide bay `b4`
   **1.9 px** apart, and the default `.14 m` frame border makes each frame cross
   the other. `frameClearancePx` is a new opt-in per-feature declaration (the
   measured same-row glazing gap); the compiler caps the frame to it and never
   past the nearest neighbour. `opening-frame-corrections.json` declares the six
   measured openings; `refresh-reviewed-opening-frames.ts` republished only
   case-05's `shapeFeatures.full` + `shapeStudy.full` (packet `cf5b0da4…` →
   `ad09c342…`), and `check-reviewed-opening-frames.ts` is the thirteenth lane.
   **Residual parked:** the declaration is study-only, so the metric
   `building-placement` candidate and the live game still draw the uncorrected
   `.14 m` frames. A shared compiler rule would change case-09/12/19/22/24/30
   studies and their delivered lanes, so it needs a versioned regeneration.
   Reuse the existing modules (`facadeEntranceAssemblies.ts`,
   `cityAppearanceMachineSigns.ts`, `retail-registration.ts`,
   `retail-source-corrections.ts`) and keep the unreviewed shopfront/literal-sign
   policy in HISTORY.md. Retail is the strongest recognisability cue and the most
   placement-sensitive: it sits at the base, where the bottom edge is most often
   occluded and where a boresight error hurts most.
6. **Scale and validate panorama boresight.** The anchor tool auto-selects
   panoramas (`build-pano-anchor-task.ts --auto=N`; 12 panos / 56 markers at
   `pano-anchor.html?task=expanded`) and `anchorRegistration.ts` converts marks
   into `correspondence-verified` evidence, now cross-validated. Remaining: mark
   the expanded set, then decide whether the prior-constrained auto-estimate
   (`estimate:pano-boresight`) can replace per-panorama anchoring. Today it is
   within ~1° when the GPS prior is right and prior-limited otherwise.
7. Extend the existing resumable coordinator with failure-specific repairs,
   bounded retries, independent evaluation and regression generation, using the
   new immutable offline reports as the starting point. Calibrate automatic
   field-level acceptance using
   held-out evidence; retain conservative output for unresolved cases.
8. Profile the complete scene on a named desktop and physical phone, then
   expand to diverse architectural districts with measured quality and review
   cost. The saved 9.12 MB building-buffer/texture figure excludes other scene
   memory and cannot establish full-device performance.

Resolved (2026-09-21, pass 1): the case20 doors expectation is no longer red —
`node --import tsx --test scripts/review/source-to-owner-candidate.test.ts` is 8/8
green and already asserts `agent-inspected` for `full:door-1`.

The existing unreviewed shopfront/literal-sign policy remains recorded in
HISTORY.md. Proposed delivery levels do not bypass current release gates.
Keep the missing twelve original image-numbered examples as an unresolved
historical issue while defining new work against identified evidence.


**11. Other cities: content, not plumbing.**
Utrecht, Rotterdam and Den Haag are playable from the City row (see HISTORY,
"Full city selector"), and `other-cities.spec.ts` rides each one. What is
left is content:
- 275 of Utrecht's 380 landmarks have no text, and Rotterdam and Den Haag
  have had no landmark-text pass at all;
- the teaching data is Amsterdam-only so far: street-name origins, the
  bridge register, building facts and monuments. Each came from an
  Amsterdam municipal API. Utrecht, Rotterdam and Den Haag publish their own
  open data, which needs a source per city before cards there can match.

**11c. Give Amsterdam and Utrecht real ledes.**
Amsterdam’s card-facing extracts are English in the publish gate
(`check:extract-english` after `enrich:english` in `refresh-city-extract.sh`).
Remaining thin blurbs are Wikidata description floors or rename refusals that
fell back to a description. Utrecht's backlog, measured 2026-09-30 with `trn`
(`npm run enrich:utrecht-english -- --translator=trn --dry-run`), is 11
distinct blurbs. All 11 are refused for translating the place's own name
(Eendenkooi, Verzetsmonument, Ridderhofstad Den Engh, …) and fall back to
English Wikidata descriptions, so none still reads Dutch. What remains is
thin ledes, not Dutch.

`street-knowledge.json` is now generated from streets/water
(`npm run build:street-knowledge`) — do not hand-edit it.

The shared translation cache is pruned against all Randstad extracts
(`--prune-stale` on `translate-extracts-to-english.ts`; 322 orphans removed,
1,422 kept). Remaining thin cards are mostly Wikidata description floors
(~400 distinct).

Expect some refusals: the pass rejects a translation that lost the feature's
own name. Those come back as `refused — translated the name itself` and fall
back to a Wikidata description when one exists.

**12. Clear all my data.**
Partial: **Reset knowledge…** is on the route briefing account row (and
confirms before wiping). It clears local + signed-in spaced-repetition memory
and fact-rotation history, leaves auth and Canal preferences. Still open: a
full “clear preferences / exploration / everything” path if we want that
separate from knowledge reset.

**15. Keep naming regression locations.**
Continue expanding named cul-de-sac and dead-end cases in
`scripts/check-canal-car.ts`. Ongoing, not a milestone: every geographic failure
reported from play should land here before it is called fixed. Bike-routing
coverage for pedestrian/cycleway corridors is pinned in
`scripts/check-city-extract.ts` (Zeedijk in, Kalverstraat out); still add the
street name from any future "can't bike here" report so a junction-level miss
does not hide behind the highway-class fix.

**11b. Optional Amsterdam extract refresh (not broken).**
Published Amsterdam is check-green (~47k routing ways, motorway/trunk classes,
`city-profile.json`, bridge crossings aligned, Potgieterstraat present). Last
structural rebuild 2026-08-31. A new `refresh:amsterdam` is worthwhile for
pipeline currency (dab-follow enrich, English rename-refusal handling) but will
churn encyclopedia blurbs — stage, diff coverage, publish only after review.
Do not treat this as a red routing bug.

**14. Storybook visual regressions.**
`storybook-visual.spec.ts` compares 40 Storybook states (cards, HUD, finish,
panels; desktop and phone at each story's own viewport) against committed
screenshots (2.3 MB), stable across repeated and parallel runs. Still open:
- the five desktop briefing screens, left out because their photo backdrop
  makes each baseline 1.5 MB;
- baselines are darwin-only, so a Linux CI would need its own set;
- the landmark-card baselines (`landmark-card*`, and HUD states showing a
  card) predate the close "×" added 2026-10-03 and need re-recording on a Mac
  (`--update-snapshots`); the cloud sessions run Linux and cannot.


---

## P3 — Bets worth a spike, on their own branch

**17. Public transit mode.** Tram / metro / ferry as its own routing and
recall model, not a vehicle skin. *Large.* **GTFS-first** (OVapi → GVB). Plan:
[`TRANSIT_SPIKE.md`](TRANSIT_SPIKE.md). **Phases A–E + play polish shipped:**
tram+metro drive, termini pool, metro 52 pin, sibling/hub distractors,
active-line stop scope, transfers, two-leg planner + second-leg drive, surprise
pairing biased toward teachable transfers (~70%), second-leg plaque clear,
named Noord→Isolatorweg two-leg pin. **2026-09-06 playtest:** chase≠cockpit +
tilt slider; bold corridor overlay (metro dashed above buildings); orientation
grace before line/transfer asks; map idle settle on load. Still open: bus,
GTFS-RT, dedicated mesh, OSM tunnel tagging in extract, GTFS `transfers.txt`
merge when cached. Canal-belt teaching streets via `amsterdam-curation` +
`ensure:amsterdam-teaching-streets`. Pedestrian `bicycle=no` corridors
(Kalverstraat) playable with `bicycleRestricted`. Bike ferries (GVB IJ
F1–F9) are playable in bike mode (HISTORY 2026-10-09); open: no timetable or
waiting, router treats crossings as plain distance, terminal accesses are
projected (some 30–43 m, Sporenburg's over water), 33 m ferry overlaps the
iPhone thumbstick in chase view, no Storybook visual baseline.

**25. Large-letter postcard compositor (standalone).**
Craft board: [`LARGE_LETTER_CRAFT.md`](LARGE_LETTER_CRAFT.md). **Check loop:**
`test:large-letter-craft` → `render:large-letter-craft -- --round=N` (gallery +
pixel P0 on Jordaan: no top ink, cream ring ≤14px) → vision. Three themed
rounds + a fill bump (span ~64%H), then the Spoon Graphics recipe pass
(2026-10-03, HISTORY). Remaining: tighter greeting nest, place props, a
converging (vanishing-point) block as an optional style (the recipe's own block
is parallel), and the recipe colours for the non-default styles.

**19. Structured Wikidata + city-hall advisor.** Assignments from mayors,
architects, opening dates — without another card competing with the corridor.

**23 / 24. Authentic retro rendering and the optional arcade layer.**
Parked; design notes at the end of `HISTORY.md`.

---

## Ongoing reliability work

Not milestones — standing obligations with live guards.

- `Canal CI` must stay green: `check:canal`, boot smoke, full Playwright.
  Deploys wait on that workflow. Local: `prepare` installs pre-commit (`lint`)
  and pre-push (`lint` + `test:e2e:smoke`).
- Name every reported geographic failure in `scripts/check-canal-car.ts` (or
  the reachability / city-extract harness) before calling it fixed. Bike
  corridor pins: Zeedijk in, Kalverstraat out (`check-city-extract`).
- Prefer city-qualified Wikipedia dab follows (`pickDisambiguationTarget`,
  score ≥45); keep `check:encyclopedia-disambiguation` green.
- Refine boat shoreline response and bridge traversal on more geometries.
- Keep rejecting distant or ambiguous home-address-to-waterway snaps.
- Audit route topology at docks, broad water polygons, bridges, and split OSM
  fragments.
- Tune neighborhood postcard scale and long-name typography on mobile.

- P2: Landmark fronts (Bijenkorf, Beurs hall, Royal Palace, Concertgebouw, Tuschinski) and kits (Westerkerk, Zuiderkerk, Montelbaanstoren, Noorderkerk, Royal Palace dome, Waag, Beurs, Centraal, Rijksmuseum, Sint-Nicolaas, Munttoren, Krijtberg) are in the game. Oude Kerk, Nieuwe Kerk and NEMO (colour only; its skillion roof terrace is still flat) are done too. Next: Stopera, Carré, Stadsschouwburg, Stedelijk, Scheepvaartmuseum; Centraal's long front and Rijksmuseum's gate front as fronts (references: `build-pano-facade.ts --toward=lng,lat --max-panos=3`; the Rijksmuseum pick lands inside the passage, so choose the Museumplein wall with `--wall`); Beurs Damrak front; Anne Frank House needs a reference (Mapillary token via env `MAPILLARY_TOKEN`, never committed). Front ids must be the game tiles' ids.
- P2: Hand-modelled storefronts for notable businesses (Kema Vlees, 't Mandje, De Jaren, Winkel 43, Hoppe done). Next: Massimo Gelato branches (identify which shop in each panorama), Papeneiland, Café 't Smalle, Brouwerij Troost, Lastage/Vermeer etc. via their hotels; hotel facades (Amstel Hotel, Krasnapolsky, De L'Europe, Doelen, Pulitzer, Conservatorium). Reference: `build-pano-facade.ts --ids=<pand> --near=<poi lng,lat> --ppm=50 --min-standoff=2 --max-dist=40 --max-obl=60`.

- P2: Anne Frank House facade needs a source other than panoramas (Commons photos once the rate limit clears, with per-image licence/attribution); Sherlocked is not in the landmark data (which building was meant?).
- P2: Apply panorama JPEGs to landmark walls in the three layer (needs per-wall UV mapping) and ship Waag kit via KITS if kept.
