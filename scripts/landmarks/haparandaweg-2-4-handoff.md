Haparandaweg 2/4 frozen draft (2026-10-07)

Own worktree: `/Users/blackmad/Code/map-recall2-haparanda-2-4`, base `1f13dba2`, branch `worker/haparanda-2-4-oct7`. No shared registrations, bundles, git index, commits or GPU changed. Shared root node_modules is read-only.

Owned deliverables: `scripts/landmarks/haparandaweg-2-4-{builder.ts,spec.json,footprints.json,research.json,poi.json,geometry-review.json,extract.mjs,handoff.md}`, `scripts/landmarks/export-haparandaweg-2-4-draft.ts`, `scripts/check-haparandaweg-2-4-geometry.ts`.

Draft `artifacts/landmark-next-batch/haparandaweg-2-4.glb`: 27,513 triangles, 371,432 bytes; no textures. CPU renders in `artifacts/landmark-offline-preview/`. Four source crops in `artifacts/haparandaweg-2-4/` and private processed pack. Failed roof export preserved as `artifacts/haparandaweg-2-4/failed-roof-quantization.glb`.

Private unstaged sources: sibling `map-recall2-source-data/models/haparandaweg-2-4/raw/2026-10-07/manifest.json` lists raw bytes/provenance/checksums; processed crops separately. Root must verify/publish private sources and enter commit before model checkpoint.

Identity is genuine school `n4337412612` (OSM XML), matching building `w435847382` with exact BAG `0363100012244095`; small ancillary Haparanda VBOs 8521/8522 share physical school with Archangelweg4. No apartment duplicate. Root integrates genuine POI route/pin/card, using public west entrance if centre is inaccessible; proposed west entry `[4.872796,52.394089]` is photo-guided and still needs route evidence.

Shared wiring: import `buildHaparandaweg24`, invoke `(width,depth,tools)`, merge materialOverrides from spec. Suppress only exact parent; retain adjacent parents including east `0363100012252993`.

Checks: scoped TypeScript compile passed. `node --import tsx scripts/check-haparandaweg-2-4-geometry.ts` passes 36 first-hit glazing probes and exported roof winding. Two postquantization source slivers failed before repair; original failed GLB retained. CPU geometry and source comparison are draft evidence only. Root independent review and native gallery/live/game/pointer/route/suppression/neighbors/performance acceptance remain pending.

Corrected candidate after independent rejection:26,233triangles/357,504bytes;SHA256`a912c0ecc4e37ca43d553839c1c14ad6515c89fec2e52005f7da205d2cfe8d5d`. Prior7e87ae draft, fourviews and independentrays preserved in `artifacts/haparandaweg-2-4/failed-independent-7e87ae/`. Allfive findings repaired as recorded in research.json. Added24decodedterrrace/guard/deck/stair/door/northground probes plus independently scanned7north upperframes with two widthgroups. ScopedTypeScript passes. Fourfull CPUviews regenerated;2lowernorth views in `artifacts/haparandaweg-2-4/lower-north/`. Photo-guided publicwestentry updated to `[4.872795,52.394106]` atactualdoor. Freshindependentreview and allnativegameacceptance stillpending. No shared/index/GPUchanges.

Native louver HOLD repair candidate: draftSHA256`50625e96b3262bbf5aba32e5eb1db5a940fc25a167c7e658447662508d80a0a5`,26,233triangles/357,384bytes. Faileda912/production6e1fmodels and3nativePNGs preserved in `artifacts/haparandaweg-2-4/failed-native-a912-6e1f/`. Originaldecoded minslatgap17.224mm/no duplicatedslattriangles/horizontalnormals. Newminimumdecodedgap148.269mm over1188sampledtriangles, counts unchanged, no shader/depthbias changes. Innerterracereturnslats alsoseparated. ScopedTS and originalcriticalchecks plusdecodedgap assertions pass. Rootmustregenerateproduction and capture affectednativeviews; diagnosis/fix effect remains inference untilGPU comparison. Onlybuilder/check/research/handoffchanged, noGPU/shared/indexedits.
