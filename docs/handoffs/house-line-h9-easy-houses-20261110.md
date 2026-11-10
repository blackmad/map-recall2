# Lane H9: the user's "easy houses" — right colour and shape (2026-11-10)

User, 2026-11-10, on `map-recall2-screenshots/whats-new/2026-11-10-facade-extras.jpg` (photo | before | after, 10 rows): "these are good examples of houses that I think should be easy to model but are currently wrong shape and color". Opus. Starts now (needs H1 on main; uses H2/H2c preview when merged, ride frames meanwhile). This is the house line's first user-named acceptance set.

## The set (named regression locations)
The 12 pands and 19 cameras in `map-recall2-screenshots/buildings/2026-11-10-register-extras/cams.json` (Langestraat 175320, 175318, 168136; Nieuwmarkt 182857 + row 182849/171851/171854/182848; Herengracht/Raadhuisstraat 176312, 176346, 169116, 168578; Vijzelstraat 180181, 167483, 171023). Pin them as `easy-houses` spots in `tests/e2e/demo-shots.spec.ts` (desktop DPR 2 + phone) and as a `house:preview` batch list (`scripts/house-specs/sets/easy-houses-20261110.json`).

## What the sheet shows (my read; verify each)
- **Colour family is wrong, not just brightness.** Near-black painted brick (Langestraat rows, the canal row) renders as white plaster or orange-red brick; pale salmon brick with white bands (Nieuwmarkt step gables) renders dark maroon; brown brick (Herengracht corners, Vijzelstraat) renders maroon or orange. The generic path paints period/BAG colours; measured walls are held (`SPEC_WALLS_HELD`, H1) because raw measured hex darkened Kinkerstraat against the user's brighter-palette priority (2026-10-16).
- **Shape is wrong.** Neck/bell/step gables render as flat cornice boxes (canal row, Langestraat); storey count and window rhythm too coarse (photo: tall sashes, 3 bays; game: fewer, squat); the Vijzelstraat arcade (row 10) is one building with a continuous glazed canopy, the game draws separate narrow fronts; the Vijzelstraat corner has gables/turret, the game a flat box.

## Step 0 — measure per pand (report first)
For each of the 12: route the game draws (generic/spec/installed), spec fields present and their sources (H1 extract), register gable/finish, `planRoof` outcome (accepted or which rule rejected), BAG storeys vs photo storeys, measured wall hex (H2c `measureFacade` on the cams' photo crop) vs rendered hex. One table: which defect has which cause. No code before this table.

## Step 1 — colour: measured family through the look lift
Replace the hold with a rule, not a revert: the spec wall colour reaches the game as the **measured colour family and relative darkness**, lifted by the city look (`look/` palette lift used for period walls), so a near-black painted front is the darkest front in its row but not black, pale brick stays pale, white plaster stays white. Write it as one typed function (`houseSpec/wallColour.ts`: measured OKLab → look-lifted sRGB, with the lift constants in one place) behind `?specWalls=0`. Gate on both: this set's rows look right side by side with the photos, **and** Kinkerstraat 244–332 (H1's frames) is not darker than today by more than ΔL 0.03 mean. If the two conflict, show both sheets and stop: the user rules.

## Step 2 — shape, per cause from step 0
Fix in the spec/describe path, not per house: register or measured gable reaching the generic roof when `planRoof` accepts the footprint; storeys from photo crop (H2c openings) over BAG when they disagree; bays from the crop. The arcade building: the kit may not say "continuous canopy across one wide front" — record it as `schemaLimits {component: 'pui', what: 'continuous glazed canopy'}` and leave it for the H6 queue unless it is one existing component away. Every limit you hit goes on the spec, typed.

## Gate (likeness, not checks)
The user's sheet re-made with a fourth column "after H9": photo | before | after(a1) | after(H9), same cameras, plus `house:preview --photo` compare sheets for the 12 with `measureFacade` before/after. Colour family right on all 12; gable right where the register or the crop shows one; storeys within ±0 and bays within ±1. `world:compile` changes only the cells holding these pands (plus the colour rule's city-wide effect, reported as a count of pands whose wall changes and a 24-pand random sheet). `check:canal` green.

## Documentation
`docs/house-line.md`: §1 gains the wall-colour rule and its flag; the easy-houses set is listed as the line's standing acceptance set (re-run it on every look or spec change). HISTORY text: the rule and why (user's sheet, brighter-palette constraint).

## Rules
`LANE-RULES.md`; `/usr/bin/git`; own worktree + port; link `node_modules`; browser runs under `/tmp/canal-pw.sh`; staging first; no edits to `game.js`, `index.html`, lockfiles, `TODO.md`, `HISTORY.md`; hand back SHA, step-0 table, the four-column sheet, the Kinkerstraat check, the city-wide colour count + sheet, the kit-cannot-say list, and TODO/HISTORY/What's New text.
