# Lane: streets, squares and waterways carry the name on the sign

Rules: `LANE-RULES.md`. Model: opus. Port: 4539. Branch
`lane/street-names-dutch-20261031` from `origin/main`, worktree
`/Users/blackmad/Code/map-recall2-worktrees/street-names-dutch-20261031`
(`scripts/worktrees/new.sh lane/street-names-dutch-20261031 <that dir> 4539`).

## The defect (TODO P0, found by L1 on 2026-10-30)

`streets-routing.json` names ways `routing_15692`, `routing_15693`,
`routing_21607` (52.372955, 4.900113) "New Market"; `squares.json`,
`all.json` and `facts.json` carry the same string. The sign says
Nieuwmarkt. Cause: `scripts/build-amsterdam-extract.ts` l.260 took
`tags['name:en'] || tags.name || tags['name:nl']` for roads and places. The
integrator changed that line to `tags.name || tags['name:nl'] || tags['name:en']`
(commit on `integrate/engine-programme-20261030`, "Extract generator: streets
keep the local name"); if `origin/main` does not have it yet when you start,
make the same one-line edit. Landmarks (`civicName`, l.164) and venues
(l.298) keep English on purpose ("Weepers' Tower", "Co-cathedral Basilica"
are product decisions); do not touch them.

## Regenerate

`scripts/refresh-amsterdam-extract.sh` runs the whole pipeline
(`refresh-city-extract.sh amsterdam …`): osmium filters on the archived
`.cache/osm-source/Amsterdam.osm.pbf` (never set `REFRESH_FORCE_DOWNLOAD`;
the OSM snapshot must stay the one the rest of the data was built from),
`build-amsterdam-extract.ts`, the teaching-streets ensure step, building
appearance, trees, wikimedia/wikipedia enrichment (cached), street
knowledge, translation, the English gate, bridges, `check-city-extract.ts`.
Read the script first and run it with a 1,800 s timeout. If an enrichment
step needs the network and fails, stop and report; do not hand-edit JSON.

## Review the diff

Before touching anything else, list every feature whose `name` changed in
`streets-routing.json`, `all.json`, `squares.json`, `facts.json` (old → new,
type, count by type). Expect Dutch names replacing English ones only
(Nieuwmarkt, Dam, Prinsengracht-style). Anything else that changed (feature
counts, geometry, enrichment text, images) means the refresh pulled in more
than the name rule; report it and ask before publishing. Grep the diff for
quiz-critical names pinned in `scripts/check-canal-car.ts`,
`check-canal-street-overlays.ts`, `tests/e2e/*.spec.ts` and
`src/canalRecall/**/*.test.ts` (Keizersgracht, Leidsestraat, Dam, Nieuwmarkt…)
and fix any pin that named the English form.

## Checks

`npm run lint`; `npm run test:canal-streets`; `npm run test:canal-car`;
`npm run check:extract-english`; `npm run test:reachability`;
`node --import tsx scripts/check-city-extract.ts public/data/extracts/amsterdam amsterdam`;
under the lock `PW_PORT=4539 /tmp/canal-pw.sh npx playwright test answered-street-name labels start-heading --project=desktop --workers=1 --trace off`.
Then `npm run world:verify` and say whether cells went stale (the
integrator recompiles if so).

## Hand back

The block from `LANE-RULES.md`; the name-change table; a screenshot of the
Nieuwmarkt label/answer card in the ride (before: "New Market") for the
What's New note; the list of extract files changed with byte deltas; which
bundles or cells the integrator must rebuild.
