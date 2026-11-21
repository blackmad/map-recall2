# Belt review candidates: Herengracht 2-90 (even side)

Face `herengracht-2-90-even`, generated 2026-11-21 09:49 by `scripts/belt-review/prepare.ts`. Images: `belt-review/herengracht-2-90-even` in map-recall2-source-data.

| | pands | share |
|---|---:|---:|
| pands on the face | 42 | |
| with at least one hard-pass candidate | 42 | 100 % |
| ... of which a wall crop passes | 42 | 100 % |
| strip-only (only a strip slice passes) | 0 | 0 % |
| none (no candidate passes the hard flags) | 0 | 0 % |
| judged good (hard pass and Jev quality >= 0.5) | 29 | 69 % |

Candidates: 249 (249 wall, 0 strip), 5.9 per pand; 244 pass the hard flags, 218 pass every flag; 235 leaf-off; 244 judged.
Distinct capture years per pand: median 5.
Resolution: display images are 50-100 px/m (median 80); 0 below 50 px/m (pixel budget on a wide wall), 75 where the panorama itself gives under 50 px/m (camera over ~25 m away, upsampled).

Facade wider than the BAG span (window columns on the auto-pick, facadeWidth.ts; a flag for the reviewer, not a measurement): 25 of 42 pands (90, 88, 86, 84, 80, 76–78, 72, 66, 64, 60, 56, 54, 50–52, 48, 46, 44, 40, 38, 34, 30, 22, 20, 14, 8, 6). Wall images carry 1.5 m each side of the span and 0.6 m below the ground line (`pandSpanPx`, `groundPx`).

Uncertain fronts (forced, or a BAG front edge under 3.5 m; widened to the footprint's extent along the face line, `frontUncertain`): 2 - 62 3.45 -> 5.33 m, 6 2.77 -> 5.28 m.

## Failure reasons

Every broken flag over all candidates (a candidate can break several):

| reason | candidates |
|---|---:|
| occluder | 14 |
| washed-out | 14 |
| blank | 5 |

Pands with no hard-passing candidate, by the reasons their candidates broke:

| reasons | pands |
|---|---:|

## Per pand

| # | address | wall m | cands | hard | strip | auto-pick | why | facade past span |
|---:|---|---:|---:|---:|---:|---|---|---|
| 0 | Herengracht 90 | 5.67 | 6 | 6 | 0 | w-2021-01-25-TMX7316010203-001979_pano_0001_000445 | judge: highest quality 0.592 among hard-passing candidates (pick.ts choose) | right edge cuts a window column |
| 1 | Herengracht 88 | 7.13 | 6 | 6 | 0 | w-2023-01-30-TMX7316010203-002950_pano_0000_000539 | judge: highest quality 0.437 among hard-passing candidates (pick.ts choose) | right edge cuts a window column |
| 2 | Herengracht 86 | 4.98 | 6 | 4 | 0 | w-2020-01-08-TMX7316010203-001543_pano_0000_002879 | judge: highest quality 0.576 among hard-passing candidates (pick.ts choose) | right edge cuts a window column |
| 3 | Herengracht 84 | 5.6 | 6 | 5 | 0 | w-2020-01-08-TMX7316010203-001543_pano_0000_002878 | judge: highest quality 0.576 among hard-passing candidates (pick.ts choose) | right edge cuts a window column |
| 4 | Herengracht 82 | 6.68 | 6 | 5 | 0 | w-2020-01-08-TMX7316010203-001543_pano_0000_002877 | judge: highest quality 0.586 among hard-passing candidates (pick.ts choose) | no |
| 5 | Herengracht 80 | 4.33 | 5 | 5 | 0 | w-2020-01-08-TMX7316010203-001543_pano_0000_002874 | judge: highest quality 0.747 among hard-passing candidates (pick.ts choose) | right edge cuts a window column |
| 6 | Herengracht 76–78 | 8.37 | 6 | 5 | 0 | w-2020-04-22-TMX7316010203-001666_pano_0000_003524 | judge: highest quality 0.4 among hard-passing candidates (pick.ts choose) | right: a column 0.7 m outside continues the 2.0 m spacing |
| 7 | Herengracht 74 | 4.4 | 6 | 6 | 0 | w-2023-03-13-TMX7316010203-002998_pano_0002_000059 | judge: highest quality 0.288 among hard-passing candidates (pick.ts choose) | no |
| 8 | Herengracht 72 | 4.2 | 6 | 6 | 0 | w-2017-03-13-TMX7316010203-000205_pano_0000_000496 | judge: highest quality 0.133 among hard-passing candidates (pick.ts choose) | left edge cuts a window column |
| 9 | Herengracht 70 | 4.17 | 6 | 6 | 0 | w-2025-06-16-recording_2025-06-16_03-46-32_01322 | judge: highest quality 0.152 among hard-passing candidates (pick.ts choose) | no |
| 10 | Herengracht 68 | 9.38 | 6 | 6 | 0 | w-2023-01-30-TMX7316010203-002950_pano_0000_000525 | judge: highest quality 0.66 among hard-passing candidates (pick.ts choose) | no |
| 11 | Herengracht 66 | 6.03 | 6 | 6 | 0 | w-2021-01-22-TMX7316010203-001975_pano_0000_000394 | judge: highest quality 0.517 among hard-passing candidates (pick.ts choose) | right edge cuts a window column |
| 12 | Herengracht 64 | 6.98 | 6 | 6 | 0 | w-2021-01-22-TMX7316010203-001975_pano_0000_000393 | judge: highest quality 0.679 among hard-passing candidates (pick.ts choose) | right edge cuts a window column |
| 13 | Herengracht 62 | 5.33 | 6 | 6 | 0 | w-2023-01-30-TMX7316010203-002950_pano_0000_000521 | judge: highest quality 0.314 among hard-passing candidates (pick.ts choose) | no |
| 14 | Herengracht 60 | 4.85 | 6 | 6 | 0 | w-2017-03-13-TMX7316010203-000205_pano_0000_000500 | judge: highest quality 0.282 among hard-passing candidates (pick.ts choose) | left edge cuts a window column; right edge cuts a window column |
| 15 | Herengracht 58 | 7.52 | 6 | 6 | 0 | w-2020-01-08-TMX7316010203-001543_pano_0000_002860 | judge: highest quality 0.456 among hard-passing candidates (pick.ts choose) | no |
| 16 | Herengracht 56 | 6.87 | 6 | 6 | 0 | w-2023-01-30-TMX7316010203-002950_pano_0000_000517 | judge: highest quality 0.564 among hard-passing candidates (pick.ts choose) | right: a column 0.8 m outside continues the 2.3 m spacing |
| 17 | Herengracht 54 | 14.04 | 6 | 6 | 0 | w-2019-05-13-TMX7316010203-001178_pano_0001_005313 | judge: highest quality 0.617 among hard-passing candidates (pick.ts choose) | right edge cuts a window column |
| 18 | Herengracht 50–52 | 19.49 | 6 | 6 | 0 | w-2017-03-13-TMX7316010203-000205_pano_0000_000504 | judge: highest quality 0.299 among hard-passing candidates (pick.ts choose) | right edge cuts a window column |
| 19 | Herengracht 48 | 8.57 | 6 | 6 | 0 | w-2019-01-15-TMX7316010203-001054_pano_0000_006471 | judge: highest quality 0.557 among hard-passing candidates (pick.ts choose) | left edge cuts a window column |
| 20 | Herengracht 46 | 4.56 | 6 | 6 | 0 | w-2020-04-22-TMX7316010203-001666_pano_0000_003501 | judge: highest quality 0.534 among hard-passing candidates (pick.ts choose) | left edge cuts a window column |
| 21 | Herengracht 44 | 4.46 | 6 | 6 | 0 | w-2021-01-22-TMX7316010203-001975_pano_0000_000385 | judge: highest quality 0.682 among hard-passing candidates (pick.ts choose) | right edge cuts a window column |
| 22 | Herengracht 42 | 4.37 | 5 | 5 | 0 | w-2019-05-13-TMX7316010203-001178_pano_0001_005304 | judge: highest quality 0.509 among hard-passing candidates (pick.ts choose) | no |
| 23 | Herengracht 40 | 13.26 | 5 | 5 | 0 | w-2020-01-08-TMX7316010203-001543_pano_0000_002846 | judge: highest quality 0.672 among hard-passing candidates (pick.ts choose) | right edge cuts a window column |
| 24 | Herengracht 38 | 5.64 | 6 | 6 | 0 | w-2024-12-03-b_20241203_0939_Track01_Sphere_00588 | judge: highest quality 0.653 among hard-passing candidates (pick.ts choose) | left: a column 1.2 m outside continues the 2.0 m spacing |
| 25 | Herengracht 36 | 5.47 | 6 | 6 | 0 | w-2020-01-08-TMX7316010203-001543_pano_0000_002843 | judge: highest quality 0.694 among hard-passing candidates (pick.ts choose) | no |
| 26 | Herengracht 34 | 7.13 | 6 | 6 | 0 | w-2023-02-06-TMX7316010203-002961_pano_0025_000065 | judge: highest quality 0.456 among hard-passing candidates (pick.ts choose) | left edge cuts a window column |
| 27 | Herengracht 32 | 5.02 | 6 | 6 | 0 | w-2020-01-08-TMX7316010203-001543_pano_0000_002841 | judge: highest quality 0.626 among hard-passing candidates (pick.ts choose) | no |
| 28 | Herengracht 30 | 4.82 | 6 | 6 | 0 | w-2020-01-08-TMX7316010203-001543_pano_0000_002840 | judge: highest quality 0.679 among hard-passing candidates (pick.ts choose) | right edge cuts a window column |
| 29 | Herengracht 28 | 6.12 | 6 | 6 | 0 | w-2019-01-15-TMX7316010203-001054_pano_0000_006458 | judge: highest quality 0.749 among hard-passing candidates (pick.ts choose) | no |
| 30 | Herengracht 26 | 6.12 | 6 | 6 | 0 | w-2019-01-15-TMX7316010203-001054_pano_0000_006458 | judge: highest quality 0.555 among hard-passing candidates (pick.ts choose) | no |
| 31 | Herengracht 24 | 4.76 | 6 | 6 | 0 | w-2024-12-03-b_20241203_0939_Track01_Sphere_00580 | judge: highest quality 0.718 among hard-passing candidates (pick.ts choose) | no |
| 32 | Herengracht 22 | 8.53 | 6 | 6 | 0 | w-2019-01-15-TMX7316010203-001054_pano_0000_006455 | judge: highest quality 0.643 among hard-passing candidates (pick.ts choose) | right: a column 1.1 m outside continues the 2.8 m spacing |
| 33 | Herengracht 20 | 6.78 | 6 | 6 | 0 | w-2023-02-13-TMX7316010203-002968_pano_0000_000590 | judge: highest quality 0.73 among hard-passing candidates (pick.ts choose) | right edge cuts a window column |
| 34 | Herengracht 18 | 4.46 | 6 | 6 | 0 | w-2020-01-08-TMX7316010203-001543_pano_0000_002833 | judge: highest quality 0.586 among hard-passing candidates (pick.ts choose) | no |
| 35 | Herengracht 16 | 4.53 | 6 | 6 | 0 | w-2020-01-08-TMX7316010203-001543_pano_0000_002832 | judge: highest quality 0.684 among hard-passing candidates (pick.ts choose) | no |
| 36 | Herengracht 14 | 10.06 | 6 | 6 | 0 | w-2020-01-08-TMX7316010203-001543_pano_0000_002831 | judge: highest quality 0.698 among hard-passing candidates (pick.ts choose) | right edge cuts a window column |
| 37 | Herengracht 12 | 8.66 | 6 | 6 | 0 | w-2019-05-13-TMX7316010203-001178_pano_0001_005285 | judge: highest quality 0.558 among hard-passing candidates (pick.ts choose) | no |
| 38 | Herengracht 10 | 8.64 | 6 | 6 | 0 | w-2020-04-22-TMX7316010203-001666_pano_0000_003479 | judge: highest quality 0.561 among hard-passing candidates (pick.ts choose) | no |
| 39 | Herengracht 8 | 4.44 | 6 | 6 | 0 | w-2020-04-22-TMX7316010203-001666_pano_0000_003478 | judge: highest quality 0.35 among hard-passing candidates (pick.ts choose) | left: a column 0.8 m outside continues the 2.6 m spacing; right edge cuts a window column |
| 40 | Herengracht 6 | 5.28 | 6 | 6 | 0 | w-2019-05-13-TMX7316010203-001178_pano_0001_005280 | judge: highest quality 0.25 among hard-passing candidates (pick.ts choose) | right edge cuts a window column |
| 41 | Herengracht 2–4 | 8.13 | 6 | 6 | 0 | w-2023-03-13-TMX7316010203-002998_pano_0002_000008 | judge: highest quality 0.437 among hard-passing candidates (pick.ts choose) | no |

## Run

Judged with jev-1.14.0 prompt v1: 220 new requests, $0.0210. Panorama API: 6 requests, 0 MB, 0 retries, 0 x 429; 369 s.
Walls re-picked toward the face bearing (118 deg): 0363100012175703, 0363100012179834.
Attribution: Gemeente Amsterdam, Panoramabeelden (CC BY 4.0; faces and number plates blurred by the publisher).
