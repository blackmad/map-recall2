# test:street-appearance bisect, 2026-11-10

Two tests failed on main and the suite was not in `check:canal`. Both bisected with `git bisect run --first-parent`, skipping unrunnable midpoints.

## 1. audit-frontages: installed baked street cohorts reproduce...
- First bad: `b712de6b5` "Merge lane/oosterdok-walls-20261030 (#123); rebuild bundles from merged source, stamps" (last good `19cf402c2`, 2026-10-30).
- Cause: legitimate input change, golden never re-recorded. #123 changed `public/canal-drive/models/signature-landmarks.json` (`suppressOsmIds`), which `bake-frontages.ts` excludes from the survey, so the source hashes moved. All profile cohorts still reproduce; only `surveyed footprint or construction-year sources changed` and `routing, curated identities or assignment compiler changed` fired.
- Fix: re-recorded with `node --import tsx scripts/street-appearance/bake-frontages.ts`.
- CHANGED: `frontage-survey.json` 24 sha256 lines (survey input hashes only), `evidence-manifest.json` 1 sha256 (the survey hash). `profiles.json` and every frontage record byte-identical.

## 2. coarseStreetAppearance: coarse tiles retain local window grouping...
- First bad: `836fb00ef` "Merge branch 'lane/engine-flat-roofs-20261108'" (last good `e6112ab29`).
- Cause: legitimate change, test reference not updated. Lane R5-E gives a real flat roof a build-year tone, a surface layer and a parapet lip (`flat-lipDropped`, different lid colour). The test compares coarse output with the walls chunk of a "simple" (flat) twin, which now gets that treatment while the coarse pitched-roof building correctly does not.
- Fix: the reference walls chunk is built with `?flatRoofTone=0&flatRoofSurface=0` (via a temporary `globalThis.location`). The assertion is unchanged and still deep-equal across all four looks.

## Gate
`npm run -s test:street-appearance` appended to `check:canal` in package.json. The full suite (103 tests) runs in about 3.5 s wall clock, well under 60 s.
