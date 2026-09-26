# Expansion panorama source audit — 10 September 2026

The first new-area panorama gate is complete without inference or publication. Selection
`be950e97c54cab9950c80fa33846ca8bbc2a2477fe4284977d91dc481128f783` freezes 24
previously unreviewed frontages across 14 streets. It excludes buildings from the original
Da Costa study and uses street-median controls plus wide postwar/contemporary walls; it does
not use appearance proposals or known shop names.

Materialization downloaded or reused at most 48 unique municipal panoramas and produced full,
ground, roof and context crops for every selected wall. There were no omissions. The packet
contains 144 distinct source/crop files totaling 173,704,679 bytes. All recorded source and
crop hashes pass, and all crops pass the automated nonblank preflight. Source dates range from
29 April 2022 through 31 July 2025; dates remain attached per view rather than synthesized.

A photo-first agent review, performed before any proposal, found:

- 20 usable frontages covering 257.27 m;
- four partial frontages covering 32.94 m: one parked-vehicle obstruction, one tree-canopy
  obstruction, one scaffolded upper facade and one dark/vegetated full view;
- zero apparent wrong-building identities in this sample.

Partial means identity is supportable but complete appearance is not. It is not a negative
label for storefront, roof, colour or any other field. These assessments remain agent weak
supervision and are not added to the human reference set.

For a possible next bounded extraction of the 20 usable cases, the existing blended reference
workload estimate gives $0.0258 including 25% retry/usage allowance. Round the planning ceiling
up to **$0.04**. Prior measured cumulative spend remains $1.237401792 against the unchanged $5
authorization. This is a forecast, not permission to ignore the atomic journal: unknown charges
must still stop paid work. No inference or paid call occurred in this audit.

Reproduce or inspect with:

```sh
rtk npm run select:panorama-audit
rtk npm run prepare:panorama-audit -- --run
rtk npm run build:panorama-audit-sheet
rtk npm run review:panorama-audit
```

That next stage is now complete. The 20 usable cases produced 40 source-hashed, no-upscale
512 px JPEG inputs under immutable input-set hash
`d2f28a13d4be9c9b2f4f042e63d40b415003a6d416e1cf20883317cb2efe6c4e`. A one-case canary
preceded a resumable 20-case run. All 20 returned schema-valid conservative routing proposals
for $0.014493105 total, below the $0.04 run ceiling; the global journal has no unresolved charge.
The four partial cases were withheld. Proposals remain quarantined machine suggestions: the
evidence gallery shows them beside their inputs, but none is published as city appearance.

Open `panorama-audit.html` for the evidence/proposal comparison or reproduce with:

```sh
rtk npm run prepare:city-routing-inputs
rtk npm run infer:city-routing
rtk npm run infer:city-routing -- --run --limit=20 --budget-usd=0.04
```
