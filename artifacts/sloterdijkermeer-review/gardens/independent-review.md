# Independent garden review — 2026-10-05

Decision: **accepted for bounded approximate planting around the 376 mapped small houses in Sloterdijkermeer and Nut & Genoegen**. This does not establish surveyed plot boundaries, complete park coverage, or transfer to other parks.

The reviewer inspected the source map, generator/source constraints, runtime picking and LOD ownership code, all eight refreshed desktop/touch game captures in `game/`, and `demo/interactive-demo.png`. Planting replaces barren ground while retaining readable house facades, path rows, ditches, railway-edge transitions, and central communal lawns. Both fixed heldouts pass this scope; no observed placement contradiction remains.

An independent geometry check of all 3,855 four-metre squares against cached building polygons and closed building LineStrings found zero building overlaps and zero outside-park corners. Source clearance uses a bounding circle against mapped paths, roads, water banks, ditches and walls. Nearest-house ownership is a placement constraint rather than cadastral evidence.

**Failure preserved:** the first implementation excluded gardens from render ranges, leaving coarse and near-detail gardens simultaneously visible. Evidence remains in `failed-ownership/`. Separate `allotment-garden:<houseId>` ranges now join the existing detail-ownership system. Garden hits have no matching real source feature and are skipped by building picking. The rebuilt `game/report.json` records zero incorrect ownership flags in all eight views, including coarse-only touch-wide coverage and near/coarse transitions.

The refreshed actual-game report has zero browser errors and a stationary rider in every view. Median frame intervals are 16.7 ms throughout. Same-version full-scene GPU medians with houses and gardens are 2.30/2.18 ms on desktop and 2.52/2.54 ms under touch emulation, versus 1.92/2.18 ms without them. Timing variation, especially touch repeat p95, prevents an exact marginal-cost claim; the evidence shows no median frame regression in the reviewed environment.

Remaining limits: visible square planting grids; four conservatively empty mapped-house gardens; unmapped houses/plots remain outside this restoration; planting species, beds, boundaries and architectural details are approximate. Touch evidence is headless Chrome emulation, not a physical-phone benchmark.
