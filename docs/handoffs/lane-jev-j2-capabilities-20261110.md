# Lane J2: what else is Jev good at for us? (2026-11-10)

User, 2026-11-10: "keep seeing what Jev is good at for our needs". Sonnet. Offline spike: no game data changes. Budget **$5** of Jev, spend printed per question family; key only from the login environment (`zsh -lic`), never searched, printed, logged or cached.

## What we already know (do not re-test)
J1 (#326, `docs/reviews/jev-facades-spike-20261110.md`): bays ±1 100 %, shopfront 85 % (owns it with review), gable 66–68 % (only cornice and step reliable; confident-only 42 % coverage), finish 85 % (plaster vs painted brick confused), bands/basement/dormer below baseline. H4c (#339): crop-quality judge AUC 0.89–0.95, precise at 0.5 but too strict on dark narrow canal fronts. H5 (#346): Jev cornice contradicts the register on canal fronts 5/8.

## Truth sets
- J1's 50 fronts (`map-recall2-source-data/experiments/jev-facades-20261110/`).
- H4's 150 labelled AB07 crops with the Fable label fixes (#339).
- H5h's 80 photo-read pands (#351) as soon as they land; re-score every family on them.
- For likeness questions: H2 `house:preview --photo` compare pairs (render + photo) for the 12 easy-houses pands and Nassaukade.

## Question families to test (each: accuracy vs truth, both-runs agreement, hedging rate, cost per answer, and a verdict own / filter / no)
1. **Colour family by swatch picture-choice.** 8 swatches (near-black painted, dark brown brick, red-brown brick, orange brick, pale salmon brick, tan/yellow brick, white plaster, grey stone). Truth: H5h colour family + H2d `measureFacade` houseLine. Main question: does Jev correct pixel errors from shadow and white balance (the thing pixels get wrong), or only repeat them?
2. **Window head shape** per storey: flat, segmental, round arch, pointed. (User priority: window kind/head per storey.)
3. **White accents**: yes/no for white bands (speklagen), white window surrounds, keystones, quoins, white cornice. Include real dark-frame negatives this time.
4. **Occlusion** per crop: scaffold, van/truck, tree trunk, bare branches, parked boat, as separate yes/no (feeds H4's picker; compare against the current flags).
5. **Same facade across years**: picture-choice between two years' crops of one pand: "same paint and shopfront?" (gates cross-year occluder masking).
6. **Hoist beam, stoop, souterrain entrance, bay window (erker), balcony** yes/no, plus Box with a yes/no guard for the door and the shopfront.
7. **Likeness judge**: given photo + 3 renders (today's game, the spec render, a decoy from a neighbour), "which render matches the photo best" and a 1–5 score. Truth: Fable/opus picks on the same triples (I will label 30). If it works, it is a cheap second opinion next to `measureFacade` in house:preview.
8. **Dormer and basement, reworded** per J1's open list ("a window in the roof slope, not inside a gable"; "windows below street level").
9. **Gable without reference images** (5× cheaper) and with a cropped crown-only image, to see whether bell vs neck vs plain improves.

## Deliverable
`scripts/jev/j2/*` (question fixtures as JSON so they are reviewable), a report `docs/reviews/jev-capabilities-j2-20261110.md` with one table (family → accuracy, baseline, agreement, hedging, $/1k, verdict), the worst-ten sheet per family in the screenshots repo, raw responses archived to source-data. A one-paragraph recommendation: which families H5 should wire in, behind which thresholds.

## Rules
`LANE-RULES.md`; `/usr/bin/git`; own worktree; link `node_modules`; no browser except reusing archived renders; stop on any 401/403, never retry auth; no edits to `game.js`, `index.html`, `package.json`, lockfiles, `TODO.md`, `HISTORY.md`; hand back SHA, the table, the sheets, spend, and TODO/HISTORY text. Memory `jev-typed-judge` gets the new numbers from the integrator.
