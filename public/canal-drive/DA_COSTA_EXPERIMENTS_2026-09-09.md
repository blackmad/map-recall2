# Da Costakade: extraction and review experiments

9 September 2026. Development evidence, not a building-accuracy benchmark.

**Final paid experiment total: $1.237401792 of the authorised $5.** No pending
or unknown charges remain. This includes older/stale trials and the failed
response, not only successful final proposals. No paid call was delegated to
the three parallel review agents.

## What is usable now

Run `npm run demo:neighbourhood` from this worktree. Open:

- [Neighbourhood demo](./da-costa-block.html?neighbourhood=1).
- [Tomorrow's 20-case review](./neighbourhood-review.html?queue=priority).
- [All street/roof evidence](./neighbourhood-review.html).
- [Original authored study](./da-costa-block.html), or [Elandsgracht](./da-costa-block.html?study=elandsgracht).

The local service defaults to `http://127.0.0.1:5195`. Evidence images remain in
the local cache, so opening the review HTML through an unrelated static server
will not provide its save API or photographs. No deployment was performed.

**103 elevations / 76 buildings** have four municipal-panorama views and
overhead evidence. The geometry inventory remains 171 buildings, including 159
matched 3DBAG models and 94 trees. This is the existing 260 × 278 m study,
not full coverage of a 250 m radius. Six selected candidates were omitted:
one blank crop and five stopped by the download cap. There are 190 cached
panoramas; rejected/earlier evidence is retained rather than silently relabelled.

## Experiments and decisions

| Experiment | Measured result | Decision |
| --- | --- | --- |
| Twin camera convention | Named world-aligned projection ignores vehicle attitude; synthetic invariance and crop consistency tests pass. Local legacy/new comparisons exposed old wrong-facing crops. | Use it for the new pipeline. Keep old camera APIs working; no claim that every old Amsterdam consumer has migrated. |
| Full + close ground + roof, Flash-Lite | 103 calls, $0.10878417; 41 usable storefront proposals, 22 awning proposals, 32 known street-only roof shapes. | Cheap broad appearance proposals are useful. Ground unusable means unknown, never an automatic residential negative. |
| Full facade only, paired 24 | $0.01244331; ten storefront proposals and six known roof shapes. Multi-view removed one institutional false shop suggestion, but did not demonstrate a broad shop-recall gain. | Coverage and two street sides account for denser shops; do not claim the crop ablation established accuracy. |
| Gemini 2.5 Flash, paired 24 multi-view | $0.014962662; nine usable storefronts, 14 known roofs. | No automatic model promotion from these counts. |
| Add aerial, Flash-Lite | 86 frontage calls (76 distinct buildings), $0.11668536; 70 known roof shapes versus 26 on the corresponding street-only calls. | More answers are not necessarily better answers: geometry agreement remained weak and invented ridges persisted. |
| Focused roof, stronger Gemini | Tight aerial + street top initially mistook a rooftop terrace for a dock. Wider aerial context and a neutral prompt fixed that case; both changed together. | Extend the stronger proposal pass to all 76 buildings, but preserve conflicting views and do not change mesh geometry. |
| Identical focused roof prompt, cheap model | Twelve contextual cases cost $0.0117609525; examples still invent a ridge or call a single apron a mansard. | Prompt improvements alone do not remove the weak-model roof failure. |
| GPT-5.6 Sol, same contextual roof packet | 12 calls, $0.06196410, 118 seconds total; 8/12 shape agreement with contextual Gemini Pro; 9/12 materials left unknown. | A useful alternative primary proposal model. Shared disagreements still require images and human labels; agreement is not accuracy. |
| GPT-5.6 Sol, paired 24 multi-view fronts | $0.147471885, 191 seconds total; exactly the same shop-presence answers as Flash-Lite on all 24, six different sign transcriptions. | No demonstrated reason to replace cheap shop detection wholesale. Strong text reading and critique can still help selected cases. |
| Image-only Codex review | Twelve cases: shop presence agrees with cheap output on ten; two should remain uncertain. Six deserve review; one thin/unusable wall crop is suppressed from machine appearance. | Useful critique, not human truth. Street-only unknown roofs versus overhead answers are not scored as extraction errors. |
| Frozen MobileNet + small logistic head | 18 usable human shop labels, five positives. Grouped three-fold balanced accuracy 0.562; only one of five positives recovered. | Candidate only, not promoted. Other tasks have insufficient class coverage. Preserve the original 76 human task labels. |

The stronger roof runs and GPT comparison are detailed in the machine-readable
`.cache/da-costa-neighbourhood/experiment-report.json`, including per-call
timing, cost, paired outcomes and context changes. Calls with changed prompts
or imagery remain separate. The shared spend ledger includes the early stale
ten-case trial and failed responses, not just the successful final dataset.

### Sterk without a name hint

The first-pass prompt contains no business name, address, BAG use or dimensions.
It asks for visible lettering without completing partial names. It independently
returned `STERK INGANG STERK` on building `0363100012236141`, the #7 frontage,
plus Sterk lettering on the connected #1/3/5 and #9 shop sections. Four frontage
records contain the name. These are observations, not automatic new signs.
The separate GPT multi-view pass also read Sterk on its sampled frontage without
being given that name. No generated sign was added to the scene from these readings.

The existing authored Sterk anchor predates this experiment and is not counted
as a newly discovered landmark. Its official contact page independently supports
[De Clercqstraat 7](https://www.sterk.amsterdam/contact); the pipeline output was
obtained before this corroborating check. Multi-address businesses must retain
several frontage intervals rather than painting an entire block as one shop.

### Roofs: separate three questions

1. What roof planes already exist in 3DBAG? A plane-normal/area heuristic records
   flat, opposing pitches, mixed sections or complex geometry; it is not truth.
2. What roof surfaces are visible overhead? Keep the yellow target footprint,
   wider context, source year and any clipping or relief displacement visible.
3. What is the decorative street-facing top? A stepped, bell or neck facade
   does not establish the shape of the roof behind it.

The renderer preserves the existing mesh. Median overhead colours are subdued
into a small shared palette; they are approximate roof appearance, not material
identification. Roof edges, shadows, terraces and rooftop equipment can contaminate
inside-footprint samples. Five buildings have incomplete aerial footprint coverage
(12 frontage records); these fall back to neutral roof paint and show a warning.
Two buildings have strong-model shape conflicts across street-facing views;
neither later call silently replaces the other. See the independent
[ten-building roof critique](./DA_COSTA_ROOF_CRITIQUE.md).

### Subscription review versus a primary GPT extraction service

The interactive agent pass and three parallel critiques use this working
session; the 36 GPT API calls above used the existing OpenRouter route and its
separate spend ledger. They are not billed against the ChatGPT Pro subscription.
The API comparison used `openai/gpt-5.6-sol`, low reasoning, source-hashed images,
the same schemas/prompts as the paired tasks, and no location/name hints.
[Official model capabilities](https://developers.openai.com/api/docs/models/gpt-5.6-sol)
support image inputs and structured outputs; measured provider charges above
are not a quote of OpenAI's direct API tariff.

At the observed rates, a repeat of 100 similar roof requests would be about
$0.52, or 100 three-image facade requests about $0.61, excluding retries and
future price changes. These are small-sample extrapolations, not fixed prices.
For this demo, a strong primary extractor is financially plausible; the
unresolved question is quality and source association, not the five-dollar cap.
Subscription quota cannot be converted from those API dollar amounts. A sensible
interactive review trial is 20–40 difficult cases in 5–10 compact batches, then
consult actual usage. [Subscription usage guidance](https://learn.chatgpt.com/docs/pricing).

## Parallel QA and verification

Three agents independently handled rendering, roof critique, and review workflow
hardening while the main session ran the remaining experiments and integration.
The renderer check verifies every applied wall association, rejects unusable
evidence, preserves authored landmark faces, tests texture state before/after
comparison, and captures desktop/mobile overview, shops and Sterk. Fixes included
separate brick/smooth material variants, a scrollable mobile inspector, and
frontage framing that widens field of view instead of moving inside the opposite
building. The roof mesh is unchanged.

Final identical-camera overview measurements: original **141 draw calls /
263,503 triangles**, neighbourhood **168 / 334,805**, Elandsgracht **176 /
354,344**. The neighbourhood applies **97 distinct frontage observations to
125 wall surfaces**; other cases retain fallbacks. Counts include renderer shadow
passes and are not frame rates. Final uncontended desktop/mobile capture checks
passed; an earlier screenshot attempt timed out while other browser tests were
running and was rerun successfully.

The review checks cover two-stage Enter, held keys and form focus, rapid
navigation/image races, empty queues and undo, save/reload/restart, export/import,
source/aerial staleness, preview refresh and mobile layout. Optional hidden text
suggestions record prior exposure and explicitly warn that the model-styled
preview prevents a fully blind gold-label session.
Roof volume and decorative facade top are separately editable; the inspector
shows accepted labels without silently replacing geometry. Missing facade-top
fields in older review exports remain compatible as unknown.

`npm run lint` and the existing `npm run check:facade-rebuild` passed. The legacy
router review test now uses port 5294 so it can coexist with the demo on 5195.
Budget tests intercept all requests and exercise reservation boundaries, restart
reuse and unknown-charge stopping without real calls.

Renderer metrics and captures are in
`.cache/da-costa-neighbourhood/render-metrics.json` and `render-*.png`.
The review page's initial image sources and layout findings were fixed. No
project ignore rules or manual design-check suppressions were added; automated
design hints stopped repeating after their edit threshold, so visual inspection
and browser regressions remain the verification evidence.

## Tomorrow's review

The priority session mixes difficult roofs and source problems with visible shops
and ordinary controls. Left/right changes the proposed wall; Enter opens the
appearance stage; a second Enter saves the visible choices. S skips, U marks
uncertainty, R rejects, Z undoes. Use the image/context views before agreeing
with a suggestion. A correct-building verdict does not certify metric registration.

Reviews are append-only and source-bound, including aerial evidence. Import
rejects machine-origin labels and stale image dependencies. No experimental
agent/API proposals are written into the existing human classifier-label file.
Names and newly distinctive awnings remain gated on placement review. The local
preview recompiles from saved decisions without another paid inference call.

High-value questions: is the shop on this wall or the next one; is a supposed
mansard really flat behind a single apron; are distinct facades combined under
one BAG building; and does a changed capture date explain differing storefronts?
The 15–30 minute estimate is a planning allowance, not measured review throughput.

## Reproduce without paying again

```sh
rtk proxy npm run demo:neighbourhood
rtk proxy npm run publish:neighbourhood
rtk proxy node scripts/da-costa-block/summarize-neighbourhood.mjs
rtk proxy npm run test:neighbourhood
rtk proxy node scripts/check-neighbourhood-render.mjs
rtk proxy node scripts/check-router-review.mjs
rtk proxy npm run check:facade-rebuild
rtk proxy npm run lint
```

Paid runner: `scripts/da-costa-block/infer-neighbourhood.mjs`; modes `full`,
`multi`, `aerial`, `roof`. It checks source bytes, shares a lock and spend ledger,
reserves before a call, caches each configuration, and stops on unknown charges.
The user-authorised ceiling is $5. Credentials remain in the ignored private
environment file and are never copied into public data.

Agent review has a hash-pinned image-only input packet. Regenerating that packet
invalidates the saved visual notes: do not reuse their answers against new pixels.
The classifier candidate is in
`.cache/facade-rebuild/router-review/models/da-costa-day-2026-09-09/`.

## Remaining limits

No human acceptance or recognition result yet; no full-radius acquisition;
no exact registration, datum solve, automatic storefront-name deployment or
window measurement. Multiple image interpretations are not an independent test
set. Desktop/mobile checks use a browser emulator, not a measured physical-phone
frame-rate benchmark. Further training should wait for useful human labels,
especially positive storefronts, roof hybrids and hard placement failures.
