# Lane H7: the end-to-end pilot, timed (2026-11-10)

Part of the house line (`house-line-plan-20261110.md`). Opus. Starts when H1–H5 have merged. This lane is the acceptance test of the whole line: two rows through describe → preview → compare → stage → publish, with a stopwatch.

## Rows
1. Nieuwmarkt 4–22 (the user's 2026-11-09 photo vs game pair, `map-recall2-screenshots/engine/2026-11-08-user-shots/nieuwmarkt-row-vs-streetview-*.png`).
2. One Grachtengordel-West row of 8–12 canal houses in the H4 pilot buurt with crops and at least two a1 hand intents (pick the row with the most register entries; name it).

## Procedure (record wall time per step per house)
- `house:crops --pand` for any house without a crop; `house:describe` with all writers; `house:preview --photo --watch`; read the compare sheet and the `measureFacade` fields; correct by hand only where the verdict is WARN/FAIL, in the spec file, watching the preview; `house:stage`. Then one `house:publish --batch pilot-20261110` on the lane's worktree (dry-run first), and before|after ride frames at both rows (desktop DPR 2, phone) beside the panorama, under `/tmp/canal-pw.sh`.
- Keep a log: per house, minutes in describe / preview-and-correct / stage, number of preview iterations, which fields needed a hand correction and why (the writer missed it, the kit cannot say it → `schemaLimits`), and the publish timings.

## Gate
- Lane time per house ≤ 10 min from crop to staged spec (median over the rows); report the distribution whatever it is.
- The Nieuwmarkt row shows its gables and bays in the after frame; the Grachtengordel row's `measureFacade` verdicts are PASS or WARN with the reason recorded.
- `house:publish` for the batch under 15 min wall with only the touched cells rebuilt.
- A list of what the line still cannot do, ranked, each with the house it bit on: this becomes the next round's brief.

## Documentation
`docs/house-line.md` gets the worked example (one Nieuwmarkt house, every command and its output, the correction made, the time). `HISTORY.md` text: the measured numbers (lane time per house, publish time, agreement) and the Context of the plan. What's New text if a visible change ships (the Nieuwmarkt row does).

## Rules
`LANE-RULES.md`; `/usr/bin/git`; own worktree + port; link `node_modules`; browser runs under `/tmp/canal-pw.sh`; no edits to `game.js`, `index.html`, lockfiles, `TODO.md`, `HISTORY.md`; hand back SHA, the time log, frames, the cannot-do list, and TODO/HISTORY/What's New text.
