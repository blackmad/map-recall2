# Retail fit: tenants inside the building's own openings (lane retail-fit-20261120)

David's questions:

- "Think about how we can fit the Albert Heijn into the design of the building's existing windows, and more generally how to fit in designs like that."
- "Are there other iconic street-level retail we should be building?"

The list is in [iconic-retail-20261120.json](iconic-retail-20261120.json). Its top 15 are at the end of this report.

## 1. Diagnosis: how tenants are drawn today

- **Template fronts.** A shop pand gets a template front from `shop-templates.json`, drawn by `retailFront.ts` into the generated building mesh. The front is a fascia band, a glass field and goods. `retailGround` is on by default.
- **Fronts disappear under models.** When a model (bespoke landmark, block-face chunk, recipe house) covers a pand, the shader hides that pand (`setHidden`). The template front goes with it, and the model's own ground storey is uniform glass.
  - At the Hirschgebouw on Leidseplein, all 25 arcade openings are the same #3f464c glass, so the AH, Apple, the Rijksmuseum shop and ABN AMRO are all invisible.
- **Census.** `scripts/retail-fit/census.ts` writes `artifacts/retail-fit/census.json`.
  - There are 10,163 shop pands, and 3,836 of them have a template.
  - Hosts: plain 7,886, monument 1,251, monument-pui 136, hand-front 285, block-face 246, bespoke landmark 178, recipe house 139, ground-floor record 39, building type 3.
  - **566 tenants are hidden by a model.** Among them: Hirschgebouw (AH), Kalvertoren (HEMA), Nieuw Engeland (Uniqlo, AH), Damrak 70-79 (TK Maxx, Primark), Kinkerstraat 89-105 (AH), Arti et Amicitiae (Holland & Barrett) and Effectenbeurs.
  - **517 monuments still get a generic template fascia.** For 54 of them the register names the pui (winkelpui) itself, so the fascia box covers the listed element.
- **Not every monument is fascia-free.** Photo reads of ground floors show real fascias on some monuments (Siebel, FEBO, Cheese & More). So the rule below defers to the photo read where one exists.

## 2. Taxonomy and rule (`src/canalRecall/retailFit/hosts.ts`)

**Host kinds**, by what the ground storey is:

| host | example | allowed expressions |
|---|---|---|
| landmark-arcade | Hirschgebouw, Nieuw Engeland arch | in-opening + blade |
| landmark-bays | Damrak 70-79, Kinkerstraat 89 | in-opening + blade, awning inside a bay |
| historic-pui | register pui, canal-house stoep windows | in-opening + blade, awning, letters on the pui's own sign band |
| warehouse-doors | pakhuis | in-opening + blade, painted wall letters |
| modern-glass | curtain wall / full glass | in-opening + blade, wall letters, lightbox |
| plain-modern | generated wall | everything, including the fascia box (today's template) |

"In-opening" expressions, least intrusive first:

1. interior colour
2. goods (shelves, tables, rails, seats)
3. door colour
4. letters on the glass, with an optional mark
5. vinyl band or full vinyl (solid or Delft)
6. letters in the arch head (the AH on Leidseplein)
7. a panel in the opening (Geldmaat ATMs)

**Rule.** A designed ground storey never takes a fascia box or lightbox. The tenant appears only inside the openings. A photo read outranks the host kind, so a photo-read fascia on a monument stays. A register-pui monument with no photo read defaults to in-opening expression. `hostKindOf` derives the kind from the census host, the opening heads, the register facts and the glass share. The tests pin these points.

## 3. Data plan: tenant → opening

1. **Openings come from the model's own glass.** `openings.ts` takes vertical glass triangles below 7.5 m, groups them by plane, and splits each plane into connected pieces. It keeps the outward face and reads the width, sill, springing, crown and head shape (flat, segmental or round) off the outline.
   - It finds 25 openings on the Hirschgebouw, all 8 Leidseplein arches at 3.3 m wide with a 5.0 m crown. It also works on kalvertoren, brand-bij-ca, nieuw-engeland and kinkerstraat-89.
2. **Tenants come from OSM.** Shop and amenity nodes and their entrances are taken from the cached overpass pull. Each node claims its nearest openings (Voronoi within 12 m). The name goes in the opening nearest the node.
3. **What fills an opening is read from the panorama, per opening.** These are hand fits that cite the panorama. `bay-strip.ts` makes rectified per-bay strips to read from. A chain style with no photo read is not used (see the blind result in section 4).
4. **Staged per-opening reads (round 2).** Each record in `src/canalRecall/retailFit/retail-fits.json` is one opening. It holds the point on the facade, the tenant, the source panorama and a typed `OpeningRead` (`photoRead.ts`):
   - the measured glass tone (`glass-tone.ts` / `region-tone.ts` on rectified crops)
   - goods (tables, shelves, rails, seats, curtains), lamps, vinyl (solid, delft or landscape poster, with a cut-out window), posters and panel
   - lettering (in the arch head, on the glass, or a band), frame and door

   `layersOfRead` turns a read into layers; the Hirschgebouw conversion round-trips exactly. A model's status is `staged` until it wins a blind A/B, then `published`. `checkStaged` validates the file in the test.

## 4. Pilot (round 1 behind `?retailFit=1`; round 2 default-on for published reads)

- **What it draws.** The overlay is one mesh per model at the full level only. Every layer sits between 0.008 and 0.054 m in front of the glass, so it stays under the 0.07 m archivolt, and is clipped to the opening's head.
  - The Hirschgebouw carries 19 hand fits read from 2025 city panoramas, about 3,070 triangles in total.
  - Leidseplein front: Apple ×3, the Shop at Rijksmuseum (Delft vinyl and a navy "RIJKS MUSEUM" band), the entrance doors, and AH ×3 with "ALBERT HEIJN" in the arch head, shelves and posters.
  - Kleine-Gartmanplantsoen front: Apple ×4, the Geldmaat ATM panel, and ABN AMRO ×2 with glass letters and the mark.
- **Flag modes (round 2).** The default `published` mode draws models whose blind A/B was won (Hirschgebouw, American Hotel). `?retailFit=1` (env `RETAIL_FIT=1`) adds staged reads for review. `?retailFit=0` draws nothing.
  - With `?retailFit=0`, the hooks return before any work. I checked `RETAIL_FIT=0` node frames byte-for-byte against the pre-change flag-off frames: hirsch-ah, hirsch-abn and kinker89-ah are identical.
- **Blind A/B.** One Opus judge saw photo | A | B at the panorama poses with seeded random sides and never saw the key. Sheets are in `artifacts/retail-fit/blind/sheets/`, the key in `artifacts/retail-fit/blind/blind-key.json`, and frames in `artifacts/retail-fit/frames/{off,fit}/`.

| pose | winner | note |
|---|---|---|
| hirsch-abn | **fit** (high) | ABN AMRO arch, door, ATM panel match |
| hirsch-ah | **fit** (high) | ALBERT HEIJN in the arch head, lit shelves |
| hirsch-apple | **fit** (med) | dark arches; the Delft bay reads as tile, not the photo's poster |
| hirsch-rijksmuseum | **fit** (med) | same; the blue bay may sit one arch off |
| kinker89-ah (node fill) | tie | shelves the photo does not show |
| damrak-tkmaxx (node fill) | today | light grey panels and striped rails too bright; TK MAXX not in the 2019 photo |
| nieuw-engeland-uniqlo (node fill) | today | invented UNIQLO sign and rails |

**Result.** Photo-read hand fits won 4 of 4. Chain-style node fills won none of 3 (two losses and a tie). The pilot therefore ships only the hand fits: `NODE_FILLS_ENABLED = false` in `fits.ts`. The node path stays behind that constant until a photo read feeds it. The judge's remaining criticism is that interiors are still a little bright compared with the photos' dark glazing.

**Round 2.** Changes:
- Interiors set to the measured median glass tone of each bay: clear shop glass L 64–82 (#3b4144–#4c5450), the AH arch #303c41, ABN AMRO #4b534d/#74847b. AH shelf colours dimmed by about 35%.
- The Rijksmuseum bay is a single Delft-blue landscape poster (pale sky, hill line, dark foreground, two tree crowns) with a lit flower display in a cut-out, rather than a tile repeat.

Each round used one fresh Opus judge with re-seeded sides. Sheets and keys are in `artifacts/retail-fit/blind2/` and `blind-ah/`, `blind-ah2/`.

| pose | round 2 winner | judge's remaining note |
|---|---|---|
| hirsch-abn | **fit** (high) | Geldmaat panel too white and flat; teal door arch a little green |
| hirsch-ah | **fit** (high) | interiors a little busy; leftmost poster unconfirmable |
| hirsch-apple | **fit** (med-high) | far-right AH sign hidden behind the WC kiosk in the photo |
| hirsch-rijksmuseum | **fit** (med) | poster arch may sit two arches right (camera offset) |
| american-hotel, Bar Américain front | **fit** (med) | glass flat black, the photo's is dark grey-brown with reflections |
| american-hotel, Leidsekade front, 1st read | **today** (low) | I read curtains and lamps; the daylight photo shows lowered blinds |
| american-hotel, Leidsekade front, corrected | **fit** (med, new judge) | the dark strip under the blinds is too even; no entrance canopy |

The Hirschgebouw and the American Hotel are published (default-on). Across both rounds, the hand fits won 8 of 8 Hirschgebouw sheets and 2 of 3 American Hotel sheets; the one loss was corrected and then won.

**Other modelled hosts from the iconic list:**

| host | result | why |
|---|---|---|
| Tuschinski | nothing to fit | the GLB's glass starts at 4.2 m; the street level is the cinema's own gold-painted front, so the tenant is the model |
| Magna Plaza | blocked: model tagging | the GLB has no glass material; its shop windows are `dark:frame` slabs. Needs a landmark GLB rebuild with glass tagged on the ground windows (integrator), then reads |
| De Hallen | blocked: no photo | 33 openings detected, but the panorama crops come from 28–34 m away and show the far side of the street. Its ground storey faces car-free passages with no city panorama. Needs another open photo source |
| Concerto (Utrechtsestraat 52-60) | blocked: no adapter | it lives in a block-face chunk (`chunk-face-utrechtse-48-76`, 38 openings detected). Chunks load outside `signature-landmarks-source.js` and the node-frame hook skips them. Needs a chunk adapter (about 40 lines, same `retailFitScene` call) before reads are worth staging |
| American Hotel | **published** | 11 openings, 11 reads. The 145° front has no openings where Café Américain's big arched windows are, so its glass is only under the BAR AMERICAIN awning (model gap) |

**Generated-shopfront openings for the register-pui monuments (plan, item 4).**
- 161 shop pands have a register-named pui. 64 of them still draw a template fascia: 50 on generated monument walls, 6 under bespoke models, 4 recipe houses, 3 hand fronts and 1 ground-floor record.
- The template mix on the 50 is brownBar 14, hairdresser 5, coffeeshop 4, souvenir 4, redLight 3, and the rest at two or fewer each.
- Only 1 of the 64 has a ground-floor photo read in `ground-floors.json`. That schema (openings with head and sill, piers, plinth) is the right carrier, so detection there needs no mesh analysis.
- Plan:
  1. Photo-read the 50 puis into `ground-floors.json` with the existing ground-floor pipeline, one panorama each (about 50 rectified crops).
  2. Add a pure mapper from ground-floor openings to `HostOpening` (about 30 lines) so `FitBuilder` draws in them.
  3. For `historic-pui` hosts with no photo-read fascia, retailFront drops the fascia box and puts the name on the glass or the pui's own sign band (`hosts.ts`).
  4. Blind the 50 by row.
- This touches `retailFront.ts` beside the shop-variety lane's pane content, so I did not start it here.

**What the kit still cannot say:**
- reflections on dark glass (interiors are flat colours; tone is now measured)
- awnings and entrance canopies (the Bar Américain awning, the hotel canopy) outside the openings
- printed poster imagery
- recessed entrance lobbies and their depth
- awnings and blades inside an arch
- lit-from-inside night lettering
- a pui's own sign band on generated (non-GLB) monuments, because openings are detected only on model glass

## 5. Iconic street-level retail (top 15 of 60; full list with sources in the JSON)

The list uses open data only: OSM, Wikidata, RCE, Wikipedia/Commons and the businesses' own sites, with a source URL for each item. Each item is scored as route weight × still open × ride visibility × verification. The score is lowered where a bespoke model, a market kit or a measured front already stands.

| # | name | now (verified) | game today | ride | route |
|---|---|---|---|---|---|
| 1 | Dappermarkt | daily street market | generic facades, no stalls | on route | market-stall-kit |
| 2 | Café de Sluyswacht, Jodenbreestraat 1 | café in the leaning 1695 lock house | brownBar template on a generated wall | on route | bespoke-landmark |
| 3 | Lindenmarkt (Lindengracht, Sat) | open | open space | on route | market-stall-kit |
| 4 | Westerstraat market (Mon) | open | open space | on route | market-stall-kit |
| 5 | Nieuwmarkt market | open | open space | on route | market-stall-kit |
| 6 | In 't Aepjen, Zeedijk 1 | brown café in a timber house | brownBar template | on route | bespoke-landmark |
| 7 | De Drie Fleschjes, Gravenstraat 18 | proeflokaal | generic facade | on route | historic-shopfront-kit |
| 8 | Jacob Hooy & Co, Kloveniersburgwal 12 | herbalist since 1743 | generic facade | on route | historic-shopfront-kit |
| 9 | Vleminckx, Voetboogstraat 33 | fries hatch | frites template | on route | ground-floor-fit |
| 10 | Bloemenmarkt, Singel | floating flower stalls | open space | seen | market-stall-kit |
| 11 | Noordermarkt (Sat/Mon) | open | open space | seen | market-stall-kit |
| 12 | Café 't Papeneiland, Prinsengracht 2 | brown café since 1642 | brownBar template | on route | historic-shopfront-kit |
| 13 | P.G.C. Hajenius, Rokin 96 | cigar shop, 1915 interior | tobacco template | on route | historic-shopfront-kit |
| 14 | Concerto, Utrechtsestraat 52-60 | record store | block-face GLB, tenant hidden | on route | ground-floor-fit (retail-fit) |
| 15 | Van Stapele, now Rokin 17 | moved from Heisteeg | bakery template at the old address | on route | ground-floor-fit |

**Surprises the research verified:**
- Van Stapele has moved to Rokin 17.
- The former V&D on Kalverstraat is now La Place and a Zeekr showroom.
- Maison de Bonneterie has been H&M since 2021.
- Metz & Co closed in 2013; its current tenant is unconfirmed.
- The American Hotel is now the Clayton; Café Américain still trades.
- Brandmeesters has moved to Maasstraat 84.

Tuschinski, Magna Plaza, the American Hotel and De Hallen already have bespoke models. Their tenants are hidden, so they are retail-fit candidates rather than modelling work.

## 6. Round 3: chunk hosts, Magna Plaza, register puis

### Stored openings and the block-face chunk adapter
- `stage-openings.ts` measures a model's ground openings once from its GLB and stages them in `retail-fits.json` (`openings`). The runtime then skips the glass search, so a city-look material swap or a merged street chunk can no longer hide the glass.
- A chunk's openings each record their pand (the GLB's `pandRanges`). The fit mesh carries `pandRanges` too (browser: `geometry.userData.pandRanges` plus an index; node: `prim.extras.pandRanges`), so the chunk's own per-pand lift moves the fit with its house.
- `node-frame` appends a chunk's fit primitives into the chunk GLB before `separateChunkPands`.
- The opening merge now also needs a vertical gap under 0.15 m, so ground and first-floor glass no longer fuse into one tall arch. Side effect: the American Hotel's corner opening is now 1.3 x 2.0 m instead of 1.7 x 5.3 m (more correct; this came after its blind).
- A fit may name its opening by id (`opening: "<bearing>:<u>"`); otherwise it matches the nearest opening within 2.5 m of `at`.

### Concerto (chunk-face-utrechtse-48-76), published
- Five fits by opening id: dark glass #2a1d10, record-sleeve goods, an oxblood frame #5a1a17 with a transom, cream CONCERTO glass letters. Blind: won 2/2 (med, med).
- The judge's notes: the sleeves are too saturated (the photo is pale and monochrome); a second CONCERTO is unconfirmed; the corner template still says WIJNHANDEL where the photo shows WE ARE LABELS OUTLET (that is a template front, not this lane's).
- Other chunk hosts on the iconic list: none. 't Mandje is a recipe GLB, and the rest are bespoke.

### Magna Plaza, published
- The ground shop windows were in the `dark` frame material, so no glass was found. The retag (`scripts/retail-fit/magna-plaza-glass-retag.patch`) gives them a new palette colour, `glassShop` (#303b43, slot glass).
  - The name must start with "glass": geometryAudit's OPENING_MATERIAL regex decides what snapOpenings treats as an opening, and a first try named `shopGlass` changed the geometry.
  - The rebuilt GLB is geometry-identical: sorted triangle-multiset hash 0902780908ffcbdf, 23,852 triangles before and after; dark 7,616 → 5,824, glassShop 0 → 1,792. The unchanged builder reproduces the committed GLB exactly. `check:manual-landmarks` passed (505 landmarks).
  - The GLB rebuild is integrator-owned, so the patch is NOT applied on this branch. Because the geometry is identical, the 32 openings staged from the retagged GLB fit the committed GLB too.
- Panorama reads (2023-01 and 2025-01) are in `artifacts/retail-fit/photos/walls/0363100012167578/`: 24 window reads with tones from `wall-points.ts`. Mango has letters and pink SALE posters, a clothes rail in one window, and the rest is plain dark glass.
- Only 11 of the 24 reads land within 2.5 m of an opening: the builder spaces the bays at 5.3 m, not at the real window rhythm (a model gap, reported rather than fitted).
- Blind: fit won 2/2 (Spuistraat low, Nieuwezijds Voorburgwal med). Judge notes: too few posters, MANGO not legible at that distance, the treatment covers only some bays.

### Geldmaat panel and Rijksmuseum poster
- The Geldmaat panel and glass were re-measured to #97a6a6 (source note in the JSON).
- Poster offset: checked at the rijksmuseum pose. The poster sits in the 4th arch in both the photo and the render, so nothing changed.

### Register-pui monuments: the brown bars (14)
- `src/canalRecall/retailFit/historicPui.ts` with `historic-puis.json`: 14 pands whose RCE register names the shopfront and whose template is brownBar, all staged. They use the same modes as the fits: the default draws published ones, `?retailFit=1` adds staged ones, `?retailFit=0` draws none.
- `retailFront.ts`, behind `input.host === 'historic-pui'`: no projecting board or cap. The name goes on the pui's own flush sign band, painted in the pui frame colour (the existing wall-mount path). With `host` absent, the output is unchanged.
- `threeBuildingMesh.ts` sets `host` from `historicPuiHost(b.id)` in `retailFrontOn` (the template path only).
- Node frames never install the shop-template extract (`decorateShopTemplate` is not called under nodeFrame/), so template fronts cannot be judged there: all 14 node pairs were byte-identical. The pairs were therefore shot in the browser instead: `house:frames --lists ...@retailFit=0, ...@retailFit=1 --query '?world=live'` (`artifacts/retail-fit/frames-puis-browser/`).
- 7 of 14 changed pixels (3.8–8.5 %). The other 7 were byte-identical: their pose sees another pand (Dokter's wall picks were all 0363100012175488), or the template front stands on a wall out of view (Arendsnest and others).
- Blind, one fresh opus judge, 7 sheets: board-less pui 1 win, template 2, tie 4, every call low confidence. At house-frames distances the board and the flat band are nearly indistinguishable.
- The photos split: Stoof has its name painted on the band (no board), while De Heeren van Aemstel (Leentje's pand) and Soho do have a projecting board or canopy. So "no fascia on a register pui" is not a safe rule for brown bars.
- All 14 stay staged (only `?retailFit=1`). The default is unchanged.
- Next: a per-pand read of the sign kind (painted band, board, letters on the glass) from a square-on crop, staged per pand in `historic-puis.json`, then a blind on close crops.

### Round 3 blind table
| Host | Pose | Verdict | Confidence |
|---|---|---|---|
| Concerto | concerto | fit | med |
| Concerto | concerto-koffie | fit | med |
| Magna Plaza | Spuistraat (288) | fit | low |
| Magna Plaza | Nieuwezijds Voorburgwal (107) | fit | med |
| Brown bars, register pui (7 visible) | browser rows | 1 pui / 2 template / 4 tie | all low; stays staged |

## 7. Round 4

### Brown bars: sign kind per pand
- Square-on crops (`all-walls.ts`, `artifacts/retail-fit/photos/puis/`) give each of the 14 pands a `sign` in `historic-puis.json`, with a `signSource`:
  - painted band: Leentje and Stoof;
  - letters on the glass: Elfde Gebod, Keffer, Tribe and 't Smalle;
  - board or awning, so the template stays: Soho, Arendsnest and Casablanca;
  - unread (no usable crop): Bar Du, Marcella (awnings), Dokter (the pose frames the next shop), Bar Blend and Rode Laars.
- `retailFront.ts` `host` is now `'historic-pui' | 'historic-pui-glass'`. The glass mode draws no word on the band and puts the name in cream on the widest window at about 0.6 of the glass height. `historicPuiHost` maps band to `historic-pui` and glass to `historic-pui-glass`; board and unread map to nothing.
- **Round 3's browser pui frames tested nothing.** The browser serves the committed `three-buildings*.bundle.js`, which did not hold the host branch, and the mesh worker never received `retailFit` (it is not on `engine/workerPool.ts` `withWorkerFlags`; added this round). Round 4 shoots with all four pool bundles built into a scratch `BUNDLES_DIR`. `game.json` confirms `three-buildings-worker.bundle.js?retailFit=1`.
- **What changes.** With the right code, the host moves at most 0.11 % of each frame (Leentje, Stoof, Tribe). Keffer, Elfde Gebod and 't Smalle show no change in view. `retailGround=0` vs `1` on the same poses changes 5–31 %, so fronts are drawn in view.
  - On a close crop (Stoof), the brownBar template already draws a near-flush dark band. Dropping the "board" changes little more than the lettering face.
  - The visible gap is the whole template pui: a dark glazed front with bottle shelves, where the photo has the building's own white small-paned sash windows and the name painted in script on the band.
  - The useful next step for register-pui bars is a host that draws no template pui at all: the building's own windows stand, and only the painted name goes on the band. That is a larger change than a sign swap.
- Close-crop blind, cropped to the changed pixels (`scripts/retail-fit/diff-crop.mts`), one fresh opus judge: the host won 3/3. Leentje low (its photo crop frames The Bolster next door), Stoof low (near a tie), Tribe med (glass mode: no fascia, as on the photo).
- The judge's shared verdict: both renders put a dark fascia and plate over a dark glazed bar front with bottle shelves. Neither can say red script neon on the brick, gilt letters on the upper front, etched letters on cream cast-iron glazing, or the cream small-paned windows these fronts have.
- All 14 stay staged.

### American Hotel corner and byte identity
- Re-blind with the current openings, one fresh opus judge: Bar Américain fit (low), Leidsekade fit (med).
- `RETAIL_FIT=0` node frames are byte-identical to round 2 for all 7 Hirschgebouw, Kinkerstraat, Damrak and Nieuw-Engeland poses.
- The two American Hotel off frames differ by 0.13–0.21 %. That is exactly the published Hirschgebouw fits across Leidseplein (round 2's off frames were shot at the default mode: `retailFit` 2,776 triangles in their counts, none now). Not a regression.

### Concerto
- Sleeves desaturated to the photo's pale, near-monochrome display. Re-blind: concerto fit (med), concerto-koffie fit (med-high). The judge still saw a uniform grey grid.
- After that blind: each sleeve now sits a little high or low on its rack, and now and then a print two sleeves wide stands in the row (unblinded, minor).
- WIJNHANDEL is not retail-ground's. It is the block-face lane's intent for Utrechtsestraat 50 (pand 0363100012178874), in `scripts/block-face/faces/utrechtse-48-76/intent.json`:
  - line 99 holds the sign text;
  - lines 101–103 hold the groundFloor name ("Wijnhandel Neleman", from a stale OSM node), the note and the signage.
  - The 2025-01-20 panorama (b_20250120_0926_Track30_Sphere_00286/00287) shows WE ARE LABELS OUTLET on that grey front.
  - Fixing it means a block-face edit and a re-bake of the chunk GLB, so it is not done here.

### Magna Plaza bay rhythm
- Written up for the landmark lane in `docs/reports/magna-plaza-bay-rhythm-20261120.md`. Retail-fit stops there.

### Round 4 blind table
| Host | Pose | Verdict | Confidence |
|---|---|---|---|
| American Hotel | Bar Américain | fit | low |
| American Hotel | Leidsekade | fit | med |
| Concerto (desaturated) | concerto | fit | med |
| Concerto (desaturated) | concerto-koffie | fit | med-high |
| Brown bars, close crops | Leentje | host | low |
| Brown bars, close crops | Stoof | host | low (near tie) |
| Brown bars, close crops | Tribe (glass) | host | med |

## Wiring (for the integrator)

- Add `src/canalRecall/retailFit/retailFit.test.ts` to `test:shopfront-gate` in package.json.
- Rebuild `public/canal-drive/js/signature-landmarks.bundle.js` (`node scripts/build-3d-bundles.mjs`), because `signature-landmarks-source.js` now calls `attachRetailFit` at the full level.
- No GLB, LOD or covers rebuild is needed.
- Round 2 is default-on for published reads (Hirschgebouw about 3,070 triangles, American Hotel about 1,200, full level only). `?retailFit=0` is the off switch, and `?retailFit=1` shows staged reads.
- Node frames (house:frames) of these two models change by default; `RETAIL_FIT=0` restores the old frames byte-for-byte.
- Tools: `scripts/retail-fit/{census,bay-strip,blind,iconic,glass-tone,region-tone,openings-probe}.ts`, poses in `scripts/retail-fit/poses*.json`, and node-frame with `RETAIL_FIT=0|1`.
- Round 3: rebuild the building bundle as well as signature-landmarks, because `threeBuildingMesh.ts` now imports `retailFit/historicPui.ts` (with `historic-puis.json`, a few KB) and `retailFront.ts` gained the `host` branch.
- Round 3, Magna Plaza (optional, for the game's own glass search and so other consumers see glass): `git apply scripts/retail-fit/magna-plaza-glass-retag.patch`, then `node --import tsx scripts/landmarks/build-manual-landmarks.ts --only=magna-plaza`, then LODs for magna-plaza, then build covers, then `check:covers` and `check:manual-landmarks`. Then rebuild the signature-landmarks bundle. The fits work without it, from the staged openings.
- Round 4: `src/canalRecall/engine/workerPool.ts` adds `'retailFit'` to `withWorkerFlags`, so `?retailFit=0|1` reaches the mesh workers. Rebuild the pool bundles (`build:canal-three-buildings`, the engine bundle and own-ground-game) together.
