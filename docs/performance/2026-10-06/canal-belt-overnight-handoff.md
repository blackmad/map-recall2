# Canal-belt ordinary buildings: result and handoff

Updated 2026-10-07. Ten additional source-specific warehouse/modern treatments are accepted in the resumed canal-belt pass. The accompanying final release brings the ordinary gallery to 20, preserving the earlier ten port-area models. No workers remain building these ten. This document and the scoped work inventory replace the old checkpoint chronology; failed evidence is preserved.

## Demos

- [Manual ordinary-building gallery](https://canalrecall-blackmad.web.app/manual-ordinary-buildings.html): newest first, drag/orbit, zoom, source comparison and per-model screenshot feedback. `?only=<BAG digits>` filters one card.
- [Detailed source comparison](https://canalrecall-blackmad.web.app/ordinary-buildings.html): select a building; **Other street front** shows the actual second frontage and its matching municipal photographs where available. Front, close, opposite and wide views remain available.
- [Poly Haven material A/B](https://canalrecall-blackmad.web.app/ordinary-material-trial/viewer.html): original appearance left, subtle finish right; Detail/Zoom out/Orbit together. This is an isolated experiment, not game material adoption. [Source/image comparisons and costs](https://canalrecall-blackmad.web.app/ordinary-material-trial/).

Firebase excludes Markdown. Share this document through GitHub, not a hosted .md URL.

## Accepted buildings

All use exact native BAG identity/footprint, metre scale and surveyed roof regions, source-specific facades, successful-load replacement suppression and native fallback. They are ordinary background treatments with full architectural research where distinctive/registered; no invented POI destinations or trivia were added. Existing genuine mapped places remain separate from the curated automatic route pool.

| BAG digits | Building | GLB bytes | Triangles | Materials |
| --- | --- | ---: | ---: | ---: |
| 0363100012177576 | Koning David / De David, Brouwersgracht188–190 | 142396 | 1355 | 3 |
| 0363100012177571 | Groene/Grauwe Valk, Brouwersgracht192–194 | 136200 | 1259 | 3 |
| 0363100012165119 | Maxwell House, Spuistraat168 | 219068 | 1906 | 3 |
| 0363100012167569 | Restored retail/office, Kalverstraat48–52 | 230208 | 2275 | 3 |
| 0363100012168534 | Former university library, Singel425 | 232644 | 1873 | 3 |
| 0363100012167770 | Triple warehouse, Brouwersgracht174–178 | 485052 | 6104 | 2 |
| 0363100012167736 | Keysersveste, Keizersgracht28–36 | 379304 | 4202 | 2 |
| 0363100012168028 | Robbers office/warehouse, Spuistraat110–116 / Singel151 | 434656 | 3172 | 2 |
| 0363100012176271 | Former Twentsche Bank archive, Singel152–158 / Bergstraat1–3 | 279972 | 2213 | 2 |
| 0363100012176244 | 1972 offices, Herengracht459–463 / Reguliersdwarsstraat12–16 | 209828 | 1732 | 2 |

Ten combined:2,749,328bytes and26,091triangles. Every asset is below500KB and40,000triangles; detail was retained rather than raising budgets. Source ownership, authoring and root/independent gallery/game acceptance are recorded in the fidelity ledger and private validation packs.

Batch01 public0dedeea8cf9781e22ea5707c08a4b64ec9a2fe40; batch02 public6499eee0a234b8f6b3cd485ba96612f4a2d99008; batch03 public8997fa36c765260aec2c2264bec002a73a3032c6. The final trio accompanies this handoff. Separate material demo26fce452c9cc63a77d125c195e067c4ecad9c3ea. First seven hosted fingerprints were verified; final-trio deployment/fingerprint checks occur after the accompanying push.

## What the workflow learned

Native geometry plus a per-building original facade atlas and a few meaningful physical features captures character quickly. Window-tier proportions, white trim, genuine tall ground openings, paired glazing, shutters, stairs, roof caps and major setbacks matter more than generic surface grain. Do not start from uniform rows and hope color tuning will repair the architecture.

Treat discovery-box screening as a suggestion. A simple-looking footprint can contain lowered covered strips, multiple wings, roof equipment, a thin terrace deck or distinctive dormers. Preserve the actual native plan and surveyed parts; exclude ambiguous complex candidates from the fast loop unless source/part interpretation makes reuse safe. Never fill a courtyard or hide neighboring buildings with a padded suppression rectangle.

Establish real street roles from installed routing/address relationships and polygon normals before assigning features. The bank's Bergstraat side was initially put on rear edge3; actual street edges0/2 have a tall corner termination plus four lower fronts. A retry at the correct location found clear2025/2024/2020 municipal photographs. Multiple dates resolve tree/obstruction gaps; failed access or an incorrect initial station is not permanent unavailability.

Use Data Amsterdam's perspective panorama view as a current reference; do not call it an orthographic elevation or assert it outperforms our rectification without a comparison. Record panorama identity, actual capture date separately from mission year, heading/pitch/FOV and native building part. Historical photos/register descriptions remain valuable and must be cross-checked against current images and roof evidence.

Official recent aerials are efficient for roof/open-space interpretation. Source CityJSON indices and area-sorted/filtered recipe indices differ: match native vertices explicitly. Keep roof-plane positions, identify supporting local roofs and distinguish technical fittings from occupied facades. Broad pale gravel, dark pitched roofs and localized gray fittings require different finishes. Hidden side materials/function and exact flight days remain conservative unknowns; no all-glass equipment boxes or fabricated open courts.

Consolidate physical colors into a single vertex-colored primitive rather than one material per ornament. Assert metallicFactor0 explicitly: glTF defaults can otherwise turn intended diffuse architecture metallic. Exact vertex indexing reduced the triple warehouse705420→485052B and Keysersveste476444→379304B without changing expanded triangle attribute bytes, winding, materials or image pixels. All20 models regenerate byte-identically through the scoped portable stages.

## Verification and preserved failures

Root personally inspected source/render and actual game frames; independent reviews sought concrete failures. Both desktop and touch-emulated final runs check installed identity/picking, delayed load, exact shader/hidden-ID suppression, neighbors, disable/restore fallback, a desktop forced-load failure, stationary-rider camera pan and zoom-out. Target legacy pyramid entries happen to be empty: hidden-ID contract is verified, not a visual test of a nonempty pyramid mesh. Touch is viewport/input emulation on M4Pro, not physical-phone benchmarking.

Final-trio warm90-frame site/wide p95 is16.8ms desktop and16.7ms touch emulation. Loading still produced319ms desktop and128ms touch tasks. Earlier446ms nonstartup/reload948ms and cold touch wide33.3ms evidence stays preserved. These are scoped measurements, not cold-load improvements or a stall-free claim. A separate queue task `ordinary-building-loading-task-profile` preserves the next profiling work; earlier verified road/surface work is not silently overwritten or assigned blame without a trace.

Main/source frontages survive in actual game context; trees and foreground roofs partly obscure the warehouse portal, bank's lower Bergstraat tiers and modern ground frontage. Clear current references/gallery and exported first-hit checks establish those assemblies; do not claim complete ground-row gameplay visibility. Warehouse bowed glazing is planar, fine relief/dormer dimensions are simplified, bank small interior rooflights are omitted, and technical roof cheeks/functions remain inferred. Native lower/covered regions remain; those simplifications are explicit rather than invented source certainty.

Preserved failures include wrong camera units/direction; Maxwell blank upper corner repairedv4; Kalver full-height minor fins erased broad retail bays; a terrace deck closed as a large box; Singel opposite-wing/window-count/date confusion; whole-height technical roof walls; metallic-default materials; wrong bank street role and extra side/attic window groups; modern equal-height tiers/base; warehouse blurred return glazing/missing parapet/pale stone and uniformly dark roofs. The initial warehouse roof-crown hold was withdrawn only after source/GLB/runtime diagnosis. Root overwrote the initial batch02 GPU screenshot path: `failed-deck-reconstructed` is explicitly a later reproduction from the saved failed GLB, not an original capture. Use unique versioned capture directories.

## Texture decision

Poly Haven assets are CC0; original diffuse inputs, license/API records and reproducible trial scripts are privately archived. Brick courses add a subtle close-up gain and mostly disappear at game-like distance. Concrete has little visible payoff and is rejected as a production choice on current evidence.

Three-level wall-only finish preserves all window/door/trim/shutter/sign pixels, geometry and three-material budget. Warehouse148296B versus published142396B sounds like only+5900B, but a fair comparison to pixel-identical lossless baseline123620B gives+24676B material cost. Modern200672B versus optimized177204B costs+23468B; its reduction against published219068B comes from PNG encoding, not texture benefit. Each GLB embeds its own combined atlas; this is not cross-model GPU texture sharing. No extra normal/displacement/roughness maps were used.

Root checked isolated native WebGL Detail/Zoom out/Orbit on desktop/touch emulation and hosted loading of all four A/B models/source images. No game material migration is accepted. If continuing, trial cheap brick in a real scene, measure loading/upload/motion against the optimized baseline and check seams/mips/shimmer before admission. Consider lossless baseline image encoding separately. Architecture remains the priority.

## Paths, reproduction and source gates

- Active staging `/tmp/map-recall2-canal-belt-overnight`; actual review game `http://localhost:3000/canal-drive/`.
- Clean public integration `/tmp/map-recall2-ordinary-gallery-release`; fetch/rebase latest origin before edits because other agents also publish. Never broadly stage canonical root dirty files.
- Private source root `/Users/blackmad/Code/map-recall2-source-data`; clean archive worktree `/tmp/map-recall2-source-ordinary-pilot`. Copy only completed owned packs, verify payload checksums, push before public model commits. Raw source and processed interpretation remain distinct.
- Root evidence `/Users/blackmad/Code/map-recall2/artifacts/canal-belt-overnight`; all failures/final reviews archived privately.

Production generator sequence on fresh base assets:

```
npx tsx scripts/ordinary-buildings/build.ts
node scripts/ordinary-buildings/build-canal-belt-details.mjs
node scripts/ordinary-buildings/build-canal-belt-three-details.mjs
npx tsx scripts/ordinary-buildings/check.ts
npm run build:canal-signature-landmarks
```

Use ORDINARY_DATA_ROOT/ORDINARY_OUTPUT_ROOT for isolated generation. Detail stages explicitly filter their two/three researched identities. Do not run a detail stage twice on already detailed meshes. Generation resets catalogue metadata: preserve accepted source/updated dates, camera frontages, second-street references and admission records during merge. Rebuild browser/runtime bundles after content changes; ordinary fingerprints come from catalogue hashes. Catalogue, recipes, exact suppression and both gallery pages must remain synchronized.

Private source/validation gates:

| Scope | Commit | Path under experiments/canal-belt-overnight |
| --- | --- | --- |
| Batch01 validation | 9c29e89655ab177fa1125320ad1a6f0fc0cfc8e6 | validation-batch01-20261007 |
| Batch02 validation | 056663b9872690367e3b82b3627858e8015d7825 | validation-batch02-20261007 |
| Batch03 validation/index proof | df79731b0ec912f4410c3441db4a1a00c252da2e | validation-batch03-20261007 |
| Batch04 raw + prior roof followup | 7b26e67e736c6434849b443ec649cb1836713f3d | sources-04; sources-03/*/roof-followup |
| Batch04 aerial roofs | 74dc6ae19d03957a9a2cc9f7692140223726655c | sources-04/*/roof-followup |
| Current three-year bank side | a2a35c791b21f1412d79a79741aa16be702edc48 | sources-04/0363100012176271/current-side-followup |
| Final batch04 validation | 8efa7eef24d4f47a7460c5f17fa532388e7afe40 | validation-batch04-20261007 |
| Poly Haven trial | e6093506637c4355b3588dbc8fd4890968004a54 | material-trial-polyhaven |

Final-trio pack326payloads/106.4MB and prior aerial/current-side packs109/20payloads were checksum-verified and pushed before model admission. Original raw gates ea13b59, de241dc9, 88fd684b and ed24dde8 remain in ancestry. Candidate20 source-screen records preserve rejected options and the wrong initial associations; accepted interpretation and new source evidence supersede them.

## Next steps and feedback

1. Complete final accompanying release/hosted hash and20-card feedback checks, then update release state; ten-building architecture scope is complete only after that publication check.
2. Profile remaining loading pauses with a bounded Chrome trace; separate tile/road/surface work, shader compilation and model texture upload before optimizing. Retain ordinary window/door identity when panning away from the rider.
3. For future central candidates, use short fresh source/build/review handoffs and the same native/source/critical-trait gates. Box-like geometry is useful screening, not acceptance. Keep full review for mapped POIs, raised/detailed structures and requested landmarks; no ordinary background asset becomes a fake destination.
4. A shared bowed-window helper or source-supported relief treatment could improve repeated historic office bays efficiently. Exact tiny ornament is secondary to the observed frontage composition.

Latest October7 feedback checkpoint: open 0, in-progress 0, atLimit false; the Kriterion note was resolved by its other workstream. Root made no claim/resolution. Pull open+in-progress at session start, batch/release checkpoints and every30minutes of active work using `.agents/skills/canal-feedback/SKILL.md`; preserve evidence and do not duplicate claims. Original requested/deferred POI/street tasks remain in their inventories.

The former overnight08:00 deadline was interrupted by usage limits, then the user explicitly resumed and requested periodic pushes today. Source/generation/review/integration times are distinct; this result does not claim the entire research/release cycle takes the few milliseconds of mesh generation. Historical checkpoints are preserved in `canal-belt-checkpoint-journal.md`.
