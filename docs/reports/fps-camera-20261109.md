# First-person riding camera (issue #171), 2026-11-09

## 1. Current camera pipeline (measured by reading the code, then by running it)

- **Pose source.** `public/canal-drive/js/camera.js` keeps the game camera: centre = rider plus `CHASE_LOOKAHEAD`
  (0 in chase), `rotation` = the heading through `cameraYaw.ts` (10 degree dead band, 80 deg/s cap, ease 0.04: it
  deliberately lags steering), `speedZoomScale` pull-back. `viewMode` is `chase` / `north` (`cockpit` is retired but its
  branches remain).
- **Solve.** `engine/gameCamera.ts` `GameCameraSolver.request` turns it into a MapLibre-style view: centre lng/lat, zoom
  (game zoom x `CHASE_ZOOM_OFFSET` 0.3), bearing, pitch (`CHASE_PITCH_DEGREES` 60 plus tilt, eased 0.12/frame, plus the
  landmark sightline lift). `ownWorldView.sync` then lowers the pitch against buildings (`cameraClearance.ts`,
  `CLEARANCE_MAX_DROP` 10 deg, floor 17) and pulls the eye out of walls (`streetVisibility.ts` `clearEye`, F4: pull toward
  the rider down to 0.3 of the distance, else drop pitch; a rider deep in a footprint ghosts that building instead).
- **Camera model.** `ownMap/mapCamera.ts` `cameraFrame`: eye = centre minus `heading * d * sin(pitch)`, height
  `elevation + d * cos(pitch)`, with `d = focal * metresPerPixel(zoom)`; fov 36.87 degrees; pitch ceiling 85
  (`MAX_PITCH_DEG`). `engine/cameraMap.ts` `clipFromMercator` builds the three.js projection: `near = d / 50`,
  `far = furthest * 1.01 + elevation`. Chase `d` is roughly 60-100 m, so near is 1.2-2 m.
- **Consumers keyed to the camera.** Labels and line labels (`drawLabels`, `frame` + `zoom`), own-ground residency
  (`_ownGround.update(centre, zoom, pitch, lngLat)`), `isAerialView(zoom, pitch, lat)` / `eyeHeightM` (aerial power and
  ground bases), far shells and baked coarse (rider `subject`, not the camera), building detail ring (`setDetailCentre`
  on the rider), landmarks (`setRevealPose`, rider).  Residency and detail follow the rider; only the aerial switch and
  label projection read the eye.
- **Bike model.** `setPlayerBike(player, loader, visible, zoomScale)`; the rider angle is `player.angle`
  (bearing = angle + 90 degrees).
- **Keys in use** (grep of game-route/input/hud/src): E M W T S P D C A U R Q O L K J I G F B, F3, F4, Digit0.
  Free: **V**, H, N, X, Y, Z.

## 2. What breaks at 1.6 m (and what was done)

| Concern | Finding | Handling |
| --- | --- | --- |
| Near-plane clipping | `near = d/50`. With a 1.6 m eye the model distance is ~18 m so near = 0.37 m and the near-plane half-diagonal is ~0.5 m: any wall within an arm's length is sliced. | `nearDivisor` option on `EngineCamera` (default 50, byte-identical); FPS uses 120 (0.15 m). |
| Far plane | A level view at fov 72 makes `furthest` several km (topHalf clamp). Depth range 0.15 m .. km risks z-fighting for coplanar road/ground layers. | `farCapM` option (default Infinity); FPS caps 2500 m. |
| Eye inside a building | Rider is on a road, so only covered passages, arcades and kerb-hugging walls matter. | Existing F4 footprint test (`eyeInsideBuilding`, with the FPS near-plane reach + 0.2 m); eye steps back up to 3 m along the heading, in at once, out eased; if still inside (passage) the footprint is ghosted via the existing `'eye'` ghost key. |
| Bridges / tunnels | The camera `elevation` is the eased rider surface (deck / sunken water), so the eye is 1.6 m above the deck. | Unchanged. |
| Chase clearance guard | Lowers pitch toward overhead against buildings; meaningless at eye level. | Skipped while FPS is on; the chase solver state is untouched, so leaving FPS returns to the chase pose. |
| Yaw | Chase yaw is dead-banded (lags a steer by design, user nausea report 2026-10-29). | FPS uses `player.angle` through a 0.12 s low-pass (`stepFpsYaw`), frame-rate independent, shortest way round. |
| Labels | Placement projects through the same frame, so labels at eye level appear on the horizon band; occlusion uses the frame. Not changed. | Reported only. |
| Bike model | Directly below the eye. | Hidden in FPS (`visible && !fpsDrawn`). |
| Spoiler rule | The HUD/map never reveal the street under question: FPS changes only the camera, the label policy is untouched. | n/a |

## 3. What was built

- `src/canalRecall/engine/fpsCamera.ts` (pure, unit-tested in `fpsCamera.test.ts`): `fpsPose` solves the camera model's
  centre/zoom/pitch/fov so the eye is 1.6 m over the rider; `stepFpsYaw` (0.12 s low-pass, short way round);
  `headBobM` (2.5 cm, stride 2.4 m, off unless `?bob=1`); `clearBackM`; `fpsRequested` (`?cam=fps|chase`, else the
  stored choice).
- `engine/cameraMap.ts`: optional `nearDivisor` (default 50) and `farCapM` (default Infinity) on `EngineCamera`, and
  `fovDeg` joins the jump-tolerance check; with the defaults nothing changes.
- `engine/ownWorldView.ts`: `sync` solves FPS first when on (not detached, not in the start flight, chase/cockpit view
  mode), skips the chase pitch clearance, applies the lens (fov 72, near = d/120, far cap 2500 m) and lifts the game's
  chase caps (pitch 75, zoom 22) while on, restoring them on leaving. `setFpsCamera(on)` / `fpsCameraOn()` on the view,
  stored in `localStorage.canalRecallCam`; **V** toggles (ignored in inputs, with modifiers). Bike model hidden.
- The pitch/zoom caps were the first real bug the spec caught: with the game's pitch 75 / zoom 22 the eye sat 1.82 m up;
  with them lifted the spec pins 1.6 m.

## 4. Measurements (desktop 1440x900, headless Chrome, `?glCounters=1`, rider stationary, p50 of 40 forced frames)

Frame time is vsync-bound in this harness (16.6 ms both), so triangles and draws are the comparison.

| Spot | chase tris / draws | fps tris / draws | own-ground tris (chase -> fps) |
| --- | --- | --- | --- |
| Prinsengracht quay (4.88395, 52.37335, 74 deg) | 1.64 M / 210 | 1.80 M / 237 (+10 %) | 349 k -> 787 k |
| Egelantiersstraat plaza (4.8815, 52.37585, 90 deg) | 1.70 M / 218 | 2.26 M / 216 (+33 %) | 394 k -> 712 k |
| Magere Brug (4.9014, 52.3631, 90 deg) | 1.32 M / 233 | 1.90 M / 236 (+45 %) | 295 k -> 916 k |

The growth is the own ground: its ring is planned from `zoom` and `pitch`, and the FPS zoom is 20.6 (chase ~18), so
it asks for the finest level over the whole 2.5 km level view. Buildings (facades) are about equal because they key to
the rider. Fix not applied: feeding the ground a chase-equivalent zoom would change which cells are resident at the
horizon and needs a look at the far-field handover (`ownGround/groundResidency.ts`); it is the first follow-up, since
GPU time (not measurable under vsync here) follows triangles.

Eye clearance: `back` stayed 0 at all three spots. At the quay and the Egelantiersstraat plaza the guard reported
`stuck` (still inside a footprint after 3 m back) and ghosted pands NL.IMBAG.Pand.0363100012174217 and
...2172887; the frames show no visible fault, but a rider on open pavement should not hit this, so the probe's reach
(0.2 m + near-plane diagonal 0.21 m, plus the 1 m grid pad in `footprintsNear`) or an overlapping low footprint needs a
look. The teleport spots are guessed street positions (plazas), not ridden roads.

Visual findings (screenshots below): ground and facade detail hold up at 1.6 m (brick, window reveals, cobbles); the
level view shows the far canal and bridge; sky and far buildings fine. The DESTINATION pin label sits over a facade
(existing behaviour, but at eye level it reads as an address sign): consider hiding the pin until the answer in FPS.
Trivia cards/HUD unchanged. Phone portrait renders correctly with the stick pad and cards; the "bridge" spot is the quay beside the Magere Brug, not its deck (the teleport coordinates were guessed), so deck elevation was not exercised.

## 5. Not done / open

- Car view (optional in the brief): the same pose maths apply with a different eye height; not wired.
- Handlebar hint: none (no new models).
- Ground LOD keyed to eye (above), stuck-probe margin, destination pin at eye level.
- game.js: no change needed (the key listener and `?cam=fps` live in the engine view). The legacy MapLibre engine
  ignores the flag.
