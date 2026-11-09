# Lane: per-buurt profiles for every buurt, with more grammar knobs (2026-11-07, week 1, tier T0)

Branch `lane/profiles-citywide-20261107`, own worktree. Read `docs/handoffs/LANE-RULES.md`, then
`docs/plans/city-coverage-20261107.md` §A row 7b and §B3. Model: **haiku** for every run, one
**opus** turn at the end for the sheet verdict (spawned separately, ≤ 10 turns). Use `/usr/bin/git`;
never `pkill`. `MAP_RECALL_SOURCE_DATA=/Users/blackmad/Code/map-recall2-source-data`. Budget: 50
haiku turns + 10 opus.

## Why

Tier T0 is where "nearly 100 %" comes from: a measured buurt-and-era look on every generic pand costs
nothing per building. `scripts/buurt-profiles/derive.ts` (#102) already derives 209 profiles for 256 of
518 buurten from 3,649 measured fronts (panorama thumbnails, archived rectified walls, block-face
houses) with a wijk and city fallback. The other 262 buurten and the knobs the generic grammar has but
the profile does not carry (storey heights, shopfront share, crown kind mix, sash proportions) are the
gap. The profile's own verdict on 10-29 was "modest colour gain, fronts still more saturated than the
photos"; the palette-level lane (`lane-palette-level-20261107.md`) owns saturation; this lane owns
coverage and knobs. Byte-identical output for any pand without a profile stays the rule.

## Do

1. Coverage first. Read `derive.ts`'s header for the sources and MIN_N. Run it as is and report, per
   buurt, n fronts and which fallback applies. For every buurt under MIN_N, extend the thumbnail
   sampler (`src/canalRecall/buurtProfiles/thumbEvidence.ts`) over more panoramas per buurt until
   n ≥ MIN_N or the buurt has no panorama coverage (then wijk fallback, recorded). Thumbnails come
   from the city panorama API (CC BY 4.0, open data only); cache under `.cache/buurt-profiles/`.
   Target: 518 of 518 buurten with a profile or a recorded fallback reason.
2. Knobs. In `src/canalRecall/buurtProfiles/profiles.ts` add optional era fields the generic grammar can
   consume today (check `bayLook.ts` / `threeBuildingFeatures.ts` for what is actually read):
   `storeyHeightM` (median from 3DBAG eaves ÷ storeys where the block-face houses give storeys),
   `shopfrontShare` (OSM shop/amenity on ground floor within the buurt), `crowns` already exists (fill
   it from the block-face types and the archived walls), `sashTallShare` is `tallShare` (keep). Each
   new field: validator, byte-identical when absent (pinned in `profiles.test.ts`), one consumer in the
   grammar behind the existing `?buurtProfiles=` switch.
3. `derive.ts --publish`, rebuild the bundles the integrator names (report the commands; do not commit
   `public/canal-drive/js/*`), `npm run world:compile -- --changed` into staging and report the cell
   diff count (the integrator publishes cells).
4. Sheet: the existing 12-spot sheet (`docs/images/look/generic-uplift-12spot-20261029.jpg` was made
   by a script under `scripts/look/`; find and rerun it) before and after, plus 6 new spots in buurten
   that had no profile before (pick by the census-refresh lane's ride-ring ranking if it has landed,
   else the top 6 by pands among the newly profiled). The opus turn writes one PASS / WARN line per
   spot beside the photo and names any buurt to hold at wijk fallback.

## Numbers to hand back

Buurten with own profile / wijk / city before and after; fronts measured; new fields filled per
buurt; cells changed; the sheet path and the opus verdict lines.

## Hand back

LANE-RULES format. INTEGRATOR TODO: publish `buurt-profiles.json`, bundles, staged cells,
`world:verify`, a What's New note with the sheet if the user can see it.
