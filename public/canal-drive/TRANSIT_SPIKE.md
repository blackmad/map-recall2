# Public transit mode — spike notes (item 17)

Branch / worktree: `spike/canal-transit` ·
`.worktrees/transit` · started 2026-09-05.

This is a design spike, not a ship plan. Goal: teach real Amsterdam transit
geography (stop / line / headsign) from a **versioned GTFS-derived extract**,
not a live timetable app.

---

## Product rule

Same as boat and bike: **geographic learning outranks arcade.**

A trip is a sequence of **services and walking connections**. Questions must
distinguish:

| Ask about | Example |
| --- | --- |
| **Stop** | “Which stop is this?” (Dam, Centraal Station) |
| **Line** | “Which tram is this?” (12, 2) |
| **Destination / headsign** | “Where is this service going?” (Nieuw Sloten) |

Live disruption (GTFS-RT) stays **optional**. Learning must work from a cached
extract. Do not poll OVapi more than daily; send a real `User-Agent`.

---

## Data: GTFS is primary

OSM route relations exist (~148 in Amsterdam) but are the wrong foundation for
this mode: incomplete stop sequences, weak headsigns, no reliable transfers,
and bus/tram identity that drifts from what riders see on the vehicle.

**Source of truth:** [OVapi GTFS NL](https://gtfs.ovapi.nl/nl/gtfs-nl.zip)
(~220 MB). Agency **GVB** alone is enough for Amsterdam v0.

Measured from the 2026-09-05 feed (staging build):

| Mode | GVB routes kept | Notes |
| --- | --- | --- |
| Tram (`route_type=0`) | 17 | refs 1–7, 12–14, 17, 19, 24–29 |
| Metro (`route_type=1`) | 5 | 50–54 |
| Ferry (`route_type=4`) | 10 | F1–F9, F20–F22 |
| Bus (`route_type=3`) | *deferred* | 43 GVB buses — too dense for v0 learning |

Staging extract: `public/data/extracts/amsterdam/transit-network.json`
(~320 KB): one representative trip + shape + stop sequence per line, 309
stops (302 inside the Amsterdam play bbox). Named pins already hold:

- tram **2** stops at **Dam**
- metro **52** stops at **Noord**

Rebuild (from worktree, after caching the zip):

```bash
# already downloaded to .cache/transit/gtfs-nl.zip
python3 scripts/build-amsterdam-transit-gtfs.py
```

**OSM role (secondary):** basemap context, quay/walk connectors, maybe snapping
ferry terminals to water. Not the line/stop catalog.

---

## What exists today in the game

- Travel modes are binary: `boat` | `car` (bike UI). Branching is `isCar()`.
- No transit extract in the published Amsterdam partitions.
- Bridge-railway tagging only silences rail-only bridges from quizzes.

---

## Mode model (not a vehicle skin)

Add `transit` to `TRAVEL_MODES`. Replace binary `isCar` with a **mode profile**:

```ts
{
  id: 'transit',
  label: 'Transit',
  dataset: 'transit-network',      // from GTFS
  quizSubjects: ['stop', 'line', 'headsign'],
  learnedType: 'stop' | 'line',
  motion: 'follow-corridor',       // snap to GTFS shapes
  vehicle: 'tram-car',             // presentation only
}
```

Reuse `RoadNetwork` / `planRoute` on corridor polylines from `shapes.txt`.
Transfers: GTFS `transfers.txt` (2.6 MB NL-wide) filtered to GVB stop ids —
edge list for multi-leg trips later.

---

## Recall design (v0)

- On a corridor: ask **line** or **current / next stop**.
- At a stop: ask stop name; distractors from nearby stops on other lines.
- Never reveal the line on the HUD before a line-answer (same as streets/canals).
- Mastery keys: `transit:stop:…` and `transit:line:…`.

Surprise anchors: Centraal, metro termini, IJ ferry terminals.

---

## First deliverables (gated)

1. **Cache + filter pipeline** — download OVapi GTFS with UA; write Amsterdam
   GVB tram/metro/ferry `transit-network.json` (staging → publish after review).
2. **`check:transit-extract`** — pin tram 2↔Dam, metro 52↔Noord, ferry F-lines
   present, stop count band, every line has path + stops.
3. **Mode profile spike** — `TravelMode` includes `transit`; prefs parse safe.
4. **Playable thin slice** — follow one tram shape with stop quizzes only.
   No bus, no GTFS-RT.

---

## Out of scope

- GTFS-RT vehicle dots
- Full journey-planner UX before one corridor plays
- NS trains
- Tram mesh before extract + quiz subjects exist
- Citywide bus (add only after tram/metro/ferry teach well)

---

## Open questions for the owner

1. Tram-only first, or tram + metro + ferry together (staging already has all three)?
2. Ride-one-line follow vs transfer planner as the first playable loop?
3. Transit mastery on the knowledge map: separate layer or mixed with streets?
