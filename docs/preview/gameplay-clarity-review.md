# Canal Recall gameplay clarity review (2026-10-17)

This review covers what a first-time player sees in Canal Recall: a guest with
empty storage, on a 1440×900 desktop and a 390×844 phone (Playwright `desktop`
and `iphone` projects). The states covered are the first visit, the start panel,
More options, a home-route start, a boat ride and a bike ride, a question, a
right and a wrong answer, the arrival card, How to play, settings, and long
names with stacked notices.

**Method.** `tests/e2e/clarity-shots.spec.ts` captures every state. It is
opt-in, and you run it like this:
`CLARITY_SHOTS=1 SHOT_TAG=after PW_PORT=4403 bash /tmp/canal-pw.sh npx playwright test clarity-shots`.
Full-size PNGs land in `artifacts/clarity/<tag>/`, which git ignores.
Downscaled copies are committed under `docs/preview/clarity/{before,after}/`.
I judged the screens with the impeccable critique/clarify lens: Nielsen
heuristics, cognitive load and UX copy. This was a single-context run. The
skill's dual sub-agent critique was not used, because this was a leaf lane.
The deterministic detector (`detect.mjs`) found one issue: an empty
`<img id="landmark-panel-image">`. That is a false positive, because the image
is filled at runtime.

The questions are injected (`_openQuizPrompt`), so the plaque headline in the
answered shots does not match the injected street. That mismatch comes from the
harness, not from the game.

## Scorecard (before)

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | The tally `0 / 0 · 0 pts` has no label. A bare `65%` zoom flash looks like a loading bar. |
| 2 | Match with the real world | 3 | Jargon: “learning ring” and “1.15× new street”, which also appeared on canals. |
| 3 | User control and freedom | 3 | No help on the setup screen. |
| 4 | Consistency and standards | 3 | The phone finish card offers Route setup; the desktop one does not. |
| 5 | Error prevention | 2 | Home route with no visible address field. Feedback covered the Start button on phones. |
| 6 | Recognition rather than recall | 2 | The View row is four bare icons. Difficulty levels did not say what they change. |
| 7 | Flexibility and efficiency | 3 | The desktop key strip is good. The help table mixes debug keys with core keys. |
| 8 | Aesthetic and minimalist design | 3 | The enamel world is coherent. On phones the setup screen is dense. |
| 9 | Error recovery | 3 | Wrong answers teach well: the right name is shown and highlighted. |
| 10 | Help and documentation | 1 | There was no first-run explanation, and help was hidden where newcomers start. |
| **Total** | | **26/40** | Solid core, weak first minute |

**Strengths to keep:**
- The question card withholds the name as `? ? ?` and never leaks it.
- A wrong answer strikes through the guess and ticks the right name. That teaches.
- The desktop bottom key strip (`? help · G settings · M map …`).
- The phone “hold here to drive” hint on the ring.

## Findings

Severity: **High** blocks or misleads a first-time player. **Medium** costs
understanding. **Low** is polish.

### 1. Nothing says what the game is before the first ride — High — FIXED
- **Shots.** `before/desktop-01-first-visit.jpg`, `before/iphone-02-start-panel.jpg`
- **What confuses a first-time player.** The first screen asks for City, Travel,
  View, Route, Difficulty and Destination. Only the small line above Start says
  what happens: “Canal hop to your destination · Arrive knowing more of
  Amsterdam”. Nothing says the ride stops to quiz you, or how to answer.
- **Fix.** A three-step first-run intro (`src/canalRecall/onboarding/`):
  1. Ride the real city. Steering hints by device: keys, or the ring.
  2. Name it. A miniature `? ? ?` card shows the question; 1–4 or tap to
     answer, and No idea is always available.
  3. Points and names learned. A worked tally reads `3/4 named · 290 pts`, and
     the step points to Knowledge.
- **Behaviour.** The intro shows once, behind a try/catch `localStorage` flag
  (`canalRecall.onboarding.v1`). Skip, ×, Esc or a tap on the backdrop
  dismisses it. ←/→ step through it. Show the 3-step intro in How to play
  replays it. Automated runs skip it unless they set
  `window.__canalRecallOnboarding = true`.
- **After.** `after/desktop-01b-onboarding-1.jpg` to `-01d-`, and
  `after/iphone-01b-onboarding-1.jpg` to `-01d-`.

### 2. Feedback covers Start route on a phone — High — FIXED
- **Shot.** `before/iphone-02-start-panel.jpg` (bottom right)
- **What confuses a first-time player.** The Feedback pill sits on the right
  third of the primary button. A thumb aimed at Start opens the feedback form.
- **Fix.** During setup on a phone, Feedback and How to play share one row
  below Start, and the footer reserves 22 px so Start clears that row. The e2e test asserts
  that neither control overlaps `#route-start`.
- **After.** `after/iphone-02-start-panel.jpg`

### 3. How to play is hidden on the setup screen — High — FIXED
- **After.** `after/desktop-01d-onboarding-3.jpg` (the `?` sits in the corner
  behind the intro), `after/desktop-20-help.jpg` (the “Show the 3-step intro”
  button).
- **Shot.** `before/desktop-01-first-visit.jpg` (no `?` in the corner)
- **What confuses a first-time player.** `body.setup-open` hid both utility
  buttons. Newcomers make every decision on this screen, so this is where they
  most need help.
- **Fix.** Only Settings hides there, because the setup form duplicates it.
  How to play stays.

### 4. The View row is four bare icons — Medium — FIXED
- **Shots.** `before/desktop-01-first-visit.jpg`, `before/iphone-02-start-panel.jpg`
- **What confuses a first-time player.** Compass, arrow, crosshair and gauge.
  Only the selected one shows its name (“NORTH UP”). What a view does
  (flat or 3D, behind the vehicle) lived only in a hover `title`.
- **Fix.** The current view's hint shows under the row, on phones too, in both
  the setup screen and Ride settings. For example: “Flat map, north at top”.
- **After.** `after/iphone-02-start-panel.jpg`

### 5. Difficulty does not say what it changes — Medium — FIXED
- **Shots.** `before/desktop-01-first-visit.jpg`. On the phone the gloss was
  hidden.
- **What confuses a first-time player.** “Naming help. Expert & Custom sit
  under More options.” does not say how Easy differs from Hard.
- **Fix.** `difficultyGloss()` (`src/canalRecall/game/setupCopy.ts`) derives
  the text from `DIFFICULTY_PRESETS`. For example: “Pick the name from a list.
  Route line shown.” or “Type each name. No route line or minimap.” It is
  visible on phones.

### 6. The score tally has no label — Medium — FIXED
- **Shots.** `before/desktop-10-boat-riding.jpg`, `before/iphone-10-car-riding.jpg`
- **What confuses a first-time player.** `0 / 0 · 0 pts` reads like a
  fraction of something unknown.
- **Fix.** `scoreTally()` (`src/canalRecall/hudCopy.ts`) draws
  `0/0 named · 0 pts`. The intro's third step explains it with a worked example.
- **After.** `after/desktop-10-boat-riding.jpg`, `after/iphone-10-car-riding.jpg`

### 7. The answer bonus is jargon and named the wrong thing — Medium — FIXED
- **Shot.** `before/desktop-13-car-right.jpg`
- **What confuses a first-time player.** “Correct — Raadhuisstraat (+86 pts,
  1.15× new street)” exposes a raw multiplier. It also said “street” on a canal
  in boat mode, and it was truncated on the desktop plaque.
- **Fix.** `answerPath.ts` now writes “(+86 pts · new name bonus)”,
  “· cycle track bonus” and “· 3 in a row”. `check-canal-answer-path.ts` is
  updated.
- **After.** `after/desktop-13-car-right.jpg`

### 8. Picking Home seems to do nothing on a phone — Medium — FIXED
- **Shot.** `before/iphone-04-home-route-setup.jpg`
- **What confuses a first-time player.** The home-address field opens below
  Destination, under the fold, so the Home tile appears to change nothing but
  the line above Start.
- **Fix.** When Home is picked and no address is saved, the field scrolls into
  view and takes focus.
- **After.** `after/iphone-04-home-route-setup.jpg`. That shot sets the
  address through the store, so the focus path is exercised by hand, not by
  the harness.

### 9. “Home base · grow your learning ring” — Low — FIXED
- **Shot.** `before/iphone-04-home-route-setup.jpg`
- **What confuses a first-time player.** “Learning ring” is an internal term.
- **Fix.** The line now reads “Rides from home reach further as you learn”.
  With a known radius it reads “Learn the names within ~1.2 km of home”.

### 10. A bare “65%” flashes over the vehicle — Low — FIXED (label only)
- **Shots.** `before/iphone-30-stacked-long.jpg`, `before/desktop-30-stacked-long.jpg`
- **What confuses a first-time player.** The camera zoom badge appears as the
  ride starts and reads as a loading bar.
- **Fix.** It now reads `Zoom 65%`.
- **Unfixed.** Why the badge fires right after the start flight, when the
  player never zoomed. The camera settling after `_intro` clears counts as a
  zoom change.

### 11. The phone “More ⌄” cue covers the Destination select — Medium — open
- **Shots.** `before/iphone-02-start-panel.jpg`, `before/iphone-04-home-route-setup.jpg`
- **What confuses a first-time player.** The floating cue sits on the select's
  chevron, so it looks like part of the field.
- **Proposed fix.** Dock the cue into the scroll fade band, or hide it once the
  last field is at least half visible.

### 12. More options opens out of sight on desktop — Low — open
- **Shot.** `before/desktop-03-setup-advanced.jpg`
- **What confuses a first-time player.** Expanding the section shows only the
  “Harder difficulties” label above the footer. The new controls are below the
  fold, so the click seems to do little.
- **Proposed fix.** On `toggle`, scroll the opened `<details>` into view.

### 13. The answered card keeps an empty band — Low — open
- **Shot.** `before/iphone-14-boat-wrong.jpg`
- **What confuses a first-time player.** After answering, No idea hides and
  leaves about 120 px of blank paper, which looks like a missing control.
- **Proposed fix.** Collapse the slot, or put a “Riding on in 3 s” line there.

### 14. The arrival card repeats itself and differs between devices — Low — open
- **Shot.** `before/desktop-16-boat-finish.jpg`, compared with `before/iphone-16-boat-finish.jpg`
- **What confuses a first-time player.** `1/2 Canals` and `50% Recall` state the
  same fact. The phone offers Route setup, but the desktop card only offers
  ENTER (Next route) and C (Share).
- **Proposed fix.** Drop Recall %, or show ribbon axes instead. Add
  “ESC Route setup” to the desktop actions.

### 15. The How to play keyboard table is flat — Low — open
- **Shots.** `after/desktop-20-help.jpg`, `after/iphone-20-help.jpg`
- **What confuses a first-time player.** The table lists 21 rows. Steer, brake
  and the answer keys sit beside the debug overlay and IJKU panning.
- **Proposed fix.** Split it into “Ride and answer” (5 rows) and a collapsed
  “More keys”.

### 16. The plaque names the starting street before any question — Info, for the owner
- **Shots.** `before/desktop-10-boat-riding.jpg` (SINGEL),
  `before/iphone-10-car-riding.jpg` (AMSTEL)
- **What confuses a first-time player.** The start corridor is shown by name.
  `missionBrief.ts` says it must never name the start corridor, because that
  would spoil the first quiz.
- **To check.** If the start street can later be asked, this breaks the
  answer-before-reveal rule. If it is never asked, nothing is wrong. Please
  confirm which, and pin it in a check.

### 17. Signed-in, long-name and stacked-notice states — note
- Long names trim correctly in the merged phone plaque
  (`before/iphone-30-stacked-long.jpg`).
- The stacked landmark and neighbourhood cards are covered by the existing
  Storybook stories `StackedNotices` / `PortraitStackedNotices`. The live
  harness shot was taken before those cards drew.
- The signed-in state was not exercised, because this lane has no account.

## Verification

- Unit tests: `node --import tsx --test src/canalRecall/onboarding/onboarding.test.ts`
  (6 tests). They cover storage that throws, device hints, that the intro
  names no real street, the tally copy and the difficulty glosses.
- `npm run test:canal-answer-path`, `npm run test:canal-car`,
  `npm run test:play-delight` and `npm run lint` all pass.
- e2e: `tests/e2e/onboarding.spec.ts` (desktop and iphone) checks five things:
  - A first visit shows the intro.
  - Keyboard and tap navigation work.
  - G is swallowed while the intro is open.
  - Dismissing it persists across a reload.
  - Esc skips it, How to play is visible on setup and replays it, and nothing
    overlaps Start route.
- Storybook: `IntroRide`, `IntroNameIt` and `IntroScore`, each with a `…Phone`
  version, plus `PortraitRouteSetupHome`. `npm run build-storybook` passes.
