The repair pipeline now separates source selection, independent references, registration, paid image analysis, materialization, compilation, inspection and activation. The preserved release remains live. No photographic fidelity pass or repaired district release is claimed.

`active-development-manifest.json` identifies twelve cached replacement frontages. They do not resolve the twelve original image-numbered examples in `development-examples.json`. Source identity validation is separate from registration acceptance. `heldout-source-inspection.json` retains thirty disjoint candidates, fifteen per district; feature quotas and complete independent annotations remain uncertified. Do not extract or tune against that set until certification is complete.

`independent-reference-measurements.json` contains the primary agent's individual ground-photo inspections: 27 complete opening boxes and 13 partial visible extents across twelve photographs. Complete boxes use the assembly perimeter. Partial extents deliberately do not assert the hidden complete opening and cannot be scored as complete boxes. These are manually estimated source pixel annotations, not human review, metric measurements, extraction predictions or full-façade certification. Full-tier annotations remain missing. The earlier category-template annotations were rejected and are not reference evidence.

`registration-artifact.json` derives candidate transforms from native cached crop planes, preserving signed wall direction, crop margins and pixel-edge sampling. A candidate is accepted only with verified wall/orientation/boundary/roofline evidence, resolved datum and uncertainty ≤0.15 m. Camera-height inference is not certification. Multi-surface crops must be split into independently bound wall crops. Pavement/base contacts are distinct from entrance thresholds; source geometry and raised/basement geometry must be preserved.

```sh
npm run prepare:facade-registrations -- --input=scripts/city-appearance/fidelity/active-development-manifest.json --out=scripts/city-appearance/fidelity/registration-artifact.json
npm run extract:facade-details -- --manifest=scripts/city-appearance/fidelity/active-development-manifest.json
npm run test:facade-repair-pipeline
npm run report:facade-repair
```

The extraction dry run reconciles the live ledger. The `--run` flag is for a validated payable manifest only. Analysis keys depend on image bytes/dimensions, model, prompt, schema and extraction version; changing a registration or output path reuses the same saved image analysis. Reservations are serialized, phase spending is bounded, and saved responses are recovered and settled before new requests. Unresolved charges are never retried. Development is capped at $1, held-out/unseen together at $0.50, and expansion at $1.50, within $3 additional and the $5 cumulative ceiling.

`materialize-cli.mjs` attaches cached analysis only to matching observation, building, geometry, evidence, frontage, image hash and date. Existing human feature corrections, feature revocations, observation revocations and different captures are retained. Missing sources and unregistered tiers produce omissions. Both viewers compile the shared `FacadeDescription`; a withheld described tier cannot silently become a guessed opening grid.

Publication uses `publishAreaGeometryDemo({...,stageOnly:true})` (or `--stage-only`) to stage immutable artifacts without activating the pointer. A richer release must provide `evaluationIndex` for activation; the former `fidelityGateInput` booleans cannot authorize it. Each staged release includes `candidate.json`, which binds release ID, compiler hash, records hash, artifact inventory hash and the manifest bytes. Compiler source files and generated viewer bundles are also hashed; changes invalidate evaluation and activation. The previous exact pointer is retained under `rollback/` before atomic activation.

The evaluation index is `{version:1,candidate,evidence}`. `candidate` contains `releaseId`, `compilerHash`, `recordsSha256` and `artifactsSha256`. `evidence` has hashed `{path,sha256}` files for `run`, `references`, `predictions`, `compiled`, `captures`, `contacts`, `runtime` and `ledger`; paths resolve relative to the index unless a document declares its source/artifact root. `compiled` is the staged candidate descriptor. `evaluation.test.ts` is an executable fixture for the remaining evidence document schemas. It is synthetic testing, not photographic acceptance evidence.

The run document pins the active/held-out case content hashes, compiler/extractor versions, cases, named-shop case IDs, earlier fixture exclusions and fourteen runtime camera IDs. References are independent per-source annotations with source hashes/dates and inspection timestamps. Predictions must retain missing/abstained cases: clearly visible references still count as false negatives. The gate reports one-to-one IoU≥0.7 accuracy overall and separately for doors/windows, plus district breakdowns. It checks development openings and architectural assertions for awnings, materials and physical signs; source-linked ground contacts; inspected source/render captures; and candidate-specific runtime evidence including texture memory, clearance, deterministic compilation and disposal/rehydration.

```sh
npm run evaluate:facade-fidelity -- --index=/absolute/evidence/index.json --out=/absolute/evaluation.json
FACADE_CANDIDATE_MANIFEST=/absolute/staged/release/manifest.json npx playwright test tests/e2e/city-appearance-study-route.spec.ts
npm run activate:facade-candidate -- --release=/absolute/staged/release --evaluation-index=/absolute/evidence/index.json
```

The candidate camera option serves the staged manifest only to that browser session and writes captures under a candidate-specific directory. It does not change `current.json`. Activation rechecks all referenced bytes and recomputes the gate, verifies the evaluated manifest is the staged one, and rejects a changed/unresolved live cost ledger. Captures of the preserved release cannot qualify a richer candidate.

`repair-report.json` separates processing coverage, rendered-feature coverage and unmeasured reconstruction fidelity, and lists remaining blockers. There is no route expansion while photographic or runtime gates are incomplete. If held-out evidence informs any repairs, retire the set and establish a fresh untouched set before claiming generalization.
