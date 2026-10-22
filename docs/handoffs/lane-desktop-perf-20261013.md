# Lane: desktop ride performance after the 2026-10-13 merges (perf, 2026-10-13)

User 2026-10-13: "I think there's still perf work to do btw". Desktop is
~10x as important as the phone (user); the iPhone profile is recorded as
pending, not measured here. Today's merges each claimed "within noise" on
their own: the fixed sun (vehicles re-aim per frame, shadows on), the mood
pass, roof/facade tiers, 105,646 sheds, measured roof furniture, the POI
label DOM overlay (budget, occlusion ray tests per frame), the highlight
marker, own-ground cells, the HUD tuck listeners, labels `hitTest`.
Together they may not be. Nobody has profiled the whole ride since.

Inputs: `scripts/ride-perf-fixed-route.mjs` (Anne Frank Huis →
Rijksmuseum, map render / three layers / draw calls / heap),
`tests/e2e/ride-perf.spec.ts`, `docs/performance/` (method, earlier
numbers), the memory note on profiling (CDP `Profiler.start` stalls
~1.7 s; ignore), `docs/archive/research/own-renderer-spike-20261009.md`. Lane owns
the perf scripts, `docs/performance/desktop-20261013.md`, and the fixes it
makes in the modules it names (one commit per fix, each with its own
before/after); ≤ 10 reported lines in `vector-map.js`. Do not edit
`game.js`, `index.html`, `package.json`, bundles, `TODO.md`, `HISTORY.md`.

## Deliverables
1. **Profile the ride** on desktop (1440×900, chase view, the fixed route;
   then the same with `?ownGround=1`, with `?sharedFrame=1&cityLook=1`,
   and an aerial hold at 300 m): per frame, ms by owner (MapLibre render,
   each three.js layer, the label overlay's plan/occlusion/DOM writes,
   HUD canvas, own ground, GC), draw calls, resident triangles, heap; and
   the long frames (> 33 ms) with their cause (cell load, chunk compile,
   texture upload, shadow redraw, label replan).
2. **Fix the top three** by measured ms. Candidates to check, not assume:
   labels (ray tests per frame → only on camera change, cap candidates),
   vehicle light re-aim per frame, shadow map redraws, roof-furniture
   extras in the near tier, sheds in the mid tier, highlight marker
   redraws, HUD tuck mousemove handler (passive, throttled), own-ground
   ribbon rebuilds, the three-buildings worker's message sizes.
3. **A budget table** in `docs/performance/desktop-20261013.md`: median
   and p95 frame, ms per owner before/after, and a line per flag; the
   ride-perf spec pinned at the new numbers with slack.

## Checks
`npm run lint`, the unit tests of every module touched,
`PW_PORT=<yours> npx playwright test ride-perf --project=desktop`, and
the e2e specs of the modules touched (labels, highlight, own-ground-game,
building-look). Report: branch, SHA, the table, each fix's before/after,
unfinished.
