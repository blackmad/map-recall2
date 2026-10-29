# Likeness judge: curtain walls, crop height cap, group-plane pairing (GitHub #114)

Lane `likeness-judge-20261029`, branch `lane/likeness-judge-20261029`. Measurement fix only: the `LIKENESS`
constants are unchanged (pinned in `likenessCurtain.test.ts`), no allowlist entries, no installs, goldens unmoved.

## What changed

1. **Curtain symmetry** (`likeness.ts` `curtainReading`, `measureFacade.ts` `majorityClean`). When the group is a
   `curtain-wall` (or the photo's front class is `curtain`) and the model draws a curtain grid (a `curtain-wall` group,
   or a front with no wall-slot material, whose modal frame material above 2.5 m is the grid), the model is read as the
   photo reads a curtain front: its wall is the spandrel material if drawn, else the grid's; grid cells of the wall
   colour are wall, lighter ones trim, darker ones glazing; and the mask goes through the photo pass's own 3x3 majority
   clean-up, so a one-cell grid line vanishes on both sides. Brick and every non-curtain group are untouched.
   `likeness-replay.ts` dumps carry the curtain mask, so replays include it.
2. **Crop height cap** (`scripts/pand-reference/rectify.ts`, `all-walls.ts --max-height=<m>`, needs `--suffix`).
   Default 32 m / 1.8 Mpx, so no archived crop changes; above 32 m the pixel budget scales with height
   (`maxPixelsFor`), so a 60 m wall gets the ppm a 32 m wall of the same width gets. Trade documented in the header.
3. **Group-plane pairing** (`cropToPanel.ts` `mergedPanelPlane`, `groupPlaneCoverage`; used by `likeness-house.ts`).
   Only when the main panel pairs nothing: a crop is accepted on the least-squares plan plane through the group's member
   walls with the same 0.5 m / 5 deg / 60 % thresholds, placed where the main panel's ends project onto the crop.
   Reports `pairedVia: 'group-plane'`.

## Findings

- **The brief's premise was half right.** The model side was wrong ("wall not drawn", glazing 1.00), but the photo
  does *not* read the mullion grid as wall: its column profile on every #105 glass front has almost no wall columns
  (thin mullions vanish in the photo's 3x3 clean-up). The photo's 13-30 % wall is **horizontal floor/spandrel bands
  0.5-1.5 m tall** at the storey lines (Apollo walls[3], Pieter Nieuwland walls[3], Het Dok walls[7] row profiles).
  Read symmetrically, the models still glaze 0.97-0.99 against 0.70-0.87: the kit's spandrel-less curtain grid has no
  floor bands. Those groups now FAIL for that real reason (and a real wall-colour comparison: the grid's white frame
  against the photo's dark bands) instead of "wall not drawn". **No verdict moved; 10 reason strings did.**
- **Group-plane pairing pairs nothing in today's data.** A survey of all 86 NO PHOTO groups: 65 are single-panel
  groups, and the NO PHOTO cause is a front set back 1.5-8 m from the BAG edge, or no crop on that side, not
  faceting. Het Nieuwe Huis walls[3] (main panel p111, 7 surfaces): the merged plane is 1.9 deg off and **0.76 m behind**
  BAG edge w01-33 (the 3DBAG front stands 0.27-1.01 m behind the footprint all along), outside 0.5 m. Pinned in
  `groupPlane.test.ts`; it needs a crop cut on the 3DBAG plane (`all-walls.ts --inset`), not a looser tolerance.
- `kpn-teleport-165158` fails to compile (`Maximum call stack size exceeded`) before and after: not this lane.

## Method

`compileLargeHouse` for every house (17 drafts copied, uncommitted, from the ride-landmarks staging; 95 installs with
`reviewState: large-recipe-likeness-inferred` from the catalogue), before (origin/main code) and after, every group's
verdict including NO PHOTO. The local source-data checkout is 4 commits behind `origin/main` (it lacks the #105 crops,
e.g. NFTA 0363100012170259 and Het Nieuwe Huis 0363100012148010), so both runs used a read-only overlay: the local
checkout plus the six pand directories `origin/main` adds, extracted with `git archive`.

## Before -> after

| set | before | after |
|---|---|---|
| 17 drafts (99 groups) | PASS 2, WARN 9, FAIL 33, NO EVIDENCE 14, NO PHOTO 40, compile error 1 | identical |
| 95 inferred installs (298 groups) | PASS 13, WARN 38, FAIL 150, NO EVIDENCE 51, NO PHOTO 46 | identical |
| PASS -> FAIL | | none |

## Still cannot measure

- Curtain fronts whose photo wall is a floor band the kit does not draw: the judge now says so, the kit needs a
  spandrel/floor-band component for spandrel-less curtain walls (the integrator should route that to a kit lane).
- Fronts set back from the BAG edge (Het Nieuwe Huis walls[1] 2.6 m, Apollo walls[7] 5.9 m, Sarphati Plaza walls[5]
  7.8 m, De Valerius walls[3..4] 2.3-2.8 m...): pairing needs inset crops.
- Curtain-wall colour when the photo's wall cluster is reflective glass of the band's lightness (overcast).

## Per house and group

### 17 #105 drafts (staging, not installed)

Before: PASS 2, WARN 9, FAIL 33, NO EVIDENCE 14, NO PHOTO 40, ERROR 1  
After: PASS 2, WARN 9, FAIL 33, NO EVIDENCE 14, NO PHOTO 40, ERROR 1

| house | group | street | system | photo class | before | after | reason after (before, when it moved) |
|---|---|---|---|---|---|---|---|
| akzonobel-240015 | walls[0] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| akzonobel-240015 | walls[1] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| akzonobel-240015 | walls[2] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| akzonobel-240015 | walls[3] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| akzonobel-240015 | walls[4] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| akzonobel-240015 | walls[5] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| akzonobel-240015 | walls[6] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| akzonobel-240015 | walls[7] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| akzonobel-tower-240149 | walls[0] | S | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | washed out 50 % > 30 % |
| akzonobel-tower-240149 | walls[1] | S | brick-bay-grid | columns | FAIL | FAIL | glazing storey band off by 0.26; wall family unresolved (#5d6869 is dark and neutral, brick courses not resolved): lightness and hue judged only |
| akzonobel-tower-240149 | walls[2] | S | brick-bay-grid | curtain | FAIL | FAIL | glazing storey band off by 0.59 mean 0.28 vs photo 0.81 |
| akzonobel-tower-240149 | walls[3] | S | brick-bay-grid | curtain | NO EVIDENCE | NO EVIDENCE | washed out 55 % > 30 % |
| akzonobel-tower-240149 | walls[4] |  | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| apollo-148632 | walls[0] | S | brick-bay-grid | ribbon | FAIL | FAIL | glazing storey band off by 0.23; window shape none vs photo wide; wall family unresolved (#0f1104 is dark and neutral, brick courses not resolved): lightness and hue judged only; columns none vs photo 2 |
| apollo-148632 | walls[1] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| apollo-148632 | walls[2] |  | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | obliquity 48.4 deg > 45 |
| apollo-148632 | walls[3] |  | curtain-wall | curtain | FAIL | FAIL | wall dL +0.38; glazing  mean 0.98 vs photo 0.83; wall family unresolved (#8c8d87 is dark and neutral, brick courses not resolved): lightness and hue judged only (was: wall not drawn; glazing  mean 1.00 vs photo 0.83; wall family unresolved (#8c8d87 is dark and neutral, brick courses not resolved): lightness and hue judged only) |
| apollo-148632 | walls[4] |  | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| apollo-148632 | walls[5] |  | curtain-wall | curtain | FAIL | FAIL | wall family paint vs photo brick (was: wall not drawn; glazing  mean 1.00 vs photo 0.87) |
| apollo-148632 | walls[6] |  | ribbon-windows | columns | FAIL | FAIL | glazing storey band off by 0.45; window shape none vs photo square; columns none vs photo 2 |
| apollo-148632 | walls[7] |  | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| atlanta-080492 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | storey 1: widest opening 0.5 m vs photo 17.4 m (a ribbon against windows) |
| atlanta-080492 | walls[1] | S | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | foliage 26 % > 25 % |
| atlanta-080492 | walls[2] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| atlanta-080492 | walls[3] |  | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| atlanta-080492 | walls[4] |  | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| barlaeus-gymnasium-169565 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | window shape square vs photo tall |
| barlaeus-gymnasium-169565 | walls[1] | S | brick-bay-grid | columns | WARN | WARN | mask IoU 0.064 < 0.45 |
| barlaeus-gymnasium-169565 | walls[2] | S | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | foliage 29 % > 25 % |
| barlaeus-gymnasium-169565 | walls[3] | S | brick-bay-grid | columns | WARN | WARN | mask IoU 0.095 < 0.45 |
| barlaeus-gymnasium-169565 | walls[4] | S | brick-bay-grid | columns | WARN | WARN | mask IoU 0.351 < 0.45 |
| barlaeus-gymnasium-169565 | walls[5] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| barlaeus-gymnasium-169565 | walls[6] |  | brick-bay-grid | punched | WARN | WARN | mask IoU 0.395 < 0.45 |
| de-valerius-251533 | walls[0] | S | brick-bay-grid | curtain | NO EVIDENCE | NO EVIDENCE | foliage 39 % > 25 % |
| de-valerius-251533 | walls[1] | S | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | washed out 62 % > 30 % |
| de-valerius-251533 | walls[2] | S | brick-bay-grid | punched | FAIL | FAIL | wall dL +0.33 |
| de-valerius-251533 | walls[3] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| de-valerius-251533 | walls[4] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| de-valerius-251533 | walls[5] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| de-valerius-251533 | walls[6] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| de-valerius-251533 | walls[7] |  | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| forum-125840 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.22; columns 79 vs photo 36 |
| forum-125840 | walls[1] | S | brick-bay-grid | curtain | FAIL | FAIL | glazing storey band off by 0.62 mean 0.28 vs photo 0.75; wall family unresolved (#273439 is dark and neutral, brick courses not resolved): lightness and hue judged only |
| forum-125840 | walls[4] |  | brick-bay-grid | blank | FAIL | FAIL | glazing storey band off by 0.30 mean 0.28 vs photo 0.03 |
| gebouw-parnas-153698 | walls[0] | S | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | foliage 29 % > 25 %; washed out 49 % > 30 % |
| gebouw-parnas-153698 | walls[1] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.28 mean 0.28 vs photo 0.10 |
| gebouw-parnas-153698 | walls[2] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| gebouw-parnas-153698 | walls[3] | S | ribbon-windows | ribbon | FAIL | FAIL | glazing storey band off by 0.26 |
| gebouw-parnas-153698 | walls[4] |  | brick-bay-grid | punched | PASS | PASS |  |
| gebouw-parnas-153698 | walls[5] |  | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| gebouw-parnas-153698 | walls[6] |  | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| gebouw-parnas-153698 | walls[7] |  | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.40 mean 0.28 vs photo 0.64 |
| het-dok-252442 | walls[0] | S | brick-bay-grid | curtain | NO EVIDENCE | NO EVIDENCE | usable upper cells 35 % < 40 % |
| het-dok-252442 | walls[2] | S | brick-bay-grid | punched | WARN | WARN | mask IoU 0.06 < 0.45 |
| het-dok-252442 | walls[4] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.32; wall family unresolved (#3a3f3d is dark and neutral, brick courses not resolved): lightness and hue judged only |
| het-dok-252442 | walls[5] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.60 mean 0.28 vs photo 0.49 |
| het-dok-252442 | walls[7] |  | curtain-wall | curtain | FAIL | FAIL | wall family paint vs photo brick; glazing storey band off by 0.41 mean 0.99 vs photo 0.70 (was: wall not drawn; glazing storey band off by 0.42 mean 1.00 vs photo 0.70) |
| het-nieuwe-huis-148010 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | window shape wide vs photo square |
| het-nieuwe-huis-148010 | walls[1] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| het-nieuwe-huis-148010 | walls[2] |  | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| het-nieuwe-huis-148010 | walls[3] |  | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| het-nieuwe-huis-148010 | walls[4] |  | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| het-nieuwe-huis-148010 | walls[5] |  | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| het-nieuwe-huis-148010 | walls[6] |  | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| het-nieuwe-huis-148010 | walls[7] |  | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| kpn-teleport-165158 | - |  |  |  | ERROR | ERROR | Maximum call stack size exceeded |
| nfta-markenplein-170259 | walls[0] | S | curtain-wall | punched | NO EVIDENCE | NO EVIDENCE | foliage 50 % > 25 % |
| nfta-markenplein-170259 | walls[1] | S | curtain-wall | punched | NO EVIDENCE | NO EVIDENCE | washed out 37 % > 30 % |
| nfta-markenplein-170259 | walls[3] |  | curtain-wall |  | NO PHOTO | NO PHOTO | coverage 0 |
| nfta-markenplein-170259 | walls[4] |  | curtain-wall | punched | FAIL | FAIL | wall dL +0.54; glazing storey band off by 0.71 mean 0.99 vs photo 0.35; wall family unresolved (#273330 is dark and neutral, brick courses not resolved): lightness and hue judged only (was: wall not drawn; glazing storey band off by 0.75 mean 1.00 vs photo 0.35; wall family unresolved (#273330 is dark and neutral, brick courses not resolved): lightness and hue judged only) |
| pakhuis-australie-139498 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.18 |
| pakhuis-australie-139498 | walls[1] | S | brick-bay-grid | punched | WARN | WARN | wall family unresolved (#3c2c2a is dark and neutral, brick courses not resolved): lightness and hue judged only; mask IoU 0.215 < 0.45 |
| pakhuis-australie-139498 | walls[2] | S | brick-bay-grid | columns | FAIL | FAIL | wall family brick vs photo paint; glazing storey band off by 0.24; window shape wide vs photo tall |
| pakhuis-australie-139498 | walls[3] |  | brick-bay-grid | punched | PASS | PASS |  |
| pakhuis-australie-139498 | walls[7] |  | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.20 |
| pieter-nieuwlandcollege-078546 | walls[0] | S | brick-bay-grid | ribbon | NO EVIDENCE | NO EVIDENCE | usable upper cells 24 % < 40 %; foliage 65 % > 25 % |
| pieter-nieuwlandcollege-078546 | walls[1] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.31 mean 0.39 vs photo 0.63 |
| pieter-nieuwlandcollege-078546 | walls[2] | S | brick-bay-grid | punched | WARN | WARN | mask IoU 0.246 < 0.45 |
| pieter-nieuwlandcollege-078546 | walls[3] | S | curtain-wall | curtain | FAIL | FAIL | wall dL +0.15; glazing storey band off by 0.15 mean 0.98 vs photo 0.86 (was: wall not drawn; glazing storey band off by 0.16 mean 1.00 vs photo 0.86) |
| pieter-nieuwlandcollege-078546 | walls[6] |  | ribbon-windows | punched | WARN | WARN | mask IoU 0.426 < 0.45 |
| pieter-nieuwlandcollege-078546 | walls[7] |  | brick-bay-grid | punched | FAIL | FAIL | wall dL +0.20; glazing storey band off by 0.15; wall family unresolved (#434240 is dark and neutral, brick courses not resolved): lightness and hue judged only |
| sarphati-plaza-182840 | walls[0] | S | brick-bay-grid | punched | WARN | WARN | mask IoU 0.34 < 0.45 |
| sarphati-plaza-182840 | walls[1] | S | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | obliquity 53.8 deg > 45 |
| sarphati-plaza-182840 | walls[2] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.26 |
| sarphati-plaza-182840 | walls[3] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| sarphati-plaza-182840 | walls[4] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| sarphati-plaza-182840 | walls[5] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| sarphati-plaza-182840 | walls[6] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| sarphati-plaza-182840 | walls[7] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| sint-nicolaaslyceum-239853 | walls[0] | S | brick-bay-grid | curtain | FAIL | FAIL | glazing  mean 0.24 vs photo 0.77; wall family unresolved (#1b211d is dark and neutral, brick courses not resolved): lightness and hue judged only |
| sint-nicolaaslyceum-239853 | walls[1] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.55 mean 0.39 vs photo 0.59 |
| sint-nicolaaslyceum-239853 | walls[2] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.27 |
| sint-nicolaaslyceum-239853 | walls[3] | S | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | foliage 26 % > 25 % |
| sint-nicolaaslyceum-239853 | walls[4] | S | brick-bay-grid | punched | FAIL | FAIL | wall family brick vs photo paint; glazing storey band off by 0.27 |
| sint-nicolaaslyceum-239853 | walls[5] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| sint-nicolaaslyceum-239853 | walls[6] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| sint-nicolaaslyceum-239853 | walls[7] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| the-edge-239633 | walls[3] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.21 |
| the-edge-239633 | walls[7] |  | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.42 mean 0.39 vs photo 0.28; wall family unresolved (#352f20 is dark and neutral, brick courses not resolved): lightness and hue judged only |

### 95 installed `large-recipe-likeness-inferred` houses

Before: PASS 13, WARN 38, FAIL 150, NO EVIDENCE 51, NO PHOTO 46, ERROR 0  
After: PASS 13, WARN 38, FAIL 150, NO EVIDENCE 51, NO PHOTO 46, ERROR 0

| house | group | street | system | photo class | before | after | reason after (before, when it moved) |
|---|---|---|---|---|---|---|---|
| politie-van-leijenberghlaan | walls[0] | S | ribbon-windows | punched | WARN | WARN | columns 19 vs photo 13 |
| politie-van-leijenberghlaan | walls[2] |  | ribbon-windows | punched | PASS | PASS |  |
| politie-van-leijenberghlaan | walls[3] |  | ribbon-windows | punched | NO EVIDENCE | NO EVIDENCE | obliquity 51.9 deg > 45 |
| politie-van-leijenberghlaan | walls[4] |  | ribbon-windows | punched | FAIL | FAIL | wall family brick vs photo paint; glazing storey band off by 0.40 mean 0.72 vs photo 0.46; columns 11 vs photo 39 |
| politie-van-leijenberghlaan | walls[5] |  | ribbon-windows |  | NO PHOTO | NO PHOTO | coverage 0 |
| kattenburg-wings-164938 | walls[0] | S | brick-bay-grid | columns | WARN | WARN | mask IoU 0.118 < 0.45 |
| kattenburg-wings-164938 | walls[1] | S | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | washed out 32 % > 30 % |
| heinekenplein-130580 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | wall dL +0.22; glazing storey band off by 0.26 mean 0.32 vs photo 0.17 |
| heinekenplein-130580 | walls[1] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| heinekenplein-130580 | walls[2] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| politie-lijnbaansgracht | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.16; window shape square vs photo tall |
| politie-lijnbaansgracht | walls[1] | S | brick-bay-grid | ribbon | FAIL | FAIL | glazing storey band off by 0.27 mean 0.36 vs photo 0.61; window shape tall vs photo square |
| politie-lijnbaansgracht | walls[2] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| politie-nieuwezijds-voorburgwal | walls[0] | S | curtain-wall | punched | FAIL | FAIL | wall family paint vs photo brick; glazing storey band off by 0.95 mean 0.98 vs photo 0.27; window shape none vs photo tall; columns 8 vs photo 13 (was: wall not drawn; glazing storey band off by 0.96 mean 1.00 vs photo 0.27; window shape none vs photo tall; columns none vs photo 13) |
| politie-nieuwezijds-voorburgwal | walls[1] | S | brick-bay-grid | curtain | FAIL | FAIL | glazing storey band off by 0.66 mean 0.21 vs photo 0.82 |
| politie-nieuwezijds-voorburgwal | walls[2] | S | curtain-wall | curtain | FAIL | FAIL | wall dL +0.57; glazing storey band off by 0.26; wall family unresolved (#323632 is dark and neutral, brick courses not resolved): lightness and hue judged only (was: wall dL +0.57; glazing storey band off by 0.28; wall family unresolved (#323632 is dark and neutral, brick courses not resolved): lightness and hue judged only) |
| politie-nieuwezijds-voorburgwal | walls[3] | S | curtain-wall |  | NO PHOTO | NO PHOTO | coverage 0 |
| politie-ij-tunnel | walls[0] | S | ribbon-windows | punched | FAIL | FAIL | storey 2: widest opening 1.2 m vs photo 9.1 m (a ribbon against windows); columns 4 vs photo 3 |
| politie-ij-tunnel | walls[1] | S | ribbon-windows | punched | WARN | WARN | columns 6 vs photo 18; mask IoU 0.261 < 0.45 |
| politie-ij-tunnel | walls[2] | S | ribbon-windows | punched | FAIL | FAIL | glazing storey band off by 0.36 mean 0.48 vs photo 0.31; columns 5 vs photo 3 |
| politie-ij-tunnel | walls[3] | S | ribbon-windows | punched | FAIL | FAIL | wall family paint vs photo brick; glazing storey band off by 0.23 |
| politie-houtmankade | walls[0] | S | ribbon-windows | punched | NO EVIDENCE | NO EVIDENCE | foliage 29 % > 25 %; washed out 32 % > 30 % |
| politie-houtmankade | walls[1] | S | ribbon-windows |  | NO PHOTO | NO PHOTO | coverage 0 |
| politie-houtmankade | walls[2] | S | brick-bay-grid | punched | WARN | WARN | mask IoU 0.264 < 0.45 |
| politie-oost-watergraafsmeer | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.25; columns 11 vs photo 18 |
| politie-oost-watergraafsmeer | walls[1] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.16 |
| politie-oost-watergraafsmeer | walls[2] | S | brick-bay-grid | punched | WARN | WARN | columns 8 vs photo 15 |
| politie-oost-watergraafsmeer | walls[3] | S | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | obliquity 47.5 deg > 45 |
| politie-postjesweg | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.20 mean 0.37 vs photo 0.48; window shape square vs photo tall; columns 6 vs photo 11 |
| politie-postjesweg | walls[1] | S | ribbon-windows | punched | FAIL | FAIL | storey 2: widest opening 1.4 m vs photo 20.5 m (a ribbon against windows); columns 6 vs photo 15 |
| politie-postjesweg | walls[2] | S | ribbon-windows | blank | FAIL | FAIL | wall dL +0.15; glazing storey band off by 0.56 mean 0.50 vs photo 0.04; wall family unresolved (#4b2525 is dark and neutral, brick courses not resolved): lightness and hue judged only |
| politie-postjesweg | walls[3] | S | ribbon-windows | punched | FAIL | FAIL | glazing storey band off by 0.18 mean 0.11 vs photo 0.21; columns 6 vs photo 4 |
| politie-meer-en-vaart | walls[0] | S | ribbon-windows | punched | NO EVIDENCE | NO EVIDENCE | foliage 44 % > 25 % |
| politie-meer-en-vaart | walls[1] | S | ribbon-windows | punched | FAIL | FAIL | window shape wide vs photo square; columns 9 vs photo 12 |
| politie-meer-en-vaart | walls[2] | S | ribbon-windows |  | NO PHOTO | NO PHOTO | coverage 0 |
| politie-meer-en-vaart | walls[3] | S | ribbon-windows |  | NO PHOTO | NO PHOTO | coverage 0 |
| politiepost-ijburg | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.15; window shape tall vs photo square; wall family unresolved (#413129 is dark and neutral, brick courses not resolved): lightness and hue judged only |
| politiepost-ijburg | walls[1] | S | brick-bay-grid | columns | FAIL | FAIL | glazing storey band off by 0.16; storey 2: widest opening 1.3 m vs photo 8.9 m (a ribbon against windows); wall family unresolved (#3d2d25 is dark and neutral, brick courses not resolved): lightness and hue judged only; columns 4 vs photo 3 |
| politiepost-ijburg | walls[2] | S | brick-bay-grid | punched | FAIL | FAIL | window shape tall vs photo square |
| overtoom-283-084999 | walls[0] | S | brick-bay-grid | punched | PASS | PASS |  |
| overtoom-283-084999 | walls[1] | S | brick-bay-grid | punched | WARN | WARN | mask IoU 0.336 < 0.45 |
| overtoom-283-084999 | walls[2] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| nieuwpoortstraat-126319 | walls[0] | S | plinth-shopfronts | punched | FAIL | FAIL | storey 3: widest opening 1.7 m vs photo 13.1 m (a ribbon against windows) |
| nieuwpoortstraat-126319 | walls[1] | S | ribbon-windows |  | NO PHOTO | NO PHOTO | coverage 0 |
| nieuwpoortstraat-126319 | walls[2] | S | plinth-shopfronts | columns | NO EVIDENCE | NO EVIDENCE | foliage 26 % > 25 % |
| kattenburgerstraat-164930 | walls[0] | S | ribbon-windows | punched | NO EVIDENCE | NO EVIDENCE | foliage 41 % > 25 % |
| kattenburgerstraat-164930 | walls[1] | S | ribbon-windows |  | NO PHOTO | NO PHOTO | coverage 0 |
| warmoesstraat-garage-165687 | walls[0] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| warmoesstraat-garage-165687 | walls[1] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| warmoesstraat-garage-165687 | walls[2] | S | brick-bay-grid | blank | NO EVIDENCE | NO EVIDENCE | obliquity 47 deg > 45 |
| warmoesstraat-garage-165687 | walls[3] | S | brick-bay-grid | punched | WARN | WARN | mask IoU 0.129 < 0.45 |
| engelsesteeg-165098 | walls[0] | S | brick-bay-grid | columns | NO EVIDENCE | NO EVIDENCE | foliage 26 % > 25 % |
| engelsesteeg-165098 | walls[1] | S | brick-bay-grid | punched | WARN | WARN | mask IoU 0.304 < 0.45 |
| engelsesteeg-165098 | walls[3] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| oz-achterburgwal-233-180196 | walls[0] | S | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | camera 6.8 m < 8 m from a 23 m wall |
| oz-achterburgwal-233-180196 | walls[1] | S | brick-bay-grid | punched | FAIL | FAIL | wall dL +0.14; glazing storey band off by 0.24 mean 0.29 vs photo 0.43; storey 3: widest opening 1.9 m vs photo 8.8 m (a ribbon against windows); wall family unresolved (#2d2a28 is dark and neutral, brick courses not resolved): lightness and hue judged only |
| westerdok-186086 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | wall dL +0.25; wall family unresolved (#474c53 is dark and neutral, brick courses not resolved): lightness and hue judged only; columns 14 vs photo 52 |
| westerdok-186086 | walls[1] | S | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | foliage 47 % > 25 % |
| westerdok-186086 | walls[2] | S | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | foliage 28 % > 25 %; washed out 62 % > 30 % |
| westerdok-186086 | walls[3] | S | brick-bay-grid | ribbon | FAIL | FAIL | glazing storey band off by 0.25 |
| westerdok-186086 | walls[4] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| nieuwe-achtergracht-253754 | walls[0] | S | brick-bay-grid | punched | WARN | WARN | mask IoU 0.321 < 0.45 |
| nieuwe-achtergracht-253754 | walls[1] | S | brick-bay-grid | punched | PASS | PASS |  |
| nieuwe-achtergracht-253754 | walls[2] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| aambeeldstraat-202176 | walls[0] | S | ribbon-windows | punched | FAIL | FAIL | glazing  mean 0.25 vs photo 0.44; wall family unresolved (#535450 is dark and neutral, brick courses not resolved): lightness and hue judged only |
| aambeeldstraat-202176 | walls[1] | S | ribbon-windows | punched | NO EVIDENCE | NO EVIDENCE | foliage 26 % > 25 % |
| oude-turfmarkt-168172 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.19 |
| oude-turfmarkt-168172 | walls[1] | S | brick-bay-grid | curtain | FAIL | FAIL | wall dL +0.78; glazing storey band off by 0.40 mean 0.36 vs photo 0.77; wall family unresolved (#372c1c is dark and neutral, brick courses not resolved): lightness and hue judged only |
| oba-javaplein | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.18 mean 0.39 vs photo 0.29; window shape square vs photo tall; columns 14 vs photo 10 |
| oba-javaplein | walls[1] | S | brick-bay-grid | punched | WARN | WARN | mask IoU 0.2 < 0.45 |
| oba-javaplein | walls[2] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.40 mean 0.29 vs photo 0.53; window shape square vs photo tall; columns 20 vs photo 27 |
| oba-javaplein | walls[3] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.21; window shape square vs photo tall; columns 10 vs photo 17 |
| oba-olympisch-kwartier | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.45 mean 0.30 vs photo 0.65 |
| oba-olympisch-kwartier | walls[1] | S | brick-bay-grid | columns | FAIL | FAIL | glazing storey band off by 0.16; window shape square vs photo tall; columns 5 vs photo 14 |
| oba-olympisch-kwartier | walls[3] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.18 mean 0.25 vs photo 0.41; window shape square vs photo wide; columns 6 vs photo 4 |
| oba-olympisch-kwartier | walls[4] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.41 mean 0.44 vs photo 0.57 |
| oba-olympisch-kwartier | walls[5] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.20 mean 0.16 vs photo 0.27; window shape tall vs photo square |
| oba-olympisch-kwartier | walls[6] | S | brick-bay-grid | punched | WARN | WARN | mask IoU 0.371 < 0.45 |
| oba-olympisch-kwartier | walls[7] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.20 |
| oba-olympisch-kwartier | walls[8] | S | brick-bay-grid | punched | FAIL | FAIL | window shape square vs photo tall |
| oba-linnaeus | walls[0] | S | ribbon-windows | punched | FAIL | FAIL | glazing storey band off by 0.36 mean 0.51 vs photo 0.40 |
| oba-linnaeus | walls[1] | S | brick-bay-grid | columns | FAIL | FAIL | glazing storey band off by 0.33 mean 0.26 vs photo 0.53; window shape square vs photo tall; columns 4 vs photo 6 |
| oba-linnaeus | walls[2] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| stadsloket-oost | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.23 mean 0.25 vs photo 0.45; window shape tall vs photo square |
| stadsloket-oost | walls[1] | S | brick-bay-grid | punched | FAIL | FAIL | wall dL +0.36; glazing storey band off by 0.29 mean 0.20 vs photo 0.53; storey 1: widest opening 2.5 m vs photo 8.6 m (a ribbon against windows) |
| stadsloket-oost | walls[2] | S | brick-bay-grid | punched | WARN | WARN | glazing not judged (frames cannot be told from bands: 12 % of the front is a band run along openings (glazing 0.308..0.427)); mask IoU 0.272 < 0.45 |
| stadsloket-noord | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | wall hue 30 deg; glazing storey band off by 0.25; window shape square vs photo wide; wall family unresolved (#363f40 is dark and neutral, brick courses not resolved): lightness and hue judged only; columns 5 vs photo 3 |
| stadsloket-noord | walls[1] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.16; wall family unresolved (#34333f is dark and neutral, brick courses not resolved): lightness and hue judged only; columns 4 vs photo 6 |
| stadsloket-noord | walls[2] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.21; window shape wide vs photo tall; wall family unresolved (#34323b is dark and neutral, brick courses not resolved): lightness and hue judged only; columns 6 vs photo 8 |
| stadsloket-zuidoost | walls[0] | S | brick-bay-grid | punched | PASS | PASS |  |
| stadsloket-zuidoost | walls[1] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.18 |
| stadsloket-zuidoost | walls[2] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.24 mean 0.30 vs photo 0.42 |
| stadsloket-zuidoost | walls[3] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| stadsdeel-nieuw-west | walls[0] | S | ribbon-windows |  | NO PHOTO | NO PHOTO | coverage 0 |
| stadsdeel-nieuw-west | walls[1] | S | ribbon-windows |  | NO PHOTO | NO PHOTO | coverage 0 |
| stadsdeel-nieuw-west | walls[2] | S | ribbon-windows | curtain | FAIL | FAIL | glazing storey band off by 0.40 mean 0.61 vs photo 0.82 |
| stadsdeel-nieuw-west | walls[3] | S | ribbon-windows | punched | FAIL | FAIL | wall family paint vs photo brick; columns 6 vs photo 18 |
| stadsdeel-nieuw-west | walls[4] | S | ribbon-windows |  | NO PHOTO | NO PHOTO | coverage 0 |
| stadsdeel-nieuw-west | walls[5] | S | ribbon-windows |  | NO PHOTO | NO PHOTO | coverage 0 |
| stadsloket-west | walls[0] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| stadsloket-west | walls[1] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.48 mean 0.48 vs photo 0.32; storey 2: widest opening 23.9 m vs photo 1.4 m (a ribbon against windows); storey 3: widest opening 23.9 m vs photo 2.2 m (a ribbon against windows); storey 4: widest opening 23.9 m vs photo 2.4 m (a ribbon against windows) |
| stadsloket-west | walls[2] | S | curtain-wall | punched | FAIL | FAIL | glazing storey band off by 0.34 mean 0.68 vs photo 0.55; wall family unresolved (#464444 is dark and neutral, brick courses not resolved): lightness and hue judged only; columns 20 vs photo 82 |
| stadsloket-west | walls[3] | S | curtain-wall | punched | FAIL | FAIL | wall family paint vs photo brick; glazing storey band off by 0.58 mean 0.60 vs photo 0.14; columns none vs photo 10 (was: wall family paint vs photo brick; glazing storey band off by 0.60 mean 0.61 vs photo 0.14; columns 20 vs photo 10) |
| stadsloket-west | walls[4] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| hamerkanaal-209-243116 | walls[0] | S | brick-bay-grid | punched | WARN | WARN | columns 15 vs photo 29; mask IoU 0.315 < 0.45 |
| hamerkanaal-209-243116 | walls[1] | S | brick-bay-grid | curtain | FAIL | FAIL | glazing storey band off by 0.67 mean 0.36 vs photo 0.68; wall family unresolved (#3b333a is dark and neutral, brick courses not resolved): lightness and hue judged only |
| cgm-190-202277 | walls[0] | S | brick-bay-grid | punched | WARN | WARN | mask IoU 0.211 < 0.45 |
| cgm-190-202277 | walls[1] | S | brick-bay-grid | punched | FAIL | FAIL | glazing  mean 0.16 vs photo 0.57 |
| cgm-190-202277 | walls[2] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.25; columns 10 vs photo 13 |
| hotel-arena-236788 | walls[0] | S | brick-bay-grid | punched | WARN | WARN | mask IoU 0.291 < 0.45 |
| hotel-arena-236788 | walls[1] | S | brick-bay-grid | punched | FAIL | FAIL | wall dL +0.41; glazing storey band off by 0.54 mean 0.61 vs photo 0.28; wall family unresolved (#382e27 is dark and neutral, brick courses not resolved): lightness and hue judged only; columns 6 vs photo 4 |
| hotel-arena-236788 | walls[2] | S | brick-bay-grid | punched | FAIL | FAIL | wall dL +0.40; glazing  mean 0.52 vs photo 0.26; wall family unresolved (#3b2f29 is dark and neutral, brick courses not resolved): lightness and hue judged only; columns 6 vs photo 11 |
| hotel-arena-236788 | walls[3] | S | curtain-wall |  | NO PHOTO | NO PHOTO | coverage 0 |
| hotel-arena-236788 | walls[4] | S | curtain-wall | curtain | NO EVIDENCE | NO EVIDENCE | foliage 26 % > 25 % |
| utrechtsestraat-15-169214 | walls[0] | S | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | foliage 31 % > 25 % |
| utrechtsestraat-15-169214 | walls[1] | S | brick-bay-grid | punched | WARN | WARN | mask IoU 0.395 < 0.45 |
| utrechtsestraat-15-169214 | walls[2] | S | brick-bay-grid | punched | PASS | PASS |  |
| marnixstraat-248-185422 | walls[0] | S | ribbon-windows | punched | FAIL | FAIL | wall family paint vs photo brick; glazing storey band off by 0.32 mean 0.41 vs photo 0.25; storey 2: widest opening 19.6 m vs photo 3.3 m (a ribbon against windows); storey 3: widest opening 19.6 m vs photo 2.5 m (a ribbon against windows); storey 5: widest opening 19.6 m vs photo 3.8 m (a ribbon against windows); storey 6: widest opening 19.6 m vs photo 8.4 m (a ribbon against windows); columns 8 vs photo 11 |
| marnixstraat-248-185422 | walls[1] | S | ribbon-windows | punched | NO EVIDENCE | NO EVIDENCE | washed out 55 % > 30 % |
| marnixstraat-248-185422 | walls[2] | S | ribbon-windows | curtain | NO EVIDENCE | NO EVIDENCE | washed out 40 % > 30 % |
| funenpark-427-184743 | walls[0] | S | ribbon-windows | punched | NO EVIDENCE | NO EVIDENCE | foliage 37 % > 25 % |
| funenpark-427-184743 | walls[1] | S | ribbon-windows | punched | NO EVIDENCE | NO EVIDENCE | foliage 38 % > 25 % |
| funenpark-427-184743 | walls[2] | S | ribbon-windows | punched | NO EVIDENCE | NO EVIDENCE | foliage 31 % > 25 % |
| funenpark-427-184743 | walls[3] | S | ribbon-windows | curtain | NO EVIDENCE | NO EVIDENCE | usable upper cells 32 % < 40 %; foliage 62 % > 25 % |
| funenpark-427-184743 | walls[4] | S | ribbon-windows | punched | NO EVIDENCE | NO EVIDENCE | washed out 71 % > 30 % |
| funenpark-427-184743 | walls[5] | S | brick-bay-grid | blank | FAIL | FAIL | glazing storey band off by 0.34 mean 0.28 vs photo 0.00 |
| funenpark-427-184743 | walls[6] | S | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | foliage 26 % > 25 % |
| funenpark-427-184743 | walls[7] | S | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | foliage 26 % > 25 % |
| westerdok-748-186003 | walls[0] | S | brick-bay-grid | columns | FAIL | FAIL | glazing storey band off by 0.32 mean 0.32 vs photo 0.47; window shape square vs photo tall |
| westerdok-748-186003 | walls[1] | S | brick-bay-grid | ribbon | FAIL | FAIL | glazing storey band off by 0.36; window shape wide vs photo tall; columns 5 vs photo 7 |
| westerdok-748-186003 | walls[2] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.30 mean 0.28 vs photo 0.17; wall family unresolved (#4e4e49 is dark and neutral, brick courses not resolved): lightness and hue judged only |
| westerdok-748-186003 | walls[3] | S | brick-bay-grid | curtain | NO EVIDENCE | NO EVIDENCE | washed out 31 % > 30 % |
| westerdok-748-186003 | walls[4] | S | brick-bay-grid | punched | FAIL | FAIL | wall hue 22 deg; glazing storey band off by 0.27; window shape square vs photo tall; columns 4 vs photo 6 |
| westerdok-748-186003 | walls[5] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.21; columns 3 vs photo 5 |
| buitenzagerij-45-100112 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.24 mean 0.18 vs photo 0.40; storey 1: widest opening 2.8 m vs photo 12.5 m (a ribbon against windows); columns 13 vs photo 61 |
| buitenzagerij-45-100112 | walls[1] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| weteringstraat-16-184747 | walls[0] | S | brick-bay-grid | punched | WARN | WARN | mask IoU 0.315 < 0.45 |
| weteringstraat-16-184747 | walls[1] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.29; storey 1: widest opening 1.6 m vs photo 12.4 m (a ribbon against windows) |
| weteringstraat-16-184747 | walls[2] | S | brick-bay-grid | punched | WARN | WARN | mask IoU 0.382 < 0.45 |
| weteringstraat-16-184747 | walls[3] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.20 |
| weteringstraat-16-184747 | walls[4] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.27 |
| barlaeus | walls[0] | S | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | washed out 33 % > 30 % |
| barlaeus | walls[1] | S | brick-bay-grid | punched | WARN | WARN | columns 3 vs photo 4; mask IoU 0.325 < 0.45 |
| barlaeus | walls[2] | S | brick-bay-grid | columns | FAIL | FAIL | glazing storey band off by 0.31 mean 0.31 vs photo 0.57; window shape tall vs photo square; columns 10 vs photo 4 |
| vossius | walls[0] | S | brick-bay-grid | ribbon | NO EVIDENCE | NO EVIDENCE | usable upper cells 38 % < 40 %; foliage 52 % > 25 % |
| vossius | walls[1] | S | brick-bay-grid | punched | WARN | WARN | mask IoU 0.442 < 0.45 |
| vossius | walls[2] | S | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | foliage 36 % > 25 % |
| vossius | walls[3] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| rijksakademie | walls[0] | S | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | foliage 39 % > 25 % |
| rijksakademie | walls[1] | S | brick-bay-grid | columns | FAIL | FAIL | glazing storey band off by 0.22 mean 0.23 vs photo 0.50; wall judged on chromaticity: the photo's exposure is not normalised and the wall reads +0.22 darker than the model's in shade or overcast light; columns 10 vs photo 7 |
| cygnus | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.18; wall family unresolved (#372e29 is dark and neutral, brick courses not resolved): lightness and hue judged only |
| kloveniersburgwal-72-171179 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | wall family brick vs photo paint; glazing  mean 0.45 vs photo 0.56 |
| kloveniersburgwal-72-171179 | walls[1] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.24 mean 0.26 vs photo 0.40; wall family unresolved (#4b5050 is dark and neutral, brick courses not resolved): lightness and hue judged only; columns 3 vs photo 2 |
| kloveniersburgwal-72-171179 | walls[2] | S | brick-bay-grid | curtain | FAIL | FAIL | wall dL -0.43; glazing storey band off by 0.34 mean 0.38 vs photo 0.85 |
| kloveniersburgwal-72-171179 | walls[3] | S | brick-bay-grid | punched | FAIL | FAIL | wall dL +0.13 |
| kloveniersburgwal-72-171179 | walls[4] | S | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | foliage 28 % > 25 % |
| kloveniersburgwal-72-171179 | walls[5] | S | brick-bay-grid | punched | PASS | PASS |  |
| van-oldenbarneveldtstraat-48-137990 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | wall dL +0.36; glazing storey band off by 0.21; window shape square vs photo wide; wall family unresolved (#3f4142 is dark and neutral, brick courses not resolved): lightness and hue judged only; columns 11 vs photo 7 |
| schaafstraat-17-091631 | walls[0] | S | ribbon-windows | punched | FAIL | FAIL | glazing storey band off by 0.39 mean 0.31 vs photo 0.10; storey 1: widest opening 9.9 m vs photo 2.3 m (a ribbon against windows); columns 14 vs photo 29 |
| schaafstraat-17-091631 | walls[1] | S | ribbon-windows | punched | FAIL | FAIL | glazing storey band off by 0.37 mean 0.31 vs photo 0.07; columns 8 vs photo 21 |
| schaafstraat-17-091631 | walls[2] | S | ribbon-windows | punched | FAIL | FAIL | wall family paint vs photo brick; columns 7 vs photo 9 |
| asterweg-19-134024 | walls[0] | S | ribbon-windows | punched | FAIL | FAIL | wall dL +0.21 |
| van-der-palmkade-191-120309 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.26 mean 0.44 vs photo 0.61; window shape tall vs photo wide; columns 5 vs photo 2 |
| tilanusstraat-23-240319 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | wall dL -0.14; storey 3: widest opening 0.8 m vs photo 17.2 m (a ribbon against windows) |
| tilanusstraat-23-240319 | walls[1] | S | blank | punched | FAIL | FAIL | wall dL -0.17; glazing storey band off by 0.76 mean 0.05 vs photo 0.36; columns 6 vs photo 10 |
| tilanusstraat-23-240319 | walls[2] | S | brick-bay-grid | punched | FAIL | FAIL | window shape tall vs photo wide; columns 18 vs photo 6 |
| hoogte-kadijk-400-251313 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.40 mean 0.17 vs photo 0.48; window shape square vs photo tall; storey 1: widest opening 3.0 m vs photo 16.7 m (a ribbon against windows); columns 6 vs photo 11 |
| hoogte-kadijk-400-251313 | walls[1] | S | brick-bay-grid | columns | FAIL | FAIL | glazing storey band off by 0.19 mean 0.20 vs photo 0.31; columns 5 vs photo 7 |
| polderweg-3-134667 | walls[0] | S | ribbon-windows | punched | FAIL | FAIL | wall dL +0.80; glazing  mean 0.61 vs photo 0.47; storey 3: widest opening 2.0 m vs photo 10.6 m (a ribbon against windows); wall family unresolved (#282322 is dark and neutral, brick courses not resolved): lightness and hue judged only |
| polderweg-3-134667 | walls[1] | S | ribbon-windows |  | NO PHOTO | NO PHOTO | coverage 0 |
| polderweg-3-134667 | walls[2] | S | ribbon-windows | punched | NO EVIDENCE | NO EVIDENCE | obliquity 52.9 deg > 45 |
| valckenierstraat-65-170734 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | wall dL +0.27; window shape wide vs photo square |
| valckenierstraat-65-170734 | walls[1] | S | ribbon-windows |  | NO PHOTO | NO PHOTO | coverage 0 |
| valckenierstraat-65-170734 | walls[2] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.24 mean 0.39 vs photo 0.22; columns 11 vs photo 19 |
| valckenierstraat-65-170734 | walls[3] | S | ribbon-windows | curtain | FAIL | FAIL | glazing  mean 0.48 vs photo 0.70 |
| houthavenkade-26-247232 | walls[0] | S | glazed-columns | punched | PASS | PASS |  |
| houthavenkade-26-247232 | walls[1] | S | glazed-columns | punched | WARN | WARN | mask IoU 0.41 < 0.45 |
| houthavenkade-26-247232 | walls[2] | S | ribbon-windows |  | NO PHOTO | NO PHOTO | coverage 0 |
| houthavenkade-26-247232 | walls[3] | S | brick-bay-grid | punched | WARN | WARN | mask IoU 0.404 < 0.45 |
| houthavenkade-26-247232 | walls[4] | S | brick-bay-grid | punched | WARN | WARN | mask IoU 0.23 < 0.45 |
| hamerkanaal-175-112128 | walls[0] | S | brick-bay-grid | ribbon | NO EVIDENCE | NO EVIDENCE | washed out 54 % > 30 % |
| hamerkanaal-175-112128 | walls[1] | S | brick-bay-grid | punched | FAIL | FAIL | window shape square vs photo tall; columns 6 vs photo 8 |
| hamerkanaal-175-112128 | walls[2] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| nieuwe-achtergracht-100-253824 | walls[0] | S | brick-bay-grid | columns | FAIL | FAIL | window shape square vs photo tall |
| waagdragerhof-198-118320 | walls[0] | S | french-window-ledge | punched | WARN | WARN | wall family unresolved (#38302f is dark and neutral, brick courses not resolved): lightness and hue judged only; mask IoU 0.438 < 0.45 |
| waagdragerhof-198-118320 | walls[1] | S | french-window-ledge | punched | FAIL | FAIL | wall hue 173 deg; glazing storey band off by 0.35; wall family unresolved (#323a3d is dark and neutral, brick courses not resolved): lightness and hue judged only |
| waagdragerhof-198-118320 | walls[2] | S | brick-bay-grid | punched | PASS | PASS |  |
| waagdragerhof-198-118320 | walls[3] | S | brick-bay-grid | punched | PASS | PASS |  |
| van-beuningenstraat-48-093853 | walls[0] | S | brick-bay-grid | curtain | FAIL | FAIL | wall dL +0.34; glazing storey band off by 0.27 mean 0.47 vs photo 0.70; wall family unresolved (#1a1711 is dark and neutral, brick courses not resolved): lightness and hue judged only |
| van-beuningenstraat-48-093853 | walls[1] | S | brick-bay-grid | punched | FAIL | FAIL | wall dL +0.15; glazing storey band off by 0.31 mean 0.36 vs photo 0.16; wall family unresolved (#474541 is dark and neutral, brick courses not resolved): lightness and hue judged only; columns none vs photo 13 |
| van-beuningenstraat-48-093853 | walls[2] | S | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | camera 5.2 m < 8 m from a 40 m wall |
| balboaplein-48-147097 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | wall hue -13 deg; glazing storey band off by 0.29 mean 0.40 vs photo 0.28 |
| balboaplein-48-147097 | walls[1] | S | brick-bay-grid | punched | FAIL | FAIL | glazing  mean 0.44 vs photo 0.55 |
| balboaplein-48-147097 | walls[2] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.18 mean 0.19 vs photo 0.29; columns 6 vs photo 8 |
| apollolaan-4-134507 | walls[0] | S | glazed-hall | punched | NO EVIDENCE | NO EVIDENCE | foliage 32 % > 25 % |
| apollolaan-4-134507 | walls[1] | S | brick-bay-grid | columns | FAIL | FAIL | glazing  mean 0.34 vs photo 0.47; window shape none vs photo tall; columns none vs photo 2 |
| apollolaan-4-134507 | walls[2] | S | curtain-wall |  | NO PHOTO | NO PHOTO | coverage 0 |
| apollolaan-4-134507 | walls[3] | S | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | foliage 27 % > 25 % |
| spinozastraat-51-243487 | walls[0] | S | brick-bay-grid | punched | WARN | WARN | wall judged on chromaticity: the photo's exposure is not normalised and the wall reads +0.31 darker than the model's in shade or overcast light; mask IoU 0.185 < 0.45 |
| spinozastraat-51-243487 | walls[1] | S | brick-bay-grid | punched | FAIL | FAIL | wall dL +0.23; glazing storey band off by 0.18 |
| spinozastraat-51-243487 | walls[2] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.20 mean 0.18 vs photo 0.29; window shape tall vs photo square; wall family unresolved (#362f2b is dark and neutral, brick courses not resolved): lightness and hue judged only |
| wg-plein-600-233657 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | window shape tall vs photo wide; columns 15 vs photo 4 |
| wg-plein-600-233657 | walls[1] | S | brick-bay-grid | punched | WARN | WARN | mask IoU 0.16 < 0.45 |
| da-costakade-146-236799 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | wall dL +0.24; glazing storey band off by 0.19 mean 0.32 vs photo 0.46; columns 11 vs photo 15 |
| da-costakade-146-236799 | walls[1] |  | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.57 mean 0.25 vs photo 0.53; window shape square vs photo tall; columns 7 vs photo 13 |
| da-costakade-146-236799 | walls[2] |  | ribbon-windows | columns | FAIL | FAIL | glazing storey band off by 0.37 mean 0.24 vs photo 0.39 |
| da-costakade-146-236799 | walls[3] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.27 mean 0.33 vs photo 0.15; columns 7 vs photo 5 |
| asterweg-19b-209785 | walls[0] | S | ribbon-windows | punched | FAIL | FAIL | glazing  mean 0.32 vs photo 0.43 |
| revaleiland-437-250186 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.18 |
| revaleiland-437-250186 | walls[1] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.42 mean 0.41 vs photo 0.30; window shape wide vs photo tall; columns 5 vs photo 8 |
| louise-wentstraat-230-165821 | walls[0] | S | brick-bay-grid | columns | FAIL | FAIL | glazing  mean 0.38 vs photo 0.49; window shape wide vs photo tall; storey 1: widest opening 3.4 m vs photo 13.1 m (a ribbon against windows); columns 18 vs photo 29 |
| louise-wentstraat-230-165821 | walls[1] | S | ribbon-windows |  | NO PHOTO | NO PHOTO | coverage 0 |
| louise-wentstraat-230-165821 | walls[2] | S | brick-bay-grid | punched | FAIL | FAIL | window shape wide vs photo square; storey 2: widest opening 3.0 m vs photo 10.1 m (a ribbon against windows); columns 8 vs photo 14 |
| wibautstraat-78-129127 | walls[0] | S | ribbon-windows | punched | FAIL | FAIL | glazing storey band off by 0.23; columns 8 vs photo 30 |
| wibautstraat-78-129127 | walls[1] | S | ribbon-windows | punched | FAIL | FAIL | glazing storey band off by 0.22 |
| wibautstraat-78-129127 | walls[2] | S | ribbon-windows | curtain | PASS | PASS |  |
| rigakade-8-078289 | walls[0] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| rigakade-8-078289 | walls[1] | S | brick-bay-grid | punched | FAIL | FAIL | wall family paint vs photo brick; glazing  mean 0.01 vs photo 0.13 |
| meeuwenlaan-132-101771 | walls[0] | S | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | washed out 52 % > 30 % |
| meeuwenlaan-132-101771 | walls[1] | S | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | foliage 33 % > 25 % |
| meeuwenlaan-132-101771 | walls[2] | S | brick-bay-grid | curtain | PASS | PASS |  |
| meeuwenlaan-132-101771 | walls[3] | S | brick-bay-grid | punched | FAIL | FAIL | glazing  mean 0.00 vs photo 0.33; columns none vs photo 13 |
| meeuwenlaan-132-101771 | walls[4] | S | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | foliage 40 % > 25 % |
| haarlemmerweg-325-110408 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | wall family paint vs photo brick; glazing storey band off by 0.53 mean 0.02 vs photo 0.43; columns 13 vs photo 19 |
| haarlemmerweg-325-110408 | walls[1] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.33 mean 0.02 vs photo 0.20; wall family unresolved (#352c29 is dark and neutral, brick courses not resolved): lightness and hue judged only; columns 13 vs photo 21 |
| haarlemmerweg-325-110408 | walls[2] | S | brick-bay-grid | punched | FAIL | FAIL | wall family paint vs photo brick; glazing storey band off by 0.85 mean 0.02 vs photo 0.62; columns 10 vs photo 16 |
| haarlemmerweg-325-110408 | walls[3] | S | ribbon-windows | punched | FAIL | FAIL | wall dL +0.39; glazing storey band off by 0.36 mean 0.36 vs photo 0.13; storey 2: widest opening 11.1 m vs photo 6.6 m (a ribbon against windows); wall family unresolved (#393e45 is dark and neutral, brick courses not resolved): lightness and hue judged only; columns 4 vs photo 10 |
| quellijnstraat-36-098847 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | window shape wide vs photo square; columns 6 vs photo 9 |
| quellijnstraat-36-098847 | walls[1] | S | brick-bay-grid | punched | WARN | WARN | columns 6 vs photo 8; mask IoU 0.161 < 0.45 |
| quellijnstraat-36-098847 | walls[2] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.27 mean 0.12 vs photo 0.34; storey 1: widest opening 1.7 m vs photo 13.8 m (a ribbon against windows) |
| spinoza-lyceum-129398 | walls[0] | S | ribbon-windows | punched | WARN | WARN | columns 16 vs photo 31; mask IoU 0.349 < 0.45 |
| spinoza-lyceum-129398 | walls[1] | S | ribbon-windows | punched | PASS | PASS |  |
| kinkerstraat-32-137280 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.56 mean 0.23 vs photo 0.66; window shape square vs photo tall |
| kinkerstraat-32-137280 | walls[1] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.39; window shape tall vs photo square |
| kinkerstraat-32-137280 | walls[2] | S | brick-bay-grid | punched | WARN | WARN | mask IoU 0.145 < 0.45 |
| kinkerstraat-32-137280 | walls[3] | S | brick-bay-grid | curtain | FAIL | FAIL | glazing storey band off by 0.83 mean 0.29 vs photo 0.79 |
| kinkerstraat-32-137280 | walls[4] |  | brick-bay-grid | punched | WARN | WARN | columns 5 vs photo 3; mask IoU 0.112 < 0.45 |
| kinkerstraat-89-092013 | walls[0] | S | ribbon-windows | punched | FAIL | FAIL | glazing storey band off by 0.23 |
| kinkerstraat-89-092013 | walls[1] |  | ribbon-windows | punched | FAIL | FAIL | glazing storey band off by 0.21; window shape wide vs photo square |
| kinkerstraat-89-092013 | walls[2] | S | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | washed out 57 % > 30 % |
| rietveld-gebouw-077325 | walls[0] | S | curtain-wall | punched | FAIL | FAIL | glazing storey band off by 0.27 mean 0.49 vs photo 0.39; storey 4: widest opening 39.3 m vs photo 3.0 m (a ribbon against windows); wall family unresolved (#4a4b47 is dark and neutral, brick courses not resolved): lightness and hue judged only (was: glazing storey band off by 0.35 mean 0.58 vs photo 0.39; storey 4: widest opening 39.3 m vs photo 3.0 m (a ribbon against windows); wall family unresolved (#4a4b47 is dark and neutral, brick courses not resolved): lightness and hue judged only; columns 6 vs photo 20) |
| rietveld-gebouw-077325 | walls[1] | S | curtain-wall | punched | FAIL | FAIL | glazing storey band off by 0.32 mean 0.37 vs photo 0.27; window shape none vs photo tall; storey 1: widest opening 12.4 m vs photo 2.3 m (a ribbon against windows); storey 2: widest opening 12.4 m vs photo 1.7 m (a ribbon against windows); storey 3: widest opening 12.4 m vs photo 0.9 m (a ribbon against windows); columns 6 vs photo 4 (was: glazing storey band off by 0.42 mean 0.43 vs photo 0.27; storey 1: widest opening 12.4 m vs photo 2.3 m (a ribbon against windows); storey 2: widest opening 12.4 m vs photo 1.7 m (a ribbon against windows); storey 3: widest opening 12.4 m vs photo 0.9 m (a ribbon against windows); columns 6 vs photo 4) |
| rietveld-gebouw-077325 | walls[2] | S | curtain-wall | punched | NO EVIDENCE | NO EVIDENCE | foliage 33 % > 25 % |
| rietveld-gebouw-077325 | walls[3] | S | curtain-wall |  | NO PHOTO | NO PHOTO | coverage 0 |
| rietveld-academie-091838 | walls[0] | S | ribbon-windows | blank | FAIL | FAIL | glazing storey band off by 0.20; wall family unresolved (#4b4a47 is dark and neutral, brick courses not resolved): lightness and hue judged only |
| rietveld-academie-091838 | walls[1] | S | ribbon-windows | punched | NO EVIDENCE | NO EVIDENCE | foliage 35 % > 25 % |
| rietveld-academie-091838 | walls[2] | S | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | foliage 40 % > 25 %; washed out 52 % > 30 % |
| rietveld-academie-091838 | walls[3] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| oostpoort-montessori-080630 | walls[0] | S | brick-bay-grid | punched | PASS | PASS |  |
| oostpoort-montessori-080630 | walls[1] | S | brick-bay-grid | punched | FAIL | FAIL | glazing  mean 0.25 vs photo 0.38; wall family unresolved (#626460 is dark and neutral, brick courses not resolved): lightness and hue judged only |
| oostpoort-montessori-080630 | walls[2] | S | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | obliquity 45.9 deg > 45 |
| pand-165427 | walls[0] | S | brick-bay-grid | punched | WARN | WARN | wall family unresolved (#4f4c4d is dark and neutral, brick courses not resolved): lightness and hue judged only; mask IoU 0.436 < 0.45 |
| pand-165427 | walls[1] | S | brick-bay-grid | punched | WARN | WARN | wall family unresolved (#413f3d is dark and neutral, brick courses not resolved): lightness and hue judged only; mask IoU 0.367 < 0.45 |
| pand-165427 | walls[2] | S | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | camera 5.1 m < 8 m from a 18 m wall |
| pand-165427 | walls[3] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| pand-165427 | walls[4] | S | brick-bay-grid | punched | WARN | WARN | wall family unresolved (#414040 is dark and neutral, brick courses not resolved): lightness and hue judged only |
| pand-165427 | walls[5] | S | brick-bay-grid | punched | WARN | WARN | mask IoU 0.226 < 0.45 |
| pand-165427 | walls[6] | S | brick-bay-grid | punched | WARN | WARN | mask IoU 0.42 < 0.45 |
| pand-165427 | walls[7] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| van-eeghenstraat-97-237151 | walls[0] | S | brick-bay-grid | curtain | FAIL | FAIL | wall dL +0.32; glazing storey band off by 0.59 mean 0.32 vs photo 0.78; wall family unresolved (#0b1f1f is dark and neutral, brick courses not resolved): lightness and hue judged only |
| van-eeghenstraat-97-237151 | walls[1] | S | brick-bay-grid | columns | FAIL | FAIL | wall dL +0.17; glazing storey band off by 0.37 |
| van-eeghenstraat-180-236607 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.33 mean 0.40 vs photo 0.12; wall family unresolved (#38312e is dark and neutral, brick courses not resolved): lightness and hue judged only; columns 3 vs photo 4 |
| van-eeghenstraat-180-236607 | walls[1] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| koningslaan-28-237339 | walls[0] | S | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | foliage 30 % > 25 % |
| koningslaan-28-237339 | walls[1] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| koninginneweg-34-150885 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | wall dL +0.15; glazing storey band off by 0.20 |
| emmalaan-4-236822 | walls[0] | S | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | foliage 38 % > 25 % |
| emmalaan-4-236822 | walls[1] | S | brick-bay-grid | columns | NO EVIDENCE | NO EVIDENCE | foliage 40 % > 25 % |
| emmalaan-4-236822 | walls[2] | S | brick-bay-grid | punched | WARN | WARN | mask IoU 0.286 < 0.45 |
| haarlemmerweg-217-101656 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.26; storey 5: widest opening 18.0 m vs photo 2.6 m (a ribbon against windows) |
| haarlemmerweg-217-101656 | walls[1] |  | brick-bay-grid | punched | FAIL | FAIL | wall dL +0.22; window shape wide vs photo tall; columns 12 vs photo 3 |
| haarlemmerweg-217-101656 | walls[2] |  | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | foliage 46 % > 25 % |
| haarlemmerweg-285-097137 | walls[0] | S | brick-bay-grid | punched | WARN | WARN | mask IoU 0.291 < 0.45 |
| haarlemmerweg-285-097137 | walls[1] | S | brick-bay-grid | punched | FAIL | FAIL | wall dL +0.23; glazing storey band off by 0.51 mean 0.21 vs photo 0.60 |
| haarlemmerweg-285-097137 | walls[2] |  | brick-bay-grid | columns | FAIL | FAIL | glazing storey band off by 0.29 mean 0.28 vs photo 0.42; window shape square vs photo tall; wall judged on chromaticity: the photo's exposure is not normalised and the wall reads +0.24 darker than the model's in shade or overcast light; columns 10 vs photo 29 |
| haarlemmerweg-285-097137 | walls[3] |  | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| haarlemmerweg-315-135676 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | wall dL +0.19 |
| haarlemmerweg-201-160400 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | wall dL +0.21; glazing storey band off by 0.27 mean 0.42 vs photo 0.59 |
| haarlemmerweg-77-106960 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | wall dL +0.15 |
| haarlemmerweg-77-106960 | walls[1] | S | brick-bay-grid | punched | FAIL | FAIL | wall dL +0.18 |
| haarlemmerweg-63-081533 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | wall dL +0.20; glazing storey band off by 0.29 mean 0.26 vs photo 0.11 |
| haarlemmerweg-63-081533 | walls[1] | S | brick-bay-grid | punched | FAIL | FAIL | wall dL +0.24 |
| haarlemmerweg-99-131644 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.39 mean 0.34 vs photo 0.57 |
| haarlemmerweg-105-100677 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.19 mean 0.35 vs photo 0.48; wall judged on chromaticity: the photo's exposure is not normalised and the wall reads +0.20 darker than the model's in shade or overcast light |
| haarlemmerweg-91-091729 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | wall dL +0.21; glazing storey band off by 0.19 mean 0.31 vs photo 0.51 |
| haarlemmerweg-91-091729 | walls[1] | S | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | camera 7.9 m < 8 m from a 20 m wall |
| haarlemmerweg-73-084332 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | wall dL +0.26; columns 6 vs photo 4 |
| haarlemmerweg-89-097106 | walls[0] | S | brick-bay-grid | punched | FAIL | FAIL | wall dL +0.28 |
| haarlemmerweg-337-118325 | walls[0] | S | brick-bay-grid | punched | WARN | WARN | wall family unresolved (#62656c is dark and neutral, brick courses not resolved): lightness and hue judged only; columns 13 vs photo 7; mask IoU 0.259 < 0.45 |
| haarlemmerweg-337-118325 | walls[1] | S | brick-bay-grid | punched | FAIL | FAIL | glazing  mean 0.18 vs photo 0.51; wall family unresolved (#555c60 is dark and neutral, brick courses not resolved): lightness and hue judged only |
| haarlemmerweg-778 | walls[0] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| haarlemmerweg-778 | walls[1] |  | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| haarlemmerweg-778 | walls[2] |  | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| haarlemmerweg-778 | walls[3] |  | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | washed out 35 % > 30 % |
| haarlemmerweg-940 | walls[0] | S | brick-bay-grid | punched | NO EVIDENCE | NO EVIDENCE | usable upper cells 38 % < 40 % |
| haarlemmerweg-940 | walls[1] | S | brick-bay-grid | punched | FAIL | FAIL | glazing storey band off by 0.36 mean 0.35 vs photo 0.19 |
| haarlemmerweg-940 | walls[2] | S | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
| haarlemmerweg-940 | walls[3] |  | brick-bay-grid |  | NO PHOTO | NO PHOTO | coverage 0 |
