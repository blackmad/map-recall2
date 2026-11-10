# Lane H10: `house:frames`, photo-matched in-game frames (opus, 2026-11-10)

**User, 2026-11-10:** "do we need a better review strategy for these? are we building them in game to check or
independently?", then "build that frame tool and then start up builders".

## Why

Every house check today is independent of the game. `install-large` renders a GLB elevation in SwiftShader and
`likenessGate` compares it with a rectified crop. `house:preview` renders through the game's chunk code, but still as a
flat elevation. Ride frames come only at the end, a few demo spots at a time. The failures the user keeps catching are
in-game-only:

- the Nassaukade corner 116526 drew as a blank wall in the ride (another model's cover), while its elevation was fine;
- roofs offset from their walls (user shots 2026-11-08);
- the lit look drawing GLB fronts about 0.1 L darker;
- far shells drawing every gable plain;
- neighbours, trees and the camera itself.

`house:frames` puts the game camera where a panorama was taken, looking where the panorama looks. It renders one frame
and sets it beside the panorama cut to the same heading, pitch and field of view. Builder lanes are accepted on these
pairs; the elevation verdict becomes a pre-filter.

## What exists (reuse, do not rewrite)

- **Panorama pick:** `scripts/pand-reference/select.ts` (`pickWall`, `listPanos`, `rankPanos` with `FACADE_WINDOW`
  5–35 m and obliquity ≤ 55°; `PanoPick` carries `timestamp` and `missionYear`).
- **Panorama cut:** `scripts/pand-reference/rectify.ts aimedThumbnail` already cuts a perspective view aimed at the
  wall centre from the public thumbnail endpoint (`fov`, `heading`, `pitch`, cached). Extend it to take a fixed
  heading, pitch and FOV, and to return the camera position (`record.geometry.coordinates`) and its height (the record's
  camera height, `FALLBACK_GROUND_NAP` rule as in `rectifyWall`).
- **Game camera:** `tests/e2e/demo-shots.spec.ts` (`teleport`, cockpit view, `standpoint`); `tests/e2e/helpers.ts`
  `settleWorld` (use it; never a fixed timeout, memory "held-sync specs measure the harness");
  `src/canalRecall/engine/fpsCamera.ts` and `ownWorldView.ts` (the first-person lens, `fovDeg`).
- **Browser runs:** `/tmp/canal-pw.sh` and a private `PW_PORT`, as for every Playwright run.

## Deliver

1. **`npm run house:frames`** (`scripts/house-frames/frames.ts`, a `HELP` constant, a Playwright driver under
   `tests/e2e/house-frames.spec.ts` or a direct `chromium` script; your choice, justified in the doc).
   - Input: `--pands id,id` | `--face <block-face id>` | `--buurt <code>` | `--list file.json`, plus
     `--year <yyyy>`, `--season winter|any` (winter = Nov–Mar captures first), `--query '<game query>'` (e.g.
     `?world=live&houseSpecs=0` for before/after), `--label before|after`, `--out <dir>`.
   - Per pand: pick the street wall and the panorama (lowest foliage first, then rank), choose one pose per panorama
     (heading at the wall centre, pitch and FOV from `aimedThumbnail`'s rule, clamped to the game lens' range).
   - One browser page for the whole list: open the route once, then for each pose teleport, set the first-person
     camera to the panorama's position, eye height, heading, pitch and FOV, `settleWorld`, screenshot. Re-open the
     page only when it crashes or after N poses (memory pressure).
   - Write `<out>/<pand>/{photo.jpg, game.jpg, pair.jpg, pose.json}` and `<out>/contact-N.jpg` sheets (6 pairs per
     sheet, desktop 1440 × 900 source, pairs at equal size, a caption with pand, address, panorama date, distance, the
     route the game drew and the query).
2. **Alignment check** (this is what makes the pairs trustworthy): project the pand's BAG wall outline (footprint edge
   × tile height) into both images with the same pose, and draw it as a thin line on both halves of `pair.jpg`. In
   `pose.json`, record how far the panorama's facade edges sit from the projected outline (edge offset in % of image
   width; a vertical-edge detector on the photo is enough). Report the distribution; investigate any pose > 3 %.
3. **Automatic flags** (cheap, advisory, printed on the caption):
   - blank wall: the game frame's projected wall has no openings (H2d's opening count) where the photo has ≥ 2;
   - missing or extra building: the projected outline is sky or ground in the game frame;
   - roof offset: the game's roof edge sits more than 1 m from the projected crown line;
   - wall colour: `measureFacade` (houseLine profile) on the projected wall region of both halves; advisory until the
     H2e clusterWall fix and H9 round 3 land.
4. **Reviewer checklist** in `docs/house-line.md`, new section "§7 Review in the game": what a reader checks on each
   pair (crown and gable type; storeys; window axes; colour family and darkness relative to the neighbours; blank or
   missing walls; roof offset; shopfront; anything the photo shows that the kit cannot say, which goes to the kit-gap
   queue). One line per item, with the H5h reader ceilings next to the countable ones. Say that builders are accepted
   on these pairs read by opus or a human, not on the elevation verdict, and that sonnet does not accept its own pairs.
5. **Docs and tests:** `--help` from `HELP`; `test:house-line-docs` lists the new command; a unit test for the pose maths
   (RD/WGS84 → game coordinates, heading, eye height) with two pinned poses.

## Validation set (each known defect must be visible in its pair)

| Case | Expect |
|---|---|
| 116526 Nassaukade corner, `?houseSpecs=0` world before H7 | the blank wall shows, flag fires |
| Nieuwmarkt 4–22 row (the user's 2026-11-09 photo pose) | register gables visible, crowns match |
| Nassaukade 145–152 (H7's row) | before frames; after frames once H7 publishes |
| 169916 (H1c, three windows) | 3 columns in game and photo |
| Houthavenkade 26 (large recipe, 12 of 510 surfaces) | the missing surfaces show |
| two roof-offset shots from 2026-11-08 (screenshots repo, `user-shots`) | the offset flag fires |
| 15 walls from the #341 blank-wall audit (top 5, 5 random seed 341, 5 worst landmark) | the false-positive rate of that audit, read from the pairs (this was #341 P2) |

## Gates

- Alignment: median edge offset ≤ 2 % of image width over the validation set, none above 5 % without a written cause.
- Throughput: ≥ 8 pairs per minute in one page on the user's Mac, under `/tmp/canal-pw.sh`.
- Every validation case shows its defect; the #341 sample yields a false-positive rate with the 15 pairs attached.
- `check:canal` green; no change to the game's runtime (the tool only drives it); no new browser globals in `src/`
  except a documented debug hook if the camera cannot be set from outside (keep it behind the existing debug object).

## Rules

`/usr/bin/git`; your own worktree via `scripts/worktrees/new.sh`; a private `PW_PORT`; browser runs serialised through
`/tmp/canal-pw.sh`; stop your dev server by its port's PID; panoramas are fetched through the existing cache (no new
bulk fetch over 2 GB without asking the integrator); sheets go to the screenshots repo as a worktree of
`~/Code/map-recall2-screenshots`, source refs to a sparse source-data worktree (`scripts/worktrees/new-source-data.sh`).
Hand back a commit SHA, the validation table filled in, the gate numbers and the contact sheets. Do not edit the
integrator's hotspots (`package.json` script line: list it in the hand-back; TODO/HISTORY).

## After it lands

Builder lanes (canal belt restart, ring buurten, then a Houthaven opus pilot) take `house:frames` before/after
pairs as their acceptance evidence. The integrator runs the frames for a batch at publish time.
