# Lane: colour fixes, De Pijp fronts and painted fronts (#121, 2026-10-30)

Branch `lane/colour-fixes-20261030`. Follows #118 (`lane-buurt-lightness-20261029.md`).

## Diagnosis (before any change)

`GAP_PROBE=1` on the 8 spots (4 named + 4 controls) found that no probed front carries `facadeMappedColour`, a
measured `sideColour`, `periodWallHex` or a recipe. Only 2 block-face chunks are installed in these streets
(`chunk-face-saenredam-62-66-r1`, `chunk-face-steen-84-140-r2`), and the camera is not on either. Every visible front
is drawn by `bayLookFor` from the **generic buurt profile** wall (`profileWall` = the drawn wall for every probed pand).

- **Saenredamstraat (KE01 Frans Halsbuurt):** the profile's c19 walls were `#823e37` x61 of 103, L* 33 C* 34. 87 of
  its 103 fronts were block-face houses, coloured from their **type palette** brick (58 x `pijp-1879-five-low`
  `#6a4a3e`, L* 35 C* 17). That palette is a kit colour (fitted so the chunk renders cityWallTint(brick) like the
  photo), but derive read it as a photo measure: the `blockface` source got chroma x0.60 and the city transform
  x5.79 (thumbnail brick median C* 4.8 -> palette), net x3.5, so every type brick landed on the C* 34 clamp with hue
  rotated 47 -> 32 deg: saturated red. #118's "profile moves 0-20 %" was true because #118 did not touch this path.
- **Tweede Jan Steenstraat (KE05 Hemonybuurt):** thumbnails only (17); brick read L* 40-57 C* 3-5 and lifted to
  C* 18-29 at hue 42: `#886156`/`#9a6b59`/`#af7c5f`, rosy brown.
- **Stalpertstraat (KE02 Gerard Doubuurt):** thumbnails; 46 % painted, plus `#ffdacc` (pink-white) swatches.
- **Kerkstraat (AG wijk pool):** light walls classed brick by `photoPainted` on the raw thumbnail colour. A contact
  sheet of 30 light centre thumbnails showed raw L* 44-63 is nearly all brick, while white and cream fronts read
  L* 73-92 with C* 4-24 and usually no lighter trim. Cream/buff walls (C* >= 14) failed the C* < 14 paint test, went
  through the brick chroma lift and clamped at L* 72 C* 34 (`#d89776`, `#dfa07b`, `#e3a280`). A second source: a
  lightness slice mixing light brick and white paint took the median a/b of both (`#ffcfa9` peach).
  208 swatches across the 635 era profiles were L* > 62 C* > 25.

## What changed (commit b78e077a3)

- `src/canalRecall/buurtProfiles/paintClass.ts` (new, typed, 6 tests): wall normalised to ONE white point, the light
  trim reference measureFacade uses (trim -> 215, gain 0.75-1.45): the sample's own trim when it is real trim
  (>= 25 L* lighter), else the city white point (median thumbnail trim, level 165). A lift never passes the white point.
  Painted = L* >= 62 and (C* < 14, or cream/buff hue 60-110 with C* < 30), or the old cool-grey rule. Sunlit red
  brick stays brick.
- `scripts/buurt-profiles/derive.ts`:
  - thumbnails and panorama walls use `classifyWall`; a painted swatch carries the normalised colour;
  - block-face houses take their wall from the archived **strip** (`faceStripPalettes`, per-pand wall median, trim =
    the pand's accent class) as source `strip`, fitted onto the thumbnails like any photo (27 shared pands: dL -1.1,
    C x0.77). Houses without a strip keep their traits but give no colour;
  - per-source paint cast removed before the half tint (strips b* +21: white drew cream-yellow);
  - brick and paint swatched apart, slots in proportion.
- `src/canalRecall/buurtProfiles/exposure.ts`: `BRICK_MAX_L` 60 (was 72; thumbnail brick reads 25-55).

Type palettes (`scripts/block-face/types/de-pijp/*.json`) are **not** changed: they are kit colours judged by
chunk-render likeness, and the defect was reading them as photo colours. So no chunk recompiles, no roof-golden or
fit-golden moves.

## Measured

| profile | before (c19) | after |
|---|---|---|
| KE01 Frans Halsbuurt | L43 C30, painted 0.10, `#823e37` x61 | L53 C14, painted 0.36: `#55352c #5b3b33 #60433b #684a41 #8a4a40 #965f4d` + whites |
| KE05 Hemonybuurt | L42 C20 painted 0.29 | L45 C15 painted 0.35 (greys replace two pinks) |
| KE04 Sarphatiparkbuurt | L37 C28 | L38 C24 |
| AG Grachtengordel-Zuid | L37 C27, 12 % salmon | L40 C24, 0 % salmon |
| AB10 Elandsgrachtbuurt | 13 % salmon | 0 %, light swatch `#eedacb` |
| EP02 Bellamybuurt-Zuid (control) | L37 C33 | L32 C28 (darker: block-face strips) |

Salmon swatches (L* > 62, C* > 25) across all profiles: 208 -> 0. Thumbnail painted: 549 -> 721 of 2792.

Sheet: `docs/images/look/colour-fixes-8spot-20261030.jpg` (photo | before | after).

## Still wrong

Visual verdict from the sheet (after = profiles published locally and the three-buildings bundles rebuilt from this
tree; the ground also changed between runs because the rebuilt bundle carries main's newer road-look source, ignore it):

- Saenredamstraat: better. Saturated red gone; right side dark brown plus a white front, one mid red-brown remains.
- Tweede Jan Steenstraat: **not fixed.** The left side still draws rosy brown (same picks; KE05 is thumbnails only and
  its brick reads L* 40-57, so it stays mid brown-pink after the chroma lift).
- Stalpertstraat: better. The right side is dark brown (was red), the left white/light (was red and pink).
- Kerkstraat: partial. No salmon, a light tan front on the right; the left still draws dark red where the photo is
  white and grey (those pands are drawn from the AG wijk pool, painted 0.17, and the hash picks brick for them).
- Controls: Ten Katestraat unchanged; Eerste Looiersdwarsstraat left pink -> dark brown (closer); Runstraat
  unchanged plus a grey; Bellamystraat left gains a white front beside dark brick. None worse on the sheet.

Also known: the city brick chroma lift (x5.4 on thumbnail
C* ~5) still sets De Pijp brick at C* 14-24 where the photos read nearer purple-grey; KE01 painted share 0.36 is high
for Frans Halsbuurt (strip "wall" medians on sunlit/overexposed strips classify as cream); 29 faces have no archived
strip (Boterdiep and others; their houses now give traits only).

## Integrator

1. Strips: `git -C ~/Code/map-recall2-source-data archive origin/main block-face-strips | tar -x -C staging/bfs` and
   link each into `staging/block-face/<face>`; 167 faces are only in `../type-libraries-20261029/staging/block-face/`
   (not archived: archive them to source-data). `staging/buurt-profiles/pano-samples.json` from
   `../generic-uplift-20261029/staging/buurt-profiles/`.
2. `node --import tsx scripts/buurt-profiles/derive.ts --publish` (expect `strip dL -1.1 C x0.77`, revision
   `# Buurt profiles` hash differs; salmon count 0).
3. `npm run build:canal-three-buildings` (both bundles embed the profiles JSON). Bump the asset stamp.
4. `node --import tsx --test src/canalRecall/buurtProfiles/*.test.ts` (26 pass on the regenerated set).
5. No covers, chunk installs or goldens change.
