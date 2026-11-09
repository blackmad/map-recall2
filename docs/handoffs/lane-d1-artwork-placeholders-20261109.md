# Lane D1: no "An artwork." placeholder cards — a building tap shows the building (2026-11-09)

Model: sonnet. Worktree `/Users/blackmad/Code/map-recall2-worktrees/d1-artwork-placeholders-20261109`, branch `lane/d1-artwork-placeholders-20261109`, port 4738. Base: main (5003c7b5a or later).

## The user's word (2026-11-09, Free Ride): "why are so many things being reported as 'an artwork'?"
Shot: a card chipped BUILDING, titled "BRETTENSUITE 11/20", whose whole blurb is "An artwork." plus a "Research source" link.

## Cause from the data
`public/data/extracts/amsterdam/click-poi-info.json` carries every OSM `tourism=artwork` node with the kind label "an artwork" and empty address/url/description (the Brettensuite series alone is 20 nodes along the Brettenpad). A building tap resolves to the nearest click POI and labels it BUILDING. Find the resolution code (search `click-poi`, `clickPoi`, `_requestBuildingFacts`, `poi-click-selection`, `check-poi-click-selection`) and the card renderer before changing anything.

## Step 1 — count
Over the extract: click POIs whose blurb would be only the kind label, by kind (art, shop, food, …), as a table. Then how often a building tap resolves to a POI node rather than the pand: sample the tap resolution at 200 random pand centroids in the click set in Node (no browser) and count pand vs POI results.

## Then
(a) A tap on a building shows the building (pand facts); it resolves to a POI only when the tap is on the POI's own marker (its pixel radius, not "nearest").
(b) The chip says what the thing is (ARTWORK, SHOP, CAFÉ …), never BUILDING for a node. Dutch strings via the i18n catalogue (`src/i18n`), run `npm run test:canal-i18n`.
(c) A POI with nothing beyond its kind label gets no card: enrich it from `street-art.json` / Wikidata (artist, year, material; CC0 only, provenance kept) where a match exists, else leave it a plain label with no tap card. No "An artwork." placeholders anywhere.
(d) The "Research source" link on a card with no research is removed.
Typed logic in `src/canalRecall/` with unit tests; a data pass writes to `staging/` and reports coverage (how many artwork nodes enriched, how many label-only); the integrator publishes.

## Gate
Zero placeholder-only cards in the click set after the pass (a test over the extract, joined to a `test:*` script the integrator can add to `test:hud`); the Brettensuite nodes either enriched or label-only; building taps at five pands (one each: canal-house row, corner shop building, church, school, housing block) open the pand's card — measured in a Playwright spec on desktop and iPhone AFTER the integrator says "resume" (the user is playing on this machine). Before/after strip `ui/2026-11-09-d1-artwork-placeholders/` with the user's Brettensuite case.

## Addendum (judgement session, 2026-11-09): why Brettensuite 11/20 has no Wikipedia
Measured in the extracts: `street-art.json` already has the series article (Q21418963 "Beeldenroute Brettensuite", nl.wikipedia, English extract present) and per-piece articles for some pieces (n6037694335 "Brettensuite 17/20" → "Aarde (Brettensuite 17)", artist Herbert Nouwens), while 11/20 and most of the series carry only the OSM node (name, artist at best). Two causes: (1) the tapped card is built from `click-poi-info.json`, which never consults `street-art.json`, so even pieces with an article show "An artwork."; (2) `scripts/build-street-art.ts` matches an article only by the node's wikidata tag or by a Wikidata point within a few metres, so the series article, whose single point sits near 18/20, reaches one piece and the other nineteen inherit nothing.

Fixes for this lane: (a) the click card uses the street-art record when one exists for the same node id (artist, year, article, extract); (b) a series fallback in `build-street-art.ts`: a name of the form "<Series> N/M" (or "(<Series> N)") with no article of its own takes the series article's extract plus "part N of M" and the node's artist, flagged as series-level so the card says "Part 11 of 20 of the Beeldenroute Brettensuite"; (c) a per-piece lookup by title pattern on nl.wikipedia ("… (Brettensuite 11)") through the existing wikipedia-pages helper, cached, run once offline; (d) report how many of the 1,427 street-art points gain text by (b) and (c). Gate adds: Brettensuite 11/20 shows the series text, artist and the Wikipedia link; no card in the click set reads only its kind label. Data output to `staging/` with a coverage report; the integrator publishes.
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
