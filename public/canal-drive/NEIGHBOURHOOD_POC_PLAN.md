# Da Costa neighbourhood: implementation and review checkpoint

Updated 9 September 2026. This replaces the historical unchecked POC checklist.
The long-term architecture and expansion gates are in [the city plan](./CITY_APPEARANCE_PLAN.md).

## Tonight: 20 minutes, twelve cases

Start `npm run demo:neighbourhood`, then open the
[calibration queue](./neighbourhood-review.html?queue=calibration).
The new [streamed neighbourhood demo](./city-appearance.html) is ready to explore.
The [detailed reference demo](./da-costa-block.html?neighbourhood=1) remains available.
In the streamed demo, **Load latest saved reviews** rebuilds derived appearance without
saving answers. Your review tab and any unsaved choices remain independent.

The queue orders Amsta's broad Hugo de Grootkade 20 frontage, Sterk / De Clercqstraat 7,
Da Costakade 4, ordinary controls at 15 / 25 / 27, the corner at 28, DORUS / 51,
Michel / Da Costastraat 1, IWKA / Da Costastraat 6, and De Clercqstraat 4 / 6.
Stop at twenty minutes; unanswered cases are not failures.

- Establish the physical wall and whether its crop is usable before appearance.
- Use **C — right building, bad crop** when identity is clear but framing is wrong.
  Use **U** when identity or placement is uncertain. These are different diagnoses.
- Leave hidden roof volume unknown. Decorative facade top is a separate field.
- For canopies, distinguish fabric from rigid construction and deployment from installation.
  Add a short note when the choices do not express the evidence.
- Photo-first mode hides model text, mesh diagnostics and the styled preview.
  Revealing assistance is recorded against the source evidence and cannot be erased by hiding it again.
- The selected queue is calibration, not a representative blind accuracy benchmark.

Human labels remain separate from all agent reviews. Export/import and source-change checks
are preserved. The server rejects stale packets. New optional canopy details preserve legacy
labels as unknown specifics rather than inferring deployed fabric.
An explicit same-wall human judgment of fabric plus deployed can enable the generic canopy;
unknown, retracted, rigid or mixed judgments override older machine deployment suggestions.

## Implemented and verified foundations

| Subsystem | Current implementation |
| --- | --- |
| Evidence | 103 photographed frontages on 76 buildings; full, ground, roof and context views, plus aerial building/context evidence. Cached study is a couple of blocks, not a completed 250 m radius. |
| Extraction | 99 source-current paid baselines; 33 direct visual self-reviews, 32 eligible primary-agent records. Field-level abstentions and frozen source hashes prevent stale opinions becoming new labels. |
| Placement | Coherent Amsterdam panorama projection; own-building occlusion and corrected crops; inferred lens heights explicit. Local wall-height mode remains opt-in after a broader trial truncated decorative silhouettes. |
| Wall intervals | Amsta's two records no longer compete for one whole mesh face. Source triangles are partitioned into measured intervals; gaps remain baseline; conflicting observations withhold detail. Both records render: 101 represented frontages, two unusable records deliberately withheld. |
| Decorations | Frames, paint, glazing and optional signs follow the supported interval. Source holes and concavities constrain decoration rectangles. Neighbourhood storefronts require an explicit positive field; street-name heuristics no longer resurrect withheld shops. |
| Roofs | Roof volume and facade top are independent. Image-first proposals precede mesh critique. Small pitches, lower annexes and true attachment are distinguished; flat mesh does not refute visible roof detail. Canonical roof geometry remains unchanged. |
| Trees | 94 inventory positions with height-class proxies and six loose crown typologies. Botanical priors are not measured crowns or inferred pruning histories. |
| Review | Twelve-case photo-first calibration, source-aware queue, separate placement/appearance stages, notes, optional canopy details, persistent assistance exposure, keyboard navigation and original-photo popup. |
| Scale | Shared area configuration reaches acquisition, compilation and evidence preparation. Generic outputs omit authored landmark hints and retain complete BGT features. Cache-only inventory runs without downloading or writing evidence. |
| Jobs and spending | Restartable dependency jobs, artifact hashes, bounded concurrency, source pagination/completeness checks, and an atomic cross-area spending journal integrated into inference. |
| Transport and demo | Browsable streamed scene: 171 source-geometry buildings, 103 existing observations, street/water context and 94 inventory trees. Deterministic owner tiles and reference-only halos, source hashes, 12-resident-tile budget, LOD hysteresis, stable picking and disposal. Experimental interval paint and illustrative opening recipes are explicit options. |
| Feedback publication | Immutable hashed releases and an atomic current pointer. Saved review refresh audits source bytes and human dependencies; invalid releases leave the prior scene intact. Notes and crop-repair judgments produce source-bound follow-ups, never invented labels. |
| Next-area inventory | A fixed roughly 550 m square contains 825 operational BAG buildings, 8,162 land panorama positions and 509 tree records. Metadata only: no new photographs, 3D geometry or accepted appearance coverage. See the expansion inventory report. |
| Expansion tranche | A source-pinned inner rectangle now compiles 422 buildings, inventories 449 public-facing wall candidates and produces 450,193 gzip bytes of neutral staging tiles. Public metadata/geometry only: zero image downloads, observations or paid calls. See the expansion tranche report. |
| Panorama audit | A 24-frontage, 14-street new-area packet passed byte/crop checks. Photo-first agent review marked 20 frontages / 257.27 m usable and four / 32.94 m partial, with no apparent wrong-building identity. |
| Expansion routing | Forty immutable compact images produced 20/20 schema-valid machine routes for $0.014493105. They are shown beside source pixels but quarantined from publication; partial evidence was withheld. |
| Expansion demo | 825 buildings across the 550 m parent area with z16 building/context streams in a hashed gzip release. Era-sensitive visualization priors, layered close-LOD exterior window/entrance rhythm, 20 quarantined colour overrides from the inner audit, togglable coverage, street labels, wrong/right-tested recall challenge, and a nine-leg guided route with live source-street naming work across desktop/mobile viewports with bounded residency. |
| Main-game seam | A hash-verified 825-BAG appearance sidecar decorates matching features in Canal Recall's existing complete-city MapLibre streamer, including a separate era-sensitive street-storey volume that breaks up plain extruded masses. Four independently hashed z16 owner tiles add 1,717 exact LoD2.2 roof surfaces to 645 buildings using a bounded per-source-surface compatibility gate; 81 slanted candidates remain withheld. Facades, inventory trees and BGT public realm use parallel bounded streams. A catalog-driven “Da Costa study” setup choice launches source-bound endpoints from that same release. Citywide contextual fallback survives missing/corrupt district data and all out-of-area buildings. |

Seven literal machine sign previews remain opt-in with `machineSigns=1`.
Authored anchors are separate fixtures. Sterk was transcribed in blind extraction without
its name/address in the prompt; preserve that discovery test instead of supplying landmark hints.

## What the experiments actually established

Crop/identity failures dominate many apparent classifier disagreements. Another model agreeing
on the same obscured crop is not independent verification. Street and aerial evidence can
support different components of one roof; unknown must not become a vote for flat.

The small frozen classifier recovered only one of five positive storefronts in grouped
cross-validation and was not promoted. Agent labels are weak supervision, never human gold.
Training and evaluation must split by building and street.

Source repairs invalidate dependent results. Ground evidence remains independent of roof
repairs where source dependencies allow it. Mixed-date views remain explicitly dated; they
must not synthesize a supposedly current tenant or deployment state.

A generic inventory of the existing cached geometry finds additional public-facing candidates
beyond the old named-street filter. This is candidate coverage, not new photographed or
accepted frontage coverage.

## Budget and release gates

Cumulative authorized paid inference: **$5**.
Measured cumulative cost after the expansion routing run: **$1.251894897 across 408 calls**,
no unresolved charges. The new shared journal imports prior spending;
per-area ledgers remain compatible and cannot reset the cumulative allowance.

The current demo remains experimental. Tonight's labels unblock calibration, not automatic
citywide detail publication. Before ten-block expansion, audit source identity, wrong-wall
details, unknown rates and ordinary-house controls. Before roughly 100 contiguous blocks,
measure throughput, costs and real-device streaming performance. Full-city paid work needs
a measured forecast within whatever budget is then authorized.

## Verification and handoff

- `npm run test:neighbourhood`: geometry, source binding, intervals, roofs, trees,
  extraction merging, budget mocks and isolated review browser/API checks.
- `npm run test:city-appearance`: source adapters, restart/budget concurrency,
  generic area compilation, stable tile ownership and streaming lifecycle.
- `npm run lint`: TypeScript checks.
- `npm run test:city-appearance-render`: actual WebGL checks of the staged geometry adapter,
  neutral defaults, opt-in colours, stable picking, massing/detail changes and disposal.
- `npm run build:appearance-viewer` and `npm run publish:appearance-demo`: reproducible
  browser bundle and validated experimental release. Start the existing review server;
  open `/canal-drive/city-appearance.html`.
- `npm run test:city-appearance-viewer`: desktop/mobile viewport interaction, live derived
  refresh, failure retention and repeated-release GPU resource checks; never writes labels.
- `npm run test:city-appearance-game`: desktop/iPhone complete-city streaming, stable BAG
  picking, hash-verified appearance-sidecar integration and real setup-to-study-route launch in
  the actual MapLibre game.
- `npm run test:appearance-demo-publication`, `npm run test:city-appearance-facades` and
  `npm run test:expansion-inventory`: isolated feedback/source gates, conservative facade
  recipes and deterministic metadata acquisition.
- `npm run test:city-appearance-context`: inventory-based context, exact instance-buffer
  disposal events, idempotent cleanup and unchanged source inputs.
- `node scripts/check-neighbourhood-render.mjs`: original/neighbourhood/Eland
  desktop/mobile regression captures.
- `node scripts/check-wall-interval-render.mjs`: actual Amsta and contrasting-colour
  browser-only fixtures; no synthetic review is saved.
- `node scripts/check-frontage-camera-render.mjs`: close camera, zoom, resize and sign checks.
- `npm run inventory:neighbourhood`: cache-only candidate inventory.
- `npm run compile:appearance-tiles`: dry-run transport inventory; explicit staging output only.
- `npm run pipeline:appearance`: inspect the complete cache-only area run.
  Add `-- --run` to stage compilation, inventory and tiles under a source/code-versioned
  cache directory; rerun the same command to resume or reuse completed stages.
  Custom areas use `-- --area-config=/absolute/path/area.json --run` after separate acquisition.

Historical evidence: [continued self-review](./CONTINUED_SELF_REVIEW_2026-09-09.md),
[roof components](./ROOF_COMPONENT_EXPERIMENT_2026-09-09.md),
[blind storefront review](./BLIND_STOREFRONT_REVIEW_EXPERIMENT.md),
[temporal ground bays](./TEMPORAL_GROUND_BAYS_2026-09-09.md),
[tree typology](./TREE_TYPOLOGY_EXPERIMENT.md).
These are experiment snapshots, not competing current task lists.
