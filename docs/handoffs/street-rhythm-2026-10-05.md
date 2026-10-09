# Street rhythm handoff — paused 2026-10-05

The user explicitly paused this work. Do not continue implementation until resumed.

## Branch and workspace state

- Main checkout: `/Users/blackmad/Code/map-recall2`, branch **main**, HEAD `635fc6a1` when paused. The completed changes were committed and pushed to main, not retained on a feature branch.
- Rhythm commit: `d8f7255f` — source-backed canal row recipes and reusable facade/crown assemblies.
- Refinement commit: `635fc6a1` — optional rounded heads, lighter cornices, stronger masonry, and recorded archive-led plan.
- Review worktrees are detached: `../map-recall2-rhythm-review` at `4763fdea`; `../map-recall2-refinement-review` at `eca1a356`. Their working files contain review/integration changes. They are not clean feature branches or authoritative current HEAD checkouts. Do not reset or delete them casually.
- Main has many unrelated dirty landmark, feedback and garden files. Git index was empty when paused. Preserve all drafts. In particular, current modifications to `street-rhythm-work.json` may include another task's work.
- A next implementation run should use a fresh dedicated branch/worktree from current main. Coordinate shared runtime bundles and git index with other sessions; concurrent garden/renderer commits landed during this work.
- This handoff itself is left as a local file, without another commit/push.

## Accepted scope and what changed

Observed Oudezijds Voorburgwal east bank 39–71: **100.15m, 18 native fronts**. No district-wide or city-wide acceptance.

Shared components now support whole-front two/three window groups, pale casing with dark inner sash, tall commercial/side-entry ground floors, paneled access leaves, connected stoops/open rails, quiet short returns, contained attic glazing and neck/bell/cornice crown families. Ten official monument identities explicitly constrain crowns. Native footprints, factual heights and construction dates remain authoritative.

Five earlier review cycles preserved failures before accepting this observed row. Shared roof fitting repairs attach ordinary roof ends to surveyed walls and close sky gaps.

Latest refinement adds an explicit `windowHead: 'flat' | 'segmental'` recipe decision. It is **one selectable shallow rounded style**, not all window tops. The current row assigns it to two fronts; sixteen retain flat heads. Curved casing/glass/mask agree. Optional flat relief headers/frames must not overlay the curved style. The initial conflicting-header capture is preserved under `refinement/`.

Observed source-front cornices use a 25cm face, 18cm projection and 10cm frieze, with unchanged native crown top and closed masonry slab. Other ordinary city cornices retain their prior proportions. Photo masonry has a clearer running-bond mortar overlay, without added wall geometry. Identical atlas cells share layers; 190 bay layers plus 64 procedural layers fit byte indices.

## Evidence and validation

- Latest comparison: http://127.0.0.1:5197/rows/oudezijds-39-71/refinement.html
- Original baseline versus latest: http://127.0.0.1:5197/rows/oudezijds-39-71/index.html
- Local artifacts: `artifacts/street-appearance/rows/oudezijds-39-71/`.
- Previous accepted captures: `final/`; first refinement with header failure: `refinement/`; corrected 24-view capture: `refinement-final/`.
- Final runtime captures/reports: `refinement-final/game-production/` and `refinement-final/phone-production/`; immutable bundles: `refinement-final/production-bundles/`.
- Independent visual report: `scripts/street-appearance/reviews/oudezijds-39-71/facade-refinement-review.json`.
- Final production report: `scripts/street-appearance/reviews/oudezijds-39-71/facade-refinement-production.json`.
- **88 street-appearance tests**, TypeScript and pre-push route-boot smoke test passed. Desktop and emulated touch passed all four modes, with no mode/revision mismatches or browser errors and unchanged rider detail ownership during coarse camera pan.
- Full-scene GPU measurements are variable headless M4 Pro Chrome observations, not a speedup claim or physical-phone benchmark. Latest three rounds: profiles-on median 2.57–4.65ms; profiles-off 3.64–4.25ms.
- Runtime catalog revision: `2b8597da5262de54`. Explicit accepted recipes are in `public/data/street-appearance/reviewed-row-profiles.json`; routine compilation retains the row. Candidate/evaluation files must not be automatically published.
- Artifact URLs require local servers. Review app was on 5196; artifact server on 5197. Artifacts are mostly local, not committed source images.

## Unresolved scope and next work

Adjacent south row, **48.38m**, remains withheld. Its original heldout exposed detached roof pieces and sky gaps. Shared geometry repair passes regression review, but does not turn the already-exposed challenge into fresh transfer evidence. A wider asymmetric frontage with three main windows beside a narrow access tower still needs a reusable grouping/entrance assembly. Freeze a fresh independent adjacent challenge before expanding.

Persistent plans and coverage are in `public/canal-drive/street-rhythm-work.json`:

- `oudezijds-facade-refinement`: complete-scoped.
- `oudezijds-next-south-compound-frontage`: capability gap, not accepted.
- `pre1905-canalhouse-archive-recipes`: queued source inventory.

The user's archive-led idea is **not yet a systematic inventory or modeling pass of every pre-1905 canal house**. Completed work is the reusable kit and one bounded street group. The new plan is to inventory native canal-side frontages, use cached monument descriptions and representative address-based Beeldbank elevations, extract recurring facade families into shared recipes, review whole groups and fresh challenges, then expand accepted coverage. BAG year is a discovery filter, not proof of present facade style. Avoid drifting into bespoke landmark meshes or exact photographed-building matching.

## Source ownership and resumption

Private source repo: `../map-recall2-source-data`, GitHub `blackmad/map-recall2-source-data`.

- Primary municipal source pack: archived commit `1b32bd4`.
- Frozen south evaluation pack: `a3d5c3c`.
- User refinement screenshot/provenance: `a6c4f10`, path `streets/oudezijds-voorburgwal-east-39-71-discovery/user-refinement/`; committed and pushed before the refinement commit.

Reuse existing archives before acquiring new sources. Preserve raw originals, dates, checksums, rights/access states and processed/raw distinction. Read current AGENTS.md and the rhythm queue before resuming. Freeze scope and source-derived critical traits, use an independent failure reviewer, personally compare references with native/game captures, and preserve failed evidence. Tests and completed cycle counts do not substitute for visual acceptance. User priority remains **street rhythm, not perfection**.
