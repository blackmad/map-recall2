# Lane: POI labels that fit the palette and the depth (presentation, 2026-10-13)

User 2026-10-13, desktop screenshot over the Damrak at ~250 m: "labels now
look really bad against our palette; also not sure they make sense to
always be on top of everything." What the shot shows: hundreds of white
sans-serif POI labels with a dark halo (shops, hotels, cafés, "Lovers Canal
cruises/Hop on Hop Off") painted over every roof and wall at full opacity,
no density cap, no occlusion, no fade with distance, drawn above the 3D
scene so a label hangs over a building that hides its POI. Inputs: the
MapLibre symbol layers in `public/canal-drive/js/vector-map.js` (style JSON,
`text-*` paint, `symbol-sort-key`, `text-allow-overlap`), the POI source
(`landmarkRuntime.ts`, the signature pins, the labelled-landmark rule in
`recallRuntime.ts` `_drawLearnedBridgeLabels`), `look/palette.ts`,
`docs/LOOK.md`, `docs/gameplay/loop.md` (the street under question must
never be revealed by a label; learned names earn their label). Lane owns the
label style and the label-source rules; ≤ 30 reported lines in
`vector-map.js` if the style is inline there (or move the symbol layers to
a typed `labels/` module and report the mount). Do not edit `game.js`,
`index.html`, `package.json`, bundles, `TODO.md`, `HISTORY.md`.

## Deliverables
1. **Style**: labels typed in the HUD face, ink from the palette (the
   plaque's warm dark on a thin paper halo, or paper text on the dark ink
   halo, test both on brick, slate, water and the white ground), size by
   class (landmark > museum/church > hotel/shop), uppercase small caps only
   for landmarks; a leader dot at the POI; the "89% new"/pin style of the
   destination card reused for the destination label.
2. **Density and depth**: a density cap by zoom (at 250 m camera height at
   most ~12 labels in view, chosen by the landmark score and the game's
   own list: destinations, quiz landmarks, learned bridges; shops and
   cafés only within 80 m of the rider); fade with distance; **occlusion**:
   a label whose anchor is hidden by a building (depth test against the
   shared frame's depth, or MapLibre's `fill-extrusion` occlusion when the
   label layer sits below the buildings in the style) is hidden or faded;
   collision so labels never overlap the plaque, the destination card or
   the prompt.
3. **Never reveal the question**: a street-name label never appears for a
   withheld name; POI labels that contain the street name under question
   (hotel "Damrak 1") are hidden while that question is open; add this to
   `check-recall-rules.ts` or the e2e.
4. **Shots** at the user's Damrak viewpoint, the Westerkerk at 1.7 m, the
   Dam from the air, Nieuw-West, before/after; a Playwright spec that counts
   labels in view at the Damrak viewpoint (≤ 12) and that none lies over the
   plaque.

## Checks
`npm run lint`, `npm run test:recall-rules`, `PW_PORT=<yours> npx playwright
test look-consistency labels --project=desktop` (new spec). Report: branch,
SHA, shots, label counts before/after, the `vector-map.js` lines, unfinished.
