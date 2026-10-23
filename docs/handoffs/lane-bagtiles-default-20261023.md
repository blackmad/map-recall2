# Lane: BAG tiles become the default (S1)

Plan §2. Rules: `LANE-RULES.md`. User decision 2026-10-23: flip after a
desktop measurement and one strip. Evidence already recorded
(`docs/buildings-pipeline.md` "BAG tiles: review and default-on
recommendation"): map render 2.2 vs 2.7 ms on the fixed ride, same draw calls
and heap, `check:covers --strict` 0 hidden bugs, 109 stale suppress ids
pruned, 5 garage stand-ins newly hidden. It was left off only as "user's call".

Model: haiku for the steps, one opus check of the strip before hand-back.

## Steps

1. Flip the default in `src/canalRecall/bagTiles.ts` (today `=== '1'` at
   about line 283): on unless `?bagTiles=0`. Keep the legacy path when
   `public/canal-drive/models/covers.json` fails to load.
2. Rebuild the bundles generated from the catalogue, because they still carry
   the pruned ids: `signature-placement`, `game-landmarks`, `route-selection`,
   `own-ground`, `signature-landmarks.json` (the `build:*` scripts in
   `package.json` named for them; `npm run build` runs all of them).
3. `npm run check:covers -- --strict`, `npm run check:osm-under-models`,
   `npm run check:canal`.
4. `PW_PORT=<your port> npx playwright test tests/e2e/bag-tiles.spec.ts` **alone**
   (it is load-sensitive).
5. Desktop ride-perf, run alone: `node scripts/ride-perf-fixed-route.mjs` and
   `node scripts/ride-perf-places.mjs` at BRU0166, BRU0044, BRU0067 and the
   Nieuw-West place; paste the table rows beside the 2026-10-13 rows.
6. Strip for the user: the four places, flag off beside flag on, at the
   chase camera; expect identical frames except the five garage stand-ins.

## Do not

Delete `suppressOsmIds` reads yet: the chunk loader still uses them until
recipe tiles are the default (S2).

## Acceptance

Ride-perf 5/5 within budget; covers strict 0; `check:canal` green; the strip.
Hand back the SHA and the table; the integrator merges and pushes.
