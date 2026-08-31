# Building appearance enrichment

The runtime and mesh architecture consuming these observations is specified in
[`BUILDING_RENDERER_DESIGN.md`](BUILDING_RENDERER_DESIGN.md).

Status and implementation plan for turning government geometry and imagery into
honest, reproducible building appearance data. This document distinguishes a
measurement from a model guess: the renderer may use both, but the extract must
record which one it received and how confident it was.

## Where the repository is now

The current worktree already contains an end-to-end roof-colour prototype:

- `build-osm-building-appearance.ts` extracts separate wall and roof colours
  from OSM colour/material tags and records source fields.
- `build-satellite-roof-colours.ts` requests the open PDOK RGB orthophoto,
  caches 128 m JPEG tiles in `.cache/pdok-ortho`, erodes each OSM footprint by
  one pixel and writes the median interior RGB value when the sample is large
  and internally consistent.
- Amsterdam currently contains 10,578 appearance-backed building features.
  The local generated file has 5,778 aerial measurements and 4,800 records
  without an aerial source. The completed run cached 1,316 tiles (78 MB);
  its log recorded 3,388 existing roof values retained and 1,412 rejected
  samples.
- `vector-map.js` renders separate wall extrusions and roof caps, so sampled
  roof colours are visible instead of being copied onto walls.
- Focused colour extraction checks pass. The full appearance check still needs
  to be rerun outside the restricted shell: the `tsx` CLI failed while opening
  its local IPC socket, not on an assertion.

This is a successful prototype, not yet a dependable build stage. It is
Amsterdam-hardcoded, mutates the published GeoJSON in place, uses the moving
`Actueel_orthoHR` layer, samples only the first outer ring, assigns a building
to its centre tile even when the footprint crosses a tile edge, and has no
review artifact beyond aggregate counts. It is also not called by
`refresh-city-extract.sh`. The “keep OSM” check compares roof and wall values
rather than consulting `roofColourSource`, so its reported provenance is not
yet a trustworthy breakdown.

## Source hierarchy

Use the most direct, highest-resolution source available, and retain its date,
license and product identifier in a run manifest.

1. **OSM explicit tags** — `roof:colour`, `roof:material`, roof shape and
   building-part geometry. Explicit colour/material tags take precedence over
   imagery unless a review tool marks them stale.
2. **PDOK aerial RGB** — annual nationwide winter orthophotos at 8 cm (partly
   5 cm), CC BY. This is the primary roof-colour measurement for the
   Netherlands. Pin a named year/layer rather than `Actueel` for reproducible
   output.
3. **3DBAG LoD2.2 / AHN** — BAG-linked roof planes, slopes, ridges, heights and
   reconstruction quality. Use roof-plane polygons rather than whole OSM
   footprints to avoid courtyards and to sample sloped/stepped roofs correctly.
   3DBAG is CC BY 4.0; AHN point clouds and surface models are open government
   data.
4. **Satellietdataportaal** — repeated 30/50 cm panchromatic and 1.2/2 m
   multispectral acquisitions, with pansharpened RGB/NIR products and a STAC
   API. Use it for multi-date agreement, vegetation/green-roof detection,
   change detection and fallback for large roofs. Access requires a registered
   Dutch user and supplier-specific terms; do not publish source pixels or a
   trained model until the applicable agreement has been recorded as allowing
   that use. An irreversible per-building class or colour may qualify as a
   derivative under some agreements, but that needs an explicit license check.
5. **BAG and BGT** — authoritative BAG identity, footprint, construction year,
   status and use; BGT surface/object context around the building. These are
   useful features and validation signals, not direct evidence of colour.
6. **3D Geluid / 3D Basisvoorziening** — alternative government-derived BAG +
   AHN building parts and heights. Audit overlap and freshness before carrying
   both these and 3DBAG; prefer one canonical geometry pipeline.

### Is there a government building-material registry?

Not a public nationwide one found in the source schemas. The national BAG
`Pand` record has identity, status, geometry and original construction year;
Amsterdam's BAG+ adds name, situation and floor counts, but not roof or façade
material. BGT's `fysiekVoorkomen` describes surfaces such as roads and terrain,
not the construction material of each BAG building. 3DBAG/AHN reconstruct roof
geometry rather than material.

Government data can still supply strong labels and exclusions:

- Amsterdam publishes annual street panorama imagery and an API under CC BY
  4.0. This is the most promising government source for *measuring façades*;
  audit its image endpoints, capture geometry and ML/derived-data terms in a
  small pilot before bulk download.
- EP-Online publishes nationwide current energy-performance records (monthly
  bulk files, free API key). Public summaries are useful for building type and
  thermal-era features, but the public API is not a material registry; detailed
  construction assemblies in an owner's energy-label report are not generally
  public per-building labels.
- Amsterdam publishes a public-domain solar-panel/roof-potential layer. Use it
  to mask panels and validate roof slope/potential, subject to checking its
  freshness; it does not label roof covering.
- Permit drawings, monument descriptions and archives often state materials,
  but they are sparse documents requiring entity linking and text extraction,
  not a clean registry. They are best used as high-quality labelled examples.

Sentinel-2 (10 m RGB/NIR) is too coarse for normal individual roofs. It can
help at block scale but is not an honest per-building colour source.

## Phase 1 — make roof colour production-safe

Deliverable: a staged Amsterdam roof-colour candidate plus a review report; no
automatic overwrite of the published extract.

1. Parameterise city, input, output, cache, imagery layer/year and attribution.
   Cache original response bytes by source, layer, CRS, bounding box and size;
   write a manifest with URL/product, capture date where available, checksum,
   license and sampler version. Keep the cache out of git.
2. Join OSM features to BAG/3DBAG identities and LoD2.2 roof planes. Sample all
   polygon parts, respect holes, and fetch/stitch every intersecting tile with
   a small halo. Do not rely on a footprint centroid.
3. Convert pixels to a perceptual colour space, exclude deep shadow, blown
   highlights, vegetation (using CIR/NIR where available), solar panels and
   obvious roof furniture, then estimate a robust dominant colour per roof
   plane. Quantise the final renderer colour to a controlled palette so flight
   and JPEG noise do not create thousands of meaningless near-duplicates.
4. Emit `roofColour`, `roofColourSource`, `roofColourConfidence`,
   `roofColourObservedAt`, `roofColourMethod`, `imageryProduct` and rejection
   reasons. Preserve explicit OSM roof colour/material separately from the
   observation; precedence belongs in one documented resolver.
5. Produce coverage by source and rejection reason, a colour histogram, and a
   deterministic HTML/GeoJSON sample sheet stratified by roof size, shape,
   neighbourhood and confidence. Manually label at least 200 buildings before
   setting thresholds. Acceptance gate: no obvious footprint leakage in the
   audit sample and a predeclared colour-error target on the labelled set.
6. Run from the city refresh into a staging directory. Publish only after the
   existing extract checks, new provenance/coverage checks and a reviewed diff
   pass. A failed imagery service must leave the OSM/material fallback intact.

## Phase 2 — roof material and texture experiment

The first classifier predicts a semantic roof material, not an arbitrary image
filename. Map the predicted material and colour to a compatible, licensed
texture only after classification. The OSM Texture Library can seed the render
palette, but its entries have per-asset licenses and limited class coverage;
store author/license/real-world scale for every selected asset.

1. Define a small visible-from-above taxonomy: clay tile, slate/dark tile,
   bitumen, metal/zinc, glass, gravel, green/vegetated, solar-dominant and
   unknown. Keep façade classes out of this model.
2. Build georeferenced chips aligned to 3DBAG roof planes, with a footprint
   mask and context channel. Split train/validation/test by neighbourhood (and
   preferably acquisition date), not randomly by neighbouring buildings, to
   prevent spatial leakage.
3. Bootstrap labels from explicit OSM `roof:material`, then manually verify a
   balanced sample. Treat weak OSM labels as weak supervision, not ground
   truth. Record imagery supplier/license on every chip and keep restricted
   imagery out of distributable training bundles.
4. Establish non-ML baselines (colour + NIR + slope + BAG age/use), then train
   an Ultralytics classification model only if the labelled dataset is large
   enough. Calibrate probabilities and support abstention; `unknown` is a good
   result when the roof is occluded, tiny or atypical.
5. Evaluate per-class precision/recall, calibration, performance by roof size
   and age, and stability across dates. Ship predictions only above per-class
   thresholds, with `roofMaterialSource=model`, model version and confidence.
6. Render a representative route and compare flat colour, generic material
   texture and predicted texture for recognition, aliasing, download size and
   mobile frame time. Do not tile a photographic roof crop onto the mesh.

## Phase 3 — façade appearance, separately

Satellite/nadir aerial pixels do not normally observe façades. BAG construction
year, use and neighbourhood can provide a prior (for example, likely brick),
but that must be stored as `inferred`, never `measured`.

For actual façade material/texture, begin with Amsterdam's CC BY 4.0 annual
panorama API, then audit other open oblique/street-level government sources and
Mapillary/KartaView, including ML-training and derived-model rights. Match
visible façade planes to 3DBAG, account for viewpoint/occlusion, and start with
a manually reviewed landmark or one-block pilot. If licensing or reliable
geometry is unavailable, retain OSM material plus an age/use prior and abstain
from texture assignment.

## Recommended next run

Before training anything, repair the sampler and review 200 stratified roofs.
In parallel, register for Satellietdataportaal access and make a license/source
manifest for one Amsterdam scene, but keep PDOK 8 cm imagery as the production
colour source. The first decision gate is whether roof-plane-aware sampling can
reach reliable colour coverage; the second is whether verified material labels
are numerous and balanced enough to justify Ultralytics.
