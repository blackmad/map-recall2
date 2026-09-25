# Photographing signs

How the game gets the real signage of notable Amsterdam businesses — Moeders, Dijkman, Bakkerij Wolf
and their kind — onto the buildings they belong to.

This plan supersedes the sign-rendering half of `SIGNAGE_EXPLORATION_PLAN.md`. That document's
decisions stand (D1 local readers only, D3 signs may ship unreviewed with provenance and
revocation); what changes is the answer to D2, how a sign should *look*.

---

## The reframe

**Do not reproduce signs. Photograph them.**

Font classification was assessed and rejected (D7), and that was the right call: recognising a
typeface and re-rendering it produces an approximation of something we already have a picture of.
Meanwhile what ships today is worse than an approximation — `cityAppearanceMachineSigns.ts` draws
every one of the 307 live signs as the same canvas texture, `#25372e` background, `#e7e5d9` text,
Arial 700 44px, truncated at 28 characters. Every shop in Amsterdam is currently a dark green band
with different words on it.

The render path for the real thing already exists and is live. `studyFacadesBrowser.ts` handles
`kind: 'observed-physical-sign'` by UV-mapping an actual photo crop onto source-bound geometry,
carrying `sourceSha256`, `physicalSignId`, `observationId` and `captureDate`. Nothing needs building
to *display* a photographed sign. What is missing is the pipeline that produces good crops.

So the problem becomes **locate a rectangle and cut it cleanly**, which is tractable, rather than
**recognise and re-synthesise**, which is not. It also satisfies "only ship what is measured" in the
strongest available sense: the sign is the photograph.

---

## Three tiers

| tier | what renders | when |
| --- | --- | --- |
| **1 — photographed** | a real crop of the sign, UV-mapped | a view clears the quality bar in §3 |
| **2 — reconstructed** | OCR text on a fascia whose colours are *measured from the pixels* | text is confident but no view is good enough to photograph |
| **3 — nothing** | a blank fascia, or no sign | everything else |

Tier 2 is not the current generic band. A sign is small, flat and high-contrast, so its fascia colour
and letter colour are among the *easiest* things in this project to measure — far easier than a wall,
which is why this is worth doing even though the typeface will be wrong. A dark green fascia with
gold lettering reads as a bruin café even in the wrong face; the right face on a wrong-coloured band
reads wrong.

Tier 3 is a real answer. A blank fascia on a real address beats an invented business name.

---

## 1. Locating the sign

Three signals compose, and all three already exist:

- **OCR bounding boxes.** The local Apple Vision reader returns boxes, not just strings. That is the
  anchor, and it makes this an *anchored* search rather than the unanchored one that has been failing
  in `facadeBands`.
- **The fascia edges**, from the colour step around that box. Same band machinery, but anchored and
  horizontal, which is a far easier problem than finding a ground floor blind.
- **The metric prior.** A fascia sits roughly 2.5–4.5 m above pavement. `metricFrame` in
  `public/data/wall-colour/v1/sample.json` converts rows to metres above ground.

The shopfront's own vertical extent, once `facadeBands` works, narrows this further — the fascia is
normally the top of the shopfront band. But this does not block on that: OCR boxes plus the metric
prior are enough to start.

## 2. Which businesses are notable — the part that needed thinking

The idea worth building: **temporal persistence**, computed from imagery we already hold.

The panorama archive covers the same frontages across multiple campaign years; the track-datum solve
was built on co-located frames from different years, so repeat coverage is established fact. Run OCR
on the same shopfront across every campaign that saw it. A name recurring across years is an
established business; a name appearing once is a shop that opened last year, or an OCR hallucination.

The property that makes this worth doing: **the same signal filters invention and measures notability
at once.** The evidence that "Moeders" is notable is the same evidence that the reading is real.
Nothing else available here does both.

Cross-check against OSM `name` tags where present, and against the owner's own list.

## 3. What "high quality" means — view selection is the actual work

Per candidate view of a located sign, score:

- **pixels per metre across the sign rectangle** — the binding constraint, because signs are small
  and a distant oblique view is mush;
- **obliquity** — head-on beats 40°;
- **occluder fraction over the rectangle** — from the Vistas label map, class 3; a van, a pedestrian,
  an awning shadow;
- **exposure** — neither blown nor crushed;
- **recency** — businesses change, so the most recent adequate view wins over an older better one
  within a tolerance.

Take the best. **Abstain if none clears the bar**, and drop to tier 2. Abstention is the discipline
that has made every other part of this project trustworthy.

## 4. The gate that must be answered before tier 1 ships

Using panorama imagery as *measurement input* is a different licensing posture from shipping it as a
*texture inside a distributed game*. `landmarks/signatureModels.ts` already carries an unresolved
licence question in its own comments, and `CITY_RECONSTRUCTION_REVIEW.md` records the historic
panorama licence audit as incomplete.

Tier 1 is the tier that turns photographs into distributed assets. That question is a blocker for
tier 1 specifically, and it does not block tiers 2 and 3, which ship measurements rather than
imagery. Answer it before building the crop publisher, not after.

---

## Order of work

**S1. Measure the OCR invention rate.** Against the three reference shops on Rozengracht first, then
a labelled sample. This has never been measured and 307 unreviewed signs are already live. The number
decides everything downstream: if invention is rare, tier 2 can be broad; if common, tier 2 shrinks
and tier 1 carries the weight. Cheapest step, largest consequence — do it first.

**S2. Persistence index.** OCR the same frontages across campaigns; emit, per frontage, the set of
names read and the years each was seen. Falls out as both a notability ranking and an invention
filter.

**S3. Sign localisation.** OCR box → fascia rectangle, in metres, with abstention. Score against
hand-drawn rectangles on a sample; this is where a labelling pass is genuinely needed and where the
owner's time is best spent.

**S4. View selection and crop publication.** The §3 scorer, then cut and publish crops bound to
`sourceSha256`. **Gated on §4.**

**S5. Tier 2 reconstruction.** Measured fascia and letter colour, OCR text, a small set of layout
archetypes. Independent of the licence gate, so it can proceed while §4 is unresolved.

## Verification

- Owner recognition check on the three Rozengracht references: does the rendered shopfront read as
  that shop while cycling past it?
- Invention rate reported as a number, per tier, before anything ships.
- Every published sign carries `sourceSha256`, `captureDate` and a revocation path, as the existing
  `observed-physical-sign` contract already requires.
