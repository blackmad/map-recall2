# Older cached views for obscured Da Costa ground bays

Fifteen cached alternatives across the five unresolved Da Costakade 14–26 intervals produced **two better entrance observations, one partial window/base improvement, and two continuing occlusions**. No positive storefront or tenant finding was made. Cost: $0; downloads: zero. Human reviews, active imagery, publisher/UI and parent intervals were unchanged.

| Metric interval along parent wall | What changed across dates | Conservative result |
| --- | --- | --- |
| Bay 01: 0–9.83 m | 2023 construction fencing → 2024 opaque hoarding/glare → 2025 foreground Amsterdam 750 banner | Lower frontage still hidden. Entrance/use unknown. |
| Bay 02: 9.83–19.65 m | Same sequence; parts of a doorway appear, but no clean full lower-frontage view | Entrance/use unknown. Contextual adjacent openings are not imported. |
| Bay 03: 19.65–29.48 m | April 2022 predates the banner and exposes ordinary windows; shrubs and a boundary-clipped doorway remain. January 2023 is worse because of construction panels. | Partial evidence improvement, not a reliable complete entrance/shop label. |
| Bay 05: 39.31–49.13 m | January 2023 has less vegetation across the recessed arched door and reveals steps; other dates retain shrubs/tree obstruction | Local dated entrance present. Shopfront remains unknown. |
| Bay 06: 49.13–58.96 m | January 2023 removes the van hiding the entrance base in the prior best view; doorway and steps become visible | Local dated entrance present. Shopfront remains unknown. |

## What this teaches the selection pipeline

Temporal diversity is worth retaining, but it is not a monotonic “older is clearer” rule. Construction existed in January 2023; November 2024 adds hoarding and glare; July 2025 adds the colourful bridge banner. Near-identical alternative July camera positions do not remove a broad foreground barrier. A low angle score cannot detect any of those conditions.

Each interval received at most three alternatives, one per distinct capture year, chosen from cached cameras that passed the existing distance/angle/building-occlusion gate. Previous same-source and best-source cameras were excluded. Ranking within a year used the projected horizontal angular span of the interval, rather than output crop width. The resulting source support is only **207–373 panorama pixels across about 9.83 m**, despite 1081-pixel-wide generated crops. This is why faces, small text and interior use do not become reliable merely by upsampling.

All fifteen alternatives—including bad ones—remain in the packet. Contact sheets include the unchanged metric projection, a maximum 1.5 m clamped context extension and an **unrectified original panorama region**. The latter makes the bridge hoarding, construction equipment and houseboat roofs recognisable as foreground objects, not facade signage, awnings or shops. Foliage and the boundary-clipped doorway in bay 03 still prevent a complete local label.

These are dated observations, not a stitched single-time survey. Ordinary windows and a shared-looking doorway do not prove all tenants are residential, and a partial interval negative cannot become a whole-wall negative. All diagnostic records keep `appearanceEligible=false`; local entrance proposals are separate from the active extraction schema. Shopfront remains unknown in all five follow-up records.

## Frozen artifacts

- Stage: `.cache/da-costa-ground-bays-temporal-2026-09-09/`.
- `manifest.json`: exact original parent ID/derivation, interval derivation and metric endpoints, panorama ID/date/hash/pose, projection quads, crop hashes, native angular pixel span and failed alternatives.
- `findings.json`: independent per-alternative critique and interval-only proposals, bound to a literal fingerprint of the inspected packet.
- `*-temporal-sheet.jpg`: five source-bound contact sheets; ground, wider projection, original context columns.
- Preparation: `node scripts/da-costa-block/prepare-temporal-ground-bays.ts`.
- Freeze the already inspected observations: `node scripts/da-costa-block/record-temporal-ground-bays.mjs`. This fails closed if preparation changes the packet; a new packet needs fresh inspection and a separate finding, not an updated automatic pin.

Useful next action is to keep multiple dated visibility states per interval and prefer a genuinely unobscured source per component. Do not spend additional inference on bays 01–02 expecting a model to reconstruct the hidden base. A future near-side, unobstructed capture would provide different evidence; the current cached alternatives do not.
