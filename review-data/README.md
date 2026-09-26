**Durable reconstruction review artifacts**

`npm run review:reconstruction -- --write` creates content-addressed `snapshots/` and `runs/` here. These files are intended to survive disposable-cache cleanup. They contain saved review decisions, available binding manifests, and diagnostic reports. They do not archive every referenced image, mesh, analysis cache or browser-only draft.

Snapshots bind exact file bytes and the list of missing historical bindings. Run reports bind input hashes, evaluator code, source-image diagnostic state and the review snapshot. Repeating an unchanged run verifies and reuses it. Leave saved snapshots/runs immutable; a new input or corrected review creates a new version.

Use `npm run review:snapshot -- verify --snapshot <snapshot-directory>` to verify one snapshot. Restore only into an empty review directory with `npm run review:snapshot -- restore --snapshot <snapshot-directory> --out <empty-directory>`; inspect it before migrating anything back into a live notes store. Restore refuses overwrite and symlink destinations. Use canonical filesystem paths.

See [the execution handoff](../RECONSTRUCTION_HANDOFF.md) for current artifacts, next steps and known missing bindings. Saved notes may contain project-private feedback. This directory is outside `public/` and is not served as game content.
