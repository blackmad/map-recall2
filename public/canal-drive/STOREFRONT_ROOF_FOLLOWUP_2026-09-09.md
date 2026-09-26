# Six new storefront-sample roofs — 9 September 2026

Image-only review adds **four roof-shape proposals** and **two straight-facade-top proposals**, with explicit abstentions elsewhere. Six buildings were selected outside the previous 12-roof sample, all with complete aerial source bounds. Thirty images (full, upper wall, street context, aerial, aerial context) were inspected, and the field decisions were frozen before viewing these buildings' mesh components. Existing roof model answers were not read. Cost: $0, zero downloads.

Only `roofShape` and `facadeTop` are present in the frozen proposal objects. Ground-floor shopfront, awning and signage reviews are untouched. These are source-bound agent proposals, not human truth or a random accuracy sample; building identity was known.

| Building / selected frontage | Frozen image-only roof | Frozen facade top | Why |
| --- | --- | --- | --- |
| IWKA, Da Costastraat 6 — `0363100012162168_e_04g3jtu` | Unknown | Unknown | Broad light flat-looking main deck, but rear portion deeply shadowed; two different street-top treatments, with the large left crown touching the crop boundary. Decorative tops do not establish hidden roof volume. |
| DORUS, Da Costakade 51 — `0363100012166975_e_1bab2bg` | Flat with front pitch | Unknown | Aerial distinguishes a flat-looking triangular core from the narrow edge band; street shows actual short slopes around dormers. Central flat-capped brick/hoist top has ambiguous subtype. Corner/perimeter pitch is approximated by the available front-pitch family. |
| Toms, De Clercqstraat 25 — `0363100012158909_e_0u03o2h` | Flat with front pitch | Straight | Broad flat-looking aerial deck plus a visible short pitched band and dormer above the target's straight cornice. Neighbouring gables are excluded. |
| Chai kitchen, De Clercqstraat 19 — `0363100012166189_e_0b6kngg` | Flat with front pitch | Unknown | Broad flat-looking core; a sloping strip is visible beside the target's ornamental gable. The clipped/curved decorative subtype is unresolved rather than guessed from the roof family. |
| WASH PRATIC, De Clercqstraat 13 — `0363100012164219_e_0xe584t` | Flat | Straight | Continuous flat-looking aerial surface and straight target parapet. The neighbour's pitch is visibly outside the target. Tiny fixtures remain unresolved. |
| Nassaukade 141 — `0363100012157005_e_1xvojnu` | Unknown | Unknown | Broad flat main deck, but the lower front-right window/grey roof section is too small to confidently distinguish a short pitch from a cap/surround. The asymmetrical two-height top is not a regular stepped gable. |

## Separately labelled mesh follow-up

All six source-indexed mesh plans were inspected only after freezing the image findings. They strengthen component hypotheses without editing those findings:

- **IWKA:** faces 22/23 are real retained front-edge slope candidates, approximately 3.53/21.01 m² and 42°/64°, adjoining flat reference face 24 around 16.3–16.8 m local Y. Other flat components occupy the shadowed rear. This makes a *mesh-assisted flat-core/front-pitch plus rear-components hypothesis* useful, but does not retroactively turn the image-only abstention into a visual finding or prove the ornate top subtype.
- **DORUS:** pitched source face 18 follows the selected street edge and adjoins flat face 19, consistent with the frozen hybrid proposal.
- **Toms:** front face 16 corroborates visible front pitch; face 18 is a separate lower rear slope. Do not paint that rear strip onto the street face or claim an entirely level rear volume.
- **Chai:** front face 13 corroborates the small visible pitch, even though it is only 5.66 m². Lower rear face 11 is a separate component, not frontage evidence.
- **WASH PRATIC:** a single flat-family mesh face is consistent with the image proposal, but consistency is not validation.
- **Nassaukade 141:** the mesh is a single flat-family face. This does **not** resolve the small uncertain street detail: the earlier visual-pitch/all-flat-mesh counterexamples demonstrate why the image abstention must remain.

This reinforces three practical distinctions: a component observation is not a whole-roof label; decorative facade tops need their own taxonomy; and mesh agreement must not be used to erase an image uncertainty or representation gap. Unknown material fields stay untouched.

## Artifacts and validation

Stage root: `.cache/da-costa-storefront-roofs-2026-09-09/`.

- `sources.json`: current parent derivation keys, complete source footprints and hashes, image/panorama hashes, source dates and aerial bounds; copied source-only packets under `images/`.
- `frozen-image-findings.json`: immutable image-only field proposals and abstentions, per-field explanations/eligibility, exact active source basenames and staged image paths. No ground fields.
- `mesh-comparison.json`, `01–06-mesh.svg/.png`: separately labelled post-freeze source-indexed component facts and plans; binds the frozen finding hash.

Reproduce packet preparation with `node scripts/da-costa-block/prepare-storefront-roof-followup.mjs`; it reads no roof answers. After a frozen finding exists, `node scripts/da-costa-block/compare-storefront-roof-components.mjs` creates only the second-stage comparison. Do not rerun preparation against changed sources and retain old findings: their hashes intentionally fail validation.

Validation confirmed all six parent derivation keys remain current, all 30 staged/active image pairs match their frozen hashes, and proposals contain only the two intended roof fields. The publisher and human-review files were not edited by this experiment. Tomorrow's high-value checks are IWKA's shadowed rear/front pitch and mixed top, Nassaukade 141's tiny front-right section, and DORUS/Chai's decorative-top subtype—not relabelling clearly visible storefronts again.
