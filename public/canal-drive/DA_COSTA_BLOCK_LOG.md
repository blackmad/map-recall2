# Da Costa block: street recognition experiment

## Neighbourhood continuation — 9 September 2026

The [autonomous continuation report](./AUTONOMOUS_CONTINUATION_2026-09-09.md)
supersedes the initial status below: four distinct frontage records are repaired,
all five clipped aerial footprints have expanded coverage, direct agent fields
are integrated, tree typology is live, and an optional machine-sign experiment
is available. The historical diagnosis below is retained as provenance.

### Review correction: right building, wrong crop

The user identified Hugo de Grootkade 20 (`0363100012237064_e_0tvudm4`) as
the correct building but an unusably narrow crop. An agent compared the cached
original panorama with the full/context crops: the selected 3.14 m recessed
edge is about 34.64 m from the camera, behind the same building's front wall
at about 10 m. The selector currently skips the target building in occlusion
checks. This is a self-occlusion / target-plane defect, not a wrong-building label.
At the time of this initial diagnosis, the selection defect was not yet repaired;
the subsequent continuation above implements and verifies the replacement views.

The review now distinguishes **Right building, bad crop · C**: it stores the
selected target ID with `placement: crop-repair`, keeps appearance unknown,
withholds that crop from rendering, and exposes a Crop repairs queue. This
confirms building identity, not the selected wall plane. Existing undo/export/
import and source-pixel checks apply. No decision is entered on the user's behalf.
Original links open an inline image dialog with fit/actual-size inspection;
the source server's octet-stream content type no longer causes a default download.

The photo-linked continuation now covers **103 elevations / 76 buildings** in
the cached area, with a source-bound keyboard review workflow and stronger
roof-image experiments. Sterk is also read by name in the blind image pipeline,
separately from the authored anchor below. Total paid experiments: **$1.237401792**
of the authorised $5; no unresolved charges and no changes to the existing
76 human task labels. Geometry remains unchanged.

Open the [photo-linked demo](./da-costa-block.html?neighbourhood=1) and
[20-case review session](./neighbourhood-review.html?queue=priority) through
`npm run demo:neighbourhood`. See the
[experiment report](./DA_COSTA_EXPERIMENTS_2026-09-09.md),
[roof critique](./DA_COSTA_ROOF_CRITIQUE.md), and updated
[implementation plan](./NEIGHBOURHOOD_POC_PLAN.md). The earlier entries below
remain the provenance of the authored studies, not newly machine-verified facts.

## Brief — 7 September 2026

Build a small interactive 3D study of the block enclosed by Da Costakade,
Hugo de Grootgracht, Nassaukade and De Clercqstraat. Include a narrow context
margin across the canals and the shopping street so that its edges make sense.
Try three improvements: the public realm, everyday visual anchors, and coherent
architectural families. This is a local demo, with no changes to the game or
the existing façade reconstruction work in this dirty worktree.

## Working record

### Reconnaissance

- The existing OSM tree extract contains zero trees in the study envelope.
  The municipal tree inventory returns objects here, including **stumps**.
  Filter object status; never turn a historic tree/stump record into a canopy.
- Existing local-business data identifies Fuoco Vivo and Parsa Persian on the
  block's southern frontage. Verify their current identity and address against
  their own sites before representing them.
- Sterk's own contact page gives De Clercqstraat 7, on the opposite side of
  the street. It is useful context, not a business inside the target block.
- BAG supplies footprints and construction years. 3DBAG supplies actual roof
  geometry. BGT supplies road/footpath/water polygons. Municipal panoramas
  supply visual reference without needing a per-window extraction pipeline.
- Preserve source geometry and identifiers. Treat façade patterns, material
  palette and prop dimensions as authored simplifications unless a reference
  explicitly supports them. A business coordinate alone does not identify its
  entrance or wall.

## Sources under investigation

- [BGT collections](https://api.pdok.nl/lv/bgt/ogc/v1/collections?f=html) — CC0.
- [BAG](https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand?f=html) — CC0.
- [3DBAG](https://docs.3dbag.nl/en/schema/layers/) — CC BY 4.0.
- [Municipal trees](https://api.data.amsterdam.nl/v1/docs/datasets/bomen@v1.html).
- [Municipal panoramas](https://api.data.amsterdam.nl/panorama/panoramas/).
- [Sterk contact page](https://sterkamsterdam.nl/contact).

### What the photographs changed

Inspected full municipal panoramas, without rectifying individual façades:

| View | Capture | Observation used |
| --- | --- | --- |
| De Clercqstraat | 2025-07-03, `recording_2025-07-03_08-35-58_00407` | Dark continuous commercial ground floor; Fuoco Vivo's red awning; green/dark Scooter Center West frontage; pale upper window frames; balcony rhythm. |
| Nassaukade | 2025-06-18, `recording_2025-06-18_08-56-14_01110` | Brown brick residential row, pale trim, projecting balconies, broad roadway, substantial trees and moored boats. |
| Northern corner | 2025-06-18, `recording_2025-06-18_08-56-14_01099` | Groot Amsterdam's pale shopfront and dark lettering on the southeast-facing chamfer. |
| Da Costakade | 2023-01-12, `TMX7316010203-002929_pano_0013_000033` | Brick paving, narrow quay, winter tree row, bicycles, boats and repeated residential fronts. |
| Shopping context | 2023-01-10, `TMX7316010203-002921_pano_0015_000272` | Older street context; used as a secondary reference, not proof of current business occupancy. |

Full URLs, capture dates and camera positions are in the compiled extract's
`references` array. The reference button opens the original 360° image. It does
not claim camera registration to the synthetic view.

Findings that mattered:

- A request for the nearest **2025** Da Costakade image selected a view **61 m
  away on Nassaukade**. Discarded it as Da Costakade evidence and used the
  January 2023 capture 5 m from the requested location. “Nearest” is not enough.
- The inspected 2025 mission reports zero camera heading and height. Those
  fields must not drive metric reconstruction. Visual inspection is still useful.
- A [municipal terrace plan from 2021](https://assets.amsterdam.nl/publish/pages/1038217/20211223_concept_terrassenplan_de_clercqstraat-jan_evertsenstraat.pdf)
  identifies Fuoco Vivo's frontage and a 3.30 × 1.50 m terrace (p. 8), and
  Bagels & Beans on the north side of De Clercqstraat at its junction
  with Da Costakade (p. 10). It establishes historical location/layout; it is
  not a survey of September 2026 tables. The PDF screenshot service timed out;
  extracted document text and the municipal panorama remained usable.
- The visual treatment needed here is a late-19th/early-20th-century brick
  apartment row, not a collection of randomly chosen tourist canal-house gables.
  Kept the 3DBAG roof silhouettes rather than inventing new gables.

### Acquired and compiled

- Fixed study envelope: WGS84 `[4.87165, 52.37115, 4.87545, 52.37365]`.
- Local scene uses RD metres, origin derived from `[4.87355, 52.3723]`.
  Y is up; Z points south. The 260 × 278 m miniature includes neighbouring
  context. No individual home marker from the supplied screenshot is stored.
- **171 active BAG buildings**, **50 inside the selected block**.
- **159** buildings have a matched 3DBAG LoD2.2 model; **47 of the 50 target
  buildings** have one. Geometry comes from 2023 AHN where reported by the
  source, while current BAG registration provides identity and construction year.
- The three target buildings without matched roof geometry are small,
  unaddressed courtyard footprints. The initial generic 14 m fallback produced
  implausible towers. Replaced it with an explicitly approximate 2.8 m fallback.
  This is conservative depiction, not a measured building height.
- **94 tree records**, after excluding **15 stumps**. The visual extent clips
  some edge records. Position/species/height class come from the inventory;
  crown shape, width and choice of a midpoint height are approximations.
- **42 designated BAG moorings**, from
  [the ligplaats collection](https://api.pdok.nl/kadaster/bag/ogc/v2/collections/ligplaats/items?bbox=4.87165,52.37115,4.87545,52.37365&limit=1000&f=json).
  Used their location and long axis for simplified houseboats. The register
  describes the berth, not the present vessel or whether it is occupied.
- **319 historical/superseded BGT features excluded** across the downloaded
  layers. Both `termination_date` and `eind_registratie` matter; retained the
  newest surviving record for each local ID. Rendering every response feature
  would overlay old street layouts on current ones.
- The 3DBAG API returns 50 features per page despite `limit=100`. Followed its
  next links. Each page carries its own CityJSON transform; apply that page's
  transform before combining models. Applying one page's offset globally would
  displace later buildings.
- Compiled scene is about **1.8 MiB uncompressed**. The demo reads it locally;
  it makes no map-tile or geometry API requests at runtime. Original reference
  photographs are fetched only when needed and require network access.

### Five small landmarks

Business-to-building joins use the official BAG address → pand relation, not
nearest-building guessing. Street-facing walls are checked against public-space
geometry; the observed camera side selects the northern corner's chamfer.

| Cue | Address | BAG pand | Evidence and simplification |
| --- | --- | --- | --- |
| Fuoco Vivo | De Clercqstraat 12 | `0363100012159182` | [Own site](https://www.fuocovivo.nl/gerechten/), 2025 panorama and 2021 terrace plan. Red awning and dark base observed; sign/table dimensions approximate. |
| Scooter Center West | De Clercqstraat 10 | `0363100012236681` | Readable 2025 panorama and [address listing](https://www.waze.com/live-map/directions/nl/nh/amsterdam/scooter-center-west?to=place.ChIJ1wkKwd4JxkcRg_XIfYG0i14). Scooter count/positions are illustrative. Own website fetch timed out. |
| Bagels & Beans | De Clercqstraat 22 | `0363100012153066` | [Street business association](https://declercqstraatamsterdam.nl/company/bagels-beans/) and 2021 terrace plan establish the canal corner. Shop treatment is approximate; current occupancy is not independently certified. |
| Groot Amsterdam | Nassaukade 134 | `0363100012166471` | [Own contact page](https://www.grootamsterdam.nl/contact/) and 2025 panorama. Pale corner fascia observed. First candidate wall faced north; corrected to the southeast chamfer visible from the source camera. |
| Sterk Amsterdam | De Clercqstraat 7 | `0363100012236141` | [Own contact page](https://sterkamsterdam.nl/contact) and BAG join. Correctly placed across the shopping street, facing north. Colours and fascia are illustrative. |

Parsa Persian was present in the existing OSM-derived POI extract, but the
available corroborating listings were old. It was not selected for this pilot.
The five selected cues include different levels of evidence; their inspectors
describe those differences rather than calling all five photo-verified.

### Rendering and iteration

Built `da-costa-block.html` as an independent browser scene using the existing
shared Three.js runtime. No production gameplay code or existing package scripts
were changed.

1. Public realm: measured BGT road/footpath/cycleway/water outlines; simplified
   curbs, quay faces, tram rails, municipal trees, parked cars in registered
   parking areas, and houseboats in registered berths. The invented part is the
   appearance of those objects. Parking occupancy, boat occupancy, precise rail
   offsets and vertical street levels are not surveyed.
2. Everyday landmarks: sparse source-backed business identities represented by
   small fascia/awning/glazing/table assets. Core façades remain available when
   this layer is switched off.
3. Architectural families: shared subdued brick palette, procedural brick
   material, pale frames/sills, cornices, residential entrances and balcony
   rhythms. Counts/placement are approximate, not extracted window observations.
   Interior party walls receive no invented street-facing windows.
4. Interaction: drag orbit, right-drag/shift-drag pan, wheel/pinch zoom, arrow-key
   controls when the canvas is focused, five camera presets, building picking,
   evidence inspectors, reference photographs, and an all-layers comparison.
5. Neighbouring buildings stay pale to make the selected block readable.
   Street detail is at its true scale; the camera can get close enough to see it.

Rendering checks caught and fixed:

- The initial shop camera sat behind the opposite row: moved it into a view
  along the actual shopping frontage. The northern preset now shows the corner
  fascia instead of a tree hiding its original wall.
- Hidden map labels still displayed because a component `display:flex` rule
  overrode the browser's `[hidden]` rule. Added an explicit hidden rule and
  collision filtering; labels behind their façade are withheld.
- Reduced approximately **1,383 draw calls to 129** in the overview (including
  the added boats). Batched road surfaces and building materials; kept per-face
  building IDs for picking. Plain comparison is about **24 draw calls**.
- Corrected triangle winding after projecting 3D surfaces for triangulation.
  Small roof slivers still alias in a city-scale shadow map, so buildings cast
  shadows onto the street while their own surfaces use diffuse illumination.
- Fixed overlapping generic ground-floor windows and authored shopfront panels
  by placing each panel beyond the generic trim; the layer switches remain
  independent.
- Adapted the overview framing and controls to a narrow phone viewport.
- The design hook flagged the dynamically populated photo element's missing
  initial source. Added a real source and lazy loading. No ignores/suppressions
  were added and no hook findings were left outstanding.

## Reproduction

From the repository root (prefix with `rtk proxy` in an RTK-configured shell):

```sh
node --import tsx scripts/da-costa-block/acquire.mjs
node --import tsx scripts/da-costa-block/compile.mjs
npx vite --host 127.0.0.1 --port 5192 --strictPort
```

Open <http://127.0.0.1:5192/canal-drive/da-costa-block.html>.
The normal development server can serve the same `/canal-drive/da-costa-block.html`
path. The demo requires no new package installation or build step.

Raw responses and inspected images are cached in `.cache/da-costa-block/`.
`public/data/da-costa-block/sources.json` records source request URLs, byte counts
and SHA-256 hashes. Existing cache files are reused; the acquisition timestamp
is the assembly time of that manifest, not proof that every upstream dataset
was refreshed then. Delete or move a **specific cache response** only when a
deliberate source refresh is needed.

With the local server running:

```sh
node scripts/da-costa-block/check-demo.mjs
```

Set `DA_COSTA_DEMO_URL` to use another local server. Browser checks cover loading,
layer switches and restoration, all five camera presets, the landmark inspector,
source dialog, mobile overflow, unique building IDs, target 3DBAG coverage,
excluded stump records, address joins, three important shopfront bearings,
conservative unmeasured courtyard heights, and the draw-call budget.
Screenshots and a machine-readable report are written to
`.cache/da-costa-block/captures/`.

Final validation: **passed** in desktop Chrome at 1500 × 1050 and a narrow
390 × 844 viewport. The browser reported no exceptions or failed local asset
requests. All three controls, comparison restoration, camera views, inspector,
source dialog and data assertions passed. Individual switch testing caught a
decorative switch span intercepting direct input clicks; it now has
`pointer-events: none`. JavaScript syntax checks also passed. Inspected the
overview, shopping frontage, both quays, northern corner and mobile captures.
Final overview: 129 draw calls, about 226,000 triangles including shadow passes;
plain view: 24 calls. This is renderer instrumentation, not a mobile frame-rate
benchmark. Final compiled extract: 1,837,633 bytes.

## What this experiment demonstrates, and what remains open

The three ideas can be combined into a small navigable scene with useful
source-backed local differences, without completing façade extraction. The most
productive new data was public-space geometry, tree status, registered moorings,
and the ordinary shops at the block's corners/frontage.

The street and roof geometry is more dependable than the façade appearance.
This prototype is still visibly stylized: window counts, balconies, paint colours,
shop dimensions, boats and furniture need selective correction if any of them
becomes a learning target. A resident's recognition of the block remains the
most useful next evaluation. The browser checks do not establish learning
transfer, historical accuracy of every object, or frame rates on a real phone.

## Design hook follow-up

Replaced Inter with Avenir Next (Avenir, Segoe UI and generic sans-serif fallbacks),
retaining the Georgia headings. Replaced the view note's thick coloured left
border with a thin neutral outline. Both reported findings were addressed in
the stylesheet; no hook ignores or suppressions were added.
Reran the existing desktop/mobile browser checks after these changes: passed.

## Extension — 8 September 2026

The priority for this pass is written out in
[A recognisable Amsterdam, at city scale](./CITY_APPEARANCE_PLAN.md).
It covers the appearance contract, architectural families, restrained colour
and window variation, frontage capture, provenance, streaming, staged rollout,
cost measurement and recognition/performance checks. The citywide pipeline is
a proposal; the two local studies below are implemented.

### Elandsgracht: a second study using the same renderer

Open [Elandsgracht](./da-costa-block.html?study=elandsgracht), or go directly to
[Engels Verf](./da-costa-block.html?study=elandsgracht&view=engels).
Links between the studies and the citywide notes are in the sidebar.

- Acquisition envelope: `[4.8773, 52.36835, 4.8839, 52.3708]`; a separate cache
  and compiled extract keep the original block reproducible.
- **507 active buildings**, including **92 with Elandsgracht addresses**;
  **489 matched 3DBAG models**, **150 tree records**, **7 stumps excluded**.
- Eleven selected June 2025 municipal views cover the street and closer
  storefront references. Their camera locations are 1–8 m from the requested
  reference points; visual inspection still determines their relevance.
- **10 selected storefront cues**, represented by **12 frontage sections**.
  Five cues have observed projecting awnings; Siem's canopy is split into two
  sections. This is a first selection, not an exhaustive shop census or a
  measurement of reviewed frontage length. Most individual fronts remain
  approximate, and unknown shops receive no invented names or awnings.

| Cue | Address | Treatment and evidence |
| --- | --- | --- |
| Engels Verf | 93–97 | Rainbow fascia, white lettering, dark bases and pale display trim. Own [contact page/photo](https://engelsverf.nl/contact/) plus June 2025 panorama. Shelves and paint tins are illustrative. |
| WALDO | 91 | Brown fascia and pale window surround visible in June 2025. Label explicitly dates the frontage; current occupancy is unverified and external listings conflict. |
| Koffiespot | 53 | Grey-green lower facade and white lettering visible in the central panorama. |
| Baskèts | 57 | Dark display frontage and small lettering from the same dated view. |
| Vlaamsch Broodhuys | 122 | Pale frontage and dark projecting awning; [own location page](https://www.vlaamschbroodhuys.nl/winkels/amsterdam/elandsgracht/) establishes the address. |
| Siem van der Gragt | 116A | Green paired awnings and dark fascia; business association address and the close reference near 108. The interval within the larger building is approximate. |
| Western corner | 148 | Taupe awning and grey-painted building observed in the western panorama; tenant left unnamed. |
| Blue awning | 64 | Observed blue canopy, simplified projection; no current tenant name asserted. |
| Dark awning | 66 | Neighbouring dark canopy; dimensions and glazing are approximate. |
| Antiekcentrum | 109 | Burgundy fascia/entrance and pale lettering from the June 2025 western view. |

Engels is the useful data-model test: **three addresses join two BAG buildings**
(`0363100012174549` and `0363100012174146`). Keep one business identity, three
address/frontage intervals and both building links. Do not discard an interval
because its building ID repeats, or paint the entire connected building as one
shop. The inspector works when either building is selected. The browser check
also verifies that the two sections on the shared wall do not overlap.

The Elandsgracht families add stable variation in brick shade, bay spacing and
window width. Photo-informed dominant colours override the fallback for Engels
and the grey western corner. Exact RGB values and upper window layouts remain
authored. No generic balconies are added to the Elandsgracht study. Opening
rectangles are checked against wall polygons so they do not extend into sloped
wall tops. Narrow 3DBAG wall segments now receive their own windows; the original
three-metre cutoff had left several complete house fronts blank. Cornices are
withheld where a sloping wall top cannot contain them. More complete facade
segmentation/merging remains necessary before
calling this a reconstruction of every frontage.

### Amsta / De Poort: an institutional facade

Open the new **Amsta · De Poort** camera in the original study, or
[link directly to it](./da-costa-block.html?view=amsta).

The building is `0363100012237064`, already present in the northern context.
Amsta gives the official address as
[Hugo de Grootkade 18–28](https://www.amsta.nl/locaties/de-poort); the BAG join
in this extract uses number 20. The view from Da Costakade identifies the broad
canal elevation across the water. It remains outside the selected residential
block rather than changing the block definition to include it.

The January 2023 panorama
`TMX7316010203-002929_pano_0013_000022` shows pale horizontal framing, repeating
glazing, muted ochre accents and a glazed lower part. A separate
`institutional-bands` pattern now follows the retained 3DBAG walls and setbacks.
It uses a smooth material and shared horizontal levels, with no invented
residential balconies or door-per-house rhythm. Module widths, floor levels and
colours are simplified; there is no asserted entrance or wall-mounted Amsta sign.
The rear of the complex remains restrained because this view does not observe it.

A rendering correction mattered: a recessed upper wall can sit **inside** the
ground footprint even on its outward side. The old footprint-based normal test
flipped that wall inward and left the top storey blank. This local institutional
case uses the complex centre to choose its outward side. The city pipeline
should derive orientation from properly validated surface topology; a centre
test is not a universal solution for concave buildings.

### Reproduce the extension

```sh
rtk proxy node --import tsx scripts/da-costa-block/acquire.mjs
rtk proxy node --import tsx scripts/da-costa-block/compile.mjs
rtk proxy node --import tsx scripts/da-costa-block/acquire.mjs --elandsgracht
rtk proxy node --import tsx scripts/da-costa-block/compile.mjs --elandsgracht
rtk proxy npx vite --host 127.0.0.1 --port 5192 --strictPort
```

Storefront observations live in `scripts/da-costa-block/eland-frontages.json`.
The new extract is `public/data/elandsgracht/block.json`; its source manifest is
beside it. Reference images are cached by panorama ID and copied to convenient
view names, preventing a changed view selection from silently reusing an older
image under the same filename. The browser continues to load compiled local
geometry, with photographs requested only when a reference dialog is opened.

```sh
rtk proxy node scripts/da-costa-block/check-demo.mjs
rtk proxy node scripts/da-costa-block/check-demo.mjs --elandsgracht
```

Checks cover both studies, camera presets, layer switches, comparison restore,
inspectors and photo dialogs, mobile overflow, building identities, geometry
coverage, stump exclusion, storefront sides and the Engels range join. Captures
and reports are in each study's `.cache/.../captures/` directory. The scene now
supports direct camera links; the Engels preset uses a wider, low street view
to make the three fascias readable below the tree crowns.

Final extension validation: **both suites passed**, at 1500 × 1050 and
390 × 844, with no browser exceptions or failed local asset requests. JavaScript
syntax and whitespace checks passed. Inspected the final Engels, awning row,
western/eastern street, De Poort and mobile captures. Da Costa overview:
**141 draw calls**, 263,503 triangles including shadow passes; Elandsgracht:
**176 draw calls**, 354,344 triangles. Compiled JSON sizes are 1,839,587 and
3,872,555 bytes respectively. These are local renderer measurements, not a
mobile frame-rate benchmark or a citywide streaming result.

### What to carry into the city plan

The renderer can share shop/awning primitives while the **frontage record**
carries local identity and evidence. Large buildings need distinct proportions,
bands and blank areas, not extra repetitions of the small-house template.
Architectural variation belongs to a coherent building/row, while storefront
variation belongs to a dated ground-floor interval. These two studies are
examples of that separation, not evidence that ten shops or one institution
are enough to calibrate the whole city.
