# Lane: gameplay pacing — stop freezing the rider (2026-10-13)

Plan: `docs/plans/digital-twin-direction-20261013.md` §4 (R1). Lane owns
`src/canalRecall/game/*` pacing/quiz logic, Storybook states and e2e; it does
NOT edit `game.js`, `index.html`, `package.json`, bundles, TODO or HISTORY
(return a SHA and check output; the integrator rebuilds bundles and merges).

## Problem (measured)
- `recallRuntime.ts` `_openQuizPrompt` zeroes player speed (line ~818) and
  `public/canal-drive/js/game.js:462-469` returns early each frame while
  `quizPromptName` is set: every route question freezes the vehicle.
- A route question fires for every new unlearned name after 0.65 s / 8 m
  (`recallRules.ts advanceRouteQuiz`, constants in `constants.js:147-169`).
- Spaced repetition never chooses questions; it only skips known names.
- Plaque feedback (`quizFeedback`) never times out and blocks drive-by cards
  and postcards through the one-card rule (`presentationRuntime.ts:432`).
- Pacing is spread over `teachingSurface.ts`, `driveByTrigger.ts`,
  `postcardPacing.ts`, `BRIDGE_QUIZ_COOLDOWN`, transit cooldowns.

## Deliverables (typed, tested)
1. `src/canalRecall/game/questionBudget.ts`: pure module. Input: ride clock,
   candidate name events (new unlearned / due review / known), settings
   `maxAsksPerMinute` (default 2). Output: `ask | reveal-after-pass | skip`
   with priority due-review > new teaching-street names > rest. Unit tests.
2. Non-blocking route prompt: a `riding` prompt mode in `recallRuntime.ts`
   that does not zero speed; keys 1–4 / tap answer while moving; unanswered
   after 12 s or on leaving the street = `passed` grade (new grade in
   `answerPath.ts`, scored as exposure, never a miss); one-line reveal after
   leaving the street (never before: geographic-learning rule). Typed mode and
   bridge-arrival questions keep the freeze. Expose a small adapter so the
   integrator can flip `game.js:462` to skip the early return in riding mode.
3. `src/canalRecall/game/teachingPacer.ts`: single timeline that absorbs
   drive-by gap, postcard pacing, bridge cooldown, transit cooldowns and a
   6 s timeout for plaque feedback. Keep existing tests green; move their
   constants, do not change their values yet.
4. Cards auto-collapse to a title line after 8 s (presentation state only;
   sticky stays for user-clicked buildings).
5. Storybook: riding prompt desktop + phone + stacked with postcard
   (`stories/canal-drive/CanalDrive.stories.tsx`); extend
   `scripts/check-bottom-hud-layout.ts` for the riding prompt band.
6. e2e: seeded Anne Frank → Rijksmuseum ride asserts ≤ 2 prompts/min and
   player speed never forced to 0 by a route question (use a private
   `PW_PORT`).

## Checks
`npm run lint`, `npm run test:notice-cards`, `npm run test:canal-answer-path`,
`npm run test:bottom-hud`, `node --import tsx --test src/canalRecall/game/*.test.ts`,
`npm run build-storybook`, the new e2e. Report numbers (prompts/min before
and after on the seeded ride).
