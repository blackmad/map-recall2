# Belt review candidates: Keizersgracht 596-648 (even side)

Face `keizersgracht-596-648-even`, generated 2026-11-21 09:56 by `scripts/belt-review/prepare.ts`. Images: `belt-review/keizersgracht-596-648-even` in map-recall2-source-data.

| | pands | share |
|---|---:|---:|
| pands on the face | 25 | |
| with at least one hard-pass candidate | 25 | 100 % |
| ... of which a wall crop passes | 25 | 100 % |
| strip-only (only a strip slice passes) | 0 | 0 % |
| none (no candidate passes the hard flags) | 0 | 0 % |
| judged good (hard pass and Jev quality >= 0.5) | 14 | 56 % |

Candidates: 147 (147 wall, 0 strip), 5.9 per pand; 142 pass the hard flags, 134 pass every flag; 125 leaf-off; 142 judged.
Distinct capture years per pand: median 5.
Resolution: display images are 50-95 px/m (median 80); 0 below 50 px/m (pixel budget on a wide wall), 28 where the panorama itself gives under 50 px/m (camera over ~25 m away, upsampled).

Facade wider than the BAG span (window columns on the auto-pick, facadeWidth.ts; a flag for the reviewer, not a measurement): 12 of 25 pands (640, 638, 634, 626, 624, 620, 612, 610, 604, 602, 598, 596). Wall images carry 1.5 m each side of the span and 0.6 m below the ground line (`pandSpanPx`, `groundPx`).

Uncertain fronts (forced, or a BAG front edge under 3.5 m; widened to the footprint's extent along the face line, `frontUncertain`): 0.

## Failure reasons

Every broken flag over all candidates (a candidate can break several):

| reason | candidates |
|---|---:|
| occluder | 7 |
| blank | 5 |
| washed-out | 1 |

Pands with no hard-passing candidate, by the reasons their candidates broke:

| reasons | pands |
|---|---:|

## Per pand

| # | address | wall m | cands | hard | strip | auto-pick | why | facade past span |
|---:|---|---:|---:|---:|---:|---|---|---|
| 0 | Keizersgracht 648 | 5.68 | 5 | 5 | 0 | w-2019-01-14-TMX7316010203-001053_pano_0000_002226 | judge: highest quality 0.475 among hard-passing candidates (pick.ts choose) | no |
| 1 | Keizersgracht 646 | 5.52 | 5 | 5 | 0 | w-2021-01-22-TMX7316010203-001975_pano_0000_000083 | judge: highest quality 0.269 among hard-passing candidates (pick.ts choose) | no |
| 2 | Keizersgracht 642–644 | 11.21 | 6 | 6 | 0 | w-2019-01-14-TMX7316010203-001053_pano_0000_002223 | judge: highest quality 0.266 among hard-passing candidates (pick.ts choose) | no |
| 3 | Keizersgracht 640 | 5.58 | 6 | 6 | 0 | w-2023-01-11-TMX7316010203-002925_pano_0008_000123 | judge: highest quality 0.557 among hard-passing candidates (pick.ts choose) | left: a column 1.0 m outside continues the 2.0 m spacing |
| 4 | Keizersgracht 638 | 5.56 | 6 | 5 | 0 | w-2023-03-06-TMX7316010203-002988_pano_0021_000080 | judge: highest quality 0.67 among hard-passing candidates (pick.ts choose) | left: a column 0.9 m outside continues the 1.7 m spacing |
| 5 | Keizersgracht 634–636 | 5.65 | 6 | 6 | 0 | w-2021-01-22-TMX7316010203-001975_pano_0000_000085 | judge: highest quality 0.598 among hard-passing candidates (pick.ts choose) | no |
| 6 | Keizersgracht 634 | 5.56 | 6 | 6 | 0 | w-2019-01-14-TMX7316010203-001053_pano_0000_002218 | judge: highest quality 0.57 among hard-passing candidates (pick.ts choose) | right edge cuts a window column |
| 7 | Keizersgracht 632 | 6.29 | 6 | 6 | 0 | w-2023-03-06-TMX7316010203-002988_pano_0021_000077 | judge: highest quality 0.743 among hard-passing candidates (pick.ts choose) | no |
| 8 | Keizersgracht 630 | 4.87 | 6 | 6 | 0 | w-2019-01-10-TMX7316010203-001047_pano_0000_001131 | judge: highest quality 0.665 among hard-passing candidates (pick.ts choose) | no |
| 9 | Keizersgracht 628 | 4.96 | 6 | 6 | 0 | w-2016-08-16-TMX7316060226-000022_pano_0000_000503 | judge: highest quality 0.672 among hard-passing candidates (pick.ts choose) | no |
| 10 | Keizersgracht 626 | 4.9 | 6 | 6 | 0 | w-2016-08-16-TMX7316060226-000022_pano_0000_000502 | judge: highest quality 0.614 among hard-passing candidates (pick.ts choose) | left: a column 1.1 m outside continues the 1.9 m spacing; right: a column 1.1 m outside continues the 1.9 m spacing |
| 11 | Keizersgracht 624 | 5.1 | 6 | 6 | 0 | w-2019-01-10-TMX7316010203-001047_pano_0000_001128 | judge: highest quality 0.332 among hard-passing candidates (pick.ts choose) | left edge cuts a window column |
| 12 | Keizersgracht 620 | 10.99 | 6 | 6 | 0 | w-2025-06-16-recording_2025-06-16_06-21-55_00247 | judge: highest quality 0.614 among hard-passing candidates (pick.ts choose) | right: a column 1.0 m outside continues the 1.8 m spacing |
| 13 | Keizersgracht 618 | 7.54 | 6 | 6 | 0 | w-2023-03-27-TMX7316010203-003014_pano_0005_000096 | judge: highest quality 0.446 among hard-passing candidates (pick.ts choose) | no |
| 14 | Keizersgracht 616 | 7.52 | 6 | 6 | 0 | w-2019-01-10-TMX7316010203-001047_pano_0000_001123 | judge: highest quality 0.499 among hard-passing candidates (pick.ts choose) | no |
| 15 | Keizersgracht 614 | 5.39 | 6 | 6 | 0 | w-2023-03-20-TMX7316010203-003004_pano_0002_000039 | judge: highest quality 0.423 among hard-passing candidates (pick.ts choose) | no |
| 16 | Keizersgracht 612 | 9.41 | 6 | 6 | 0 | w-2019-01-14-TMX7316010203-001053_pano_0000_002205 | judge: highest quality 0.757 among hard-passing candidates (pick.ts choose) | right edge cuts a window column |
| 17 | Keizersgracht 610 | 7.54 | 6 | 6 | 0 | w-2020-01-08-TMX7316010203-001543_pano_0000_001862 | judge: highest quality 0.534 among hard-passing candidates (pick.ts choose) | left edge cuts a window column |
| 18 | Keizersgracht 608 | 7.45 | 6 | 6 | 0 | w-2019-01-14-TMX7316010203-001053_pano_0000_002202 | judge: highest quality 0.489 among hard-passing candidates (pick.ts choose) | no |
| 19 | Keizersgracht 606 | 7.41 | 6 | 6 | 0 | w-2020-01-08-TMX7316010203-001543_pano_0000_001865 | judge: highest quality 0.566 among hard-passing candidates (pick.ts choose) | no |
| 20 | Keizersgracht 604 | 14.95 | 6 | 5 | 0 | w-2025-06-16-recording_2025-06-16_06-21-55_00234 | judge: highest quality 0.665 among hard-passing candidates (pick.ts choose) | right edge cuts a window column |
| 21 | Keizersgracht 602 | 5.12 | 6 | 6 | 0 | w-2025-06-16-recording_2025-06-16_06-21-55_00231 | judge: highest quality 0.461 among hard-passing candidates (pick.ts choose) | left edge cuts a window column |
| 22 | Keizersgracht 600 | 5.19 | 5 | 4 | 0 | w-2017-03-31-TMX7316010203-000234_pano_0005_000058 | judge: highest quality 0.475 among hard-passing candidates (pick.ts choose) | no |
| 23 | Keizersgracht 598 | 5.19 | 6 | 5 | 0 | w-2023-01-30-TMX7316010203-002951_pano_0018_000097 | judge: highest quality 0.557 among hard-passing candidates (pick.ts choose) | left: a column 0.9 m outside continues the 2.4 m spacing |
| 24 | Keizersgracht 596 | 14.33 | 6 | 5 | 0 | w-2020-01-08-TMX7316010203-001543_pano_0000_001877 | judge: highest quality 0.158 among hard-passing candidates (pick.ts choose) | left: a column 0.8 m outside continues the 3.6 m spacing; right: a column 1.1 m outside continues the 3.6 m spacing |

## Run

Judged with jev-1.14.0 prompt v1: 142 new requests, $0.0134. Panorama API: 6 requests, 0 MB, 0 retries, 0 x 429; 236 s.
Walls re-picked toward the face bearing (13 deg): none.
Attribution: Gemeente Amsterdam, Panoramabeelden (CC BY 4.0; faces and number plates blurred by the publisher).
