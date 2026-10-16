# Should `?streetChunks=1` be the default again? (2026-10-16)

Measurement lane `lane/chunk-look-20261016`. No game code changed. Sheet: `docs/images/look/chunks-20261016.jpg`.
Each row shows the default (chunks retired) on the left, `?streetChunks=1` on the right, and the face's photo
strip below.

## How it was measured

- Frames: `scripts/live-play-shots.mjs` with `MASK=1`, desktop 1280×800, chase view, bike (`MODE=car`) and boat,
  same seed and pose in both modes. The player stands 6–45 m out on the face's outward normal (bearing
  `northOffsetDegrees + 180`) and looks 30–45° off square. Every place was shot at the default chase zoom (0.65)
  and at `CAMZOOM=1.4`. The table uses 1.4 because 0.65 leaves too few chunk pixels. The 0.65 numbers agree
  except at Utrechtsestraat, where the far framing caught a different part of the face.
- Wall pixels come from `frameRegions.regionOfMask`. A second ID pass gives the chunk's own pixels: only the named
  `face-<id>` meshes draw normals. A third gives the generic ones: only the `facades` (three-building) layer draws.
  - **chunk**: chunk wall pixels in the flag frame.
  - **neighbours**: the generic extrusion walls in the same flag frame.
  - **default**: the default frame's walls at the chunk's screen pixels, i.e. what draws there today.
- Photo: median of the face's `strip.jpg` from 1 m above the ground to 75 % of the face height, with black
  (missing panorama) pixels dropped. Strips are overcast panoramas at different exposures. Compare each face
  with its own strip, not one strip with another.
- Values are median luma / median chroma (Rec. 709, 0–255) and the share of wall pixels under luma 60.

**Mask caveat, which also applies to `scripts/look/region-mask.js`.** The generic buildings hide suppressed pands
through a per-vertex `hidden` attribute (`litFacadeMaterial` VERTEX_HIDE). The mask's replacement materials ignore
it, so hidden generic prisms come back in the ID pass and cover the chunk's walls. The first pass here counted
Bilderdijkstraat chunk walls as generic for that reason. This lane's masks add the same vertex discard. The look
lane's `region-mask.js` still lacks it, which mislabels walls under every landmark. Its wall/roof split is still
right; its building attribution is not.

## Numbers (z 1.4)

| place | default (same pixels) | chunk | neighbours | photo strip | chunk ÷ photo luma |
|---|---|---|---|---|---|
| Nassaukade 318 row, bike | 78/26, 26 % | **61/25, 45 %** | 116/21, 9 % | 98/27, 14 % | 0.62 |
| Nassaukade 318 row, boat | 97/15, 15 % | **72/14, 42 %** | 136/11, 0 % (431 px) | 98/27, 14 % | 0.73 |
| Marnixstraat marnix-c, bike | 75/23, 18 % | **64/11, 12 %** | 87/23, 8 % | 98/24, 6 % | 0.65 |
| Utrechtsestraat 48-76, bike | 58/13, 53 % | **69/27, 43 %** | 89/23, 16 % | 123/25, 20 % | 0.56 |
| Oudezijds Voorburgwal 115-125, bike | 55/20, 57 % | **46/17, 90 %** | 69/25, 29 % | 71/8, 29 % | 0.65 |
| Oudezijds Voorburgwal 115-125, boat | 55/19, 55 % | **46/16, 88 %** | 68/23, 30 % | 71/8, 29 % | 0.65 |
| Bilderdijkstraat 236022-167243, bike | 96/73, 1 % | **72/44, 17 %** | 113/68, 1 % | 49/10, 65 % | 1.47 |

The same comparison at the default zoom 0.65 (chunk vs neighbours): Nassaukade bike 62 vs 110 (44 % under 60),
boat 76 vs 116, Marnixstraat 64 vs 108, Oudezijds Voorburgwal 46 vs 77 (89–94 %), Bilderdijkstraat 73 vs 118.

Reading:

- The old black is gone. The 2026-10-14 figure was 50–59 % of pixels under luma 60. Now Nassaukade 318 shows 42–45 %
  under luma 60 and the shading is visibly a brick row in sun.
- Every chunk except Bilderdijkstraat is still 13–48 luma darker than its own neighbours. It is also 0.56–0.73 of
  its own photo's luma, while the generic walls sit near or above the photo. Beside generic walls the chunk reads
  as a dark band.
- Chroma is right or low. Marnixstraat drops to 11 against a photo 24, so it reads greyer than the brick.
- Oudezijds Voorburgwal is the worst: 88–90 % of wall pixels under luma 60 against 29 % in the photo, so it
  reads as a black block. The default there is already dark (55–57 % under 60, from the dark generic tints), but
  the chunk is darker still.
- Utrechtsestraat is the one face where the chunk is brighter than what draws there today (69 vs 58, 43 % vs
  53 % under 60). It is also visibly closer to the photo: the white and stucco fronts and the gables.
- Bilderdijkstraat is lighter than its photo, which was shot in dark overcast. The rendered row is a clear
  likeness win (gables, bay, shopfronts) with only 17 % under 60.

## Ride perf (`PERF_RIDE=1 PW_PORT=4554 … ride-perf.spec.ts --project=desktop`)

The flag run used an uncommitted copy of the spec that passes `?streetChunks=1` to `openRoute`. Values are
frame interval median and p95, map render median and p95, three.js median, heap and landmarks shown.

| variant | default | `?streetChunks=1` |
|---|---|---|
| default | failed budget: map render median 4.1 > 4 ms (first, cold run) | 16.7/16.8, map 3.4/6.8, three 1.2, 765 MB, 77 shown |
| default (repeat) | 16.7/16.7, map 3.2/6.6, three 1.1, 767 MB | 16.7/16.8, map 2.1/3.3, three 0.6, 748 MB |
| landmarks off | map 3.3/6.1, 743 MB | map 2.8/5.9, 780 MB |
| all landmarks resident | 466 shown, map 5.7/11.9, three 2.6, 954 MB, 0 over 50 ms | 488 shown, map 7.6/13.6, three 2.9, **1,057 MB**, 1 over 50 ms |

The seeded perf route never comes near a chunk: 77 landmarks are shown in both modes. Normal riding is therefore
within noise. The default-mode budget failure is noise, not a flag effect: it came on the first, cold run of the
unflagged spec, and the repeat passed at 3.2 ms. The cost appears when the chunks are resident: +22 models,
+103 MB heap, and map render median +1.9 ms in the all-resident stress. A rider meets this only on Bilderdijkstraat
and Nassaukade, where the 2–44 k triangle faces cluster.

## Recommendation

Bring back some faces, not all of them, and not by flipping the default for every face.

- **Bring back Utrechtsestraat 48-76 and the Bilderdijkstraat faces.** Bilderdijkstraat was measured on
  236022-167243; its neighbour faces draw in the same frames and look the same. Both are equal to or brighter
  than what draws there today, read as their photos, and have a near-black share at or below the default's.
- **Keep Nassaukade 318, Marnixstraat (marnix-c) and Oudezijds Voorburgwal 115-125 retired.** They are no longer
  black, but they are 0.62–0.73 of their photo's luma and 30–50 luma below the generic walls beside them.
  Oudezijds Voorburgwal still has 88–90 % of its wall pixels under luma 60. Fix one of these first: lift the
  chunk's measured tints through the same white-point and exposure path the generic walls got, or add shadow
  fill on the Lambert chunk material. Then re-measure with this lane's masks.
- Per-face selection needs a small allowlist in `streetSurveyMode` / `applyStreetChunks` (integrator lane). A
  face-id list in the manifest, e.g. `defaultOn: true`, would keep the flag for comparison.
