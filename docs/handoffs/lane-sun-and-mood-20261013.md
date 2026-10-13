# Lane: a fixed sun and a less dour city (look, 2026-10-13)

User 2026-10-13: "the way the sun moves in our 3d world is weird and I'm
not sure how to describe it ... feels like it's moving with me? the whole
city is a little dark/dour." Inputs: `docs/LOOK.md` (art direction, the
city-look review's luma numbers), `src/canalRecall/rendererShared/lightRig.ts`,
`look/palette.ts`, `look/cityLook.ts`, the per-layer rigs still in
`signature-landmarks-source.js`, `player-vehicles-source.js`,
`inventory-trees-source.js`, `artis-animals.js`, `detailed-buildings-source.js`,
the MapLibre `setLight` for extrusions, the baked shade in the unlit
building shader (`threeBuildingMesh.ts`), tree/shadow blobs. Lane owns the
rigs, shaders and palette; ≤ 20 reported lines in `vector-map.js`. Do not
edit `game.js`, `index.html`, `package.json`, bundles, `TODO.md`,
`HISTORY.md`. Default-path pixels may change here (this is the fix the
user asked for) but every change must be shown before/after and measured.

## Deliverables
1. **Find the moving sun**: measure, with a Playwright ride turning through
   360°, whether the shading of a fixed wall changes with the rider's
   heading in (a) the default frame, (b) `?sharedFrame=1`, (c)
   `?cityLook=1`. Likely causes to check: a directional light parented to
   the camera or re-aimed from the camera position each frame; MapLibre
   `light.anchor: 'viewport'` instead of `'map'`; the baked shade computed
   from view-space normals; blob shadows offset from the camera. Fix so
   the sun is world-fixed (one azimuth/elevation from `lightRig.ts`, the
   same in every layer and in MapLibre), and add a test that the sun side
   of a wall is the same side at four headings.
2. **Mood**: raise the city's key and warmth within LOOK.md's bands — sky
   colour and fog by distance, a warmer sun, lighter ambient on the shade
   side, ground and pavement albedo (the klinker grey reads as wet
   concrete), water colour less teal-black, tree green less olive. Keep
   contrast so facades still read. Produce the same six spots (Dam,
   Westerkerk, Rijksmuseum, Bilderdijkstraat, Nieuw-West, a canal at 1.7 m)
   before/after, sun side and shade side, and a luma/saturation table.
3. **Shadows**: if the shared frame's sun shadows are what make the frame
   "feel like a game" (own-renderer spike), measure their desktop cost
   again on the fixed route with the fixed sun and say whether they should
   be on at the flip.
4. Write the result into `docs/LOOK.md` (sun angle, key, why).

## Checks
`npm run lint`, `npm run test:look`, `PW_PORT=<yours> npx playwright test
building-look look-parity look-consistency --project=desktop` (update
look-consistency baselines only for the intended mood change, and say so).
Report: branch, SHA, the moving-sun cause and fix, shots, numbers, the
`vector-map.js` lines, unfinished.
