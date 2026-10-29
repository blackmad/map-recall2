# Lane: driving feel — fixed substeps, a speed-dependent lock, the camera offset

Rules: `LANE-RULES.md`. Plan: `slop-newyork-plan-20261029.md` §4 lane E.
Evidence: `docs/research/slop-newyork-20261029.md` §3. Model: opus.
Follows the 2026-10-29 steering work (`cameraYaw.ts`, `streetFollow.ts`,
HISTORY "Phones follow the street"), which must stay as it is: the dead
band, the 80°/s cap and the Follow mode are ahead of slop.

## What slop does that we do not

- **Frame-rate independence.** `steps = ceil(dt·120)` substeps and every
  response as `1 − exp(−k·step)` (`js/controllers.js:1178`). Its test runs
  the same inputs at 30, 60, 120 and 144 Hz and requires paths within 10 cm,
  heading within 0.01 rad and speed within 0.05 m/s
  (`tests/controllers.test.cjs:382`). Ours integrates once per frame with
  `dt` clamped to 50 ms (`game.js:341-345`, `car.js:50-110`): a 120 Hz
  ProMotion iPhone and a 30 Hz laptop drive different cars.
- **Speed-dependent lock.** `maxSteer = atan(turn / max(v², turn / tan 0.60))`
  with `turn = wheelbase · cornering`: full lock at parking speed, lateral
  acceleration capped at `cornering` above it; yaw target `v·tan δ / L`
  clamped to `grip / |v|`. Ours: a constant turn rate reduced 30 % at top
  speed (`constants.js` `CAR_TURN_RATE 1.45`, `TURN_REDUCTION_AT_SPEED 0.3`).
- **Camera offset in the rider's frame.** `js/cameras.js:333-352` smooths the
  offset relative to the entity, not a world position, because a world-space
  follower trails by speed × dt and surges on uneven frame times. Ours eases
  x and y in world space (`camera.js:86-87`). Also a pull-back of up to 25 %
  with speed and a 5.2 m look-ahead.
- **Touch plumbing.** Radial dead zone 0.15 rescaled so analog strength
  survives; `setPointerCapture` + `stopPropagation` on the controls so the
  canvas orbit never sees them; keyboard, touch and gamepad as separate input
  maps blended by `max`; everything reset on blur, resize and
  visibilitychange.

Do not copy slop's bicycle: 19 m/s and a constant 2.15 rad/s yaw.

## Build

1. `src/canalRecall/drive/steerModel.ts`, pure: lock from speed, yaw target,
   friction circle, substep integration with `1 − exp` responses; `car.js`
   calls it through a bundle global (new logic typed, legacy adapter small).
   The bike gets the bicycle model with cornering 4–5 m/s², top speed 7–8 m/s
   in world units (check `constants.js` px per metre), slop's visual lean
   `−turn · min(1, |v|/9) · 0.34` and a freewheel cadence if the bike model
   has cranks (`player-vehicles-source.js`).
2. The display-rate agreement test on the pure model: scripted inputs
   (a straight, a 90° corner, a brake into a corner, a pivot from rest) at
   30/60/120/144 Hz within 10 cm, 0.01 rad, 0.05 of top speed.
3. Camera: smooth the follow offset in the rider's frame under `cameraYaw.ts`;
   speed-scaled pull-back and look-ahead as options in `preferences.ts`
   defaults, measured against the cap.
4. Touch: the radial dead zone and pointer capture on the Steer thumbstick
   and the Follow buttons; input maps blended by `max`; reset on blur.

## Regressions that must stay green

`npm run test:street-follow` (Leidsestraat × Keizersgracht straight/left/
right, the Keizersgracht ring hands-off, Utrechtsestraat × Prinsengracht),
`npm run test:canal-car` (Dam ride, Leidseplein exits, Frederiksplein, Piet
Heinkade), e2e `ferry-centraal-pier`, `open-squares`, `sun-heading`,
`start-heading`. Steering keys stay E and T free (`player bugs`, #24 #25).

## Acceptance

The user rides it: a 30 s desktop clip and a 30 s phone clip of the
Keizersgracht ring and one T-junction, before | after, posted with the
hand-back. Camera yaw stays ≤ 80°/s and zero on straight streets in
`test:street-follow`. Ride-perf unchanged.

## Checks

`npm run lint`; the new `test:steer-model`; `npm run test:street-follow`;
`npm run test:canal-car`; `PW_PORT=<port> npx playwright test sun-heading
start-heading open-squares --project=desktop` and `--project=iphone` under
the lock.
