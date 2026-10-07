Afrikahuis independent source / exported-mesh CPU review, 2026-10-07

Verdict: FAIL pending two bounded geometry repairs. No final gallery/game acceptance.

Frozen input: artifacts/afrikahuis/afrikahuis.glb, 397572 bytes / 27926 triangles. Review decoded the Meshopt GLB independently with NodeIO, rather than trusting builder-only geometry checks. Source inputs inspected: raw 20-20989.webp (2021 corner), 21-21791.webp (2021 presbytery entrance), 21-21792.webp (2021 frontage), processed front-0.jpg (2024 original-panorama stair crop); also three original CPU views and three newly generated street-level CPU views. Native source coordinates/footprints and roof plates read from afrikahuis-footprints.json. No new network acquisition, GPU review, authored geometry or shared catalogue changes.

Required repair 1 — presbytery ground entrance assembly (high confidence, source photo 21-21791.webp).

The source shows two upper timber/glass bays above a sheltered recessed ground entrance: two angled timber doors, a prominent central vertical concrete/finned core, and flaring concrete beams under the first upper bay. The builder repeats the upper-floor bay on the ground level at indices 30/31. The new presbytery CPU view therefore reads as three ordinary window rows and has no recessed entry assembly. Decoded first-hit probe at ring30/y2.4 is exposed glass at the same plane/distance as ring30/y6.2. Keep the two upper bays; replace the ground corner bay with the source-supported recessed entry, central core and structural beam treatment. Recheck a source-facing entrance view. The broad fanning stair approach is also reduced to a narrow straight staircase; widen/shape it enough to read as the photographed approach, without making an exact tread-count claim. Tread count is secondary to the entrance assembly and meaningful approach width.

Required repair 2 — open slit under high roof (high confidence, exported geometry plus source photo).

Tall-wall final panel ends at y12.78; the surveyed roof is y13.09. No tall fascia/parapet closes the 0.31m vertical gap. A decoded ray through the long north face ring29 at y12.92 has no intersection. The street-level presbytery CPU view shows background through that strip beneath the floating roof. The photo has a closed thick concrete upper parapet. Close the perimeter with its concrete edge up to the surveyed roof, retaining the explicit upward roof plate and avoiding a duplicate cap. Rerun this first-hit probe and street-level view after repair.

Scoped passes / retained strengths:

- Five linked faceted modules, distinctive projecting glass stairs, concrete base and taller east presbytery are recognizable in CPU views.
- The raised west hall retains an open street-level forecourt: decoded ray from [-7,1.5,-4] along +Z first hits at23.177m, rather than an opaque foreground wall.
- Decoded first-hit stair glass, presbytery upper corner glass and long ribbon glass are exposed; source-supported apertures are not buried behind parent extrusions at sampled locations.
- Main clerestory sampled as dark at y8.45; source photograph supports a shadowed band. CPU high-angle views make it appear narrower than source, but no unsupported roof slope is inferred from that alone. Native GPU lower-view comparison still needed.
- Decoded main roof ray hits slate at y9.2107; east roof ray at y13.0878. No whole-parcel tall roof cap in these probes.
- Cross placement on ring1 matches the prominent north-west source face at this scope.

Unresolved / acceptance limits:

The dense limestone-joint raster looks broken/dotted in low-resolution CPU views; assess native GPU before tuning it. Core/support placement beneath the hall and hidden rear facade remain photo-guided, lower confidence. Roof53 lower inset connector is acknowledged omitted and not independently accepted. A global rendered outline does not validate neighbor retention: retained school/residential identities require actual installed game checks. Gallery/game native source-facing views, suppression and load-failure fallback including pyramid layer, three POI surfaces, and actual performance evidence remain pending. Source-pack publication and its commit/path remain root work. Register direct-body and Beeldbank-image acquisition gaps remain honestly recorded and are not converted into source claims.

Probe artifacts: artifacts/afrikahuis/independent-review/decoded-probe.mjs, decoded-first-hits.json, afrikahuis-cpu-street-front.png, afrikahuis-cpu-street-north.png, afrikahuis-cpu-presbytery.png. These preserve failed evidence. Reader released after this review; builders may repair the frozen model.
