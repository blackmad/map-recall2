# Roof mesh + image experiment — 9 September 2026

The mesh can supply useful evidence beneath aerial shadows, but its whole-building `flat` label is too coarse to be an oracle. In several cases the mesh **contains** a street-facing pitch that the area threshold discards; in others it does not contain the visibly pitched detail at all. No image-only findings, active classifications, meshes or human reviews were changed. Cost: $0.

The experiment computed independent area-weighted face normals, slope bins, height bands and sampled footprint coverage for all 12 frozen visual packets, then compared the two expanded-aerial follow-ups. Six north-up diagrams were directly inspected alongside aerial evidence; the four smaller unresolved street/upper-roof packets were reopened too. Prior visual judgments were frozen, but they are agent proposals, not benchmark truth.

## Six cases

“Flat %” is the existing heuristic's surface-area fraction under 12°. “Coverage” is roof projection over sampled footprint points, **not** confidence or watertightness.

| Building / frozen visual judgment | Mesh evidence | What fusion adds—and does not |
| --- | --- | --- |
| Amsta, Hugo de Grootkade 20 / unknown | 100.0% flat after rounding; 97.4% sampled coverage. Face 108 covers the short wing **and shadowed connector**: 558.9 m², slope 0.31°, height 13.76–13.93 m. Long-wing planes sit around 23.4 and 27.6 m. | The lower continuous plane plausibly explains the dark connector as cast shadow rather than a ridge. A **mesh-assisted flat-family candidate** is reasonable, with multiple height levels explicitly retained. The 2.6% projection gap and simplified roof details remain unresolved; this is not a new image-only label. |
| Nassaukade 142 / unknown | One 81.0 m² plane, 1.84° slope, height 14.28–14.72 m; 100% sampled coverage. | A flat main-deck hypothesis is consistent with the visible parapet and aerial surface. But a single plane cannot adjudicate the very front/edge detail under shadow: identical all-flat simplification occurs where front pitch is visible in control cases. Prefer a tentative main-deck observation, not an automatic whole-roof label. |
| Da Costakade 25 / unknown; stepped facade | 81.8% flat; 99.9% coverage. A second 16.8 m² face has 21.5° slope at 12.43–13.48 m, versus main deck 16.32–16.61 m. | This is not an all-flat mesh despite the heuristic label. The lower end strip is not a continuous pitched apron attached at the main-deck height, so its location and wall association need checking before calling it front pitch. The stepped brick facade remains a separate decorative fact. |
| Da Costakade 4 / unknown | 71.0% flat; 100% coverage. Face 23: 30.8 m² at 60.2°, height 13.63–18.27 m; broad main deck is ~16.1 m. A small flat tower top is ~17.8 m, with a low ~3.8 m extension elsewhere. | Geometry positively supports a steep street-edge component plus a broad flat core and raised tower. This is the strongest unresolved small-building **hybrid candidate**. Do not erase the asymmetric tower into one neat apron, and do not derive a decorative-top class from its roof normals. |
| De Clercqstraat 8/10 / unknown; stepped facades | 89.9% flat; 100% coverage. Two front faces are 71.6–71.8° (24.8 m² combined); the shadowed rear L-extension is face 47, 59.8 m² at 0.48°, height ~3.4 m. Main deck ~16.4–16.9 m. | The mesh supplies a plausible low flat rear extension under the shadow and corroborates the street-visible front pitch. A **flat-core/front-pitch + low rear annex candidate** is stronger than either the image-only abstention or the heuristic's plain flat label. Exact front angles may reflect simplified fitting; retain the independent stepped-facade observation. |
| Da Costakade 14–26 / expanded aerial complex | Heuristic says flat at 89.3%, but the slope diagram clearly contains alternating pitched strips in the central cross-wings. Seven 2 m height bands span 4.29–25.60 m. Sampled coverage 78.8%. | Geometry actually corroborates the image's mixed roof volumes; its scalar classifier loses them. Much of the projection gap aligns with the central open/gridded court area: it is **not demonstrated missing roof mesh**. The low coverage triggers inspection of footprint/courtyard semantics, not an assertion that 21.2% of the roof is absent. |

## Counterexamples to “trust the flat mesh”

Four of the six frozen image-supported hybrid buildings have **100% flat mesh** and ≥99.8% sampled footprint coverage: Da Costakade 28, Michel's De Clercqstraat 15 corner, and both Sterk entrance buildings (7 and 9). Their street-visible short front pitches do not survive in the mesh. The other two hybrid packets are labelled `complex` by the current heuristic. This disagreement is evidence of a representation/taxonomy mismatch, not a measured 0% model accuracy.

Conversely, Da Costakade 25, De Clercqstraat 8/10 and the large Da Costa complex retain non-flat faces but pass the `flatFraction > 0.8` shortcut. Lowering that threshold alone cannot fix both failure types. The previously observed clock/decorative-gable height failure is another reason not to use mesh maximum height as a guaranteed crop ceiling.

## A conservative fusion rule to test

1. Keep separate facts: `mainDeckFlat`, `visibleFrontPitch`, `decorativeFacadeTop`, roof component heights, and evidence coverage. “Flat core” and “front pitch” are compatible observations, not votes to average.
2. Let a mesh face suggest the structure of a shadowed region only when that **specific projected face** spans it and its exposed continuation agrees with imagery. Keep the result source-labelled `mesh-assisted`; Amsta's face 108 and De Clercq's rear face 47 are useful trial cases.
3. Give directly visible positive pitch/detail precedence over its absence in a simplified mesh. Do not let `flatFraction > 0.8`, 100% projection coverage, or no ridge in LoD2.2 suppress a visible apron. Preserve small street-edge faces even when their building-wide area fraction is small.
4. Distinguish a pitched apron adjoining the main deck from a much lower annex. Use per-component adjacency, front-wall proximity, and eave/ridge height compatibility before mapping geometry's `flat-with-pitched-section` to appearance's `flat-with-front-pitch`.
5. Use coverage diagnostics to route uncertainty, not certify correctness. A courtyard can legitimately have no roof projection; a complete projection can be a single over-simplified plane. Unknown material and facade-top fields stay unknown when no direct source resolves them.

This suggests an **evidence-fusion experiment**, not training on mesh labels as truth. Tomorrow's labels would be most useful for the image/mesh disagreements and the two shadow-region candidates; a few ordinary flat and full-gable controls should be added before tuning thresholds.

## Reproduce and inspect

`node scripts/da-costa-block/compare-roof-mesh-evidence.mjs`

Outputs: `.cache/da-costa-neighbourhood/roof-mesh-experiment-2026-09-09/comparison.json` plus `011`, `012`, `028`, `045`, `073`, `090` `-mesh-comparison.svg/.png` diagrams. JSON binds the block, individual building surfaces, footprint, frozen finding files and source image hashes; it retains every source face index and normal. It does not emit active extraction proposals.

Areas use Newell polygon normals with interior rings subtracted; slopes are 3D-area weighted. Height bins use each face's mean vertex height, so they are a coarse diagnostic rather than a volume integral. Roof projection is sampled on a 0.25 m grid with footprint holes respected. The mesh's local Y coordinate is reported directly; no new vertical-datum calibration, survey verification, normal-based material inference, or aerial painting is claimed.
