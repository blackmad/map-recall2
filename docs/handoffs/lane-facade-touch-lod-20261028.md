# Lane: cheaper far facade chunks on touch devices (opencode/DeepSeek)

**Goal.** The `facades` shared-frame participant (`src/canalRecall/threeBuildingsBrowser.ts`, registered at about line 1502) draws ~0.8–1 M triangles in the iPad frame at the Westerkerk. That is about half of what remains after the ground cut (#91), and the context-loss crashes are Sentry CANAL-RECALL-7. The goal is to give chunks away from the rider a cheaper build **on touch devices only**. Desktop must stay **byte-identical**.

**Model.** DeepSeek via opencode (`--auto`).

**Read.** `docs/handoffs/LANE-RULES.md`, this brief, then:
- `docs/handoffs/inflight-20261025.md`: only the "Ground touch LOD merged" paragraph and the CANAL-RECALL-7 bullets
- `src/canalRecall/threeBuildingsBrowser.ts`, plus whatever it imports for chunk builds
- `src/canalRecall/ownGround/gameGround.ts`: see how #91 did it (`detailFlag()`, `groundNearFlag()`, the `detail` option, rebuild when near). Copy that pattern.
- `scripts/gpu-load-ipad.mjs`, the measurement.

**Do.**
1. **Measure first.** Write the breakdown to `artifacts/facade-touch-lod/measurements.md`: facade triangles per chunk (distance from the rider), and per content kind inside a chunk (generic BAG walls, roofs and roof decoration, kit parts, shopfronts, special kits/boats, bays, monument gables). Use `SharedFrame.drawStats()` plus your own traversal; name meshes if needed, in a diagnostic only.
2. Add one typed option `detail: 'full' | 'touch'`, chosen the same way as the ground (`?facadeDetail=full|touch`).
   - In `touch`, chunks other than the rider's own build a cheaper version. Pick from the breakdown which content to drop or simplify: for example roof decoration, kit part detail, shopfronts, bay geometry beyond the near chunk.
   - Keep each building's mass, height, roof shape and wall colour, so the skyline does not change.
   - A chunk becoming near rebuilds at full. Use one level per chunk, never two at once.
3. Desktop (`full`) must not change. `npm run test:three-buildings` and any goldens it checks must pass unchanged.

**Measure.**
- Run `PORT=<your port> PLACES=4.88385,52.37450,180 node scripts/gpu-load-ipad.mjs` before and after, and with `QS='?facadeDetail=full'`.
- Target: facades ≤ 450 k and main pass ≤ 1.3 M at the Westerkerk.
- Screenshots at 1180×734 @2x, before and after: near, at bearing 90, and far down the canal, at bearing 180. Save them to `artifacts/facade-touch-lod/`.
- Run `PW_PORT=<port> npx playwright test tests/e2e/own-ground-default.spec.ts tests/e2e/canal-recall.spec.ts`. Stop your server by its port's PID.

**Do not touch.** `index.html`, `game.js`, `package.json`, `TODO.md`, `HISTORY.md`, goldens, the ground and landmarks code. Do not commit bundles; say which ones the integrator must rebuild.

**Report block.**
```
FACADE-TOUCH-LOD <sha>: facades a -> b tris, main pass c -> d (Westerkerk, iPad), what was dropped/simplified per content kind, desktop identical (how shown), tests pass, screenshots artifacts/facade-touch-lod/, what looks worse (specific), bundles to rebuild
```
