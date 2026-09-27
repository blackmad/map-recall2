# Generated facade strips on 3DBAG — rendering pilot

User asked for a demo that turns the three successful continuous head-on Pro
strips into textures, details and features on actual 3DBAG geometry.

## Demo

`/canal-drive/facade-texture-demo.html` is an isolated interactive Three viewer.
Three street studies use cached 3DBAG LoD2.2 semantic wall/roof polygons, not
extruded photograph rectangles. Orbit, front and roof views expose geometry.
Four treatments share the same source mesh:

1. Original geometry with plain materials.
2. Generated raster projected onto selected front walls, with plain unseen sides.
3. Same texture plus local grayscale relief inferred from dark glazing.
4. Shallow raised frame bars derived from pixel-window candidates, mapped onto
   the actual wall using barycentric inversion of its UV triangles.

A photograph toggle compares the corresponding photo texture. This reuses the
source-plane registration; generated artwork may have moved individual features.
Relief is a shading effect. Raised bars are real added geometry but are not
measured window depths, and no holes are cut through the source building.

## Pipeline demonstrated

- Keep raw panorama, pose, rectified context plane, crop bounds and hashes.
- Bind actual BAG surfaces to that plane in RD+NAP coordinates.
- Map source-image coordinates to front-wall UVs, leaving roofs and other sides
  plain. Preserve source massing independently of generated silhouette changes.
- Use the generated strip as colour artwork. Mask connected white sky; do not
  paint sky onto mismatched gables or stretch edge pixels beyond the strip.
- Derive optional dark-glazing candidates locally, filtering tiny marks and large
  storefronts. Keep candidates distinct from verified openings.
- Add lighting-responsive relief or restrained raised frames for comparison.

This does not establish per-building identity acceptance for all neighbouring
frontages, exact source-to-generated registration, or inferred hidden geometry.
Source geometry is real; matching appearance still needs landmark checks.

## Better model outputs to test next

**Registration first.** Supply the photograph plus a numbered outline guide of
verified BAG wall boundaries, opening anchors and ground/eaves lines. Ask for
appearance only inside fixed panels, preserving pixel coordinates and silhouette.
Score correspondence before vectorization or publication.

**Unlit colour texture.** Ask for diffuse colour without black illustration
outlines, cast shadows, lighting gradients or baked glass reflections. Preserve
material bands, storefront frame colours and architectural hoisting beams. Remove
foreground objects, marking inferred areas separately. This avoids double-lighting
when the renderer adds illumination.

**Feature description.** Ask a vision model to label/group numbered window,
door, storefront and balcony candidates using native pixel bounds; return JSON
with shape, frame colour, opening type, visibility and confidence. Keep geometry
from pixel measurements rather than asking the model to redraw SVG coordinates.

**Separate depth.** Build shallow reveals/frames procedurally from approved
opening masks. Use class-specific defaults, marked as inferred. Do not infer a
balcony slab or doorway behind an occlusion solely to make the picture prettier.

These follow-up prompts are prepared proposals, not additional paid experiments.
The current demo uses existing Pro outputs and local processing only. It cannot
show that any new prompt improves the model until that experiment is run.

## Reproduction

- Detail assets: `node --import tsx scripts/review/extract-head-on-3d-details.ts`.
- Geometry assets: `node --import tsx scripts/review/export-head-on-3d-scene.ts`.
- Bundle: `npx esbuild src/canalRecall/facade/facadeTextureDemo.ts --bundle --format=iife --outfile=public/canal-drive/js/facade-texture-demo.bundle.js --minify`.
- Browser check: `node scripts/review/check-facade-texture-demo.mjs`.
- Assets: `public/data/facade-review-galleries/head-on-3d-v1/` (local generated
  evidence; binaries intentionally not committed per repo policy).

No default game bundles or appearance releases are changed.

## Result and remaining work

The three views cover3/5/6 actual BAG buildings and203/196/232 semantic surface
meshes, including roof-step walls. Ten/29/32 front-facing wall surfaces are
eligible for texture projection. Source-plane UVs remain unclamped; the shader
uses plain masonry outside the captured strip. Top-connected white sky is alpha
masked over a plain wall fallback rather than creating holes in the BAG mesh.
Bump gradients are suppressed outside the valid UV domain as well.

The local detector proposes50/62/40 upper-window rectangles. Only rectangles
whose four corners lie on one mapped wall and pass metre-scale size checks get
raised frames. Some are missed or split into panes; storefronts are deliberately
excluded from this simple detector. A feature is not accepted merely because it
can be rendered. Normal/bump relief does not create actual window recesses.

Roof fit now replaces the front 2 m with an illustrated silhouette and a roof
apron joining the retained BAG roof. The original meshes remain available via
Fit roofline. All three strips join 97/97 skyline samples to actual rear roof
surfaces, with no fallback joins. Generated profiles remain provisional; they
are not surveyed roof reconstructions.

A fourth study demonstrates a compact, agent-authored JSON recipe built locally
with Blender: real wall voids, inset glazing, two projecting balcony slabs with
railings, and simplified roof/trim. Its 8 material meshes contain 3,008 triangles.
This is a geometry construction test, not an image-to-3D model benchmark or a
photo-matched building. Metric dimensions/depths are inferred; roof details differ
from the reference and wall tessellation leaves subtle shading seams.

Next experiment: extract fixed image-space opening outlines and balcony groups
into this recipe, constrain scale with BAG, and compare front and side views.
Use a clean wall-colour pass so projected balcony/door perspective is not baked
back onto the geometry. Preserve measured/inferred provenance for each depth.

Recommendation: start with registered colour textures, then add selected verified
opening details at close range. Use the LLM for appearance and semantic grouping;
retain measured coordinates and deterministic geometry construction. At present,
raised frame candidates are less reliable than the full image texture.

## Verification

Browser check covers all three rows and four modes at1440px desktop and390px
phone (24 combinations), plus camera/texture/wireframe controls. All pass with
zero page/console/network errors or horizontal overflow. TypeScript passes;
geometry sanity checks confirm finite vertices, valid indices, wall-only UVs,
and source target BAG IDs present for all three studies. Source/result review
also exposed and fixed UV edge smears, sky paint and missing roof-step walls.
Remaining roofline/registration inaccuracies are recorded above.

Independent review also found an unfair unlit-versus-lit mode comparison. All
three textured treatments now use the same MeshStandardMaterial, roughness and
lighting; only bump/frame detail changes. Final24 browser checks pass again.

## Roof and Blender reproduction update

After exporting geometry, run `node --import tsx scripts/review/repair-head-on-3d-roofs.ts`.
Then run `blender --background --python scripts/review/build-facade-recipe-blender.py -- --recipe review-data/facade-assessment/blender-facade-recipe-v1.json --out public/data/facade-review-galleries/head-on-3d-v1`.
The Blender study is a separate scene JSON so roof regeneration does not erase it.
Current validation: 26 desktop/phone treatment checks, no browser errors or overflow;
roof toggle preserves camera position. Three roof geometry tests pass. Root and
Sol reviewed roof joins and the Blender prototype from multiple angles.

## Automatic component strip — 2026-09-27

Open `/canal-drive/facade-texture-demo.html?study=components` for the fifth study.
The hash-bound generated-image detector proposes 64 windows, 10 balconies and
one tentative door. The geometry compiler admits 63 openings and all 10 balconies;
it withholds both members of a conflicting window/door pair. Triangle clipping
creates actual wall apertures, inset textured panels, reveals and projecting
slabs/rails. Depth defaults are 0.12 m recess / 0.65 m projection, not measurements.
Ten uniquely aligned partial openings are extended behind railing to the detected
slab; these completions are explicitly recorded as inferred. No independent
aperture is invented for a standalone balcony.

The texture shader replaces detected painted balcony regions with sampled wall
colour on masonry and neutral glass on inset panels. This removes much of the
baked projection, but rectangular cleanup and missing lower mullions remain
visible. This is a working diagnostic pipeline, not a finished visual upgrade.
Ground-floor semantic identification, precise arches and source-photo fidelity
remain unresolved. There is no automatic door success claim from this strip.

Local Qwen3.5:9b free-coordinate extraction took 248.6 seconds and returned
invalid coordinate scale plus duplicate windows; it was rejected. A smaller
fixed-ID classification trial timed out and was not used. Neither trial incurred
API spend. Do not treat its elapsed wall time as a reliable throughput benchmark.

Reproduce after prior scene/roof steps:

```
node --import tsx scripts/review/extract-facade-components.ts --input=.cache/facade-assessment/banana-head-on-v1/strip1.png --receipt=.cache/facade-assessment/banana-head-on-v1/strip1.json --out=.cache/facade-assessment/banana-head-on-v1/auto-components-strip1
node --import tsx scripts/review/build-component-scene.ts
node --import tsx scripts/review/build-component-extraction-report.ts
```

The review report additionally uses cached Qwen receipts. Eight extraction/geometry
tests pass; 30 desktop/mobile browser checks pass. Root and Sol inspected
projection directions, inset surfaces and roof views. All output remains an
isolated demo. See `facade-component-output-contract.md` for alternative prompts.

Next comparisons: MAI-Image-2.6 editing for clean colour and separate masks versus
Nano Banana; TRELLIS.2 isolated facade/detail generation and existing-shape
texturing versus this deterministic geometry. Neither has been run here. MAI
image-edit endpoint verified through OpenRouter; TRELLIS official setup requires
Linux/NVIDIA >=24 GB. Keep shape/location accuracy separate from visual appeal.

## Reviewed entrance assembly — close-up regression

`?study=components&focus=entrance` opens the exact reported entrance. Entrance
repair toggles the old glass-box treatment and a complete assembly without
moving the camera. This is one reviewed generated-image fixture, not automatic
entrance extraction. Source hash, fitted outer arch, estimated depth and local
stone-post paint masks live in
`review-data/facade-vector-pilot/head-on-3d-v1/entrance-assembly.json`.

The wall is cut to the full convex arch; solid reveals, opaque rear door, paired
glazing and arched transom sit 0.65 m behind it. The depth is inferred. The outer
edge follows a quadratic fitted within the reviewed image region, with a 2 px
coverage margin to remove the old black outline. Two foreground stone posts
replace painted posts that the cut would otherwise bisect. Their dimensions and
material are simplified. Automatic ground-floor glass-box frames are withheld
in the repaired branch; their original appearance remains until assemblies are
classified correctly.

Root and independent Sol close-up review caught/fixed a remaining painted arch,
painted reveal, clipped stone posts and a camera that hid the threshold. The
revised front and both oblique views show a coherent provisional entrance.
Six geometry tests pass, including retained wall outside the polygon, recessed
panel depth, foreground posts and full-height camera focus. Six desktop/phone
view-toggle checks pass. Other balconies and awnings remain unresolved; this is
not a whole-facade or neighbourhood acceptance claim. No paid generation.

Rebuild with `node --import tsx scripts/review/build-component-scene.ts`;
review with `node scripts/review/check-entrance-assembly.mjs`.
