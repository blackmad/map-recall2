# Lane: generic generator uplift with per-buurt profiles (#102, 2026-10-29)

Branch `lane/generic-uplift-20261029`. State at hand-back; the integrator owns bundles, TODO and HISTORY.

## What the 12-spot gap sheet showed (before)

Rider-height frames (`tests/e2e/generic-gap-strip.spec.ts`) beside the 2023-2025 municipal panoramas
(`scripts/look/generic-gap-panos.ts`, spots in `scripts/look/generic-gap-spots.json`). The common gaps:

1. **One brick palette everywhere.** Every inner-ring street drew the same saturated orange-red and tan mix
   (`PERIOD_WALLS.photo`), while the photos differ by neighbourhood: brown brick with white, grey and black painted
   fronts in the Jordaan and the canal belt, dark red-brown rows in Oud-West, purple-brown in De Pijp.
2. **No painted or rendered fronts outside the canal period's few swatches.**
3. **White accents and window presets picked by hash alone**, the same mix in every buurt; the larger measured-
   proportion presets (`openingOccupancy` .55-.62) were reachable only from street-survey recipes.
4. **Roof and crown form** (cornice vs gable vs dormer mix) is the same everywhere; not fixed (see below).
5. **Shopfronts** follow the OSM shop extract, which is right; the profile share is only a fallback.

## What changed

Two layers, as the coordinator asked:

- **Mechanics** (`src/canalRecall/bayLook.ts`, `threeBuildingFeatures.ts`): `bayLookFor(..., profile)`. In the photo
  look and never over a recipe, the building's era profile picks the wall from the buurt's measured swatches, and
  the bay preset from the white-accent, dark-frame, arched-head and tall-sash shares (`bayStyleForTraits`, scoring
  the plain masonry presets incl. the measured-proportion ones). A missing construction year takes the buurt's
  dominant era. A profile wall replaces a city-wide OSM `building:material` hue of the same family
  (`profileWallBeatsMaterial`); OSM colour tags and accepted measurements still win. No profile: byte-identical
  (tested over 1,000 calls).
- **Parameters** (`src/canalRecall/buurtProfiles/buurt-profiles.json`, data): written by
  `scripts/buurt-profiles/derive.ts` (staging first, `--publish` copies). 3,649 measured fronts: 2,765 panorama
  thumbnails at the street front (`scripts/buurt-profiles/sample-panos.ts`, 20 pre-1945 pands per buurt within
  3.5 km of the Dam), 123 archived rectified walls (source-data `pand-reference-walls`), 761 block-face houses via
  their district types, plus the BAG year mix. Pooled buurt (n >= 12) -> wijk (n >= 12) -> none, per era
  (n >= 8, else the area's pre-1945 pool). 256 buurten map to 209 profiles on a 40 m RLE grid. The report with
  n and confidence per profile is `staging/buurt-profiles/report.md` (regenerate with the derive command).
- **Calibration** keeps the city's brightness: each source's brick median goes to the city palette's L*, 0.75 x
  its chroma, its hue; brick stays L* <= 72, C* 12-34, hue 32-56; paint keeps half its measured tint.
- A/B: `?buurtProfiles=0` (passed to the chunk worker), `?buurtProfiles=debug` paints every profiled wall magenta.

## Results

- Sheet: `docs/images/look/generic-uplift-12spot-20261029.jpg` (photo | before = `?buurtProfiles=0` | after).
- Jordaan / canal belt now carry white, grey and brown fronts; Ten Kate-, Nicolaas Beets- and Kerkstraat darker
  red-brown; neighbouring buurten differ (unit test: the 12 spots resolve to >= 6 distinct profiles).
- Triangles: flat, `node --import tsx scripts/buurt-profiles/triangles.ts` 0.0 % over 3,163 buildings at the 12
  spots (the change picks existing texture layers and tints; no new layers, no texture MB).

## Still wrong

- De Pijp (Saenredam-, Stalpertstraat) reads light rosy-brown where the photos show dark purple-brown; the
  lightness offset (thumb median L* 35 -> city 43) lifts it. A per-source exposure model, or a darker city target
  for c19 brick, would fix it; the user asked for brighter, so left for review.
- Tweede Jan Steenstraat keeps an ochre-brown front (block-face types' palette in Nieuwe Pijp).
- Window traits (arch, tall, dark frames) are measured only where block-face houses exist (Oud-West, Pijp,
  Bellamy, Helmers, Spaarndammer, Rivierenbuurt); the Jordaan and centre profiles carry palette and accent share only.
- Crown/roof mix is in the profiles (`crowns`) but not drawn: `roofMesh.ts planRoof` would need a profile hook.
- `test:city-appearance` and `test:city-appearance-roofs` fail in this worktree on missing untracked data
  (`.cache/da-costa-block/acquisition.json`, `public/data/city-expansion/current.json`), before any code of this lane.

## Integrator

- `npm run build:canal-three-buildings` (both three-buildings bundles; they embed the profiles JSON).
- A profile change: rerun `node --import tsx scripts/buurt-profiles/derive.ts --publish`, rebuild that bundle.
- Re-sample: `node --import tsx scripts/buurt-profiles/sample-panos.ts` (~25 min, thumbnails cached in `.cache/`).
