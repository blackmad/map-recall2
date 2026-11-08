# Lane: road shields repeat every ~200 m, landmark pills truncate without an ellipsis (user shots 2026-11-08)

Worktree `/Users/blackmad/Code/map-recall2-worktrees/labels-shields-pills-20261108`, branch `lane/labels-shields-pills-20261108` from `main` (11cbb47a7 or later), port 4674. Issue #259. Model: opus. Rules: `docs/handoffs/LANE-RULES.md`.

The user, on the live build 7cda9af: "highway labels drawn 'too often'" and "cut off labels". Shots in `blackmad/map-recall2-screenshots` `user-shots/2026-11-08/`:
- `shields-a10-a5-s101-sloterdijk.png`: along one stretch of the A10 / A5 at Sloterdijk the shield "A10" is drawn 8 times, "A5" 7 times and "S101" 8 times, about every 200 screen pixels; `roofs-offset-weteringschans-singelgracht.png` shows "S100" 5 times along the Stadhouderskade.
- `landmark-pills-truncated-hortus.png`: the landmark pills read "Hortus Botanicus greenho" and "Canal Ring Area of Amster", cut at a fixed width with no ellipsis.

The labels are the own engine's (`src/canalRecall/engine/placeNames.ts`, `labelBudget.ts`, `labelOcclusion.ts`, `labelLayerPolicy`, the label adapter in `public/canal-drive/js/*-source.js` that draws pills and shields; HISTORY R2-x "labels" entries describe the budget and occlusion). Find where road `ref` shields are placed (one per way segment, or per tile?) and where the pill text is measured.

## What is wanted

1. **Shields:** one shield per ref per visible road stretch. A minimum screen spacing between two shields of the same ref (start at ~1,000 CSS px, measure what reads well at the user's pitch), dedup across the way segments and tiles of one ref, keep the one nearest the screen centre of each stretch; a motorway with two refs (A10 and A5 concurrent) may show both once. Stable under the pan (no flicker: hysteresis as the other labels have). Report the counts before | after on the two shots' poses and on the aerial pan (`aerial-pan.mjs labelsByKind`).
2. **Pills:** a landmark pill either widens to its full name up to a maximum (about 36 characters or 420 CSS px at DPR 2, whichever first) or ends with "…" at a word boundary; never a hard cut mid-word. Check the longest names in the landmark catalogue (`Canal Ring Area of Amsterdam inside the Singelgracht`, `Hortus Botanicus greenhouses`) and that the pill's dot and tail still align. Desktop and phone.
3. **Tests** for the spacing / dedup rule and the truncation rule as pure functions; `npm run lint`, `npm run test:engine`. The label budget (`labelBudget` 4 ms) must not grow: report the label phase ms before | after.
4. **Strips** to `blackmad/map-recall2-screenshots` `ui/2026-11-08-labels/`: the Sloterdijk and Stadhouderskade shots before | after, the Hortus pills before | after. **What's New text**, e.g. "Road numbers appear once per stretch of road, and place names are no longer cut off mid-word."

## Fences

Yours: the label modules in `src/canalRecall/engine/` named above and their tests, the label adapter source (`public/canal-drive/js/*-source.js`, label lines only), Storybook label states if any. Not yours: `game.js`, `index.html`, `package.json`, bundles, `TODO.md`, `HISTORY.md`, `whats-new-notes.json`, extracts, the occlusion index. Other lanes use ports 4670–4673 and the same lock.

## Hand back here

Branch + SHA (pushed, merged with `origin/main`); the rule and its numbers (counts before | after at the poses, label ms); tests joined; strip paths; which bundles to rebuild; What's New text; what is still open. Then stop; the integrator merges.

Rules: `docs/handoffs/LANE-RULES.md`. `/usr/bin/git` only, never `git stash`, never `pkill` (stop your server with `kill $(lsof -t -iTCP:4674 -sTCP:LISTEN)`), one Playwright run at a time via `/tmp/canal-pw.sh` (`PW_PORT=4674`); timing runs and the push under `CANAL_PW_EXCLUSIVE=1 /tmp/canal-pw.sh`. Wait on background commands in the foreground. Budget: about 80 turns.
