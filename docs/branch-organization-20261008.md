# Branch organization — 2026-10-08

The existing mixed root work has been preserved as four topic branches, with original-source hashes, per-topic handoffs, regenerated owned runtime bundles, and a full recovery snapshot. Active session dependencies are retained in root. These are preservation branches; unfinished visual work is not accepted or released by this cleanup.

## Branches and recovery

| Branch | Final commit | Captured paths |
| --- | --- | --- |
| `wip/street-rendering-20261008` | `db0512d02958` | 81 |
| `wip/canalhouse-recipes-20261008` | `fcaeabb59c94` | 1760 |
| `wip/landmark-drafts-20261008` | `7844b6cbbac1` | 227 |
| `fix/feedback-account-ui-20261008` | `1eee0bd83f14` | 7 |

Each branch contains `docs/handoffs/<topic>-20261008.md` and a machine-readable file inventory. The four handoffs are also present in this checkout. Shared `package.json` scripts and street-rhythm plans were split by workstream. The panorama sampling export is identical on the street and canalhouse branches. The complete original package/JSON bytes and mixed local scripts commit remain in recovery, so splitting does not discard unassigned changes.

Original topic base: `5ffe7d3368229a6caf2501dabe537c6c5034e165`. Original root HEAD: `4d22ff17a6b390e9fe417ea088281cc145746ff0`. Full recovery branch: `backup/root-dirty-20261008` at `416763adb741e55e8172b8a70df698678159c115`.

Disk recovery: `/Users/blackmad/Code/map-recall2-cleanup-recovery-20261008/`. It contains copied source files, hashes, original index and binary patches. Logs and `.DS_Store` files are preserved on disk, outside topic commits.

The complete updated topic branches live in the independent local clone `/private/tmp/map-recall2-cleanup-20261008`, with worktrees under `/private/tmp/map-recall2-cleanup-worktrees-20261008/`. A durable verified bundle is saved in `artifacts/branch-organization-20261008/topics.bundle` in this checkout. Its manifest, validation logs and cleanup journal are alongside it. Do not push this bundle or preservation branches before reviewing private/raw reference inputs.

**Permission interruption:** filesystem permissions changed during execution. Original `.git` and sibling worktrees became read-only. Before that change, root gained the recovery branch and initial street/canalhouse preservation refs; the final documented tips above are in the temporary clone and bundle. Importing final tips into this checkout, changing root HEAD, and publishing main remain pending. No force push or rewrite of published main was performed.

When Git writes are available again, import the final branches explicitly (the two existing WIP refs have no subsequent user commits at the checkpoint; inspect before replacing them):

```sh
git bundle verify artifacts/branch-organization-20261008/topics.bundle
git fetch artifacts/branch-organization-20261008/topics.bundle '+refs/heads/wip/street-rendering-20261008:refs/heads/wip/street-rendering-20261008' '+refs/heads/wip/canalhouse-recipes-20261008:refs/heads/wip/canalhouse-recipes-20261008' 'refs/heads/wip/landmark-drafts-20261008:refs/heads/wip/landmark-drafts-20261008' 'refs/heads/fix/feedback-account-ui-20261008:refs/heads/fix/feedback-account-ui-20261008'
```

The initial street branch is checked out in `map-recall2-worktrees/cleanup-street-rendering`; release or update that worktree before importing its ref. Preserve its original source bytes. The original main worktree must remain on main while other sessions use it.

## Active ownership retained

- New landmark batch: all `scripts/landmarks`, geometry checks, the nine current landmark reference packs, npm dependencies and their recursively imported utilities. Its active target records include Mediamatic, Hannekes Boom, Meerpadkerk, Nieuwendammerkerk, This is Holland, Luther Museum, Posthoornkerk, Huize Frankendael and Uilenburger Synagoge. Worker files created after the snapshot are untouched.
- Landmark queue publisher: isolated `cafe-kobalt` worktree; private `source-archive` index exclusively belongs to that session. Root feedback tools, recipe/skill/instructions, cache and source/independent review artifacts remain available.
- Ordinary-building publisher: isolated `canal-box-release-recovery` and source/author/evidence worktrees. Its root-owned `docs/performance/2026-10-06/canal-belt-continuation-handoff.md` is retained.
- Ferry and elevation sessions already have separate branches/worktrees; their worktrees and all other session worktrees are untouched.

A static recursive import audit identified additional dependencies beyond the initial path lists: the shared panorama sampler, frontage planners, façade helpers, surveyed-envelope helpers and building mesh code. Their current root bytes remain intact. Root can therefore retain some dirty street/rendering source even though dormant trials/tests/models moved to branches. Uncertain shared metadata, queues and instructions remain in place.

Do not use broad staging, stash/reset/clean, rebuild every landmark, or treat old task status as authoritative. Fresh upstream already contains Electric Ladyland and Podium work that the stale root backlog mistakenly called pending.

## Checks and known failures

- Verified 2,075 original topic-file contents against the snapshot. The full snapshot contains 2,081 captured paths. Every captured path is preserved in a topic/recovery commit or disk-only recovery.
- Canalhouse: 103 recipe tests pass, TypeScript lint passes, review and signature-placement builds pass. Original roof/performance/visual acceptance holds remain.
- Street: 175 tests pass; one source-admission fingerprint test fails with `routing, curated identities or assignment compiler changed`. Do not relabel this work as accepted. Three-building/worker/pyramidal-roof builds pass.
- UI: feedback/overlay builds pass and three existing desktop Playwright tests are discovered. Browser checks were not run. Lint in the shared root dependencies exposes original-base viewer errors from canalhouse's installed `@types/three`; release lint needs an isolated install.
- Landmark drafts: owned runtime/gallery bundles regenerate; model geometry and visual acceptance were not changed. No GLBs were rebuilt or cloud feedback claimed/resolved.

## Main reconciliation and publication

Latest locally acquired upstream is `0abdd6a722b0c9d81190ef09dbc4a35f07ec0582`, the reviewed32 ordinary-building release, following `6789f77e`'s landmark batch. A docs-only reconciliation branch `chore/branch-organization-20261008` is prepared in the temporary clone. Its parent is current acquired upstream; it does not merge the mixed local scripts commit or publish held drafts.

A main push triggers Firebase deployment. Refresh upstream, coordinate an exact SHA/file publication window with existing publishers, rebase the docs-only change additively, and use a normal push. Network attempts in this session failed GitHub DNS under the new restricted profile. Session-coordination messages were rejected because MCP calls require approval while policy is `never`. No main push or deployment is claimed.

Root HEAD synchronization requires restored `.git` write access and an agreed author freeze. Before switching its baseline, snapshot all **current** retained changes, including changes since this cleanup. Semantically replay active changes over upstream and preserve root index ownership; do not reset the root tree to make it clean. The remaining root work and exact cleanup actions are recorded in `artifacts/branch-organization-20261008/`.
