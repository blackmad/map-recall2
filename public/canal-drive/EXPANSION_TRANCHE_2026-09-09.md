# Da Costa expansion geometry tranche — 9 September 2026

Assuming the street-evidence review gate is satisfactory, the next conservative scale step
has been staged without publishing appearance detail or making paid calls.

The versioned `da-costa-tranche-400m-v1` configuration is an approximately 340 × 445 m
rectangle inside the source-pinned 550 m expansion inventory. Its deterministic selection
manifest binds the boundary to parent inventory
`df490817c6e82fc2137802f7de27cf651dc2499c1cfd3bf4ecde883f5ca82c87` and contains 422
intersecting operational BAG building IDs. This is a practical contiguous demonstration
tranche, not a claim that municipal street blocks have been counted.

Public-source acquisition completed with provider completeness checks:

- 422 compiled buildings from 432 intersecting BAG features and 414 3DBAG feature envelopes;
- 449 usable public-facing wall candidates selected from source geometry;
- BGT street, water, terrain, bridge, vegetation and street-context layers;
- 230 tree records, 2,017 address-unit records and 56 mooring records;
- 8,042 land-panorama metadata candidates available to source selection.

The offline run `7ea5c6b49ebd4de067d4773136f2a04334ef4507b749faffbff3c0e742b8be20`
compiled 422 neutral-geometry buildings into deterministic owner/halo tiles totaling 450,193
gzip bytes. It contains zero appearance observations, zero image downloads and zero paid calls.
The tranche remains staging-only: no panorama pixels were acquired, no model extraction ran,
and no human decisions were inferred from the user's review assumption.

At this scale the inventory JSON exceeded 64 KiB and exposed a child-stdout truncation bug.
The inventory producer now waits for its piped JSON to flush before exit; the full 449-record
inventory parses and the resumed compile/inventory/tile run completes.

Reproduce with:

```sh
rtk npm run select:expansion-tranche
rtk proxy node scripts/da-costa-block/acquire.mjs --area-config=scripts/city-appearance/areas/da-costa-tranche-400m-v1.json --inventory-only
rtk npm run pipeline:appearance -- --area-config=scripts/city-appearance/areas/da-costa-tranche-400m-v1.json --run
```

The capped [panorama source audit](./PANORAMA_SOURCE_AUDIT_2026-09-10.md) is complete:
20 usable frontages / 257.27 m, four partial frontages / 32.94 m, and no apparent wrong-building
identity in the photo-first agent sample. Immutable routing inputs and the bounded extraction
are complete: 20/20 schema-valid suggestions cost $0.014493105. They remain visible only in
the audit gallery, never promoted into appearance without calibration.

The [browsable expansion demo](./city-appearance.html?area=expansion) publishes all 422 source
buildings with separately streamed z16 context tiles and gzip transport. It marks audited source
walls green/ochre as a togglable coverage layer, not facade paint, and links every marked wall
back to its dated evidence. Browser checks cover desktop and mobile layouts, bounded residency,
source hashing, picking and zero review writes.
