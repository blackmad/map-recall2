# Lane: GLB cleanup pass, batch 1 (2026-10-13)

Plan: `docs/plans/digital-twin-direction-20261013.md` §7 "GLB cleanup pass".
User goals: windows attached to buildings, more surfaces with recorded
materials, no obvious holes in roofs or sides. Lane owns
`src/canalRecall/landmarks/{geometryAudit,glbQuality}.ts` + tests and the
builders it fixes under `scripts/landmarks/`; it rebuilds the affected GLBs
and LOD1s. No `game.js`/`index.html`/bundles/TODO/HISTORY; manifest/bundle
regeneration is the integrator's.

## Step 1: make the gates trustworthy (before touching models)
- `geometryAudit.ts` ~line 199: the proximity grid skips triangles spanning
  > 20,000 cells, so a large diagonal wall reads as absent and its windows
  FAIL `opening-floating`. Bin by plane or rasterise only the triangle.
- Over-flags listed in TODO: overhang on glass curtain walls, "buried" on
  curved drums, see-through false holes on concave footprints (cast rays
  through the bbox / from outside the footprint, not hull-limited).
- Add `materialSlotCoverage`: share of visible surface area whose material
  has `userData.materialSlot` (and `tint`). Report per model; hard-gate 100%
  for new exports in `glbQuality.ts`; warning for legacy.
- Re-record `geometry-audit-baseline.json` only downward (`--write-baseline`
  after fixes; never raise).

## Step 2: batch 1 offenders (by audit rank)
de-bijenkorf, oude-kerk, beta-boulders, fire-station-willem,
mountain-network, centraal-station, rai-amsterdam, westerkerk, valley,
lab111, vredeskerk, scheepvaarthuis, dominicuskerk, magna-plaza,
madame-tussauds. For each: fix in the builder (not the GLB), re-export,
`npm run audit:glb -- --id=<id>`, before/after contact sheet
(`npm run review:sheet`), and tag materials with `materialSlot`+`tint` while
there. Gerard Dou Synagogue open side/rear walls (7/30 see-through rays) and
Het Pakhuis rear-step gaps are in scope if time allows.

## Checks
`npm run audit:glb -- --only-geometry`, `npm run test:geometry-audit`,
`npm run test:glb-quality`, `node --import tsx scripts/check-landmark-attachment.ts`,
`npm run check:osm-under-models`. Return SHA, the audit diff (fails before →
after per model) and the strip paths under `artifacts/`. The integrator
reviews strips at gallery size before merging.
