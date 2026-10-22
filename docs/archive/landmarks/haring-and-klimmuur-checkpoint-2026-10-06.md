# Keith Haring mural and Klimmuur signage

The Keith Haring mural is on the surveyed west wall of Koelhuis, BAG `0363100012201630`, north of the separate Centrale Markthal. Its genuine artwork identity is OSM `n9021384965`. The artwork map pin and building card remain at the mural; the route finishes at the documented Willem de Zwijgerlaan public viewpoint across the water. The default gallery shows the mural without changing geographic placement. Geometry interprets the reference in the texture-free house style; roof/stair heights and fine weathering remain explicitly approximate.

Klimmuur Centraal now carries its real `KLIM MUUR CENTRAAL` lettering on the south upper band. Vertical narrow sans stems follow the descending crown, fit the actual wall plane and clear the corrugation. The earlier assumption that lettering should be omitted was incorrect; the operator photograph and the cached 2023 photo both support it.

Initial visual failures are preserved prominently: Klimmuur's first strokes were too thin in the game; the mural's first default gallery hid the artwork and its north facade omitted the large gray panel. Corrected versions passed root and independent source/render review: Klimmuur `f8954acce2d6adc6`, mural `8a50d19e865f7a58`.

Native default/four rotated galleries and game views, actual chosen routes, map pins, physical pointer-selected sourced cards, exact loaded masks, ordinary roof suppression and resident drawable neighbors passed. The mural arrival point and physical pin were separately asserted in the actual game. Focused geometry, shared asset/POI contracts, TypeScript and route-selection checks pass. Assets are 1,600 triangles/35,448 bytes and 5,084 triangles/69,676 bytes respectively.

Stationary headless Chrome visible/hidden/repeat frame medians were 16.7 ms for both assets with masks retained. No difference was measurable at that sampling limit; this does not establish whole-city or physical-phone performance.

Raw sources, provenance/checksums, access gaps, generated validation and failed iterations were pushed before the model commit to private `blackmad/map-recall2-source-data`, commit `1313b00`: `models/klimmuur-centraal/validation/signage-20261006/` and `models/keith-haring-mural/validation/mural-20261006/`. Beeldbank/register viewer shells are recorded as access gaps; reproduced historical elevations were cross-checked against current photographs and current BAG scope.
