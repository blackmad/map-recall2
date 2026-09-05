# Public transit mode — implementation plan (item 17)

Branch / worktree: `spike/canal-transit` ·
`.worktrees/transit` · plan written 2026-09-05.

This is the **ship plan**, not just a spike note. Goal: teach real Amsterdam
transit geography (stop / line / headsign) from a **versioned GTFS-derived
extract**, without becoming a live timetable app.

Geographic learning outranks arcade. The street/canal/line under question must
never be revealed by the HUD before the answer.

---

## 0. Status snapshot

| Piece | State |
| --- | --- |
| OVapi GTFS → GVB tram/metro/ferry extract | **Done** — `transit-network.json` (32 lines, 309 stops) |
| Typed network schema | **Done** — `src/canalRecall/transit/network.ts` |
| Builder + pin check | **Done** — `build:amsterdam-transit-gtfs`, `test:transit-extract` |
| `TravelMode = 'transit'` | Not started |
| Graph load / drive along shapes | Not started |
| Stop / line / headsign quizzes | Not started |
| Transfers / multi-leg | Later phase |
| Bus / GTFS-RT / tram mesh | Out of v1 |

Rebuild extract (zip cached under `.cache/transit/`):

```bash
npm run build:amsterdam-transit-gtfs
npm run test:transit-extract
```

---

## 1. Product model

### What the player learns

| Ask about | Example | Mastery key family |
| --- | --- | --- |
| **Stop** | “Which stop is this?” (Dam) | `transit:stop:…` |
| **Line** | “Which tram/metro is this?” (2, 52) | `transit:line:…` |
| **Headsign** | “Where is this service going?” | filed against the trip/line, not a separate map layer at first |

A trip is a sequence of **services and walking connections**. v1 play may still
be **single-line follow** with stop quizzes; the data model must not paint us
into a corner when transfers land.

### Defaults (owner can override)

Until the owner answers otherwise, ship with:

1. **Tram + metro + ferry** in the extract (already built); **playable thin
   slice = one tram corridor** before unlocking all lines in the UI.
2. **Ride-one-line follow** as the first loop; transfer planner is phase 3.
3. **Separate mastery layer** from streets/water on the knowledge map (same
   store, different `feature.type`).

### Non-goals (v1)

- GTFS-RT vehicle dots or disruption banners
- NS trains
- Citywide bus (43 GVB bus routes drown the signal)
- Photoreal tram mesh before quizzes teach
- Replacing boat/bike — transit is a **third travel mode**

Live data stays optional forever for learning; cached extract must suffice.

---

## 2. Data plane (GTFS-first)

### Source of truth

[OVapi GTFS NL](https://gtfs.ovapi.nl/nl/gtfs-nl.zip) (~220 MB). Agency **GVB**.
Policy: real `User-Agent`, daily cache max, `Accept-Encoding: gzip`. No SLA.

| `route_type` | Mode | v1 extract |
| --- | --- | --- |
| 0 | tram | 17 lines |
| 1 | metro | 5 lines |
| 4 | ferry | 10 lines |
| 3 | bus | deferred |

### Published artifact

`public/data/extracts/amsterdam/transit-network.json`

- One representative trip + shape + ordered `stopIds` per route
- Stops with `[lat, lng]` centres (canal extract convention)
- Counts + named pins: tram **2↔Dam**, metro **52↔Noord**

### Pipeline evolution

| Step | Work |
| --- | --- |
| Now | `scripts/build-amsterdam-transit-gtfs.ts` + streaming `scripts/lib/gtfs-csv.ts` |
| Next | Emit `paths[]` compatible with `buildRoadSegments` / multi-path stitching if needed |
| Next | Filter `transfers.txt` → `transit-transfers.json` (GVB stop pairs only) |
| Later | Hook into `refresh-city-extract.sh` / `refresh:amsterdam` with cache + publish review |
| Later | Both directions per line (today: one `direction_id`) if playtests miss reverse headsigns |

### OSM role (secondary)

Basemap, walk connectors, ferry terminal ↔ water snap. **Not** the line/stop
catalog. Do not rebuild identity from `route=tram` relations.

---

## 3. Mode architecture

### Replace binary `isCar`

Today everything branches on `isCar(travelMode)` (`boat` vs `car`=bike).

Introduce a **mode profile** in typed code (name TBD, e.g.
`src/canalRecall/game/travelProfile.ts`):

```ts
type TravelProfile = {
  id: TravelMode;                 // 'boat' | 'car' | 'transit'
  label: string;                  // Boat / Bike / Transit
  extractFile: string;            // water.json | streets-routing.json | transit-network.json
  quizRouteSubject: QuizSubject;  // waterway | street | line (new)
  learnedKind: 'water' | 'street' | 'transit';
  motion: 'water' | 'road' | 'corridor';
  vehicle: 'boat' | 'bike' | 'transit';
};
```

`TRAVEL_MODES` in `src/canalRecall/game/modes.ts` gains `'transit'`.
`parseMode` already falls back safely for old prefs.

Migrate call sites gradually: new code uses profiles; legacy `isCar` /
`isBoat` become thin wrappers (`profile.motion === 'road'`, etc.) so
`game.js` does not need a big-bang rewrite.

### Key files to touch (load path)

1. `src/canalRecall/game/modes.ts` — enum + quiz subjects
2. `src/canalRecall/game/preferences.ts` + `OverlayApp.tsx` + `enamelIcons.tsx`
3. `public/canal-drive/js/osm-loader.js` `fetchRoads` — third dataset branch
4. Adapter: `transit-network.json` lines → same segment shape as streets
   (`id`, `name`, `type`, `cityId`, `center`, `highway`/`mode`, `path` / `paths`)
5. `public/canal-drive/js/game-route.js` — loading nouns, `player.isBoat`, no
   `waterTest` for transit; corridor motion like bike
6. `public/canal-drive/js/game.js` / `carRoadGuard.ts` — reuse road-constrain
   on GTFS shapes (treat as road corridors)
7. `src/canalRecall/game/presentationRuntime.ts` — mesh: reuse bike or a
   simple transit stand-in until a tram asset exists
8. Bundles: `build:canal-preferences`, `build:canal-overlay`,
   `build:canal-game-recall`, `build:canal-game-presentation`

### Graph / routing

Reuse `RoadNetwork` + `src/canalRecall/routing/roadGraph.ts`
(`planLearningRoadRoute`). Each transit line corridor is a named way; stops
are quiz triggers along the path, not separate driveable edges in v1.

Surprise routing (`routeSelection.ts` / `game-route.js`):

- Destination pool: transit termini + Centraal + ferry terminals (curated
  subset of stops / landmarks), not museum prominence alone
- Cap pair distance like today (`ROUTE_POI_MAX_PAIR_KM`)
- Retarget with `findRouteToFirstReachable` on the transit graph

Home pattern: geocode → nearest **stop**, then ride a line that serves it
(phase 2+; surprise-only is enough for thin slice).

---

## 4. Recall model

### New quiz subjects

Extend `QUIZ_SUBJECT_NAMES` in `modes.ts` and chip copy in
`public/canal-drive/js/constants.js`:

- `line` — “Which line are you on?”
- `stop` — “Which stop is this?” (or “next stop”)
- Keep `headsign` as prompt copy variant on `line` until it needs its own SRS type

### When to ask

| Trigger | Subject | Distractors |
| --- | --- | --- |
| Moving on a corridor (spaced) | `line` | other lines of same mode |
| Approaching / dwelling at stop | `stop` | nearby stops on other lines |
| Optional advanced | headsign | other termini on the same mode |

Never show line ref / colour as the answer on the HUD before a line question
resolves (same rule as street names).

### Feature identity / SRS

Today: `getFeatureKey` ← `city|type|name|lat4|lon4`
(`src/utils/featureIdentity.ts`), used by `recallStore.ts`.

Transit:

- Stop feature: `{ name: stopName, type: 'stop', cityId, center: stop.center }`
- Line feature: `{ name: lineRef or "Tram 2", type: 'line', cityId, center: ask-point or line centroid }`

Use **stable extract centres** for stops (already on the stop record) so
mastery does not fragment every time the vehicle asks from a slightly
different lat/lon. Lines should key on **ref + mode + city**, not ask-point —
extend `getFeatureKey` or add `getTransitLineKey` with tests.

`routeMasteryFromStates` today only feeds `street`/`canal` into path costs.
Extend to `line` (and optionally stop density) so novelty routing prefers
under-learned corridors.

### Exploration progress

`progressStore.ts` currently splits `learnedStreets` / `learnedWaterways`.
Add `learnedTransitLines` / `learnedTransitStops` (or one `learnedTransit`
bag with kinds). Finish card copy in `presentationRuntime.ts` must not say
“Streets” / “Canals” for transit runs.

---

## 5. Phased delivery

Each phase must be **worth shipping alone** and gated by named checks.

### Phase A — Data currency (mostly done)

- [x] GTFS download + GVB filter
- [x] `transit-network.json` committed
- [x] `test:transit-extract` pins
- [ ] Add `test:transit-extract` to `check:canal` (or a lighter
      `check:transit` pre-merge gate on this branch)
- [ ] Document cache path + UA in `EXTRACT_PIPELINE.md`
- [ ] Optional: both directions per ref; transfer sidecar

**Exit:** refresh is reproducible; pins green on CI.

### Phase B — Mode profile + wiring (no play yet)

- [ ] `'transit'` in `TRAVEL_MODES` / prefs / overlay Travel row
- [ ] `travelProfile.ts` + migrate a few call sites off raw `isCar`
- [ ] `osm-loader.fetchRoads` loads `transit-network.json` → segments
- [ ] Loading screen / setup copy for transit
- [ ] `test:canal-preferences` + `test:canal-overlay` cover transit parse
- [ ] Storybook: briefing with Transit selected (desktop + phone)

**Exit:** selecting Transit loads a transit graph without crashing; boat/bike
unaffected (regression: `test:canal-car`, `test:reachability`).

### Phase C — Playable thin slice (one tram)

Pick **tram 2** (pinned, central, Dam).

- [ ] Spawn on tram 2 shape; road-constrain along corridor
- [ ] Stop proximity detector → stop quiz
- [ ] Occasional line quiz while moving
- [ ] Distractors from extract, not citywide random
- [ ] Mastery keys for stop + line; `clearKnowledge` / clear-all still wipe them
- [ ] Finish card nouns: stops / lines
- [ ] Named checks: “tram 2 corridor reachable end-to-end”, “Dam stop triggers”
- [ ] Playwright or driving harness pin if cheap; else typed proximity tests

**Exit:** a player can complete a tram 2 surprise hop answering stops (and
at least one line question) without HUD leaks.

### Phase D — Full GVB rail+ferry surface

- [ ] All tram + metro + ferry lines selectable via surprise routing
- [ ] Curated transit anchors (Centraal, Noord, ferry terminals)
- [ ] Ferry: corridor follow if shape is water-like; else stop-to-stop hop
      with short cinematic — decide with a measured F-line playtest
- [ ] Line colour chips **after** answer only
- [ ] Expand `test:transit-extract` + reachability sample across modes

**Exit:** surprise transit routes across modes; still no bus, no transfers.

### Phase E — Transfers (true transit model)

- [ ] `transit-transfers.json` from GTFS `transfers.txt`
- [ ] Multi-leg planner: ride → walk/transfer → ride
- [ ] Quiz at transfer stops: “which line next?” / “which stop to change?”
- [ ] Cap legs (e.g. max 2 rides) so routes stay teachable
- [ ] Knowledge map layer for transit mastery (item 6 can consume later)

**Exit:** item 17’s “sequence of services and walking connections” is real.

### Phase F — Polish / widen (after v1 teaches)

- Bus as opt-in advanced difficulty or separate mode
- GTFS-RT as optional overlay (never required for questions)
- Dedicated tram/metro vehicle mesh
- Rotterdam RET / Den Haag HTM / Utrecht U-OV extracts (same builder,
  different `agency_id`)

---

## 6. Verification gates

| Gate | Command / artifact | Phase |
| --- | --- | --- |
| Extract pins | `npm run test:transit-extract` | A+ |
| Prefs/overlay | `test:canal-preferences`, `test:canal-overlay` | B+ |
| Boat/bike regression | `test:canal-car`, `test:reachability` | B+ |
| Transit corridor | new `test:transit-routing` (tram 2 path) | C+ |
| Recall rules | extend `test:recall-rules` for stop/line | C+ |
| Aggregate | append transit tests to `check:canal` before merge to main | C or D |
| Visual | Storybook transit briefing + mid-quiz stop card | B/C |
| Play | manual: tram 2 Centraal→somewhere, phone + desktop | C |

Turn every geographic failure into a **named regression** (stop id / line ref),
same rule as cul-de-sac pins in `check-canal-car.ts`.

---

## 7. UI / copy checklist

- Setup Travel row: Boat · Bike · **Transit**
- No bike-skin row when Transit selected
- Loading: “Mapping tram lines…” (not streets/waterways)
- Prompt chips: Line / Stop (and Bridge only if we ever quiz shared bridges)
- Finish: lines and stops learned; exploration badge not “waterways”
- HOW TO PLAY blurb: transit-specific when mode is transit
  (`presentationRuntime` still hardcodes boat in places — fix)
- Colour: line colour may appear on **feedback** and encyclopedia card, not
  on the unanswered prompt

---

## 8. Risk register

| Risk | Mitigation |
| --- | --- |
| `isCar` sprawl misses a branch | Profile helper + grep gate in `check:canal-preferences` / lint for raw comparisons in new files |
| Ask-point SRS keys fragment stops | Stable stop centres from extract |
| One trip per route misses reverse | Add opposite `direction_id` when thin slice is green |
| Ferry shapes awkward to “drive” | Playtest F-line early; allow hop mode |
| GTFS zip weight in CI | Cache artifact; builder not run on every CI — committed JSON + pin test |
| Teaching wrong stop names | Prefer `stop_name` as shown on GVB; pin Dam/Noord; playtest |
| Bus pressure to “just add them” | Keep deferred until D exit criteria met |

---

## 9. Suggested implementation order (this branch)

1. Fix docs / add extract gate to a local `check:transit` script.
2. Phase B mode profile + loader (no quiz).
3. Phase C tram 2 thin slice end-to-end.
4. Open PR to `main` after C (or D if C is too thin for players).
5. Phase E transfers on a follow-up branch.

Leaf agents: keep `game.js` / `index.html` / `TODO.md` / `HISTORY.md` as
integration hotspots — return SHAs and check output; integrating agent merges.

---

## 10. Open questions (owner)

Answer these to lock defaults in §1:

1. Tram-only thin slice, or allow metro/ferry as soon as C works?
2. Is “surprise single-line follow” enough for the first public build, or must
   transfers ship in v1?
3. Knowledge map: separate transit layer vs mixed with streets/water?

Until answered, §1 defaults stand.

---

## Appendix — measured extract (2026-09-05 feed)

- 17 tram, 5 metro, 10 ferry; 309 stops (302 in bbox)
- Every line has path + stops
- Pins: tram 2 ↔ Dam; metro 52 ↔ Noord
- Types: `src/canalRecall/transit/network.ts`
- Builder: `scripts/build-amsterdam-transit-gtfs.ts`
