# Da Costa 550 m expansion demo — 10 September 2026

Open the [825-building 3D expansion](./city-appearance.html?area=expansion), then the
[source evidence gallery](./panorama-audit.html). The first view proves the reusable geometry,
tiling and runtime foundation; the second makes every new inference inspectable beside its exact
inputs.

The demo is an immutable, content-hashed release with gzip-compressed z16 building and context
tiles. Building residency is capped at 12 tiles and context at 16. The current initial view uses
12 building tiles and seven context tiles. The scene records roughly 109–111 draw calls in the
current desktop/mobile headless checks, below the provisional 250-draw ceiling. It contains 825 BAG/3DBAG buildings, BGT streets, canals
and terrain, and 469 in-bound inventory trees. The finer grid replaces the legacy release that concentrated
all 422 owners in a single z14 tile.

Both transport-byte and decoded-content SHA-256 values now accompany the foundational building and
context tiles. The viewer accepts only one of those exact hashes, accommodating hosts that either
serve raw gzip bytes or transparently decode `Content-Encoding: gzip`; it no longer mistakes valid
decoded delivery for release corruption.

A deterministic construction-era palette gives all 825 buildings legible brick/plaster and roof
variation without claiming observed colour. Twenty routed source walls can override that prior in
the explicitly quarantined machine-preview mode. The alternative coverage mode uses green for
usable evidence and ochre for partial evidence. Street labels are derived from building inventory,
collision-managed in screen space, and can be hidden. “Test me” turns them into a recall exercise:
it withholds a target name, keeps prompting after a wrong building, and clears only after a click
whose source street assignment matches. Close LOD gives exterior-wall window priors a surround,
glazing, transom and shallow sill; more than 1,200 windows and 42 one-per-building entrance priors were visible
in the current deterministic browser views. A stable source-building hash selects one of three
restrained glass tones, while construction era selects light or dark trim; the result never changes
between runs. These remain explicitly procedural and carry no
observation IDs. Soft
directional tree shadows improve block and canal depth without repeating all building geometry in
the shadow pass. Headless software-WebGL frame intervals remain slow at this expanded
scale and are diagnostic only;
they do not satisfy the outstanding physical desktop/phone performance gate.

Evidence-bound frontage framing now temporarily suppresses inventory-tree meshes so a nearby crown
cannot cover the wall under review. Returning to a neighborhood, canal, shop, route, or manual view
restores those trees. The browser regression verifies positive tree visibility before framing, zero
during focus, restoration afterward, and no review writes.
The selected source building also receives one reversible amber runtime shell while its inspector is
open. The shell is non-pickable, excluded from source statistics, carries no evidence identity, and is
disposed on deselection or tile eviction, so review orientation is clearer without changing the release.

The browser now samples sustained frame intervals and applies a one-way quality governor: first
reduce pixel density in bounded steps (never below 0.75), then disable shadows if the device is
still slow. In the deliberately slow software-WebGL check this made three adjustments and improved
median intervals to roughly 175 ms desktop / 142 ms mobile without dropping source geometry,
facade rhythm, route playback or tile caps. Capable hardware retains full pixel density and shadows.

Map Recall's existing Amsterdam street extract is now compiled at publication time into a compact
790.93 m cross-area route: 54 graph points, six named streets and 528 clipped source segments. The
14.4 MB city network stays build-time only; the immutable context carries the route points and its
source hash. Nine contiguous source-derived teaching legs attach the current street name to the
full route; genuinely unnamed connector edges remain unnamed. The tour HUD updates at each street
transition. A restrained 0.8 m route ribbon remains legible in the neighbourhood view without
painting a lane across the driver-height view; pause/resume street-level playback drives the same camera that
updates both tile streams. Browser checks prove playback advances, manual views regain camera
control, and route movement stays within building/context residency caps. Camera heading uses a
12 m path look-ahead with an end-of-route fallback; all 54 graph vertices are tested for finite,
non-degenerate camera framing on desktop and mobile. A five-position full
corridor traversal (0/25/50/75/99%) records no tile failures and at most 107 live GPU geometries,
with resources falling again after the densest starting view rather than accumulating along the
route.

Source water polygons use a distinct physical material with low roughness and clearcoat, while
paving, cycleways and green space retain matte materials. This improves canal/ground separation
under the same scene lighting without changing source classification, fabricating reflections, or
adding an inferred data field.
All 15 streamed BGT bridge components retain their exact horizontal source footprint. The game adds
only vertical perimeter faces from 0.55 m below the road plane to just beneath it; it adds no deck
triangles, so basemap lanes remain authoritative. Live browser telemetry proves the release instantiates
them; bridge depth remains presentation metadata, not a measured claim.

Twenty usable audited walls were converted into 40 immutable compact inputs. A resumable,
atomic-journaled routing run returned 20/20 schema-valid suggestions for $0.014493105. The gallery
shows these as quarantined machine routes. No suggestion is copied into published appearance and
no human review is synthesized. Four partial walls were withheld from inference.

The current immutable release is `9e40bcce…`, built from cached run `16288822…`: 156 source files
feed four restartable stages, producing 825
buildings, 968 candidate frontages and 3,166 context owners without imagery or paid inference.
The inner 400 m audit remains a separately hashed evidence area, so the wider geometry cannot
pretend to inherit coverage it does not have.

The release now also carries a hash-verified MapLibre appearance sidecar for the same 825 canonical
BAG identities. Canal Recall's existing complete-city streamer decorates matching resident features
with the shared wall/roof prior only after the sidecar release ID, source-block hash and SHA-256 pass.
Missing, stale, malformed or corrupt sidecars leave the neutral city unchanged, as do buildings
outside this study. A main-game capture loaded 801 styled matches inside a 46,057-feature working set;
desktop and iPhone complete-city tests exercise this path. “Da Costa study” is now a first-class route
choice in the real setup screen: it reads its Hugo de Grootkade and Rozengracht endpoints from the
same verified release rather than duplicating coordinates in UI code, selects a pitched 3D chase
presentation at 80% street-reading zoom,
and starts inside the styled area. Styled buildings now split an era-sensitive, darker street storey
from the upper wall, avoiding the previous uninterrupted colored-box appearance while remaining an
explicit procedural prior. The complete-city streamer is now attached immediately after the colour
sidecar verifies, before optional roofs/facades/trees/water initialize; this removes the startup window
where decorative context could appear over the obsolete neutral static-building source.

The same complete-city streamer now gives otherwise-uncolored BAG masses a city-scale identity palette
at runtime. The precedence is strict: a verified area prior wins, then existing OSM appearance, then
the explicit unmeasured runtime fallbacks; non-BAG features remain unchanged. Walls use
`citywide-identity-palette-v2-not-measured`. The same unknown-wall branch adds a darker 3.2 m display
base labelled `citywide-ground-storey-palette-v1-not-measured`; it is never applied when OSM or an area
release supplies appearance. Flat or unspecified caps independently use
`citywide-flat-cap-palette-v2-not-measured`; known pitched shapes never receive an invented cap color.
These stable restrained tones guess no era, material or roof shape and add zero tile or
sidecar bytes. A live 13-tile checkpoint decorated 52,241 walls and 47,099 caps among 54,295 resident
buildings while retaining all 801 richer study matches. Tests require majority coverage and prove the cached source
features are never mutated.

Da Costa is now the first entry in a validated city appearance-area catalog rather than a pointer
hardcoded separately into the building renderer and route setup. The catalog can add independently
published, non-overlapping districts; each release retains its own area/content verification, and a
failed district is withheld without suppressing valid neighbors. Duplicate BAG ownership fails closed
until the pipeline defines an explicit overlap policy. Each verified entry now gets independently
namespaced roof, facade, tree and public-realm renderers, with artifact failure isolated by district and
layer. All four optional detail classes now evict off-camera resources, including source roofs.

The game also streams source-bound facade detail from four independently hashed z16 artifacts. They
contain 17,668 deterministic window priors, 672 entrance priors and 3,638 restrained facade
datum/top bands and layered entrances (180,764 triangles, 1.70 MB gzip)
derived against exact LoD2.2 wall surfaces. Coordinates are quantized to millimetres for compact,
stable transport and moved 0.18 m outward along the building footprint normal so the glazing and
frames remain visible over the LoD1 gameplay mass without fabricating a changed footprint. Residency
is capped at 12 tiles, fetch concurrency at two, corrupt content is rejected after hashing, and every
eviction disposes its GPU geometry and materials. The procedural openings are explicitly unobserved:
they do not inherit the 24-wall evidence audit and cannot pass the human-confirmation gate by being
rendered. Historic (pre-1965) display priors now add a deterministic central sash mullion, a glazed
entrance transom and rail, and place
the glass behind the surround rather than slightly in front of it. Modern priors retain the simpler
unmullioned opening; every contextual entrance receives a shallow threshold. Transom glazing reuses
the building's existing glass batch rather than adding a draw/material family per tile. This improves close-range depth and Amsterdam-era legibility without claiming a
measured opening layout.

Roof geometry is no longer universally reduced to a raised flat cap. Four independently hashed z16 owner tiles
transfer 1,717 exact LoD2.2 roof polygons for 645 source buildings. The per-source-surface v2 gate
admits coherent main roofs even when a low annex would fail the old whole-building test, while retaining
the same eave, ridge and slope bounds. Of 726 slanted candidates, 81 remain explicitly withheld rather
than flattened or guessed. The renderer
loads nearest tiles with concurrency two, retains no more than 12, verifies both compressed and decoded
content hashes, and disposes GPU geometry below the local-detail zoom threshold. The complete current
district occupies only four roof tiles and 110 KB compressed.
The selection policy is now a shared compiler with adversarial component fixtures and a deterministic
real-area test, and its source hash participates in the immutable release ID.

The integrated game checkpoint loaded nine city tiles with 45,022 buildings, 801 verified colour
matches, all four facade tiles, and all 144,032 facade triangles. Desktop and iPhone route/integration
tests pass, and the publication verifier recomputes both compressed and decompressed SHA-256 values
for every facade tile. The visual checkpoint confirms the openings are no longer depth-occluded; the
normal study start also confirms coloured building masses and source roofs coexist with them. A close
gameplay checkpoint confirms the source-contained bands break up long slab silhouettes without crossing
party walls or replacing the observed-appearance review gate.

Map Recall now receives the same municipal tree inventory through a dedicated four-tile z16
stream. All 469 positions and height-class proxies occupy just 10.6 KB gzip and render in at most
four instanced meshes per resident tile (trunk plus three crown tones), rather than one draw per
tree. The shared `inventory-crown-priors/v1` typology remains explicit: crown width, shape,
clearance and summer foliage are authored priors, while inventory placement and height lineage are
preserved. The game checkpoint loads four tree tiles as 16 meshes alongside the building, roof and
facade layers; corruption, stale release binding and malformed heights fail independently without
removing the underlying city.

Public realm is now integrated through a compact source-bound stream. Seven z16 tiles carry 19 BGT
water features, 15 bridge components, 92 green-space polygons, 348 footpaths, 112 cycleways and 35
classified quay-wall/bank-protection lines in 91.2 KB gzip.
Water receives a restrained 38%-opacity blue physical glaze so the exact study geometry blends into
MapLibre's `rgb(158,189,255)` canal at its boundary instead of becoming a dark patch.
Bridge plan geometry remains packaged and verified, while the game deliberately withholds a second
road-top surface: close review showed it obscured road markings above the basemap or z-fought them
below it. The `water-greenery-active-mobility-quay-v5-bridge-understructure` policy instead derives
source-aligned vertical understructure faces with an explicitly illustrative 0.55 m depth. An explicit 8 cm display
tolerance reduces 191,111 source vertices to 11,795 while the original context hash remains bound;
indexed buffers then keep the full resident public realm to about 329 KB. The 0.55 m boundary height
is explicitly an illustrative display prior; only its plan alignment and class come from BGT. The runtime rejects stale
releases, corrupt compressed or decoded bytes, unsupported layers and malformed polygons independently.
The simplifier is a shared compiler component with direct tests for its error bound, ring closure,
holes, multipolygons, input immutability and invalid-coordinate handling rather than publisher-local code.
The browser also reconciles every tile's decoded vertex count with its tile metadata and the summed
index totals before allocating GPU buffers, so a valid hash cannot mask a malformed count contract.

Gameplay detail now has explicit scale gates. Facade tiles become resident from zoom 16.5, but their
screen-scale LOD withholds all drawing below 18.25, shows only recessed opening silhouettes at 58%
opacity from 18.25, and restores frames, mullions, sills, doors and trim at 19.35. This keeps route-scale
massing legible without distant joinery confetti or camera-threshold refetch churn. Inventory crowns
render from 15.5 and local physical water and roofs from 15.25. At zoom 14 all four local layers
dispose their resources and stop painting, leaving the coherent full-city basemap rather than window speckle,
oversized crowns or a visible edge around the bounded water study. Desktop and iPhone integration
checks exercise both the close-study and overview decisions. Dropping below those thresholds—or
switching to a mutually exclusive detailed/Google layer—now aborts pending work and disposes every
resident facade, crown and water buffer rather than retaining invisible GPU memory. The overview
browser check requires both zero resident tiles and zero detail bytes, then returns to zoom 17 and
requires all four streams to rehydrate within their original tile and decoded-buffer ceilings. This catches
both retention leaks and abort/concurrency state that would otherwise strand detail after an overview.

The real Map Recall route is now sampled by cumulative path distance at 0/25/50/75/100% in both desktop and iPhone
browser runs. Every checkpoint drains its fetch queues, retains more than 500 city buildings and
verified appearance matches, and stays within 12 city/roof/facade/tree/public-realm tiles. Custom-layer
decoded buffer telemetry is part of the runtime contract: the current full study uses about 7.64 MB
for facades, 218 KB for instanced trees, 329 KB for public realm and about 500 KB for the four resident source-roof
tiles. Tree trunks now use an explicitly versioned `tapered-z-cylinder-v2` presentation primitive:
the cylinder is rotated onto the game world's vertical Z axis before instancing, correcting the prior
radially stretched blade geometry while retaining inventory height and position. Enforced ceilings are
1 MB / 8 MB / 300 KB / 1.5 MB respectively and 11 MB combined for the four
streamed detail layers. Current route traversal peaks at 9.42 MB. This counts every typed geometry attribute, generated normal, index and
instance matrix—not just vertex positions. It excludes opaque MapLibre internals and total browser
process memory, so it remains a bounded component metric rather than a physical-device claim.
Flat surrounds, mullions, trim, sills, thresholds and door leaves use stable unlit materials and therefore carry no redundant
normal buffer; window, shop and transom glazing retain normals and lit material response. This preserves all 180,764 facade
triangles while saving roughly 5.10 MB of resident typed arrays.

Measured MapLibre masses now use a typed, map-anchored directional-light preset. Clean mode uses a
warm-neutral sun (`#fff7ea`, intensity 0.5) that separates perpendicular canal facades without
altering their contextual palette; 8-bit, 16-bit, PSX and cyberpunk modes receive distinct restrained
light tones through the same tested presentation function. The light is a renderer decision and
adds no appearance evidence.

Area identity is now part of every runtime trust boundary. The appearance sidecar, source-roof
artifact, facade index, tree index and public-realm index all declare
`da-costa-expansion-550m-v1` and must match the immutable pointer before rendering. Generic
`city-appearance-*` custom-layer IDs replace the original Da Costa-specific names, so the same
publisher/runtime seam can serve later areas without colliding while cross-area artifact swaps fail
closed.

This is designed as a city pipeline, not a one-off scene: versioned area configuration feeds
restartable acquisition, compilation, inventory, building-tile and context-tile jobs; stable owner
tiles avoid duplicate geometry; source hashes bind evidence and releases; loaders enforce bounded
concurrency/residency and explicit disposal; appearance promotion remains a separate calibrated
gate. The next genuine scale risks are representative human calibration, physical-phone profiling,
route-scale memory measurement and a source-rights decision for photographic redistribution.
