# Building IR and Sol evidence handoff

The executable IR is the existing Blender recipe (`schemaVersion: 1`), now accepted
from any file using `--ir` or a batch `--manifest`. Do not emit Python code or a
second incompatible building schema. Use the checked-in recipes as complete
examples; optional components extend them.

## Inputs and axes

Use metres. X runs along the primary frontage, Y into the building, Z up. Each
frontage has an origin and rotation, applied once to all of its components.
Opening x/z specify the centre, width/height its bounds. Storeys have explicit
bottom/top datums. Roof eaves and top are independent from the front gable profile.
Materials refer to catalog IDs, with explicit optional colour overrides.

## Quick photo authoring

Use a library form and a compact row layout for the first likeness pass. Correct
the obvious form, storey count, bay count, colour and entrance/display pattern;
do not require bespoke ornament on ordinary buildings. Preset proportions stay
inferred even when the form and counts are photo-observed. Source footprint,
identity and street planes remain independently bound.

`frontages[].profileLayout` accepts `family`, `eaves`, `top` and optional
`raised`/`provenance`, expanding into the explicit facade profile. Families are
straight, triangular, stepped, spout, neck, bell and gambrel. The native roof
behind a source-derived facade is separate from the decorative front form.

Opening rows may use `storeys: ["upper_1", "upper_2"]`,
`centresFraction: [0.25, 0.75]`, `widthFraction`, `heightFraction` and
`sillFraction`. The corresponding metre fields remain supported; specify one
form per dimension. IDs stay unique across repeated storeys. `template` carries
head shape, sash divisions and colours. Resolved output remains the existing IR.

`frontages[].openingPatterns` selects a reusable ground layout: `shop`,
`left-entry`, `right-entry`, `center-entry` or `two-entries`. Each item accepts
`preset`, `id`, `storey`, `template` and `provenance`. Patterns emit actual
openings into the same facade cutter/joinery builders; unusual fronts can keep
explicit `openings`. `facade_patterns.py` owns the shared library, with no owner
ID switches. Extra work should extend these shared components before adding
another one-off building script.

Batch commands from the isolated checkout:

```sh
PYTHONPATH=scripts/blender python3 scripts/blender/expansion/batch_pipeline.py prepare --limit 100 --output artifacts/my-batch --exclude-batch artifacts/building-batch-pilot
PYTHONPATH=scripts/blender python3 scripts/blender/expansion/batch_pipeline.py build --output artifacts/my-batch --include-starters
PYTHONPATH=scripts/blender python3 scripts/blender/expansion/batch_pipeline.py preview --output artifacts/my-batch
PYTHONPATH=scripts/blender python3 scripts/blender/expansion/batch_pipeline.py apply --output artifacts/my-batch --edits path/to/photo-edits.json
```

Edits contain `{"edits": [{"id": "bag-OWNER", "notes": "Quick photo reading",
"recipe": {"materials": {}, "frontages": []}}]}` with only editable existing
IR fields. Applying an edit validates first and preserves the initial recipe.
The progress gallery has quick choices for rows, bays, window heads, front form,
ground pattern and colours. It queues only changed choices and downloads one
`quick-photo-edits.json`. Apply and rebuild with a single `batch_pipeline.py run`
command; the published preview changes only after the actual build. Attention
can remain automatic or be explicitly ordinary/extra. This is a static/offline
editor, not a claim that a browser can write directly to repository files.

Agents can use the same editor choices without generating long IR patches:
`building-batch-quick-edit.ts --root artifacts/my-batch --choices photo-choices.json
--output artifacts/my-batch/photo-edits.json`. Input is `{"choices": [{"id":
"bag-OWNER", "values": {"rows": 2, "bays": 3, "groundPattern": "shop"},
"notes": "Quick photo reading"}]}`. It uses the same pure edit compiler as the
browser and preserves source fields.

Changed recipes rebuild; unchanged successes resume. Failure reports stay
per-owner and stale output is excluded from the gallery. POI footprint matches
are suggestions for extra storefront/entrance detail, not business identity or
permission to guess signs. Quick photo drafts and unreviewed starters have
distinct visible statuses; neither is silently added to the reviewed library.

A real building retains buildingId (BAG owner), geometryRevision, exact footprint,
sourceBundle, sourceShell and placement from its seed. A source bundle must match
both owner and revision. Every real IR also requires ordered endpoint pairs in
the bundle's `physicalFacade.frontage` and recipe's `placement.frontageLocal`.
Each pair must contain finite numeric coordinates and have nonzero length.
Corresponding endpoints must match within 0.04 m; reversed endpoints and missing
bindings are rejected, including when both fields are absent.
Do not mark an uncertain real building synthetic to
bypass these checks. Synthetic fixtures must explicitly state their purpose.

Openings can override `glassColour` while retaining the simple matte glass style.
A rectangular shop opening can use `transomArch: {"rise": 0.2}` for a curved
internal sash beneath its upper grille; `transom` supplies the spring datum and
the rise must fit inside that upper pane. `lowerPanel: {"height": 0.28,
"colour": "#263d56"}` adds an opaque display base inside the opening. Optional `divisions` are ordered
fractional leaf boundaries; `louvreCount` (0–32) adds horizontal slats per leaf.
Doors accept `handleFractions` (positions inside 0–1) and `handleColour`.
A custom lower panel replaces the default door kick panel.
Set `storefront.cornice: false` to omit the otherwise default horizontal shop
course on ordinary residential facades without an evidenced course.
Storefront signs support `substrate: false` for lettering without a fascia,
optional `letteringColour`, and `letteringDepth` in the local facade Y frame.
For lettering on glazing, place it just streetward of that opening's
`glazingDepth`; lettering fits both the declared sign width and height.

Glazing recesses must be finite and fit inside the wall body (pane thickness
0.014 m). Dormers require positive finite dimensions, support across their whole
0.85 m footprint depth, and a head above the highest rear support. Ridge caps
require positive-rise pitched/gambrel/hip roofs and an uninterrupted nonzero
ridge span at the roof top. These checks run before the composer clears a scene.
`frontages[].bicycleSign: true` places the optional bicycle sign in that facade's
local frame; legacy `details.bicycleSign: true` selects the primary facade.

`massing: {"mode": "source-derived"}` uses measured semantic `sourceShell`
wall/roof surfaces instead of a uniform analytic shell. Preflight checks finite
coordinates, planar tessellation (including roof holes), manifold shared edges,
and simple ground boundary loops before closing the base. Roof triangles retain
measured heights; fragments owned by the closed authored facade slab are clipped
to avoid coplanar overlap. Original source-only audit geometry stays unchanged.
Optional frontage `profile` and `eaves` describe a facade independently of the
owner's other heights. Ordinary frontage ownership clips only its local wall
interval; composite/recessed frontages must declare `sourceWallSelection` with
`surfaceIndices`, local `depthRange`, matching `geometryRevision`, and nonempty
`provenance.basis`/`provenance.note`. This explicit selection never expands
ownership to unselected street walls or wings. Analytic roof attachments are
currently unsupported in this mode. Export metadata records `massingMode` and
`massingAudit`; final assembly watertightness is not asserted. Missing observed
street facades keep the owner reconstruction held even when its massing is measured.

Real exports can include `placement.sourceRDFrame`: exact `anchorRD`, unit
`xAxisRD`/`yAxisRD` vectors, owner/revision and source provenance. Derive this only
from the frozen owner's `coordinateFrame.originRD` and ordered frontage after
checking normalized source vertices; the batch gate also requires the RD anchor
and tangent endpoint to match the bound `physicalFacade.plane` within 0.04 m,
independently of any padded original image plane. `derive-source-rd-frames.py` does that for
known source manifests. `xAxisBearingDegrees` remains the source grid bearing.
At the game boundary `rdProjectedSurvey` derives the precise geographic anchor
and optional surveyed `horizontalBasis` through the repository RD converter and
MapLibre MercatorCoordinate. This basis projects horizontal metre coordinates;
model scale stays 1, vertical metres/ground altitude are independent. Existing
surveyed landmarks without a basis keep their original transform. Cached WGS
anchors can have centimetre rounding, so the exact RD anchor takes precedence
when this metadata is present. The local affine projection is checked against
full source coordinates; it is not a footprint fitting operation.

## Sol task contract

Process at most ten owners per evidence task. For each owner provide the existing
seed recipe, measured geometry/height audit, supported component vocabulary,
dated rectified full facade, ground floor and roof views, and their source bundle.
Use multiple independent years when available. Count panorama/date pairs rather
than duplicate crops or resized versions. Native source resolution remains part
of the evidence; rectification does not create additional detail.

Return one recipe JSON per owner plus a short evidence decision record. Preserve
source and identity fields. Attach provenance to openings, roof decisions,
components and assumptions: observed/inferred/unknown basis, evidence references,
and the reason for any inferred metric value. Keep dimensions within measured
facade bounds. Unregistered pixel ratios are inferred dimensions, not survey data.

Select a coherent appearance date for signs and business use. Older images may
clarify permanent architecture. Omit unreadable text. Keep gable silhouette, roof
volume, window spacing, material zones and ornament independently configurable.
The user-provided architectural style sheets are variation references, not owner
identity or historical evidence. Render simple versions of observed architectural
details instead of copying uncertain illustrated ornament.

If a clearly evidenced feature cannot be represented, pause that building and
request a reusable component addition with the evidence attached. Resume after a
generic fixture and the originating building both render correctly. A restrained
inference for hidden architecture is different from substituting an incorrect
stock component for a visible loading door, shutter, bay or roof.

Do not use whole-owner roof maxima as street eaves. Keep selected front wall
height distinct from higher rear volumes and roof percentiles. If owner identity
is ambiguous, return a retained-shell decision rather than inventing a facade.
If an unsupported topology cannot be represented, return an explicit unsupported
decision; do not silently replace a courtyard or concave footprint with a box.

## Run contract

A manifest contains recipe paths relative to itself:

```json
{"schemaVersion": 1, "recipes": ["recipes/owner-a.json", "recipes/owner-b.json"]}
```

Validate before Blender:

```sh
python3 scripts/blender/build-buildings.py --manifest path/to/batch.json --validate-only
```

Build, render, or resume:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/blender/build-buildings.py -- --manifest path/to/batch.json --render --resume
```

`--ir FILE` is repeatable. `--building ID` filters explicit inputs. `--evidence-root`
selects the evidence directory; bundle paths cannot escape it. `--output-root`
and `--artifact-root` isolate runs. Only one process may write a given output and
artifact pair. Parallel evidence work is safe; concurrent Blender runs require
separate destinations.

Each build stages its scene, GLB and optional renders before replacing existing
outputs. Per-building failures do not stop unrelated recipes. `batch-state.json`
records successful fingerprints, file hashes and results; `batch-report.json`
reports this invocation. Resume checks recipe, evidence bundle, library code,
material catalog, render mode, actual GLB, scene, recipe-download and requested render hashes.
Input failures produce a nonzero CLI exit status. The Blender launcher may need
its `--python-exit-code` option when CI requires Python failures as process status.

A `built` batch status means compilation succeeded. It does not upgrade the public
manifest's visual/evidence acceptance status. Reports distinguish synthetic
fixtures from real candidates. Previous GLBs are preserved on validation or
geometry/render failure; they must not be mistaken for a newly successful build.

## Required visual review

Inspect front, oblique, roof and ground views, including roof/gable joins,
thresholds, recesses, sign alignment, floor spacing, ordinary-building proportions,
and material contrast. Check actual game placement separately. Automated mesh
validation is necessary but cannot certify photographic resemblance.

## Compact generators

`building_lib.ir.resolve()` expands compact authoring into explicit geometry inputs
without importing Blender or changing the authored dictionary. The CLI calls it
before validation. Explicit storeys and silhouette points take precedence.

```json
{
  "storeyLayout": {"groundTop": 3.2, "upperCount": 2},
  "gable": {"family": "neck", "rise": 2.8, "raised": 0.4},
  "openingRows": [{
    "id": "upper-row", "storey": "upper_1", "centres": [1.2, 3.2, 5.2],
    "sill": 0.6, "width": 1.1, "height": 1.8,
    "template": {"head": "segmental", "mullions": [0.5], "transom": 0.3}
  }]
}
```

Place `openingRows` on a frontage; `storeyLayout` and `gable` belong on the building.
Rows use explicit centre positions in metres and sill heights above their storey
bottom. An explicit `upperHeights` array supports unequal floor spacing. Generated
openings receive stable IDs and retain row provenance. Generated gable ratios are
inferred presets until supplied with actual measured silhouette points. The
complete `fixtures/ir/ordinary-shop-terrace.json` demonstrates the executable form.
Exported `.recipe.json` files contain resolved IR and can be rebuilt directly.

Source-derived compilation canonically removes only exactly equal consecutive or closing ring vertices, without changing the immutable `sourceShell`, coordinates, ring area vectors, or audit tolerances. `audit.sourceNormalization` records geometry revision, input/output digests and every original surface/ring/vertex index removed. A resulting degenerate face remains rejected by default. The optional `massing.sourceNormalization` exclusion requires matching `geometryRevision`, explicit `surfaceIndices` and nonempty `provenance.basis`/`note`; each listed surface must have exactly one ring collapsing to at most two distinct vertices with zero area after exact deduplication. Original surfaces and zero-area proof remain in the audit; surface indices stay stable. All retained geometry still passes ordinary strict topology, hole and base checks. This cannot exclude a three-vertex collinear face or relax tolerances.

`massing.sourcePatches[]` permits explicit inferred appearance geometry only: each patch requires unique `id`, `mode: "inferred-appearance"`, matching `geometryRevision`, nonoverlapping original `surfaceIndices`, explicit semantic `replacementSurfaces` and `provenance` containing `basis`, `note` and nonempty `evidenceKeys`. Original source remains immutable. The compiler verifies equal exact directed interface boundaries, valid positive-area triangulation/holes, selected source bounding envelope, owner footprint and height/ground anchors, then reruns full strict shell topology. Replacement faces receive appended effective indices; original indices remain distinguishable and excluded. `massingAudit.sourcePatches` records originals, replacements, area totals, added coordinates, preserved boundary edges and input digest. This is photo-inferred geometry, not measured retention.

Roof attachment support defaults to retained original `sourceSurfaceIndices`; removed faces and replacement indices cannot silently serve as measured support. A patch attachment must instead specify `supportMode: "inferred-appearance-patch"`, `sourcePatchId`, `derivedSurfaceIndices`, and `provenance.status: "inferred"`. Those faces must belong to the named audited patch. Existing measured supports remain unchanged.

## Cornice brackets, recessed pilasters and curved dormers

Facade components accept `kind: "corbel"` with explicit `x` and optional
`z`, `width`, `height`, `projection`, material and colour. The closed faceted
concave bracket defaults to a top at the facade eaves and shares aperture
cutters with cornices. Its proportions are authoring presets.

A pilaster optionally declares `panels: [{bottom, top, margin, inset}]`.
Ordered disjoint panel bounds must lie inside the shaft; positive side margins
retain the frame and inset must remain smaller than shaft projection. Panels
are blind recesses with retained closed backs. Omitting panels keeps the existing
plain shaft unchanged.

`details.sourceDormers[]` optionally accepts `capRise` (default zero).
Positive rise creates a segmental curved cap, cheek profile, pale fascia and
matching true arched aperture. Rise is limited by half the width and half the
height; the outer spring, rather than just its peak, must clear the entire rear
roof support. Flat caps retain their original geometry. Support remains bound
to retained semantic roofs or explicitly inferred replacement provenance.

### Keyhole apertures, facade recesses and mailbox banks

`head: "keyhole"` is a circular bulb joined to a narrower vertical stem, with
`stemWidth` (15–75% of the bulb width) and an overall height taller than the
bulb. The shared outline cuts a true wall aperture, makes a continuous closed
mitered frame, and clips sash to the same silhouette. It carries no rectangular
sill or unsupported door hardware. It is an explicit form, not a building ID
exception.

`frontages[].recessedUpperPanels[]` with explicit `cutFacade: true` cuts the front slab at the panel bounds and
places a closed back wall at `setback`, with optional true back-wall apertures.
Closed side, floor and ceiling returns connect the void to the back. This
facade recess does not own or cut a native source roof. Existing panels above a stepped facade need no additional cut and retain the default `cutFacade: false`. Empty `openings` is
appropriate when the photographed dark back is obscured; do not invent joinery.
Provenance and inferred depth belong in a real recipe.

Facade component `mailboxes` has explicit x/z, width/height/projection and
integer rows/columns (1–8 each, at most 32 cells). It makes closed backing,
plates, slots and labels. Validation rejects facade bounds violations, tiny
cells and overlap with authored windows or doors. Its printed names are not
invented. A synthetic combined study and dedicated geometric test exercise
keyhole voids, genuine recess depth and the mailbox grid.

A frontage can compose stock forms without authored knots using
`profileLayout: {family: "compound", eaves: 8, top: 12, parts: [...]}`.
Each part specifies `fraction`, `family`, `eaves`, and `top`; fractions must
sum to one. Neighbouring parts can have different eaves, producing a vertical
junction for towers. Parts reuse the ordinary straight, triangular, neck,
bell and other profile generators. Top remains bounded by the declared profile
and source envelope. The quick editor offers paired triangular, paired neck,
and central tower presets; paired attic lights fit inside each local gable.
These forms are photo-inferred simplifications, not new source measurements.

The quick editor also exposes facade eaves height. Changing it redistributes
upper storeys and openings, moves components at the old cornice, updates the
selected profile and attic lights, and retains native source coordinates and
roof peak. This is an inferred facade choice. Low profile endpoints can be hip
shoulders rather than the photographed flat cornice; inspect the photo and
native front-wall top rather than flattening every form at its lowest knot.
The compiler rejects heights outside the native owner envelope.

Repeated balconies use `frontages[].componentPatterns` with
`preset: "balcony-stack"`, `id`, `storeys`, `centresFraction`,
`widthFraction`, and `bottomFraction` (default0.17 of each storey height).
A `template` supplies ordinary balcony fields such as depth, railing height,
spacing and colours. IR resolution produces ordinary explicit balcony
components; each keeps its inferred provenance. Fractional positions must fit
inside the frontage and storeys must be unique. Walking/slab-top datums follow
storey height rather than arbitrary absolute placements.

The portable builder and Blender share balcony_plan.py: a closed projecting
slab, front railing, side returns and balusters. Components can intentionally
stand in front of openings; cornice aperture-overlap rejection still applies.
Quick authoring offers centre, left, right and wide stacks, or removes its
generated stack with none. Changing row count, bays, height or window ratio
rebuilds that generated pattern. Manual components remain explicit and separate.

The portable builder supports flat-cap `details.sourceDormers` using the existing
source_attachments.dormer_plan contract. The declared roof surfaces must cover
the entire dormer footprint without overlapping projections. Source compilation
subtracts that footprint from the selected roof surfaces, while support checks
use the retained roof before attachment openings. Overlapping dormer ownership
footprints and duplicate IDs are rejected. The immutable sourceShell is retained.
The front cheeks have a real aperture with recessed joinery and a closed rear;
curved caps and other source roof attachments still require Blender.

For a photo-observed dormer on an ordinary primary front, create a compact edit:

```sh
PYTHONPATH=scripts/blender python3 scripts/blender/expansion/source-dormer-edit.py \
  --root artifacts/building-batch-scale-100 --id bag-OWNER \
  --x-fraction .5 --setback .5 --width 1.2 --height 1.4 --depth .65 \
  --wall-colour '#d7d5bd' --notes 'Photo-observed dormer; dimensions inferred.' \
  --output artifacts/building-batch-scale-100/dormer-edit.json
```

The tool selects intersecting native support surfaces, validates coverage and
cap height against the owner peak, and writes an existing-IR edit. It does not
infer dormer presence from geometry. Apply with the ordinary batch `run --edits`
command. Complex roof overlaps can specify `--surface-indices`; unsupported
placement fails. Dormer colours are shared by Blender and the portable builder.

`openingPatterns` also supports `preset: "attic-lights"` with `storey: "attic"`,
`layout: "single" | "wide" | "stacked"`, and `segments: 1 | 2` for a single
or paired gable. It expands into ordinary openings with editable templates and
inferred provenance. Lights use the lesser of the attic-storey ceiling and the
selected facade profile top; a taller rear owner roof does not stretch them.
Existing aperture containment and closed-facade checks validate the result.

The quick editor selects an attic-light layout and can remove it with the attic
checkbox. Changing a layout enables lights; explicit checkbox removal clears
the pattern and attic storey. Ground pattern edits preserve attic patterns.


Batch previews use `render-building-lod-projections.ts --incremental`: reuse requires matching renderer/detail/LOD asset fingerprints and all eight PNG/SVG output hashes per model/level. Changed assets, missing files and corrupt files rerender that model/level; detail bounds remain the reference for all LODs. `projections/render-report.json` records rendered/reused view counts. This is a CPU authoring aid; it does not grant GPU or likeness acceptance.


Quick photo authoring offers `windowDivision`: automatic, single, pair, triple, wide-centre, wide-left, wide-right. Shared `scripts/buildingWindowDivisions.ts` maps these to the existing opening-row template `mullions` fractions; no new geometry dialect. `automatic` removes the override, custom authored divisions remain untouched unless changed, and floor-count reflow preserves the selected divisions. Fractions and widths are inferred from a photo, not measured registration. Both Blender and portable recessed joinery consume the resulting ordinary openings.


Uneven repeated rows may set `widthFractions: [...]`, one positive facade-width fraction per centre, instead of uniform `width`/`widthFraction`. The fields are mutually exclusive. Each storey repeats the same inferred horizontal layout into ordinary recessed openings. Quick `bayLayout` choices even/wide-centre/wide-left/wide-right allocate twice the slot width to selected bays while preserving the width-within-bay ratio. Odd centre layouts widen one bay; even centre layouts widen the middle pair. Existing custom spacing stays custom and survives floor reflow; choose a library layout before changing its bay count or width ratio. Window divisions and aperture widths are separate editable choices.
