# Historic body/roof repair — frozen original candidate

The three-model faulty-flat-body checkpoint `3b93bdb4` / `a7812218` / `03d49c32` is preserved in `artifacts/melkweg-coupled/fault-repair-checkpoint/`. Its aperture/void corrections were scoped passes, not historical body/roof source acceptance.

Current **historic** original export: SHA256 `3da63c59404705b921bbba36e57dc1080a93fa9ea26ce6f9e62b9d96c349a7d0`, **267084 B /22234 triangles**. Companion `a7812218` remains byte-identical; main Melkweg is now `1c39474d` after the documented source-plan top-ownership repair. Historic `3da63c59` is unchanged by that repair. All materials metallic0; per-asset budgets unchanged. No GPU/shared registration/git-index/private mutations.

## Source and modeled result

Cached official8738 3DBAG original is privately archived at commit `b1cdb177e3766b694f08fe38afe4c0e730829d0e`, path `models/stadsschouwburg/files/stadsschouwburg-current-3dbag.json`. It selects **AHN5**; source ground1.269000mNAP.96 source roof faces guide original native plan/plane reconstruction, not imported mesh triangles. The source has no fitted plane residual over.2m in this extraction.

Source roof groups relative to source ground:

- Paired large central pitched planes253/265m²:26.3–32.4m.
- Higher independent rear stage roof415m²:34.1–36.6m; shallow60m² annex near34m.
- Lower service-side roofs169–192m²:15.7–16.7m.
- Broad side-connector roofs173–174m²:19.5–20.0m.
- Steep front/central mansard/hip planes88–100m²:20.4–26.1m.

New PDOK current aerial original confirms these roof families and the separate higher stagehouse. Capture year of the mosaic remains unverified. RCE register46503 identifies independent audience/stage buildings, mansard audience roof with **three round dormers** and central ventilation, shallow stage gable, slate/zinc roof mixture, tent-roof towers and **twelve window axes on each long side**, basement apertures and varied side risalits. Current official ITA facade photos cross-check the front family and real lettering. The bounded Beeldbank exact-address search returned a JavaScript catalogue shell: recorded access gap, no drawing sheet claimed.

https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.0363100012168738

https://monumentenregister.cultureelerfgoed.nl/monumenten/46503

https://ita.nl/nl/stadsschouwburg-amsterdam/geschiedenis-van-het-huis

`prepare-stadsschouwburg-roofs.py` reconstructs121 native footprint/roof-plane assemblies, clips them to exact8738 and excludes the four authored front tower ownership footprints. Walls follow each source eave/profile; the uniform17.5/22.5 parent caps and unsupported generic main mansard box are removed. Explicit upward roof surfaces own tops. Shallow zinc-family large roofs use restrained grey; steep slate fronts remain darker.1.116m² native/source outline precision residue uses adjacent stable large roof planes, never maximum equipment height or a whole-building plate.

Retain the current three main arches, lower front niches, physical currentITA panel and tower/lantern assemblies. The higher upper niches now follow the source front eave25.9m, with3.8m tent roof preserving37.2m overall spire tops; the original low-body/high-tent split buried them under a newly source-correct mansard strip. Three round dormers now sit on the actual source front steep plane. The side groups have source-count12+12native wall bays; frame sizes and vertical tiers are explicitly bounded facade-photo/register reconstructions, not surveyed elevations or a claim of exact historical joinery.

## Checks, failures and limits

- Actual decoded **712 explicit roof triangles: zero downward**; finite native bounds. A failed earlier export had33 reversed source-rounded triangulation slivers. Its GLB/check JSON remain at `failed-source-roof-winding/`.
- Original triangulation cleanup omits238 numerical roof remnants with projected altitude below20mm, totaling**1.274153m²**; source rings/walls and large roof planes remain. The ledger is preserved, not hidden as perfect roof coverage. This is.04%of source plan area and is still a quantified visual/coverage limit for review.
- Historic42frontal aperture probes pass;192native side-pane probes pass.
- Actual decoded64selected modern source-direction rays still pass against the three-model group.
- Unchanged broad381-point void set has no unsupported blocker, no historic side-glass hit, all clear below7.7m;65 explicit source-supported8m corridor-floor hits remain recorded.
- Scoped TypeScript passes. Main/hall exact footprint and absence of broad spatial suppression remain unchanged.

Prepared source/CPU comparisons: `artifacts/melkweg-coupled/index.html`; current triple `artifacts/landmark-offline-preview/melkweg-triple-coupled-cpu-canal-oblique.png`; actual source aerial `artifacts/melkweg-coupled/new-raw-source/stadsschouwburg-aerial-current.jpg`. Full archive manifest: `artifacts/melkweg-coupled/source-archive-manifest.json`.

Independent failure review of roof-family recognition, source-supported side openings, numerical rooftop coverage and all preserved first-hit failures remains required. Actual GPU/gallery/game neighbors, exact load/fallback masks, chosen route/map pins/physical cards and performance remain pending. No complete historical-source or native acceptance inferred from CPU checks.

## Root archival/integration

Archive new raw PDOK aerial, RCE description, Beeldbank shell and provenance, existing two officialITA originals/licensed font input, processed roof plans, original code, failed checkpoint/slivers, current exports and CPU evidence before public model commit. Retain MAGENTA/MgOpen notice in raw font and production historic GLB scene extras as documented in main handoff. Existing genuineITA identity `extract_landmarks_1939633952`, relatedMelk identity `extract_landmarks_1586263374`; no thirdRabozaal destination/pin. Exact8738/8735/73457 ownership only; ordinary/pyramidal fallback stays until each asset loads.
