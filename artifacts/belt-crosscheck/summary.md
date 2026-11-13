# Belt cross-check (lane BX, batch belt-20261113)

Reader: D1 describer prompt v4.3, read by Claude opus (7 shards) from perspective cuts of the street panoramas (not the in-game frame). Spec side: installed house-specs (round 127 extract). Gemini was not used.

- Specs in batch: 178; cuts made: 175 (no panorama within 5-35 m: 0363100012171851, 0363100012171854, 0363100012182776); readable: 164.

| field | compared | agree | disagree | not visible | queued |
|---|---|---|---|---|---|
| crown (class group) | 153 | 129 | 24 | 11 | 13 (reader says cornice/step/curved); 11 where reader says flat/point/eaves not queued |
| rows | 154 | 102 exact | 51 off by 1, 1 off by 2+ | 10 | 1 |
| bays | 157 | 126 | 31 | 4 | 31 |

Rows (reader minus spec): +1: 20, -1: 31, -2: 1, 0: 102

## Crown confusion (spec / reader), all disagreements

- spec cornice / reader flat: 7
- spec neck / reader cornice: 3
- spec cornice / reader neck: 3
- spec flat / reader cornice: 2
- spec cornice / reader point: 2
- spec point / reader cornice: 1
- spec cornice / reader bell: 1
- spec cornice / reader pitched-eaves: 1
- spec cornice / reader spout: 1
- spec bell / reader step: 1
- spec bell / reader pitched-eaves: 1
- spec bell / reader cornice: 1

Queue counts: {'crown': 13, 'bays': 31, 'rows': 1} across 41 houses; low-confidence reader rows: 16.

Caveats: cuts are single oblique panorama views, many with trees, vans or an outline straddling two fronts (see each answer's notes); rows differ by one in 51 of 154 houses, mostly the roof-storey/souterrain conventions, so only 2+ is queued. 0363100012165073: reader crown cornice (frieze, dormers plain, low), 3 rows, 2 bays (spec: cornice, 4, 3; the spec's monument text says historicGable neck). 0363100012169539: crown and cornice not-visible (very oblique, low on bays/rows), 3 rows, 2 bays (spec: bell, 3, 2).

Queue rows: artifacts/belt-crosscheck/queue.json. Answers: artifacts/belt-crosscheck/answers/. Image kind is recorded as 'crop' in the answers because the writer validator has no 'cut' kind; refs point at cuts/.
