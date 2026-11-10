# Lane H4: rectified crops for the ride-priority buurten, pilot (2026-11-10)

Part of the house line (`house-line-plan-20261110.md`). Two phases: the code (sonnet), then the pilot run (haiku, or the same lane continuing). Independent of H1/H2. Folds in needs-david #336.

Measurement is manual because the panorama → rectified-facade pipeline (`scripts/pand-reference/{select,rectify}.ts`, `scripts/block-face/intake.ts planStrip`) was only ever run per reviewed block: 887 strips + 571 reference walls against 192,567 pands. The Jev spike (#326) showed the judge is cheap and the crops are the bottleneck. This lane makes crops a city-scale, resumable, quality-flagged step and runs it on one canal-belt buurt.

## Step 0 — measure before building (report first, 30 min cap)
1. Read `select.ts` (`rankPanos`: 5–35 m, strict 8–25 m, standoff > 2 m, obliquity ≤ 55°, newer-year bonus), `rectify.ts rectifyWall` (BAG footprint wall, baseZ, 50 px/m, 1.8 Mpx), `intake.ts planStrip` (one capture day per face, ≤ 3 panos median-fused, 40 px/m), and the quality signals `foliageFraction`, `washedOutFraction`, `missingFraction`. Line numbers in the hand-back.
2. Time one `pand-reference` run end to end for one pand (API calls, bytes, seconds) and one `planStrip` face; derive the pilot's expected wall time and request count at one request per 500 ms.
3. Pick the pilot buurt: a canal-belt CBS buurt in `RIDE_PRIORITY_GEBIEDEN` with ~1,500–2,500 pands and the most a1 hand intents already staged (so H5 can score writer-vs-hand agreement). Name it and the count.
4. Check the API terms and existing rate handling in the repo (`scripts/pand-reference`, memory `amsterdam-photo-sources`): identifying user agent, backoff on 429/5xx.

## Deliverable
- `scripts/house-crops/crops.ts` → `npm run house:crops -- --buurt <code> [--pand <id>] [--resume] [--dry-run] [--rate-ms 500]`: for every pand in the buurt with a street-facing BAG wall (reuse `select.ts` exposed-wall logic), choose the wall and panoramas with `rankPanos`, rectify with `rectifyWall`; when a pand's wall is under 4 m or the pand is mid-row with no standoff, fall back to `planStrip` for its face and cut the pand's span from the strip. One request per 500 ms, exponential backoff, identifying user agent, resumable from a manifest.
- Quality flags per crop, from the existing functions plus two cheap new ones: `foliage`, `washedOut`, `missing`, `obliquity`, `cameraDistance`, `occluderShare` (dark-blob share in the lower third as a van/scaffold proxy; say in the doc that it is a proxy), `usable: boolean` with the thresholds written in one constant (`voidShare ≤ 0.35`, `foliage ≤ 0.3` from `autoPlace.ts`, plus the new ones).
- Archive: `map-recall2-source-data/pand-crops/<pandId>/{front.jpg,front.json}` (the JSON: panorama id(s), mission date, wall, px/m, flags, source URL) via a dedicated worktree of the source-data repo (memory `source-archive-per-lane`); the game repo gets only `scripts/house-crops/manifests/<buurt>.json` (pand → archive path + flags). The crops are the Jev/pixel-measurement input for H5 and the compare photo for H2 `--photo`.
- `scripts/house-crops/report.ts`: the coverage table (pands, walls found, crops made, usable, rejected by reason, API requests, wall time) and a contact sheet of 48 random crops (`artifacts/house-crops/<buurt>-sheet.png`).

## Pilot run
Run the pilot buurt in the background with the log in the worktree, not `/tmp`; a zero-byte log means working (memory `opencode-lane-operation`). Push the archive. Hand back the report and the sheet; the user judges the sheet (memory `roads-judged-against-photo` applies: look at the crops, not the flags).

## Gate
≥ 70 % usable crops on the pilot buurt or a reasoned table of why not (trees in the belt are the expected reason; leaf-off missions preferred as `planStrip` does); no 429s in the log; `--resume` after a kill continues without repeating requests; `npm run lint`; unit tests for the flag thresholds and the span cut.

## Documentation
`docs/house-line.md` §4a: the command, flags, the archive layout, the manifest, the flags and their thresholds, the rate rule, and how to run the next buurt. `--help` prints from the same `HELP` constant. Hand back the doc diff.

## Rules
`LANE-RULES.md`; `/usr/bin/git`; own worktree + port; link `node_modules`; no browser needed; the source-data archive is committed and pushed by the integrator from the lane's worktree (say the path); no edits to `game.js`, `index.html`, lockfiles, `TODO.md`, `HISTORY.md`; `package.json` only for `house:crops`; hand back SHA, step-0 table, report, sheet path, archive path, and TODO/HISTORY text.
