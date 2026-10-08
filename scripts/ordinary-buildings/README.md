# Source-specific ordinary building components

The shared `build.ts` creates native-footprint shells, original facade atlases and surveyed roof surfaces. Building recipes own actual dimensions, face assignments, opening groups and source uncertainty. New components extend the observed assemblies without changing the old batch.

| Component | Purpose | First integration |
| --- | --- | --- |
| `facade-assemblies.mjs` | Arched opening profiles, projecting curved glass bays and matching bands; caller supplies native edge frame and material | Rokin southern block |
| `repeated-front-assemblies.mjs` | Repeated shallow stepped pediments, with separate upward roof tops | Rokin northern block |
| `sloped-window-groups.mjs` | Flush window groups on measured sloped roof planes | Rokin northern block |
| `barrel-vault.mjs` | Bounded circular vault mesh and original diamond-cassette pattern with glazing tapering toward an opaque crest | Rokin southern block |
| `perforated-canopy.mjs` | Thin canopy strips with actual circular through-holes, fitted to the caller's native frame | Keizersgracht 603 / Vijzelstraat 79 |
| `round-front-assemblies.mjs` | Rounded columns and circular door details, placed in the caller's native facade frame | Kerkstraat 206–210 (local integration) |
| `roof-step-support.mjs` | Local supports below stepped roofs, subtracting existing coplanar walls to avoid overlapping surfaces | Kerkstraat 206–210 (local integration) |
| `exact-index.mjs` | Exact attribute-tuple indexing of expanded static triangles, preserving IEEE bits, typed/normalized attributes, primitive order and materials | Rokin southern block |

`build-rokin-north-details.mjs` and `build-rokin-south-details.mjs` place these components using the two individual recipes. They modify only their exact BAG identity, update only its catalogue entry and reject a second application. `rokin-roof-details.mjs` owns the southern building's source-specific roof/deck assembly. Roof and facade helper functions contain no BAG IDs; native placement stays in the building stage.

## Reproduction

Run from the repository root. `ORDINARY_DATA_ROOT`, `ORDINARY_OUTPUT_ROOT` and `ORDINARY_SOURCE_ROOT` can point to a disposable generation directory and the private source clone. The source root must contain every recipe's source pack and its processed references.

```sh
node --import tsx scripts/ordinary-buildings/build.ts
node scripts/ordinary-buildings/build-canal-belt-details.mjs
node scripts/ordinary-buildings/build-canal-belt-three-details.mjs
node scripts/ordinary-buildings/build-canal-belt-box-details.mjs
node scripts/ordinary-buildings/build-canal-belt-spui-details.mjs
node scripts/ordinary-buildings/build-rokin-north-details.mjs
node scripts/ordinary-buildings/build-rokin-south-details.mjs
node scripts/ordinary-buildings/build-keizers603-details.mjs
node scripts/ordinary-buildings/build-kerk206-details.mjs
node --import tsx scripts/ordinary-buildings/build-amstelstraat16-details.ts
node --import tsx scripts/ordinary-buildings/build-kerk136-details.ts
node --import tsx scripts/ordinary-buildings/build-nieuwespiegel555.ts
node --import tsx scripts/ordinary-buildings/build-prinsen211-details.ts
node --import tsx scripts/ordinary-buildings/build-prinsen215-details.ts
ORDINARY_OUTPUT_ROOT=public/canal-drive/models/ordinary-buildings node --import tsx scripts/ordinary-buildings/build-prinsen485-details.ts
node --import tsx scripts/ordinary-buildings/check.ts
npm run build:canal-signature-landmarks
```

The current local full sequence reproduced all 29 model byte streams exactly during the Amstelstraat integration; the previous 28 hashes stayed unchanged. Hosted acceptance currently covers 28 until Amstelstraat release and hosted verification complete. The Amstelstraat native procedural stage uses existing BuildingTools/house-geometry primitives and replaces only its intermediate shell; its dimensions, lower-front trace and separate main/low roofs live in source-specific specs. The new Keizersgracht model fits the strict 500,000-byte / three-material budget. Exact indexing applies to these static expanded triangle assets, not arbitrary animated glTF files.

The subsequent sequence reproduces 34 meshes, preserving the earlier 32 fingerprints. Prinsengracht 215–217 and 485–487 use their own surveyed roofs and photographed opening groups. The 215–217 check deliberately continues to report 28 first-hit shutter/guardrail overlaps; their source classifications and failed original evidence are retained in its review record. A passing shared structural check does not erase those probe results. The 485–487 stage defaults to a draft directory, so set `ORDINARY_OUTPUT_ROOT` explicitly for runtime regeneration.

## What this batch taught us

Street panoramas hid important roof assemblies. The first actual GPU review held both roofs: the northern model lacked sloped glazing; the southern model mistook a planar LoD2.2 proxy for its curved restaurant roof. Preserve these failures. The corrected models use primary construction photos/profile drawings and aerial ownership evidence, with original procedural colors/patterns rather than copied photo pixels.

Box-shaped ground plans can have distinctive roofs. These two remain ordinary assets, but required full architectural review. A shared official VBO/address does not merge their physical Pand identities, close the ground gap or create a curated destination. Existing mapped place information must stay attached to the exact clicked footprint.

Reuse geometry mechanisms after an actual source/render comparison. Reuse of a roof shape, window count, material color or height requires evidence for the next building. Check current official BAG geometry against installed candidates early: the next Amstel 130 candidate proved stale and covered neighboring facades, so it was held before authoring.

The next two builds exposed two useful checks before generalizing another assembly. Keizersgracht's low southern wing belongs to the same native parent and needs its own three window tiers; a shared high facade grid missed it. Lange Leidsedwarsstraat has two different central fronts between modern wings: configuring one repeated grid lost their window groups, gable glazing and entrance proportions. Both first versions failed source review and were corrected. The completed Lange Leidsedwarsstraat model was subsequently deferred after the geographic audit placed it outside the target area; its recipe, builder and evidence are retained privately. The new canopy helper is reusable; the central profiled fronts remain source-specific until another building establishes which parameters should be shared.

## Shared-component priorities

Reuse source-sized assemblies rather than whole facades. Historic boxes most often need arched openings with brick surrounds, repeated window groups and cornices. Modern boxes need projecting window heads, separate upper-floor rhythms, double-height ground entrances and low wings. Keep each building's dimensions, counts, colors and arrangement in its recipe. Promote another shared assembly when a second researched building demonstrates the repeated mechanism.

Kerkstraat exposed checks that should travel with the helpers: explicit nonmetallic materials for masonry and painted columns, subtraction of existing coplanar roof supports, first-hit visibility, and clear openings beneath low terraces. CPU geometry checks did not catch the black material appearance; actual rendered review remains necessary. These checks can reduce repeated debugging, but total authoring speed has not yet been measured.

## Next work

Measure source research, authoring, integration and visual-review time separately on the next comparable buildings. No measured speedup is established by this first shared-component integration. Start with a simple grounded native box and verified photo ownership; configure opening groups, top tier, ground entrances and roof roles before writing another bespoke stage. Extract another component only when a real building needs it. Keep independent gallery review, exact neighbor/fallback checks, stationary-rider desktop/touch camera pans and zoom-out evidence in the acceptance loop.

Amstelstraat also showed why source roles need checks separate from pane visibility: an earlier version had visible doors but put the service entrance and louver at the wrong geographic end. The corrected source trace fixes every lower bay individually. Shared geometry can speed implementation; it cannot establish which end of the street owns each entrance.
