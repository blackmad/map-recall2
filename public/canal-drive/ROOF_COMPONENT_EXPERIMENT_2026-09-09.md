# Frontage-linked roof components — 9 September 2026

The component diagnostic improves review evidence without producing a new roof class. It preserves every nondegenerate source roof face, separates projected contact from height-compatible edge attachment, and distinguishes a lower rear slope from a main-level street pitch. No paid calls, downloads, image labels, human reviews or mesh changes were made by this experiment.

## API and provenance

`roofFrontageComponents(building, {localStart:[x,z], localEnd:[x,z]}, options?)` is exported by `scripts/da-costa-block/roof-components.mjs`. It is pure and took about **15 ms for all 103 frontages / 76 buildings** in this workspace; no raster sampling or image calls occur.

Outputs retain source `surfaceIndex`, area, slope, local-Y height range, frontage overlap/contact/proximity, and projected versus height-compatible boundary contacts. `flatDeckCandidates` retains separate connected flat components. `mainDeckCandidate` means the largest projected-area connected flat component, **not an authoritative main roof**. `authoritativeRoofClass` is always null and `absenceIsEvidenceOfAbsence` is always false.

The source-hashed outputs are `.cache/da-costa-roof-components/diagnostics.json` (103 frontages) and `real-cases.json` (12 existing visual packets). Hashes bind the module, block, per-building surfaces, ordered frontage endpoints, manifest and comparison inputs; the visual comparison's referenced image hashes are checked. Existing image proposals are context, not consumed as classification inputs or treated as truth.

## Evidence-backed cases

| Selected frontage | Component result | Interpretation and restraint |
| --- | --- | --- |
| Da Costakade 25, `0363100012157075_e_0udbbkk` | Face 8: 16.84 m², 21.5°, height 12.43–13.48 m; 12.56 m from selected wall. Main flat face 9 begins at 16.32 m. Shared projected boundary differs by up to 3.13 m vertically. | Lower rear/end component, not selected street front pitch. The street image's stepped brick top remains a separate facade fact. |
| Da Costakade 4, `0363100012236521_e_030nf28` | Face 23: 30.82 m², 60.2°, 5.91 m projected street-edge contact, height 13.63–18.27 m. Flat face 24: 16.07–16.16 m. Their coincident plan edges differ by about 1.6–2.1 m in height. | Positive street-edge pitch candidate plus flat core and separate raised tower/low extension. Do not claim direct 3D deck attachment merely because polygons touch on the aerial diagram. The street crop mainly shows the tower/brick parapet, not the hidden deck connection. |
| De Clercqstraat 8/10, `0363100012236681_e_0f0740u` | Faces 41/43: 18.53/6.26 m², ~71.7°, street-edge contact and approximately height-compatible attachment to flat face 46. Low rear face 47 stays separate at 3.37–3.47 m. | Strong component-level corroboration of the visible pitch behind the stepped facades. Face 43 attachment survives 0.2/0.4/0.6 m height tolerances; face 41 only survives ≥0.4 m and relies on a 0.459 m short contact. Attachment is approximate, not surveyed. |
| Amsta, `0363100012237064_e_0aws3g3` | Largest flat component is **low wing 108**, 13.76–13.93 m, while other broad decks reach 23–28 m. Faces 102/104 are only 0.309/0.544 m² with tiny projected areas. | Preserve these slivers, but do not convert them into a meaningful pitched-roof claim. Face 108 still provides useful spatial evidence for the shadowed low connector; the largest-component rule is not a semantic main-roof detector. |
| Da Costakade 14–26, `0363100012077314_e_14o9326` | All eight pitched faces retained, including central cross-wing strips. None meets the selected long street wall; central slopes are roughly 26–31 m behind it. | Whole-building mixed geometry is real mesh evidence, but does not justify painting those interior slopes onto the selected frontage. Courtyard/coverage caveats from the preceding experiment remain. |
| Da Costakade 28, Michel's corner, Sterk 7 and 9 | No mesh pitch observed; the reopened street images show pitched surface/dormer detail. | Explicit representation-gap controls: never suppress visible image pitch because all source mesh faces are flat-family. |

Direct inspection reopened five existing aerial/mesh diagrams and seven street-roof crops. The report is a geometry-assisted critique of those sources, not a blind image benchmark.

## Review routing, not truth thresholds

Raw `frontageLinkedPitchFaceIndices` includes tiny faces and nearby-only associations, so it is too permissive to trigger a flat-roof question. Two additional facts preserve the raw evidence while controlling question noise:

- `substantiveFrontagePitchFaceIndices`: actual projected edge contact ≥0.5 m, face area ≥1 m², projected area ≥0.25 m², and vertical rise ≥0.5 m.
- `substantiveMainDeckHeightFrontagePitchFaceIndices`: the above plus a height range compatible with the provisional reference deck. This is the preferable flat-main-deck review question trigger, not an automatic contradiction or label replacement.

All routing thresholds are exposed in `thresholds`; none removes a face. Geometry contact uses 0.4 m horizontal/vertical tolerance and ≥0.25 m edge overlap. Physical adjacency respects hole boundaries; areas subtract holes; frontage association excludes internal hole boundaries. Approximate mesh fitting, rooftop steps and reference-deck choice can change attachment flags.

The all-frontage run found pitch somewhere in 74 records, projected frontage-linked pitch in 46, and approximate reference-deck-adjoining front pitch in 24. These are **diagnostic counts, not accuracy or positive roof labels**. They intentionally repeat buildings with multiple frontages.

## Reproduce

`node scripts/check-roof-components.mjs`

`node scripts/da-costa-block/diagnose-roof-components.mjs`

Synthetic checks cover tiny-face retention, non-evidence of absence, lower/upper height separation, projected-nearby versus edge contact, corner-only exclusion, connected decks, hole area/adjacency and question-routing scale. The diagnostic script additionally asserts the named real-case source-face relationships and image hashes. Keep this layer in review disclosure; future validation should include ordinary full-gable controls and explicit image-confirmed boundaries before any roof-class automation.
