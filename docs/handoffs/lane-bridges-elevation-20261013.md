# Lane: real bridge elevation and deck geometry (ground, 2026-10-13)

User 2026-10-13, with a screenshot of the bridge by the Westerkerk under
own ground: "I thought we were going to try to model real bridge
elevation"; the deck is a flat grey slab whose edges float over the water,
its railings are a thin dark line hovering beside the road, the approach
roads tear where they meet the deck, and the quay walls stop short of the
abutments. Landed data: 931 measured bridge profiles (AHN DSM, HISTORY
2026-10-13 "Own-ground data"), 729 earlier measured decks, per-polder
water levels, BGT widths. `docs/elevation.md`, `src/canalRecall/ownGround/*`,
`scripts/check-canal-car.ts` (bridge segments), the bridge sweep
(3,006 crossings). Lane owns the bridge deck/railing/abutment drawing under
`src/canalRecall/ownGround/`, the bridge data joins, and the ground
harness; ≤ 20 reported lines in `vector-map.js`. Do not edit `game.js`,
`index.html`, `package.json`, bundles, `TODO.md`, `HISTORY.md`. Behind
`?ownGround=1`; the physics corridor (`ROAD_WIDTHS`, routing) must not
change unless the deck height does, in which case the rider's y must follow
the measured profile and `test:canal-car` must stay green.

## Deliverables
1. **Humped decks from the measured profiles**: every bridge with a
   profile rises and falls along its axis as measured (clamped to sane
   grades), the road band drapes on it, the rider follows it (speed feel:
   small slow-down up, free-wheel down, already in the physics? check
   `game.js` slope handling and report).
2. **Deck edges attached**: deck width from BGT `wegdeel`/`kunstwerkdeel` or
   the measured width; abutments as vertical faces down to the water
   level; quay walls meet the abutments; no floating edges. Railings as a
   simple post-and-rail band on both edges (Amsterdam green or the
   bridge's OSM colour where tagged), arches or piers only where the
   profile shows a span > 12 m (cheap: one arch segment set).
3. **Movable bridges** (110 in the sweep): a visible counterweight/portal
   frame as one shared unit placed at the OSM `bridge:movable` side.
4. **Named regressions**: the Westerkerk bridge (Rozengracht/Prinsengracht),
   Raampoort, Ryckerbrug, BRU0166, BRU0044, BRU0067, the Magere Brug, the
   Blauwbrug — each pinned in the harness with deck height and attachment
   checks; before/after shots at 1.7 m and from the air.

## Checks
`npm run lint`, `npm run test:canal-car`, the ground harness, the own-ground
e2e; report: branch, SHA, how many bridges got humps/edges/railings, shots,
perf delta on the fixed route, the `vector-map.js` lines, unfinished.
