This batch repairs the ordinary historic-looking pair within a recorded 1992 construction cohort on the south side of Bethaniënstraat. Completion applies to the observed transition and its preselected challenge views. It does not admit all De Wallen streets, every narrow modern building, or the entire existing transfer profile.

The implementation decision is concrete: add an evidence-scoped visual frontage class, preserve construction facts, and resolve a compatible source-guided roof prior before detailed mesh construction. Use existing neck/triangular crown geometry, not new façade registration or building-specific overrides. The current balcony/window repair remains the modern neighbor grammar. The goal is convincing street rhythm: the narrow historical-looking pair and pale modern neighbors must form a coherent material, window and crown mixture. Exact door-to-crown assignment, individual attic counts and perfect source registration are not acceptance criteria.

## Source scope and inventory

Use the existing directed street segment `[4.89819,52.371758]` → `[4.898948,52.371522]`, side `-1`, reach 12 m. Its length is approximately 57.75 m. Chainage here is native street projection, not image registration.

| Observed module | Approximate chainage | Native front width / height | Genuine construction fact | Evidence |
| --- | --- | --- | --- | --- |
| Pale modern west frontage, stack plus plain corner group | 4.0–13.3 m | 9.29 / 12.69 m | 1992 | 2017 station 670; existing 2020 heldout-13; 2018 corner view |
| Brown historic-looking neck front, visible door 12 | 13.3–17.9 m | 4.65 / 9.81 m | 1992 | 2017 station 671 and 2020 station 195 directly center the front |
| Brown historic-looking triangular front, visible door 14 | 17.9–23.8 m | 5.87 / 11.46 m | 1992 | 2018 station 1508 directly shows the pair |
| Pale modern east frontage, grouped windows and slate base | approximately 26.7–36.2 m | approximately 9.47 / 11.14 m | 1992 | 2017 station 672 shows the adjoining gap/corner; identity mapping is weaker |

The two narrow identities used solely for the native audit are BAG 2178531 and 2178209. They are not renderer dispatch keys. Their persistent visual class is corroborated by independent 2017, 2018 and 2020 camera positions. This resolves the architectural appearance observation; it does not establish retained historic fabric, exact original construction history or a surveyed crown surface.

The authoritative source packet is [`../7/source/manifest.json`](../7/source/manifest.json), with camera/date/source URL and panorama/crop SHA256 hashes. [`../7/source/module-inventory.json`](../7/source/module-inventory.json) and [`../7/source/native-scope.json`](../7/source/native-scope.json) preserve the findings and factual dates. Existing source station identifiers are abbreviated below only for readability.

## Bounded visual class and recipe admission

Add an optional `visualClass` on a reviewed street profile, with `{kind, sourceEvidenceIds, constructionYearPolicy}`. `constructionYearPolicy: 'source-visual'` means the profile's observed architectural appearance can differ from a factual date; it must be rejected without qualifying municipal evidence. The default remains current date eligibility. Never write this value into `constructionYear`, POI facts or tile metadata.

Represent the observed historic-looking pair as a short higher-priority street-side profile, approximately chainage **10–27 m**, rather than relaxing year eligibility across the 57.75 m transfer. Resolve membership by exposed run midpoint, source-facing side and local dimensional compatibility: frontage approximately **4–6.5 m**, native height approximately **8–14 m**. These width/height bounds are compatibility tests inside the independently observed spatial class, not proof of historical character. Broad modern midpoints lie outside this short profile. Use a complete local cohort bake; do not assign historical styles to arbitrary members of the 1992 cohort.

Add `frontageMin/Max` to reviewed eligibility and pass the complete exposed run width to both compiler and runtime lookup. Existing baked identities remain stable across chunk boundaries. A modern building can contain a narrow architectural module, so neither footprint width nor a single tessellated edge is sufficient: use the grouped exposed street run. Do not allow profile matching to fragment one broad modern frontage into fake narrow historical members.

Give the explicit observed class precedence over its containing general profile only when all spatial, facing, dimensional and source-admission checks succeed. If the short class rejects a run, continue to the containing modern/general profile; do not let an ineligible high-priority match erase the underlying appearance. Compile and runtime must share this candidate-resolution order.

The short class carries two joint masonry/canal recipes with restrained pale frames, tall paired/transom glazing, brown walls, and neck versus plain triangular crown priors, weight 1:1. Exact door numbers and façade IDs are not inputs. Allocate the two complementary crown families across genuine local fronts in street order; keep the pair visibly distinct beside the pale modern neighbor. This is a bounded street-composition prior, not an exact photographed building match. No modern balcony assembly belongs on the historical pair. Existing modern profiles protect the wider neighboring stack/plain-corner groups.

## Crown capability and required shared change

Current `streetCrown.ts` recolors matching roof plates and places contained attic windows only inside existing compatible geometry. It cannot turn a less-than-1 m parapet into a neck or triangular silhouette. The actual resident pair currently selects parapets with approximately 0.93 and 0.67 m rise. Raw surveyed tiles provide footprint and total height, not crown vertices.

There is a specific shared precedence gap in `roofMesh.ts`: `planRoof` honors register-derived `monumentGable` even for a modern style, but `planBuildingRoof` excludes modern/non-simple outlines from its inscribed-roof branch unless a roof tag exists. Consequently a corroborated neck hint can fall through to a modern parapet. The register extract contains a neck hint for the first narrow front, no hint for the triangular one, and a bell hint on the broad eastern modern neighbor. The latter is a counterexample to assuming a register description always names the currently observed street front.

Implement an explicit **source-visual roof prior** that is admitted only for the reviewed visual class. Apply it before roof planning, separately from actual year and measured geometry. The neck uses an independently corroborated architectural hint; the triangular option uses a source-biased generic plain gable. Do not globally override every modern register hint. Admit the non-simple inscribed-roof branch for this explicit historical visual class and preserve exterior-front orientation and courtyard holes. Reuse existing neck and plain gable plate functions.

Keep the native total height and footprint invariant: allocate crown rise inside that height envelope and derive coherent eaves once. Preserve explicitly measured eaves/roof vertices, honored mapped roof tags, curated kits, front carriers and exact source appearance; incompatible authoritative geometry is withheld, not overwritten. Generated `roofShape`/`roofEavesHeightM` from the old parapet must be regenerated coherently, not mistaken for measured values. Do not lower walls using stale parapet eaves while emitting a taller gable. Preserve all neighbors and avoid duplicate flat lids under a pitched roof. The two crown shapes are procedural priors, never “surveyed historical roofs.”

## Critical review criteria, written before implementation

| Trait | Required relationship | Reject condition |
| --- | --- | --- |
| Historic/modern frontage boundary | Two narrow brown masonry fronts remain visibly distinct beside pale modern stack/plain-corner frontage | Brown material or historical roof migrates onto either broad modern neighbor; pair still rendered as modern infill |
| Crown differentiation | A restrained mix of historical crown silhouettes distinguishes the narrow masonry pair from pale modern neighbors within the unchanged native height envelope | Both remain modern flat parapets; crowns float, face a rear/courtyard wall, duplicate lids, or exceed native height |
| Historical glazing hierarchy | Tall paired/transom windows and pale entrance framing differ from the modern access-and-flank assembly | Plain balanced modern panes or modern balcony stack remains on historical pair |
| Coherent native roof/wall assembly | Eaves, roof plates, material continuation and contained attic windows meet the actual wall geometry | Stale eaves create overlaps/gaps; crown windows cut outside plates; courtyard or neighbor is covered |
| Bounded transfer and uncertainty | Same grammar survives independent oblique views; protected modern/plain-corner modules remain modern | A favorable frontal view hides a failed opposite oblique or unclassified narrow modern exception |

Counts, colors and proportions remain approximate. Judge the street-side cohort from broad and oblique views first; near views diagnose obvious assembly defects. A neck/triangle swap between the two narrow fronts, approximate attic placement or an approximate individual opening count does not reject an otherwise coherent source-supported rhythm. Each critical relationship still requires visual source/render evidence; tests and an effort-cycle count cannot waive a failed material/silhouette/window mixture.

## Fixed representatives, transitions and challenge stations

Representatives used to admit the source class: 2017 `TMX7316010203-000227_pano_0000_000671` (neck) and 2018 `TMX7316010203-000709_pano_0000_001508` (paired crowns). Transitions: 2017 station 670 (west modern corner) and 672 (east modern/gap). Existing 2020 station 195 and the original heldout-13 are **known failed-case replays**, not newly blind holdouts.

Before code changes, fix these unused municipal stations as spatial/temporal challenges: 2017 `TMX7316010203-000227_pano_0000_000676`, 2018 `TMX7316010203-000709_pano_0000_001506`, and 2020 `TMX7316010203-001662_pano_0000_000196`. Acquire/hash their original source and crops into a separate evaluation manifest; do not tune recipes from them. They sample both sides of the transition from different lateral camera positions. If visibility is poor, mark uncertain with evidence; choose replacement stations by visibility before looking at candidate renders. This does not establish a blind unseen-neighborhood generalization test.

Use native-source projection views at heading 206.8568°, pitch 35°, horizontal FOV 110°, 1200×900, plus a documented 2 m streetward retreat, broad oblique row and near-crown views. Camera position must be outside all installed footprints. Keep original source frame, candidate frame, native identity/roof audit and camera matrices together. Review both directions along the row. Root and an independent reviewer must explicitly attempt to reject every critical trait. Actual game scene and all detailed modes follow after the native study passes.

Counterexamples stay in the review packet: broad pale modern west/east corners; modern opposite-side narrow grouped modules; register bell metadata on the visibly modern eastern front; source geometry with measured eaves; and historic windows on other streets that do not imply this local crown class. Keep the current 1986 Overtoom modern exception and modern high-rise regression as out-of-scope guard tests.

## Meaningful implementation and runtime checks

1. Replay the actual narrow-pair native polygons and modern neighbors with ring rotations and independently streamed subsets. Verify stable visual-class choice and frontage-width grouping; no tessellated edge or stream split manufactures a historical member.
2. Preserve construction year 1992, source footprint coordinates and native maximum height exactly. Withhold measured/tagged/curated geometry; clear generated roof/eaves coherently when applying an admitted prior.
3. Regress modern/non-simple outline plus corroborated neck-class planning: produce a compatible source-guided crown, not the current parapet fallback. A similar narrow modern outline outside the source class must remain unchanged.
4. Verify neck/triangle fronts are on exposed street orientation, all roof triangles are finite and courtyard holes stay open. Test material continuation and containment at stepped/tapered plate edges, not merely rectangle corners.
5. Bake the complete observed cohort and run existing source/admission, split streaming, profile on/off, all-look and worker-revision checks. Source manifests must retain evidence hashes and explicitly separate new admitted class from evaluation pictures.

Next implementation order: reviewed visual-class schema and grouped-width eligibility; source-prior roof planning precedence/coherent eaves; compile/bake the short class with explicit provenance; freeze candidate; native reject-oriented source review including the fixed challenge stations; then full-game LOD/mode and CPU/GPU checks. Stop publication at any failed critical criterion, preserve failed artifacts, and revise the shared capability rather than adding a showcased-building override.
