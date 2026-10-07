# Continuous canal-belt ordinary buildings: current handoff

Updated 2026-10-07, approximately 19:10 UTC. The continuous user request remains active. The first ten canal-belt additions are published; that checkpoint does not complete the ongoing queue.

## Scope and next work

User reconfirmed large, fairly boxy **non-landmark buildings inside the canal belt**, especially warehouse conversions and modern commercial blocks. Preserve surveyed footprints and use source-specific facade groups, original procedural patterns and shallow native geometry. Exclude ornate monuments, courtyard complexes and uncertain multiple wings from the fast queue. Exclude both existing manual-model and ordinary-model identities during discovery.

Next ranked source pack: `/tmp/canal-box-discovery-20261007/ranked-candidates.json`, 236 files, approximately83.7 MB, staged for private archival. Root inspected its actual source contact sheet. Preferred next boxes:

- BAG0363100012168482, Singel532–540 / Reguliersdwarsstraat59–63: gray slab-grid commercial box,1,349m²,21.52m, no holes, native frontageedge5=35.60m. Fresh scoped builder `/root/singel_slab_box_build`, own `/tmp/canal-slab-box-build`, is implementing it from complete current official address/Pand relationships and municipal panoramas.
- BAG0363100012165204, Haarlemmerdijk1–7 / KortePrinsengracht22–34: pale brick repetitive block,1,151m²,16.01m, no holes; mainedge9=26.07m and opposite municipal views00513/00514 cached. Fresh builder `/root/haarlemmer_box_build` is implementing this second box in `/tmp/canal-haarlemmer-box-build`.
- BAG0363100012168201, Kalverstraat99: smaller463m² tall-glazing retail box,12.53m.
- BAG0363100012175754, Spuistraat242–250: ochre brick/polygonal glazed bay; resolve645 versus584.55m² footprint discrepancy before building.

No new candidates are accepted or installed publicly. Ordinary mapped shops do not create curated route POIs.

## Existing drafts and failures

BAG0363100012175221 Singel475–483 / Kalverstraat228–230: final priorV6 GLB380,532B,3,801triangles,3materials, SHA256`17876af33c809659681f7f05dc2ad9eec6fa08d48c62cce7195a099cba9f3434`. Prior15mm margin failure on angled paired windows was independently fixed and exported FrontSide rays pass. **New actual wide sources prove the longfront composition needs correction:10 upper paired groups, four broad concrete groups with four panes, western brick/stair balcony band. Kalverstraat is nativeedge2, with four structural bays/strip windows/tall shops and small attics; prior blankedge2 fails recognition. Edge3 is party/abutting.** Scoped source/build worker `/root/brick_corner_source_finish`, own `/tmp/brick-corner-source-finish`, is making these bounded corrections while preserving passedcorner/native roofs. Do not publish priorV6 merely because runtime checks pass.

BAG0363100012175216 Singel pale arcade: priorV08 GLB448,648B,3,702triangles,2materials, SHA256`8dfad6a703f03c4ced731c9293542cacb91ba29e3537d2257516011c04334c49` (consult catalogue for authoritative fullhash). North clerestory was buried by full roof-band walls;25cm deck interpretation exposes actual inset windows, independently43 FrontSide probes pass. Region144 small real component restored; low6.8m covered roof146 and elevated holes retained. **Region134 still renders an unacceptable32m sail. New official AHN DSM samples confirm genuine high returns up to34.16NAP in that locality; simple lowering as a fit artifact is contradicted.** Completed reviewer `/root/canal_continuation_arch_review` found a broad high cluster spanning the shaded adjacent roof area, not proof of a standalone thin sail. Report and AHN decision are in `/tmp/canal-continuation-arch-review`; do not invent a low seam or whole occupied32m wall. Keep HOLD if classification remains unresolved and continue simpler boxes.

BAG0363100012164994 registered telephone exchange Herengracht295 / Singel340: retained finalV8 GLB470,252B,5,587triangles,2materials,105 independent FrontSide probes pass. **Deferred out of the fast queue after user reconfirmed boxy non-landmarks**; elaborate historic east assembly and uncertain roof massing belong to full architecture workflow. Preserve all sources/drafts; not accepted, no automatic POI identity.

## Source archive and access

Private source checkpoint **a588990cc983751afd09ac17d0ffd62d11401596**, pushed to `blackmad/map-recall2-source-data`, path `experiments/canal-belt-continuation-20261007/checkpoint-01`:473 checksum-verified payloads,52,046,531bytes. Contains30 original raw HTTP/photos separately from processed sources, all three frozen drafts, failed evidence and source interpretation records. New discovery originals, AHN GeoTIFF/provenance and actual GPU/game evidence are privately pushed in checkpoint02 at90c943cad8b611a65266057448c82d9ff40aa8cf (281payloads,113,193,050bytes; final independent report/classification followup follows). Fresh corrected GLBs still require their own verified source/evidence checkpoint before publication.

Earlier DNS failures occurred in restricted worker contexts; full root access now works, Amsterdam portal HTTP200 verified. Successful root aerial acquisitions have explicit provenance, not fabricated request times inferred from file modification dates. Preserve failed attempts and retry with bounded backoff. Source host failure is not proven by sandbox-network-disabled errors.

Feedback last successful pulls2026-10-07T18:57:35Z: open0, in-progress1 (Melkweg cross geometry repair already claimed by another ongoing root/worker; do not duplicate). Full saved note read. Continue pulls at batch/release checkpoints and every30minutes active.

## Actual local verification and performance

Local integration checkout `/tmp/map-recall2-canal-belt-continuation` has published20 plus **two held local-only drafts**, not the telephone exchange. Server PORT49327, process session9077. Gallery GPU screenshots `/tmp/canal-continuation-gpu-v1`, root inspected actual fronts. Game desktop/touch evidence `/tmp/canal-continuation-game-v1`; tests completed with no browser errors, exact replacement suppression, lazy-load/failure fallback, native neighbors retained, stationary-rider camera gestures, source-front and zoom-out captures. Root inspected actual game front and zoom-out. The test's native pyramidal entries may be empty; do not overclaim visible roof-instance coverage.

Both local drafts warm median/p95 approximately16.7ms (touch maxp95~16.8ms), **startup longtasks reached377ms desktop /199ms touch**. These are not stall-free claims; keep loading/setup performance work open. Source/architecture failures still prevent visual acceptance regardless of successful runtime tests.

Opt-in generator improvements: source-required window cluster counts now fail explicitly if margin silently drops a group; native roofregion holes preserved, the deferred telephone-exchange rustica extension remains in its archived portable patch rather than the quick-box generator. Rebuilt all20 published GLBs from shared generator plus established detail stages; every SHA256 identical. Proof `/tmp/canal-continuation-guard-legacy20/proof.json`. TypeScript lint passes. Root-created `scripts/review/ordinary-model-cpu.mjs` remains fast six-view preflight only, not actual GPU/game acceptance.

## Integration ownership

Root owns catalogue/bundles, GPU browser slots, private/public git windows and publication. Root checkout based522e6a27, fetched peer origin/main a9c53249; isolate checkpoint publication from unaccepted review catalogue/models. Preserve unrelated canonical workspace and private archive changes. Rebuild current content fingerprints/runtime/gallery after accepted model changes. Run meaningful final independent source/render and livegame checks on corrected models before admission, then commit/push periodically and continue next box; never stop merely at this batch checkpoint.
