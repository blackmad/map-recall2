# Canal-belt ordinary buildings: handoff

Updated 2026-10-07. User resumed work after the overnight usage interruption and authorized periodic commits and pushes today. Continue until ten additional warehouse conversions/modern buildings inside the canal enclosure have passed review; five are published, two repaired drafts and three new drafts remain.

## Published results and demos

[Manual ordinary-building gallery](https://canalrecall-blackmad.web.app/manual-ordinary-buildings.html) has 15 models including ten earlier port-area treatments and five new canal-belt additions. Cards have source comparisons, dates, orbit/zoom and screenshot feedback. The current priority is the canal belt, not expanding the port inventory.

| Batch | Native BAG identities | Published commit | Source/validation gate |
| --- | --- | --- | --- |
| 01 | 0363100012177576, 0363100012177571, 0363100012165119 | 0dedeea8cf9781e22ea5707c08a4b64ec9a2fe40 | 9c29e89655ab177fa1125320ad1a6f0fc0cfc8e6 |
| 02 | 0363100012167569, 0363100012168534 | 6499eee0a234b8f6b3cd485ba96612f4a2d99008 | 056663b9872690367e3b82b3627858e8015d7825 |

Batch01: Brouwersgracht 188–190 and 192–194 warehouses plus Maxwell House, Spuistraat168. Batch02: Kalverstraat48–52 restored retail/office block and former University Library, Singel425. Batch02 hosted catalogue/model bytes were checked on October7: both SHA-256 hashes match their published catalogue, 15 entries total.

Source comparisons: `ordinary-buildings.html?building=ordinary-<BAG digits>`. `manual-ordinary-buildings.html?only=<BAG digits>` filters one card. Firebase excludes Markdown: share the GitHub version of this handoff rather than a hosted .md link.

## Active next work

**Batch03 remains unaccepted.** `/tmp/canal-belt-batch03` contains repaired models and reproducible patches. IDs0363100012167770 (Brouwersgracht174–178, triple warehouse) and0363100012167736 (Keysersveste, Keizersgracht28–36, 1990–91 marble apartments). Root must apply/review `checks/proposed-generator.patch` and `checks/proposed-details-roof.patch`, preserve existing metadata while merging only those recipes/models, capture new gallery views and obtain independent/root review, then actual desktop/touch game and performance evidence. The repaired assets retain two materials, original measured planes, native footprints and distinctive shutters/crown or inset balconies/blue entrance.

Primary aerial evidence established opaque raised roof assemblies, not uniformly glazed boxes. Their cheeks now begin on local supporting roofs (modern19.71m+, warehouse16.29m+) instead of near ground level. Nine internal modern faces are removed and seven actual local steps retained. Missing full-source regions17/30 were restored as recipe16/17, with explicit mapping. Current2026 warehouse roof is pale; 2023/25 gray imagery is retained. Hidden cheek materials/function remain conservative inferences. Do not claim exact equipment identification. Proofs: `evidence/roof-closure-check.json`, `roof-region-mapping.json`, `roof-legacy-regression.json`. All15 previous models regenerate byte-identically. CPU checks are not visual acceptance. Roof-followup raw source packs and batch04 sources were checksum-verified (425 payloads,97.3MB) and pushed at7b26e67e736c6434849b443ec649cb1836713f3d before public admission.

**Batch04 remains unaccepted.** Builder `/root/canal_belt_batch04_builds` owns `/tmp/canal-belt-batch04`, finishing three original native models:

- 0363100012168028: historic1912 Robbers office/warehouse, Spuistraat110–116 / Singel151; paired roof glazing, relief and window groups. BAG1989 is not its architectural appearance date. Mapped Amsterdam Velo/Rush Hour points are inside, but curatedPointsInside is empty. Keep basic mapped-place info separate from the automatic route pool; no invented POI destination.
- 0363100012176271: former1941 bank archive, Singel152–158 / Bergstraat1–3, municipal monument210050. Four broad loading windows, substantial tile cap and five unequal side house-fronts/dormer/hoist rhythm. The clear side reference is dated2011; current side panorama attempt failed and is preserved. Full historical/source review remains required.
- 0363100012176244: 1972 offices, **Herengracht459–463**, Reguliersdwarsstraat12/14/16. Six pentagonal concrete roof dormers and offset external entrance stairs/rails. Earlier Singel address association was incorrect and is preserved as failed evidence.

Private `experiments/canal-belt-overnight/sources-04` contains completed source acquisition for these plus rejected candidates. Archived with checksum verification at7b26e67e736c6434849b443ec649cb1836713f3d; visual acceptance still required before public assets. Builder reports two materials each and useful CPU probes; root/independent gallery, live game, suppression/neighbor and performance acceptance are pending.

**Poly Haven material trial:** user suggested free component textures. Official CC0 checked. Worker `/root/polyhaven_material_trial` owns isolated `/tmp/canal-polyhaven-material-trial` plus private material source pack. Compare restrained shared brick/stone/concrete base-color materials on a published warehouse and Maxwell while preserving architecture, source colors and draw budgets. No production texture change is accepted yet. Root must inspect game zoom/readability/shimmer and loading cost before deciding whether to use it.

## Ownership and practical paths

Root alone owns shared catalogue/dispatcher/bundle registration, GPU reviews and public/source git windows. Builders use isolated staging. Do not overwrite canonical root dirty work or stage unrelated drafts.

- Active development: `/tmp/map-recall2-canal-belt-overnight`, local game `http://localhost:3000/canal-drive/`.
- Public integration: `/tmp/map-recall2-ordinary-gallery-release`; fetch/rebase current origin before copying accepted changes. Public main advances through other agents too.
- Clean private archive: `/tmp/map-recall2-source-ordinary-pilot`; fetch/rebase, copy only complete owned packs from `/Users/blackmad/Code/map-recall2-source-data`, verify every checksum, commit/push before public model commit.
- Root review evidence: `/Users/blackmad/Code/map-recall2/artifacts/canal-belt-overnight/batch01`, `batch02`, `batch03`.
- Raw-source gates: ea13b59 (first warehouse/modern), de241dc94ce7fa8dd6d1dbf11e94b794084a9fa8 (source03/Maxwell correction), 88fd684b99971e52e983546cf9e8a277de010616 (modern02/deck), ed24dde852932532f946836cf76f379269ea6477 (corrected Singel part/date).

`build.ts` supports source-specific window tiers, arched openings, shutters, doors, fins, balconies, shallow glass bays and optional thin measured terrace decks. `build-canal-belt-details.mjs` adds original bounded physical details for batch03 and consolidates flat colors into a vertex-colored primitive. Run generic generation before this poststage. Preserve semantic roof triangle ranges for upward-normal checks. Builders must not silently reset accepted catalogue camera/source dates/status.

Rebuild signature/runtime bundles and modelAssetVersions after mesh changes. Exact replaced native identities are hidden only after successful loading, including the independent pyramidal roof layer; fallback must restore on disable/failure. Ordinary treatments must not fabricate selectable/trivia POIs. For genuine POIs audit destination, geographic map pin and researched card together.

## Review findings and performance limits

Source frontage and ground openings dominate recognition: warehouse rounded loading arches, masonry crown/shutter folds; modern upper glazing and genuinely broad double-height retail bays. Generic palette changes do not fix missing critical assemblies. Build-specific light geometry on native surveyed envelopes works well, but simple-box screening never substitutes for source/open-space review. Some roof patches represent decks, dormers or equipment rather than occupied full-height wings.

Failures retained: initial gallery radians/degrees and runtime camera direction; Maxwell blank upper corner repairedv4; Kalver minor full-height fins erased retail bays, repaired to upper-only fins; Kalver terrace formerly closed as a large box, source-supported thin deck repaired; Singel opposite-wing/window-count and photo-date associations corrected; batch03 ground-based roof boxes held until local closure repair. Initial warehouse crown hold was withdrawn only after source/GLB/runtime diagnosis confirmed supported geometry. Do not restore unaccepted patches or claim an earlier held mesh is reviewed.

Root accidentally overwrote the original batch02 GPU failure screenshot output. Failed GLB/catalogue/worker CPU evidence and independent hold remain; `failed-deck-reconstructed` is explicitly a later reproduction, not the original capture. Future reviews use unique versioned output directories.

Published batches passed root/independent source-gallery and desktop/touch-emulated actual game checks, exact suppression, neighbor/fallback/picking checks and stationary-rider camera pan/zoom-out. Batch02 Kalver rear remains partially roof-occluded in the supported gameplay camera; gallery and first-hit evidence verify its facade, but no claim of full rear-row gameplay visibility. Physical-phone testing was not performed.

Warm sampled site/wide frames are typically16.7ms p95; this is not a cold-load improvement measurement or a stall-free claim. Earlier cold touch wide33.3ms, nonstartup446ms and reload948ms tasks remain preserved. Batch02 observed pre-reload nonstartup maxima153ms desktop/123ms touch. Keep actual timing and limitations with each acceptance.

## Feedback and next release

Latest October7 checkpoint: open0, in-progress1, atLimit false. Kriterion note1d79b5b9-8491-4c91-b99f-9f9820b69e5b (“bottom ewindows brown”) is claimed by another workstream. Root made no feedback claim/resolution. Preserve its private note/screenshot and do not duplicate the claim. Pull queue at batch/release checkpoints and at least every30minutes using `.agents/skills/canal-feedback/SKILL.md`.

Next: archive completed sources; inspect and integrate batch03 roof repairs; produce independent gallery/game/performance acceptance; review batch04 native architecture and mapped identities; commit/push each accepted bounded batch with source gate recorded; verify hosted content hashes/gallery and finish ten-building demo/lessons. Continue building work while material trial and documentation proceed. A completed cycle, tests or successful archive is not visual acceptance.

Previous checkpoint chronology and failed-state notes are preserved in `canal-belt-checkpoint-journal.md`; the current status above supersedes those entries.
