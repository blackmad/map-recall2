# Sol's canal-house work: what to salvage, and how to reuse house types along a street

Research lane `research/sol-canalhouse-salvage-20261010`, 2026-10-10. This lane is read-only for `src/`.
New files: this doc, `scripts/research/upper-module-sharing.ts`, `scripts/research/detect-house-types.ts`.

## 0. Short answer

**Can a block be repeated with a generator, or by reusing the actual model? Yes for most 19th-century rows.
Today's pipeline cannot do it yet, and Sol's branches do not do it either.**

- On two new strips the uppers repeat. **Nassaukade 318–300** (20 pands): a 30-line image detector finds three
  repeated body types covering 12/20 houses. By eye there are four, covering 16/20. **De Clercqstraat 22–2**
  (12 house modules in 9 pands): two body types cover 10/12 modules, and every ground floor there is a different
  shop. See §3.
- The current block-face pipeline only shares *whole houses* with identical designs at the same fitted size
  (`blockFace/instancing.ts`, the `sameAs` rule). On the 15 authored faces this shares 14 of 84 houses, all of them
  on Marnixstraat. Splitting the ground floor off adds 10 houses (24/84). Splitting off the crown as well, on these
  authored intents, adds 1 more (25/84). The Bilderdijkstraat intents were written house by house: same 6.2 m
  width, same 4 storeys and bands, yet small authoring differences (bay weights 0.40/0.60 vs 0.32/0.68, balcony
  storeys [1,2] vs [1,2,3], sash vs arched) give every house its own key. Type reuse only pays off if the house
  type is authored once and placed many times. Deduplicating hand-written intents afterwards does not work.
- **Instancing is not mainly a draw-call win at block scale.** A block-face chunk is already one mesh with one
  primitive per material, 6–43 draws per face (measured below). Instancing per type gives draws = types × materials.
  That only beats chunk merging when the same types recur across many chunks, i.e. at district scale. Within one
  block the wins are authoring effort, consistency, payload and GPU memory. §4.4 has the numbers.
- Sol's work is a large **per-owner** Blender generator (Jordaan building library: 45 public buildings, a batch
  pipeline toward 3,189 owners) plus a September series of facade-perception experiments. None of it has a
  house-type layer. It reuses components and gable/opening *presets*, not types. The user rejected its fidelity on
  2026-10-02 (wrong BAG roofs, stock windows, missing entrances). Its most useful pieces for this goal are
  infrastructure and contracts, not geometry. Top 5 are in §6.

## 1. Inventory of Sol's refs

Survey commands: `command git log main..<ref>` and `command git diff --stat main...<ref>`. The large branches were
read in temp worktrees under `/Users/blackmad/.claude/jobs/d4e667c7/tmp/{sol-lib,sol-comp}`; nothing was checked
out over this worktree.

| Ref | Ahead / behind main | Content |
| --- | --- | --- |
| `backup/wt-sol-building-library-20261009` (1 archive commit on `agent/sol-building-library`, whose 0 unmerged commits are an old base) | 1 / 967 | 690 files: `scripts/blender/building_lib` (47 py modules, ~5.1k lines), `scripts/blender/expansion` (batch pipeline, 18 expansion recipes), 9 library recipes, `public/canal-drive/models/building-library` (recipes, 266 evidence crops, before/revised renders; GLBs excluded from the archive), 9 plan docs, TS tile/viewport modules `src/canalRecall/buildingLibrary{TileBatching,TileLoader,RenderChunks,Viewport,ViewportStreaming}.ts` |
| `.worktrees/jordaan-building-library` | n/a (copied tree) | The same library extracted as a standalone repo (`MIGRATION.json`: 2,248 files from `agent/sol-building-library@30a78198`, media excluded, GitHub push pending). Adds TS portable-LOD/quick-editor scripts and `artifacts/building-batch-scale-{100,200}` reports |
| `agent/sol-component-geometry` (contains all of the `agent/sol-*` chain below) | 39 / 1136 | `src/canalRecall/facade/{componentGeometry,balconyAssembly,awningAssembly,openingProposalAdjudication,facadeSvgExperiment,detailHeightEnvelope,rdMercatorBasis,wallPatchMeasurement,wallMaterialBandTrial,facadeTextureDemo}.ts` (each with a test), `scripts/review/classify-block-candidates.ts`, `scripts/review/headOnRoofRepair.ts`, Blender facade recipe prototype, ~60 review-data JSONs |
| `agent/sol-headon-geometry` ⊂ above | 30 | Head-on 3DBAG LoD2.2 texture demo, `headOnRoofRepair.ts` (first non-sky row per column plus spike rejection) |
| `agent/sol-banana-pack`, `-budget-unknown-ack`, `-gpt-effort-pilot`, `-svg-pixel-arch`, `-occ-vector-baseline`, `-svg-experiment`, `-band-e2e` ⊂ above | 8–25 | Image-model pilots (Nano Banana Lite/Pro facade reconstruction, GPT reasoning-effort SVG tracing, six-model vector pilot, OccFacade local segmentation, wall material band trial), plus `global-budget.mjs` scoped continuation |
| `backup/wt-sol-band-e2e-20261009` | 9 | `band-e2e` plus an archive commit (same files) |
| `review/facade-assessment-native-sol` | 3 | Opening proposal adjudication, review gallery, 5 native review pairs (different tip of 2 commits that are also in the chain) |
| `codex/reconstruction-sol-20260913-100641` / its backup | 6–7 / 1404 | 280 files: reconstruction workbench review lane, offline source-space evaluation, "thousand-building extraction" scripts, `scripts/city-appearance/fidelity/*` |
| `feat/district-rectification-sol` | 1 / 1159 | Resumable batch selection and rectification of district frontages (6 .mjs files, +237 lines) |
| `feat/wall-colour-expanded-sol` | 2 / 1198 | Data only: 200 reviewed wall-colour sample crops plus conflict resolutions (3.5k lines of JSON) |
| `fix/appearance-residency-sol` | 1 / 1200 | 7-line change keeping study meshes resident through camera updates (`vector-map.js` and 4 study browsers) |

On main, the `src/canalRecall/facade/*` modules the brief names come from mixed authorship. `ROOFLINE_FROM_PHOTOS_PLAN.md`
assigns G2/A-tasks to DeepSeek/Sonnet lanes, and `docs/plans/appearance-programme.md` gives Sol T2.4 (opening lattice)
and wall-colour reviews. They are assessed in §2 because the brief asks, without claiming they are all Sol's.

## 2. Each piece: what, how mature, overlap with today's pipeline, recommendation

Today's pipeline is `buildingRecipe/*` (component-named `CanalHouseIntent` → fit to 3DBAG facts → three.js compile,
gates, roof cleanup) plus `blockFace/*` (one intent per face, `sameAs`, cornice groups, party loops/slit closing,
rears, wall colour, `planInstancing`). It imports nothing from `facade/` except `evidence.ts` and `houseRecord.ts`
(both via `buildingRecipe/fit.ts` and `canalhouseRecipes.ts`). `gableTrim.ts` and `canalhouseRecipes.ts` also take
nothing from gable/gableFit/roofReconcile.

| Piece | What it does | Maturity | vs current pipeline | Recommendation | Effort |
| --- | --- | --- | --- | --- | --- |
| Sol Blender `building_lib` + IR (`BUILDING_IR.md`) | Per-owner recipe → Blender scene → GLB. Profile families (straight/triangular/stepped/spout/neck/bell/gambrel), `openingPatterns` ground presets (`shop`, `left-entry`, `right-entry`, `center-entry`, `two-entries`), row layouts by fraction, warehouse loading doors/shutters/hoists, cornice/pilaster plans, recessed entries, signage, source-derived 3DBAG massing with clipping | 45 public buildings (20 real, 25 synthetic), 166,582 tris, max 20 draws; py tests + validator; GLB/roundtrip/browser checks. **User rejected fidelity on 2026-10-02** (`building-library-photo-fidelity-recovery.md`). I looked at two renders against their photos (Lauriergracht 37, Rozengracht 158): right counts and form, wrong window heads/projections, missing cornice band, wrong brick colour | Duplicates the recipe pipeline in Python/Blender. Its vocabulary is broader for warehouses and ground presets, narrower for 19th-c. rows: no balcony stacks, bay windows (erkers), bands or keystone surrounds as first-class features (they exist in `FrontIntent`) | **Do not port the code.** Mine the vocabulary: `openingPatterns` and warehouse/hoist packs become ground-slot and crown-slot presets in the type layer (§4) | 0.5 d to transcribe |
| `buildingLibrary{TileBatching,RenderChunks,Viewport,ViewportStreaming,TileLoader}.ts` (backup only) | Per-material static batching of many owners' GLBs into tile chunks; viewport selection with distance hysteresis, nearest-first priority, resident triangle and byte budgets, cancel/swap without losing a good resident | ~250 lines TS. Measured 142 → 6 draws on 11 owners (+6.6 % payload); 20-owner fine chunks peak at 19.5k resident tris with a 20k budget; 16 camera cases, 714 picking checks (Sol's reports, not re-run here). No production hookup | Street chunks already merge per material per face; this adds **budgets, hysteresis and cross-chunk streaming**, which block-face chunks lack once there are hundreds of faces | **Port the viewport/budget logic** (not the tile format) as a typed module beside `streetChunks/`, when district-scale instancing (§4.4) lands | 1.5–2 d |
| `scripts/review/classify-block-candidates.ts` + `global-budget.mjs` scoped continuation | Sends a strip plus an ID overlay to a cheap VLM, which may only assign roles to *existing IDs* (no coordinates; exact-ID coverage enforced; abstains on invalid output); bounded calls under a global USD budget | Tested (3 tests); bounded runner; no accuracy measurement | Nothing equivalent. Block-face intents are authored by hand or VLM without this contract | **Reuse the contract** for type assignment: the detector proposes module IDs and types, and the VLM may only confirm, reject or relabel by ID (§4.2) | 0.5–1 d |
| `openingProposalAdjudication.ts` (+ review gallery) | Merges opening candidates from several lanes with evidence type (source-observed / model-proposal / procedural-inference), door/window conflict rules | Tested; 5 native review pairs; opt-in, never used downstream | Overlaps `facade/openingMerge.ts` + `openingLattice.ts` on main | Keep the evidence-type idea for the rhythm gate. Do not port separately | — |
| `componentGeometry.ts`, `balconyAssembly.ts`, `awningAssembly.ts`, `facadeTextureDemo.ts` | Cut image-space window/door/balcony boxes into **photo-textured 3DBAG wall meshes** (polygon clipping, recess, linked balcony slab/rail, awning) | Tested (~190 lines of tests), demo only | Different approach (textured LoD2.2 walls vs procedural recipes). Recipes already have balconies/awnings/shopfronts | **Discard for the recipe pipeline.** Keep the branch as reference if a photo-texture LOD fallback is ever wanted | — |
| `headOnRoofRepair.ts` | Silhouette roof repair: first non-sky row per column, spike rejection | 1 test, demo-only | Duplicates `facade/stripRoofline.ts` (consensus, mask + luminance) and `buildingRecipe/roofCleanup.ts` | **Discard** | — |
| SVG/vector pilot, OccFacade baseline, Banana Lite/Pro, GPT effort | Image-model facade reconstruction and segmentation experiments | Carefully receipted. **Nothing accepted**: OccFacade "useful proposals, not accepted"; vector pilot "no general solution earned expansion"; GLM 5.3 structured output was the most promising coarse candidate | — | **Discard the code; keep the conclusions** (§7): image models do not yet give reliable bay geometry; use them for ID-level classification only | — |
| `codex/reconstruction-sol-*` | Reconstruction review workbench, offline source-space evaluation, thousand-building extraction | Superseded by the block-face review sheet and gates | — | **Discard** | — |
| `feat/district-rectification-sol` | Resumable batched frontage selection and rectification across a district | Small, 1 test | `block-face/intake.ts` does one face. A district survey needs batching | Fold its resumable-batch pattern into a future multi-face intake driver | 0.5 d |
| `feat/wall-colour-expanded-sol` | 200 reviewed wall-colour crops plus conflict resolutions | Data | `blockFace/wallColour.ts` and the palette have no per-type colour gold | **Merge the data** as gold for palette variants per type | 0.25 d |
| `fix/appearance-residency-sol` | Keep study meshes resident | 7 lines, 1,200 commits behind | Probably stale | Check against current `vector-map.js`, else discard | 0.25 d |
| main `facade/gable.ts` + `gableFit.ts` | Classify a gable type from a roofline; least-squares fit of a parametric template | gableFit tested; owned by **another lane** that is wiring them into block faces now | Exactly the **crown-variant** signal the type layer needs (§4.2) | Consume that lane's output. Do not duplicate | — |
| main `facade/stripRoofline.ts` | Roofline from a rectified strip (mask + luminance consensus, provenance) | Tested; roofline-eval tooling | Not used by `blockFace`. Strips from `block-face/intake.ts` are exactly its input | Use it as the crown-silhouette feature for type detection | 1 d to wire into the detector |
| main `facade/openingLattice.ts` | Imputes missed openings from storey-row rhythm | Tested; evaluation script | Not used by `blockFace` | Use as the **rhythm check** behind a type assignment (bays × rows per module) | 1 d |
| main `facade/blockFaces.ts` | Collinear touching-wall chains per street side | Tested; only `scripts/review/check-blockfaces.ts` uses it | Duplicates `blockFace/discover.ts` (which works on BAG/3DBAG party walls) | **Discard** (or use only as a cross-check) | — |
| main `facade/facadeBands.ts` | Ground-floor colour band detection | `FACADE_BANDS_REPORT.md`: strict 11/46, then 11/46, then 6/46; never good | — | **Do not use** | — |
| main `facade/dominantWallColour.ts` | Dominant wall colour by coherent cluster | Tested; used by measurement scripts | `blockFace/wallColour.ts` takes palette names from intents | Measurement source for type palette variants | 0.5 d |
| main `facade/roofReconcile.ts` | Additive gable screen when 3DBAG is too low at the facade | Tested; roofline-eval only | Overlaps `buildingRecipe/roofCleanup.ts` / `gableTrim.ts` | Keep as a measurement. Not in the build path | — |
| main `facade/facadeMeshCompiler.ts` | Point-cloud box/mesh compiler | Tested; point-cloud scripts only | Unused by the recipe pipeline | Out of scope | — |

## 3. What the two pilot streets look like (strips viewed)

Both strips were produced by `scripts/block-face/intake.ts` in this worktree. They are archived with provenance in
`/Users/blackmad/Code/map-recall2-source-data-wt/bilderdijk-faces/models/{nassau-162289,clercq-236681}/` and are not
committed here.

### Nassaukade 318–300, west side (2024-11-29), face `nassau-162289`

The full face 327–300 is rejected by `compileChunk` (the frontage bends more than 11°), so the intake is bounded
318→300. Facade rhythm read from the strip:

| Type (by eye) | Pands (house numbers) | Width | Body | Ground | Crown variants |
| --- | --- | --- | --- | --- | --- |
| **B "stucco-cornice pair"** | 318, 317, 316, 315 | 5.96–6.05 m | 3 bays, 3 upper storeys, centre balcony stack (3), white entablature with brackets, keystone/decorated heads | Souterrain plus bel-etage: 2 arched windows plus an arched door bay with stoop. **Door alternates sides: mirrored pairs** (317, 315 mirror 318, 316) | One shared *pair* crown: a big double dormer straddling the 318/317 and 316/315 party walls. The crown belongs to a 2-pand pair module, not to a house |
| **A "white-banded brick, 3 bays"** | 310, 309, 308, 307, 306, 305 | 6.24–6.37 m | 3 bays, 4 upper rows, white horizontal bands, white keystone surrounds, centre balcony stack | Souterrain plus bel-etage: arched windows plus arched door with stoop; door side alternates | **2 variants**: pointed-spire dormer (310, 308, 307, 305); Neo-Renaissance curved/stepped gable with chimney (309, 306) |
| **C "banded, door-left"** | 312, 311 (313 near) | 5.8–6.1 m | 3 bays, banded, centre balcony stack | Flat door left plus 2 windows, raised | Step gable (312) vs dormer (311, 313) |
| **D "narrow stucco-attic"** | 304, 303, 302, 301 | 4.3–5.8 m in BAG (visually equal) | 2 bays, 4 rows, white attic storey with brackets | Door plus 2 windows | Same dormer ×4 |
| singles | 314 (stepped neck gable, 2 bays), 304A (157131, 4.2 m neck gable), 313, 300 (corner shop) | | | | |

By eye: 16/20 pands are in a repeated type; 4 bodies; 1 pair module; mirroring on two types.

### De Clercqstraat 22–2, north side (2021-03-24), face `clercq-236681`

| Type (by eye) | Pands → modules | Body | Ground | Crown variants |
| --- | --- | --- | --- | --- |
| **E "dark brick, corbel cornice, 3 bays"** | 16–18 (one 17.9 m pand = 3 modules), 14, 12, 8–10 (one 11.8 m pand = 2 modules): 7 modules | 3 bays, 3 upper storeys, arched heads with stone keystones, centre balcony stack (absent on the leftmost module), corbel-table cornice | **Every one differs**: Manoto restaurant (spanning 2 modules), Burrito, Fuoco Vivo, ScooterCentre West, a florist | Square brick tower-dormer (16–18 ×2, 14), arched tower (12), stepped gable (8–10 ×2), none (16–18 left) |
| **F "stucco cornice, mansard"** | 6, 4, 2: 3 modules (5.4–5.5 m) | 3 bays, 3 upper storeys, white cornice band and surrounds, centre balcony stack | Bike shop (spans 6+4), pizzeria: shop glass with timber pui | Identical mansard with one central ornate dormer plus 2 small dormers |
| corners | 22 (153066, crenellated corner block, café), 116526 (4.2 m, corner at Nassaukade: chamfered corner, café) | | | |

Here the upper module is identical and the ground floor differs in every case. The house type must have
**separate upper and ground slots**, and a BAG pand is not the unit (one pand holds 2 or 3 modules).

### Automatic detection prototype (`scripts/research/detect-house-types.ts`)

For each house module (pands wider than 1.5 modules are split evenly) the prototype crops two bands of the strip:
the body (4.5–13.5 m) and the crown. It makes 16×40 normalised thumbnails, scores pairs by NCC (also against the
mirrored crop) and links modules at NCC ≥ 0.6 when widths agree within 0.4 m. It knows nothing about the ground floor.

```
nassau-162289: 20 modules
type A: 6 modules 6.24-6.37 m  156556 156555(m) 162089 162090(m) 166290 159934(m)      (= 310,309,308,307,306,305)
   crown variants 2: [310 308 307 305] [309 306]                                        (= spire dormer / gable: correct)
type B: 4 modules 5.96-6.05 m  165898 154241(m) 162368 164663(m)                        (= 318,317,316,315 with mirrored pairs: correct)
type C: 2 modules              162083 161701                                            (= 312, 311; 313 scores 0.35-0.44)
coverage 12/20  (misses D: 304/303/301 score 0.57-0.66 but BAG widths 4.3/4.8/5.8 m fail the width test)

clercq-236681: 12 modules from 9 pands
type A: 7 modules 5.91-6.15 m  236262/1-3 158603 159182 236681/1-2                       (= E: correct, incl. multi-module pands)
type B: 3 modules 5.42-5.53 m  157618 156454 156960                                     (= F: correct)
singletons: 153066 116526 (the two corners)          coverage 10/12
crown split: [236262/1] vs the rest, so it does NOT separate step gable from tower dormer
```

The bodies match my reading on both streets, including mirror detection and pand splitting. Two failures are
instructive. First, BAG pand spans do not equal visual house modules on Nassaukade 304–301, so the width check
needs visual party-wall evidence (pilaster/downpipe columns), not BAG spans. Second, thumbnail NCC cannot classify
crowns, so the crown slot needs a silhouette classifier: `stripRoofline` → `gable.classifyGable`, which the other
lane is wiring.

### Sharing measured on the 15 authored faces (`scripts/research/upper-module-sharing.ts`)

| Face | Houses | Whole-house shared (today) | Upper (ground removed) shared at size | Body (crown removed) shared | Chunk tris | Draws (chunk primitives) |
| --- | --- | --- | --- | --- | --- | --- |
| marnix-124-138 | 8 | 6 | 7 | 7 | 14,943 | 9 |
| marnix-c | 9 | 8 | 8 | 9 | 17,209 | 6 |
| bilder-080336-090492 | 4 | 0 | 4 | 4 | 6,157 | 10 |
| bilder-233645-236975 | 3 | 0 | 3 | 3 | 7,038 | 10 |
| bilder-236022-167243 | 7 | 0 | 2 | 2 | 14,673 | 25 |
| other 10 bilder/utrechtse/wallen faces | 53 | 0 | 0 | 0 | 106,137 | 6–43 each |
| **total** | **84** | **14** | **24** | **25** | 166,157 | |

The individual per-house GLBs of marnix-c have 54 primitives; its merged chunk has 6. That is why instancing has to
justify itself on bytes and memory, not draws, until it spans many chunks.

## 4. Design: a house-type layer for street surveys

### 4.1 Units: module, slots, type

- **Module**: one repeated house front along the frontage. A BAG pand holds 1..n modules (De Clercqstraat 16–18 = 3).
  A type may also be a **pair module** (Nassaukade 318/317: one crown straddles the party wall). Modules come from
  the detector plus the author, never from BAG alone.
- **Slots** (built and shared separately, assembled per module):
  - `body`: upper storeys between the shopfront/bel-etage line and the cornice top. Bays, rows, balconies, bay
    windows, bands, surrounds, cornice. Shared within a type and placed with optional mirroring.
  - `crown`: everything above the cornice line (gable/neck/step/bell, dormers, spire, finial, mansard face, ornament).
    A named variant within the type.
  - `ground`: ground storey (+ souterrain/stoop). On a residential row it is a named variant within the type
    (door left/right). On a shop street it is **per house**: today's `ShopfrontIntent`/`GroundFrontIntent` plus sign
    text. Never instanced when it carries a sign.
- **Type**: a body plus its admissible crown and ground variants, palette variants, and the fitted size range it
  can be stretched over.

### 4.2 Detection: photo + BAG → proposed types (typed, staged, reviewable)

```ts
// proposed: src/canalRecall/blockFace/typeDetect.ts (pure; the CLI adds sharp I/O like scripts/research/detect-house-types.ts)
export interface ModuleSpan { id: string; pandId: string; x0M: number; x1M: number; split: 'bag' | 'even' | 'visual' }
export interface ModuleFeatures {
  module: string;
  bodyThumb: Float32Array; crownProfile: (number | null)[];      // stripRoofline column heights, 0.1 m
  rows: number; bays: number;                                     // openingLattice on the body band
  gable?: {type: string; fitError: number};                       // from the gable lane's classifyGable / gableFit
  ground: 'shop' | 'stoop-bel-etage' | 'door-windows' | 'unknown'; // BAG gebruiksdoel + OSM + shop-glass ratio
}
export interface TypeProposal {
  type: string; modules: string[]; mirrored: string[];           // mirrored relative to the first member
  crownVariants: {variant: string; modules: string[]}[];
  evidence: {minBodyNcc: number; widthSpreadM: number; rhythm: string};  // e.g. "3x4 bays x rows on all members"
}
export function proposeTypes(spans: ModuleSpan[], features: ModuleFeatures[], opts?: {ncc?: number; widthTolM?: number}): TypeProposal[];
```

Pipeline:

1. Run `block-face/intake.ts` as today. Get modules from the BAG spans, then split them by visual party walls:
   vertical continuous columns (pilasters, downpipes, joints in band courses) found in the strip gradient. This fixes
   Nassaukade 304–301.
2. Features per module: body NCC (as in the prototype) plus `openingLattice` rows × bays. A type requires equal
   rows × bays on all members, which is the rhythm gate the quality bar asks for. Crown silhouette comes from
   `stripRoofline` and is classified by the gable lane's `classifyGable`/`gableFit`.
3. Connected components give `TypeProposal[]`, written to `staging/block-face/<face>/types.json` with a contact sheet.
4. Optional VLM check using Sol's **ID-only contract** (`classify-block-candidates.ts`). The model sees the strip
   with module IDs and may only confirm, reject or move an ID between proposed types, never invent geometry. It
   runs under `global-budget.mjs`.
5. The author confirms and writes the type once (4.3). Nothing is published from detection alone.

### 4.3 Authoring and placement (extends `BlockFaceIntent`, compiles to today's `CanalHouseIntent`)

```ts
// proposed: src/canalRecall/blockFace/houseType.ts
import type {FrontIntent, PaletteIntent, ShopfrontIntent, GroundFrontIntent} from '../buildingRecipe/intent.ts';

type CrownKeys = 'gable' | 'crownCap' | 'crownCapSpan' | 'crownCapRise' | 'crownAt' | 'crownBays' | 'crownRise' | 'crownSteps'
  | 'crownFinial' | 'atticWindows' | 'atticShape' | 'dormers' | 'dormerStyle' | 'gableOrnament' | 'roofFront' | 'crownGroups' | 'tower' | 'hoist';
type GroundKeys = 'shopfront' | 'groundFront' | 'doorBay' | 'basement' | 'tallGround' | 'shutters';
export type BodyIntent = Omit<FrontIntent, 'id' | 'street' | 'share' | CrownKeys | GroundKeys>;
export type CrownIntent = Pick<FrontIntent, CrownKeys>;
export type GroundVariant = Pick<FrontIntent, 'doorBay' | 'basement' | 'tallGround' | 'groundFront' | 'shutters'>;

export interface HouseTypeIntent {
  schemaVersion: 1; kind: 'house-type';
  id: string;                                   // 'nassau-1890-banded-3bay'
  modulesPerUnit: 1 | 2;                        // 2 = pair module (shared crown over the party wall)
  fit: {widthM: [number, number]; storeys: number[]};   // admissible stretch; outside it the type does not apply
  body: BodyIntent;                             // written ONCE
  crowns: Record<string, CrownIntent>;          // 'spire-dormer', 'neo-ren-gable', 'pair-double-dormer'
  grounds: Record<string, GroundVariant>;       // 'stoop-door-left'; shop streets usually have none (per house)
  palettes: Record<string, Partial<PaletteIntent>>;    // 'red-brick-white-bands', 'dark-brick'
  evidence: {face: string; modules: string[]; citation: string}[];   // strip refs; grows as the type is reused on more faces
}

export interface TypedHouse {           // a third option in BlockFaceHouse, beside `design` and `sameAs`
  type: string;                         // HouseTypeIntent id (may live in another face's folder or a shared catalogue)
  modules?: number;                     // modules this pand holds (De Clercqstraat 16-18: 3); becomes FrontIntent.repeat
  mirror?: boolean;                     // door/crown side flipped; becomes instances.mirrorIntent
  crown: string | string[];             // one variant, or one per module
  ground: string | {shopfront: ShopfrontIntent} | {groundFront: GroundFrontIntent};  // shop streets: per house
  palette?: string;
  overrides?: Partial<BodyIntent>;      // escape hatch, e.g. no balcony on module 1; reported as a type deviation
}
```

`houseIntents()` resolves `TypedHouse` into a normal `CanalHouseIntent` (body + crown + ground merged, `repeat`/mirror
applied). Fitting, compile, gates and review stay unchanged. Types live in
`scripts/block-face/types/<type>.json` once they are shared across faces.

**Nassaukade** (residential, varied crowns): types A, B (pair), C, D. Variation parameters are `mirror`, `crown`
(spire dormer / gable / step), `ground` (stoop-door-left/right) and palette (red vs brown brick). 4 types and about
5 crowns cover 16/20 pands; 314, 304A, 313 and the corner 300 stay ordinary per-house `design`.

**De Clercqstraat** (shop street, uniform uppers): types E and F. Every house carries `ground: {shopfront: …}` with
its sign. E needs `modules: 3` / `modules: 2` on the multi-module pands and a per-module crown list
(`['none','tower','tower']`, `['step','step']`). Corners 116526 (Nassaukade end, chamfered) and 153066 are their own
`design`, not types. A chamfered corner is a two-front intent and is never instanced.

### 4.4 Rendering: generator reuse first, real instancing second

**Stage 1, generator reuse (no loader change).** Compile each house from the type as now, into the merged face chunk.
This delivers the authoring and consistency win immediately and keeps draws at about one per material per chunk.

**Stage 2, content-hash instancing (measured before shipping).** Do not trust intent equality. After compile, cut
every house into its body / crown / ground slot submeshes in the frontage frame (`instances.ts` frame: +X along the
frontage, +Z outward). Hash the quantised vertex/index buffers. Equal hashes share. This is safe against the
per-house geometry changes the block-face compiler makes:

- party clipping at oblique party walls (`partyClip`), slit closing, joint snap and cornice snap all change geometry,
  so hashes differ and the house falls back to the merged chunk;
- rears (`blockFace/rear.ts`) and party-wall loops (`partyLoops.ts`) are never instanced;
- gates, the interference check and the GLB audit run on the un-instanced compile exactly as today, and instancing
  is a pure re-encoding afterwards. Add one gate: decoded instanced chunk ≡ merged chunk (triangle count and bbox per
  pand within 1 mm).

Chunk format: the writer (`streetChunks/gltf.ts`) emits shared slot meshes on nodes with `EXT_mesh_gpu_instancing`
(three's GLTFLoader turns them into `InstancedMesh`), plus `extras.instancePands[]` so picking maps
`instanceId → pand`. Per-pand procedural suppression keeps working from the chunk's pand list. Palette variants use
`instanceColor` only if `recipeLook` slot materials multiply by it. Otherwise each palette is its own shared mesh.

Loader change (integrator-owned `signature-landmarks-source.js`): in `sharedFrame` mode, accept instanced nodes and
extend `pandIndexForFace` to `(object, faceIndex, instanceId)`. Two gotchas:

- **Mirrored instances.** `InstancedMesh` does not flip front faces per instance (the existing per-clone
  `scale.x = -1` trick in the loader relies on the object determinant). Mirrored members need their own instanced
  node with mirrored geometry, or `side: DoubleSide` on that material.
- Instanced picking must keep the per-pand highlight. Highlight via `setColorAt`, or swap the picked instance into
  a temporary clone.

**Expected numbers.** About 2,000 tris per house from the authored faces (12,102 / 6 on bilder-164451, 14,943 / 8 on
marnix-124-138). The body/crown/ground split (~60/15/25 %) is an assumption to measure.

| Nassaukade 318–300, 20 houses | Merged chunk (today) | Stage-2 instanced |
| --- | --- | --- |
| Stored triangles | ~44k | ~28k (11 unique bodies, ~8 crowns, 20 grounds), about -35 % |
| Draws | ~8–12 (one per material) | ~25–30 (3 shared types × ~5 materials + residual chunk). **More draws** |
| Bytes | ~300 kB gz scale (marnix-c: 254 kB gz for 17k tris) | about -30 % |

At district scale (say 400 faces, 30 types) a merged layout needs ~400 × 8 = 3,200 draws, and instanced shared types
need ~30 × 5 + residuals. That is where instancing wins draws too, together with a viewport/budget streamer (Sol's
`buildingLibraryViewport*` logic). So the order is: Stage 1 now, Stage 2 behind a measured gate once there are about
20 or more faces of typed houses.

### 4.5 Coverage estimate for the 19th-century belt

BAG pands built 1860–1915 in rough boxes, from the local `building-tiles` + `building-facts` (pands, not houses;
annexes included):

| Area | All pands | 1860–1915 |
| --- | --- | --- |
| Oud-West incl. Da Costa / Kinker / Bilderdijk / Nassaukade W | 6,722 | 4,692 |
| Staatslieden / Frederik Hendrik (De Clercqstraat N) | 3,761 | 2,202 |
| De Pijp | 6,068 | 3,742 |
| Oosterpark / Dapper | 4,156 | 2,304 |
| **total** | 20,707 | **~12,900** |

Estimate (uncertain, from two strips plus 15 authored faces). Speculative builders put up rows of 4–8 identical
fronts, and the same façade families recur across streets with different crowns and balconies. Measured row-local
repetition is 60–85 % of modules (Nassaukade 12–16/20, De Clercqstraat 10/12, Marnix 7–9/9). The Bilderdijkstraat
faces looked 0 % only because they were authored per house; by eye bilder-164451 is one body family with crown
variants. With 20–40 parametric types (body family × bays 2/3 × storeys 3/4/5, crown and ground variants as slots):

- generator reuse (type authored once, fitted per house): **~55–70 %** of 1860–1915 street fronts at block-face
  fidelity;
- exact geometry instancing (same fitted size within 0.3 m, square party walls): **~35–50 %**, because fitted widths
  vary by 0.1–0.6 m within a row;
- the rest is corners, ornate one-offs, modern infill and shop-street grounds, which stay per house.

The 20–40 type figure is a guess to test in the pilot: count how many new types each additional face needs.

## 5. Pilot proposal (first follow-up lane)

**Lane "street-types-pilot"** (domain logic plus content; port ≠ 4429). Faces: `nassau-162289` (Nassaukade 318–300,
strip 2024-11-29, archived) and `clercq-236681` (De Clercqstraat 22–2 north, strip 2021-03-24, archived; take the
south side too).

1. Visual module splitting (party-wall columns) and rows × bays from `openingLattice` added to the detector, made
   typed (`blockFace/typeDetect.ts`). Target: Nassaukade 16/20 and De Clercqstraat 10/12 modules typed, with no
   false merges. Named regressions: 318/317 mirrored pair; 309/306 gable vs spire; 16–18 = 3 modules; 304–301 as one
   type despite BAG widths.
2. `HouseTypeIntent` + `TypedHouse` in `houseIntents()` (Stage 1). Author types A, B (pair), C, D and E, F, then
   compile both faces through the unchanged gates. Review sheet: render against strip, bay by bay.
3. Measure Stage 2 offline: slot hashing, the instanced-vs-merged equivalence gate, and stored tris / bytes / draws
   for both faces. Hand the loader change (`EXT_mesh_gpu_instancing` + `instanceId → pand`, mirrored-instance
   handling) to the integrator only if the numbers justify it.
4. Test reuse: apply the Nassaukade/De Clercqstraat types to one unseen face (e.g. Da Costakade or the De Clercqstraat
   south side) and count new types needed.

Effort: ~3–4 days for 1–3, plus 1 day for 4. Expected: ~6 types for 32 modules on the two faces; ~44k → ~28k stored
tris on Nassaukade; draws unchanged in Stage 1.

## 6. Top 5 reuse candidates (for the street-type goal)

1. **Sol's ID-only VLM adjudication contract** (`scripts/review/classify-block-candidates.ts` + scoped
   `global-budget.mjs`). Use it as the type-assignment verifier over detector proposals. 0.5–1 d. Small, tested, and
   the right safety model (no invented coordinates).
2. **Sol's viewport/budget streaming** (`buildingLibraryViewport.ts`, `buildingLibraryViewportStreaming.ts`,
   batching ideas from `buildingLibraryTileBatching.ts`, backup ref only). Port as a typed module for district-scale
   chunk/instance streaming. 1.5–2 d. Only needed once Stage 2 or many faces ship.
3. **Sol's IR presets as slot catalogues**: `openingPatterns` (shop / left-entry / right-entry / center-entry /
   two-entries) → `grounds` presets; profile families plus warehouse/hoist/cornice packs → `crowns` and future
   warehouse types. 0.5 d to transcribe; no code port.
4. **`feat/wall-colour-expanded-sol` data + main `dominantWallColour.ts`** as palette-variant gold per type. 0.25–0.5 d.
5. **Main `openingLattice.ts` (+ Sol's evidence typing from `openingProposalAdjudication.ts`)** as the
   rows × bays rhythm gate behind each type assignment. 1 d.

Overlap note: crown-variant classification should come from `facade/gable.ts` + `gableFit.ts` via `stripRoofline`.
Another lane is wiring those into block faces, and this design only consumes their output.

**Discard:** Blender `building_lib` code (keep the standalone repo as reference), `componentGeometry`/balcony/awning
photo-texture assemblies, `headOnRoofRepair`, all image-model pilot code, the reconstruction workbench branch,
`facade/blockFaces.ts`, `facadeBands.ts`.

## 7. Conclusions worth keeping from Sol's experiments

- Image models (GLM 5.3, Gemini, DeepSeek, MiMo, GPT at several effort levels, Nano Banana) do not reliably give bay
  geometry. They merge rows, invent windows and drop balcony recesses. Use them for ID-level classification and keep
  the geometry in procedural recipes.
- OccFacade gives useful upper-window proposals but is unreliable on ground floors, and unusable for direct colour.
- Generated counts measure throughput, not likeness. The 2026-10-02 fidelity rejection of Sol's library (wrong
  roofs, stock windows, missing entrances) is the same failure mode the 2026-10-09 quality bar targets.

## Uncertain

- Body/crown/ground triangle split and the Stage-2 numbers are estimates. No instanced chunk was built.
- The coverage percentages are extrapolated from two strips and 15 faces. The 20–40 type count is untested.
- I did not render a side-by-side of Sol's builder against the current recipe for the same house. Sol's library
  covers Jordaan owners (no Bilderdijk/Marnix overlap), its GLBs are not in the archive, and the existing block-face
  strips are not in staging. I viewed Sol's own photo/render pairs for Lauriergracht 37 and Rozengracht 158 instead.
- Authorship of the main `facade/*` modules is mixed; "Sol's" is not asserted for them.
- Sol's measured numbers (142 → 6 draws, viewport checks) are quoted from its reports, not re-run.
