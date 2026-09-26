# Independent implementation and self-review

9 September 2026. Current plan: [neighbourhood](./NEIGHBOURHOOD_POC_PLAN.md) /
[city](./CITY_APPEARANCE_PLAN.md). Three parallel workstreams plus parent integration.

## Findings fixed during this implementation

1. **Shared-wall ownership was order-dependent.** Amsta surface 46 serves two physical
   intervals. The broad frontage covers approximately 0–22.455654 m; the other covers
   22.456547–43.045399 m. Both now render independently. The roughly 0.000893 m gap
   remains baseline. A browser-only red/white fixture makes accidental whole-wall
   assignment visible; neither fixture nor a fabricated review is saved.
2. **Withholding a shop could still create one.** A legacy street-name heuristic
   reintroduced commercial glazing after an unknown/rejected field. Neighbourhood
   mode now requires explicit shop presence; original/Eland styling remains intact.
3. **Four-corner rectangle checks missed openings.** A long narrow hole can cross a
   window rectangle while containing none of its corners or vertices. Decoration
   containment now checks source boundaries through the rectangle interior, including
   concave exterior notches. Source mesh triangles retain holes and winding.
4. **Street selection and reference fixtures limited reuse.** Generic areas now omit
   named anchors/reference hints and the study street whitelist. They preserve full
   BGT polygons and inventory every exterior component and courtyard ring, with
   courtyard-facing normals and stable endpoint IDs.
5. **Provider counts are not interchangeable.** 3DBAG counts CityObjects, not its
   enclosing CityJSONFeatures. WFS needs explicit offset/count handling. The adapters
   now record count units and reject truncated, repeated or incompatible cached pages.
6. **Diagonal projected bounds could under-cover an area.** Custom requests project
   all four geographic corners. Frozen preset requests retain their historical URLs;
   old cached bytes are not relabelled as the wider request.
7. **Per-area spending could reset the allowance.** New requests reserve against a
   global atomic journal importing all existing charges. Unknown charges fail closed.
8. **Hiding text was not blind review.** The styled iframe and mesh diagnostics are
   now hidden/unloaded initially; assistance exposure persists against exact evidence.
   New canopy construction/deployment fields let explicit human corrections override
   a dated machine state without changing old labels into asserted deployment.

## Measured outputs

- Existing evidence remains 103 frontages / 76 buildings; no new inference or training.
- Interval rendering represents 101 frontages; two unusable crops remain withheld.
- Cache-only legacy inventory: 109 candidate frontages. Generic selection over the
  same source cache: 171 candidates, about 1,400 m of summed candidate frontage.
  These are candidates, not newly photographed or accepted observations.
- Offline staged transport: 171 buildings, 103 existing observations, one z14 owner
  tile and eight reference-only halo tiles; 437,408 compressed bytes total.
- Immediate full-pipeline rerun reused compilation, inventory and tile stages.
- Actual Three/WebGL adapter, at desktop and mobile viewport sizes: 171 buildings,
  two neutral meshes / 10,394 triangles; approximate massing 3,995 triangles;
  opt-in wall colours seven meshes / 10,737 triangles. Picking and complete disposal
  passed. The 95 supported wall-colour records are fewer than the 101 associations:
  six recovered ground/roof-only records correctly do not establish paint.
  These geometry-only measurements exclude the subsequently integrated optional facade recipes
  and street/tree context described below.
- Desktop/mobile-layout browser captures: original 141 draw calls / 263,503 triangles;
  Eland 176 / 354,344; neighbourhood overview 154 / 329,515. These are small-scene
  headless measurements, not physical-phone performance or city extrapolations.
- Source audit: all 733 hashes passed (564 crops and 169 unique original panoramas).
- Historical spend ledger unchanged, SHA-256
  `92fb28efbcfdf28d1326038252f6b6a1f98148afc8bfbe7f8729e02b6cbb53c3`.
  Global import: 388 entries, $1.237401792, no unresolved charges; $5 cumulative ceiling.

## Safety and remaining gates

Tests use isolated ledgers, mock paid providers, temporary source replays and intercepted
browser writes. Automated work did not change real human decisions, source images or paid
history. Existing public block/evidence data were not replaced by generic staged outputs.
The review service preserves human history and its private token across its latest restart;
project Impeccable remains disabled.

Night review: [twelve photo-first cases](./neighbourhood-review.html?queue=calibration),
twenty-minute cap. Human calibration and a stratified held-out sample still gate automatic
detail publication. Main driving-game integration, physical-device performance and the
ten-block acquisition remain separate rollout steps, not completed city coverage.

Abandoned long-running jobs can resume after their process is gone. An abandoned lock
inside a short atomic journal transaction deliberately fails closed and requires inspected
recovery; an uncertain paid request must never be retried on the assumption it was free.

See package commands `test:neighbourhood`, `test:city-appearance`, `pipeline:appearance`
and `lint`; `test:city-appearance-render` exercises actual WebGL buffers and screenshots.
`pipeline:appearance` is read-only by default; `-- --run` stages cached work.

## Browsable demo and feedback loop added

Open [the streamed neighbourhood](./city-appearance.html) on the existing local server.
The scene combines 171 source-geometry buildings, 103 existing photographed frontages,
BGT street/water surfaces and 94 inventory trees. Overview, canal, shopping-street and
source-wall cameras expose the same tile-backed data. The main driving game is unchanged.

Source-bound paint remains at facade LOD. Opt-in detail recipes provide 1,040 synthetic
windows and 39 supported storefront observations across 56 source-wall patches in the
all-detail fixture. These are display priors, **not extracted window counts or shop shapes**.
Five fixed palettes batch unpainted opening geometry. Unknown/negative fields, source holes,
neighbours, nonplanar faces and elevated wall fragments constrain generated detail. No
awning passes the deployed-fabric human gate yet; no landmark name is authored into this viewer.

The experimental release compiler audits all 733 image hashes, effective human fields,
wall/geometry bindings and source revisions, then writes immutable releases and atomically
updates `current.json`. The viewer verifies tile/context hashes. A failed update leaves the
previous scene visible. Live refresh is serialized with saves and never changes human answers.

One real human review is now saved on Amsta's broad frontage. Its note, “the building is in
fact wider than the crop,” stays verbatim with the accepted-wall/unknown-appearance fields;
the publisher lists it as a follow-up without inventing a crop-repair label. Automated tests
exercise positive, negative, unknown and crop-repair histories in isolated fixtures only.

Desktop/mobile viewport checks cover navigation, selecting evidence, preserving selection
through style changes, live derived refresh, release failure, and repeated GPU resource
disposal. Screenshots and machine-readable metrics are in
`.cache/city-appearance/viewer-check/`. They do not establish actual phone frame rates.

Independent integration review caught and fixed three more defects: source-bound display
clipping at IWKA/Nassaukade, dropped rapid checkbox changes during asynchronous loads, and
tree instance buffers not released by geometry disposal alone. Canonical bounds stay intact;
only the bounded display extent changes. Delayed-fetch tests now check the final checkbox
state. Tree instances dispatch their own disposal event; actual outstanding WebGL buffers
held at 49 → 49 → 49 → 49 across four independent refreshes (previously +4 per refresh).
The automated browser regression also counts real buffer allocations, not just geometries.

### Detailed-view opening regression from user screenshots

Fixed missing provisional doors and horizontal fascia through ground-floor windows in the
older detailed viewer. Doors previously used a world-zero centre, so containment rejected
their lower frames on raised source walls while detached handles survived. A second shop
glazing plane and fixed-height fascia also overlaid the regular opening layout. The shared
TypeScript `facadeOpeningLayout.ts` now anchors complete openings to each wall base and
places horizontal trim only in a clear inter-floor gap; redundant storefront overlays were
removed. The legacy page imports its generated browser bundle. This is still provisional
geometry, not extracted entrance positions. Unit and actual-browser checks cover source
heights, holes, trim collisions, original/neighbourhood/Eland modes, and unchanged reviews.

## Next-area work completed without imagery or inference

The [expansion inventory](./EXPANSION_INVENTORY_2026-09-09.md) fetched 35 public metadata
pages / 29.49 MB for a frozen roughly 550 m square: 825 operational buildings, 8,162 land
panorama positions and 509 trees. Offline replay reproduces the report and rejects corrupt
cache bytes. No imagery or model calls were purchased. It is deliberately not labelled a
complete geometry acquisition: BGT/3DBAG, frontage selection and a capped source-image
tranche remain next. The boundary is not ten measured blocks or the eventual 100-block area.

Reproduction: `build:appearance-viewer`, `publish:appearance-demo`, then the existing
`demo:neighbourhood` server. Checks: `test:city-appearance-facades`,
`test:city-appearance-context`, `test:appearance-demo-publication`, `test:city-appearance-viewer`, and
`test:expansion-inventory`, in addition to the existing pipeline and neighbourhood suites.
