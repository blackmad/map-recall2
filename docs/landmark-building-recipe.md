# Amsterdam landmark building recipe

Build a recognizable original low-poly POI in the existing house style, at its real map location. Completion includes the model, destination, map pin/label and meaningful sourced card. This recipe preserves the current quality bar; its efficiency rules remove repeated context and work, not visual acceptance.

## 1. Give one worker one bounded assignment

Use a fresh worker with a short handoff rather than a long inherited conversation. Include the building name, existing POI identity, owned paths, this recipe, relevant references, known defects and acceptance requirements. Read the applicable `AGENTS.md`, then only relevant files. Do not load every builder or the city dataset into the conversation.

Prefer an isolated checkout/worktree for outside agents. In a shared checkout, one coordinator owns catalogue registration, generated manifests/bundles and the git index. Retire the worker after its deliverable; use a new short handoff for the next building.

## 2. Establish identity and physical scope

- Find the existing destination in `public/canal-drive/landmark-backlog.json` and the source feature in `public/data/extracts/amsterdam/landmarks.json`. Preserve its genuine identity and researched facts.
- Resolve current OSM outlines, mapped parts, BAG parent identities and public entrance. Nearby labels and address points are clues, not proof of building ownership.
- Record the exact replaced identities and at least one adjacent building that must remain visible. A complex may have several physical parts; their aliases do not require duplicate destinations.
- Preserve holes, courtyards, raised volumes and underpasses. Do not model an entire parcel as an opaque slab or hide neighbors with a padded rectangle.

Save source footprints and their provenance alongside the builder. Keep source IDs, URLs, dates where known, coordinate conventions and the measured-versus-approximate distinction.

## 3. Research recognition before coding

Use primary architectural, operator, heritage or municipal references. Obtain a clear principal facade and roof view, plus an opposite/context view when needed. Identify the few features that distinguish the building: silhouette, roof profile, tower, entrance, window rhythm, materials and open spaces.

Use actual dimensions and survey data where available. OSM/BAG/AHN/3DBAG each describe different things: equipment maxima are not whole-building heights; a fitted roof can omit a thin spire or open crane. Record uncertainty instead of inventing precision. A historical construction date may not date every present wing.

Reuse stored research first. Browse only for missing evidence or changed conditions. Reference images guide original reconstruction; do not import their pixels or third-party geometry into an asset attributed as original.

### Architectural records before estimating details

For every new historic landmark, make one bounded address-based Beeldbank search early, before estimating facade or roof details. Reuse cached results, including recorded unsuccessful searches. Use official records by address/BAG identity to resolve roof profiles, pane divisions, dimensions or historic ornament. Cache useful records once and reuse them across workers. Do not turn each standard-building pass into an exhaustive archival survey.

- **Before1905:** search `bouwtekening` plus address in the City Archives/Beeldbank. Facade elevations, sections and restoration drawings can clarify proportions and details. [City guidance](https://www.amsterdam.nl/wonen-bouwen-verbouwen/bouwen-verbouwen/bouwtekeningen-bouwvergunningen-opvragen/).
- **1905–2010:** find the address in Data Amsterdam, then its `Bouw- en omgevingsdossiers`/`Bouwdossiers` records. Public dossiers may require email-based temporary access before free download. Record the dossier/date and access state; do not represent a search hit as an inspected drawing. [Current archive instructions](https://beta.archief.amsterdam/handleiding/bouwdossiers).
- **BAG:** record exact Pand/VBO identity, current status, registered original construction year, Pand geometry and VBO usage functions. BAG `oppervlakte` means a VBO’s usable floor area, not the building footprint. Derive footprint area separately from current Pand geometry. Multiple VBO functions can belong to one physical Pand. [Official area definition](https://catalogus.kadaster.nl/bag/nl/page/?uri=Oppervlakte).
- **National/municipal monument registers:** keep the monument ID and architectural-description evidence for gable type, window rhythm, materials, alterations and named ornament. These are often prose descriptions, not guaranteed normalized facade fields. A proposed automatic `trapgevel`/`klokgevel`/`halsgevel` tag must retain its exact supporting passage, applicable facade/building part, source date and confidence; ambiguous text stays unresolved rather than becoming generated geometry.

A dated permit drawing records a proposal or historical state, not proof of the present facade. Compare it with current photos, documented alterations and current surveyed geometry before using it as dimensions/shape authority. Preserve evidence for measured, inferred and approximate features separately. Record archive search results and useful image/dossier identifiers in each footprint source file so workers do not repeat discovery. Existing RCE descriptions remain valid research evidence even where no drawings have been obtained.

### Turn monument descriptions into modeling evidence

For each registered monument, read and cache its register description during the initial reference pass. Extract explicitly stated architectural features into the reference pack: facade termination (straight cornice versus gable), roof form, frieze/ornament, material, openings, building part and historical period. Keep the source passage and monument URL with each assertion. Leave unstated dimensions, spacing, colors and ornament counts unknown until a drawing/photo/survey supports them.

Example supplied by the user: [monument5087](https://monumentenregister.cultureelerfgoed.nl/monumenten/5087), described as a facade beneath a straight cornice with triglyphs and consoles, topped by a small hipped roof, eighteenth century. This suggests a straight cornice, triglyph frieze, consoles and a small hipped roof; it does not justify an invented stepped gable, exact roof pitch or console count. The English description is user-provided; direct page retrieval failed during this check, so do not label it an independently verified Dutch transcription.

Use these assertions to select reusable geometry assemblies and as review criteria. Match the registered address/building part to the correct BAG identity, then compare current photos for alterations. Preserve historic period separately from BAG construction year. For batch extraction, validate a small sample before allowing parsed prose to drive geometry across the backlog.

### Additional reference sources

- [RCE Beeldbank](https://www.cultureelerfgoed.nl/onderwerpen/b/beeldbank): heritage photos and drawings; search building name and monument ID as well as address.
- [Nieuwe Instituut collection](https://nieuweinstituut.nl/projects/collectie/zoeken-in-de-collectie): architects’ archives and project documents; search architect/project name when municipal searches miss a landmark. Catalogue presence does not guarantee a digitized downloadable drawing.
- [3DBAG roof layers](https://docs.3dbag.nl/en/schema/layers/): AHN-derived LoD2.2 roof planes and BAG identity for measured massing; not window/ornament truth. Use existing cached survey evidence before fetching again.
- [AHN point clouds](https://www.ahn.nl/dataroom): check irregular roof elevations and terrain against actual survey coverage/date; sparse aerial facade observations cannot establish window patterns.
- [PDOK aerial imagery](https://www.beeldmateriaal.nl/bekijk-luchtfotos): roof layout, courtyards, annexes and context. Ortho imagery is a plan reference, not a facade elevation.
- [BGT](https://www.pdok.nl/introductie/-/article/basisregistratie-grootschalige-topografie-bgt-): detailed ground-level road, water and terrain boundaries for placement/context checks, including suspected monument/water overlaps.
- [Data Amsterdam](https://data.amsterdam.nl/): municipal map includes panoramas, aerial photos and measuring tools to compare drawings with current visible appearance.

For every new landmark, run a bounded [Amsterdam Beeldbank](https://archief.amsterdam/beeldbank/) search by exact address and building name for reference photographs as well as drawings. Save useful original images and their catalogue records privately, with dates and reuse terms. Compare archival photos with current views before copying a roofline or facade feature into the model. A JavaScript viewer shell is an access gap, not inspected reference evidence.

Treat archival accessibility and open-data licensing separately. Record each source’s date, access state and reuse terms; do not assume every publicly viewable scan is openly licensed. Cache a compact reference pack per building (identity, useful elevation, roof evidence, current facade, remaining uncertainty) to reduce repeated research without reducing quality.

### Archive every source in the private research repository

Raw reference inputs live in the private repository [map-recall2-source-data](https://github.com/blackmad/map-recall2-source-data), cloned at `/Users/blackmad/Code/map-recall2-source-data`. Keep the public game repository’s source URLs, architectural assertions and reproducible model code; keep complete raw photos, scans, register descriptions/pages, BAG/3DBAG/OSM responses and original imported-reference files in the private archive, grouped by canonical model ID.

At research time, save the original downloaded bytes before parsing or cropping. Record URL, retrieval date, HTTP/access state, content checksum, attribution/reuse terms when known, and the feature informed. Preserve a processed crop/extracted text separately from its original. Never describe extracted JSON or a screenshot as the original HTTP response. An unavailable original gets an explicit missing/access entry; do not silently substitute a similar image or invent a successful download. Preserve useful superseded references and explain why current evidence overrides them.

Before each model commit, sync available inputs using `scripts/landmarks/archive-model-sources.py`, inspect the per-model manifest and unresolved-source report, and commit/push the source pack to the private repository. Record its commit/model path in the model source record. Reuse that cached pack in short worker handoffs. Keep third-party photos/scans and raw imported geometry out of the public asset repository; private archival storage does not change their licensing or the original-house-style asset policy. Archive only task-relevant source files, not account tokens, cookies or unrelated personal downloads.

Save every reference photo/image used and the body of each source webpage read, including monument-register descriptions. Store a rendered page screenshot when layout, embedded images or a JavaScript viewer informs the build; retain downloaded images independently of the screenshot. Record these sources in the model research files so the archiver can associate them with the canonical model. The archive provides browsable `models/<id>/files/` and `webpages/`, a per-model README and checksum manifest.

Run `python3 scripts/landmarks/archive-model-sources.py --destination ../map-recall2-source-data --verify` to copy cached inputs and verify their bytes. Add `--fetch-missing` for current responses of recorded URLs, or `--screenshot-url URL` for an explicitly recorded page requiring a rendered snapshot. These new captures carry their actual retrieval date; they are not the page version read historically. Failed requests and JavaScript-only shells remain explicit gaps. Initial backfill: private commit `b1cdb17`, covering 146 model packs, cached images/reference files, raw HTTP bodies and selected page screenshots.

## 4. Author the model

Use Three.js geometry and the shared `BuildingTools` palette/primitives in `scripts/landmarks/cultural-builders.ts` and `build-manual-landmarks.ts`. Use `house-geometry.ts` for open-top footprint shells and upward-facing roof planes. Geometry is in metres, glTF Y-up; surveyed local axes and the placement specification determine map orientation. Existing facade-oriented primitives generally face +Z.

Build silhouette and main volumes first, then the characteristic facade assemblies. Clip details to the real perimeter. On angled walls, derive each window's position and tangent from that wall; fixed coordinates can leave windows floating. Glazing and columns must be physically exposed, not buried in the main extrusion.

Give explicit roofs ownership of their surfaces. Avoid duplicate wall caps, downward winding, coplanar trims, unsupported roof plates and rotated/nonuniformly scaled primitives whose bounds no longer match the intended roof. For unusual roofs, directly construct bounded surfaces from the intended profile.

Do not add building-name lettering for identification. Retain lettering only when the actual sign is a defining part of the architecture, supported by references. Map labels handle names. Architectural signs must fit their actual panels, follow the wall plane and remain subordinate to the building.

## 5. Persist the reusable deliverable

Typical files are:

- `scripts/landmarks/<id>-builder.ts`: original geometry, exporting a function using `BuildingTools`.
- `<id>-spec.json`: canonical POI, model URL, native anchor/bearing, exact suppression IDs, dimensions and attribution.
- `<id>-footprints.json`: source geometry, references, height notes and important open-space probes.
- `<id>-poi.json`: meaningful sourced description when existing information needs supplementing.
- `scripts/check-<id>-geometry.ts`: focused checks for this building's actual failure risks.
- `scripts/landmarks/review-<id>.mjs`: reproducible gallery/live review where appropriate.

Reusable examples: Faralda for open structures; Concertgebouw for exposed columns/courtyards; Heineken for multiple historical fronts and calibrated roofs; Stopera for elevated parts and open passages. Read the closest example, not all of them.

## 6. Integrate and generate once the source is ready

The coordinator registers the spec in `src/canalRecall/landmarks/manualCatalogue.json` and the dedicated builder in `scripts/landmarks/build-manual-landmarks.ts`. Builder argument signatures differ: read the export before wiring it. Add useful fallback facts in `src/canalRecall/game/manual-poi-data.json` while preserving genuine existing facts.

```sh
node --import tsx scripts/landmarks/build-manual-landmarks.ts --only MODEL_ID
npm run build:canal-signature-landmarks
npm run build:canal-route-selection
npm run build:canal-game-landmarks
```

The generator updates the GLB, asset manifest and content fingerprints. Rebuild the relevant bundles so the runtime requests the new asset rather than a cached old version. Existing per-model budgets are under 40,000 triangles and 500,000 bytes, with no textures. Do not loosen budgets to make a failing model pass.

## 7. Keep the same acceptance checks

Run focused geometry checks, the shared asset check, POI contract and TypeScript check. Test real risks: finite bounds, native scale, roof support/winding, actual first-hit glazing/column visibility, open-space rays and exact source identities. Avoid tests that merely repeat constants from the implementation.

```sh
node --import tsx scripts/check-MODEL_ID-geometry.ts
node --import tsx scripts/landmarks/check-manual-landmarks.ts
node --import tsx scripts/check-manual-poi-contract.ts
npm run lint
```

Inspect the default higher gallery view and four lower-angle rotations against references, including roof silhouette and side-window attachment; one successful front view is insufficient. Use consistent face lighting so rotated facades remain readable. Compare live-game views from both relevant sides. Verify exact replacement masks, drawn neighboring geometry, actual chosen destination/finish, visible geographic pin and physical clicking of the correct sourced card. A direct call to show a card is not a pointer-selection test. Wait for current local building residency before evaluating neighbors; coarse/streamed buffers can differ.

Fix concrete observed failures. Repeat the affected checks after edits; do not rerun unrelated checks without reason. Batch independent exports and shared checks; keep GPU reviews serial. Run the required route-start smoke check before pushing. Mark a model verified only after acceptance, not just successful generation.

## 8. Close the handoff

Report owned files, source evidence, output budget, checks, reference/render findings and unresolved limitations. Keep the report short. Update `poi-work-queue.json`, regenerate POI/dominant-building backlogs when coverage changes, and preserve earlier requests. The public views are `/landmark-queue.html` and `/manual-landmarks.html`.

## Cost discipline without reducing quality

Keep worker context small, references cached on disk, tool output bounded and shared integration coordinated. Do not print huge source datasets. Batch common build/check work. Preserve researched architecture and actual visual/game acceptance. Elapsed time includes research, waiting and review; token totals include cached context rereads and are not a direct percentage of subscription allowance.

## Large ordinary buildings: standard treatment

Large candidates first receive a recognition check, not automatic landmark detail. The generated backlog screens footprint complexity, courtyards, raised parts, unusual mapped roofs, skyline height and mapped POIs. These are clues: a rectangular footprint can still belong to a distinctive building. An unreviewed quick-loop candidate is not an approved simpler model.

Record decisions by exact candidate ID in `public/canal-drive/dominant-building-fidelity.json`. A review needs `treatment` (`standard` or `landmark`), `reviewedOn`, `sourceUrls`, `referenceImage` (saved source image/crop or direct image URL), `reason`, and four boolean `checks`: `ordinarySilhouette`, `repetitiveFacade`, `noDefiningDetailsLost`, `openSpacesUnderstood`. Standard approval requires all four true. Mapped POIs and raised structures require landmark review. Recognizable architecture, user-requested landmarks such as ING House, distinctive roofs, historic ornament or unresolved structure stay in the full loop. No evidence means unreviewed.

For an approved standard building, use one cached facade/context reference, surveyed native massing and height, correct roof/open spaces, restrained real material colors, and a reusable facade rhythm. Omit tiny ornament, interiors and invented lettering. Reuse a parameterized builder and batch similar buildings after one accepted example. Record which details were deliberately simplified. If the model fails recognition or needs substantial bespoke geometry, promote it to the full loop rather than iterate a cheap model indefinitely.

Keep the inexpensive shared geometry/identity checks and one gallery plus live-game visual comparison, including exact suppression and the adjacent building. Use the shared harness rather than writing a bespoke test/review script per ordinary block; add focused probes only for actual risks. A faster loop reduces researched/detail scope and repeated plumbing, not native placement or acceptance. If promoted to a POI, it still requires a genuine destination, map pin/label and meaningful sourced card. Anonymous background improvements do not automatically become trivia destinations.

Track elapsed time for the first small batch to calibrate the faster loop before promising timing or token savings. Review records survive backlog regeneration, and the dashboard distinguishes suggestions, approved standard buildings and full landmark treatment.

### Source-supported signage lettering

For source-supported real signs, match the observed lettering family, letter shapes, weight, proportions and spacing as closely as the native geometry allows. Use the actual panel and wall plane; record an approximate font match when the exact typeface is unknown. Do not replace distinctive signage with generic pixel lettering.
