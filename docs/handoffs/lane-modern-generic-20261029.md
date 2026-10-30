# Lane: modern side of the generic generator (#117, 2026-10-29)

Branch `lane/modern-generic-20261029`. State at hand-back; the integrator owns bundles, TODO and HISTORY.

## The 12-spot gap sheet (before)

Spots: `scripts/look/modern-gap-spots.json`. Each one is a dated post-1945 generic pand on a ride street, with the
camera 30 m up the street aimed at the facade. Four eras: 1960s offices (Weesperstraat, Reguliersdwarsstraat,
Nieuwe Herengracht), 1956-79 housing (Tweede Oosterparkstraat), 1980s-90s infill (Kinkerstraat, Haarlemmer
Houttuinen, Derde Oosterparkstraat, Govert Flinckstraat, Van Reigersbergenstraat) and 2000s blocks (Valkenburgerstraat,
Sarphatistraat, Borneolaan). Panoramas: `scripts/look/generic-gap-panos.ts`. Frames: `tests/e2e/generic-gap-strip.spec.ts`.
`GAP_PROBE=1` now dumps the decorated properties of the buildings in frame into `meta.json`.

The gaps, before:

1. **One preset for 80 years.** Every dated post-1945 generic pand drew `BAY_STYLES.modern` 4 or 5: smooth render
   with small punched holes. That covered 1965 concrete offices and 1990s brick infill alike.
2. **The wrong material.** The photos show 1980s-2000s housing in brick, mostly red-brown, purple-brown or dark brown.
   The game drew it as beige render. The one brick swatch in `PERIOD_WALLS.photo.modern` (`#b05a40`) then landed at
   random, so the Weesperstraat concrete office came out orange brick.
3. **No window bands on offices.** The ribbon and curtain presets were in the texture array, but no generic building
   could reach them (`bayStyleForRecipe`: "Construction date alone is not evidence for continuous ribbon glazing").
4. **Balcony and gallery stacks** on housing slabs: these appear only through extras, at random.
5. **Ground floors.** The photos show recessed or glazed plinths and arcades (Vijzelstraat, Weesperstraat). These are
   not fixed.

## What changed

- `src/canalRecall/modernFacades.ts`. `modernVocabulary({id, year, heightM, footprintM2, buildingType})` sorts each
  building into one of four eras (1945-64 reconstruction, 1965-79 late-modern, 1980-99 renewal, 2000+ contemporary)
  and a use: OSM `building` type from the building-facts tiles, or else a deep post-war footprint proxy
  (>= 1,500 m2, >= 15 m, built before 1980, read as an office). Weighted, deterministic picks then choose one of the
  nine modern presets already in the array, plus a wall family (buff, red or dark brick, concrete, render).
  Brick presets take brick swatches and smooth presets take concrete or render. Curtain fronts need a height of
  15 m or more, galleries 11 m or more.
- `bayLook.ts bayLookFor(..., modern?)`. The vocabulary applies in the photo look only, never over a recipe, and
  only for the `modern` archetype with a known year. It replaces the hash pick and the buurt profile's era traits
  (those were measured on pre-1945 fronts). A measured period wall, a recipe wall and sourced colours still win.
- `threeBuildingFeatures.ts` passes footprint and `buildingType` for year >= 1945. `genericFacades.ts`'s year enricher
  also stamps `buildingType`.
- Ribbon and curtain fronts take a pale spandrel accent (`SPANDREL_ACCENTS`). A shop's brand colour no longer
  overwrites that accent on those fronts, because it striped Kinkerstraat's spandrels red. The brand colour stays on
  the shop sign.
- Buff brick is desaturated: the first pass read ochre-yellow at Derde Oosterparkstraat.
- A/B: `?modernFacades=0`, passed to the chunk worker alongside `?buurtProfiles` (`threeBuildingsBrowser.ts`).

## Review round (2026-10-30): walls from measured data

The integrator's review found that a fixed city-wide wall family per era contradicts a share of the photos: spots 6,
9 and 11. Lane #118 (`lane/buurt-lightness-20261029`, f61bbb1bf) is merged in first.

- `scripts/buurt-profiles/sample-panos.ts --modern` measures BAG year >= 1945 pands (7-45 m high, 40-5,000 m2). It
  wrote `staging/buurt-profiles/pano-samples-modern.json` (untracked): 1,635 fronts in 207 buurten.
- `scripts/buurt-profiles/derive.ts` feeds those samples into the modern era only. The exposure fit, the profile
  level, `n`, the older eras and the grid stay byte-identical to #118's staging set (checked: 0 of 209 profiles
  differ outside `eras.modern`). Two further rules apply to modern-pass samples only:
  - a front with thumbnail L >= 66 counts as paint;
  - post-war brick takes 0.55 of the city chroma lift (`MODERN_BRICK_CHROMA`).
  121 of 209 profiles now carry measured modern walls. `buurt-profiles.json` is republished, so it also carries
  #118's recalibration.
- `modernVocabulary(f, buurt.eras.modern)` draws the wall from that distribution. The measured material picks a
  brick or smooth preset. Paint keeps 35 % of its tint (`PAINT_TINT`). Ribbon and curtain offices are unchanged.
- Sheet columns are now photo | before | first | revised. Per spot, revised against the photo:
  - Better: 6 Haarlemmer Houttuinen (now white render, as the photo), and 1 and 5 (kept).
  - Unchanged: 3 and 10.
  - Worse: 7 Derde Oosterparkstraat. Revised draws pale render where the photo shows dark brick.
  - Not fixed: 9 Van Reigersbergenstraat, still dark brown where the photo is pale buff. 11 Sarphatistraat now reads
    pale pinkish render where the photo shows dark grey brick, worse than "first".
  - Mixed: 2 and 4 are now dark brick, which is partly right (brick behind, pale render with balconies in front).
  - Same: 8 and 12, dark brick, plausible.
- Root limit: a weighted draw from the buurt's distribution cannot hit an individual building. The next step is the
  sampled pand's own measured wall where one exists (1,635 pands), or a per-street distribution. Peach casts remain
  in the light swatches.

## Proofs

- `node --import tsx --test src/canalRecall/modernFacades.test.ts` (7 tests). The preset indices match their presets
  and `BAY_LAYER_COUNT` is unchanged at 191, so no new layers. `bayLookFor` is deep-equal with and without the new
  facts for 1,000 ids at pre-1945 or undated years, with and without a buurt profile. It is also deep-equal in the
  cartoon look and with the flag off. The era x use shares and the height limits are pinned.
- `node --import tsx scripts/look/modern-facade-triangles.ts`. Around each of the 12 spots (150 m): post-1945
  triangles per building go 0.0 % on vs off. A sha256 of the pre-1945 buildings' walls and extras chunk arrays is
  identical on vs off at every spot. The script exits 1 if either fails.

## Still wrong

- **Use is thin.** OSM types tag about 4 % of post-1945 pands. BAG `gebruiksdoel` (`.cache/bag-pand-uses`) is the
  real signal, but it is not in the runtime tiles. Adding a use code to the building-facts rows is a data regen,
  which the integrator owns.
- **Wall colours are unmeasured.** The swatches are calibrated to the city palette's brick brightness, not to
  photos. The buurt-profile sampler (`scripts/buurt-profiles/sample-panos.ts`) could sample post-1945 pands too.
- **Not drawn:** set-back top floors, recessed or glazed ground floors and arcades, and floor bands on brick. Each
  needs either a texture layer (one spare under the 192 cap) or a roof or extras hook.
- The large tier (`largeBuildingTier.ts`) and towers (>= 30 m) keep their own systems. Undated buildings are unchanged.
- **Bad source years.** BAG years in building-facts can disagree with the bag-tiles year: Kinkerstraat
  0363100012078005 is 1900 in facts and 1980s in tiles. Those buildings stay c19.

## Integrator

- Rebuild `npm run build:canal-three-buildings` (both three-buildings bundles) and `npm run build:canal-buildings`
  (building-style bundle, for the year enricher).
- `test:street-appearance` (`audit-frontages.test.ts`): only the input hashes moved, because the threeBuilding*
  sources changed. The frontages still reproduce, with 0 palette and 0 mask changes. Re-record, as was done after #94/#100.
- `test:city-appearance-roofs` fails on the missing untracked `public/data/city-expansion/current.json`. This
  happens before any of this lane's code runs.
