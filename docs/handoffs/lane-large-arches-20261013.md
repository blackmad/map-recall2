# Lane: arched openings for the large tier + Entrepotdok and the four passing probes (2026-10-13)

Context: `docs/buildings-pipeline.md` "Large tier", the 2026-10-13 HISTORY
entries "Large tier landed" and "Large tier, second customers",
`src/canalRecall/blockBuilding/{compose,components,dissolve,panels,spec}.ts`,
`src/canalRecall/buildingRecipe/{fitLarge,largeCompile,largeGates}.ts`,
installed large recipes under `scripts/building-recipes/houses/`
(`kattenburg-wings-164938` is the latest template). Lane owns new components
in `blockBuilding/` (default compose output byte-identical:
`npm run test:block-kit-installed`) and new recipe folders. Do not write to
catalogues, `public/` models, `game.js`, `index.html`, `package.json`,
bundles, `TODO.md`, `HISTORY.md`; the integrator installs with
`install-large.ts --house=<id> --install`.

## Deliverables
1. **Arched-opening cutter**: the hole cutter in `dissolve.ts`/`compose.ts`
   cuts rectangles only. Add `arch: 'round' | 'segmental' | 'pointed'` to
   openings with a polygonal head (8–12 segments), reveals and a voussoir or
   brick-arch band option, so warehouses, churches and 19th-century schools
   can be large recipes. Unit tests on the dissolved mesh (closed, no open
   edges, hole area), and a golden on one synthetic wall.
2. **Entrepotdok warehouses** (pand 0363100012164981, 156 m wall, arched
   ground portals and arched upper windows; panoramas via
   `npm run pand-reference -- 0363100012164981` and
   `scripts/pand-reference/all-walls.ts`): author the recipe with the new
   cutter; name boards (the warehouses carry painted names of towns) via
   `signage.ts` where the crop shows them.
3. **The four probes that passed the shell baseline** in the dominant lane:
   0363100012084999 (pastel stucco block, rounded corner, roof pavilion;
   needs `corner: 'rounded'` or a plain chamfer), 0363100012186290,
   0363100012126319, 0363100012243844. Identify each (BAG address, OSM name),
   author what passes the gates, list what the panoramas show that the recipe
   lacks (ornaments and signs included, per the user's 2026-10-13 rule).
4. Report per building: pand, name, tris, gates, `audit:glb`, sheets, install
   command; component additions with before/after `test:block-kit-installed`.

## Checks
`npm run lint`, `npm run test:building-recipes`, `npm run test:fit-golden`
(`--write` for new houses only; no existing hash moves),
`npm run test:geometry-audit`, `npm run test:block-kit-installed`.
