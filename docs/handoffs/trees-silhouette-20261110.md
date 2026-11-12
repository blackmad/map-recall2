# Lane T-shape: tree silhouettes that look like the trees (opus, 2026-11-10)

**User, 2026-11-10**, on the canal west of Piet Kranenbergpad: "wtf is up with these trees I don't think they
actually look like that?" The game draws a solid wall of 20–27 m tall narrow cylinders on long bare trunks.

## What the data says (municipal trees, tile 15-16825-10772)

- **West bank:** `Populus canadensis 'Robusta'` (23), `Populus nigra` (9), `'Italica'` (5), planted 1981, 16.5–27 m.
  `tree-typology.js:79` maps Robusta to `pyramidal`. In life it is a broad, open, ovoid crown with a fairly low crown
  base. Only `'Italica'` is columnar.
- **East of the path:** `Taxodium distichum` (45) and `Metasequoia` (29), 6–10.5 m, `conical-deciduous`.
- **Root causes, to verify:**
  - the archetype prior for Robusta;
  - the crown-base fraction for tall trees (it makes the bare trunks);
  - the crown radius not scaling with height;
  - identical instances in a dense row merging into a wall, with no per-tree size and shape jitter.

## Do

1. **Measure before changing anything.** For the 30 commonest species in the ride-priority buurten, plus every row of
   trees ≥ 15 m tall:
   - compare the game's silhouette with panorama crops (`pand-reference/select.ts`, open data only);
   - record crown width/height ratio, crown-base height, outline (columnar, oval, pyramidal, spreading) and density.
   - Jev is reliable for categorical calls, so it may label the outline class. Measure the ratios from the pixels.
2. **Fix by species and archetype.**
   - Correct the wrong priors: Robusta and other canadensis cultivars get a broad ovoid crown. Check every `pyramidal`
     poplar, willow and alder against photos.
   - Scale crown radius with height from the measured ratios.
   - Take crown base from the data's `heightClass`, not a fixed fraction.
   - Add seeded per-tree jitter in size, lean and lobe placement, so a row reads as separate trees.
   - Keep one silhouette per archetype × size class for draw-call cost, and measure the triangle and instance budget.
3. **Check that nothing obvious is missing.** Autumn and leaf state are out of scope.

## Gates

- Before/after ride frames at the Kranenbergpad canal (images 42 and 45 in session 88cbf34b), beside a panorama crop of
  the same row.
- A sheet of the 30 species, each with photo, before and after.
- Measured crown ratios fall within ±20 % of the photos for ≥ 25 of 30 species.
- Frame time is unchanged on the desktop aerial pose (`CANAL_PW_TIMING=1` for that measurement only).
- `check:canal` is green. Update the existing tree-typology checks (`scripts/check-tree-*.mjs`) where a prior changes,
  with the photo as the reason.

## Rules

- Use `/usr/bin/git` and `scripts/worktrees/new.sh`.
- Use a private `PW_PORT`, run browsers through `/tmp/canal-pw.sh`, and stop the server by PID.
- Archive the source crops in a sparse source-data worktree.
- Do not edit the integrator's hotspots.
