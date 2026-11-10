# Lane G-shards: torn ground at rail and road embankments, city-wide (opus, 2026-11-10)

**User, 2026-11-10** (build 93440cb), Piet Kranenbergpad under the ring railway (Stadionbuurt/Schinkelbuurt, about
52.343 N 4.851 E): "this still looks awful". On the Amstelveenseweg viaduct (52.3445, 4.8565): "this one is better
but still not perfect, the other one is worse". On the Schinkel bank west of it (Jachthavenweg): "please systemic
fix along here and anywhere else that it's an issue".

## The shots

The shots are `images/40.png`–`45.png` in session 88cbf34b. Copy them into the screenshots repo under
`user-shots/2026-11-10-ring-underpass/`.

- **Ground layers tear into slivers.** Where paths and roads pass under the rail viaduct, the asphalt, grass, sand,
  cycle-path red and pavement layers break into triangular slivers. These "shards" fan out from the embankment foot,
  and patches of one layer poke through another.
- **Cycle-path red breaks up.** The red smears into wedges under the deck.
- **Sand at the bank.** A large sand-coloured area at the Schinkel bank runs into a red cycle path that dead-ends.
- **One spot regressed.** The user reads Piet Kranenbergpad as worse than before, so some recent change regressed it.
  Bisect the deploys before fixing.

## Do

1. **Diagnose before fixing.**
   - Pin the 3 poses (`demo-shots` spots, desktop).
   - For each shard, record which layer it comes from (BGT class), which build step makes it, and why. Candidates:
     - polygon tessellation with holes or self-intersections;
     - overlapping BGT layers with no precedence;
     - draping onto AHN across the embankment slope, where height steps tear the layer;
     - under-deck clipping (`ownGround/deckCarry.ts`, `bridgeGaps.ts`, `decks.ts`, `crossingCells.ts`);
     - triangles stretched across a cell seam.
   - Bisect deploys from about 2026-11-07 to 93440cb at the Kranenbergpad pose to find the regression.
2. **A city-wide detector.** This is the systemic part, and it runs in Node on the baked ground cells with no
   browser. Per cell it reports:
   - sliver triangles (aspect > 20 and area > 0.05 m²);
   - overlapping-layer area at the same height (z-fight);
   - layer-boundary self-intersections;
   - "fans" (many slivers sharing one vertex).

   Rank cells by shard area, weighted by ride priority. Report the top 50 with their positions, and how many share each
   root cause. The 3 user poses must rank high, or the detector is wrong.
3. **Fix by cause, not by location.** Each fix must be typed and unit-tested. It must also be byte-identical on cells
   with no defect (`world:verify`, which reports the changed cells).
4. **Sand and dead ends.** Check the Schinkel-bank sand polygon against BGT and the orthophoto (open data only). If
   BGT says `zand` (a beach or a construction site), keep it and say so. If it's a fill fallback, fix the fallback.
   The red path ending in sand is either data (a path under construction) or a clip bug; say which.

## Gates

- Judge on the user's three poses: a before/after ride frame each, desktop plus phone, beside the orthophoto. Per
  "road look over accuracy", the frame's look comes first: no visible shards, and coherent layer edges at the
  embankment foot.
- The detector's top-50 shard area drops by ≥ 80 % city-wide, and no cell gets worse.
- Name the regression from the bisect.
- `check:canal` is green. The three poses become named regression locations, either as ground e2e or as a
  detector unit fixture.

## Rules

- Use `/usr/bin/git` and `scripts/worktrees/new.sh`.
- Use a private `PW_PORT` and `/tmp/canal-pw.sh`, which has 3 shared slots.
- Stop the dev server by PID.
- Hand back the SHA, the detector report, the before/after frames and the cause table.
