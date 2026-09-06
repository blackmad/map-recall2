# The Amsterdam façade twin

Reconstructing Grachtengordel West's 3,025 canal houses from BAG parcels, 3DBAG
massing and the municipal panorama archive, so the game can render a street that
is actually that street.

**Start with the numbers, not the design.** What is measured, what is red, and
what is blocked lives in [`TODO.md`](TODO.md); why each thing is the way it is
lives in [`HISTORY.md`](HISTORY.md), whose façade sections are numbered and cited
from commit messages as §1–§26.

This file is the standing design: scope, sources, and the rebuild that produced
the current shape. Each chapter kept the words it was written in.

## The one number that matters

Identity — does the strip we rectified show the pand we asked for — is measured by
reading the house number beside the door and comparing it against BAG's address
points, with a decoy scored by the same rule. It stands at **76%**: of the panden
a reading can decide, 44 confirm and 14 contradict. The bar is 95%, and
`check-number-anchors.ts` fails below it.

Everything else in this file is subordinate to that, because a measurement taken
off the wrong building is not a weak measurement.

## Contents

1. **Scope and the build contract** — The scope contract the twin is built against, and what is deliberately excluded.
2. **Reconnaissance: what the sources actually hold** — The M0 survey of BAG, 3DBAG and the panorama archive over the pilot boundary.
3. **The clean rebuild plan** — Why the pipeline was rebuilt, and the import/quarantine matrix that governed it.

---

## 1. Scope and the build contract

*Was `public/canal-drive/AMSTERDAM_FACADE_TWIN.md`.*

Build a convincing, recognisable **3D reconstruction of the buildings of the
western canal ring (De Negen Straatjes / Grachtengordel-West)**, rendered inside
the existing Canal Recall runtime, and then a plan to extend that work to the
rest of Amsterdam.

This is not a toy scene and not a handful of representative canal houses. The
goal is a **city-scale building twin** where a rider on Prinsengracht can look
across the water at Herengracht, recognise individual houses by their gables,
and know which stretch of which canal they are on without a label.

---

### Part 0 — Scope contract

Read this before anything else. It is the part of this document most likely to
be violated by an enthusiastic agent.

#### In scope

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

#### Out of scope — do not build these, do not spend a single agent on them

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

#### The one deliberate consequence of this scope

A leafless, vehicle-free, person-free canal ring will look uncanny in a wide
daylight shot, and every visual QA agent will want to report that. It is not a
defect. Visual QA must judge **façades against façade references**, framed
tightly enough that the missing city does not dominate the comparison.

#### Runtime target

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

### Part 1 — The pilot: De Negen Straatjes and Grachtengordel-West

#### Boundary

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

#### Hero buildings

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

Everything else is reconstructed the same way as the heroes — from its own
observations — but through the automated measurement pipeline rather than by
hand. That is the point of the pilot: the hero buildings prove the ceiling, the
ordinary terraces prove that per-building fidelity survives automation.

#### Ground truth is measured, not guessed

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

#### Coordinate system

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


#### Per-building reconstruction

**Every building is reconstructed from its own evidence.** This is the central
rule of the project and it outranks throughput.

Amsterdam's canal ring is the most grammatical urban fabric in Europe — narrow
plots, party walls, a shared structural logic, a small vocabulary of gable and
window types that vary by date — and that grammar is genuinely useful. But it is
useful as a **rendering vocabulary**, not as a source of facts. The parts library
tells you how to draw a *klokgevel* once you know this house has one. It must
never tell you that this house has one.

So: derive the vocabulary, then measure each building into it. A house gets its
own gable type, its own bay count, its own storey heights, its own door
position, its own brick colour, its own lean — observed, not sampled from what
its neighbours look like.

##### The parameter record is per building, and cheap

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
  bayOffsetsM: number[];         // measured, not evenly divided
  windowType: 'kruiskozijn' | 'schuifraam-6' | 'schuifraam-8' | 'later';
  storeyHeights: number[];       // diminishing upward, measured not assumed
  doorPositionM: number;         // measured offset across the façade
  hoistBeam: boolean;
  hoistBeamOffsetM: number | null;
  corniceType: CorniceSpec;
  brick: BrickSpec;              // bond, colour (measured), pointing
  dressings: 'sandstone' | 'painted' | 'none';
  leanDeg: number;               // op de vlucht, measured per façade
  ridgeSagM: number;             // settlement, measured per façade
  puiType: PuiSpec;              // ground-floor shopfront frame, tenant-neutral
  evidence: EvidenceLedger;      // see below — mandatory
}
```

Thirty-odd numbers per building. At a citywide scale that is single-digit
megabytes for the entire municipality — trivially affordable, and far smaller
than the meshes it generates. **Per-building storage is not the constraint.
Per-building *observation* is.** Plan the expansion around observation cost and
nothing else; never compromise per-building fidelity to save bytes, because the
bytes were never the problem.

##### The evidence ledger

Every field carries its provenance, its confidence and the observation it came
from, exactly as `BUILDING_ENRICHMENT.md` requires of roof colour:

```ts
interface FieldEvidence {
  value: unknown;
  source: 'bag' | 'ahn' | '3dbag' | 'pdok-ortho' | 'monument-text'
        | 'streetlevel-measured' | 'osm' | 'reviewed' | 'default';
  confidence: number;            // calibrated, not vibes
  observationId: string | null;  // which image, which record, which review
  measuredAt: string;            // imagery or record date
}
```

`default` is the only value that means "we did not observe this". It must be
counted, reported, and visible in the QA report per field and per
neighbourhood. The renderer may use a default; the extract may never launder one
into a measurement.

##### No jitter, and no invented façades

Do not apply procedural jitter to make a terrace look hand-built. Real terraces
already vary, in ways that are measurable: different lean, different sag,
different storey heights, different brick, different pointing, different door
positions. Measure that variation instead of simulating it. Jitter is a guess
wearing the costume of detail, and in a game whose whole purpose is geographic
learning it teaches confident falsehoods.

That leads to the hard rule:

> **A building whose façade has never been observed does not get a façade.**

It renders at LoD2.2 — correct silhouette, correct roof, measured materials, and
no openings — and it joins the observation queue. It never gets plausible
invented windows.

An unmodelled building is a gap. A confidently wrong building is a lie the
player memorises, and this project exists to teach people what is actually
there. Prefer the gap, every time.

##### Observation tiers

Reconstruction fidelity follows evidence, per elevation, not per building:

```text
FRONTAL      rectified street-level view of this façade
             → full LoD3: openings, gable, cornice, pui, materials, lean

OBLIQUE      angled or partial view, or a monument description naming the
             gable type and bay count
             → LoD3 for what is stated or visible; conservative elsewhere;
               every unobserved field marked default

AERIAL ONLY  roof and massing measured, façade never seen
             → LoD2.2 with measured roof and wall colour, no openings

NONE         no usable observation
             → LoD1
```

Canal frontage in the pilot boundary should reach FRONTAL almost everywhere.
Rear elevations, courtyard walls and party-wall returns frequently will not, and
that is the correct place for the ladder to fall back.

##### Measuring a façade

For each building with street-level reference, in leaf-off imagery wherever the
choice exists:

1. rectify the façade to an orthographic elevation using the BAG footprint edge
   as the ground-truth width;
2. scale from the measured plot width — the one dimension you already know
   exactly;
3. locate storey lines, window openings, door, hoist beam, cornice and gable
   apex in that rectified space;
4. classify the gable type and ornament against the vocabulary;
5. sample brick, paint and joinery colour away from shadow and highlight, as the
   roof pipeline already does;
6. emit the parameter record with per-field confidence and the observation id;
7. flag for review anything ambiguous rather than picking the modal answer.

Monument descriptions are a *second independent measurement* for protected
buildings, not a substitute. Where the text and the imagery disagree, review
that building by hand and record which won.

##### Assembly

Blender generates the parameterised parts offline:

```python
make_gable(kind="klok", width_m=5.4, ornament="klauwstukken+vaas", stone="sandstone")
make_window(kind="schuifraam-8", width_m=1.1, height_m=2.05, bars=True)
make_cornice(kind="kroonlijst", width_m=5.4, depth_m=0.45, brackets=7)
make_pui(width_m=5.4, height_m=3.2, bays=2, frame="painted-timber", fascia="neutral")
```

Parts are exported as compressed GLB, atlased, and assembled at runtime by
instancing against each building's own parameter record. Instancing is a
performance technique applied to geometry that genuinely repeats — a window
sash, a cornice bracket — and never a licence to reuse one house's measurements
for another.

Two adjacent houses built by the same hand in the same year may legitimately
resolve to near-identical records. That is a finding, not a shortcut, and it
must arrive from two independent observations rather than from copying one.

#### Fidelity ladder

Extend the ladder in `LOD.md` rather than inventing a parallel one.

- **LoD1** — footprint extrusion, measured height, measured roof colour.
  Complete coverage, offline fallback, everything outside the pilot boundary.
- **LoD2.2** — 3DBAG reconstructed walls and roof planes. Correct silhouette,
  no openings. The current `detailed-buildings` baseline.
- **LoD2.2 + measured appearance** — the above with measured roof and wall
  colour and material. The correct resting tier for any building whose façade
  has not been observed. No openings, ever, without evidence.
- **LoD3 (new, this project)** — per-building measured façade: this building's
  window and door openings, its gable form and ornament, its cornice, its *pui*,
  its materials and its lean. Requires a frontal or oblique observation of the
  elevation being detailed. This is the pilot's deliverable tier.
- **Signature model** — authored GLB for the hero buildings, per the existing
  signature-model rules: attribution record, geographic transform, performance
  LODs, stable aliases, identical picking and highlight behaviour.

A building renders at exactly one tier at any moment. Tier selection is per
`pand_id`, per elevation, per camera distance, **and per available evidence** —
a building is never promoted above what has actually been observed of it. The
transition must not pop the silhouette.

#### Parallel reconstruction swarm

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
RECON-6   Per-building façade survey, Herengracht both banks
RECON-7   Per-building façade survey, Keizersgracht both banks
RECON-8   Per-building façade survey, Prinsengracht both banks
RECON-9   Per-building façade survey, Singel + the nine cross-streets
RECON-10  Quay, water level, bridge and kademuur geometry
```

The survey agents work canal-side by canal-side, **house by house**, from
leaf-off street-level reference. For each `pand_id` they record that building's
own gable type, bay count and offsets, storey count and heights, window type,
door position, hoist beam, cornice, lean and materials, each with a confidence
and an observation id. They record `default` where they could not see, and they
never carry a neighbour's answer across a party wall. They do **not** record
what shop is downstairs.

Construction wave — again concurrent, one lane each:

```text
BUILD-1   Blender gable library (all seven types, parameterised)
BUILD-2   Blender window/door/shutter library
BUILD-3   Blender cornice, dressing and ornament library
BUILD-4   Blender pui (shopfront frame) library, tenant-neutral
BUILD-5   Material library: brick bonds, sandstone, stucco, paint, glass, pantile, slate
BUILD-6   Façade rectification and measurement pipeline
BUILD-6b  Per-building assembly engine (typed, in src/)
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

#### Materials

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

#### Time of day

Support `DAY`, `SUNSET`, `NIGHT`. Day is the reference-validation mode.

Night is where a leafless, empty city is least strange, and where façades read
most clearly: lit windows, illuminated bridges, and the canal reflections
Amsterdam is known for. Do not light building interiors — emissive windows and
faked interior depth only, per the no-interiors rule.


#### Verification

The final artifact is visual. Source-code inspection proves nothing. A milestone
is never complete because the code compiles, the assets load and the console is
clean; those are minimum conditions.

Every milestone runs:

```text
IMPLEMENT → RUN THE REAL GAME → NAVIGATE → CAPTURE → COMPARE → MEASURE
→ LIST ERRORS → FIX → RUN AGAIN
```

Repeat until convergence.

##### Reference viewpoints

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

##### Visual reference mode

Implement a developer-only overlay in the running game: reference photograph and
rendered frame at the same camera, blendable by an opacity slider. This mode is
critical. Most façade errors — a bay too many, a storey height wrong, a gable of
the right family but the wrong sub-type — are invisible in isolation and obvious
in overlay.

##### Structural comparison, not pixel matching

Lighting, imagery date and season differ. Compare structure:

- roofline profile across a terrace;
- gable silhouettes;
- window-bay spacing and storey-height ratios;
- party-wall positions against BAG footprints;
- cornice and *hijsbalk* heights;
- quay and waterline position.

Automated metrics complement human review; they do not replace it.

##### Named regression locations

Per this repository's working agreement, every reported geographic failure
becomes a **named regression location**. When a reviewer says "Keizersgracht 268
has the wrong gable", that address is pinned in the check suite before the fix
is considered done, and it stays pinned afterwards. Screenshots and house
numbers are evidence; convert them into tests.

Wire the new checks into `npm run check:canal` so façade regressions are caught
by the same pre-integration gate as driving and reachability.

##### Storybook

Use Storybook for deterministic façade states that are expensive to reach by
driving: each gable type, each window type, a terrace with mixed heights, a
building at each fidelity tier, the tier transition, a low-confidence fallback
building, and the reference-overlay mode. Add desktop and mobile states.

##### QA agents

Run independent reviewers in parallel. None of them may be the agent that built
the thing under review.

```text
QA-GEOM     footprints, heights, party walls, roof pitch, quay alignment
QA-ARCH     is this the right gable, the right period, the right proportion?
QA-LOCAL    would someone who lives here recognise this stretch of canal?
QA-TECH     materials, texture repetition, LOD popping, z-fighting, artifacts
QA-SCOPE    has anyone smuggled in a tree, a bike, a boat or a shop logo?
QA-EVIDENCE does every rendered opening trace to an observation of THIS pand?
```

QA-GEOM and QA-ARCH produce error reports and do not modify the scene;
correction agents act on those reports; then an independent re-review runs.

QA-SCOPE is not a joke lane. Scope creep into foliage and vehicles is the most
likely way this project fails.

QA-EVIDENCE is the second most likely. It audits the ledger against the render:
pick buildings at random, trace every visible feature back to a `pand_id`-level
observation, and report any that resolve to a neighbour's record, a template
default or nothing at all. It should also re-review the buildings the pipeline
was *most* confident about, because that is where an unnoticed template leak
would hide.

#### Performance

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

#### Milestones

```text
M0  RECONNAISSANCE       inventory, sources joined, grammar hypothesis, boundary fixed
M1  MASSING              BAG/3DBAG/AHN massing + roofs across the boundary, in-game
M2  QUAY AND WATER       canals, quay walls, bridges, correct water level
M3  GABLE LIBRARY        all seven types parameterised, reviewed twice
M4  MEASUREMENT          rectification pipeline + per-building façade survey
M5  ASSEMBLY             per-pand records drive geometry; evidence ladder enforced
M6  FAÇADE ROLLOUT       every observed building in the boundary at LoD3
M7  HERO BUILDINGS       Westerkerk and the signature set
M8  MATERIAL PASS        measured colour, brick, stone, glass, roofing
M9  LIGHTING             day / sunset / night, reflections
M10 INTEGRATION          tier resolution, picking, highlight, offline fallback
M11 OPTIMISATION         profile, instance, atlas, stream
M12 ADVERSARIAL QA       independent geometric, architectural, local and scope review
```

Do not proceed past M0 until the geographic inventory is coherent. Do not
proceed past M1 until the massing is recognisable in overlay against reference.
Do not proceed past M4 until measurement coverage is known per elevation — the
rollout's job is to render what was measured, not to fill in what was not.

#### Final QA bar

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
Per-building evidence discipline    10/10
```

No category may sit below 8. Scope discipline and evidence discipline are both
pass/fail at 10: a single façade rendered from a neighbour's measurements, or a
`default` shipped as though it were measured, fails the milestone outright. Do
not lower the bar to justify unfinished work.

Report **measurement coverage** alongside these scores — the share of buildings
at each observation tier, and per field the share measured versus defaulted.
A boundary that is 70% frontally observed and honest about it is a better
result than one that is 100% detailed and 30% invented.

#### The walkthrough test

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

#### No empty back sides

A classic failure of generated cities is beautiful canal frontage and hollow
everything else. The canal ring's rear geometry is genuinely complex — deep
plots, *achterhuizen*, courtyards, party walls of unequal height. A user must be
able to look down a cross-street, over a roofline, or into a courtyard gap
without exposing unfinished geometry.

#### Deliverables

- façade geometry rendering inside `public/canal-drive/` through the existing
  Three.js custom MapLibre layer;
- typed vocabulary, façade-measurement and per-building assembly modules in
  `src/`, with their generated browser bundles committed atomically alongside
  them;
- offline Blender asset-generation scripts and their optimised GLB output;
- the per-building evidence ledger, published with the extract, queryable by
  `pand_id`, and summarised per field and per neighbourhood;
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

#### Autonomy

Do not stop to ask which house to prioritise, whether a gable is good enough,
whether an approximation is acceptable, or whether to continue. Use evidence and
independent QA agents. When sources conflict, investigate further. When
information is genuinely unavailable, make the smallest defensible approximation,
mark it low-confidence in the extract, and record it in the QA report.

Do not stop at massing. Do not stop at recognisable. Stop when the reconstruction
survives independent geometric, architectural, local-knowledge, performance and
scope review.

---

### Part 2 — Completing the rest of Amsterdam

This part is the plan to run *after* the pilot is accepted. Do not start it
early, and do not let it influence pilot scope. Its purpose is to make the pilot
build the right things.

#### The framing that makes this affordable

Per-building measurement is the requirement citywide, not a luxury the pilot
could afford because it was small. What has to scale is therefore the
*measuring*, not the guessing.

The pilot is not just a beautiful neighbourhood. It is deliberately three other
things:

1. **A vocabulary.** Seven gable types, a window vocabulary, a cornice
   vocabulary, a materials library, and a parameter schema that describes any
   canal house in about thirty numbers rather than a mesh.
2. **A measurement pipeline.** Rectify a façade against its BAG footprint edge,
   find its storey lines and openings, classify its gable, sample its colours,
   emit a record with per-field confidence. This is the artifact that scales.
3. **A calibration corpus.** Roughly two thousand buildings, each with a
   `pand_id` and hand-verified fields, cross-referenced to BAG, AHN, ortho and
   monument text — the set that tells you how much to trust the pipeline's
   output on a building nobody has checked.

What does *not* scale is a human looking at every façade. What does scale is a
machine looking at every façade and a human looking at the ones it was unsure
about. Those are very different things, and only the second preserves the
per-building rule.

Design the survey tooling in the pilot with this in mind: structured records
keyed by `pand_id`, one row per building, every field with provenance,
confidence and an observation id, exported as a calibration-ready dataset. If
the pilot's façade knowledge lives in agent transcripts and hand-edited meshes
instead of a table, the expansion is dead before it starts.

#### Gate: what must be true before expansion begins

Do not open Tier 1 until all of these hold.

- The pilot passes its final QA bar, scope discipline included.
- The parameter schema is stable and versioned; no field has been added in the
  last two milestones.
- Assembly is fully automatic from a parameter record: given a row, the engine
  produces that building with no human step.
- Façade measurement is automatic end to end on the pilot boundary, and its
  confidence scores are calibrated against held-out hand-verified buildings.
- Observation coverage is measured and reported per elevation, and the QA report
  distinguishes measured from defaulted fields for every building.
- The gable/window/cornice/pui libraries are complete for the 17th–18th century
  vocabulary and reused, not forked, across the pilot.
- Performance headroom exists: the pilot boundary at LoD3 uses no more than half
  the frame budget, because the expansion will put more of the city on screen.
- Tier fallback is seamless: an LoD3 boundary adjoining LoD2.2 city shows no
  seam, no duplicate building, no popped silhouette.
- The extract pipeline writes to `staging/`, reports coverage and diffs, and
  publishes to versioned extracts only after review.
- Offline size budget is understood for *generated geometry* — the parameter
  records themselves are megabytes citywide and never the constraint. Measure
  the pilot's mesh and texture bytes per building at each tier, multiply by the
  real citywide `pand` count from BAG, and if that product does not fit the
  streaming and cache budget, solve it **before** building more city. Solve it
  by tiling, atlasing and LOD, never by reverting to shared per-block
  geometry.

#### Measure the city first

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

#### Tiers

Order by *grammatical coherence*, not by distance from the centre. Each tier is
a fabric with its own vocabulary; the cost of a tier is the cost of learning
that vocabulary and teaching the extractor to read it, plus a small marginal
measurement cost per building.

##### Tier 1 — The rest of the 17th-century canal ring and Centrum

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

##### Tier 2 — The 19th-century belt

De Pijp, Oud-West, Staatsliedenbuurt, Dapperbuurt, Oosterparkbuurt, Kinkerbuurt.

This is the highest-leverage tier in the entire project and it should be
attacked immediately after Tier 1. Speculative *revolutiebouw* built these
neighbourhoods in long, near-identical runs: the same developer, the same year,
the same plan repeated forty times down a street. Template reuse is extreme.

A new vocabulary is required — neo-renaissance and eclectic ornament, larger
windows, cast-iron balconies, tiled tympana, shop *puien* under *bovenwoningen*.
Once it exists, measurement gets cheap and reliable here: the repetition means
the extractor sees the same forms thousands of times and its confidence is well
calibrated, so the automation ratio is high and review lands only on the
genuine oddities.

The repetition is a reason measurement is *easy* here, not a reason to stop
measuring. Two houses in a run of forty still differ in paint, ornament
sub-type, later shopfront insertion and a century of alteration, and those
differences are exactly what a rider navigates by. Measure all forty.

Expect this tier to deliver more buildings per unit of effort than any other.

##### Tier 3 — Amsterdam School and interwar

Plan Zuid, Spaarndammerbuurt, Betondorp, Rivierenbuurt.

Sculptural expressionist brickwork: parabolic arches, rounded corners, tapered
towers, ladder windows, decorative bond patterns. The grammar approach still
works but the *parts* are far more varied and far less orthogonal, and 3DBAG's
roof reconstruction is weaker on these forms. Budget a dedicated part library
and more per-building geometry.

Het Schip and a handful of other set pieces are signature models.

##### Tier 4 — Postwar

Westelijke Tuinsteden, Buitenveldert, Slotervaart, Bijlmer, Noord's postwar
estates.

Repetitive slabs and gallery blocks with flat façade grammar. Low fidelity cost
per building and very high instancing efficiency at the *part* level — window
grids, balcony rows, panel bays. The estate-scale repetition is real, but it is
still confirmed per building rather than assumed: postwar blocks are heavily
renovated, and cladding, glazing and balcony infill now differ block to block.
3DBAG LoD2.2 already carries most of the silhouette;
LoD3 here is largely a matter of correct window grids, balcony rows and panel
materials. Large building counts, small effort.

##### Tier 5 — Contemporary and bespoke

Zuidas, IJburg, Houthavens, Overhoeks, NDSM, Oostelijk Havengebied.

Curtain wall, varied massing, few shared rules. Each significant building is
close to bespoke, but there are comparatively few of them and their forms are
simple. 3DBAG plus a good glass material and measured façade grids gets most of
the way; reserve authored models for the towers that define the skyline.

##### Tier 6 — Industrial, port and infrastructure

Sheds, terminals, tanks, bridges, the ring road's structures. Mostly acceptable
at LoD2.2 with correct materials. Do not gold-plate.

#### The measurement pipeline at city scale

The mechanism that makes Tiers 1–4 tractable. Note what it is *not*: it is not a
model that predicts what a building probably looks like. It is an automated
observer that measures each building individually and says how sure it is.

1. **Join** BAG, 3DBAG, AHN, OSM, monument register and ortho per `pand_id`.
2. **Acquire** an observation of each elevation: street-level imagery, oblique
   aerial, archive photography, monument text. Coverage is the gating resource,
   so measure it first and report it per neighbourhood before building anything.
3. **Measure** each façade from its own image — rectify, scale from the known
   plot width, locate storey lines and openings, classify the gable, sample
   colours. One building, one observation, one record.
4. **Score confidence** per field, calibrated against the held-out pilot corpus
   so the numbers mean something. Report accuracy per field, per era.
5. **Use priors only to route attention.** `bouwjaar`, neighbourhood and
   neighbouring buildings are legitimate for ordering review, flagging
   surprises and breaking a genuine tie between two readings of the same image.
   They are never a source of values. A neighbour's gable type may raise a
   question about this building; it may not answer it.
6. **Auto-accept** high-confidence *measurements*.
7. **Review by exception.** Humans and review agents look at low-confidence
   buildings, source disagreements, and buildings that are visually prominent —
   canal frontage, corners, squares, landmark sightlines. A rear wall in an
   interior courtyard does not earn review time.
8. **Default the rest, visibly.** Anything neither measured nor reviewed stays
   at its evidence tier — LoD2.2, no openings — and stays in the queue. Tiers
   ship with holes rather than with fabrications.
9. **Sample-audit** the auto-accepted population. Draw a random sample per
   neighbourhood, review it blind, publish the measured error rate per field.
   If a field falls below its threshold, demote that field to a conservative
   default across the tier rather than shipping it wrong.
10. **Feed back.** Every reviewed correction joins the calibration corpus.
    Accuracy should climb monotonically across tiers; if it does not, stop and
    find out why.

Two metrics decide whether expansion is working, and they must be reported
together:

- **Observation coverage** — the share of buildings with a usable view of each
  elevation. This is the ceiling on everything.
- **Automation ratio** — the share of *observed* buildings whose measurement is
  auto-accepted. Target **95%** in Tiers 2 and 4, **85%** in Tier 1, **75%** in
  Tier 3.

A high automation ratio over low observation coverage is not progress; it is a
small measured city with a large invented one behind it. If a tier cannot hit
its ratio, the measurement pipeline is wrong for that fabric — fix the pipeline
rather than throwing review capacity at it, and never fix it by lowering the
confidence bar.

#### Delivery mechanics

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

#### Ordering and stop rules

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

#### What "done" means for Amsterdam

- Every active BAG `pand` in the municipality renders at LoD1 or better,
  offline.
- Centrum, the 19th-century belt and the interwar belt render at LoD3 from
  per-building measurement, with published observation coverage and sampled
  accuracy per field.
- No building anywhere renders openings it was not observed to have.
- Every landmark on the orientation list is a signature model.
- A rider dropped anywhere inside the ring road can determine their
  neighbourhood from the buildings alone, and their street within Centrum.
- The scope contract in Part 0 still holds: no foliage, no trams, no people, no
  vehicles, no boats, no interiors, no tenant signage — in the whole city, not
  just the pilot.


## 2. Reconnaissance: what the sources actually hold

*Was `public/canal-drive/FACADE_RECON.md`.*

Status: **M0 complete for RECON-1 through RECON-4, and for the observation
survey behind RECON-6…9.** RECON-5 (PDOK ortho roof colour) and RECON-10
(quay, water level, bridges) are not started — and RECON-5 now blocks a field:
roof material is `default` on every record until it runs.

Coverage measured for the whole boundary: 17,251 elevations, 139,937 panorama
poses, **26.5% of elevations frontal and 88.6% of buildings with a frontal view
of at least one elevation**, 86.7% of those leaf-off.

Façades actually measured, as of the latest run: **1,598 buildings, of which
1,340 carry at least one opening — 44.3% of the boundary — and 10,335 openings
in total.** 56 readings were rejected by the plausibility filter as not being
façades at all, each with its reason. None of this is validated: the
registration check is red at its own bar and no field has been checked against a
hand-labelled building, so every street-level field is capped at confidence 0.4.
The review harness that lifts that cap is built and waiting at
`public/canal-drive/facade-review/`.

Every number here is measured from the sources named beside it. Where this
document contradicts an estimate in
[`AMSTERDAM_FACADE_TWIN.md`](AMSTERDAM_FACADE_TWIN.md), the measurement wins —
that document says so itself.

Regenerate with:

```bash
npm run recon:facade                                        # every declared area
npx tsx scripts/facade-twin/recon.ts --area=amsterdam-grachtengordel-west
npx tsx scripts/facade-twin/recon.ts --area=... --refresh   # bypass caches
```

Outputs land in
`public/data/extracts/amsterdam/staging/facade-twin/<areaId>/{recon.json,boundary.geojson}`.
Nothing is published to a versioned extract yet, by design.

### The pipeline is source-adapter driven, not Amsterdam-shaped

The first cut of this welded the BAG endpoint, the 3DBAG endpoint, the RCE
register and a ring of five named canals straight into four scripts. That was
the wrong shape, and not merely untidy: **BAG, 3DBAG and the Rijksmonumenten
register are national registers.** A pipeline welded to one city throws away the
fact that Utrecht, Rotterdam and Den Haag are already covered by exactly the
same sources, and it has no way to express what a city outside the Netherlands
would need instead.

So reconnaissance is now written against three narrow interfaces in
`src/canalRecall/facade/sources.ts`, each answering one question a façade
reconstruction has to ask of the world:

| interface | question |
|---|---|
| `BuildingRegistry` | which buildings are here, and what is each one called? |
| `MassingSource` | how tall is it, what shape is its roof, and how much do you trust your own answer? |
| `HeritageSource` | has anyone described this building's façade in words? |

plus `ProjectedCrs`, because façade measurement is metric work and every city
declares the metre-based CRS its own registers are published in. The Dutch
implementations live in `sources/netherlands.ts`; adding a Dutch city is an
entry in `areas.ts` and nothing else.

A survey area is likewise declared data, in one of two shapes — a **corridor**
ring that follows named linear features with a per-leg outward offset (what the
canal ring needs), or an explicit **polygon** (for areas whose edges are not
linear features). Both resolve to a ring in the city's CRS with membership by
footprint intersection.

**Verified by running it elsewhere.** `utrecht-binnenstad-north` — the
Oudegracht wharf-canal fabric, declared as a polygon — runs through identical
code: 2,378 buildings, 2,171 matched to 3DBAG, 617 heritage listings, median
plot width 6.6 m. No Amsterdam-specific code was involved, and the Amsterdam
numbers reproduced exactly across the refactor.

One Utrecht number corroborates the central Amsterdam finding below: pitched-roof
reconstruction error there is **0.38 m** median against Amsterdam's **0.60 m**.
The canal ring's roofs really are unusually complex, rather than 3DBAG being
uniformly weak on pitched roofs.

Amsterdam is the focus; the other area exists to keep the pipeline honest about
what is city-specific and what is not.

---

### Coordinate system — settled and pinned

Work is in **RD New (EPSG:28992)** with **NAP** heights, reprojected once at the
pipeline edge, per the brief.

`src/canalRecall/facade/rdNew.ts` implements the Schreutelkamp / Strang van Hees
polynomial approximation of RDNAPTRANS. Measuring it against 24 authoritative
RD/WGS84 pairs from PDOK's own Locatieserver showed the raw polynomials sit a
**constant 0.183 m east, 0.234 m north** off PDOK's published WGS84 — spread
about a centimetre from Kerkrade to Groningen. A constant that stable across
300 km is a datum offset, not approximation noise, so it is subtracted as a
measured constant (`NSGI_ALIGNMENT_M`) rather than tolerated.

A second session measured the same offset independently, against a different
endpoint (PDOK BAG dual-CRS reprojection) and a different point set, and got
0.184 E / 0.233 N — one millimetre apart. The lineage is settled.

Residual after correction, pinned in `scripts/check-facade-coordinates.ts`:

| scope | mean | worst | tolerance |
|---|---|---|---|
| inside the pilot boundary | 1.0 mm | 1.4 mm | 5 mm |
| nationally | 1.8 mm | 11.0 mm | 15 mm |

Two tolerances because the residual has a shape: once the datum offset is gone,
what remains is a polynomial fit centred near Amersfoort, smallest mid-country
and largest at the coasts. The tight number is the one façade measurement
depends on — the pipeline measures from 12.5 cm orthophoto pixels, and 1.4 mm is
a hundredth of a pixel.

**Fixed local origin: RD (120700, 487500)**, on the Westermarkt 44 m from the
Westerkerk tower. Documented in `rdNew.ts`, pinned by the check, never to change.

**Water and datum constants** are explicit with a source, not eyeballed:
canal water level **−0.40 m NAP**; nominal quay crown **+1.05 m NAP**, always
superseded by an AHN measurement per quay segment, because a canal that renders
level across a kilometre is wrong.

---

### The boundary — fixed

`src/canalRecall/facade/surveyArea.ts` and `areas.ts`, published to
`staging/facade-twin/pilot-boundary.geojson`.

The boundary follows **canal centrelines**, not a bounding box and not chords
between corner junctions — the ring curves continuously, and a chord cuts off
the outside of every bend. Each leg is then pushed **outward** far enough to
reach the building row on the far bank, because the brief puts *both banks* of
every boundary canal in scope. Membership is **BAG footprint intersection**.

| leg | length | outward offset | why |
|---|---|---|---|
| Brouwersgracht | 433 m | 42 m | narrower than the main grachten; reaches the north-bank warehouses without touching Haarlemmerstraat |
| Singel | 1164 m | 45 m | Brouwersgracht down to the canal's south end at Koningsplein |
| Herengracht | 125 m | 45 m | the south-east closure — see below |
| Leidsegracht | 302 m | 45 m | south edge; the Gouden Bocht beyond it is the stretch sector |
| Prinsengracht | 1691 m | 95 m | west edge, widened to take the first Jordaan row behind the west bank |

Offsets are measured against real cross-sections, not picked. A Grachtengordel
canal is ~25 m of water plus ~12–15 m of quay each side, so the far-bank front
wall is ~27 m from the centreline; 45 m lands 18 m into a plot 30–55 m deep.

The 95 m west offset was set from measured perpendicular distances, not
assumed — Bloemstraat 12 sits 54 m and Egelantiersgracht 12 sits 49 m west of the
Prinsengracht centreline (first row behind, **in**), while Bloemgracht 60 sits
109 m west (second row, **out**).

**Two geometric facts the brief's four-canal description does not cover:**

1. **Singel does not reach Leidsegracht.** It ends at Koningsplein. The
   south-east corner is closed *along Herengracht*, which does reach both — a
   125 m leg from the point nearest Singel's south end down to
   Herengracht × Leidsegracht. The whole ring therefore stays on canal
   centrelines rather than hopping across a block.
2. **The district is not 1.1 km × 0.7 km.** Measured extent is
   **0.95 km × 1.77 km**, area **0.873 km²**. Brouwersgracht to Leidsegracht
   along Prinsengracht is 1.69 km. The brief's estimate was roughly half the
   true north–south run.

Every canal junction in the ring is an exact shared OSM node (gap 0.00 m); the
only non-zero gap is the deliberate 111 m Koningsplein closure.

#### Named regression locations

`scripts/check-facade-boundary.ts` pins **36 addresses** — 23 inside, 13
outside — each with its BAG `pand_id` and real footprint, committed as a
fixture. All nine Negen Straatjes cross-streets and every hero building are in
the inside set; the Gouden Bocht is in the outside set because it is the stretch
sector, not the core. 44 checks, all passing, including ring simplicity.

One case is pinned specifically because it distinguishes the two candidate
membership rules: **Singel 411's BAG address point is 79 m from the Singel
centreline — outside a 45 m offset — while its footprint plainly intersects the
boundary.** Address points sit deep inside blocks. Testing them instead of
footprints would silently drop far-bank buildings while appearing to pass.

An offset ring also self-intersects wherever the offset exceeds the local radius
of curvature; one such loop appeared at a kink in Singel and is excised by
`removeSelfIntersections`. Left in, it would have inverted inside/outside for
every building near it.

---

### RECON-1 — the pand inventory

Source: PDOK Kadaster **BAG OGC API Features v2**, collection `pand`
(`api.pdok.nl/kadaster/bag/ogc/v2`). Paged by cursor at 1000/page.

- **5,757** panden in the boundary bounding box
- **3,025** intersect the boundary — **this is the pilot's building count**
- **2,950** are `Pand in gebruik`; 34 demolished, 22 never built, 7 under permit

The brief guessed "roughly two thousand buildings". It is **3,025**, about 50%
more, and 2,270 of them are canal-house-shaped (3.5–9 m wide).

Plot geometry, from the minimum-area rectangle of each footprint — the short
side is the façade width the whole measurement pipeline scales from:

| percentile | plot width | footprint area |
|---|---|---|
| p5 | 3.4 m | 19 m² |
| p25 | 4.6 m | 51 m² |
| p50 | **5.7 m** | 82 m² |
| p75 | 7.6 m | 139 m² |
| p95 | 16.7 m | 401 m² |

A 5.7 m median plot is the canal-house grammar showing up in the data.

`bouwjaar`, by quarter-century (BAG registration year, which for a canal house
is often a later rebuild rather than first construction):

```
1005 (unknown)   215      1725   380
1600             114      1750   350
1625             123      1775   120
1650             176      1800    62
1675              73      1825    70
1700             180      1850   140
                          1875   215
                          1900   348
                          1925   150
                          1950    51
                          1975   177
                          2000    73
```

**215 buildings (7.1%) carry BAG's `1005` sentinel, meaning no known
construction year.** They must not be routed as if they were medieval. Pre-1800
is 1,046 buildings, with a clear 1725–1775 peak of 730 — the great refacing era,
which is consistent with the *lijstgevel* dominance the monument register shows
below.

---

### RECON-2 — 3DBAG massing and reconstruction quality

Source: **3DBAG API** (`api.3dbag.nl`), collection `pand`, 32 tiles of 250 m.

Two API behaviours worth writing down: the bbox must be **RD**, and a WGS84 bbox
returns zero features rather than an error; and **`offset=0` returns HTTP 500**
because its offsets are 1-based, so paging must follow the server's own `next`
link rather than synthesise one.

- **2,894 of 3,025** inventory panden matched by `pand_id` — **95.7%**. The 131
  unmatched are a gap to chase, not a rounding error.
- Roof type: 2,783 `slanted`, 77 `horizontal`, 32 `multiple horizontal`
- AHN campaign: 2,106 from AHN5, 696 AHN4, 92 AHN3
- LoD2.2 geometry valid: 2,756 true / 138 false
- **93.7%** are structurally sound (valid geometry, sufficient point cloud,
  quality indicator set)
- Storeys: 1,092 four-storey, 1,067 five-storey, 216 three
- Ridge above ground: p25 12.7 m, **p50 14.9 m**, p75 17.0 m

#### The finding that should change the plan

`b3_rmse_lod22` — how well 3DBAG's own reconstruction fitted the point cloud —
has a median of **0.59 m** across the pilot. The obvious move is to threshold it
at 0.5 m and promote what passes. That keeps only **39%** of the boundary, which
would gut the pilot.

Splitting the same number shows the threshold is measuring the wrong thing:

| | count | median RMSE | within 0.5 m |
|---|---|---|---|
| pitched (`slanted`) | 2,783 | **0.60 m** | 38% |
| flat (`horizontal`) | 111 | **0.11 m** | 66% |

and it is **flat across plot width** (0.53–0.62 m from <4.5 m plots to >20 m
plots) and **flat across century** (0.57–0.62 m from pre-1800 to 1900+). The
narrow-plot and old-building hypotheses are both wrong.

So the residual tracks **roof complexity, not reconstruction failure**. A canal
roof with dormers, chimneys, a stepped gable and a ridge has real geometry that
LoD2.2 planes do not represent, and the point cloud faithfully reports the
difference. A single global RMSE gate would reject buildings *for being
interesting* — exactly backwards here.

**Consequence for M1 and the fidelity ladder:** 3DBAG LoD2.2 is a sound
foundation for footprint, wall planes, storey count and eaves height, but its
*roof and gable top* is not trustworthy for the 96% of the pilot that is
pitched. The gable — the single most identifying feature of a canal house, and
the thing the brief exists to reconstruct — has to come from façade observation,
not from massing. The promotion gate must be calibrated per roof type against
hand-verified buildings (M4's calibration corpus) before it decides anything.

---

### RECON-3 — the Rijksmonumenten register

The brief calls this the highest-value and most overlooked source. It is also
**not where anyone would look for it**, which had already blocked one session.

Dead ends, all HTTP 404: `api.pdok.nl/rce/rijksmonumenten/ogc/v1`, the same
under `v1_0`, `service.pdok.nl/rce/rijksmonumenten/wfs/v1_0`, and the PDOK atom
index. `api.pdok.nl/rce/beschermde-gebieden-cultuurhistorie/ogc/v1` exists but
serves *protected areas*, not individual monuments.

**The two endpoints that actually work:**

| what | where |
|---|---|
| geometry + monument number + category | `services.rce.geovoorziening.nl/rce/wfs`, `rce:NationalListedMonumentPoints` (also `…Polygons`, `Townscapes`, `WorldHeritage`) |
| the *redengevende omschrijving* text | `api.linkeddata.cultureelerfgoed.nl/datasets/rce/cho/services/cho/sparql`, predicate `ceo:heeftOmschrijving` on `ceo:Rijksmonument` |

Measured inside the boundary:

- **1,764** rijksmonumenten
- **1,568** carry a description (88.9%)
- **1,493** of the 1,764 monument points land inside a BAG footprint — 15% miss,
  because much register geometry is flagged `kwaliteitsindicator: globaal`
- **989 of 3,025 panden (32.7%)** carry at least one monument record

Monuments and buildings are **not one-to-one**: one canal house can carry
several records. Counting monuments and calling it building coverage would
overstate the register's reach by nearly two to one.

#### What the descriptions actually contain

The brief expects them to "frequently state the gable type, storey count, window
arrangement, cornice type, sandstone ornament and construction date". Measured
against 1,568 real descriptions, that is **half right**, and the half that
fails matters.

| feature named | share of described monuments |
|---|---|
| any gable word | 96% |
| **a specific gable type** | **70.1%** |
| — *lijstgevel* / kroonlijst | 42% |
| — *halsgevel* | 17% |
| — *klokgevel* | 7% |
| — *puntgevel* | 3% |
| — *trapgevel* | 2% |
| century date (XVII–XIX) | 36% |
| sandstone | 9% |
| *pui* / shopfront | 9% |
| *stoep* / bordes | 9% |
| dormer | 5% |
| gable stone | 4% |
| **bay count** (*Nraamsgevel*) | **3%** |
| hoisting beam | 2% |
| **storey count** | **1%** |
| sash windows | 1% |
| *kruiskozijn* | 0.3% |
| *klauwstukken* | 0.3% |

Median description length is **88 characters** — a sentence, not a paragraph.
A representative one, monument 2269:

> "Pand met zandstenen vierraamsgevel onder rechte triglyfenlijst waarin
> consoles (XVIIIc) met gebeeldhouwde deuromlijsting, waarin empire deur."

That single sentence yields dressings (sandstone), bay count (four), cornice
type (straight triglyph with consoles), date (third quarter 18th c.) and a
sculpted door surround — five fields of the parameter record, from a
conservator, with no photograph involved.

**So the register is a strong gable-type source and almost nothing else.** It
independently states a gable type for **695 of 3,025 panden — 23.0% of the
pilot** — which is a real head start on the hardest and most identifying field.
It does **not** supply bay count, storey count or window arrangement at any
useful rate; those must come from imagery. 14 descriptions name more than one
gable type and are flagged for hand review rather than resolved by first match.

Descriptions are kept as the register's original Dutch, verbatim, as provenance.

---

### RECON-4 — hand-mapped OSM semantics

Source: **OpenStreetMap via Overpass**, ODbL 1.0. Joined to BAG by the `ref:bag`
tag, which Dutch OSM carries on essentially every building — a direct key, no
spatial matching needed.

`LOD.md` makes this stage blocking rather than optional: manual OSM geometry
must be consulted *before* any fidelity tier is chosen, and an automated
reconstruction must never silently flatten a mapped tower, wing, passage or
courtyard. `LOD.md`'s own "Blocker 1" is that the existing resolver reads only
the colour-tagged subset and so never sees most manual work. This stage ingests
every building and `building:part` in the boundary instead.

- **2,907 of 3,025** buildings matched by `ref:bag` — **96.1%**
- **221 (7.6%)** carry hand-authored tags beyond the bulk import
- **9** have a mapped multi-part composition an automated rebuild would flatten

#### Most of Dutch OSM here is BAG wearing a different hat

The single most important thing to know about this source in the Netherlands:
large parts of it are a **bulk import of BAG, with heights copied from 3DBAG**.
Those tags look like independent corroboration and are nothing of the kind. A
pipeline that counts an imported `height` as a second opinion on a 3DBAG height
is agreeing with itself and calling it evidence.

So the adapter records, per building, whether the tags came from an import and
which tags a person added on top. Only that second list is evidence. Across the
pilot it is small but real:

| hand-added tag | buildings |
|---|---|
| `building:levels` | 131 |
| `roof:levels` | 110 |
| `wikidata` | 101 |
| `wikimedia_commons` | 90 |
| `roof:shape` | 67 |
| `name` | 36 |
| `wikipedia` | 16 |
| `heritage` | 7 |

`roof:shape` on 67 buildings is the most directly useful: it is an independent,
human statement about roof form for buildings whose 3DBAG roof reconstruction is
exactly the thing RECON-2 showed cannot be trusted.

#### The storey-count disagreement is a souterrain detector

The build prompt flags a `building:levels` / measured-height mismatch as a
*signal* rather than an error — on a canal house it usually means a
*souterrain*, a raised *bel-étage* or a rear annex. Measured:

- **106** buildings carry both an OSM level count and a measured 3DBAG storey count
- **71 of them disagree** — 67%
- **60 of those 71 (85%) are cases where OSM counts fewer storeys**

That asymmetry is the finding. Random noise would disagree in both directions
roughly equally. A systematic bias towards OSM counting *fewer* is what a
souterrain produces: 3DBAG measures a storey that exists in the building volume,
while a mapper counting from the pavement does not see it as one. These 60
buildings are the first concrete candidate list for `hasSouterrain` /
`hasBelEtage` — a parameter-record field that decides where the front door sits
and how the whole ground floor reads.

It is a candidate list and not an answer: the disagreement is reported, never
resolved automatically. 106 of 3,025 is also a 3.5% sample, so this establishes
the mechanism, not the rate.

### The grammar, and what it is allowed to do

`src/canalRecall/facade/grammar.ts` holds the geometric constants this project
reasons with. Every one carries the evidence beside it, because the whole risk
of a grammar is that it stops being a way of reading and becomes a source of
facts. These numbers may narrow a search, reject an implausible reading, or rank
two readings of the same image. They may never supply a value for a building
nobody looked at.

**Storey height, from independent data.** 3DBAG's storey counts divided by AHN
eaves heights, n = 2,390 — neither of which has anything to do with this
project's detector:

| p05 | p25 | p50 | p75 | p95 |
|---|---|---|---|---|
| 2.40 m | 2.76 m | **3.01 m** | 3.26 m | 3.71 m |

Eaves by storey count: 3 storeys → 9.5 m, 4 → 12.1 m, 5 → 14.9 m (medians).
Narrow plots under 5 m are 4 storeys at the median; wider ones 5.

**The Amsterdam foot, tested and rejected.** Canal-ring plots were set out in
Amsterdam feet of 28.13 cm at 18, 20, 22, 24 or 26 feet — 5.06 to 7.31 m — and
the pilot's median plot width is 5.66 m, which is 20 feet almost exactly. It is
very tempting to quantise measured widths onto that module.

The module is not there. Across 1,343 pre-1800 plots the mean distance from a
whole foot is **0.2524**, against **0.2524** for a randomised control — 0.25
being exactly what no structure looks like. The 20-foot peak is the mode of the
distribution, not evidence of quantisation. The historic module was real; it is
simply not recoverable from a BAG footprint, which is a modern survey of a
building rebuilt, merged, split and settled for four centuries, and whose
"width" here is the short side of a minimum-area rectangle rather than a plot
boundary. The constant is kept for provenance and deliberately unused.

**What the reference sheet showed.** Rectifying ten façades at 26 px/m with a
metre grid drawn over them was meant to yield proportions. What it actually
showed was that several readings at obliquity under 12° and standoff under 40 m
— filters that sound strict — were photographs of canal elms, scaffolding, a
lamp post, or a wildly mis-scaled close-up. Those pass every test on the
*camera* and none on the *building*. Hence `plausibility()`, which asks whether
a reading is a façade at all before it is kept: storey count against the
building's own height, floor-to-floor intervals against the measured range, bays
against frontage, opening area as a share of wall, and how many openings are
window-shaped. 41 readings were rejected on the last run, each with its reason.

**What changed as a result**, measured over the same 190 panoramas:

| | before | after |
|---|---|---|
| storey bands, p25/p50/p75 | 5 / 6 / 6 | 3 / 4 / 5 |
| bays, p50 | 1 | **2** |
| readings rejected as not façades | 0 | 41 |

Two bugs fell out of it. The storey ladder was scoring `mean × rung count`
capped at six, which is a *reward* for finding six rungs whatever the comment
beside it claimed — that alone put the median at exactly 6. And a tree trunk,
downpipe or lamp standard reads as a strong deviation from the wall in one
continuous vertical band from pavement to roofline, which a window never does,
so columns that stay high across 82% of the height are now discarded as
obstructions.

### The generator

`src/canalRecall/facade/generate.ts` turns a measured skeleton — plot width,
eaves, ridge, storeys — into a full plausible façade: diminishing storey
heights that sum to the measured eaves exactly, bays at a ~1.9 m pitch, windows
that shrink with their storey, a door on the ground floor, a hoisting beam, and
one of seven gable profiles drawn per type rather than smeared into a single
parameterised curve.

It exists as the *rendering vocabulary* the brief describes: it tells you how to
draw a klokgevel once you know this house has one, and it must never tell you
that this house has one. Everything it emits is stamped `provenance: 'generated'`
and an unstated gable is flagged `gableIsAssumed`. It is for the parts library
the Blender lanes need, for filling a bay the detector lost to a tree on a
building whose other bays were measured, and for spikes. It is not for the
extract: a building nobody has looked at still gets no façade.

59 checks pin it, and the ones that matter are the conservation rules — storey
heights are generated but the eaves height they sum to is a measurement, and a
rule about the parts may never move the whole.

### RECON-10 — quay crowns and water

The brief admits quays and water into an otherwise buildings-only scope for one
reason: buildings are unreadable without them. It also warns against the easy
mistake — Amsterdam is flat but not level, and "a canal that renders perfectly
horizontal across a kilometre is wrong".

Measured, and the warning is right. The buildings fronting a canal stand *on*
its quay, so 3DBAG's AHN-derived ground level for each of them samples the crown
about every five metres of frontage — a denser survey than this project could
acquire on its own. Bucketed every 45 m and taken as a median:

| canal | length | crown min / median / max (m NAP) | fall | freeboard |
|---|---|---|---|---|
| Prinsengracht | 1,755 m | 0.17 / 0.57 / 1.42 | **1.25 m** | 0.97 m |
| Herengracht | 1,575 m | 0.38 / 0.75 / 1.41 | 1.03 m | 1.15 m |
| Singel | 1,350 m | 0.37 / 0.82 / 1.63 | **1.26 m** | 1.22 m |
| Brouwersgracht | 630 m | 0.44 / 0.88 / 1.45 | 1.01 m | 1.28 m |
| Leidsegracht | 360 m | 0.62 / 0.89 / 1.23 | 0.61 m | 1.29 m |

**A canal drawn level along its length is wrong by up to 1.26 m** — more than
the freeboard itself. Per-segment crowns are in the extract and a renderer
should use them rather than any single number.

It also corrected one of mine. `NOMINAL_QUAY_CROWN_NAP_M` was 1.05 m, a
plausible figure from nothing in particular; the measured median across 126
segments is **0.73 m**. The guess was 32 cm high — a third of the freeboard, and
enough to float every building in the pilot. Water level is unchanged and still
not measured here: it is Rijkswaterstaat's target level for the Amsterdam
boezem, carried in `rdNew.ts` with its source.

### What M0 still owes

- **RECON-5** PDOK ortho roof colour across the boundary. The pipeline already
  exists (`scripts/build-roof-color-observations.ts`, `ROOF_ENRICHMENT.md`) and
  needs pointing at the boundary rather than the A10 cache.
- **RECON-10** quay, water level, bridge and *kademuur* geometry.
- **RECON-5 is running** but not yet wired into the records. Measured roof
  colour from PDOK `Actueel_orthoHR` at 12.5 cm/px across a 250-building spread:
  **17% pantile, 63% zinc, 20% slate**. Three bugs had to be found before that
  number meant anything, and all three produced confident, wrong answers:

  1. A bounded run selected `sort().slice(0, limit)` over BAG pand ids. Those are
     issued in registration order, so a lexical prefix is a block of buildings
     standing together — the run measured one street and reported it as the
     boundary.
  2. The palette's roof colours were written from imagination. `roof-pantile`
     was `#8c4a32`, a vivid dark terracotta at r−b +90 and luma 88. A roof shot
     from directly above in flat winter light is far paler: the measured warm
     cluster sits at r−b +37, luma 168. The invented value could never win the
     snap, so 1.6% of the ring came out pantile against an orthophoto showing
     whole terraces of it. The palette now carries measured medians.
  3. On a pitched roof the material was snapped from the *larger* illumination
     cluster. The shaded slope is darker and bluer because it is lit by sky
     rather than sun — a fact about the hour the plane flew, not the roof — and
     whichever slope faces away is larger about half the time. Snapping from the
     **sunlit** slope moved pantile from 2 to 42 of 250, matching the 16% warm
     cluster found independently.

  Still open: the shadow and vegetation rejectors never fire (0 of 250), and the
  rasterised footprint area runs about 2.6× the registry's own `areaM2`, which
  wants explaining before the numbers are trusted.
- **Validation of the façade detector.** `check-facade-registration.ts` is red
  at its own 0.5 m bar, and no detector output has been checked against a
  hand-labelled building. Street-level fields are therefore capped at confidence
  0.4. `calibration.ts` exists for exactly this and has never been fed a real
  `ReviewOutcome`.
- The **131 panden with no 3DBAG match**, individually.
- Reconciling the 3DBAG API's `v2023.10.08` collection against the
  `v20250903` tileset the runtime streams in `js/detailed-buildings-source.js`.
  Two vintages of one dataset; attribute names and pand sets should not be
  assumed to agree.

### What M0 has settled

- Coordinate system, datum alignment, local origin and water datum — pinned to
  1.4 mm in the pilot.
- The boundary, as geometry rather than prose, with 36 named regression
  locations and the far-bank membership rule made explicit.
- The building count: **3,025**, not ~2,000.
- That 3DBAG gives trustworthy massing but untrustworthy *gables*, with the
  evidence for why a naive RMSE gate would be wrong.
- Where the monument register lives, and that it is a 23%-coverage gable-type
  source rather than a general façade-attribute source.
- That most Dutch OSM building data here is a BAG/3DBAG import and must not be
  counted as independent corroboration — only the 7.6% carrying hand-authored
  tags is evidence, and `roof:shape` on 67 buildings is the useful part.
- A mechanism for detecting *souterrains*: OSM counts fewer storeys than the
  measured massing in 60 of 71 disagreements, an asymmetry noise would not
  produce.
- That the pipeline is not Amsterdam-shaped, proved by running it over a second
  city through identical code.


## 3. The clean rebuild plan

*Was `public/canal-drive/FACADE_REBUILD_PLAN.md`.*

Status: proposed for review. No rebuild worktree has been created and no
implementation in this plan has started.

### Decision

Start a new worktree and branch from current `main`, not from
`feat/amsterdam-building-twin`:

```text
worktree  .worktrees/amsterdam-facade-rebuild
branch    feat/amsterdam-facade-rebuild
base      main (737990d when this plan was written)
```

The existing feature branch is useful as a source library and incident record,
not as the rebuild's base. It is 23 branch commits ahead of its merge base and
144 mainline commits behind current `main`; its valid and invalid work are
interleaved, and its worktree currently contains unrelated uncommitted changes.

Do not cherry-pick the 23 façade commits wholesale. Import an audited component
only when the phase that needs it begins, with its tests and provenance in the
same commit.

### Why the rebuild is necessary

The failure in the review screenshot is reproducible:

- BAG pand `0363100012164989`, Herengracht 270, was measured from panorama
  `TMX7316010203-001543_pano_0000_003628`.
- The recorded view is 38.6 m from the wall and 3.3 degrees off square.
- The current `centre` yaw convention samples the foreground building on the
  camera's side instead of the target across the canal.
- The `edge` convention samples the intended Herengracht 270 façade.
- `rectify.ts` defaults to `centre`, while `rectify-facades.ts` contains a
  nearby comment saying that `centre` points 180 degrees away.
- The boundary runner does not pass an explicit camera convention, so its
  output inherits the unsafe default.

The existing registration check cannot arbitrate this. It fails under both
conventions and treats redundant collinear BAG footprint vertices as visual
party walls before correlating them against noisy roofline steps. It is also
not part of `check:canal`, so city-scale extraction continued while the check
was red.

Therefore every current street-level-derived result is invalid until
recomputed through a proven camera model. This includes opening rectangles,
storey/bay readings, wall colours, façade material assignments, photographic
textures, review samples, evidence strips, and façade sections in renderer
extracts. Aggregate agreement with citywide medians does not establish
per-building identity.

### Scope and invariants

This rebuild covers the evidence path:

```text
BAG address and pand
  -> canonical footprint elevation
  -> suitable panorama and camera model
  -> source-image façade quadrilateral
  -> rectified metric elevation
  -> opening/material measurements
  -> reviewed per-pand evidence
  -> renderer extract
```

The following invariants are non-negotiable:

1. BAG `pand_id` is canonical. OSM may corroborate hand-authored semantics but
   is not the parcel or address authority.
2. Building identity, elevation selection, projection, rectification, and
   feature detection are separate stages with separate tests.
3. A detector or vision model cannot certify that a crop belongs to the
   requested pand.
4. An ambiguous elevation or crop is rejected. It is never repaired by a
   plausible façade grammar.
5. A building with no certified street observation renders as massing only.
6. No derived artifact survives a change to any upstream source, camera model,
   rectifier, or elevation definition without an explicit cache-key match.
7. Street imagery stays in ignored local review/cache directories unless its
   license and the project's distribution policy explicitly permit publishing
   it.
8. No full-boundary measurement run occurs before the gold registration set
   passes.

### Import and quarantine matrix

#### Import early after re-verification

- Survey-area declarations and boundary geometry.
- RD New/WGS84 conversion and its authoritative control-point fixtures.
- BAG footprint adapter and cached raw BAG responses.
- 3DBAG massing adapter and cached raw massing responses.
- Panorama metadata adapter and cached original panorama files.
- Evidence, house-record, and calibration data types and their unit tests.
- Rijksmonumenten and OSM source adapters, with BAG remaining canonical.

Existing checks currently give useful starting evidence: 54 coordinate checks,
44 boundary checks, the façade-record checks, build-record checks, and
calibration-math checks pass. These checks will be rerun on the new branch; a
pass here does not imply that street-image registration passes.

#### Import only when a valid consumer exists

- Parameterised gable and façade geometry.
- Blender gable library.
- Runtime façade layer and evidence inspector interaction patterns.
- Quay/water work, because it is independent of street-level extraction but is
  not needed to prove registration.
- Roof-colour work after its separate footprint-area and rejection issues are
  resolved.

#### Quarantine; never import as evidence

- `measured-facades.json` and every derived façade/evidence extract.
- Current façade review images and labels.
- Current photographic façade textures and material manifest.
- Current detector accuracy, coverage, and material-distribution claims.
- Current registration offsets and party-wall correlation results.
- Resumable caches keyed only by `pand_id`.

The handcrafted detector remains a candidate baseline. It is not imported as a
trusted extractor until it has been run against correctly registered crops.

### Proposed architecture

Keep the stages explicit in code and data rather than sharing one mutable
`MeasuredFacade` structure across the pipeline.

```text
BuildingIdentity
  pandId, BAG addresses/VBOs, footprint, source versions

Elevation
  stable elevationId, ordered endpoints, outward normal, source vertex range

ElevationCandidate
  evidence for street/canal adjacency, address side, visibility, ambiguity

PanoramaCameraModel
  source id, mission/schema version, yaw origin, heading/pitch/roll convention

RegisteredObservation
  pandId, elevationId, panoramaId, pose, projected source quad,
  anchor residuals, registration verdict, derivation key

RectifiedObservation
  metric extent, pixels per metre, missing/occluded fractions,
  registration reference, derivation key

FacadeDetection
  masks/boxes, classes, confidences, metric coordinates, model/version

ReviewedFacadeEvidence
  accepted/rejected fields, reviewer/model provenance, calibration result
```

The panorama adapter must provide a camera model explicitly. `rectifyFacade`
must not have a default yaw convention.

### Phase 0 — create the clean lane and establish a baseline

1. Create the new worktree and branch from current `main`.
2. Record the exact base SHA and run the relevant baseline checks.
3. Add an invalidation note preventing current street-derived artifacts from
   being interpreted as evidence.
4. Copy or hard-link only allowlisted raw caches into a new ignored raw-cache
   namespace, preserving source URLs, retrieval dates, byte hashes, and
   licenses:
   - BAG registry JSON;
   - 3DBAG massing JSON;
   - heritage and OSM source JSON;
   - panorama metadata JSON;
   - original panorama JPEGs.
5. Do not copy rectified strips, measurements, material textures, review data,
   or renderer extracts.

Gate: the new worktree builds and its pre-existing tests are green before any
façade code changes.

### Phase 1 — canonical identity and elevation records

1. Add a BAG address/VBO adapter and materialise address-to-pand relationships.
   Preserve all addresses for multi-address panden instead of choosing one.
2. Normalise footprint rings and create stable elevation IDs. Merge collinear
   survey vertices into a single elevation while retaining the original vertex
   range for traceability.
3. Separate candidate generation from elevation selection. Minimum-rectangle
   plot width may nominate candidates but cannot identify the front by itself.
4. Score candidates using independent evidence:
   - BAG address/public-space association;
   - adjacency to the addressed street, quay, or canal;
   - panorama trajectory and visibility;
   - footprint occlusion;
   - OSM street geometry as corroboration only.
5. Represent corner buildings and buildings with multiple public fronts as
   multiple elevations. Do not force one building-wide `front`.

Deliverables:

- typed identity/elevation modules;
- an address/pand inspection report;
- unit tests for ring orientation, collinear merging, normals, stable IDs, and
  multi-front buildings.

Gate: every building in the gold set resolves to the human-selected pand and
elevation; ambiguous cases return `ambiguous`, not a guessed wall.

### Phase 2 — registration gold set and review tool

Create an initial gold set of approximately 16 buildings, expanding to 30
before detector evaluation. It must include:

- Herengracht 270, the reproduced 180-degree regression;
- Prinsengracht 263;
- Huis met de Hoofden;
- Huis Bartolotti;
- Felix Meritis;
- typical narrow canal houses on both banks;
- north-, east-, south-, and west-facing elevations;
- a corner building;
- an irregular/L-shaped footprint;
- a wide or double house;
- a building with several BAG addresses;
- a partially occluded façade.

For each fixture, record only redistributable structured facts:

- address set and `pand_id`;
- elevation ID and exact RD endpoints;
- panorama ID, capture date, mission, and pose;
- manually clicked source-pixel anchors for left/right wall limits, ground,
  eaves, and distinctive roofline points;
- an identity verdict and reviewer note.

Build a local, ignored-image review page showing:

- full panorama context;
- BAG footprint and selected elevation inset;
- projected façade quadrilateral;
- address, pand, camera, and source metadata;
- a rectified preview;
- controls to correct anchors and reject ambiguity.

Do not show detector boxes during registration review.

Gate: two review passes agree on pand and elevation for every gold fixture.

### Phase 3 — camera model and rectifier

1. Make world-to-camera and camera-to-equirectangular projection pure exported
   functions.
2. Add synthetic cardinal panoramas that independently pin north/east/south/
   west, horizontal wrap, elevation, pitch, and roll.
3. Move yaw origin and orientation conventions into the Amsterdam panorama
   adapter. Allow mission-specific camera models if the gold data demonstrates
   that missions differ.
4. Remove all `centre`/`edge` defaults from generic rectification APIs.
5. Compare predicted source pixels directly with the gold anchors. Do not infer
   registration from whether the resulting image resembles a façade.
6. Render context outside the target wall during diagnostics so a one-building
   lateral shift cannot hide at the crop boundary.
7. Validate horizontal and vertical scale independently.

Initial acceptance targets:

- 100% of gold observations point toward the correct pand and elevation;
- median anchor residual at most 0.25 m in the wall plane;
- 95th-percentile anchor residual at most 0.50 m;
- no unexplained mission-specific 180-degree or sign errors;
- deterministic output hashes for a fixed source image and configuration.

Any identity mismatch fails the gate regardless of aggregate residuals.

### Phase 4 — view selection and registration gate

1. Rank only views whose geometry can contain the complete target elevation.
2. Measure resolution at the wall, not merely panorama dimensions or camera
   standoff.
3. Calculate occlusion and truncation independently from image aesthetics.
4. Retain several candidate views per elevation; use cross-view agreement as a
   quality signal after each view passes registration.
5. Replace the current party-wall/skyline proxy with direct gold-anchor tests
   and conservative runtime checks on projected wall limits.
6. Add a mandatory registration command to `check:canal`.
7. Make every measurement command refuse to operate on observations without a
   passing registration verdict and matching derivation key.

Every artifact key must include hashes or versions for:

- footprint/elevation;
- panorama bytes and metadata;
- camera model;
- rectifier implementation/configuration;
- measurement or detector model;
- source schema versions.

Gate: a stratified 50-building set contains no wrong-pand or wrong-elevation
crop. Ambiguous and obstructed observations are rejected and reported.

### Phase 5 — opening detector benchmark

Only correctly registered crops enter this phase.

#### Candidate systems

Benchmark, rather than assume:

1. the existing handcrafted detector;
2. at least two licensed Roboflow/YOLO object-detection models;
3. at least two licensed window instance-segmentation models;
4. a small ensemble that uses geometry only as a consistency check.

Instance segmentation is preferred for the production measurement path because
masks can represent arches, clipped openings, and non-rectangular shopfronts.
Boxes remain a useful fast baseline.

Before downloading or training from any Universe project, record:

- dataset URL and owner;
- explicit license (no license means do not use it);
- image count and class definitions;
- annotation type and visible annotation quality;
- train/validation/test split method;
- model architecture/version and whether weights are downloadable;
- preprocessing that may distort façade proportions.

The initial external candidates include the CC BY 4.0, 4,785-image Doors and
Windows dataset and the larger window/door and instance-segmentation projects
identified during reconnaissance. Their published metrics are leads, not
acceptance evidence.

#### Amsterdam labels and fine-tuning

Create a private/local Amsterdam dataset from certified rectified observations.
Begin with 100–200 corrected crops and these labels:

- window;
- door;
- shopfront;
- souterrain window;
- façade boundary;
- occlusion/unknown.

Split by pand, street/block, and panorama mission. Never place different views
of the same pand in both train and validation/test sets.

Use active learning:

1. run external candidates;
2. label disagreements and uncertain cases first;
3. fine-tune a compact segmentation model locally;
4. repeat against a held-out block-level test set.

Report both computer-vision and building-domain metrics:

- precision/recall and box/mask AP per class;
- mask IoU;
- exact opening-count accuracy per façade;
- centroid and boundary errors in metres;
- false openings per square metre;
- performance by resolution, obliquity, occlusion, material, and storey;
- cross-view consistency for the same elevation.

No metric may be calculated on crops that fail registration.

Gate: choose the production detector from held-out Amsterdam results, not the
model's original dataset score. Fields that do not meet their calibrated bar
remain unobserved/defaulted.

### Phase 6 — paid multimodal-model verification

Use paid vision-language models as independent critics and triage systems, not
as geometric ground truth.

Provider requirements:

- image input under terms compatible with the Amsterdam panorama license;
- an API mode with acceptable retention/training controls;
- pinned model identifier/version where available;
- structured JSON output and an explicit `uncertain` outcome;
- stored prompt, image hash, response, timestamp, and cost metadata.

Use a blind two-pass protocol:

1. **Clean crop pass:** determine whether one façade dominates, whether it is
   straight enough, count visible openings, and list obstruction/truncation.
2. **Overlay critique pass:** inspect detector masks and explain false positives,
   misses, class errors, or boundary errors.

Do not show model B the answer from model A. Use a second independent paid model
for disagreements and a human for unresolved cases.

Audit policy:

- 100% of registration gold fixtures;
- 100% of the first 50- and 200-building rollout samples;
- every detector/geometry/model disagreement;
- every low-confidence or ambiguous observation;
- a random sample of accepted observations;
- a deliberate sample of the highest-confidence observations, where hidden
  overconfidence is most dangerous.

Calibrate each model's judgements against human labels. A paid model's agreement
does not lift confidence until its field-level accuracy is known.

### Phase 7 — staged rollout

Roll out in increasing, reviewable batches:

```text
gold fixtures -> 50 stratified buildings -> 200 buildings -> one canal block
-> full pilot boundary
```

At each stage produce:

- registration coverage and rejection reasons;
- per-field detector metrics;
- paid-model and human disagreement report;
- per-pand evidence dossiers;
- a contact sheet of clean crops and overlays;
- data and renderer diffs from the preceding stage.

Do not count a rejected observation as a detector failure or silently replace
it with generated façade details. It remains massing-only.

### Phase 8 — renderer and façade vocabulary

Only after the 200-building evidence gate passes:

1. import or reimplement the façade renderer against the new versioned records;
2. import the gable/parts library with its independent geometry tests;
3. render measured masks/boxes as architectural openings;
4. retain heritage-stated features with distinct provenance;
5. retain massing-only fallback for every uncertified elevation;
6. regenerate materials and textures solely from certified observations;
7. verify the real Canal Recall runtime at named viewpoints.

The evidence inspector should show, for every rendered feature:

- address and pand;
- selected elevation and footprint;
- panorama context and projected quad;
- clean rectified crop;
- detector masks and confidence;
- paid-model/human review history;
- exact source and derivation versions.

### Tests and continuous gates

Add focused commands before folding them into `check:canal`:

```text
test:facade-identity
test:facade-elevations
test:facade-camera-model
test:facade-rectification
test:facade-registration
test:facade-lineage
test:facade-detector-benchmark
test:facade-evidence-integrity
```

The integration gate must fail when:

- a camera convention is implicit;
- a gold anchor exceeds tolerance;
- an observation points at another pand/elevation;
- a derived artifact has a stale lineage key;
- a rendered opening lacks accepted evidence for that exact pand/elevation;
- a model/dataset lacks recorded licensing and version information;
- review imagery is accidentally staged for publication.

### Planned commit sequence

Keep commits small and independently reviewable:

1. establish clean worktree baseline and invalidation record;
2. add BAG address identity and canonical elevation schema;
3. add gold registration fixtures and ignored-image review tool;
4. replace camera model and add synthetic/real anchor tests;
5. implement conservative multi-elevation frontage resolution;
6. add registration gate and derivation-keyed artifacts;
7. add detector benchmark and dataset/license manifests;
8. add Amsterdam labels and fine-tuned segmentation experiment;
9. add paid-model audit harness and calibration report;
10. pass the 50-building review gate;
11. pass the 200-building review gate;
12. import the renderer/vocabulary against certified records;
13. run the pilot boundary and publish the final QA report.

Each commit updates the relevant state/history document and includes generated
browser bundles only when it changes runtime code.

### First implementation checkpoint

After approval of this plan, stop after phases 0–2 and return for review with:

- the clean worktree and branch;
- baseline test results;
- the import/quarantine manifest with hashes;
- the BAG address/elevation data model;
- the proposed gold-building list;
- the registration review page populated with Herengracht 270 and several
  contrasting fixtures.

Do not change the camera convention or run a detector at that checkpoint. The
review should first confirm that the new pipeline is asking the right identity
and elevation questions.
