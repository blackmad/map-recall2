# Rails class probe, 2026-11-10 (lane rails-class)

Feedback 2026-11-09, desktop Free Ride, Westpoort / Sloterdijk, build 6a901ba: #10 minor surface issues in rail bridge,
#12 road and rail looks very broken (Arlandabrug), #13 weird uncovering effect on rails (Kimpoweg), #16 very broken
height / rails (Radarweg underpass), #18 lines on the road (Radarweg junction).

Method: `scripts/own-ground/probe-rails-class.ts` builds every rail cell (139, LOD 0, roads-v1 on) with the production
`buildCell` and scans the meshes. Offline renders: `scripts/own-ground/rail-view.ts`. The feedback items carry no pose
(only the HUD street names); the five spots were placed from the street/bridge names and the probe's findings (the
Arlandabrug is at 4.84484,52.38597 in bridges.json). Browser frames were not taken (machine load 30 for the whole session);
the before/after images are CPU renders of the built ground, not the game shader.

## Counts, whole city (139 rail cells)

| class | what | before | after |
|---|---|---|---|
| a crossing | runs of non-bridge track where the bed stands more than 0.2 m over/under an asphalt, klinker or cycle surface | 587 runs, 18672 m | 309 runs, 12838 m |
| b height | road more than 0.6 m above/below a non-bridge bed with no deck structure between | 56 runs | 50 runs |
| c ramp | steep (>25 degrees) land/square/paving/gravel sheets >0.3 m2 within 8 m of a bed, per 20 m | 2021 bins | 2021 bins |
| d seam | road-layer triangles fighting another layer's (same draw rank, within 5 mm) at the Radarweg junction cell (-5_2) | 18 | 18 (not touched) |

Run length is the metric's unit (2 m samples); a "run" with a 0.35 m maximum may be mostly flat with one raised stretch,
so metres overstate the tear.

## a. Crossing: worst 20 before (by max step x length)

| lng,lat | kind | max step m (+ bed over road) | run |
|---|---|---|---|
| 4.92924,52.36999 | tram | 0.36 | 206 samples |
| 4.96192,52.37191 | tram | 0.35 | 211 samples |
| 4.96699,52.37001 | tram | 0.34 | 214 samples |
| 4.90476,52.37815 | tram | 0.59 | 114 samples |
| 4.83802,52.39302 | rail | 0.55 | 105 samples |
| 4.93189,52.37163 | tram | 0.47 | 111 samples |
| 4.90867,52.37765 | tram | 0.41 | 118 samples |
| 4.90705,52.36738 | tram | 0.36 | 110 samples |
| 4.95243,52.36528 | tram | 0.49 | 80 samples |
| 4.96353,52.37147 | tram | 0.42 | 91 samples |
| 4.97571,52.36556 | tram | 0.48 | 79 samples |
| 4.91775,52.34769 | tram | 0.56 | 67 samples |
| 4.90443,52.36809 | tram | 0.35 | 107 samples |
| 5.02841,52.35609 | tram | 0.52 | 72 samples |
| 4.809,52.37668 | tram | 0.39 | 95 samples |
| 4.95017,52.36514 | tram | 0.53 | 68 samples |
| 4.90715,52.36731 | tram | 0.36 | 99 samples |
| 4.909,52.36737 | tram | 0.46 | 71 samples |
| 4.96465,52.371 | tram | 0.37 | 86 samples |
| 4.81169,52.37644 | tram | 0.33 | 94 samples |

After the fix, worst 20:

| lng,lat | kind | max step m | run |
|---|---|---|---|
| 4.96192,52.37191 | tram | 0.35 | 211 samples |
| 4.96699,52.37001 | tram | 0.34 | 214 samples |
| 4.92924,52.36999 | tram | 0.34 | 206 samples |
| 4.90476,52.37815 | tram | 0.59 | 114 samples |
| 4.83802,52.39302 | rail | 0.55 | 105 samples |
| 4.93189,52.37163 | tram | 0.47 | 111 samples |
| 4.90867,52.37765 | tram | 0.41 | 118 samples |
| 4.90705,52.36738 | tram | 0.36 | 110 samples |
| 4.95243,52.36528 | tram | 0.49 | 80 samples |
| 4.96353,52.37147 | tram | 0.42 | 91 samples |
| 4.97571,52.36556 | tram | 0.48 | 79 samples |
| 4.91775,52.34769 | tram | 0.56 | 67 samples |
| 4.90443,52.36809 | tram | 0.35 | 107 samples |
| 5.02841,52.35609 | tram | 0.52 | 72 samples |
| 4.809,52.37668 | tram | 0.39 | 95 samples |
| 4.95017,52.36514 | tram | 0.53 | 68 samples |
| 4.909,52.36737 | tram | 0.48 | 71 samples |
| 4.90715,52.36731 | tram | 0.33 | 99 samples |
| 4.81169,52.37644 | tram | 0.33 | 94 samples |
| 5.02841,52.35609 | tram | 0.5 | 62 samples |

Cause: railTracks `atGrade` flattened only the pieces whose own segment crossed a street's centreline. A 6 m piece ending
2 m short of a 7 m carriageway, or a tram laid along a street, kept the bed's 0.32 m topLift over the asphalt, so the
ballast stood as a mound across the road. Fix: `onStreetTest` (railTracks.ts): a piece is flat where its segment comes
within the street's half width plus the bed's top half width (1.55 m) of a non-bridge, non-tunnel street centreline.

## b. Height: worst 20 (before)

| lng,lat | kind | step m (road minus bed) | run |
|---|---|---|---|
| 4.95799,52.37288 | tram | -5.9 | road-under-rail 2 samples in-tunnel-cut |
| 4.87856,52.38749 | rail | -2.13 | road-under-rail 2 samples in-tunnel-cut |
| 4.84298,52.35813 | tram | -2.13 | road-under-rail 5 samples |
| 4.8786,52.38751 | rail | -1.74 | road-under-rail 2 samples in-tunnel-cut |
| 4.83919,52.38758 | tram | -1.73 | road-under-rail 6 samples |
| 4.98307,52.31261 | subway | -1.68 | road-under-rail 2 samples |
| 4.95972,52.34844 | rail | -1.58 | road-under-rail 2 samples |
| 4.96096,52.3485 | rail | -1.55 | road-under-rail 3 samples |
| 4.84206,52.35782 | tram | -1.5 | road-under-rail 3 samples |
| 4.93471,52.35864 | rail | -1.5 | road-under-rail 2 samples in-tunnel-cut |
| 4.83919,52.38758 | tram | -1.48 | road-under-rail 7 samples |
| 4.95996,52.34871 | rail | -1.45 | road-under-rail 4 samples |
| 4.96034,52.34826 | rail | -1.43 | road-under-rail 2 samples |
| 4.84287,52.35782 | tram | -1.41 | road-under-rail 2 samples |
| 4.98336,52.27201 | rail | -1.41 | road-under-rail 2 samples |
| 4.84933,52.40147 | rail | -1.39 | road-under-rail 8 samples |
| 4.89834,52.37939 | rail | -1.37 | road-under-rail 3 samples |
| 4.95993,52.34867 | rail | -1.37 | road-under-rail 4 samples |
| 4.96076,52.34842 | rail | -1.35 | road-under-rail 6 samples |
| 4.93312,52.37239 | tram | -1.33 | road-under-rail 7 samples |

All are non-bridge tram/rail tracks standing over a road that lies 1-6 m below (tram viaduct approaches the OSM data does
not tag bridge=yes; Arlandabrug 4.8448,52.3862, 4.8392,52.3876; Piet Heinkade tram 4.932,52.372; Wibautstraat tram
4.843,52.358). 4 of 56 lie in a tunnel cut strip. Not fixed in this lane (see TODO).

## c. Ramp: worst 20 (m2 of steep ground sheet beside a bed)

| lng,lat | kind | m2 | max drop |
|---|---|---|---|
| 4.98038,52.27503 | rail | 1231.1 | max drop 5.8 m |
| 4.98261,52.27257 | rail | 943.1 | max drop 6.1 m |
| 4.98121,52.27438 | rail | 926.5 | max drop 6.4 m |
| 4.98108,52.27426 | rail | 863.4 | max drop 6.5 m |
| 4.85319,52.39505 | subway | 795.3 | max drop 3.4 m |
| 4.8053,52.41398 | rail | 790.9 | max drop 4.8 m |
| 4.98062,52.27503 | rail | 762.8 | max drop 5.8 m |
| 4.9605,52.29719 | rail bridge | 748.6 | max drop 4.6 m |
| 4.9833,52.27208 | rail | 682.5 | max drop 4.9 m |
| 4.94862,52.35482 | rail | 628.7 | max drop 4.1 m |
| 4.90685,52.37673 | rail | 604 | max drop 3.5 m |
| 4.80552,52.41439 | rail | 546 | max drop 5.2 m |
| 4.91897,52.37645 | tram | 542.4 | max drop 3.8 m |
| 4.90285,52.3778 | rail | 487.5 | max drop 3.8 m |
| 4.81394,52.39088 | rail | 485.7 | max drop 5.1 m |
| 4.93528,52.32478 | subway | 480.6 | max drop 5.6 m |
| 4.88872,52.33832 | subway | 478.9 | max drop 8.6 m |
| 4.98005,52.27567 | rail | 460.7 | max drop 4.4 m |
| 4.98272,52.27271 | rail | 444.2 | max drop 5.4 m |
| 4.92736,52.3741 | rail | 430.3 | max drop 4.4 m |

The top of the list is Schiphol-Zuid / Sloterdijk / Amstel cuttings and embankments (real topography, 3-8 m drops). Near
the user's spots: 4.83904,52.38181 subway ramp 203 m2, 4.83887,52.38126 150 m2 (the Sloterdijk metro ramp up to the
viaduct, Kimpoweg 90 m north), 4.83583,52.38874 rail trench 342 m2 (Radarweg).

## d. Junction seams

Radarweg / Basisweg cell: 18 fights (paving/gravel at 4.83781,52.39244) and 1,419 hidden triangles (asphalt under
paving / cycle, invisible). No z-fight sits at the junction in the screenshot, so the lines are not coplanar road layers;
likely survey markings / sliver edges. Not fixed; see TODO.

## What changed, what did not

Changed: `onStreetTest` (railTracks.ts) + the groundCell wiring (`railOnStreet`, default on, `?`-less: store option for
A/B). City-wide crossing runs over 0.2 m: 587 to 309 (-47 %), metres 18,672 to 12,838. Cells with no rail are
byte-identical (the test only feeds `atGrade`); the unit test pins a street 20 m off the track as byte-identical.

Named pins (`scripts/own-ground/check-rail-street.ts`, tear metres before / after): Arlandabrug tram 50 / 0 (fixed);
Sloterdijk viaduct 46 / 46 and Kimpoweg 84 / 84 (unfixed, class b: a tram bed 0.3-0.5 m over a road that dips 1.5 m
under it, no structure); Radarweg underpass 0 / 0 and Radarweg junction 0 / 0 (their defects are class b/c/d, not
crossings).

Images (CPU renders, `rail-view.ts`, not the game shader): `docs/reports/rails-class-20261110/arlanda-before.png`,
`arlanda-after.png` (identical to the eye: the tear was a 0.3 m mound, the visible breakage there is the class b
hump), `ramp-b0.png` (Sloterdijk metro ramp), `radar-b0.png`, `kimpo3.png`; the five feedback screenshots are copied to
`/Users/blackmad/Code/map-recall2-screenshots-a1/roads/2026-11-10-rails/` (not committed).

## Not done (diagnosis for the next lane)

1. Class b: a non-bridge track whose bed rides over a lower road with no structure: tram viaduct approaches OSM does
   not tag `bridge=yes`. The Arlandabrug transect (4.8430-4.8458, 52.3861) shows the tram bed rising 0.1 to 3.7 m on a slab
   over land at -0.2 (the road), then the land fill hump at 2.7-3.0: a hump with lowered roads both sides. Candidate fix:
   promote such pieces to bridge (railProfile approaches, railBridge piers) where a non-tunnel street at least 1 m lower
   passes under the bed, 99 runs city-wide.
2. Class c: beige ramps are the steep `land` sheets beside raised beds (the 5 m land grid against 6 m bed pieces);
   no change made.
3. Class d: the Radarweg lines are not coplanar road layers (18 fights in the cell, none at the junction). Next step is
   a top-down raster of `paint` against asphalt at 4.8366,52.3908 with `render-topdown.ts`.
