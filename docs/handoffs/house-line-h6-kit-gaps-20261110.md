# Lane H6: the kit-gap queue and the horizon rule (2026-11-10)

Part of the house line (`house-line-plan-20261110.md`). Haiku. Starts when H1 merges (needs `schemaLimits` on specs and the adapters).

Every house lane has also been a kit lane: when the kit cannot say what the photo shows, the lane stops to add a component, and `docs/handoffs/kit-gaps.md` (prose) is the only record. This lane turns the limits already typed on specs and block faces into a queue with counts, and names the rule for when a gap earns a kit lane.

## Step 0 — measure (report first, 20 min cap)
Count today's limits: `schemaLimits` in `scripts/block-face/faces/*/intent.json` and `types/**`, `limitations` lines on faces, `schemaLimits` on the H1 specs; the distinct components named (text before the colon), and how `kit-gaps.md` describes the same gaps. Check `RIDE_PRIORITY_GEBIEDEN` now lives in `src/canalRecall/ridePriority.ts` (H1 moved it; if not, move it here) and how a pand maps to its gebied (`bag-facts`/buurt extract).

## Deliverable
- `scripts/house-specs/kit-gaps.ts` → `npm run house:kit-gaps`: aggregate from the three sources into `artifacts/kit-gaps/queue.json`: `[{gap, component, weightedCount, pandCount, priorityPandCount, pands: [...], examples: [{pandId, cropPath, intentPath}] x3, firstSeen, lastSeen}]`, weight 3 for a pand in a ride-priority gebied, else 1, sorted by `weightedCount`. Normalise the gap text (lower-case, trim, map the ten most common synonyms in a table in the script).
- Generate `docs/handoffs/kit-gaps.md` from the queue: a header explaining it is generated, the horizon rule, the table (top 30), then a preserved "Notes" section carried over from the current file (move the current prose under it by hand once).
- The horizon rule, written in the doc and in `docs/house-line.md` §5: a gap goes to a kit lane when its `weightedCount` reaches 50 or one landmark needs it; below that the house ships with the nearest option and the limit stays on the spec. The weekly kit session takes the top two of the queue. House lanes stop extending the kit themselves.
- `test:house-line-docs` seed: a unit test that the generated doc lists every queue entry over the threshold.

## Gate
The queue lists every limit found in step 0 with counts; the top three gaps named with example crops; `kit-gaps.md` regenerated; `npm run lint`; the test.

## Documentation
`docs/house-line.md` §5 (the queue, the rule, the command). `CLAUDE.md` house-line section gains one line: "kit gaps go on the spec's schemaLimits and into the queue; a house lane does not extend the kit".

## Rules
`LANE-RULES.md`; `/usr/bin/git`; own worktree; link `node_modules`; no browser; no edits to `game.js`, `index.html`, lockfiles, `TODO.md`, `HISTORY.md`; `package.json` only for `house:kit-gaps`; hand back SHA, the count table, the top three, and TODO/HISTORY text.
