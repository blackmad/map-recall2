# Map Recall / Canal Recall

Two geography-learning apps share this repository:

| App | Type | Entry point | Where it lives |
| --- | --- | --- | --- |
| **Canal Recall** (the lead app) | 3D canal-boat and cycling ride through Amsterdam that teaches street and canal names | `public/canal-drive/index.html` | `public/canal-drive/` (legacy runtime) + `src/canalRecall/` (typed modules) |
| **Map Quest / Map Recall** | React + Vite 2D map quiz with spaced repetition | `index.html` → `src/main.tsx` | `src/` (React app) |

## Data sources

Everything is built from **open data only**:

- **OpenStreetMap (OSM)** — road/water topology, ways, POI geometry
- **BAG** (`bag.basisregistraties.overheid.nl`) — address/building register, footprints
- **3DBAG** — 3D building models and LOD heights
- **BGT** — large-scale base map (ground, roads, water)
- **AHN** — elevation/relief data
- **Wikipedia / Wikidata** — encyclopaedia text, images, structured facts
- **Amsterdam panoramas / Beeldbank** — reference photos for facades and landmarks
- Open tiles: **OpenFreeMap / OpenMapTiles** (basemap), Gemeente Amsterdam tree data

No proprietary map or imagery APIs are required at runtime; the Amsterdam extracts are cached/versioned under `public/data/extracts/`.

## Quick start

```sh
npm install
npm run dev
```

The dev server (`tsx server.ts`, Express + Vite middleware) serves both apps from one process:

- **Map Quest (2D quiz):** <http://localhost:3000/>
- **Canal Recall (3D ride):** <http://localhost:3000/canal-drive/>

Both apps work without Firebase in guest mode (progress is stored in the browser). See `FIREBASE_SETUP.md` to enable accounts and cross-device sync.

## Key npm scripts

Grouped by purpose — see `package.json` for the full list (300+ scripts).

**Develop & build**

| Script | Purpose |
| --- | --- |
| `npm run dev` | Express + Vite dev server (both apps) |
| `npm run build` | Full build: every Canal Recall bundle, then `vite build` |
| `npm run start` | Serve the production build (`dist/server.cjs`) |
| `npm run preview` | Vite preview of the React app |
| `npm run clean` | Remove `dist/` and `server.js` |

**Checks (aggregate gates)**

| Script | Purpose |
| --- | --- |
| `npm run lint` | `tsc --noEmit` type check |
| `npm run check:canal` | Pre-integration gate: typed checks, driving/reachability regressions, Storybook build |
| `npm run check:map-recall` | Map Quest unit/trivia/text checks |
| `npm run check:transit` | Transit extract + bundle + routing checks |
| `npm run check:facade-rebuild` | Facade reconstruction checks |

**Driving / reachability / regression tests**

| Script | Purpose |
| --- | --- |
| `npm run test:canal-car` | Named driving regressions (`scripts/check-canal-car.ts`) |
| `npm run test:reachability` | Road reachability audit (`scripts/check-road-reachability.ts`) |
| `npm run test:canal-streets` | Street overlay checks |
| `npm run test:srs` | Spaced-repetition logic checks |

**Playwright end-to-end** (`tests/e2e/*.spec.ts`)

| Script | Purpose |
| --- | --- |
| `npm run test:e2e` | Full e2e suite |
| `npm run test:e2e:smoke` | One smoke spec |
| `npm run test:e2e:update` | Update visual snapshots |

Playwright reuses any server already on its port, and other worktrees run their own dev servers — pin a private port so e2e exercises *this* checkout:

```sh
PW_PORT=4388 npx playwright test tests/e2e/canal-recall.spec.ts
```

**Storybook**

| Script | Purpose |
| --- | --- |
| `npm run storybook` | Serve the workbench (port 6006) |
| `npm run build-storybook` | Verify it compiles (used for deterministic HUD/card visual states) |

**Data pipelines** (open-data ingestion → versioned extracts/models)

| Script | Purpose |
| --- | --- |
| `npm run build:amsterdam` | Build the Amsterdam extract (`scripts/build-amsterdam-extract.ts`) |
| `npm run enrich:amsterdam` | Enrich with Wikimedia data |
| `npm run refresh:amsterdam` | Refresh the extract via shell pipeline |
| `npm run enrich:english` | Translate extracts to English |
| `npm run build:bag-tiles` | BAG building tiles + `covers.json` |
| `npm run build:recipe-tiles` | Compile facade recipe tiles |
| `npm run build:canalrecall-site` | Assemble `dist-canalrecall/` for Firebase hosting |

Most `build:canal-*` scripts are **esbuild bundle builds** that compile a `src/canalRecall/…` module into a browser global in `public/canal-drive/js/` (see `docs/ARCHITECTURE.md`).

**Feedback queue**

| Script | Purpose |
| --- | --- |
| `npm run feedback:queue -- pull` | Pull submitted image/game feedback from Firestore |
| `npm run build:canal-feedback` | Build the feedback browser bundle |
| `npm run test:feedback` | Feedback queue unit tests |

## Deploy

Two Firebase Hosting targets in the `map-recall2-blackmad` project (`firebase.json`, `.firebaserc`):

| Target | Site | App | Built from |
| --- | --- | --- | --- |
| `edumap` | `edumap-blackmad` | Map Quest | `dist/` |
| `canalrecall` | `canalrecall-blackmad` | Canal Recall | `dist-canalrecall/` |

`main` deploys both automatically via `.github/workflows/deploy-firebase.yml`. See **[DEPLOY.md](DEPLOY.md)** for the full story (custom domains, the `dist-canalrecall/` layout, and the legacy GitHub Pages workflow that should be retired).

## Work board

- **`public/canal-drive/TODO.md`** — unfinished work, ordered P0–P3 (the handoff board; only unfinished work lives here).
- **`public/canal-drive/HISTORY.md`** — why a thing is the way it is (append at top).
- `public/canal-drive/landmark-queue.html` — progress dashboard (model coverage, work tasks, dominant-building candidates, requested street buildings).
- Queue JSON files: `public/canal-drive/poi-work-queue.json`, `dominant-building-backlog.json`, `landmark-backlog.json`, `street-rhythm-work.json`.

See `CLAUDE.md` for the working agreement and `docs/` for the plan, handoffs, and living documents.

## Licence

`public/canal-drive/LICENSE` is **GPL-3.0**. The Canal Recall runtime is adapted from the open-source game *Smokeys and the Bandit* (GPL-3.0), credited in the game footer. The repository has **no root-level `LICENSE` file** and `package.json` declares no `license` field, so individual directories and dependencies should be treated as carrying their own terms; the only checked-in licence text is the GPL-3.0 file under `public/canal-drive/`.
