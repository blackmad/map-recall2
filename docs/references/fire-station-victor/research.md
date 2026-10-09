# Brandweerkazerne Victor — draft handoff, 2026-10-09

Official address Dapperstraat325 maps to BAG0363100012103300 and current OSM outline w278390874; genuine POI n26612532 (OSM update2026-06-30). Geometry uses native eastX/southZ, scale1 and anchor4.92924015/52.3604391. Only these two building identities are suppressed. The proposed entrance pin sits on the Dapperstraat pavement before the genuine apparatus portals.

## Evidence and architectural assertions

Raw and derived evidence is privately archived under `models/fire-station-victor/`. Complete original inputs include official BAG/VBO/PDOK, OSM response, 3DBAG response, municipal panorama catalogues and original8000px photographs, operator page, address/name Beeldbank response, architecture page and five photographs, and public TenderNed2025 renovation brief and ENZO drawing.

The ENZO sheet VO-B-12 is labelled **Doorsneden / Bestaande situatie**, dated2024-09-30: it depicts the existing building, although supplied in a renovation tender. Floor datums0/4.970/9.840/13.710 and roofs17.200/17.580 independently support the AHN5 roof massing. Its geometry confirms a central flat roof with steep street-side zinc slopes. Drawing elevation datum0 is the actual ground floor, not NAP. The model uses survey ground0.388NAP. The operator's renovation brief confirms opening1912, former living quarters, Orde2 special appearance, public frontage on both streets, second-floor roof terrace and a small rear plot shared with the adjacent school's emergency route. It does not establish a monument registration. Bounded heritage search yielded no matching register description; no protected monument status is claimed.

Current2025-09-26 panoramas and2021 photos agree on two apparatus arches, four tall window groups plus paired corner bay, paired corner gables, pale stone/white trim, green-black frames, side balcony with white consoles, zinc dormers and brown-grey masonry. Current photographs override the1911 archival elevation drawing for altered apparatus doors and dormers. The real ceramic BRANDWEER plaque uses narrow Roman serif capitals: Times New Roman regular is an approximate native outline match (exact historic typeface unknown), fitted to the actual small panel. No building-name identification lettering was added. Red/gold brigade shield and historic red street alarm are supported by current photographs.

One bounded Beeldbank exact-address query was captured; its response is a JS shell and does not constitute inspected original catalogue evidence. The architecture page lists3 associated archive records and includes a1911 PubliekeWerken elevation drawing with public-domain caption, preserved as that page's supplied drawing. Full private captures retain provider rights; photographs guide original geometry, never pixels/textures.

## Native scope and revisions

The west-southwest Dapperstraat frontage is native ring2→5, normal(-.924,.382), with12.17m centreline gap. Domselaerstraat is ring5→6, normal(.371,.929), gap6.99m. All14 surrounding mapped BAG parents within35m are recorded, including north school0363100012148810 (0.08m gap), rear0363100012214275 (2.85m), opposite0363100012200349 (7.26m). No own footprint holes; the rear plot is outside this Pand and stays open.

**Rejected survey inference:** semantic roof35 is a1.6×0.12m boundary strip at22.4m beside the taller school. Neither current photos nor2024 existing sections supports a22m station shaft. An initial literal CPU export wrongly included it; it has been excluded while keeping original survey and failed export. Semantic roof36 is the lower rear terrace around10.1m. Other roof rings preserve source vertices and variable heights, with top-free walls and explicit upward roof triangles.

**Failed compressed evidence:** initial meshopt export reversed one tiny roof sliver, area0.00027055m², despite source winding passing. The failed mesh and report are preserved. Omitting source-rounding remnants with projected altitude<2mm removed one triangle; subsequent compressed check passes all41 relevant roof triangles. This bounded cleanup does not change substantive roof surfaces.

## Checks and pending acceptance

Final draft16875triangles /213704bytes /0textures. Geometry check passes native finite bounds,43 source upward roof faces and228fractional first-hit samples across38 exposed panes. Compressed roof check passes; SHA256 is in compressed-roof-check.json. CPU Dapperstraat/corner comparisons preserve paired arches/gables and side balcony rhythm. CPU images omit city context and cannot establish neighbor suppression, gameplay or POI behavior.

Root must perform independent failure-seeking reference/render review, native gallery and live-game views from both street camera sides, physical pointer card selection, exact masks and fallback, actual chosen route/pin/finish and neighboring school/rear plot retention. Draft is not visually accepted or complete. Root owns shared catalogue, dispatcher, bundle generation, source publication and model git commit. Source pack must be pushed before model commit; fill the source commit/path after scoped verification.
