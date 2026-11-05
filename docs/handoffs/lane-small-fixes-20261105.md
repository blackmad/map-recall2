# Lane: small fixes batch (2026-11-05, #226)

Branch `lane/small-fixes-20261105`, worktree
`/Users/blackmad/Code/map-recall2-worktrees/small-fixes-20261105`, dev port 4856
(`PW_PORT=4856`; Playwright only through `bash /tmp/canal-pw.sh … --workers=1`, named specs).
Read `docs/handoffs/LANE-RULES.md` first. Use `/usr/bin/git`. Model: opus. Never `pkill`; stop
your server by its port's PID. Open data only. `node_modules` is linked; never `npm install`.
Do not open `TODO.md`, `HISTORY.md` or `buildings-pipeline.md`.

## Why

The user asked (2026-11-05) for the cheap parked items to be finished while the engine work runs.
Six items, each under an hour, in this order. Commit each one separately on your branch with a
message naming the item. Never loosen a gate, baseline or threshold. Hand back when all six are
done or by **02:00 CET** with what is done; an item you cannot finish is reported with the reason.

## The items

1. **A unit test for `scripts/landmarks/zone-wall-kit.ts`** (lane #206 added it untested).
   Read the module and the tests beside the other kit pieces (`src/canalRecall/landmarks/*.test.ts`,
   `node --import tsx --test <file>`) and write `scripts/landmarks/zone-wall-kit.test.ts` covering
   every exported function: zone splitting, opening placement, the byte-identical-when-absent
   promise, degenerate inputs. The integrator wires it into `package.json` `test:landmark-kits`;
   say the exact path in the report.
2. **Volkshotel roof letters need a back panel.** `scripts/landmarks/volkshotel-builder.ts` (lines
   ~119–123, `flatLetters(... 'VOLKSHOTEL' ...)`) draws single-sided quads that mirror from behind.
   Add a dark back panel (or double-sided letters on the rail) so the lettering reads from the
   street and shows a plain dark rail from the Wibautstraat side behind. Re-export
   (`node --import tsx scripts/landmarks/build-manual-landmarks.ts --only=volkshotel`,
   `npm run build:landmark-lods -- --only=volkshotel`), `npm run audit:glb -- --id=volkshotel`
   (no new failures), and an in-game or sheet view from behind.
3. **The AkzoNobel Center garage pand draws as a 41 m red block.** BAG pand
   `0363100012240015` (Christian Neefestraat 50, 2017, underground car park) carries
   `height 41.46, eaves 2.5, ridge 44.3` in tile
   `public/data/extracts/amsterdam/bag-tiles/14/8414/5386.geojson.gz` (osm w387808996,
   w388095663, w46274135) because 3DBAG gave the garage outline the towers' roof heights. The
   rule in `src/canalRecall/undergroundBuildings.ts` (`isUndergroundPand`) refuses anything over
   `UNDERGROUND_PAND_MAX_HEIGHT_M = 8`. Fix it in the typed rule with a test in
   `undergroundBuildings.test.ts` (for example: an underground OSM way whose pand's measured
   roof cover is low keeps counting as underground whatever 3DBAG's height, or an explicit
   documented exception keyed by pand id with the reason), then
   `npx tsx scripts/drop-underground-buildings.ts --publish` to rewrite the affected tiles in
   place and `npm run check:underground-buildings`. Report what else the rule change removed
   (the script's report lists every feature it drops; every extra removal must be a real
   underground structure, otherwise narrow the rule). Before/after in-game shot of the AkzoNobel
   Center from the Christian Neefestraat.
4. **Retire three uninstalled recipes**: `scripts/building-recipes/houses/{pand-233585,
   beursplein-5-165051, passeerdersstraat-242951}` (`npm run check:stale-installs` lists them
   under "not installed"). Remove the directories and `scripts/landmarks/beursplein-5-165051-inventory.json`,
   and remove their rows from `scripts/building-recipes/fit-golden.json`,
   `likeness-triage.json` and `large-mesh-golden.json` (deletions only, no other value changes;
   say which rows). `de-makroon-builder.ts` mentions one of them: read why and leave the
   comment or fix it, do not change the De Makroon model. Then `npm run check:stale-installs`,
   `npm run test:building-types`, `npm run test:landmark-release`.
5. **The ordinary catalogue entry for pand `0363100012171032`** (`ordinary-0363100012171032`,
   `public/canal-drive/ordinary-buildings-data/catalogue.json` ~line 25164) is named
   "Politiebureau Nieuwezijds Voorburgwal, Nieuwezijds Voorburgwal 35, Amsterdam (Spui-Nieuwezijds
   corner, 1996)". It is now shadowed by the bespoke `politie-nieuwezijds-voorburgwal`. Check the
   BAG address and year, find where the name comes from (the recipe's `intent.json` or the
   catalogue builder), and correct it at the source so the generated entry says what stands there;
   drop the "Spui corner" claim if the pand is not at the Spui. Say which file.
6. **Two tint checks.** (a) The WTC Amsterdam wing blades read grey in shade: in
   `scripts/landmarks/wtc-amsterdam-builder.ts` check the blades' material slot and tint against
   the photo (white composite in sun) and `docs/LOOK.md` "Palette and saturation"; only move to a
   measured value. (b) The Ziggo Dome roof reads tan: check the measured roof slot in
   `ziggo-dome-spec.json` / `ziggo-dome-builder.ts` against the photo. Re-export both, audit
   both, and show a before/after in-game pair for each.

## Checks before hand-back

`npm run lint`; the tests you touched; `npm run -s test:landmark-kits` (with your new test run
directly, since `package.json` is the integrator's); `npm run check:stale-installs`;
`npm run check:underground-buildings`; `npm run test:bag-tiles`; `npm run check:manual-landmarks`;
audits for volkshotel, wtc-amsterdam, ziggo-dome.

## Report

LANE-RULES hand-back block plus one line per item (done / not, the commit, the evidence paths),
and the INTEGRATOR TODO: the `test:landmark-kits` line to add, models to include in
`build:canal-signature-landmarks`, covers, world recompile if tiles changed, What's New note text
with before/after pairs for items 2, 3 and 6.
