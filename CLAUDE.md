# Map Recall development notes

This repository is an active product prototype. Work autonomously, preserve
working behavior, and leave it easier for the next session to continue.

## Working agreement

- Prefer TypeScript for new logic. Put reusable physics, routing, scoring, data
  transformation, and state logic in `src/` or typed scripts, then expose a
  small browser adapter when the legacy Canal Recall page needs a global.
- Do not expand large untyped files when a focused typed module is practical.
  Existing vanilla JavaScript is not a reason to add more untestable logic.
- Keep `public/canal-drive/ROADMAP.md` current in the same change that moves an
  item. It is the handoff/status board: **In progress**, **Next**, **Recently
  done**, and **Backlog** must reflect reality, including blockers and measured
  results.
- Make periodic, coherent commits after verification. Do not accumulate an
  entire long session into one opaque commit.
- Integrate completed branches back into `main` regularly. Before merging,
  inspect divergence and the worktree, use a normal non-destructive merge, run
  relevant checks, and push `main` so other sessions do not work from stale
  history.
- Preserve unrelated user changes. Never reset or discard a dirty worktree to
  make integration easier.
- For parallel agents, use a separate worktree and feature branch per agent.
  Give each agent an exclusive lane (presentation, routing, content/data, or
  domain logic) and a unique dev-server port.
- The integrating agent owns `game.js`, `index.html`, `package.json`, lockfiles,
  generated browser bundles/data, `ROADMAP.md`, merges, and pushes. Leaf agents
  should return a commit SHA and verification results instead of editing those
  shared integration hotspots.
- Commit a typed source module and its generated browser bundle atomically.
  Data generators should write to a staging path, report coverage/diffs, and
  publish into versioned extracts only after review.

## Verification

- Turn every reported geographic failure into a named regression location.
  Screenshots and street names are valuable evidence; pin the relevant OSM
  junction/bridge/cul-de-sac in `scripts/check-canal-car.ts`, the reachability
  audit, or the driving harness before considering it fixed.
- Run focused checks first, then broader checks proportional to risk. Common
  commands are `npm run lint`, `npm run test:canal-car`,
  `npm run test:reachability`, `npm run test:canal-streets`, and focused
  Playwright specs.
- `npm run check:canal` is the aggregate pre-integration gate for typed checks,
  named driving/reachability regressions, and the production Storybook build.
- Use Storybook for deterministic visual states that are expensive to reach by
  driving. `npm run storybook` serves the workbench and
  `npm run build-storybook` verifies it compiles. Add desktop and mobile states
  for every new HUD/card combination.
- Inspect both desktop and phone layouts. A screen that works only for the
  default guest route is not done; exercise signed-in, home-route, expanded
  advanced settings, long names, missing images, and stacked notices.

## Canal Recall product principles

- Geographic learning outranks arcade spectacle. The street/canal under
  question must never be revealed by the HUD or map before the answer.
- Keep the driving corridor visible. Trivia and neighborhood cards belong near
  the bottom, should be compact, and must not dominate navigation.
- Use English encyclopedia text in the English game. Preserve original foreign
  text and provenance so translation passes remain resumable.
- Amsterdam street mode is cycling in the presentation, even while it reuses
  the proven road-routing physics internally.
- Prefer bounded, explainable learning mechanics: spaced review, novelty-aware
  routing with detour caps, and bonuses for meaningful infrastructure such as
  separated cycle paths.
- Treat OSM topology and display geometry as imperfect data. At junctions,
  bridges, boundaries, and split same-name ways, use measured tolerances,
  hysteresis, deduplication, and regression coverage rather than assumptions.

## Current architecture notes

- Canal Recall is served from `public/canal-drive/`; much of its runtime is
  legacy canvas JavaScript. Shared typed modules are bundled explicitly by npm
  scripts.
- Amsterdam extracts live in `public/data/extracts/amsterdam/`. Avoid runtime
  dependence on third-party APIs when a cached/versioned extract is suitable.
- `ROADMAP.md` contains current unfinished work and design notes. Read it before
  choosing the next task, and update it before committing status changes.
