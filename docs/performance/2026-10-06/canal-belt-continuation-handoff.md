# Canal-belt ordinary-building handoff

Updated 2026-10-07, 19:55 UTC. The continuous building request remains **active**. This is a working checkpoint, not completion or publication of the new drafts.

## Scope

The user reconfirmed **large, fairly boxy non-landmark buildings inside the canal belt**, especially converted warehouses and modern commercial blocks. Give each its observed architectural character on native geometry: opening groups, materials, roof/setback proportions, and a few inexpensive defining assemblies. Prioritize speed without accepting missing street facades, top-floor windows, open spaces or neighboring-building ownership errors. Exclude elaborate monuments, courtyard complexes and uncertain multiwing assemblies from this quick queue. Exclude both ordinary-gallery and manual/signature-model identities when discovering candidates. Do not invent building-name signage, curated POIs or destinations for ordinary mapped shops.

## Repository and ownership

- Main working integration: `/tmp/map-recall2-canal-belt-continuation`, detached base522e6a27. It is dirty with **24 local entries: published 20 plus four unaccepted drafts**. Do not commit its catalogue/models wholesale.
- Clean publication/checkpoint worktree: `/tmp/map-recall2-canal-continuation-checkpoint`. Last root public checkpoint **fb7320eef1a92f7de1b7d0feca1462fa628b112f** was pushed. It contains workflow/guard/handoff/inventory changes, not new models. Fetch and rebase before any later push; peers advance main frequently.
- Canonical shared repository: `/Users/blackmad/Code/map-recall2`. Preserve its unrelated dirty files and index. This handoff is copied there for other agents.
- Private source worktree: `/tmp/map-recall2-source-canal-continuation`, remote `blackmad/map-recall2-source-data`. Root owns source publication, shared catalogue/dispatchers/bundles, GPU browser reviews and git windows. Building/source workers use isolated staging directories.
- Local review server: `http://localhost:49327/canal-drive/`, process session9077. Other agents use other ports; do not kill their servers. Chrome now works with restored full root access.

No build worker should be described as actively modeling merely because its handoff exists. At this checkpoint the scoped authors/reviewers completed their reports; the slab author showed `pending_init` in the latest agent listing, not a verified active build. Start fresh, short-context workers for the next buildings and coordinate GPU/git ownership.

## Current models

### 1. Haarlemmerdijk 1–7 / Korte Prinsengracht 22–34 — BAG0363100012165204

**Closest to admission.** Author package `/tmp/canal-haarlemmer-box-build/HANDOFF.md`, model/data/portable `details.mjs`, `fixed-facade-top.patch`, six CPU views and failed-first/prior checkpoints.

Final GLB **473,376 bytes,7,357 triangles,7 materials**, SHA256`ac5690a122f965987c84404917b1a288fe642e18790b6320d674c079fb63e0ab`. Native 1,151 m² / no holes,1967. Frontedge9: three11-group green-window tiers, white Juliets, broad retail piers/canopy. Canal edge 6: raised shops, pink basement doors and **white lower 4.5 m zone**. The first tan lower-zone draft failed independent recognition and is preserved. Tiny equipment tops are omitted explicitly; substantial188 m² raised 19.47 m rearroof and275 m² low 6 m roof are retained.

Independent corrected source/GPU architecture **PASS**: `/tmp/haarlemmer-box-independent/review.json`; priorHOLD preserved. Actual corrected GPU `/tmp/canal-haarlemmer-gpu-v2`, both street front controls/references work. Exported white-zone first-hit color verified. Root inspected actual mainfront; inspect corrected secondary and final game frames before admission.

**Actual desktop and touch game checks on this exact final hash pass**, including lazy-load replacement, exact suppression, neighbor retention, fallback/forcedfailure, stationary-rider gestures and zoom-out: `/tmp/canal-new-boxes-game-v2/{desktop,touch}.json` and screenshots. Request URLs prove the final hash loaded. Warm median/p95~16.7 ms. Whole-test startup longtasks max 251 ms desktop / 175 ms touch; do not claim stall-free performance.

Remaining: root final visual acceptance, private finalmodel/evidence archive gate, scoped fidelity/catalogue/manual-gallery integration, rebuild current bundle/fingerprints, then commit/push/deploy and verify hosted asset. The optionalfixedFacadeTopMetres patch is applied only in the dirty integration generator; it is not in fb7320ee. Run meaningful old 20 hash regeneration after integrating this further change.

### 2. Singel 532–540 / Reguliersdwarsstraat 59–63 — BAG0363100012168482

Author `/tmp/canal-slab-box-build/HANDOFF.md`. Final GLB **139,672 bytes,956 triangles,3 materials**, SHA256`466b074f4d5ae238b0570cf5218390e6e409d58e275e4ffa839faa165f497a6f`. Native 1,349 m² / no holes. Gray slab panels, repeated single square panes, dark recessed top row and both end stacks, tall retailglazing. Major 989 m² at 21.52 m and342 m² at 18.06 m roof surfaces retained; omitted small unknown equipment/roof cutouts are documented and capped at their supporting roof, not made into ground courts.

First draft used a neighboring glazed continuation on west edge 7 and left actual southern Reguliers edge 9 almost blank. **This failed and was corrected** from current municipal panorama 01838: four paired tiers, western shops, eastern loadingdoors; remove borrowed edge 7 glazing. New original source is `/tmp/canal-slab-box-build/secondary-source` and is **not yet privately archived**.

Independent corrected source/geometry **PASS**, `/tmp/singel-slab-independent/review-secondary.json`; originalHOLD preserved. The first gallerySecondary object omitted its requiredtarget/distance/referenceImages and produced a TypeError. Root normalized metadata in the **dirty integration recipe/catalogue only**, keeping GLB unchanged. Corrected actual capture `/tmp/canal-slab-secondary-gpu-v2/capture.json` has no errors; independent/root actual corrected secondary inspection remains pending. Do not use failed `/tmp/canal-slab-secondary-gpu` as acceptance evidence.

Same exact-hash desktop/touch game evidence as above passes; desktop p95~16.8 ms,touch ~16.7 ms. Remaining: inspect corrected actual secondary/source and finalgameframes, archive new01838original plus finalmodel/evidence, preserve normalized gallerymetadata in portable reproduction/integration, then admission/publication.

### 3. Singel475–483 / Kalverstraat228–230 — BAG0363100012175221

Author source correction `/tmp/brick-corner-source-finish/HANDOFF.md`. New whole-source images proved earlier13 upper pairs wrong: actual 10 pairs, four concretegroups each four panes, western brick/balconyband and eastern tall glass. Actual Kalverstreet is **edge2**, with four structural bays of shops/stripwindows/verticalwindows/attics. Edge3/7/8 abut separate native neighbors; preserve them. Corrected composition/native ownership pass independent review. OriginalV6 and every failed correction are retained.

Root follow-up is **`/tmp/brick-corner-root-top-fix`**, not the author's frozen model. LatestGLB **381,820 bytes,3,767 triangles,3 materials**, SHA256`ca5da2ea78019ed11a1a7781e7a8ba1a7018b2a3c6d651eb4f487b6834d468dd`.

Independent actualGPU found missing backing above Kalver attics at16.8–17 m; old 148 pane probes at16.4m missed the failure. First root four-bay patches left structural-pier gaps and failed again. Latest root repair adds **one continuous nativeedge2 attic/pier band16–17.44m using the existing atlas**, only 2 additional triangles, preserving original roof/source geometry. Original 148 pane checks and36 upper boundary checks pass; inter-bay pier checks/finalGPU/independent review still required. Previous root8-triangle repair must be retained as failed evidence if recovering its mesh from the frozen gallery checkpoint; do not claim an unpreserved originalGLB exists.

A separate far-roof-cap slit remains under investigation. Reviewer `/tmp/brick-corner-corrected-review/cap-rays.json` attributes it to roof17/partyedge7 support. **Root bounded downward ray tests along actual edge 7 contradict a simple21 m edge-wall extension:** most samples first hit the low8.35 m interior roof; only the last reaches20.45 m. DoubleSide produces the same results. Do not fill the entireedge 7 to 21 m from a nearby cap sample; the cap is inset from the tested boundary. Diagnostic script `/tmp/brick-corner-root-top-fix/scripts/diagnose-double-roof.mjs` and temporary attemptedclosure code are NOT an accepted repair. No roof-height fallback is used, so this attemptedstage adds no cheektriangles. Next reviewer should locate the exact cap support/local underside and make a bounded native-supported closure, or keepHOLD and prioritize the next boxes.

Latest continuous-band model has not yet had finalGPU/game/reproduction/source-archive acceptance. Local integration still contains an earlier root top fix hash, so **copy the final frozen model/catalogue together before retesting**. Source photos01257/259/01573/01575 in `/tmp/brick-corner-source-finish/raw` are new and not yet in privatecheckpoint 03. Both authoritative galleryfrontages and actual derived references are present.

### Deferred and held work

- BAG0363100012175216 pale Singelarcade: V08 remains **HOLD** for a literal32 m roof sail. AHN DSM supports broad highreturns up to34.16 NAP, contradicting an unsupportedlowseam simplification; physical ownership/role unresolved. Do not delete/lower from parentmedian alone. Archive/report `/tmp/canal-continuation-arch-review`, including `ahn/DECISION.md`. Continue simpler boxes rather than consuming the quick queue on this unknown object.
- BAG0363100012164994 registered telephoneexchange: V8 retained, **deferred out of quick box queue** because ornate/historic assembly needs full landmark architecture workflow. Do not lose its sources or manufacture a POI. Author `/tmp/canal-belt-batch06-mixed/HANDOFF.md`.

## Sources, feedback and checks

Private pushed source gates:

- **a588990cc983751afd09ac17d0ffd62d11401596**, `experiments/canal-belt-continuation-20261007/checkpoint-01`:473payloads52,046,531 bytes, three older drafts/failed source records and30originalHTTP/photos.
- **ac1c67511a5d39085212b46247b97c287980d482**, `.../checkpoint-02`:284payloads113,205,415 bytes. Original discoverypanos/API/3DBAG/AHN bytes separated from processedprojections; installednative feature subsets explicitlyclassifiedderived. Includes first GPU/game evidence and final AHN contradiction, not finalcorrectednew GLBs.

Create and checksum-verify/push **checkpoint 03** with new brick/slab originals, final author/root models and portable scripts/recipes, all failed/review evidence and actual corrected GPU/game outputs **before public model commit**. Reuse existing raw dependencies by commit/path, preserve capture timestamp separately from mission year / unknown AHN capture date, archive no credentials. Raw acquisition stage directories remain dependencies until archival/reproduction is verified.

Full root network/browser access works. Earlier worker DNS and network-disabled failures were sandbox-context failures; retry bounded and route downloads through working root. Never report a source permanently unavailable from one worker failure.

Latest feedback pulls completed **2026-10-07T19:55:39Z**: **open 1 / in-progress 1**. New open OCCII note `063e3e2c-0627-48a8-b835-f407fee9cbe7` reports facade misalignment on hosted build `c5ca253`, asset version `daa846481f1d3693`. Root read the full saved note/camera/build and inspected its screenshot; it remains unclaimed and unresolved, separate from the box-building queue. Evidence is in `.cache/canal-feedback/queue-open.json` and its extracted JPG. Existing Melkweg repair remains claimed elsewhere; do not duplicate it. Use `.agents/skills/canal-feedback/SKILL.md`, fresh Firestore update-time preconditions, and verified resolution evidence.

All 20 published ordinaryGLB hashes remained byte identical after countguard/native-region-hole changes: `/tmp/canal-continuation-guard-legacy20/proof.json`. Lint passed. SubsequentfixedFacadeTopMetres addition needs another meaningfulold 20 regeneration check. CPU preflight `scripts/review/ordinary-model-cpu.mjs` is useful but never GPU/game acceptance. Startupstalls remain open even when warm frame samples pass.

## Next actions / useful split for two agents

**Integration agent:** finish final root source/render inspection for the two new boxes, archive/checksum/push finalsource pack, merge only accepted models + portable stages/metadata into the cleanlatestmain worktree, update fidelity/work inventory and manual ordinary page, rebuild runtime/gallery fingerprints, run meaningful required checks, commit/push/deploy and verify hosted hashes/cards/feedback. Keep held arcade/brick assets out of published catalogue until their gates pass. Own GPU/git windows; no competing registration edits.

**Building/source agent:** resolve the bounded brick cap support issue if it is cheap, otherwise continue the next true box from `/tmp/canal-box-discovery-20261007/ranked-candidates.json`. Kalverstraat99 BAG0363100012168201 is a463 m² simple tall-glazing retail box with cachedsources. Spuistraat242–250 BAG0363100012175754 is a promising ochre modern box but requires645 versus 584.55 m² footprint reconciliation. Herengracht34 is deferred for a July 2026 alteration after available 2025 photos. Start fresh short-context workers; root handles sharedregistration/publication.

The production demo remains https://canalrecall-blackmad.web.app/manual-ordinary-buildings.html (published 20). Localgallery includes unaccepted drafts. Old `artifacts/canal-belt-continuation/index.html` shows earlierthreeCPUdrafts and is **stale**, not a demo of the two new corrected boxes. Create an updated demo after the next accepted release. Do not call the continuous goal complete at that batch checkpoint.
