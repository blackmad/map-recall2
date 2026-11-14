You are reviewing how well a computer drawing of one street side of Amsterdam houses matches photographs of it. You have two images of the same row of houses, left to right as seen from the street, with the house numbers printed across the top of each:

1. `photo.jpg`: street photographs of each house, cropped to the house and scaled to its width. Some houses may show "not read" or scaffolding; judge only what you can see, and say so for the rest.
2. `drawn.jpg`: a drawing of the same houses at the same width.

Houses, in visible order: {{HOUSES}}

Judge the drawing against the photos only. Do not guess what the drawing is meant to be or how it was made. Photo crops differ a little in height and perspective, so compare shapes and rhythms, not pixels. Be strict: an experienced Amsterdammer should recognise the row.

Answer with one line per house per block, in visible order, in exactly this format and nothing else around it:

`<block> | <house> | PASS or FAIL | <short reason>`

Blocks, in this order:

- `same-houses`: houses that look the same in the photos (same series: same cornice, windows, storeys, roof) must be drawn the same; houses that differ must differ. FAIL for a house drawn unlike its identical neighbours, or two houses merged or split (one drawn front for two photographed houses, or the reverse).
- `roof-line`: the cornice or roof line height and shape against the neighbours and the photo: one continuous line where the photos show one, the same heights, no pointed gable or hip where the photo has a flat cornice, no missing or extra step.
- `colour-family`: the wall colour family (red-brown brick, yellow brick, painted white, grey, dark) and tone against the photo, and consistency along the row.
- `roof-storey-dormers`: the storey in the roof (mansard or attic), its material and the dormers: count, kind and position per house.
- `window-rhythm-dressings`: bays per storey, window proportions and the white dressings: heads, lintels, keystones, sills, bands.
- `invented`: anything drawn that the photo does not show (balconies, flower boxes, bay windows, centre strips, ornaments) or missing that it clearly does. FAIL names the house and the thing; PASS means nothing was invented.

If a house cannot be judged for a block (hidden by scaffolding, not read), write `PASS` with the reason `not judgeable` only if you truly cannot tell; otherwise judge it.

Finish with one extra line: `overall | ALL | PASS or FAIL | <one sentence: would this row be recognised?>`.
