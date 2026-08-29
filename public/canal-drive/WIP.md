# Canal Recall — work in progress

Running notes for the current session. Delete items as they land.

## Session budget

Not a constraint right now: ~14.9M of 15M context tokens remain. Nothing
below is being rushed or dropped for budget reasons.

## Landed and pushed

| Commit | What |
|---|---|
| `efde1ae` | Route ribbons (bronze/silver/gold on recall, self-reliance, efficiency) and the master `Game-y features` toggle |
| `371ec8b` | Deleted the unreachable pursuit layer (~1,100 lines); postcard images load on demand and use CORS-safe URLs |
| `99668ba` | Bridge recall quiz; route destinations drawn from the landmark extract (245 POIs, was 11) |
| `1f6bbec` | HUD cleanup (killed TIME, speed dial, permanent zoom badge); route line drawn from the player's position |
| `d6a4a61` | Building colour `to-color` fix, opaque extrusions, highlight no longer fights the building, bridge crossing test, no countdown |
| `a9cb18d` | Calmer camera, grippier car, 1–4 answer keys, Reduced motion option |

## Car feel — measured, needs your judgement

Current tune: `PLAYER_CAR_DRIFT_FACTOR` 0.12, `PLAYER_CAR_TURN_MULT` 1.45,
`PLAYER_CAR_SPEED_MULT` 1.35, `PLAYER_CAR_ACCEL_MULT` 1.4,
`CAR_MIN_STEER_FACTOR` 0.7.

Measured in a car-mode drive:

- Stationary pivot: **72°/s**. Previously the car could not turn at all when
  stopped — `speedFactor` floored at 0 for cars, so steering authority was
  literally zero at a standstill.
- Top speed works out to ~330 km/h at `PIXELS_PER_METER = 3`, reaching 209 px/s
  within 2.5 s and still climbing. That is very fast for city streets; drop
  `PLAYER_CAR_SPEED_MULT` if it overshoots junctions.
- **Zero** frames outside the drivable corridor on that route, so the road guard
  was not fighting the car. The stuck-at-bridges report did not reproduce here.
- Distance from the road centreline still creeps up at speed (25.8 → 29.2 px
  against a 30 px half-width over six frames), so the car wanders toward the
  edge on long straights even with the new grip.

## Next up, in order

### 1. Firebase-backed mastery — "stop asking me what I know"

The headline request. Canal Recall has **zero** Firebase code today; everything
is `localStorage` under `canalRecall.*`. That is also why it never prompts a
login: `AuthModal.tsx` lives only in the React app at `/`.

The scheduler already exists and is unused by the game — `src/spacedRepetition.ts`
has `ReviewState` (`dueAt`, `intervalDays`, `ease`, `repetitions`, `lapses`),
`rateRound`, `scheduleReview`, `selectReviewFeatures`. `src/progressRepository.ts`
already syncs those to Firestore per-uid, and `firestore.rules` is deployed.

Plan:
1. New `src/canalRecall/recallStore.ts`, bundled with esbuild exactly like the
   existing `build:canal-car` / `build:canal-buildings` targets, exposing
   `window.CanalRecallStore`. canal-drive is plain `<script>` globals outside
   the Vite build, so it cannot import `src/firebase.ts` directly.
2. It should wrap `scheduleReview`, mirror to `localStorage` so signed-out play
   still works, and expose `isDue(featureKey)`, `record(featureKey, correct)`,
   `signIn()`, `user`.
3. `_updateCanalQuiz` skips a name whose `dueAt` is in the future.
   `_submitCanalAnswer` calls `record(...)`.
4. Small sign-in affordance on the setup screen; guest mode stays the default.

Note `scheduleReview` takes a `RoundResult` shaped for the React game
(`gameMode`, `accuracyPercentage`, `timeSpentMs`). Either adapt the canal answer
into that shape or factor the scheduling maths out of the `RoundResult`
signature — the latter is cleaner.

### 2. Car stuck at bridges

Reported at Raampoort/Nassaukade: the car stops dead at a bridge. Suspect the
car road guard rolls the car back because the bridge way is not in the drivable
corridor it tests against (`getNearestRoad` + `CAR_ROAD_EDGE_TOLERANCE`), even
though `27abbfc` preserved bridges in the routing graph. Reproduce, then check
whether the street network used for the guard includes the bridge segments.

### 3. On-rails street mode

Proposed: lock the car to street centrelines so steering only picks turns and
the car always runs straight along the road. Would remove the remaining
nausea and most of the stuck-at-geometry failures. Should be an option, not a
replacement.

### 4. Richer landmark popup with on-demand fetch

Only 112 of 300 landmarks carry a `wikipediaExtract`, so cards like
"Bevrijdingslinde" show a bare name. Fetch summaries lazily from
`https://<lang>.wikipedia.org/api/rest_v1/page/summary/<title>` (CORS-enabled,
no proxy needed) using the `wikipedia` field (e.g. `nl:Amsterdam Museum`), cache
per session, and fall back to what is already there. `distractors` is populated
for all 300 and still unused.

### 5. Setup screen cleanup + home delivery radius

The setup card is long and the Advanced section is a dumping ground. Also add a
control for the radius around the home address that errand destinations are
drawn from — currently home errands pick from the whole POI pool.

### 6. React config screen renders twice

Reported this session, not yet investigated. Suspect `StrictMode` double-invoke
in dev, or an effect without a dependency guard in `App.tsx`. Confirm whether it
reproduces in a production build before changing anything.

### 7. Canal highlight labels

Reported as "weird" twice; still no clear repro. Needs a screenshot showing the
problem before it is worth touching.

## Known limitations accepted for now

- A route whose origin snaps into a disconnected component (typically an
  Amsterdam-Noord canal cut off by the IJ) re-rolls up to twice, then plays
  without a route line rather than failing.
- `bridges.json` groups every way tagged `bridge=yes` under one name, so some
  entries carry long approach roads. The crossing test handles this, but the
  bridge *label* is placed where the player crossed rather than at the span.
