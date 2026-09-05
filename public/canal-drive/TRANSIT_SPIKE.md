# Public transit mode — spike notes (item 17)

Branch / worktree: `spike/canal-transit` ·
`.worktrees/transit` · started 2026-09-05.

This is a design spike, not a ship plan. Goal: decide the smallest mode that
teaches real Amsterdam transit geography without becoming a GTFS timetable app.

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

Teaching a dab Wikipedia “public transport in Amsterdam” list is explicitly
out — the trivia pipeline already strips those sections.

Live disruption data stays **optional**. Learning must work from a cached,
versioned extract.

---

## What exists today

- Travel modes are a binary: `boat` | `car` (`car` is bike in the UI).
  Branching is `isCar()` everywhere — prefs, loader, physics, quiz subject,
  exploration (`byBoat`).
- Extracts have **no** transit partition. Amsterdam `streets-routing` has
  `busway` lanes and a handful of abandoned-railway tags, not tram/metro
  lines. Bridge-railway tagging only silences rail-only bridges from quizzes.
- OSM probe (Overpass, Amsterdam admin_level=8, 2026-09-05): **~148**
  tram/subway/ferry/bus **route relations** and **~526** stop-like nodes in
  one count query. Enough geography to teach; needs a real builder, not the
  highway extract.

---

## Data sources (ordered)

1. **OSM route relations + stops** (preferred for v0 geometry)  
   `route=tram|subway|ferry` (+ GVB bus later). Same provenance as canals and
   streets; versionable via BBBike/PBF refresh. Shapes and stop order live on
   relations; colours/refs are usually tagged.

2. **OVapi GTFS** (`https://gtfs.ovapi.nl/nl/gtfs-nl.zip`, ~220 MB NL-wide)  
   Best for **schedules, headsigns, transfers**, agency completeness. License:
   open, no SLA; must send a real `User-Agent` and prefer daily cache, not
   polling. **Do not** depend on GTFS-RT for the learning game.

3. **Hybrid** (likely production shape)  
   OSM for drawable corridors and stop positions; GTFS for line identity /
   headsigns / transfer edges when OSM is thin. Publish a trimmed
   Amsterdam-only GTFS slice into `.cache/` then a compact
   `transit-network.json` extract.

v0 should ship from **OSM alone** so refresh stays offline-capable after one
PBF pull. Add GTFS when stop naming or transfers are wrong in playtests.

---

## Mode model (not a vehicle skin)

Add `transit` to `TRAVEL_MODES` (or finer `tram` later). Replace binary
`isCar` with a small **mode profile**:

```ts
{
  id: 'transit',
  label: 'Transit',
  dataset: 'transit-routing',      // new extract
  quizSubjects: ['stop', 'line', 'headsign'],
  learnedType: 'stop' | 'line',    // mastery keys
  motion: 'follow-corridor',       // reuse road graph snap
  vehicle: 'tram-car',             // presentation only
}
```

Reuse `RoadNetwork` / `planRoute` / mastery weighting. Physics can start as
**road-constrain along corridor centerlines** (same as bike), not boat water
fit. Ferry legs are stop-to-stop hops or short water corridors — decide after
counting named ferry routes.

Harder without touching legacy JS: `game.js` collision and `game-route.js`
load copy. Typed path: `modes.ts` → extract filter → `osm-loader` third
dataset → `recallRuntime` / `recallRules` subjects.

---

## Recall design (v0)

- **While moving on a line corridor:** ask the **line** (ref + colour chip) or
  the **next / current stop**.
- **At a stop / transfer:** ask the stop name; distractors from nearby stops
  on other lines (not random citywide).
- **Never** reveal the line on the HUD before the answer when the question is
  the line (same rule as street/canal names).
- Spaced repetition keys: `transit:stop:…` and `transit:line:…` — separate
  from street/water mastery.

Surprise routes: landmark POIs already curated; transit mode can target
**Centraal, a metro terminus, a ferry terminal** as anchors.

---

## First deliverables (gated)

1. **`scripts/build-amsterdam-transit.ts`** — from PBF/Overpass cache, emit
   `transit-routing.json`: lines (ref, colour, mode, stop sequence) + stop
   nodes + corridor polylines. Pin counts (tram lines, metro lines, ferry
   routes, stops with names).
2. **`check:transit-extract`** — named regressions (e.g. tram 2 stops at
   Dam; metro 52 has Noord; IJ ferry terminals exist).
3. **Mode profile spike** (typed only) — `TravelMode` includes `transit`;
   prefs parse safely; no game wiring yet.
4. **Playable thin slice** — follow one tram corridor with stop quizzes only.
   No transfers, no bus, no live data.

Stop before citywide bus. Bus density will drown the learning signal.

---

## Out of scope for the spike

- GTFS-RT / vehicle positions on the map
- Full multi-leg journey planner UX
- NS trains (different agency, different learning problem)
- Skinning a tram mesh before the extract and quiz subjects exist

---

## Open questions for the owner

1. **Tram-only Amsterdam first**, or tram + metro together?
2. Is the player **riding a single line** (arcade follow) or **planning
   transfers** (true transit model)? Item 17 text says the latter; v0 play
   may still be single-line follow with transfer questions at stops.
3. Should transit mastery sync with street/water mastery on the knowledge map,
   or a separate layer?
