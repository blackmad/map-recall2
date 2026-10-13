# Lane: the "window frame 2 cm proud of an unholed wall" z-fight class (content/domain, 2026-10-13)

Follow-up to `lane-zfight-audit-20261013.md`. The survey
(`scripts/landmarks/zfight-survey.ts`, report in HISTORY 2026-10-13
"Z-fighting found by audit") ranks 286 of 390 models above the 0.5 m²
new-export gate, and the top class by area is one builder habit: a window
or frame drawn as a sheet 2 cm in front of a wall that has no opening cut,
so at 900–1800 m the wall bleeds through the frame (calibrated: 2 cm bleeds
9–17 %, 3 cm and more not until ~2.7 km). Worst: vriesseveem-9 11,962 m²,
hva-wibautstraat-3 10,420, kohnstammhuis 6,703, hva-rhijnspoorplein-2 6,597,
conservatorium 1,454, de-bazel 1,160, madame-tussauds 921, silodam 888,
amstel-hotel 862, voc-kade-600 842, allard-pierson 822, haarlemmerweg-333
434, de-wester 412. Second class, "flush wall cladding or band on a wall":
jacob-bontiusplaats-9 6,411, valley 3,024, the Haparandaweg blocks
(haparandaweg-65 2,445, -870-900 1,820, -650-706 1,695, -708-744 909,
-788-868 645, -746-786 549, -902-950 505), pllek 536, frascati 500 (doubled
brick face).

Inputs: `src/canalRecall/landmarks/geometryAudit.ts` (`auditZFight`, bands
coplanar < 2 cm / tight 2–3 cm / near 2–8 cm), `scripts/audit-glb-quality.ts`
(`--id=<a,b>` `--only-geometry` `--write-baseline`),
`scripts/landmarks/zfight-validate.ts` (render + bleed measurement),
`scripts/landmarks/snapOpenings.ts` and `snapDetachedParts` (now 5 cm),
the shared window/frame helpers the builders call (find them: grep the top
builders for the function that draws the frame sheet), the Haparandaweg
block kit (`scripts/haparandaweg/build.ts`, models installed from
`artifacts/haparandaweg/<id>/model.min.glb`; its builder is the kit, not
`build-manual-landmarks`). Lane owns the helpers, the builders it fixes,
the baseline (lower, never raise) and the re-exports. Re-export one id per
process (`node --import tsx scripts/landmarks/build-manual-landmarks.ts
--only=<id>`, then `npm run build:landmark-lods`). Do not edit `game.js`,
`index.html`, `package.json`, bundles, catalogues, `TODO.md`, `HISTORY.md`.

## Deliverables
1. **Fix the class once in the helper**, not per model: a frame on an
   unholed wall is either lifted to ≥ 3 cm proud (cheap, keeps triangle
   counts) or the wall gets the opening cut and the frame sits in the
   reveal (right, costs triangles). Pick per helper call site by what the
   model's budget allows; the audit must show `zfight-tight-m2` → ~0 for
   the model, not moved into `zfight-near-m2` at 3.0 cm exactly (use 4–5 cm).
2. **Re-export the top 13 of the frame class and the Haparandaweg kit
   blocks** with the fix; `audit:glb --only-geometry` before/after per
   model in the report; baselines lowered; `zfight-validate.ts` renders of
   the top 5 before/after at 900 m and 1800 m.
3. **`check-manual-landmarks` fails on `homomonument`** ("exact
   replacement, bounded host opening or native standalone landscape
   required"), already failing on main before 2026-10-13 and not in
   `check:canal`. Find which of the three the Homomonument spec should be
   (it is a surveyed standalone landscape on the Westermarkt: pink granite
   triangles in the pavement and the canal step), fix the spec or the gate,
   and report the command that proves the check passes end to end so the
   integrator can add it to `check:canal`.

## Checks
`npm run lint`, `npm run test:geometry-audit`, `npm run audit:glb --
--id=<ids> --only-geometry`, `node --import tsx
scripts/landmarks/check-manual-landmarks.ts`, `npm run check:landmark-inventory`.
Report: branch, SHA, per-model before/after m², renders, what stays above
the gate and why, unfinished.
