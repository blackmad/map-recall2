# Large tier sheet (2026-10-29)

What the `kind: large` recipe tier has produced, what blocks it, and the
rules a review turn applies. Update the numbers with each integration.

## Yield so far

| Run | Reviewed | Pass | Installed |
|---|---|---|---|
| Factory batches 1–2 (2026-10-24, unattended drafts) | 27 | 0 | 0 |
| Acceptance re-run on the new kit (#45) | 28 | 3 | 0 (gate refused all three on street walls) |
| Ride-visible top 40 (#105, Opus hand passes) | 17 | 0 | 0 |
| Skill self-test, triage-selected punched/ribbon fronts (2026-10-29) | 9 | 1 | 1 (Molenwerf 1; 5 holds on gates, 3 on kit gaps, 1 no-evidence) |

| Installed large recipes (all time) | 117 |
|---|---|
| Likeness pass on every street group | 7 |
| Installed with `--allow-inferred` notes | 96 |
| Gates only (pre-gate installs) | 14 |

Reading: the tier installs almost nothing under "every street group must
PASS", and almost everything it has installed went in under a reviewed
strip plus inferred notes. Open issue #59 says about 85 of the installed
houses are refused by today's gate.

## What passes

Brick grids with punched or column windows on a rectangular 3DBAG shell,
photographed from the street at under 45 degrees with little foliage:
schools, libraries, offices and civic blocks from 1900 to 1990. The kit
has stone bands, arch heads, piers, corbels, paired windows, balconies,
loggias, plinths, cladding bands and a curtain-wall system, all measured
from the crop by `measure.ts`.

## What does not pass, and why

1. **Glass curtain fronts.** Lane #114 made the judge read a curtain group
   on its spandrels or grid colour, and found the FAILs are real: the
   photo's 13 to 30 % "wall" is floor bands 0.5 to 1.5 m tall at the storey
   lines, which the kit's spandrel-less curtain system cannot draw (model
   glazing 0.97 to 0.99 against the photo's 0.70 to 0.87). A kit lane for
   floor bands is the unlock, not a judge change.
2. **Towers.** Crops stop at 32 m (`rectify.ts wallHeight`,
   `Math.min(..., 32)`), so upper storeys never have evidence.
3. **Curved and stepped fronts.** Crops pair to single 3DBAG facets
   (0.5 m, 5 degrees, 60 % overlap); a curved Amsterdam School corner
   splits into hundreds of facets that nothing pairs with.
4. **Photo quality.** Foliage over 25 %, washed-out glass over 30 %,
   obliquity over 45 degrees, or a crop older than the building: NO
   EVIDENCE, by design. Do not build from a guess.
5. **Kit gaps** (see `docs/handoffs/kit-gaps.md`): channel glass, slab
   balconies and ribbon parapets, mural fronts, metal rib and louvre
   cladding, sawtooth and folded roofs, a warehouse with a modern block on
   top where the BAG footprint differs from the LoD2.2 shell.
6. **Identity noise in ranked lists.** Name merges (one office drawn by
   four OSM parts), underground stations, twin BAG registrations of a
   modelled building, pands missing from the tiles. Triage removes these
   before any draft.

## Expected yield by front class and evidence

| Photo front class | Judgeable crops on 2+ street walls | Expect |
|---|---|---|
| punched / columns, brick or stone family | yes | buildable; roughly 1 in 3 passes on first compile, more after one `fix` |
| ribbon | yes | buildable; watch `rowMismatch` (ribbon one side, punched the other) |
| curtain | any | `kit-gap` until the kit draws floor bands (see blocker 1) |
| blank, mural, cladding | any | `kit-gap` |
| any | no | `no-evidence` |
| any, over 32 m | any | `kit-gap` (crop cap) until parametrised |

## Inferred-install policy

Pending the user's answer on #112. Until then: a group installs as inferred
only when the house has a `pass` verdict on its strip and the group carries
a note saying what was inferred from what (`--allow-inferred=<group>:<note>`,
eight characters at least). A group whose likeness verdict is FAIL never
installs. The catalogue entry then carries
`reviewState: large-recipe-likeness-inferred` and one `limitations` line per
group, which is how 95 of the 116 installed houses are recorded.

## Costs to beat

- Ordinary rows by agent-per-house: about 3 M tokens per house (#98: 50
  houses for 167 M; #97: 72 M for none). Stopped by the user 2026-10-29.
- #105: about 130 Opus turns for 0 installs.
- Target for this lane: one Opus turn per 20 houses reviewed, under 10
  turns per install including fixes. The queue records it since #111; the
  first run measured 1.7 turns per reviewed building and about 19 turns
  per install.
