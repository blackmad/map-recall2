# Map Recall

A geography learning game for Amsterdam, and the façade-twin pipeline that
supplies its buildings.

Two halves that share a repository:

- **Canal Recall** — the game itself, served from `public/canal-drive/`. Cycle the
  city, name the street or canal you are on, and get spaced review of the ones you
  keep missing.
- **The façade twin** — a pipeline that reconstructs Grachtengordel West's 3,025
  buildings from BAG parcels, 3DBAG massing and the municipal panorama archive, so
  the game can render a street that is actually that street.

## Start here

Six documents, and that is the whole set.

| File | What it holds | Read it when |
|---|---|---|
| [`docs/TODO.md`](docs/TODO.md) | The work board. Unfinished work only, P0–P3, with measured results and blockers. | Choosing what to do next. **Start here.** |
| [`docs/HISTORY.md`](docs/HISTORY.md) | Why things are the way they are. Part 1 is Canal Recall newest-first; Part 2 is the façade twin's numbered findings, §1 onward, cited from commit messages. | Something looks wrong and you want to know whether it is already known. |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | How a city becomes something the game can teach: extracts, facts, levels of detail, the renderer, appearance enrichment. | Working on the game or the data that feeds it. |
| [`docs/FACADE_TWIN.md`](docs/FACADE_TWIN.md) | The Amsterdam façade pipeline: scope contract, what the sources actually hold, the rebuild that shaped it. | Working on buildings. |
| [`CLAUDE.md`](CLAUDE.md) | Working agreement — verification expectations, worktree and integration rules. | Before your first commit. |
| [`DEPLOY.md`](DEPLOY.md) | Shipping it. | Deploying. |

Two more stay where they are because their location is the point:
`public/canal-drive/NOTICE.md` carries the upstream GPL attribution, and
`scripts/facade-twin/vision/README.md` documents the Python vision environment
beside the code that uses it.

## Viewers

Every viewer writes a single self-contained HTML file under `.cache/facade-twin/`.
Nothing is served; open the file. They are built on demand because most embed
photographs and are tens of megabytes.

**Start with the city map** — it is the only one that shows all 3,025 buildings,
and it is how you find a building worth looking at. Clicking a pand opens its deep
view when one has been built, so the usual order is:

```sh
npx tsx scripts/facade-twin/build-explorer.ts --split --limit=200   # deep views
npx tsx scripts/facade-twin/build-city-map.ts                       # then the map
open .cache/facade-twin/city-map/index.html
```

| Build | Opens | What it answers |
|---|---|---|
| `npx tsx scripts/facade-twin/build-city-map.ts` | `.cache/facade-twin/city-map/index.html` | **Where is everything.** All 3,025 footprints, coloured by what the house-number anchor said. Click one for 3DBAG's heights, its massing at each published height, and what we measured off the photograph. Vector only, so it is a megabyte rather than a gigabyte. |
| `npx tsx scripts/facade-twin/build-explorer.ts --split --ids=<pandId>` | `.cache/facade-twin/explorer/<pandId>.html` | **Everything known about one building.** The plan (footprint, wall, cameras, rays, address points), the footprint drawn into the raw panorama, the rectified strip from each independent view, the door band with any number read off it, and the numbers behind all of it. `--split` writes one page per pand, which is what the city map links to; without it you get one combined page. |
| `npx tsx scripts/facade-twin/build-contact-sheet.ts` | `.cache/facade-twin/contact-sheet/index.html` | **Does the strip set look like a street?** Every confident rectified façade in one grid, judged by eye rather than by percentile. |
| `npx tsx scripts/facade-twin/build-registration-review.ts` | `.cache/facade-twin/registration-review/index.html` | **Is this the right building?** One pand at a time, pictures as large as the screen allows, for adjudication rather than browsing. Answers land in `.cache/facade-twin/review.sqlite`. |
| `npx tsx scripts/facade-twin/build-help-wanted.ts` | `.cache/facade-twin/help-wanted/index.html` | **What needs a person.** The cases where geometry has gone as far as it can and a human glance settles it in seconds. |
| `npx tsx scripts/facade-twin/model-compare.ts` | `.cache/facade-twin/model-compare/index.html` | **Which camera model is right?** One pand, several panoramas, two camera models, side by side. |

## Instruments

These print rather than draw. Each one exists because a number was believed
without a control behind it.

| Command | Measures |
|---|---|
| `npx tsx scripts/facade-twin/check-number-anchors.ts` | **Identity.** How often the wall we projected is the house we asked for, judged by the number beside its door, with a decoy scored by the same rule. This carries the project's acceptance bar. |
| `npx tsx scripts/facade-twin/lens-sensitivity.ts` | **Whether a measurement holds still.** Re-measures stored façades with the lens deliberately moved. Its δ=0 pass must reproduce the store exactly, or nothing else it says means anything. |
| `npx tsx scripts/facade-twin/check-facade-registration.ts --inject=1.0` | **Whether the registration check can see.** Displaces BAG's boundaries by a known amount and reports how much of it comes back. |
| `npx tsx scripts/facade-twin/check-inferred-height.ts` | **Whether a guessed camera height is good enough.** Compares the inference against a datum-corrected published height across 97,120 frames. |
| `npx tsx scripts/facade-twin/number-bands.ts --audit-views` | **What the view ranking is leaving on the table.** Chosen obliquity against the squarest available, and what a swap would cost in resolution. |
| `npx tsx scripts/facade-twin/check-number-order.ts` | **Whether a house number is a position in a sequence.** Asks, with no walk and no street axis, whether number *n* lies geometrically between *n−2* and *n+2*; cross-checks against OSM's own geometry. 99.3% on clean triples. Guards the premise the whole anchoring design rests on. |
| `npx tsx scripts/facade-twin/check-lens-height.ts` | **Whether a published camera height is believable.** The zero sentinel was always caught; a height that is present but nonsense was not. 631 frames claim up to 97 m above the street, and believing one aims the band into the panorama's black nadir cap. |
| `npx tsx scripts/facade-twin/check-front-wall.ts` | **Whether the wall we project is the front.** From the building's own proportions — a canal house is narrow and deep, so a wall matching `plotWidthM` is a front and one matching `plotDepthM` is a flank. 96.2%. Nothing else tested an assumption every downstream measurement rests on. |
| `npx tsx scripts/facade-twin/build-blocks.ts` | **Where one terrace ends and the next begins.** Party-wall chains, front row only, writing `blocks.json`. Its own test is that chain order agrees with BAG house numbers 98.4% of the time, having never seen a number. |
| `npx tsx scripts/facade-twin/check-number-anchors.ts` | **Whether the wall is the right house, and separately whether the frame is right.** Identity from a pand's own doorplate; registration from doorplates naming anyone else's number, which no positional filter selects, against a chance null. |
| `npx tsx scripts/facade-twin/fit-block-shifts.ts` | **Whether a registration error is shared along a block.** It is not: blocks differ from each other less than the houses inside one differ among themselves, and held out the fit makes 17 of 25 predictions worse. Kept as the instrument that says so. |

## Checks

`npm run check:canal` is the pre-integration gate: typed checks, named driving and
reachability regressions, and the production Storybook build.

The façade-specific ones can be run alone — `npm run test:facade-camera`,
`test:facade-record`, `test:facade-boundary`, `test:facade-calibration`,
`test:facade-layer`, `test:facade-coordinates`.

## Data

Cached inputs live in `.cache/facade-twin/` and are not committed. Generated
extracts are written to
`public/data/extracts/amsterdam/staging/facade-twin/<area>/` and published into
versioned extracts only after review.

Panorama imagery © Gemeente Amsterdam, Kernregistratie Panoramabeelden (CC BY 4.0).
BAG parcels © Kadaster (CC0). 3DBAG LoD2.2 © TU Delft (CC BY 4.0), from AHN.
