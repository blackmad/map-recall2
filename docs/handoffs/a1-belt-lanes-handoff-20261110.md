# a1 belt and first-ring buurt lanes: handoff to integrator-lanes-85 (2026-11-10)

a1 closed after landing batch round 5 (30b03a122) and the facade-extras fix (d1436bdcc). The user ruled "land the staged batch, then hold". Every lane below is stopped:
- Placed, held and vetoed decisions are committed on its branch: auto-place.json, `buurten/<buurt>-review-*.json`, and the report under `docs/reports/buurt-*-20261110.md` plus `*-strip-verdict-20261110.md`.
- Sheets and strips are in map-recall2-source-data at ab2581997, `block-face-strips/<buurt>-20261110/`.

Restart them as spec writers once H1–H3 merge. Branch-only installs go through `house:stage`, not a merge of the lane's chunks.

Briefs: `a1-buurt-lane-brief-p0-20261110.md` (shared flow) and `a1-belt-addendum-20261110.md` (gable families, register cross-check, Nassaukade 506 bar). Replace their install and capture steps with H2/H3.

| Lane (buurten) | Branch | Head | On branch, not on main | Notes |
|---|---|---|---|---|
| GG-West (Felix Meritis, Leliegracht, Bloemgracht) | lane/belt-gg-west-20261110 | 42de78c55 | Herengracht 92/94/96, Keizersgracht 254/256/258 (round-1 GLBs); r1/r2 staged with verdict fixes | Local-extract OSM intake (minutes to seconds); louis gablet, gabletSize/Light, atticSize; merged GG-Zuid |
| GG-Zuid (Vijzelstraat, Rembrandtplein e.o.) | lane/belt-gg-zuid-20261110 | 90761984f | Keizersgracht 616A/614/610/608 | windowFrames eared, basementDoor, doorSurround, stoopRails, reviewOverrides.ts; dentils kit-only (GLB audit host-wall question) |
| Haarlemmerbuurt (W/O) | lane/belt-haarlemmer-20261110 | 81e980aad | Haarlemmerdijk 4/6/16/18/20/131/133A, Haarlemmerstraat 52/54 | stripWhiteBalance.ts (green/yellow cast; for H4), BlockFaceIntent.schemaLimits {component, what}, reviewShopfront.ts; 133A accepted at NCC 0.14 |
| Jordaan / Elandsgracht | lane/belt-jordaan-eland-20261110 | f3c7b033f | 47 pands hand-placed (hand-runs.json) | Opus sent about half back; see verdict doc |
| Burgwallen (Oude Zijde, Kalverdriehoek, BG-terrein) | lane/belt-burgwallen-20261110 | 89bb6968a | 23 pands (verdict fixes applied after a backed-out merge) | Re-review before stage |
| Nieuwmarkt/Lastage | lane/belt-nieuwmarkt-lastage-20261110 | f6f5735d6 | 17 unreviewed | Needs an Opus review |
| Frederik Hendrik ZO | lane/buurt-frederikhendrik-20261110 | d37411d45 | 9 pands (Van Houweningenstraat 1-31, Fr. Hendrikstraat 134-154) | dentil-lintel, pairTransom, wideGround; crownRise renders about 2x |
| Plantage | lane/buurt-plantage-20261110 | ac31eb67e | none beyond main | Polaklaan 16-26 rakeClear untested; Kerklaan 24/26 need eaves pins |
| Den Tex / Vondelpark-Oost | lane/buurt-dentex-frederiksplein-20261110 | a8b5e0490 | residue after the round-5 merge | reviewRoofs.ts is on main |
| Weesper / Sarphati | lane/buurt-weesper-20261110 | 737929179 | (check ahead=3) | |
| Dapper / Oosterpark | lane/buurt-dapper-oosterpark-20261110 | 196f3b30e | records only | |
| Register extras | lane/register-extras-20261110 | 55e08b557 | 8ee3806b3: releases the register stoop and door surround in registerRecipe | Engine fix merged (d1436bdcc); the release waits for the hold |

Measured: facade-extras fix frame cost. Desktop, fixed route, 2 runs each, f56a2c4f9 against d1436bdcc, frames vsync-bound at 16.7 ms in all runs:

| Run | mapRender (ms) | three layers (ms/frame) |
|---|---|---|
| pre 1 | 2.8 | 1.48 |
| post 1 | 3.4 | 1.79 |
| pre 2 | 3.3 | 1.81 |
| post 2 | 2.7 | 1.48 |

Draw calls were 654 in all runs. No cost beyond run-to-run noise.

Caveat: the harness rider did not move (start = end), so this is one standing pose, not the route. The perf gate in check:canal still prints n/a (#294).
