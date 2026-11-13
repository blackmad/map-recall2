Per-row truth: 203 pands (2 with a round row).

### answers-v4-crop: 36 pands with aligned rows

| class | rows read (pands) | precision | 95 % CI | rows in truth (pands) | recall |
|---|---|---|---|---|---|
| flat | 73 (28) | 0.932 | 0.849-0.97 | 74 (28) | 0.919 |
| segmental | 28 (10) | 0.75 | 0.566-0.873 | 27 (10) | 0.778 |
| round | 1 (1) | 0 | 0-0.793 | 1 (1) | 0 |

read->truth: {"flat->segmental":5,"flat->flat":68,"segmental->flat":6,"segmental->segmental":21,"round->segmental":1,"segmental->round":1}

### answers-v4-cut: 28 pands with aligned rows

| class | rows read (pands) | precision | 95 % CI | rows in truth (pands) | recall |
|---|---|---|---|---|---|
| flat | 67 (24) | 0.851 | 0.747-0.917 | 60 (21) | 0.95 |
| segmental | 15 (7) | 0.8 | 0.548-0.93 | 21 (8) | 0.571 |
| round | 0 (0) | - | 0-1 | 1 (1) | 0 |

read->truth: {"flat->flat":57,"segmental->flat":3,"flat->segmental":9,"segmental->segmental":12,"flat->round":1}

### answers-v42-crop: 31 pands with aligned rows

| class | rows read (pands) | precision | 95 % CI | rows in truth (pands) | recall |
|---|---|---|---|---|---|
| flat | 62 (23) | 0.952 | 0.867-0.983 | 69 (25) | 0.855 |
| segmental | 23 (9) | 0.609 | 0.408-0.778 | 18 (7) | 0.778 |
| round | 3 (3) | 0.333 | 0.061-0.792 | 1 (1) | 1 |

read->truth: {"flat->flat":59,"round->flat":1,"segmental->segmental":14,"round->segmental":1,"flat->segmental":3,"segmental->flat":9,"round->round":1}

### answers-v3: 40 pands with aligned rows

| class | rows read (pands) | precision | 95 % CI | rows in truth (pands) | recall |
|---|---|---|---|---|---|
| flat | 78 (30) | 0.923 | 0.842-0.964 | 82 (31) | 0.878 |
| segmental | 33 (13) | 0.727 | 0.558-0.849 | 30 (11) | 0.8 |
| round | 2 (2) | 0.5 | 0.095-0.905 | 1 (1) | 1 |

read->truth: {"flat->flat":72,"round->flat":1,"segmental->segmental":24,"segmental->flat":9,"flat->segmental":6,"round->round":1}

### answers: 111 pands with aligned rows

| class | rows read (pands) | precision | 95 % CI | rows in truth (pands) | recall |
|---|---|---|---|---|---|
| flat | 259 (99) | 0.958 | 0.926-0.976 | 253 (97) | 0.98 |
| segmental | 33 (13) | 0.848 | 0.691-0.933 | 40 (15) | 0.7 |
| round | 2 (2) | 0.5 | 0.095-0.905 | 1 (1) | 1 |

read->truth: {"flat->flat":248,"segmental->segmental":28,"flat->segmental":11,"round->segmental":1,"segmental->flat":5,"round->round":1}

