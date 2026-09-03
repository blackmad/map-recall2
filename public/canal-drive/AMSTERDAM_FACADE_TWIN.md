# Autonomous build prompt — photorealistic Amsterdam canal-house façade twin

Build a convincing, recognisable **3D reconstruction of the buildings of the
western canal ring (De Negen Straatjes / Grachtengordel-West)**, rendered inside
the existing Canal Recall runtime, and then a plan to extend that work to the
rest of Amsterdam.

This is not a toy scene and not a handful of representative canal houses. The
goal is a **city-scale building twin** where a rider on Prinsengracht can look
across the water at Herengracht, recognise individual houses by their gables,
and know which stretch of which canal they are on without a label.

---

## Part 0 — Scope contract

Read this before anything else. It is the part of this document most likely to
be violated by an enthusiastic agent.

### In scope

**Buildings, and only buildings.** Specifically:

- building massing: footprint, height, party walls, depth, rear annexes
  (*achterhuizen*), courtyard geometry;
- roof form: pitch, ridge direction, dormers (*dakkapellen*), roof tiles versus
  slate versus flat bitumen, chimneys;
- gable form and ornament: *trapgevel*, *halsgevel*, *klokgevel*, *tuitgevel*,
  *lijstgevel*, *puntgevel*, *verhoogde halsgevel*, claw-pieces
  (*klauwstukken*), scrolls, vases, pediments, festoons, cornices
  (*kroonlijsten*);
- façade articulation: window rhythm and diminishing storey heights, sills,
  lintels, *strekken*, sandstone dressings, *muurankers*, gable stones
  (*gevelstenen*), hoisting beams (*hijsbalken*) and their hooks;
- windows and doors as geometry, not texture: *schuiframen* with real glazing
  bars, *kruiskozijnen* on the oldest houses, shutters, fanlights, doorcases;
- the ground floor: *stoep*, *bordes*, *souterrain* light wells, basement
  entrances, and the *winkelpui* shopfront frame as **architecture**;
- façade lean (*op de vlucht*) and the settlement-induced tilt and sag that make
  a real Amsterdam terrace read as hand-built rather than extruded;
- materials: Dutch brick and its bonds, painted brick, sandstone, stucco,
  painted timber, leaded glass, zinc, pantile, slate.

**Immediately adjacent static structure**, only because buildings are
unreadable without it:

- canal water surface and water level;
- quay walls (*kademuren*), quay paving edge, mooring rings and bollards where
  they are part of the wall;
- bridge decks and arches;
- the street/quay ground plane.

### Out of scope — do not build these, do not spend a single agent on them

- **Foliage.** No elms, no street trees, no planters, no window boxes, no
  hanging plants, no grass, no seasonal vegetation. This is deliberate: canal
  elms occlude precisely the façades this project exists to reconstruct.
  Verification imagery must be chosen for winter/leaf-off views wherever the
  choice exists.
- **Trams, trains, metro.** No rails, no catenary, no stops, no vehicles.
- **People.** No pedestrians, no crowds, no NPCs, no navigation graph, no
  behaviour states, no animation systems for agents.
- **Cars, bicycles, boats.** No traffic system, no parked-vehicle instancing, no
  moored canal boats, no houseboats, no tour boats, no bike racks and no bikes
  chained to railings.
- **Business identity and retail census.** Do not build a storefront database,
  do not research which shop currently occupies a *pui*, do not model logos or
  fascia signage of current tenants. Reconstruct the shopfront *frame* and its
  glazing as architecture and leave the fascia visually neutral. Painted-on
  historical signage and carved *gevelstenen* are building fabric and stay in
  scope; a current lease is not.
- **Interiors.** No enterable buildings, no interior geometry, no interior
  lighting, no doors that open.
- **Street furniture beyond the quay wall.** No lamp posts, benches, bollards in
  the roadway, litter bins, traffic signals, parking meters, *Amsterdammertjes*.

If an agent proposes work in an out-of-scope category "because the scene looks
empty without it", terminate the agent. The scene is *supposed* to look like a
building study. Emptiness between buildings is the correct result.

### The one deliberate consequence of this scope

A leafless, vehicle-free, person-free canal ring will look uncanny in a wide
daylight shot, and every visual QA agent will want to report that. It is not a
defect. Visual QA must judge **façades against façade references**, framed
tightly enough that the missing city does not dominate the comparison.

### Runtime target

The shipped runtime is **Canal Recall itself**, at `public/canal-drive/`:
MapLibre GL for the basemap and camera, with building geometry drawn in a
Three.js `type: 'custom', renderingMode: '3d'` layer sharing the existing
Three.js runtime exposed as `window.CanalRecallThree`
(`js/three-runtime-source.js`, bundled to `js/three.bundle.js`).

Do not stand up a separate Three.js application. Do not add a second copy of
Three.js. Do not introduce a second camera model. The reconstruction either
renders in the game the user already drives, or it does not ship.

`js/detailed-buildings-source.js` already streams 3DBAG LoD2.2 through
`3d-tiles-renderer` from `data.3dbag.nl`. That layer is the baseline this work
replaces **within the pilot boundary only**, and must continue to serve every
building outside it. Follow `BUILDING_RENDERER_DESIGN.md`: one representation
per building at a time, resolved per `pand_id`, never three overlapping
geometries fighting for the same pixels.

Blender (via its Python API, headless) is permitted as an **offline** asset
generator. It must not appear at runtime. Its output is optimised, Draco- or
Meshopt-compressed GLB, loaded by the existing Three.js runtime.

---

## Part 1 — The pilot: De Negen Straatjes and Grachtengordel-West

### Boundary

Reconstruct every building whose footprint intersects:

```text
North   Brouwersgracht
South   Leidsegracht
East    Singel (both banks)
West    Prinsengracht (both banks) + the first Jordaan house row behind it
```

That is roughly 1.1 km × 0.7 km and contains the full width of the canal ring at
its most characteristic: Singel, Herengracht, Keizersgracht, Prinsengracht, and
the nine cross-streets that name the district — Reestraat, Hartenstraat,
Gasthuismolensteeg, Berenstraat, Wolvenstraat, Oude Spiegelstraat, Runstraat,
Huidenstraat, Wijde Heisteeg.

Determine the exact building count from the BAG extract during reconnaissance
and record it. Do not guess it, and do not assume this document's estimate.

**Stretch sector, only after the core boundary passes QA:** extend Herengracht
south-east from Leidsegracht to Vijzelstraat to capture the *Gouden Bocht*. It
is the single most photographed stretch of Amsterdam façade and the strongest
external validation of the façade grammar, but it is wider, richer and later
than the pilot core and must not compete with it for attention.

### Hero buildings

These get the highest fidelity and at least two independent visual review cycles
each. Verify every address in reconnaissance before building — treat this list
as candidates to confirm, not as established fact:

- Westerkerk and its tower, Prinsengracht/Westermarkt — the district's only
  true landmark silhouette and the primary orientation cue;
- Anne Frank Huis and the Prinsengracht 263 group;
- Huis met de Hoofden, Keizersgracht 123;
- Huis Bartolotti, Herengracht 170–172;
- Felix Meritis, Keizersgracht 324;
- the Cromhouthuizen / Bijbels Museum group on Herengracht;
- Het Grachtenhuis, Herengracht 386;
- De Rode Hoed, Keizersgracht;
- Torensluis and the Singel bridgehead buildings.

Everything else is reconstructed by grammar, not by hand. That is the point of
the pilot: the hero buildings prove the ceiling, the ordinary terraces prove the
method scales.

### Ground truth is measured, not guessed

This is the largest single departure from a generic city-reconstruction brief.
Amsterdam does not require you to infer footprints from photographs. The
Netherlands publishes them.

Source hierarchy, strongest first:

1. **BAG** — authoritative building identity (`pand_id`), footprint geometry,
   `bouwjaar`, status. Every reconstructed building is keyed by `pand_id`. A
   building without one is a bug, not a building.
2. **3DBAG LoD2.2** — reconstructed wall and roof surfaces from BAG + AHN,
   with per-building reconstruction-quality metadata. This is the massing and
   roof-form foundation. Promote to detailed geometry only where quality
   metadata says the reconstruction is trustworthy.
3. **AHN** — height, ridge height, and the relative heights of adjoining houses,
   which is what makes a terrace's stepped roofline correct.
4. **PDOK `Actueel_orthoHR`** — 12.5 cm orthophoto, already cached by this
   repository's roof pipeline (`.cache/pdok-ortho`, see
   `ROOF_ENRICHMENT.md` and `BUILDING_ENRICHMENT.md`). Roof colour and material
   are *measured* here, not chosen.
5. **Rijksmonumenten register (RCE open data)** — the highest-value and most
   overlooked source for this project. Monument descriptions for canal houses
   frequently state the gable type, storey count, window arrangement, cornice
   type, sandstone ornament and construction date in plain text. A large
   fraction of the pilot boundary is protected. Parse these descriptions into
   structured façade attributes *before* any agent looks at a photograph.
6. **OSM** — semantics, `building:part` topology, names, addresses, existing
   colour/material tags. Per `LOD.md`, manual OSM structure is preserved at
   every level and never silently overwritten by an automated reconstruction.
7. **Street-level and archive photography** — Google Street View, the Amsterdam
   City Archives *Beeldbank*, and published photographs. These are **visual
   reference only**. Inspect them, infer geometry, reconstruct it yourself.
   Never extract, redistribute or ship third-party imagery or mesh as an asset.

Where sources disagree, record the disagreement. A building whose OSM
`building:levels` contradicts its AHN ridge height is telling you something —
usually about a *souterrain*, a raised *bel-étage*, or a rear annex.

### Coordinate system

Work in **RD New (EPSG:28992)** with **NAP** heights, because that is what BAG,
3DBAG, AHN and PDOK are natively in. Reproject once, at the edge of the
pipeline, into the WGS84 the MapLibre camera expects; do not reproject
per-building at runtime and do not accumulate float error by doing arithmetic in
degrees.

Pick a fixed local origin inside the pilot boundary, document it, and never
change it. Canal water level, quay height and NAP datum must all be explicit
constants with a source, not eyeballed offsets. Amsterdam is flat, but it is not
level: quay heights vary, and a canal that renders perfectly horizontal across a
kilometre is wrong.


### The façade grammar

Do not model 2,000 canal houses individually. Amsterdam's canal ring is the most
grammatical urban fabric in Europe: narrow plots, party walls, a shared
structural logic, and a small vocabulary of gable and window types that vary by
date. Derive the grammar, then instantiate it per building from measured
parameters.

A building is described by a parameter record, not by a mesh:

```ts
interface CanalHouse {
  pandId: string;            // BAG identity, canonical
  plotWidthM: number;        // measured from BAG footprint
  depthM: number;
  eavesHeightM: number;      // AHN-derived
  ridgeHeightM: number;
  storeys: number;
  hasSouterrain: boolean;
  hasBelEtage: boolean;
  gable: 'trap' | 'hals' | 'klok' | 'tuit' | 'lijst' | 'punt' | 'verhoogde-hals';
  gableOrnament: OrnamentSpec;   // klauwstukken, vases, pediment, festoons
  bays: number;                  // window bays across the façade
  windowType: 'kruiskozijn' | 'schuifraam-6' | 'schuifraam-8' | 'later';
  storeyHeights: number[];       // diminishing upward, measured not assumed
  hoistBeam: boolean;
  corniceType: CorniceSpec;
  brick: BrickSpec;              // bond, colour (measured), pointing
  dressings: 'sandstone' | 'painted' | 'none';
  leanDeg: number;               // op de vlucht
  puiType: PuiSpec;              // ground-floor shopfront frame, tenant-neutral
  confidence: Record<string, number>;
  sources: Record<string, string>;
}
```

Every field carries a provenance and a confidence. A field that was inferred by
a model rather than measured must say so, exactly as `BUILDING_ENRICHMENT.md`
requires of roof colour. The renderer may use a guess; the extract may never
silently launder one into a measurement.

Blender generates the parameterised parts offline:

```python
make_gable(kind="klok", width_m=5.4, ornament="klauwstukken+vaas", stone="sandstone")
make_window(kind="schuifraam-8", width_m=1.1, height_m=2.05, bars=True)
make_cornice(kind="kroonlijst", width_m=5.4, depth_m=0.45, brackets=7)
make_pui(width_m=5.4, height_m=3.2, bays=2, frame="painted-timber", fascia="neutral")
```

Parts are exported as compressed GLB, atlased, and assembled at runtime by
instancing against the per-building parameter record. Two houses with identical
parameters must still not render identically: apply deterministic per-`pand_id`
jitter to lean, sag, brick tone and pointing so a terrace reads as built rather
than stamped.

### Fidelity ladder

Extend the ladder in `LOD.md` rather than inventing a parallel one.

- **LoD1** — footprint extrusion, measured height, measured roof colour.
  Complete coverage, offline fallback, everything outside the pilot boundary.
- **LoD2.2** — 3DBAG reconstructed walls and roof planes. Correct silhouette,
  no openings. The current `detailed-buildings` baseline.
- **LoD3 (new, this project)** — grammar-instantiated façade: real window and
  door openings, gable form and ornament, cornice, *pui*, materials, lean.
  This is the pilot's deliverable tier.
- **Signature model** — authored GLB for the hero buildings, per the existing
  signature-model rules: attribution record, geographic transform, performance
  LODs, stable aliases, identical picking and highlight behaviour.

A building renders at exactly one tier at any moment. Tier selection is per
`pand_id` and per camera distance, and the transition must not pop the
silhouette.

### Parallel reconstruction swarm

Parallelism is mandatory. The lead agent is an orchestrator and integrator, not
the sole implementer. Give every subagent an explicit scope, the file paths it
may modify, its deliverable, its verification method and a token budget.
Terminate agents that wander out of lane, and terminate on sight any agent that
starts modelling a tree, a bicycle or a shopfront logo.

Reconnaissance wave — run all of these concurrently:

```text
RECON-1   BAG/3DBAG extract: pand inventory, footprints, bouwjaar, quality flags
RECON-2   AHN heights: eaves, ridge, per-terrace roofline profiles
RECON-3   Rijksmonumenten text mining → structured façade attributes
RECON-4   OSM semantics, building:part topology, existing colour/material tags
RECON-5   PDOK ortho roof colour + material for the whole boundary
RECON-6   Gable-type census, Herengracht both banks
RECON-7   Gable-type census, Keizersgracht both banks
RECON-8   Gable-type census, Prinsengracht both banks
RECON-9   Gable-type census, Singel + the nine cross-streets
RECON-10  Quay, water level, bridge and kademuur geometry
```

The census agents work canal-side by canal-side, house by house, from
leaf-off street-level reference. For each `pand_id` they record gable type,
bay count, storey count, window type, hoist beam, cornice, lean, and a
confidence with its source. They do **not** record what shop is downstairs.

Construction wave — again concurrent, one lane each:

```text
BUILD-1   Blender gable library (all seven types, parameterised)
BUILD-2   Blender window/door/shutter library
BUILD-3   Blender cornice, dressing and ornament library
BUILD-4   Blender pui (shopfront frame) library, tenant-neutral
BUILD-5   Material library: brick bonds, sandstone, stucco, paint, glass, pantile, slate
BUILD-6   Grammar instantiation engine (typed, in src/)
BUILD-7   MapLibre custom-layer integration + tier resolution per pand_id
BUILD-8   Quay walls, water surface, bridges
BUILD-9   Hero building: Westerkerk
BUILD-10  Hero buildings: remaining signature models
BUILD-11  Reference-camera QA harness
BUILD-12  Performance instrumentation
```

Do not wait for BUILD-1 to finish before starting BUILD-2.

Important components go Builder → independent reviewer → correction agent →
independent re-review. Agents do not grade only their own work. Westerkerk and
the gable library each require at least two independent visual review cycles.

### Materials

Do not use flat colours. Build a reusable Amsterdam material library with
honest roughness, metalness, normal variation and texture scale:

- red, brown, purple-brown and yellow Dutch brick, with correct bond and
  pointing, at real brick dimensions;
- painted brick, in the greys, creams, blacks and dark greens actually used;
- Bentheimer sandstone dressings and ornament;
- stucco and painted plaster;
- painted timber joinery, in the near-white and dark green of the canal ring;
- glass: modern float, older cylinder glass with visible distortion, leaded
  lights;
- Hollandse pantile, slate, zinc, lead flashing, bitumen;
- granite and brick quay wall, wet at the waterline;
- canal water — dark, low-clarity, correctly reflective, never a swimming pool.

Roof and wall colour come from the measured PDOK pipeline wherever a measurement
exists, and fall back to a constrained palette otherwise, with the fallback
recorded as a fallback.

### Time of day

Support `DAY`, `SUNSET`, `NIGHT`. Day is the reference-validation mode.

Night is where a leafless, empty city is least strange, and where façades read
most clearly: lit windows, illuminated bridges, and the canal reflections
Amsterdam is known for. Do not light building interiors — emissive windows and
faked interior depth only, per the no-interiors rule.


### Verification

The final artifact is visual. Source-code inspection proves nothing. A milestone
is never complete because the code compiles, the assets load and the console is
clean; those are minimum conditions.

Every milestone runs:

```text
IMPLEMENT → RUN THE REAL GAME → NAVIGATE → CAPTURE → COMPARE → MEASURE
→ LIST ERRORS → FIX → RUN AGAIN
```

Repeat until convergence.

#### Reference viewpoints

Establish at least **25 fixed reference viewpoints** with recorded position,
bearing and field of view. At minimum:

- each canal, both banks, looking along the water from three points;
- each of the nine cross-streets, looking through from Prinsengracht to Singel;
- Westermarkt facing Westerkerk;
- the Prinsengracht 263 group, frontal;
- Huis met de Hoofden, frontal;
- Huis Bartolotti, frontal;
- three bridge-deck views looking down a canal;
- two elevated views showing the roofline profile of a full terrace.

Prefer leaf-off reference imagery for every viewpoint. Record the imagery date.

#### Visual reference mode

Implement a developer-only overlay in the running game: reference photograph and
rendered frame at the same camera, blendable by an opacity slider. This mode is
critical. Most façade errors — a bay too many, a storey height wrong, a gable of
the right family but the wrong sub-type — are invisible in isolation and obvious
in overlay.

#### Structural comparison, not pixel matching

Lighting, imagery date and season differ. Compare structure:

- roofline profile across a terrace;
- gable silhouettes;
- window-bay spacing and storey-height ratios;
- party-wall positions against BAG footprints;
- cornice and *hijsbalk* heights;
- quay and waterline position.

Automated metrics complement human review; they do not replace it.

#### Named regression locations

Per this repository's working agreement, every reported geographic failure
becomes a **named regression location**. When a reviewer says "Keizersgracht 268
has the wrong gable", that address is pinned in the check suite before the fix
is considered done, and it stays pinned afterwards. Screenshots and house
numbers are evidence; convert them into tests.

Wire the new checks into `npm run check:canal` so façade regressions are caught
by the same pre-integration gate as driving and reachability.

#### Storybook

Use Storybook for deterministic façade states that are expensive to reach by
driving: each gable type, each window type, a terrace with mixed heights, a
building at each fidelity tier, the tier transition, a low-confidence fallback
building, and the reference-overlay mode. Add desktop and mobile states.

#### QA agents

Run independent reviewers in parallel. None of them may be the agent that built
the thing under review.

```text
QA-GEOM     footprints, heights, party walls, roof pitch, quay alignment
QA-ARCH     is this the right gable, the right period, the right proportion?
QA-LOCAL    would someone who lives here recognise this stretch of canal?
QA-TECH     materials, texture repetition, LOD popping, z-fighting, artifacts
QA-SCOPE    has anyone smuggled in a tree, a bike, a boat or a shop logo?
```

QA-GEOM and QA-ARCH produce error reports and do not modify the scene;
correction agents act on those reports; then an independent re-review runs.

QA-SCOPE is not a joke lane. Scope creep into foliage and vehicles is the most
likely way this project fails.

### Performance

Buildings-only is not a licence to be slow. A canal-ring view can put a thousand
façades on screen at once.

Target at 1920×1080 on a modern desktop GPU: **60 FPS preferred, 45 FPS minimum
sustained**, inside the real game, with the driving runtime also running.

Measure draw calls, triangles, visible meshes, texture memory, JS frame time and
GPU frame time. Techniques: `THREE.InstancedMesh` for repeated parts, shared
geometry and texture atlases, `THREE.LOD` per building, frustum culling that
understands the canal's long sightlines, and tile-based streaming keyed to the
RD grid.

Have a performance subagent independently hunt excessive materials, duplicated
geometry, overdraw, expensive transparency, and too many shadow casters. Fix
measured bottlenecks. Do not "optimise" by deleting fidelity.

Streaming sectors for the pilot:

```text
singel-west        herengracht-west     herengracht-east
keizersgracht-west keizersgracht-east   prinsengracht-west
prinsengracht-east negen-straatjes      brouwersgracht-south
leidsegracht-north jordaan-edge         westermarkt
```

### Milestones

```text
M0  RECONNAISSANCE       inventory, sources joined, grammar hypothesis, boundary fixed
M1  MASSING              BAG/3DBAG/AHN massing + roofs across the boundary, in-game
M2  QUAY AND WATER       canals, quay walls, bridges, correct water level
M3  GABLE LIBRARY        all seven types parameterised, reviewed twice
M4  GRAMMAR ENGINE       per-pand instantiation from measured parameters
M5  FAÇADE ROLLOUT       every building in the boundary at LoD3
M6  HERO BUILDINGS       Westerkerk and the signature set
M7  MATERIAL PASS        measured colour, brick, stone, glass, roofing
M8  LIGHTING             day / sunset / night, reflections
M9  INTEGRATION          tier resolution, picking, highlight, offline fallback
M10 OPTIMISATION         profile, instance, atlas, stream
M11 ADVERSARIAL QA       independent geometric, architectural, local and scope review
```

Do not proceed past M0 until the geographic inventory is coherent. Do not
proceed past M1 until the massing is recognisable in overlay against reference.

### Final QA bar

Score independently before declaring the pilot done:

```text
Footprint and massing accuracy      9/10
Roofline and gable accuracy         9/10
Façade proportion and rhythm        8.5/10
Hero building recognisability       9/10
Material fidelity                   8.5/10
Lighting                            8.5/10
Canal and quay accuracy             8.5/10
Integration with canal-drive        9/10
Performance                         8.5/10
Boundary completeness               9/10
Scope discipline                    10/10
```

No category may sit below 8, and scope discipline is pass/fail at 10. Do not
lower the bar to justify unfinished work.

### The walkthrough test

Drive and look, in the real game:

1. start on Brouwersgracht and travel south along Prinsengracht;
2. recognise Westerkerk before reaching it;
3. cross a bridge and see the quay wall and waterline behave correctly;
4. turn into a cross-street and see both sides of it fully built;
5. arrive on Herengracht and identify which bank you are on from the façades;
6. stop opposite Huis Bartolotti and recognise it;
7. look along the canal and see a roofline that steps like a real terrace;
8. rise to an elevated view and still know exactly where you are;
9. switch to night and find the façades still legible;
10. leave the pilot boundary and watch the tier fall back to 3DBAG without a
    visible seam, a popped silhouette or a duplicated building.

Any broken step is a QA failure.

### No empty back sides

A classic failure of generated cities is beautiful canal frontage and hollow
everything else. The canal ring's rear geometry is genuinely complex — deep
plots, *achterhuizen*, courtyards, party walls of unequal height. A user must be
able to look down a cross-street, over a roofline, or into a courtyard gap
without exposing unfinished geometry.

### Deliverables

- façade geometry rendering inside `public/canal-drive/` through the existing
  Three.js custom MapLibre layer;
- typed grammar and instantiation modules in `src/`, with their generated
  browser bundles committed atomically alongside them;
- offline Blender asset-generation scripts and their optimised GLB output;
- a versioned building-parameter extract under
  `public/data/extracts/amsterdam/`, written first to `staging/` with a coverage
  and diff report, and published only after review;
- reference viewpoint definitions and the visual-reference overlay mode;
- named façade regression checks wired into `npm run check:canal`;
- Storybook states for every façade tier and gable type;
- `TODO.md` and `HISTORY.md` updated in the same change that moves the work;
- `FACADE_QA_REPORT.md` containing: boundary, building count, coverage by
  fidelity tier, gable-type distribution, measured-versus-inferred parameter
  ratio, low-confidence building list, reference viewpoint count, comparison
  passes run, average and 1%-low FPS, triangle count, draw calls, texture
  memory, and remaining known discrepancies.

### Autonomy

Do not stop to ask which house to prioritise, whether a gable is good enough,
whether an approximation is acceptable, or whether to continue. Use evidence and
independent QA agents. When sources conflict, investigate further. When
information is genuinely unavailable, make the smallest defensible approximation,
mark it low-confidence in the extract, and record it in the QA report.

Do not stop at massing. Do not stop at recognisable. Stop when the reconstruction
survives independent geometric, architectural, local-knowledge, performance and
scope review.

---

## Part 2 — Completing the rest of Amsterdam

This part is the plan to run *after* the pilot is accepted. Do not start it
early, and do not let it influence pilot scope. Its purpose is to make the pilot
build the right things.

### The framing that makes this affordable

The pilot is not just a beautiful neighbourhood. It is deliberately two other
things:

1. **A grammar.** Seven gable types, a window vocabulary, a cornice vocabulary,
   a materials library, and a parameter schema that describes a canal house in
   about thirty numbers rather than a mesh.
2. **A labelled training corpus.** Roughly two thousand buildings, each with a
   `pand_id` and hand-verified gable type, bay count, storey count, window type
   and material, cross-referenced to BAG, AHN, ortho and monument text.

Nothing else about the pilot scales. Hand-censusing every façade in Amsterdam is
not a bigger version of the pilot; it is a different project that will never
finish. **Expansion is a pipeline problem, and the pilot's job is to produce the
pipeline's inputs.**

Design the census tooling in the pilot with this in mind: structured records
keyed by `pand_id`, one row per building, every field with provenance and
confidence, exported as a training-ready dataset. If the pilot's façade
knowledge lives in agent transcripts and hand-edited meshes instead of a table,
the expansion is dead before it starts.

### Gate: what must be true before expansion begins

Do not open Tier 1 until all of these hold.

- The pilot passes its final QA bar, scope discipline included.
- The parameter schema is stable and versioned; no field has been added in the
  last two milestones.
- Grammar instantiation is fully automatic from a parameter record: given a row,
  the engine produces the building with no human step.
- The gable/window/cornice/pui libraries are complete for the 17th–18th century
  vocabulary and reused, not forked, across the pilot.
- Performance headroom exists: the pilot boundary at LoD3 uses no more than half
  the frame budget, because the expansion will put more of the city on screen.
- Tier fallback is seamless: an LoD3 boundary adjoining LoD2.2 city shows no
  seam, no duplicate building, no popped silhouette.
- The extract pipeline writes to `staging/`, reports coverage and diffs, and
  publishes to versioned extracts only after review.
- Offline size budget is understood: measure the pilot's bytes per building at
  each tier, then multiply by the real citywide `pand` count from BAG. If that
  product does not fit the streaming and cache budget, solve that **before**
  building more city, not after.

### Measure the city first

Before planning tiers, run one reconnaissance job over the whole municipality's
BAG extract and produce the real numbers:

- total active `pand` count within the municipal boundary;
- distribution by `bouwjaar` decade;
- distribution by footprint area and plot width;
- 3DBAG LoD2.2 reconstruction-quality distribution;
- monument status coverage (Rijksmonument, gemeentelijk monument, protected
  cityscape);
- ortho coverage and roof-measurement success rate outside the centre.

Every subsequent estimate in this plan is a placeholder until those numbers
exist. Do not carry this document's guesses into a schedule.

### Tiers

Order by *grammatical coherence*, not by distance from the centre. Each tier is
a fabric with its own vocabulary; the cost of a tier is the cost of learning its
grammar plus a small marginal cost per building.

#### Tier 1 — The rest of the 17th-century canal ring and Centrum

Grachtengordel-South and East, the Golden Bend, Jordaan, Nieuwmarkt, the
Wallen, Haarlemmerbuurt, the Eastern Islands.

Reuses the pilot grammar almost entirely. Marginal cost per building is the
lowest it will ever be. Expect three new sub-problems: the wider and later
Golden Bend palaces, the Jordaan's smaller and plainer workers' houses, and the
warehouses (*pakhuizen*) of the islands with their shutter-tiers and hoist
gantries — that is one new library, not a new grammar.

Also here: the true landmarks. Paleis op de Dam, Nieuwe Kerk, Oude Kerk, Munt,
Centraal Station, Beurs van Berlage, Waag, Scheepvaartmuseum. These are
signature models, budgeted individually, and they matter disproportionately for
orientation across the whole map.

Success condition: a rider anywhere in Centrum can identify their canal from
façades alone.

#### Tier 2 — The 19th-century belt

De Pijp, Oud-West, Staatsliedenbuurt, Dapperbuurt, Oosterparkbuurt, Kinkerbuurt.

This is the highest-leverage tier in the entire project and it should be
attacked immediately after Tier 1. Speculative *revolutiebouw* built these
neighbourhoods in long, near-identical runs: the same developer, the same year,
the same plan repeated forty times down a street. Template reuse is extreme.

A new grammar is required — neo-renaissance and eclectic ornament, larger
windows, cast-iron balconies, tiled tympana, shop *puien* under
*bovenwoningen* — but once learned, a single template can cover an entire block
face with per-building variation limited to colour, storey height and ornament
sub-type.

Expect this tier to deliver more buildings per unit of effort than any other.

#### Tier 3 — Amsterdam School and interwar

Plan Zuid, Spaarndammerbuurt, Betondorp, Rivierenbuurt.

Sculptural expressionist brickwork: parabolic arches, rounded corners, tapered
towers, ladder windows, decorative bond patterns. The grammar approach still
works but the *parts* are far more varied and far less orthogonal, and 3DBAG's
roof reconstruction is weaker on these forms. Budget a dedicated part library
and more per-building geometry.

Het Schip and a handful of other set pieces are signature models.

#### Tier 4 — Postwar

Westelijke Tuinsteden, Buitenveldert, Slotervaart, Bijlmer, Noord's postwar
estates.

Repetitive slabs and gallery blocks with flat façade grammar. Low fidelity cost
per building, very high instancing efficiency: a whole estate is often three
building types repeated. 3DBAG LoD2.2 already carries most of the silhouette;
LoD3 here is largely a matter of correct window grids, balcony rows and panel
materials. Large building counts, small effort.

#### Tier 5 — Contemporary and bespoke

Zuidas, IJburg, Houthavens, Overhoeks, NDSM, Oostelijk Havengebied.

Curtain wall, varied massing, few shared rules. Each significant building is
close to bespoke, but there are comparatively few of them and their forms are
simple. 3DBAG plus a good glass material and measured façade grids gets most of
the way; reserve authored models for the towers that define the skyline.

#### Tier 6 — Industrial, port and infrastructure

Sheds, terminals, tanks, bridges, the ring road's structures. Mostly acceptable
at LoD2.2 with correct materials. Do not gold-plate.

### The classification pipeline

The mechanism that makes Tiers 1–4 tractable:

1. **Join** BAG, 3DBAG, AHN, OSM, monument register and ortho per `pand_id`.
2. **Predict** the parameter record from cheap signals: `bouwjaar`, plot width,
   footprint shape, roof form from 3DBAG, roof colour and material from ortho,
   monument description text where it exists, neighbourhood, and — critically —
   the parameters of adjacent buildings, since terraces are built in runs.
3. **Score confidence** per field. The pilot's 2,000 hand-verified rows are the
   training and calibration set; hold part of them out to measure honest
   accuracy per field, per era.
4. **Auto-accept** high-confidence predictions.
5. **Review by exception.** Humans and review agents only ever look at
   low-confidence buildings, disagreements between sources, and buildings that
   are visually prominent — canal frontage, corners, squares, landmark
   sightlines. A building at the back of an interior courtyard does not earn
   review time.
6. **Sample-audit** the auto-accepted population. Draw a random sample per
   neighbourhood, review it blind, and publish the measured error rate per
   field in the tier's QA report. If sampled accuracy for a field falls below
   its threshold, that field is demoted to a conservative default across the
   tier rather than shipped wrong.
7. **Feed back.** Every reviewed correction becomes training data. Accuracy
   should climb monotonically across tiers; if it does not, stop and find out
   why.

Automation ratio is the metric that decides whether expansion is working.
Target **95% auto-accepted** in Tiers 2 and 4, **85%** in Tier 1, **75%** in
Tier 3. If a tier cannot hit its ratio, the grammar for that fabric is wrong —
fix the grammar rather than throwing review capacity at it.

### Delivery mechanics

- **Tile everything.** Build independently cacheable, versioned 3D tiles keyed
  to the RD grid, per `BUILDING_RENDERER_DESIGN.md`'s offline-compiler end
  state. The compiler is the last step, not the first.
- **Ship per neighbourhood, not per city.** Each neighbourhood is a reviewable
  unit with its own coverage report, its own sampled accuracy and its own
  named regression locations. `TODO.md` tracks tiers and neighbourhoods, not one
  monolithic "rest of Amsterdam" item.
- **Never regress coverage.** LoD1 remains complete across the municipality at
  all times. A neighbourhood in progress renders at its current best tier; a
  half-finished LoD3 rollout never leaves a hole.
- **Budget bytes.** Track bytes per building per tier and total offline cache
  size per neighbourhood against the mobile budget. Fidelity that does not fit
  in the cache is fidelity nobody sees.
- **Regression locations accumulate.** The named-location suite grows with every
  tier and never shrinks. By Tier 4 it should cover several hundred addresses
  across every fabric, and it is the fastest signal that a grammar change broke
  something two neighbourhoods away.

### Ordering and stop rules

Recommended order: **Tier 1 → Tier 2 → Tier 4 → Tier 3 → Tier 5 → Tier 6.**

Tier 4 jumps ahead of Tier 3 because it is cheap per building and closes large
areas of the map quickly; Tier 3 is the most expensive grammar per building and
benefits from a more mature pipeline. Reorder if the measured city numbers say
otherwise, and record why.

Stop a tier and reassess when any of these fire:

- automation ratio is more than 15 points below the tier's target after the
  first neighbourhood;
- sampled accuracy for gable or roof form falls below 85%;
- frame time in the busiest view exceeds the 45 FPS floor;
- the offline cache for a neighbourhood exceeds its byte budget;
- a grammar change causes regressions in a previously accepted tier.

### What "done" means for Amsterdam

- Every active BAG `pand` in the municipality renders at LoD1 or better,
  offline.
- Centrum, the 19th-century belt and the interwar belt render at LoD3 with a
  published, sampled accuracy per field.
- Every landmark on the orientation list is a signature model.
- A rider dropped anywhere inside the ring road can determine their
  neighbourhood from the buildings alone, and their street within Centrum.
- The scope contract in Part 0 still holds: no foliage, no trams, no people, no
  vehicles, no boats, no interiors, no tenant signage — in the whole city, not
  just the pilot.
