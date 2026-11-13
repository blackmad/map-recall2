
### crop v4: 22 misses of 119 scored, every one off by exactly 1 ({'over': 7, 'under': 15}); truth set of the miss: {'benchmark': 3, 'hand-spec': 18, 'hand-set': 1}

| cause | misses |
|---|---|
| other | 7 |
| attic row in gable (read as gable, label counts it) | 5 |
| roof storey (read as roof, label counts it) | 4 |
| attic row in gable (read counts it, label does not) | 3 |
| souterrain (read counts the storey above as bel-etage) | 1 |
| entresol / tall ground (label counts the entresol) | 1 |
| entresol / tall ground (read counts it, label does not) | 1 |

### cut v4: 27 misses of 119 scored, every one off by exactly 1 ({'under': 19, 'over': 8}); truth set of the miss: {'hand-spec': 22, 'hand-set': 1, 'benchmark': 4}

| cause | misses |
|---|---|
| roof storey (read as roof, label counts it) | 10 |
| attic row in gable (read as gable, label counts it) | 6 |
| entresol / tall ground (read counts it, label does not) | 6 |
| other | 2 |
| souterrain (read counts the storey above as bel-etage) | 1 |
| souterrain (read as souterrain, label counts it) | 1 |
| entresol / tall ground (label counts the entresol) | 1 |
