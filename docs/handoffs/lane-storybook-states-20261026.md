# Lane: missing Storybook states (opencode/DeepSeek, mechanical)

**Goal.** Every HUD/card/notice the ride can show has a desktop and a phone story.
CLAUDE.md requires both for each new HUD/card combination. This lane fills the gaps; it does not restyle anything.

**Model.** DeepSeek via opencode (`--auto`). No judgement of looks; the build and a screenshot per story are the evidence.

**Read.** `docs/handoffs/LANE-RULES.md`, this brief, `stories/canal-drive/CanalDrive.stories.tsx` (the pattern: one export per state, `…Phone` variants use the phone viewport), `stories/canal-drive/FreeRide.stories.tsx`.

**Steps.**
1. Inventory: list every export in `stories/**/*.stories.tsx`. Mark each state that has no `…Phone`/`Mobile` twin. Known gaps to check first:
   - `LiveHud`, `LiveHudFerry`, `FinishCard`, `NeighborhoodPhotoCard`, `BridgeOriginCard`, `BridgeRegisterCard`, `StreetOriginCard`, `BuildingFactsCard`, `StackedNotices`
   - the map-guard reload notice (`mountNoticeIn` in `src/canalRecall/mapGuard.ts`). It has no story at all. Add `GraphicsReloadNotice` and `GraphicsReloadNoticePhone` that mount it into a sized container.
2. Add the missing phone twins, plus stress variants where the CLAUDE.md checklist applies: a long street/landmark name (≥ 40 chars), a missing image, and stacked notices. Reuse existing fixtures; do not invent new data files.
3. `npm run build-storybook` must pass. Screenshot each new story with Playwright at desktop 1280×800 and phone 390×844. Use one browser run at a time on port `PW_PORT=4490`. Save the screenshots to `artifacts/storybook-states/`; do not commit them.

**Do not touch.** Anything under `public/canal-drive/` (no `game.js`, `index.html`, bundles), `TODO.md`, `HISTORY.md`, `package.json`. Do not change component code. If a state cannot be rendered without a code change, list it in the report.

**Acceptance.** `build-storybook` green; `npm run lint` green; every story listed in step 1 now has a phone twin, or a stated reason why not.

**Report block.**
```
STORYBOOK-STATES <sha>: added n stories (list), still missing m (reasons), build-storybook pass, lint pass, screenshots artifacts/storybook-states/
```
