# Why `?streetChunks=1` walls drew at ~0.65 of their photo, and the fix (2026-10-16)

Lane `lane/chunk-brightness-20261016`, which follows `docs/chunk-look-20261016.md`. Sheet:
`docs/images/look/chunks-brightness-20261016.jpg`. Each row shows the same view before (origin/main bundles) on
the left and after on the right, with the face's photo strip below.

## Cause

The material path was ruled out first. A live probe of the chunk meshes shows the legacy recipe look, lit:
`MeshLambertMaterial`, map = brick cell, colour = `cityTint(slot, hex)`. Chunk walls carry no `tintSource`, so they
take the city brick path (`cityWallTint`). The chunk path does not use cityLook's 0.9 level or the unlit baked shade.

The ratio splits into three measured factors:

    chunk / photo  =  (drawn head-on / strip wall)  x  (light on that wall)  x  (exposure gain: missing)

1. **Drawn head-on / strip wall (0.86-1.44 in sRGB).** The block-face review (`scripts/block-face/review.ts`,
   wall-colour check) matches `cell x cityTint(palette.brick)` to the rectified strip. So a chunk wall facing the
   light draws the strip's colour at the strip's own exposure. Medians over brick pands: marnix-c 0.98,
   nassau-162289 1.04, wallen-ozv 1.07, utrechtse 0.86. bilder-236022-167243 is 1.44: its bricks were lifted by eye
   above a strip whose trim is bright (210).
2. **Light.** In every view of the four dark faces, the wall is on its shade side, 95-146° from the sun's azimuth
   (215°). A white Lambert on the chunk draws 171/255 there: the rig's 0.41 shade-to-sun ratio in linear light, by
   design (`sunny.ts`). On Bilderdijkstraat's sun side it draws 244/255.
3. **No exposure gain.** Per-house measured walls are brought from their crop's white to a sunlit white
   (`sunlitMeasuredWall`). Chunk walls had no exposure record, so they drew the overcast reading. Their strips' light
   trim measures 164-196 luma, against a sunlit white of 219.

The factors predict the before column: 0.98 x 0.67 = 0.66 for marnix-c (measured 0.65), 1.07 x 0.67 = 0.72 for OZV
(0.65), 0.86 x 0.67 = 0.58 for Utrechtsestraat (0.56) and 1.44 x 0.96 = 1.38 for Bilderdijkstraat (1.47).

A side issue: a measured tint's white point reached the game only by matching the wall's hex against the per-house
crops. The `tintWhitePoint` extra the exporter writes was ignored.

## Fix

- `src/canalRecall/look/chunkWallExposure.ts`. In the sunny look, a chunk's brick, accent and stucco walls are scaled
  in linear light by `measuredWallGain(strip white) x stripOverDrawn`, bounded 0.4-2.5. This draws each wall at its
  photo colour normalised to sunlight, and corrects factors 1 and 3 together.
  - Both numbers are measured per chunk on its strip by `scripts/look/build-chunk-wall-exposure.ts`, which generates
    `chunkWallExposureData.ts`. The white is the median of the pands' light trims. A strip without trim, or a chunk
    without a strip, falls back to `FALLBACK_WALL_GAIN`.
  - `chunkSpecFor` carries the exposure into the spec. `signature-landmarks-source.js _dress` passes it to the
    recipe look, on the legacy path and the `?cityLook=1` path.
  - Frames, glass, roofs, the legacy look and every non-chunk model are unchanged, byte for byte.
  - No GLB was regenerated: the fix is at runtime.
- `sceneSlotHex` and `cityLook` now use a measured tint's own `tintWhitePoint`. Without one they look the white up
  by hex, as before.
- `scripts/look/region-mask.js` discards `hidden` facade vertices, as `litFacadeMaterial` does, so suppressed
  generic prisms no longer cover the walls drawn in their place.
- Tests: `src/canalRecall/look/chunkWallExposure.test.ts`, run by `test:look`. It checks that the table is current
  with `chunks.json`, the bounds and the fallback, walls-only and sunny-only scaling, that the spec carries the
  exposure, that `tintWhitePoint` is used, and that the region-mask discard matches `VERTEX_HIDE`.
- After `scripts/block-face/compile.ts --install`, rerun `npx tsx scripts/look/build-chunk-wall-exposure.ts --write`.
  The test fails until you do.

## Numbers (z 1.4, chunk-wall pixels, median luma/chroma, % under luma 60)

"Sunlit photo" is photo luma x white gain (sRGB) x the light on that wall (the white-Lambert pass). It is what a
correctly normalised wall should draw in that view.

| view | before | after | neighbours | default (same px) | photo | after ÷ photo | sunlit photo | after ÷ sunlit |
|---|---|---|---|---|---|---|---|---|
| Nassaukade 318 row, bike | 62/25, 40 % | **84/31, 11 %** | 117/21, 9 % | 78/26, 25 % | 98/27, 14 % | 0.86 | 80 | 1.05 |
| Nassaukade 318 row, boat | 72/17, 45 % | **76/17, 22 %** | 137/11, 0 % | 97/15, 15 % | 98/27, 14 % | 0.78 | 80 | 0.95 |
| Marnixstraat marnix-c, bike | 64/11, 12 % | **79/13, 11 %** | 87/23, 8 % | 75/23, 18 % | 98/24, 6 % | 0.81 | 78 | 1.01 |
| Utrechtsestraat 48-76, bike | 88/28, 40 % | **87/28, 27 %** | 89/23, 16 % | 58/13, 53 % | 123/25, 20 % | 0.71 | 95 | 0.92 |
| Oudezijds Voorburgwal 115-125, bike | 46/17, 90 % | **50/18, 89 %** | 69/25, 29 % | 55/20, 57 % | 71/8, 29 % | 0.70 | 55 | 0.91 |
| Oudezijds Voorburgwal 115-125, boat | 46/16, 88 % | **50/18, 87 %** | 68/23, 30 % | 55/19, 55 % | 71/8, 29 % | 0.70 | 55 | 0.91 |
| Bilderdijkstraat 236022-167243, bike | 72/44, 17 % | **53/35, 58 %** | 113/68, 1 % | 96/73, 1 % | 49/10, 65 % | 1.08 | 49 | 1.08 |

Utrechtsestraat's "before" reads 88 here, against 69 in the chunk-look doc. The pose and seed are the same, but
main has moved since that lane, and the cause was not isolated. The other "before" values reproduce the doc
within 1-3 luma.

## Against the brief's targets

- **Chunk ÷ photo within 0.9-1.15: met only by Bilderdijkstraat (1.08).** The four shade-side views reach
  0.70-0.86, against 0.62-0.73 before. Against the sunlit photo, every view is within 0.91-1.08.
  - The remaining gap is the rig. A shade-side wall gets 0.67 (sRGB) of a sun-side wall, and the white gain is only
    1.15-1.22. The ceiling is 0.67 x 1.22 = 0.82 for a wall drawn exactly at its normalised photo colour.
  - The generic walls of the same pands sit at 0.47-0.80 of the photo for the same reason.
  - Meeting 0.9 on shade sides needs a look decision, not a chunk fix: raise the rig's shade ratio from 0.41 to about
    0.55 linear, for every wall.
- **Share under luma 60, at most the photo's share + 10 points:** Nassaukade (11 % and 22 % vs 24 %), Marnixstraat
  (11 % vs 16 %), Utrechtsestraat (27 % vs 30 %) and Bilderdijkstraat (58 % vs 75 %) pass. **Oudezijds Voorburgwal
  fails at 87-89 % vs 39 %.** Its soot-black brick (photo 71 overcast) on a shade side is ~50 luma once
  normalised, and its exposure gain is small (1.18 linear: strip white 191).
- Bilderdijkstraat darkened from 72 to 53 because its walls now match their strip. Its warm reds read duller on the
  sheet. If the eye-lifted brick was the better likeness, the strip measurement for that face is what to revisit.

## Ready to draw by default

On the normalised measure, these are ready: **Nassaukade 318 row (nassau-162289)**, **Marnixstraat marnix-c**,
**Utrechtsestraat 48-76** and **Bilderdijkstraat (bilder-236022-167243, and its neighbour faces by the same
mechanism)**. Each is within 0.92-1.08 of its sunlit photo, with its near-black share inside the bound, and no
longer a dark band beside the default.

**Oudezijds Voorburgwal 115-125** should stay off. It is still 89 % under luma 60, below the default's 55-57 %.
