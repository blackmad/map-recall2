# Sculptures: photo impostors and splats

Statues are not boxes. The backlog has 38 `treatment: sculpture` items
(filter "Sculpture (splat)" in `landmark-queue.html`). This page covers the
pipeline, the De Dokwerker pilot (2026-10-13), the numbers, and what the
other 37 need. Earlier history: the 2026-10-09 splat pilot in `HISTORY.md`
and `docs/landmark-splat-reference-pilot.md`.

## What runs

`?sculptures=1` (or `window.__canalRecallSculptures = true`) turns on the
shared frame and loads `public/canal-drive/sculptures/sculptures.bundle.js`
(16 KB, global `CanalRecallSculptures`) and `sculptures/manifest.json`. Each
manifest entry is one statue:

- **near LOD** (within `nearM`, default 50 m, back to far past 55 m): a mesh
  plinth plus a reconstruction of the figure, either
  - `impostor`: real photographs from several sides on one camera-facing
    quad (`src/canalRecall/sculptures/impostor.ts`), or
  - `splat`: a Gaussian splat (`splatMesh.ts`, `splatFormat.ts`,
    `splatSort.ts`), for statues whose photos support one;
- **far LOD**: the existing hand-built landmark model, untouched. The near
  LOD hides it per frame only once the reconstruction has loaded, so the
  plinth is never empty.

Picking is unchanged. The hidden hand model is still raycast by
`SignatureLandmarks.inspectAtScreen`, so a click on the statue returns its
landmark id (`extract_landmarks_1098130181` for De Dokwerker).

The mount is 13 lines in `vector-map.js`: the flag read (which implies
`sharedFrame`), one call after load, and `_ensureSculptures()`. With the flag
off nothing is fetched or registered.

### Impostor

`scripts/sculptures/build_impostor.py` bakes the atlas from
`scripts/sculptures/<id>/impostor-views.json`: one photo per camera azimuth
(0 = in front of the figure, + toward the figure's own left hand), each with
a rough crop box.

1. rembg cuts out the statue (U²-Net; IS-Net per view when U²-Net loses a
   part against foliage). The largest component is kept.
2. The plinth top is the first row below the upper third where the mask
   widens into a block. `plinthTopY` overrides it.
3. The figure is scaled to a fixed height, its feet are centred, and it is
   written into a 256×512 tile.
4. Luminance is histogram-equalised inside the mask, then tinted bronze
   (`tone`, `gamma`, `tint`). 2013 colour photos and 1950s–80s Anefo scans
   then read as one statue instead of flicking between sepia, grey and green.

At runtime the quad turns about the vertical axis to face the eye, and the
tile is chosen by the eye's azimuth around the figure's `facingDeg`.
Neighbouring tiles cross-fade only in a band of 12% of the gap around the
midpoint. A plain linear blend of two photos taken 45° apart draws two
figures (the 2026-10-09 pilot's ghosting). The impostor is alpha-tested and
depth-written, so it sorts with the city like a mesh. It is unlit (the photos
carry their light) and casts no shadow. The plinth does both.

### Splat

`MRSPLAT1` is 17 bytes per splat: quantised position, log-scale, sRGB
colour + opacity, and quaternion. It is column-major and needs no decoder
library. The renderer keeps everything in data textures and draws one
instanced quad per splat. It projects each 3D covariance with the Jacobian
of the whole clip ← local matrix, so it works under the shared frame's
identity view matrix without a focal length. It blends premultiplied
back-to-front after a CPU counting sort, and re-sorts only when the eye
moves more than 5 cm or turns more than 0.02 rad. Sorting 150k splats takes
under 10 ms in the unit test on this machine. No splat ships yet; the format
and renderer are tested (`sculptures.test.ts`) and wait for a statue with a
consistent photo set.

## De Dokwerker (Mari Andriessen, 1952, Jonas Daniël Meijerplein)

### Photo set

`scripts/sculptures/fetch-commons.ts dokwerker` indexes `Category:De
Dokwerker` (depth 2) into `scripts/sculptures/dokwerker/sources.json`, with
licence, author, date, size and sha1 per file. It checks each licence
against `licences.ts`: CC0, PD, CC BY and CC BY-SA are admitted; NC, ND and
unknown licences are refused.

| | |
| --- | --- |
| Files | 279 (278 photos + 1 webm, skipped) |
| Admitted | 278: 259 CC0 (Anefo / Nationaal Archief), 12 CC BY-SA 4.0, 2 CC BY-SA 3.0, 1 CC BY-SA 3.0 nl, 2 CC BY 4.0, 1 CC BY 3.0, 1 CC BY 2.5 nl, 1 PD |
| Decades | 1950s 41, 1960s 90, 1970s 80, 1980s 48, 1990s–2020s 19 |
| Colour | 20, of which 7 are one 2013 front-arc series (A.A.W.J. Rietman) |
| Not the statue | maquettes (a087, a130, a131), a wooden copy (a137), portraits and crowd shots |
| City panoramas | rejected in the 2026-10-09 pilot: the nearest are 28–36 m away and the statue is ~25 px tall |

The images are not in the repo. They are in
`~/Code/map-recall2-source-data/experiments/sculptures/dokwerker/images/`,
named as the pilot's COLMAP model knows them.

**Angular coverage, by eye.** The front arc (−45° to +45°) is well covered,
by the colour set and the 1961 Anefo series. Both sides (±90°) have usable
views. Behind-left (+135°) and behind (180°) are well covered, because every
commemoration was photographed from the square. Behind the figure's right
shoulder (−135°) there is **no usable photo**.

**Why no camera-pose coverage.** The 2026-10-09 COLMAP 4.2.1 run registered
214 of these photos with 0.6 px mean reprojection error. `coverage.ts` tests
the poses at the statue. The feet and head, hand-labelled in 7 photos
(`labels.json`), do not triangulate to one place:

- median ray miss: 1.59 model units;
- figure height: 1.09 units;
- one point lands behind its own camera.

The registrations matched backgrounds (bare trees, façades) across four
decades, not the bronze, which is textureless and was usually surrounded by
crowds. That explains why the pilot's splat looked like a ghost. An attempt
to mask the statue for a masked retrain found the "statue column" taken from
the pilot splat was not the statue either (`review-sheets/dbg-axis.jpg` in
the archive).

### Chosen path: a 7-view photo impostor

A splat needs poses that agree at the statue, and these do not. Re-running
COLMAP on statue masks would need masks, and the masks need the poses. The
handoff's fallback, a baked impostor, works from the photos directly and
does not depend on the poses.

| View | Photo | Source |
| --- | --- | --- |
| 0 | a007 | Rietman 2013, CC BY-SA 4.0 |
| +45 | a004 | Rietman 2013, CC BY-SA 4.0 |
| +90 | a073 | Bert Verhoeff / Anefo 1972, CC0 |
| +135 | a053 | Jack de Nijs / Anefo 1968, CC0 |
| 180 | a061 | Joop van Bilsen / Anefo 1964, CC0 |
| −90 | a059 | Hugo van Gelderen / Anefo 1961, CC0 |
| −45 | a057 | Hugo van Gelderen / Anefo 1961, CC0 |

Two views were rejected after a bake:

- a127: the head was lost against the foliage;
- a121: the figure is 130 px tall, and it faces away-left, so it is +135,
  not −135.

**Facing.** `facingDeg` is 252 (WSW). It comes from the city panoramas: a
camera at heading 67–77° sees the figure's front. The eye-level shots agree.
From the front, the low Portuguese Synagogue annexes are behind the statue,
as in the 2013 photos. From behind, the Joods Museum is in view.

**Plinth.** 1.1 × 1.2 × 1.55 m, dark granite. The size is read off a058 and
a059 against the 2.6 m figure.

**Licence.** The atlas, `dokwerker-impostor.webp` (1024², 210 KB), is a
derivative of two CC BY-SA 4.0 photos, so it is CC BY-SA 4.0. Credits per
view are in `manifest.json`; the integrator should add a NOTICE line. The
sculpture itself is in copyright (Andriessen †1979). Dutch freedom of
panorama (Auteurswet art. 18) covers reproducing a work permanently placed
in a public place as it stands there; the Commons photos rely on the same
article.

### Numbers (desktop, 1440×900, local Chrome, headless)

At the statue: 14 m away, eye 1.7 m, `sculptures.spec.ts`. The second row
is the same camera with the layer disabled, which is the hand model.

| | frame median / p95 | shared-frame main pass median / p95 | sculpture update |
| --- | --- | --- | --- |
| impostor (near) | 16.7 / 16.8 ms | 0.6 / 0.7 ms | < 0.1 ms (below timer resolution) |
| hand model | 16.7 / 16.8 ms | 0.6 / 0.7 ms | — |

One extra draw call (the quad) and one 1024² texture. The plinth replaces
the hand model's plinth.

The ride uses `scripts/ride-perf-fixed-route.mjs`, Anne Frank Huis →
Rijksmuseum, desktop, 12 s. The route does not pass the statue, so this
measures the cost of the flag when no statue is in range:

| run | frame median / p95 | MapLibre render median / p95 | three layers ms/frame | draw calls | errors |
| --- | --- | --- | --- | --- | --- |
| `?sharedFrame=1` #1 | 16.7 / 16.8 | 2.3 / 3.3 | 1.03 | 407 | 0 |
| `?sharedFrame=1&sculptures=1` #1 | 16.7 / 16.8 | 2.6 / 3.5 | 1.17 | 407 | 0 |
| `?sharedFrame=1` #2 | 16.7 / 16.7 | 3.4 / 4.2 | 1.48 | 407 | 0 |
| `?sharedFrame=1&sculptures=1` #2 | 16.7 / 16.8 | 3.6 / 5.3 | 1.67 | 407 | 0 |

Run-to-run spread (base #1 vs #2: +1.1 ms render) is larger than the
flag's difference (+0.2–0.3 ms within each pair), so off-route cost is
within noise: the participant does one distance test per statue per frame
and draws nothing. Heap varied 732–1021 MB with no pattern.

iPhone (4× CPU throttle): **pending**, per the desktop-first rule.

### Shots

`SCULPTURES=1 PW_PORT=<port> npx playwright test sculptures --project=desktop`
writes to `artifacts/sculptures/`:

- `desktop-eye-az{0,45,90,135,180,-135,-90,-45}.png`: eye height 1.7 m,
  14 m away;
- `desktop-gallery-az*.png`: the same shots at 360 px wide;
- `desktop-card*.png`: a higher view;
- `desktop-far-80m.png`: the hand model is back;
- `desktop-flag-off.png`: the hand model, for comparison.

The first test asserts that with the flag off nothing loads. It also
asserts that a mounted-but-disabled layer leaves the square's canvas
pixel-identical: 0 differing pixels, with a 0-pixel noise baseline between
frames.

## Limits and known issues

- **Impostor parallax.** The figure is flat. Walking around it, the view
  changes in 45° steps, with a short cross-fade. From above (the gallery
  card) the figure looks like a cut-out. There is no top view; the street
  is what matters.
- **No −135° photo.** That arc shows the −90° or the 180° photo.
- **Photo defects in the views.**
  - a004 (+45°) keeps a lamp-post fragment by the right leg.
  - a073 (+90°) has a washed-out head, shot against the sky.
  - a053 (+135°) has a branch by the hand.
- **No figure shadow.** The hand model's shadow goes with it while the
  impostor is shown. One way to keep a shadow: a shadow-only caster (the
  hand model with `colorWrite = false`).
- **Unlit.** The impostor ignores the sun direction; the tone is fixed at
  bake time.

## What the next 37 need

1. **Photos per side, not per count.** Thirty photos of one commemoration
   from the same corner are worth less than one photo from each side. Check
   the four quadrants by eye before anything else (`sheets.sh`-style
   contact sheets; 10 minutes per statue).
2. **Test poses at the statue before training.** Label feet and head in 5–7
   photos, add them to `labels.json`, and run `coverage.ts`. Train a splat
   only if `registrationCheck.consistent` is true. That needs a set from a
   few dates with the statue large in frame: modern walk-around series on
   Commons (like Rietman's) qualify; event scans do not.
3. **Otherwise impostor.** Most of the backlog statues are smaller and
   photographed from fewer sides than De Dokwerker. A 4–8 view impostor
   takes about an hour per statue:
   - pick the views;
   - write rough boxes;
   - bake;
   - inspect `impostor/review/`;
   - fix with `plinthTopY` or `model`;
   - check eye-level shots in the game.
4. **Facing from a panorama.** The city panoramas are too far away to
   reconstruct from (28 m+), but they fix the heading.
5. **Manifest entry**: anchor (the OSM node), `handModelId`, `landmarkId`,
   plinth size from a photo with a known scale, and credits.
6. **Capture.** For the most-visited statues (Rembrandt-, Thorbecke-,
   Multatuli, Vondel-), a contemporary walk-around of 30–60 frames is the
   way to a real splat. It is a bounded fieldwork task, not a data-mining
   one.

## Files

| Path | Role |
| --- | --- |
| `src/canalRecall/sculptures/` | runtime (layer, impostor, splat, LOD, licences, coverage maths) + `sculptures.test.ts` |
| `scripts/sculptures/fetch-commons.ts` | Commons index + download (`--cache` adopts files already on disk) |
| `scripts/sculptures/coverage.ts`, `colmap.ts` | colour/registration facts, pose check at the statue |
| `scripts/sculptures/build_impostor.py` | atlas baker (`uv run --with "rembg[cpu]==2.0.67" --with pillow`) |
| `scripts/sculptures/build-bundle.mjs` | `sculptures.bundle.js` (not in package.json yet; the integrator may add `build:canal-sculptures`) |
| `scripts/sculptures/dokwerker/` | `config.json`, `sources.json`, `labels.json`, `impostor-views.json` |
| `public/canal-drive/sculptures/` | `manifest.json`, atlas + layout, bundle |
| `tests/e2e/sculptures.spec.ts` | flag-off pixel identity, flag-on look, picking, LOD, perf at the statue |
| `~/Code/map-recall2-source-data/experiments/sculptures/dokwerker/` | images (82 MB), COLMAP model, the 2026-10-09 splat PLYs, impostor PNG + review overlays, contact sheets (not committed) |
