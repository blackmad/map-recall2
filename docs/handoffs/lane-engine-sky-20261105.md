# Lane E3: the sky flickers under the own engine (2026-11-05)

Worktree `/Users/blackmad/Code/map-recall2-worktrees/engine-sky-20261105`, branch `lane/engine-sky-20261105`, port 4622. Plan: #213 (item C).

The user sees the sky flicker while riding with `?engine=own` on this Mac in Chrome. Nobody has captured it yet.

## Diagnose first
Capture 20 s of consecutive frames at a sky-heavy pose (chase camera at the lowest pitch that shows sky, and the overview) under own, headed Chrome on this Mac (headless SwiftShader may not reproduce a compositor issue; try both). Diff consecutive frames in the sky region and count the frames whose sky differs. Then A/B each hypothesis and report which one moves the number:
1. `renderOnChange` (`engine/frameHost.ts`): a still frame is not redrawn and the canvas keeps the last one; with `preserveDrawingBuffer` false the compositor may present an undefined back buffer where only the clear colour (the sky, `clearColor` from `look/sunny.ts` `mapLibreSky()`) was. A/B `?renderOnChange=0`.
2. The overview land plane (`engine/overviewLayer.ts`, `frustumCulled = false`, drawn to the horizon) against a far plane recomputed every frame (`engine/cameraMap.ts:186`, `far = furthest × 1.01 + elevation`): the horizon line z-fights or jitters as far changes. A/B a far plane held at a fixed multiple.
3. The depth-fade fog (`rendererShared/sharedFrame.ts:217`, `THREE.Fog(SKY.horizon, 1e7, 2e7)`) and the clear colour disagreeing at the horizon at some tilts; A/B `?depthFade=0`.
4. Anything the capture shows instead (a full-screen pass such as `toonLook` or the post hooks, the overview layer's near-radius uniform, the label layer clearing).

## Fix the one that moves the number
Keep it typed and behind a flag. Pin it: a spec that rides 20 s at the named pose and asserts the sky region's frame-to-frame diff is 0 px (allow the clouds if there are any), desktop under own; include the MapLibre engine as the reference. Report the capture frames (a contact sheet) on the lane issue.

## Rules for every engine lane (2026-11-05)
- Work only in your worktree (given above), on your branch, with `/usr/bin/git`. Never `git stash`, never `pkill`; stop your dev server by the PID on your port. Never `npm install` in the shared checkout.
- Do not edit integration hotspots: `game.js`, `index.html`, `package.json`, lockfiles, generated bundles under `public/canal-drive/js/*.bundle.js`, `TODO.md`, `HISTORY.md`, `whats-new-notes.json`, `budgets.json`. Put new tests in `src/` next to the module; tell the integrator which npm test script and which bundle build they belong to.
- Browser runs go through the shared lock: `PW_PORT=<your port> /tmp/canal-pw.sh perl -e 'alarm 2400; exec @ARGV' -- npx playwright test <spec> --project=desktop --workers=1 --trace off --reporter=line`. One run at a time per lane. Timing measurements (stutter, heap) use `CANAL_PW_EXCLUSIVE=1`.
- The own engine is `?engine=own`; the default is still MapLibre. Measure both when the change can touch both.
- Acceptance is a measured ride or a pinned spec, not a strip. Every fix gets a named regression location and a flag to turn it off (`?x=0`) so the integrator can A/B it.
- Hand back on your lane issue as a comment: branch + SHA (pushed), what changed, numbers before/after, the bundles to rebuild, the tests to wire, and what is still open. Then stop. The integrator merges; do not merge main into your branch unless you need something from it (then say so).
- The user plays on this Mac in Chrome and on an iPhone. "Works in the strip" is not done.
