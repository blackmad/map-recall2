# Feedback verify, 2026-11-19

This report checks the 31 ride and building-page notes that `docs/reports/feedback-triage-20261116.md` left open.
For each note I asked whether current main (a0d12ae87e) already fixes it. David wrote on #396 that many are probably
done. Measured against frames, 4 are fixed, 3 are partly fixed and 24 are still open.

## Method

- **Queue.** `npm run feedback:queue -- pull --status open` returned 31 notes, each with its screenshot and pose.
- **Frames.** I took frames at each note's pose on this branch's main checkout, using
  `scripts/feedback/pose-pick-shots.mjs` (dev server on 4741, through `/tmp/canal-pw.sh`, desktop, own engine,
  Free Ride, the note's building look). Each note was framed twice:
  - with the chase camera at the note's `mapCenter`;
  - with the camera detached at the note's camera and the rider at the note's player offset (pose suffix `d`).
- **Bearings.** The photo-look notes of 2026-11-10 had a detached camera whose rotation was not recorded. I estimated
  their bearing (about -50°) from the north arrow on each note's minimap (pose suffix `b`).
- **Picks.** The harness also picks the building under the note's anchor the way a tap does (`inspectBuilding`).
- **Fixes since the notes.** I checked `git log bc4ad8a..main` (684 commits) for fixes. Since the triage on
  2026-11-16, main has gained only ground-floor, shop and chain-logo work. None of it touches these places.
- **Framing caveat.** Most chase frames sit a little further back than the user's camera, because the user's camera
  was still easing. Where the target was visible, I compared full-resolution crops.

**Evidence.** Every note's screenshot beside its current-main frame is in `blackmad/map-recall2-screenshots`, branch
`feedback-verify-20261119`, folder `feedback/2026-11-19-verify/` (`<id>-note-vs-now.jpg`, plus `crop-*.jpg`). The raw
frames are in this worktree's `artifacts/feedback-verify-20261119/desktop-<id>[d|b]-now.jpg`, which is gitignored.

## Verdicts

| Note | Place | Verdict | Evidence / what is still wrong |
|---|---|---|---|
| 71028a | De Clercqstraat bridge, Bilderdijkgracht | **FIXED, resolved** | 6fa88ec421 (quay walls cut at the bridge opening). The arches are open and the quay wall no longer runs through them (`crop-71028a.jpg`). |
| 704240 | Building at Tweede Kostverlorenkade (the El Tawheed note) | **FIXED, resolved** | A tap at the anchor now picks pand 0363100012075898, and the grey shed is a windowed block (F2 vetoes). The El Tawheed landmark itself is pand 0363100012137097, 180 m NE. |
| e3838e | Rembrandtpark bridge, red cycle path | **FIXED, resolved** | The red path is continuous across the bridge: no grey seam, no red speckles (`crop-e3838e.jpg`). Probably 89551e2768 (open-ground-v2, 2026-11-13 23:13). |
| 45abd3 | Piet Kranenbergpad, pale glass-grey boxes (photo look) | **FIXED, resolved** | The curved 2005 building now has window rows and brick (`45abd3-note-vs-now-bearing50.jpg`). |
| 4c1344 | Doelensluis | PARTLY | The deck now meets the pavement on the Nieuwe Doelenstraat side. A water notch still shows beside the near-left abutment, between the deck end and the quay (`crop-4c1344.jpg`). |
| 47d096 | Bellamyplein, yellow house in the north row | PARTLY | The yellow front now shows 3 window bays (it had 2). Its grey roof mass still reaches left past the front, over the brown neighbour, so the facade and the roof footprint still disagree (`crop-47d096d.jpg`). |
| 8022e3 | Slotervaart / Lelylaan, roofs blend into ground (photo look) | PARTLY | The open ground around the blocks is green now. The school at the anchor still has a pale beige flat roof on pale grey paving (`8022e3-note-vs-now-bearing50.jpg`). |
| 935a68 | Oost-Indische Huisbrug, Kloveniersburgwal | OPEN | Unchanged. The deck top is two-toned: a darker asphalt wedge meets the deck paving diagonally on the west half, and the far parapet kinks near the west end (`crop-935a68.jpg`). |
| 62d5a3 | Vijzelstraat tram rails | OPEN (unmeasured) | The frames look much like the note's. The tram pair follows the OSM tram way; nobody has measured its offset from the carriageway centre. |
| 3b8ca6 | De Clercqstraat bridge over the Da Costagracht | OPEN | Thin dark seam lines still cross the carriageway at the deck/street joints (`crop-3b8ca6.jpg`). |
| c16d34 | Torensluis | OPEN | The light-blue water slit still cuts into the wide deck on the far (north) side, and the deck still looks warped. |
| e058c8 | LAB111, Jacob van Lennepkade (1981 red block) | OPEN | The window boxes still stand proud of the brick as blue-grey boxes. No window-overlap fix has landed. |
| 1a223c | White block, Jacob van Lennepkade | OPEN | The window grid is unchanged (pick r3674867, 14.5 m). No relevant commit. |
| 18a9d3 | Slotervaart blocks (photo look) | OPEN | No overlap fix. The frame could not reach the corner at the note's bearing. |
| 0046bb | Osdorp 1955 rows (photo look) | OPEN | Same short, flat-topped boxes in mixed colours. |
| d99e51 | Postjesweg | OPEN | No fix for a projecting mass cutting through windows. The frame is too far back to see the corner. |
| f8f282 | Prinsengracht, near the Tulip Museum | OPEN | Pand 0363100012165018 (17.65 m) still has a generic uniform window grid on a dark-red canal-house front. |
| c361c8 | Building on the Kinkerbrug | OPEN | The small house still stands half over the water, with no deck or piles under it. No rule exists for buildings on bridges. |
| ee2b30 | Haparandadam | OPEN | A row of lamp posts still stands in open water off the dam. |
| eaf0aa | Spaarndammertunnel mouth | OPEN | The road still drops into an open trench with floating grey slabs across it. There is no portal or tunnel roof. |
| c57c04 | Noord, IJ bank (broken ground) | OPEN | There is still a translucent grey ground slab beside the quay. The note asks for a city-wide detector, which does not exist. |
| d18eca | START tag in the sky | OPEN | Code unchanged. The tag is drawn every frame while `hideStartTag` is false and the point is roughly on screen, however far the rider has gone (`road-network.js:848`). It sits `(w+20)*z` px above the projected point, so a far point near the horizon puts it at the top edge. The same tag shows in notes c361c8, 47d096 and 62d5a3. |
| 174f6f | OBA Spaarndammerbuurt | OPEN, now actionable | The building is still near-black. needs-david #385 is closed with "it's grey brick in the images", so it should become grey brick. |
| 13fa7f | Politiepost IJburg (building page) | OPEN | The GLB is byte-identical to the one the note saw (sha d8c6d391…): large blank red walls with only two window bays. |
| 347e64 | Politiebureau Oost Zeeburg (building page) | OPEN | The GLB is byte-identical (sha f57d540c…). The rear wall has fins but no windows. |
| 4b1114 | Schutterstoren | OPEN | No bespoke model in the repo. It draws as a generic grey cylinder. |
| ef65d8 | Schiphol terminals | OPEN | Generic, and outside the ride area. |
| deb3fc | "Why not" sculpture (Else Ringnalda), Nassaukade | OPEN | `street-art.json` n13410980119 has no image field (`i`). 447 of 1,428 entries have none. |
| e41668 | Osdorp long slab (De Vaart) | OPEN | The photo facade still repeats along the slab. |
| ba2f5b | Riekerpolder "industrial building" | OPEN (unverified) | Still looks the same at the estimated bearing. This is looks-programme work. |
| a9198f | Westerdok / Spaarndammerbuurt generic houses | OPEN | A programme-level look complaint (rows/buurt looks). |

Counts: 4 fixed and resolved in the queue (open → in-progress → resolved, each with a work note); 3 partly fixed
(left open); 24 open.

## Fix lanes for the open and partly fixed notes

### 1. HUD and tapping: d18eca (S)
- **Problem.** The START tag is drawn for the whole ride, wherever the start lies on screen.
- **Fix.** Hide the tag once the rider is more than about 50 m from `startPoint`, or after the first question. Also
  skip a screen label whose projected point is past the far plane or above the horizon.
- **Files.** `public/canal-drive/js/road-network.js` (`_drawScreenLabel`, line 848); the projector in
  `src/canalRecall/engine/ownWorldView.ts` (`projectWorld`).
- **Test.** Add a Playwright check in a guided ride, not Free Ride, which hides the tag.
- **Related.** 704240 is resolved. A small follow-up could tie the El Tawheed landmark card to the building the user
  tapped, if that building is in fact the mosque. The register says it is not.

### 2. Bridges: 935a68, 4c1344, 3b8ca6, c16d34, 62d5a3 (M-L)
- **935a68.** The Oost-Indische Huisbrug deck is two-toned: the street asphalt runs onto the deck in a diagonal wedge.
  Clip the street surface at the deck outline, or give the deck top one material.
- **4c1344.** At the Doelensluis, a water notch remains beside the near-left abutment. Close the quay/abutment gap at
  the deck end.
- **3b8ca6.** Dark seam lines cross the carriageway at the De Clercqstraat deck joints. These are likely T-junction
  slivers between the deck top and the road strip.
- **c16d34.** The Torensluis water slit is still unexplained (HISTORY rules out `WET_CLEAR_M`).
- **62d5a3.** First measure the Vijzelstraat tram-way offset from the carriageway centre, then snap the rails within
  tolerance.
- **Files.** `src/canalRecall/ownGround/` (decks, `wayDecks.ts`, quay walls, `groundCell.ts` tram layer,
  `railTracks.ts`), `scripts/check-canal-car.ts`, `bridge-feedback-pins.ts`.
- **Regressions.** Pin each bridge as a named regression.

### 3. Windows: e058c8, 1a223c, 18a9d3, d99e51, f8f282, 0046bb, plus 47d096 (M)
- **Overlap pass.** Write a generic pass that drops or clips openings which intersect a projecting mass (erker or
  annex) or a neighbouring building's box. Gate it like `check-glb-openings`.
- **LAB111.** Its window boxes stand proud and overlap where the wings meet.
- **47d096.** The facade run is shorter than the roof footprint. Draw the front over the full street wall of the pand.
- **f8f282 and 0046bb.** These are window-kind and roof-shape fidelity questions, so they need a photo.
- **Files.** `src/canalRecall/threeBuildingFeatures.ts`, `threeBuildingMesh.ts`, `blockBuilding/windowBox.ts`, and the
  row front in `houseLine/rowFront.ts` for 47d096.
- **Regressions.** Pin LAB111 (w44532021), r3674867, pand 0363100012104321 (Postjesweg) and 0363100012165018
  (Prinsengracht).

### 4. Ground: ee2b30, eaf0aa, c57c04, 8022e3 (M)
- **ee2b30.** Drop street furniture whose base is over water, or draw the pier/steiger under it.
- **eaf0aa.** Give the Spaarndammertunnel a portal and roof, and remove the floating slabs (see `tunnels.ts`
  clipMeshAtCuts).
- **c57c04.** Build a city-wide ground-anomaly detector from `check-ground-spots`, `probe-hole-junctions` and
  `check:rail-joins`, then fix what it flags at the Noord IJ bank.
- **8022e3.** Pale flat roofs on pale paving are a palette or contrast question for photo-look roofs.
- **Files.** `src/canalRecall/ownGround/`, the street-furniture placement source, `scripts/check-ground-spots*`.

### 5. Models: 174f6f, 13fa7f, 347e64, c361c8, 4b1114, ef65d8, deb3fc, e41668, ba2f5b, a9198f (S each; Schiphol L; looks are programme work)
- **174f6f.** Turn the OBA Spaarndammerbuurt brick to grey (David ruled on #385). Size: S.
- **13fa7f and 347e64.** Add windows to the blank walls of `recipe-large-politiepost-ijburg` and
  `recipe-large-politie-oost-zeeburg` (`scripts/building-recipes/houses/<name>/intent.json`, then rebuild). Size: S
  each.
- **c361c8.** Add a bridge-house rule: when a building footprint overlaps a bridge deck, sit it on the deck. Size: S-M.
- **4b1114.** The Schutterstoren needs a bespoke landmark. Size: M.
- **ef65d8.** Schiphol is out of the ride area. Size: L, low priority.
- **deb3fc.** Find a Commons image for "Why not", and sweep the 447 street-art entries that have no image. Size: S-M.
- **e41668.** Stop the photo facade tiling on long slabs: mirror or vary the tile, or fall back to the kit. Size: M.
- **ba2f5b and a9198f.** These belong to the rows/buurt looks programme.
