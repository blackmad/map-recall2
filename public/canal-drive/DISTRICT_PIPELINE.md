# Da Costabuurt + Jordaan reconstruction

Start the local application:

```sh
npm run demo:neighbourhood
```

Open http://127.0.0.1:5195/canal-drive/district-evaluation.html for the coverage report and thirty-case source/render gallery. Open http://127.0.0.1:5195/canal-drive/city-appearance.html?area=expansion for the connected 2,004 m street tour, or http://127.0.0.1:5195/canal-drive/ for Map Recall, then choose the study route in the route setup. The active immutable release is recorded in [current.json](../data/city-expansion/current.json); the gallery and source viewer accept `?release=<releaseId>` to retain a specific release.

The verified release ID is `c4bebc1fcc1ad9622ea4972755b3eee69f037928db4573219c86d2c4e088920d`. Its [coverage and cost report](../data/city-expansion/evaluations/c4bebc1fcc1ad9622ea4972755b3eee69f037928db4573219c86d2c4e088920d/evaluation.json), [cost ledger](../data/city-expansion/evaluations/c4bebc1fcc1ad9622ea4972755b3eee69f037928db4573219c86d2c4e088920d/cost-ledger.json) and [Amsterdam forecast](../data/city-expansion/evaluations/c4bebc1fcc1ad9622ea4972755b3eee69f037928db4573219c86d2c4e088920d/amsterdam-forecast.json) are published together.

The combined release contains 7,395 unique active BAG buildings, including the complete acquired envelopes around both districts. Exact municipal boundary membership identifies 966 Da Costabuurt buildings, 3,189 Jordaan buildings and 3,240 surrounding buildings. The frozen eight-feature municipal boundary snapshot, source hashes, RD coordinate frames and ownership travel with the release. Acquisition halos are explicitly reported and never counted as additional district buildings.

There are 598 photographed frontages. The route inventory has 598 eligible frontage IDs across 4,087.56 m; 585 were processed, covering 3,940.98 m (96.4%). By district the processed length is 99.2% for Da Costabuurt and 94.1% for Jordaan. The report separately lists 23 route buildings without an imagery candidate, whose missing frontage length is unknown, 13 omitted candidate frontages, and 25 processed frontages without a compatible render-wall binding. The available source geometry remains visible when appearance detail is omitted.

Machine observations are **unreviewed**, including storefront classes and literal signs. Byte/crop preflight is not a visual identity audit. Storefronts and eligible literal signs are enabled by default, with source image hashes and dates. Machine awnings remain disabled; machine wall colour is opt-in. Source roofs are retained when compatible; unsupported roof proposals never replace them. Window rhythms, glazing dimensions, frame colours, tree crowns and sign-band placement remain procedural display choices. The per-record revocation registry is `scripts/city-appearance/districts/appearance-revocations-v1.json`; add an ID and reason, optionally an evidence key, then republish to revoke an observation without inventing a human review.

The run used **$0.453310605 additional inference**, within the authorized $1; cumulative settled spend is **$1.705205502**, within $5, with no unresolved charge. A complete coordinator evidence/inference resume performed zero additional paid requests. The authorization file preserves the task's starting ledger value; reruns cannot reset that allowance. Unknown charges stop the paid runner before another request.

## Reusable coordinator

```sh
# Read-only plan; no downloads, requests or publication.
npm run pipeline:district

# Public acquisition, cached geometry, evidence, compilation and validated local publication; no paid inference.
npm run pipeline:district -- --run --spend-limit-usd=0

# Resume the already-authorized route extraction in sequential batches of at most 25.
npm run pipeline:district -- --resume --stages=evidence,inference --spend-limit-usd=1

# Recompile and activate a validated combined immutable release.
npm run publish:district-demo
npm run report:district-evaluation
npm run publish:district-evaluation -- --capture --base-url=http://127.0.0.1:5195
```

`--district-config` selects an area collection with priorities, municipal boundary pins, resource limits and an optional connected route configuration. `--stages` selects acquisition, geometry, evidence, inference, compilation, validation and local-publication. The existing `pipeline:appearance` area runner remains offline. The coordinator performs network acquisition only when required, uses existing completeness-checked adapters, and verifies artifact hashes before reuse. Stage journals record dependencies, completion and failures under `.cache/city-appearance/districts/<district>/<configHash>.stages.json`. Invalid artifacts are isolated, valid model outputs are reused across overlapping acquisitions, and inference runs have both a local ceiling and the global atomic spend journal.

The 3DBAG adapter checks the API's provider seed-row count separately from hierarchy-expanded CityObjects. Jordaan's archived 118 pages were independently rechecked: 11,766/11,766 provider rows, exhausted pagination, valid page hashes, and four additional hierarchy objects. A higher CityObject total does not imply missing pagination.

A third, nonadjacent area was acquired and compiled through the same configuration interface: **Oosterpark, 936 buildings and 6,107 context features**. Its building/context tile payloads total approximately 5.89 MB compressed. Reproduce its offline geometry stage with:

```sh
npm run pipeline:district -- --district-config=scripts/city-appearance/districts/oosterpark-extensibility-v1.json --stages=geometry --resume
```

The Amsterdam forecast uses the pinned local building-index workload of 342,993 features, not a municipal BAG census. It extrapolates source-crop and raw-panorama storage, geometry/detail bytes, measured inference latency and request cost for one and two frontages per building. It includes 25% inference cost overhead. Acquisition/crop-generation time, service changes and human review labour remain outside the estimate; full-city paid extraction has not run.

## Evaluation and rollback

Each release-scoped evaluation directory contains `evaluation.json`, `comparison-packet.json`, `cost-ledger.json`, `amsterdam-forecast.json`, source/render captures and an artifact hash index. The thirty cases are selected reproducibly across districts and machine positive/negative/unknown outcomes; named development examples are excluded. Their human review fields remain pending. Captures preserve source identity, dates, evidence tier and omission reasons without modifying review records.

The game uses one viewport-wide detail allowance across catalog areas. The render-ready barrier checks opaque massing, painted detail layers, settled tile loading and the 11 MB aggregate detail ceiling. Footprint and camera-to-road visibility checks keep the phone camera clear of buildings. The final fourteen-camera matrix passed in both layouts, with maximum aggregate detail buffers of 8.12 MB on desktop and 6.56 MB on emulated iPhone. Repeated route traversal and overview transitions test disposal and rehydration. A separate source-positive development view verifies readable FEST signage without entering the held-out thirty-case packet. Detail density is reduced under the resource budget; the full-city massing fallback remains available.

Validation commands:

```sh
npm run lint
npm run test:city-appearance
npm run test:district-pipeline
npm run test:district-publication
npm run test:district-evaluation
npm run test:machine-signs
npm run test:district-gallery
npm run test:city-expansion-demo
npm run test:city-appearance-game
```

Browser captures are desktop and emulated iPhone layouts. Some phone checkpoints have weak composition because foreground buildings and trees obscure façade detail; clearance and residency assertions do not establish visual quality. Human spot-check completion and physical-device performance remain unmeasured. Headless frame timings are recorded as diagnostic measurements and are not physical-device performance claims.

Previous immutable releases remain available. To roll back locally, copy the chosen release's `manifest.json` to `public/data/city-expansion/current.json`; the catalog already points to that stable URL. The earlier 825-building study and the initial combined release are retained.
