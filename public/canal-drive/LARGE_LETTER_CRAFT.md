# Large-letter postcard — craft gaps & attack plan

Compare current canvas output (Jordaan demo) against authentic linen cards
(Santa Claus / Monterey / Lexington / Custer / Hayward strip).

The mechanic works (per-letter photo windows + fake extrusion). The **souvenir
craft** does not yet.

---

## Gap list (ours → authentic)

1. **Place-true imagery**
   - Ours: fjord / canyon stock for “Jordaan”; letters and backdrop ignore Amsterdam.
   - Theirs: every letter and the backdrop are *about that place* (harbor, horses, Santa, Black Hills).

2. **Letter-face readability**
   - Ours: photos fight a heavy ghosted extrusion / perspective lean; windows feel muddy.
   - Theirs: faces are bright, clear vignettes with crisp outlines; extrusion stays *behind* the face.

3. **Extrusion as solid 3D, not striped smear**
   - Ours: long stepped offsets → candy-stripe depth, sometimes ghosting over the face.
   - Theirs: short, solid colored sides (often one hue) + clean black/white stroke; depth is a block, not a ladder.

4. **Outline language**
   - Ours: thick white rim, soft slate outer, easily lost in grain.
   - Theirs: strong black (or dark) outer stroke; face edge reads as a printed die-cut.

5. **Baseline / perspective**
   - Ours: aggressive canvas skew + deep dy → letters tip off-composition; shelf dominates the lower half.
   - Theirs: mild arch or rise; perspective is subtle; the *word* stays the hero, not the shadow.

6. **Backdrop role**
   - Ours: one competing full-bleed photo under everything.
   - Theirs: backdrop is thematic illustration/scene that *frames* the word (harbor, race, night sky) without stealing the letter windows.

7. **Secondary type**
   - Ours: two Pacifico scripts (greeting + caption) in similar weight.
   - Theirs: script “Greetings from” + **block** state/region line (INDIANA, CALIFORNIA) in a contrasting solid color.

8. **Decor / props**
   - Ours: none.
   - Theirs: sleigh, flags, gold nugget, emblems, snow caps — place theater around the word.

9. **Print finish**
   - Ours: uniform linen grid + flecks.
   - Theirs: litho saturation, softer paper edge, occasional thematic overlays (snow on letter tops).

10. **Composition density**
    - Ours: empty margins, word floating on a photo.
    - Theirs: packed souvenir layout — word + props + caption occupy the frame on purpose.

---

## Plan of attack (ordered)

### P0 — Stop looking broken
1. **Cap extrusion** — fewer steps, smaller `dy`, solid wall color (no orange/blue striping on sides); orange shelf only if it stays *under* the face.
2. **Kill face ghosting** — draw extrusion fully behind faces; no second translucent word over photos.
3. **Ease perspective** — mild arch/rise only; drop or heavily dial back `setTransform` skew until faces stay legible.
4. **Black outer stroke** — restore die-cut black outline; keep thin white inner rim.

### P1 — Read as a souvenir
5. **Caption typography** — region/city as condensed **block** caps (Barlow), not a second script.
6. **Backdrop wash** — lower backdrop contrast/opacity so letter windows win; or use a soft illustrated wash instead of a second competing photo.
7. **Per-letter photo contract** — API: `images.length === letterCount` (or explicit `perLetter: CanvasImageSource[]`); refuse silent cycling in craft checks.

### P2 — Place truth (product)
8. **Fixture packs per neighborhood** — N Wikimedia thumbs tagged to the place (canals, façades, bridges), not random picsum nature.
9. **Backdrop from the same pack** — one establishing shot; letters from detail shots.
10. **Optional prop layer** later (bike, canal boat silhouette) — after faces/extrusion are right.

### P3 — Gallery styles
11. Re-enable style presets only after P0/P1 look good on `linen-arch`.
12. Then: flat-block, rise-coastal, desert-warm as *palette + path*, not as excuses for broken extrusion.

---

## Check loop (agentic)

Run this every craft iteration. Stop when the vision checklist is mostly green
and automated checks pass.

### A. Automate (`npm run test:large-letter-craft`)

Geometric / contract guards (no eyeballing):

- Extrusion depth px ≤ 22% of card height
- Perspective skew magnitude below craft cap
- Caption baseline on-card (margin ≥ 28px from bottom)
- `imageStripCount` / per-letter: when `requirePerLetter`, `images.length >= nonSpaceGlyphs`
- Outline width in a readable band
- Style `linen-arch` pathAmount in [0.12, 0.28] (no wild arcs)

### B. Render

```bash
npm run render:large-letter-craft -- --round=3
# → .tmp/postcard-roundN/{id}.png + contact-sheet.png
# → .tmp/postcard-craft.png (Jordaan, pixel P0)
```

### C. Vision critique (LLM reads the PNG)

Score each item **pass / fail** against an authentic strip (or NARNIA):

| # | Criterion | Pass looks like |
|---|-----------|-----------------|
| 1 | Letter faces readable | Can name a subject in ≥5/7 letters |
| 2 | No ghosting on faces | Extrusion does not veil photo windows |
| 3 | Extrusion is a block | Solid side color; short depth; not candy stripes |
| 4 | Outline die-cut | Dark outer stroke clearly separates face from bg |
| 5 | Word is hero | Shadow / bg do not dominate the lower half |
| 6 | Type hierarchy | Script greeting ≠ block region line |
| 7 | Place coherence | (when fixtures are place-true) bg + letters match the name |

### D. Patch only failing rows

One batch of paint/style fixes → re-run A → B → C. Max 3 loops per session
unless faces are still unreadable (then keep going on P0 only).

### E. Done enough for integration

P0 + P1 green on craft checklist; place-true fixtures can follow on a data branch.
Game pop-in waits until then.

---

## Session log — 2026-09-06 (P0 paint loops)

### Automated
- `test:large-letter-postcard` + `test:large-letter-craft` pass
- Craft render → `.tmp/postcard-craft.png`

### Vision checklist C (after 3 paint loops)

| # | Criterion | Result |
|---|-----------|--------|
| 1 | Letter faces readable | **pass** — per-letter windows show distinct crops |
| 2 | No ghosting on faces | **pass** — extrusion stays behind faces |
| 3 | Extrusion is a block | **pass** — solid blue walls + short orange ribbed shelf |
| 4 | Outline die-cut | **pass** — black outer + white rim |
| 5 | Word is hero | **pass** — mild skew; shelf no longer owns the frame |
| 6 | Type hierarchy | **pass** — Pacifico greeting + Barlow block caption |
| 7 | Place coherence | **fail** — `amsterdam-*.jpg` fixtures are mislabeled nature stock (fjord/canyon), not Amsterdam |

### Paint changes this session
- Cap extrusion with visible walls (`14 × 1.5` dy, solid blue; orange only on far ~28%)
- Milder skew (`c ≈ -0.11`); tighter tracking (`-0.07em`)
- Black die-cut + thicker white rim; quieter distress over letter band
- Block region caption; quieter backdrop veil
- Loop 1 over-corrected to a flat drop-shadow — restored medium step size so walls read

### Next
- **P2:** replace fixture pack with place-true Wikimedia Amsterdam thumbs; backdrop from same pack
- Optional: slightly stronger letter overlap / litho saturation
- Game pop-in still deferred

---

## Session log — 2026-09-06 (excellence pass)

### Automated
- `test:large-letter-postcard` + `test:large-letter-craft` pass (incl. JPEG SOI guards)
- Craft render → `.tmp/postcard-craft.png`

### Vision checklist C

| # | Criterion | Result |
|---|-----------|--------|
| 1 | Letter faces readable | **pass** — canals, bridges, façades, night scenes |
| 2 | No ghosting on faces | **pass** |
| 3 | Extrusion is a block | **pass** — solid blue walls + thin orange ribbed shelf |
| 4 | Outline die-cut | **pass** |
| 5 | Word is hero | **pass** — washed canal backdrop |
| 6 | Type hierarchy | **pass** — script + chrome-yellow block caption |
| 7 | Place coherence | **pass** — Jordaan/Amsterdam Wikimedia pack |

## Session log — 2026-09-06 (billboard scale loop)

### Problem
Lettering read as a mid-band strip (~128px cap) — not souvenir billboard mass.

### Changes
- Fit prefers max height then width-fill (`NAME_MAX_FRAC` 0.68, stretch/compress band)
- Edge-tight side pads; paint bulk `scale(1.28, 1.4)` with lower pivot
- Per-glyph extrusion (avoids blue-slab when tracking is tight)
- Thinner outlines so photo windows stay open
- Craft guards: font ≥45%H, visual mass ≥60%H after paint scale, span ≥90% band

### Layout (browser craft render)
`font≈214px stretch≈0.88` → ~75%H visual mass after paint scale (was ≤128px / ~32%H).

### Next optional
Stronger vanishing-point extrusion (true side faces), slightly less condensed face.

## Session log — 2026-09-06 (three vision rounds, no size circle)

Froze fill / clip / `pathAmount` / letter-reach knobs. Gallery:
Jordaan linen, Noord flat, IJburg rise, Oud-West desert, Sloterdijk long,
De Pijp fallback. Refs: Indiana, Waterloo, Athletics/Alaska.

### Round 1 — extrusion + die-cut

Paint a solid back silhouette + two facets (~23–31px single-line, under 22%H).
Black outer + hairline white inner so the wall is the side, not a cyan outline.

| # | Criterion | Result |
|---|-----------|--------|
| 1 | Extrusion is a block | **pass** — rust/blue/navy shelves read as walls |
| 2 | Die-cut | **pass** — dark outer, no cyan tire |
| 3 | Faces readable | **pass** |
| 4 | Type hierarchy | **pass** |
| 5 | Greeting nest | **fail** — script still a reserved-air sticker |
| 6 | Word is hero | **pass** |
| 7 | Style variety | **pass** — navy / maritime / terracotta differ |

### Round 2 — type + greeting park

Allowed script onto the left crests; stopped shoving the billboard down.
Caption stayed chrome-yellow, slightly heavier.

| # | Criterion | Result |
|---|-----------|--------|
| 1–4, 6–7 | held | **pass** |
| 5 | Greeting nest | **fail** — still reads above J / IJ / O, not Waterloo-in-the-tops |

Did not take a second greeting pass (that is the old circle).

### Round 3 — print finish + style read

Letter-window litho (`saturate 1.78 / contrast 1.4`); quieter canal wash
(`backdropAlpha` ~0.16–0.18 + cream veil); stronger paper linen. Stop.

| # | Criterion | Result |
|---|-----------|--------|
| 1 | Extrusion is a block | **pass** |
| 2 | Die-cut | **pass** |
| 3 | Faces readable | **pass** (De Pijp solid fill is the no-image story) |
| 4 | Type hierarchy | **pass** |
| 5 | Greeting nest | **fail** — same as round 2; left listed |
| 6 | Word is hero | **pass** — wash is paper, not a competing photo |
| 7 | Style variety | **pass** — beige linen / grey flat / blue rise / sandy desert |

### Remaining (do not chase this session)
True vanishing-point side faces; Waterloo-tight greeting nest; place props.

## Session log — 2026-09-06 (fill bigger)

User catch after the three vision rounds: still too much linen. Cause was
padded face AABB (`archPad * 1.15`), not a timid target. Tightened metrics,
raised fill band to 60–78%, shrank the greeting reserve.

Jordaan pixel: span 44%→64%, reach 71%→75%, topInk=0. Gallery in
`.tmp/postcard-round4/`.
