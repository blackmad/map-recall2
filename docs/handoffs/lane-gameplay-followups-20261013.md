# Lane: gameplay follow-ups after the riding-prompt merge (2026-10-13)

Context: `docs/gameplay/loop.md`, the 2026-10-13 HISTORY entry "Route
questions no longer freeze the rider", `src/canalRecall/game/{questionBudget,
ridingPrompt,teachingPacer,answerPath,recallRuntime}.ts`,
`tests/e2e/riding-pacing.spec.ts`. Lane owns `src/canalRecall/game/*`,
`src/canalRecall/recall-store/*` (or wherever `RecallStore` lives), the
route/via planner, presentation runtime for the finish card, Storybook
stories and e2e. Do not edit `game.js`, `index.html`, `package.json`,
lockfiles, bundles, `TODO.md`, `HISTORY.md`; report the exact edits the
integrator should make to `game.js`/`index.html`.

## Deliverables, in order
1. **`review-ride.spec.ts` regression** ("a due street off every landmark
   line is ridden as a via"): the seeded surprise ride (Artis Bibliotheek on
   2026-10-10, Fo Guang Shan He Hua Tempel on 2026-10-13 → Kazerne Zebra)
   plans with `dueOnPath: []`, detour 0 and no via although Avenhornstraat is
   due. Find why the via/stop planner drops the due street (seed drift? the
   due set? the detour cap?), fix it at the planner, pin the seed so the
   origin stops varying, make the spec pass without weakening it.
2. **`RecallStore.expose()`**: a `passed` name (prompt timed out or rider
   left the street) is revealed but not scheduled, so it is simply asked
   again later. Implement exposure scheduling in the store (a short first
   interval, counted as exposure not recall), with unit tests, and wire
   `answerPath.ts`'s existing `recallStore.expose?()` call.
3. **Per-minute budget as a setting**: `maxAsksPerMinute` is a field on the
   game; expose it in the settings panel (1 / 2 / 3 / off) through the
   existing hidden-select pattern (`tests/e2e/helpers.ts setHiddenSelect`),
   persisted like the other prefs, with a Storybook state and a bottom-HUD
   check row. Report the `index.html` markup the integrator should add.
4. **Portrait finish card ghost**: the `portrait-finish-card` Storybook
   baseline (414×896) shows a translucent second card layer behind the finish
   card; desktop is clean. Find the stacked/ghost element in the presentation
   runtime or the story's state, fix it, re-record only that baseline, show
   before/after.
5. **Riding-prompt styles**: `ridingPromptStyles.ts` injects CSS at runtime;
   move it to a stylesheet block the integrator can paste into `index.html`
   (report the block), keep the runtime injection as a fallback when the
   block is absent.
6. **Ferry edge**: a prompt opened just before boarding a ferry does not time
   out until the ferry ends (`_updateCanalQuiz` is skipped on a ferry); make
   the timeout tick independent of that skip, with a test.

## Checks
`npm run lint`, `node --import tsx --test src/canalRecall/game/*.test.ts`,
`npm run test:canal-answer-path`, `npm run test:bottom-hud`,
`npm run build-storybook`, `PW_PORT=4438 npx playwright test riding-pacing review-ride storybook-visual --project=desktop`.
Report: branch, SHA, the planner root cause, check output verbatim, the
`game.js`/`index.html` edits, unfinished items.
