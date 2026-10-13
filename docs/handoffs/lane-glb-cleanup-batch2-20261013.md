# Lane: GLB cleanup batch 2 (2026-10-13)

Same rules and tools as `docs/handoffs/lane-glb-cleanup-20261013.md` and the
batch-1 HISTORY entry (2026-10-13): hard gates are `opening-floating`,
`opening-buried`, `opening-overhang`, `holes`, `see-through`, `far-outside`;
`snapOpenings.ts` and `snapDetachedParts` are builder-time passes with
per-model options in `build-manual-landmarks.ts`; every material carries
`materialSlot`+`tint`; baselines are lowered, never raised. Lane owns
`scripts/landmarks/*-builder.ts`, specs, the re-exported GLBs and LOD1s, and
`geometry-audit-baseline.json` entries for its models. Do not edit `game.js`,
`index.html`, `package.json`, bundles, `TODO.md`, `HISTORY.md`, or the four
generated manifests (`signature-landmarks.json`, `model-dates.json`,
`modelAssetVersions.json`, `modelLods.json`); the integrator regenerates them.

## The batch, by priority
1. **The 21 that the corrected measurement now fails** (no baseline entry was
   raised): stadhuis, heineken-experience-amsterdam, nieuwe-kerk,
   jewish-museum, dutch-resistance-museum, allard-pierson, cinecenter,
   straat-museum, haparandaweg-2-4, fire-station-hendrik, fire-station-zebra,
   this-is-holland, posthoornkerk, petrus-en-paulus-kerk, oudemanhuispoort,
   american-hotel (also `check-landmark-attachment` wants `b.mark('shell')`),
   krasnapolsky (user-reported window geometry), hilton-amsterdam, booking-hq
   (held per TODO; un-hold only if the gallery strip looks right),
   scheepvaartmuseum and waag (no baseline entry yet: record first, then fix).
   Fix in the builder; `snapOpenings` options are the first tool, builder
   geometry the second. Report per model: counts before/after, what changed.
2. **Shell holes left from batch 1**: madame-tussauds (one 33.8 m loop at the
   clipped hip cut), rai-amsterdam (103 loops), centraal-station (376 loops,
   802 m around roof/glazing), valley (~3,070 zero-thickness aperture walls and
   glass skin; may need a different skin construction). Close walls or add
   caps; if a model cannot reach the gate in the lane's time, say what it
   needs.
3. **Churches from the kit lane**: opstandingskerk east gable (37 of 46
   openings off-size against the photo spec), obrechtkerk (43k tris, budget
   ≤ 25k; find the duplicated or over-tessellated parts).
4. **Held models**: felix-meritis (branch `fix/felix-meritis-20261011`: 12
   floating openings, z-fight 0.9 m²), jodenbreestraat-11 (branch
   `big/ordinary-a2-20261013`: 116 open loops, 1,494 m² blank NW wall, 118 m²
   z-fight). Merge those branches into yours, fix, report.
5. **Recovered landmarks** on `wip/recovery-landmark-integration-20261009`
   (merge it into your branch): academie-theater-dans (666 open loops, 19
   detached parts, 979 m² blank SE wall), holocaust-namenmonument (2 openings
   off the wall), max-euwe-centrum (see-through 4/151, 80 floating openings).
   voormalige-schouwburgpoort passes; render it from four sides at
   gallery-card size and include the strip.

## Deliverable
One before/after strip per model (6 views) under `artifacts/glb-cleanup-2/`,
the audit diff, baseline entries lowered, `npm run audit:glb -- --only-geometry`
exit 0 with your models out of the fail list. Checks: lint,
`test:geometry-audit`, `test:glb-quality`, `check:osm-under-models`. Report:
branch, SHA, per-model table, strips you looked at and what you saw, what is
unfinished and why.
