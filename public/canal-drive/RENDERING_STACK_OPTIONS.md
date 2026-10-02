# Rendering stack options (exploration branch, 2026-10-02)

Question: is MapLibre still the right base, or should buildings (or everything)
move to three.js or another library? Status: **desk research only, nothing
built.** The recommendation is a bounded spike, not a rewrite.

## What MapLibre does for us today

`vector-map.js` (about 2,300 lines) drives MapLibre 5 for: the CARTO basemap,
road/cycle/route lines, symbol labels with collision (POIs, neighbourhoods,
brand icons), GeoJSON sources with feature-state highlighting, and the
streamed building tiles as `fill-extrusion` layers. three.js is already in the
repo as *custom layers sharing MapLibre's GL context* (`detailed-buildings`,
`google-tiles`, `facade-recipe`), so the hybrid exists and works.

## Where MapLibre fights us (all seen this session)

- `fill-extrusion-pattern` has no mipmaps, so window grids shimmer at a slant.
- Pattern pixel ratio is an integer, so images are re-registered at each
  integer zoom, which re-lays-out tiles (hitch, flicker near a boundary).
- One pattern per wall, colour baked into the image: 48 images for 6 styles x
  8 colours instead of one tinted texture.
- Extrusions are prisms: no real roofs, no per-building UVs or atlases.

All four are building-rendering limits, not basemap limits.

## Options

| Option | Fit | Verdict |
| --- | --- | --- |
| **Keep MapLibre; render buildings in a three.js custom layer** | Fixes every item above: mipmapped, anisotropic atlas textures, tinting in a shader, real roofs. Reuses the z14 building tiles and the existing custom-layer plumbing. | **Recommended spike.** |
| deck.gl (interleaved with MapLibre) | Strong for data layers and meshes (`SimpleMeshLayer`, `ScenegraphLayer`). Adds a dependency and its own texture limits; no better than three for facade work. | Only if we add heavy data layers. |
| CesiumJS | Globe, terrain, 3D Tiles. Large bundle; we already stream Google 3D tiles through three. | No, unless we go globe-scale. |
| OpenLayers | Excellent GIS, no 3D. | No. |
| flywave.gl (three.js based, MVT + 3D Tiles + DEM, Apache-2.0) | Would replace the basemap too. 32 stars, 10 forks, early stage. We would rebuild labels, collision, styles and routing overlays. | Read its MVT-to-mesh code for ideas; not a base. |
| WorldExplorer3D (three.js game on OSM, custom source-available licence) | A game, not a library. Licence blocks reuse in a derivative product. | Ideas only, copy nothing. |
| Pure three.js for everything | Total control, but we lose the label engine, glyph rendering and vector basemap, the most expensive parts to rebuild. | No. |

## Proposed spike (branch `explore/rendering-stack`)

1. A three.js custom layer that takes the existing building tile features and
   builds one merged mesh per tile: walls with UVs from edge length and height,
   a trimmed-texture atlas per period style, per-instance tint, mipmaps and
   anisotropy on.
2. Same camera as the chase view; compare against the current extrusion path
   with the same four named locations (Rozengracht, Da Costakade, Centraal,
   Nassaukade).
3. Measure on a throttled phone: frame time, tile hitch, memory, shimmer
   (frame-to-frame pixel difference while riding).
4. Decide by the numbers. If it is not clearly better, drop it and keep the
   current layer.

## Open questions

- Highlighting by feature state (answer reveal) needs an id-to-mesh-range map.
- Occlusion with MapLibre labels in a shared depth buffer.
- Memory for a merged mesh across 9 z14 tiles.

## Spike results (built 2026-10-02)

Built as a standalone page, not wired into the game: `rendering-spike.html`
(`npm run build:rendering-spike`, query `?look=cartoon|photo&mode=aligned|repeat
&lat=&lng=&radius=&yaw=&pitch=&dist=&door=N`). Code: `src/canalRecall/wallBays.ts`
(layout maths, `scripts/check-wall-bays.ts`), `bayTextures.ts` (canvas-drawn
Amsterdam bays), `renderingSpike.ts` (three.js meshes from the z14 tiles).
Screenshots in `docs/rendering-spike/` (kept out of `public/` so they do not deploy).

**Alignment works.** Each wall gets a whole number of bays across (about 5.2 m
each, stretched at most a few percent) and a whole number of storeys up, with
the ground floor separate and a front door in one bay per house (every second
or third bay on a terrace). `repeat` mode (today's behaviour) cuts panes at
wall ends and at the roofline on the same buildings; `aligned` never does.
395 buildings around Rozengracht, 2 tiles.

**Textures.** `photo` look: the repo's CC0 ambientCG `Bricks057` under drawn
sash windows (six-over-six), stone sills, soldier-course lintels, shutters,
fanlit doors and a plinth. `cartoon` look (asked for after "still drab"): flat
warm wall colours, thick outlines, chunky cream-framed windows with sky-blue
glass, teal/mustard/red/navy doors and shutters, wall colour baked into the
texture so glass and doors keep their own colours. Everything is drawn here;
no model or photograph is copied. Sketchfab and 3D Warehouse models were not
used: their licences (per-asset CC-BY or a restrictive Warehouse licence) and
file sizes make them poor to bundle, and a fitted per-wall texture is what the
game needs anyway. No image generator was available in this session.

**Costs and limits (not yet measured on a device).**
- Cartoon look: 113 draw calls and about 70 MB of bay textures (6 wall x 4
  accent colours x 3 kinds); needs an atlas or shader tint before it ships.
- Roofs are flat. Gables, which the game teaches with, are not in this spike.
- No highlighting, labels or basemap; no feature-state equivalent yet.
- Headless software WebGL only: frame time, shimmer and memory on a phone are
  the real test and are still to do.
- Mesh build for 395 buildings is trivial; merged-per-tile for thousands is the
  open measurement.

**Next if we continue:** (1) mount it as a MapLibre custom layer behind the
labels; (2) replace per-colour canvases with one atlas plus a shader tint;
(3) gables from `gable.ts`; (4) per-building wall data (door side, shopfront)
from the building-facts tiles; (5) shimmer measurement against the current
extrusion layer at the four named locations.
