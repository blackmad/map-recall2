# Autonomous continuation — 9 September 2026

This is the first continuation snapshot. See the [second self-review
round](./CONTINUED_SELF_REVIEW_2026-09-09.md) for the latest 33 reviewed frontages,
seven optional signs, roof-component diagrams and camera/edge-coverage fixes.

The user's “right building, wrong crop” correction triggered a source-image and
geometry review, not another paid inference run. Three subscription-backed
agents worked in parallel on crop/geometry experiments, primary image extraction,
and rendering/integration critique. Their observations remain machine evidence;
no human review decisions or supervised labels are manufactured.

## Live changes

- **Review:** Original links open a fit/actual-size image popup. “Right building,
  bad crop · C” records identity separately from crop acceptance. Crop repair
  decisions withhold appearance and support undo/import/export. Review captions
  now say wall crop / upper-wall crop instead of implying a whole building.
  The placement map now fits the full building footprint, selected wall and
  photo camera, with a sightline and legend; the camera no longer falls outside
  its viewport. Detailed model alternatives are collapsed, not discarded.
- **Self-occlusion:** the old visibility test excluded the target building.
  Three of 103 full views were therefore blocked by another wall of that same
  building. Replacement full/roof/context crops are live; their ground pixels
  were unchanged. The broad 31.8 m Amsta front is now first in the human priority
  queue, instead of a recessed fragment.
- **Height scope:** Amsta's blue-windowed annex was cropped using the complex's
  32.25 m roof height, not its supported 14.58 m local roof. A visually checked
  replacement reduces the full crop from 144 × 1496 to 144 × 701 and shows the
  actual facade. This fourth replacement is live.
- **Primary agent extraction:** 16 direct street-image packets, four corrected
  crop packets, one annex packet and 12 roof packets are source-bound by image
  and panorama hashes. The current merged release covers 23 unique records,
  with 22 receiving eligible primary agent fields. Ineligible fields explicitly
  abstain; they do not become human labels. New roof packets support six
  flat-core/front-pitch hypotheses and initially abstain on six whole-building
  shapes. Expanded aerial evidence additionally supports `complex` for Da
  Costakade 14–26; Amsta remains image-only roof-unknown.
- **Aerial coverage:** five expanded PDOK tiles now cover all previously clipped
  footprints (12 frontages), with at least 18 m context. New image hashes retire
  old roof answers; the ground/facade observations reused here were explicitly
  re-inspected and rebound, not copied across changed aerial inputs. Roof colour
  remains withheld for these five buildings; this is coverage repair, not painting.
- **Further height trial:** only one of eight candidates improved enough to
  promote: Amsta's brick annex `12fpdwm`, now showing the whole low wing from a
  clearer camera. Three were rejected for clipped silhouettes and four retained
  as controls. The same record had already received a visibility repair, so the
  total remains four distinct changed frontage records.
- **Trees:** 94 inventory positions and compiled heights are retained. Six
  coarse crown archetypes use 72 checked species/cultivar priors, one explicit
  management record and 21 authored fallbacks. Original/Eland scenes retain
  legacy trees; the neighbourhood version supports `&trees=legacy` comparison.
- **Impeccable:** the user-requested project-only disable is persisted in
  `.impeccable/config.json`; its status command confirms disabled. No global
  hooks changed. The empty viewer image tag was also removed, not ignored.

## What we learned, including rejected changes

1. Width alone is a bad quality gate. The narrow IJscuypje corner is useful;
   the old Amsta fragment was not. Compare original panorama, crop, context,
   geometry and field-specific visibility.
2. A correct building ID does not establish the photographed wall plane.
   Include self-occlusion, not just neighbouring buildings, in visibility tests.
3. The highest point of a complex is not every annex's height. However, a
   matched mesh height is not always a safe crop ceiling: the Da Costakade 14–26
   experiment cut off a decorative clock gable despite full mesh coverage.
   **That change is rejected; local-height mode remains opt-in.**
4. Street facade tops do not determine whole-roof volume. Wider overhead context
   can distinguish a flat core and pitched edges from a complete gable roof;
   clipped footprint coverage and deep shadow still justify unknown.
5. Source provenance must survive integration. Regression checks caught and
   fixed usable agent fields hidden behind an old unusable baseline, unsupported
   OCR surviving an abstention, human overrides disappearing behind a machine
   gate, and whole-building roof candidates inherited from an unusable/clipped
   source. Human overrides restore only explicit reviewed fields, never invalid
   paint or sign guesses.

## Evidence preservation and cost

Four records have new derivation keys; the other 99 retain their original
identities. Old paid responses remain in the ledger but are not reused for new
pixels. Active proposals currently comprise 99 valid paid baselines plus the
source-bound agent proposals; 39 effective storefront suggestions are visible,
versus the original 41 baseline suggestions. This is not an accuracy score or
an attempt to inflate storefront density with institutional windows.

Recoverable pre-promotion evidence is in:

- `.cache/da-costa-neighbourhood/before-visibility-FSrNtU/` — before three visibility repairs.
- `.cache/da-costa-neighbourhood/before-visibility-KC6lVn/` — before the annex repair.
- `.cache/da-costa-neighbourhood/before-visibility-6taXg5/` — before the improved brick-annex view.
- `.cache/da-costa-neighbourhood/before-aerial-jiAd56/` — before five expanded aerial records; original image files remain in place.

The promotion tool validates the audited manifest-file hash and every staged
image, preserves unaffected records, requires the local review server stopped,
backs up old evidence, and rolls back on write failure. Publishing is atomic.

Additional paid inference: **$0**. The shared paid ledger remains
**$1.237401792** of the authorised $5, 388 calls, no pending/unknown charges.
Human review history remains untouched. Free public panorama/orthophoto reads
are separate from model inference.

## Checks and bounded experiments

Passing checks cover self-occlusion (concavity, holes, tangency, endpoints and
the actual Amsta failure), local-height support/fallbacks, source-bound field
merging, human override semantics, OCR withholding, backed-up promotion,
review persistence/keyboard/mobile behavior and the live inspector. Eight tree
A/B captures preserve exact draw calls and triangle counts, with Sterk visible.
TypeScript checking and whitespace checks pass.

The final eight-view renderer matrix passes on desktop/mobile across original,
neighbourhood and Eland scenes, including landmark preservation and per-wall
assignment. Placement-map tests verify actual footprint/camera coordinates,
fit after wall selection, no overflow and zero real review writes. A read-only
source audit verifies 733 image files (564 crops and 169 unique original
panoramas) across all 103 frontages and 76 aerial building records.

The optional `?neighbourhood=1&machineSigns=1` preview adds two neutral,
source-bound sign bands: IJscuypje and Michel de Letter. Authored ScooterCentre
and Sterk landmarks are excluded. The default remains off; a visible label says
these are unreviewed agent-extracted signs. Desktop/mobile comparisons pass;
the visible IJscuypje band costs one draw call and two triangles. This tests
recognition without inventing more shopfronts or changing paint/awnings.

The cache-only wide-frontage experiment made 30 projections for ten bays. Eight
original-camera bay midpoints failed the angle limit despite passing at the
whole-wall midpoint. Better cached cameras clarify two residential-looking Da
Costa sections, but five remain blocked/blurry; Amsta separates terrace,
entrance and glazing without establishing mixed retail tenancy. No bay labels
were applied to whole walls. See `.cache/da-costa-ground-bays/REPORT.md`.

Mesh/image fusion adds useful evidence under shadows, but also supplies
counterexamples: four visually supported hybrid roofs have entirely flat
simplified meshes, while other meshes retain pitches that the 80%-flat shortcut
discards. The six-case fusion report proposes component-level facts and shadow
checks; it does not overwrite the active image-only labels or roof geometry.

After freezing the original 16 street reviews, the 12 eligible shopfront and
12 eligible awning answers each matched the cheap baseline. Sign text differed
in 2/12 eligible cases and decorative tops in 2/10. This is agreement, not
accuracy; the main gains were source repair, abstention, better text/top detail
and roof/context interpretation—not evidence that every cheap shop answer
needs a costly replacement. Comparison: `self-review-2026-09-09/comparison.json`.

Frozen review producers now pin the exact reviewed input packets. Fifteen
mutation regressions reject changed record order, derivations, crops and
original panorama hashes. Rerunning preparation cannot silently reattach old
opinions to new evidence. Neither a blanket height switch nor a roof mesh
replacement is justified by these experiments alone.

Reports: [street self-review](./SELF_REVIEW_2026-09-09.md),
[roof self-review](./SELF_REVIEW_ROOFS_2026-09-09.md),
[tree typology](./TREE_TYPOLOGY_EXPERIMENT.md),
[expanded aerial](./AERIAL_COVERAGE_EXPERIMENT_2026-09-09.md),
[mesh/image fusion](./ROOF_MESH_FUSION_EXPERIMENT_2026-09-09.md),
[optional sign preview](./MACHINE_SIGN_PREVIEW_EXPERIMENT.md).
