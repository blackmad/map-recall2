# Lane: a quieter desktop HUD, utilities on mouse wiggle (presentation, 2026-10-13)

User 2026-10-13, desktop screenshot over the IJ: "HUD still busy, revisit;
all that stuff in the bottom right can probably be hidden by default, show
on mouse wiggle?" Bottom right today: the Feedback button, the settings
gear, the help "?" and the build stamp ("build 922de98 · 2026-10-13"); bottom
left the minimap with the attribution line; top left the recall plaque
(street, neighbourhood, score, trip, "Learning near home"); top right the
destination card and the compass; centre top "RE-CENTER (R)". There is
already a tuck rule for the phone (`presentationRuntime.ts` ~530: utilities
stay out of the corridor while riding until a tap on the map) and a desktop
"tap on the map or a mouse move brings them back" comment in `index.html`
~611; the desktop screenshot shows them permanently visible, so the rule
is not reaching the desktop layout or the build stamp and Feedback button
are outside it. Inputs: `public/canal-drive/js/hud.js`, `hudLayout.ts`,
`src/canalRecall/game/presentationRuntime.ts`, `teachingSurface.ts`,
`scripts/check-bottom-hud-layout.ts`, `stories/canal-drive/CanalDrive.stories.tsx`
(HUD states), `docs/gameplay/loop.md`, the corridor rule in CLAUDE.md. Lane
owns the HUD modules, the overlay CSS for these controls (report the
`index.html` lines for the integrator to paste, do not edit it), Storybook
states; ≤ 10 reported lines in `game.js`. Do not edit `game.js`,
`index.html`, `package.json`, bundles, `TODO.md`, `HISTORY.md`.

## Deliverables
1. **Tuck the utilities on desktop**: Feedback, settings, help and the
   build stamp fade out 3 s after the ride starts and after every mouse
   movement stops; any mouse movement, a key press, or Escape brings them
   back for 3 s; hover keeps them. The attribution line under the minimap
   stays (licence) but may shrink to one muted line. Keyboard shortcuts
   for settings/help keep working while hidden.
2. **Review the rest**: propose and implement one pass of reduction, each
   item measured by the screenshot: "RE-CENTER (R)" only while the camera is
   off the rider; the plaque's fourth line ("Learning near home · ~6.0 km")
   folded into the setup/finish screens unless it changes during the ride;
   the destination card's "89% new" badge only on hover or in the finish
   story; the compass smaller. Keep the plaque's street line, the score and
   the distance, which are the game.
3. **Phone**: unchanged behaviour, verified in the stories.
4. Storybook states (desktop idle, desktop after wiggle, phone) and
   `scripts/check-bottom-hud-layout.ts` updated; a Playwright spec that the
   utilities are hidden 4 s into a ride and visible 200 ms after a mouse
   move; before/after screenshots at 1440×900 and 1920×1080.

## Checks
`npm run lint`, `npm run test:bottom-hud`, `npm run test:teaching-surface`,
`npm run build-storybook`, `PW_PORT=<yours> npx playwright test
storybook-visual mobile-overlays --project=desktop` (update baselines only for
the intended change and say so). Report: branch, SHA, shots, the `index.html`
and `game.js` lines, unfinished.
