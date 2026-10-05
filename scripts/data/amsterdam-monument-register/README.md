# Amsterdam monument source archive

Reusable source data for architectural research and street rhythm. `records.json.gz`
contains full municipal records and a bounded RCE property graph, with descriptions,
legal status, coordinates, explicit BAG Pand/VBO links and source identifiers. The two
registers remain separate; monument numbers are not globally unique across registers.
No facade recipes, construction years or game geometry are changed by collection.

## Commands

Run from the repository root:

```sh
npx tsx scripts/monument-register/archive.ts fetch
npx tsx scripts/monument-register/archive.ts resume
npx tsx scripts/monument-register/archive.ts refresh
npx tsx scripts/monument-register/archive.ts rebuild
npx tsx scripts/monument-register/archive.ts verify
node --import tsx --test scripts/monument-register/archive.test.ts
```

`fetch` and `resume` reuse successful cached requests. Failed batches retry and split;
missing singleton requests fail collection. `refresh` starts a new generation while
retaining the previous raw cache. `rebuild` and `verify` are strictly offline; verification
checks raw checksums, pagination, root and linked-resource request coverage, deterministic
snapshot hashes and the saved file. Optional `--cache=/path` and `--output=/path` override
the defaults. Raw gzipped responses and resumable state live in the ignored
`.cache/monument-register/amsterdam/`; the portable normalized snapshot and manifest are
committed here. A fresh checkout can read the snapshot without fetching sources; rebuilding
it requires its raw generation or a new collection.

## Scope and limits

Municipal collection follows every page, including withdrawn records. RCE scope is the
independent Amsterdam municipality inventory plus national monument numbers referenced
by the municipal register, including records filed under older municipality names.
Direct root properties, linked CEO resources and vocabulary labels are preserved;
nested BAG/BRK relations are fetched. This is a bounded architectural source graph,
not a mirror of the complete national linked-data database. The manifest records queries,
retrieval times, response checksums, coverage and missing fields/resources.

Descriptions are unchanged historical assertions, sometimes multiple per monument.
Missing text or BAG associations remain missing; address proximity does not create an
identity match. Municipal and RCE records can overlap. Their raw counts must not be added
as a count of distinct buildings. Listed buildings are a biased historic sample, not a
complete street inventory or an unbiased estimate of neighborhood style frequencies.
`scripts/fetch-monument-gables.ts` prefers this snapshot for its existing staged gable
classification; its `--publish` action remains explicit.

Sources: [Amsterdam monuments API](https://api.data.amsterdam.nl/v1/monumenten/monumenten/)
and [RCE linked data](https://linkeddata.cultureelerfgoed.nl/). Source provenance is retained
per record and in `manifest.json`. Keep original text and identifiers alongside any future
trait extraction so ambiguous or outdated assertions can be reviewed.
