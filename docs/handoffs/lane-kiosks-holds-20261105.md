# Lane: the four kiosk holds from #180 (2026-11-05, #227)

Branch `lane/kiosks-holds-20261105`, worktree
`/Users/blackmad/Code/map-recall2-worktrees/kiosks-holds-20261105`, dev port 4857
(`PW_PORT=4857`; Playwright only through `bash /tmp/canal-pw.sh … --workers=1`, named specs).
Read `docs/handoffs/LANE-RULES.md` first, then `docs/handoffs/lane-kiosks-20261101.md` (the
original kiosk brief: sources, standplaatsen, the kit, the method) and `docs/START-HERE-buildings.md`
§1–§2A. Use `/usr/bin/git`. Model: opus. Never `pkill`; stop your server by its port's PID.
Open data only (city panoramas CC BY 4.0, Commons with licence per file, Beeldbank, BAG
standplaatsen/ligplaatsen, orthophoto). `node_modules` is linked; never `npm install`. Do not
open `TODO.md`, `HISTORY.md` or `buildings-pipeline.md`.

## Why

Lane #180 (2026-11-01) built `src/canalRecall/kiosks/kioskKit.ts` and seven kiosks and held four
with reasons. The user asked today for the kiosks to be finished. Open two installed kiosk
builders first (`scripts/landmarks/kiosk-frens-haringhandel-builder.ts`,
`kiosk-museumplein-builder.ts`) plus `kiosk-kit-tools.ts` and `kiosk-footprint.ts`.

## The four, in order (a hold with a written reason is still a valid outcome)

1. **Bloemenmarkt stalls**, the floating flower stalls on the Singel between the Koningsplein and
   the Munt. Hold reason: "needs greenhouse roofs; its 14 stalls are BAG ligplaatsen". Add a
   greenhouse-roof stall variant to `kioskKit.ts` (typed, tested in its test file, byte-identical
   for the existing variants: glass gable roof on a dark frame, the open quay-side front with the
   flower display, the awning), measure one stall from the panoramas and the orthophoto, then place
   the row from the ligplaats outlines (`https://api.data.amsterdam.nl/v1/bag/ligplaatsen/`, or
   the orthophoto if the API has no outlines) as one catalogue entry `bloemenmarkt-stalls`
   (landmark category, one GLB holding the row, the way #180's brief said). Count the stalls and
   say it. The user's rides pass here constantly.
2. **Park Kiosk BEA**, 52.34356 N 4.88432 E (POI `local-food-2273`). Hold reason: "a 100 m²
   pavilion", too big for the kit. Treat it as a small bespoke landmark: BAG pand if there is
   one under it (tile lookup), inventory, elevations, a builder with `BuildingTools`, id
   `kiosk-park-bea`.
3. **Pat's Poffertjes**, beside Stubbe's Haring at the Haarlemmersluis / Singel, standplaats
   `0363030011957763` (POI `local-food-2394`). Hold reason: "unproven on standplaats 762".
   Settle which standplaats is which from the panoramas at more than one date, then model it with
   the kit (id `kiosk-pats-poffertjes`) or hold with the evidence.
4. **Ramon's Coffee Kiosk**, 52.38985 N 4.89105 E (POI `local-food-2588`). Hold reason:
   "unphotographed". Look for panoramas from other dates and bearings and Commons photographs; if
   nothing shows the kiosk, hold it and say what you searched.

## Method

As in the original kiosk brief: identity (standplaats/ligplaats/pand), photos, inventory
(`<id>-inventory.json`: lettering, awnings, hatches, menus, colours with the photo each comes
from), footprints, elevations, builder, catalogue entry and dispatcher line in
`scripts/landmarks/build-manual-landmarks.ts`, export (`build-manual-landmarks.ts --only=<id>`,
`build:landmark-lods --only=<id>`), gates (`audit:glb --id`, `check:landmark-inventory --id`,
`check:manual-landmarks`, `test:building-taxonomy`, `lint`), then look: `review:sheet` and
`ingame-capture.ts` (desktop + phone) through the lock on port 4857. Judge beside the photo at
gallery size; fix what the photo contradicts. Commit per kiosk. Never push or merge; never touch
`game.js`, `index.html`, `package.json`, bundles, `covers.json`, `landmark-backlog.json`,
goldens, baselines, `TODO.md`, `HISTORY.md`, `whats-new-notes.json`. Hand back when the four
are done or held, or by **03:00 CET**.

## Report

LANE-RULES hand-back block plus per kiosk: identity (ids), tris, KB, audit result (counts and
whether photo-true), sheet and in-game shot paths, holds with evidence, the kit piece added and
its test, source refs to archive, What's New note text with before/after pairs. INTEGRATOR TODO:
`build:canal-signature-landmarks`, covers, backlog regen, world recompile, the kioskKit test
line if a new test file exists.
