# Two reviewed erf exceptions for the BGT plazas (lane erf-exceptions-20261110)

Integrator ruling 2026-11-10: BGT `erf` is not admitted city-wide (private gardens, school yards). The two player reports
that the plazas lane left blocked, 637f346b and 4f47f105, become named, reviewed exceptions.

## What opened

`ERF_EXCEPTIONS` in `src/canalRecall/routing/bgtPlazas.ts` is a closed list of BGT lokaal_ids, each with a feedback id and a
reason. Geometry is in `scripts/routing/bgt-erf-exceptions.json` (`fetch-bgt-erf-exceptions.ts`, PDOK OGC, 2026-11-10; the
cell archives keep no erf). The build adds each as a plaza source that skips the 8 m opening (the reviewed polygon is the
area) and keeps every other cut: BGT walls and fences, holes for pands, a corridor that reaches it, 40 m² of paving, 20 m²
newly opened. Features carry `exception: <feedback id>`.

| feedback | polygon | orthophoto | opened |
|---|---|---|---|
| 637f346b ASC SDW forecourt, Heathrowstraat | G0363.c73ba53f... (2,875 m², 9 holes) | open paved forecourt, zebra markings, a parked car, no fence. The south-west corner lies on the club building's roof terrace and is cut out (`exclude` box) | 2 pieces, 2,206 m² paving, 1,062 m² newly rideable |
| 4f47f105 Radarweg office apron, Barajasweg | G0363.9ad22f40... (367 m²) | paved apron with a zebra crossing joining the car park; its west leg was already corridor, so the gain is the dead end of the service road | 1 piece, 365 m² paving, 91 m² newly rideable |

Neither spot is fenced or private on the photo. The Radarweg inner courtyard (gravel and planting, other erf polygons) is
not in the list and stays blocked.

## Build

`build-bgt-plazas.ts --exceptions-only [--publish]` builds only the exceptions (about 100 s) and replaces the exception
features in the published `bgt-plazas-v1.json`. A full rebuild includes them through the same code path.
Inputs: `BGT_ONBEGROEID_DIR` and `BGT_SCHEIDING_DIR` from `map-recall2-source-data/datasets/bgt-plazas-20261110`.
The extract was republished (4,940 pieces; +3). No bundle changes: the runtime ignores `exception`.

## Pins

- `test:canal-car`: the ratchets now flip. A point on each exception paving is blocked without the plazas, rides with them,
  is inside a plaza piece, and is reached from the reported corridor position (flood path under 40 m; null without).
  Kept: the Radarweg inner courtyard (52.387592, 4.833165), the Museumplein and Frederiksplein lawns stay blocked.
- `test:bgt-plazas`: the list is closed (2), geometry matches the list, the published extract has no erf piece outside it.
- Ride frames (`bgt-plaza-ride-frames.ts`, now `bgtPlazas=0` for off): ASC west 3.0 m off, 52.0 m on; Radarweg east 0.6 m off,
  6.4 m on. Frames: `map-recall2-screenshots-a1/roads/2026-11-10-erf-exceptions/`.

Note for review: the feedback context's `mapCenter` is the camera, about 22 m from the bike; the player position is at the
ortho centres used here.
