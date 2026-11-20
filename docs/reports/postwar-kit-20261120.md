# Post-1965 housing kit (2026-11-20, lane/postwar-housing-kit-20261120)

The kit is behind `?postwarKit=1` and is off by default. **It did not pass its blind:** kit on 4 wins, kit off 5 wins, 6 ties, with 2 regressions flagged against the kit. Do not flip it.

## 1. Measured fronts

The lane read 60 cluster members from the ordinary backlog (C1, C2, C4, C5) by eye from aimed Gemeente Amsterdam panorama thumbnails (CC BY 4.0). One front was unusable (scaffold), so 59 reads remain. They are in `src/canalRecall/postwarKit/measured-fronts.json` and typed in `facts.ts`. The sample is the backlog's members by payoff, keeping a member only when it has a straight (≤ 35°) clear panorama. 15 further members were held out for the blind by hash (`scripts/postwar-kit/split.ts`). Sheets are in `map-recall2-screenshots/ui/2026-11-20-postwar-kit/measured-fronts-*.jpg`.

| Cluster | n | wall | balcony | ground | window | frames | erker |
|---|---:|---|---|---|---|---|---|
| C1 1985–2004 mid-rise blocks | 24 | brick-red 7 (29 %), brick-buff 5 (21 %), render-white 4 (17 %), brick-brown 3 (13 %), brick-dark 2 (8 %), brick-grey 1 (4 %), render-colour 1 (4 %), cladding 1 (4 %) | none 10 (42 %), projecting 4 (17 %), loggia 4 (17 %), french 2 (8 %), round 2 (8 %), band 2 (8 %) | plain 12 (50 %), shop 10 (42 %), glazed 1 (4 %), arcade 1 (4 %) | punched 13 (54 %), wide 5 (21 %), arched 2 (8 %), strip 2 (8 %), tall 1 (4 %), grid 1 (4 %) | white 16 (67 %), dark 8 (33 %) | none 21 (88 %), white-glass 2 (8 %), dark-glass 1 (4 %) |
| C2 2005+ mid-rise blocks | 14 | brick-dark 4 (29 %), brick-red 3 (21 %), brick-buff 2 (14 %), render-white 2 (14 %), brick-brown 1 (7 %), brick-grey 1 (7 %), render-colour 1 (7 %) | none 9 (64 %), projecting 3 (21 %), band 1 (7 %), loggia 1 (7 %) | plain 4 (29 %), shop 4 (29 %), glazed 4 (29 %), recessed 1 (7 %), arcade 1 (7 %) | wide 8 (57 %), punched 3 (21 %), tall 2 (14 %), strip 1 (7 %) | white 10 (71 %), dark 4 (29 %) | none 14 (100 %) |
| C4 1965–1984 blocks | 14 | brick-red 7 (50 %), brick-brown 5 (36 %), render-white 2 (14 %) | none 5 (36 %), round 4 (29 %), projecting 2 (14 %), french 2 (14 %), loggia 1 (7 %) | plain 5 (36 %), shop 4 (29 %), arcade 3 (21 %), recessed 1 (7 %), glazed 1 (7 %) | punched 10 (71 %), wide 2 (14 %), grid 1 (7 %), tall 1 (7 %) | white 11 (79 %), colour 2 (14 %), dark 1 (7 %) | none 13 (93 %), brick 1 (7 %) |
| C5 1985–2004 towers ≥ 24 m | 7 | render-white 3 (43 %), cladding 2 (29 %), brick-grey 1 (14 %), brick-red 1 (14 %) | none 5 (71 %), band 2 (29 %) | plain 3 (43 %), glazed 2 (29 %), shop 1 (14 %), arcade 1 (14 %) | wide 5 (71 %), grid 1 (14 %), punched 1 (14 %) | white 4 (57 %), dark 3 (43 %) | none 7 (100 %) |

Low-confidence reads (occluded): 7 of 59.

**Today against the read.** The generic path's wall family matches the read on 9 of 59 fronts exactly, and on 22 of 59 at a coarse level (warm brick, buff, grey or render).

- The commonest misses:
  - red-brown brick drawn grey: 6;
  - white render drawn brown: 5;
  - red brick drawn brown: 5;
  - buff drawn grey: 4;
  - red brick drawn white: 3.
- **The T0 own walls** (`modern-pand-walls.json`) are often window-and-loggia averages:
  - Bloemgracht 210-286 has #7a7c7e "paint" on red brick;
  - Wibautstraat 31-55 has #372622 on red-brown;
  - Ferdinand Bolstraat 148-156 has dark brick on pink-grey panels.

## 2. Kit

- **`postwarKit/kit.ts` evidence order:**
  1. this lane's read;
  2. a plausible T0 own wall (paint at L* ≥ 80; brick at 30 ≤ L* ≤ 70 with a* ≥ 8);
  3. today's draw, when it is a plausible warm brick that is not pink;
  4. a draw from the cluster's frequencies, blended with read fronts within 500 m (same cluster × 3, other × 1).
- **Bay preset:** chosen from material, window shape and frame tone: brick or smooth, pale or dark frames, ribbon, or tall/French.
- **Features:** a read pand gets its own features. An unread pand gets features only from its read neighbours' weighted share, against a prior of 9 for "none".
- **Wall components** (`postwarKit/components.ts`): balcony bands, round balcony stacks, projecting slab balconies, an arcade (dark recess, piers and beam) and dark-glass erkers.
  - They are forced through `registerForce` on street walls only, and the kit owns those walls' balconies.
  - They join the registry only with the flag on.
- **Flag off is byte-identical:** the same chunk hash over 12 sample tiles before and after the change, walls and extras.
- **Cost, flag on, 6 sample tiles** (32,392 features):
  - 251 pands get geometry;
  - extras grow by 60.7k triangles, +1.0 % of extras and +0.63 % of walls plus extras, about 240 per pand;
  - wall triangles are unchanged;
  - chunk build time is +5.9 % (101 s against 95 s, on a loaded machine).
  - The flag adds no texture layers. The bay array is already at its 191-cell byte budget.

## 3. Blind

- **Set-up:**
  - 15 held-out members;
  - `house:frames` at panorama poses, `?world=live&workerPool=0` against the same plus `postwarKit=1`, with scratch bundles;
  - sides randomised by hash;
  - one fresh Opus judge over all pairs.
- **Result:**

| # | Pand | Cluster | Judge | Kit |
|---:|---|---|---|---|
| 1 | Bestevâerstraat 54-62 (+1 street) (0363100012064954) | C1 | tie | tie |
| 2 | Van Hogendorpstraat 52-54 (+1 street) (0363100012148089) | C1 | B | **win** |
| 3 | Wibautstraat 87-101 (+1 street) (0363100012068680) | C1 | B | **win** |
| 4 | Weteringschans 1-13 (+2 streets) (0363100012174383) | C1 | tie | tie |
| 5 | Tweede Constantijn Huygensstraat 37-39 (0363100012118170) | C1 | B | loss |
| 6 | Van Limburg Stirumstraat 11-15 (+2 streets) (0363100012071245) | C1 | A | **win** |
| 7 | Bloemgracht 67-71 (0363100012239635) | C2 | tie | tie |
| 8 | John Blankensteinstraat 2-116 (+1 street) (0363100012243732) | C2 | B | loss |
| 9 | Eerste Constantijn Huygensstraat 40-64 (0363100012080855) | C2 | A | loss |
| 10 | Zuiderkerkhof 2-60 (+2 streets) (0363100012171627) | C4 | A | loss |
| 11 | Looiersgracht 15-19 (0363100012168836) | C4 | tie | tie |
| 12 | Eikenweg 10-48 (+1 street) (0363100012106168) | C4 | A | **win** |
| 13 | Rapenburg 53-73 (0363100012181607) | C4 | tie | tie |
| 14 | Zeeburgerdijk 710-790 (0363100012061476) | C5 | B | loss |
| 15 | Weesperstraat 284-386 (+1 street) (0363100012169731) | C5 | tie | tie |

- **Regressions flagged against the kit:**
  - #5 Tweede Constantijn Huygensstraat 37-39: projecting balconies the photo does not have, from neighbourhood features;
  - #14 Zeeburgerdijk 710-790: a cream cladding tower on dark red-brown brick, from a cluster draw.
- **The judge also called these kit choices wrong-family:**
  - #9: a buff/render draw on red-brown brick.
- **Against today, the judge flagged:**
  - dark-brown walls on #6 and #12.
- **Caveat:** after a first look at the frames, this lane tuned on the same 15 before the judged run. It darkened buff, kept plausible brick and limited features to neighbours. The test is therefore not perfectly blind.

## What it still cannot say

- **Wall colour of an unread pand whose current draw is implausible.** The cluster draw is a lottery: render and cladding draws landed on brick (#9, #14). The next step is brick-only replacement draws, or reading more fronts.
- **Loggias and recessed galleries:** these need wall cuts. They are 17 % of C1 reads.
- **Round white oriels** (Dapperstraat 74-84) and **canted brick erkers** (Djakartaterras).
- **Arched heads** on the 1985-2000 neo-traditional blocks (Sarphatistraat 252-280, 340-368).
- **Curved plan fronts:** the mesh follows BAG edges.
- **Coloured accent panels** (Sarphatistraat 143-159).
- **Glazed stair towers.**
- **Features on unread pands** are a neighbourhood guess. #5 shows the risk.
- **Other looks:** the kit is photo-look only. Storybook and cartoon are unchanged.
