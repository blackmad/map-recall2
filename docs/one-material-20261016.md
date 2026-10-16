# One wall material, one colour pipeline (2026-10-16)

Lane `lane/one-material-20261016`. The user asked on 2026-10-16 why block-face chunks still read darker than the
generic extrusions beside them: "can't you just match the materials between them?" Sheet:
`docs/images/look/one-material-20261016.jpg`. In each row, before (origin/main) is on the left and after is on the
right. The face rows also show the photo strip.

## The probe: same hex, same normal, every path

`src/canalRecall/look/lookParity.ts` now has two more paths:

- `chunk`: a recipe-look brick slot with no tint source, carrying a chunk exposure record that says its strip wall
  measured `hex` (`chunkExposureForMeasured`).
- `recipe-measured`: `tintSource: measured`.

Each path renders a 10 m wall under the real rig. The table shows mean sRGB luma, before → after. The east wall
always reads the same as the north wall.

| hex | face | generic | chunk | recipe-measured | recipe (unmeasured) | landmark |
|---|---|---|---|---|---|---|
| #808080 | south | 124.5 → 129.7 | 129.3 → 130.9 | 127.1 → 128.7 | 117.7 → 119.2 | 121.7 → 122.9 |
| #808080 | north | 83.7 → 101.7 | 88.4 → 102.5 | 87.2 → 100.9 | 80.1 → 93.0 | 83.7 → 96.3 |
| #9a5240 | south | 99.7 → 102.4 | 101.4 → 102.6 | 100.7 → 101.9 | 100.6 → 101.8 | 97.0 → 98.2 |
| #9a5240 | north | 63.8 → 78.7 | 67.4 → 78.9 | 66.9 → 78.4 | 66.8 → 78.2 | 64.7 → 75.4 |
| #4a3a33 | north | 36.0 → 45.4 | 39.5 → 46.9 | 39.3 → 46.7 | 47.0 → 55.4 | 37.8 → 44.8 |
| #c9b9a0 | south | 180.4 → 189.6 | 186.6 → 188.8 | 186.7 → 189.0 | 135.7 → 137.4 | 178.2 → 180.0 |

A second probe ran in the game. Every chunk mesh and every generic facade was drawn as a plain white Lambert
(`artifacts/one-material/white-all.js`). At all five faces the chunk walls and the same-facing generic walls received
exactly the same light: 0.67 sRGB on the shade sides before (0.77 after), and 0.96–0.97 on Bilderdijkstraat's sun
side. **The light was already shared.** The gap between a chunk and its neighbours in a frame is albedo, meaning the
wall colour.

## Differences found, and how each was removed

1. **Different material model.** Generic walls used `MeshStandardMaterial` with roughness 0.9, dropping to 0.32 on
   dark texels. Chunks, recipe houses, building types and landmarks use `MeshLambertMaterial`. The standard
   material's F0 0.04 sun specular, and its multiscatter-reduced sky fill, drew a sun side about 3 luma over and a
   shade side about 1 luma under a Lambert wall. It also put view-dependent glints on dark glass.
   **Fix:** `rendererShared/litFacadeMaterial.ts` is now `MeshLambertMaterial`, flat shaded. The roughness hook is
   gone and the cache key is `shared-frame-facade-v7`.
2. **Different exposure.** In the sunny look, measured walls are scaled in linear light from their crop's white to a
   sunlit white. Chunk walls get the same from their strip. A wall with no recorded white gets
   `FALLBACK_WALL_GAIN` 1.106. Generic walls got nothing, so the same colour drew 2–6 luma darker on a generic wall.
   **Fix:** `look/sunny.ts litFacadeWallGain` multiplies the lit facades' `wallGain` by `1.106^(1/2.2)`. The shader
   linearises it with pow 2.2, so the result is exactly 1.106 in linear light. It touches wall-masked texels only
   and only in the sunny look. `threeBuildingsBrowser.ts` uses it. The opt-in `?cityLook=1` keeps its own value.
   **After:** generic, chunk and measured-recipe walls of one colour agree within 0.2–1.9 luma on every orientation.
   The remaining difference is the chunk strip ratio, which is luma-only. The new e2e test pins this.
3. **Shade ratio.** The rig lit a wall facing away from the sun at 0.41 of a sun-facing wall, in linear light. That
   capped a wall drawn at exactly its sunlit photo colour at 0.67 sRGB of that colour. With the 215° sun, the canal
   rows facing north and east sit on that side.
   **Fix:** `SUNNY_SHADE_RATIO = 0.55` (`look/sunny.ts`). This is one rig, so it applies to every building.
   - Shade sides now draw at 0.77 sRGB of their colour.
   - To keep level ground neutral, the fill is whiter: `#d5e5f3`, was `#b5d2ea`.
   - Exposure is 1.081, was 1.423.
   - Level surfaces receive 1.116. The ground divides it out (`FLAT_GROUND_GAIN` 0.896, was 0.996). Flat roofs draw
     about 5 % lighter in sRGB.
4. **Near-black slate.** Chunk and recipe slate drew at luma 53–75. The PDOK orthophoto measures pitched-slate roofs
   (roof-facts, 174,801 roofs) at p10 84, p25 101 and median 116.
   **Fix:** `look/palette.ts MEASURED_SLATE` = `#76808f`, `#606b79`, `#8c939c` (was `#4b525c`, `#3f464f`,
   `#5a6068`). These are chosen so that tone × slate cell mean (0.794) lands on the measured p25, p10 and median, in
   the old cool hue. The slate `ROOF_SLOT_TONES.slate.hex` follows. This is one table, so generic planned roofs and
   recipe slate change together.
5. **Not changed.**
   - Landmarks keep their authored colours. They have the same light response; the test pins their per-face ratios.
   - Unmeasured recipe slots keep `cityWallTint`, which maps an authored colour into the city brick range. That is a
     colour rule, not a material, and it changes #c9b9a0 a lot (137 vs 189).
   - The `?cityLook=1` 0.9 cell level is opt-in and untouched.

## Faces (z 1.4, chunk-wall median luma/chroma and the share under luma 60)

"Same-facing" means generic wall pixels whose normal matches the chunk's (mask colour within 40). "Sunlit" is photo
luma × the strip's white gain (sRGB): the wall's colour in sun, facing the sun.

| view | chunk before → after | same-facing generic before → after | after gap | photo | sunlit | chunk ÷ sunlit | roof before → after |
|---|---|---|---|---|---|---|---|
| Nassaukade 318, bike | 84/31 11 % → 97/41 7 % | 113/20 → 134/31 | −37 | 98/27 | 119 | 0.82 | 74 → 121 |
| Nassaukade 318, boat | 76/17 22 % → 98/22 4 % | 137/11 → 164/22 ¹ | −66 | 98/27 | 119 | 0.82 | 75 → 122 |
| Marnixstraat marnix-c, bike | 79/13 12 % → 92/21 6 % | 88/21 → 106/25 | −14 | 98/24 | 117 | 0.79 | 53 → 88 |
| Utrechtsestraat 48-76, bike | 87/28 27 % → 93/28 8 % | 73/20 → 86/25 | +7 | 123/25 | 142 | 0.65 | 60 → 99 |
| Oudezijds Voorburgwal 115-125, bike | 50/18 90 % → 59/25 65 % | 70/25 → 84/30 | −25 | 71/8 | 82 | 0.72 | 73 → 120 |
| Oudezijds Voorburgwal 115-125, boat | 50/18 87 % → 59/25 64 % | 68/23 → 83/29 | −24 | 71/8 | 82 | 0.72 | 73 → 120 |
| Bilderdijkstraat 236022-167243, bike (sun side) | 53/35 58 % → 54/36 58 % | 115/83 → 119/87 | −65 | 49/10 | 51 | 1.06 | 59 → 97 |

All frames were re-taken under the shared browser lock (`/tmp/canal-pw.sh`, one lane at a time), with the origin/main
bundles swapped into `public/` for "before". The first, unlocked pass agreed within 1–2 luma, except for two framing
outliers that the locked pass replaces.

¹ The only generic wall facing the same way in this frame is a small corner of a pale stucco building (431 px).
It is not a comparison.

**Reading the table**

- Light: chunk and same-facing neighbour irradiance are identical in every view, before and after.
- Gap: where the chunk is darker than its neighbours, the neighbours have twice its albedo.
  - Nassaukade: 0.43 vs 0.22. The cream-stucco back row and the dense white frames of the bay cells.
  - Oudezijds Voorburgwal: 0.16 vs 0.08.
  - The chunk's albedo is its photo's. Oudezijds Voorburgwal's chunk albedo is 0.079 (sRGB 79), against a sunlit
    photo of 82.
  - The generic walls there are period priors, not measurements. "Chunk within 10 of neighbour" is met only where
    the colours are alike: Utrechtsestraat +7, Marnixstraat −14 (albedo 0.19 vs 0.26).
- Target of ≥ 0.9 of the sunlit photo: met on the sun side (Bilderdijkstraat 1.06). On shade sides it is 0.65–0.82
  (was 0.61–0.71).
  At ratio 0.55 the rig's shade cap is 0.77 sRGB. Reaching 0.9 on a shade side would need a ratio near 0.8, which is
  close to overcast light with no visible sun/shade.

## Overall frames (default query, median luma/chroma, before → after)

| place | walls | roofs | paved | frame |
|---|---|---|---|---|
| Singelgracht boat spot | 116/48 → 124/52 | 118/5 → 136/7 | 133/22 → 133/22 | 126/27 → 131/27 |
| Nassaukade south end (bike) | 158/30 → 163/26 | 99/7 → 114/7 | 134/22 → 133/22 | 126/44 → 126/46 |
| Nieuw-West, Slotermeer (bike) | 136/27 → 142/26 | 133/3 → 155/6 | 168/28 → 168/28 | 145/28 → 154/28 |
| Overview (zoom 0.16) | 122/38 → 129/38 | 114/5 → 134/7 | 132/29 → 132/29 | 124/23 → 130/23 |

The city reads sunnier, not greyer:

- Walls are +5 to +8 luma, with chroma held.
- Roofs are +15 to +22, with chroma up 0–3. The near-black slate patches are gone.
- The ground is within ±1, except one road reading at Nieuw-West.
- Nothing clips: white membrane 222 draws about 233.

## Tests

- `tests/e2e/look-parity.spec.ts` "one material" covers five hexes and four faces:
  - Generic, chunk and measured recipe agree within 2.5 luma.
  - Every path (landmark and unmeasured recipe included) has the generic wall's face-over-south ratio within 0.02.
- The old grey triple now allows 0.10, because its spread is colour rules (above).
- `sunny.test.ts`: the shade ratio, the exposure (1.081), flat at 1.116, the paler fill, and `litFacadeWallGain`.
- `ownGround.test.ts`: flat ground 1.116 and gain 0.896. Asphalt in cast shadow stays ≥ 75.
- `building-look.spec.ts`: the sun-side grey table was re-measured.

## Oudezijds Voorburgwal 115-125

Keep it held. Its walls are now drawn at its photo's colour, and that colour is soot-dark brick: 71/8 overcast, 82
sunlit. On the shade side it is 59 luma, with 64–65 % of wall pixels under luma 60. The photo has 29 %, and the
bound is the photo + 10. The generic draw at the same pixels was darker than the chunk before this change.

## Ride perf (desktop, `PERF_RIDE=1`, alone under the browser lock, load 6)

5/5 within budget.

| variant | frame interval median/p95 | map render median/p95 | three.js median | heap | landmarks shown |
|---|---|---|---|---|---|
| default | 16.7/16.7 | 2.3/5.2 | 0.8 | 1,047 MB | 76 |
| landmarks off | 16.7/16.7 | 2.2/4.5 | 0.6 | 909 MB | 53 |
| all landmarks resident | 16.7/16.8 | 3.9/6.6 | 1.8 | 1,137 MB | 486 |
| default (repeat) | 16.7/16.8 | 2.3/5.0 | 0.9 | 874 MB | 76 |

Motion stutter: p95 16.7 ms, p99 16.8 ms, 2 frames over 50 ms, 0 over 100 ms, longest 66.7 ms.

Earlier unlocked runs were taken at load 40–110 and are void. They failed the map-render budget on origin/main's
bundles and on this lane's alike.
