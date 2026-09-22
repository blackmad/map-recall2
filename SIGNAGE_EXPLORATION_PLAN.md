# Shop signage and notable street detail: exploration plan

Status: plan, written 2026-09-22; owner direction added the same day (§1a). Not started. Roofs
(`ROOFLINE_FROM_PHOTOS_PLAN.md`) have priority; this runs when the owner says so.
It is a task spec under `public/canal-drive/TODO.md` item 10.

## 1. The question and the decisions it feeds

**Why:** signs are how people navigate a street ("left at the Albert Heijn, past
the Fotolab"). For a geographic learning game they may be worth more per unit of
effort than any window. But a wrong sign is worse than no sign: it teaches a
false landmark.

**The exploration ends in three decisions, each with a rule fixed now:**

| # | Decision | Options |
| --- | --- | --- |
| D1 | **Reader:** what reads sign text and position from the photos | keep the current Gemini call · a local OCR · a local VLM · a stronger hosted VLM · none |
| D2 | **Look:** how a sign appears in the game | current generic band (baseline) · styled sign (measured colours, case, font class, size, position, shape) · rectified photo decal |
| D3 | **Policy:** can signs stay on by default, unreviewed | yes · only after owner approval per sign · off |

## 1a. Owner direction (2026-09-22). These override the options above

- **D1: local.** Only local readers compete: R-ocr, R-vlm-local and their
  combination. The hosted VLM is dropped. The existing Gemini text is scored only
  as a reference point, not as a candidate.
- **D2: capture a rough sense of the real signage.** The goal is that a sign
  looks like *that* shop, not like a generic label: its colours, lettering
  character, placement and shape. The owner's reference shops are **Moeders**
  (Rozengracht 251, already a repair case, with "Moeders sign absent" in its
  self-review), **Dijkman** and **Bakkerij Wolf** (addresses to come from the owner;
  neither is in our data yet). These three are fixed members of the S4 bake-off and
  must be in the S0 sample. The generic Arial band (option A) stays only as the
  baseline to beat.
- **D3: unreviewed.** Signs ship without per-sign review, with provenance and the
  existing revocation registry. Owner labels exist **to test and choose the
  models**, not to gate each sign. §6's D3 rule is replaced by this. The invention
  rate is still measured and reported, and it becomes a D1 threshold (a reader that
  invents signs cannot be adopted), not a policy switch.

## 2. What exists today (verified 2026-09-22)

- **One reader, never measured.** `scripts/city-appearance/infer-routing-inputs.mjs`
  asks `google/gemini-3.1-flash-lite` (OpenRouter, paid) for one `signText`
  string per frontage, plus `signTextEligible`, inside a routing schema that
  covers much more than signs. The active release `c4bebc1f…` renders
  **307 literal sign bands** from 585 processed frontages, all unreviewed.
  **Nobody has measured how often that text is right, or invented.**
- **One look.** `src/canalRecall/cityAppearanceMachineSigns.ts` draws every sign
  the same way: Arial bold, cream on dark green, 0.55 m tall, centred at a
  **fixed** height above the ground-floor band. None of the sign's real position,
  size, colours or style is used.
- **Storefront structure exists.** `src/canalRecall/facade/storefrontAssembly.ts`
  groups display glazing, entrance, fascia and awning; `retailPatches.ts` /
  `retailCompiler.ts` turn that into patches. They never invent sign text.
- **Hand repairs show the ceiling.** Retail cases 03 (het Fotolab), 21 (De
  Fietsenmaker) and 29 (DORUS) were repaired by hand with separate fascia, canopy
  and awning text (`scripts/review/retail-stage-readiness.md`). That is the target
  look, reached one building at a time.
- **A known delivery bug.** The Moeders sign tile didn't become resident in the
  game smoke test (`CITY_RECONSTRUCTION_REVIEW.md`). An isolated render doesn't
  prove a sign reaches the game.
- **Sources.** Ground-floor crops at 110 px/m exist for the release frontages
  (`prepare-neighbourhood.ts`), and the panoramas carry about 140 px/m at
  typical standoffs. A 0.5 m fascia letter band is 55–70 px tall: readable.

## 3. Scope

**In:** fascia/name boards, projecting blade signs (including historic
uithangborden), window lettering, awning text, and brand marks that stand in for
text (the Albert Heijn "ah", the HEMA logo). **Also recorded:** gevelstenen
(carved gable stones), since they are notable and permanent. They are tagged in
the gold set but not decided here.

**Out:** interior shop contents, menus and opening hours, posters and temporary
banners, street furniture.

**Time matters.** Shops change. Every sign keeps its capture date, and when two
views of different dates disagree, the newest wins and the older one is kept as
history, not deleted.

## 4. The sample and the gold set

**Sample (fixed before any reader runs):** 80 frontages from the active release,
seeded and stratified:
- 40 where Gemini returned sign text (to measure its accuracy and invention rate),
- 25 where `groundType` is storefront but no text came back (to measure misses),
- 15 residential or unknown (to measure invented signs on buildings without any).

At most 2 per street segment, and none of the retail repair cases (03/21/29),
which were tuned by hand.

**Gold, from the owner** (the owner offered to grade; an agent never labels its
own ground truth). A labelling page shows the ground crop for each frontage. For
every sign, the owner draws a box and types the text exactly as it appears, then
tags type (fascia / blade / window / awning / logo / gevelsteen) and "readable at
street distance?" (y/n), and clicks once on the sign's background and once on its
lettering to sample the two colours. "No sign" is a valid answer. Estimate: 20–25 minutes
for 80 frontages. Frozen with a sha256 before scoring.

## 5. Tasks

Rules as in `ROOFLINE_FROM_PHOTOS_PLAN.md` §5: own worktree and branch per task,
typed logic in `src/` with a test, no edits to `package.json` / `TODO.md` /
`HISTORY.md` / bundles, commit SHA plus commands plus one overlay per task, and
stop on a false premise.

### S0: Sample, crops, licence check (DeepSeek)
1. Build the stratified sample (§4) from the release records, **plus Moeders
   (Rozengracht 251), Dijkman and Bakkerij Wolf** (cut fresh strips for any that
   aren't in the release, using the strip cutter); write
   `review-data/signage/v1/sample.json` with the seed.
2. For each frontage, cut a sign-band crop at native resolution (≈140 px/m;
   ground to 5 m up, with margins) using the existing rectifier. Keep the 110 px/m
   crop too.
3. **Licence check:** find and quote the licence of the Amsterdam panorama
   imagery. D2's photo-decal option is only allowed if it permits
   redistribution inside the game. If unclear, stop that option and report.
Done when: sample, crops, contact sheet, and the quoted licence with a URL.

### S1: Labelling page (DeepSeek)
A page like the roofline grading page (A6): crop, drag a box, type the text,
pick a type, next frontage by keyboard. Export/import JSON bound to the crop hash.
The owner labels. Integrator freezes `review-data/signage/v1/gold.json`.

### S2: Readers (in parallel; each emits the same JSON)
Output per frontage: `signs: [{ text, type, boxPx, boxWallM, fg, bg, case,
fontClass (serif / sans / script / display), confidence }]`, or an explicit
`signs: []`.
- **R-gemini:** the existing `machineRoutingProposal.signText` values, converted.
  Free, already paid for. Text only, no box.
- **R-ocr (DeepSeek):** PaddleOCR (PP-OCRv5) on the sign-band crops: detect
  lines, recognise, merge into signs. Local.
- **R-vlm-local (Sonnet):** Qwen2.5-VL-7B, or Florence-2-large OCR-with-region, run
  locally (MLX or MPS). Ask for signs with boxes, colours and font class in a
  strict schema. Local.
- **R-vlm-hosted: dropped by the owner (§1a, D1 is local).** Was: one stronger hosted VLM
  on the 80 frontages only, same schema, through the existing budget ledger. At
  roughly a cent per frontage, under $1.
- **Two readers together:** where R-ocr and a VLM agree on text, accept it;
  where they disagree, abstain. Scored as its own reader.

### S3: Scoring (DeepSeek)
Against the frozen gold, per reader. Text is normalised (case, whitespace,
diacritics, punctuation) before comparing:
- **Main-name accuracy:** the largest sign per frontage read exactly right.
- **Character error rate** over all signs.
- **Invention rate:** frontages where the reader returns text and gold says none,
  or returns a name that isn't on the building (the worst error).
- **Miss rate:** gold signs that the owner marked readable, which the reader didn't return.
- **Box IoU** in wall metres (not for R-gemini).
- Cost per frontage and seconds per frontage.
Overlay: the crop with the gold and reader boxes and texts, per frontage.

### S4: Look bake-off (integrator + owner)
Pick 12 frontages with correct text from the best reader: **Moeders, Dijkman and
Bakkerij Wolf**, plus at least 2 blade signs and 2 awnings. Render each 3 ways in the real game path (not an
isolated page, because of the Moeders bug): **A** the current generic band,
**B** a styled band (measured position, size, colours, case, font class), **C** a
rectified photo decal (only if S0's licence allows). Capture them at gameplay
camera distance on desktop and phone.
The owner grades each capture: "would this help me recognise the street?"
(yes / somewhat / no), "is the text readable?" (y/n), and picks a favourite per
frontage.

## 6. Decision rules (fixed now; don't change them after seeing results)

**D1, reader:** adopt the **cheapest local** reader (or local pair) that meets all of:

| Metric | Threshold |
| --- | --- |
| Main-name accuracy | ≥ 85 % |
| Invention rate | ≤ 3 % |
| Miss rate (readable signs) | ≤ 25 % |
| Box IoU ≥ 0.5 | ≥ 80 % of signs |
| Colour (fg/bg) within ΔE 15 of the owner-sampled colour | ≥ 70 % of signs (needed for D2's styled sign) |

If none meets all, no reader is adopted: the existing text stays as it is, and the
next step is a local fine-tune on the owner's labels, planned separately.

**D2, look:** adopt the option with the most "yes, helps me recognise" grades.
C wins over B only if it beats B by ≥ 20 percentage points, since a decal costs
texture memory and ties the look to one capture date. A is kept only if B
and C don't beat it.

**D3, policy:** decided by the owner (§1a): unreviewed, with provenance and
revocation. The labels are for choosing and testing models.

The D1 and D2 results are recorded in `HISTORY.md` with the numbers.

## 7. Routing and effort

| Task | Agent | Owner time |
| --- | --- | --- |
| S0 sample, crops, licence | DeepSeek | — |
| S1 labelling page | DeepSeek | ~20–25 min labelling |
| S2 R-ocr | DeepSeek | — |
| S2 R-vlm-local | Sonnet | — |
| S3 scoring | DeepSeek | — |
| S4 bake-off renders | integrator (touches shared bundles) | ~10 min grading |
| Decisions D1–D3 | integrator, with owner sign-off | — |

Waves: S0 → S1 (owner labels) and S2 in parallel → S3 → S4 → decisions.
Everything is local except the optional hosted reader.

## 8. Risks

- **The sample is from Da Costa / Jordaan only.** Canal-belt retail is similar;
  big-brand streets (Kalverstraat) are not. D1 then holds only for this
  kind of street. Widen the sample before any city-scale rollout.
- **Crops may cut signs.** Blade signs project off the wall plane and can fall
  outside a rectified wall crop. S0's contact sheet must show whether they're in
  frame; if not, add a crop with side margin.
- **Dated signs.** A correct 2021 reading of a shop that closed in 2024 is still
  a wrong landmark. The capture date is shown with the sign, and the newest view wins.
