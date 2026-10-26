# Lane: named regressions for shipped geographic fixes (opencode/DeepSeek, mechanical)

**Goal.** CLAUDE.md: "turn every reported geographic failure into a named regression location". Several shipped fixes in What's New have no pinned regression. This lane adds pins for them and does not change runtime code.

**Model.** DeepSeek via opencode (`--auto`).

**Read.** `docs/handoffs/LANE-RULES.md`, this brief, `public/canal-drive/whats-new-notes.json`, `scripts/check-canal-car.ts` (named spots such as `daCosta`, `stirumJunction`), `scripts/check-road-reachability.ts`.

**Steps.**
1. From `whats-new-notes.json`, pick every note that names a place in routing, driving, bridges, ferries or squares. Ignore building models and UI. Typical examples: open squares (Dam, Leidseplein), ferry docks (NDSM, Buiksloterweg), and junction or bridge fixes.
2. For each one, check whether it is already covered:
   - grep the check scripts and `tests/e2e/*.spec.ts` for the place name or its coordinates.
   - Write a table with the columns note, place, covered-by (file:line) and missing.
3. For each missing one, add a named assertion in the matching script, in the style already there:
   - a reachability pair in `check-road-reachability.ts`
   - a junction, bridge or segment assertion in `check-canal-car.ts`
   - Take the coordinates from `public/data/extracts/amsterdam/streets-routing.json` or the OSM ids in the note. Never from guesses.
4. Run `npm run test:canal-car` and `npm run test:reachability`. A new pin that **fails** on main is a finding, not something to fix: leave it out of the commit, keep it in a separate patch file, and report it.

**Do not touch.** Routing/physics code under `src/`, `public/`, extracts, `TODO.md`, `HISTORY.md`, `package.json`. Never loosen an existing tolerance.

**Acceptance.** Both checks green with the new pins; the table covers every geographic note; 0 coordinates without a source (cite the routing street name or OSM id in a comment).

**Report block.**
```
REGRESSION-PINS <sha>: notes scanned n, already covered c, pinned p (names), failing-on-main f (patch path + what fails), test:canal-car pass, test:reachability pass
```
