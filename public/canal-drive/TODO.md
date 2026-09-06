# Canal Recall — what is left

The work board. Everything finished lives in `HISTORY.md`; this file is only
things that are not done. Keep it current in the same change that moves an
item, not afterwards.

Ordered by one rule: **a learning game that teaches the wrong thing is broken
in a way that a plain-looking one is not.** So correctness of what the game
teaches outranks the depth of what it teaches, which outranks how it looks.
Within a tier, cheap-and-blocking comes before expensive-and-isolated.

Building / façade / 3D mesh work is owned by other agents — do not queue it
here. Their design notes stay in `BUILDING_*.md`, `FACADE_*.md`, `LOD.md`, and
`HISTORY.md`.

---

## P0 — Red, or actively teaching something false

*Empty. Keep it that way: anything that makes the game teach something false
belongs here before anything below it.*

---

## P1 — The learning model itself

**16. Review and refine the published Randstad trivia.**
v11 is published (4,052 facts / 1,628 features). Trivia Lab’s **Human review**
view is the audit path: approve / reject / strike / note, then
`npm run facts:publish`. Still worth a pass: dates, quantities, Dutch
translations, and model-verifier disagreements. Corrections must keep exact
Wikipedia evidence.

**6. City knowledge review map.**
Full-city map colouring learned roads and waterways by mastery / review state,
with fog-of-war over the rest. Derive from visits, answers and recency — not
one drive-through as mastery. Same data should later feed “where next”.
*Shipped:* graded fog / learning / known / mastered tints; waterways (canal /
river / dock) use cool blue bands vs land green; cache busts on band counts.
Still open: review-due tint and a dedicated review screen.
*Related:* Home-base routes grow an expanding learning radius from the address
(HUD/briefing readout + soft path bias inside the ring).

---

## P2 — Weight and reach

**11b. Optional Amsterdam extract refresh (not broken).**
Published Amsterdam is check-green (~47k routing ways, motorway/trunk classes,
`city-profile.json`, bridge crossings aligned, Potgieterstraat present). Last
structural rebuild 2026-08-31. A new `refresh:amsterdam` is worthwhile for
pipeline currency (dab-follow enrich, English rename-refusal handling) but will
churn encyclopedia blurbs — stage, diff coverage, publish only after review.
Do not treat this as a red routing bug.

**11c. Thicken thin English ledes; prune translation cache.**
English publish gates are green. `--prune-stale` on
`translate-extracts-to-english.ts` now drops orphaned cache entries against
**all** Randstad extracts (shared cache; one-city prune would delete live
siblings) — 322 orphans removed → 1,422 kept. Remaining thin cards are mostly
Wikidata description floors (~400 distinct); upgrade-from-original is sparse
and `trn` still rename-refuses many. Re-run `enrich:*-english` after refresh.

**14. Storybook visual regressions.**
HUD / briefing / finish / notice states compile in Storybook. Still open:
automated screenshot diffs for those states (not just `build-storybook`).

---

## P3 — Bets worth a spike, on their own branch

**17. Public transit mode.** Tram / metro / ferry as its own routing and
recall model, not a vehicle skin. *Large.* **GTFS-first** (OVapi → GVB). Plan:
[`TRANSIT_SPIKE.md`](TRANSIT_SPIKE.md). **Phases A–E + play polish shipped:**
tram+metro drive, termini pool, metro 52 pin, sibling/hub distractors,
active-line stop scope, transfers, two-leg planner + second-leg drive, surprise
pairing biased toward teachable transfers (~70%), second-leg plaque clear,
named Noord→Isolatorweg two-leg pin. Still open: bus, GTFS-RT, dedicated mesh,
GTFS `transfers.txt` merge when cached. Canal-belt teaching streets via
`amsterdam-curation` + `ensure:amsterdam-teaching-streets`. Pedestrian
`bicycle=no` corridors (Kalverstraat) playable with `bicycleRestricted`.
Ferry water hops stay out of scope.

**19. Structured Wikidata + city-hall advisor.** Assignments from mayors,
architects, opening dates — without another card competing with the corridor.

**23 / 24. Authentic retro rendering and the optional arcade layer.**
Parked; design notes at the end of `HISTORY.md`.

---

## Ongoing reliability work

Not milestones — standing obligations with live guards.

- Name every reported geographic failure in `scripts/check-canal-car.ts` (or
  the reachability / city-extract harness) before calling it fixed. Bike
  corridor pins: Zeedijk in, Kalverstraat out (`check-city-extract`).
- Prefer city-qualified Wikipedia dab follows (`pickDisambiguationTarget`,
  score ≥45); keep `check:encyclopedia-disambiguation` green.
- Refine boat shoreline response and bridge traversal on more geometries.
- Keep rejecting distant or ambiguous home-address-to-waterway snaps.
- Audit route topology at docks, broad water polygons, bridges, and split OSM
  fragments.
- Tune neighborhood postcard scale and long-name typography on mobile.
