# Lane: pre-war buurten through the type libraries (B3)

Plan §3. Rules: `LANE-RULES.md`. For 19th and early-20th-century buurten the
instanced boxes of B2 are wrong; the block-face type libraries
(`scripts/block-face/types/<district>/*.json`, 40 types in oud-west, bellamy,
de-baarsjes, rivierenbuurt, spaarndammerbuurt, indische-buurt) and the
auto-placer (`docs/buurt-generator-20261016.md`; `npm run block-face:buurt-survey`,
`block-face:auto-place`, `block-face:auto-place-calibrate`) are the route.
Known limits from the Bellamy pilot: the edge-NCC gate catches gross
mismatches but passes some false positives; the kit cannot yet say painted
timber oriels, hoist-cap dormers, window kinds per axis, double doors.
Lower priority than B2: more Opus per pand covered.

Order: finish Bellamybuurt Zuid (Bellamystraat 33–141, Ten Katestraat 37–101
balcony rows, the 31 faces that placed nothing), then two buurten of
Oud-Zuid / Oost by `priority` in `coverage-v1/buurten.json` whose dominant
decade is 1880–1930.

## Per buurt

**Haiku:** survey with `--intake`; auto-place with the nearest district
library and `--review`; calibrate; report placed / held counts per face and
the faces that place nothing, with their strips.

**Opus (one session):** author the two or three missing exemplar types from
the strips, measured (storey heights, window heights, head lines: the
flat-row type went from NCC 0.05 to 0.55 on measurement alone); add the kit
component the photos need, typed and tested, byte-identical when absent
(`npm run test:building-recipes`, fit-golden unchanged for other houses);
re-run auto-place; review the run sheets at gallery size for false positives
that pass the gate.

**Haiku:** compile and stage the chunks (`block-face:compile --face=<id>`
with `--install` on the lane branch), `npm run test:block-face`, the
block-face e2e spec on your port, covers staged.

## Acceptance

Placed share per buurt, false positives found and held, the kit components
added, run sheets beside the strips; one strip per buurt for the user.
