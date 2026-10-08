# Shared street rendering core — 2026-10-08

Branch: `feat/street-rendering-core-20261008`, based on the published UI/viewer release `025e5df6`. The original preservation branch remains unchanged.

This branch owns reusable facade planners, explicit wall openings and frames, surveyed-envelope validation/binding/worker transport, repeated terrace roofs, and independent pyramid roof ownership. It contains test fixtures and derived source assertions needed to reproduce their native-geometry tests. Candidate profiles, candidate demos and their visual acceptance stay on separate branches. Marnixstraat activation is absent from this core branch; no surveyed envelopes load by default.

The Jan native test now reads a frozen candidate fixture rather than silently depending on the current installed catalogue. The fixture is extracted from the preserved street branch, with the two original identities, recipes and source evidence unchanged. This does not admit its candidate recipe into production.

Validation: TypeScript lint, 83 focused core tests and all 104 existing street tests pass. Existing production cohorts were actually rebaked from their surveyed source extracts, current model exclusions and renderer/compiler source. The production catalogue bytes, profile recipes, assignment identities and counts remain unchanged. The survey/evidence fingerprints were regenerated; admission guards were retained. Three-building/worker and pyramid bundles were rebuilt from this source.

Runtime, visual and GPU evidence will be recorded with the Marnixstraat bounded delivery. Jan Evertsen full-facade source fit, compound neighbor-row/transfer and regular canal roof failures remain open. Test success is not their visual acceptance. Do not merge candidate catalogues wholesale or add citywide source-envelope admission.
