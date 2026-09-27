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

The largest visible mismatch is the roof silhouette. BAG's simplified triangular
or flat roof/front geometry cuts through the drawing's curved gables and dormers.
This remains visible in the demo rather than replacing source geometry with an
unverified image extrusion. A separate source-reviewed gable pass is needed.

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
