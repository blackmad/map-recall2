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

### 1a. What the reader actually gets wrong — measured, 2026-09-25

The owner reports the OCR as terrible, with partial words from shadow and occlusion. Measured over 45
storefront crops in `da-costa-jordaan-v1`, that is the right diagnosis and it changes the order of
work below.

First, a correction to an assumption this plan was drafted under. `run_vision_ocr.ts` already defaults
to `tier = 'ground'` — 110 px/m over a 4.9 m band, against 45 px/m for the whole facade. Reading the
tighter crop is not an improvement waiting to be made; it is what produces the current output. A
measured full-tier comparison confirms the gap is real and already banked: **full 11/45 storefronts
read, ground 33/45.** So the partial words occur *at* 110 px/m, and more pixels is not the answer.

Second, preprocessing helps, but not in the way one would hope.
`scripts/facade-eval/prep-ocr-crops.ts` (3× Lanczos, CLAHE 64×64, mild sharpen) moves the numbers to
**38/45 storefronts and 158 lines, from 33/45 and 104 lines** — but inspection of the readings shows
the gain is mostly *more fragments*, not cleaner ones:

| crop | raw | prepared |
| --- | --- | --- |
| De Clercqstraat 70 | `Handwork Boutiqur` | `Handwork Boutique` ✅ **and** `Handwork Borfiaue` ❌ |
| De Clercqstraat 56 | `JEJU Korean Kitchen & Bar` | same, plus `MI T`, `TEJU`, `HET` |
| De Clercqstraat 64 | one `Infini®` | two `Infini®` |
| De Clercqstraat 54 | identical | identical |
| De Clercqstraat 76, 80 | empty | empty |

Third, and this is the finding worth building on: **the same sign is already read more than once
within a single image, with different errors each time.** `Handwork Boutiqur` and `Handwork Boutique`
and `Handwork Borfiaue` are three readings of one fascia — from the fascia itself, a window decal, an
awning valance. Elsewhere `NINAS` and `NINA'S` appear in one crop. The errors are independent because
they come from different physical instances of the same words under different light.

That makes this a consensus problem rather than a resolution problem. Taking the first or highest
confidence reading throws away the redundancy that is already present in every crop. Preprocessing is
then worth shipping *because* it raises fragment count: it feeds the vote. On its own, with a
first-reading consumer, it would make precision worse.

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

**S1. Fragment consensus — built, measured, and only half a success.**
*Reordered ahead of the invention measurement after §1a: the failure the owner sees is fragmentation,
not fabrication.* `src/canalRecall/facade/signConsensus.ts` clusters readings by string similarity
and glyph height, aligns them onto the longest, and votes per character weighted by confidence and
letter size. Placement stays per rectangle so two `Hotel` signs on one frontage remain two signs.

On the cases it was built for it is exactly right, recovering strings no single reading contained:

| readings | voted |
| --- | --- |
| `CLAIM NU OPI` · `CLAIM HU OP` · `LAIM NU OP` · `CLAIM NIP` · `CLAIMIOF` | `CLAIM NU OP` |
| `EERLIJK ETEN.NL` · `EERLIJK EMANL` · `LIJKETEN.NL` | `EERLIJK ETEN.NL` |
| `MAGAZINES GIFTS BIOKS` · `MAGAZINES GIFTS BOO` · `GIFTS BOOKS` | `MAGAZINES GIFTS BOOKS` |
| `DOUGLAS` · `FOUCLAS®` · `UGLAS` | `DOUGLAS` |
| `184` ×3 · `184H` ×3 | `184` |

**But over the whole cached corpus it is not yet a net win on text, and should not ship as an
automatic rewriter.** Across 1,980 reader lines from 559 buildings it emits 1,340 signs, of which 434
(32%) are corroborated by a second reading and 29 by a second view. It changes 24 strings: most are
improvements, several are regressions — `Scopes fentre` beat `ScooterCentre` because that crop
renders the wrong word larger, and the glyph-height weighting believed it.

The finding that matters for sequencing: **`agreement` does not separate the good changes from the
bad.** `Licherie` and `Exclusive` are both wrong at agreement 1.00, while the correct
`MAGAZINES GIFTS BOOKS` scores 0.79. So there is no confidence threshold that makes the rewrite safe,
and tuning further against no reference is how the earlier lanes in this project went wrong.

What to use it for now: **corroboration, not correction.** `support`, `views` and `years` are
trustworthy immediately and are precisely what S2 and the invention filter consume. Gate the text
rewrite behind S1c.

**S1c. The reference set — built, and it returned a negative result.**
`review-data/sign-gold/v1/transcriptions.json` holds four Da Costabuurt ground crops transcribed by
looking at them, without consulting reader output, so reference and subject are independent.
`scripts/facade-eval/score-sign-consensus.ts` scores against it, always reporting the vote *and* the
baseline a pipeline without a vote would publish — the longest reading in each cluster.

```
4 transcribed crops, 10 names to recover
  baseline   recovered  9/10   exact  5/10   invented  6/29
  consensus  recovered  9/10   exact  5/10   invented  6/29
```

**The vote ties the baseline.** It fixes `O TEM FA C` → `O TEM BA` and breaks
`ScooterCentre` → `Scopesfentre`, and those cancel. Co-location clustering — two readings within a
metre of each other get a looser string test, since where they sit is evidence independent of what
they say — merged more of each sign's fragments and cut inventions from 7 to 6, but moved neither
recovery number.

So the conclusion stands and is now measured rather than suspected: **ship `support` / `views` /
`years`, do not ship the rewritten text.** The honest reading of a tie is that the vote is not the
lever here.

Three things the reference set shows about where the real loss is, which matter more than tuning:

- **The reader misses whole signs.** `LA BASTA` came back only as `DASTA` and `PASTA` — both wrong on
  the same letter, so no vote over them can recover it. Redundancy only helps where errors are
  independent, and two readings of one small logo under one light are not.
- **The crop is often the limit, not the reader.** On the Freddy Fryday frontage the fascia panel
  crops the leading F, so `REDDY FRYDAY` is a *correct* reading of what is visible; the name is only
  recoverable from the hanging sign and the chip-cone, which are different rectangles. That is a view
  selection problem (§3), not a text problem.
- **OSM would have answered most of this outright.** Four of the ten names are on businesses OSM
  names. S2a is now the highest-value remaining step, not more voting.

**S1b. Measure the invention rate**, once consensus is in place, against the three reference shops on
Rozengracht and then the transcribed set. It still has never been measured and 307 unreviewed signs
are already live. But measure it on the output that would actually ship: the pre-consensus rate is a
number about a pipeline no longer proposed. If invention is rare after voting, tier 2 can be broad;
if common, tier 2 shrinks and tier 1 carries the weight.

**S2. Persistence index.** The same vote, widened from one image to every campaign year that saw the
frontage. Emit, per frontage, the set of consensus names and the years each was seen. Falls out as
both a notability ranking and an invention filter — and §1a is the evidence that the machinery works,
since cross-year voting is the within-crop vote with a longer baseline and more independent errors.

**S2a. Anchor on OSM names.** Where OSM carries a `name` for the address, the identity is known and
OCR's job shrinks to confirming the sign is there and locating its rectangle — a fuzzy match against
a one-element candidate list, which tolerates far more character error than free reading. Reserve
free reading for frontages OSM does not name.

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
