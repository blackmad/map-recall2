# docs/ index

Start here. Four files under `docs/` are living documents; the rest are
plans, lane handoffs, or dated research. Superseded handoffs, plans and
per-landmark closeouts moved to `docs/archive/` on 2026-10-22 (same file
names, same subfolders); nothing was deleted.

**Adding buildings?** Read [`START-HERE-buildings.md`](START-HERE-buildings.md)
first: setup, the three kinds of building work, the acceptance bar and the
hand-back report.

Other places to look first: `AGENTS.md` (entry point for any coding agent),
`CLAUDE.md` (working agreement),
`public/canal-drive/TODO.md` (unfinished work, ordered P0 to P3) and
`public/canal-drive/HISTORY.md` (why a thing is the way it is).

## 1. Living documents (keep current, edit in the change that alters the thing)

| Doc | Covers |
| --- | --- |
| `docs/START-HERE-buildings.md` | entry point for building work: setup, tracks, acceptance bar, hand-back |
| `docs/buildings-pipeline.md` | intent recipes to GLB, the component library, `kind: large` recipes, gates |
| `docs/elevation.md` | opt-in canal elevation: water levels, bridges, relief |
| `docs/LOOK.md` | art direction for the 3D view: one palette, era scheme, one light rig |
| `docs/gameplay/loop.md` | how a ride teaches: question budget, riding prompt, pacing numbers |

Sibling gameplay note: `docs/gameplay/bike-ferry-crossings.md` (one feature,
kept as its own page).

## 2. The plan

- `docs/plans/digital-twin-direction-20261013.md`: where the digital-twin
  approach falls short and what changes (sections: gameplay R1, buildings,
  look, ground, landmarks, process R5). This is the current direction; the
  other files in `docs/plans/` are older (section 4).

## 3. Handoffs

Lane briefs: the prompt a leaf agent works from, written by the integrator.

2026-10-13 lanes (current round):
`lane-gameplay-pacing`, `lane-look-consistency`, `lane-large-tier`,
`lane-ground-data`, `lane-glb-cleanup`, `lane-bag-base-tiles`,
`lane-citylook-atlas`, `lane-police-bureaus`, `lane-checks-and-docs`, all in
`docs/handoffs/` with the suffix `-20261013.md`. `lane-gameplay-pacing`, `lane-look-consistency`, `lane-large-tier` and
`lane-ground-data` have HISTORY entries; treat the others as open or
unconfirmed until TODO says otherwise.

Current external-worker brief: `deepseek-modeling-lanes.md` (operator setup,
lane rules, Track Z/M/L recipes, report template). Its lane rules apply to any
outside modeling agent; `START-HERE-buildings.md` is the shorter entry.

Still at the `docs/` root: `feedback-polling-handoff.md` (Firebase polling)
and `feedback-work-queue.md`.

Archived (`docs/archive/`): the older preservation handoffs from
`docs/handoffs/` dated 2026-10-05 to 2026-10-09 (`archive/handoffs/`), and the
root lane handoffs `rasphuispoort-host-opening-handoff.md`,
`landmark-backlog-handoff-20261007.md`, `landmark-finish-nine-handoff-20261006.md`,
`landmark-managed-resume-20261008.md`, `landmark-deepseek-handoff.md` and
`amsterdam-panorama-building-treatment-handoff.md`. Read them only when
resuming exactly that lane.

## 4. Research and spikes (dated; read for evidence, not for instructions)

"Superseded" means a living document now carries the conclusion; the file can
be archived once the integrator agrees.

### Direction, rendering and data (docs/research and docs/plans)

- `research/amsterdam-open-sources-20261009.md` (2026-10-09): verified open
  imagery and data sources for building recipes. Still the source list.
- `research/own-ground-20261009.md` (2026-10-09): own ground on AHN relief.
  Partly superseded by `elevation.md`; the AHN method detail is not copied.
- `archive/research/own-renderer-spike-20261009.md` (2026-10-09): renderer
  spike, shows lighting is the visible gap. Superseded by `LOOK.md` plus plan
  section on the shared frame. Archived.
- `research/drop-maplibre-20261010.md` (2026-10-10): inventory of what dropping
  MapLibre means, with a proof. Open; not superseded.
- `research/sol-canalhouse-salvage-20261010.md` (2026-10-10): what to keep of
  Sol's canal-house work and how to reuse house types along a street.
  Superseded by `buildings-pipeline.md` for the pipeline parts.
- `archive/plans/appearance-programme.md`: appearance architect plan.
  Superseded by `LOOK.md` and `buildings-pipeline.md`. Archived.
- `archive/plans/citywide-wall-colour-texture-rollout.md`,
  `wall-material-colour-diagnosis.md`, `wall-material-demo.md`,
  `material-demo-contextual-facade-issue.md` (all in `archive/plans/`): wall
  colour and material experiments. Superseded by `LOOK.md` (one palette
  module, era scheme). Archived.
- `plans/district-rectification-expansion.md`,
  `plans/district-rectification-gaps.md`: Jordaan and Da Costabuurt rectification
  before wider colour rollout. Not superseded; no living equivalent.

### Buildings and landmarks (docs root)

- `landmark-building-recipe.md`: the recipe for a landmark building. Superseded
  by `buildings-pipeline.md` for the pipeline, but §2–§7 (research sources,
  source archive, elevations format) are still cited by the start-here and
  lane docs; kept in place.
- `landmark-signage-audit.md` (2026-10-04): lettering audit. Not superseded.
- `landmark-splat-reference-pilot.md`: reconstruction as a reference, bounded
  pilot. Not superseded (sculpture splat track in TODO).
- `archive/landmark-magna-plaza-overlap-review-20261007.md`: Magna Plaza
  suppression repair. Historical; archived.
- `archive/building-coplanar-audit.md`: face overlap audit. Historical; the
  gate lives in `buildings-pipeline.md`. Archived.
- `amsterdam-street-name-register-errors.md`: errors found in the BAG
  `beschrijvingNaam` register. Evidence for the translation policy; keep.
- `archive/branch-organization-20261008.md` (2026-10-08): branch layout at
  that date. Stale; archived. `archive/dead-code-cleanup-2026-10-17.md`: a
  one-off cleanup report; archived.

### Per-landmark closeouts (docs/archive/landmarks, 29 files, 2026-10-06 to 2026-10-08)

One acceptance or hosted-closeout note per landmark: Afrikahuis (3), Cafe
Kobalt (2), El Tawheed, Electric Ladyland, Haparandaweg 2-4, 8-338, 9, 11-13
(7), Haring and Klimmuur (2), Mountain Network, OCCII, Pulitzer, RAI (2),
Rasphuispoort, Beest and Kesbeke, the 2026-10-06 reviewed checkpoint, and five
Vinoly notes. All are historical records of accepted releases; the decisions
live in the landmark catalogue and HISTORY. Archived as a group.

### Per-landmark references (docs/references, about 45 folders)

Source summaries and draft handoffs for individual buildings (fire stations,
churches, Huize Frankendael, Posthoornkerk, Uilenburger Synagoge, this-is-holland
and others) plus JSON review inputs. Provenance, not instructions; keep with the
model they belong to.

### Performance, 2026-10-06 (docs/performance/2026-10-06, about a dozen files)

Stationary-camera and city-building performance work: `README.md`,
`road-setup.md`, `stalls-and-fade.md`, the canal-belt journal and two
handoffs, and six ordinary-building pilot and review notes, with desktop and
touch baseline JSON. The ordinary-building notes are superseded by
`buildings-pipeline.md`; the rest are dated measurements (the method for
profiling lives in the auto-memory note "Perf profiling method").

### Desktop ride performance, 2026-10-13 (docs/performance/desktop-20261013.md)

Per-owner profile of the fixed desktop ride after the 2026-10-13 merges (default,
`?ownGround=1`, `?sharedFrame=1&cityLook=1`, aerial hold), the long frames and
their cause, the three fixes with before/after, and the budget the
`ride-perf.spec.ts` desktop run pins. Tool: `scripts/ride-perf-owners.mjs`.
iPhone profile pending.

### Root and canal-drive notes (outside docs/)

About 40 markdown files at the repository root and in `public/canal-drive/`
(for example `DESIGN.md`, `PRODUCT.md`, `DEPLOY.md`, and the 2026-09 experiment
and self-review files). Not part of this lane's move list; flagged here so the
next compaction pass knows they exist. `README.md` in `public/canal-drive/` and
`CLAUDE.md` stay.

## 5. Conventions

- A living document states its source of truth (the typed module or script) at
  the top and is edited in the same change as the code it describes.
- A lane handoff names what the lane owns and which files it must not edit.
- Research files carry a date in the name or heading and are never edited to
  change a conclusion; write a new file or update a living document.
- Screenshots and street names that report a failure are pinned as regression
  locations, not left in prose (see `CLAUDE.md`, Verification).
