# Ground tones of a sunny Amsterdam afternoon (2026-10-14)

The user said "city too dark" about own ground. After the light lane's
1.208 ground gain, the boat spot read road 99, pavement 150 and water 105,
against 234, 246 and 187 on the legacy basemap. This note measures real
ground tones from open data and compares three palette variants behind
`?groundLook=measured|bright|legacy-ish`. The default stays as it is until
the user picks one.

## Method

`scripts/own-ground/measure-ground-tones.ts` (`npx tsx …`):

- **Orthophoto.** PDOK luchtfoto RGB `Actueel_orthoHR` at 7.8 cm/px
  (EPSG:3857 tiles of 128 m × 1000 px, cached in
  `artifacts/ground-look/pdok-ortho-8cm/`, 126 tiles). Sampled at three
  places, each a 220–260 m radius: Singelgracht/Nassaukade (4.8790,
  52.3785), Houtmankade (4.8850, 52.3890) and Prinsengracht/Westerkerk
  (4.8840, 52.3740).
  - **Labels** come from the own-ground OSM cross-section bands: the middle
    half of each band, every metre, with bridges and tunnels skipped.
    Water samples lie inside canal polygons, at least 8 m from any shore.
  - **Label noise.** Band offsets are priors, so each class keeps only
    pixels whose chroma could belong to it (asphalt sat < 0.12, pavement
    < 0.2, klinker warm, cycle r ≥ g+14 and r ≥ b+14). Tree crowns are
    dropped. The gate removes neighbours of a different kind but never
    decides the luma.
  - **Dehaze.** The aerial carries a blue path radiance: its darkest
    0.1 % sits at [33, 48, 65]. That is subtracted in linear light and
    rescaled so white stays white.
  - **Shade correction.** Otsu's threshold on each class's luma splits
    sun from cast shadow. The upper class is the flat-sunlight tone.
    Water has no split (its upper class is boats and glints), so it uses
    the median of all its samples.
- **Panoramas.** The bottom fifth of the 155 city panorama views
  archived with the reference walls
  (`map-recall2-source-data/pand-reference-walls/*/*.thumb.jpg`, CC BY 4.0).
  Only homogeneous 20 px patches are kept (luma s.d. < 10), classed by
  hue alone. Treat these as a cross-check: their exposure is set by the
  sky and facades.

## Tones (sRGB median, luma = Rec. 709 on sRGB)

| surface | source | n | median (luma) | sunlit median (luma) |
|---|---|---|---|---|
| asphalt | PDOK ortho, dehazed, 3 places | 8 255 | 162,160,151 (160) | **168,166,157 (166)** |
| pavement (sidewalk tiles) | PDOK ortho, dehazed, 3 places | 29 583 | 151,144,133 (145) | **172,164,151 (165)** |
| klinker (brick carriageway) | PDOK ortho, dehazed, 3 places | 11 963 | 155,142,131 (144) | **160,146,135 (148)** |
| cycle red asphalt | PDOK ortho, dehazed, 3 places | 2 741 | 182,163,149 (166) | **185,165,151 (168)** |
| canal water (nadir) | PDOK ortho, dehazed, 3 places | 3 392 | **50,55,55 (54)** | – |
| grey ground (asphalt + tiles) | panoramas, 155 views | 11 182 | 91,88,86 (88) | 144,147,142 (146) |
| brick-brown ground (klinker) | panoramas | 12 914 | 82,71,67 (73) | 173,153,140 (156) |
| red ground (cycle) | panoramas | 621 | 71,35,32 (42) | 71,51,44 (55) |

Results per place for the sunlit luma (asphalt / pavement / klinker /
cycle / water):

| place | asphalt | pavement | klinker | cycle | water |
|---|---|---|---|---|---|
| Singelgracht | 165 | 162 | 143 | 164 | 64 |
| Houtmankade | 165 | 167 | 154 | 172 | 51 |
| Prinsengracht | 188 | 166 | 153 | 180 | 56 |

**Findings.**

- From above, sunlit Amsterdam ground is bright and nearly one
  lightness. Asphalt, pavement and red cycle asphalt all sit at luma
  ~165, and klinker ~148. The legend therefore lives in hue, not
  lightness.
- The cycle red is a faded salmon in the aerial (chroma 11). The
  panoramas show it as a deep red (hue ~30°, chroma ~19, exposed dark).
- Canal water seen straight down is near-black and neutral (luma 54).
  From a street, the water reads grey-green because it reflects the sky,
  which a matte material cannot do.
- Today's asphalt (luma 88) is half the measured value. The legacy
  basemap's 234 is brighter than anything measured.
- **Default already misses the legend bar.** Asphalt/klinker is ΔE76
  18.5 in today's palette.

## Variants (`src/canalRecall/ownGround/groundLook.ts`)

| look | asphalt | pavement | klinker | cycle | water | ΔE asph/cyc · asph/kl · kl/cyc |
|---|---|---|---|---|---|---|
| default | 86,88,93 (88) | 174,162,152 (164) | 122,90,80 (96) | 150,66,58 (83) | 46707c (104) | 42.7 · **18.5** · 25.7 |
| measured | 168,166,157 (166) | 172,164,151 (165) | 172,133,108 | 242,145,142 | 50,55,55 (54) | ≥ 20 all |
| bright | 132,130,124 (130) | 183,174,161 (175) | 138,101,78 | 204,107,106 | 104,122,114 (118) | ≥ 20 all |
| legacy-ish | 202,200,193 (200) | 222,214,202 (215) | 199,159,134 | 255,167,163 | 154,175,167 (170) | ≥ 20 all |

- **measured** uses the orthophoto sunlit medians. It adds a legend
  floor: klinker and cycle chroma are raised, cycle along the
  panoramas' red hue, until the three surfaces are ΔE ≥ 20 apart, with
  luma kept.
- **bright** keeps the measured hues, with the road at 130, pavement at
  175 and a grey-green canal.
- **legacy-ish** heads toward the legacy basemap.
- **Land, paving and squares** are lifted in all three variants, because
  the quays and wide pavements are mostly `land`.
- **What does not change:** paint, rails, bollards, parks, trees and
  facades.
- **Where the look applies:** near-ring materials, the far ring (through
  the worker's init message) and the basemap recolour beyond the ring.

## Frames

`docs/images/ground-look-20261014/` contains these sheets:

- `singelgracht-boat.jpg`
- `prinsengracht-boat.jpg`
- `frederik-hendrikbuurt-bike.jpg`

Each sheet has the columns default | measured | bright | legacy-ish |
legacy basemap (`?ownGround=0`). The luma regions are outlined in
magenta. Raw frames are in `artifacts/ground-look/frames/`. Tools:
`scripts/live-play-shots.mjs` (port 4520) and
`scripts/ground-look-sheet.mjs`.

| place | look | scene | road | pavement | klinker | cycle | water | facade |
|---|---|---|---|---|---|---|---|---|
| Singelgracht | default | 131 | 110 | 144 | 103 | 99 | 105 | 117 |
| | measured | 130 | 169 | 153 | 136 | 171 | 57 | 118 |
| | bright | 139 | 145 | 156 | 110 | 138 | 119 | 117 |
| | legacy-ish | 157 | 199 | 163 | 159 | 189 | 170 | 116 |
| | legacy basemap | 176 | 240 | 223 | 237 | 249 | 187 | 120 |
| Prinsengracht | default | 128 | 88 | 157 | 109 | – | 102 | 114 |
| | measured | 128 | 158 | 158 | 129 | – | 55 | 114 |
| | bright | 133 | 125 | 168 | 118 | – | 115 | 114 |
| | legacy-ish | 142 | 189 | 206 | 161 | – | 166 | 114 |
| | legacy basemap | 153 | 230 | 239 | 237 | – | 187 | 108 |
| Frederik Hendrikstraat | default | 125 | 90 | 140 | – | 101 | – | 96 |
| | measured | 132 | 165 | 145 | – | 171 | – | 96 |
| | bright | 129 | 130 | 154 | – | 139 | – | 96 |
| | legacy-ish | 137 | 198 | 168 | – | 189 | – | 96 |
| | legacy basemap | 157 | 237 | 245 | – | 247 | – | 95 |

Facade luma is the same in every own-ground column. At the Prinsengracht
and the Frederik Hendrikstraat it is identical; at the Singelgracht it
varies by ±1 because the boat frames shift a few pixels between runs.
The code does not touch facades. `test:fit-golden` reports all 148
recipes identical, and `test:look` passes.

## Verdict (looked at gallery size)

- **measured** is wrong as a game look, even though it is the data.
  Streets and pavements merge into one light beige. The canal becomes a
  black slot that reads as a hole, not water. Its value is the finding:
  real street lightness is near 165, and the legend is hue.
- **legacy-ish** gets closest to the basemap's airiness, but it washes
  out. Road, pavement and klinker sit within a few luma of each other, the
  cycle red turns candy-pink, and the frame loses the ground contrast that
  carries the driving corridor.
- **bright** is the best of the three.
  - The canal finally reads as Amsterdam's grey-green, not teal.
  - Roads become a mid grey that still separates from the pale
    pavements.
  - The red cycle tracks and the brick quay stay distinct.
  - The scene lifts by +4–8 luma overall while the buildings keep their
    weight.
  - On the Frederik Hendrikstraat the street finally reads as daylight
    asphalt instead of a dark slab.

**Recommendation: make `bright` the default.** It also fixes the
default's asphalt/klinker ΔE 18.5. If the user still wants it lighter,
the next step is a bright+ that keeps bright's water and hues with the
road at ~150 (the measured lightness is 165). legacy-ish shows that going
further costs the legend. Bright's cycle red (204,107,106) is a little
salmon; a slightly deeper red (~190,96,92) would keep ΔE and look more
like fresh Amsterdam red asphalt.

Perf: the variants change base colours only, with the same materials,
textures and geometry, so the desktop ride cost is unchanged by
construction. No separate perf run was made.
