# Lane: cheaper far ground cells on touch devices (opencode/DeepSeek)

**Goal.** On touch devices (iPad and phones), own-ground cells away from the rider are built with fewer triangles. This cuts the GPU load behind Sentry CANAL-RECALL-7, a context loss on iPads and phones. Desktop output must stay **byte-identical**.

**Model.** DeepSeek via opencode (`--auto`). The number gate decides; the screenshots go to the integrator for the look.

**Read.** `docs/handoffs/LANE-RULES.md`, this brief, then:
- `docs/handoffs/inflight-20261025.md`: only the CANAL-RECALL-7 bullets ("Measured 2026-10-27" and "Why the ground is ~1 M tris").
- `src/canalRecall/ownGround/gameGround.ts`: `compactFlag()`; the worker `init` message at about line 219 is where a device option enters.
- `src/canalRecall/ownGround/groundWorker.ts`
- `src/canalRecall/ownGround/residency.ts`
- the resolution constants: `FAST_RES_M` (roadSurfaces.ts), `POCKET_RES_M` (pockets.ts), `CULL_RES_M` (parks.ts), `WAY_DECK_STEP_M` and `ROAD_EDGE_STEP_M` (wayDecks.ts)
- `scripts/gpu-load-ipad.mjs`, the measurement.

**Today, at Prinsengracht by Westerkerk on an iPad profile at pitch 60:**
- main pass 2.35 M tris, of which own-ground is 1.06 M
- 6 resident cells, every one built at 0.5 m drape steps
- largest layers: quay 225 k, paving 224 k, land 196 k, kerb 124 k, park 99 k, klinker 89 k, lawn 86 k, asphalt 62 k, bollards 49 k

**Do.**
1. Add one typed option, for example `detail: 'full' | 'touch'`. It is chosen in `gameGround.ts` from the existing device detection (look for how `compact`/phone is decided; do not invent a new user-agent sniff) and passed in the worker `init`. Allow `?groundDetail=full|touch` to override it, for testing on desktop.
2. In `touch` mode, for every cell **except** the cell the rider is in and its 8 neighbours:
   - build at coarser steps: drape 1.5–2 m instead of 0.5 m; road edges and quay/kerb stations 1 m instead of 0.25–0.5 m
   - leave out bollards and furniture
   - keep every layer's footprint; no holes or gaps at cell seams
   - When the rider moves and a cell becomes near, rebuild it at full detail. Reuse the existing rebuild path; never show two levels at once.
3. Desktop (`full`) must not change. `npm run test:own-ground` must pass unchanged, with no golden updates.

**Measure.**
- Start the dev server: `PORT=<your port> nohup npm run -s dev &`.
- Run `PORT=<port> node scripts/gpu-load-ipad.mjs` and `GROUND=1 PLACES=4.88385,52.37450,180 …` before and after.
- Target: own-ground ≤ 450 k tris and main pass ≤ 1.2 M at the Westerkerk place.
- Also run with `QS='?groundDetail=full'` to show the desktop path is unchanged.
- Screenshots at 1180×734 @2x, same place and pitch, before and after: one near the rider, and one looking far down the canal. Save them to `artifacts/ground-touch-lod/`.
- Run `PW_PORT=<port> npx playwright test tests/e2e/own-ground-default.spec.ts tests/e2e/own-ground-game.spec.ts`, one run at a time.
- Stop your dev server by its port's PID.

**Do not touch.** `index.html`, `game.js`, `package.json`, `TODO.md`, `HISTORY.md`, goldens, and any other participant (facades, landmarks). Do not commit bundles. The integrator rebuilds them.

**Report block.**
```
GROUND-TOUCH-LOD <sha>: own-ground a -> b tris, main pass c -> d (Westerkerk, iPad), desktop path identical (yes/no + how shown), test:own-ground pass, e2e pass, screenshots artifacts/ground-touch-lod/, what looks worse (be specific)
```
