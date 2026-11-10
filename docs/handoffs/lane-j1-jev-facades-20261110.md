# Lane J1 (spike): can Jev answer facade questions? (2026-11-10)

Model: opus, no turn cap (budget lifted 2026-11-09), base main a332381a9, Node/Python only, no browser. Worktree `/Users/blackmad/Code/map-recall2-worktrees/j1-jev-facades-20261110`, branch `lane/j1-jev-facades-20261110`.

## The user's word (2026-11-10): "sure do an exploration" on Jev for facades.
Jev (TypeSafe AI) is a typed-judgement model: many narrow questions about one input, answered as choice / yes-no ("noul") / ordinal score / box with probabilities, no prose. Jev 1.14 takes PNG/JPEG (280–1568 px per side) behind the header `TypeSafe-Danger-Zone-Images: true`; via OpenRouter model `typesafe/jev-1.13` or TypeSafe's API `jev-1.14.0`. An independent test on 48 COCO photos: yes/no 98–99 %, word-choice 98 %, picture-choice 96 %, ordinal score only 60–80 %, box IoU 0.85 but Box always returns a box (pair it with a yes/no), hedging in the 0.3–0.7 band, non-deterministic between runs, ~0.9 s and ~1,500 input tokens per photo with 12 questions ($0.042 per M input tokens, output free). Untested anywhere: counting, colour, buildings. The CLI is upstream at github.com/wuyoscar/jev-skill (`skills/jev/scripts/jev.py`); request/response shapes in its `references/api.md`. Read the API doc first; do not install the skill into the repo (a scratch copy outside the repo is fine).

## Key handling (hard rule, updated 2026-11-10)
- **Model:** TypeSafe directly, `jev-1.14.0`; no OpenRouter comparison. Image input is opt-in by API header; see https://docs.typesafe.ai/images (read it first).
- **Where the key lives:** the user exported `TYPESAFE_API_KEY` in their shell profile. This session's shell started before that, so run every call that needs the key from a fresh login shell, e.g. `zsh -lic 'node scripts/jev/run.mjs …'`. Read it ONLY from `process.env.TYPESAFE_API_KEY` / `os.environ`. Never open or grep `~/.zshrc` or any config for it, never search the filesystem for keys, never print, log or commit it, and never pass it on a command line (it would show in `ps`).
- **No caching:** the user will rotate the key after the spike. Don't cache it anywhere (files, env dumps, request logs, archived raw responses, headers in saved traces). Strip auth headers from anything you save.
- **If it's missing:** if `zsh -lic '[ -n "$TYPESAFE_API_KEY" ] && echo set'` doesn't print `set`, stop and comment on #326; do not look for the key.
- **Fail closed:** if any call errors on auth, stop; don't retry in a loop.

## Spike
1. Pick 50 pands we have hand measurements for (the kit's measured tint/glazing records and the register's gable for listed ones; mix canal houses, 19th-century rows, kit rows, shopfront ground floors). Use their existing panorama facade crops from the source archive (open data, already cropped; no new fetches); resize within Jev's limits.
2. Twelve questions per crop: choice gable {neck, bell, step, cornice, spout, plain}; choice finish {brick, painted brick, plaster, stone, mixed}; noul white frames; noul stone bands/speklagen; noul shopfront; noul basement entrance; noul dormer; bay count as picture-choice against five reference crops (1–5 bays) and again as a word choice; box door and box gable crown, each with a noul guard.
3. Run each twice (drift) on jev-1.14.0.
4. Score per question against our measurements and the register: accuracy, hedged share (0.3–0.7), drift, cost and latency; tune accept/review thresholds on our data; list the ten worst misses with crops.
5. Verdict: which fields Jev can own for the ordinary-house tiers (bar: ≥ 90 % on gable/finish/frames, bay count within ±1), the review-lane size at those thresholds, projected cost and runtime for the city.

No game data changes; scripts under `scripts/jev/`, outputs to staging and a report (`docs/reviews/jev-facades-spike-20261110.md`). Raw responses go to the source-data archive (memory: lanes archive to map-recall2-source-data via a dedicated worktree; commit there, the integrator pushes).
## Lane rules (binding)

- Work only in your worktree and on your branch. Never push to or merge `main`. Never edit `public/canal-drive/game.js`, `game-route.js`, `index.html`, `package.json`, lockfiles, any `*.bundle.js`, `covers.json`, goldens, `TODO.md`, `HISTORY.md`, `whats-new-notes.json`, `tests/perf/budgets.json` or published extracts under `public/data/extracts/` (stage new data under `public/data/extracts/amsterdam/staging/` and say so). The integrator owns those; put what they must do under INTEGRATOR TODO in your hand-back.
- Git: use `/usr/bin/git` for every git command (the `git` wrapper is broken). Never `git stash`. Commit as you go; end every commit message with `Co-Authored-By: Claude <your model> 5.5 <noreply@anthropic.com>`.
- Dev server: `echo <port> > .worktree-port` is done; start with `nohup env PORT=<port> npm run dev > /tmp/<lane>-dev.log 2>&1 &`. Stop it by its port's PID (`/usr/sbin/lsof -tiTCP:<port> -sTCP:LISTEN | xargs kill`), never `pkill`.
- Browser runs: exactly one Playwright run at a time on this machine, through the lock: `PW_PORT=<port> /tmp/canal-pw.sh npx playwright test <spec> --project=<desktop|iphone> --reporter=line`. The lock may hold you for 10–30 minutes while a gate runs; block on it with ONE long wait (timeout 1,800,000 ms), never poll in a loop and never give up on it. Run `npx playwright test` only through the lock.
- Shell quirk: some shells start with a stripped PATH; use absolute paths (`/usr/bin/python3`, `/usr/bin/wc`, `/opt/homebrew/bin/gh`).
- Measurement first: before changing anything, measure the thing you are about to change and write the number down; after, measure again. A claim without a number is not a result.
- Screenshots: clone or `git worktree add` the `blackmad/map-recall2-screenshots` repo (clone at `/Users/blackmad/Code/map-recall2-screenshots`; make your own worktree `/Users/blackmad/Code/map-recall2-screenshots-<lane>` on a branch, merge to its main and push). Put frames under `ui/<YYYY-MM-DD>-<slug>/`, each image ≤ 400 kB (JPEG q≈80, ≤ 1600 px wide), never rewrite a published file. Never add images to the game repo.
- Storybook: add desktop and phone stories for every new HUD/card state; `npm run build-storybook` must pass.
- Budget: at most 60 turns. If you run out of road, hand back what you have with honest status rather than guess.
- Hand back as a comment on your issue with these headings: LANE, MEASURED (before numbers), DID, NUMBERS (after), CHECKS (commands + exit codes), STORYBOOK, SPEC, STRIP (screenshot paths), WHAT'S NEW (a draft note: title, text, image paths), INTEGRATOR TODO (bundles to rebuild, tests to join, data to publish), OPEN. Then return the final commit SHA and a five-line summary as your final message.
