# Feedback + Sentry triage, 2026-10-25 (stopped at the usage-budget cap)

Nothing is fixed yet. The lane stopped during diagnosis. This file records what is known.

## C. whats-new.html: the first card never loads (tests/e2e/whats-new.spec.ts)

- **Cause, measured:** no GLB request is ever made. A wrapped IntersectionObserver
  showed one callback after `render()`, with all 30 cards `isIntersecting=false`,
  the first card included. No later callback fires, so `pump()` never sees a visible
  card. `GLTFLoader.load` is never called, and `errors` stays empty.
- **Likely reason:** the feed starts more than viewport + 200 px down the page,
  under the header, stats and changes list. Without a scroll, nothing comes into
  view. Not yet confirmed: the bounding-rect probe was cut off.
- **Next step:** after `render()`, queue the cards whose rect is already inside
  `innerHeight + 200`. Or eager-load the first N cards: push them to `queue` without
  waiting for IO. Only the `pump()`/IO loader logic should change, not the
  stats/labels markup. Debug script: scratchpad `tools/wn.mjs`. It wraps IO and
  `GLTFLoader.prototype.load`.

## A. Routing items (each needs a named regression location before it counts as fixed)

There are no location fields in the feedback. Positions below come from the screenshots.

- **636a57f4, "bike across this square" (Dam, in front of the Royal Palace, ~52.3729,4.8925).**
  The routing extract has no ring for the Dam plaza. The unnamed pedestrian rings
  near it (routing_40993/40994/40996/41000/41001) do not contain the open square.
  `osm-loader.js` also drops every closed ring, which is 1,453 rings: 430 pedestrian,
  309 service. The rideable surface is therefore only centreline corridors, so the
  open square is off-road. squares.json holds a "Dam Square" polygon (place=square).
  **Proposed fix:** a typed `src/canalRecall/routing/` module that tests a point
  against pedestrian-area polygons (closed `highway=pedestrian` rings, plus squares.json
  where the area is paved). `road-network.js getGuardRoad` would treat a point inside
  one as on-road, with a measured edge tolerance. Pin the Dam point in
  scripts/check-canal-car.ts.
- **638590e9, "got stuck" (Leidseplein, east part by Korte Leidsedwarsstraat, ~52.3640,4.8830, build ec25545).**
  The nearest corridor is the pedestrian Leidseplein way routing_4665:4, 5.6 m away.
  The bike was on the open plaza. It is probably the same class as the Dam item:
  plaza area outside every corridor. Not reproduced yet. **Next:** re-drive with
  `HARNESS_PAIRS` from that point. Pin it in the reachability audit or the harness.
- **3e7f0aa4, "blocked from the red path" (Oosterdok by the Odebrug, near
  Oosterdokseiland/Harry Banninkstraat).** Not yet located on the OSM graph.
  **Next:** list ways near the Odebrug quay. The scratchpad `tools/near.mjs <lat> <lon> <r>`
  lists routing ways with their closed-ring flag. Check whether the quay is a dropped
  closed ring or a corridor gap.

## B. Sentry (canal-recall). Not started

- CANAL-RECALL-H `null.getLayer`: not investigated.
- CANAL-RECALL-E `undefined.DIFFICULTY_PRESETS`: not investigated.
- CANAL-RECALL-D `AbortError`: not investigated. It is probably an aborted fetch on
  navigation. Check the breadcrumbs, then filter it.
- CANAL-RECALL-7 `reportGraphicsFailure`: not investigated.
- CANAL-RECALL-9 / CANAL-RECALL-6 (App Check, #44): whether they still occur was not checked.

## Resolve once deployed

Nothing yet.
