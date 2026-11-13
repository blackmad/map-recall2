Storeys under the new convention: rows below the crown (`storeyParts.full`) plus the souterrain and roof-storey flags,
on the adjudicated benchmark-v1 labels (labels.md: full storeys, ground once, no souterrain, no attic in gable or roof).
Same gate-pass pands that carry a benchmark label; undecidable storeys excluded.

| read | rows exact | rows ±1 | roofStorey flag vs label roof=mansard | souterrain flag |
|---|---|---|---|---|
| opus crop v4 | 0.80 (12/15) [0.55-0.93] | 1.00 | 2/3 agree | read on 15, true on 1; no label to score |
| opus describe cut v4 | 0.85 (11/13) [0.58-0.96] | 1.00 | 0/2 agree | read on 14, true on 0; no label to score |
| sonnet crop v4 | 0.67 (10/15) [0.42-0.85] | 1.00 | 2/3 agree | read on 14, true on 0; no label to score |

By truth set (pooled truth; the set that states the pand first), derived count from the components, opus crop v4 / opus cut v4:

| truth set | read | n | rows | rows + roofStorey | rows + souterrain | rows + both |
|---|---|---|---|---|---|---|
| benchmark | crop v4 | 22 | 0.86 | 0.77 | 0.82 | 0.73 |
| hand-set | crop v4 | 26 | 0.96 | 0.96 | 0.85 | 0.85 |
| hand-spec | crop v4 | 71 | 0.75 | 0.73 | 0.72 | 0.68 |
| benchmark | cut v4 | 17 | 0.76 | 0.65 | 0.76 | 0.65 |
| hand-set | cut v4 | 26 | 0.96 | 0.92 | 0.88 | 0.85 |
| hand-spec | cut v4 | 76 | 0.71 | 0.68 | 0.70 | 0.66 |
