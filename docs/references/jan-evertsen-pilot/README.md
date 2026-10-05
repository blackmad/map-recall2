# Jan Evertsenstraat native house GLB pilot

Two **unaccepted native-footprint drafts**, not researched POIs and not asserted to be Jan Evertsenstraat 94. The supplied Google Street View screenshot (uploaded January 2019, image capture April 2017) supports the shop/canopy assembly but crops the upper elevation and roof. The nearby Kruidvat label is not an address relationship. Search results suggest Kwakman occupied number 94; official VBO-to-Pand ownership remains unavailable.

- `NL.IMBAG.Pand.0363100012118917`: installed native polygon; 16.5 m extract height; pale framed shop variant, four provisional upper rows.
- `NL.IMBAG.Pand.0363100012096187`: installed native polygon including its rear notch; 14.43 m extract height; dark shop pier variant, three provisional upper rows.
- Retain adjacent Pand `0363100012088014` and `0363100012072380`; no rectangular suppression.

The specifications in `scripts/jan-evertsen-pilot/native-specs.json` preserve native lon/lat vertices, east/south metre vertices, anchor, street frontage chain, outward normal and exact suppression identity. Flat roof planes are conservative **provisional** closures, not surveyed roof-family evidence. Extract heights have no survey metadata in the tile; they are not asserted to be eave or crest measurements. The facade is on each polygon's southern street edge; the second footprint's rear notch must not be mistaken for its frontage.

Run `node --import tsx scripts/jan-evertsen-pilot/build.ts` and `node --import tsx scripts/jan-evertsen-pilot/check.ts`. GLBs and placement JSONs are written only beneath `artifacts/jan-evertsen-pilot/models/`. The geometry checks cover upward roofs, first-hit exposed shop/upper glazing, finite native bounds, detail height and budgets. CPU views use the shared offline rasterizer adapted to draft paths. They do not establish scene acceptance.

The single parametric builder reuses `BuildingTools` and the shared open-top footprint/roof helpers. Canopy fascia, roof/gutter edge, glazing/frame/door axes and masonry are original texture-free geometry. No downloaded geometry or photo pixels are included. The green historical sign panel has no painted identification words. Upper counts, window grouping, canopy projection (1.32 m), side/rear treatment and colors require fuller current references before acceptance.

Available original screenshot, installed tile bytes and building-facts input are archived in private source commit `65cf81b476c757a363f59aec86a76db824b48598`, under each canonical draft model ID and `models/jan-evertsen-north-canopy-pilot/`. Checksums verified before push. An isolated writable checkout archived the pack because the usual sibling is read-only. Missing original API responses and upper/roof photos remain explicit access gaps.

Access attempts on 2026-10-05: shell PDOK lookup fails DNS; web PDOK and municipal BAG endpoints are inaccessible. Bounded Beeldbank web search found no inspected image/record. Municipal panorama/current upper elevation, precise address parent, roof family and original API responses are missing. No historic landmark/register status is asserted. Preserve these gaps rather than inferring a roof from neighborhood period.

Pending: independent reference/render review, full upper facade/roof source, game-scene replacement/neighbor checks, camera pans on desktop/touch and performance evidence. Neither successful export nor CPU checks constitute visual acceptance.

Preflight corrections: the first export placed the uppermost window trim 0.27 m above the extract height; lowering the last row corrected this. The first frontage selection on the notched candidate selected its rear notch, and the first-hit pane check failed. Selecting the actual southern street edge corrected it. These were geometry failures, not source/visual acceptance. Final checks and exported CPU images refer to the corrected drafts.


Draft comparison page: `/canal-drive/jan-evertsen-pilot.html`. Native GLBs are texture-free drafts; procedural GLBs show actual generated geometry and colors with their facade atlas omitted, so their blank panes/walls are not evidence of the game appearance. The candidate street profile is not installed in the live city.
