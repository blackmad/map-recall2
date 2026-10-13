# Lane: Hoofdbureau van Politie, Elandsgracht 117 — bespoke builder (2026-10-13)

User request 2026-10-13: the police headquarters is a landmark destination and
gets a hand builder. BAG pand `NL.IMBAG.Pand.0363100012169550` (office, 1941;
see `scripts/landmarks/police-stations.json`). The building: a 1930s–41
traditionalist brick block by the city architect's office, long street wings
along Elandsgracht and Marnixstraat, a corner tower with a crown, a carved
stone entrance portal with lettering, stone plinth and string courses, steep
tiled roofs with dormers.

Lane owns `scripts/landmarks/hoofdbureau-elandsgracht-{builder.ts,spec.json,
research.json,footprints.json,elevations.json}` and its catalogue entry
proposal. Do not edit catalogues, the generated manifests, `game.js`,
`index.html`, `package.json`, bundles, `TODO.md`, `HISTORY.md`; the integrator
installs from the report.

## How to build it (the hybrid the plan asks for)
1. **Massing from 3DBAG LoD2.2** via `extractFacadeWallPlanes` / the facts
   pipeline (`npm run pand-reference -- 0363100012169550` for panoramas,
   CC BY 4.0; Beeldbank for the 1930s drawings and photos — search
   `archief.amsterdam/beeldbank` "Elandsgracht 117" / "Hoofdbureau van
   Politie", record each image's rights per record).
2. **Regular wings through the large-tier facade systems**: call
   `src/canalRecall/blockBuilding/compose.ts` (brick-bay-grid with recess
   mode, bands, plinth) from the builder for the long walls, the way
   `largeCompile.ts` does, so the wings match the city's brick and lighting
   and cost no hand work. This is the first in-builder use of the large
   systems; keep the adapter small and typed, and report what was missing.
3. **Hand-model only the signature parts**: the entrance portal with its
   stonework and lettering (stroke font from `signage.ts`), the tower shaft
   and crown, the roof with dormers, any relief you can source. Budget
   ≤ 40k tris.
4. Every material carries `materialSlot`+`tint` (`materialSlots.ts`); run
   `snapOpenings`; pass the hard gates and `npm run audit:glb -- --id=hoofdbureau-elandsgracht`;
   a review sheet (`npm run review:sheet -- --id=... --bag=0363100012169550 --no-game`)
   and a four-side gallery strip under `artifacts/landmark-lanes/hoofdbureau-elandsgracht/`.
5. Catalogue entry JSON (manual catalogue shape, with `suppressOsmIds` /
   covered pand ids, footprint, surveyed anchor) and the POI card text
   (English, with the Beeldbank/Wikipedia provenance) in the report.

## Checks
lint, `test:geometry-audit`, `audit:glb`, `check:osm-under-models` after the
integrator installs (run it locally with the entry added to a scratch copy).
Report: branch, SHA, tris, gates, sheet and strip paths, sources with
licences, what the large systems could not express.
