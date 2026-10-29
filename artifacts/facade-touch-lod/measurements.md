# Facade touch LOD: where the `facades` triangles are (CANAL-RECALL-7)

Lane `lane/oc-facade-touch-lod-20261028`, 2026-10-28. iPad profile (1180×734 @2x, `isMobile`,
`hasTouch`), chase camera, pitch 60, at the Westerkerk (`4.88385,52.37450`). Measured with
`SharedFrame.drawStats()` plus a traversal of the layer's own `chunks` map.

Scripts (new, diagnostic only):
- `scripts/facade-load-breakdown.mjs` — per chunk: triangles, distance from the rider, bounding
  radius, building count and the per-content-kind tally (`mesh.userData.kinds`).
- `scripts/facade-ab-ipad.mjs` — one page, one resident tile set, same camera: measures
  `detail = 'touch'`, rebuilds every chunk at `'full'`, measures again, restores `'touch'`.
- `scripts/facade-screens.mjs` — the before/after strips in this directory.

## Before: which participant, which chunk

Brief's command (`PORT=4437 PLACES=4.88385,52.37450,180 node scripts/gpu-load-ipad.mjs`), before
the change: **main pass 161 calls, 1.94 M triangles**, of which
own-ground 875 k, **facades 822 k**, trees 129 k, landmarks 114 k, player-bike 36 k.

Facade triangles per resident chunk, at the reference place (a chunk is the merged mesh the layer
draws; `coarse` is the z14 city shell, `near` the detailed z17 block around the rider, `extras`
that block's facade relief):

| chunk | tris | dist (m) | buildings | content |
|---|---|---|---|---|
| coarse:8414/5384 | 293 722 | 731 | 6 765 | ground 72 k, upper 83 k, door 10 k, roof-plate 50 k, lid 44 k, wall-plain 18 k, frontage 17 k |
| coarse:8414/5383 | 181 358 | 935 | 4 985 | ground 46 k, upper 54 k, door 10 k, lid 27 k, roof-plate 29 k, wall-plain 9 k, frontage 7 k |
| coarse:8414/5385 | 226 609 | 2 108 | 6 577 | same shape as above, further out |
| `__kit` (landmark kits) | 129 792 | 910 | 337 parts | kit |
| boats × 11 chunks | 257 k total | 696–2 879 | — | houseboat models |
| extras:67313/43072 | 41 714 | 135 | 203 | extras 42 k |
| extras:67313/43073 | 29 150 | 184 | 139 | extras 29 k |
| extras:67314/43073 | 21 846 | 156 | 107 | extras 22 k |
| extras:67314/43072 | 10 086 | 84 | 67 | extras 10 k |
| near × 4 chunks | 42 955 total | 84–167 | 516 | ground 5 k, upper 6 k, roof slopes/plates/trim/decals 27 k, lid 4 k |

Per content kind over every resident coarse shell (the 700 k that dominates the participant):

| kind | triangles | what it is |
|---|---|---|
| upper | 143 k | one quad per wall, window cell |
| ground | 123 k | one quad per ground-floor bay run |
| roof-plate | 89 k | the projecting cornice strip per wall (+ surveyed closures) |
| lid | 73 k | flat roof cap, indexed earcut |
| wall-plain | 29 k | walls too short for a layout (chamfers, sheds) |
| frontage | 24 k | compound / regular canal / terrace bay relief from street appearance |
| door | 21 k | one quad per door bay |
| decal/trim/slope | 16 k | roof decals, trim, slopes |
| parapet | 1 k | large-tier parapet band |

So the load is **not** in the near block (43 k of detailed walls + 103 k of extras). It is the z14
city shells: ~43 triangles per building, of which only ~21 are wall and lid; the rest is the
ground-floor split (10), the cornice (7), the door (2) and frontage relief (2).

## After: the touch shell

`detail: 'touch'` (pointer-coarse or `?facadeDetail=touch`) builds every `coarse:` chunk as one quad
per wall, base to top, in the building's own window cell, plus its flat lid. Dropped per kind:

| kind | before | after | how |
|---|---|---|---|
| ground (shop/window band) | 123 k | 0 | one wall quad replaces the per-bay ground run |
| door | 21 k | 0 | no door bay at this distance |
| roof-plate (cornice) | 89 k | 0 | no projecting cornice strip |
| frontage (bay relief) | 24 k | 0 | no street-appearance bay geometry |
| parapet | 1 k | 0 | — |
| upper / wall-plain | 172 k | 227 k `shell-wall` | kept, one quad per wall (also covers walls that had no upper quad) |
| lid | 73 k | 73 k | kept at the mapped height, so the skyline is unchanged |

Per building: ~43 triangles → ~20. Every building keeps its footprint, its height, its flat lid and
its wall colour (tint is the building's own `wallHex` × shade), and its walls keep a textured window
cell — no bare-colour boxes.

One session, same camera, same resident tiles (`scripts/facade-ab-ipad.mjs`, reference place):

| build | facades | main pass | calls |
|---|---|---|---|
| touch (rider's block full, shells cheap) | **606 k** | **1.72 M** | 179 |
| full (desktop, every chunk `coarse`) | 836 k | 1.95 M | 179 |
| touch again, rebuilt in the same page | 606 k | 1.72 M | 179 |

Resident triangles per chunk family in that same page — only the `coarse` shells change:

| family | full | touch |
|---|---|---|
| coarse | 684 903 | 371 770 (−46 %) |
| `__kit` | 113 681 | 113 681 |
| near | 42 955 | 42 955 |
| boats | 275 112 | 275 112 |
| extras | 102 796 | 102 796 |

A second session measured 596 k / 1.71 M against 827 k / 1.94 M: the residency ring changes by a tile
between loads, so read the A/B (one page) rather than two loads. −28 % facades, −12 % main pass, and
the rebuild is deterministic.

At the reference place the 596 k is: shells 247 k (wall 173 k, lid 74 k), landmark kits + houseboats
206 k (kits 101 k, boats 105 k), the rider's near block 146 k (extras 103 k, detailed walls 43 k).

Screenshots (1180×734 @2x, HUD on):

| view | facades full → touch | main pass full → touch |
|---|---|---|
| near, bearing 90 | 827 k → 596 k | 1.94 M → 1.71 M |
| near, bearing 180 | 921 k → 691 k | 1.67 M → 1.44 M |
| down the canal, bearing 180 | 570 k → 426 k | 1.54 M → 1.38 M |

## Why not 450 k

The brief's 450 k is below what this view can reach without touching what the brief protects:

- the rider's own detailed block is 146 k (its extras alone are 103 k, ~200 triangles per building),
  and landmark kits are 101 k (the Westerkerk's own kit is in there) — that is 247 k before the
  city is drawn at all;
- the city shells for everything in view floor at 247 k (one quad per wall + the lid; 12–20
  triangles per building).

Room left, measured, if a lane is allowed the visual cost:

- houseboats beyond ~500 m are 84 k of the 105 k drawn; a hull + cabin variant would keep ~40 % of
  that (≈ −50 k). The houseboat generator has no far level today.
- facade extras in the three near tiles that are not the rider's own tile (~77 k of the 103 k).
  Visible at 150–300 m: dormers, chimneys, balconies and hoist beams disappear from the roofs beside
  the rider.

Main pass 1.3 M is out of reach from facades on this build entirely: own-ground 875 k + trees 129 k +
landmarks 114 k + bike 36 k = 1.15 M with no facades at all, so facades would have to be under 150 k.
