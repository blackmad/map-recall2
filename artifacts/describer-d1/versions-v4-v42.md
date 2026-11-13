### answers-v4-crop vs answers-v42-crop on the same 147 pands (pooled adjudicated truth)

| field | answers-v4-crop | answers-v42-crop | change | answers-v4-crop right, answers-v42-crop wrong | reverse |
|---|---|---|---|---|---|
| storeys | 0.819 (95/116) [0.739-0.878] | 0.816 (93/114) [0.735-0.876] | -0.003 | 5 | 4 |
| storeys±1 | 1 (116/116) [0.968-1] | 1 (114/114) [0.967-1] | +0.000 | 0 | 0 |
| bays | 0.915 (118/129) [0.854-0.952] | 0.902 (120/133) [0.84-0.942] | -0.013 | 3 | 2 |
| bays±1 | 0.992 (128/129) [0.957-0.999] | 0.985 (131/133) [0.947-0.996] | -0.007 | 1 | 0 |
| bands | 0.921 (93/101) [0.851-0.959] | 0.929 (92/99) [0.861-0.965] | +0.008 | 2 | 3 |
| bandKind | 0.867 (85/98) [0.786-0.921] | 0.884 (84/95) [0.804-0.934] | +0.017 | 2 | 4 |
| shop | 0.805 (99/123) [0.726-0.865] | 0.787 (96/122) [0.706-0.85] | -0.018 | 8 | 6 |
| basement | 0.838 (67/80) [0.742-0.903] | 0.826 (57/69) [0.72-0.898] | -0.012 | 1 | 0 |
| finish | 0.857 (96/112) [0.78-0.91] | 0.876 (99/113) [0.803-0.925] | +0.019 | 3 | 4 |
| crown cornice | 0.956 (43/45) [0.852-0.988] | 0.979 (46/47) [0.889-0.996] | +0.023 | 0 | 0 |
| crown step | 0.8 (4/5) [0.376-0.964] | 1 (4/4) [0.51-1] | +0.200 | 0 | 0 |
| crown neck/bell (curved) | 0.917 (22/24) [0.742-0.977] | 0.893 (25/28) [0.728-0.963] | -0.024 | 0 | 0 |
| head flat | 0.846 (11/13) [0.578-0.957] | 0.909 (10/11) [0.623-0.984] | +0.063 | 0 | 0 |
| head segmental | 1 (5/5) [0.566-1] | 0.75 (6/8) [0.409-0.929] | -0.250 | 0 | 0 |
| cornice none | 0.867 (26/30) [0.703-0.947] | 0.9 (27/30) [0.744-0.965] | +0.033 | 0 | 0 |

#### answers-v4-crop: house-ground (dwelling) rows exact 0.741 (40/54) [0.611-0.839]

| miss | pands |
|---|---|
| under 1 | read a gable attic the truth counts | truth hand-spec | read souterrain false / truth false | read roof gable-attic | 2 |
| under 1 | other under | truth hand-spec | read souterrain false / truth false | read roof not-visible | 2 |
| under 1 | read a souterrain the truth counts as the ground storey (bel-etage confusion) | truth hand-spec | read souterrain true / truth false | read roof gable-attic | 2 |
| under 1 | other under | truth hand-spec | read souterrain false / truth false | read roof none | 2 |
| over 1 | counted the truth attic in the crown | truth benchmark | read souterrain false / truth false | read roof gable-attic | 1 |
| over 1 | other over | truth hand-spec | read souterrain true / truth false | read roof not-visible | 1 |
| under 1 | other under | truth hand-set | read souterrain false / truth false | read roof not-visible | 1 |
| under 1 | read a souterrain the truth counts as the ground storey (bel-etage confusion) | truth hand-spec | read souterrain true / truth false | read roof dormers | 1 |
| over 1 | other over | truth hand-spec | read souterrain false / truth false | read roof gable-attic | 1 |
| under 1 | read a souterrain the truth counts as the ground storey (bel-etage confusion) | truth hand-spec | read souterrain true / truth false | read roof mansard | 1 |

#### answers-v42-crop: house-ground (dwelling) rows exact 0.784 (40/51) [0.654-0.875]

| miss | pands |
|---|---|
| under 1 | read a gable attic the truth counts | truth hand-spec | read souterrain false / truth false | read roof gable-attic | 2 |
| under 1 | read a souterrain the truth counts as the ground storey (bel-etage confusion) | truth hand-spec | read souterrain true / truth false | read roof gable-attic | 2 |
| under 1 | other under | truth hand-spec | read souterrain false / truth false | read roof not-visible | 2 |
| over 1 | other over | truth hand-spec | read souterrain true / truth false | read roof not-visible | 1 |
| under 1 | read a roof storey the truth counts | truth hand-spec | read souterrain false / truth false | read roof mansard | 1 |
| under 1 | read a souterrain the truth counts as the ground storey (bel-etage confusion) | truth hand-spec | read souterrain true / truth false | read roof dormers | 1 |
| under 1 | other under | truth hand-spec | read souterrain false / truth false | read roof none | 1 |
| under 1 | read a souterrain the truth counts as the ground storey (bel-etage confusion) | truth hand-spec | read souterrain true / truth false | read roof mansard | 1 |
