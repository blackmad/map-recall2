# Lane: GLB cleanup batch 3 (2026-10-13)

Context: `docs/handoffs/lane-glb-cleanup-batch2-20261013.md` and the batch-2
HISTORY entry (2026-10-13); tools `scripts/landmarks/{thicken-sheet,list-holes,
list-boundary-edges}.ts`, `TRIACCT=1` in `build-manual-landmarks.ts`,
`snapOpenings.ts` (`SNAP_OPENING_IDS`, `SNAP_OPTS`), `npm run audit:glb -- --id=X`,
`scripts/landmarks/geometry-audit-baseline.json` (lower, never raise). Lane
owns builders and specs under `scripts/landmarks/`, baselines, the rebuilt
GLB + lod1 for each model it touches. Do not edit `game.js`, `index.html`,
`package.json`, bundles, catalogues, generated manifests
(`signature-landmarks.json`, `model-dates.json`, `modelAssetVersions.json`,
`modelLods.json`), `TODO.md`, `HISTORY.md`; the integrator regenerates
manifests after merging.

Rule from the user (2026-10-13): hand-modelled buildings must carry their
signature ornaments, reliefs, sculpture and signs. When you touch a builder,
check its panoramas (`npm run pand-reference -- <pand>`) for an ornament the
model lacks and list it in the report (modelled / skipped with reason).

## Deliverables, in order
1. **hoofdbureau-elandsgracht** (another session added the north end wall
   with the Amsterdam arms relief, 32k tris, pushed to main 2026-10-13): one
   `opening-overhang` FAIL, 66% of a face off the wall at (4.2, 1.6, -95.3);
   fix it in the builder (not by snap-dropping if it is the relief or a
   colonnade element), keep the relief. Check the GLB size against the 500 KB
   manifest budget and report it.
2. **haparandaweg-2-4**: one window 40% buried at (-20.3, 9.8/5.7, 19.8);
   move it in the builder.
3. **petrus-en-paulus-kerk**: north gable window-rhythm; recount from a
   rectified pano crop (turret slits, fanlight, 2.8 m sash), fix the spec.
4. **opstandingskerk** east gable (37/46 openings off-size).
5. **rialto** coplanar roof (`z-fight`).
6. **valley**: ~3,070 open loops from zero-thickness aperture walls and the
   glass skin; thicken with `thicken-sheet.ts` or close in the builder; the
   detached 657 m² skin part.
7. **felix-meritis** (`fix/felix-meritis-20261011`) and **jodenbreestraat-11**
   (`big/ordinary-a2-20261013`): merge those branches into yours, bring them
   through the gates, report.
8. **Recovered landmarks** on `wip/recovery-landmark-integration-20261009`:
   academie-theater-dans, holocaust-namenmonument, max-euwe-centrum,
   voormalige-schouwburgpoort — merge, gate, four-side strips for each
   (`scripts/landmarks/*-strip.ts` pattern or the demo strip in batch 2).
9. **Size budget**: hotel-de-l-europe 52k tris / 725 KB (21k tris in
   `sashWindows`, 7.7k at `hotel-de-l-europe-builder.ts:162`): decide a window
   budget — e.g. full sashes on the first two floors, plain recessed panes
   above, keep the rhythm — and get it under the 40k attachment cap and 500 KB.
   mountain-network 649 KB and palace-on-the-dam: same treatment where cheap.
10. Strips for the batch-2 models nobody viewed: jewish-museum,
    dutch-resistance-museum, fire-station-hendrik, fire-station-zebra,
    this-is-holland, oudemanhuispoort, waag, scheepvaartmuseum.

Per model: audit before/after, baseline lowered, GLB + lod1 rebuilt
(`node --import tsx scripts/landmarks/build-manual-landmarks.ts --only=<id>`,
`npm run build:landmark-lods -- --only=<id>`), a six-view strip under
`artifacts/glb-cleanup-3/strips/`, and the ornament note.

## Checks
`npm run lint`, `npm run test:geometry-audit`, `npm run test:glb-quality`,
`npm run audit:glb -- --only-geometry` (report the pass/fail counts; the real
exit code, not `tail`'s), `node --import tsx scripts/check-landmark-attachment.ts`,
`npm run check:osm-under-models`. Report: branch, SHA, per-model table, strips
viewed, what is unfinished and why.
