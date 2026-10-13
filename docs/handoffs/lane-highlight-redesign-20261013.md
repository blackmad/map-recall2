# Lane: a better landmark highlight than the yellow blob (presentation, 2026-10-13)

User 2026-10-13, screenshot of a highlighted block at the Westermarkt:
"The yellow highlight is bad, come up with a better highlight." Today the
destination/selected landmark is painted flat yellow (emissive in the
default frame; the city-look review made it shaded under `?cityLook=1`,
`look/cityLook.ts`). Inputs: `signature-landmarks-source.js` (`setHighlighted`,
emissive path), `look/cityLook.ts` highlight variant, `tileBuildings`
`setHighlighted`, the building-types runtime highlight, `docs/LOOK.md`,
`docs/gameplay/loop.md` (what the highlight must communicate: "this is the
destination" / "this is the building you tapped", never the name of the
street under question). Lane owns the highlight code in those modules and
Storybook states; ≤ 20 reported lines in `vector-map.js`. Do not edit
`game.js`, `index.html`, `package.json`, bundles, `TODO.md`, `HISTORY.md`.

## Deliverables
1. **Three candidates, implemented behind `?highlight=a|b|c`**, each
   working for landmark GLBs, recipe/chunk meshes, instanced types and
   generic extrusions, in both frames:
   - a) **outline + ground ring**: the building keeps its real materials;
     a 2-px screen-space silhouette (stencil or back-face scaled pass) in
     the accent colour, plus a soft ring on the ground at the footprint
     and a thin vertical beacon above the roof that fades with distance;
   - b) **rim light + pulse**: fresnel rim in the accent, pulsing slowly,
     materials kept, plus the ground ring;
   - c) **desaturate the rest**: the highlighted building keeps full
     colour while buildings within 60 m drop saturation 40 % and the
     ground ring marks the footprint.
   Accent from `look/palette.ts` (not pure yellow; test an orange-coral and
   the game's HUD accent), with a colour-blind check.
2. **Shots** at the Westermarkt block, the Westerkerk, the Rijksmuseum and
   a terrace house in Oud-West, at the chase view and from the saddle,
   default frame and shared frame, day position; a contact sheet of the
   three candidates against today's yellow.
3. **Recommendation** with the cost (ms per frame, extra passes) and the
   one you would ship; Storybook states (desktop + phone) for the
   recommended one; `tests/e2e/highlight.spec.ts` that the highlighted
   building is found by pixel colour in both frames.

## Checks
`npm run lint`, `npm run test:look`, `npm run build-storybook`, the new
spec. Report: branch, SHA, the sheet, the recommendation, perf, the
`vector-map.js` lines, unfinished.
