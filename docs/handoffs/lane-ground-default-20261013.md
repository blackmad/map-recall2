# Lane: own ground and BAG tiles toward default-on (ground/data, 2026-10-13)

Context: `docs/elevation.md`, `docs/research/own-ground-20261009.md`,
`docs/handoffs/lane-ground-data-20261013.md`, HISTORY 2026-10-13 "Own-ground
data" and "Migration steps 1 and 2 behind flags"; TODO "Own ground in game
behind `?ownGround=1`" and the BAG-tiles paragraph. Landed: per-polder water
levels, BGT widths per way, 931 measured bridges, `?ownGround=1`,
`?bagTiles=1` with `covers.json`. Desktop first (user: ~10× iPhone); the
iPhone measurement is pending and is recorded as such, not blocking.
Lane owns `src/canalRecall/{ownGround,bagTiles,bagPandIndex}*`,
`scripts/build-covers.ts`, `scripts/check-covers.ts`, the suppress lists in
specs where it prunes stale ids (catalogue edits allowed for *removing*
stale `suppressOsmIds` only, reported as a diff), e2e. Do not edit `game.js`,
`index.html`, `package.json`, bundles, `TODO.md`, `HISTORY.md`; the default
flips are the integrator's call — report the evidence.

## Deliverables
1. **Desktop ride-perf** for `?ownGround=1`, `?bagTiles=1`, both, and
   neither, on `scripts/ride-perf-fixed-route.mjs` and at the three named
   ground regressions (BRU0166, BRU0044, BRU0067): ms per frame, long frames,
   memory; the canal-belt ride and a Nieuw-West ride.
2. **The 15 "hidden bug" covers** (`npm run check:covers -- --strict` lists
   them: the-movies, delamar ×2, kleine-komedie, he-hua-temple, oude-kerk,
   hortus-greenhouses, walloon-church, rijksmuseum, westerkerk ×5,
   sexmuseum-venustempel): look at each in the game with and without
   `?bagTiles=1`, decide hide / keep (a pand that is really a neighbour must
   not be hidden), fix the covers rule or the spec, and make `--strict` pass.
3. **Prune the 114 stale suppress ids** and fix the 5 building-type instance
   pands missing from the tiles (`check-covers` output), so the tiles and the
   lists agree; `check:osm-under-models` stays at 0.
4. **Ground gaps the ride shows**: ride the canal belt and Oud-West under
   `?ownGround=1&sharedFrame=1` and list every visible defect (water
   plane vs quay, bridge deck vs relief, road width vs corridor) as a named
   location in `scripts/check-canal-car.ts` or the ground harness; fix what is
   data (levels, widths, deck profiles) and report what is rendering.
5. Write the default-on recommendation with the numbers into
   `docs/elevation.md` (own ground) and the BAG-tiles section of
   `docs/buildings-pipeline.md`.

## Checks
`npm run lint`, `npm run test:bag-tiles`, `npm run check:covers -- --strict`,
`npm run check:osm-under-models`, `npm run test:canal-car`,
`PW_PORT=<yours> npx playwright test bag-tiles own-ground --project=desktop`
(whatever specs exist under those names). Report: branch, SHA, perf tables,
the 15 decisions, the stale-id diff, defects found and fixed, recommendation.
