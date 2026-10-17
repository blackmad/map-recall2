# Wiring POI stamps and themed tours into the ride

Branch `preview/collect-tours-20261017` ships the typed modules, bundles and
data only. Nothing in `index.html`, `game.js` or `game-route.js` calls them
yet. Line numbers are for this branch's base, commit `2356db496`.

## 1. Script tags (`public/canal-drive/index.html`)

Add both tags after `js/route-selection.bundle.js` (line 1369) and before
`js/game-route.js` (line 1377):

```html
<script src="js/collection.bundle.js?v=20261017a"></script>
<script src="js/tours.bundle.js?v=20261017a"></script>
```

- `collection.bundle.js` (10 kB) sets `window.CanalCollection`. On load it
  fetches `../../data/extracts/amsterdam/landmarks.json`, resolved against
  its own script URL, to build the default pool.
- `tours.bundle.js` (2.5 kB) sets `window.CanalRecallTours`.

Rebuild them with `npm run build:canal-collection` and `npm run build:canal-tours`.

## 2. Stamps

The interface the account lane codes against:

- `CanalCollection.record(event)`
  - `event` is one of:
    - `{ id, name, how: 'arrived' | 'named' }`
    - `{ kind: 'tour', id, name }`
  - It returns `{ isNew, record }`, or `null` for a malformed event.
  - On a first stamp it dispatches `window` `canal-stamp` with
    `detail: { record, progress }`.
- `CanalCollection.progress()` returns `{ earned, total, byTier: { alist: {earned,total}, other: {earned,total} } }`.
- `CanalCollection.all()` returns `[{ id, kind, name, firstEarnedAt, lastEarnedAt, how, count }]`, newest first.
- Extras:
  - `setPool(features)`
  - `ready` (a Promise for the default pool)
  - `merge(remoteDocs)`
  - `docs()`, for Firestore `users/{uid}/poiStamps/{id}`

The `id` can be a route-POI id (`lm-<landmarkId>`) or a landmark id. The
module strips the `lm-` prefix.

### 2a. Arrival (`how: 'arrived'`)

Hook it into `game.js` `_updateRacing` finish block, lines 613–618, right
after `const arrived = this._finishLandmark();`:

```js
if (arrived && window.CanalCollection) {
  window.CanalCollection.record({ id: arrived.id, name: arrived.name, how: 'arrived' });
}
```

`_finishLandmark()` (`src/canalRecall/game/presentationRuntime.ts:1765`)
already handles three cases:

- It returns null for home, review stops and transit.
- It resolves `routeTo.landmarkId`, or the `lm-` id, to the exact landmark.
- It falls back to the nearest landmark within 220 px.

That fallback can stamp a landmark the player did not choose. For a strict
stamp, record only when `arrived.id === (this.routeTo.landmarkId || this.routeTo.id.replace(/^lm-/, ''))`.

### 2b. A correct name answer (`how: 'named'`)

Hook it into `src/canalRecall/game/recallRuntime.ts` `_submitCanalAnswer`,
right after `const correct = result.wasCorrect;` (line 1300).

No question asks for a landmark's name today. Every `_openQuizPrompt` call
(lines 494, 583, 705, 791, 863 and 1126) is about a street, water, a bridge,
a stop or a line. The cold-open review at line 583 prefers streets, water or
transit. So `'named'` never fires until a landmark question exists, for
example a quiz on the arrival card.

When that question lands, stamp the landmark if the answer is right and the
name belongs to a landmark:

```ts
if (correct && recallFeature && recallFeature.type === 'landmark') {
  const landmark = this.landmarks?.find(l => this._normaliseCanalName(l.name) === this._normaliseCanalName(correctName));
  if (landmark) (window as any).CanalCollection?.record({ id: landmark.id, name: landmark.name, how: 'named' });
}
```

This is a source change, so rebuild `game-recall.bundle.js` with
`npm run build:canal-game-recall`. Streets, bridges and water never stamp.

### 2c. Pool parity (optional)

`game-route.js` `_loadRoutePoiCatalog` merges manual-POI features at line
835 (`const features = CanalRecallRoute.mergeManualPoiFeatures(...)`). Call
`window.CanalCollection?.setPool(features)` right after that line. The
stamp total then counts the same hand-modelled destinations the route
picker uses. Without this call, the pool is the raw extract.

Measured on the current extract: 261 collectibles, 41 of them A-list.

### 2d. Cloud sync (account lane)

After sign-in:

1. Read `users/{uid}/poiStamps`.
2. Call `CanalCollection.merge(docs)`. The newest `lastEarnedAt` wins per id, counts are max'd and the earliest `firstEarnedAt` is kept.
3. Write back `CanalCollection.docs()`.

`stampsToUpload(merged, remote)` in `src/canalRecall/collection/poiCollection.ts`
gives the minimal write set. The rules in `firestore.rules` take an owner-only
document with exactly the fields `id, kind, name, firstEarnedAt, lastEarnedAt, how, count, schemaVersion: 1`,
where `id` equals the document id and `count` is an integer of 1 or more.
`npm run test:collection:rules` covers them.

## 3. Tours

The data is `public/data/extracts/amsterdam/tours.json` (built by
`npm run build:tours`, checked by `npm run test:tours`). Each stop is
`{ name, landmarkId?, osm?, lngLat: [lng, lat], why, source }`. Volatile
food and café tours also carry `volatile: true` and `checkedAt`. Show
"checked 17 Oct 2026, shops change" on those tours.

### 3a. A "Tours" launcher entry

The setup rail starts rides through `game-route.js` `_startConfiguredRoute`
(line 453). Fixed pairs go through `_launchPoiRoute(from, to)` (line 1037).
A Tours entry should do the following:

```js
async _startTour(tourId) {
  const T = window.CanalRecallTours;
  const tours = this._tours || (this._tours = await T.loadTours(this._activeCity().extractPath));
  const tour = tours.find(t => t.id === tourId);
  if (!tour) return this._setRouteError('That tour is unavailable.');
  await this._loadRoutePoiCatalog();
  this._tour = { tour, state: T.startTour(tour) };
  T.saveTourState(this._tour.state);
  this._launchTourLeg();
}

_launchTourLeg() {
  const T = window.CanalRecallTours;
  const { tour, state } = this._tour;
  const leg = T.nextLeg(state, tour);
  if (!leg) return;
  const from = T.stopAsRoutePoi(tour, leg.fromIndex);
  const to = T.stopAsRoutePoi(tour, leg.toIndex);
  // Landmark stops use the extract id `lm-<landmarkId>`, so _finishLandmark
  // shows the stop's arrival card. Shop stops have no landmark, so show
  // leg.to.why on the finish card instead.
  this._launchPoiRoute(from, to, { explicitDestination: true });
}
```

Put both methods on the `game-route.js` mixin, next to `_launchPoiRoute`.

### 3b. Advancing on arrival

In the `game.js` finish block (lines 595–621), after the arrival card:

```js
if (this._tour) {
  const T = window.CanalRecallTours;
  const step = T.advanceOnArrival(this._tour.state, this._tour.tour);
  this._tour.state = step.state;
  T.saveTourState(step.state);
  if (step.completed) {
    window.CanalCollection?.record({ kind: 'tour', id: this._tour.tour.id, name: this._tour.tour.title });
  }
}
```

### 3c. Riding on from the finish card

`game.js` `_runFinishAction('again')` (lines 244–255) calls
`_startNextRouteFromArrival` (`game-route.js:1063`). While a tour is in
progress, route it to the next leg instead:

```js
if (this._tour && !window.CanalRecallTours.isComplete(this._tour.state, this._tour.tour)) {
  this._launchTourLeg();
  return;
}
```

Clear `this._tour` when the tour completes, when the player opens route
setup (`_openRouteSetup`, `game-route.js:1095`), or when they choose a
non-tour ride. `T.tourProgressLabel(state, tour)` gives "Jewish Amsterdam:
stop 3 of 7" for the HUD.

### Product checks for the integrator

- Never show a stop's name on the HUD before arrival. The question rules
  still apply: the `name` of a street stop such as Jodenbreestraat or Golden
  Bend (Herengracht) answers a street question. Hide it the way
  `_destinationLabel()` already hides track names.
- Keep the stop's `why` card compact and near the bottom (see CLAUDE.md
  product principles).
