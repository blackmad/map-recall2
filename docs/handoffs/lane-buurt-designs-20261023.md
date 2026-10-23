# Lane: high-repetition buurten as instanced designs (B2)

Plan §3. Rules: `LANE-RULES.md`. 159 buurten have repetition ≥ 0.5
(`public/data/extracts/amsterdam/coverage-v1/buurten.json`), 84,486 pands;
their top clusters are one house design repeated hundreds of times
(Holendrecht-Oost 5m×6m×1980 n=894, Gein 3 n=988, Tuindorp Oostzaan-Oost
n=1,197, Blauwe Zand n=541, Kelbergen n=275). The Nieuw-West machinery already
does exactly this for 3,075 pands: type specs as data
(`src/canalRecall/buildingTypes/types/*.json`, e.g. `nw-brick-tower-stair-5st.json`),
`generate.ts`, `public/canal-drive/building-types/instances.json`, one
`InstancedMesh` per unit, on by default. Reuse it unchanged.

Order (by `priority`, pands > 400): Tuindorp Oostzaan-Oost, Gein 3,
Holendrecht-Oost, Blauwe Zand, Gein 4, Kelbergen, Twiske-Oost, K-buurt-Zuidwest.

## Per buurt

**Haiku, survey:** `npm run block-face:buurt-survey -- --buurt=<slug> --intake`
(crops per face), then a design brief page `artifacts/buurt/<slug>/brief.png`:
the cluster table from `buurten.json`, three exemplar strips per top-3
cluster (sunlit where possible), the BAG year/width/depth histogram. Report
the brief path and the cluster sizes.

**Opus, authoring (~1 h):** one to three type specs per buurt measured from
the strips: storey heights, window sizes and head lines, door side, balcony
or gallery, roof form and pitch, colour medians from sunlit crops (never
darkened). Follow the Nieuw-West spec shape; variants for the colour
schemes the strips show. Add kit elements the photos need to `generate.ts`
only with a test and byte-identical output for existing specs. Record
inferred backs and mirror parity as inferred.

**Haiku, placement:** assign pands to a design by cluster membership (width
× depth × year within the cluster tolerance) and the buurt; write the area
into `instances.json` via the existing generator; gates
(`npm run test:building-types`, `audit:glb` on the unit GLBs); sheets:
aerial and street before/after beside the orthophoto and a panorama, pages
of four; `npx tsx scripts/build-covers.ts` staged (the integrator copies).

**Opus, one review turn** per buurt; held designs listed with reasons.

## Acceptance

Per buurt: placed / held / unclassified counts, the design count, draw calls
at the densest view (target ≤ the Osdorper Ban row: 20 draws), the sheets.
The user sees one strip per buurt. Target eight buurten this month.
