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

Everything else is reconstructed the same way as the heroes — from its own
observations — but through the automated measurement pipeline rather than by
hand. That is the point of the pilot: the hero buildings prove the ceiling, the
ordinary terraces prove that per-building fidelity survives automation.

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


### Per-building reconstruction

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

#### The parameter record is per building, and cheap

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

#### The evidence ledger

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

#### No jitter, and no invented façades

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

#### Observation tiers

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

#### Measuring a façade

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

#### Assembly

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

### Fidelity ladder

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

### Gate: what must be true before expansion begins

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
a fabric with its own vocabulary; the cost of a tier is the cost of learning
that vocabulary and teaching the extractor to read it, plus a small marginal
measurement cost per building.

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
per building and very high instancing efficiency at the *part* level — window
grids, balcony rows, panel bays. The estate-scale repetition is real, but it is
still confirmed per building rather than assumed: postwar blocks are heavily
renovated, and cladding, glazing and balcony infill now differ block to block.
3DBAG LoD2.2 already carries most of the silhouette;
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

### The measurement pipeline at city scale

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
