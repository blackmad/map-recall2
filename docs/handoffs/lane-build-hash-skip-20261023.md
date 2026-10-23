# Lane: build-manual-landmarks skips unchanged builders

Plan §1 item 3. Rules: `LANE-RULES.md`. Model: haiku. A full
`node --import tsx scripts/landmarks/build-manual-landmarks.ts` re-runs all
355 builders and rewrites every GLB, then `check:landmark-lods` sees every
lod1 hash stale. With 600 more models that is the integrator's hour.

## Design

1. A source hash per model, written to
   `src/canalRecall/landmarks/modelSourceHashes.json` next to
   `modelAssetVersions.json`:
   - `toolchain` = sha256 over the contents of every `scripts/landmarks/*.ts`
     **except** `build-manual-landmarks.ts`, plus `src/canalRecall/landmarks/*.ts`
     (not the JSON files);
   - per id = sha256 of `toolchain` + the spec's JSON (`JSON.stringify` of
     the `MANUAL_LANDMARKS` entry) + the contents of every
     `scripts/landmarks/<id>-*.json` and `scripts/landmarks/<id>*.ts` that exists.
2. In the main loop, before building an id: if its recorded source hash
   equals the current one **and** `public/canal-drive/models/<id>.glb` exists
   with the fingerprint recorded in `modelAssetVersions.json`, keep the
   manifest entry as is and skip. `centraal-station`, `muziekgebouw-bimhuis`
   and `olvg-*` (built from code inside `build-manual-landmarks.ts`) always
   rebuild. `--only` and a new `--no-skip` force a rebuild.
3. Print per run: built n, skipped n, seconds. Record the full-run time
   before and after in the report (expect minutes → seconds when nothing
   changed).

## Checks

`npm run check:manual-landmarks`, `npm run check:landmark-lods` after a
no-change run (nothing stale), a change to one builder rebuilds exactly that
model, a change to a shared helper rebuilds all. `npm run lint`.

## Acceptance

The three timings in the report; hashes file committed; no GLB byte changed
by a skip run (`/usr/bin/git status` clean under `public/canal-drive/models/`).
