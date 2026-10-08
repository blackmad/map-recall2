# Feedback account ui — preservation handoff, 2026-10-08

Branch: `fix/feedback-account-ui-20261008`. Original base: `5ffe7d3368229a6caf2501dabe537c6c5034e165`. Source snapshot: `416763adb741e55e8172b8a70df698678159c115`. Preservation commit: `c5f49bc890f5453cda8fa83a97f7c66c3607fb58`.

This branch was split from root's existing work without treating preserved drafts as accepted changes. It starts from the original common base so source bytes remain attributable; rebase/extract onto fresh upstream before publication. Branches remain local.

## Work preserved

- Feedback modal Cmd/Ctrl+Enter submission with IME/repeat guards, accessible shortcut hint and close after a successful save.
- Feedback launcher placed in utility controls, preserving visibility while setup/settings/help buttons are tucked.
- Utility-button/build-stamp layout changes for desktop, portrait and landscape; settings display the current account and expose sign-in/sign-out through existing callbacks.
- Existing feedback and utility-account Playwright coverage.

## Status and resume

This branch preserves the existing requested UI fixes; it does not change feedback database behavior or claim/resolve submitted notes. Root feedback tools/cache remain available to other sessions.

Run npm run build:canal-feedback and npm run build:canal-overlay before browser checks. Use a unique PW_PORT for tests/e2e/feedback.spec.ts and tests/e2e/utility-account.spec.ts on desktop and iphone. These checks require a runnable local server/browser; avoid another session's GPU review window.

The initial lint attempt used a node_modules symlink to root. Root contains @types/three from the canalhouse work, while this branch's original dependency manifest does not; resulting old viewer errors are an environment/dependency contamination and are preserved in validation notes. Use an isolated npm ci environment for release lint rather than changing unrelated viewers to silence it.

## Recovery and evidence

The complete local recovery snapshot is backup/root-dirty-20261008; its disk copy is map-recall2-cleanup-recovery-20261008 beside the original checkout. Logs and desktop metadata are saved on disk, outside topic commits. The cleanup manifest records every captured path/hash and its assigned branch. No private source checkout or other session worktree was reset, cleaned or modified.

## Cleanup validation (2026-10-08)

- Feedback and overlay bundles built successfully
- Failed in shared root node_modules: installed canalhouse @types/three exposes existing original-base viewer errors
- Three desktop Playwright tests successfully discovered; browser tests not run due unavailable coordination/network and active GPU ownership

## Reviewed integration — 2026-10-08

The UI source and tests were extracted additively onto current main in `fix/feedback-account-ui-release-20261008`; preservation branches remain unchanged. The build-stamp DOM placement is included with the control layout, so it participates in the utility grid rather than overlapping the buttons. Feedback and overlay bundles were regenerated from this reviewed source. No landmark/rendering source or queue data belongs to this change.

All six existing feedback/account Playwright checks pass on desktop and iPhone, including desktop/portrait/landscape button bounds and steering-pad clearance, settings account updates, draft retention after failure, successful shortcut submission and game freeze/release. The isolated server was verified to serve the patched utility-grid CSS on port49187. Earlier runs accidentally reused servers serving another checkout and are retained as invalid comparison evidence, not product failures. Root inspected the portrait control capture. Isolated dependency installation and commit lint pass. These checks use stubbed feedback/account responses; no real sign-in or cloud feedback note was submitted.

The reviewed UI is committed locally; deployment is a separate publication step. Local validation logs are in `artifacts/branch-organization-20261008/ui-isolated-tests.log`.
