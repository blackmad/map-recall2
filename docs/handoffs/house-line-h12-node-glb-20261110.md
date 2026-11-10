# Lane H12: GLB first passes without a browser (opus, 2026-11-10)

**User, 2026-11-10:** "could we be doing more entirely outside of a browser? like the first passes of looking at a GLB
can be browser-less no?"

## Why

- **Generic houses are already browser-free.** `house:preview` renders them in Node through
  `src/canalRecall/houseSpec/softRaster.ts`, in about 3 s and with no lock.
- **GLBs still need Chromium/SwiftShader.** Every GLB first pass goes through `scripts/building-recipes/render.ts` or a
  page script. That covers:
  - block-face `review`, `auto-place`, `batch` and `draft-preview`;
  - `large.ts` contact sheets and the `install-large` likeness gate;
  - `house:preview --recipe`;
  - landmark `kit-sheets`, `review-sheet`, `landmark-views` (gallery-card orbit), `*-strip.ts` and `big-camrender`;
  - `coverage/build-look-thumbs.ts`;
  - `building-types/camera-sheets.ts`.
- **That puts the builders in the lock queue.** Belt builders now go through the recipe route (GLBs), so every look at a
  house waits for a browser slot.

## Deliver

1. **`src/canalRecall/glbRaster/`, a pure Node GLB renderer.**
   - **Load:** `@gltf-transform/core`, with meshopt via `meshoptimizer` (already installed for the lods; check), and
     KHR_texture_transform and KHR_materials_emissive where we use them. Read vertex colours, base-colour factor and
     texture, and alphaMode MASK. Images decode through `@napi-rs/canvas`/`sharp`.
   - **Flatten:** to softRaster's triangle input, with per-primitive material colour and an optional texture.
   - **Raster:** reuse softRaster's loop and z-buffer, with ortho and perspective, supersampling and back-face rules
     per material `doubleSided`.
   - **Lighting:** the game's lit look (`look/cityLook.ts` rig: Lambert flat, sun, hemisphere, sRGB) and the
     "gallery" light of `landmark-views`. Shadows are optional and off by default.
   - **No DOM and no globals.** It must be byte-deterministic.
2. **One view vocabulary** (`glbRaster/views.ts`), the same JSON as `landmark-views.mjs`:
   - `front` elevation at N px/m on the BAG wall, in the same axis as `rectify.ts rectifyWall`, so the photo and the
     render overlay;
   - `threeq`; `orbit theta/phi` (gallery card, top, back); `street x/z/h/fov/pitch`;
   - a fixed sheet layout of the gallery card plus front, top and back.
3. **Call sites move to Node by default, with `--browser` keeping today's path:** `render.ts` callers, `large.ts`
   sheets and the likeness gate, `house:preview --recipe`, block-face review/auto-place/batch/draft-preview, landmark
   kit-sheets, review-sheet and landmark-views, build-look-thumbs and camera-sheets. Move the high-traffic ones first.
   List any you leave and why.
4. **Node audits stay where they are.** The GLB audit (`glbQuality.ts`: opening-outside, zfight-tight,
   geometry-regression) is Node already. Make sure no install step launches Chromium for a check that is not a
   picture.
5. **Agreement report.** Render the same GLBs both ways and run `measureFacade` (houseLine) on both, plus
   `likenessVerdict`:
   - 10 recipe canal houses (include Nassaukade 506 and Haarlemmerdijk 6);
   - 5 block-face chunks;
   - 5 large recipes (include Houthavenkade 26);
   - 5 landmarks (one with alpha leaves or glass).

   Report ΔL, hue, glazing share, columns and the verdict. Put the pairs side by side on one sheet.
6. **Documentation.** A `docs/house-line.md` section "§8 Browser-free GLB passes": what is Node, what still needs the
   browser, and the flag. Add a `HELP` constant per new command, and a CLAUDE.md line under House line: "first passes
   are Node; browsers are for in-game frames (house:frames), rides and timing."

## Gates

- **Agreement:** verdicts equal on ≥ 23 of 25. Median ΔL ≤ 0.02 and hue ≤ 3° on the facade region; columns equal.
  Every disagreement gets a written cause (for example SwiftShader mip or alpha), and the Node side is fixed where
  it is wrong.
- **Speed:** the 4-view gallery sheet of a canal-house GLB in under 2 s warm on the user's Mac, and a large recipe in
  under 10 s.
- **The lock is out of first passes:** a `large.ts` run and a block-face `review` complete with `/tmp/canal-pw.slot*`
  held by another process.
- Determinism: same bytes on two runs; unit tests for the loader (meshopt, vertex colours, MASK) and the view maths.
  `check:canal` green; no runtime change.

## Not in scope

In-game frames (H10 `house:frames`), rides, perf and the game-structure smoke stay in the browser. The final
"gallery size from all sides" release review can use the Node orbit once agreement passes. Say in the hand-back
whether it should.

## Rules

- `/usr/bin/git`, with a worktree from `scripts/worktrees/new.sh`.
- Browser runs only for the agreement report: through `/tmp/canal-pw.sh` with a private `PW_PORT`.
- A sparse source-data worktree, and screenshots as a worktree of `~/Code/map-recall2-screenshots`.
- No edits to the integrator's hotspots; list the `package.json` lines in the hand-back.
