# District rectification gaps

Updated 2026-09-26. Read-only audit of the **683 exact district owners with no current panorama frontage candidate** in the rectification queue. This is a selector-gap analysis, not proof that imagery does or does not exist for those buildings.

## Reproduced counts

The exact district owner set is assigned by the publisher's municipal footprint intersection and overlap priority, then intersected with the source inventory's frontage records. It is not a nearest-building join. The frozen source snapshots used here are:

| Area | Exact owners | Eligible frontages | Owners with a frontage | No-candidate owners | Queue hash |
|---|---:|---:|---:|---:|---|
| Da Costabuurt | 966 | 974 | 797 | 169 | `d76a0bef6e4fd742cf6491f4c20f5048250eb04173c5a5223b5f559e5d3fe35c` |
| Jordaan | 3,189 | 3,365 | 2,675 | 514 | `8911af57df17344b4eb995f9e4c43361d0c4fbafa47c3335567ead4b3e073fa7` |
| **Total** | **4,155** | **4,339** | **3,472** | **683** | — |

Reproduce the queue and the coarse prefilter breakdown from the repository root with:

```sh
node --import tsx --input-type=module <<'JS'
import { loadDistrictConfig } from './scripts/city-appearance/district-config.mjs';
import { planDistrictCoverageQueue } from './scripts/city-appearance/select-panorama-audit.mjs';
const file = 'scripts/city-appearance/districts/da-costa-jordaan-v1.json';
const district = await loadDistrictConfig(file);
for (const area of district.areas) {
  const q = await planDistrictCoverageQueue(
    { ...area.area, configHash: area.configHash },
    { districtConfigFile: file },
  );
  const frontageOwners = new Set(q.records.map(record => record.buildingId));
  const buildings = new Map(q.source.block.buildings.map(building => [building.id, building]));
  let noAddress = 0, heightAtMost5m = 0, both = 0;
  for (const id of q.ownerIds) {
    if (frontageOwners.has(id)) continue;
    const building = buildings.get(id);
    if (!building) throw new Error(`Owner missing from source block: ${id}`);
    const missingAddress = !building.addresses?.length;
    const tooLow = !(building.height > 5);
    if (missingAddress) noAddress++;
    if (tooLow) heightAtMost5m++;
    if (missingAddress && tooLow) both++;
  }
  console.log(JSON.stringify({
    area: area.id, queueHash: q.queueHash, owners: q.ownerIds.size,
    frontages: q.eligibleFrontages, frontageOwners: q.frontageOwners,
    noCandidateOwners: q.noEligibleImageryOwners.length,
    noCandidateWithoutAddress: noAddress,
    noCandidateHeightAtMost5m: heightAtMost5m,
    noCandidateBoth: both,
  }));
}
JS
```

For input identity, the area config hashes are `828ee39c434c47164a99fca00988d1e6f0f1403c7e7f9505fddfae030133cb75` (Da Costabuurt) and `7da960675b54c62353adde24492db03401026c91b2b32f03090915b1aec2e987` (Jordaan). The queue source block/inventory SHA-256 pairs are respectively `c9ce5a6c39480ca521b8fc36fa6d58b3256c1fc722683a83e5aacd1c1bcbd475` / `b4852a7f4358ee4802af2241e30e7dca92de198e995df791a48a988f3cdbe70c` and `1f083ec78967d180bcba185a2e1cb58d55381bc83c878087465f16cdc2b87e8d` / `d59d9cb97b27bd097bb9ae4a9b383a59014a98cdd8ae16cc5ce1af44599e9fb6`.

## What the selector evidence establishes

`prepare-neighbourhood.ts` has an initial selector requiring a BAG-derived block with at least one address and height greater than 5 m. For each selected block it builds BAG-footprint elevations, keeps wall segments at least 3 m long, requires a public-road face, and searches panoramas with a front standoff of at least 3 m, distance at most 52 m, viewing angle at most 48°, no more than one of three sampled target rays blocked, and a valid inferred lens. The district inventory stores successful frontage records; it does **not** store a reason record for each rejected owner or rejected wall/view.

The 683 current no-candidate owners break down against only the two measurable initial selector predicates as follows. Categories are mutually exclusive in this table; the independent predicate totals below overlap.

| Area | Fails address only | Fails height only | Fails both | Passes both but has no candidate |
|---|---:|---:|---:|---:|
| Da Costabuurt | 5 | 8 | 130 | 26 |
| Jordaan | 44 | 35 | 133 | 302 |
| **Total** | **49** | **43** | **263** | **328** |

Equivalently, 312 of the 683 have no address, 306 are at or below 5 m, and 263 satisfy both conditions. The union of those initial exclusions is 355 owners; 328 pass both but still have no generated frontage. There are no missing source-block owner records in this set. These are overlapping selector checks, **not** proven causal diagnoses: relaxing one gate can expose another.

For the 328 passing both, the inventory cannot attribute absence to road geometry, minimum wall length, panorama distance/standoff, view angle, self-occlusion, panorama lens inference, or combinations of those factors. The published count of 683 therefore must not be reported as “683 with no panorama,” nor apportioned among those downstream causes without instrumentation. The selector performs a per-wall and per-view cascade; only accepted records persist.

## Safest next tranche

First finish the already-frozen 4,339-frontage queue and review source identity/visibility on its crops. Rectification is evidence preparation only: current rectification progress records zero visually accepted frontages. Do not infer colour from its byte/nonblank preflight.

For a bounded gap-recovery experiment, start with the **49 no-address-only owners above 5 m** (5 Da Costabuurt, 44 Jordaan). Their canonical BAG IDs, exact publisher ownership and source footprints already exist; the address-presence gate is administrative metadata, not a wall-visibility measurement. In an isolated selector profile, remove only the `addresses.length` requirement, preserve the exact ID/footprint ownership and every downstream wall, road, panorama geometry, lens and occlusion rule, and generate a dry-run inventory. Process no more than one small batch initially. Keep each source crop attached to its exact BAG ID and withhold it if an independent visual identity check cannot identify that frontage. This can add usable evidence only where the existing geometry finds an actual view; it does not assume any of the 49 is photographable.

Do not combine this with a height-threshold change. A separate bounded dry run could test the 43 height-only owners, but the current wall construction and target-height quality assumptions need to be audited before broadening below 5 m. The 263 failing both gates are not the first tranche. For the 328 owners that already pass these coarse gates, add selector diagnostics per owner and wall before trying alternate limits; this will measure road-facing wall availability, view distance/angle, occlusion and lens failure without conflating causes. Any alternate candidate remains preview-only until identity is checked against the actual photo.

## Worker status observed

At 2026-09-26 20:03 UTC the detached `material-4000` worker was alive as PID `56190` (`node --import tsx scripts/city-appearance/run-district-rectification.mjs --source-profile=material-4000 --batch-size=100 --resume`). Its durable report showed five completed batches: 497 rectified frontages, 3 recorded omissions, 3,839 pending frontages, and 0 visually accepted; batch 6 was running. The log file was empty because the runner captures child output until each batch completes. There was no recorded error or failed batch at inspection time. This is a point-in-time status; check the PID and JSON progress file before relying on it.

The worker writes only profile-specific local crops and progress. This audit did not alter its files, start/stop it, download imagery, or modify its queue.

## Source locations

- `docs/plans/district-rectification-expansion.md` — queue policy and worker commands.
- `scripts/city-appearance/select-panorama-audit.mjs` — exact district owner/inventory intersection.
- `scripts/da-costa-block/prepare-neighbourhood.ts` — address/height prefilter and frontage/view eligibility cascade.
- `.cache/city-appearance/districts/da-costa-jordaan-v1/rectification/9ff86f256f18b3fe03d1f7693636976947c37ccba43be1ab08f7946947233389-material-4000-batch-100.json` — observed worker state; local generated evidence, not versioned.
