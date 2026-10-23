# Agents: start here

This repository is Ride Amsterdam (the 3D ride, `public/canal-drive/` plus
`src/canalRecall/`) and Map Quest (the 2D quiz, `src/`). Any coding agent
(Claude, Codex, others) should read, in this order:

1. [`CLAUDE.md`](CLAUDE.md): the working agreement, product principles and
   verification rules. They apply to every agent, not only Claude.
2. [`docs/START-HERE-buildings.md`](docs/START-HERE-buildings.md), if you are
   adding or improving buildings: setup, the three kinds of building work,
   the acceptance bar, what you may edit, and how to hand work back.
3. [`docs/README.md`](docs/README.md): the index of living docs, plans and
   dated research.
4. [`public/canal-drive/TODO.md`](public/canal-drive/TODO.md) for open work,
   and [`public/canal-drive/HISTORY.md`](public/canal-drive/HISTORY.md) for
   why things are the way they are.

## Durable rules not covered elsewhere

- **Network sources.** DNS and network failures are often transient. Retry
  with bounded backoff, reuse cached responses (`.cache/`), and keep working
  on independent tasks between attempts. One failed request doesn't mean a
  source is permanently unavailable.
- **Queues.** Requested landmarks and deferred work live in
  `public/canal-drive/poi-work-queue.json`. Large ordinary candidates are in
  `public/canal-drive/dominant-building-backlog.json`, built by
  `scripts/landmarks/build-dominant-building-backlog.ts`; its thresholds live
  in the work queue. Requested street buildings are in
  `public/canal-drive/requested-street-buildings.json`. Don't drop an earlier request when a new
  one arrives. Ranking a candidate is not researching it.
- **Street rhythm.** Read `public/canal-drive/street-rhythm-work.json` before
  choosing or accepting a neighbourhood rhythm. Judge success by street-row
  composition: frontage widths, white trim, window groups, roof mixture and
  balcony frequency. Missing facade assemblies need generator improvements,
  not palette tuning.
- **Clicked buildings.** An ordinary building's card uses only mapped places
  inside its installed footprint (excluding courtyard holes). Never
  substitute a nearby POI.
- **Routes.** An explicitly chosen destination never silently becomes
  another POI when the network can't reach it; show a clear route failure.
  A chosen home or GPS origin stays fixed.
- **Performance work keeps facades.** LOD and startup optimisations must keep
  textured windows and ground-floor doors on surrounding buildings. Verify
  with a real camera pan on desktop and touch, not only rider-detail tiles.
- **Building-look modes** (photo, painted, storybook, …) must update geometry
  and colour consistently, including streamed tiles and in-flight worker
  results.
- **Shared files.** One agent at a time owns shared catalogue, dispatcher and
  bundle registration. Leaf agents work in their own worktree and branch,
  and return a commit SHA plus their verification results (see `CLAUDE.md`).

## Dutch localization

The game speaks English and Dutch behind a live toggle (`src/i18n`), and Dutch
trivia comes from Dutch sources, never machine translation. Read
`docs/nl-localization-handoff.md` for the current state and next steps, and
`docs/nl-localization.md` for the rules: `#key` for data-borne text, render-time
pickers, `data-i18n` markup, the municipal-register error policy
(`docs/amsterdam-street-name-register-errors.md` →
`scripts/dutch-street-origin-corrections.json`), and the fact provenance
requirements checked by `npm run test:dutch-facts` and
`npm run test:dutch-street-origins`.
