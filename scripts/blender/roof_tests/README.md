# Roof geometry review

Run the pure geometry checks from the repository root:

```sh
python3 scripts/blender/roof_tests/check_roofs.py
```

The report is `artifacts/building-library/roof-tests/geometry-report.json`.
It covers the eight migrated recipes, fifteen independent synthetic fixtures,
and known construction heights for the gambrel and hip families.
Checks measure projected coverage, overlaps, internal boundary cracks, T junctions,
triangle normals and degeneracy, facade ownership, silhouette containment, and
chimney attachment queries. Invalid courtyard/family/join inputs fail explicitly.
A roof covering is an open surface; the test does not require a closed manifold.

Two Blender reviews write only into the dedicated roof-test artifact directory:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/blender/roof_tests/review_roofs_blender.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/blender/roof_tests/render_fixtures_blender.py
```

The first command loads the archived foundation `.blend` scenes, compares their
roof polygon planarity with the replacement, renders matched front/roof/rear
views, and saves separate review scenes. It preserves all archived scenes and
public exports. The second command renders synthetic concave, stepped,
reentrant, reversed-winding, and extended-footprint fixtures in contrasting
materials. Image review remains necessary: numerical continuity does not prove
resemblance to the photographs.

The compiler keeps footprint and wall/eaves datums intact. Each covering facet
is a plane, with a front ramp capped by the main pitch. This replaces a bilinear
front transition and exporter-dependent nonplanar n-gon tessellation. Boundary
infill consumes the exact covering edges. The street closure belongs to the
facade; the shed's end closure is behind the facade. Lower knots at a vertical
step provide a continuous roof underneath that silhouette. Roof extensions past
the frontage remain at the main roof's edge height, an inferred simplification.

Pitched and gambrel roofs accept an explicit `pitchSpan: [leftX, rightX]` and optional
`ridgeX`. These belong to the roof structure and are never automatically derived
from the street gable. The narrow-span and asymmetric-ridge fixtures demonstrate
them. `pitch-span-proposals.json` lists geometric screen constraints for the
current shaped gables; these are review candidates, not measured roof evidence.
A straight cornice alone cannot determine the form or orientation of its hidden
roof. A generic pitch can remain visible beside a narrow gable even when every
surface join is correct; that needs a recipe/evidence decision.

Supported families are pitched, flat, shed, gabled gambrel, and rectangular hip.
A gambrel requires `kneeSpan: [leftKneeX, rightKneeX]` and `kneeHeight` in metres.
The knees must sit between eaves and ridge, with steeper lower slopes than upper
slopes. It retains the pitched family's planar front cap and supports concave
shells. The warehouse fixture is a roof geometry demonstration, not a complete
warehouse archetype or a measured Amsterdam roof.

A hip requires the actual owner footprint to be rectangular and aligned to the
facade frame's x/y axes, plus `hipEndRun` in metres.
That run is the distance from each end eaves to the full-height ridge; it cannot
exceed half the roof depth after the facade setback. The roof uses four planes
with shared diagonals. Optional `ridgeX` shifts the ridge, while `pitchSpan`, if
provided, must match the owner's actual x bounds. Redundant collinear footprint
points and either winding are supported. Concave hips fail with an explicit
volume-splitting message; no bounding rectangle is substituted for their shell.
Use the returned surface's `height(x, y)` for attachments, since a hip depends
on both horizontal axes. Its dimensions and explicit run establish geometry,
not confidence in hidden roof form.

Courtyards, multiple volumes, concave hips, mansards, covering thickness,
gutters, and parapet assemblies remain separate work.
`frontTransition` and `gableClearance` tune the inferred join;
they do not establish confidence in an unseen roof. The original recipe roof
status is retained on the covering object. Roof shape still requires dated,
registered evidence independently of the 3DBAG metric envelope.

`chimney-attachment-audit.json` measures a separate assembly defect: placing a
horizontal chimney base at its center roof height leaves the lower edge floating.
Use the minimum of corner roof heights for its buried bottom and the maximum
for an above-roof coping datum. The archetype owner applies that change.
