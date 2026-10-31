# Lane: railway tracks that look right from the chase camera

Rules: `LANE-RULES.md`. Model: opus. Port: 4537. Branch
`lane/rail-look-20261030` from `origin/main`, worktree
`/Users/blackmad/Code/map-recall2-worktrees/rail-look-20261030`
(`scripts/worktrees/new.sh lane/rail-look-20261030 <that dir> 4537`).

## The report

The user rode the rail corridors east of Centraal on 2026-10-30 (build
04e3c88, hours after `rail-v1` shipped, HISTORY "Railway tracks (2026-10-30,
#124)") and filed three bugs through the in-game feedback button:

| id | text | rider (lng, lat) | what the screenshot shows |
|---|---|---|---|
| 5d3fb497 | "train tracks buried by surface" | 4.919002, 52.376640 (Piet Heinkade, looking east along the Dijksgracht corridor) | the ballast beds sit *in* the beige land: the ground surface swallows the beds; sleepers read as a grey hatch; tracks fan and merge as flat ribbons with no separation |
| d49a15b0 | "more bad train tracks" | 4.931068, 52.374300 (Panamalaan / Czaar Peterstraat, looking north-east at the Zeeburg curve) | same: a wide grey hatched plane with dark stripes, the beds disappear under the ground on the curve |
| 5d5b56c4 | "ooof, these rails look really bad" | 4.903754, 52.376897 (Oostertoegang, Centraal's eastern throat, looking north) | the station throat: dozens of tracks drawn as a dense sleeper hatch with the odd dark ridge, nothing reads as rails on a ballast bed |

Screenshots: `.cache/canal-feedback/<id>.jpg` in the integrator checkout
(`/Users/blackmad/Code/map-recall2-worktrees/integrator-engine/.cache/canal-feedback/`),
pulled by `npm run feedback:queue`. Look at all three before touching code.

## What is there

`src/canalRecall/ownGround/railTracks.ts` (pure; shared by
`scripts/own-ground/build-rail-tracks.ts`, the ground store and
`groundCell.ts`): per way a ballast bed `RAIL_SECTION` (3.1 m top at
+0.32 m, shoulders to 4.6 m, service tracks 3 cm lower), the sleepers as a
texture (`SLEEPER_TILE_M` 3.1 m, `RAIL_TONES`), two ridge rails at standard
gauge, bridges on a slab, level crossings flat. Extract
`public/data/extracts/amsterdam/rail-v1/` (139 cells). `?rails=0` turns it
off. `scripts/own-ground/rail-shots.mjs` freezes the rider at four spots and
writes before/after PNGs and frame times — add the three report spots to its
`SPOTS` (ids `piet-heinkade-east`, `zeeburg-curve`, `oostertoegang`, with
the bearings from the screenshots) and use it for every strip.

## Likely causes, in the order to check

1. **The bed is below the terrain, not on it.** `topLift 0.32` is measured
   from the sampled `HeightFn`; where the corridor is an embankment the
   AHN-derived ground is already at embankment height for the land beside
   it, and the beige land polygon (`landuse=railway` in the own-ground
   extract) is draped at the same height, so the bed and the land z-fight or
   the land wins. Check which layer draws the beige and at what z; the
   corridor's land should draw as ballast/gravel (not beige sand) and sit
   below the beds, or the beds must lift above the draped land by more
   than its own thickness.
2. **The sleeper texture reads as a hatch at chase distance.** From 40–80 m
   at 60° pitch a 3.1 m tile becomes 6–10 px with hard dark/light bands;
   three or more parallel beds alias into a moiré. Measure the texel size on
   screen at the three spots; fade the sleeper contrast with distance
   (mip bias or a distance mix to the ballast tone) and make the rails the
   element that stays dark and continuous. Slop and real photos: at that
   distance you see two dark lines per track on a grey-brown bed, no sleepers.
3. **Overlapping beds in the throat.** Where tracks are closer than the bed
   width (4.6 m toe to toe; yard tracks at 4.0–4.5 m centres) the shoulders
   cross; merge adjacent beds into one yard bed (one shoulder pair for the
   group, individual rails) when centres are < 5 m apart, with the
   service tracks no longer 3 cm lower (that step is what draws the dark
   ridges in the throat).
4. **Separation between corridor and road.** Where the corridor runs beside
   Piet Heinkade the real thing has a kerb/wall/fence or a verge; the game
   shows the bed dying into the asphalt edge. A low concrete edge beam
   (0.3 m) along the corridor's outer toes where it meets a street polygon
   would read; keep it under 2 ms per cell.

Judge every change by the frame (`road-look-over-accuracy`): before/after
strips at the three spots, desktop and phone, with the user's screenshots
beside them. The accept bar is that each of the three frames would not have
drawn the complaint.

## Keep

`?rails=0` working; the Dijksgracht ≥ 6 tracks regression; frame time at the
four existing spots within noise (`rail-shots.mjs` `frames.json`); the
tunnel and level-crossing rules; `build-rail-tracks.ts` output unchanged
unless a fix needs a new field (then bump `RAIL_VERSION`, keep the decoder
tolerant of v1, rebuild the extract with the script and report the diff).

## Checks

`npm run lint`; `node --import tsx --test src/canalRecall/ownGround/railTracks.test.ts`
(create it if missing: bed merge, lift, texture fade as pure functions);
`npm run test:own-ground` if it exists (`grep '"test:own-ground' package.json`);
`PORT=4537 node scripts/own-ground/rail-shots.mjs artifacts/rail-look-20261030`
under the lock (`/tmp/canal-pw.sh`); then under the lock
`PW_PORT=4537 /tmp/canal-pw.sh npx playwright test own-ground-roads start-heading --project=desktop --workers=1 --trace off`.

## Hand back

The block from `LANE-RULES.md`; the strips (paths) and the frame-time table;
the cause(s) found per report row; which bundles the integrator rebuilds
(`own-ground` worker bundle via `npm run build:canal-own-ground` or whatever
`package.json` names for `ownGround`) and whether the `rail-v1` extract
changed.
