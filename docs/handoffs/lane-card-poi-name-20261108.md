# Lane: the building card names a building its POI label already names (user shot 2026-11-08)

Worktree `/Users/blackmad/Code/map-recall2-worktrees/card-poi-name-20261108`, branch `lane/card-poi-name-20261108` from `main` (11cbb47a7 or later), port 4673. Issue #258. Model: opus. Rules: `docs/handoffs/LANE-RULES.md`.

The user, on the live build 7cda9af: "why named but has no data?" Shot: `blackmad/map-recall2-screenshots` `user-shots/2026-11-08/gurdwara-label-empty-card-sloterdijk.png`. At Sloterdijk (Transformatorweg / Condensatorweg) the POI label "Shri Guru Nanak Gurdwara Sahib" stands on a hall; tapping that hall opens the BUILDING card with the title "SHRI GURU NANAK GURDWARA SAHIB" and the body "This building has no name or date in the map data." So the card already resolves the name (the label's record, or the POI inside the footprint) for its title but the body is written from the pand's own facts only (`src/canalRecall/buildingFacts.ts describeBuilding`, line ~178 is the fallback sentence). The title and the body contradict each other, and a player reads "no name" under a name.

## What is wanted

1. **Find how the title got the name** (the label's POI record passed to the card, or a POI-in-footprint lookup) and make the body use the same source: when the pand has no name or date, but a POI with a name sits in or on the footprint, the body says what the place is from the POI's tags (`amenity=place_of_worship` + `religion=sikh` → "Sikh gurdwara", `shop`, `office`, `leisure`, `tourism`, `school`, the usual OSM kinds; translate the kind to plain English, keep the original name), and the year or architect if the POI or the building facts have one. Keep the "no name or date" sentence only when neither the building nor any POI on it says anything.
2. **Every branch tested** in `buildingFacts.test.ts` (or beside the module that composes the card): pand with name; pand without name + POI with name and kind; pand without name + POI with name and no kind; pand without name + no POI; a POI whose name equals the pand's name (no duplication); a landmark card is unchanged.
3. **Check the card both ways on the page**: the Gurdwara at Sloterdijk, a named canal house, a nameless house with no POI, a landmark (Hortus). Desktop and phone layouts (long names: "Canal Ring Area of Amsterdam inside the Singelgracht" is a real one). Storybook: add the new card state (desktop + mobile) if the card has stories.
4. **Strips** to `blackmad/map-recall2-screenshots` `ui/2026-11-08-card-poi/`: before | after at the Gurdwara. **What's New text**, e.g. "Tapping a named place now tells you what it is, even when the building record itself is blank."

## Fences

Yours: `src/canalRecall/buildingFacts.ts` and its test, the card composition module the title comes from (name it in the hand-back), Storybook stories for the card. Not yours: `game.js`, `index.html`, `package.json`, bundles, `TODO.md`, `HISTORY.md`, `whats-new-notes.json`, extracts. If the fix needs a line in `game.js`, write it in the hand-back as a patch for the integrator.

## Hand back here

Branch + SHA (pushed, merged with `origin/main`); where the title's name came from; the new body rule; tests joined; the four page checks; strip paths; which bundles to rebuild; What's New text; what is still open. Then stop; the integrator merges.

Rules: `docs/handoffs/LANE-RULES.md`. `/usr/bin/git` only, never `git stash`, never `pkill` (stop your server with `kill $(lsof -t -iTCP:4673 -sTCP:LISTEN)`), one Playwright run at a time via `/tmp/canal-pw.sh` (`PW_PORT=4673`); the push under `CANAL_PW_EXCLUSIVE=1 /tmp/canal-pw.sh`. Wait on background commands in the foreground. Budget: about 60 turns.
