# Lane: level the city palette to the measured photos (2026-11-07, week 1, user strip)

Branch `lane/palette-level-20261107`, own worktree. Read `docs/handoffs/LANE-RULES.md`,
`docs/LOOK.md` "Palette and saturation", and `docs/plans/city-coverage-20261107.md` §B3. Model:
**haiku** for the measurement and the strips, one **opus** turn (≤ 15) for the levelling decision.
Use `/usr/bin/git`; never `pkill`; Playwright through `bash /tmp/canal-pw.sh` with your `PW_PORT`,
one run per strip. Budget: 40 haiku + 15 opus.

## Why

The user: "a lot of buildings could use slightly more textures to accomplish the right colour/feel".
No GLB carries an image texture; the look is one array texture of procedural cells plus one CC0
brick, tinted per pand. The per-buurt profile work (#102) ended with "fronts are still more saturated
than the muted photos", and `derive.ts` already brings every photo source onto one exposure frame
(`buurtProfiles/exposure.ts`). So the first texture work is not a texture: it is one measured,
city-wide levelling of rendered wall saturation and lightness against the photos, judged on a strip the
user looks at. Slot layers (timber, metal roof, warm-grey tile, dark painted brick, glazed plinth, soot
band) are week 4 (§C4), after this lands.

## Do

1. Measure. For the 3,649 measured fronts (the derive.ts sources) take the rendered wall colour of the
   same pand from a headless frame at the same wall (the look-consistency harness or
   `scripts/look/*` already renders fixed spots; the chunk-wall-exposure tool
   `src/canalRecall/look/chunkWallExposure.ts` samples drawn walls). Compute, in LCH, the median and
   p10/p90 of (rendered − measured) for L and C, per era and per material family (brick, painted,
   stone). One table. If a per-pand render is too slow, sample 400 pands stratified by era and buurt
   and say so.
2. Propose. One global transform in `src/canalRecall/look/palette.ts` (the `cityWallTint` path and the
   period walls) that moves the medians to zero without clamping below the brick range LOOK.md sets,
   with the number in a constant and a unit test on the medians. No per-buurt or per-pand change in
   this lane. Behind `?paletteLevel=0` for the before.
3. Strips. The 12-spot sheet before/after at gallery size, plus the user's two pinned poses
   (`da-costakade-user` in `scripts/look/crispSpots.ts`, `s3-slab-user` in `scripts/world/abSpots.ts`)
   before/after. Landmarks share the slot table: include one landmark spot (Westerkerk or Rijksmuseum)
   so a levelling that dulls a reviewed landmark is caught (LOOK: 293/311 landmarks within 10 % of
   their reviewed brightness; keep that).
4. The opus turn writes: the chosen numbers, what moved, which spots read closer to the photo and
   which worse, and a recommendation. The user decides on the strip (needs-david issue with the
   before/after images in `blackmad/map-recall2-screenshots`).

## Numbers to hand back

Median and p10/p90 ΔL, ΔC before/after per era and material; the constant; landmark brightness
deltas; strip paths; the issue number.

## Hand back

LANE-RULES format. Nothing is flipped by this lane; the integrator flips after the user's answer.
