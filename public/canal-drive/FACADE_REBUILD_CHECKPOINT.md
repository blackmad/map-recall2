# Amsterdam façade rebuild — checkpoint 1

Checkpoint date: 2026-09-04. Scope: phases 0–2 of
[`AMSTERDAM_FACADE_REBUILD_PLAN.md`](../../AMSTERDAM_FACADE_REBUILD_PLAN.md).
Camera-model work and detector evaluation are intentionally not part of this
checkpoint.

## Baseline

| Fact | Value |
| --- | --- |
| Branch | `feat/amsterdam-facade-rebuild` |
| Recorded branch HEAD | `973f2c4bd1c928e91e55b06220dbf1e8e22c4c4d` |
| Merge base with `main` | `737990d324496f4a367b6b6a53c581c992ae3584` |
| Worktree before implementation | clean |
| `npm run build` | pass |
| `npm run check:canal` | pass, including 54 coordinate and 44 boundary checks |

The previous street-derived artifacts are invalidated by
[`street-derived-invalidation.json`](../../src/canalRecall/facade/fixtures/street-derived-invalidation.json).
It names the Herengracht 270 regression and refuses old rectifications,
measurements, textures, labels, correlations, and renderer extracts as rebuild
inputs.

## Import and quarantine manifest

`npm run facade-cache:migrate` materialises an ignored cache at
`.cache/facade-rebuild/raw/v1/`. The generated manifest records URL, retrieval
date, byte count, SHA-256, licence, and whether each file is a hard link or
copy. The checkpoint run contains 1,444 files / 3,950,594,777 bytes, including
1,437 untouched original panoramas. No path matching measured, texture, review,
or renderer extract was imported.

| Allowlisted record | Bytes | SHA-256 |
| --- | ---: | --- |
| BAG pand response | 3,551,408 | `f8c8577872963e163e824fdd676d79d6080d92ded60c779baea72b5596c2ed63` |
| BAG adapter record | 3,608,936 | `b7cc56b66745ef334b0227e87ff451dad6353003f4e44f05e460cea94be380ce` |
| 3DBAG source response | 12,011,241 | `52560c92bf813b697521b1a86de6b40e16d8c0ab3e5c064259af01ec8fc26fcd` |
| 3DBAG adapter record | 2,654,691 | `a813c3ba34e37295af1eb44c9ac0f995ab1b333dd640f2e4421a8e2ef0d5a444` |
| Rijksmonumenten records | 1,543,667 | `f09033920e9fc3cb25e9213de6a94683ab5f5d3e6f84fbe50ccb8dd65fe4236e` |
| OSM corroboration records | 1,455,222 | `4578a5b15ddec6348d2f1d9a811633fd81196ceace9269caee7e1fb768d99dfd` |
| Amsterdam panorama metadata | 76,729,638 | `efad9fa321e1f589d24e2e9c2bf95e7451985c91abbff79d6159fdc8019f6e9e` |
| Herengracht 270 original panorama | 2,673,385 | `ce0a17667f5674912a0a5a3d9dd5c3835a2a3daa704ece23ac91763f55306803` |

## Canonical identity and elevations

`bagIdentity.ts` joins official BAG `pand`, `verblijfsobject`, and `adres`
records by their explicit item/identifier links. It retains all addresses,
including secondary addresses, instead of treating a display address or point
proximity as building identity.

`elevations.ts` now normalises rings counter-clockwise, canonicalises the start
vertex, merges only survey-collinear edges (0.75° default), retains original
vertex/edge indices, and derives stable per-pand elevation IDs from
millimetre-quantised ordered endpoints. Candidate generation and selection live
separately in `elevationCandidates.ts`; unresolved close races return
`ambiguous`, while independently supported corner fronts can remain multiple.

The ignored BAG inspection report is
`.cache/facade-rebuild/reports/bag-address-pand-inspection.json`. Its checkpoint
run resolved all 16 candidate panden; 12 have multiple addresses. Herengracht
270 has 13 addresses and 13 VBOs. Its selected wall is
`0363100012164989:e:1y4i3ks`, from RD `(120909.861, 487141.970)` to
`(120910.731, 487155.390)`, 13.448 m long and facing 93.709°. The pinned camera
position reproduces 38.6 m standoff and 3.3° obliquity without making any image
yaw claim.

## Gold candidates and review desk

The first catalog contains 16 unique BAG panden and includes Herengracht 270,
Prinsengracht 263, Huis met de Hoofden, Huis Bartolotti, Felix Meritis, both
canal banks, cardinal contrasts, and explicit candidates for corner,
irregular-footprint, multi-address, and partial-occlusion review.

Run:

```text
npm run build:facade-registration-review
npm run dev
```

Then open `/canal-drive/facade-registration-review/index.html`. The local page
presents Herengracht 270 as the one task with a traceable source panorama and
separates the 15 geometry-only candidates into a non-actionable waiting queue.
The primary path asks the reviewer to compare the full panorama, official BAG
identity, footprint, and highlighted wall before recording two plain-language
verdicts. Metadata and source-pixel anchors remain available as advanced details.
Detector boxes are absent; calibration and rectification remain locked.

The phase-2 human gate is still open: under the explicit solo-operator decision
adopted on 2026-09-05, Herengracht 270 needs one auditable local review with a
selected wall and accepted identity and elevation verdicts. An uncertain or
rejected verdict fails closed. Source-pixel points can be removed individually,
undone in reverse order, or cleared together through a guarded two-click action.
Every remaining fixture still needs an explicit panorama selection before it
can enter the same review. Until then no detector or measurement run is
authorised.
