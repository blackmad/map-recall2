# Reconstruction as a landmark reference: bounded pilot

Investigated 2026-10-05. No reconstruction or splat training has been run. Root performed the initial bounded feasibility investigation after a fresh worker could not start at the thread limit. An independent worker then reviewed the actual inputs and runnable path once capacity became available. Existing landmark builds continue independently.

## Decision

Try geometry reconstruction before splat training. The desired artifact is an orbitable reference with fixed facade/roof comparison views and confidence markings, from which we author an original house-style mesh. Keep BAG/3DBAG/AHN as independent scale and roof checks. Predicted geometry is evidence to inspect, not an exact survey or authority for unseen surfaces.

The first candidate is OBA Oosterdok, whose source pack and revised manual model already exist, providing a baseline. Its current image set is **not yet admitted as a reconstruction dataset**. Inspection showed `OBA_07_2.jpg` is an interior section presentation and `architect-roof.jpg` is an interior photograph, despite misleading context/roof labels in the original provenance notes. Exclude both from exterior reconstruction. `07330-04.jpg` is a clear exterior front photograph. Inspect every remaining image for overlapping exterior features, alterations, crop, and resolution before proceeding. The independent pass found one additional genuine exterior image, `OBA_08.jpg`, linked in the already-cached architect page. It overlaps the portal/window grid in `07330-04.jpg` from a different viewpoint. These two form a **candidate frontage-only smoke-test pair**, subject to rights and state checks; they cannot establish an orbitable whole-building reference, back facade, or unseen roof setbacks. No compatible 360° panorama has been identified in this investigation.

## Independent image admission pass

All ten named candidates below were actually opened and inspected. Original new downloads plus checksums are cached in `artifacts/landmarks/splat-reference-exploration/references/`; existing images retain the OBA source pack and provenance. Filenames alone were unsafe evidence.

| Image | Actual content | Exterior reconstruction admission |
| --- | --- | --- |
| `07330-04.jpg` | Real daylight oblique main portal/window-front photograph, 2756×4134 | Candidate front view; architect source, capture date/permissions unresolved |
| `OBA_08.jpg` | Real dusk portal/front photograph from another position, 1744×1184 | Candidate overlapping second view; lighting and foreground differ, facade state broadly matches |
| `architect-front.jpg` | Architectural section drawing | Exclude from image reconstruction; useful separate geometry reference |
| `OBA_07_2.jpg` | Cutaway section rendering | Exclude; original provenance incorrectly called this exterior context |
| `architect-roof.jpg`, `07308-98.jpg`, `46---oba.jpg`, `25---OBA.jpg` | Interior photographs | Exclude from this exterior pilot |
| `0117-schb20-073.jpg` | Hand-drawn design sketch | Exclude from camera reconstruction; separate historical design evidence |
| `oba_06.jpg` | Aerial architectural masterplan rendering | Exclude; synthesized context and building-state differences cannot supply real camera evidence |

Minimum practical next input is a permitted short exterior sequence: several distinct front/corner camera positions with visible portal and recessed window-grid overlap, ideally 8–12 usable frames plus two reserved validation views. That is a bounded acquisition target, not a claimed mathematical minimum for VGGT. The pair already found can test front depth inference but lacks a reserved independent view; two-image success would not admit a whole-building reconstruction. Repeated windows, specular glass, mixed day/dusk lighting and narrow alley occlusion are specific failure risks. A panorama route requires a genuine permitted equirectangular image; neither ordinary photograph is one, and fake panorama stitching is excluded.

## Options and requirements

| Tool | Actual output/input | Fit and limits |
| --- | --- | --- |
| [PaGeR](https://github.com/prs-eth/PaGeR) | One equirectangular panorama → predicted depth, normals, sky mask, colored point-cloud GLB | Useful if a permitted real panorama is available. This is not Gaussian-splat training. Documented Linux/CUDA configuration needs approximately 11.5 GiB VRAM for unified fp16 inference. Code Apache-2.0; pretrained weights CC BY-NC 4.0. |
| [VGGT](https://github.com/facebookresearch/vggt) | Ordinary images → predicted cameras/depth/points; optional COLMAP export and bundle adjustment | Better input match for our cached photographs, subject to overlap/consistency admission. Code and the **VGGT-1B-Commercial** checkpoint have commercial-use provisions; original VGGT-1B checkpoint remains noncommercial. Read the exact license and obtain gated checkpoint access before choosing weights. |
| [gsplat](https://github.com/nerfstudio-project/gsplat) | Calibrated image set/COLMAP reconstruction → trained Gaussian representation and renders | Optional second stage only if point-cloud reference is insufficient. CUDA implementation, Apache-2.0 source. Training adds setup, rendering and validation work; savings are unmeasured. Pin the tested version rather than combining stale VGGT integration commands with current gsplat blindly. |

Local read-only check: macOS arm64, default Python has NumPy but lacks PyTorch, OpenCV and Pillow. No CUDA execution path is established here. No dependencies, model weights or paid compute were installed/obtained. The current captured `demo_colmap.py` queries `torch.cuda.get_device_capability()` before its CPU fallback and also uses CUDA autocast; the unmodified command is therefore not a verified CPU/MPS path. Apple GPU compatibility has not been tested.

## One runnable pilot handoff

1. Admit only a small set of exterior photographs with visible shared corners/windows and compatible building state. Record file checksum, source URL/date/rights, views covered, and excluded images. A short permitted contemporary walk-around capture may be more useful than unrelated historical photos; do not assemble panorama crops into fictitious independent camera positions.
2. On a suitable existing CUDA environment, pin the VGGT repository commit, dependencies and approved checkpoint revision. The captured `demo_colmap.py` hardcodes the **original noncommercial** `facebook/VGGT-1B` URL; merely running the README command does not select commercial weights. After approved `VGGT-1B-Commercial` access, explicitly load that checkpoint locally instead of allowing the original automatic download, recording its checksum/license. Put admitted originals in `SCENE/images/`. Start with `python demo_colmap.py --scene_dir=SCENE` for feedforward geometry, keeping `SCENE/sparse/points.ply` and cameras/points. Inspect confidence and alignment first. Add `--use_ba` only if useful overlapping feature tracks justify its added dependencies and work; it is optional, not the cheapest starting point. Validate reprojection and held-out views before treating output as useful.
3. Align the reliable visible structure to the exact BAG footprint and independent measured heights using one documented transform. Check several corners/roof elevations, not one dimension. Record residuals; distinguish occlusion, prediction error and changed building state.
4. Export a point-cloud viewer and fixed front/side/roof views. Evaluate those against original images and current OBA model. Stop here if this resolves setbacks/proportions without splat training.
5. Only if worthwhile, use the exported COLMAP set with a version-compatible gsplat trainer. Retain original cameras, masks, checkpoint and logs. Compare held-out original photographs; an attractive render alone does not validate architectural geometry or hidden roofs.
6. Archive originals, raw repository documentation/licenses, processed outputs and provenance separately under the canonical model ID in the private source repository. Generated point clouds/splats remain reference artifacts; runtime assets retain the original house style and standard visual/game checks.

## Success and stopping rules

Log preparation, compute/setup, inspection, modeling, and correction effort separately. Compare a bounded list of predeclared ambiguous details (portal depth, roof setbacks, side-wall alignment) against the existing photo/BAG/AHN workflow. Adopt the method only if it reduces total effort or catches material errors at unchanged quality. No token/time savings are currently demonstrated. Stop if inputs lack overlap, outputs disagree substantially with survey/photos, or setup dominates the bounded pilot; record that result rather than rolling the method into every build.

Independent verdict: **no reconstruction or training was run**. The immediate runnable prerequisites are an existing suitable CUDA environment, explicitly approved/selected checkpoint and admitted permitted exterior images. The two cached photos suffice only for a bounded frontage inference smoke test; full OBA reference admission still needs additional overlapping and held-out views. PaGeR is blocked on a genuine panorama; gsplat should wait until geometry-only outputs demonstrate value.

Raw documentation captures and HTTP/checksum metadata are in `artifacts/landmarks/splat-reference-exploration/references/`, ready for private source archival. They are current captures, not a record of an earlier experiment.
