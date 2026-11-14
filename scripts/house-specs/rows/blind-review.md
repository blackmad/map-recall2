# Blind row review (house rows first, lane P)

A row passes only when someone who did not build it, looking at two strips and nothing else, says so. "Closer than today" is retired.

## Run it (integrator)

1. `npm run house:row-sheet -- <row> [--drawn-env ...] [--drawn-specs <lane D staging dir>]` writes `artifacts/house-rows/sheets/<row>/blind/photo.jpg` and `blind/drawn.jpg`: the same width, scale and house-number header on both. Nothing names the renderer, flags or "today".
2. Spawn a fresh opus agent (no shared context, no repo access needed) with `scripts/house-specs/rows/blind-review-prompt.md` as the prompt and exactly those two images. Substitute `{{HOUSES}}` with the number labels in visible order (the manifest's `members[].label`). Give it no brief, no diff, no staging notes and no prior verdict.
3. Save its answer to `artifacts/house-rows/sheets/<row>/review-<n>.txt` and parse it:
   `node --import tsx scripts/house-specs/rows/parse-review.ts <file> --houses 110,106–108,...`
   Exit 0 = pass (with or without non-blocking fails), 1 = blocked or invalid.

## Rules

- Blocks and what blocks: `same-houses`, `roof-line`, `colour-family` block the row on any FAIL. `roof-storey-dormers`, `window-rhythm-dressings` and `invented` are reported and must be fixed before David's sheet, but do not block alone.
- An answer that is not in the line format, skips a block, or skips a house (without an ALL line) is `invalid`: ask the same reviewer to redo it in the format, never read it as a pass.
- The builder never reviews. Sonnet does not review its own pairs. A reviewer that has seen earlier strips of the row is not fresh.
- A Weteringschans label is a BAG number id (e.g. 169016), not a house number.
- A pass here is the gate for sending the first row of a kind to David; it does not replace David's sign-off.
