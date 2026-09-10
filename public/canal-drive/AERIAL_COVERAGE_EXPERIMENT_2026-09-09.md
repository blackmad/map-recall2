# Expanded aerial coverage experiment — 9 September 2026

Five previously clipped building footprints now have complete staged aerial coverage, affecting 12 frontages. This required five public PDOK tile requests (309,168 image bytes), with **$0 paid API cost**. Active imagery, appearance, previous findings and human reviews were not changed.

Each request uses the exact `2025_orthoHR` layer, EPSG:28992, and 8 pixels/metre. Bounds are snapped outwards to the 1/8-metre pixel grid and cover every outer footprint vertex with at least 18 m margin: the 3 m tight-crop margin plus another 15 m of context. No tile exceeds 4096 pixels per side. Original JPEGs are cached by the SHA-256 of the exact source URL; source, cropped-image and footprint hashes are retained. Coordinate round trips and image dimensions are asserted.

| Building | Source tile | Footprint coverage |
| --- | --- | --- |
| 0363100012077314 — Da Costakade 14–26 | 1055 × 934 | clipped → complete |
| 0363100012162168 — Da Costastraat 6 | 498 × 395 | clipped → complete |
| 0363100012156758 — De Clercqstraat 24 | 373 × 412 | clipped → complete |
| 0363100012237064 — Hugo de Grootkade 20 / Amsta | 830 × 827 | clipped → complete |
| 0363100012163839 — Nassaukade 128 | 412 × 345 | clipped → complete |

## What the new pixels resolve

Direct inspection of the two previously abstained large-building packets produced one new coarse roof proposal and one continuing abstention. These are agent suggestions, not human labels or measured accuracy.

- **Da Costakade 14–26: `complex` proposal.** Both long flat-deck wings are now visible with the differently oriented, raised central roof sections around the gridded court/deck. This positively supports mixed roof volumes. The precise curved-versus-shallow-pitched central geometry remains uncertain; neither the grid surface material nor a uniform whole-roof material is asserted. The repeated curved street caps and clock are decorative features, not the roof-volume label.
- **Amsta: whole-building roof remains `unknown`.** The formerly clipped short wing is now visibly another flat-deck wing with solar panels and equipment. However, the connecting section is still deeply shadowed. The two exposed wings support local flat observations, not a confident label for every volume in the building. The reviewed street wall separately retains a `straight` decorative top.

Coverage is therefore demonstrably better even where classification does not change. Complete footprint extent is not proof of roof visibility. Shadows, relief displacement, unverified footprint-to-roof alignment and the 2023-street/2025-aerial time difference remain limitations. No roof colouring or material inference was generated from these staged pixels.

## Artifacts and reproducibility

- Fetch/stage: `node scripts/da-costa-block/stage-expanded-aerial.mjs`
- Freeze/validate the observed roof proposals: `node scripts/da-costa-block/record-expanded-aerial-review.mjs`
- Isolated output: `.cache/da-costa-neighbourhood/aerial-expanded-2026-09-09/`
- Source manifest: `aerial.json`; native source images: `tiles/`; outlined crops: `images/`.
- New agent-only observations: `roof-findings.json`, containing street derivation keys, hashes for all four viewed images, original panorama provenance, exact aerial source URL/bbox/hash, and roof-only field eligibility.

Promotion is a separate integration step. The new findings deliberately bind the staged overhead hashes and must not be consumed against the old active imagery. Previous roof findings remain unchanged, and this roof-only packet must not erase useful ground-floor extractions.

Two Amsta ground packets were subsequently reopened against the expanded overhead context: corrected narrow wall `0tvudm4` and broad entrance wall `1hyy18v`. Fresh source-bound observations are in `expandedground-findings.json` (generator: `record-expanded-ground-review.mjs`). Both retain local `shopfront=no`, `awning=no`; the broad wall directly supports the sign transcription `AMSTA De Poort` and a straight decorative top. Its cream terrace covers are freestanding parasols, not attached awnings. The narrow wall's text/top remain unknown. These minimal ground/wall records omit roof fields entirely.
