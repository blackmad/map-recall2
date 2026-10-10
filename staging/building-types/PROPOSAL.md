# Building types for Nieuw-West: pilot results and runtime proposal (2026-10-10)

Branch `types/nieuw-west-pilot-20261010`. Staged only: nothing here is installed in the game, no catalogue, chunk
manifest, bundle or TODO/HISTORY file was touched. The integrator decides what to install.

## What was built

| Piece | Path |
| --- | --- |
| Typed generator (footprint rectangle + roof facts + cladding variant -> mesh) | `src/canalRecall/buildingTypes/{geometry,orientation,mesh,spec,generate,facts,glb}.ts` |
| Tests (16, `node --import tsx --test src/canalRecall/buildingTypes/buildingTypes.test.ts`) | `src/canalRecall/buildingTypes/buildingTypes.test.ts` |
| Type specs with the bay counts and the photo evidence | `src/canalRecall/buildingTypes/types/nw-portiek-brick-pitched.json` (type 1), `nw-pilotis-panel-flat.json` (type 6) |
| Pipeline CLIs | `scripts/building-types/{select-area,build,camera-sheets,render-page}.ts` |
| Staged output | `staging/building-types/{sonderbuur,comenius}/` (pilot areas), `slotermeer-geuzenveld/` (negative control, reports and sheets only) |

Reproduce: `select-area.ts --nw=<survey> --area=... --lng --lat --t1/--t6`, write `variants.json` after looking at the
survey montage, `build.ts --area=...`, `camera-sheets.ts --area=... --survey | --sheets=<type>:<pand>,... | --aerial`.
`build.ts` fetches (and caches) one 3DBAG item per pand for the roof; the sheets fetch Amsterdam panoramas
(Gemeente Amsterdam, CC BY 4.0, faces and plates blurred by the publisher). No dev server is needed: the page script is
bundled with esbuild and loaded into a blank Chromium page (`--use-angle=swiftshader`; `--use-gl=swiftshader` loses
the WebGL context in this Chromium).

Generator contract (all in `generate.ts`): local frame x along the long side, front at +z, ground y = 0; a type is a
list of **bays** per facade (relative widths scaled to the real length) each with **elements** (window, ribbon, balcony,
door, storage door, vents, panel) repeating on `ground | upper | all | [floors]`, a roof (gable / hip / flat), a ground
mode (`solid | pilotis`) and **cladding variants** (palette + material slot; `variants`/`exceptVariants` per element so a
re-clad variant can swap balconies for ribbon windows). Storeys come from the 3DBAG eaves height
(`storeysFromHeight`: the count within one of the type's that puts the storey height nearest 2.95 m), roof form and
ridge direction from the 3DBAG LoD2.2 roof planes (`roofFactsFromItem`), the front from `frontSide` (below). Materials
carry `materialSlot` + `tint` extras and metre UVs, so `buildingRecipe/recipeLook.ts` dresses them like recipe houses.

**Front orientation** (`orientation.ts`, tested for 5 rotations x both sides, footpath-vs-road, gable street, yaw
mapping, south-facing world check): sample 5 points along each long side, 0.5 m outside; per point the distance to the
nearest street segment that lies in front of the side plus a class penalty (drivable 0, service 6, cycleway 8, footway 10,
path 12); mean per side; the lower side is the front; ambiguous when the two means are within 2 m.

## Measured (24 instances per pilot area, real BAG footprints, 3DBAG ground)

| | Type 1 (Sonderbuur / Reinveen / Wildeman / Veldzicht) | Type 6 (Comeniusstraat / Johan Huizingalaan) |
| --- | --- | --- |
| Instances; variants | 24; 13 brick, 11 re-clad grey (`clad-panel`) | 24; ground mode 13 pilotis, 11 solid (10 closed + 1 unusable crop) |
| Triangles per instance | 1,308 (clad 1,148) | 3,414 solid 3,232 / pilotis 3,414; over the 3k recipe budget (joints, slat balustrades) |
| Baked GLB (one node per exact-size instance, meshopt) | 688 KB, 29,632 tris, 1 file | 1.49 MB, 79,934 tris, 2 files (50k-triangle split for the audit cap) |
| Merged into one mesh per material (chunk style) | 626 KB (2.06 MB raw), 58,208 vertices | 1.33 MB (5.13 MB raw), 144,836 vertices |
| True instancing (`EXT_mesh_gpu_instancing`, 1 mesh per design group + per-instance TRS+scale) | **78 KB** (184 KB raw), 4,828 vertices, 2 groups, max scale deviation 1.6 % | **149 KB** (442 KB raw), 12,040 vertices, 2 groups, max scale deviation 12.2 % |
| Saving vs merged / vs baked | 88 % / 89 % bytes (91 % raw) | 89 % / 90 % bytes (91 % raw) |
| Bucketed instancing (one mesh per +-0.25 m length/width and +-0.2 m eaves bucket instead of scaling) | n/a (scaling is within 1.6 %) | 7 meshes, ~517 KB: 61 % less than merged |
| Rectangle IoU vs BAG ring | min 0.998 | min 0.997 (12-vertex notched rings; control 0.953) |
| Front street ambiguity / distance | 1 of 24 ambiguous (still correct on the sheet); median 12.5 m, 11 fronts > 15 m | 0 of 24; median 4.6 m, 2 > 15 m |
| GLB audit (`npm run audit:glb -- --file=...`) | unit meshes PASS; baked PASS (warn: site model > 150 m, 1,472 open window-plate loops) | unit meshes PASS; baked parts PASS (same warns) |

Extrapolated to all 357 + 70 panden (the cluster counts; tris/vertices per instance from above, 32 B/vertex raw):

| | merged / baked per pand | true instancing |
| --- | --- | --- |
| Download | 357 x 26 KB + 70 x 55 KB = ~13 MB | ~10 unit meshes x 40-75 KB + 427 x ~40 B = ~0.6-1 MB |
| GPU vertex memory | (357 x 2.4k + 70 x 6.0k) = 1.29 M vertices = ~41 MB raw (~20 MB quantised) | 17-50 k vertices = 0.5-1.6 MB |
| Triangles if everything were in view | 357 x 1.2k + 70 x 3.3k = ~670 k | the same (instancing saves memory and calls, not triangles) |
| Draw calls, 150 type-1 + 35 type-6 in view | per-pand clone path (today's `SharedAssetCache` clones): 185 x ~8 = ~1.5 k; per-chunk (15 pands/chunk): ~12 chunks x ~9 = ~110 | one InstancedMesh per (unit mesh, material): ~4 meshes x ~8 = ~35 |

Triangles are the cost that does not go away: 670 k only if the whole district is in view, but a 500 m radius around
Sonderbuur holds 144 type-1 pands (~180 k tris) and around Comeniusstraat 34 type-6 (~115 k). That needs LOD (a
flat-shaded 150-300 triangle box-and-roof version beyond ~120 m, which instancing makes free) before it is installed; the
generator already takes the facade detail from data, so a `lod: 'far'` that keeps walls, roof, balcony slabs and columns
and drops windows/rails/joints is a small change.

## Comparison with the photos (camera-matched, panorama position/heading/FOV, three columns: photo | render | 50 % overlay)

Sheets: `sonderbuur/sheets/nw-portiek-brick-pitched-contact.jpg` (4 instances: 2 brick, 2 re-clad),
`comenius/sheets/nw-pilotis-panel-flat-contact.jpg` (4 instances: 2 closed ground, 2 pilotis), aerials
`*/sheets/aerial-{oblique,top,close}.jpg`, survey montages `*/sheets/survey-{a,b}.jpg` (all 24 photos per area, used to
choose variants), negative control `slotermeer-geuzenveld/sheets/*-contact.jpg`.

What matches: footprint, orientation (the entrance, stair core and balcony stacks are on the photographed side in all 8
sheeted pilot instances and in the 4 control instances), eaves and ridge heights, storey count, roof direction (all 38
pitched type-1 members, in all three areas, have a gable roof with the ridge along the long side; 3DBAG agrees with the type's roof class for every one of the 74 pands),
the five-bay rhythm of type 1 (door, balcony columns and window groups land on the overlay bay for bay, including the
4-storey Geuzenveld members that 3DBAG labels 5 storeys), the symmetric 2+2 balcony / window / stair core rhythm of type 6
on Comeniusstraat 109852 (door 245 px in the photo, 250 in the render), the pilotis columns and soffit band.

What does not match, honestly:

1. **Design purity of a footprint cluster is not guaranteed.** In the control area (Geuzenveld/Slotermeer, nearest 26
   cluster members around 4.809, 52.3775): all 12 "type 6" members (Dirk Sonoystraat, Jan Zijvertszstraat) are a different
   design (brown brick with white slab bands and a glazed stair tower; massing right, facade wrong); of the 14 "type 1"
   members 9 are the 4-storey version of the same five-bay design (2 checked on camera-matched sheets, the other 7 read the
   same in the survey montage), 2 have a shop ground floor (Burgemeester Van Leeuwenlaan) and 3 look like another layout
   (Jan Goeverneurhof; not examined closely). The earlier survey photo of Beek en Hoff 12-2 shows a third
   sub-design (wide 5.5 m core, storage doors at the outer edges); it is not modelled. A design needs a facade signature
   check per pand, not only dimensions.
2. **Cladding details not modelled**: cream spandrel bands between the window rows (13 of 24 Sonderbuur members read as
   plain brick), the roof dormer/chimneys of type 1, the curved balcony slabs of type 6, the dark mesh cages behind the
   pilotis, per-flat curtains and awnings. Windows are plates (frame + glass), not recessed.
3. **Type 6 asymmetry and mirroring**: Comeniusstraat 549-2 has no balcony pair right of the stair door in the photo (the
   model is symmetric); some members may be mirrored. The back facade and both gables of both types are **inferred**
   (marked `inferred` and `NOT verified` in the JSON): no straight-on photo of a back or gable was in the survey.
4. **Pilotis vs closed ground** is per pand and cannot come from BAG/3DBAG; I classified 24 pands by eye. 13 pilotis, 10
   solid, 1 photo useless (camera under the soffit).
5. **Re-clad variant coverage**: type 1 has 11 re-clad members (variant `clad-panel`, verified on 2 sheets: brick piers
   and plinth kept, grey spandrel panels and ribbon windows, blue doors). None of the 24 type-6 members is re-clad, so the
   type-6 `render` and `clad-grey` variants exist only in the generator (unit GLBs, tested) and are unverified.
6. Type 6 is 3.2-3.4 k triangles per pand (budget 3 k); type 1 is 1.1-1.3 k.
7. Rows with a heavy oblique pano (pilotis sheets) show the perspective of the real view; the overlay is still readable but
   the pixel error there is ~3-5 % of the image width.

## Runtime proposal

**Category.** `street-survey` (repetitive geometry whose aim is reuse; `docs/buildings-pipeline.md` taxonomy). Never a
landmark. Each manifest entry carries `category: "street-survey"` and a `buildingType` object; the street-surveys gallery
gets a "building types" section next to faces and chunks (type spec, bay counts and evidence, strip photo | render pairs).

**Loading: two options, recommend A with B as the stop-gap.**

*A. Shared unit meshes + instance list, drawn with `THREE.InstancedMesh`.* One GLB per design group
(`types/<type>__<variant>__<storeys>__<roof>__<ridge>__<ground>.glb`, 36-90 KB meshopt, unit dimensions in extras) and one
`building-types.json` manifest, same shape family as `chunks.json`:
`{version: 1, units: [{id, modelUrl (?asset=<sha16>), sha256, bytes, triangles, nominal: {lengthM, widthM, eavesM, ridgeM}}],
instances: [{pand: <BAG id>, unit, anchor: {lng, lat}, northOffsetDegrees, scale: [sx, sy, sz], groundNapM, regroundedByM,
variant, groundMode, front: {street, bearingDeg}}], suppress: [<BAG pand ids>]}`. A new layer module (typed,
`src/canalRecall/landmarks/buildingTypes.ts`) builds one `InstancedMesh` per (unit primitive) with the shared recipe-look
materials (`materialSlot` -> city brick/stucco/stone/roof shaders, already shared across recipe houses), writes the per-
instance matrix from `anchor` + `northOffsetDegrees` (the same ENU placement the ordinary layer uses) and the scale, and
answers hover/click with `instanceId -> pand` (simpler than the chunk `faceIndex` ranges). Mirroring is not needed (the
front is rotated, not mirrored); if a chiral design appears it gets a second InstancedMesh with the opposite
`frontFace`, because three does not flip winding per instance. Non-uniform scale is bounded (<= 4 % in the sheet
data; bucket by +-0.25 m when a group exceeds it, as Comenius' solid group at 12 % would).

*B. Per-area chunks through the existing `chunks.json` contract* (the `*-baked-<n>.glb` files here, <= 50 k triangles
each, node per pand with `extras.pandId`): works with the current loader and `suppressOsmIds` today, no new code, but
no sharing: ~13 MB for 427 pands, ~110 draw calls in a dense view. Usable immediately for a first in-game look.

**Suppressing OSM/BAG extrusions.** Unchanged contract: every instance's BAG pand id goes into `suppress`
(`suppressOsmIds` of the layer's `SignatureModelSpec`), exactly as `applyStreetChunks` does. Precedence when several
sources cover a pand: landmark > block-face chunk > per-house recipe > building type > OSM/BAG extrusion; a type instance
is dropped (not drawn) for a pand that a higher source already covers, and its `suppress` entry is removed so the hole is
not doubled. Pands the generator rejects (design mismatch, ambiguous front, a gate failure) stay in the cluster list as
`held` with the reason, as block faces do, and keep their extrusion.

**Ground.** Instances stand on one street level per area (median 3DBAG `b3_h_maaiveld`, `chunkGroundNapM` in the asset
extras), the street-chunks rule: per-pand maaiveld wobbles by up to a metre on a flat street. The staged GLBs record each
pand's own ground and the re-grounding delta (0.0-0.4 m here).

**Gates before anything is installed** (each exists today or is one small script on top of this lane):
1. `node --import tsx --test src/canalRecall/buildingTypes/buildingTypes.test.ts` (rectangle, front orientation, counts
   vs the JSON, storeys from height, roof facts, GLB writers).
2. `npm run audit:glb -- --file=<unit glb>` per unit mesh and per baked chunk (triangle cap, below-ground, detached, blank
   walls); `holes` warnings from open window plates are expected.
3. Per pand, in `build.ts`: rectangle IoU vs BAG >= 0.9, eaves/ridge vs 3DBAG (exact by construction, assert +-0.3 m),
   storey height 2.6-3.4 m, 3DBAG roof class equals the type's, front ambiguity, `warnings` empty or reviewed.
4. **Design review per area**, mandatory: the survey montage (all photos of the area) and one camera-matched sheet with
   >= 3 instances including a re-clad one; every pand whose photo shows another design is `held`. The pilot found a 100 %
   mismatch in one area, so this is the gate that matters. A cheap next step is a facade signature (window-axis count and
   balcony columns counted from the panorama by a model against the bay list) so the montage review is only for outliers.
5. Camera-matched in-game shot from where riders pass (street-level, desktop and iPhone), plus the existing block-face
   gates for overlap with neighbouring chunks/recipes.
6. Runtime: measure frame time with 150 type-1 + 35 type-6 in view on the iPhone project (4x throttle), with and without the
   far LOD; target <= 40 draw calls and <= 200 k triangles in view.

**Not decided here (needs the integrator):** manifest location (`public/canal-drive/ordinary-buildings-data/`), npm script
names, the browser bundle for the layer, whether the `buildingTypes` objects extend `catalogue.json` or live only in the new
manifest, and the cluster -> design assignment for the other 55 clusters of the Nieuw-West survey.
