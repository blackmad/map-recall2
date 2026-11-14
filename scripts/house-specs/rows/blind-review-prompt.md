You are reviewing how well a computer drawing of one street side of Amsterdam houses matches photographs of it. You have two images of the same row of houses, left to right as seen from the street, with the house numbers printed across the top of each:

1. `photo.jpg`: street photographs of each house, cropped to the house and scaled to its width. Some houses may show "not read" or scaffolding; judge only what you can see, and say so for the rest.
2. `drawn.jpg`: a drawing of the same houses at the same width.
3. `zoom/<house>.jpg`: for each house, the photo crop (left) beside the drawing crop (right) at about three times the strip scale. Use them for window heads, white bands and dormers.

Houses, in visible order: {{HOUSES}}

Judge the drawing against the photos only. Do not guess what the drawing is meant to be or how it was made. Photo crops differ a little in height and perspective, so compare shapes and rhythms, not pixels. Be strict: an experienced Amsterdammer should recognise the row.

Answer with one line per house per block, in visible order, in exactly this format and nothing else around it:

`<block> | <house> | PASS or FAIL | <short reason>`

Blocks, in this order:

- `same-houses`: houses that look the same in the photos (same series: same cornice, windows, storeys, roof) must be drawn the same; houses that differ must differ. FAIL for a house drawn unlike its identical neighbours, or two houses merged or split (one drawn front for two photographed houses, or the reverse).
- `roof-line`: the cornice or roof line height and shape against the neighbours and the photo: one continuous line where the photos show one, the same heights, no pointed gable or hip where the photo has a flat cornice, no missing or extra step.
- `colour-family`: the wall colour family (red-brown brick, yellow brick, painted white, grey, dark) and tone against the photo, and consistency along the row.
- `white-amount`: the amount of white against the photo: speklagen and other bands, window heads, lintels, surrounds, frames. FAIL where the drawing carries visibly more or less white than the photo (heavy banding, a missing white head row, a top-storey head dressed differently from the photo). Look at the zoom pairs for this.
- `roof-storey-dormers`: the storey in the roof (mansard or attic), its material and the dormers: count, kind and position per house.
- `window-rhythm-dressings`: bays per storey, window proportions and the white dressings: heads, lintels, keystones, sills, bands.
- `invented`: anything drawn that the photo does not show (balconies, flower boxes, bay windows, centre strips, ornaments) or missing that it clearly does. FAIL names the house and the thing; PASS means nothing was invented.

If a house cannot be judged for a block (hidden by scaffolding, not read), write `PASS` with the reason `not judgeable` only if you truly cannot tell; otherwise judge it.

Finish with one extra line: `overall | ALL | PASS or FAIL | <one sentence: would this row be recognised?>`.

## Blocking-only mode

Use this variant when the brief says "blocking-only". You get the rule-10 pair (`rule10-photo.jpg` beside `rule10-drawn.jpg`: a first-person frame of the row, photo and drawing at the same pose), the strips and the zoom pairs. Judge the roof line and the roof storey from the rule-10 pair; judge windows, bands, heads and white from the strips and zooms. Ornament (voussoir splay, friezes, tympana, dormer richness) is not judged in this mode: do not fail a house for it.

Answer with the same line format, only these five blocks, in this order (omit `roof-storey-dormers` and `window-rhythm-dressings`):

- `same-houses`, `roof-line`, `colour-family`, `white-amount`, `invented` (definitions as above; roof-storey and dormer faults go under `roof-line`, window, band and head faults under `white-amount` or `invented`).

Any FAIL among them blocks the row. Finish with the `overall` line as before.
