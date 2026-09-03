# Colouring the whole city, not a few buildings well

A separate attempt on `feat/building-colour-coverage`, deliberately aimed at the
opposite end of the problem from `feat/roof-enrichment` and
`feat/building-enrichment`. Staging only: nothing here publishes into
`public/data/extracts/`, and nothing here renders yet.

## What the two earlier branches settled

Both measured a few buildings precisely, and both concluded the same thing.

`ROOF_ENRICHMENT.md` ran a 140-building aerial pilot across the centre, De Pijp,
Oud-West and Houthaven, and stopped on purpose: much of the roofscape is
genuinely dark grey, one colour per BAG footprint blends planes, dormers, glass
and solar, and *"at the intended oblique street/canal viewpoints, correct roof
shape and a few distinctive materials matter more than small per-building colour
shifts."*

`feat/building-enrichment` went after façades from municipal panorama imagery,
built a reviewed-evidence gate around a vision classifier, and was merged to
`main` and reverted the same day (`0604dca`, `24c8beb`).

Neither conclusion is wrong. But they answer *how well do we know one building*,
and that is not why the city looks grey.

## Why the city looks grey

Measured on `main`, 2026-09-01:

- `buildings-colored.geojson` carries **10,578** Amsterdam buildings, of which
  **5,778** have an aerial roof sample (`roofSource: "aerial"`).
- Every other building in the city is drawn by `building-3d` from the basemap
  tiles, and `buildingStyle.ts` colours it with a **four-stop grey ramp keyed on
  height**. A 1650 canal house and a 1975 office block are the same beige if
  they are the same height.
- Those 10,578 also have **invented heights**: `build-osm-building-appearance.ts`
  falls back to `levels * 3`, or a flat 9 m.

So the gap is coverage and it is roughly an order of magnitude, and part of the
skyline is guessed on top of that.

## The bet

Give **every** building a defensible colour and a measured height, and label
exactly how each was arrived at. A measurement always wins; a construction year
is a prior and is recorded as one, so nothing downstream can launder a guess
into evidence. `src/canalRecall/buildingAppearance.ts` resolves walls and roofs
*separately*, because the aerial sampler measures roofs and cannot see walls at
all — the common outcome is a measured roof over a prior wall, and one combined
confidence would hide that.

The prior is construction year, on the hypothesis that Amsterdam's stock is
strongly era-coded: pre-1800 red-brown brick, the 19th-century ring, the deep
orange-red of the Amsterdamse School, pale post-war brick and concrete panel,
then contemporary glass and panel. That hypothesis is tested below, and it does
not hold up as stated.

## Source: 3DBAG, and why tiles

3DBAG is BAG-keyed, CC BY 4.0, and carries `oorspronkelijkbouwjaar` plus roof and
ground levels derived from AHN laser altimetry — so one source supplies the
identity to join on *and* the two things the renderer currently invents.

`api.3dbag.nl` is not usable for this: it caps a page at **50 features** and took
**39 seconds** to answer for one square kilometre holding 5,531 buildings. That
is about 72 minutes per km² against roughly 220 km² of Amsterdam. The
`BAG3D:tiles` WFS index instead publishes per-tile CityJSON downloads with a
version (`v20250903`), a sha256 and a building count, so
`build-3dbag-appearance.ts` uses those and verifies each file against its digest.

## Measured result: coverage is real, the palette is not

**Coverage.** 33 tiles over central Amsterdam (`--bbox=4.855,52.355,4.935,52.395`):

| | count | share |
| --- | ---: | ---: |
| buildings | 42,534 | |
| usable construction year | 42,130 | 99.1% |
| measured height (AHN) | 42,314 | 99.5% |
| rejected height | 220 | 0.5% |
| footprint | 42,534 | 100% |

That is **four times the whole city's current appearance coverage from central
Amsterdam alone**, and its heights are measured rather than `levels * 3`.

**The palette does not survive its own test.** `check-era-separation.ts` joins
these to the colours on `main` by point-in-polygon — an OSM centroid must fall
inside exactly one BAG footprint — and reports the measured colour per era:

    ## wall (OSM building:colour)          joined 329
      pre-1800 centre      104   #bd8161   lum 139.4
      Amsterdamse School   157   #bd8161   lum 139.4
      19th-century ring     42   #bd8161   lum 139.4
      spread: luminance 0.0, warmth 0

    ## roof (PDOK aerial sample)           joined 143
      pre-1800 centre       40   #5e626e   lum  98.0
      19th-century ring     26   #626772   lum 102.7
      Amsterdamse School    57   #7b7882   lum 121.4
      spread: luminance 23.3, warmth 9

The wall row is **not evidence and must not be read as one**. `#bd8161` is
literally the `brick`/`masonry` constant in `buildingStyle.ts`, and it accounts
for 3,707 of the 10,578 features (`#d48741`, the next most common, is the `wood`
constant). The extract's `colour` is largely *derived from material tags*, so
that test compared a constant against itself. There is no observed wall colour
in this repository to validate a wall prior against.

The roof row is a real but modest signal: about 23 luminance units across eras
on 123 joined samples, and essentially **all of it is lightness, not hue** —
every median is a grey-blue with negative warmth. That agrees with
`ROOF_ENRICHMENT.md` finding the roofscape genuinely dark and desaturated.

**So the honest conclusion is that this attempt's value is coverage and measured
height, not colour.** The era palette as written varies strongly in hue, and
nothing available supports that. Two defensible options, in order:

1. Ship coverage and heights; reduce the era prior to a **lightness gradient**
   only, which is the part the roof data actually supports.
2. Hold the colour prior entirely until a wall observation exists.

What should not happen is shipping a six-hue era palette and calling it
measured, which is exactly the laundering `wallSource: 'era-prior'` exists to
prevent.

## What is not done, and what would decide it

1. **Nothing renders this yet.** The staged GeoJSON is BAG-keyed; the runtime
   layer is OSM-keyed. Joining them, or replacing `building-3d` with this source
   as item 10 step 2 describes, is the next step and the one that produces a
   screenshot.
2. **The palette failed its test; see above.** Run it again over a wider tile
   set before acting: only 329 of 10,578 extract features fell inside the
   staged tiles, because the appearance extract is spread over the whole BBBike
   box (lon 4.55-5.17) rather than clipped to the municipality (4.73-5.11) —
   itself worth a look, since a good number of "Amsterdam" appearance buildings
   are not in Amsterdam.
3. **Walls remain unmeasured everywhere.** Straight-down imagery cannot observe
   a façade. Amsterdam does publish the right source — a 2024 mobile-LiDAR point
   cloud, RGB-coloured from the panorama images, so it genuinely sees walls —
   but the open metadata tables are **empty**: `metadata_2024` returns
   `totalElements: 0` and `metadata_2025` 404s through the API and returns no
   features over WFS. So there are no download URLs to sample today. AHN's
   colourised point clouds are coloured from *nadir aerial* imagery and add
   height and plane geometry, not wall colour.

## Reproducing

    npx tsx scripts/build-3dbag-appearance.ts --bbox=4.855,52.355,4.935,52.395 --limit-tiles=33
    npx tsx scripts/check-era-separation.ts
    npx tsx scripts/check-building-appearance-coverage.ts

Tiles cache in `.cache/3dbag-tiles/`, output and the coverage report in
`.cache/3dbag-appearance/`.
